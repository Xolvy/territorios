import './modules/extensions.mjs';
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInAnonymously, getRedirectResult } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getPermisosUsuario, migrateConductoresToPublicadores, autoCleanTelefonosData } from './data/firestore-services.js';
import { initTheme } from './modules/utils/theme-manager.js';
import { initUpdateManager } from './modules/utils/update-manager.js';
import { moduleRegistry } from './modules/utils/module-registry.js';
import { XolvyAdaptive } from './modules/utils/adaptive.js';
import { VisualEngine } from './modules/utils/visual-engine.js';

// Initialize Visual Ecosystem
VisualEngine.applyGlobalEcosystem();

// Initialize Module Registry
moduleRegistry.init();

// The version is injected by Vite at build time (Core Shell Version)
const APP_VERSION = "2.9.0";

// --- XOLVY MODULAR: MICRO-MODULE ENGINE ---
const dynamicModules = import.meta.glob('./modules/**/*.js');

async function loadModule(moduleName, basePath) {
    return moduleRegistry.loadModule(moduleName, basePath, dynamicModules);
}

// Shell View Accessors
const loadLogin = async () => (await loadModule('login', './modules/login.js')).renderLogin;
const loadAdmin = async () => (await loadModule('admin', './modules/admin-dashboard.js')).renderAdminDashboard;
const loadConductor = async () => (await loadModule('conductor', './modules/conductor-dashboard.js')).renderConductorDashboard;


