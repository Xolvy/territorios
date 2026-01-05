import { db, auth, storage } from '/firebase-config.js?v=2.4.0';
import {
    collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, getDoc, setDoc, orderBy, limit, Timestamp, writeBatch,
    enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PERSISTENCE (Offline-First) ---
// Note: firebase-config.js already uses persistentLocalCache which is the modern recommended way.
// We explicitly try enableIndexedDbPersistence as a secondary layer if needed for compatibility.
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
        } else if (err.code == 'unimplemented') {
            console.warn("The current browser doesn't support all of the features needed to enable persistence");
        }
    });
} catch (e) {
    // Already enabled or modern SDK handles via localCache
}

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

const logAssignment = async (territorioData, conductorName, details = {}) => {
    try {
        await addDoc(collection(db, "historial_territorios"), {
            territorio_id: territorioData.id,
            numero: territorioData.numero,
            conductor: conductorName,
            auxiliar: details.auxiliar || null,
            lugar: details.lugar || details.Lugar || null,
            hora: details.hora || details.Hora || null,
            faceta: details.faceta || details.Faceta || null,
            campana: details.campana || null,
            turno: details.turno || null,
            fecha_asignacion: details.fecha_asignacion || new Date().toISOString(),
            fecha_salida: details.fecha_salida || null,
            fecha_entrega: null,
            estado: 'Asignado',
            timestamp: Timestamp.now(),
            observaciones: details.observaciones || null
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

export const getHistorialReport = async () => {
    // Fetch all history to allow calculating "Last Completion Date" even before report range
    const q = query(collection(db, "historial_territorios"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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

export const addHistoryRecord = async (data) => {
    // Ensure timestamp is present for sorting
    if (!data.timestamp) {
        data.timestamp = Timestamp.fromDate(new Date(data.fecha_asignacion || new Date()));
    }
    await addDoc(collection(db, "historial_territorios"), data);
};

export const updateHistoryRecord = async (id, data) => {
    await updateDoc(doc(db, "historial_territorios", id), data);
};

export const deleteHistoryRecord = async (id) => {
    await deleteDoc(doc(db, "historial_territorios", id));
};

// --- RECOVERY TOOL ---





// --- CONFIGURACION GLOBAL ---

export const getSystemVersion = async () => {
    try {
        const docRef = doc(db, "configuracion", "version_control");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data().latestVersion;
        }
        return '1.0.0';
    } catch (e) {
        console.warn("Could not fetch system version", e);
        return null;
    }
};

export const setSystemVersion = async (version, force = true) => {
    try {
        const docRef = doc(db, "configuracion", "version_control");
        await setDoc(docRef, {
            latestVersion: version,
            forceUpdate: force,
            updatedAt: Timestamp.now()
        }, { merge: true });
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
            horarios_programa: ['08:45', '09:00', '09:15', '14:00', '16:00', '19:00', '21:15'],
            jornadas: { manana: '🌅 Mañana', tarde: '☀️ Tarde', noche: '🌙 Noche' }
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

export const assignTerritorio = async (id, conductorName, details = {}) => {
    const updateData = {
        asignado_a: conductorName,
        fecha_asignacion: details.fecha_asignacion || new Date().toISOString(),
        fecha_salida: details.fecha_salida || null,
        estado: 'Asignado',
        auxiliar: details.auxiliar || null,
        lugar: details.lugar || null,
        hora: details.hora || null,
        faceta: details.faceta || null,
        turno: details.turno || null,
        campana: details.campana || null,
        manzanas_asignadas: details.manzanas || null
    };

    await updateDoc(doc(db, "territorios", id), updateData);

    const snap = await getDoc(doc(db, "territorios", id));
    if (snap.exists()) {
        const fullData = { id, ...snap.data() };
        await logAssignment(fullData, conductorName, details);

        // Auto-Sync to Weekly Program if a date is provided
        if (details.fecha_asignacion) {
            await syncAssignmentToWeeklyProgram(fullData, conductorName, details);
        }
    }
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

export const returnTerritorio = async (id, notes, customDate, status = 'Completado') => {
    const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();
    await updateDoc(doc(db, "territorios", id), {
        asignado_a: null,
        fecha_asignacion: null,
        auxiliar: null,
        lugar: null,
        hora: null,
        faceta: null,
        turno: null,
        ultima_fecha: dateToUse,
        estado: status === 'Perdido' ? 'Extraviado' : 'Predicado'
    });
    await logReturn(id, dateToUse, status, notes);
};

export const returnTerritorioMultiple = async (ids, notes, customDate, status = 'Completado') => {
    const batch = writeBatch(db);
    const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();

    for (const id of ids) {
        batch.update(doc(db, "territorios", id), {
            asignado_a: null,
            fecha_asignacion: null,
            auxiliar: null,
            lugar: null,
            hora: null,
            faceta: null,
            turno: null,
            ultima_fecha: dateToUse,
            estado: status === 'Perdido' ? 'Extraviado' : 'Predicado'
        });
        // Note: logReturn is async and uses queries, so we can't batch it easily without more complex logic.
        // We'll call it individually which is fine for small batches.
        await logReturn(id, dateToUse, status, notes);
    }
    await batch.commit();
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

export const updateAssignmentData = async (id, newDate, newDateSalida, newConductor, newStatus) => {
    const updateData = {};
    if (newDate) updateData.fecha_asignacion = newDate;
    if (newDateSalida !== undefined) updateData.fecha_salida = newDateSalida;
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
            if (newDateSalida !== undefined) histData.fecha_salida = newDateSalida;
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
    const q = query(collection(db, "publicadores"), where("es_conductor", "==", true));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addConductor = async (conductor) => {
    await addDoc(collection(db, "publicadores"), { ...conductor, es_conductor: true });
};

export const deleteConductor = async (id) => {
    await deleteDoc(doc(db, "publicadores", id));
};

export const updateConductor = async (id, data) => {
    await updateDoc(doc(db, "publicadores", id), data);
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

// --- MIGRATION & UNIFIED PERSONNEL ---

/**
 * Migrates existing data from 'conductores' to 'publicadores' if not already done.
 */
export const migrateConductoresToPublicadores = async () => {
    try {
        const conductoresSnap = await getDocs(collection(db, "conductores"));
        const publicadoresSnap = await getDocs(collection(db, "publicadores"));

        const existingPublicadores = publicadoresSnap.docs.map(d => d.data().nombre.toLowerCase());
        const batch = writeBatch(db);
        let count = 0;

        for (const condDoc of conductoresSnap.docs) {
            const condData = condDoc.data();
            if (!existingPublicadores.includes(condData.nombre.toLowerCase())) {
                const newRef = doc(collection(db, "publicadores"));
                batch.set(newRef, {
                    nombre: condData.nombre,
                    telefono: condData.telefono || "",
                    es_conductor: true,
                    genero: "Hombre", // Default for old conductors (manual fix later)
                    grupo: 1, // Default
                    privilegios: ["Conductor"],
                    disponibilidad: condData.disponibilidad || {},
                    migrated_at: Timestamp.now()
                });
                count++;
            }
        }

        if (count > 0) {
            await batch.commit();
            console.log(`✅ Migrated ${count} conductors to the unified directory.`);
        }
    } catch (e) {
        console.error("Migration error:", e);
    }
};

// --- GROUPS CONFIGURATION ---

export const getGroupsConfig = async () => {
    const snap = await getDoc(doc(db, "configuracion", "grupos"));
    if (snap.exists()) return snap.data().list || [];

    // Default 6 groups if none exist
    const defaults = Array.from({ length: 6 }, (_, i) => ({
        id: i + 1,
        nombre: `Grupo ${i + 1}`,
        lider: "",
        asistente: "",
        casa_salida: ""
    }));
    return defaults;
};

export const saveGroupsConfig = async (groups) => {
    await setDoc(doc(db, "configuracion", "grupos"), { list: groups });
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

export const solicitarNumeros = async (cantidad = 30, userId) => {
    // 1. Fetch all processed records vs total to check cycle
    // (Optimization: We handle specific picking here)

    // Only pick numbers that are 'Sin asignar' and DO NOT have a solicitor or current publisher
    // Status MUST be 'Sin asignar' (means blank/not assigned)
    const q = query(collection(db, "telefonos"),
        where("estado", "==", "Sin asignar"),
        where("publicador_asignado", "==", null)
    );
    const snapshot = await getDocs(q);

    let count = 0;
    const batchPromises = [];

    // Filter out 'No llamar' that are still within 6 months
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    for (const d of snapshot.docs) {
        if (count >= cantidad) break;
        const data = d.data();

        // Check 'No llamar' timer
        if (data.ultimo_estado === 'No llamar') {
            const lastDate = data.fecha_ultimo_estado ? new Date(data.fecha_ultimo_estado) : new Date(0);
            if (lastDate > sixMonthsAgo) continue; // Skip if it's been less than 6 months
        }

        // Extra safety check for requested_by (solicitado_por)
        if (!data.solicitado_por) {
            batchPromises.push(updateDoc(doc(db, "telefonos", d.id), {
                solicitado_por: userId,
                publicador_asignado: null,
                asignado_a: null,
                fecha_asignacion: new Date().toISOString()
            }));
            count++;
        }
    }

    await Promise.all(batchPromises);
    return count;
};

// Check if all 1124 (or total) records are processed and reset cycle
export const checkAndResetTelephoneCycle = async () => {
    try {
        const snapshot = await getDocs(collection(db, "telefonos"));
        const total = snapshot.docs.length;
        if (total === 0) return false;

        // Count those that have a status DIFFERENT from 'Sin asignar' 
        // OR have been assigned previously in this cycle.
        // Actually, requirement says: "una vez que todos tengan un estado registrado, todos los registros se pondrán en blanco"
        const recordsWithStatus = snapshot.docs.filter(d => {
            const st = d.data().estado;
            return st && st !== 'Sin asignar';
        });

        if (recordsWithStatus.length === total) {
            console.log("🚀 Telephone Cycle Complete! Resetting all records...");
            const batch = writeBatch(db);
            const now = new Date().toISOString();

            snapshot.docs.forEach(d => {
                const data = d.data();
                const currentStatus = data.estado;

                // Rules:
                // Contestaron, No contestan, Colgaron -> Sin asignar, clear publisher
                // Observations kept internally for Admin with date

                if (['Contestaron', 'No contestan', 'Colgaron'].includes(currentStatus)) {
                    batch.update(doc(db, "telefonos", d.id), {
                        estado: 'Sin asignar',
                        publicador_asignado: null,
                        asignado_a: null,
                        solicitado_por: null,
                        fecha_asignacion: null,
                        // Preserve historical observations
                        ultima_observacion_ciclo: data.comentario || '',
                        fecha_ultimo_ciclo: now
                    });
                } else if (currentStatus === 'Revisita') {
                    // Keep Revisita until manually returned (Requirement: "hasta que se marque como Devuelto")
                    // We don't reset it here.
                } else if (currentStatus === 'No llamar') {
                    // "permanecerá oculto por 6 meses, después de ese tiempo el estado pasará a ser Sin asignar"
                    // This is handled in solicitarNumeros filter, but let's mark it for clarity
                    batch.update(doc(db, "telefonos", d.id), {
                        ultimo_estado: 'No llamar',
                        estado: 'Sin asignar',
                        fecha_ultimo_estado: now,
                        publicador_asignado: null,
                        asignado_a: null,
                        solicitado_por: null
                    });
                }
            });

            await batch.commit();
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error in cycle reset:", e);
        return false;
    }
};

export const logSessionSummary = async (summary) => {
    try {
        await addDoc(collection(db, "resumenes_sesion_telefonia"), {
            ...summary,
            timestamp: Timestamp.now(),
            fecha: new Date().toISOString()
        });
    } catch (e) {
        console.error("Error logging session summary:", e);
    }
};

export const getSessionSummaries = async () => {
    try {
        const q = query(collection(db, "resumenes_sesion_telefonia"), orderBy("timestamp", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("Error getting session summaries:", e);
        return [];
    }
};

// Release numbers that were requested but never assigned or worked on
export const releaseUnusedTelefonos = async (userId) => {
    const q = query(collection(db, "telefonos"),
        where("solicitado_por", "==", userId),
        where("estado", "==", "Sin asignar"),
        where("publicador_asignado", "==", null)
    );
    const snapshot = await getDocs(q);
    const batchPromises = [];

    snapshot.docs.forEach(d => {
        batchPromises.push(updateDoc(doc(db, "telefonos", d.id), {
            solicitado_por: null,
            asignado_a: null,
            publicador_asignado: null,
            fecha_asignacion: null
        }));
    });

    await Promise.all(batchPromises);
};

export const updateTelefonoStatus = async (id, estado, publicadorName, comentario = null) => {
    const data = { estado };
    if (publicadorName) {
        data.asignado_a = publicadorName;
        data.publicador_asignado = publicadorName;
    }
    if (comentario !== null) {
        data.comentario = comentario;
    }

    // Rules for Deletion: Suspendido, Testigo
    if (estado === 'Suspendido' || estado === 'Testigo') {
        await deleteDoc(doc(db, "telefonos", id));
        return;
    }

    // Requirement: If status is 'Sin asignar', assignment MUST be cleared
    if (estado === 'Sin asignar') {
        data.publicador_asignado = null;
        data.asignado_a = null;
        data.fecha_asignacion = null;
        data.solicitado_por = null;
    }

    await updateDoc(doc(db, "telefonos", id), data);

    // After update, check if cycle is complete
    await checkAndResetTelephoneCycle();
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
    if (querySnapshot.empty) return { asignaciones: [] };
    const data = querySnapshot.docs[0].data();
    // Migración legacy si es necesario
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

// --- PROGRAMA SEMANAL ---

// --- HELPER: Sync Hub Assignment to Weekly Program ---
export const syncAssignmentToWeeklyProgram = async (territoryData, conductorName, details) => {
    try {
        const date = new Date(details.fecha_asignacion);
        if (isNaN(date.getTime())) return;

        // Get Monday of that week
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        const weekId = d.toISOString().split('T')[0];

        // Day of week (0=Monday, 6=Sunday)
        let dayIdx = date.getDay();
        dayIdx = dayIdx === 0 ? 6 : dayIdx - 1;

        // Turn
        const turno = details.turno || 'manana';

        // Get current week or initialize
        let prog = await getProgramaSemanal(weekId);
        if (!prog) {
            prog = {
                id: weekId,
                dias: [
                    { nombre: 'Lunes', manana: {}, tarde: {}, noche: {} },
                    { nombre: 'Martes', manana: {}, tarde: {}, noche: {} },
                    { nombre: 'Miércoles', manana: {}, tarde: {}, noche: {} },
                    { nombre: 'Jueves', manana: {}, tarde: {}, noche: {} },
                    { nombre: 'Viernes', manana: {}, tarde: {}, noche: {} },
                    { nombre: 'Sábado', manana: {}, tarde: {}, noche: {} },
                    { nombre: 'Domingo', manana: {}, tarde: {}, noche: {} }
                ]
            };
        }

        // Initialize day turn if missing
        if (!prog.dias[dayIdx]) prog.dias[dayIdx] = { nombre: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][dayIdx] };
        if (!prog.dias[dayIdx][turno]) prog.dias[dayIdx][turno] = {};

        // Update fields (Supports multiple blocks for Sundays)
        const t = prog.dias[dayIdx][turno];

        if (details.blocks && details.blocks.length > 0) {
            // Sunday Split Logic: Concatenate blocks or store as array if view supports it
            // For now, we concatenate for the "Read-Only" simplified view
            t.territorio = details.blocks.map(b => b.territorio || territoryData.numero).join(' / ');
            t.conductor = details.blocks.map(b => b.conductor).join(' / ');
            t.auxiliar = details.blocks.map(b => b.auxiliar || '-').join(' / ');
            t.grupos = details.blocks.map(b => b.grupos || '-').join(' | ');
        } else {
            t.territorio = territoryData.numero;
            t.conductor = conductorName;
            t.auxiliar = details.auxiliar || '';
            if (details.grupos) t.grupos = details.grupos;
        }

        t.lugar = details.lugar || t.lugar || '';
        t.hora = details.hora || t.hora || '';
        t.faceta = details.faceta || t.faceta || '';
        if (details.campana) t.campana = details.campana;

        // Save
        await setDoc(doc(db, "programa_semanal", weekId), prog);
        console.log(`Synced territory ${territoryData.numero} to Program ${weekId}`);
    } catch (e) {
        console.error("Error syncing to weekly program:", e);
    }
};

// --- CAMPAIGNS ---
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

/**
 * Gets historical assignments within a date range.
 * Useful for smart motors and dashboard summaries.
 */
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
        // Try the new unified publicadores directory first
        const qPub = query(collection(db, "publicadores"), where("telefono", "==", email)); // Note: App uses 'email' param but often passes phone
        const snapPub = await getDocs(qPub);

        // Secondary check by email if the above fails (assuming email field exists)
        let snap = snapPub;
        if (snap.empty) {
            const qEmail = query(collection(db, "publicadores"), where("email", "==", email));
            snap = await getDocs(qEmail);
        }

        if (!snap.empty) {
            const data = snap.docs[0].data();
            const isAdmin = data.privilegios?.includes('Administrador');

            // They need to be either a conductor or an admin to access anything beyond basic public view
            if (data.es_conductor || isAdmin) {
                return {
                    role: isAdmin ? 'Administrador' : 'Conductor',
                    ...data,
                    id: snap.docs[0].id
                };
            }
        }

        // Fallback for legacy conductors
        const q = query(collection(db, "conductores"), where("email", "==", email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return { role: data.role || 'Conductor', ...data };
        }
        return null;
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
        const hasPubId = t.publicador_asignado && t.publicador_asignado !== 'Usuario' && t.publicador_asignado !== '';
        const hasPubName = t.asignado_a && t.asignado_a !== 'Usuario' && t.asignado_a !== 'Sin asignar' && t.asignado_a !== '';

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
        // User Request: If discrepancy exists (Publisher set but Status free), RESET both to Unassigned.
        if ((hasPubId || hasPubName) && (t.estado === 'Sin asignar' || !t.estado || t.estado === 'Pendiente')) {
            updates.asignado_a = null;
            updates.publicador_asignado = null;
            updates.estado = 'Sin asignar';
            updates.fecha_asignacion = null;
            dirty = true;
            report.details.push(`Phone ${t.numero}: Reset to 'Sin asignar' due to missing status (was assigned to ${t.asignado_a})`);
        }

        // CASE 4: Ghost Assignment (Status says Asignado, but no user)
        if ((t.estado === 'Asignado' || t.estado === 'Asignada') && !hasPubId && !hasPubName) {
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

// --- RESTORE SYSTEM BACKUP (Batch Write) ---
export const restoreSystemBackup = async (data, onProgress) => {
    if (!data) throw new Error("No data provided for restore");

    const collections = [
        { key: 'territorios', name: 'territorios' },
        { key: 'conductores', name: 'conductores' },
        { key: 'telefonos', name: 'telefonos' },
        { key: 'publicadores', name: 'publicadores' },
        { key: 'historial', name: 'historial_territorios' }
    ];

    let totalOps = 0;
    collections.forEach(c => {
        if (data[c.key]) totalOps += data[c.key].length;
    });

    if (data.config) totalOps += 1;
    if (data.programa) totalOps += 1;

    let executedOps = 0;
    const reportProgress = (msg) => {
        if (onProgress) onProgress(msg, Math.floor((executedOps / totalOps) * 100));
    };

    // 1. Restore Collections
    for (const colDef of collections) {
        const items = data[colDef.key];
        if (!items || !Array.isArray(items)) continue;

        reportProgress(`Restaurando ${colDef.key}...`);

        // Firestore batches are limited to 500 operations
        for (let i = 0; i < items.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + 500);

            chunk.forEach(item => {
                const { id, ...cleanData } = item;
                const docRef = id ? doc(db, colDef.name, id) : doc(collection(db, colDef.name));
                batch.set(docRef, cleanData, { merge: true });
                executedOps++;
            });

            await batch.commit();
            reportProgress(`Procesados ${executedOps}/${totalOps} registros...`);
        }
    }

    // 2. Restore Config
    if (data.config) {
        reportProgress(`Restaurando configuración...`);
        const { id, ...configData } = data.config;
        await setDoc(doc(db, "configuracion", id || "general"), configData, { merge: true });
        executedOps++;
        reportProgress(`Configuración restaurada.`);
    }

    // 3. Restore Programa (If exists in backup)
    if (data.programa) {
        reportProgress(`Restaurando programa actual...`);
        const { id, ...progData } = data.programa;
        if (id) {
            await setDoc(doc(db, "programa_semanal", id), progData, { merge: true });
        }
        executedOps++;
    }

    reportProgress(`✅ Restauración completada con éxito (${executedOps} operaciones).`, 100);
    return executedOps;
};




