import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase-config.js";

export const getPermisosUsuario = async (email) => {
    if (!email) return null;
    try {
        const qPub = query(collection(db, "publicadores"), where("telefono", "==", email));
        let snap = await getDocs(qPub);
        if (snap.empty) {
            const qEmail = query(collection(db, "publicadores"), where("email", "==", email.toLowerCase()));
            snap = await getDocs(qEmail);
        }

        let matchedDoc = null;
        let matchedData = null;

        if (!snap.empty) {
            matchedDoc = snap.docs[0];
            matchedData = matchedDoc.data();
        } else {
            // Sweep fallback for case-insensitive or formatted queries
            console.log("🛡️ [Auth] Búsqueda directa sin resultados en getPermisosUsuario. Iniciando barrido...");
            const normalizedEmailInput = email.toLowerCase().trim();
            const cleanInputPhone = email.replace(/\D/g, "");
            const allPubsSnap = await getDocs(collection(db, "publicadores"));

            for (const docObj of allPubsSnap.docs) {
                const data = docObj.data();
                const dbEmail = data.email ? data.email.toLowerCase().trim() : "";
                const dbPhone = data.telefono ? String(data.telefono).replace(/\D/g, "") : "";

                if (
                    (dbEmail && dbEmail === normalizedEmailInput) ||
                    (cleanInputPhone && dbPhone && dbPhone === cleanInputPhone)
                ) {
                    matchedDoc = docObj;
                    matchedData = data;
                    break;
                }
            }
        }

        if (matchedDoc && matchedData) {
            const isAdmin =
                matchedData.privilegios?.includes("Administrador") ||
                matchedData.privilegios?.includes("SuperAdmin") ||
                matchedData.rol === "Admin" ||
                matchedData.role === "Admin";
            const esConductor =
                matchedData.es_conductor ||
                isAdmin ||
                matchedData.privilegios?.includes("Conductor") ||
                matchedData.rol === "Conductor";

            const availableRoles = [];
            if (isAdmin) availableRoles.push("Administrador");
            if (esConductor) availableRoles.push("Conductor");
            availableRoles.push("Publicador");

            return {
                role: isAdmin ? "Administrador" : esConductor ? "Conductor" : "Publicador",
                isAdmin,
                esConductor,
                availableRoles,
                ...matchedData,
                id: matchedDoc.id,
            };
        }
        return null;
    } catch (e) {
        console.error("Error getting permissions:", e);
        return null;
    }
};
