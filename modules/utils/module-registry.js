import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase-config.js";

/**
 * MODULE REGISTRY - XOLVY HMS (Hot Module Swapping)
 * Manages individual versions for application modules to allow granular updates.
 */

const LOCAL_STORAGE_KEY = 'xolvy_module_registry';

class ModuleRegistry {
    constructor() {
        this.registry = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || {
            core: "2.4.3.0",
            login: "2.4.2.5",
            admin: "2.4.3.0",
            conductor: "2.4.9.9.1",
            territories_view: "2.4.6.5",
            public_view: "2.4.2.5",
            phones_view: "2.4.2.5",
            rules_view: "2.4.3.7",
            availability: "2.4.2.5",
            recursos: "2.4.3.7",
            maps_explorer: "2.4.5.8",
            rescue: "2.4.6.5",
            phone_module: "2.4.3.7",
            onboarding: "2.4.2.5",
            analytics_view: "2.4.5.7",
            reports_view: "2.4.2.5",
            weekly_program: "2.4.2.5",
            program_views: "2.4.2.5"
        };
        this.listeners = [];
        this.cache = new Map();
    }

    init() {
        console.log("🧩 Module Registry: Initializing HMS...");
        let isFirstSnapshot = true;

        // Listen to Firestore for module version changes
        onSnapshot(doc(db, "configuracion", "module_control"), (docSnap) => {
            if (!docSnap.exists()) return;

            const remoteRegistry = docSnap.data().versions || {};
            let hasChanges = false;

            Object.keys(remoteRegistry).forEach(moduleName => {
                if (this.registry[moduleName] !== remoteRegistry[moduleName]) {
                    console.log(`🔄 HMS Catch: Module [${moduleName}] updated ${this.registry[moduleName]} -> ${remoteRegistry[moduleName]}`);
                    this.registry[moduleName] = remoteRegistry[moduleName];
                    hasChanges = true;

                    // Only notify listeners (trigger re-renders) AFTER the initial sync.
                    // The first snapshot is just syncing versions; the page is still loading.
                    if (!isFirstSnapshot) {
                        this.notifyListeners(moduleName, remoteRegistry[moduleName]);
                    }
                }
            });

            if (hasChanges) {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.registry));
            }

            // After the first snapshot, all subsequent changes are real HMS updates
            isFirstSnapshot = false;
        });
    }


    /**
     * Centralized Hot Module Loading with Caching
     * ALWAYS uses Vite's glob import as primary strategy.
     * Dynamic import is only a fallback when no glob key matches.
     */
    async loadModule(name, path, globMap = {}) {
        // Normalize path to absolute from root
        let absolutePath = path;
        if (path.startsWith('./')) {
            if (path.startsWith('./modules/')) {
                absolutePath = path.substring(1); // ./modules/ -> /modules/
            } else {
                absolutePath = `/modules/${path.substring(2)}`;
            }
        }

        // Check if we already have a valid cached version
        const cachedMod = this.cache.get(name);
        if (cachedMod) {
            return cachedMod;
        }

        console.log(`📡 [HMS] Loading Micro-Module: ${name}`);
        let mod;

        // Build all possible glob key variations for matching
        // app.js glob keys:                ./modules/login.js
        // conductor-dashboard.js glob keys: ./conductor/availability.js
        const globPath1 = `.${absolutePath}`;  // -> ./modules/login.js or ./modules/conductor/availability.js
        const globPath2 = absolutePath.startsWith('/modules/')
            ? `.${absolutePath.substring(8)}`   // -> ./login.js or ./conductor/availability.js
            : absolutePath;

        // STRATEGY 1: ALWAYS use Vite glob map first (works in both dev and production)
        // The glob map is compiled at build time by Vite and already resolves to the correct
        // chunk files. It works reliably in ALL environments.
        const globKey = globMap[path] ? path
            : globMap[globPath1] ? globPath1
                : globMap[globPath2] ? globPath2
                    : null;

        if (globKey) {
            try {
                mod = await globMap[globKey]();
            } catch (e) {
                console.warn(`⚠️ [HMS] Glob load failed for ${name} (key: ${globKey}):`, e);
            }
        }

        // STRATEGY 2: Direct dynamic import (only if glob map had no matching key)
        if (!mod) {
            console.log(`📡 [HMS] No glob key for ${name}, using dynamic import`);
            const isProduction = import.meta.env.PROD;
            let finalPath = isProduction
                ? `/assets/${absolutePath.split('/').pop()}`
                : absolutePath;

            try {
                mod = await import(/* @vite-ignore */ finalPath);
            } catch (error) {
                console.error(`❌ [HMS] Failed to load module ${name} from ${finalPath}:`, error);
                throw error;
            }
        }

        this.cache.set(name, mod);
        return mod;
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(moduleName, version) {
        this.listeners.forEach(cb => cb(moduleName, version));
    }
}

export const moduleRegistry = new ModuleRegistry();
