import { db, storage } from '../../firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, getDoc, setDoc, Timestamp, writeBatch, arrayUnion, runTransaction, orderBy, limit } from "firebase/firestore";
import { ServiceCache, fetchCached } from './base-service.js';
import { logReturn, logAssignment } from './history-service.js';
import { saveAuditLog } from './audit-service.js';
import { syncAssignmentToWeeklyProgram } from './program-service.js';

const COL_TERRITORIOS = "territorios";
const COL_BANCO_S13 = "banco_s13";

// --- XOLVY SHIELD: GLOBAL AGGREGATIONS ---
export const updateGlobalStats = async (transaction, field, diff) => {
    const statsRef = doc(db, "configuracion", "stats_globales");
    const snap = await transaction.get(statsRef);
    if (snap.exists()) {
        const val = (snap.data()[field] || 0) + diff;
        transaction.update(statsRef, { [field]: Math.max(0, val) });
    } else {
        transaction.set(statsRef, { [field]: Math.max(0, diff) }, { merge: true });
    }
};

export const getGlobalStats = async () => {
    return fetchCached('stats_globales', async () => {
        const snap = await getDoc(doc(db, "configuracion", "stats_globales"));
        return snap.exists() ? snap.data() : { territorios_asignados: 0, territorios_disponibles: 0 };
    });
};

const normalizeTerritorioData = (id, data, latestAssignment = null) => {
    let geojson = data.geojson;
    if (typeof geojson === 'string') {
        try { geojson = JSON.parse(geojson); } catch (e) { geojson = null; }
    }
    const numeroStr = String(data.numero || '');
    const estado = latestAssignment ? latestAssignment.estado : (data.estado || 'Disponible');
    const asignado_a = latestAssignment ? latestAssignment.conductor : null;
    const fecha_asignacion = latestAssignment ? latestAssignment.fecha_asignacion : null;

    return {
        id,
        numero: numeroStr,
        manzanas: data.manzanas || '',
        localidad: data.localidad || '',
        geojson: geojson,
        estado: estado,
        asignado_a: asignado_a,
        fecha_asignacion: fecha_asignacion,
        last_assignment: latestAssignment
    };
};

export const getTerritorios = async () => {
    return fetchCached('territorios_combined', async () => {
        try {
            const [terrSnap, bancoSnap] = await Promise.all([
                getDocs(collection(db, COL_TERRITORIOS)),
                getDocs(query(collection(db, COL_BANCO_S13), where("estado", "==", "Asignado")))
            ]);
            const activeAssignments = {};
            bancoSnap.docs.forEach(d => {
                const data = d.data();
                const baseNum = String(data.territorio_id || '').match(/^(\d+)/)?.[1] || data.territorio_id;
                activeAssignments[String(baseNum)] = { ...data, id: d.id };
            });
            return terrSnap.docs
                .map(doc => normalizeTerritorioData(doc.id, doc.data(), activeAssignments[String(doc.data().numero)]))
                .filter(t => t.numero && t.numero.trim().length > 0)
                .sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
        } catch (e) {
            console.error("Critical error fetching territories:", e);
            return [];
        }
    });
};

export const addTerritorio = async (territorio) => {
    ServiceCache.clear('territorios');
    await addDoc(collection(db, COL_TERRITORIOS), territorio);
};

export const updateTerritorio = async (id, data) => {
    ServiceCache.clear('territorios');
    await updateDoc(doc(db, COL_TERRITORIOS, id), data);
};

export const updateTerritoryGeoJSON = async (numero, geojson) => {
    try {
        ServiceCache.clear('territorios');
        const q = query(collection(db, COL_TERRITORIOS), where("numero", "==", String(numero)));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const id = snap.docs[0].id;
            const serializedGeoJSON = JSON.stringify(geojson);
            await updateDoc(doc(db, COL_TERRITORIOS, id), { geojson: serializedGeoJSON });
            return id;
        }
        return null;
    } catch (e) {
        console.error("Error updating territory GeoJSON:", e);
        throw e;
    }
};

export const uploadMapPNG = async (file, territoryNum) => {
    try {
        const ext = file.name.split('.').pop();
        const fileRef = ref(storage, `mapas/T-${territoryNum}-${Date.now()}.${ext}`);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
    } catch (e) {
        console.error("Error uploading map PNG:", e);
        throw e;
    }
};

export const addTerritoryReference = async (territoryId, reference) => {
    try {
        await updateDoc(doc(db, COL_TERRITORIOS, territoryId), {
            referencias: arrayUnion(reference)
        });
        return true;
    } catch (e) {
        console.error("Error adding territory reference:", e);
        throw e;
    }
};

