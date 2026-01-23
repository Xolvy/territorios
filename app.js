import './modules/extensions.mjs';
import { auth, db } from './firebase-config.js?v=2.2.5';
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
// Main modules are now lazy-loaded
// import { renderLogin } from './modules/login.js?v=2.0.1';
// import { renderAdminDashboard } from './modules/admin-dashboard.js?v=2.0.1';
// import { renderConductorDashboard } from './modules/conductor-dashboard.js?v=2.0.1';
import { getPermisosUsuario, getSystemVersion, migrateConductoresToPublicadores } from './data/firestore-services.js?v=2.2.5';
import { showNotification } from './modules/utils/helpers.js?v=2.2.5';
import { initTheme, createThemeToggle } from './modules/utils/theme-manager.js?v=2.2.5';
import { initPWA } from './modules/utils/pwa-manager.js?v=2.2.5';

// Global Module Cache for performance
const ModuleCache = {
    login: null,
    admin: null,
    conductor: null
};

async function loadLogin() {
    if (!ModuleCache.login) ModuleCache.login = await import('./modules/login.js?v=2.2.5');
    return ModuleCache.login.renderLogin;
}

async function loadAdmin() {
    if (!ModuleCache.admin) ModuleCache.admin = await import('./modules/admin-dashboard.js?v=2.2.5');
    return ModuleCache.admin.renderAdminDashboard;
}

async function loadConductor() {
    if (!ModuleCache.conductor) ModuleCache.conductor = await import('./modules/conductor-dashboard.js?v=2.2.5');
    return ModuleCache.conductor.renderConductorDashboard;
}

// Init Theme
initTheme();
document.body.appendChild(createThemeToggle());

// Init PWA & Notifications
initPWA();

const APP_VERSION = '2.2.5';

// --- PWA INITIALIZATION ---

// --- SUCCESS CONFIRMATION AFTER UPDATE ---
const checkUpdateSuccess = () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('updated') === 'true') {
        setTimeout(() => {
            showNotification(`✅ ¡Aplicación actualizada con éxito a la v${APP_VERSION}!`, "success");
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 1500);
    }
};
checkUpdateSuccess();

