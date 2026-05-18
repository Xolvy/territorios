import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase-config.js";
import { showNotification, updateNotificationWorkflow, completeSyncNotification } from "./helpers.js";

/**
 * UPDATE MANAGER - SUPER POWER UP
 * Handles version control, forced syncs, and premium UI feedback
 */

const APP_VERSION = __APP_VERSION__;

/**
 * ANTI-LOOP SHIELD
 * Prevents infinite update cycles by tracking attempts in localStorage
 */
const UpdateShield = {
    getStats: () => {
        try {
            return JSON.parse(localStorage.getItem('xolvy_update_loop_stats') || '{"count":0, "lastAttempt":0, "lastTarget":""}');
        } catch (e) {
            console.warn("🛡️ [Update Shield] Storage unavailable.");
            return { count: 0, lastAttempt: 0, lastTarget: "" };
        }
    },
    saveStats: (stats) => {
        try {
            localStorage.setItem('xolvy_update_loop_stats', JSON.stringify(stats));
        } catch (e) { /* ignore */ }
    },
    registerAttempt: (targetVersion) => {
        try {
            const stats = UpdateShield.getStats();
            const now = Date.now();

            // If target changed, reset count (we are trying a new version)
            if (stats.lastTarget !== targetVersion) {
                stats.count = 1;
            } else if (now - stats.lastAttempt > 300000) {
                stats.count = 1;
            } else {
                stats.count++;
            }

            stats.lastAttempt = now;
            stats.lastTarget = targetVersion;
            UpdateShield.saveStats(stats);
            console.warn(`🛡️ [Update Shield] Attempt ${stats.count}/3 for v${targetVersion} registered.`);
            return stats;
        } catch (e) { return { count: 1, lastAttempt: Date.now(), lastTarget: targetVersion }; }
    },
    isLocked: () => {
        try {
            const stats = UpdateShield.getStats();
            const locked = stats.count >= 3 && (Date.now() - stats.lastAttempt < 300000);
            if (locked) console.error("🚨 [Update Shield] CIRCUIT BREAKER ACTIVE: Update loop detected.");
            return locked;
        } catch (e) { return false; }
    },
    reset: () => {
        try {
            console.log("🛡️ [Update Shield] Resetting loop statistics.");
            localStorage.removeItem('xolvy_update_loop_stats');
        } catch (e) { /* ignore */ }
    }
};

export const initUpdateManager = () => {
    console.log(`🛡️ Update Manager: Active (v${APP_VERSION})`);

    // 0. RADICAL PURGE: Verify if we are coming from a "stuck" state
    try {
        const lastSessionVersion = localStorage.getItem('xolvy_last_shell_version');
        if (lastSessionVersion && lastSessionVersion !== APP_VERSION) {
            console.log(`🧹 [Radical Purge] Version transition detected: ${lastSessionVersion} -> ${APP_VERSION}`);
            performRadicalCachePurge(false); // Silent purge if we already updated
            localStorage.setItem('xolvy_last_shell_version', APP_VERSION);

            // SUCCESS: We successfully moved to a new version, reset the loop shield
            UpdateShield.reset();
        } else if (!lastSessionVersion) {
            localStorage.setItem('xolvy_last_shell_version', APP_VERSION);
        }
    } catch (e) {
        console.warn("🛡️ [Update Manager] Storage access denied.");
    }
    // 1. HANDSHAKE: Check if we just updated to show "Online" status
    try {
        if (localStorage.getItem('xolvy_update_handshake') === 'true') {
            console.log("🟢 [Xolvy Updates] Handshake detected. Showing 'Online' status.");
            localStorage.removeItem('xolvy_update_handshake');

            // Show a premium "Online" notification
            setTimeout(() => {
                showNotification("¡Conexión Restablecida! Sistema Optimizado", "success");
            }, 1500);
        }
    } catch (e) { /* ignore */ }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('updated') === 'true') {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Listen for Server-Side Force Updates
    onSnapshot(doc(db, "configuracion", "version_control"), async (docSnap) => {
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        const serverVersion = data.latestVersion;
        const serverForceTimestamp = data.forceTimestamp || 0;
        const localForceTimestamp = parseInt(localStorage.getItem('last_force_timestamp') || '0');

        // Helper for semantic comparison (e.g., 2.4.2.10 > 2.4.2.9)
        const isNewer = (vServer, vLocal) => {
            const s = String(vServer).split('.').map(Number);
            const l = String(vLocal).split('.').map(Number);
            for (let i = 0; i < Math.max(s.length, l.length); i++) {
                if ((s[i] || 0) > (l[i] || 0)) return true;
                if ((s[i] || 0) < (l[i] || 0)) return false;
            }
            return false;
        };

        const hasUpdate = isNewer(serverVersion, APP_VERSION);
        const forceRequired = serverForceTimestamp > localForceTimestamp;

        console.log(`📡 Update Check: Local=${APP_VERSION}, Server=${serverVersion} | NewAvailable=${hasUpdate}`);

        // ONLY trigger full reload if the CORE shell version is NEWER
        if (hasUpdate) {
            // Check if we are locked in a loop
            if (UpdateShield.isLocked()) {
                showRescuePill(serverVersion);
                return;
            }

            console.log("🚀 Core Update Required! Starting background sync...");
            startBackgroundUpdate(serverVersion, serverForceTimestamp);
        } else if (forceRequired) {
            // If it's just a force sync without version change, we can just clear caches silently
            console.log("⚡ Force Sync requested without version change. Purging background caches.");
            localStorage.setItem('last_force_timestamp', serverForceTimestamp.toString());
            // No reload needed, HMS or next fetch will pick up changes
        } else if (isNewer(APP_VERSION, serverVersion)) {
            // TELEMETRY: If I am an Admin and my version is newer, I should auto-sync the server
            // TELEMETRY: If I am an Admin and my version is newer, I should auto-sync the server
            const currentRole = window.XolvyApp?.user?.role;
            const isAdmin = (currentRole === 'Administrador' || currentRole === 'SuperAdmin');
            if (isAdmin) {
                console.log("📡 [Telemetry] Admin detected with newer version. Auto-syncing Firestore...");
                broadcastCurrentVersion().catch(err => console.warn("Telemetry sync failed:", err));
            }
        }
    });

    // 3. Telemetry: If I'm an Admin, I should verify if my version is the "latest"
    // This is optional but helps keep the Firestore doc in sync
};

