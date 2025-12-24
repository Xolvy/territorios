import { auth } from './firebase-config.js';
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { renderLogin } from './modules/login.js?v=5.0.2';
import { renderAdminDashboard } from './modules/admin-dashboard.js?v=5.0.2';
import { renderConductorDashboard } from './modules/conductor-dashboard.js?v=5.0.2';
import { getPermisosUsuario, getSystemVersion } from './data/firestore-services.js?v=5.0.2';
import { showNotification } from './modules/utils/helpers.js?v=5.0.2';
import { initTheme, createThemeToggle } from './modules/utils/theme-manager.js';

// Init Theme
initTheme();
document.body.appendChild(createThemeToggle());

const APP_VERSION = '5.0.3'; // BUMP VERSION

// --- SYSTEM CHECK & CLEANUP ---
(async () => {
    try {
        // 1. Local Cache Busting (Immediate)
        const storedVersion = localStorage.getItem('app_version');

        // Helper to compare versions (semver-ish)
        const isNewerVersion = (local, remote) => {
            if (!remote) return false;
            const l = local.split('.').map(Number);
            const r = remote.split('.').map(Number);
            for (let i = 0; i < Math.max(l.length, r.length); i++) {
                if ((r[i] || 0) > (l[i] || 0)) return true;
                if ((r[i] || 0) < (l[i] || 0)) return false;
            }
            return false;
        };

        if (storedVersion !== APP_VERSION) {
            console.warn(`⚡ New local version detected (${APP_VERSION}). Cleaning cache...`);

            // FORCE UNREGISTER ALL WORKERS
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }

            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            }

            localStorage.setItem('app_version', APP_VERSION);
            window.location.reload(true);
            return;
        }

        // 2. Remote Version Check (Async)
        const remoteVersion = await getSystemVersion();
        if (isNewerVersion(APP_VERSION, remoteVersion)) {
            console.warn(`🚀 Remote version mismatch (Local: ${APP_VERSION}, Remote: ${remoteVersion}). Forcing Update...`);

            // Clear version to trigger cleanup on next load
            localStorage.removeItem('app_version');

            showNotification(`Actualizando a la versión ${remoteVersion}...`, "info");
            setTimeout(() => {
                window.location.reload(true);
            }, 2000);
        }

    } catch (err) {
        console.error("Version check failed:", err);
    }
})();

// Disable Dev Logs in Production (Only if not localhost)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log = () => { };
    console.debug = () => { };
    console.warn = () => { };
}

// --- GLOBAL PWA INSTALL PROMPT ---
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    console.log("📲 PWA Install Trigger Captured");
});

// Listeners estado de red para PWA
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

    // 1. Registrar Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => console.log('SW registrado'))
                .catch(err => console.log('SW error', err));
        });
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
                    renderConductorDashboard(appContainer, storedName || 'Conductor');
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
                renderLogin(appContainer);
                return;
            }

            // --- ROUTING LOGIC ---
            if (role === 'Administrador' || role === 'SuperAdmin') {
                // Enforce /administrador URL
                if (!path.startsWith('/administrador')) {
                    window.history.replaceState({}, '', '/administrador/dashboard');
                    renderAdminDashboard(appContainer, APP_VERSION, 'dashboard');
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
                    renderAdminDashboard(appContainer, APP_VERSION, tabId);
                }
            } else {
                // Conductor
                if (!path.startsWith('/conductores')) {
                    window.history.replaceState({}, '', '/conductores');
                }
                renderConductorDashboard(appContainer, user.email || 'Usuario');
            }
        } else {
            // No user
            // Check if attempting to access protected route needed?
            // For now, just render login.
            if (path !== '/login' && path !== '/' && path !== '/index.html') {
                // Store intent?
                window.history.replaceState({}, '', '/login');
            }
            renderLogin(appContainer);
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
