import { showNotification } from './helpers.js?v=1.9.8';

let deferredPrompt = window.deferredPWAPrompt || null;
let newWorker = null;

// Listen for the global catch
window.addEventListener('pwa-prompt-ready', () => {
    deferredPrompt = window.deferredPWAPrompt;
    console.log("📍 PWA: Manager synchronized with Global Prompt");
});

window.addEventListener('beforeinstallprompt', (e) => {
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
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (!reg) return;

            // Check for updates periodically
            setInterval(() => reg.update(), 1000 * 60 * 60); // Every hour

            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateBanner();
                    }
                });
            });
        });

        // Handle refresh when new SW takes over
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                window.location.reload();
                refreshing = true;
            }
        });
    }

    // 2. Install Logic
    window.addEventListener('appinstalled', (e) => {
        console.log('✨ PWA: Application installed successfully');
        localStorage.setItem('pwa_installed', 'true');
        removeInstallUI();
        showNotification("¡Bienvenido a la experiencia nativa de Xolu!", "success");
    });

    // 3. Initial UI Check
    setTimeout(triggerUI, 4000);

    // 4. Badging Support (Power Up)
    updateAppBadge(0);

    // 5. Notifications
    setTimeout(requestNotifications, 10000);
};

const triggerUI = () => {
    if (isStandalone() || sessionStorage.getItem('pwa_banner_dismissed') || localStorage.getItem('pwa_installed')) {
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
    const toast = document.createElement('div');
    toast.id = 'pwa-update-toast';
    toast.className = 'fixed top-24 left-1/2 -translate-x-1/2 z-[10001] animate-bounce-in';
    toast.innerHTML = `
        <div class="glass-morphism bg-teal-600/90 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/20 backdrop-blur-xl">
            <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🚀</div>
            <div>
                <h4 class="text-[10px] font-black uppercase tracking-[0.2em]">Nueva Versión</h4>
                <p class="text-[9px] font-bold opacity-80 uppercase tracking-wider">Actualización lista para instalar</p>
            </div>
            <button id="btn-pwa-update-now" class="bg-white text-teal-700 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tight hover:bg-teal-50 transition-colors shadow-lg active:scale-95">
                Actualizar
            </button>
        </div>
    `;
    document.body.appendChild(toast);

    document.getElementById('btn-pwa-update-now').onclick = () => {
        if (newWorker) newWorker.postMessage({ type: 'SKIP_WAITING' });
    };
};

export const isStandalone = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://');
};

const ensureInstallUI = () => {
    let banner = document.getElementById('pwa-persistence-banner');
    if (banner || isStandalone()) return;

    banner = document.createElement('div');
    banner.id = 'pwa-persistence-banner';
    banner.className = 'fixed bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-[380px] glass-morphism p-6 rounded-[2.5rem] z-[1000] border border-teal-500/30 animate-bounce-in shadow-[0_20px_50px_rgba(13,148,136,0.3)] dark:shadow-none';

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    banner.innerHTML = `
        <div class="flex flex-col gap-5">
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 bg-teal-500/10 dark:bg-teal-500/20 rounded-2xl flex items-center justify-center text-3xl shadow-inner group relative">
                    <img src="/icon-192.svg" class="w-10 h-10 rounded-xl transition-transform group-hover:scale-110" alt="App Icon">
                    <div class="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></div>
                </div>
                <div class="flex-1">
                    <h4 class="text-sm font-black dark:text-white uppercase tracking-tight">Xolu Premium</h4>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">Uso Offline & Notificaciones</p>
                </div>
            </div>
            
            <div class="space-y-3">
                ${isIOS ? `
                    <div class="p-4 bg-teal-500/5 rounded-2xl border border-teal-500/10 text-[11px] text-teal-700 dark:text-teal-400 font-bold uppercase tracking-tight leading-relaxed">
                        En iOS: Toca <i class="fa-solid fa-share-from-square mx-1"></i> y luego <br>
                        <span class="text-teal-600 dark:text-teal-300">"Agregar a Pantalla de Inicio" <i class="fa-solid fa-plus-square ml-1"></i></span>
                    </div>
                ` : `
                    <button id="btn-pwa-main-install" class="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-teal-600/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-rocket animate-pulse"></i> Instalar Ahora
                    </button>
                `}
                
                <button id="btn-pwa-later" class="w-full py-2 text-[10px] font-black text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 uppercase tracking-[0.15em] transition-colors">
                    Continuar en el navegador
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(banner);

    const installBtn = document.getElementById('btn-pwa-main-install');
    if (installBtn) {
        installBtn.onclick = async () => {
            const prompt = deferredPrompt || window.deferredPWAPrompt;
            if (prompt) {
                try {
                    prompt.prompt();
                    const { outcome } = await prompt.userChoice;
                    if (outcome === 'accepted') {
                        localStorage.setItem('pwa_installed', 'true');
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

    document.getElementById('btn-pwa-later').onclick = () => {
        sessionStorage.setItem('pwa_banner_dismissed', 'true');
        removeInstallUI();
    };
};

const removeInstallUI = () => {
    const banner = document.getElementById('pwa-persistence-banner');
    if (banner) {
        banner.classList.add('animate-fade-out');
        setTimeout(() => banner.remove(), 500);
    }
};

/**
 * APP BADGING API (Power Up)
 */
export const updateAppBadge = (count) => {
    if ('setAppBadge' in navigator) {
        if (count > 0) {
            navigator.setAppBadge(count).catch(e => console.error("Badge error:", e));
        } else {
            navigator.clearAppBadge().catch(e => console.error("Badge error:", e));
        }
    }
};

export const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;

    showNotificationRationale();
};

const showNotificationRationale = () => {
    let rationale = document.getElementById('notification-rationale');
    if (rationale) return;

    rationale = document.createElement('div');
    rationale.id = 'notification-rationale';
    rationale.className = 'fixed top-28 left-4 right-4 md:left-auto md:right-8 md:w-96 glass-morphism p-6 rounded-[2.5rem] z-[110] border border-blue-500/30 animate-bounce-in shadow-2xl';

    rationale.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-2xl animate-pulse">🔔</div>
                <div class="flex-1">
                    <h4 class="text-xs font-black dark:text-white uppercase tracking-tight">Activar Avisos</h4>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Para recordatorios de territorios</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button id="btn-notif-grant" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">Permitir</button>
                <button id="btn-notif-ignore" class="px-4 py-3 text-[10px] font-black text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 uppercase tracking-widest transition-colors">Luego</button>
            </div>
        </div>
    `;

    document.body.appendChild(rationale);

    document.getElementById('btn-notif-grant').onclick = async () => {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') showNotification("¡Notificaciones activadas!", "success");
        rationale.remove();
    };

    document.getElementById('btn-notif-ignore').onclick = () => rationale.remove();
};
