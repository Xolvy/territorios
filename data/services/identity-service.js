import { auth, db } from '../../firebase-config.js';
import { signInAnonymously } from "firebase/auth";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { normalizeRobust } from '../../modules/utils/helpers.js';

/**
 * IDENTITY SHIELD: Service to resolve and bind Firestore identities with Firebase Auth.
 * Eliminates identity fragmentation by creating a Single Source of Truth.
 */
export const IdentityShield = {
    /**
     * Resuelve la identidad del usuario y vincula el UID de Firebase con el documento de Firestore.
     * @param {string} rawIdentifier - Nombre o teléfono proporcionado en el login local.
     * @returns {Promise<Object>} Identidad canónica y blindada.
     */
    resolveAndBindIdentity: async (rawIdentifier) => {
        console.log("🛡️ [IdentityShield] Iniciando resolución para:", rawIdentifier);

        // 1. Garantizar Auth (Anonymous)
        let currentUser = auth.currentUser;
        if (!currentUser) {
            console.log("🛡️ [IdentityShield] Auth no detectado. Solicitando sesión anónima...");
            const cred = await signInAnonymously(auth);
            currentUser = cred.user;
        }

        const uid = currentUser.uid;
        const normalizedInput = normalizeRobust(rawIdentifier);

        // 2. Búsqueda Robusta en Firestore (Publicadores)
        const pubCol = collection(db, "publicadores");
        const snap = await getDocs(pubCol);
        
        let targetDoc = null;
        let pData = null;

        // Búsqueda exhaustiva para evitar fallos por tildes/espacios
        for (const d of snap.docs) {
            const data = d.data();
            const nameMatch = normalizeRobust(data.nombre) === normalizedInput;
            const phoneMatch = data.telefono && String(data.telefono).replace(/\D/g, '') === rawIdentifier.replace(/\D/g, '');
            const emailMatch = data.email && normalizeRobust(data.email) === normalizedInput;

            if (nameMatch || phoneMatch || emailMatch) {
                targetDoc = d;
                pData = data;
                break;
            }
        }

        if (!targetDoc) {
            console.warn("🛡️ [IdentityShield] No se encontró perfil en Firestore para:", rawIdentifier);
            // Fallback: Retornar identidad genérica pero con UID
            return {
                uid: uid,
                docId: null,
                nombreCanonico: rawIdentifier,
                rol: 'Visitante',
                isAnonymous: true
            };
        }

        // 3. THE BINDING: Vincular UID con el documento
        try {
            await updateDoc(doc(db, "publicadores", targetDoc.id), {
                current_auth_uid: uid,
                ultima_conexion: new Date().toISOString()
            });
            console.log("🛡️ [IdentityShield] Binding exitoso: UID vinculada al perfil.");
        } catch (e) {
            console.warn("🛡️ [IdentityShield] Error en Binding (posiblemente falta permiso de escritura):", e);
        }

        // 4. CANON OPTIMIZER: Retornar objeto inmutable
        const identity = {
            uid: uid,
            docId: targetDoc.id,
            nombreCanonico: pData.nombre,
            email: pData.email || '',
            telefono: pData.telefono || '',
            rol: pData.privilegios || (pData.es_conductor ? 'Conductor' : 'Publicador'),
            isAnonymous: currentUser.isAnonymous
        };

        window.XolvyApp = window.XolvyApp || {};
        window.XolvyApp.identity = identity;
        
        return identity;
    }
};
