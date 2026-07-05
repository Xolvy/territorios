/**
 * @module firebase-config
 * @description Inicialización y configuración de Firebase para la aplicación.
 *              Implementa el Patrón Singleton para Firestore con persistencia offline
 *              (IndexedDB multi-tab) y un sistema de recuperación de emergencia
 *              ante corrupciones de IndexedDB.
 *
 * @layer Core / Infraestructura
 *
 * @exports
 *  - auth     → Instancia de Firebase Authentication
 *  - db       → Instancia Singleton de Firestore (con persistencia offline)
 *  - storage  → Instancia de Firebase Storage
 *
 * @important Si Firestore lanza un error de IndexedDB, `triggerEmergencyRecovery()`
 *            deshabilita la persistencia para el siguiente boot y recarga la página.
 */
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// ═══════════════════════════════════════════════════════════
// CREDENCIALES Y PROYECTO
// ═══════════════════════════════════════════════════════════
// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDrgpMp04uuFRz61vNIOzD9CCPl8p_wDL0",
    authDomain: "territorios-jw.web.app",
    projectId: "territorios-jw",
    storageBucket: "territorios-jw.firebasestorage.app",
    messagingSenderId: "350092132257",
    appId: "1:350092132257:web:7795cb426dfe4b496b55e0",
};

// Inicializa Firebase o recupera instancia existente
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// ═══════════════════════════════════════════════════════════
// SINGLETON: Auth y Firestore
// Firestore se inicializa UNA sola vez con persistencia offline (IndexedDB).
// Si ya existe una instancia (getApps().length > 0), se reutiliza para
// garantizar que no haya múltiples conexiones en el mismo contexto.
// ═══════════════════════════════════════════════════════════
// Exporta las instancias de los servicios
export const auth = getAuth(app);

// Inicializar Firestore con persistencia configurada (Singleton Pattern)
let firestoreDb;
const initFirestore = (withPersistence = true) => {
    try {
        if (withPersistence) {
            return initializeFirestore(app, {
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager(),
                }),
            });
        }
    } catch (e) {
        const isCorruption =
            e.message?.includes("IndexedDB") || e.code === "failed-precondition" || e.name === "FirebaseError";
        if (isCorruption) {
            console.error("🔥 Firestore: Persistence Corruption Detected during init.", e);
            triggerEmergencyRecovery();
        } else {
            console.warn("📍 Firestore: Persistence init failed, falling back to basic.", e);
        }
    }
    return getFirestore(app);
};

// Emergency check for IndexedDB corruption (Power Up)
try {
    const justPurged = localStorage.getItem("xolvy_purge_executed");
    const forceDisable = localStorage.getItem("xolvy_disable_persistence") === "true";
    const skipPersistence = forceDisable || Date.now() - parseInt(justPurged || "0", 10) < 5000;

    if (skipPersistence) {
        console.warn("🛡️ [Firestore] Skip Persistence due to recovery flag or recent purge.");
        // Auto-reset the flag for the next try, assuming this boot will be clean
        localStorage.removeItem("xolvy_disable_persistence");
        firestoreDb = initFirestore(false);
    } else {
        firestoreDb = initFirestore(true);
    }
} catch (e) {
    console.error("🚨 Firestore: Critical Initialization Error", e);
    firestoreDb = getFirestore(app);
}

// ═══════════════════════════════════════════════════════════
// RECUPERACIÓN DE EMERGENCIA (Power Up)
// Si Firestore detecta corrupción de IndexedDB, deshabilita la persistencia
// para el siguiente boot y fuerza una recarga limpia de la página.
// ═══════════════════════════════════════════════════════════
// Global Error Listener for Firebase Persistence Corruptions (Refined)
const triggerEmergencyRecovery = () => {
    console.error("🔥 Persistence Corruption Detected. Triggering emergency recovery...");

    // Recovery: Disable persistence for the next boot and purge
    localStorage.setItem("xolvy_purge_executed", Date.now().toString());
    localStorage.setItem("xolvy_disable_persistence", "true");

    // Critical: Clean up what we can now
    if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }

    if (window.indexedDB) {
        // Official Firebase DB names
        window.indexedDB.deleteDatabase("firestore/[DEFAULT]/territorios-jw/main");
        // Specific name requested by user for manual purges/legacy
        window.indexedDB.deleteDatabase("firestoreDb");
    }

    // Final purge of keys
    localStorage.removeItem("firebase:firestore/[DEFAULT]/territorios-jw/main/offlinePersistenceEnabled");

    // Force reload with cache busting
    setTimeout(() => {
        window.location.href = window.location.pathname;
    }, 1000);
};

window.addEventListener("unhandledrejection", (event) => {
    const msg = event.reason?.message || "";
    const code = event.reason?.code || "";

    // Silence initial permission errors (Live Pool resolves them late)
    const isEarly = !window.__appBootTime || Date.now() - window.__appBootTime < 1500;
    if (isEarly && (code === "permission-denied" || msg.includes("insufficient permissions"))) {
        console.debug("🤫 [Auth] Silencing early permission error.");
        return;
    }

    if (msg.includes("IndexedDB") || msg.includes("refusing to open IndexedDB")) {
        triggerEmergencyRecovery();
    }
});

// Set boot time
window.__appBootTime = Date.now();

window.addEventListener("error", (event) => {
    const msg = event.message || "";
    const isEarly = !window.__appBootTime || Date.now() - window.__appBootTime < 1500;

    if (isEarly && msg.includes("insufficient permissions")) return;

    if (msg.includes("IndexedDB") || msg.includes("refusing to open IndexedDB") || msg.includes("code=unavailable")) {
        triggerEmergencyRecovery();
    }
});

export const db = firestoreDb;
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");
