import { db } from '../../firebase-config.js';
import { collection, query, where, getDocs, addDoc, getDoc, doc, writeBatch, orderBy, setDoc, Timestamp, serverTimestamp, deleteDoc, updateDoc } from "firebase/firestore";
import { ServiceCache, fetchCached } from './base-service.js';
import { saveAuditLog } from './audit-service.js';

const COL_VISOR = "programa_semanal";
const COL_BANCO_S13 = "banco_s13";

export const getPredicacionPublica = async () => {
    const querySnapshot = await getDocs(collection(db, "predicacion_publica"));
    if (querySnapshot.empty) return { asignaciones: [] };
    const data = querySnapshot.docs[0].data();
    if (data.dias && !data.asignaciones) data.asignaciones = data.dias;
    return { id: querySnapshot.docs[0].id, ...data };
};

export const savePredicacionPublica = async (data) => {
    const current = await getPredicacionPublica();
    if (current.id) {
        await updateDoc(doc(db, "predicacion_publica", current.id), data);
    } else {
        await addDoc(collection(db, "predicacion_publica"), data);
    }
};

export const syncAssignmentToWeeklyProgram = async (territoryData, conductorName, details) => {
    try {
        const baseDateStr = details.fecha_asignacion || new Date().toISOString();
        const baseDate = new Date(baseDateStr.split('T')[0] + 'T12:00:00Z');
        if (isNaN(baseDate.getTime())) return;

        const d = new Date(baseDate);
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - (day === 0 ? 6 : day - 1);
        d.setUTCDate(diff);
        d.setUTCHours(12, 0, 0, 0);
        const weekId = d.toISOString().split('T')[0];

        const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        let dayIdx = -1;

        if (details.fecha_salida) {
            if (dayNames.includes(details.fecha_salida)) {
                dayIdx = dayNames.indexOf(details.fecha_salida);
            } else {
                const sDate = new Date(details.fecha_salida);
                if (!isNaN(sDate.getTime())) {
                    dayIdx = sDate.getUTCDay();
                    dayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
                }
            }
        }

        if (dayIdx === -1) {
            dayIdx = baseDate.getUTCDay();
            dayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
        }

        if (dayIdx === -1) return;
        if (details.prog_sync === true) return;

        const turno = details.turno || 'manana';
        let prog = await getProgramaSemanal(weekId);
        if (!prog) {
            prog = {
                id: weekId,
                dias: dayNames.map(name => ({ nombre: name, manana: {}, tarde: {}, noche: {}, zoom: {} }))
            };
        }

        if (!prog.dias[dayIdx]) prog.dias[dayIdx] = { nombre: dayNames[dayIdx] };
        if (!prog.dias[dayIdx][turno]) prog.dias[dayIdx][turno] = {};

        const t = prog.dias[dayIdx][turno];
        if (details.blocks && details.blocks.length > 0) {
            t.territorio = details.blocks.map(b => b.territorio || territoryData.numero).join(' / ');
            t.conductor = details.blocks.map(b => b.conductor).join(' / ');
            t.auxiliar = details.blocks.map(b => b.auxiliar || '-').join(' / ');
            t.grupos = details.blocks.map(b => b.grupos || '-').join(' | ');
        } else {
            const tNumStr = String(territoryData.numero).trim();
            if (t.territorio && t.territorio.length > 0) {
                const parts = String(t.territorio).split(/[,/]/).map(p => p.trim()).filter(Boolean);
                if (!parts.includes(tNumStr)) t.territorio = [...parts, tNumStr].join(' / ');
            } else {
                t.territorio = tNumStr;
            }
            t.conductor = conductorName;
            t.auxiliar = details.auxiliar || '';
            if (details.grupos) t.grupos = details.grupos;
        }

        t.lugar = details.lugar || t.lugar || '';
        t.hora = details.hora || t.hora || '';
        t.faceta = details.faceta || t.faceta || '';
        if (details.campana !== undefined) t.campana = details.campana;

        // Protocolo de Sanitización Anti-Undefined de Firebase
        const sanitizedProg = JSON.parse(JSON.stringify(prog));
        await setDoc(doc(db, COL_VISOR, weekId), sanitizedProg);
    } catch (e) {
        console.error("Error syncing to weekly program:", e);
    }
};

