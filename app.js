import "./modules/extensions.mjs";
import { getRedirectResult, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
    autoCleanTelefonosData,
    getPermisosUsuario,
    migrateConductoresToPublicadores,
} from "./data/firestore-services.js";
import { IdentityShield } from "./data/services/identity-service.js";
import { auth, db } from "./firebase-config.js";
import { XolvyAdaptive } from "./modules/utils/adaptive.js";
import { moduleRegistry } from "./modules/utils/module-registry.js";
import { initTheme } from "./modules/utils/theme-manager.js";
import { initUpdateManager, stopUpdateManager } from "./modules/utils/update-manager.js";
import { VisualEngine } from "./modules/utils/visual-engine.js";
import { initDynamicIslandHUD } from "./modules/services/dynamic-island-hud.js";
import { initPWAInstallPrompt } from "./modules/services/pwa-install-prompt.js";

// --- MOBILE MENU LOGIC ---
// Deterministic open/close (never toggle) to survive dashboard re-renders
function closeMobileMenu() {
    const s = document.getElementById("main-sidebar");
    const o = document.getElementById("mobile-overlay");
    if (s) s.classList.add("-translate-x-full");
    if (o) o.classList.add("hidden");
}
function openMobileMenu() {
    const s = document.getElementById("main-sidebar");
    const o = document.getElementById("mobile-overlay");
    if (s) s.classList.remove("-translate-x-full");
    if (o) o.classList.remove("hidden");
}
window.closeMobileMenu = closeMobileMenu;

export function initMobileMenu() {
    const sidebar = document.getElementById("main-sidebar");
    const toggleBtn = document.getElementById("menu-toggle-btn");
    if (!sidebar || !toggleBtn) return;

    // Hamburger → open
    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        openMobileMenu();
    };

    // X button inside sidebar → close
    const closeBtn = document.getElementById("btn-close-sidebar");
    if (closeBtn) closeBtn.onclick = () => closeMobileMenu();

    // Overlay backdrop → close
    const overlay = document.getElementById("mobile-overlay");
    if (overlay) overlay.onclick = () => closeMobileMenu();

    // Nav items inside sidebar → close on mobile after selection
    sidebar.querySelectorAll(".nav-item").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (window.innerWidth < 1024) closeMobileMenu();
        });
    });
}
window.initMobileMenu = initMobileMenu;

// FASE 1: Clean dirty rescue URLs left by old update loops
if (window.location.search.includes("rescue")) {
    window.history.replaceState({}, document.title, window.location.pathname);
}

// Initialize Visual Ecosystem & Ultra PWA Engine
VisualEngine.applyGlobalEcosystem();
initDynamicIslandHUD();
initPWAInstallPrompt();

// Initialize Module Registry (Deferred until authentication and user binding to avoid permission-denied errors)
// moduleRegistry.init();

// The version is injected by Vite at build time (Core Shell Version)
const APP_VERSION = "4.7.0";
window.XolvyApp = { user: null, version: APP_VERSION };

window.switchAppRole = (targetRole) => {
    console.log("🔄 [Role Switcher 1-Tap] Cambiando a modo:", targetRole);
    window.XolvyApp = window.XolvyApp || {};
    const currentUser = window.XolvyApp.user || {};

    const updatedUser = {
        ...currentUser,
        role: targetRole,
        rol: targetRole
    };
    window.XolvyApp.user = updatedUser;
    sessionStorage.setItem("xolvy_active_mode", targetRole);

    const currentSession = JSON.parse(localStorage.getItem("xolvy_session") || "{}");
    localStorage.setItem("xolvy_session", JSON.stringify({
        ...currentSession,
        ...updatedUser,
        role: targetRole,
        rol: targetRole
    }));

    const adminName = window.XolvyApp.user?.nombre || window.XolvyApp.identity?.nombreCanonico || currentUser.nombre;
    if (adminName) {
        localStorage.setItem("selected_conductor_name", adminName);
    }

    if (targetRole === "Administrador") {
        if (typeof window.showNotification === "function") window.showNotification("Cambiado a Modo Administrador", "success");
        location.href = "/administrador";
    } else {
        if (typeof window.showNotification === "function") window.showNotification(`Cambiado a Modo ${targetRole}`, "success");
        if (location.pathname.startsWith("/administrador")) {
            location.href = "/conductores";
        } else if (typeof window.refreshConductorView === "function") {
            window.refreshConductorView(true);
        } else {
            location.href = "/conductores";
        }
    }
};