export const deleteTerritorio = async (id) => {
    try {
        ServiceCache.clear('territorios');
        ServiceCache.clear('puntos_interes');
        ServiceCache.clear('historial');
        ServiceCache.clear('programa');

        const tSnap = await getDoc(doc(db, COL_TERRITORIOS, id));
        if (!tSnap.exists()) return;
        const tNum = String(tSnap.data().numero || '').trim();

        const batch = writeBatch(db);
        batch.delete(doc(db, COL_TERRITORIOS, id));

        const histQuery = query(collection(db, "historial_territorios"), where("territorio_id", "==", id));
        const histSnap = await getDocs(histQuery);
        histSnap.forEach(d => batch.delete(d.ref));

        const poiQuery = query(collection(db, "puntos_interes"), where("territorio_id", "==", id));
        const poiSnap = await getDocs(poiQuery);
        poiSnap.forEach(d => batch.delete(d.ref));

        // Scrub from Weekly Program
        const turnos = ['manana', 'tarde', 'noche', 'zoom'];
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));

        for (let i = -8; i <= 4; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + (i * 7));
            const weekId = d.toISOString().split('T')[0];
            const progRef = doc(db, "programa_semanal", weekId);
            const pSnap = await getDoc(progRef);

            if (pSnap.exists()) {
                const prog = pSnap.data();
                let wasModified = false;
                if (Array.isArray(prog.dias)) {
                    prog.dias.forEach(dia => {
                        turnos.forEach(turno => {
                            const slot = dia[turno];
                            if (slot && slot.territorio) {
                                const terrs = String(slot.territorio).split(/ \/ | \/|,/).map(s => s.trim());
                                if (terrs.includes(tNum)) {
                                    const newTerrs = terrs.filter(s => s !== tNum);
                                    slot.territorio = newTerrs.join(' / ');
                                    if (newTerrs.length === 0) {
                                        slot.conductor = '';
                                        slot.auxiliar = '';
                                        slot.lugar = '';
                                        slot.hora = '';
                                        slot.faceta = '';
                                    }
                                    wasModified = true;
                                }
                            }
                        });
                    });
                }
                if (wasModified) batch.set(progRef, prog);
            }
        }
        await batch.commit();
        return true;
    } catch (e) {
        console.error("Critical error in master territory deletion:", e);
        throw e;
    }
};

