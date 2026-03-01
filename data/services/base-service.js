import { db } from '../../firebase-config.js';

export const ServiceCache = {
    data: new Map(),
    ttl: 2 * 60 * 1000,

    get(key) {
        const item = this.data.get(key);
        if (item && (Date.now() - item.time < this.ttl)) return item.value;
        return null;
    },
    set(key, value) { this.data.set(key, { value, time: Date.now() }); },
    clear(key = null) { if (key) this.data.delete(key); else this.data.clear(); },
    clearAll() { this.data.clear(); }
};

export const clearServiceCache = () => ServiceCache.clearAll();

export const fetchCached = async (key, fetchFn) => {
    const cached = ServiceCache.get(key);
    if (cached) return cached;
    const fresh = await fetchFn();
    ServiceCache.set(key, fresh);
    return fresh;
};

// --- XOLVY LIVE POOL ENGINE ---
import { collection, query, onSnapshot } from "firebase/firestore";

export const startLivePool = (collectionName, filters, onUpdate) => {
    const q = query(collection(db, collectionName), ...filters);
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        onUpdate(data);
    }, (error) => {
        console.error(`[Live Pool] Error en ${collectionName}:`, error);
    });
};
