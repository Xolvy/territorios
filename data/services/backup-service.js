import { collection, doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase-config.js";

export const restoreSystemBackup = async (data, onProgress) => {
    if (!data) throw new Error("No data provided for restore");
    const collections = [
        { key: "territorios", name: "territorios" },
        { key: "conductores", name: "conductores" },
        { key: "telefonos", name: "telefonos" },
        { key: "publicadores", name: "publicadores" },
        { key: "historial", name: "historial_territorios" },
    ];
    let totalOps = 0;
    collections.forEach((c) => {
        if (data[c.key]) totalOps += data[c.key].length;
    });
    if (data.config) totalOps += 1;
    if (data.programa) totalOps += 1;

    let executedOps = 0;
    const reportProgress = (msg) => {
        if (onProgress) onProgress(msg, Math.floor((executedOps / totalOps) * 100));
    };

    for (const colDef of collections) {
        const items = data[colDef.key];
        if (!items || !Array.isArray(items)) continue;
        reportProgress(`Restaurando ${colDef.key}...`);
        for (let i = 0; i < items.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + 500);
            chunk.forEach((item) => {
                const { id, ...cleanData } = item;
                const docRef = id ? doc(db, colDef.name, id) : doc(collection(db, colDef.name));
                batch.set(docRef, cleanData, { merge: true });
                executedOps++;
            });
            await batch.commit();
        }
    }
    if (data.config) {
        const { id, ...configData } = data.config;
        await setDoc(doc(db, "configuracion", id || "general"), configData, { merge: true });
        executedOps++;
    }
    return executedOps;
};