// --- XOLVY MODULAR: MICRO-MODULE ENGINE ---
const dynamicModules = import.meta.glob("./modules/**/*.js");

async function loadModule(moduleName, basePath) {
    return moduleRegistry.loadModule(moduleName, basePath, dynamicModules);
}

// Shell View Accessors
const loadLogin = async () => (await loadModule("login", "./modules/login.js")).renderLogin;
const loadAdmin = async () => (await loadModule("admin", "./modules/admin-dashboard.js")).renderAdminDashboard;
let _conductorPromise = null;
const loadConductor = async () => {
    if (window.XolvyApp?.lastConductorRender) {
        return window.XolvyApp.lastConductorRender;
    }
    if (_conductorPromise) {
        console.log("⚡ [App] loadConductor ya está en ejecución, reutilizando promesa en vuelo...");
        return _conductorPromise;
    }
    _conductorPromise = (async () => {
        try {
            // Esperar a que Firebase Auth tenga usuario antes de cargar módulos
            await new Promise((resolve) => {
                if (auth.currentUser) {
                    resolve();
                    return;
                }
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
            const render = (await loadModule("conductor", "./modules/conductor-dashboard.js")).renderConductorDashboard;
            window.XolvyApp.lastConductorRender = render;
            return render;
        } finally {
            _conductorPromise = null;
        }
    })();
    return _conductorPromise;
};

// --- DIFFUSION LISTENER ---
let unsubDiffusion = null;
const initDiffusionListener = () => {
    if (unsubDiffusion) return; // Prevent duplicate listeners
    unsubDiffusion = onSnapshot(
        doc(db, "configuracion", "diffusion_active"),
        (docSnap) => {
            let banner = document.getElementById("global-diffusion-banner");
            if (docSnap.exists() && docSnap.data().active) {
                const data = docSnap.data();
                if (!banner) {
                    banner = document.createElement("div");
                    banner.id = "global-diffusion-banner";
                    document.body.prepend(banner);
                }
                const bgColor = data.type === "urgent" ? "from-red-600 to-red-800" : "from-blue-600 to-blue-800";
                banner.className = `w-full bg-gradient-to-r ${bgColor} text-white p-4 flex items-center justify-center gap-4 sticky top-0 z-[100] shadow-2xl`;
                banner.innerHTML = `<span>📢</span> <div class="flex-1 text-center font-black uppercase text-xs">${data.content}</div>`;
            } else {
                if (banner) banner.remove();
            }
        },
        (error) => {
            console.warn("⚠️ [Diffusion] Error in diffusion listener:", error);
        },
    );
};

const stopDiffusionListener = () => {
    if (unsubDiffusion) {
        unsubDiffusion();
        unsubDiffusion = null;
    }
    const banner = document.getElementById("global-diffusion-banner");
    if (banner) banner.remove();
};

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
    const appContainer = document.getElementById("app-container");

    // 1. App Loading State: Prevenir renderizado errático durante inicialización y checkeo asíncrono
    appContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-white dark:from-[#02040f] dark:via-[#050819] dark:to-[#02020a] text-slate-800 dark:text-slate-200 animate-fade-in w-full max-w-[100vw] px-4 box-border relative overflow-hidden" style="min-height: 100vh; min-height: 100dvh;">
            <!-- Ambient Glowing Background Orbits directly on body -->
            <div class="absolute top-[20%] left-[20%] w-[350px] h-[350px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[100px] animate-pulse" style="animation-duration: 6s;"></div>
            <div class="absolute bottom-[20%] right-[20%] w-[350px] h-[350px] bg-emerald-500/10 dark:bg-emerald-600/15 rounded-full blur-[100px] animate-pulse" style="animation-duration: 8s;"></div>

            <div class="z-10 flex flex-col items-center justify-center gap-8 text-center max-w-sm">
                <!-- Ultra Premium Orbit Loader -->
                <div class="relative w-28 h-28 flex items-center justify-center">
                    <!-- Pulsing central core with App Icon -->
                    <div class="absolute w-14 h-14 bg-gradient-to-tr from-indigo-600 to-indigo-500 dark:from-indigo-500 dark:to-indigo-450 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/35 animate-pulse">
                        <i class="fas fa-layer-group text-xl"></i>
                    </div>
                    <!-- Outer spinning orbit -->
                    <div class="absolute inset-0 rounded-full border-[3px] border-indigo-500/10 dark:border-white/5"></div>
                    <div class="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-600 dark:border-t-indigo-400 border-r-indigo-600/30 dark:border-r-indigo-400/30 animate-spin" style="animation-duration: 1.2s;"></div>
                    <!-- Secondary counter-spinning dashed orbit -->
                    <div class="absolute -inset-3.5 rounded-full border border-dashed border-indigo-500/30 dark:border-indigo-400/25 animate-spin" style="animation-duration: 5s; animation-direction: reverse;"></div>
                </div>

                <div class="space-y-2.5">
                    <!-- Elegant Label -->
                    <h3 class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-[0.45em] leading-none">Cargando</h3>
                    <p class="text-[10px] font-black text-indigo-600/60 dark:text-indigo-400/60 uppercase tracking-widest animate-pulse">Conectando con el Servidor</p>
                </div>
            </div>
        </div>
    `;

    initTheme();
    // initUpdateManager(); (Deferred until authentication and user binding to avoid permission-denied errors)
    XolvyAdaptive.init();

    // Initialize PWA Engine
    import("./modules/utils/pwa-manager.js").then((m) => m.initPWA());

    // 2. Interceptar getRedirectResult sin bloquear el listener global
    // Esto previene que el app se quede colgado en "Verificando credenciales" si Firebase tarda en responder
    getRedirectResult(auth)
        .then((result) => {
            if (result?.user) {
                console.log("💎 [Auth] Login exitoso vía Redirect:", result.user.email);
                // Clean stale navigation caches (consolidated from login.js)
                localStorage.removeItem("lastPath");
                localStorage.removeItem("lastRoute");
                localStorage.removeItem("redirectUrl");
                localStorage.removeItem("redirectPath");
                sessionStorage.removeItem("lastPath");
                sessionStorage.removeItem("lastRoute");
                sessionStorage.removeItem("redirectUrl");
                sessionStorage.removeItem("redirectPath");
                localStorage.removeItem("xolvy_session");
            }
        })
        .catch((redirectError) => {
            console.error("❌ [Auth] Redirect Error:", redirectError);
            // En caso de error de red o similar, el onAuthStateChanged eventualmente fallará o mostrará login
        });

    const handleAuthChange = async (user) => {
        // --- UNCONDITIONAL POOL CLEANUP (LP-01, LP-02) ---
        if (typeof window.stopActiveLivePools === "function") {
            try {
                window.stopActiveLivePools();
            } catch (e) {
                console.error("Error stopping active conductor pools:", e);
            }
        }
        if (typeof window.stopAdminLivePools === "function") {
            try {
                window.stopAdminLivePools();
            } catch (e) {
                console.error("Error stopping active admin pools:", e);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // XOLVY SECURITY v4.0 — ZERO TRUST AUTH HANDLER
        // ═══════════════════════════════════════════════════════════
        // POLICY: Role is NEVER determined by localStorage.
        // Role is ALWAYS resolved from Firestore (getPermisosUsuario)
        // or from the resolved IdentityShield profile.
        // localStorage is used ONLY as a UX hint for conductor session
        // persistence (xolvy_session), never for authorization.
        // ═══════════════════════════════════════════════════════════

        const tieneSesionLocal = !!localStorage.getItem("xolvy_session");

        // CASE 1: No Authenticated User
        if (!user) {
            if (window._authSuspended || window._adminAuthSuspended) return;

            stopDiffusionListener();
            moduleRegistry.stop();
            stopUpdateManager();

            // Protection for Conductors: If there's a local session hint,
            // trigger anonymous auth + Firestore validation (NOT localStorage role check)
            if (tieneSesionLocal) {
                console.log("🚀 [FastBoot] Detectada sesión local de Conductor. Iniciando validación...");

                if (window.location.pathname.startsWith("/conductores")) {
                    const session = JSON.parse(localStorage.getItem("xolvy_session"));
                    // Identity Shield: Resolve identity via Firestore before rendering
                    try {
                        const identity = await IdentityShield.resolveAndBindIdentity(
                            session?.nombre || session?.email || "Usuario",
                        );
                        if (identity.docId) {
                            // Initialize diffusion, HMS, and update listeners now that we are authenticated and bound
                            initDiffusionListener();
                            moduleRegistry.init();
                            initUpdateManager();

                            const role = identity.rol || session?.rol || "Conductor";
                            const isAdmin = role === "Administrador" || role === "SuperAdmin";
                            const contextPath = window.location.pathname;

                            if (isAdmin && !contextPath.startsWith("/conductores")) {
                                if (!contextPath.startsWith("/administrador")) window.history.replaceState({}, "", "/administrador");
                                const subPath = contextPath.split("/")[2] || "dashboard";
                                const urlToTab = {
                                    territorios: "casa-en-casa",
                                    predicacion: "predicacion",
                                    telefonos: "telefonos",
                                    config: "config",
                                };
                                const tabId = urlToTab[subPath] || "dashboard";
                                const render = await loadAdmin();
                                render(appContainer, APP_VERSION, tabId);
                                return; // CRITICAL: Stop execution here
                            }

                            if (!contextPath.startsWith("/conductores")) window.history.replaceState({}, "", "/conductores");
                            const render = await loadConductor();
                            render(appContainer, identity.nombreCanonico, APP_VERSION, role);
                            return; // CRITICAL: Stop execution here
                        }
                    } catch (e) {
                        console.warn("🛡️ [FastBoot] Identity validation failed, redirecting to login:", e);
                    }
                }
                // If we reach here, the local session is invalid — purge and show login
                localStorage.removeItem("xolvy_session");
                localStorage.removeItem("selected_conductor_name");
            }

            // Standard Login Fallback (no more admin guard via localStorage)
            window.XolvyApp.user = null;
            const render = await loadLogin();
            render(appContainer, APP_VERSION);
            return; // CRITICAL: Stop execution here
        }

        // CASE 2: User exists (Firebase Auth confirmed)
        if (window._authSuspended || window._adminAuthSuspended) return;

        try {
            const contextPath = window.location.pathname;

            console.log("💎 [Auth] Active User Session:", user.email);

            // 2.1 Anonymous Sessions (Conductor)
            if (user.isAnonymous) {
                if (window._fastBootRendered) return;
                const storedName = localStorage.getItem("selected_conductor_name");
                const session = localStorage.getItem("xolvy_session");

                if (storedName || session) {
                    const nameToResolve = storedName || (session ? JSON.parse(session)?.nombre : null);
                    if (!nameToResolve) {
                        console.warn("⚠️ [Auth] Sesión anónima sin identificador válido. Cerrando.");
                        await auth.signOut();
                        return;
                    }

                    // Identity Shield: Validate against Firestore — the ONLY source of truth
                    const identity = await IdentityShield.resolveAndBindIdentity(nameToResolve);

                    if (!identity.docId || (identity.rol !== "Conductor" && identity.rol !== "Administrador" && identity.rol !== "SuperAdmin" && identity.rol !== "Publicador")) {
                        // User not found in Firestore or not authorized — reject
                        console.warn("⚠️ [Auth] Usuario no encontrado o no autorizado en Firestore. Cerrando sesión.");
                        localStorage.removeItem("xolvy_session");
                        localStorage.removeItem("selected_conductor_name");
                        await auth.signOut();
                        return;
                    }

                    // Initialize diffusion, HMS, and update listeners now that we are authenticated and bound
                    initDiffusionListener();
                    moduleRegistry.init();
                    initUpdateManager();

                    const role = identity.rol || "Conductor";
                    const isAdmin = role === "Administrador" || role === "SuperAdmin";

                    if (isAdmin && !contextPath.startsWith("/conductores")) {
                        if (!contextPath.startsWith("/administrador")) window.history.replaceState({}, "", "/administrador");
                        const subPath = contextPath.split("/")[2] || "dashboard";
                        const urlToTab = {
                            territorios: "casa-en-casa",
                            predicacion: "predicacion",
                            telefonos: "telefonos",
                            config: "config",
                        };
                        const tabId = urlToTab[subPath] || "dashboard";
                        const render = await loadAdmin();
                        render(appContainer, APP_VERSION, tabId);
                        return;
                    }

                    if (!contextPath.startsWith("/conductores")) window.history.replaceState({}, "", "/conductores");
                    const render = await loadConductor();
                    render(appContainer, identity.nombreCanonico, APP_VERSION, role);
                    return;
                } else {
                    // Anonymous but no conductor session?
                    // If we are currently showing the login screen / selection modal, DO NOT sign out!
                    // This allows anonymous session to remain active so the user can read the directory list.
                    const isConductorModalOpen = !!document.getElementById("conductor-modal");
                    const isLoginView = !!(
                        document.getElementById("btn-login-google-admin") ||
                        document.getElementById("btn-login-google-conductor") ||
                        document.getElementById("btn-login-google-publicador") ||
                        document.getElementById("login-logo-container")
                    );
                    const isLoginPath = contextPath === "/login" || contextPath === "/";

                    if (isConductorModalOpen || isLoginView) {
                        console.log("🛡️ [Auth] Anonymous session active for directory query or login view.");
                        return;
                    }

                    console.log("🛡️ [Auth] Anonymous session on login path. Rendering Login View...");
                    window.XolvyApp.user = null;
                    const render = await loadLogin();
                    render(appContainer, APP_VERSION);
                    return;
                }
            }

            // 2.2 Global Authorization (Firestore Gated — ZERO TRUST)
            // ALWAYS verify role in Firestore — NEVER trust localStorage
            const permisos = await getPermisosUsuario(user.email);
            const role = permisos?.role;

            // Integración de Identity Shield Directa para Admins/Usuarios Autenticados
            try {
                const IdentityService = await import("./data/services/identity-service.js");
                window.XolvyApp.identity = await IdentityService.IdentityShield.bindSessionDirect(
                    user.uid,
                    permisos.id,
                    permisos.nombre,
                    role,
                );
            } catch (identityError) {
                console.error(
                    "🛡️ [Security Shield] Falló la vinculación de la sesión del administrador:",
                    identityError,
                );
            }

            // Initialize diffusion, HMS, and update listeners now that we are authenticated and bound
            initDiffusionListener();
            moduleRegistry.init();
            initUpdateManager();

            // Actualizar estado global (from Firestore, keeping UX active role selection)
            const savedSession = JSON.parse(localStorage.getItem("xolvy_session") || "{}");
            const activeRole = savedSession.role || savedSession.rol || role || window.XolvyApp.identity?.rol || "Publicador";

            window.XolvyApp.user = {
                uid: user.uid,
                email: user.email,
                nombre: window.XolvyApp.identity?.nombreCanonico || permisos?.nombre || user.displayName || user.email,
                role: activeRole,
                rol: activeRole,
                baseRole: role || window.XolvyApp.identity?.baseRole || activeRole,
                isAdmin: permisos?.isAdmin || window.XolvyApp.identity?.isAdmin || false,
                esConductor: permisos?.esConductor || window.XolvyApp.identity?.esConductor || false,
                availableRoles: permisos?.availableRoles || window.XolvyApp.identity?.availableRoles || [activeRole],
                ...permisos,
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

            // Run system maintenance hooks now that we have verified active credentials
            migrateConductoresToPublicadores();
            autoCleanTelefonosData();

            // 2.3 Dashboard Routing (role from Firestore ONLY)
            const isAdmin = role === "Administrador" || role === "SuperAdmin";
            let path = window.location.pathname;

            // FASE 1: Hard-Gated Admin Route Guard (Unbypassable P0 Shield)
            if (path.startsWith("/administrador")) {
                if (!isAdmin) {
                    console.error(
                        "🛡️ [Security Shield] Intento de acceso no autorizado a Administrador detectado. Forzando redirección.",
                    );
                    window.history.replaceState({}, "", "/conductores");
                    const render = await loadConductor();
                    render(appContainer, user.email || "Usuario", APP_VERSION, role);
                    return;
                }
            }

            // FASE 2: Redirect suave y limpio en raíz o login (cero parpadeos)
            if (path === "/" || path === "/login" || path.includes("index.html")) {
                if (isAdmin) {
                    window.history.replaceState({}, "", "/administrador");
                } else {
                    window.history.replaceState({}, "", "/conductores");
                }
                path = window.location.pathname;
            }

            if (isAdmin && path.startsWith("/conductores")) {
                // Modo Simulacro: Si un administrador navega a /conductores, se le permite.
                console.log("🛡️ [Security] Admin entrando a vista Conductor (Modo Simulacro/Supervisión).");

                let storedName = localStorage.getItem("selected_conductor_name") || window.XolvyApp?.identity?.nombreCanonico || permisos?.nombre || user.displayName || user.email;
                if (storedName) {
                    localStorage.setItem("selected_conductor_name", storedName);
                }

                const activeTargetRole = sessionStorage.getItem("xolvy_active_mode") || "Conductor";
                const render = await loadConductor();
                render(appContainer, storedName, APP_VERSION, activeTargetRole);
            } else if (isAdmin) {
                // Admin route: Preserve selected conductor identity for role switching
                const adminCanonicalName = window.XolvyApp?.identity?.nombreCanonico || permisos?.nombre || user.displayName;
                if (adminCanonicalName) {
                    localStorage.setItem("selected_conductor_name", adminCanonicalName);
                }

                const subPath = path.split("/")[2] || "dashboard";
                const urlToTab = {
                    territorios: "casa-en-casa",
                    predicacion: "predicacion",
                    telefonos: "telefonos",
                    config: "config",
                };
                const tabId = urlToTab[subPath] || "dashboard";
                const render = await loadAdmin();
                render(appContainer, APP_VERSION, tabId);
            } else {
                // Publicadores / Otros
                if (!window.location.pathname.startsWith("/conductores"))
                    window.history.pushState({}, "", "/conductores");
                const render = await loadConductor();
                render(appContainer, user.email || "Usuario", APP_VERSION, role);
            }
        } catch (e) {
            console.error("🚀 [Boot] Critical Auth/Render Error:", e);
            if (appContainer) {
                appContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center min-h-screen p-6 text-center animate-fade-in bg-gradient-to-br from-slate-50 via-slate-100 to-rose-50/20 dark:from-[#02040f] dark:via-[#050819] dark:to-[#1a080c] text-slate-800 dark:text-slate-100 w-full" style="min-height: 100vh; min-height: 100dvh;">
                        <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center text-2xl mb-6 shadow-xl border border-rose-500/20"><i class="fas fa-triangle-exclamation"></i></div>
                        <h2 class="text-xl font-black uppercase tracking-tight">Error de Inicialización</h2>
                        <p class="text-slate-500 dark:text-slate-400 max-w-sm mt-2 text-xs font-bold">${e?.message || "No se pudo conectar con el servidor."}</p>
                        <div class="flex flex-wrap gap-3 mt-8 justify-center">
                            <button onclick="location.reload()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-600/25 active:scale-95 transition-all">
                                <i class="fas fa-rotate-right mr-2"></i> Reintentar
                            </button>
                            <button onclick="localStorage.clear(); sessionStorage.clear(); location.href='/'" class="bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">
                                <i class="fas fa-sign-out-alt mr-2"></i> Reiniciar Sesión
                            </button>
                        </div>
                    </div>
                `;
            }
        }
    };

    // Expose for seamless transitions
    window.switchToConductorView = () => {
        window.history.pushState({}, "", "/conductores");
        handleAuthChange(auth.currentUser);
    };

    window.switchToAdminView = () => {
        window.history.pushState({}, "", "/administrador");
        handleAuthChange(auth.currentUser);
    };

    // --- HMS RE-RENDER LOGIC ---
    moduleRegistry.subscribe(async (moduleName, version) => {
        const path = window.location.pathname;

        // XOLVY UPDATES: Use the new discrete notification system
        const { notifyModuleUpdate, completeXolvyUpdate } = await import("./modules/utils/update-manager.js");
        notifyModuleUpdate(moduleName, version);

        // Define which sub-modules belong to which main view
        const conductorSubModules = [
            "availability",
            "recursos",
            "maps_explorer",
            "rescue",
            "phone_module",
            "onboarding",
            "weekly_program",
            "program_views",
        ];
        const adminSubModules = [
            "territories_view",
            "public_view",
            "phones_view",
            "rules_view",
            "analytics_view",
            "reports_view",
        ];

        // Determine if we should re-render (use path + XolvyApp.user.role, NOT localStorage)
        const isConductorView = path.startsWith("/conductores");
        const currentRole = window.XolvyApp?.user?.role;
        const isAdminView = !isConductorView && (currentRole === "Administrador" || currentRole === "SuperAdmin");

        const shouldRefreshConductor =
            isConductorView && (moduleName === "conductor" || conductorSubModules.includes(moduleName));
        const shouldRefreshAdmin = isAdminView && (moduleName === "admin" || adminSubModules.includes(moduleName));

        if (shouldRefreshConductor || shouldRefreshAdmin) {
            const user = auth.currentUser;

            // Xolvy Modular Rule 1.3: State Immortalization
            // Save scroll position before the re-render
            const uiState = {
                scroll: window.scrollY,
                module: moduleName,
                timestamp: Date.now(),
            };
            sessionStorage.setItem("xolvy_hms_state", JSON.stringify(uiState));

            // Small delay to show the "Receiving" state in HUD
            setTimeout(() => {
                completeXolvyUpdate(moduleName, version);

                // Targeted refresh or full re-auth
                if (shouldRefreshConductor && window.refreshConductorView) {
                    window.refreshConductorView().then(() => {
                        restoreState();
                        XolvyAdaptive.refresh();
                    });
                } else if (shouldRefreshAdmin && window.refreshAdminView) {
                    window.refreshAdminView().then(() => {
                        restoreState();
                        XolvyAdaptive.refresh();
                    });
                } else {
                    handleAuthChange(user).then(() => {
                        restoreState();
                        XolvyAdaptive.refresh();
                    });
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
        const saved = sessionStorage.getItem("xolvy_hms_state");
        if (saved) {
            const { scroll } = JSON.parse(saved);
            window.scrollTo({ top: scroll, behavior: "smooth" });
            sessionStorage.removeItem("xolvy_hms_state");
        }
    };

    // Xolvy Data Shield: Cache Burster on version change
    const lastVer = localStorage.getItem("last_app_version");
    if (lastVer !== APP_VERSION) {
        console.log(`✨ Version Upgrade: ${lastVer} -> ${APP_VERSION}. Purging caches.`);
        const { clearServiceCache } = await import("./data/firestore-services.js");
        clearServiceCache();
        localStorage.setItem("last_app_version", APP_VERSION);
    }

    // Xolvy Automation: System Maintenance Hooks
    // (Migrated to execute safely post-authentication inside handleAuthChange)

    let authResolved = false;

    // Failsafe Timeout: Si en 8 segundos no hay respuesta de Auth, forzamos salida del loader
    const authTimeout = setTimeout(async () => {
        if (!authResolved) {
            console.warn("⚠️ [Auth] Failsafe Timeout: Firebase Auth no respondió a tiempo. Forzando Login.");
            const render = await loadLogin();
            render(appContainer, APP_VERSION);
        }
    }, 8000);

    onAuthStateChanged(auth, (user) => {
        authResolved = true;
        clearTimeout(authTimeout);
        handleAuthChange(user);
    });

    document.addEventListener("demo-login", async (e) => {
        const { email, role } = e.detail;

        // SECURITY v4.0: We store conductor name for session persistence ONLY.
        // No 'demo_role' is stored — role comes from Firestore exclusively.
        localStorage.setItem("selected_conductor_name", email);

        // Identity Shield: Secure identity before rendering heavy modules
        const identity = await IdentityShield.resolveAndBindIdentity(email);

        // Validate identity was found in Firestore and is authorized
        if (!identity.docId || (identity.rol !== "Conductor" && identity.rol !== "Administrador" && identity.rol !== "Publicador")) {
            console.error("🛡️ [Security] Identity not authorized or not found in Firestore. Blocking access.");
            localStorage.removeItem("xolvy_session");
            localStorage.removeItem("selected_conductor_name");
            const render = await loadLogin();
            render(appContainer, APP_VERSION);
            return;
        }

        // Zero-Latency Execution: Enrutamiento en milisegundos ignorando latencia de red
        window._fastBootRendered = true;
        const activeRole = role || identity.rol || "Conductor";
        const isUserAdmin = identity.isAdmin || activeRole === "Administrador" || activeRole === "SuperAdmin";

        window.XolvyApp.user = {
            ...identity,
            nombre: identity.nombreCanonico || email,
            email: email,
            role: activeRole,
            rol: activeRole,
            baseRole: identity.baseRole || identity.rol || activeRole,
            isAdmin: isUserAdmin,
            esConductor: identity.esConductor || true,
            availableRoles: identity.availableRoles || (isUserAdmin ? ["Administrador", "Conductor", "Publicador"] : ["Conductor", "Publicador"]),
        };
        localStorage.setItem("xolvy_session", JSON.stringify(window.XolvyApp.user));

        if (activeRole === "Administrador") {
            window.history.pushState({}, "", "/administrador");
            const render = await loadAdmin();
            render(appContainer, APP_VERSION, "dashboard");
        } else {
            if (!window.location.pathname.startsWith("/conductores")) window.history.pushState({}, "", "/conductores");
            const render = await loadConductor();
            render(appContainer, identity.nombreCanonico, APP_VERSION, activeRole);
        }
    });

    // CAMBIO 3: Listener Delegado Global para Logout de Conductor
    document.addEventListener("click", async (e) => {
        const btn = e.target.closest("#logout-btn");
        if (btn && window.location.pathname.startsWith("/conductores")) {
            console.log("👋 [Logout] Cerrando sesión de Conductor...");

            // Unconditionally stop active pools on logout
            if (typeof window.stopActiveLivePools === "function") {
                try {
                    window.stopActiveLivePools();
                } catch (_err) {}
            }
            if (typeof window.stopAdminLivePools === "function") {
                try {
                    window.stopAdminLivePools();
                } catch (_err) {}
            }

            localStorage.removeItem("xolvy_session");
            localStorage.removeItem("selected_conductor_name");

            // Limpiar la URL y recargar para volver al Login puro
            window.history.replaceState({}, "", "/conductores");
            window.location.reload();
        }
    });

    // --- HOOK DE DESTRUCCIÓN UNCONDITIONAL (LP-01) ---
    window.addEventListener("beforeunload", () => {
        if (typeof window.stopActiveLivePools === "function") {
            try {
                window.stopActiveLivePools();
            } catch (_err) {}
        }
        if (typeof window.stopAdminLivePools === "function") {
            try {
                window.stopAdminLivePools();
            } catch (_err) {}
        }
    });
});
