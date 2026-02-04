import Chart from 'chart.js/auto';
import {
    getSystemVersion, setSystemVersion, getHistorialReport, getConfiguracion
} from '../data/firestore-services.js';
import { auth } from '../firebase-config.js';
import { showNotification } from './utils/helpers.js';
import { GlassButton } from './services/ui-components.js';

import { moduleRegistry } from './utils/module-registry.js';
import { XolvyAdaptive } from './utils/adaptive.js';

// --- MICRO-MODULE LOADER ---
const SubModuleCache = new Map();
const dynamicSubModules = import.meta.glob('./**/*.js');

async function loadSubModule(name, path) {
    const fullPath = moduleRegistry.getModulePath(name, path);
    // If version changed, force fresh reload
    const isNew = SubModuleCache.get(`${name}_path`) !== fullPath;
    if (!SubModuleCache.has(name) || isNew) {
        console.log(`📡 [HMS] Swapping Micro-Module: ${name}`);

        let mod;
        const globPath = path.startsWith('./') ? path : `./${path.startsWith('/') ? path.substring(1) : path}`;

        if (dynamicSubModules[globPath]) {
            mod = await dynamicSubModules[globPath]();
        } else {
            const finalPath = isNew ? `${fullPath}&ts=${Date.now()}` : fullPath;
            mod = await import(/* @vite-ignore */ finalPath);
        }

        SubModuleCache.set(name, mod);
        SubModuleCache.set(`${name}_path`, fullPath);
    }
    return SubModuleCache.get(name);
}

/**
 * Main Entry Point for the Administration Control Panel
 * Refactored in 2026 for modular architecture and performance.
 */
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
                    console.log(`[Auto-Update] System Bump: ${remoteVer} -> ${appVersion}`);
                    await setSystemVersion(appVersion);
                }
            }).catch(e => console.warn("Version check skipped", e));
        }

        // --- MAIN SHELL RENDER ---
        container.innerHTML = `
            <div class="animate-fade-in pb-32 lg:pb-8 w-full max-w-[1600px] mx-auto p-2 md:p-8 overflow-x-hidden" data-adaptive-container="true">
                <header class="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 lg:mb-10 p-4 md:p-8 glass-morphism rounded-2xl lg:rounded-[2rem] gap-6" data-mobile-order="1">
                    <div class="flex items-center gap-4 md:gap-6">
                        <div class="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary to-slate-900 rounded-2xl flex items-center justify-center text-2xl md:text-3xl shadow-xl shadow-primary/20 border border-primary/20 transition-transform hover:scale-105 duration-500 shrink-0">
                            <i class="fas fa-university text-white"></i>
                        </div>
                        <div>
                            <h1 class="text-xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tighter">Panel de Gestión</h1>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="relative flex h-2 w-2">
                                   <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                   <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <p class="text-[9px] md:text-[10px] text-slate-500 font-black uppercase tracking-widest">Sincronizado • v${appVersion}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <!-- Version Badge (Requested in Image) -->
                        <div class="hidden sm:flex flex-col items-center bg-slate-50 dark:bg-white/5 px-6 py-2.5 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-[0.3em] mb-0.5">Versión del Sistema</span>
                            <span class="text-[10px] font-black text-slate-800 dark:text-white tracking-widest uppercase">Build v${appVersion}</span>
                        </div>

                        <!-- UI Role/Switch Badge -->
                        <div class="flex-1 lg:flex-none flex items-center justify-between gap-4 bg-slate-100 dark:bg-white/5 px-6 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner min-w-[240px] shrink-0">
                             <div class="flex items-center gap-3">
                                 <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                 <span class="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Vista Admin</span>
                             </div>
                             <div class="w-px h-4 bg-slate-300 dark:bg-white/10 mx-1"></div>
                             <button onclick="window.history.pushState({}, '', '/conductores'); location.reload();" class="text-[9px] font-black text-primary hover:text-indigo-600 uppercase tracking-widest transition-colors flex items-center gap-2 whitespace-nowrap group/switch shrink-0">
                                 <i class="fas fa-random text-[10px] group-hover:rotate-180 transition-transform duration-500"></i> Conductor
                             </button>
                        </div>
                        
                        <button id="logout-btn" class="flex-1 lg:flex-none btn-pro bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-8 py-3.5 rounded-2xl border border-rose-500/20 transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-rose-500/5 active:scale-95">
                            <i class="fas fa-sign-out-alt"></i> Salir
                        </button>
                    </div>
                </header>
                <div class="flex flex-col lg:flex-row gap-8 items-start">
                    <!-- Navigation -->
                    <aside class="w-full lg:w-72 lg:sticky lg:top-8 z-40 shrink-0">
                        <nav class="flex flex-row lg:flex-col gap-2 overflow-x-auto scrollbar-hide lg:overflow-visible p-1 glass-morphism rounded-3xl lg:bg-transparent lg:border-none lg:shadow-none lg:backdrop-blur-none transition-all">
                            ${renderNavItem('dashboard', 'fas fa-chart-line', 'Estadísticas', initialTab === 'dashboard')}
                            ${renderNavItem('casa-en-casa', 'fas fa-map-location-dot', 'Territorios', initialTab === 'casa-en-casa')}
                            ${renderNavItem('predicacion', 'fas fa-bullhorn', 'P. Pública', initialTab === 'predicacion')}
                            ${renderNavItem('telefonos', 'fas fa-phone-volume', 'Telefonía', initialTab === 'telefonos')}
                            <div class="hidden lg:block h-px bg-slate-200 dark:bg-white/10 my-4 mx-4"></div>
                            ${renderNavItem('config', 'fas fa-sliders', 'Ajustes', initialTab === 'config')}
                        </nav>
                    </aside>

                    <!-- Main Content -->
                    <main id="admin-content" class="flex-1 w-full min-h-[70vh] rounded-[2.5rem] bg-white/30 dark:bg-black/10 backdrop-blur-sm border border-slate-100 dark:border-white/5 shadow-inner overflow-hidden">
                        <!-- Dynamic views load here -->
                    </main>
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

const renderNavItem = (id, icon, label, active) => `
    <button class="nav-item ${active ? 'active' : ''} flex-1 lg:flex-initial flex items-center justify-center lg:justify-start gap-4 p-5 rounded-2xl transition-all group ${active ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/5 text-slate-500 dark:text-gray-400'}" data-tab="${id}">
        <i class="${icon} text-lg transition-transform group-hover:scale-125 shrink-0"></i>
        <span class="text-[11px] font-black uppercase tracking-widest hidden lg:block whitespace-nowrap">${label}</span>
        ${active ? '<div class="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-50"></div>' : ''}
    </button>
