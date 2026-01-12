
import { showNotification } from './helpers.js?v=3.5.0';

let deferredPrompt = null;

export const initPWA = () => {
    // 1. Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        console.log("📲 PWA Install Trigger Captured");

        // Only show if not already standalone
        if (!isStandalone()) {
            ensureInstallUI();
        }
    });

    // 2. Listen for successful installation
    window.addEventListener('appinstalled', (e) => {
        console.log('✅ PWA Instalada con éxito');
        deferredPrompt = null;
        removeInstallUI();
        showNotification("¡Aplicación instalada con éxito!", "success");
    });

    // 3. Initial check
    if (!isStandalone()) {
        // We might not have deferredPrompt yet, so we wait or show a generic "how to install" if on iOS
        setTimeout(() => {
            if (!isStandalone()) {
                ensureInstallUI();
            }
        }, 3000);
    }

    // 4. Notification Request
    requestNotifications();
};

export const isStandalone = () => {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');
};

const ensureInstallUI = () => {
    let banner = document.getElementById('pwa-persistence-banner');
    if (banner) return;

    banner = document.createElement('div');
    banner.id = 'pwa-persistence-banner';
    banner.className = 'fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-96 glass-morphism p-6 rounded-[2rem] z-[100] border border-teal-500/30 animate-slide-up shadow-2xl';

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    banner.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center text-2xl animate-bounce">
                    📲
                </div>
                <div class="flex-1">
                    <h4 class="text-sm font-black dark:text-white uppercase tracking-tight">App no instalada</h4>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Para recibir notificaciones y trabajar offline</p>
                </div>
            </div>
            
            <div class="space-y-3">
                ${isIOS ? `
                    <div class="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                        En iOS: Toca el botón <strong>Compartir</strong> <span class="text-lg">⎋</span> y luego <strong>"Agregar a Inicio"</strong> <span class="text-lg">⊞</span>.
                    </div>
                ` : `
                    <button id="btn-pwa-main-install" class="w-full bg-teal-600 hover:bg-teal-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95">
                        Instalar Ahora
                    </button>
                `}
                
                <button id="btn-pwa-later" class="w-full py-2 text-[9px] font-black text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 uppercase tracking-widest transition-colors">
                    Continuar en el navegador (Limitado)
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(banner);

    const installBtn = document.getElementById('btn-pwa-main-install');
    if (installBtn) {
        installBtn.onclick = async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    removeInstallUI();
                }
                deferredPrompt = null;
            } else {
                showNotification("Busca la opción 'Instalar' en el menú de tu navegador.", "info");
            }
        };
    }

    document.getElementById('btn-pwa-later').onclick = () => {
        banner.remove();
    };
};

const removeInstallUI = () => {
    const banner = document.getElementById('pwa-persistence-banner');
    if (banner) banner.remove();
};

export const requestNotifications = async () => {
    if (!("Notification" in window)) {
        console.log("Este navegador no soporta notificaciones.");
        return;
    }

    if (Notification.permission === 'granted') return;

    if (Notification.permission === 'denied') {
        // Only show if we haven't shown the "denied" warning this session
        if (!sessionStorage.getItem('pwa_notif_denied_warned')) {
            showNotification("Las notificaciones están bloqueadas. Actívalas en la configuración de tu navegador para estar al día.", "warning");
            sessionStorage.setItem('pwa_notif_denied_warned', 'true');
        }
        return;
    }

    // If default, show rationale
    showNotificationRationale();
};

const showNotificationRationale = () => {
    let rationale = document.getElementById('notification-rationale');
    if (rationale) return;

    rationale = document.createElement('div');
    rationale.id = 'notification-rationale';
    rationale.className = 'fixed top-20 left-4 right-4 md:left-auto md:right-8 md:w-96 glass-morphism p-6 rounded-[2rem] z-[110] border border-blue-500/30 animate-fade-in shadow-2xl';

    rationale.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-2xl animate-pulse">
                    🔔
                </div>
                <div class="flex-1">
                    <h4 class="text-sm font-black dark:text-white uppercase tracking-tight">Activar Notificaciones</h4>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Para recibir recordatorios de tus territorios</p>
                </div>
            </div>
            
            <div class="flex gap-2">
                <button id="btn-notif-grant" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">
                    Permitir
                </button>
                <button id="btn-notif-ignore" class="px-4 py-3 text-[10px] font-black text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 uppercase tracking-widest transition-colors">
                    Ahora no
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(rationale);

    document.getElementById('btn-notif-grant').onclick = async () => {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showNotification("¡Notificaciones activadas!", "success");
            const registration = await navigator.serviceWorker.ready;
            // Optionally subscribe to push here if needed
        }
        rationale.remove();
    };

    document.getElementById('btn-notif-ignore').onclick = () => {
        rationale.remove();
    };
};
