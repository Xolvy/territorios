import { addDoc, collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "../../firebase-config.js";

const COL_AUDITORIA = "bitacora_auditoria";

export const saveAuditLog = async (accion, detalles) => {
    try {
        await addDoc(collection(db, COL_AUDITORIA), {
            accion,
            detalles,
            timestamp: Timestamp.now(),
            usuario: detalles.usuario || "Sistema",
        });
    } catch (e) {
        console.error("Error saving audit log:", e);
    }
};

export const getAuditLogs = async (limitCount = 100) => {
    try {
        const q = query(collection(db, COL_AUDITORIA), orderBy("timestamp", "desc"), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Error fetching audit logs:", e);
        return [];
    }
};
