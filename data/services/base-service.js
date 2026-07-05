/**
 * @module base-service
 * @description Capa base de acceso a datos. Provee el caché en memoria (ServiceCache)
 *              y el motor de sincronización en tiempo real (Live Pool via onSnapshot).
 *
 * @layer Backend / Data Layer — Fundamento de todos los demás servicios
 *
 * @exports
 *  - ServiceCache           → Objeto de caché con TTL de 2 minutos
 *  - clearServiceCache()    → Limpia toda la caché (usado al cambiar versión)
 *  - fetchCached()          → Helper: devuelve caché o ejecuta fetchFn
 *  - startLivePool()        → Suscripción onSnapshot con callback reactivo
 */
import { db } from "../../firebase-config.js";

// ═══════════════════════════════════════════════════════════
// CACHÉ EN MEMORIA (TTL: 2 min por defecto)
// ═══════════════════════════════════════════════════════════
export const ServiceCache = {
    data: new Map(),
    defaultTtl: 2 * 60 * 1000,

    get(key) {
        const item = this.data.get(key);
        const ttl = item?.customTtl || this.defaultTtl;
        if (item && Date.now() - item.time < ttl) return item.value;
        return null;
    },
    set(key, value, customTtl = null) {
        this.data.set(key, { value, time: Date.now(), customTtl });
    },
    clear(key = null) {
        if (key) this.data.delete(key);
        else this.data.clear();
    },
    clearAll() {
        this.data.clear();
    },
};

export const clearServiceCache = () => ServiceCache.clearAll();

export const fetchCached = async (key, fetchFn, customTtl = null) => {
    const cached = ServiceCache.get(key);
    if (cached) return cached;

    try {
        const result = await fetchFn();
        // Restaurar: cachear siempre el resultado, incluso si es vacío
        ServiceCache.set(key, result, customTtl);
        return result;
    } catch (error) {
        console.error(`[fetchCached] Error fetching ${key}:`, error);
        throw error;
    }
};

// ═══════════════════════════════════════════════════════════
// LIVE POOL ENGINE (Xolvy Real-time Sync)
// onSnapshot reactivo: devuelve la función de cancelación (unsubscribe)
// ═══════════════════════════════════════════════════════════
import { collection, onSnapshot, query } from "firebase/firestore";

export const PoolManager = {
    activePools: [],
    register(unsub) {
        if (typeof unsub === "function") {
            this.activePools.push(unsub);
        }
        return unsub;
    },
    stopAll() {
        console.log(`🛑 [PoolManager] Deteniendo ${this.activePools.length} live pools activos.`);
        this.activePools.forEach((unsub) => {
            try {
                if (typeof unsub === "function") unsub();
            } catch (err) {
                console.error("[PoolManager] Error al detener live pool:", err);
            }
        });
        this.activePools = [];
    },
};

export const startLivePool = (collectionName, filters, onUpdate) => {
    const q = query(collection(db, collectionName), ...filters);
    const unsub = onSnapshot(
        q,
        (snapshot) => {
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            onUpdate(data);
        },
        (error) => {
            console.error(`[Live Pool] Error en ${collectionName}:`, error);
        },
    );
    return PoolManager.register(unsub);
};
