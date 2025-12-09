import { db, auth, storage } from '../firebase-config.js';
import {
    collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, getDoc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- CONFIGURACION GLOBAL ---

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
};

export const returnTerritorio = async (id) => {
    await updateDoc(doc(db, "territorios", id), {
        asignado_a: null,
        fecha_asignacion: null,
        ultima_fecha: new Date().toISOString(),
        estado: 'Predicado' // Marked as Preached/Completed
    });
};

export const returnTerritorioParcial = async (originalId, completedManzanas, remainingManzanas) => {
    // 1. Get original doc
    const territoryRef = doc(db, "territorios", originalId);
    const territorySnap = await getDoc(territoryRef);
    if (!territorySnap.exists()) throw new Error("Territorio no encontrado");
    const tData = territorySnap.data();

    // 2. Create NEW doc for the COMPLETED part (Free & Predicado)
    await addDoc(collection(db, "territorios"), {
        ...tData,
        manzanas: completedManzanas,
        estado: 'Predicado',
        asignado_a: null,
        fecha_asignacion: null,
        ultima_fecha: new Date().toISOString(),
        origen_id: originalId // Traceability
    });

    // 3. Update EXISTING doc for the REMAINING part (Keep Assigned)
    await updateDoc(territoryRef, {
        manzanas: remainingManzanas
    });
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
    // For now we get ALL and filter in memory or we can do a compound query?
    // Firestore simple query:
    const querySnapshot = await getDocs(collection(db, "telefonos"));

    // Filter logic:
    // If user is a 'Publicador', they see numbers assigned to their ID.
    // If user is a 'Conductor', they might see... wait, users are usually conductors here?
    // Let's assume 'conductorQuery' matches 'publicador_asignado' (ID) OR 'asignado_a' (Name legacy)

    // We'll return all for client-side filtering if simpler or implement better query later.
    // Actually, let's just return all and filter in JS for now as dataset is small.
    // OPTIMIZATION: Filter by 'estado' != 'Suspendido'

    const all = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Filter logic moved to client or:
    // This function is named "getMisTelefonos", so let's filter:

    // NOTE: In the previous conversations, we were passing the User's Name or Email.
    // The 'telefonos' collection has 'publicador_asignado' which is an ID, and sometimes 'asignado_a' (legacy name).
    // We need to resolve the publicador ID from the name if possible, but that's expensive here.
    // So we return ALL active numbers for the Dashboard to filter/display or manage.

    return all;
};

export const getTelefonos = async () => {
    const querySnapshot = await getDocs(collection(db, "telefonos"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addTelefono = async (telefono) => {
    await addDoc(collection(db, "telefonos"), telefono);
};

export const solicitarNumeros = async (cantidad, userId) => {
    // Simple algorithm: Find X numbers 'Sin asignar', assign to userId
    const q = query(collection(db, "telefonos"), where("estado", "==", "Sin asignar")); // Limit not supported in basic query builder easily without order
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
    // Single doc singleton
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

export const getProgramaSemanal = async () => {
    const querySnapshot = await getDocs(collection(db, "programa_semanal"));
    if (querySnapshot.empty) return { dias: [] };
    return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
};

export const saveProgramaSemanal = async (data) => {
    const current = await getProgramaSemanal();
    if (current.id) {
        await updateDoc(doc(db, "programa_semanal", current.id), data);
    } else {
        await addDoc(collection(db, "programa_semanal"), data);
    }
};
