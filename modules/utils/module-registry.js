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
            core: "2.4.2.5",
            login: "2.4.2.5",
            admin: "2.4.2.5",
            conductor: "2.4.3.7",
            territories_view: "2.4.6.2",
            public_view: "2.4.2.5",
            phones_view: "2.4.2.5",
            rules_view: "2.4.3.7",
            availability: "2.4.2.5",
            recursos: "2.4.3.7",
            maps_explorer: "2.4.5.8",
            rescue: "2.4.3.7",
            phone_module: "2.4.3.7",
            onboarding: "2.4.2.5",
            analytics_view: "2.4.5.6",
            weekly_program: "2.4.2.5",
            program_views: "2.4.2.5"
        };
        this.listeners = [];
    }

    init() {
        console.log("🧩 Module Registry: Initializing HMS...");

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

                    // Notify listeners (the UI shell) to pull the new code
                    this.notifyListeners(moduleName, remoteRegistry[moduleName]);

                    // Silent Pre-fetch: Download the code in background
                    this.prefetchModule(moduleName, remoteRegistry[moduleName]);
                }
            });

            if (hasChanges) {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.registry));
            }
        });
    }

    async prefetchModule(moduleName, version) {
        const moduleMap = {
            'admin': './modules/admin-dashboard.js',
            'conductor': './modules/conductor-dashboard.js',
            'login': './modules/login.js',
            'territories_view': './modules/admin/territories-view.js',
            'public_view': './modules/admin/public-view.js',
            'phones_view': './modules/admin/phones-view.js',
            'rules_view': './modules/admin/rules-view.js',
            'availability': './modules/conductor/availability.js',
            'recursos': './modules/conductor/recursos.js',
            'maps_explorer': './modules/conductor/maps-explorer.js',
            'rescue': './modules/conductor/rescue.js',
            'phone_module': './modules/conductor/phone-module.js',
            'onboarding': './modules/conductor/onboarding.js',
            'weekly_program': './modules/conductor/weekly-program.js',
            'program_views': './modules/conductor/program-views.js'
        };

        const path = moduleMap[moduleName];
        if (path) {
            console.log(`📡 [HMS] Pre-fetching Micro-Module [${moduleName}] v${version}...`);
            try {
                const link = document.createElement('link');
                link.rel = 'modulepreload';
                link.href = `${path}?v=${version}`;
                document.head.appendChild(link);
            } catch (e) {
                console.warn("HMS Pre-fetch failed:", e);
            }
        }
    }

    getModuleVersion(moduleName) {
        return this.registry[moduleName] || "latest";
    }

    /**
     * Appends a version segment to the import path to bypass cache
     * only when a mismatch is detected, or for initial load.
     */
    getModulePath(moduleName, basePath) {
        const v = this.getModuleVersion(moduleName);
        // Use relative paths that Vite can understand
        return `${basePath}?v=${v}`;
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(moduleName, version) {
        this.listeners.forEach(cb => cb(moduleName, version));
    }
}

export const moduleRegistry = new ModuleRegistry();
