import { db } from '../../firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch, Timestamp } from "firebase/firestore";
import { ServiceCache, fetchCached } from './base-service.js';

// --- CONDUCTORES ---

export const getConductores = async () => {
    // Reusar getPublicadores (ya cacheada) y filtrar en memoria
    const todos = await getPublicadores();
    return todos.filter(p => p.es_conductor === true || (p.privilegios && p.privilegios.includes("Conductor")));
};

export const addConductor = async (conductor) => {
    ServiceCache.clear('conductores');
    ServiceCache.clear('publicadores');
    await addDoc(collection(db, "publicadores"), { ...conductor, es_conductor: true });
};

export const deleteConductor = async (id) => {
    ServiceCache.clear('conductores');
    ServiceCache.clear('publicadores');
    await deleteDoc(doc(db, "publicadores", id));
};

export const updateConductor = async (id, data) => {
    ServiceCache.clear('conductores');
    ServiceCache.clear('publicadores');
    await updateDoc(doc(db, "publicadores", id), data);
};

// --- PUBLICADORES ---

export const getPublicadores = async () => {
    return fetchCached('publicadores', async () => {
        const querySnapshot = await getDocs(collection(db, "publicadores"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
};

export const addPublicador = async (publicador) => {
    ServiceCache.clear('publicadores');
    ServiceCache.clear('conductores');
    await addDoc(collection(db, "publicadores"), publicador);
};

export const deletePublicador = async (id) => {
    ServiceCache.clear('publicadores');
    ServiceCache.clear('conductores');
    await deleteDoc(doc(db, "publicadores", id));
};

export const updatePublicador = async (id, data) => {
    ServiceCache.clear('publicadores');
    ServiceCache.clear('conductores');
    await updateDoc(doc(db, "publicadores", id), data);
};

// --- MIGRATION & UNIFIED PERSONNEL ---

/**
 * Migrates existing data from 'conductores' to 'publicadores' if not already done.
 */
export const migrateConductoresToPublicadores = async () => {
    try {
        const lastMigration = localStorage.getItem('last_migration_v2');
        if (lastMigration) return;

        const conductoresSnap = await getDocs(collection(db, "conductores"));
        const publicadoresSnap = await getDocs(collection(db, "publicadores"));

        const existingPublicadores = publicadoresSnap.docs.map(d => d.data().nombre.toLowerCase());
        const batch = writeBatch(db);
        let count = 0;

        for (const condDoc of conductoresSnap.docs) {
            const condData = condDoc.data();
            const normalizedName = condData.nombre?.toLowerCase();
            if (normalizedName && !existingPublicadores.includes(normalizedName)) {
                const newRef = doc(collection(db, "publicadores"));
                batch.set(newRef, {
                    nombre: condData.nombre,
                    telefono: condData.telefono || "",
                    es_conductor: true,
                    genero: "Hombre",
                    grupo: condData.grupo || 1,
                    privilegios: ["Conductor"],
                    disponibilidad: condData.disponibilidad || [],
                    email: condData.email || "",
                    migrated_at: Timestamp.now(),
                    legacy_id: condDoc.id
                });
                count++;
            }
        }

        if (count > 0) {
            await batch.commit();
            console.log(`🚀 [ENGINE] Migrated ${count} records to Unified Directory 2.0`);
        }
        localStorage.setItem('last_migration_v2', Date.now().toString());
    } catch (e) {
        if (e.code === 'permission-denied') {
            console.warn("Migration skipped: Missing permissions (normal for non-admins)");
            localStorage.setItem('last_migration_v2', 'skipped');
        } else {
            console.error("Migration error:", e);
        }
    }
};
