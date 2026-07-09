/**
 * @module history-service
 * @description Servicio de historial de territorios (banco S-13 cronológico).
 *              Gestiona el registro de asignaciones (logAssignment), entregas (logReturn),
 *              edición/borrado de registros históricos, y consultas de reporte.
 *              Fuente autoritativa: `banco_s13`.
 *
 * @layer Backend / Data Layer
 * @depends firebase-config.js, base-service.js, audit-service.js, program-service.js
 *
 * @exports
 *  - logAssignment()       → Registrar asignación en banco_s13 (con dedup)
 *  - logReturn()           → Cerrar ciclo S-13 (fecha_entrega + bitacora)
 *  - getHistorialReport()  → Todos los registros del banco S-13 (con caché)
 *  - getTerritoryHistory() → Historial de un territorio específico
 *  - addHistoryRecord()    → Agregar registro manual con sincronización al Visor
 *  - updateHistoryRecord() → Editar registro con sincronización bidireccional al Maestro
 *  - deleteHistoryRecord() → Borrar registro en banco_s13
 */

import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase-config.js";
import { normalizeName } from "../../modules/utils/helpers.js";
import { saveAuditLog } from "./audit-service.js";
import { fetchCached, ServiceCache } from "./base-service.js";
import { syncAssignmentToWeeklyProgram, removeAssignmentFromWeeklyProgram } from "./program-service.js";

// ═══════════════════════════════════════════════════════════
const COL_BANCO_S13 = "banco_s13"; // Fuente autoritativa S-13
const COL_BITACORA_OBS = "bitacora_observaciones"; // Notas/observaciones de campo
const COL_TERRITORIOS = "territorios"; // Maestro de territorios

// ═══════════════════════════════════════════════════════════
// REGISTRO DE ASIGNACIÓN (Escritura S-13)
// ═══════════════════════════════════════════════════════════

export const logAssignment = async (territorioData, conductorName, details = {}) => {
    try {
        const dateKey = (details.fecha_asignacion || new Date().toISOString()).split("T")[0];
        const q = query(
            collection(db, COL_BANCO_S13),
            where("territorio_id", "==", String(territorioData.numero)),
            where("conductor", "==", conductorName),
            where("estado", "==", "Asignado"),
        );
        const snap = await getDocs(q);
        const exists = snap.docs.some((d) => (d.data().fecha_asignacion || "").split("T")[0] === dateKey);

        if (exists) {
            console.log(`🛡️ [Shield] Assignment duplicate prevented for T-${territorioData.numero} on ${dateKey}`);
            return;
        }

        await addDoc(collection(db, COL_BANCO_S13), {
            territorio_id: String(territorioData.numero).trim(),
            numero: String(territorioData.numero).trim(),
            conductor: conductorName,
            auxiliar: details.auxiliar || null,
            turno: details.turno || null,
            fecha_asignacion: details.fecha_asignacion || new Date().toISOString(),
            fecha_entrega: null,
            estado: "Asignado",
            timestamp: Timestamp.now(),
            observaciones: details.observaciones || null,
            prog_sync: details.prog_sync || details.sync || false,
        });
        ServiceCache.clear("historial");
    } catch (e) {
        console.error("Error logging assignment history:", e);
    }
};

