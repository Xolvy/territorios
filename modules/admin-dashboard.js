import { getConfiguracion, getSystemVersion, setSystemVersion } from "../data/firestore-services.js";
import { auth } from "../firebase-config.js";
import { XolvyAdaptive } from "./utils/adaptive.js";
import { showNotification } from "./utils/helpers.js";
import { moduleRegistry } from "./utils/module-registry.js";

// --- MICRO-MODULE LOADER ---
const dynamicSubModules = import.meta.glob("./**/*.js");

let currentAdminLivePoolUnsubscribe = null;

export const stopAdminLivePools = () => {
    if (currentAdminLivePoolUnsubscribe) {
        if (typeof currentAdminLivePoolUnsubscribe === "function") {
            currentAdminLivePoolUnsubscribe();
        } else if (Array.isArray(currentAdminLivePoolUnsubscribe)) {
            currentAdminLivePoolUnsubscribe.forEach((unsub) => unsub?.());
        }
        currentAdminLivePoolUnsubscribe = null;
    }
};
window.stopAdminLivePools = stopAdminLivePools;

export const setAdminLivePool = (unsub) => {
    stopAdminLivePools();
    currentAdminLivePoolUnsubscribe = unsub;
};

async function loadSubModule(name, path) {
    return moduleRegistry.loadModule(name, path, dynamicSubModules);
}

/**
 * Main Entry Point for the Administration Control Panel
 * Refactored in 2026 for modular architecture and performance.
 */
const renderSkeleton = (container) => {
    container.innerHTML = `
        <div class="p-10 space-y-12 animate-pulse">
            <div class="flex flex-col sm:flex-row justify-between items-center gap-6">
                <div class="h-10 w-64 bg-slate-100 dark:bg-white/5 rounded-2xl"></div>
                <div class="h-12 w-48 bg-slate-100 dark:bg-white/5 rounded-2xl"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="h-64 bg-slate-100 dark:bg-white/5 rounded-[2.5rem]"></div>
                <div class="h-64 bg-slate-100 dark:bg-white/5 rounded-[2.5rem]"></div>
                <div class="h-64 bg-slate-100 dark:bg-white/5 rounded-[2.5rem]"></div>
            </div>
            <div class="h-[500px] bg-slate-100 dark:bg-white/5 rounded-[3rem]"></div>
        </div>
    `;
};

const renderNavItem = (id, icon, label, active) => `
    <button class="nav-item ${active ? "active" : ""} flex-1 min-w-0 lg:flex-initial flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-4 p-3 lg:p-4 rounded-xl transition-all group border ${active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent" : "border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium"}" data-tab="${id}">
        <i class="${icon} stroke-1.5 text-lg transition-transform group-hover:scale-110 shrink-0 ${active ? "text-emerald-600 dark:text-emerald-400" : ""}"></i>
        <span class="sidebar-text text-[8px] lg:text-[10px] font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis max-w-full">${label}</span>
    </button>
`;