`;

const setupNavigation = (appVersion) => {
    // Logout Logic
    document.getElementById('logout-btn').onclick = async () => {
        localStorage.removeItem('demo_role');
        await auth.signOut();
        location.href = '/login';
    };

    // View Switching logic is now inline in the header badge

    const tabs = document.querySelectorAll('.nav-item');
    tabs.forEach(btn => {
        btn.onclick = (e) => {
            tabs.forEach(t => t.classList.remove('active', 'bg-primary', 'text-white', 'shadow-xl', 'shadow-primary/20'));
            tabs.forEach(t => t.classList.add('hover:bg-primary/5', 'text-slate-500', 'dark:text-gray-400'));

            const target = e.currentTarget;
            target.classList.add('active', 'bg-primary', 'text-white', 'shadow-xl', 'shadow-primary/20');
            target.classList.remove('hover:bg-primary/5', 'text-slate-500', 'dark:text-gray-400');

            const tabId = target.dataset.tab;
            const urlMap = { 'dashboard': 'dashboard', 'casa-en-casa': 'territorios', 'predicacion': 'predicacion', 'telefonos': 'telefonos', 'config': 'config' };

            window.history.pushState({}, '', `/administrador/${urlMap[tabId] || 'dashboard'}`);
            loadTab(tabId, appVersion);
            XolvyAdaptive.refresh();
        };
    });
};

const loadTab = async (tabName, appVersion) => {
    const contentDiv = document.getElementById('admin-content');
    renderSkeleton(contentDiv);

    try {
        switch (tabName) {
            case 'config':
                const config = await getConfiguracion();
                const mRules = await loadSubModule('rules_view', './admin/rules-view.js');
                await mRules.renderConfigTab(contentDiv, config, appVersion, (tabId) => loadTab(tabId, appVersion));
                break;
            case 'casa-en-casa':
                const cfg = await getConfiguracion();
                const mTerrs = await loadSubModule('territories_view', './admin/territories-view.js');
                await mTerrs.renderCasaEnCasaTab(contentDiv, cfg, appVersion);
                break;
            case 'predicacion':
                const mPublic = await loadSubModule('public_view', './admin/public-view.js');
                await mPublic.renderPredicacionTab(contentDiv);
                break;
            case 'telefonos':
                const mPhones = await loadSubModule('phones_view', './admin/phones-view.js');
                await mPhones.renderTelefonosTab(contentDiv);
                break;
            case 'dashboard':
            default:
                const mAnalytics = await loadSubModule('analytics_view', './analytics-view.js');
                await mAnalytics.renderAnalyticsView(contentDiv, appVersion);
                break;
        }
        XolvyAdaptive.refresh();
    } catch (e) {
        contentDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center py-32 text-center space-y-4">
                <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center text-2xl"><i class="fas fa-triangle-exclamation"></i></div>
                <h4 class="text-sm font-black uppercase text-slate-800 dark:text-white">Error de Carga</h4>
                <p class="text-xs text-slate-400 max-w-xs">${e.message}</p>
                <div class="flex flex-wrap justify-center gap-3 mt-4">
                    <button onclick="location.reload()" class="bg-primary px-8 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95">
                        <i class="fas fa-sync-alt mr-2"></i> Reintentar
                    </button>
                    <button onclick="window.repairSystem()" class="bg-slate-800 dark:bg-slate-700 px-8 py-3 rounded-xl text-[10px] font-black uppercase text-white tracking-widest shadow-lg transition-all active:scale-95">
                        <i class="fas fa-tools mr-2"></i> Reparar Sistema
                    </button>
                </div>
            </div>
        `;
    }
};

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

