import { showNotification } from "./helpers.js";

let deferredPrompt = window.deferredPWAPrompt || null;
let newWorker = null;

// Listen for the global catch
window.addEventListener("pwa-prompt-ready", () => {
    deferredPrompt = window.deferredPWAPrompt;
    console.log("📍 PWA: Manager synchronized with Global Prompt");
});

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.deferredPWAPrompt = e;
    console.log("📲 PWA: Install Opportunity Detected");
});

/**
 * INITIALIZE PWA ENGINE
 */
export const initPWA = () => {
    console.log("🚀 PWA Super-Engine Initializing...");

    // 1. Update Detection Logic
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
            if (!reg) return;

            // Check for updates periodically
            setInterval(() => reg.update(), 1000 * 60 * 60); // Every hour

            reg.addEventListener("updatefound", () => {
                newWorker = reg.installing;
                newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        showUpdateBanner();
                    }
                });
            });
        });

        // Handle refresh when new SW takes over
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (!refreshing) {
                window.location.reload();
                refreshing = true;
            }
        });
    }

    // 2. Install Logic
    window.addEventListener("appinstalled", (_e) => {
        console.log("✨ PWA: Application installed successfully");
        localStorage.setItem("pwa_installed", "true");
        removeInstallUI();
        showNotification("¡Bienvenido a Gestión de Territorios!", "success");
    });

    // 3. Initial UI Check
    setTimeout(triggerUI, 4000);

    // 4. Badging Support (Power Up)
    updateAppBadge(0);

    // 5. Notifications
    setTimeout(requestNotifications, 10000);
};

const triggerUI = () => {
    if (isStandalone() || sessionStorage.getItem("pwa_banner_dismissed") || localStorage.getItem("pwa_installed")) {
        return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const hasPrompt = !!(deferredPrompt || window.deferredPWAPrompt);

    if (hasPrompt || isIOS) {
        ensureInstallUI();
    }
};

/**
 * SHOW UPDATE TOAST
 */
const showUpdateBanner = () => {
    const toast = document.createElement("div");
    toast.id = "pwa-update-toast";
    toast.className =
        "fixed top-32 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[380px] z-[10001] animate-bounce-in";
    toast.innerHTML = `
        <div class="modern-card bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-white p-4.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-emerald-500/15 backdrop-blur-xl">
            <div class="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 text-base shrink-0">
                <i class="fas fa-rocket animate-pulse"></i>
            </div>
            <div class="flex-1 min-w-0 flex flex-col">
                <h4 class="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mb-0.5">Nueva Versión</h4>
                <p class="text-[11px] font-medium text-slate-550 dark:text-slate-400 normal-case tracking-wide leading-tight">Actualización lista para instalar</p>
            </div>
            <button id="btn-pwa-update-now" class="bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold normal-case tracking-wide shadow-md shadow-emerald-600/15 transition-all active:scale-95 shrink-0 cursor-pointer">
                Actualizar
            </button>
        </div>
    `;
    document.body.appendChild(toast);

    document.getElementById("btn-pwa-update-now").onclick = () => {
        if (newWorker) newWorker.postMessage({ type: "SKIP_WAITING" });
    };
};

export const isStandalone = () => {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone ||
        document.referrer.includes("android-app://")
    );
};

const getOrCreateBottomHUD = () => {
    const hudId = "xolvy-bottom-hud";
    let hud = document.getElementById(hudId);
    if (!hud) {
        hud = document.createElement("div");
        hud.id = hudId;
        hud.className = "fixed bottom-24 left-4 right-4 md:bottom-12 md:left-auto md:right-8 md:w-[320px] sm:w-[360px] z-[10000] flex flex-col gap-4 pointer-events-none";
        document.body.appendChild(hud);
    }
    return hud;
};

