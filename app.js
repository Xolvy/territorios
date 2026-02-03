import './modules/extensions.mjs';
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getPermisosUsuario, migrateConductoresToPublicadores } from './data/firestore-services.js';
import { initTheme, createThemeToggle } from './modules/utils/theme-manager.js';
import { initUpdateManager } from './modules/utils/update-manager.js';
import { moduleRegistry } from './modules/utils/module-registry.js';

// Initialize Module Registry
moduleRegistry.init();

// The version is injected by Vite at build time (Core Shell Version)
const APP_VERSION = __APP_VERSION__;

// --- XOLVY MODULAR: MICRO-MODULE ENGINE ---
// Xolvy Modular: Independent Updates & Hot Module Swapping (HMS) logic
const ModuleCache = new Map();

async function loadModule(moduleName, basePath) {
    const path = moduleRegistry.getModulePath(moduleName, basePath);

    // Xolvy Modular: Independent Update Logic
    // If the path-version changed since last load, we force a fresh import
    const cacheKey = moduleName;
    const isNewVersion = ModuleCache.get(`${cacheKey}_path`) !== path;

    if (!ModuleCache.has(cacheKey) || isNewVersion) {
        console.log(`📦 [Xolvy Modular] Loading ${moduleName} (v${moduleRegistry.getModuleVersion(moduleName)})`);
        // We add a cache-buster ONLY if we are forcing a swap in a running session
        const finalPath = isNewVersion ? `${path}&ts=${Date.now()}` : path;
        const mod = await import(finalPath);
        ModuleCache.set(cacheKey, mod);
        ModuleCache.set(`${cacheKey}_path`, path);
    }

    return ModuleCache.get(cacheKey);
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

    initTheme();
    document.body.appendChild(createThemeToggle());
    initUpdateManager();
    initDiffusionListener();

    const handleAuthChange = async (user) => {
        appContainer.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div></div>';
        const path = window.location.pathname;

        if (user) {
            if (user.isAnonymous) {
                const storedRole = localStorage.getItem('demo_role');
                const storedName = localStorage.getItem('selected_conductor_name');
                if (storedRole === 'Conductor') {
                    if (!path.startsWith('/conductores')) window.history.replaceState({}, '', '/conductores');
                    const render = await loadConductor();
                    render(appContainer, storedName || 'Conductor', APP_VERSION, storedRole);
                    return;
                }
            }

            const permisos = await getPermisosUsuario(user.email);
            let role = permisos?.role || localStorage.getItem('demo_role');

            if (!role) {
                await auth.signOut();
                const render = await loadLogin();
                render(appContainer, APP_VERSION);
                return;
            }

            const isAdmin = (role === 'Administrador' || role === 'SuperAdmin');
            if (isAdmin && !path.startsWith('/conductores')) {
                const subPath = path.split('/')[2] || 'dashboard';
                const urlToTab = { 'territorios': 'casa-en-casa', 'predicacion': 'predicacion', 'telefonos': 'telefonos', 'config': 'config' };
                const tabId = urlToTab[subPath] || 'dashboard';
                const render = await loadAdmin();
                render(appContainer, APP_VERSION, tabId);
            } else {
                if (!path.startsWith('/conductores')) window.history.replaceState({}, '', '/conductores');
                const render = await loadConductor();
                render(appContainer, user.email || 'Usuario', APP_VERSION, role);
            }
        } else {
            const render = await loadLogin();
            render(appContainer, APP_VERSION);
        }
    };

    // --- HMS RE-RENDER LOGIC ---
    moduleRegistry.subscribe(async (moduleName, version) => {
        const path = window.location.pathname;

        // XOLVY UPDATES: Use the new discrete notification system
        const { notifyModuleUpdate, completeXolvyUpdate } = await import('./modules/utils/update-manager.js');
        notifyModuleUpdate(moduleName, version);

        // Define which sub-modules belong to which main view
        const conductorSubModules = ['availability', 'recursos', 'maps_explorer', 'rescue', 'phone_module', 'onboarding', 'weekly_program', 'program_views'];
        const adminSubModules = ['territories_view', 'public_view', 'phones_view', 'rules_view', 'analytics_view'];

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
                completeXolvyUpdate(moduleName);

                // Targeted refresh or full re-auth
                if (shouldRefreshConductor && window.refreshConductorView) {
                    window.refreshConductorView().then(() => restoreState());
                } else if (shouldRefreshAdmin && window.refreshAdminView) {
                    window.refreshAdminView().then(() => restoreState());
                } else {
                    handleAuthChange(user).then(() => restoreState());
                }
            }, 2000);
        } else {
            // Not in the relevant view, just finish the HUD
            setTimeout(() => {
                completeXolvyUpdate(moduleName);
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

    migrateConductoresToPublicadores();

    onAuthStateChanged(auth, handleAuthChange);

    document.addEventListener('demo-login', async (e) => {
        const { email, role } = e.detail;
        localStorage.setItem('demo_role', role);
        localStorage.setItem('selected_conductor_name', email);
        await signInAnonymously(auth);
    });
});
