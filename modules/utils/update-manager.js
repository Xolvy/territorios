import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase-config.js";
import { showNotification } from "./helpers.js";

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
            return JSON.parse(localStorage.getItem('xolvy_update_loop_stats') || '{"count":0, "lastAttempt":0}');
        } catch (e) {
            console.warn("🛡️ [Update Shield] Storage unavailable.");
            return { count: 0, lastAttempt: 0 };
        }
    },
    saveStats: (stats) => {
        try {
            localStorage.setItem('xolvy_update_loop_stats', JSON.stringify(stats));
        } catch (e) { /* ignore */ }
    },
    registerAttempt: () => {
        try {
            const stats = UpdateShield.getStats();
            const now = Date.now();
            if (now - stats.lastAttempt > 300000) {
                stats.count = 1;
            } else {
                stats.count++;
            }
            stats.lastAttempt = now;
            UpdateShield.saveStats(stats);
            console.warn(`🛡️ [Update Shield] Attempt ${stats.count}/3 registered.`);
            return stats;
        } catch (e) { return { count: 1, lastAttempt: Date.now() }; }
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

            console.log("🚀 Core Update Required! Triggering discrete notification...");
            showSmartUpdatePill(serverVersion, serverForceTimestamp, !!data.forceUpdate);
        } else if (forceRequired) {
            // If it's just a force sync without version change, we can just clear caches silently
            console.log("⚡ Force Sync requested without version change. Purging background caches.");
            localStorage.setItem('last_force_timestamp', serverForceTimestamp.toString());
            // No reload needed, HMS or next fetch will pick up changes
        } else if (isNewer(APP_VERSION, serverVersion)) {
            // TELEMETRY: If I am an Admin and my version is newer, I should auto-sync the server
            const isAdmin = localStorage.getItem('demo_role') === 'Administrador';
            if (isAdmin) {
                console.log("📡 [Telemetry] Admin detected with newer version. Auto-syncing Firestore...");
                broadcastCurrentVersion().catch(err => console.warn("Telemetry sync failed:", err));
            }
        }
    });

    // 3. Telemetry: If I'm an Admin, I should verify if my version is the "latest"
    // This is optional but helps keep the Firestore doc in sync
};

