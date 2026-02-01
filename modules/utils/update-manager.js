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
    overlay.className = 'fixed inset-0 bg-slate-900/98 backdrop-blur-2xl z-[99999] flex items-center justify-center p-6 text-white';
    overlay.innerHTML = `
        <div class="max-w-md w-full text-center space-y-10 animate-fade-in">
            <div class="relative inline-block">
                <div class="w-32 h-32 bg-indigo-500/20 rounded-[3rem] flex items-center justify-center text-5xl shadow-2xl animate-pulse">
                    <i class="fas fa-sync-alt rotate-animation text-indigo-400"></i>
                </div>
                <div class="absolute -top-2 -right-2 bg-emerald-500 text-[10px] font-black px-3 py-1 rounded-full shadow-lg border-4 border-slate-900">
                    NUEVA VERSIÓN
                </div>
            </div>

            <div class="space-y-4">
                <h2 class="text-4xl font-black tracking-tighter uppercase tabular-nums">Optimizando Sistema</h2>
                <p class="text-slate-400 font-bold text-sm uppercase tracking-widest leading-relaxed">
                    Preparando la versión <span class="text-indigo-400 font-black">${newVersion}</span> para una mejor experiencia.
                </p>
            </div>

            <div class="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div id="update-progress-bar" class="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 w-0 transition-all duration-3000 ease-out"></div>
            </div>

            <p class="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] animate-pulse">Limpiando caché & reconstruyendo recursos</p>
        </div>
    `;

    document.body.appendChild(overlay);

    // Start Update Flow
    setTimeout(async () => {
        const bar = document.getElementById('update-progress-bar');
        if (bar) bar.style.width = '100%';

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
        const serverForceTimestamp = (await (await fetch(window.location.href)).headers.get('date')) || Date.now();
        localStorage.setItem('last_force_timestamp', serverForceTimestamp.toString());

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
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] w-[90%] max-w-sm animate-bounce-in';
    toast.innerHTML = `
        <div class="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-5 rounded-[2rem] shadow-2xl flex items-center gap-5">
            <div class="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-2xl text-indigo-400">
                <i class="fas fa-sparkles animate-pulse"></i>
            </div>
            <div class="flex-1">
                <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Mejora Disponible</h4>
                <p class="text-xs font-bold text-white uppercase tracking-tight">Versión ${newVersion} lista</p>
            </div>
            <button id="btn-update-soft" class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">
                Actualizar
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
