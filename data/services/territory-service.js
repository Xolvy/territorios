import { db, storage } from '../../firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, getDoc, setDoc, Timestamp, writeBatch, arrayUnion, runTransaction, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { ServiceCache, fetchCached } from './base-service.js';
import { logReturn, logAssignment } from './history-service.js';
import { saveAuditLog } from './audit-service.js';
import { syncAssignmentToWeeklyProgram } from './program-service.js';
import { normalizeName } from '../../modules/utils/helpers.js';

const COL_TERRITORIOS = "territorios";
const COL_BANCO_S13 = "banco_s13";

// --- XOLVY SHIELD: GLOBAL AGGREGATIONS (Moved to internal transaction logic) ---
// updateGlobalStats removed to prevent Firestore transaction violations (Reads before Writes)


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
    
    // Aislamiento de Scope: Priorizamos los campos del Live Pool (S-13) 
    // pero permitimos lectura del Maestro con los nuevos nombres
    const estado = latestAssignment ? latestAssignment.estado : (data.status || data.estado || 'Disponible');
    const asignado_a = latestAssignment ? latestAssignment.conductor : (data.currentAssignee || data.asignado_a || null);
    const fecha_asignacion = latestAssignment ? latestAssignment.fecha_asignacion : (data.assignmentDate || data.fecha_asignacion || null);
    const auxiliar = latestAssignment ? (latestAssignment.auxiliar || null) : (data.auxiliar || null);
    const asignado_a_normalized = asignado_a ? normalizeName(asignado_a) : null;
    const auxiliar_normalized = auxiliar ? normalizeName(auxiliar) : null;

    return {
        id,
        numero: numeroStr,
        manzanas: data.manzanas || '',
        manzanas_trabajadas: data.manzanas_trabajadas || [],
        localidad: data.localidad || '',
        geojson: geojson,
        imagen: data.imagen || null,
        estado: estado,
        asignado_a: asignado_a,
        asignado_a_normalized: asignado_a_normalized,
        auxiliar: auxiliar,
        auxiliar_normalized: auxiliar_normalized,
        fecha_asignacion: fecha_asignacion,
        last_assignment: latestAssignment,
        // Alisos para nuevos nombres
        status: estado,
        currentAssignee: asignado_a,
        assignmentDate: fecha_asignacion,
        // Datos puros del Maestro (para Recepción estricta)
        master_status: data.status || data.estado || 'Disponible',
        master_assignee: data.currentAssignee || data.asignado_a || null,
        master_date: data.assignmentDate || data.fecha_asignacion || null
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
            conductor_normalized: normalizeName(conductorName),
            fecha_asignacion: details.fecha_asignacion || new Date().toISOString(),
            fecha_entrega: null,
            estado: 'Asignado',
            turno: details.turno || 'Sin turno',
            observaciones: details.observaciones || '',
            faceta: details.faceta || 'Casa en casa',
            weekId: details.weekId || null,
            timestamp: Timestamp.now()
        };
        if (details.auxiliar) {
            assignmentData.auxiliar = details.auxiliar;
            assignmentData.auxiliar_normalized = normalizeName(details.auxiliar);
        }

        const docRef = await addDoc(collection(db, COL_BANCO_S13), assignmentData);
        await saveAuditLog('ASIGNACION_MANUAL', { territorio: tData.numero, conductor: conductorName });

        // Update Maestro
        await updateDoc(tRef, {
            estado: 'Asignado',
            status: 'Asignado',
            asignado_a: conductorName,
            asignado_a_normalized: normalizeName(conductorName),
            currentAssignee: conductorName,
            fecha_asignacion: assignmentData.fecha_asignacion,
            assignmentDate: assignmentData.fecha_asignacion,
            auxiliar: details.auxiliar || null,
            auxiliar_normalized: details.auxiliar ? normalizeName(details.auxiliar) : null,
            turno: details.turno || 'Sin turno',
            lastUpdated: serverTimestamp()
        });

        ServiceCache.clear('territorios_combined');
        return docRef.id;
    } catch (e) {
        console.error("Error al asignar:", e);
        throw e;
    }
};