// --- REAL-TIME VERSION CHECK & FORCED UPDATE ---
const initVersionCheck = (currentVersion) => {
    onSnapshot(doc(db, "configuracion", "version_control"), async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const serverVersion = data.latestVersion;
            const serverForceTimestamp = data.forceTimestamp || 0;
            const localForceTimestamp = parseInt(localStorage.getItem('last_force_timestamp') || '0');

            const isNewVersion = serverVersion && serverVersion !== currentVersion;
            const isForcedAction = serverForceTimestamp && serverForceTimestamp !== localForceTimestamp;

            if ((isNewVersion || isForcedAction) && data.forceUpdate) {
                // Prevenir bucles infinitos
                const urlParams = new URLSearchParams(window.location.search);
                const currentV = urlParams.get('v');
                if (currentV && (Date.now() - parseInt(currentV)) < 5000) {
                    console.log("⏳ Sistema estabilizándose...");
                    return;
                }

                console.warn(`🚀 Iniciando actualización forzada: ${currentVersion} -> ${serverVersion} (Reason: ${isNewVersion ? 'New Version' : 'Force Signal'})`);

                const overlay = document.createElement('div');
                overlay.className = 'version-modal-overlay';
                overlay.innerHTML = `
                    <div class="version-modal-content animate-scale-in">
                        <div class="mb-6 flex justify-center">
                            <div class="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center text-3xl animate-bounce">
                                🚀
                            </div>
                        </div>
                        <h2>Actualización Obligatoria</h2>
                        <p>Estamos sincronizando la última versión de los archivos para asegurar la estabilidad del sistema.</p>
                        <div class="version-modal-timer">
                            Limpiando memoria y archivos temporales...
                        </div>
                        <div class="flex justify-center">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);

                // 1. Service Workers Unregister
                if ('serviceWorker' in navigator) {
                    try {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (let registration of registrations) {
                            await registration.unregister();
                        }
                    } catch (e) { console.error("SW error:", e); }
                }

                // 2. Clear Caches
                if ('caches' in window) {
                    try {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(key => caches.delete(key)));
                    } catch (e) { console.error("Cache error:", e); }
                }

                // 3. Store the timestamp to prevent looping
                localStorage.setItem('last_force_timestamp', serverForceTimestamp.toString());
                localStorage.removeItem('app_version');

                // 4. Reload forcefully
                setTimeout(() => {
                    const v = Date.now();
                    window.location.href = `${window.location.pathname}?updated=true&v=${v}`;
                }, 1500);
            }
        }
    });
};

// Start listener
initVersionCheck(APP_VERSION);

// --- DIFFUSION LISTENER ---
const initDiffusionListener = () => {
    // Inject Power Up Styles
    const style = document.createElement('style');
    style.textContent = `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        .custom-scrollbar-horizontal::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar-horizontal::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar-horizontal::-webkit-scrollbar-thumb { background: rgba(20, 184, 166, 0.2); border-radius: 10px; }

        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        
        @keyframes pulse-slow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }

        @keyframes bounce-in { 0% { transform: translateY(50px); opacity: 0; } 60% { transform: translateY(-5px); opacity: 1; } 100% { transform: translateY(0); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .label-premium { font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.2em; display: block; margin-bottom: 0.5rem; }
        .input-premium { width: 100%; background: rgba(255,255,255,0.03); border: 1px border rgba(255,255,255,0.1); border-radius: 1rem; padding: 1rem; color: white; outline: none; transition: all 0.3s; }
        .input-premium:focus { border-color: #6366f1; background: rgba(255,255,255,0.05); }
    `;
    document.head.appendChild(style);

    onSnapshot(doc(db, "configuracion", "diffusion_active"), (docSnap) => {
        let banner = document.getElementById('global-diffusion-banner');

        if (docSnap.exists() && docSnap.data().active) {
            const data = docSnap.data();
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'global-diffusion-banner';
                // Add to top of body
                document.body.prepend(banner);
            }

            const bgColor = data.type === 'urgent' ? 'from-red-600 to-red-800' : 'from-blue-600 to-blue-800';
            const icon = data.type === 'urgent' ? '🚨' : '📢';

            banner.className = `w-full bg-gradient-to-r ${bgColor} text-white p-4 flex items-center justify-center gap-4 animate-slide-down sticky top-0 z-[100] shadow-2xl border-b border-white/10 backdrop-blur-md`;
            banner.innerHTML = `
                <span class="text-xl animate-bounce">${icon}</span>
                <div class="flex-1 text-center font-black tracking-tight uppercase text-xs md:text-sm">
                    ${data.content}
                </div>
                <div class="flex-shrink-0 opacity-50 text-[8px] font-mono hidden md:block">
                    ${data.timestamp?.toDate ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
            `;
        } else {
            if (banner) banner.remove();
        }
    });
};
initDiffusionListener();

// Disable Dev Logs in Production (Only if not localhost)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log = () => { };
    console.debug = () => { };
    console.warn = () => { };
}

// --- OFFLINE SUPPORT ---
const setupOfflineListener = () => {
    const banner = document.getElementById('offline-banner') || document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-[9999] transition-all duration-500 transform translate-y-32 flex items-center gap-3 font-bold text-sm border border-white/20 backdrop-blur-md';
    banner.innerHTML = `
        <div class="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full animate-pulse">📴</div>
        <div class="flex flex-col">
            <span class="leading-none">Modo Offline</span>
            <span class="text-[10px] font-normal opacity-80">Sin conexión a Internet</span>
        </div>
    `;
    if (!document.getElementById('offline-banner')) document.body.appendChild(banner);

    const updateStatus = () => {
        if (navigator.onLine) {
            banner.classList.remove('active');
            banner.classList.add('translate-y-32');
        } else {
            banner.classList.add('active');
            banner.classList.remove('translate-y-32');
        }
    };

    window.addEventListener('online', updateStatus);
};
setupOfflineListener();

// --- STYLES INJECTED VIA INPUT.CSS ---

// --- VIEW TRANSITIONS ---
const navigateWithTransition = (renderFn) => {
    if (document.startViewTransition) {
        document.startViewTransition(() => {
            renderFn();
        });
    } else {
        renderFn();
    }
};

// Listeners estado de red 
window.addEventListener('online', () => {
    showNotification("conexión restaurada 🟢", "success");
});

window.addEventListener('offline', () => {
    showNotification("Sin conexión a internet 🔴. Modo offline activo.", "warning");
});

// Estado global simple para demo
let currentUserRole = null;

document.addEventListener('DOMContentLoaded', async () => {
    const appContainer = document.getElementById('app-container');

    // 0. Unified Directory Migration (Safe once-per-load check)
    migrateConductoresToPublicadores();

    // 1. Registrar Service Worker
    if ('serviceWorker' in navigator) {
        const registerSW = () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => {
                    console.log('✅ SW registrado con éxito');
                    // Ensure SW is active to help with PWA installation
                    if (reg.installing) console.log('SW installing');
                    if (reg.waiting) console.log('SW waiting');
                    if (reg.active) console.log('SW active');
                })
                .catch(err => console.error('❌ SW error:', err));
        };

        if (document.readyState === 'complete') {
            registerSW();
        } else {
            window.addEventListener('load', registerSW);
        }
    }

    // 2. Manejar Auth
    // Init Router Hook
    onAuthStateChanged(auth, async (user) => {
        appContainer.innerHTML = ''; // Limpiar

        const path = window.location.pathname; // e.g. /administrador/territorios

        if (user) {
            // Usuario autenticado

            // Si es anónimo, confiamos en el localStorage para el rol/identidad (Lógica Conductor sin pass)
            if (user.isAnonymous) {
                const storedRole = localStorage.getItem('demo_role');

                // Si no hay rol guardado (ej. usuario hizo logout limpieza), cerramos la sesión anónima real
                if (!storedRole) {
                    auth.signOut();
                    return;
                }

                const storedName = localStorage.getItem('selected_conductor_name');
                if (storedRole === 'Conductor') {
                    // Update URL if needed
                    if (!path.startsWith('/conductores')) {
                        window.history.replaceState({}, '', '/conductores');
                    }
                    const renderConductorDashboard = await loadConductor();
                    navigateWithTransition(() => renderConductorDashboard(appContainer, storedName || 'Conductor', APP_VERSION, storedRole));
                    return;
                }
            }

            // Buscamos el rol en Firestore (Logic Admin o Conductor con email real)
            const permisos = await getPermisosUsuario(user.email);

            // Determinar rol:
            let role = null;

            if (permisos && permisos.role) {
                role = permisos.role;
            }

            // 3. Fallback Demo (solo si se usó login demo explícito)
            if (!role && localStorage.getItem('demo_role')) {
                role = localStorage.getItem('demo_role');
            }

            // 4. Validación Final
            if (!role) {
                console.warn(`⛔ Acceso denegado para: ${user.email}`);
                showNotification("🚫 Acceso Denegado: Usuario no autorizado.", "error");
                await auth.signOut();
                const renderLogin = await loadLogin();
                renderLogin(appContainer, APP_VERSION);
                return;
            }

            // --- ROUTING LOGIC ---
            const isAdmin = (role === 'Administrador' || role === 'SuperAdmin');

            if (isAdmin && !path.startsWith('/conductores')) {
                // Enforce /administrador URL
                if (!path.startsWith('/administrador')) {
                    window.history.replaceState({}, '', '/administrador/dashboard');
                    const renderAdminDashboard = await loadAdmin();
                    navigateWithTransition(() => renderAdminDashboard(appContainer, APP_VERSION, 'dashboard'));
                } else {
                    // Extract sub-route
                    // /administrador/territorios -> view: territorios
                    const subPath = path.split('/')[2] || 'dashboard'; // index 0="", 1="administrador", 2="sub"

                    // Map URL to Internal Tab ID
                    const urlToTab = {
                        'dashboard': 'dashboard',
                        'territorios': 'casa-en-casa',
                        'predicacion': 'predicacion',
                        'telefonos': 'telefonos',
                        'historial': 'historial',
                        'config': 'config'
                    };

                    const tabId = urlToTab[subPath] || 'dashboard';
                    const renderAdminDashboard = await loadAdmin();
                    navigateWithTransition(() => renderAdminDashboard(appContainer, APP_VERSION, tabId));
                }
            } else {
                // Conductor
                if (!path.startsWith('/conductores')) {
                    window.history.replaceState({}, '', '/conductores');
                }
                const renderConductorDashboard = await loadConductor();
                navigateWithTransition(() => renderConductorDashboard(appContainer, user.email || 'Usuario', APP_VERSION, role));
            }
        } else {
            // No user
            if (path !== '/login' && path !== '/' && path !== '/index.html') {
                window.history.replaceState({}, '', '/login');
            }
            const renderLogin = await loadLogin();
            navigateWithTransition(() => renderLogin(appContainer, APP_VERSION));
        }
    });

    // LISTENER PARA LOGIN SIN PASSWORD (Ciosco/Demo)
    document.addEventListener('demo-login', async (e) => {
        const { email, role } = e.detail;
        currentUserRole = role;
        localStorage.setItem('demo_role', role);

        // Si es conductor (selección de lista), guardamos el nombre para usarlo tras el login anónimo
        if (role === 'Conductor') {
            localStorage.setItem('selected_conductor_name', email); // En este caso email es el nombre o email
        }

        // Si ya hay usuario (ej. Admin saliendo a Conductor?), signOut primero?
        // Asumimos flujo limpio. Iniciamos sesión anónima para cumplir reglas Firestore.
        if (!auth.currentUser) {
            try {
                await signInAnonymously(auth);
                // onAuthStateChanged se encargará del render
                // But we probably want to set URL immediately?
                // Let AuthStateChanged handle it to avoid race.
            } catch (error) {
                console.error("Error signing in anonymously:", error);
                if (error.code === 'auth/admin-restricted-operation') {
                    showNotification("⚠️ Configuración requerida: Debes habilitar el proveedor 'Anónimo' en la consola de Firebase Authentication.", "error");
                } else {
                    showNotification("Error de autenticación: " + error.message, "error");
                }
            }
        } else {
            // Ya autenticado (quizás real o anónimo previo), forzamos refresh de vista
            // Trigger manual re-evaluation
            window.location.reload();
        }
    });
});