export const logReturn = async (
    territorioId,
    fechaEntrega,
    status = "Completado",
    notas = null,
    fotos = null,
    conductorName = null,
) => {
    try {
        const tSnap = await getDoc(doc(db, COL_TERRITORIOS, territorioId));
        const num = tSnap.exists() ? String(tSnap.data().numero) : territorioId;

        // Query active assignments for this territory
        const q = query(
            collection(db, COL_BANCO_S13),
            where("territorio_id", "==", num),
            where("estado", "==", "Asignado"),
        );
        const snapshot = await getDocs(q);

        let docsToUpdate = snapshot.docs;
        if (conductorName && !snapshot.empty) {
            const normInput = normalizeName(conductorName);
            docsToUpdate = snapshot.docs.filter((d) => {
                const c = d.data().conductor;
                return c && normalizeName(c) === normInput;
            });

            // Fallback: if name doesn't match exactly but we only have 1 active assignment, heal it
            if (docsToUpdate.length === 0 && snapshot.docs.length === 1) {
                docsToUpdate = snapshot.docs;
            }
        }

        if (docsToUpdate.length > 0) {
            const batch = writeBatch(db);
            const finalizingStates = [
                "Completado",
                "Extraviado",
                "Disponible",
                "Devuelto",
                "Devuelto (Transferido)",
                "Predicado Parcial",
            ];
            const isClosing = finalizingStates.includes(status);

            docsToUpdate.forEach((d) => {
                const updates = {
                    timestamp: Timestamp.now(),
                    fotos: fotos || d.data().fotos || null,
                };

                if (isClosing) {
                    updates.fecha_entrega = fechaEntrega || new Date().toISOString();
                    updates.estado = status;
                    updates.observaciones = notas || d.data().observaciones || null;
                } else {
                    // For partial advances/notes (like 'Avance Parcial', 'Nota S-13', 'Novedad Nexo'),
                    // DO NOT close the S-13 assignment. Only append the note.
                    updates.observaciones = notas
                        ? d.data().observaciones
                            ? `${d.data().observaciones}\n[${status}] ${notas}`
                            : `[${status}] ${notas}`
                        : d.data().observaciones;
                }

                batch.update(d.ref, updates);
            });

            await batch.commit();
            await saveAuditLog("ENTREGA_TERRITORIO", { territorio: num, estado: status });

            if (notas && notas.trim().length > 0) {
                const conductor = docsToUpdate[0].data().conductor || "Anónimo";
                await addDoc(collection(db, COL_BITACORA_OBS), {
                    territorio_id: num,
                    conductor: conductor,
                    nota: notas,
                    fecha: fechaEntrega || new Date().toISOString(),
                    timestamp: Timestamp.now(),
                });
            }
        }
        ServiceCache.clear("territorios_combined");
        ServiceCache.clear("historial");
    } catch (e) {
        console.error("Error al registrar entrega:", e);
    }
};

export const getGlobalObservations = async () => {
    try {
        const q = query(collection(db, COL_BITACORA_OBS), orderBy("timestamp", "desc"), limit(200));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Error fetching global observations:", e);
        return [];
    }
};

export const deleteObservation = async (id) => {
    await deleteDoc(doc(db, COL_BITACORA_OBS, id));
};

export const getHistorialReport = async () => {
    return fetchCached("historial", async () => {
        const q = query(collection(db, COL_BANCO_S13), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({
            ...d.data(),
            id: d.id,
            numero: String(d.data().territorio_id || "").trim(),
        }));
    });
};

export const getTerritoryHistory = async (territoryNum) => {
    const q = query(collection(db, COL_BANCO_S13), where("territorio_id", "==", String(territoryNum)));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp - a.timestamp);
};

export const addHistoryRecord = async (data) => {
    try {
        const tNum = String(data.numero || data.territorio_id || "").trim();
        const dateKey = (data.fecha_asignacion || new Date().toISOString()).split("T")[0];

        // Query all S13 records for this territory
        const q = query(collection(db, COL_BANCO_S13), where("numero", "==", tNum));
        const snapshot = await getDocs(q);

        // Find existing record with same assignment date
        const existingDoc = snapshot.docs.find((d) => {
            const fAsig = d.data().fecha_asignacion;
            return fAsig && fAsig.split("T")[0] === dateKey;
        });

        if (existingDoc) {
            console.log(
                `🛡️ [Shield] Manual assignment duplicate found for T-${tNum} on ${dateKey}. Merging/replacing...`,
            );
            await updateDoc(existingDoc.ref, {
                conductor: data.conductor || existingDoc.data().conductor,
                conductor_normalized: data.conductor
                    ? normalizeName(data.conductor)
                    : existingDoc.data().conductor_normalized || null,
                auxiliar: data.auxiliar || existingDoc.data().auxiliar || null,
                auxiliar_normalized: data.auxiliar
                    ? normalizeName(data.auxiliar)
                    : existingDoc.data().auxiliar_normalized || null,
                fecha_entrega: data.fecha_entrega || existingDoc.data().fecha_entrega || null,
                estado: data.estado || existingDoc.data().estado || "Completado",
                observaciones: data.observaciones || existingDoc.data().observaciones || null,
                timestamp: Timestamp.now(),
            });

            ServiceCache.clear("historial");
            ServiceCache.clear("territorios_combined");

            if (data.observaciones && data.observaciones.trim().length > 0) {
                await addDoc(collection(db, COL_BITACORA_OBS), {
                    territorio_id: tNum,
                    conductor: data.conductor || "Anónimo",
                    nota: data.observaciones,
                    fecha: data.fecha_asignacion || data.fecha_entrega || new Date().toISOString(),
                    timestamp: Timestamp.now(),
                });
            }
            return existingDoc.ref;
        }

        // Standard add if no duplicate found
        if (!data.timestamp) {
            data.timestamp = Timestamp.fromDate(new Date(data.fecha_asignacion || new Date()));
        }
        const docRef = await addDoc(collection(db, COL_BANCO_S13), data);
        ServiceCache.clear("historial");
        ServiceCache.clear("territorios_combined");

        if (data.fecha_asignacion) {
            await syncAssignmentToWeeklyProgram(
                { id: data.territorio_id || docRef.id, numero: data.numero },
                data.conductor,
                data,
            );
        }

        if (data.observaciones && data.observaciones.trim().length > 0) {
            await addDoc(collection(db, COL_BITACORA_OBS), {
                territorio_id: data.numero || data.territorio_id,
                conductor: data.conductor || "Anónimo",
                nota: data.observaciones,
                fecha: data.fecha_asignacion || data.fecha_entrega || new Date().toISOString(),
                timestamp: Timestamp.now(),
            });
        }
        return docRef;
    } catch (e) {
        console.error("Error in addHistoryRecord:", e);
        throw e;
    }
};