export const returnTerritorio = async (id, notes, customDate, status = 'Completado', fotos = null, conductorOverride = null) => {
    try {
        const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();
        let tNumero = null;
        const conductorName = await runTransaction(db, async (transaction) => {
            const tRef = doc(db, COL_TERRITORIOS, id);
            const statsRef = doc(db, "configuracion", "stats_globales");
            
            // --- FASE 1: LECTURAS (Strictly first) ---
            const [tSnap, statsSnap] = await Promise.all([
                transaction.get(tRef),
                transaction.get(statsRef)
            ]);

            if (!tSnap.exists()) return null;
            const tData = tSnap.data();
            tNumero = String(tData.numero || '');
            const prevConductor = tData.asignado_a || null;

            // --- FASE 2: ESCRITURAS (Strictly last) ---
            // CAMBIO A: Estado siempre 'Disponible' para entregas normales (consistencia con returnTerritorioMultiple)
            transaction.update(tRef, {
                asignado_a: null,
                asignado_a_normalized: null,
                fecha_asignacion: null,
                auxiliar: null,
                auxiliar_normalized: null,
                lugar: null,
                hora: null,
                faceta: null,
                turno: null,
                ultima_fecha: dateToUse,
                estado: status === 'Perdido' ? 'Extraviado' : 'Disponible',
                prog_sync: null
            });

            // Update Global Stats atomicity
            if (tData.estado === 'Asignado') {
                if (statsSnap.exists()) {
                    const statsData = statsSnap.data();
                    transaction.update(statsRef, {
                        territorios_disponibles: (statsData.territorios_disponibles || 0) + 1,
                        territorios_asignados: Math.max(0, (statsData.territorios_asignados || 0) - 1)
                    });
                } else {
                    transaction.set(statsRef, {
                        territorios_disponibles: 1,
                        territorios_asignados: 0,
                        total_territorios: 0
                    }, { merge: true });
                }
            }
            return prevConductor;
        });

        // CAMBIO A: Cierre activo de banco_s13 — fuera de la transacción pero con manejo de error explícito
        if (tNumero) {
            try {
                const bancoQuery = query(collection(db, COL_BANCO_S13),
                    where('territorio_id', '==', tNumero),
                    where('estado', '==', 'Asignado')
                );
                const bancoSnap = await getDocs(bancoQuery);
                if (!bancoSnap.empty) {
                    const batchS13 = writeBatch(db);
                    bancoSnap.docs.forEach(d => batchS13.update(d.ref, {
                        estado: status === 'Completado' ? 'Completado' : (status === 'Perdido' ? 'Extraviado' : 'Disponible'),
                        fecha_entrega: dateToUse,
                        timestamp_entrega: serverTimestamp()
                    }));
                    await batchS13.commit();
                    console.log(`✅ [returnTerritorio] banco_s13 cerrado para territorio ${tNumero} (${bancoSnap.size} registro(s))`);
                }
            } catch (bancoError) {
                // CAMBIO A: Error NO silencioso — se loguea con severidad y se propaga
                console.error(`🔴 [returnTerritorio] FALLO CRÍTICO cerrando banco_s13 para territorio ${tNumero}:`, bancoError);
                // No hacemos throw aquí para no romper el flujo principal, pero el error queda visible
            }
        }

        const finalConductor = conductorOverride || conductorName;
        try {
            await logReturn(id, dateToUse, status, notes, fotos, finalConductor);
        } catch (logError) {
            console.error(`🟡 [returnTerritorio] logReturn falló para territorio ${tNumero}:`, logError);
        }
        ServiceCache.clear('territorios');
        ServiceCache.clear('territorios_combined');
        ServiceCache.clear('historial');
        ServiceCache.clear('stats_globales');
    } catch (e) {
        console.error("Atomic transaction failed in returnTerritorio:", e);
        throw e; // Propagar el error para que el llamador sepa que la entrega falló
    }
};

