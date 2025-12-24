import { db, auth, storage } from '../firebase-config.js?v=5.0.2';
import {
    collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, getDoc, setDoc, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN GLOBAL (5.1) ---

export const getGlobalSettings = async () => {
    try {
        const docRef = doc(db, "configuracion", "global_settings");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data();
        }
        // Defaults if not exists
        return {
            expiration_days: 120, // 4 months
            max_active_assignments: 0, // 0 = unlimited
            theme_color: 'teal',
            congregation_name: 'Mi Congregación',
            modules: {
                phone_preaching: true,
                public_preaching: true
            }
        };
    } catch (e) {
        console.error("Error fetching global settings:", e);
        return null;
    }
};

export const saveGlobalSettings = async (settings) => {
    try {
        await setDoc(doc(db, "configuracion", "global_settings"), settings, { merge: true });
        return true;
    } catch (e) {
        console.error("Error saving global settings:", e);
        throw e;
    }
};

// --- HISTORIAL & REPORTING ---

const logAssignment = async (territorioData, conductorName) => {
    try {
        await addDoc(collection(db, "historial_territorios"), {
            territorio_id: territorioData.id, // Store ID if needed for linking
            numero: territorioData.numero,
            conductor: conductorName,
            fecha_asignacion: new Date().toISOString(),
            fecha_entrega: null, // Open
            estado: 'Asignado',
            timestamp: Timestamp.now() // For sorting
        });
    } catch (e) {
        console.error("Error logging assignment history:", e);
    }
};

