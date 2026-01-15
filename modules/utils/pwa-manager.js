
import { showNotification } from './helpers.js?v=1.9.5.2';

let deferredPrompt = window.deferredPWAPrompt || null;

// Listen for the global catch in case it happened before this module loaded
window.addEventListener('pwa-prompt-ready', () => {
    deferredPrompt = window.deferredPWAPrompt;
    console.log("📍 PWA: Manager synchronized with Global Prompt");
    // If the module is already initialized, we might want to show the UI
    const triggerUI = () => {
        if (!isStandalone() && !sessionStorage.getItem('pwa_banner_dismissed')) {
            ensureInstallUI();
        }
    };
    triggerUI();
});

// Also keep the local listener just in case
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.deferredPWAPrompt = e;
    console.log("📲 PWA: Install Opportunity Detected (Local catch)");
});

export const initPWA = () => {
    console.log("🛠️ PWA Engine Initializing...");

    // 2. Listen for successful installation
    window.addEventListener('appinstalled', (e) => {
        console.log('✅ PWA: Application installed successfully');
        deferredPrompt = null;
        window.deferredPWAPrompt = null;
        localStorage.setItem('pwa_installed', 'true');
        removeInstallUI();
        showNotification("¡Aplicación instalada con éxito! Ya puedes abrirla desde tu pantalla de inicio.", "success");
    });

    // 3. Initial check and UI Logic
    const triggerUI = () => {
        // If already in standalone mode, dismissed in session, or recorded as installed -> exit
        if (isStandalone() ||
            sessionStorage.getItem('pwa_banner_dismissed') ||
            localStorage.getItem('pwa_installed')) {
            return;
        }

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const hasPrompt = !!(deferredPrompt || window.deferredPWAPrompt);

        // Only show if we have an actual prompt or if it's iOS (manual instructions)
        if (hasPrompt || isIOS) {
            ensureInstallUI();
        } else {
            console.log("ℹ️ PWA: Banner skipped (No prompt available and not iOS)");
        }
    };

    // Check availability with a slight delay to allow events to fire
    setTimeout(triggerUI, 3000);

    // 4. Notification Request (Wait a bit more for UX)
    setTimeout(requestNotifications, 8000);
};

export const isStandalone = () => {
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://');

    // Check for Chrome's "Installed" state via window.clientInformation
    const isChromeInstalled = window.clientInformation?.managed === false &&
        /Chrome/.test(navigator.userAgent) &&
        window.matchMedia('(display-mode: standalone)').matches;

    return isStandaloneMode || isChromeInstalled;
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
                <div class="w-14 h-14 bg-teal-500/10 dark:bg-teal-500/20 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                    <img src="/icon-192.svg" class="w-10 h-10 rounded-xl" alt="App Icon">
                </div>
                <div class="flex-1">
                    <h4 class="text-sm font-black dark:text-white uppercase tracking-tight">Experiencia Completa</h4>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">Instala para usar offline y recibir avisos</p>
                </div>
            </div>
            
            <div class="space-y-3">
                ${isIOS ? `
                    <div class="p-4 bg-teal-500/5 rounded-2xl border border-teal-500/10 text-[11px] text-teal-700 dark:text-teal-400 font-bold uppercase tracking-tight leading-relaxed">
                        En iOS: Toca <i class="fa-solid fa-share-from-square mx-1"></i> y luego <br>
                        <span class="text-teal-600 dark:text-teal-300">"Agregar a Pantalla de Inicio" <i class="fa-solid fa-plus-square ml-1"></i></span>
                    </div>
                ` : `
                    <button id="btn-pwa-main-install" class="w-full bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-teal-600/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-download"></i> Instalar Ahora
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
            // Check global or local
            const prompt = deferredPrompt || window.deferredPWAPrompt;

            if (prompt) {
                try {
                    prompt.prompt();
                    const { outcome } = await prompt.userChoice;
                    console.log(`📡 PWA: Install user choice: ${outcome}`);
                    if (outcome === 'accepted') {
                        localStorage.setItem('pwa_installed', 'true');
                        removeInstallUI();
                        deferredPrompt = null;
                        window.deferredPWAPrompt = null;
                    }
                } catch (err) {
                    console.error("❌ PWA: Error during prompt:", err);
                    showNotification("Hubo un problema al abrir el instalador. Intenta desde el menú del navegador.", "warning");
                }
            } else {
                showNotification("Busca la opción 'Instalar Aplicación' en el menú de los 3 puntos de tu navegador.", "info");
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
