import './modules/extensions.mjs';
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getPermisosUsuario, migrateConductoresToPublicadores } from './data/firestore-services.js';
import { initTheme, createThemeToggle } from './modules/utils/theme-manager.js';
import { initUpdateManager } from './modules/utils/update-manager.js';

// The version is injected by Vite at build time
const APP_VERSION = '2.4.1.2';

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

    // Xolvy Data Shield: Cache Burster on version change
    const lastVer = localStorage.getItem('last_app_version');
    if (lastVer !== APP_VERSION) {
        console.log(`✨ Version Upgrade: ${lastVer} -> ${APP_VERSION}. Purging caches.`);
        const { clearServiceCache } = await import('./data/firestore-services.js');
        clearServiceCache();
        localStorage.setItem('last_app_version', APP_VERSION);
    }

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