/**
 * BACKGROUND UPDATE ENGINE
 * Performs the update silently using the HUD sidebar
 */
const startBackgroundUpdate = async (newVersion, forceTimestamp = 0) => {
    if (document.getElementById('xolvy-core-sync-hud')) return;

    // 1. Show HUD card for the core update
    notifyModuleUpdate("Núcleo", newVersion);

    // Flag for "Online" handshake after reload
    localStorage.setItem('xolvy_update_handshake', 'true');

    // Preservation of state (Rule 1.3)
    const currentState = {
        path: window.location.pathname,
        timestamp: Date.now(),
        role: window.XolvyApp?.user?.role || null,
        user: localStorage.getItem('selected_conductor_name')
    };
    sessionStorage.setItem('xolvy_pre_update_state', JSON.stringify(currentState));

    try {
        // AI Announcement (Background) handled by Nexo now


        // Register attempt in the shield
        UpdateShield.registerAttempt(newVersion);

        // 2. Perform the update swap
        // Wait 4 seconds so the user can see the sync notification in the HUD
        await new Promise(r => setTimeout(r, 4000));

        // Radical Cache Purge (Smart Mode - Session Preserved)
        await performRadicalCachePurge(false);

        if (forceTimestamp) localStorage.setItem('last_force_timestamp', forceTimestamp.toString());

        // 3. Finalize and Reload
        completeXolvyUpdate("Núcleo", newVersion);

        setTimeout(() => {
            window.location.href = `${window.location.pathname}?updated=true`;
        }, 1500);

    } catch (err) {
        console.error("Background update failed:", err);
        window.location.reload();
    }
};



/**
 * PERISTENCE KILLER: Ensures NO old assets (especially Service Workers) survive a version jump
 */
