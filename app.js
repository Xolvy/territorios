import './modules/extensions.mjs';
import { auth, db } from './firebase-config.js?v=2.2.7';
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
// Main modules are now lazy-loaded
// import { renderLogin } from './modules/login.js?v=2.0.1';
// import { renderAdminDashboard } from './modules/admin-dashboard.js?v=2.0.1';
// import { renderConductorDashboard } from './modules/conductor-dashboard.js?v=2.0.1';
import { getPermisosUsuario, getSystemVersion, migrateConductoresToPublicadores } from './data/firestore-services.js?v=2.3.0';
import { showNotification } from './modules/utils/helpers.js?v=2.3.0';
import { initTheme, createThemeToggle } from './modules/utils/theme-manager.js?v=2.3.0';
import { initPWA } from './modules/utils/pwa-manager.js?v=2.3.0';

// Global Module Cache for performance
const ModuleCache = {
    login: null,
    admin: null,
    conductor: null
};

async function loadLogin() {
    if (!ModuleCache.login) ModuleCache.login = await import('./modules/login.js?v=2.3.0');
    return ModuleCache.login.renderLogin;
}

async function loadAdmin() {
    if (!ModuleCache.admin) ModuleCache.admin = await import('./modules/admin-dashboard.js?v=2.3.0');
    return ModuleCache.admin.renderAdminDashboard;
}

async function loadConductor() {
    if (!ModuleCache.conductor) ModuleCache.conductor = await import('./modules/conductor-dashboard.js?v=2.3.0');
    return ModuleCache.conductor.renderConductorDashboard;
}

// Init Theme
initTheme();
document.body.appendChild(createThemeToggle());

// Init PWA & Notifications
initPWA();

const APP_VERSION = '2.3.0';

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
                        <div class="relative">
                            <!-- Background Glow -->
                            <div class="absolute -top-20 -left-20 w-40 h-40 bg-teal-500/20 blur-3xl rounded-full animate-pulse"></div>
                            <div class="absolute -bottom-20 -right-20 w-40 h-40 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" style="animation-delay: 1s"></div>

                            <div class="mb-8 flex justify-center relative">
                                <div class="w-24 h-24 bg-gradient-to-tr from-teal-500 to-indigo-600 rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl shadow-teal-500/20 animate-float">
                                    <i class="fas fa-sparkles text-white"></i>
                                </div>
                                <div class="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border-4 border-slate-50 dark:border-slate-900">
                                    <div class="w-3 h-3 bg-teal-500 rounded-full animate-ping"></div>
                                </div>
                            </div>
                            
                            <h2 class="text-3xl font-black text-slate-800 dark:text-white mb-4 tracking-tighter uppercase">Mejorando tu Experiencia</h2>
                            <p class="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-10 font-medium">
                                Estamos sincronizando nuevas herramientas y mejoras de estabilidad. Esto tomará solo unos segundos.
                            </p>

                            <div class="space-y-6">
                                <div class="w-full bg-slate-100 dark:bg-white/5 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-white/10">
                                    <div class="bg-gradient-to-r from-teal-500 via-indigo-500 to-teal-500 h-full rounded-full animate-shimmer-progress" style="width: 100%; background-size: 200% 100%"></div>
                                </div>
                                
                                <div class="flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400 animate-pulse">
                                    <i class="fas fa-microchip"></i>
                                    <span>Optimizando archivos del sistema</span>
                                </div>
                            </div>

                            <div class="mt-12 pt-8 border-t border-slate-100 dark:border-white/5">
                                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Versión de destino: v${serverVersion}</p>
                            </div>
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
    banner.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-6 py-4 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] z-[9999] transition-all duration-700 transform translate-y-48 flex items-center gap-5 font-bold text-sm border border-slate-200 dark:border-white/10 backdrop-blur-xl';

    const updateBanner = (isOnline, isSyncing = false) => {
        if (isOnline) {
            if (isSyncing) {
                banner.innerHTML = `
                    <div class="flex items-center justify-center w-10 h-10 bg-teal-500 rounded-2xl text-white shadow-lg shadow-teal-500/20">
                        <i class="fas fa-sync-alt animate-spin text-sm"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="leading-none uppercase tracking-tighter font-black">Sincronizando</span>
                        <span class="text-[9px] font-black opacity-50 uppercase tracking-[0.2em] mt-1">Subiendo cambios locales...</span>
                    </div>
                `;
                banner.classList.remove('translate-y-48');
            } else {
                banner.classList.add('translate-y-48');
            }
        } else {
            banner.innerHTML = `
                <div class="flex items-center justify-center w-10 h-10 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-500/20 animate-float">
                    <i class="fas fa-plane-slash text-sm"></i>
                </div>
                <div class="flex flex-col">
                    <span class="leading-none uppercase tracking-tighter font-black">Modo Desconectado</span>
                    <span class="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.2em] mt-1 animate-pulse">Trabajando con datos locales</span>
                </div>
            `;
            banner.classList.remove('translate-y-48');
        }
    };

    window.addEventListener('online', () => {
        updateBanner(true, true);
        setTimeout(() => updateBanner(true, false), 3000);
    });
    window.addEventListener('offline', () => updateBanner(false));

    // Initial check
    if (!navigator.onLine) updateBanner(false);
    if (!document.getElementById('offline-banner')) document.body.appendChild(banner);
};
setupOfflineListener();

/**
 * POWER UP: Resource Pre-caching for Territories
 * Pre-downloads maps and keys resources to ensure 100% offline availability.
 */
window.precacheTerritoryResources = async (territories) => {
    if (!navigator.onLine || !territories || territories.length === 0) return;

    console.log(`🔌 [Power Up] Pre-cargando recursos para ${territories.length} territorios...`);
    const cache = await caches.open('territorios-elite-v2.2.7');

    let count = 0;
    for (const t of territories) {
        if (t.imagen) {
            try {
                const response = await fetch(t.imagen, { mode: 'cors' });
                await cache.put(t.imagen, response);
                count++;
            } catch (e) {
                console.warn(`Failed to precache map for T-${t.numero}`);
            }
        }
    }
    if (count > 0) {
        console.log(`✅ [Power Up] ${count} mapas guardados en memoria local para uso offline.`);
    }
};

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
            navigator.serviceWorker.register('/service-worker.js?v=2.3.0')
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
            // No user - OFFLINE EMERGENCY BYPASS
            const storedRole = localStorage.getItem('demo_role');
            const storedName = localStorage.getItem('selected_conductor_name');

            if (!navigator.onLine && storedRole === 'Conductor' && storedName) {
                console.log("📡 [OFFLINE] Recuperando sesión local...");
                if (!window.location.pathname.startsWith('/conductores')) {
                    window.history.replaceState({}, '', '/conductores');
                }
                const renderConductorDashboard = await loadConductor();
                navigateWithTransition(() => renderConductorDashboard(appContainer, storedName, APP_VERSION, storedRole));
                return;
            }

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
                    // OFFLINE RESCUE for Conductors
                    if (!navigator.onLine && role === 'Conductor') {
                        showNotification("🛰️ Entrando en modo offline (Sin conexión de red)", "warning");
                        if (!window.location.pathname.startsWith('/conductores')) {
                            window.history.replaceState({}, '', '/conductores');
                        }
                        const renderConductorDashboard = await loadConductor();
                        navigateWithTransition(() => renderConductorDashboard(appContainer, email, APP_VERSION, role));
                        return;
                    }
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





