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
        const versionMismatch = serverVersion !== APP_VERSION;
        const forceRequired = serverForceTimestamp > localForceTimestamp;

        if (versionMismatch || forceRequired) {
            if (data.forceUpdate) {
                showPremiumUpdateOverlay(serverVersion);
            } else {
                showUpdateSuggestion(serverVersion);
            }
        }
    });

    // 3. Telemetry: If I'm an Admin, I should verify if my version is the "latest"
    // This is optional but helps keep the Firestore doc in sync
};

const showPremiumUpdateOverlay = (newVersion) => {
    if (document.getElementById('premium-update-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'premium-update-overlay';
    // Deep dark background with high blur
    overlay.className = 'fixed inset-0 bg-[#020617] backdrop-blur-[100px] z-[99999] flex items-center justify-center p-6 text-white overflow-hidden';

    // Add some animated background blobs for that mesh gradient look
    overlay.innerHTML = `
        <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] animate-pulse" style="animation-delay: 2s"></div>
        
        <div class="max-w-md w-full text-center space-y-12 animate-slide-up relative z-10">
            <div class="relative inline-block group">
                <!-- Outer Glow -->
                <div class="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-125 transition-transform duration-1000"></div>
                
                <!-- Main Icon Container -->
                <div class="relative w-28 h-28 bg-white/[0.03] backdrop-blur-md rounded-[2.5rem] border border-white/10 flex items-center justify-center text-4xl shadow-2xl overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent"></div>
                    <i class="fas fa-sync-alt text-indigo-400 rotate-animation relative z-10"></i>
                </div>
                
                <!-- Version Badge -->
                <div class="absolute -top-3 -right-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-[9px] font-black px-4 py-1.5 rounded-full shadow-2xl border-4 border-[#020617] transform rotate-12">
                    V${newVersion}
                </div>
            </div>

            <div class="space-y-6">
                <div class="space-y-1">
                    <h2 class="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
                        Optimizando
                    </h2>
                    <h2 class="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none text-white">
                        Sistema
                    </h2>
                </div>
                
                <p class="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em] leading-relaxed max-w-[300px] mx-auto opacity-80">
                    Sincronizando últimas mejoras y reconstruyendo recursos...
                </p>
            </div>

            <div class="space-y-4 max-w-[320px] mx-auto">
                <div class="relative w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/[0.03]">
                    <div id="update-progress-bar" class="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 w-0 transition-all duration-[3000ms] ease-in-out">
                         <div class="absolute right-0 top-0 bottom-0 w-8 bg-white blur-md opacity-40"></div>
                    </div>
                </div>
                
                <div class="flex justify-between items-center px-1">
                    <span id="update-status-text" class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Iniciando...</span>
                    <span id="update-percent" class="text-[8px] font-black text-indigo-400 uppercase tracking-widest">0%</span>
                </div>
            </div>

            <div class="pt-10">
                <p class="text-[8px] font-black text-slate-700 uppercase tracking-[0.8em] animate-pulse">
                    XOLU ENGINE • 2026
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Start Update Flow
    setTimeout(async () => {
        const bar = document.getElementById('update-progress-bar');
        const statusEl = document.getElementById('update-status-text');
        const percentEl = document.getElementById('update-percent');

        if (bar) bar.style.width = '100%';

        // Progress percentage simulation
        let percent = 0;
        const pInterval = setInterval(() => {
            percent += 1;
            if (percentEl) percentEl.innerText = `${percent}%`;
            if (percent >= 100) clearInterval(pInterval);
        }, 30);

        // Status messages simulation
        const messages = [
            "Limpiando caché local...",
            "Inyectando nuevos parches...",
            "Reconstruyendo motor...",
            "Validando integridad...",
            "Optimizando datos...",
            "Finalizando..."
        ];
        let msgIdx = 0;
        const mInterval = setInterval(() => {
            if (statusEl && msgIdx < messages.length) {
                statusEl.innerText = messages[msgIdx++];
            } else {
                clearInterval(mInterval);
            }
        }, 500);

        // 1. Purge Service Workers
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (let r of regs) await r.unregister();
        }

        // 2. Clear Caches
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }

        // 3. Mark timestamp to prevent loop
        const serverForceTimestamp = (await (await fetch(window.location.href, { cache: 'no-store' })).headers.get('date')) || Date.now();
        localStorage.setItem('last_force_timestamp', new Date(serverForceTimestamp).getTime().toString());

        // 4. Reload
        setTimeout(() => {
            window.location.href = `${window.location.pathname}?updated=true&v=${Date.now()}`;
        }, 3500);
    }, 500);
};

const showUpdateSuggestion = (newVersion) => {
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
    document.getElementById('btn-update-soft').onclick = () => showPremiumUpdateOverlay(newVersion);
};

/**
 * ADMIN ONLY: Utility to broadcast the current version as the latest
 */
export const broadcastCurrentVersion = async () => {
    try {
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