export const syncSlotWithTerritories = async (weekId, dayIdx, turno, tData, dateISO, explicitAssignmentDate = null) => {
    try {
        const uiTerrs = tData.territorio ? String(tData.territorio).split(/[,;/]/).map(s => s.trim()).filter(Boolean) : [];
        const conductor = tData.conductor || '';
        const batch = writeBatch(db);

        // --- MASTER SYNC: Resolve all territory numbers to doc IDs ---
        const terrSnap = await getDocs(collection(db, "territorios"));
        const numToId = {};
        terrSnap.forEach(d => {
            const num = String(d.data().numero || '').trim();
            if (num) numToId[num] = d.id;
        });

        const qPrev = query(collection(db, COL_BANCO_S13),
            where("weekId", "==", weekId),
            where("turno", "==", turno),
            where("estado", "==", "Asignado")
        );
        const snapPrev = await getDocs(qPrev);

        snapPrev.docs.forEach(d => {
            const data = d.data();
            if (!uiTerrs.includes(data.territorio_id)) batch.delete(d.ref);
        });

        for (const num of uiTerrs) {
            const existingDoc = snapPrev.docs.find(d => d.data().territorio_id === num);
            if (!existingDoc) {
                const ref = doc(collection(db, COL_BANCO_S13));
                const tNumStr = String(num).trim();
                batch.set(ref, {
                    territorio_id: tNumStr,
                    numero: tNumStr,
                    conductor: conductor,
                    fecha_asignacion: explicitAssignmentDate || weekId,
                    fecha_entrega: null,
                    estado: 'Asignado',
                    turno: turno,
                    weekId: weekId,
                    timestamp: Timestamp.now(),
                    faceta: tData.faceta || 'Casa en casa',
                    observaciones: tData.observaciones || ''
                });
            } else if (existingDoc.data().conductor !== conductor) {
                batch.update(existingDoc.ref, {
                    conductor: conductor,
                    timestamp: Timestamp.now()
                });
            }

            // --- MASTER SYNC: Ensure Master Territory is updated ---
            const tId = numToId[num];
            if (tId) {
                batch.update(doc(db, "territorios", tId), {
                    estado: 'Asignado',
                    asignado_a: conductor,
                    fecha_asignacion: explicitAssignmentDate || weekId,
                    turno: turno
                });
            }
        }

        await batch.commit();
        await saveAuditLog('SYNC_PROGRAM_SLOT', { weekId, turno, total: uiTerrs.length });
        ServiceCache.clear('territorios_combined');
        ServiceCache.clear('territorios');
        ServiceCache.clear('historial');
    } catch (e) {
        console.error("Error in syncSlotWithTerritories:", e);
        throw e;
    }
};

export const removeAssignmentFromWeeklyProgram = async (territoryNum, fechaISO, turno) => {
    try {
        if (!fechaISO || !turno) return;
        const baseDateStr = fechaISO.split('T')[0] + 'T12:00:00Z';
        const baseDate = new Date(baseDateStr);
        if (isNaN(baseDate.getTime())) return;

        const d = new Date(baseDate);
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - (day === 0 ? 6 : day - 1);
        d.setUTCDate(diff);
        d.setUTCHours(12, 0, 0, 0);
        const weekId = d.toISOString().split('T')[0];

        let dayIdx = baseDate.getUTCDay();
        dayIdx = dayIdx === 0 ? 6 : dayIdx - 1;

        let prog = await getProgramaSemanal(weekId);
        if (!prog || !prog.dias[dayIdx]) return;

        const t = prog.dias[dayIdx][turno];
        if (t && t.territorio) {
            const terrs = String(t.territorio).split(/[/,]/).map(s => s.trim());
            const filtered = terrs.filter(num => num != territoryNum);
            if (filtered.length === 0) {
                prog.dias[dayIdx][turno] = { territorio: '', conductor: '', auxiliar: '', grupos: '', lugar: '', hora: '', faceta: '' };
            } else {
                t.territorio = filtered.join(' / ');
            }
            // Protocolo de Sanitización Anti-Undefined de Firebase
            const sanitizedProg = JSON.parse(JSON.stringify(prog));
            await setDoc(doc(db, COL_VISOR, weekId), sanitizedProg);
        }
    } catch (e) {
        console.error("Error in removeAssignmentFromWeeklyProgram:", e);
    }
};

export const getCampanas = async () => {
    const snap = await getDoc(doc(db, "configuracion", "campanas"));
    return snap.exists() ? snap.data().list || [] : [];
};

