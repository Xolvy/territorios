import { collection, deleteDoc, getDocs, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "../../firebase-config.js";
import { normalizeName } from "../../modules/utils/helpers.js";

export const runSystemDiagnosticsAndRepair = async (onProgress) => {
    const report = {
        rebuiltHistory: 0,
        fixedPhones: 0,
        fixedTerritories: 0,
        syncPersonnel: 0,
        details: [],
    };
    const reportProgress = (msg, pc) => {
        if (onProgress) onProgress(msg, pc);
    };

    reportProgress("🔍 Escaneando integridad de territorios...", 30);
    const terrSnap = await getDocs(collection(db, "territorios"));
    const terrBatch = writeBatch(db);
    let terrBatchCount = 0;

    for (const d of terrSnap.docs) {
        const t = d.data();
        const updates = {};
        let dirty = false;

        // Propagación de identidad canónica en Maestro
        if (t.asignado_a) {
            const normalized = normalizeName(t.asignado_a);
            if (t.asignado_a_normalized !== normalized) {
                updates.asignado_a_normalized = normalized;
                dirty = true;
            }
        } else {
            if (t.asignado_a_normalized !== null && t.asignado_a_normalized !== undefined) {
                updates.asignado_a_normalized = null;
                dirty = true;
            }
        }

        if (t.auxiliar) {
            const normalized = normalizeName(t.auxiliar);
            if (t.auxiliar_normalized !== normalized) {
                updates.auxiliar_normalized = normalized;
                dirty = true;
            }
        } else {
            if (t.auxiliar_normalized !== null && t.auxiliar_normalized !== undefined) {
                updates.auxiliar_normalized = null;
                dirty = true;
            }
        }

        // Espejo de compatibilidad robusta
        if (t.estado && t.status !== t.estado) {
            updates.status = t.estado;
            dirty = true;
        }
        if (t.asignado_a && t.currentAssignee !== t.asignado_a) {
            updates.currentAssignee = t.asignado_a;
            dirty = true;
        }
        if (t.fecha_asignacion && t.assignmentDate !== t.fecha_asignacion) {
            updates.assignmentDate = t.fecha_asignacion;
            dirty = true;
        }

        if (t.estado === "Asignado" && !t.asignado_a) {
            updates.estado = "Disponible";
            updates.status = "Disponible";
            updates.asignado_a = null;
            updates.asignado_a_normalized = null;
            updates.currentAssignee = null;
            updates.fecha_asignacion = null;
            updates.assignmentDate = null;
            updates.turno = null;
            dirty = true;
            report.details.push(`Territorio ${t.numero}: Corregido estado 'Asignado' sin conductor -> Disponible`);
        }
        if (t.estado === "Disponible" && (t.asignado_a || t.fecha_asignacion)) {
            updates.asignado_a = null;
            updates.asignado_a_normalized = null;
            updates.currentAssignee = null;
            updates.fecha_asignacion = null;
            updates.assignmentDate = null;
            updates.turno = null;
            updates.status = "Disponible";
            dirty = true;
            report.details.push(`Territorio ${t.numero}: Limpiado conductor en territorio 'Disponible'`);
        }
        if (!["Disponible", "Asignado", "Extraviado", "Predicado", "Pendiente"].includes(t.estado)) {
            updates.estado = "Disponible";
            updates.status = "Disponible";
            dirty = true;
            report.details.push(`Territorio ${t.numero}: Estado inválido '${t.estado}' -> Disponible`);
        }
        if (String(t.numero) !== String(t.numero).trim()) {
            updates.numero = String(t.numero).trim();
            dirty = true;
            report.details.push(`Territorio ${t.numero}: Número normalizado`);
        }

        if (dirty) {
            terrBatch.update(d.ref, updates);
            report.fixedTerritories++;
            terrBatchCount++;
            if (terrBatchCount >= 500) {
                await terrBatch.commit();
                terrBatchCount = 0;
            }
        }
    }
    if (terrBatchCount > 0) await terrBatch.commit();

    reportProgress("📡 Escaneando y normalizando S-13 Live Pool...", 70);
    const s13Snap = await getDocs(collection(db, "banco_s13"));
    const s13Batch = writeBatch(db);
    let s13BatchCount = 0;

    // Map territories from Maestro both by ID and by Number for S-13 auto-healing lookup
    const maestroMapByNumber = {};
    const maestroMapById = {};
    terrSnap.docs.forEach((d) => {
        const data = d.data();
        const tNum = String(data.numero || "").trim();
        const tId = d.id;
        const info = {
            id: tId,
            numero: tNum,
            estado: data.estado || data.status || "Disponible",
            asignado_a: data.asignado_a || data.currentAssignee || null,
            ultima_fecha: data.ultima_fecha || null,
            fecha_asignacion: data.fecha_asignacion || data.assignmentDate || null,
        };
        if (tNum) maestroMapByNumber[tNum] = info;
        maestroMapById[tId] = info;
    });

    let healedCount = 0;
    let healedIdCount = 0;

    for (const d of s13Snap.docs) {
        const r = d.data();
        const updates = {};
        let dirty = false;

        // 1. Curación de Identificadores (Firestore ID -> Territory Number)
        // banco_s13 must strictly use the human-readable territory number in "territorio_id" and "numero"
        let tNum = null;
        let maestroRef = null;
        if (maestroMapById[r.territorio_id]) {
            tNum = maestroMapById[r.territorio_id].numero;
            maestroRef = maestroMapById[r.territorio_id];
            updates.territorio_id = tNum;
            updates.numero = tNum;
            updates.territorio_numero = tNum;
            dirty = true;
            healedIdCount++;
        } else if (maestroMapById[r.numero]) {
            tNum = maestroMapById[r.numero].numero;
            maestroRef = maestroMapById[r.numero];
            updates.territorio_id = tNum;
            updates.numero = tNum;
            updates.territorio_numero = tNum;
            dirty = true;
            healedIdCount++;
        } else {
            tNum = String(r.territorio_id || r.numero || "").trim();
            maestroRef = (r.territorio_doc_id && maestroMapById[r.territorio_doc_id]) || maestroMapByNumber[tNum];
        }

        // Curación de territorio_doc_id (nueva mejora de integridad)
        if (maestroRef && r.territorio_doc_id !== maestroRef.id) {
            updates.territorio_doc_id = maestroRef.id;
            dirty = true;
        }

        // 2. Normalización de Nombres
        if (r.conductor) {
            const normalized = normalizeName(r.conductor);
            if (r.conductor_normalized !== normalized) {
                updates.conductor_normalized = normalized;
                dirty = true;
            }
        }
        if (r.auxiliar) {
            const normalized = normalizeName(r.auxiliar);
            if (r.auxiliar_normalized !== normalized) {
                updates.auxiliar_normalized = normalized;
                dirty = true;
            }
        }

        // 2b. Curación de Fecha de Asignación (Fecha de Creación en vez del día de predicación)
        const createdTS = r.createdAt || r.timestamp;
        if (createdTS) {
            const creationDateObj = createdTS.toDate ? createdTS.toDate() : new Date(createdTS);
            if (!Number.isNaN(creationDateObj.getTime())) {
                // Formatear en zona horaria de Ecuador (GMT-5)
                const ecDate = new Date(creationDateObj.getTime() - 5 * 60 * 60 * 1000);
                const ecY = ecDate.getUTCFullYear();
                const ecM = String(ecDate.getUTCMonth() + 1).padStart(2, "0");
                const ecD = String(ecDate.getUTCDate()).padStart(2, "0");
                const creationDateISO = `${ecY}-${ecM}-${ecD}T12:00:00Z`;

                // Comparamos sólo la parte de fecha YYYY-MM-DD
                const currentAsigDatePart = String(r.fecha_asignacion || "").split("T")[0];
                const expectedAsigDatePart = `${ecY}-${ecM}-${ecD}`;

                if (currentAsigDatePart !== expectedAsigDatePart) {
                    updates.fecha_asignacion = creationDateISO;
                    dirty = true;
                    healedCount++;
                }
            }
        }

        // 3. Curación del S-13 Live Pool (Auto-Healer Nivel Dios)
        // Si el registro está 'Asignado' pero en el Maestro ya está 'Disponible'
        // o reasignado a otro conductor, indica que se entregó sin reportarse al S-13.
        if (r.estado === "Asignado" && tNum) {
            const m = (r.territorio_doc_id && maestroMapById[r.territorio_doc_id]) || maestroRef || maestroMapByNumber[tNum];
            if (m) {
                let shouldClose = false;
                let closeDate = null;
                let closeReason = "";

                if (m.estado === "Disponible") {
                    shouldClose = true;
                    closeDate = m.ultima_fecha || r.fecha_asignacion || new Date().toISOString();
                    closeReason = "Territorio marcado como Disponible en el Maestro.";
                } else if (
                    m.estado === "Asignado" &&
                    m.asignado_a &&
                    normalizeName(m.asignado_a) !== normalizeName(r.conductor)
                ) {
                    shouldClose = true;
                    closeDate = m.fecha_asignacion || new Date().toISOString();
                    closeReason = `Territorio reasignado a ${m.asignado_a}.`;
                }

                if (shouldClose) {
                    updates.estado = "Completado";
                    updates.fecha_entrega = closeDate;
                    updates.timestamp = Timestamp.now();
                    updates.observaciones = r.observaciones
                        ? `${r.observaciones} (Auto-cerrado por PowerSync: ${closeReason})`
                        : `(Auto-cerrado por PowerSync: ${closeReason})`;
                    dirty = true;
                    healedCount++;
                }
            }
        }

        if (dirty) {
            s13Batch.update(d.ref, updates);
            report.rebuiltHistory++;
            s13BatchCount++;
            if (s13BatchCount >= 500) {
                await s13Batch.commit();
                s13BatchCount = 0;
            }
        }
    }
    if (s13BatchCount > 0) await s13Batch.commit();

    if (healedIdCount > 0) {
        report.details.push(
            `🛡️ S-13 Healer: Se corrigieron ${healedIdCount} registros con IDs de documento Firestore a números legibles.`,
        );
    }
    if (healedCount > 0) {
        report.details.push(`🛡️ S-13 Healer: Se auto-cerraron y recuperaron ${healedCount} entregas desincronizadas.`);
    }

    reportProgress("📡 Escaneo profundo de base de datos telefónica...", 45);
    const allPhones = await getDocs(collection(db, "telefonos"));
    const allPubs = await getDocs(collection(db, "publicadores"));
    const pubsMap = {};
    allPubs.forEach((d) => {
        const p = d.data();
        pubsMap[d.id] = p.nombre;
        pubsMap[p.nombre] = d.id;
    });

    let phoneBatch = writeBatch(db);
    let phoneBatchCount = 0;
    for (const d of allPhones.docs) {
        const t = d.data();
        const updates = {};
        let dirty = false;
        const _status = (t.estado || "").trim().toLowerCase();

        if (t.asignado_a === "Usuario" || t.publicador_asignado === "Usuario") {
            if (pubsMap[t.publicador_asignado]) {
                updates.asignado_a = pubsMap[t.publicador_asignado];
                dirty = true;
            } else {
                updates.asignado_a = null;
                updates.publicador_asignado = null;
                updates.estado = "Sin asignar";
                dirty = true;
            }
        }
        if (dirty) {
            phoneBatch.update(d.ref, updates);
            report.fixedPhones++;
            phoneBatchCount++;
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
    allPubs.forEach((d) => {
        const p = d.data();
        if (p.modulos?.telefonos !== true) {
            pubBatch.update(d.ref, { "modulos.telefonos": true });
            pubCount++;
        }
    });
    if (pubCount > 0) {
        await pubBatch.commit();
        report.syncPersonnel = pubCount;
    }

    reportProgress("✨ Limpieza profunda completada.", 100);
    return report;
};

export const clearAllCurrentData = async (onProgress) => {
    const _reportProgress = (msg, pc) => {
        if (onProgress) onProgress(msg, pc);
    };
    // Implementation of masterResetAssignments logic
    const terrSnap = await getDocs(collection(db, "territorios"));
    const terrBatch = writeBatch(db);
    let tCount = 0;
    terrSnap.forEach((d) => {
        const t = d.data();
        if (t.estado === "Asignado" || t.asignado_a || t.fecha_asignacion) {
            terrBatch.update(d.ref, { estado: "Disponible", asignado_a: null, fecha_asignacion: null, turno: null });
            tCount++;
        }
    });
    if (tCount > 0) await terrBatch.commit();
    const progSnap = await getDocs(collection(db, "programa_semanal"));
    for (const d of progSnap.docs) await deleteDoc(d.ref);
    return { territoriesReset: tCount, programsDeleted: progSnap.docs.length };
};

export const masterResetAssignments = clearAllCurrentData;