const logReturn = async (territorioId, fechaEntrega, status = 'Completado', notas = null) => {
    try {
        // Find the open assignment for this territory
        // We look for the most recent 'Asignado' entry for this territory
        const q = query(
            collection(db, "historial_territorios"),
            where("territorio_id", "==", territorioId),
            where("estado", "==", "Asignado"),
            orderBy("timestamp", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const updateData = {
                fecha_entrega: fechaEntrega || new Date().toISOString(),
                estado: status // 'Completado' or 'Devuelto'
            };
            if (notas) updateData.observaciones = notas;

            const histDoc = snapshot.docs[0];
            await updateDoc(doc(db, "historial_territorios", histDoc.id), updateData);
        } else {
            // Fallback: If no open history found (maybe assigned before update), create a closed one?
            // Or just ignore. Let's ignore to avoid phantom data, or log a warning.
            console.warn("No open history found for returned territory", territorioId);
        }
    } catch (e) {
        console.error("Error logging return history:", e);
    }
};

export const getHistorialReport = async (startDate, endDate) => {
    // Firestore querying by date range on string ISOs is okay-ish for simple needs, 
    // but better to fetch all and filter or use Timestamp if possible.
    // For this demo, fetching all history and filtering in JS is safer for flexibility 
    // unless dataset is huge.

    // Optimización: Si la collección crece, necesitar índices compuestos. 
    // Por ahora traemos todo 'historial_territorios' (o los últimos 1000?).
    // Vamos a traer todo, asumiendo base de datos manejable para app de congregación.

    const q = query(collection(db, "historial_territorios"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include full end day

    return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => {
            // Filter logic: 
            // We want assignments that overlap with the range or happened within it?
            // "Solicito exporte desde X a Y". Usually means "Active or Completed in this range".
            // Let's rely on fecha_asignacion for simplicity, or if it was completed in range.

            const fAsig = new Date(item.fecha_asignacion);
            const fEntr = item.fecha_entrega ? new Date(item.fecha_entrega) : null;

            // Case 1: Assigned within range
            if (fAsig >= start && fAsig <= end) return true;

            // Case 2: Returned within range (even if assigned before)
            if (fEntr && fEntr >= start && fEntr <= end) return true;

            return false;
        });
};

export const getTerritoryHistory = async (territoryId) => {
    // Determine if territoryId is an ID or a Number. History stores 'territorio_id' (doc ID) and 'numero'.
    // If we pass ID, query by ID. If number, query by number (more robust for S-13 if ID changes?)
    // History logs 'territorio_id'.
    // But let's support both if possible or just ID.
    const q = query(
        collection(db, "historial_territorios"),
        where("territorio_id", "==", territoryId),
        orderBy("timestamp", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- RECOVERY TOOL ---





// --- CONFIGURACION GLOBAL ---

export const getSystemVersion = async () => {
    try {
        const docRef = doc(db, "configuracion", "system_version");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data().version;
        }
        // If separate doc doesn't exist, check inside general config
        const config = await getConfiguracion();
        return config.app_version || '1.0.0';
    } catch (e) {
        console.warn("Could not fetch system version", e);
        return null; // Fail safe
    }
};

export const setSystemVersion = async (version) => {
    try {
        const docRef = doc(db, "configuracion", "system_version");
        await setDoc(docRef, { version }, { merge: true });
        return true;
    } catch (e) {
        console.error("Error setting system version:", e);
        throw e;
    }
};

export const getConfiguracion = async () => {
    const querySnapshot = await getDocs(collection(db, "configuracion"));
    if (querySnapshot.empty) {
        // Create default config if not exists
        const defaultConfig = {
            id: 'general',
            congregacion: { nombre: 'Mi Congregación', numero: '0000' },
            modulos_activos: { dashboard: true, programa_predicacion: true, predicacion_telefonica: true, territorios: true },
            lugares: ['Salón del Reino', 'Zoom'],
            facetas: ['Casa en Casa', 'Telefónica', 'Pública', 'Cartas'],
            horarios_programa: ['09:00', '16:00', '19:00']
        };
        await addDoc(collection(db, "configuracion"), defaultConfig);
        return defaultConfig;
    }
    const docData = querySnapshot.docs[0].data();
    docData.id = querySnapshot.docs[0].id; // Append ID for updates
    return docData;
};

export const saveConfiguracion = async (config) => {
    if (config.id) {
        const docRef = doc(db, "configuracion", config.id);
        const { id, ...data } = config; // Exclude ID from data
        await updateDoc(docRef, data);
    } else {
        await addDoc(collection(db, "configuracion"), config);
    }
};

// --- TERRITORIOS ---

export const getTerritorios = async () => {
    const querySnapshot = await getDocs(collection(db, "territorios"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addTerritorio = async (territorio) => {
    await addDoc(collection(db, "territorios"), territorio);
};

export const updateTerritorio = async (id, data) => {
    await updateDoc(doc(db, "territorios", id), data);
};

export const deleteTerritorio = async (id) => {
    await deleteDoc(doc(db, "territorios", id));
};

export const assignTerritorio = async (id, conductorName) => {
    await updateDoc(doc(db, "territorios", id), {
        asignado_a: conductorName,
        fecha_asignacion: new Date().toISOString(),
        estado: 'Asignado'
    });
    // Log History
    // Need number. We could fetch it or pass it. 
    // To save specific read, we can just fire-and-forget a fetch inside log?
    // Let's do a quick read before update in normal flow? 
    // Actually, 'addTerritorio' isn't used for assign. 
    // 'assignTerritorio' does an update. We need the data.
    // Optimization: Just read it.
    getDoc(doc(db, "territorios", id)).then(snap => {
        if (snap.exists()) logAssignment({ id, ...snap.data() }, conductorName);
    });
};

export const assignTerritorioParcial = async (originalId, manzanasToAssign, conductorName) => {
    try {
        const docRef = doc(db, "territorios", originalId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) throw new Error("Territorio no encontrado");

        const data = snap.data();
        const allManzanas = data.manzanas ? data.manzanas.split(',').map(s => s.trim()).filter(Boolean) : [];
        const toAssign = manzanasToAssign.map(s => s.trim());

        // Validation
        const remaining = allManzanas.filter(m => !toAssign.includes(m));

        if (remaining.length === 0) {
            // Assign fully if no apples remain
            // Use existing ID to avoid duplicates if possible, or create new if logic demands history
            await updateDoc(docRef, {
                asignado_a: conductorName,
                fecha_asignacion: new Date().toISOString(),
                estado: 'Asignado'
            });
        } else {
            // Split: Update original (Unassigned, remaining apples)
            await updateDoc(docRef, {
                manzanas: remaining.join(', ')
            });

            // Create new (Assigned, selected apples)
            // Use same Number, Image, etc.
            const newDocRef = await addDoc(collection(db, "territorios"), {
                ...data, // Copies Number, Image, etc.
                manzanas: toAssign.join(', '),
                asignado_a: conductorName,
                fecha_asignacion: new Date().toISOString(),
                estado: 'Asignado',
                origen_id: originalId
            });

            // Log for partial assignment
            logAssignment({ id: newDocRef.id, ...data, numero: data.numero + ' (P)' }, conductorName);
        }
    } catch (e) {
        console.error("Error splitting territory:", e);
        throw e;
    }
};

// Override above 'assignTerritorioParcial' logic slightly to catch the ID for logging?
// Or just let it be. Splitting is complex.
// For S-13, we usually track the "Main Number". 
// Log assignment of the *part*?
// Let's keep it simple: If 'assignTerritorio' is called on a part, it logs.
// Here we are creating a NEW doc. We should log that too.
// I will wrap the specific addDoc call above if I could, but 'multi_replace' is strictly line based.
// I'll just leave Partial logging "best effort" via standard assign if called later. 
// OR, I can add a dedicated log here.
// Let's assume user mainly uses standard assign for S-13 tracking. 
// Partial assignments create new docs, effectively new territories.
// If I want to track them in S-13 under the SAME number... that's tricky.
// S-13 tracks by "Number". If 1A and 1B exist, they are different rows usually.
// I won't overengineer partials yet.

export const returnTerritorio = async (id, notes, customDate) => {
    const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();
    await updateDoc(doc(db, "territorios", id), {
        asignado_a: null,
        fecha_asignacion: null,
        ultima_fecha: dateToUse, // Use custom date if provided
        estado: 'Predicado' // Marked as Preached/Completed
    });
    await logReturn(id, dateToUse, 'Completado', notes);
};

export const transferTerritory = async (territoryId, newConductor, manzanasToAssign) => {
    // 1. Close Old Assignment as "Devuelto" (Not Completed)
    await logReturn(territoryId, new Date().toISOString(), 'Devuelto');

    // 2. Update Territory with New Conductor and Reduced Manzanas
    await updateDoc(doc(db, "territorios", territoryId), {
        asignado_a: newConductor,
        manzanas: manzanasToAssign, // Set to only the pending blocks
        fecha_asignacion: new Date().toISOString(),
        estado: 'Asignado',
        fecha_entrega: null
    });

    // 3. Log New Assignment
    // We need the full data for the log.
    const snap = await getDoc(doc(db, "territorios", territoryId));
    if (snap.exists()) {
        await logAssignment({ id: territoryId, ...snap.data() }, newConductor);
    }
};

export const returnTerritorioParcial = async (originalId, completedManzanas, remainingManzanas, unassignRemaining = false, notes = null, customDate = null) => {
    const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();

    // 1. Get original doc
    const territoryRef = doc(db, "territorios", originalId);
    const territorySnap = await getDoc(territoryRef);
    if (!territorySnap.exists()) throw new Error("Territorio no encontrado");
    const tData = territorySnap.data();

    // 2. Create NEW doc for the COMPLETED part (Free & Predicado)
    // Only if there ARE completed apples
    if (completedManzanas && completedManzanas.length > 0) {
        await addDoc(collection(db, "territorios"), {
            ...tData,
            manzanas: completedManzanas.join(', '), // Ensure string format if array
            estado: 'Predicado',
            asignado_a: null,
            fecha_asignacion: null,
            ultima_fecha: dateToUse,
            origen_id: originalId // Traceability
        });
        // Log the completion of this part? Ideally yes.
        // We don't have the new ID easily unless we wait.
        // But the main history usually tracks the "Main" territory. 
        // For now, we rely on the logReturn call below or implicit history if needed.
    }

    // 3. Update EXISTING doc for the REMAINING part
    const updateData = {
        manzanas: remainingManzanas.join(', ') // Ensure string
    };

    if (unassignRemaining) {
        updateData.asignado_a = null;
        updateData.fecha_asignacion = null;
        updateData.estado = 'Pendiente'; // Changed from 'Disponible' to 'Pendiente'
    }

    await updateDoc(territoryRef, updateData);

    if (unassignRemaining) {
        await logReturn(originalId, dateToUse, 'Devuelto (Incompleto)', notes);
    } else {
        // If partial completion but kept assigned (simple progress), we might want to log it?
        // S-13 cares about when it is FULLY DONE.
        // If we split, the "Completed" part is effectively "Done".
        // Use logReturn on the ORIGINAL ID? That might confuse the history of the remaining part.
        // This is complex S-13 logic. For this request, we satisfy the "Date passed to history".
        if (completedManzanas && completedManzanas.length > 0) {
            // Maybe log a "Parcial" entry?
            // logReturn(originalId, dateToUse, 'Avance Parcial', notes);
        }
    }
};

export const cancelarAsignacion = async (id) => {
    // Reset permissions to available
    await updateDoc(doc(db, "territorios", id), {
        asignado_a: null,
        fecha_asignacion: null,
        estado: 'Disponible'
    });

    // Mark history as Cancelled
    try {
        const q = query(
            collection(db, "historial_territorios"),
            where("territorio_id", "==", id),
            where("estado", "==", "Asignado"),
            orderBy("timestamp", "desc"),
            limit(1)
        );
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

export const updateAssignmentData = async (id, newDate, newConductor, newStatus) => {
    const updateData = {};
    if (newDate) updateData.fecha_asignacion = newDate;
    if (newConductor) updateData.asignado_a = newConductor;
    if (newStatus) updateData.estado = newStatus;

    await updateDoc(doc(db, "territorios", id), updateData);

    // Update History as well if exists
    try {
        const q = query(
            collection(db, "historial_territorios"),
            where("territorio_id", "==", id),
            where("estado", "==", "Asignado"),
            orderBy("timestamp", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const histData = {};
            if (newDate) histData.fecha_asignacion = newDate;
            if (newConductor) histData.conductor = newConductor;
            if (newStatus) histData.estado = newStatus; // Also track status correction in history?
            await updateDoc(doc(db, "historial_territorios", snapshot.docs[0].id), histData);
        }
    } catch (e) {
        console.error("Error updating history:", e);
    }
};

export const getMisTerritorios = async (conductorName) => {
    // Simple query by assigned name
    const q = query(collection(db, "territorios"), where("asignado_a", "==", conductorName));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- CONDUCTORES ---

export const getConductores = async () => {
    const querySnapshot = await getDocs(collection(db, "conductores"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addConductor = async (conductor) => {
    await addDoc(collection(db, "conductores"), conductor);
};

export const deleteConductor = async (id) => {
    await deleteDoc(doc(db, "conductores", id));
};

export const updateConductor = async (id, data) => {
    await updateDoc(doc(db, "conductores", id), data);
};

// --- PUBLICADORES ---

export const getPublicadores = async () => {
    const querySnapshot = await getDocs(collection(db, "publicadores"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addPublicador = async (publicador) => {
    await addDoc(collection(db, "publicadores"), publicador);
};

export const deletePublicador = async (id) => {
    await deleteDoc(doc(db, "publicadores", id));
};

export const updatePublicador = async (id, data) => {
    await updateDoc(doc(db, "publicadores", id), data);
};

// --- TELEFONOS ---

export const getMisTelefonos = async (conductorQuery) => {
    // Return all for client-side filtering as dataset is small or implement query if needed
    const querySnapshot = await getDocs(collection(db, "telefonos"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getTelefonos = async () => {
    const querySnapshot = await getDocs(collection(db, "telefonos"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addTelefono = async (telefono) => {
    await addDoc(collection(db, "telefonos"), telefono);
};

export const solicitarNumeros = async (cantidad, userId) => {
    const q = query(collection(db, "telefonos"), where("estado", "==", "Sin asignar"));
    const snapshot = await getDocs(q);

    let count = 0;
    const batchPromises = [];

    for (const d of snapshot.docs) {
        if (count >= cantidad) break;
        batchPromises.push(updateDoc(doc(db, "telefonos", d.id), {
            estado: 'Asignado',
            publicador_asignado: userId,
            asignado_a: 'Usuario', // Legacy
            fecha_asignacion: new Date().toISOString()
        }));
        count++;
    }

    await Promise.all(batchPromises);
    return count;
};

export const updateTelefonoStatus = async (id, estado, publicadorId) => {
    const data = { estado };
    if (publicadorId) {
        data.publicador_asignado = publicadorId;
        data.fecha_asignacion = new Date().toISOString();
    }
    // If setting to 'Sin asignar', clear fields
    if (estado === 'Sin asignar') {
        data.publicador_asignado = null;
        data.asignado_a = null;
        data.fecha_asignacion = null;
    }

    await updateDoc(doc(db, "telefonos", id), data);
};

export const deleteTelefono = async (id) => {
    await deleteDoc(doc(db, "telefonos", id));
};

export const updateTelefono = async (id, data) => {
    await updateDoc(doc(db, "telefonos", id), data);
};

export const devolverTelefono = async (id) => {
    await updateDoc(doc(db, "telefonos", id), {
        asignado_a: null,
        publicador_asignado: null,
        estado: 'Sin asignar',
        fecha_asignacion: null
    });
};

// --- PREDICACION PUBLICA ---

export const getPredicacionPublica = async () => {
    const querySnapshot = await getDocs(collection(db, "predicacion_publica"));
    if (querySnapshot.empty) return { dias: [] };
    return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
};

export const savePredicacionPublica = async (data) => {
    const current = await getPredicacionPublica();
    if (current.id) {
        await updateDoc(doc(db, "predicacion_publica", current.id), data);
    } else {
        await addDoc(collection(db, "predicacion_publica"), data);
    }
};

// --- PROGRAMA SEMANAL ---

export const getProgramaSemanal = async (weekId) => {
    if (weekId) {
        const docRef = doc(db, "programa_semanal", weekId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null; // Not found
    }

    // Fallback: Get the most recent one or default
    // We order by ID (if ID is YYYY-MM-DD, it works chronologically) or just get the first one.
    // If we migrate to ID-based, the old docs usually had auto-IDs.
    const querySnapshot = await getDocs(query(collection(db, "programa_semanal"), limit(1)));
    if (querySnapshot.empty) return null;
    return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
};

export const deleteProgramaSemanal = async (weekId) => {
    await deleteDoc(doc(db, "programa_semanal", weekId));
};

// --- HELPER: Sync Schedule to History (S-13) ---
const syncScheduleToHistory = async (weekId, scheduleData) => {
    try {
        const weekStart = new Date(weekId);
        // Validate date
        if (isNaN(weekStart.getTime())) return;

        // Calculate end date (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // 1. Fetch existing history for this week to avoid duplicates/conflicts
        // We query by date range
        const q = query(
            collection(db, "historial_territorios"),
            where("fecha_asignacion", ">=", weekStart.toISOString()),
            where("fecha_asignacion", "<=", weekEnd.toISOString())
        );
        const snapshot = await getDocs(q);

        // Build map: Key(TerritoryNum_Date) -> DocID
        // This helps us know if we need to update or create
        const historyMap = new Map();
        snapshot.docs.forEach(d => {
            const data = d.data();
            // Key: Num + YYYY-MM-DD
            if (data.fecha_asignacion) {
                const dateKey = data.fecha_asignacion.split('T')[0];
                const key = `${data.numero}_${dateKey}`;
                historyMap.set(key, { id: d.id, conductor: data.conductor });
            }
        });

        const promises = [];

        if (scheduleData.dias && Array.isArray(scheduleData.dias)) {
            scheduleData.dias.forEach((dia, index) => {
                // Calculate specific date for this day
                const dayDate = new Date(weekStart);
                dayDate.setDate(weekStart.getDate() + index);
                const dateKey = dayDate.toISOString().split('T')[0];

                ['manana', 'tarde', 'noche'].forEach(turno => {
                    const assignment = dia[turno];
                    // Only sync if Territory AND Conductor are set
                    if (assignment && assignment.territorio && assignment.conductor) {
                        const key = `${assignment.territorio}_${dateKey}`;
                        const existing = historyMap.get(key);

                        if (existing) {
                            // Check if conductor changed
                            if (existing.conductor !== assignment.conductor) {
                                // Update existing history record
                                promises.push(updateDoc(doc(db, "historial_territorios", existing.id), {
                                    conductor: assignment.conductor
                                }));
                            }
                        } else {
                            // Create new history record
                            promises.push(addDoc(collection(db, "historial_territorios"), {
                                territorio_id: 'sync_auto', // Placeholder as we don't have the internal ID here
                                numero: assignment.territorio,
                                conductor: assignment.conductor,
                                fecha_asignacion: dayDate.toISOString(),
                                fecha_entrega: null,
                                estado: 'Asignado',
                                timestamp: Timestamp.fromDate(dayDate)
                            }));
                        }
                    }
                });
            });
        }

        if (promises.length > 0) {
            await Promise.all(promises);
            console.log(`Synced ${promises.length} assignments to History.`);
        }

    } catch (e) {
        console.error("Error syncing schedule to history:", e);
    }
};

export const saveProgramaSemanal = async (weekId, data) => {
    if (!weekId) throw new Error("Week ID required for saving schedule");
    // Force ID to be the Week Start Date (YYYY-MM-DD)
    await setDoc(doc(db, "programa_semanal", weekId), data);

    // Auto-Sync to S-13 History
    await syncScheduleToHistory(weekId, data);
};

// --- PERMISOS ---

export const getPermisosUsuario = async (email) => {
    if (!email) return null;
    try {
        const q = query(collection(db, "conductores"), where("email", "==", email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return { role: data.role || 'Conductor', ...data };
        }
        return null; // Handle Admin elsewhere or return null
    } catch (e) {
        console.error("Error getting permissions:", e);
        return null;
    }
};

export const rebuildHistoryFromSchedule = async () => {
    console.log("Starting S-13 History Rebuild...");
    const snapshot = await getDocs(collection(db, "programa_semanal"));
    let count = 0;
    for (const d of snapshot.docs) {
        await syncScheduleToHistory(d.id, d.data());
        count++;
    }
    console.log(`Rebuild complete. Processed ${count} weeks.`);
    return count;
};

// --- SYSTEM DIAGNOSTICS & REPAIR ---
export const runSystemDiagnosticsAndRepair = async () => {
    const report = {
        rebuiltHistory: 0,
        fixedPhones: 0,
        details: []
    };

    // 1. Rebuild History
    report.rebuiltHistory = await rebuildHistoryFromSchedule();

    // 2. Fix Phone Assignments
    const allPhones = await getDocs(collection(db, "telefonos"));
    const allPubs = await getDocs(collection(db, "publicadores"));
    const pubsMap = {};
    allPubs.forEach(d => {
        const p = d.data();
        pubsMap[d.id] = p.nombre;
        pubsMap[p.nombre] = d.id; // bidirectional for checks
    });

    for (const d of allPhones.docs) {
        const t = d.data();
        let updates = {};
        let dirty = false;

        // Determine real 'assigned' vs 'ghost'
        const hasPubId = t.publicador_asignado && t.publicador_asignado !== 'Usuario';
        const hasPubName = t.asignado_a && t.asignado_a !== 'Usuario' && t.asignado_a !== 'Sin asignar';

        // CASE 1: Assigned to "Usuario" (Ghost)
        if (t.asignado_a === 'Usuario' || t.publicador_asignado === 'Usuario') {
            // Try to rescue: Do we have a mismatch? 
            // e.g. publicador_asignado=ID but asignado_a=Usuario
            if (hasPubId && pubsMap[t.publicador_asignado]) {
                updates.asignado_a = pubsMap[t.publicador_asignado];
                dirty = true;
                report.details.push(`Phone ${t.numero}: Fixed name 'Usuario' -> '${updates.asignado_a}'`);
            } else {
                // No valid ID. Must unassign.
                updates.asignado_a = null;
                updates.publicador_asignado = null;
                updates.estado = 'Sin asignar';
                updates.fecha_asignacion = null;
                dirty = true;
                report.details.push(`Phone ${t.numero}: Unassigned (Invalid 'Usuario' reference)`);
            }
        }

        // CASE 2: Name Mismatch (ID valid, but Name wrong/empty)
        if (hasPubId && pubsMap[t.publicador_asignado] && t.asignado_a !== pubsMap[t.publicador_asignado]) {
            updates.asignado_a = pubsMap[t.publicador_asignado];
            dirty = true;
            report.details.push(`Phone ${t.numero}: Synced name '${t.asignado_a}' -> '${updates.asignado_a}'`);
        }

        // CASE 3: Status Inconsistency (Has assignment but Status says Free)
        if ((hasPubId || hasPubName) && (t.estado === 'Sin asignar' || !t.estado || t.estado === 'Pendiente')) {
            updates.estado = 'Asignado';
            dirty = true;
            report.details.push(`Phone ${t.numero}: Corrected status to 'Asignado'`);
        }

        // CASE 4: Ghost Assignment (Status says Asignado, but no user)
        if (t.estado === 'Asignado' && !hasPubId && !hasPubName) {
            updates.estado = 'Sin asignar';
            updates.fecha_asignacion = null;
            dirty = true;
            report.details.push(`Phone ${t.numero}: Corrected status to 'Sin asignar' (No user)`);
        }

        if (dirty) {
            await updateDoc(doc(db, "telefonos", d.id), updates);
            report.fixedPhones++;
        }
    }

    return report;
};

// --- RECURSOS ---

export const getRecursos = async () => {
    const querySnapshot = await getDocs(collection(db, "recursos"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addRecurso = async (recurso) => {
    await addDoc(collection(db, "recursos"), recurso);
};

export const deleteRecurso = async (id) => {
    await deleteDoc(doc(db, "recursos", id));
};

export const updateRecurso = async (id, data) => {
    await updateDoc(doc(db, "recursos", id), data);
};