const showSmartUpdatePill = async (newVersion, forceTimestamp = 0, isForced = false) => {
    if (document.getElementById('smart-update-pill')) return;

    const pill = document.createElement('div');
    pill.id = 'smart-update-pill';
    // Floating pill at the top center
    pill.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[100000] w-[90%] max-w-md animate-slide-down';

    pill.innerHTML = `
        <div class="bg-slate-900/90 backdrop-blur-3xl border border-indigo-500/30 p-4 rounded-[2rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] flex items-center gap-4 relative overflow-hidden group">
            <!-- Progress Background Pulse -->
            <div id="pill-progress-bg" class="absolute inset-0 bg-indigo-500/5 translate-x-[-100%] transition-transform duration-700 ease-out"></div>
            
            <div class="relative w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-xl text-indigo-400 shrink-0 shadow-inner overflow-hidden">
                <i id="pill-icon" class="fas fa-rocket animate-pulse"></i>
                <div id="pill-spinner" class="absolute inset-0 border-2 border-transparent border-t-indigo-500 rounded-full hidden animate-spin"></div>
            </div>
            
            <div class="flex-1 min-w-0 relative z-10">
                <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-[8px] font-black text-indigo-400 uppercase tracking-[0.3em]">Xolvy Core v${newVersion}</span>
                    ${isForced ? '<span class="px-1.5 py-0.5 bg-rose-500/20 text-rose-500 text-[6px] font-black rounded-full uppercase tracking-tighter">Obligatoria</span>' : ''}
                </div>
                <h4 id="pill-title" class="text-[12px] font-black text-white uppercase tracking-tight truncate leading-tight">Mejora de Sistema Disponible</h4>
                <p id="pill-status" class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Listo para optimizar tu experiencia</p>
            </div>
            
            <button id="btn-pill-action" class="relative z-10 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all outline-none">
                Actualizar
            </button>
        </div>
    `;

    document.body.appendChild(pill);

    const btn = pill.querySelector('#btn-pill-action');
    const status = pill.querySelector('#pill-status');
    const title = pill.querySelector('#pill-title');
    const icon = pill.querySelector('#pill-icon');
    const spinner = pill.querySelector('#pill-spinner');
    const progressBg = pill.querySelector('#pill-progress-bg');

    const runUpdateFlow = async () => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        status.innerText = "Modo Offline: Sincronizando...";
        status.className = "text-[8px] font-black text-rose-400 uppercase tracking-widest mt-1 animate-pulse";
        spinner.classList.remove('hidden');
        icon.classList.add('opacity-0');

        // Preservation of state (Rule 1.3)
        const currentState = {
            path: window.location.pathname,
            timestamp: Date.now(),
            role: localStorage.getItem('demo_role'),
            user: localStorage.getItem('selected_conductor_name')
        };
        sessionStorage.setItem('xolvy_pre_update_state', JSON.stringify(currentState));
        // Flag for "Online" handshake after reload
        localStorage.setItem('xolvy_update_handshake', 'true');

        try {
            // Register attempt in the shield
            UpdateShield.registerAttempt();

            status.innerText = "Aislación de activos...";

            // MODIFIED: Use Smart Purge by default to avoid logging out users
            // Radical purge is now only for the Rescue Pill or if locked
            await performRadicalCachePurge(false);

            status.innerText = "Finalizando optimización...";
            await new Promise(r => setTimeout(r, 1200));

            progressBg.style.transform = 'translateX(0%)';
            if (forceTimestamp) localStorage.setItem('last_force_timestamp', forceTimestamp.toString());

            title.innerText = "Optimización Completada";
            status.innerText = "Restableciendo conexión...";
            status.className = "text-[8px] font-black text-emerald-400 uppercase tracking-widest mt-1";
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.className = "relative z-10 bg-emerald-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20";

            setTimeout(() => {
                window.location.href = `${window.location.pathname}?updated=true&v=${Date.now()}`;
            }, 800);

        } catch (err) {
            console.error("Discrete update failed:", err);
            // Fallback to reload if something breaks
            window.location.reload();
        }
    };

    btn.onclick = runUpdateFlow;

    // AI Integration: Announce the core update
    try {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (apiKey) {
            const { TerritoryIntelligence } = await import("./intelligence.js");
            const intelligence = new TerritoryIntelligence([], [], [], {}, [], []);
            const message = await intelligence.getUpdateInsight('core', newVersion, apiKey);
            showIANotification(message);
        }
    } catch (e) { console.warn("AI Insight for Core Update failed", e); }

    // If forced, start automatically after AI has a chance to show up
    if (isForced) {
        setTimeout(runUpdateFlow, 3000);
    }
};

