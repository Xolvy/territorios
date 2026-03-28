import { db } from '../../firebase-config.js';
import { collection, query, where, getDocs, addDoc, getDoc, doc, writeBatch, orderBy, limit, Timestamp, runTransaction, deleteDoc } from "firebase/firestore";
import { ServiceCache, fetchCached } from './base-service.js';
import { saveAuditLog } from './audit-service.js';
import { syncAssignmentToWeeklyProgram } from './program-service.js';

const COL_BANCO_S13 = "banco_s13";
const COL_BITACORA_OBS = "bitacora_observaciones";
const COL_TERRITORIOS = "territorios";

export const logAssignment = async (territorioData, conductorName, details = {}) => {
    try {
        const dateKey = (details.fecha_asignacion || new Date().toISOString()).split('T')[0];
        const q = query(
            collection(db, COL_BANCO_S13),
            where("territorio_id", "==", String(territorioData.numero)),
            where("conductor", "==", conductorName),
            where("estado", "==", "Asignado")
        );
        const snap = await getDocs(q);
        const exists = snap.docs.some(d => (d.data().fecha_asignacion || '').split('T')[0] === dateKey);

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
            estado: 'Asignado',
            timestamp: Timestamp.now(),
            observaciones: details.observaciones || null,
            prog_sync: details.prog_sync || details.sync || false
        });
        ServiceCache.clear('historial');
    } catch (e) {
        console.error("Error logging assignment history:", e);
    }
};

export const logReturn = async (territorioId, fechaEntrega, status = 'Completado', notas = null, fotos = null, conductorName = null) => {
    try {
        const tSnap = await getDoc(doc(db, COL_TERRITORIOS, territorioId));
        const num = tSnap.exists() ? String(tSnap.data().numero) : territorioId;

        // --- REFERENTIAL INTEGRITY: Query by territory AND conductor to avoid multi-reassignment closure bug ---
        const filters = [
            where("territorio_id", "==", num),
            where("estado", "==", "Asignado")
        ];
        if (conductorName) {
            filters.push(where("conductor", "==", String(conductorName).trim()));
        }

        const q = query(
            collection(db, COL_BANCO_S13),
            ...filters
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => {
                batch.update(d.ref, {
                    fecha_entrega: fechaEntrega || new Date().toISOString(),
                    estado: status,
                    observaciones: notas || d.data().observaciones,
                    timestamp: Timestamp.now(),
                    fotos: fotos || null
                });
            });
            await batch.commit();
            await saveAuditLog('ENTREGA_TERRITORIO', { territorio: num });

            if (notas && notas.trim().length > 0) {
                const conductor = snapshot.docs[0].data().conductor || 'Anónimo';
                await addDoc(collection(db, COL_BITACORA_OBS), {
                    territorio_id: num,
                    conductor: conductor,
                    nota: notas,
                    fecha: fechaEntrega || new Date().toISOString(),
                    timestamp: Timestamp.now()
                });
            }
        }
        ServiceCache.clear('territorios_combined');
        ServiceCache.clear('historial');
    } catch (e) {
        console.error("Error al registrar entrega:", e);
    }
};

export const getGlobalObservations = async () => {
    try {
        const q = query(collection(db, COL_BITACORA_OBS), orderBy("timestamp", "desc"), limit(200));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Error fetching global observations:", e);
        return [];
    }
};

export const deleteObservation = async (id) => {
    await deleteDoc(doc(db, COL_BITACORA_OBS, id));
};

export const getHistorialReport = async () => {
    return fetchCached('historial', async () => {
        const q = query(collection(db, COL_BANCO_S13), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({
            ...d.data(),
            id: d.id,
            numero: String(d.data().territorio_id || '').trim()
        }));
    });
};

export const getTerritoryHistory = async (territoryNum) => {
    const q = query(
        collection(db, COL_BANCO_S13),
        where("territorio_id", "==", String(territoryNum))
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.timestamp - a.timestamp);
};

export const addHistoryRecord = async (data) => {
    if (!data.timestamp) {
        data.timestamp = Timestamp.fromDate(new Date(data.fecha_asignacion || new Date()));
    }
    const docRef = await addDoc(collection(db, COL_BANCO_S13), data);
    ServiceCache.clear('historial');

    if (data.fecha_asignacion) {
        await syncAssignmentToWeeklyProgram({ id: data.territorio_id || docRef.id, numero: data.numero }, data.conductor, data);
    }

    if (data.observaciones && data.observaciones.trim().length > 0) {
        await addDoc(collection(db, COL_BITACORA_OBS), {
            territorio_id: data.numero || data.territorio_id,
            conductor: data.conductor || 'Anónimo',
            nota: data.observaciones,
            fecha: data.fecha_asignacion || data.fecha_entrega || new Date().toISOString(),
            timestamp: Timestamp.now()
        });
    }
    return docRef;
};

export const updateHistoryRecord = async (id, data) => {
    try {
        await runTransaction(db, async (transaction) => {
            const histRef = doc(db, COL_BANCO_S13, id);
            const oldSnap = await transaction.get(histRef);
            if (!oldSnap.exists()) return;
            const old = oldSnap.data();

            transaction.update(histRef, data);

            if (old.estado === 'Asignado' && (data.conductor || data.fecha_asignacion || data.turno)) {
                const tQuery = query(collection(db, COL_TERRITORIOS), where("numero", "==", old.numero));
                const tSnap = await getDocs(tQuery);
                if (!tSnap.empty) {
                    const tId = tSnap.docs[0].id;
                    const tUpdate = {};
                    if (data.conductor) tUpdate.asignado_a = data.conductor;
                    if (data.fecha_asignacion) tUpdate.fecha_asignacion = data.fecha_asignacion;
                    if (data.turno) tUpdate.turno = data.turno;
                    transaction.update(doc(db, COL_TERRITORIOS, tId), tUpdate);
                }
            }
        });
        ServiceCache.clear('historial');
        ServiceCache.clear('territorios');
    } catch (e) {
        console.error("Atomic transaction failed in updateHistoryRecord:", e);
    }
};

export const deleteHistoryRecord = async (id) => {
    try {
        // banco_s13 is the authoritative collection for all S-13 / Cronología records
        await deleteDoc(doc(db, COL_BANCO_S13, id));
        ServiceCache.clear('historial');
    } catch (e) {
        console.error("Error deleting history record from banco_s13:", e);
        throw e;
    }
};

export const getAssignmentsByDate = async (startDate, endDate) => {
    try {
        const q = query(
            collection(db, "historial_territorios"),
            where("fecha_asignacion", ">=", startDate),
            where("fecha_asignacion", "<=", endDate)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("Error in getAssignmentsByDate:", e);
        return [];
    }
};
