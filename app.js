import { auth, db } from '/firebase-config.js?v=2.5.5';
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { renderLogin } from './modules/login.js?v=2.5.5';
import { renderAdminDashboard } from './modules/admin-dashboard.js?v=2.5.5';
import { renderConductorDashboard } from './modules/conductor-dashboard.js?v=2.5.5';
import { getPermisosUsuario, getSystemVersion, migrateConductoresToPublicadores } from './data/firestore-services.js?v=2.5.5';
import { showNotification } from './modules/utils/helpers.js?v=2.5.5';
import { initTheme, createThemeToggle } from './modules/utils/theme-manager.js?v=2.5.5';

// Init Theme
initTheme();
document.body.appendChild(createThemeToggle());

const APP_VERSION = '2.5.5';

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

            if (serverVersion && serverVersion !== currentVersion && data.forceUpdate) {
                // Prevenir bucles infinitos: si el path tiene el mismo v que acabamos de generar, no reintentar inmediatamente
                const urlParams = new URLSearchParams(window.location.search);
                const currentV = urlParams.get('v');
                if (currentV && (Date.now() - parseInt(currentV)) < 5000) {
                    console.log("⏳ Esperando a que el sistema se estabilice...");
                    return;
                }

                console.warn(`🚀 Iniciando actualización: ${currentVersion} -> ${serverVersion}`);

                // Mostrar Overlay de Actualización para evitar el parpadeo
                const overlay = document.createElement('div');
                overlay.className = 'version-modal-overlay';
                overlay.innerHTML = `
                    <div class="version-modal-content animate-scale-in">
                        <div class="mb-6 flex justify-center">
                            <div class="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center text-3xl animate-bounce">
                                🚀
                            </div>
                        </div>
                        <h2>¡Nueva versión disponible!</h2>
                        <p>Estamos optimizando tu experiencia para la v<b>${serverVersion}</b>. <br>Esto solo tomará un momento...</p>
                        <div class="version-modal-timer">
                            Limpiando caché y archivos temporales...
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

                // 3. Clear stored version
                localStorage.removeItem('app_version');

                // 4. Reload with Cache-Buster tras un pequeño delay para que el overlay sea visible y el sistema respire
                setTimeout(() => {
                    const v = Date.now();
                    window.location.href = `${window.location.pathname}?updated=true&v=${v}`;
                }, 1000);
            }
        }
    });
};

// Start listener
initVersionCheck(APP_VERSION);

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

// --- PREMIUM STYLES INJECTION ---
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        .version-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            animation: fadeIn 0.4s ease-out;
        }
        .version-modal-content {
            background: white;
            padding: 2.5rem;
            border-radius: 2rem;
            max-width: 450px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 150, 136, 0.5);
            border: 1px solid rgba(0, 150, 136, 0.2);
        }
        .dark .version-modal-content {
            background: #0f172a;
            color: white;
            border-color: rgba(255, 255, 255, 0.1);
        }
        .version-modal-content h2 {
            font-size: 1.5rem;
            font-weight: 800;
            margin-bottom: 1rem;
            color: #0d9488;
        }
        .version-modal-content p {
            font-size: 0.95rem;
            color: #475569;
            margin-bottom: 1.5rem;
            line-height: 1.6;
        }
        .dark .version-modal-content p { color: #94a3b8; }
        .version-modal-timer {
            font-size: 0.85rem;
            background: #f1f5f9;
            padding: 0.75rem;
            border-radius: 1rem;
            margin-bottom: 1.5rem;
            font-family: monospace;
            color: #64748b;
        }
        .dark .version-modal-timer { background: rgba(255,255,255,0.05); color: #94a3b8; }
        .version-modal-btn {
            background: #0d9488;
            color: white;
            padding: 1rem 2rem;
            border-radius: 1rem;
            font-weight: 600;
            width: 100%;
            transition: all 0.3s ease;
            box-shadow: 0 10px 15px -3px rgba(13, 148, 136, 0.3);
        }
        .version-modal-btn:hover {
            background: #0f766e;
            transform: translateY(-2px);
        }
        #offline-banner {
            box-shadow: 0 10px 30px -5px rgba(217, 119, 6, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(12px);
        }
        #offline-banner.active {
            transform: translate(-50%, 0) !important;
        }
    `;
    document.head.appendChild(style);
};
injectStyles();

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

    // 0. Unified Directory Migration (Safe once-per-load check)
    migrateConductoresToPublicadores();

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
                    navigateWithTransition(() => renderConductorDashboard(appContainer, storedName || 'Conductor'));
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
                    navigateWithTransition(() => renderAdminDashboard(appContainer, APP_VERSION, tabId));
                }
            } else {
                // Conductor
                if (!path.startsWith('/conductores')) {
                    window.history.replaceState({}, '', '/conductores');
                }
                navigateWithTransition(() => renderConductorDashboard(appContainer, user.email || 'Usuario'));
            }
        } else {
            // No user
            if (path !== '/login' && path !== '/' && path !== '/index.html') {
                window.history.replaceState({}, '', '/login');
            }
            navigateWithTransition(() => renderLogin(appContainer));
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