export const resyncGlobalStats = async () => {
    try {
        const [allTerrs, bancoSnap] = await Promise.all([
            getDocs(collection(db, COL_TERRITORIOS)),
            getDocs(query(collection(db, COL_BANCO_S13), where("estado", "==", "Asignado")))
        ]);

        const activeNums = new Set(bancoSnap.docs.map(d => {
            const data = d.data();
            return String(data.territorio_id || '').trim();
        }));

        const batch = writeBatch(db);
        let correctedCount = 0;
        let finalAssigned = 0;

        allTerrs.docs.forEach(docSnap => {
            const data = docSnap.data();
            const tNum = String(data.numero || '').trim();
            const isAssignedInMaster = data.estado === 'Asignado' || data.status === 'Asignado';
            const hasActiveAssignment = activeNums.has(tNum);

            if (isAssignedInMaster && !hasActiveAssignment) {
                // Healer Logic: Si el maestro dice asignado pero no hay registro en el pool S-13, liberar.
                batch.update(docSnap.ref, {
                    estado: 'Disponible',
                    status: 'Disponible',
                    asignado_a: null,
                    currentAssignee: null,
                    fecha_asignacion: null,
                    assignmentDate: null
                });
                correctedCount++;
            } else if (hasActiveAssignment) {
                finalAssigned++;
            }
        });

        if (correctedCount > 0) {
            await batch.commit();
            console.log(`🛡️ [S-13 Healer] Se corrigieron ${correctedCount} estados huérfanos.`);
        }

        const available = allTerrs.docs.length - finalAssigned;
        await setDoc(doc(db, "configuracion", "stats_globales"), {
            territorios_asignados: finalAssigned,
            territorios_disponibles: available,
            total_territorios: allTerrs.docs.length,
            last_sync: Timestamp.now(),
            healed_count: correctedCount
        }, { merge: true });

        ServiceCache.clear('stats_globales');
        ServiceCache.clear('territorios_combined');
        return { assigned: finalAssigned, available, healed: correctedCount };
    } catch (e) {
        console.error("Error resyncing global stats:", e);
        throw e;
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
        asignado_a_normalized: normalizeName(userId),
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
            asignado_a_normalized: normalizeName(userId),
            fecha_asignacion: new Date().toISOString(),
            is_incomplete: false
        });
    }

    await logAssignment({ id: newDocRef.id, ...newDocParams }, userId);
};

export const assignFreeTerritory = async (id, userId, num, manzanasStr) => {
    await updateDoc(doc(db, COL_TERRITORIOS, id), {
        asignado_a: userId,
        asignado_a_normalized: normalizeName(userId),
        fecha_asignacion: new Date().toISOString(),
        estado: 'Asignado',
        is_incomplete: false
    });
    await logAssignment({ id, numero: num, manzanas: manzanasStr }, userId);
};

export const cancelarAsignacion = async (id) => {
    // Obtener el número del territorio ANTES de limpiarlo para buscar en banco_s13
    const tSnap = await getDoc(doc(db, COL_TERRITORIOS, id));
    const tNum = tSnap.exists() ? String(tSnap.data().numero || '') : '';

    await updateDoc(doc(db, COL_TERRITORIOS, id), {
        asignado_a: null,
        asignado_a_normalized: null,
        auxiliar: null,
        auxiliar_normalized: null,
        fecha_asignacion: null,
        estado: 'Disponible'
    });

    // CAMBIO C: Apuntar a banco_s13 (colección autoritativa) en lugar de historial_territorios
    try {
        const bancoQuery = query(collection(db, COL_BANCO_S13), where("territorio_id", "==", tNum), where("estado", "==", "Asignado"), orderBy("timestamp", "desc"), limit(1));
        const snapshot = await getDocs(bancoQuery);
        if (!snapshot.empty) {
            await updateDoc(doc(db, COL_BANCO_S13, snapshot.docs[0].id), {
                estado: 'Cancelado',
                fecha_entrega: new Date().toISOString(),
                timestamp_entrega: serverTimestamp()
            });
            console.log(`✅ [cancelarAsignacion] banco_s13 cerrado para territorio ${tNum}`);
        }
    } catch (e) {
        console.error("Error cancelling assignment in banco_s13:", e);
    }

    ServiceCache.clear('territorios');
    ServiceCache.clear('territorios_combined');
    ServiceCache.clear('historial');
};

