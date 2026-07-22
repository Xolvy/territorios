/**
 * @file modules/services/pwa-install-prompt.js
 * @description PWA Install Prompt Service - Banner/Modal Inteligente de Instalación 1-Clic
 */

import { DynamicIslandHUD } from "./dynamic-island-hud.js";

let deferredPrompt = null;

export const initPWAInstallPrompt = () => {
    window.addEventListener("beforeinstallprompt", (e) => {
        // Prevent default mini-infobar on mobile
        e.preventDefault();
        deferredPrompt = e;

        console.log("📲 [PWA] Evento beforeinstallprompt capturado.");

        // Show Dynamic Island Notification for PWA installation
        const hud = DynamicIslandHUD.init();
        hud.show({
            title: "Instalar App Territorios",
            subtitle: "Toca para añadir a pantalla de inicio",
            icon: "fa-download",
            color: "purple",
            duration: 8000,
            onClick: () => triggerPWAInstall(),
        });

        renderInstallBanner();
    });

    // Handle App Installed Event
    window.addEventListener("appinstalled", () => {
        console.log("🎉 [PWA] Aplicación instalada exitosamente.");
        deferredPrompt = null;
        const banner = document.getElementById("pwa-install-banner");
        if (banner) banner.remove();

        const hud = DynamicIslandHUD.init();
        hud.show({
            title: "App Instalada",
            subtitle: "Acceso rápido activado",
            icon: "fa-circle-check",
            color: "emerald",
            duration: 4000,
        });
    });
};

export const triggerPWAInstall = async () => {
    if (!deferredPrompt) {
        // Fallback info for iOS / Safari
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            window.XolvyAlert.fire({
                title: "Instalar en iOS",
                html: `
                    <div class="text-left space-y-3 p-2 text-slate-700 dark:text-slate-200">
                        <p class="text-xs font-medium">Para instalar la app en tu iPhone o iPad:</p>
                        <ol class="list-decimal list-inside text-xs font-bold space-y-1.5 text-indigo-600 dark:text-indigo-400">
                            <li>Presiona el botón <span class="uppercase">Compartir</span> <i class="fas fa-share-square"></i> en Safari.</li>
                            <li>Selecciona <span class="uppercase">"Agregar a inicio"</span> <i class="fas fa-plus-square"></i>.</li>
                        </ol>
                    </div>
                `,
                confirmButtonText: "Entendido",
                confirmButtonColor: "#4f46e5",
            });
        }
        return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`📲 [PWA] Respuesta del usuario: ${outcome}`);
    deferredPrompt = null;
};

const renderInstallBanner = () => {
    if (document.getElementById("pwa-install-banner")) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return; // Already installed

    const banner = document.createElement("div");
    banner.id = "pwa-install-banner";
    banner.className =
        "fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[10000] p-4 bg-white/90 dark:bg-slate-900/90 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl backdrop-blur-2xl animate-fade-in flex items-center justify-between gap-3";
    
    // Bottom padding supporting Samsung NowBar & gesture insets
    banner.style.bottom = "calc(1rem + env(safe-area-inset-bottom, 0px))";

    banner.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white text-lg shrink-0 shadow-md">
                <i class="fas fa-mobile-alt"></i>
            </div>
            <div class="min-w-0">
                <h4 class="font-black text-xs text-slate-800 dark:text-white uppercase tracking-tight truncate">Instala la App</h4>
                <p class="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Uso offline & rápida</p>
            </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            <button id="btn-pwa-close" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <i class="fas fa-times text-xs"></i>
            </button>
            <button id="btn-pwa-install-action" class="py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md transition-transform active:scale-95">
                Instalar
            </button>
        </div>
    `;

    document.body.appendChild(banner);

    banner.querySelector("#btn-pwa-close").onclick = () => banner.remove();
    banner.querySelector("#btn-pwa-install-action").onclick = () => triggerPWAInstall();
};

window.triggerPWAInstall = triggerPWAInstall;
