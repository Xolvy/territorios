import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase-config.js";
import { showNotification } from "./helpers.js";

/**
 * UPDATE MANAGER - SUPER POWER UP
 * Handles version control, forced syncs, and premium UI feedback
 */

const APP_VERSION = __APP_VERSION__;

export const initUpdateManager = () => {
    console.log(`🛡️ Update Manager: Active (v${APP_VERSION})`);

    // 1. Success Message after Update
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('updated') === 'true') {
        setTimeout(() => {
            showNotification(`🚀 ¡Sistema Actualizado a v${APP_VERSION}!`, "success");
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 1000);
    }

    // 2. Listen for Server-Side Force Updates
    onSnapshot(doc(db, "configuracion", "version_control"), async (docSnap) => {
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        const serverVersion = data.latestVersion;
        const serverForceTimestamp = data.forceTimestamp || 0;
        const localForceTimestamp = parseInt(localStorage.getItem('last_force_timestamp') || '0');

        // Check if we need to force an update
        const versionMismatch = String(serverVersion) !== String(APP_VERSION);
        const forceRequired = serverForceTimestamp > localForceTimestamp;

        console.log(`📡 Update Check: Local=${APP_VERSION}, Server=${serverVersion} | Force=${forceRequired}`);

        // ONLY trigger full reload if the CORE shell version changed
        if (versionMismatch) {
            // ANTI-LOOP PROTECTOR: 
            const now = Date.now();
            const lastAttempt = parseInt(sessionStorage.getItem('last_update_attempt') || '0');
            if (now - lastAttempt < 10000) {
                console.warn("⚠️ [Update Shield] Loop detected. Standing down.");
                return;
            }

            console.log("🚀 Core Update Required! Triggering overlay...");
            sessionStorage.setItem('last_update_attempt', now.toString());

            if (data.forceUpdate) {
                showPremiumUpdateOverlay(serverVersion, serverForceTimestamp);
            } else {
                showUpdateSuggestion(serverVersion, serverForceTimestamp);
            }
        } else if (forceRequired) {
            // If it's just a force sync without version change, we can just clear caches silently
            console.log("⚡ Force Sync requested without version change. Purging background caches.");
            localStorage.setItem('last_force_timestamp', serverForceTimestamp.toString());
            // No reload needed, HMS or next fetch will pick up changes
        }
    });

    // 3. Telemetry: If I'm an Admin, I should verify if my version is the "latest"
    // This is optional but helps keep the Firestore doc in sync
};

const showPremiumUpdateOverlay = async (newVersion, forceTimestamp = 0) => {
    if (document.getElementById('premium-update-overlay')) return;

    // 1. SAVE STATE: Before we do anything, let's preserve the working context
    const currentState = {
        path: window.location.pathname,
        timestamp: Date.now(),
        scroll: window.scrollY,
        role: localStorage.getItem('demo_role'),
        user: localStorage.getItem('selected_conductor_name')
    };
    sessionStorage.setItem('xolvy_pre_update_state', JSON.stringify(currentState));

    const overlay = document.createElement('div');
    overlay.id = 'premium-update-overlay';
    overlay.className = 'fixed inset-0 bg-[#020617] backdrop-blur-[100px] z-[99999] flex items-center justify-center p-6 text-white overflow-hidden';

    overlay.innerHTML = `
        <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] animate-pulse" style="animation-delay: 2s"></div>
        
        <div class="max-w-md w-full text-center space-y-12 animate-slide-up relative z-10">
            <div class="relative inline-block group">
                <div class="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-125"></div>
                
                <div class="relative w-28 h-28 bg-white/[0.03] backdrop-blur-md rounded-[2.5rem] border border-white/10 flex items-center justify-center text-4xl shadow-2xl overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent"></div>
                    <i class="fas fa-rocket text-indigo-400 animate-bounce-subtle relative z-10"></i>
                </div>
            </div>

            <div class="space-y-6">
                <div class="space-y-1">
                    <h2 class="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
                        Próxima
                    </h2>
                    <h2 class="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none text-white">
                        Generación
                    </h2>
                </div>
                
                <p class="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em] leading-relaxed max-w-[300px] mx-auto opacity-80">
                    Preparando salto a v${newVersion} • Estabilidad y Potencia garantizada
                </p>
            </div>

            <div class="space-y-4 max-w-[320px] mx-auto">
                <div class="relative w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/[0.03]">
                    <div id="update-progress-bar" class="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 w-0 transition-all duration-[2000ms] ease-out">
                         <div class="absolute right-0 top-0 bottom-0 w-8 bg-white blur-md opacity-40"></div>
                    </div>
                </div>
                
                <div class="flex justify-between items-center px-1">
                    <span id="update-status-text" class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sincronizando Núcleo...</span>
                    <span id="update-percent" class="text-[8px] font-black text-indigo-400 uppercase tracking-widest">0%</span>
                </div>
            </div>

            <div class="pt-10">
                <p class="text-[8px] font-black text-slate-700 uppercase tracking-[0.8em] animate-pulse">
                    XOLVY REVOLUTION • 2026
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Parallel background actions while showing the UI
    const startUpdateFlow = async () => {
        const bar = document.getElementById('update-progress-bar');
        const statusEl = document.getElementById('update-status-text');
        const percentEl = document.getElementById('update-percent');

        // Progress simulation
        let percent = 0;
        const pInterval = setInterval(() => {
            if (percent < 90) percent += 0.5; // Slow down near the end
            if (percentEl) percentEl.innerText = `${Math.floor(percent)}%`;
            if (bar) bar.style.width = `${percent}%`;
        }, 15);

        const currentMsg = (msg) => { if (statusEl) statusEl.innerText = msg; };

        try {
            currentMsg("Aislación de activos...");

            // 2. STAGE SERVICE WORKER: Force download of new assets
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let r of regs) {
                    if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
                    await r.update(); // Trigger check
                }
            }

            currentMsg("Compresión de datos...");
            await new Promise(r => setTimeout(r, 800));

            currentMsg("Inmortalizando sesión...");
            // Finalize simulation
            percent = 100;
            if (percentEl) percentEl.innerText = "100%";
            if (bar) bar.style.width = "100%";

            // 3. CLEANUP & RELOAD
            if (forceTimestamp) localStorage.setItem('last_force_timestamp', forceTimestamp.toString());

            setTimeout(() => {
                window.location.href = `${window.location.pathname}?updated=true&v=${Date.now()}`;
            }, 600);

        } catch (err) {
            console.error("Seamless update failed, falling back to hard refresh:", err);
            window.location.reload();
        }
    };

    setTimeout(startUpdateFlow, 300);
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
        const { db } = await import("../../firebase.js");
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        await updateDoc(doc(db, "configuracion", "version_control"), {
            latestVersion: APP_VERSION,
            forceTimestamp: Date.now(),
            forceUpdate: true
        });
        showNotification("¡Actualización Global Activada!", "success");
    } catch (err) {
        console.error("Broadcast error:", err);
        showNotification("Error al difundir versión", "error");
    }
};
