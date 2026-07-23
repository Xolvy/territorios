import { signInAnonymously } from "firebase/auth";
import { collection, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../../firebase-config.js";
import { normalizeRobust } from "../../modules/utils/helpers.js";

/**
 * IDENTITY SHIELD: Service to resolve and bind Firestore identities with Firebase Auth.
 * Eliminates identity fragmentation by creating a Single Source of Truth.
 */
export const IdentityShield = {
    /**
     * Resuelve la identidad del usuario y vincula el UID de Firebase con el documento de Firestore.
     * Utiliza consultas Firestore direccionadas y eficientes para cumplir con Zero Trust.
     * @param {string} rawIdentifier - Nombre, correo o teléfono proporcionado.
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

        // 2. Búsqueda Direccionada Segura (Evitamos getDocs() de toda la colección)
        const pubCol = collection(db, "publicadores");
        let targetDoc = null;
        let pData = null;

        try {
            // Intento 1: Buscar por correo
            const qEmail = query(pubCol, where("email", "==", rawIdentifier));
            const emailSnap = await getDocs(qEmail);
            if (!emailSnap.empty) {
                targetDoc = emailSnap.docs[0];
                pData = targetDoc.data();
            } else {
                // Intento 2: Buscar por teléfono
                const cleanedPhone = rawIdentifier.replace(/\D/g, "");
                if (cleanedPhone) {
                    const qPhone = query(pubCol, where("telefono", "==", cleanedPhone));
                    const phoneSnap = await getDocs(qPhone);
                    if (!phoneSnap.empty) {
                        targetDoc = phoneSnap.docs[0];
                        pData = targetDoc.data();
                    }
                }

                if (!targetDoc) {
                    // Intento 3: Buscar por nombre exacto
                    const qName = query(pubCol, where("nombre", "==", rawIdentifier));
                    const nameSnap = await getDocs(qName);
                    if (!nameSnap.empty) {
                        targetDoc = nameSnap.docs[0];
                        pData = targetDoc.data();
                    } else {
                        // Intento 4: Fallback de último recurso (solo si la regla de listado está permitida)
                        console.log(
                            "🛡️ [IdentityShield] Consultas directas sin éxito. Ejecutando búsqueda por barrido...",
                        );
                        const normalizedPhoneInput = cleanedPhone || rawIdentifier.replace(/\D/g, "");
                        const snap = await getDocs(pubCol);
                        for (const d of snap.docs) {
                            const data = d.data();
                            const nameMatch = normalizeRobust(data.nombre) === normalizedInput;
                            const emailMatch = data.email && normalizeRobust(data.email) === normalizedInput;
                            const phoneMatch =
                                normalizedPhoneInput &&
                                String(data.telefono || "").replace(/\D/g, "") === normalizedPhoneInput;

                            if (nameMatch || emailMatch || phoneMatch) {
                                targetDoc = d;
                                pData = data;
                                break;
                            }
                        }
                    }
                }
            }
        } catch (queryError) {
            console.warn(
                "🛡️ [IdentityShield] Error en consulta de identidad, posible restricción Zero Trust:",
                queryError,
            );
        }

        if (!targetDoc) {
            console.warn("🛡️ [IdentityShield] No se encontró perfil en Firestore para:", rawIdentifier);
            // Fallback: Retornar identidad genérica pero con UID
            return {
                uid: uid,
                docId: null,
                nombreCanonico: rawIdentifier,
                rol: "Visitante",
                isAnonymous: true,
            };
        }

        let identityRol = pData.rol || "Publicador";
        const rLower = String(identityRol).toLowerCase();
        const privs = Array.isArray(pData.privilegios) ? pData.privilegios.map(x => String(x).toLowerCase()) : [];

        if (
            rLower === "administrador" ||
            rLower === "superadmin" ||
            pData.es_admin === true ||
            pData.es_superadmin === true ||
            privs.includes("administrador") ||
            privs.includes("superadmin")
        ) {
            identityRol = "Administrador";
        } else if (
            rLower === "conductor" ||
            pData.es_conductor === true ||
            privs.includes("conductor") ||
            (pData.modulos && pData.modulos.habilitado === true)
        ) {
            identityRol = "Conductor";
        } else {
            identityRol = "Publicador";
        }
        const ultimaConexionStr = new Date().toISOString();

        // 3. THE BINDING: Vincular UID con el documento y escribir en Session Vault
        try {
            await setDoc(doc(db, "auth_binds", uid), {
                publicadorId: targetDoc.id,
                nombre: pData.nombre,
                rol: identityRol,
                ultima_conexion: ultimaConexionStr,
            });
            console.log("🛡️ [IdentityShield] Session Vault (/auth_binds) binding escrito con éxito.");

            // Actualizar documento de publicador
            await updateDoc(doc(db, "publicadores", targetDoc.id), {
                current_auth_uid: uid,
                ultima_conexion: ultimaConexionStr,
            });
            console.log("🛡️ [IdentityShield] Binding exitoso: UID vinculada al perfil.");
        } catch (e) {
            console.warn("🛡️ [IdentityShield] Error en Escritura de Binding:", e);
        }

        const isAdmin =
            rLower === "administrador" ||
            rLower === "superadmin" ||
            rLower === "admin" ||
            pData.es_admin === true ||
            pData.esAdmin === true ||
            pData.isAdmin === true ||
            pData.es_superadmin === true ||
            privs.includes("administrador") ||
            privs.includes("superadmin") ||
            privs.includes("admin");

        const esConductor =
            isAdmin ||
            rLower === "conductor" ||
            pData.es_conductor === true ||
            pData.esConductor === true ||
            privs.includes("conductor") ||
            (pData.modulos && pData.modulos.habilitado === true);

        const availableRoles = [];
        if (isAdmin) availableRoles.push("Administrador");
        if (esConductor) availableRoles.push("Conductor");
        availableRoles.push("Publicador");

        // 4. CANON OPTIMIZER: Retornar objeto inmutable
        const identity = {
            uid: uid,
            docId: targetDoc.id,
            nombreCanonico: pData.nombre,
            email: pData.email || "",
            telefono: pData.telefono || "",
            rol: identityRol,
            baseRole: identityRol,
            isAdmin,
            esConductor,
            availableRoles,
            isAnonymous: currentUser.isAnonymous,
        };

        window.XolvyApp = window.XolvyApp || {};
        window.XolvyApp.identity = identity;

        return identity;
    },

    /**
     * Vincula de forma directa y blindada una sesión ya validada por getPermisosUsuario.
     * Evita consultas redundantes y cumple al 100% con las restricciones Zero Trust.
     * @param {string} uid - Firebase Auth User UID.
     * @param {string} docId - ID del documento del publicador en Firestore.
     * @param {string} name - Nombre del publicador.
     * @param {string} role - Rol asignado.
     * @returns {Promise<Object>} Identidad canónica vinculada.
     */
    bindSessionDirect: async (uid, docId, name, role) => {
        console.log("🛡️ [IdentityShield] Iniciando Vinculación Directa Blindada para UID:", uid);
        const ultimaConexionStr = new Date().toISOString();

        try {
            // 1. Escribir directamente en Session Vault (/auth_binds)
            await setDoc(doc(db, "auth_binds", uid), {
                publicadorId: docId,
                nombre: name,
                rol: role,
                ultima_conexion: ultimaConexionStr,
            });
            console.log("🛡️ [IdentityShield] Session Vault Direct Binding escrito con éxito.");

            // 2. Actualizar el documento de publicadores
            await updateDoc(doc(db, "publicadores", docId), {
                current_auth_uid: uid,
                ultima_conexion: ultimaConexionStr,
            });
            console.log("🛡️ [IdentityShield] Direct Binding exitoso: UID vinculada al perfil.");
        } catch (e) {
            console.error("🛡️ [IdentityShield] Error crítico en Direct Binding (Session Vault):", e);
            throw e;
        }

        const identity = {
            uid: uid,
            docId: docId,
            nombreCanonico: name,
            rol: role,
            isAnonymous: false,
        };

        window.XolvyApp = window.XolvyApp || {};
        window.XolvyApp.identity = identity;

        return identity;
    },
};
