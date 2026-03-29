import {
    getSystemVersion, setSystemVersion, getConfiguracion
} from '../data/firestore-services.js';
import { auth } from '../firebase-config.js';
import { showNotification, renderSkeleton } from './utils/helpers.js';

import { moduleRegistry } from './utils/module-registry.js';
import { XolvyAdaptive } from './utils/adaptive.js';

// --- MICRO-MODULE LOADER ---
const dynamicSubModules = import.meta.glob('./**/*.js');

let currentAdminLivePoolUnsubscribe = null;

export const stopAdminLivePools = () => {
    if (currentAdminLivePoolUnsubscribe) {
        if (typeof currentAdminLivePoolUnsubscribe === 'function') {
            currentAdminLivePoolUnsubscribe();
        } else if (Array.isArray(currentAdminLivePoolUnsubscribe)) {
            currentAdminLivePoolUnsubscribe.forEach(unsub => unsub?.());
        }
        currentAdminLivePoolUnsubscribe = null;
    }
};

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
const renderNavItem = (id, icon, label, active) => {
    const activeClasses = 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-400/20 shadow-none relative after:absolute after:left-0 after:top-1/4 after:bottom-1/4 after:w-1 after:bg-indigo-600 after:rounded-r-full';
    const inactiveClasses = 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 border-transparent shadow-none';
    
    return `
    <button class="nav-item flex-shrink-0 flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-3.5 rounded-xl border transition-all duration-300 group ${active ? activeClasses : inactiveClasses}" data-tab="${id}">
        <div class="nav-icon-bg w-8 h-8 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center transition-all shrink-0 ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-white/5 group-hover:bg-indigo-600 group-hover:text-white'}">
            <i class="${icon} text-sm transition-transform group-hover:scale-110"></i>
        </div>
        <span class="text-[11px] font-bold tracking-tight hidden lg:block whitespace-nowrap">${label}</span>
    </button>
    `;
};



const loadTab = async (tabName, appVersion) => {
    const contentDiv = document.getElementById('admin-content');
    stopAdminLivePools(); // Clean up previous listeners
    // Also clean up per-territory timeline live pools (Xolvy Live Pool)
    if (typeof window._stopAllTimelineLivePools === 'function') {
        window._stopAllTimelineLivePools();
    }
    renderSkeleton(contentDiv);

    try {
        switch (tabName) {
            case 'config': {
                const config = await getConfiguracion();
                const mRules = await loadSubModule('rules_view', './admin/rules-view.js');
                await mRules.renderConfigTab(contentDiv, config, appVersion, (tabId) => loadTab(tabId, appVersion));
                break;
            }
            case 'casa-en-casa': {
                const cfg = await getConfiguracion();
                const mTerrs = await loadSubModule('territories_view', './admin/territories-view.js');
                await mTerrs.renderCasaEnCasaTab(contentDiv, cfg, appVersion);
                break;
            }
            case 'predicacion': {
                const mPublic = await loadSubModule('public_view', './admin/public-view.js');
                await mPublic.renderPredicacionTab(contentDiv);
                break;
            }
            case 'telefonos': {
                const mPhones = await loadSubModule('phones_view', './admin/phones-view.js');
                await mPhones.renderTelefonosTab(contentDiv);
                break;
            }
            case 'reportes': {
                const mReports = await loadSubModule('reports_view', './admin/reports-view.js');
                await mReports.renderReportsTab(contentDiv);
                break;
            }
            case 'recursos': {
                const cfg = await getConfiguracion();
                const mRecs = await loadSubModule('resources_view', './admin/resources-view.js');
                await mRecs.renderRecursosTab(contentDiv, cfg, appVersion);
                break;
            }
            case 'personal': {
                const cfg = await getConfiguracion();
                const mPers = await loadSubModule('personal_view', './admin/personal-view.js');
                await mPers.renderPersonalTab(contentDiv, cfg, appVersion);
                break;
            }
            case 'dashboard':
            default: {
                const mAnalytics = await loadSubModule('analytics_view', './analytics-view.js');
                await mAnalytics.renderAnalyticsView(contentDiv, appVersion);
                break;
            }
        }
        XolvyAdaptive.refresh();
    } catch (e) {
        contentDiv.innerHTML = `
    < div class="flex flex-col items-center justify-center py-32 text-center space-y-4" >
                <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center text-2xl"><i class="fas fa-triangle-exclamation"></i></div>
                <h4 class="text-sm font-black uppercase text-slate-800 dark:text-white">Error de Carga</h4>
                <p class="text-xs text-slate-400 max-w-xs">${e.message}</p>
                <div class="flex flex-wrap justify-center gap-3 mt-4">
                    <button onclick="location.reload()" class="bg-primary px-8 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95">
                        <i class="fas fa-sync-alt mr-2"></i> Reintentar
                    </button>
                </div>
            </div >
    `;
    }
};

