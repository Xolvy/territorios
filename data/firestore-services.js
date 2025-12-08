import { db } from '../firebase-config.js';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, limit, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- USUARIOS / PERMISOS ---

export const getPermisosUsuario = async (email) => {
    try {
        // 1. Verificar si es Conductor
        const qConductor = query(collection(db, "conductores"), where("email", "==", email));
        const conductorSnap = await getDocs(qConductor);

        if (!conductorSnap.empty) {
            return { role: 'Conductor', ...conductorSnap.docs[0].data() };
        }

        // 2. Verificar si es Administrador (Buscamos en colección 'admins' o 'usuarios' con rol admin)
        // Por ahora, para facilitar el despliegue, verificamos en una colección 'admins'
        const qAdmin = query(collection(db, "admins"), where("email", "==", email));
        const adminSnap = await getDocs(qAdmin);

        if (!adminSnap.empty) {
            return { role: 'Administrador', ...adminSnap.docs[0].data() };
        }

        // Fallback para el primer usuario o demo
        // Si no hay usuarios en la BD, permitir acceso temporal o manejar en UI
        return null;
    } catch (error) {
        console.error("Error verificando permisos:", error);
        return null;
    }
};

// --- CONFIGURACIÓN GENERAL ---

export const getConfiguracion = async () => {
    try {
        const docRef = doc(db, "configuracion", "general");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap.data();

        // Configuración por defecto si no existe
        return {
            modulos_activos: {
                dashboard: true,
                programa_predicacion: true,
                predicacion_telefonica: true
            },
            congregacion: {
                nombre: "Nueve de Octubre",
                numero: "14282"
            },
            horarios: {
                manana: "08:45",
                tarde: "16:00",
                noche: "19:15"
            },
            lugares: ["Salón del Reino", "Zoom", "Familia X"]
        };
    } catch (e) {
        console.error("Error getting config:", e);
        return null;
    }
};

export const saveConfiguracion = async (config) => {
    await setDoc(doc(db, "configuracion", "general"), config, { merge: true });
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

// --- TELÉFONOS ---

export const getTelefonos = async () => {
    // En una app real, esto debería paginarse. Para demo traemos todo (cuidado con performance)
    const querySnapshot = await getDocs(collection(db, "telefonos"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addTelefono = async (telefono) => {
    await addDoc(collection(db, "telefonos"), {
        ...telefono,
        estado: 'Nuevo',
        asignado_a: null,
        fecha_asignacion: null
    });
};

export const deleteTelefono = async (id) => {
    await deleteDoc(doc(db, "telefonos", id));
};

export const updateTelefono = async (id, data) => {
    await updateDoc(doc(db, "telefonos", id), data);
};

export const solicitarNumeros = async (cantidad, usuarioId) => {
    // Buscar números no asignados
    const q = query(collection(db, "telefonos"), where("asignado_a", "==", null), limit(cantidad));
    const querySnapshot = await getDocs(q);

    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
            asignado_a: usuarioId,
            fecha_asignacion: new Date().toISOString(),
            estado: 'Sin asignar'
        });
    });

    await batch.commit();
    return querySnapshot.size;
};

export const getMisTelefonos = async (usuarioId) => {
    // En demo, si usuarioId es null o undefined, traemos algunos de ejemplo o todos
    if (!usuarioId) return [];
    const q = query(collection(db, "telefonos"), where("asignado_a", "==", usuarioId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateTelefonoStatus = async (id, estado, publicadorId) => {
    const data = {};
    if (estado !== undefined) data.estado = estado;
    if (publicadorId !== undefined) data.publicador_asignado = publicadorId;

    await updateDoc(doc(db, "telefonos", id), data);
};

// --- PROGRAMA PREDICACIÓN ---

export const getProgramaSemanal = async () => {
    const docRef = doc(db, "programas", "actual");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return docSnap.data();

    // Estructura base vacía si no existe
    return {
        dias: [
            { nombre: "Lunes", turnos: [] },
            { nombre: "Martes", turnos: [] },
            { nombre: "Miércoles", turnos: [] },
            { nombre: "Jueves", turnos: [] },
            { nombre: "Viernes", turnos: [] },
            { nombre: "Sábado", turnos: [] },
            { nombre: "Domingo", turnos: [] }
        ]
    };
};

export const saveProgramaSemanal = async (programa) => {
    await setDoc(doc(db, "programas", "actual"), programa);
};

// --- PREDICACIÓN PÚBLICA ---

export const getPredicacionPublica = async () => {
    const docRef = doc(db, "programas", "publica");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : { asignaciones: [] };
};

export const savePredicacionPublica = async (data) => {
    await setDoc(doc(db, "programas", "publica"), data);
};
