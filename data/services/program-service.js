/**
 * @module program-service
 * @description Servicio de gestión del Programa Semanal (Visor) y sincronización
 *              bidireccional con el Live Pool (banco_s13) y el Maestro de territorios.
 *
 * @layer Backend / Data Layer
 * @depends firebase-config.js, base-service.js, audit-service.js
 *
 * @exports
 *  - getProgramaSemanal()              → Programa de una semana por ID
 *  - saveProgramaSemanal()             → Guardar borrador del programa
 *  - syncSlotWithTerritories()         → Sincronizar turno → Maestro + S-13
 *  - formalizeWeek()                   → Formalizar semana (atómico e idempotente)
 *  - importProgramFromJSON()           → Importar datos de IA (Nexo Vision)
 *  - syncAssignmentToWeeklyProgram()   → Sincronizar asignación individual
 *  - removeAssignmentFromWeeklyProgram()→ Quitar asignación del programa
 *  - runProgramDiagnostic()            → Diagnosticar coherencia Visor vs S-13
 *  - getPredicacionPublica()           → Leer predicación pública
 *  - savePredicacionPublica()          → Guardar predicación pública
 *  - getCampanas() / saveCampana() / deleteCampana() → CRUD de campañas
 */
import { db } from '../../firebase-config.js';
import { collection, query, where, getDocs, addDoc, getDoc, doc, writeBatch, orderBy, setDoc, Timestamp, serverTimestamp, deleteDoc, updateDoc } from "firebase/firestore";
import { ServiceCache } from './base-service.js';
import { saveAuditLog } from './audit-service.js';
import { normalizeName } from '../../modules/utils/helpers.js';

// ═══════════════════════════════════════════════════════════
const COL_VISOR    = "programa_semanal"; // Colección del Visor (borrador + formalizado)
const COL_BANCO_S13 = "banco_s13";       // Live Pool de asignaciones S-13

// ═══════════════════════════════════════════════════════════
// PREDICACIÓN PÚBLICA
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// SINCRONIZACIÓN CON EL PROGRAMA SEMANAL
// ═══════════════════════════════════════════════════════════

/**
 * Sincroniza una asignación individual de territorio en el Programa Semanal (Visor).
 * Calcula la semana y el día automáticamente a partir de `details.fecha_asignacion`.
 * @param {object} territoryData - Datos del territorio (numero, etc.)
 * @param {string} conductorName - Nombre del conductor
 * @param {object} details - Detalles de la asignación (fecha, turno, lugar, etc.)
 */
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

// ═══════════════════════════════════════════════════════════
// SINCRONIZACIÓN POR TURNO (Maestro + S-13)
// ═══════════════════════════════════════════════════════════