// --- DIFFUSION LISTENER ---
const initDiffusionListener = () => {
    onSnapshot(doc(db, "configuracion", "diffusion_active"), (docSnap) => {
        let banner = document.getElementById('global-diffusion-banner');
        if (docSnap.exists() && docSnap.data().active) {
            const data = docSnap.data();
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'global-diffusion-banner';
                document.body.prepend(banner);
            }
            const bgColor = data.type === 'urgent' ? 'from-red-600 to-red-800' : 'from-blue-600 to-blue-800';
            banner.className = `w-full bg-gradient-to-r ${bgColor} text-white p-4 flex items-center justify-center gap-4 sticky top-0 z-[100] shadow-2xl`;
            banner.innerHTML = `<span>📢</span> <div class="flex-1 text-center font-black uppercase text-xs">${data.content}</div>`;
        } else {
            if (banner) banner.remove();
        }
    });
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    const appContainer = document.getElementById('app-container');

    // 1. App Loading State: Prevenir renderizado errático durante inicialización y checkeo asíncrono
    appContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-screen bg-slate-50 animate-fade-in">
            <div class="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6 shadow-sm"></div>
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">Verificando credenciales...</p>
        </div>
    `;

    initTheme();
    initUpdateManager();
    initDiffusionListener();
    XolvyAdaptive.init();

    // 2. Interceptar getRedirectResult sin bloquear el listener global
    // Esto previene que el app se quede colgado en "Verificando credenciales" si Firebase tarda en responder
    getRedirectResult(auth).then((result) => {
        if (result && result.user) {
            console.log("💎 [Auth] Login exitoso vía Redirect:", result.user.email);
        }
    }).catch((redirectError) => {
        console.error("❌ [Auth] Redirect Error:", redirectError);
        // En caso de error de red o similar, el onAuthStateChanged eventualmente fallará o mostrará login
    });

    const handleAuthChange = async (user) => {
        try {
            const contextPath = window.location.pathname;
            
            if (user) {
                console.log("💎 [Auth] Active User Session:", user.email);
                
                if (user.isAnonymous) {
                    const storedRole = localStorage.getItem('demo_role');
                    const storedName = localStorage.getItem('selected_conductor_name');
                    if (storedRole === 'Conductor') {
                        if (!contextPath.startsWith('/conductores')) window.history.replaceState({}, '', '/conductores');
                        const render = await loadConductor();
                        render(appContainer, storedName || 'Conductor', APP_VERSION, storedRole);
                        return;
                    }
                }

                const permisos = await getPermisosUsuario(user.email);
                let role = permisos?.role || localStorage.getItem('demo_role');

                if (!role) {
                    appContainer.innerHTML = `
                        <div class="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-fade-in bg-gradient-to-br from-slate-50 via-white to-rose-50/30">
                            <div class="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center text-3xl mb-8 shadow-xl"><i class="fas fa-shield-alt"></i></div>
                            <h2 class="text-2xl font-black text-slate-800 uppercase tracking-tight">Acceso Bloqueado</h2>
                            <p class="text-slate-500 max-w-sm mt-4 font-bold text-sm">Tu cuenta no tiene permisos asignados.</p>
                            <button onclick="location.href='/'" class="mt-10 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px]">Volver</button>
                        </div>
                    `;
                    return;
                }

                const isAdmin = (role === 'Administrador' || role === 'SuperAdmin');
                if (isAdmin && !window.location.pathname.startsWith('/conductores')) {
                    const path = window.location.pathname;
                    const subPath = path.split('/')[2] || 'dashboard';
                    const urlToTab = { 'territorios': 'casa-en-casa', 'predicacion': 'predicacion', 'telefonos': 'telefonos', 'config': 'config' };
                    const tabId = urlToTab[subPath] || 'dashboard';
                    const render = await loadAdmin();
                    render(appContainer, APP_VERSION, tabId);
                } else {
                    if (!window.location.pathname.startsWith('/conductores')) window.history.pushState({}, '', '/conductores');
                    const render = await loadConductor();
                    render(appContainer, user.email || 'Usuario', APP_VERSION, role);
                }
            } else {
                const render = await loadLogin();
                render(appContainer, APP_VERSION);
            }
        } catch (e) {
            console.error("🚀 [Boot] Error:", e);
        }
    };

    // Expose for seamless transitions
    window.switchToConductorView = () => {
        window.history.pushState({}, '', '/conductores');
        handleAuthChange(auth.currentUser);
    };

    window.switchToAdminView = () => {
        window.history.pushState({}, '', '/administrador');
        handleAuthChange(auth.currentUser);
    };

    // --- HMS RE-RENDER LOGIC ---
    moduleRegistry.subscribe(async (moduleName, version) => {
        const path = window.location.pathname;

        // XOLVY UPDATES: Use the new discrete notification system
        const { notifyModuleUpdate, completeXolvyUpdate } = await import('./modules/utils/update-manager.js');
        notifyModuleUpdate(moduleName, version);

        // Define which sub-modules belong to which main view
        const conductorSubModules = ['availability', 'recursos', 'maps_explorer', 'rescue', 'phone_module', 'onboarding', 'weekly_program', 'program_views'];
        const adminSubModules = ['territories_view', 'public_view', 'phones_view', 'rules_view', 'analytics_view', 'reports_view'];

        // Determine if we should re-render
        const isConductorView = path.startsWith('/conductores');
        const isAdminView = !isConductorView && (localStorage.getItem('demo_role') === 'Administrador' || localStorage.getItem('demo_role') === 'SuperAdmin');

        const shouldRefreshConductor = isConductorView && (moduleName === 'conductor' || conductorSubModules.includes(moduleName));
        const shouldRefreshAdmin = isAdminView && (moduleName === 'admin' || adminSubModules.includes(moduleName));

        if (shouldRefreshConductor || shouldRefreshAdmin) {
            const user = auth.currentUser;

            // Xolvy Modular Rule 1.3: State Immortalization
            // Save scroll position before the re-render
            const uiState = {
                scroll: window.scrollY,
                module: moduleName,
                timestamp: Date.now()
            };
            sessionStorage.setItem('xolvy_hms_state', JSON.stringify(uiState));

            // Small delay to show the "Receiving" state in HUD
            setTimeout(() => {
                completeXolvyUpdate(moduleName, version);

                // Targeted refresh or full re-auth
                if (shouldRefreshConductor && window.refreshConductorView) {
                    window.refreshConductorView().then(() => { restoreState(); XolvyAdaptive.refresh(); });
                } else if (shouldRefreshAdmin && window.refreshAdminView) {
                    window.refreshAdminView().then(() => { restoreState(); XolvyAdaptive.refresh(); });
                } else {
                    handleAuthChange(user).then(() => { restoreState(); XolvyAdaptive.refresh(); });
                }
            }, 2000);
        } else {
            // Not in the relevant view, just finish the HUD
            setTimeout(() => {
                completeXolvyUpdate(moduleName, version);
            }, 2500);
        }
    });

    const restoreState = () => {
        const saved = sessionStorage.getItem('xolvy_hms_state');
        if (saved) {
            const { scroll } = JSON.parse(saved);
            window.scrollTo({ top: scroll, behavior: 'smooth' });
            sessionStorage.removeItem('xolvy_hms_state');
        }
    };

    // Xolvy Data Shield: Cache Burster on version change
    const lastVer = localStorage.getItem('last_app_version');
    if (lastVer !== APP_VERSION) {
        console.log(`✨ Version Upgrade: ${lastVer} -> ${APP_VERSION}. Purging caches.`);
        const { clearServiceCache } = await import('./data/firestore-services.js');
        clearServiceCache();
        localStorage.setItem('last_app_version', APP_VERSION);
    }

    // Xolvy Automation: System Maintenance Hooks
    migrateConductoresToPublicadores();

    // AutoClean runs in background without freezing the UI. 
    // Triggers daily unconditionally to guarantee phone database health 
    // even if Admin never logs in.
    autoCleanTelefonosData();

    let authResolved = false;

    // Failsafe Timeout: Si en 3 segundos no hay respuesta de Auth, forzamos salida del loader
    const authTimeout = setTimeout(async () => {
        if (!authResolved) {
            console.warn("⚠️ [Auth] Failsafe Timeout: Firebase Auth no respondió a tiempo. Forzando Login.");
            const render = await loadLogin();
            render(appContainer, APP_VERSION);
        }
    }, 3500);

    onAuthStateChanged(auth, (user) => {
        authResolved = true;
        clearTimeout(authTimeout);
        handleAuthChange(user);
    });

    document.addEventListener('demo-login', async (e) => {
        const { email, role } = e.detail;
        localStorage.setItem('demo_role', role);
        localStorage.setItem('selected_conductor_name', email);
        await signInAnonymously(auth);
    });
});
