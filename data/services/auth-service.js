import { db } from '../../firebase-config.js';
import { collection, query, where, getDocs } from "firebase/firestore";

export const getPermisosUsuario = async (email) => {
    if (!email) return null;
    try {
        const qPub = query(collection(db, "publicadores"), where("telefono", "==", email));
        let snap = await getDocs(qPub);
        if (snap.empty) {
            const qEmail = query(collection(db, "publicadores"), where("email", "==", email));
            snap = await getDocs(qEmail);
        }
        if (!snap.empty) {
            const data = snap.docs[0].data();
            const isAdmin = data.privilegios?.includes('Administrador');
            if (data.es_conductor || isAdmin) {
                return { role: isAdmin ? 'Administrador' : 'Conductor', ...data, id: snap.docs[0].id };
            }
        }
        const qLegacy = query(collection(db, "conductores"), where("email", "==", email));
        const snapLegacy = await getDocs(qLegacy);
        if (!snapLegacy.empty) {
            const data = snapLegacy.docs[0].data();
            return { role: data.role || 'Conductor', ...data };
        }
        return null;
    } catch (e) {
        console.error("Error getting permissions:", e);
        return null;
    }
};