/**
 * Actualiza en batch el Maestro y el banco_s13 desde un turno del Visor.
 * Elimina registros S-13 de territorios que ya no están en el turno (diff) y
 * crea nuevos registros para los que se agregaron.
 * @param {string} weekId - ID de la semana (YYYY-MM-DD del lunes)
 * @param {number} dayIdx - Índice del día (0=Lunes, 6=Domingo)
 * @param {string} turno - ID del turno ('manana', 'tarde', 'noche', 'zoom')
 * @param {object} tData - Datos del turno del Visor (conductor, territorio, etc.)
 * @param {string} dateISO - Fecha ISO del día
 * @param {string|null} [explicitAssignmentDate=null] - Fecha explícita de asignación
 */
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
            const timestampActual = new Date().toISOString();
            const existingDoc = snapPrev.docs.find(d => d.data().territorio_id === num);
            const condNameNormalized = conductor ? normalizeName(conductor) : null;
            if (!existingDoc) {
                const ref = doc(collection(db, COL_BANCO_S13));
                const tNumStr = String(num).trim();
                batch.set(ref, {
                    territorio_id: tNumStr,
                    numero: tNumStr,
                    conductor: conductor,
                    conductor_normalized: condNameNormalized,
                    fecha_asignacion: timestampActual,
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
                    conductor_normalized: condNameNormalized,
                    timestamp: Timestamp.now()
                });
            }

            // --- MASTER SYNC: Ensure Master Territory is updated ---
            const tId = numToId[num];
            if (tId) {
                batch.update(doc(db, "territorios", tId), {
                    estado: 'Asignado',
                    status: 'Asignado',
                    asignado_a: conductor,
                    asignado_a_normalized: condNameNormalized,
                    currentAssignee: conductor,
                    fecha_asignacion: timestampActual,
                    assignmentDate: timestampActual,
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

/**
 * --- CAMBIO 1 & 2: Sincronización Automática ---
 * Registra o libera territorios en banco_s13 y Maestro de forma automática.
 */
export const sincronizarAsignacionesSalida = async (salida, weekId, fechaSalida) => {
    try {
        if (!salida || !weekId) return;

        // 1. Obtener el mapa de territorios del Maestro (número → {id, numero})
        const terrSnap = await getDocs(collection(db, "territorios"));
        const territoriosMaestro = terrSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. Parsear los números de territorio del string (soporta "8,9,10" / "8/9/10" / "8 9 10")
        const numerosStr = salida.territorio || '';
        const numeros = numerosStr
            .split(/[,;/\s]+/)
            .map(n => n.trim())
            .filter(Boolean);

        if (numeros.length === 0) return; // No hay territorios — saltar

        const conductor = salida.conductor || salida.responsable || '';
        const auxiliar  = salida.auxiliar || null;
        const programa_id = `${weekId}_${salida.turnoId || 'desconocido'}`;

        for (const numero of numeros) {
            const maestro = territoriosMaestro.find(
                t => String(t.numero).trim() === String(numero).trim()
            );
            if (!maestro) {
                console.warn(`[AutoAsign] Territorio #${numero} no encontrado en Maestro`);
                continue;
            }

            // 3. Verificar si ya tiene asignación activa (anti-duplicado) en la misma semana
            const qSameWeek = query(collection(db, COL_BANCO_S13),
                where('territorio_id', 'in', [String(maestro.numero).trim(), maestro.id]),
                where('weekId', '==', weekId),
                where('fecha_entrega', '==', null)
            );
            const existente = await getDocs(qSameWeek);

            if (!existente.empty) {
                const docRef = existente.docs[0].ref;
                await updateDoc(docRef, {
                    territorio_id: String(maestro.numero).trim(),
                    territorio_numero: String(maestro.numero).trim(),
                    numero: String(maestro.numero).trim(),
                    conductor,
                    conductor_normalized: normalizeName(conductor),
                    auxiliar,
                    auxiliar_normalized: auxiliar ? normalizeName(auxiliar) : null,
                    fecha_asignacion: fechaSalida,
                    programa_id,
                    updatedAt: serverTimestamp()
                });
            } else {
                // 4. Auto-cerrar cualquier asignación abierta del pasado para este territorio (autocuración)
                try {
                    const qPastOpen = query(collection(db, COL_BANCO_S13),
                        where('territorio_id', 'in', [String(maestro.numero).trim(), maestro.id]),
                        where('fecha_entrega', '==', null)
                    );
                    const pastSnap = await getDocs(qPastOpen);
                    if (!pastSnap.empty) {
                        const batchClose = writeBatch(db);
                        pastSnap.docs.forEach(d => {
                            batchClose.update(d.ref, {
                                fecha_entrega: fechaSalida,
                                estado: 'Completado',
                                timestamp: Timestamp.now()
                            });
                            console.log(`🧹 [AutoClose] Cerrando asignación antigua de T#${maestro.numero} para ${d.data().conductor}`);
                        });
                        await batchClose.commit();
                    }
                } catch (e) {
                    console.error("Error auto-closing past assignments:", e);
                }

                // 5. Crear nueva asignación en banco_s13
                await addDoc(collection(db, COL_BANCO_S13), {
                    territorio_id:     String(maestro.numero).trim(),
                    territorio_numero: String(maestro.numero).trim(),
                    numero:            String(maestro.numero).trim(),
                    conductor,
                    conductor_normalized: normalizeName(conductor),
                    auxiliar,
                    auxiliar_normalized: auxiliar ? normalizeName(auxiliar) : null,
                    fecha_asignacion:  fechaSalida,
                    fecha_entrega:     null,
                    estado:            'Asignado',
                    weekId,
                    programa_id,
                    createdAt:         serverTimestamp()
                });
            }

            // 5. Actualizar Maestro
            await updateDoc(doc(db, 'territorios', maestro.id), {
                estado:           'Asignado',
                status:           'Asignado',
                asignado_a:       conductor,
                asignado_a_normalized: normalizeName(conductor),
                currentAssignee:  conductor,
                auxiliar:         auxiliar,
                auxiliar_normalized: auxiliar ? normalizeName(auxiliar) : null,
                fecha_asignacion: fechaSalida,
                assignmentDate:   fechaSalida
            });

            // 6. Notificar al sistema
            window.dispatchEvent(new CustomEvent('territorio-liberado', {
                detail: { id: maestro.id, numero, status: 'asignado' }
            }));
        }

        ServiceCache.clear('territorios');
        ServiceCache.clear('territorios_combined');
    } catch (e) {
        console.error("Error en sincronizarAsignacionesSalida:", e);
    }
};

/**
 * Libera territorios que estaban en una salida pero ya no (Limpieza de S-13)
 */
export const liberarAsignacionesDeSalida = async (numerosALiberar, weekId) => {
    try {
        if (!numerosALiberar || numerosALiberar.length === 0) return;

        // Necesitamos el Maestro para mapear números a IDs
        const terrSnap = await getDocs(collection(db, "territorios"));
        const numToId = {};
        terrSnap.forEach(d => {
            const num = String(d.data().numero || '').trim();
            if (num) numToId[num] = d.id;
        });

        for (const num of numerosALiberar) {
            const tNum = String(num).trim();
            const tId = numToId[tNum];
            if (!tId) continue;

            const q = query(collection(db, COL_BANCO_S13), 
                            where('territorio_id', '==', tId), 
                            where('fecha_entrega', '==', null));
            const snap = await getDocs(q);

            for (const d of snap.docs) {
                // Solo liberamos si pertenece a esta semana (protocolo de seguridad)
                if (d.data().weekId === weekId) {
                    await updateDoc(d.ref, { 
                        fecha_entrega: serverTimestamp(),
                        estado: 'Disponible'
                    });

                    // Liberar en Maestro
                    await updateDoc(doc(db, 'territorios', tId), {
                        estado: 'Disponible',
                        status: 'Disponible',
                        asignado_a: null,
                        asignado_a_normalized: null,
                        currentAssignee: null,
                        auxiliar: null,
                        auxiliar_normalized: null,
                        fecha_asignacion: null,
                        assignmentDate: null
                    });
                    
                    window.dispatchEvent(new CustomEvent('territorio-liberado', {
                        detail: { id: tId, numero: tNum, status: 'disponible' }
                    }));
                }
            }
        }
        ServiceCache.clear('territorios');
        ServiceCache.clear('territorios_combined');
    } catch (e) {
        console.error("Error en liberarAsignacionesDeSalida:", e);
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

// ═══════════════════════════════════════════════════════════
// CRUD DEL PROGRAMA SEMANAL (Visor)
// ═══════════════════════════════════════════════════════════

/**
 * Obtiene el programa semanal de una semana específica.
 * @param {string} weekId - ID de la semana en formato YYYY-MM-DD
 * @returns {Promise<object|null>} Datos del programa o null si no existe
 */
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

// ═══════════════════════════════════════════════════════════
// FORMALIZACIÓN (Atómica e Idempotente)
// ═══════════════════════════════════════════════════════════

/**
 * Formaliza una semana: convierte el borrador en asignaciones oficiales en banco_s13.
 * Proceso atómico e idempotente: borra todas las asignaciones previas de la semana
 * y las reescribe. Libera del Maestro los territorios que desaparecieron del programa.
 * @param {string} weekId - ID de la semana a formalizar
 * @param {object[]} assignments - Array de asignaciones del programa
 * @returns {Promise<boolean>} `true` si tuvo éxito
 */
export const formalizeWeek = async (weekId, assignments) => {
    if (!weekId) return;
    
    try {
        const batch = writeBatch(db);
        const assignmentsArray = assignments || [];
        
        // 1. Aislamiento de Scope: Marcar la semana como formalizada
        batch.update(doc(db, COL_VISOR, weekId), { isFormalized: true });

        // --- MASTER RESOLUTION: Map numbers to Doc IDs ---
        const terrSnap = await getDocs(collection(db, "territorios"));
        const numToInfo = {};
        terrSnap.forEach(d => {
            const data = d.data();
            const num = String(data.numero || '').trim();
            if (num) numToInfo[num] = { id: d.id, ...data };
        });

        // 2. DETECTOR DE "BLANK OVERRIDE" (Goma de Borrar Contextual)
        // Obtenemos los registros que estaban asignados ANTES para esta semana específica
        const qPrev = query(collection(db, COL_BANCO_S13), where("weekId", "==", weekId));
        const snapPrev = await getDocs(qPrev);
        
        // Rastreamos qué territorios deben ser liberados si ya no figuran en el programa
        const previouslyAssignedNums = new Set();
        snapPrev.docs.forEach(d => {
            const tNum = String(d.data().territorio_id || d.data().numero || '').trim();
            if (tNum) previouslyAssignedNums.add(tNum);
            
            // Borrado físico de la asignación antigua (OBLIGATORIO por regla de idempotencia)
            batch.delete(d.ref);
        });

        // Rastreamos los nuevos territorios del batch
        const newAssignedNums = new Set(assignmentsArray.map(a => String(a.territorio_id || a.territorio || '').trim()));

        // --- MASTER WIPE: Liberar territorios que el programa "borró" ---
        previouslyAssignedNums.forEach(oldNum => {
            if (!newAssignedNums.has(oldNum)) {
                const info = numToInfo[oldNum];
                if (info) {
                    console.log(`🧹 [Blank Override] Liberando territorio ${oldNum} en Maestro`);
                    batch.update(doc(db, "territorios", info.id), {
                        status: 'Disponible',
                        currentAssignee: null,
                        assignmentDate: null,
                        // Compatibilidad legacy
                        estado: 'Disponible',
                        asignado_a: null,
                        fecha_asignacion: null,
                        lastUpdated: serverTimestamp()
                    });
                }
            }
        });

        // 3. PROCESAMIENTO ATÓMICO DE NUEVAS ASIGNACIONES (Mirror de la UI)
        const warnings = [];
        for (const asig of assignmentsArray) {
            const tNumStr = String(asig.territorio_id || asig.territorio).trim();
            const tInfo = numToInfo[tNumStr];
            const turno = asig.turno || 'manana';

            // --- CAMBIO B: Verificación anti-solapamiento global ---
            const asignacionActiva = await getDocs(
                query(collection(db, COL_BANCO_S13),
                    where('numero', '==', tNumStr),
                    where('fecha_entrega', '==', null))
            );

            if (!asignacionActiva.empty) {
                const docExistente = asignacionActiva.docs[0].data();
                // Si es de otra semana, registramos advertencia
                if (docExistente.weekId !== weekId) {
                    console.warn(`[Formalizar] Territorio ${tNumStr} ya asignado en semana ${docExistente.weekId} por ${docExistente.conductor}`);
                    warnings.push({
                        territorio: tNumStr,
                        semanaExistente: docExistente.weekId,
                        conductor: docExistente.conductor
                    });
                }
            }
            // Continúa la formalización (overwrite) de todas formas por regla de autoridad del programa

            // a) Escribir en Live Pool (ID DETERMINISTA + Sobre-escritura total)
            const timestampActual = new Date().toISOString();
            const docId = `${weekId}_${tNumStr.replace(/[/ \s]/g, '_')}_${turno}`;
            const refS13 = doc(db, COL_BANCO_S13, docId);
            
            const condNameNormalized = asig.conductor ? normalizeName(asig.conductor) : null;
            const auxNameNormalized = asig.auxiliar ? normalizeName(asig.auxiliar) : null;

            const s13Data = {
                territorio_id: tNumStr,
                numero: tNumStr,
                conductor: asig.conductor || '',
                conductor_normalized: condNameNormalized,
                auxiliar: asig.auxiliar || null,
                auxiliar_normalized: auxNameNormalized,
                fecha_asignacion: timestampActual,
                fecha_entrega: null,
                estado: 'Asignado',
                turno: turno,
                weekId: weekId,
                timestamp: Timestamp.now(),
                faceta: asig.faceta || 'Casa en casa',
                observaciones: asig.observaciones || ''
            };

            // setDoc con merge: false garantiza que si el programa dice "X", el Live Pool dice "X"
            batch.set(refS13, s13Data, { merge: false });

            // b) ESPEJO DEL MAESTRO (Sobrescritura Imperativa)
            if (tInfo) {
                console.log(`📍 [Sync] Aplastando Maestro para ${tNumStr}`);
                batch.update(doc(db, "territorios", tInfo.id), {
                    status: 'Asignado',
                    currentAssignee: asig.conductor || '',
                    asignado_a_normalized: condNameNormalized,
                    auxiliar: asig.auxiliar || null,
                    auxiliar_normalized: auxNameNormalized,
                    assignmentDate: timestampActual,
                    lastUpdated: serverTimestamp(),
                    // Compatibilidad
                    estado: 'Asignado',
                    asignado_a: asig.conductor || '',
                    fecha_asignacion: timestampActual,
                    turno: turno
                });
            }
        }

        await batch.commit();
        await saveAuditLog('IDEMPOTENT_FORMALIZE', { weekId, count: assignmentsArray.length });
        
        ServiceCache.clear('historial');
        ServiceCache.clear('territorios_combined');
        ServiceCache.clear('territorios');
        
        return { success: true, warnings };
    } catch (e) {
        console.error("❌ Error en formalizeWeek Atómico/Idempotente:", e);
        throw e;
    }
};

// ═══════════════════════════════════════════════════════════
// IMPORTACIÓN DESDE NEXO AI
// ═══════════════════════════════════════════════════════════

/**
 * Importa un programa semanal desde los datos extraídos por Nexo Vision AI.
 * Mapea los datos del objeto JSON al formato interno del Visor, con soporte
 * para múltiples turnos por día (manana_2, tarde_2, etc.).
 * @param {string} weekId - ID de la semana destino
 * @param {object} aiData - Mapa { NombreDia: [{ turno, conductor, lugar, ... }] }
 * @returns {Promise<boolean>} `true` si la importación fue exitosa
 */
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