export const updateAssignmentData = async (id, updates = {}) => {
    const territoryUpdate = {};
    const fields = ['fecha_asignacion', 'fecha_salida', 'asignado_a', 'estado', 'auxiliar', 'faceta', 'hora', 'turno', 'lugar', 'campana', 'grupos'];
    fields.forEach(f => { if (updates[f] !== undefined) territoryUpdate[f] = updates[f]; });

    if (updates.asignado_a !== undefined) {
        territoryUpdate.asignado_a_normalized = updates.asignado_a ? normalizeName(updates.asignado_a) : null;
    }
    if (updates.auxiliar !== undefined) {
        territoryUpdate.auxiliar_normalized = updates.auxiliar ? normalizeName(updates.auxiliar) : null;
    }

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
            if (updates.asignado_a !== undefined) {
                histUpdate.conductor_normalized = updates.asignado_a ? normalizeName(updates.asignado_a) : null;
            }
            if (updates.auxiliar !== undefined) {
                histUpdate.auxiliar_normalized = updates.auxiliar ? normalizeName(updates.auxiliar) : null;
            }
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
    try {
        const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();
        const batch = writeBatch(db);
        
        // 1. Fetch relevant data for all territories and their active assignments
        const [tSnaps, bancoSnap] = await Promise.all([
            Promise.all(ids.map(id => getDoc(doc(db, COL_TERRITORIOS, id)))),
            getDocs(query(collection(db, COL_BANCO_S13), where("estado", "==", "Asignado")))
        ]);

        const activeAssignmentsForThese = {};
        bancoSnap.docs.forEach(d => {
            const bData = d.data();
            activeAssignmentsForThese[String(bData.territorio_id)] = d.ref;
        });

        const logPromises = [];

        for (const snap of tSnaps) {
            if (!snap.exists()) continue;
            const tId = snap.id;
            const tData = snap.data();
            const tNum = String(tData.numero || '').trim();
            if (!tNum) continue;

            const prevConductor = tData.currentAssignee || tData.asignado_a || null;

            // a) SOBRESCRITURA ABSOLUTA EN MAESTRO (Goma de borrar activa)
            batch.update(doc(db, COL_TERRITORIOS, tId), {
                status: 'Disponible',
                currentAssignee: null,
                assignmentDate: null,
                // Mantener compatibilidad total
                estado: 'Disponible',
                asignado_a: null,
                fecha_asignacion: null,
                ultima_fecha: dateToUse,
                auxiliar: null,
                lugar: null,
                hora: null,
                faceta: null,
                turno: null,
                prog_sync: null,
                lastUpdated: serverTimestamp()
            });

            // b) SOBRESCRITURA EN LIVE POOL (banco_s13)
            // Buscamos el registro activo para este número de territorio
            const activeRef = activeAssignmentsForThese[tNum];
            if (activeRef) {
                console.log(`✅ [Reception] Cerrando ciclo en banco_s13 para ${tNum}`);
                batch.update(activeRef, {
                    estado: status === 'Completado' ? 'Completado' : 'Disponible',
                    fecha_entrega: dateToUse,
                    returnDate: dateToUse, // Campo espejo solicitado
                    timestamp_entrega: serverTimestamp()
                });
            } else {
                console.warn(`⚠️ [Reception] No se encontró asignación 'Asignado' en banco_s13 para el territorio ${tNum}`);
            }

            logPromises.push(logReturn(tId, dateToUse, status, notes, null, prevConductor));
        }

        await batch.commit();
        await Promise.all(logPromises);

        ServiceCache.clear('territorios');
        ServiceCache.clear('territorios_combined');
        ServiceCache.clear('historial');
        ServiceCache.clear('stats_globales');
    } catch (e) {
        console.error("Critical error in atomic returnTerritorioMultiple:", e);
        throw e;
    }
};

