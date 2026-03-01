import { db } from '../../firebase-config.js';
import { collection, query, where, getDocs, addDoc, getDoc, doc, writeBatch, orderBy, setDoc, Timestamp, deleteDoc, updateDoc } from "firebase/firestore";
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

        await setDoc(doc(db, COL_VISOR, weekId), prog);
    } catch (e) {
        console.error("Error syncing to weekly program:", e);
    }
};

export const syncSlotWithTerritories = async (weekId, dayIdx, turno, tData, dateISO, explicitAssignmentDate = null) => {
    try {
        const uiTerrs = tData.territorio ? String(tData.territorio).split(/[,;/]/).map(s => s.trim()).filter(Boolean) : [];
        const conductor = tData.conductor || '';
        const batch = writeBatch(db);

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
                batch.set(ref, {
                    territorio_id: num,
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
        }

        await batch.commit();
        await saveAuditLog('SYNC_PROGRAM_SLOT', { weekId, turno, total: uiTerrs.length });
        ServiceCache.clear('territorios_combined');
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
            await setDoc(doc(db, COL_VISOR, weekId), prog);
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

        prog.dias.forEach((dia, dayIdx) => {
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
        });

        return { hasData: true, totalSlots, pendingFormalization, anomalies: anomalies.slice(0, 50) };
    } catch (e) {
        console.error("Error running diagnostic:", e);
        return { error: e.message };
    }
};

export const saveProgramaSemanal = async (weekId, data) => {
    if (!weekId) throw new Error("Week ID required for saving Visor");
    await setDoc(doc(db, COL_VISOR, weekId), data, { merge: true });
    await saveAuditLog('SAVE_VISOR_DRAFT', { weekId });
};


export const rebuildHistoryFromSchedule = async () => {
    console.warn("rebuildHistoryFromSchedule is retired. S-13 is now authoritative.");
    return 0;
};

export const formalizeWeek = async (weekId, programaData) => {

    try {
        const batch = writeBatch(db);
        if (!programaData.dias) return;

        const qPrev = query(collection(db, COL_BANCO_S13), where("weekId", "==", weekId));
        const snapPrev = await getDocs(qPrev);
        snapPrev.docs.forEach(d => batch.delete(d.ref));

        programaData.dias.forEach((dia, idx) => {
            ['manana', 'tarde', 'noche', 'zoom'].forEach(turno => {
                const asig = dia[turno];
                if (asig && asig.territorio && asig.conductor) {
                    const tNums = String(asig.territorio).split(/[,/]/).map(s => s.trim()).filter(Boolean);
                    tNums.forEach(num => {
                        const ref = doc(collection(db, COL_BANCO_S13));
                        batch.set(ref, {
                            territorio_id: num,
                            conductor: asig.conductor,
                            fecha_asignacion: asig.fecha_especifica || weekId,
                            fecha_entrega: null,
                            estado: 'Asignado',
                            turno: turno,
                            weekId: weekId,
                            timestamp: Timestamp.now(),
                            faceta: asig.faceta || 'Casa en casa',
                            observaciones: asig.observaciones || ''
                        });
                    });
                }
            });
        });

        await batch.commit();
        await saveAuditLog('FORMALIZE_WEEK', { weekId });
        ServiceCache.clear('historial');

        return true;
    } catch (e) {
        console.error("Error formalizing week:", e);
        throw e;
    }
};
