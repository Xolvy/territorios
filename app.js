import './modules/extensions.mjs';
import { auth, db } from './firebase-config.js?v=2.4.0.7';
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
// Main modules are now lazy-loaded
import { getPermisosUsuario, getSystemVersion, migrateConductoresToPublicadores } from './data/firestore-services.js?v=2.4.0.7';
import { showNotification } from './modules/utils/helpers.js?v=2.4.0.7';
import { initPWA } from './modules/utils/pwa-manager.js?v=2.4.0.7';
import { initTheme, createThemeToggle } from './modules/utils/theme-manager.js?v=2.4.0.7';

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

// --- FORCED ONE-TIME SYNC TO v2.4.0.7 ---
(async () => {
    const SYNC_VERSION = '2.4.0.7';
    const syncKey = `app_sync_forced_v${SYNC_VERSION}`;
    const urlParams = new URLSearchParams(window.location.search);
    const isJustUpdated = urlParams.get('updated') === 'true';

    // If we just updated, don't run the sync logic again to avoid loops
    if (isJustUpdated) {
        localStorage.setItem(syncKey, 'true');
        localStorage.setItem('app_version', SYNC_VERSION);
        localStorage.removeItem('block_version_check'); // Safe to check again
        return;
    }

    const oldVersion = localStorage.getItem('app_version');

    if (!localStorage.getItem(syncKey) || (oldVersion && oldVersion !== SYNC_VERSION)) {
        console.warn(`🚀 Iniciando sincronización forzada a v${SYNC_VERSION}...`);

        // Show Update UI
        const overlay = document.createElement('div');
        overlay.id = 'force-sync-overlay';
        overlay.style = 'position: fixed; inset: 0; z-index: 99999; background: #f8fafc; display: flex; align-items: center; justify-content: center; font-family: "Outfit", sans-serif;';
        overlay.innerHTML = `
            <div style="background: white; padding: 3rem; border-radius: 2.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1); text-align: center; max-width: 450px; width: 90%; border: 1px solid #e2e8f0;">
                <div style="width: 80px; height: 80px; background: #ccfbf1; border-radius: 2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem; color: #0d9488; font-size: 2.5rem;">
                    <i class="fas fa-rocket"></i>
                </div>
                <h3 style="font-weight: 900; font-size: 1.5rem; margin-bottom: 1rem; color: #1e293b; text-transform: uppercase; letter-spacing: -0.02em;">Actualización Obligatoria</h3>
                <p style="color: #64748b; font-size: 0.95rem; line-height: 1.6; margin-bottom: 2rem; font-weight: 500;">
                    Estamos sincronizando la última versión de los archivos para asegurar la estabilidad del sistema.<br>
                    <strong>Limpiando memoria y archivos temporales...</strong>
                </p>
                <div style="width: 40px; height: 40px; border: 4px solid #f1f5f9; border-top-color: #0d9488; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                <style>
                    @keyframes spin { to { transform: rotate(360deg); } }
                </style>
            </div>
        `;
        document.body.appendChild(overlay);

        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let r of regs) {
                    await r.unregister();
                }
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                for (let k of keys) {
                    await caches.delete(k);
                }
            }

            // Be selective with clearing to avoid wiping out the flags we just set or about to set
            const essentialKeys = ['theme', 'last_force_timestamp'];
            const preservedValues = {};
            essentialKeys.forEach(k => preservedValues[k] = localStorage.getItem(k));

            localStorage.clear();

            essentialKeys.forEach(k => {
                if (preservedValues[k]) localStorage.setItem(k, preservedValues[k]);
            });

            localStorage.setItem(syncKey, 'true');
            localStorage.setItem('app_version', SYNC_VERSION);

            // Wait a moment for UX
            setTimeout(() => {
                window.location.href = `${window.location.pathname}?updated=true&v=${Date.now()}`;
            }, 2000);
        } catch (e) {
            console.error("Sync error:", e);
            localStorage.setItem(syncKey, 'true');
            localStorage.setItem('app_version', SYNC_VERSION);
            window.location.reload();
        }
    }
})();

// Init Theme
initTheme();
document.body.appendChild(createThemeToggle());

// Init PWA & Notifications
initPWA();

const APP_VERSION = '2.4.0.7';

// --- SUCCESS CONFIRMATION AFTER UPDATE ---
const checkUpdateSuccess = () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('updated') === 'true') {
        setTimeout(() => {
            showNotification(`✅ ¡Fuerza Sync Exitosa! v${APP_VERSION} Activa`, "success");
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 1500);
    }
};
checkUpdateSuccess();

const initVersionCheck = (currentVersion) => {
    // Skip checking if we just updated via URL to avoid race conditions
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('updated') === 'true' || localStorage.getItem('block_version_check')) return;

    onSnapshot(doc(db, "configuracion", "version_control"), async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const serverVersion = data.latestVersion;
            const serverForceTimestamp = data.forceTimestamp || 0;
            const localForceTimestamp = parseInt(localStorage.getItem('last_force_timestamp') || '0');

            // Prevent loop: If we are already on the server version (or newer), ignore version mismatches
            // Unless there's an explicit forceTimestamp change.
            const isVersionNewer = serverVersion !== currentVersion;
            const isTimestampNewer = serverForceTimestamp && serverForceTimestamp > localForceTimestamp;

            if (isVersionNewer || isTimestampNewer) {
                if (data.forceUpdate) {
                    // One last check: if we just reloaded for this version, don't do it again
                    if (localStorage.getItem('app_version') === currentVersion && !isTimestampNewer) {
                        return;
                    }

                    console.warn("🚀 Update required. Purging cache...");

                    // Mark as updating to prevent loops in this session
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

initVersionCheck(APP_VERSION);

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
initDiffusionListener();

// --- ROUTING ---
const navigateWithTransition = (renderFn) => {
    if (document.startViewTransition) document.startViewTransition(renderFn);
    else renderFn();
};

document.addEventListener('DOMContentLoaded', async () => {
    const appContainer = document.getElementById('app-container');
    migrateConductoresToPublicadores();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js?v=2.4.0.7');
        });
    }

    onAuthStateChanged(auth, async (user) => {
        appContainer.innerHTML = '';
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
