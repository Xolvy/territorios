import {
    getSystemVersion, setSystemVersion, getConfiguracion
} from '../data/firestore-services.js';
import { auth } from '../firebase-config.js';
import { showNotification, renderSkeleton } from './utils/helpers.js';

import { moduleRegistry } from './utils/module-registry.js';
import { XolvyAdaptive } from './utils/adaptive.js';
import { VisualEngine } from './utils/visual-engine.js';

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
    <button class="nav-item flex-1 lg:flex-initial flex items-center justify-center lg:justify-start gap-4 p-4 rounded-2xl border transition-all duration-300 group ${active ? activeClasses : inactiveClasses}" data-tab="${id}">
        <div class="nav-icon-bg w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0 ${active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/5 group-hover:bg-indigo-500/10 group-hover:text-indigo-600 shadow-inner'}">
            <i class="${icon} text-lg transition-transform group-hover:scale-110"></i>
        </div>
        <span class="text-[10px] font-black uppercase tracking-[0.15rem] hidden lg:block whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity">${label}</span>
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
            <div class="${VisualEngine.get('shell.container')} h-screen overflow-hidden transition-colors duration-300" data-adaptive-container="true">
                <div class="${VisualEngine.get('shell.mainOrder')} h-full flex flex-col transition-colors duration-300">
                    
                    <!-- HEADER PRO v3.0 -->
                    <header class="${VisualEngine.get('header.wrapper')} header sticky top-0 z-50 backdrop-blur-3xl border-b border-slate-200/60 dark:border-white/5 !mb-10 transition-all duration-300" data-mobile-order="1">
                        <div class="${VisualEngine.get('header.glow')} !opacity-30 bg-gradient-to-r from-indigo-500/5 to-transparent"></div>
                        <div class="flex items-center gap-5 relative z-10">
                            <div class="w-14 h-14 bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[1.25rem] flex items-center justify-center text-2xl shadow-2xl shadow-indigo-600/20 border border-white/20 transition-transform hover:rotate-3 duration-500 shrink-0">
                                <i class="fas fa-university text-white shadow-sm"></i>
                            </div>
                            <div>
                                <div class="flex items-center gap-3">
                                    <span class="text-[9px] font-black tracking-[0.4em] text-indigo-500 uppercase">SISTEMA CENTRAL</span>
                                    <div class="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-white/20"></div>
                                    <h1 class="text-base md:text-xl font-black text-slate-950 dark:text-white leading-none uppercase tracking-tighter">Gestión de Distritos</h1>
                                </div>
                                <div class="flex items-center gap-2.5 mt-2">
                                     <div class="${VisualEngine.get('status.badge')} ${VisualEngine.get('status.online')} !py-1 !px-3 rounded-lg shadow-sm">
                                        <span class="relative flex h-2 w-2">
                                           <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                           <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <span class="text-[9px] font-bold">TERMINAL ACTIVA</span>
                                     </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex flex-wrap items-center justify-end gap-2 md:gap-3 w-full lg:w-auto relative">
                            <div class="hidden md:flex flex-col items-center bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/10 shadow-sm shrink-0 pointer-events-none cursor-default">
                                <span class="text-[6px] font-black text-slate-400 uppercase tracking-[0.2em]">Versión</span>
                                <span class="text-[8px] font-black text-slate-800 dark:text-white tracking-widest uppercase tabular-nums">${appVersion}</span>
                            </div>

                            <div class="flex-none flex items-center justify-center gap-3 bg-slate-100 dark:bg-white/5 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner relative z-[60]">
                                 <button onclick="window.toggleTheme()" class="text-slate-500 hover:text-indigo-600 transition-all active:scale-75 group/theme outline-none relative z-[70] pointer-events-auto text-xs">
                                     <i class="fas fa-moon dark:hidden"></i>
                                     <i class="fas fa-sun hidden dark:block text-yellow-500"></i>
                                 </button>

                                 <div class="w-px h-3 bg-slate-200 dark:bg-white/10 mx-0.5 pointer-events-none"></div>

                                 <div class="flex items-center gap-2 pointer-events-none">
                                     <div class="w-1 h-1 rounded-full bg-primary animate-pulse"></div>
                                     <span class="text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Admin</span>
                                 </div>

                                 <div class="w-px h-3 bg-slate-200 dark:bg-white/10 mx-0.5 pointer-events-none"></div>

                             <button onclick="window.switchToConductorView()" class="text-[7px] font-black text-primary hover:text-indigo-600 uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap outline-none px-1 relative z-[70] pointer-events-auto">
                                 <i class="fas fa-random text-[9px]"></i> Conductor
                             </button>
                            </div>
                            
                            <button id="logout-btn" class="${VisualEngine.get('button.base')} ${VisualEngine.get('button.danger')} !px-4 !py-2 !text-[9px] lg:flex-none tabular-nums shrink-0">
                                <i class="fas fa-power-off text-[10px]"></i> Salir
                            </button>
                        </div>
                    </header>

                    <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-8 items-stretch relative z-10 overflow-hidden transition-colors duration-300">
                        <!-- Navigation -->
                        <aside class="w-full lg:w-72 z-40 shrink-0 h-full overflow-y-auto overscroll-contain transition-all duration-300 scrollbar-hide sidebar">
                            <nav class="flex flex-row lg:flex-col gap-3 overflow-x-auto scrollbar-hide lg:overflow-visible p-1 transition-all">
                                ${renderNavItem('dashboard', 'fas fa-chart-line', 'Estadísticas', initialTab === 'dashboard')}
                                ${renderNavItem('casa-en-casa', 'fas fa-map-location-dot', 'Territorios', initialTab === 'casa-en-casa')}
                                ${renderNavItem('predicacion', 'fas fa-bullhorn', 'P. Pública', initialTab === 'predicacion')}
                                ${renderNavItem('telefonos', 'fas fa-phone-volume', 'Telefonía', initialTab === 'telefonos')}
                                <div class="hidden lg:block h-px bg-slate-200 dark:bg-white/10 my-4 mx-4"></div>
                                ${renderNavItem('reportes', 'fas fa-file-invoice', 'Reportes', initialTab === 'reportes')}
                                ${renderNavItem('recursos', 'fas fa-folder-open', 'Recursos', initialTab === 'recursos')}
                                ${renderNavItem('personal', 'fas fa-users', 'Publicadores', initialTab === 'personal')}
                                <div class="hidden lg:block h-px bg-slate-200 dark:bg-white/10 my-4 mx-4"></div>
                                ${renderNavItem('config', 'fas fa-sliders', 'Ajustes', initialTab === 'config')}
                            </nav>
                        </aside>

                        <!-- Content Area -->
                        <main id="admin-content" class="${VisualEngine.get('card.premium')} flex-1 w-full h-full overflow-y-auto overscroll-contain relative group pt-12 pb-10 px-6 lg:px-10 custom-scrollbar transition-colors duration-300">
                            <div class="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent pointer-events-none"></div>
                            <!-- Dynamic views load here -->
                        </main>
                    </div>
                </div>
            </div>
            
            <div id="modal-container" class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm hidden overflow-y-auto z-[100] p-4 flex justify-center items-center transition-all duration-300"></div>
            <div id="modal-container-nested" class="fixed inset-0 bg-slate-950/60 backdrop-blur-md hidden overflow-y-auto z-[500] p-4 flex justify-center items-center transition-all duration-300"></div>
`;

        setupNavigation(appVersion);
        loadTab(initialTab, appVersion);
        XolvyAdaptive.refresh();

    } catch (e) {
        console.error("Admin Boot Error:", e);
        showNotification("Error: " + e.message, "error");
    }
};