const ensureInstallUI = () => {
    let banner = document.getElementById("pwa-persistence-banner");
    if (banner || isStandalone()) return;

    const hud = getOrCreateBottomHUD();

    banner = document.createElement("div");
    banner.id = "pwa-persistence-banner";
    banner.className =
        "w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 rounded-2xl border border-teal-500/20 animate-bounce-in shadow-[0_20px_40px_-5px_rgba(13,148,136,0.1)] dark:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.45)] pointer-events-auto";

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    banner.innerHTML = `
        <div class="flex flex-col gap-3.5">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-teal-500/10 dark:bg-teal-500/20 rounded-xl flex items-center justify-center shadow-inner group relative shrink-0">
                    <img src="/icon-192.png" class="w-7 h-7 rounded-lg transition-transform group-hover:scale-110" alt="App Icon">
                    <div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal-500 rounded-full border-2 border-white dark:border-slate-950 animate-pulse"></div>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-slate-800 dark:text-white tracking-wide leading-tight">Gestión de Territorios</h4>
                    <p class="text-[9px] text-slate-500 dark:text-slate-400 font-medium normal-case tracking-wide leading-none mt-1">Uso offline y notificaciones</p>
                </div>
            </div>
            
            <div class="space-y-2">
                ${
                    isIOS
                        ? `
                    <div class="p-3 bg-teal-500/5 rounded-xl border border-teal-500/10 text-[9px] text-teal-750 dark:text-teal-400 font-medium normal-case leading-relaxed">
                        En iOS: Toca compartir <i class="fa-solid fa-share-from-square mx-1"></i> y selecciona <br>
                        <span class="text-teal-650 dark:text-teal-300 font-bold">"Agregar a Pantalla de Inicio" <i class="fa-solid fa-plus-square ml-1"></i></span>
                    </div>
                `
                        : `
                    <button id="btn-pwa-main-install" class="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white py-2.5 rounded-xl text-[10px] font-bold normal-case tracking-wide shadow-lg shadow-teal-600/15 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
                        <i class="fas fa-rocket text-[10px]"></i> Instalar aplicación
                    </button>
                `
                }
                
                <button id="btn-pwa-later" class="w-full py-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-400 normal-case tracking-wide transition-colors cursor-pointer">
                    Continuar en el navegador
                </button>
            </div>
        </div>
    `;

    hud.appendChild(banner);

    const installBtn = document.getElementById("btn-pwa-main-install");
    if (installBtn) {
        installBtn.onclick = async () => {
            const prompt = deferredPrompt || window.deferredPWAPrompt;
            if (prompt) {
                try {
                    prompt.prompt();
                    const { outcome } = await prompt.userChoice;
                    if (outcome === "accepted") {
                        localStorage.setItem("pwa_installed", "true");
                        removeInstallUI();
                    }
                } catch (err) {
                    console.error("❌ PWA: Error:", err);
                }
            } else {
                showNotification("Usa el menú del navegador para instalar.", "info");
            }
        };
    }

    document.getElementById("btn-pwa-later").onclick = () => {
        sessionStorage.setItem("pwa_banner_dismissed", "true");
        removeInstallUI();
    };
};

const removeInstallUI = () => {
    const banner = document.getElementById("pwa-persistence-banner");
    if (banner) {
        banner.classList.add("animate-fade-out");
        setTimeout(() => banner.remove(), 500);
    }
};

/**
 * APP BADGING API (Power Up)
 */
export const updateAppBadge = (count) => {
    if ("setAppBadge" in navigator) {
        if (count > 0) {
            navigator.setAppBadge(count).catch((e) => console.error("Badge error:", e));
        } else {
            navigator.clearAppBadge().catch((e) => console.error("Badge error:", e));
        }
    }
};

export const requestNotifications = async () => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        syncFCMToken();
        return;
    }

    if (Notification.permission === "denied") return;

    showNotificationRationale();
};

const syncFCMToken = async () => {
    try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { db, app } = await import("../../firebase-config.js");

        const configSnap = await getDoc(doc(db, "configuracion", "general"));
        const fcmVapidKey = configSnap.exists() ? configSnap.data().fcm_vapid_key : null;

        if (!fcmVapidKey) {
            console.log("⚠️ FCM: No fcm_vapid_key found in General Config. Push subscription skipped.");
            return;
        }

        const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
        const { httpsCallable } = await import("firebase/functions");
        const { functions } = await import("../../firebase-config.js");

        const messaging = getMessaging(app);

        const token = await getToken(messaging, { vapidKey: fcmVapidKey });
        if (token) {
            const registrarToken = httpsCallable(functions, "registrarTokenFCM");
            await registrarToken({ token });
            console.log("📌 FCM Token successfully registered and subscribed.");

            // Listen for foreground notifications
            onMessage(messaging, (payload) => {
                console.log("🔔 FCM: Foreground push received:", payload);
                const { title, body } = payload.notification || {};
                showNotification(`${title || "Aviso"}: ${body || ""}`, "info");
            });
        }
    } catch (err) {
        console.warn("❌ FCM Sync Error:", err);
    }
};

const showNotificationRationale = () => {
    let rationale = document.getElementById("notification-rationale");
    if (rationale) return;

    const hud = getOrCreateBottomHUD();

    rationale = document.createElement("div");
    rationale.id = "notification-rationale";
    rationale.className =
        "w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5.5 rounded-3xl border border-blue-500/15 animate-bounce-in shadow-[0_25px_60px_rgba(59,130,246,0.12)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] pointer-events-auto";

    rationale.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3.5">
                <div class="w-12 h-12 bg-blue-500/10 dark:bg-blue-500/20 rounded-2xl flex items-center justify-center text-base text-blue-600 dark:text-blue-400 shadow-inner animate-pulse shrink-0">
                    <i class="fas fa-bell"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-bold text-slate-800 dark:text-white tracking-wide leading-tight">Activar avisos</h4>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 font-medium normal-case tracking-wide leading-none mt-1">Recibe alertas y recordatorios importantes</p>
                </div>
            </div>
            <div class="flex gap-2.5 mt-2">
                <button id="btn-notif-grant" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-[10px] font-bold normal-case tracking-wide shadow-md shadow-blue-600/15 transition-all active:scale-95 cursor-pointer">Permitir</button>
                <button id="btn-notif-ignore" class="px-4 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-400 normal-case tracking-wide transition-colors cursor-pointer">Luego</button>
            </div>
        </div>
    `;

    hud.appendChild(rationale);

    document.getElementById("btn-notif-grant").onclick = async () => {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            showNotification("¡Notificaciones activadas!", "success");
            syncFCMToken();
        }
        rationale.remove();
    };

    document.getElementById("btn-notif-ignore").onclick = () => rationale.remove();
};