const setupNavigation = (appVersion) => {
    // Logout Logic
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = null; // Purge any existing
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            localStorage.removeItem('demo_role');
            await auth.signOut();
            location.href = '/login';
        });
    }

    const tabs = document.querySelectorAll('.nav-item');
    tabs.forEach(btn => {
        btn.onclick = (e) => {
            // EXCLUSIÓN MUTUA v2.9
            const currentTab = e.currentTarget.dataset.tab;
            tabs.forEach(t => {
                const isActive = t.dataset.tab === currentTab;
                const iconBg = t.querySelector('.nav-icon-bg');
                
                if (isActive) {
                    t.className = `nav-item flex-shrink-0 flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-3.5 rounded-xl border transition-all duration-300 group bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-400/20 shadow-none relative after:absolute after:left-0 after:top-1/4 after:bottom-1/4 after:w-1 after:bg-indigo-600 after:rounded-r-full`;
                    if (iconBg) {
                        iconBg.className = 'nav-icon-bg w-8 h-8 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center transition-all shrink-0 bg-indigo-600 text-white';
                    }
                } else {
                    t.className = `nav-item flex-shrink-0 flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-3.5 rounded-xl border transition-all duration-300 group text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 border-transparent shadow-none`;
                    if (iconBg) {
                        iconBg.className = 'nav-icon-bg w-8 h-8 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center transition-all shrink-0 bg-slate-100 dark:bg-white/5 group-hover:bg-indigo-600 group-hover:text-white';
                    }
                }
            });

            const target = e.currentTarget;
            const tabId = target.dataset.tab;
            const urlMap = {
                'dashboard': 'dashboard',
                'casa-en-casa': 'territorios',
                'predicacion': 'predicacion',
                'telefonos': 'telefonos',
                'reportes': 'reportes',
                'recursos': 'recursos',
                'personal': 'publicadores',
                'config': 'config'
            };

            window.history.pushState({}, '', `/ administrador / ${urlMap[tabId] || 'dashboard'} `);
            loadTab(tabId, appVersion);
            XolvyAdaptive.refresh();
        };
    });
};