export const updateHistoryRecord = async (id, data) => {
    try {
        const histPreSnap = await getDoc(doc(db, COL_BANCO_S13, id));
        let territoryDocId = null;

        if (histPreSnap.exists()) {
            const oldData = histPreSnap.data();
            territoryDocId = oldData.territorio_doc_id || null;
            if (!territoryDocId) {
                const tQuery = query(collection(db, COL_TERRITORIOS), where("numero", "==", String(oldData.numero)));
                const tSnap = await getDocs(tQuery);
                if (!tSnap.empty) {
                    territoryDocId = tSnap.docs[0].id;
                }
            }
        }

        await runTransaction(db, async (transaction) => {
            const histRef = doc(db, COL_BANCO_S13, id);
            const oldSnap = await transaction.get(histRef);
            if (!oldSnap.exists()) return;
            const old = oldSnap.data();

            // Sincronización Bidireccional con Maestro (territorios)
            if (territoryDocId) {
                const tRef = doc(db, COL_TERRITORIOS, territoryDocId);
                const tDocSnap = await transaction.get(tRef);

                if (tDocSnap.exists()) {
                    const tUpdate = {};

                    if (data.fecha_entrega) {
                        data.estado = "Completado";
                        tUpdate.estado = "Disponible";
                        tUpdate.status = "Disponible";
                        tUpdate.asignado_a = null;
                        tUpdate.currentAssignee = null;
                        tUpdate.fecha_asignacion = null;
                        tUpdate.assignmentDate = null;
                        tUpdate.turno = null;
                        tUpdate.is_incomplete = false;
                    } else {
                        data.estado = "Asignado";
                        tUpdate.estado = "Asignado";
                        tUpdate.status = "Asignado";
                        tUpdate.asignado_a = data.conductor || old.conductor || null;
                        tUpdate.currentAssignee = data.conductor || old.conductor || null;
                        tUpdate.fecha_asignacion = data.fecha_asignacion || old.fecha_asignacion || null;
                        tUpdate.assignmentDate = data.fecha_asignacion || old.fecha_asignacion || null;
                        tUpdate.turno = data.turno || old.turno || null;
                    }

                    transaction.update(tRef, tUpdate);
                }
            }

            transaction.update(histRef, data);
        });

        if (histPreSnap.exists()) {
            const old = histPreSnap.data();
            const oldDateStr = old.fecha_asignacion || old.timestamp?.toDate?.()?.toISOString() || new Date().toISOString();
            const oldDate = new Date(`${oldDateStr.split("T")[0]}T12:00:00Z`);
            const oldTurno = old.turno || "manana";

            const newDateStr = data.fecha_asignacion || oldDateStr;
            const newTurno = data.turno || oldTurno;

            const dateChanged = newDateStr.split("T")[0] !== oldDateStr.split("T")[0];
            const turnoChanged = newTurno !== oldTurno;

            if (dateChanged || turnoChanged) {
                if (!Number.isNaN(oldDate.getTime())) {
                    const d = new Date(oldDate);
                    const day = d.getUTCDay();
                    const diff = d.getUTCDate() - (day === 0 ? 6 : day - 1);
                    d.setUTCDate(diff);
                    const oldWeekId = d.toISOString().split("T")[0];
                    let oldDayIdx = oldDate.getUTCDay();
                    oldDayIdx = oldDayIdx === 0 ? 6 : oldDayIdx - 1;
                    await removeAssignmentFromWeeklyProgram(old.numero, oldWeekId, oldDayIdx, oldTurno);
                }
            }

            const merged = { ...old, ...data };
            await syncAssignmentToWeeklyProgram(
                { id: old.territorio_doc_id || territoryDocId || old.territorio_id, numero: old.numero },
                merged.conductor,
                merged
            );
        }

        ServiceCache.clear("historial");
        ServiceCache.clear("territorios_combined");
    } catch (e) {
        console.error("Atomic transaction failed in updateHistoryRecord:", e);
        throw e;
    }
};

