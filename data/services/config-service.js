import { db } from '../../firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";

// --- CONFIGURACIÓN GLOBAL ---

export const getGlobalSettings = async () => {
    try {
        const docRef = doc(db, "configuracion", "global_settings");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data();
        }
        return {
            expiration_days: 120,
            max_active_assignments: 0,
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

// --- DIFFUSION SYSTEM ---
export const saveDiffusionMessage = async (message, type = 'info') => {
    try {
        const docRef = doc(db, "configuracion", "diffusion_active");
        if (message) {
            await setDoc(docRef, {
                content: message,
                type: type,
                timestamp: Timestamp.now(),
                active: true
            });
        } else {
            await updateDoc(docRef, { active: false });
        }
        return true;
    } catch (e) {
        console.error("Error saving diffusion message:", e);
        throw e;
    }
};

export const getDiffusionMessage = async () => {
    try {
        const docRef = doc(db, "configuracion", "diffusion_active");
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().active) {
            return snap.data();
        }
        return null;
    } catch (e) {
        console.error("Error fetching diffusion message:", e);
        return null;
    }
};

export const getGroupsConfig = async () => {
    try {
        const docRef = doc(db, "configuracion", "grupos_config");
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data().grupos || [] : [];
    } catch (e) {
        console.error("Error fetching groups config:", e);
        return [];
    }
};

export const saveGroupsConfig = async (grupos) => {
    try {
        const docRef = doc(db, "configuracion", "grupos_config");
        await setDoc(docRef, { grupos });
        return true;
    } catch (e) {
        console.error("Error saving groups config:", e);
        throw e;
    }
};

export const getConfiguracion = async () => {
    try {
        const docRef = doc(db, "configuracion", "general");
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : {};
    } catch (e) {
        console.error("Error fetching general config:", e);
        return {};
    }
};

export const saveConfiguracion = async (config) => {
    try {
        await setDoc(doc(db, "configuracion", "general"), config, { merge: true });
        return true;
    } catch (e) {
        console.error("Error saving general config:", e);
        throw e;
    }
};

export const getSystemVersion = async () => {
    try {
        const docRef = doc(db, "configuracion", "system_status");
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data().current_version : "0.0.0";
    } catch (e) {
        console.error("Error fetching system version:", e);
        return "0.0.0";
    }
};

export const setSystemVersion = async (version, force = true) => {
    try {
        const docRef = doc(db, "configuracion", "system_status");
        await setDoc(docRef, {
            current_version: version,
            last_update: Timestamp.now()
        }, { merge: true });
        return true;
    } catch (e) {
        console.error("Error setting system version:", e);
        throw e;
    }
};