const loadTab = async (tabName, appVersion, configData = null) => {
    const contentDiv = document.getElementById("admin-content");
    stopAdminLivePools(); // Clean up previous listeners
    // Also clean up per-territory timeline live pools (Xolvy Live Pool)
    if (typeof window._stopAllTimelineLivePools === "function") {
        window._stopAllTimelineLivePools();
    }
    renderSkeleton(contentDiv);

    try {
        // Fallback for direct calls that might miss configData
        const config = configData || (await getConfiguracion());

        switch (tabName) {
            case "config": {
                const mRules = await loadSubModule("rules_view", "./admin/rules-view.js");
                await mRules.renderConfigTab(contentDiv, config, appVersion, (tabId) =>
                    loadTab(tabId, appVersion, config),
                );
                break;
            }
            case "casa-en-casa": {
                const mTerrs = await loadSubModule("territories_view", "./admin/territories-view.js");
                await mTerrs.renderCasaEnCasaTab(contentDiv, config, appVersion);
                break;
            }
            case "predicacion": {
                const mPublic = await loadSubModule("public_view", "./admin/public-view.js");
                await mPublic.renderPredicacionTab(contentDiv, config);
                break;
            }
            case "telefonos": {
                const mPhones = await loadSubModule("phones_view", "./admin/phones-view.js");
                await mPhones.renderTelefonosTab(contentDiv, config);
                break;
            }
            case "reportes": {
                const mReports = await loadSubModule("reports_view", "./admin/reports-view.js");
                await mReports.renderReportsTab(contentDiv, config, appVersion);
                break;
            }
            case "recursos": {
                const mRecs = await loadSubModule("resources_view", "./admin/resources-view.js");
                await mRecs.renderRecursosTab(contentDiv, config, appVersion);
                break;
            }
            case "personal": {
                const mPers = await loadSubModule("personal_view", "./admin/personal-view.js");
                await mPers.renderPersonalTab(contentDiv, config, appVersion);
                break;
            }
            case "difusion": {
                const mDiff = await loadSubModule("diffusion_view", "./admin/diffusion-view.js");
                await mDiff.renderDiffusionTab(contentDiv, config, appVersion, (tabId) =>
                    loadTab(tabId, appVersion, config),
                );
                break;
            }
            default: {
                const mAnalytics = await loadSubModule("analytics_view", "./analytics-view.js");
                await mAnalytics.renderAnalyticsView(contentDiv, appVersion, config);
                break;
            }
        }
        XolvyAdaptive.refresh();
    } catch (e) {
        contentDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center py-32 text-center space-y-4">
                <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center text-2xl"><i class="fas fa-triangle-exclamation"></i></div>
                <h4 class="text-sm font-black uppercase text-slate-800 dark:text-white">Error de Carga</h4>
                <p class="text-xs text-slate-600 dark:text-slate-400 max-w-xs">${e.message}</p>
                <div class="flex flex-wrap justify-center gap-3 mt-4">
                    <button onclick="location.reload()" class="bg-primary px-8 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95">
                        <i class="fas fa-sync-alt mr-2"></i> Reintentar
                    </button>
                </div>
            </div>
        `;
    }
};

const setupNavigation = (appVersion, configData) => {
    // Logout Logic (Deep Session Purge)
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.onclick = null; // Purge any existing
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            console.log("🛡️ [AdminHub] Invocando Cierre de Sesión Blindado...");

            // 1. Detener todos los Live Pools activos
            if (typeof window.stopActiveLivePools === "function") {
                window.stopActiveLivePools();
            }
            if (typeof stopAdminLivePools === "function") {
                stopAdminLivePools();
            }

            // 2. Limpieza profunda de LocalStorage
            localStorage.removeItem("xolvy_session");
            localStorage.removeItem("phone_session_active");
            localStorage.removeItem("selected_conductor_name");
            localStorage.clear(); // Safe bet for hard reset

            // 3. Firebase SignOut
            await auth.signOut();

            // 4. Redirección final
            location.href = "/login";
        });
    }

    const tabs = document.querySelectorAll(".nav-item");
    tabs.forEach((btn) => {
        btn.onclick = (e) => {
            // EXCLUSIÓN MUTUA v2.9
            const currentTab = e.currentTarget.dataset.tab;
            tabs.forEach((t) => {
                const isActive = t.dataset.tab === currentTab;

                if (isActive) {
                    t.className = `nav-item active flex-1 min-w-0 lg:flex-initial flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-4 p-3 lg:p-4 rounded-xl transition-all group border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent`;
                    const icon = t.querySelector("i");
                    if (icon)
                        icon.className =
                            icon.className.replace(/text-slate-500/g, "").replace(/dark:text-slate-400/g, "") +
                            " text-emerald-600 dark:text-emerald-400";
                } else {
                    t.className = `nav-item flex-1 min-w-0 lg:flex-initial flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-4 p-3 lg:p-4 rounded-xl transition-all group border border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium`;
                    const icon = t.querySelector("i");
                    if (icon)
                        icon.className = icon.className
                            .replace(/text-emerald-600/g, "")
                            .replace(/dark:text-emerald-400/g, "");
                }
            });

            const target = e.currentTarget;
            const tabId = target.dataset.tab;
            const urlMap = {
                dashboard: "dashboard",
                "casa-en-casa": "territorios",
                predicacion: "predicacion",
                telefonos: "telefonos",
                reportes: "reportes",
                recursos: "recursos",
                personal: "publicadores",
                config: "config",
            };

            window.history.pushState({}, "", `/administrador/${urlMap[tabId] || "dashboard"}`);
            loadTab(tabId, appVersion, configData);
            XolvyAdaptive.refresh();
        };
    });
};

export const renderAdminDashboard = async (container, appVersion, initialTab = "dashboard") => {
    try {
        window.isAdminMode = true;

        // --- GLOBAL ADMIN HELPERS ---
        window.editHistoryRecord = async (id) => {
            const { editHistoryRecord } = await import("./admin/history-view.js");
            await editHistoryRecord(id);
        };

        window.deleteHistoryRecordUI = async (id, cond, num) => {
            const { deleteHistoryRecordUI } = await import("./admin/history-view.js");
            await deleteHistoryRecordUI(id, cond, num);
        };

        // --- CONFIGURATION SINGLETON ---
        const configData = await getConfiguracion();

        window.dispatchModuleSync = () => {
            const currentTab = document.querySelector(".nav-item.active")?.dataset.tab;
            if (currentTab) loadTab(currentTab, appVersion, configData);
        };

        window.refreshAdminView = async () => {
            const currentTab = document.querySelector(".nav-item.active")?.dataset.tab || initialTab;
            await loadTab(currentTab, appVersion, configData);
        };

        // --- VERSION SYNCHRONIZATION ---
        if (appVersion) {
            getSystemVersion()
                .then(async (remoteVer) => {
                    if (appVersion !== remoteVer) {
                        console.log(`[Auto - Update] System Bump: ${remoteVer} -> ${appVersion} `);
                        await setSystemVersion(appVersion);
                    }
                })
                .catch((e) => console.warn("Version check skipped", e));
        }

        const displayName = window.XolvyApp?.identity?.nombreCanonico || window.XolvyApp?.user?.nombre || localStorage.getItem("selected_conductor_name") || auth.currentUser?.displayName || "Administrador";

        // --- MAIN SHELL RENDER ---
        container.innerHTML = `
    <div class="flex flex-col w-full overflow-hidden bg-slate-50 dark:bg-[#05070a] animate-fade-in" style="height:100vh;height:100dvh;" data-adaptive-container="true">
        <header class="flex items-center justify-between bg-white/40 dark:bg-[#030712]/40 backdrop-blur-xl border-b border-slate-200/10 dark:border-white/5 sticky top-0 z-40 shadow-sm p-4 lg:hidden flex-none transition-colors duration-300">
            <button id="menu-toggle-btn" class="p-2 text-amber-500 focus:outline-none active:scale-95 transition-transform">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div class="flex items-center gap-2">
                <span class="text-amber-400 text-sm">❖</span>
                <span class="text-slate-800 dark:text-white font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase">CONGREGACIÓN "NUEVE DE OCTUBRE"</span>
            </div>
            <div class="flex items-center gap-2 relative z-10 shrink-0">
                 <div class="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <span class="relative flex h-1.5 w-1.5">
                        <span class="animate-ping bg-amber-500/30 rounded-full w-1.5 h-1.5 absolute"></span>
                        <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500 animate-pulse"></span>
                    </span>
                    <span>Admin</span>
                 </div>
            </div>
        </header>
        <div class="flex flex-col lg:flex-row flex-1 min-w-0 min-h-0 overflow-hidden relative">
            <div id="mobile-overlay" class="fixed inset-0 bg-slate-900/50 z-40 hidden lg:hidden backdrop-blur-sm transition-opacity cursor-pointer"></div>
            <aside id="main-sidebar" class="fixed inset-y-0 left-0 z-50 w-48 bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl border-r border-slate-200/50 dark:border-emerald-900/30 transform -translate-x-full transition-transform duration-300 lg:static lg:translate-x-0 lg:flex lg:w-52 flex-col h-full shadow-2xl lg:shadow-none p-4 justify-between">
                
                <!-- Floating close button for mobile drawer -->
                <button id="btn-close-sidebar" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 lg:hidden focus:outline-none transition-all rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer z-50">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>

                <nav class="flex-1 flex flex-col h-full min-h-0 overflow-y-auto hide-scrollbar space-y-1.5 pt-4">
                    <div class="space-y-1.5 flex-1">
                        ${renderNavItem("dashboard", "fas fa-chart-line", "Estadísticas", initialTab === "dashboard")}
                        ${renderNavItem("casa-en-casa", "fas fa-map-location-dot", "Territorios", initialTab === "casa-en-casa")}
                        ${renderNavItem("predicacion", "fas fa-bullhorn", "P. Pública", initialTab === "predicacion")}
                        ${renderNavItem("telefonos", "fas fa-phone-volume", "Telefonía", initialTab === "telefonos")}
                        ${renderNavItem("reportes", "fas fa-file-invoice", "Reportes", initialTab === "reportes")}
                        ${renderNavItem("personal", "fas fa-users", "Publicadores", initialTab === "personal")}
                        ${renderNavItem("recursos", "fas fa-book-open", "Recursos", initialTab === "recursos")}
                        ${renderNavItem("difusion", "fas fa-broadcast-tower", "Difusión", initialTab === "difusion")}
                        <div class="h-px bg-slate-200/50 dark:bg-emerald-900/30 my-3 mx-2"></div>
                        ${renderNavItem("config", "fas fa-sliders", "Ajustes", initialTab === "config")}
                    </div>
                    
                    <div class="pt-4 border-t border-slate-200/50 dark:border-emerald-900/30 space-y-1.5 mt-auto">
                        <button onclick="import('./services/user-profile-modal.js').then(m => m.openUserProfileModal());" class="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-500 text-[9px] font-black uppercase tracking-widest transition-all focus:outline-none">
                            <i class="fas fa-id-card stroke-1.5" stroke-width="1.5"></i> <span class="sidebar-text">Mi Perfil</span>
                        </button>
                        <button onclick="window.toggleTheme();" class="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-[9px] font-medium uppercase tracking-widest transition-all focus:outline-none">
                            <i class="fas fa-adjust stroke-1.5" stroke-width="1.5"></i> <span class="sidebar-text">Cambiar Tema</span>
                        </button>
                        <button id="logout-btn" class="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 text-[9px] font-medium uppercase tracking-widest transition-all focus:outline-none">
                            <i class="fas fa-sign-out-alt stroke-1.5" stroke-width="1.5"></i> <span class="sidebar-text">Salir</span>
                        </button>
                    </div>
                </nav>
            </aside>
            <main class="flex-1 min-w-0 flex flex-col min-w-0 h-auto lg:h-full overflow-hidden bg-slate-50 dark:bg-[#0a0f18] relative">
                <!-- Desktop / Main Header (Matching Conductor Mode) -->
                <header class="shrink-0 z-20 bg-white dark:bg-[#0a0f18] border-b border-slate-200/50 dark:border-white/5 px-6 md:px-12 py-4 hidden lg:flex items-center justify-between gap-6 relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent pointer-events-none"></div>
                    <div class="flex items-center gap-3 relative z-10">
                        <div class="w-10 h-10 bg-gradient-to-tr from-amber-500 to-amber-600 rounded-xl flex items-center justify-center text-white text-base font-black shadow-lg shadow-amber-500/30 shrink-0 border border-white/20 animate-float">
                            ${displayName.charAt(0)}
                        </div>
                        <h2 class="text-xl md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none font-sans">
                            Hola, ${displayName.split(" ")[0]}
                        </h2>
                    </div>
                    
                    <!-- 1-Tap Role Switcher Bar & Active Role Badge -->
                    <div class="flex items-center gap-3 relative z-10 shrink-0">
                         <div id="main-header-role-switcher" class="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-inner">
                            <button onclick="window.switchAppRole('Publicador')" class="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400">
                                <i class="fas fa-user text-[10px]"></i>
                                <span class="hidden sm:inline">Publicador</span>
                            </button>
                            <button onclick="window.switchAppRole('Conductor')" class="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400">
                                <i class="fas fa-id-badge text-[10px]"></i>
                                <span class="hidden sm:inline">Conductor</span>
                            </button>
                            <button onclick="window.switchAppRole('Administrador')" class="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 bg-amber-500 text-white shadow-md">
                                <i class="fas fa-user-shield text-[10px]"></i>
                                <span class="hidden sm:inline">Admin</span>
                            </button>
                         </div>

                         <div class="hidden md:flex px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest items-center gap-2 select-none">
                            <span class="relative flex h-2 w-2">
                                <span class="animate-ping bg-amber-500/30 rounded-full w-2 h-2"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
                            </span>
                            <span>Terminal Admin</span>
                         </div>
                    </div>
                </header>
                <div id="admin-content" class="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-32 bg-slate-50/50 dark:bg-black/10"></div>
            </main>
        </div>
    </div>
    <div id="modal-container" class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm hidden overflow-y-auto z-[100] p-4 flex justify-center items-center transition-all duration-300"></div>
    <div id="modal-container-nested" class="fixed inset-0 bg-slate-950/60 backdrop-blur-md hidden overflow-y-auto z-[500] p-4 flex justify-center items-center transition-all duration-300"></div>
`;

        // (Logo removed per FASE 2)

        setupNavigation(appVersion, configData);
        loadTab(initialTab, appVersion, configData);
        XolvyAdaptive.refresh();
        window.initMobileMenu();

        // Sincronizar tema en la barra lateral recién montada
        if (typeof window.updateDOMThemeToggles === "function") {
            window.updateDOMThemeToggles(localStorage.getItem("theme") || "auto");
        }
    } catch (e) {
        console.error("Admin Boot Error:", e);
        showNotification(`Error: ${e.message}`, "error");
        if (container) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-fade-in bg-slate-50 dark:bg-[#05070a] text-slate-800 dark:text-slate-100" style="min-height: 100vh; min-height: 100dvh;">
                    <div class="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center text-3xl mb-6 shadow-xl border border-rose-500/20">
                        <i class="fas fa-user-shield"></i>
                    </div>
                    <h3 class="text-xl font-black uppercase tracking-tight">Error de Panel Administrador</h3>
                    <p class="text-slate-500 dark:text-slate-400 max-w-md mt-2 font-bold text-xs">
                        No se pudo inicializar la consola de administración (${e?.message || "Error de permisos o red"}).
                    </p>
                    <div class="flex flex-wrap justify-center gap-3 mt-8">
                        <button onclick="if(window.refreshAdminView){ window.refreshAdminView(); } else { location.reload(); }" class="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                            <i class="fas fa-rotate-right mr-2"></i> Reintentar Carga
                        </button>
                        <button onclick="localStorage.clear(); sessionStorage.clear(); location.href='/'" class="bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">
                            <i class="fas fa-sign-out-alt mr-2"></i> Salir al Inicio
                        </button>
                    </div>
                </div>
            `;
        }
    }
};