export const restoreHistoryRecord = async (id) => {
    try {
        const histRef = doc(db, COL_BANCO_S13, id);
        const histSnap = await getDoc(histRef);
        if (!histSnap.exists()) throw new Error("Registro no encontrado");
        const histData = histSnap.data();

        let territoryDocId = histData.territorio_doc_id || null;
        if (!territoryDocId) {
            const tQuery = query(collection(db, COL_TERRITORIOS), where("numero", "==", String(histData.numero)));
            const tSnap = await getDocs(tQuery);
            if (!tSnap.empty) {
                territoryDocId = tSnap.docs[0].id;
            }
        }

        await runTransaction(db, async (transaction) => {
            transaction.update(histRef, {
                estado: "Asignado",
                fecha_entrega: null,
                timestamp: Timestamp.now(),
            });

            if (territoryDocId) {
                const tRef = doc(db, COL_TERRITORIOS, territoryDocId);
                transaction.update(tRef, {
                    estado: "Asignado",
                    status: "Asignado",
                    asignado_a: histData.conductor,
                    currentAssignee: histData.conductor,
                    fecha_asignacion: histData.fecha_asignacion,
                    assignmentDate: histData.fecha_asignacion,
                    turno: histData.turno || "manana",
                });
            }
        });

        ServiceCache.clear("historial");
        ServiceCache.clear("territorios_combined");

        await syncAssignmentToWeeklyProgram(
            { id: territoryDocId || histData.territorio_id, numero: histData.numero },
            histData.conductor,
            { ...histData, estado: "Asignado", fecha_entrega: null }
        );
    } catch (e) {
        console.error("Error restoring history record:", e);
        throw e;
    }
};

export const deleteHistoryRecord = async (id) => {
    try {
        const histRef = doc(db, COL_BANCO_S13, id);
        const histSnap = await getDoc(histRef);
        if (!histSnap.exists()) return;
        const histData = histSnap.data();

        let territoryDocId = histData.territorio_doc_id || null;
        if (!territoryDocId) {
            const tQuery = query(collection(db, COL_TERRITORIOS), where("numero", "==", String(histData.numero)));
            const tSnap = await getDocs(tQuery);
            if (!tSnap.empty) {
                territoryDocId = tSnap.docs[0].id;
            }
        }

        await runTransaction(db, async (transaction) => {
            transaction.delete(histRef);

            if (histData.estado === "Asignado" && territoryDocId) {
                const tRef = doc(db, COL_TERRITORIOS, territoryDocId);
                const tDocSnap = await transaction.get(tRef);
                if (tDocSnap.exists() && tDocSnap.data().estado === "Asignado") {
                    transaction.update(tRef, {
                        estado: "Disponible",
                        status: "Disponible",
                        asignado_a: null,
                        currentAssignee: null,
                        fecha_asignacion: null,
                        assignmentDate: null,
                        turno: null,
                    });
                }
            }
        });

        ServiceCache.clear("historial");
        ServiceCache.clear("territorios_combined");

        const baseDateStr = histData.fecha_asignacion || new Date().toISOString();
        const baseDate = new Date(`${baseDateStr.split("T")[0]}T12:00:00Z`);
        if (!Number.isNaN(baseDate.getTime())) {
            const d = new Date(baseDate);
            const day = d.getUTCDay();
            const diff = d.getUTCDate() - (day === 0 ? 6 : day - 1);
            d.setUTCDate(diff);
            const weekId = d.toISOString().split("T")[0];
            let dayIdx = baseDate.getUTCDay();
            dayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
            const turno = histData.turno || "manana";
            await removeAssignmentFromWeeklyProgram(histData.numero, weekId, dayIdx, turno);
        }
    } catch (e) {
        console.error("Error deleting history record from banco_s13:", e);
        throw e;
    }
};

export const getAssignmentsByDate = async (startDate, endDate) => {
    try {
        const q = query(
            collection(db, COL_BANCO_S13),
            where("fecha_asignacion", ">=", startDate),
            where("fecha_asignacion", "<=", endDate),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Error in getAssignmentsByDate:", e);
        return [];
    }
};