export const renderAdminDashboard = async (container, appVersion, initialTab = 'dashboard') => {
    try {
        window.isAdminMode = true;

        // --- GLOBAL ADMIN HELPERS ---
        window.editHistoryRecord = async (id) => {
            const { editHistoryRecord } = await import('./admin/history-view.js');
            await editHistoryRecord(id);
        };

        window.deleteHistoryRecordUI = async (id, cond, num) => {
            const { deleteHistoryRecordUI } = await import('./admin/history-view.js');
            await deleteHistoryRecordUI(id, cond, num);
        };

        window.dispatchModuleSync = () => {
            const currentTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (currentTab) loadTab(currentTab, appVersion);
        };

        window.refreshAdminView = async () => {
            const currentTab = document.querySelector('.nav-item.active')?.dataset.tab || initialTab;
            await loadTab(currentTab, appVersion);
        };

        // --- VERSION SYNCHRONIZATION ---
        if (appVersion) {
            getSystemVersion().then(async (remoteVer) => {
                if (appVersion !== remoteVer) {
                    console.log(`[Auto - Update] System Bump: ${remoteVer} -> ${appVersion} `);
                    await setSystemVersion(appVersion);
                }
            }).catch(e => console.warn("Version check skipped", e));
        }

        // --- MAIN SHELL RENDER ---
        container.innerHTML = `
            <div class="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-[#0a0f18] transition-colors duration-300">
                <!-- ROOT SHELL -->
                <div class="flex-1 flex flex-col min-h-0 relative overflow-hidden">
                    
                    <!-- HEADER CLEAN v4.0 (Stripe Style) -->
                    <header class="w-full z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-6 lg:px-12 py-4 lg:py-6 transition-all duration-300 shrink-0">
                        <div class="flex flex-row items-center justify-between gap-4 relative z-10">
                            <div class="flex items-center gap-4 lg:gap-6">
                                <div class="w-10 h-10 lg:w-12 lg:h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-lg lg:text-xl shadow-indigo-600/20 border border-white/20 shrink-0">
                                    <i class="fas fa-university text-white"></i>
                                </div>
                                <div class="flex flex-col">
                                    <h1 class="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-1">Centro de Gestión</h1>
                                    <div class="flex items-center gap-2">
                                         <div class="flex items-center gap-1.5 py-0.5 px-2 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50 rounded-full">
                                            <span class="relative flex h-1 w-1">
                                               <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                               <span class="relative inline-flex rounded-full h-1 w-1 bg-emerald-600"></span>
                                            </span>
                                            <span class="text-[8px] font-bold uppercase tracking-widest">Activo</span>
                                         </div>
                                         <span class="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em] ml-1">v${appVersion}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-3 lg:gap-4">
                                <div class="flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 p-1.5 rounded-xl border border-slate-200 dark:border-white/10">
                                     <button onclick="window.toggleTheme()" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all active:scale-95 outline-none">
                                         <i class="fas fa-moon dark:hidden text-[11px]"></i>
                                         <i class="fas fa-sun hidden dark:block text-yellow-500 text-[11px]"></i>
                                     </button>
                                     <div class="w-px h-3 bg-slate-200 dark:bg-white/10 mx-1"></div>
                                     <button onclick="window.switchToConductorView()" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all active:scale-95 outline-none" title="Cambiar a Vista Conductor">
                                         <i class="fas fa-compass text-[11px]"></i>
                                     </button>
                                </div>
                                <button id="logout-btn" class="h-10 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2">
                                    <i class="fas fa-power-off text-xs opacity-60"></i>
                                    <span class="hidden lg:inline">Cerrar Sesión</span>
                                </button>
                            </div>
                        </div>
                    </header>

                    <!-- MAIN LAYOUT AREA -->
                    <div class="flex-1 flex flex-col lg:flex-row min-h-0 relative overflow-hidden transition-all duration-300">
                        
                        <!-- NAVIGATION (Side / Bottom) -->
                        <aside class="order-2 lg:order-1 w-full lg:w-72 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-r border-slate-200 dark:border-white/5 p-2 lg:p-6 shrink-0 z-50 transition-all duration-300">
                            <nav class="flex flex-row lg:flex-col gap-1 p-1 overflow-x-auto lg:overflow-y-auto scrollbar-hide overscroll-contain">
                                <div class="hidden lg:block mb-4 px-4 py-2">
                                     <span class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Menú Principal</span>
                                </div>
                                ${renderNavItem('dashboard', 'fas fa-grid-2', 'Tablero Metas', initialTab === 'dashboard')}
                                ${renderNavItem('casa-en-casa', 'fas fa-map', 'Territorios', initialTab === 'casa-en-casa')}
                                ${renderNavItem('predicacion', 'fas fa-calendar-days', 'Programa Semanal', initialTab === 'predicacion')}
                                ${renderNavItem('telefonos', 'fas fa-phone', 'Telefonía', initialTab === 'telefonos')}
                                <div class="hidden lg:block h-px bg-slate-100 dark:bg-white/5 my-4 mx-4"></div>
                                <div class="hidden lg:block mb-4 px-4 py-2">
                                     <span class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Administración</span>
                                </div>
                                ${renderNavItem('reportes', 'fas fa-clock-rotate-left', 'Cronología S-13', initialTab === 'reportes')}
                                ${renderNavItem('personal', 'fas fa-user-group', 'Publicadores', initialTab === 'personal')}
                                ${renderNavItem('recursos', 'fas fa-folder-tree', 'Archivos', initialTab === 'recursos')}
                                ${renderNavItem('config', 'fas fa-gear', 'Configuración', initialTab === 'config')}
                            </nav>
                        </aside>

                        <!-- CONTENT VIEWPORT -->
                        <main id="admin-content" class="order-1 lg:order-2 flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain relative pb-28 lg:pb-12 pt-6 lg:pt-10 px-4 lg:px-12 custom-scrollbar transition-colors bg-slate-50 dark:bg-[#0a0f18] z-10">
                            <!-- Injected Views -->
                        </main>
                    </div>
                </div>
            </div>
            
            <div id="modal-container" class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm hidden overflow-y-auto z-[200] p-4 flex justify-center items-center"></div>
            <div id="modal-container-nested" class="fixed inset-0 bg-slate-950/60 backdrop-blur-md hidden overflow-y-auto z-[500] p-4 flex justify-center items-center"></div>
`;

        setupNavigation(appVersion);
        loadTab(initialTab, appVersion);
        XolvyAdaptive.refresh();

    } catch (e) {
        console.error("Admin Boot Error:", e);
        showNotification("Error: " + e.message, "error");
    }
};