export const saveCampana = async (name) => {
    const list = await getCampanas();
    if (!list.includes(name)) {
        list.push(name);
        await setDoc(doc(db, "configuracion", "campanas"), { list });
    }
};

export const deleteCampana = async (name) => {
    const list = await getCampanas();
    const newList = list.filter(c => c !== name);
    await setDoc(doc(db, "configuracion", "campanas"), { list: newList });
};

export const getProgramaSemanal = async (weekId) => {
    try {
        if (!weekId) return null;
        const snap = await getDoc(doc(db, COL_VISOR, weekId));
        return snap.exists() ? snap.data() : null;
    } catch (e) {
        console.error("Error fetching program from Visor:", e);
        return null;
    }
};

export const deleteProgramaSemanal = async (weekId) => {
    if (!weekId) return;
    await deleteDoc(doc(db, COL_VISOR, weekId));
    ServiceCache.clear('programas');
};

export const runProgramDiagnostic = async (weekId) => {
    try {
        const prog = await getProgramaSemanal(weekId);
        if (!prog) return { hasData: false };

        const qBanco = query(collection(db, COL_BANCO_S13), where("weekId", "==", weekId), orderBy("timestamp", "desc"));
        const snapBanco = await getDocs(qBanco);
        const bancoRecords = snapBanco.docs.map(d => d.data());

        const anomalies = [];
        let totalSlots = 0;
        let pendingFormalization = 0;

        let successCount = 0;
        for (let dayIdx = 0; dayIdx < prog.dias.length; dayIdx++) {
            const dia = prog.dias[dayIdx];
            ['manana', 'tarde', 'noche', 'zoom'].forEach(turno => {
                const data = dia[turno];
                if (data && data.territorio && data.conductor) {
                    totalSlots++;
                    const tNums = String(data.territorio).split(/[,;/]/).map(s => s.trim()).filter(Boolean);
                    tNums.forEach(num => {
                        const isInBanco = bancoRecords.some(r => String(r.territorio_id) === String(num) && r.turno === turno && r.conductor === data.conductor);
                        if (!isInBanco) {
                            pendingFormalization++;
                            anomalies.push({ type: 'banco_mismatch', territory: num, day: dia.nombre, turno, programConductor: data.conductor, status: 'Borrador (No Formalizado)' });
                        }
                    });
                }
            });
        }

        return { hasData: true, totalSlots, pendingFormalization, anomalies: anomalies.slice(0, 50) };
    } catch (e) {
        console.error("Error running diagnostic:", e);
        return { error: e.message };
    }
};

export const saveProgramaSemanal = async (weekId, data) => {
    if (!weekId) throw new Error("Week ID required for saving Visor");
    
    // Protocolo de Sanitización Anti-Undefined de Firebase
    const sanitizedData = JSON.parse(JSON.stringify(data));
    
    await setDoc(doc(db, COL_VISOR, weekId), sanitizedData, { merge: true });
    await saveAuditLog('SAVE_VISOR_DRAFT', { weekId });
};


export const rebuildHistoryFromSchedule = async () => {
    console.warn("rebuildHistoryFromSchedule is retired. S-13 is now authoritative.");
    return 0;
};

