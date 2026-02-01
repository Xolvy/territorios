import './modules/extensions.mjs';
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getPermisosUsuario, migrateConductoresToPublicadores } from './data/firestore-services.js';
import { showNotification } from './modules/utils/helpers.js';
import { initTheme, createThemeToggle } from './modules/utils/theme-manager.js';

// The version is injected by Vite at build time
const APP_VERSION = __APP_VERSION__;

// Lazy loaders for heavy modules
const ModuleCache = {
    login: null,
    admin: null,
    conductor: null
};

async function loadLogin() {
    if (!ModuleCache.login) ModuleCache.login = await import('./modules/login.js');
    return ModuleCache.login.renderLogin;
}

async function loadAdmin() {
    if (!ModuleCache.admin) ModuleCache.admin = await import('./modules/admin-dashboard.js');
    return ModuleCache.admin.renderAdminDashboard;
}

async function loadConductor() {
    if (!ModuleCache.conductor) ModuleCache.conductor = await import('./modules/conductor-dashboard.js');
    return ModuleCache.conductor.renderConductorDashboard;
}

// --- VERSION & PWA SUCCESS FLOW ---
const checkUpdateSuccess = () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('updated') === 'true') {
        setTimeout(() => {
            showNotification(`✅ ¡Fuerza Sync Exitosa! v${APP_VERSION} Activa`, "success");
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 1500);
    }
};

const initVersionCheck = (currentVersion) => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('updated') === 'true' || localStorage.getItem('block_version_check')) return;

    onSnapshot(doc(db, "configuracion", "version_control"), async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const serverVersion = data.latestVersion;
            const serverForceTimestamp = data.forceTimestamp || 0;
            const localForceTimestamp = parseInt(localStorage.getItem('last_force_timestamp') || '0');

            if (serverVersion !== currentVersion || (serverForceTimestamp > localForceTimestamp)) {
                if (data.forceUpdate) {
                    console.warn("🚀 Update required. Purging cache...");
                    localStorage.setItem('block_version_check', 'true');

                    if ('serviceWorker' in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (let r of regs) await r.unregister();
                    }
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                    }

                    localStorage.setItem('last_force_timestamp', serverForceTimestamp.toString());
                    localStorage.setItem('app_version', currentVersion);
                    window.location.href = `${window.location.pathname}?updated=true&v=${Date.now()}`;
                }
            }
        }
    });
};

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
    checkUpdateSuccess();
    initVersionCheck(APP_VERSION);
    initDiffusionListener();
    migrateConductoresToPublicadores();

    onAuthStateChanged(auth, async (user) => {
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
    });

    document.addEventListener('demo-login', async (e) => {
        const { email, role } = e.detail;
        localStorage.setItem('demo_role', role);
        localStorage.setItem('selected_conductor_name', email);
        await signInAnonymously(auth);
    });
});