export const getPuntosInteres = async () => {
    return fetchCached('puntos_interes', async () => {
        const querySnapshot = await getDocs(collection(db, "puntos_interes"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
};

export const addPuntoInteres = async (punto) => {
    ServiceCache.clear('puntos_interes');
    await addDoc(collection(db, "puntos_interes"), punto);
};

export const updatePuntoInteres = async (id, data) => {
    ServiceCache.clear('puntos_interes');
    await updateDoc(doc(db, "puntos_interes", id), data);
};

export const deletePuntoInteres = async (id) => {
    ServiceCache.clear('puntos_interes');
    await deleteDoc(doc(db, "puntos_interes", id));
};

export const assignTerritorio = async (id, conductorName, details = {}) => {
    try {
        const tRef = doc(db, COL_TERRITORIOS, id);
        const tSnap = await getDoc(tRef);
        if (!tSnap.exists()) throw new Error("Territorio no encontrado");
        const tData = tSnap.data();

        const assignmentData = {
            territorio_id: String(tData.numero),
            conductor: conductorName,
            fecha_asignacion: details.fecha_asignacion || new Date().toISOString(),
            fecha_entrega: null,
            estado: 'Asignado',
            turno: details.turno || 'Sin turno',
            observaciones: details.observaciones || '',
            faceta: details.faceta || 'Casa en casa',
            weekId: details.weekId || null,
            timestamp: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, COL_BANCO_S13), assignmentData);
        await saveAuditLog('ASIGNACION_MANUAL', { territorio: tData.numero, conductor: conductorName });

        ServiceCache.clear('territorios_combined');
        return docRef.id;
    } catch (e) {
        console.error("Error al asignar:", e);
        throw e;
    }
};

export const returnTerritorio = async (id, notes, customDate, status = 'Completado', fotos = null) => {
    try {
        const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();
        await runTransaction(db, async (transaction) => {
            const tRef = doc(db, COL_TERRITORIOS, id);
            const tSnap = await transaction.get(tRef);
            if (!tSnap.exists()) return;
            const tData = tSnap.data();

            transaction.update(tRef, {
                asignado_a: null,
                fecha_asignacion: null,
                auxiliar: null,
                lugar: null,
                hora: null,
                faceta: null,
                turno: null,
                ultima_fecha: dateToUse,
                estado: status === 'Perdido' ? 'Extraviado' : (status === 'Disponible' ? 'Sin asignar' : 'Predicado'),
                prog_sync: null
            });

            if (tData.estado === 'Asignado') {
                await updateGlobalStats(transaction, 'territorios_disponibles', 1);
                await updateGlobalStats(transaction, 'territorios_asignados', -1);
            }
        });

        await logReturn(id, dateToUse, status, notes, fotos);
        ServiceCache.clear('territorios');
        ServiceCache.clear('historial');
        ServiceCache.clear('stats_globales');
    } catch (e) {
        console.error("Atomic transaction failed in returnTerritorio:", e);
    }
};

export const resyncGlobalStats = async () => {
    try {
        const all = await getDocs(collection(db, COL_TERRITORIOS));
        const assigned = all.docs.filter(d => d.data().estado === 'Asignado').length;
        const available = all.docs.length - assigned;
        await setDoc(doc(db, "configuracion", "stats_globales"), {
            territorios_asignados: assigned,
            territorios_disponibles: available,
            total_territorios: all.docs.length,
            last_sync: Timestamp.now()
        }, { merge: true });
        ServiceCache.clear('stats_globales');
        return { assigned, available };
    } catch (e) {
        console.error("Error resyncing global stats:", e);
    }
};

export const getMisTerritorios = async (conductorName) => {
    const q = query(collection(db, COL_TERRITORIOS), where("asignado_a", "==", conductorName));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};


export const takeTerritoryPartial = async (originalId, userId, takenManzanas, remainingManzanas) => {
    const territoryRef = doc(db, COL_TERRITORIOS, originalId);
    const territorySnap = await getDoc(territoryRef);
    if (!territorySnap.exists()) throw new Error("Territorio no encontrado");
    const tData = territorySnap.data();

    const newDocParams = {
        ...tData,
        manzanas: takenManzanas.join(', '),
        estado: 'Asignado',
        asignado_a: userId,
        fecha_asignacion: new Date().toISOString(),
        origen_id: originalId
    };
    delete newDocParams.id;
    delete newDocParams.is_incomplete;

    const newDocRef = await addDoc(collection(db, COL_TERRITORIOS), newDocParams);

    if (remainingManzanas.length > 0) {
        await updateDoc(territoryRef, {
            manzanas: remainingManzanas.join(', '),
            estado: 'Libre',
            is_incomplete: true
        });
    } else {
        await updateDoc(territoryRef, {
            estado: 'Asignado',
            asignado_a: userId,
            fecha_asignacion: new Date().toISOString(),
            is_incomplete: false
        });
    }

    await logAssignment({ id: newDocRef.id, ...newDocParams }, userId);
};

export const assignFreeTerritory = async (id, userId, num, manzanasStr) => {
    await updateDoc(doc(db, COL_TERRITORIOS, id), {
        asignado_a: userId,
        fecha_asignacion: new Date().toISOString(),
        estado: 'Asignado',
        is_incomplete: false
    });
    await logAssignment({ id, numero: num, manzanas: manzanasStr }, userId);
};

export const cancelarAsignacion = async (id) => {

    await updateDoc(doc(db, COL_TERRITORIOS, id), {
        asignado_a: null,
        fecha_asignacion: null,
        estado: 'Disponible'
    });
    try {
        const q = query(collection(db, "historial_territorios"), where("territorio_id", "==", id), where("estado", "==", "Asignado"), orderBy("timestamp", "desc"), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            await updateDoc(doc(db, "historial_territorios", snapshot.docs[0].id), {
                estado: 'Cancelado',
                fecha_entrega: new Date().toISOString()
            });
        }
    } catch (e) {
        console.error("Error cancelling history:", e);
    }
};

export const updateAssignmentData = async (id, updates = {}) => {
    const territoryUpdate = {};
    const fields = ['fecha_asignacion', 'fecha_salida', 'asignado_a', 'estado', 'auxiliar', 'faceta', 'hora', 'turno', 'lugar', 'campana', 'grupos'];
    fields.forEach(f => { if (updates[f] !== undefined) territoryUpdate[f] = updates[f]; });

    await updateDoc(doc(db, COL_TERRITORIOS, id), territoryUpdate);

    try {
        const q = query(collection(db, "historial_territorios"), where("territorio_id", "==", id), where("estado", "==", "Asignado"), orderBy("timestamp", "desc"), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const histUpdate = {};
            fields.forEach(f => {
                const target = f === 'asignado_a' ? 'conductor' : f;
                if (updates[f] !== undefined) histUpdate[target] = updates[f];
            });
            await updateDoc(doc(db, "historial_territorios", snapshot.docs[0].id), histUpdate);
        }
    } catch (e) {
        console.error("Error updating history:", e);
    }

    const tSnap = await getDoc(doc(db, COL_TERRITORIOS, id));
    if (tSnap.exists() && tSnap.data().fecha_asignacion) {
        await syncAssignmentToWeeklyProgram({ id, ...tSnap.data() }, tSnap.data().asignado_a, tSnap.data());
    }
    ServiceCache.clear('territorios');
    ServiceCache.clear('historial');
};

export const returnTerritorioMultiple = async (ids, notes, customDate, status = 'Completado') => {
    const batch = writeBatch(db);
    const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();

    for (const id of ids) {
        batch.update(doc(db, COL_TERRITORIOS, id), {
            asignado_a: null,
            fecha_asignacion: null,
            auxiliar: null,
            lugar: null,
            hora: null,
            faceta: null,
            turno: null,
            ultima_fecha: dateToUse,
            estado: status === 'Perdido' ? 'Extraviado' : (status === 'Disponible' ? 'Sin asignar' : 'Predicado'),
            prog_sync: null
        });

        await logReturn(id, dateToUse, status, notes);
    }
    await batch.commit();
};

export const returnTerritorioParcial = async (originalId, completedManzanas, remainingManzanas, unassignRemaining = false, notes = null, customDate = null, fotos = null) => {
    const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();
    const territoryRef = doc(db, COL_TERRITORIOS, originalId);
    const territorySnap = await getDoc(territoryRef);
    if (!territorySnap.exists()) throw new Error("Territorio no encontrado");
    const tData = territorySnap.data();

    if (completedManzanas && completedManzanas.length > 0) {
        await addDoc(collection(db, COL_TERRITORIOS), {
            ...tData,
            manzanas: completedManzanas.join(', '),
            estado: 'Predicado',
            asignado_a: null,
            fecha_asignacion: null,
            ultima_fecha: dateToUse,
            origen_id: originalId
        });
    }

    const updateData = { manzanas: remainingManzanas.join(', ') };
    if (unassignRemaining) {
        updateData.asignado_a = null;
        updateData.fecha_asignacion = null;
        updateData.estado = 'Libre';
    }
    updateData.is_incomplete = remainingManzanas.length > 0;

    await updateDoc(territoryRef, updateData);
    await logReturn(originalId, dateToUse, 'Predicado Parcial', notes, fotos);
};

export const assignTerritorioParcial = async (originalId, manzanasToAssign, conductorName, details = {}) => {
    try {
        const docRef = doc(db, COL_TERRITORIOS, originalId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) throw new Error("Territorio no encontrado");

        const data = snap.data();
        const allManzanas = data.manzanas ? data.manzanas.split(',').map(s => s.trim()).filter(Boolean) : [];
        const toAssign = manzanasToAssign.map(s => s.trim());
        const remaining = allManzanas.filter(m => !toAssign.includes(m));

        const assignmentData = {
            asignado_a: conductorName,
            fecha_asignacion: details.fecha_asignacion || new Date().toISOString(),
            fecha_salida: details.fecha_salida || null,
            estado: 'Asignado',
            auxiliar: details.auxiliar || null,
            lugar: details.lugar || null,
            hora: details.hora || null,
            faceta: details.faceta || null,
            turno: details.turno || null,
            campana: details.campana || null
        };

        if (remaining.length === 0) {
            await updateDoc(docRef, assignmentData);
            await logAssignment({ id: originalId, ...data }, conductorName, details);
        } else {
            await updateDoc(docRef, { manzanas: remaining.join(', ') });
            const newDocRef = await addDoc(collection(db, COL_TERRITORIOS), {
                ...data,
                manzanas: toAssign.join(', '),
                ...assignmentData,
                origen_id: originalId
            });
            await logAssignment({ id: newDocRef.id, ...data, numero: data.numero + ' (P)' }, conductorName, details);
        }
    } catch (e) {
        console.error("Error splitting territory:", e);
        throw e;
    }
};

export const transferTerritorio = async (id, newConductor, manzanasToTransfer, details = {}) => {
    try {
        await logReturn(id, new Date().toISOString(), 'Devuelto (Transferido)', `Transferido a ${newConductor}`);
        const territoryRef = doc(db, COL_TERRITORIOS, id);
        const snap = await getDoc(territoryRef);
        if (!snap.exists()) throw new Error("Territorio no encontrado");
        const tData = snap.data();

        const updateData = {
            asignado_a: newConductor,
            fecha_asignacion: new Date().toISOString(),
            estado: 'Asignado',
            manzanas: manzanasToTransfer || tData.manzanas
        };

        await updateDoc(territoryRef, updateData);

        await logAssignment({ id, ...tData, ...updateData }, newConductor, details);
    } catch (e) {
        console.error("Error transferring territory:", e);
        throw e;
    }
};

export const transferTerritory = transferTerritorio;

