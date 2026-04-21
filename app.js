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
import { IdentityShield } from './data/services/identity-service.js';

// Initialize Visual Ecosystem
VisualEngine.applyGlobalEcosystem();

// Initialize Module Registry
moduleRegistry.init();

// The version is injected by Vite at build time (Core Shell Version)
const APP_VERSION = "3.0.6";
window.XolvyApp = { user: null, version: APP_VERSION };

// --- XOLVY MODULAR: MICRO-MODULE ENGINE ---
const dynamicModules = import.meta.glob('./modules/**/*.js');

async function loadModule(moduleName, basePath) {
    return moduleRegistry.loadModule(moduleName, basePath, dynamicModules);
}

// Shell View Accessors
const loadLogin = async () => (await loadModule('login', './modules/login.js')).renderLogin;
const loadAdmin = async () => (await loadModule('admin', './modules/admin-dashboard.js')).renderAdminDashboard;
let _conductorLoading = false;
const loadConductor = async () => {
    if (_conductorLoading) {
        console.warn('[App] loadConductor ya está en ejecución, ignorando llamada duplicada');
        return window.XolvyApp.lastConductorRender || (async () => {});
    }
    _conductorLoading = true;
    try {
        // ERROR 2 — Esperar a que Firebase Auth tenga usuario antes de cargar módulos
        await new Promise((resolve) => {
            if (auth.currentUser) { resolve(); return; }
            const timeout = setTimeout(() => {
                console.warn("⚠️ [Auth] Timeout en loadConductor — procediendo sin usuario");
                resolve();
            }, 3500);
            const unsub = onAuthStateChanged(auth, (u) => {
                if (u) {
                    clearTimeout(timeout);
                    unsub();
                    resolve();
                }
            });
        });
        const render = (await loadModule('conductor', './modules/conductor-dashboard.js')).renderConductorDashboard;
        window.XolvyApp.lastConductorRender = render;
        return render;
    } finally {
        _conductorLoading = false;
    }
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

    // 1. App Loading State: Prevenir renderizado errático durante inicialización y checkeo asíncrono
    appContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-screen bg-slate-50 animate-fade-in" style="min-height: 100vh; min-height: 100dvh;">
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
        // [FastBoot] Zero-Bounce Guard: Blindaje total contra rebotes al login selector.
        const tieneSesionLocal = !!localStorage.getItem('xolvy_session');
        const tieneSesionAdmin = localStorage.getItem('demo_role') === 'Administrador';

        // CASE 1: No Authenticated User (Identity Shield Return Guard)
        if (!user) {
            if (window._authSuspended || window._adminAuthSuspended) return;

            // Protection for Conductors
            if (tieneSesionLocal) {
                console.log("🚀 [FastBoot] Detectada sesión local de Conductor. Bloqueando redirección.");
                if (!window.location.pathname.startsWith('/conductores') && !tieneSesionAdmin) {
                    window.history.pushState({}, '', '/conductores');
                    const session = JSON.parse(localStorage.getItem('xolvy_session'));
                    
                    // Identity Shield: Resolve identity before rendering content
                    IdentityShield.resolveAndBindIdentity(session?.nombre || session?.email || 'Usuario').then(async (identity) => {
                        const render = await loadConductor();
                        render(appContainer, identity.nombreCanonico, APP_VERSION, 'Conductor');
                    });
                }
                return; // CRITICAL: Stop execution here
            }

            // Protection for Admins (Correction 1)
            if (tieneSesionAdmin) {
                console.log("🛡️ [AdminGuard] Detectada intención Admin. Esperando inicialización de Auth...");
                setTimeout(() => {
                    if (!auth.currentUser) {
                        console.log("⚠️ [AdminGuard] Sesión Admin no confirmada tras delay. Redirigiendo a Login.");
                        localStorage.removeItem('demo_role');
                        window.history.replaceState({}, '', '/login');
                        loadLogin().then(render => render(appContainer, APP_VERSION));
                    }
                }, 1200); // 1.2s delay for safer initialization
                return; // CRITICAL: Stop execution here
            }

            // Standard Login Fallback
            window.XolvyApp.user = null;
            const render = await loadLogin();
            render(appContainer, APP_VERSION);
            return; // CRITICAL: Stop execution here
        }

        // CASE 2: User exists
        if (window._authSuspended || window._adminAuthSuspended) return;

        try {
            const contextPath = window.location.pathname;
            
            console.log("💎 [Auth] Active User Session:", user.email);
            
            // 2.1 Anonymous Sessions (Conductor Demo)
            if (user.isAnonymous) {
                if (window._fastBootRendered) return;
                const storedRole = localStorage.getItem('demo_role');
                const storedName = localStorage.getItem('selected_conductor_name');
                if (storedRole === 'Conductor') {
                    if (!contextPath.startsWith('/conductores')) window.history.replaceState({}, '', '/conductores');
                    
                    // Identity Shield: Bind current UID with found profile
                    await IdentityShield.resolveAndBindIdentity(storedName || 'Conductor');
                    
                    const render = await loadConductor();
                    render(appContainer, window.XolvyApp.identity.nombreCanonico, APP_VERSION, storedRole);
                    return;
                } else {
                    // Anonymous but no conductor role? Something is wrong, back to login.
                    console.warn("⚠️ [Auth] Sesión anónima sin rol de Conductor. Redirigiendo.");
                    await auth.signOut();
                    return;
                }
            }

            // 2.2 Global Authorization (Firestore Gated)
            // SIEMPRE verificar en Firestore — nunca confiar solo en el localStorage para Admin
            const permisos = await getPermisosUsuario(user.email);
            let role = permisos?.role; 

            // Integración de Identity Shield para Admins/Usuarios Autenticados
            try {
                const IdentityService = await import('./data/services/identity-service.js');
                // IMPORTANTE: Resolvemos preferentemente por el nombre en los permisos, ya que es el enlace con publicadores
                const identitySearchKey = permisos?.nombre || user.email;
                window.XolvyApp.identity = await IdentityService.IdentityShield.resolveAndBindIdentity(identitySearchKey);
            } catch (identityError) {
                console.warn("[Identity] Shield fallback activo", identityError);
            }

            // Actualizar estado global
            window.XolvyApp.user = {
                uid: user.uid,
                email: user.email,
                nombre: window.XolvyApp.identity?.nombreCanonico || permisos?.nombre || user.displayName || user.email,
                role: role || window.XolvyApp.identity?.rol || 'Visitante'
            };

            if (!role) {
                appContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-fade-in bg-gradient-to-br from-slate-50 via-white to-rose-50/30" style="min-height: 100vh; min-height: 100dvh;">
                        <div class="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center text-3xl mb-8 shadow-xl"><i class="fas fa-shield-alt"></i></div>
                        <h2 class="text-2xl font-black text-slate-800 uppercase tracking-tight">Acceso Bloqueado</h2>
                        <p class="text-slate-500 max-w-sm mt-4 font-bold text-sm">Tu cuenta (${user.email}) no tiene permisos asignados.</p>
                        <button onclick="localStorage.clear(); location.href='/'" class="mt-10 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px]">Cerrar Sesión</button>
                    </div>
                `;
                return;
            }

            // 2.3 Dashboard Routing
            const isAdmin = (role === 'Administrador' || role === 'SuperAdmin');
            const path = window.location.pathname;

            if (isAdmin && path.startsWith('/conductores')) {
                // Modo Simulacro: Si un administrador navega a /conductores, se le permite.
                console.log("🛡️ [Security] Admin entrando a vista Conductor (Modo Simulacro/Supervisión).");
                
                let storedName = localStorage.getItem('selected_conductor_name');
                if (!storedName && window.XolvyApp?.identity?.nombreCanonico) {
                    storedName = window.XolvyApp.identity.nombreCanonico;
                    localStorage.setItem('selected_conductor_name', storedName);
                    localStorage.setItem('demo_role', 'Conductor');
                }

                if (!storedName) {
                    appContainer.innerHTML = '';
                    const mLogin = await loadModule('login', './modules/login.js');
                    mLogin.renderConductorSelection();
                    return;
                }
                const render = await loadConductor();
                render(appContainer, storedName, APP_VERSION, role);
            } else if (isAdmin) {
                // CAMBIO 2: Limpiar sesión de Conductor al detectar Admin
                localStorage.removeItem('xolvy_session');
                localStorage.removeItem('selected_conductor_name');
                localStorage.setItem('demo_role', 'Administrador');

                const subPath = path.split('/')[2] || 'dashboard';
                const urlToTab = { 'territorios': 'casa-en-casa', 'predicacion': 'predicacion', 'telefonos': 'telefonos', 'config': 'config' };
                const tabId = urlToTab[subPath] || 'dashboard';
                const render = await loadAdmin();
                render(appContainer, APP_VERSION, tabId);
            } else {
                // Publicadores / Otros
                if (!window.location.pathname.startsWith('/conductores')) window.history.pushState({}, '', '/conductores');
                const render = await loadConductor();
                render(appContainer, user.email || 'Usuario', APP_VERSION, role);
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
        
        // Identity Shield: Secure identity before rendering heavy modules
        const identity = await IdentityShield.resolveAndBindIdentity(email);
        
        // Zero-Latency Execution: Enrutamiento en milisegundos ignorando latencia de red
        window._fastBootRendered = true;
        window.XolvyApp.user = { nombre: identity.nombreCanonico, email: email, role: 'Conductor' };
        if (!window.location.pathname.startsWith('/conductores')) window.history.pushState({}, '', '/conductores');
        
        const render = await loadConductor();
        render(appContainer, identity.nombreCanonico, APP_VERSION, role);
    });

    // CAMBIO 3: Listener Delegado Global para Logout de Conductor
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('#logout-btn');
        if (btn && window.location.pathname.startsWith('/conductores')) {
            console.log("👋 [Logout] Cerrando sesión de Conductor...");
            localStorage.removeItem('xolvy_session');
            localStorage.removeItem('selected_conductor_name');
            localStorage.removeItem('demo_role');
            
            // Limpiar la URL y recargar para volver al Login puro
            window.history.replaceState({}, '', '/conductores'); 
            window.location.reload();
        }
    });
});