export const formalizeWeek = async (weekId, assignments) => {
    if (!weekId || !assignments || assignments.length === 0) return;
    
    try {
        const batch = writeBatch(db);
        
        // 1. Aislamiento de Scope: Marcar la semana como formalizada
        batch.update(doc(db, COL_VISOR, weekId), { isFormalized: true });

        // --- MASTER SYNC: Resolve all territory numbers to doc IDs ---
        const terrSnap = await getDocs(collection(db, "territorios"));
        const numToId = {};
        terrSnap.forEach(d => {
            const num = String(d.data().numero || '').trim();
            if (num) numToId[num] = d.id;
        });

        // REGLA DE SOBRESCRITURA TOTAL: Limpiar el Live Pool de esta semana
        const qPrev = query(collection(db, COL_BANCO_S13), where("weekId", "==", weekId));
        const snapPrev = await getDocs(qPrev);
        snapPrev.docs.forEach(d => batch.delete(d.ref));

        // 2. Procesar cada asignación en un flujo atómico
        for (const asig of assignments) {
            const tNumStr = String(asig.territorio_id || asig.territorio).trim();
            const tId = numToId[tNumStr];

            // b) Escribir/Actualizar el registro en el Live Pool (banco_s13)
            const refS13 = doc(collection(db, COL_BANCO_S13));
            batch.set(refS13, {
                territorio_id: tNumStr,
                numero: tNumStr,
                conductor: asig.conductor,
                fecha_asignacion: asig.fecha_asignacion || weekId,
                fecha_entrega: null,
                estado: 'Asignado',
                turno: asig.turno || 'manana',
                weekId: weekId,
                timestamp: Timestamp.now(),
                faceta: asig.faceta || 'Casa en casa',
                observaciones: asig.observaciones || ''
            });

            // c) SOBRESCRIBIR EL MAESTRO (Forzado e idéntico)
            if (tId) {
                console.log("Guardando en Maestro:", { conductor: asig.conductor, fecha: asig.fecha_asignacion || weekId, tNumStr, tId });
                batch.update(doc(db, "territorios", tId), {
                    status: 'Asignado',
                    currentAssignee: asig.conductor,
                    assignmentDate: asig.fecha_asignacion || weekId,
                    lastUpdated: serverTimestamp(),
                    // Mantenemos compatibilidad con campos antiguos para no romper el resto de la UI
                    estado: 'Asignado',
                    asignado_a: asig.conductor,
                    fecha_asignacion: asig.fecha_asignacion || weekId
                });
            }
        }

        await batch.commit();
        await saveAuditLog('FORMALIZE_WEEK_ATOMIC', { weekId, count: assignments.length });
        
        ServiceCache.clear('historial');
        ServiceCache.clear('territorios_combined');
        ServiceCache.clear('territorios');
        
        return true;
    } catch (e) {
        console.error("Error in atomic formalizeWeek:", e);
        throw e;
    }
};

export const importProgramFromJSON = async (weekId, aiData) => {
    try {
        if (!weekId || !aiData) throw new Error("Parámetros insuficientes");

        const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        
        // Crear estructura base
        const newProg = {
            id: weekId,
            dias: dayNames.map(name => ({
                nombre: name,
                manana: {},
                tarde: {},
                noche: {},
                zoom: {}
            }))
        };

        // Mapear datos de la IA
        for (const [diaNombre, turnos] of Object.entries(aiData)) {
            const diaIdx = dayNames.indexOf(diaNombre);
            if (diaIdx === -1) continue;

            const diaProg = newProg.dias[diaIdx];
            
            if (Array.isArray(turnos)) {
                turnos.forEach(t => {
                    // Normalizar turnoId: 'mañana' → 'manana', 'MAÑANA' → 'manana'
                    const rawTurno = String(t.turno || 'manana').toLowerCase();
                    const baseId = rawTurno.normalize("NFD").replace(/[\u0300-\u036f]/g, "").split('_')[0];
                    
                    // Solo aceptamos turnos válidos en nuestra estructura
                    if (!['manana', 'tarde', 'noche', 'zoom'].includes(baseId)) return;

                    // Omitir si no hay ningún dato de valor
                    const hasContent = t.conductor || t.territorio || t.faceta || t.lugar || t.hora;
                    if (!hasContent) return;

                    const slotData = {
                        lugar: t.lugar || '',
                        hora: t.hora || '',
                        conductor: t.conductor || '',
                        auxiliar: t.auxiliar || '',
                        faceta: t.faceta || '',
                        territorio: t.territorio || '',
                        grupos: t.grupos || ''
                    };

                    // Si el slot base ya tiene datos, buscar el siguiente id disponible (manana_2, manana_3...)
                    if (diaProg[baseId] && (diaProg[baseId].conductor || diaProg[baseId].territorio || diaProg[baseId].faceta || diaProg[baseId].lugar)) {
                        let n = 2;
                        while (diaProg[`${baseId}_${n}`]) n++;
                        diaProg[`${baseId}_${n}`] = slotData;
                    } else {
                        diaProg[baseId] = slotData;
                    }
                });
            }
        }

        // Guardar en Firestore con Sanitización
        const sanitizedProg = JSON.parse(JSON.stringify(newProg));
        await setDoc(doc(db, COL_VISOR, weekId), sanitizedProg);
        await saveAuditLog('IMPORT_AI_PROGRAM', { weekId });

        return true;
    } catch (e) {
        console.error("Error importing program from AI JSON:", e);
        throw e;
    }
};