export const performRadicalCachePurge = async (full = true) => {
    console.warn("🔥 [Xolvy Updates] Initiating Radical Cache Purge...");

    try {
        // 1. Clear all Caches (Radical Eviction)
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
            console.log("✅ [Purge] Browser Caches cleared");
        }

        // 2. Unregister all Service Workers immediately
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
            console.log("✅ [Purge] Service Workers unregistered");
        }

        if (full) {
            // 3. Delete IndexedDB Databases (Firestore persistence often gets corrupted)
            // WE ONLY DO THIS IN RADICAL MODE (Rescue) to avoid logging out users
            try {
                if (window.indexedDB && window.indexedDB.databases) {
                    const dbs = await window.indexedDB.databases();
                    await Promise.all(dbs.map(db => {
                        // DO NOT DELETE AUTH DATABASE IF POSSIBLE
                        if (db.name.includes('auth')) return Promise.resolve();

                        console.log(`🗑️ [Purge] Deleting DB: ${db.name}`);
                        return new Promise((resolve) => {
                            const req = window.indexedDB.deleteDatabase(db.name);
                            req.onsuccess = () => resolve();
                            req.onerror = () => resolve();
                            req.onblocked = () => resolve();
                        });
                    }));
                } else if (window.indexedDB) {
                    // Fallback for browsers that don't support .databases()
                    const legacyDBs = [
                        "firestore/[DEFAULT]/territorios-jw/main",
                        "firebase-heartbeat-database",
                        "firebase-installations-database"
                    ];
                    legacyDBs.forEach(dbName => window.indexedDB.deleteDatabase(dbName));
                }
                console.log("✅ [Purge] Non-Auth IndexedDB cleared");
            } catch (idbErr) { console.warn("IndexDB purge partial failure:", idbErr); }

            // 4. Clear storage
            sessionStorage.clear();

            // 5. Force browser to reload from network on next request
            localStorage.setItem('xolvy_purge_executed', Date.now().toString());
        }
    } catch (e) {
        console.error("Purge failed:", e);
    }
};



/**
 * XOLVY UPDATES - DISCRETE HUD & IA NOTIFICATIONS
 */

export const notifyModuleUpdate = async (moduleName, version) => {
    // 1. Show HUD and get ID
    const notifId = showXolvyUpdateHUD(moduleName, version);

    // 2. Trace Workflow (HMS Telemetry)
    setTimeout(() => updateNotificationWorkflow(notifId, 'Validando Módulos...'), 500);
    setTimeout(() => updateNotificationWorkflow(notifId, 'Buscando Assets HMS...'), 1200);

    // 3. IA Integration (Handled by Nexo now)
    setTimeout(() => updateNotificationWorkflow(notifId, 'Compilando Delta de Parche...'), 1800);

};

const showXolvyUpdateHUD = (moduleName, version) => {
    return showNotification(`Sincronizando ${moduleName} v${version}`, 'sync', 0, ['Iniciando Handshake...']);
};



export const completeXolvyUpdate = (moduleName, version) => {
    const finalName = version ? `${moduleName} v${version}` : moduleName;
    completeSyncNotification(finalName);
};


/**
 * ADMIN ONLY: Utility to broadcast the current version as the latest
 */
export const broadcastCurrentVersion = async () => {
    try {
        const { db } = await import("../../firebase-config.js");
        const { doc, updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: APP_VERSION,
            forceTimestamp: Date.now(),
            forceUpdate: true,
            updatedAt: new Date().toLocaleString()
        });
        showNotification("¡Actualización Global Activada!", "success");
    } catch (err) {
        console.error("Broadcast error:", err);
        showNotification("Error al difundir versión", "error");
    }
};

/**
 * RESCUE PILL: Shown when an update loop is detected
 */
const showRescuePill = (targetVersion) => {
    if (document.getElementById('xolvy-rescue-pill')) return;

    const pill = document.createElement('div');
    pill.id = 'xolvy-rescue-pill';
    pill.className = 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100000] w-[90%] max-w-sm animate-fade-in';
    pill.innerHTML = `
        <div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-slate-200 dark:border-indigo-500/20 p-8 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.2)] dark:shadow-[0_40px_100px_rgba(0,0,0,0.8)] text-center">
            <div class="w-20 h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center text-4xl text-indigo-500 mx-auto mb-6 shadow-inner animate-float">
                <i class="fas fa-shield-check"></i>
            </div>
            <h4 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Sincronización de Sistema</h4>
            <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-relaxed mb-4">
                El sistema detectó que tu versión local (v${APP_VERSION}) no logra alcanzar la versión v${targetVersion}.
            </p>
            <p class="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest leading-relaxed mb-8 bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10">
                <i class="fas fa-info-circle mr-1"></i> Esto ocurre si la actualización no se desplegó completamente en el servidor. Pulsa el botón para limpiar el rastro y volver a intentar.
            </p>
            <button id="btn-rescue-action" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-indigo-600/20 transition-all active:scale-95 outline-none mb-3">
                Restablecer Conexión
            </button>
            <p class="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Si eres administrador, verifica el despliegue del código.</p>
        </div>
    `;

    document.body.appendChild(pill);

    pill.querySelector('#btn-rescue-action').onclick = async () => {
        const btn = pill.querySelector('#btn-rescue-action');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-sync fa-spin"></i>';

        console.warn("🆘 Executing Deep Reset...");
        UpdateShield.reset(); // Reset shield so we can try one last time
        await performRadicalCachePurge(true);

        // Add a parameter to force network reload
        window.location.href = window.location.pathname;
    };
};
