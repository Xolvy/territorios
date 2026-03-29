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
    const activeClasses = 'active bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 scale-[1.02] border-indigo-400/20';
    const inactiveClasses = 'hover:bg-slate-100/50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 border-transparent';
    
    return `
    <button class="nav-item flex-shrink-0 flex items-center justify-center lg:justify-start gap-4 p-3 lg:p-4 rounded-xl lg:rounded-2xl border transition-all duration-300 group ${active ? activeClasses : inactiveClasses}" data-tab="${id}">
        <div class="nav-icon-bg w-9 h-9 lg:w-11 lg:h-11 rounded-lg lg:rounded-2xl flex items-center justify-center transition-all shrink-0 ${active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/5 group-hover:bg-indigo-500/10 group-hover:text-indigo-600 shadow-inner'}">
            <i class="${icon} text-base lg:text-lg transition-transform group-hover:scale-110"></i>
        </div>
        <span class="text-[10px] font-black uppercase tracking-[0.1rem] lg:tracking-[0.15rem] hidden lg:block whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity">${label}</span>
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
                    t.classList.add('active', 'bg-indigo-600', 'text-white', 'shadow-xl', 'shadow-indigo-600/30', 'scale-[1.02]', 'border-indigo-400/20');
                    t.classList.remove('hover:bg-slate-100/50', 'dark:hover:bg-white/5', 'text-slate-500', 'dark:text-slate-400', 'border-transparent');
                    if (iconBg) {
                        iconBg.classList.add('bg-white/20', 'text-white');
                        iconBg.classList.remove('bg-slate-100', 'dark:bg-white/5', 'group-hover:bg-indigo-500/10', 'group-hover:text-indigo-600', 'shadow-inner');
                    }
                } else {
                    t.classList.remove('active', 'bg-indigo-600', 'text-white', 'shadow-xl', 'shadow-indigo-600/30', 'scale-[1.02]', 'border-indigo-400/20');
                    t.classList.add('hover:bg-slate-100/50', 'dark:hover:bg-white/5', 'text-slate-500', 'dark:text-slate-400', 'border-transparent');
                    if (iconBg) {
                        iconBg.classList.remove('bg-white/20', 'text-white');
                        iconBg.classList.add('bg-slate-100', 'dark:bg-white/5', 'group-hover:bg-indigo-500/10', 'group-hover:text-indigo-600', 'shadow-inner');
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
                    
                    <!-- HEADER PRO v3.0 (Responsive & Compact) -->
                    <header class="w-full z-50 backdrop-blur-3xl border-b border-slate-200/60 dark:border-white/5 px-4 lg:px-10 py-3 lg:py-5 transition-all duration-300 shrink-0">
                        <div class="flex flex-row items-center justify-between gap-4 relative z-10">
                            <div class="flex items-center gap-3 lg:gap-5">
                                <div class="w-10 h-10 lg:w-14 lg:h-14 bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-xl lg:rounded-[1.25rem] flex items-center justify-center text-lg lg:text-2xl shadow-xl shadow-indigo-600/20 border border-white/20 shrink-0">
                                    <i class="fas fa-university text-white"></i>
                                </div>
                                <div>
                                    <div class="flex flex-col lg:flex-row lg:items-baseline lg:gap-3">
                                        <h1 class="text-sm md:text-xl font-black text-slate-950 dark:text-white uppercase tracking-tighter shrink-0 order-2 lg:order-1">Gestión Central</h1>
                                        <span class="text-[7px] lg:text-[9px] font-black tracking-[0.3em] text-indigo-500 uppercase order-1 lg:order-2 opacity-70">Admin Panel</span>
                                    </div>
                                    <div class="hidden lg:flex items-center gap-2 mt-1">
                                         <div class="flex items-center gap-1.5 py-0.5 px-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                                            <span class="relative flex h-1.5 w-1.5">
                                               <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                               <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                            </span>
                                            <span class="text-[7px] font-bold uppercase tracking-widest">Servidor Activo</span>
                                         </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-2 lg:gap-4">
                                <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner">
                                     <button onclick="window.toggleTheme()" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all active:scale-75 outline-none">
                                         <i class="fas fa-moon dark:hidden text-[10px]"></i>
                                         <i class="fas fa-sun hidden dark:block text-yellow-500 text-[10px]"></i>
                                     </button>
                                     <div class="w-px h-3 bg-slate-200 dark:bg-white/10 mx-0.5"></div>
                                     <button onclick="window.switchToConductorView()" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-primary transition-all active:scale-75 outline-none" title="Cambiar a Conductor">
                                         <i class="fas fa-user-circle text-[10px]"></i>
                                     </button>
                                </div>
                                <button id="logout-btn" class="w-10 h-10 lg:w-auto lg:px-5 lg:py-2.5 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center font-black text-[9px] uppercase tracking-widest transition-all hover:bg-rose-500 hover:text-white shadow-xl shadow-rose-500/20">
                                    <i class="fas fa-power-off"></i>
                                    <span class="hidden lg:inline ml-2">Salir</span>
                                </button>
                            </div>
                        </div>
                    </header>

                    <!-- MAIN LAYOUT AREA -->
                    <div class="flex-1 flex flex-col lg:flex-row min-h-0 relative overflow-hidden transition-all duration-300">
                        
                        <!-- NAVIGATION (Side / Bottom) -->
                        <aside class="order-2 lg:order-1 w-full lg:w-72 bg-white/80 dark:bg-[#0a0f18]/90 lg:bg-transparent backdrop-blur-2xl lg:backdrop-blur-none border-t lg:border-t-0 lg:border-r border-slate-200/60 dark:border-white/10 p-2 lg:p-8 shrink-0 z-50 shadow-[0_-10px_50px_rgba(0,0,0,0.1)] lg:shadow-none">
                            <nav class="flex flex-row lg:flex-col gap-2 p-1 overflow-x-auto lg:overflow-y-auto scrollbar-hide overscroll-contain">
                                ${renderNavItem('dashboard', 'fas fa-chart-line', 'Tablero', initialTab === 'dashboard')}
                                ${renderNavItem('casa-en-casa', 'fas fa-map-location-dot', 'Territorios', initialTab === 'casa-en-casa')}
                                ${renderNavItem('predicacion', 'fas fa-bullhorn', 'Horarios', initialTab === 'predicacion')}
                                ${renderNavItem('telefonos', 'fas fa-phone-volume', 'Telefonía', initialTab === 'telefonos')}
                                <div class="hidden lg:block h-px bg-slate-200 dark:bg-white/10 my-4 mx-4"></div>
                                ${renderNavItem('reportes', 'fas fa-file-invoice', 'Reportes', initialTab === 'reportes')}
                                ${renderNavItem('personal', 'fas fa-users', 'Publicadores', initialTab === 'personal')}
                                ${renderNavItem('recursos', 'fas fa-folder-open', 'Recursos', initialTab === 'recursos')}
                                ${renderNavItem('config', 'fas fa-sliders', 'Ajustes', initialTab === 'config')}
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