export const returnTerritorioParcial = async (originalId, completedManzanas, remainingManzanas, unassignRemaining = false, notes = null, customDate = null, fotos = null, conductorName = null) => {
    const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();
    const territoryRef = doc(db, COL_TERRITORIOS, originalId);
    const territorySnap = await getDoc(territoryRef);
    if (!territorySnap.exists()) throw new Error("Territorio no encontrado");
    const tData = territorySnap.data();
    const tNum = String(tData.numero || '');

    if (completedManzanas && completedManzanas.length > 0) {
        await addDoc(collection(db, COL_TERRITORIOS), {
            ...tData,
            manzanas: completedManzanas.join(', '),
            estado: 'Disponible',
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
        updateData.estado = 'Disponible';
    }
    updateData.is_incomplete = remainingManzanas.length > 0;

    await updateDoc(territoryRef, updateData);

    // CAMBIO E: Cerrar el registro activo en banco_s13 para entregas parciales
    if (unassignRemaining && tNum) {
        try {
            const bancoQ = query(collection(db, COL_BANCO_S13),
                where('territorio_id', '==', tNum),
                where('estado', '==', 'Asignado')
            );
            const bancoSnap = await getDocs(bancoQ);
            if (!bancoSnap.empty) {
                const batchS13 = writeBatch(db);
                bancoSnap.docs.forEach(d => batchS13.update(d.ref, {
                    estado: 'Completado Parcial',
                    fecha_entrega: dateToUse,
                    timestamp_entrega: serverTimestamp()
                }));
                await batchS13.commit();
                console.log(`✅ [returnTerritorioParcial] banco_s13 cerrado para territorio ${tNum}`);
            }
        } catch (bancoError) {
            console.error(`🔴 [returnTerritorioParcial] Error cerrando banco_s13 para ${tNum}:`, bancoError);
        }
    }

    try {
        await logReturn(originalId, dateToUse, 'Predicado Parcial', notes, fotos, conductorName);
    } catch (logError) {
        console.error(`🟡 [returnTerritorioParcial] logReturn falló para territorio ${tNum}:`, logError);
    }

    ServiceCache.clear('territorios');
    ServiceCache.clear('territorios_combined');
    ServiceCache.clear('historial');
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
            asignado_a_normalized: normalizeName(conductorName),
            fecha_asignacion: details.fecha_asignacion || new Date().toISOString(),
            fecha_salida: details.fecha_salida || null,
            estado: 'Asignado',
            auxiliar: details.auxiliar || null,
            auxiliar_normalized: details.auxiliar ? normalizeName(details.auxiliar) : null,
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
            asignado_a_normalized: normalizeName(newConductor),
            fecha_asignacion: new Date().toISOString(),
            estado: 'Asignado',
            manzanas: manzanasToTransfer || tData.manzanas
        };
        if (details.auxiliar) {
            updateData.auxiliar = details.auxiliar;
            updateData.auxiliar_normalized = normalizeName(details.auxiliar);
        }

        await updateDoc(territoryRef, updateData);

        await logAssignment({ id, ...tData, ...updateData }, newConductor, details);
    } catch (e) {
        console.error("Error transferring territory:", e);
        throw e;
    }
};

export const transferTerritory = transferTerritorio;