const showPremiumUpdateOverlay = () => {
    console.warn("Legacy Full-Screen Overlay bypassed in favor of Smart Pill.");
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

const showUpdateSuggestion = (newVersion, forceTimestamp = 0) => {
    if (document.getElementById('update-suggestion-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'update-suggestion-toast';
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] w-[92%] max-w-sm animate-slide-up';
    toast.innerHTML = `
        <div class="bg-slate-900/80 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4">
            <div class="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-xl text-indigo-400 shadow-inner overflow-hidden relative group">
                <div class="absolute inset-0 bg-indigo-500/10 blur-xl animate-pulse"></div>
                <i class="fas fa-sparkles relative z-10 animate-bounce-subtle"></i>
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-[9px] font-black text-indigo-400/80 uppercase tracking-[0.2em] mb-0.5">Mejora Disponible</h4>
                <p class="text-[11px] font-bold text-white uppercase tracking-tight truncate">Versión ${newVersion} lista</p>
            </div>
            <button id="btn-update-soft" class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all outline-none">
                Instalar
            </button>
        </div>
    `;

    document.body.appendChild(toast);
    document.getElementById('btn-update-soft').onclick = () => showPremiumUpdateOverlay(newVersion, forceTimestamp);
};

/**
 * XOLVY UPDATES - DISCRETE HUD & IA NOTIFICATIONS
 */

export const notifyModuleUpdate = async (moduleName, version) => {
    // 1. Show HUD
    showXolvyUpdateHUD(moduleName, version);

    // 2. IA Integration (Optional speaker)
    try {
        const { moduleRegistry } = await import("./module-registry.js");
        // We only "speak" if it's a significant module
        const significantModules = ['conductor', 'admin', 'territories_view', 'phones_view', 'weekly_program', 'program_views'];
        if (significantModules.includes(moduleName)) {
            const apiKey = localStorage.getItem('gemini_api_key');
            if (apiKey) {
                const { TerritoryIntelligence } = await import("./intelligence.js");
                const intelligence = new TerritoryIntelligence([], [], [], {}, [], []);
                const message = await intelligence.getUpdateInsight(moduleName, version, apiKey);

                // Show as an IA Notification
                showIANotification(message);
            }
        }
    } catch (e) {
        console.warn("Xolvy Updates: AI Insight failed", e);
    }
};

const showXolvyUpdateHUD = (moduleName, version) => {
    let hud = document.getElementById('xolvy-updates-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'xolvy-updates-hud';
        hud.className = 'fixed top-1/2 -translate-y-1/2 right-4 z-[10000] flex flex-col items-end gap-3 pointer-events-none transition-all duration-700';
        document.body.appendChild(hud);
    }

    const card = document.createElement('div');
    card.className = 'xolvy-hud-glass px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-left pointer-events-auto transform transition-all duration-500 hover:scale-[1.02] hover:bg-slate-900/60 group border-indigo-500/20';
    card.innerHTML = `
        <div class="relative w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 overflow-hidden shrink-0 shadow-inner group-hover:scale-110 transition-transform">
            <div class="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent animate-pulse"></div>
            <i class="fas fa-sync-alt animate-spin-slow text-lg"></i>
        </div>
        <div class="flex flex-col min-w-[140px]">
            <div class="flex items-center gap-2 mb-0.5">
                <span class="text-[8px] font-black text-indigo-400 uppercase tracking-[0.25em]">Xolvy Updates</span>
                <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span>
            </div>
            <h4 class="text-[11px] font-extrabold text-white/90 uppercase tracking-tight leading-none">Sincronizando ${moduleName}</h4>
            <p class="text-[7px] font-black text-slate-500 uppercase tracking-widest mt-1 opacity-60">Versión ${version} • HMS Core Active</p>
        </div>
    `;

    hud.appendChild(card);

    // Remove after 8 seconds with smooth exit
    setTimeout(() => {
        card.classList.add('opacity-0', 'translate-x-[200px]', 'scale-90');
        setTimeout(() => card.remove(), 700);
    }, 8500);
};

export const completeXolvyUpdate = (moduleName) => {
    const hud = document.getElementById('xolvy-updates-hud');
    if (!hud) return;

    // Find the card for this module
    const cards = hud.querySelectorAll('div');
    for (const card of cards) {
        if (card.innerText.includes(moduleName)) {
            // Update to success state
            card.className = 'xolvy-hud-glass px-4 py-3 rounded-2xl shadow-[0_20px_50px_rgba(16,185,129,0.3)] flex items-center gap-4 animate-slide-left pointer-events-auto transform transition-all duration-700 bg-emerald-500/10 border-emerald-500/30';

            const iconContainer = card.querySelector('.relative');
            if (iconContainer) {
                iconContainer.className = 'relative w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 overflow-hidden shrink-0 shadow-inner scale-110';
                iconContainer.innerHTML = '<i class="fas fa-check text-lg scale-110 transition-transform"></i>';
            }

            const header = card.querySelector('h4');
            if (header) {
                header.innerText = `${moduleName} Actualizado`;
                header.className = 'text-[11px] font-extrabold text-emerald-400 uppercase tracking-tight leading-none';
            }

            const ping = card.querySelector('.animate-ping');
            if (ping) {
                ping.className = 'w-1.5 h-1.5 bg-emerald-500 rounded-full';
            }

            const label = card.querySelector('span'); // Xolvy Updates
            if (label) {
                label.className = 'text-[8px] font-black text-emerald-400 uppercase tracking-[0.25em]';
            }

            // Remove sooner since it's done
            setTimeout(() => {
                card.classList.add('opacity-0', 'translate-x-[200px]', 'scale-90');
                setTimeout(() => card.remove(), 700);
            }, 4000);
            break;
        }
    }
};

const showIANotification = (message) => {
    const banner = document.createElement('div');
    banner.className = 'fixed bottom-24 right-6 left-6 md:left-auto md:w-[380px] z-[10001] animate-slide-up';
    banner.innerHTML = `
        <div class="ia-banner-glow bg-indigo-600/90 backdrop-blur-2xl p-6 rounded-[2.5rem] shadow-[0_30px_90px_-20px_rgba(79,70,229,0.5)] border border-white/20 relative overflow-hidden group">
            <div class="absolute inset-0 ia-scanline opacity-10 pointer-events-none"></div>
            <div class="absolute -top-20 -right-20 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-1000"></div>
            
            <div class="flex items-start gap-5 relative z-10">
                <div class="relative shrink-0">
                    <div class="w-14 h-14 bg-white/20 rounded-[1.25rem] flex items-center justify-center text-3xl shadow-xl rotate-3 group-hover:rotate-12 transition-transform duration-500">
                        🤖
                    </div>
                    <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-indigo-600 rounded-full"></div>
                </div>
                
                <div class="flex-1 space-y-2 pt-1">
                    <div class="flex justify-between items-center">
                        <h4 class="text-[10px] font-black text-white/70 uppercase tracking-[0.3em]">Cerebro Territorial</h4>
                        <span class="text-[8px] font-bold bg-white/10 text-white/50 px-2 py-0.5 rounded-full uppercase">AI Intel</span>
                    </div>
                    <p class="text-[13px] font-bold text-white leading-[1.6] italic tracking-tight">
                        "${message}"
                    </p>
                </div>
            </div>
            
            <!-- Progress line -->
            <div class="absolute bottom-0 left-0 h-1 bg-white/20 w-full">
                <div class="h-full bg-indigo-400 group-hover:bg-white transition-colors" style="animation: progress-shrink 12s linear forwards;"></div>
            </div>
        </div>
        <style>
            @keyframes progress-shrink { from { width: 100%; } to { width: 0%; } }
        </style>
    `;
    document.body.appendChild(banner);

    // Auto-remove
    setTimeout(() => {
        banner.classList.add('opacity-0', 'translate-y-10', 'scale-95');
        setTimeout(() => banner.remove(), 600);
    }, 12000);
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
    pill.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[100000] w-[90%] max-w-md animate-slide-up';
    pill.innerHTML = `
        <div class="bg-rose-950/90 backdrop-blur-3xl border border-rose-500/50 p-5 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] flex items-center gap-5">
            <div class="w-14 h-14 bg-rose-500/20 rounded-2xl flex items-center justify-center text-2xl text-rose-400 shrink-0 shadow-inner">
                <i class="fas fa-exclamation-triangle animate-pulse"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[9px] font-black text-rose-400 uppercase tracking-[0.3em]">Modo Rescate Activo</span>
                </div>
                <h4 class="text-[14px] font-black text-white uppercase tracking-tight leading-tight">Bucle de Actualización</h4>
                <p class="text-[10px] font-bold text-rose-300 opacity-80 uppercase tracking-widest mt-1">El sistema no pudo saltar a v${targetVersion}</p>
            </div>
            <button id="btn-rescue-action" class="bg-white text-rose-600 hover:bg-rose-100 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95">
                Reset Profundo
            </button>
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
        window.location.href = window.location.pathname + '?rescue=' + Date.now();
    };
};
