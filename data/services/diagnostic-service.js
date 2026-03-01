import { db } from '../../firebase-config.js';
import { collection, query, where, getDocs, doc, writeBatch, deleteDoc, setDoc, Timestamp } from "firebase/firestore";
import { ServiceCache } from './base-service.js';

export const runSystemDiagnosticsAndRepair = async (onProgress) => {
    const report = {
        rebuiltHistory: 0, fixedPhones: 0, fixedTerritories: 0, syncPersonnel: 0, details: []
    };
    const reportProgress = (msg, pc) => { if (onProgress) onProgress(msg, pc); };

    reportProgress("🔍 Escaneando integridad de territorios...", 30);
    const terrSnap = await getDocs(collection(db, "territorios"));
    const terrBatch = writeBatch(db);
    let terrBatchCount = 0;

    for (const d of terrSnap.docs) {
        const t = d.data();
        let updates = {};
        let dirty = false;

        if (t.estado === 'Asignado' && !t.asignado_a) {
            updates.estado = 'Disponible'; updates.fecha_asignacion = null; updates.turno = null; dirty = true;
            report.details.push(`Territorio ${t.numero}: Corregido estado 'Asignado' sin conductor -> Disponible`);
        }
        if (t.estado === 'Disponible' && (t.asignado_a || t.fecha_asignacion)) {
            updates.asignado_a = null; updates.fecha_asignacion = null; updates.turno = null; dirty = true;
            report.details.push(`Territorio ${t.numero}: Limpiado conductor en territorio 'Disponible'`);
        }
        if (!['Disponible', 'Asignado', 'Extraviado', 'Predicado', 'Pendiente'].includes(t.estado)) {
            updates.estado = 'Disponible'; dirty = true;
            report.details.push(`Territorio ${t.numero}: Estado inválido '${t.estado}' -> Disponible`);
        }
        if (String(t.numero) !== String(t.numero).trim()) {
            updates.numero = String(t.numero).trim(); dirty = true;
            report.details.push(`Territorio ${t.numero}: Número normalizado`);
        }

        if (dirty) {
            terrBatch.update(d.ref, updates);
            report.fixedTerritories++; terrBatchCount++;
            if (terrBatchCount >= 500) { await terrBatch.commit(); terrBatchCount = 0; }
        }
    }
    if (terrBatchCount > 0) await terrBatch.commit();

    reportProgress("📡 Escaneo profundo de base de datos telefónica...", 45);
    const allPhones = await getDocs(collection(db, "telefonos"));
    const allPubs = await getDocs(collection(db, "publicadores"));
    const pubsMap = {};
    allPubs.forEach(d => {
        const p = d.data();
        pubsMap[d.id] = p.nombre;
        pubsMap[p.nombre] = d.id;
    });

    let phoneBatch = writeBatch(db);
    let phoneBatchCount = 0;
    for (const d of allPhones.docs) {
        const t = d.data();
        let updates = {};
        let dirty = false;
        const status = (t.estado || '').trim().toLowerCase();

        if (t.asignado_a === 'Usuario' || t.publicador_asignado === 'Usuario') {
            if (pubsMap[t.publicador_asignado]) {
                updates.asignado_a = pubsMap[t.publicador_asignado]; dirty = true;
            } else {
                updates.asignado_a = null; updates.publicador_asignado = null; updates.estado = 'Sin asignar'; dirty = true;
            }
        }
        if (dirty) {
            phoneBatch.update(d.ref, updates);
            report.fixedPhones++; phoneBatchCount++;
            if (phoneBatchCount >= 500) {
                await phoneBatch.commit();
                phoneBatch = writeBatch(db);
                phoneBatchCount = 0;
            }
        }
    }
    if (phoneBatchCount > 0) await phoneBatch.commit();

    reportProgress("👥 Sincronizando directorio personal...", 95);
    const pubBatch = writeBatch(db);
    let pubCount = 0;
    allPubs.forEach(d => {
        const p = d.data();
        if (!p.modulos || p.modulos.telefonos !== true) {
            pubBatch.update(d.ref, { 'modulos.telefonos': true });
            pubCount++;
        }
    });
    if (pubCount > 0) { await pubBatch.commit(); report.syncPersonnel = pubCount; }

    reportProgress("✨ Limpieza profunda completada.", 100);
    return report;
};

export const clearAllCurrentData = async (onProgress) => {
    const reportProgress = (msg, pc) => { if (onProgress) onProgress(msg, pc); };
    // Implementation of masterResetAssignments logic
    const terrSnap = await getDocs(collection(db, "territorios"));
    const terrBatch = writeBatch(db);
    let tCount = 0;
    terrSnap.forEach(d => {
        const t = d.data();
        if (t.estado === 'Asignado' || t.asignado_a || t.fecha_asignacion) {
            terrBatch.update(d.ref, { estado: 'Disponible', asignado_a: null, fecha_asignacion: null, turno: null });
            tCount++;
        }
    });
    if (tCount > 0) await terrBatch.commit();
    const progSnap = await getDocs(collection(db, "programa_semanal"));
    for (const d of progSnap.docs) await deleteDoc(d.ref);
    return { territoriesReset: tCount, programsDeleted: progSnap.docs.length };
};

export const masterResetAssignments = clearAllCurrentData;
