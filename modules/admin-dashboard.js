import {
    getSystemVersion, setSystemVersion, getConfiguracion
} from '../data/firestore-services.js';
import { auth } from '../firebase-config.js';
import { showNotification } from './utils/helpers.js';

import { moduleRegistry } from './utils/module-registry.js';
import { XolvyAdaptive } from './utils/adaptive.js';
import { createAdaptiveLogo } from './utils/AdaptiveLogo.js';

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
    <button class="nav-item ${active ? 'active' : ''} flex-1 lg:flex-initial flex items-center justify-center lg:justify-start gap-4 p-5 rounded-2xl transition-all group border border-transparent ${active ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/20 dark:shadow-white/20 dark:border-white/20' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400'}" data-tab="${id}">
        <i class="${icon} text-lg transition-transform group-hover:scale-125 shrink-0 ${active ? 'text-indigo-400 dark:text-indigo-600' : ''}"></i>
        <span class="text-[11px] font-black uppercase tracking-widest hidden lg:block whitespace-nowrap">${label}</span>
        ${active ? '<div class="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-50"></div>' : ''}
    </button>
`;



const loadTab = async (tabName, appVersion, configData = null) => {
    const contentDiv = document.getElementById('admin-content');
    stopAdminLivePools(); // Clean up previous listeners
    // Also clean up per-territory timeline live pools (Xolvy Live Pool)
    if (typeof window._stopAllTimelineLivePools === 'function') {
        window._stopAllTimelineLivePools();
    }
    renderSkeleton(contentDiv);

    try {
        // Fallback for direct calls that might miss configData
        const config = configData || await getConfiguracion();

        switch (tabName) {
            case 'config': {
                const mRules = await loadSubModule('rules_view', './admin/rules-view.js');
                await mRules.renderConfigTab(contentDiv, config, appVersion, (tabId) => loadTab(tabId, appVersion, config));
                break;
            }
            case 'casa-en-casa': {
                const mTerrs = await loadSubModule('territories_view', './admin/territories-view.js');
                await mTerrs.renderCasaEnCasaTab(contentDiv, config, appVersion);
                break;
            }
            case 'predicacion': {
                const mPublic = await loadSubModule('public_view', './admin/public-view.js');
                await mPublic.renderPredicacionTab(contentDiv, config);
                break;
            }
            case 'telefonos': {
                const mPhones = await loadSubModule('phones_view', './admin/phones-view.js');
                await mPhones.renderTelefonosTab(contentDiv, config);
                break;
            }
            case 'reportes': {
                const mReports = await loadSubModule('reports_view', './admin/reports-view.js');
                await mReports.renderReportsTab(contentDiv, config, appVersion);
                break;
            }
            case 'recursos': {
                const mRecs = await loadSubModule('resources_view', './admin/resources-view.js');
                await mRecs.renderRecursosTab(contentDiv, config, appVersion);
                break;
            }
            case 'personal': {
                const mPers = await loadSubModule('personal_view', './admin/personal-view.js');
                await mPers.renderPersonalTab(contentDiv, config, appVersion);
                break;
            }
            case 'dashboard':
            default: {
                const mAnalytics = await loadSubModule('analytics_view', './analytics-view.js');
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
                <p class="text-xs text-slate-400 max-w-xs">${e.message}</p>
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
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = null; // Purge any existing
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("🛡️ [AdminHub] Invocando Cierre de Sesión Blindado...");
            
            // 1. Detener todos los Live Pools activos
            if (typeof window.stopActiveLivePools === 'function') {
                window.stopActiveLivePools();
            }
            if (typeof stopAdminLivePools === 'function') {
                stopAdminLivePools();
            }

            // 2. Limpieza profunda de LocalStorage
            localStorage.removeItem('demo_role');
            localStorage.removeItem('xolvy_session');
            localStorage.removeItem('phone_session_active');
            localStorage.removeItem('selected_conductor_name');
            localStorage.clear(); // Safe bet for hard reset

            // 3. Firebase SignOut
            await auth.signOut();
            
            // 4. Redirección final
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
                
                if (isActive) {
                    t.className = `nav-item active flex-1 lg:flex-initial flex items-center justify-center lg:justify-start gap-4 p-5 rounded-2xl transition-all group border border-transparent bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/20 dark:shadow-white/20 dark:border-white/20`;
                    const icon = t.querySelector('i');
                    if (icon) icon.className = icon.className.replace(/text-slate-500|text-slate-400/g, '') + ' text-indigo-400 dark:text-indigo-600';
                } else {
                    t.className = `nav-item flex-1 lg:flex-initial flex items-center justify-center lg:justify-start gap-4 p-5 rounded-2xl transition-all group border border-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400`;
                    const icon = t.querySelector('i');
                    if (icon) icon.className = icon.className.replace(/text-indigo-400|dark:text-indigo-600/g, '');
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

            window.history.pushState({}, '', `/administrador/${urlMap[tabId] || 'dashboard'}`);
            loadTab(tabId, appVersion, configData);
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

        // --- CONFIGURATION SINGLETON ---
        const configData = await getConfiguracion();

        window.dispatchModuleSync = () => {
            const currentTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (currentTab) loadTab(currentTab, appVersion, configData);
        };

        window.refreshAdminView = async () => {
            const currentTab = document.querySelector('.nav-item.active')?.dataset.tab || initialTab;
            await loadTab(currentTab, appVersion, configData);
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
    <div class="h-screen w-full p-4 md:p-6 lg:p-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] bg-slate-100 dark:bg-[#05070a] flex flex-col overflow-hidden animate-fade-in" data-adaptive-container="true">

        <div class="flex-1 w-full max-w-[1700px] mx-auto bg-white/80 dark:bg-[#0a0f18]/80 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3rem] border border-slate-200/70 dark:border-white/10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden relative group">

            <div class="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none z-0"></div>
            <div class="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none z-0"></div>

            <header class="flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 md:p-8 lg:px-10 border-b border-slate-200/50 dark:border-white/5 relative z-10 shrink-0 gap-6">
                <div class="flex items-center gap-4 md:gap-6">
                    <div id="admin-logo-container" class="w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center shadow-xl transition-transform hover:scale-105 duration-500 shrink-0 overflow-hidden">
                        <!-- Logo will be injected here -->
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

                    <div class="flex-1 lg:flex-none flex items-center justify-center gap-4 bg-slate-100 dark:bg-white/5 px-4 md:px-6 h-12 rounded-2xl border border-slate-200/50 dark:border-white/10 shadow-inner min-w-fit shrink-0">
                         <div class="flex items-center gap-2">
                             <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                             <span class="text-[8px] md:text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Vista Admin</span>
                         </div>
                         <div class="w-px h-3 bg-slate-300 dark:bg-white/10 mx-0.5"></div>
                         <button onclick="if(window.XolvyApp?.identity?.nombreCanonico){ localStorage.setItem('selected_conductor_name', window.XolvyApp.identity.nombreCanonico); localStorage.setItem('demo_role', 'Conductor'); } else { localStorage.removeItem('selected_conductor_name'); localStorage.removeItem('demo_role'); } localStorage.removeItem('xolvy_session'); window.history.pushState({}, '', '/conductores'); location.reload();" class="text-[8px] md:text-[9px] font-black text-primary hover:text-indigo-600 uppercase tracking-widest transition-colors flex items-center gap-2 whitespace-nowrap group/switch shrink-0 h-full px-1">
                             <i class="fas fa-random text-[10px] group-hover:rotate-180 transition-transform duration-500"></i> Conductor
                         </button>
                    </div>
                    
                    <button id="logout-btn" class="flex-1 lg:flex-none btn-pro bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-8 h-12 rounded-2xl border border-rose-500/20 transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-rose-500/5 active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-sign-out-alt"></i> Salir
                    </button>
                </div>
            </header>

            <div class="flex flex-col lg:flex-row flex-1 overflow-hidden relative z-10">
                
                <aside class="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-slate-200/50 dark:border-white/5 overflow-y-auto custom-scrollbar shrink-0 p-4 lg:p-6 bg-white/30 dark:bg-transparent">
                    <nav class="flex flex-row lg:flex-col gap-2 overflow-x-auto scrollbar-hide lg:overflow-visible">
                        ${renderNavItem('dashboard', 'fas fa-chart-line', 'Estadísticas', initialTab === 'dashboard')}
                        ${renderNavItem('casa-en-casa', 'fas fa-map-location-dot', 'Territorios', initialTab === 'casa-en-casa')}
                        ${renderNavItem('predicacion', 'fas fa-bullhorn', 'P. Pública', initialTab === 'predicacion')}
                        ${renderNavItem('telefonos', 'fas fa-phone-volume', 'Telefonía', initialTab === 'telefonos')}
                        ${renderNavItem('reportes', 'fas fa-file-invoice', 'Reportes', initialTab === 'reportes')}
                        ${renderNavItem('personal', 'fas fa-users', 'Publicadores', initialTab === 'personal')}
                        ${renderNavItem('recursos', 'fas fa-book-open', 'Recursos', initialTab === 'recursos')}
                        <div class="hidden lg:block h-px bg-slate-200 dark:bg-white/10 my-4 mx-4"></div>
                        ${renderNavItem('config', 'fas fa-sliders', 'Ajustes', initialTab === 'config')}
                    </nav>
                </aside>

                <main id="admin-content" class="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 lg:p-10 bg-slate-50/50 dark:bg-black/10">
                    </main>
            </div>
        </div>
    </div>
    
    <div id="modal-container" class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm hidden overflow-y-auto z-[100] p-4 flex justify-center items-center transition-all duration-300"></div>
    <div id="modal-container-nested" class="fixed inset-0 bg-slate-950/60 backdrop-blur-md hidden overflow-y-auto z-[500] p-4 flex justify-center items-center transition-all duration-300"></div>
`;

        // Inject Adaptive Logo
        const logoContainer = container.querySelector('#admin-logo-container');
        if (logoContainer) {
            logoContainer.appendChild(createAdaptiveLogo('h-7 w-auto md:h-10'));
        }

        setupNavigation(appVersion, configData);
        loadTab(initialTab, appVersion, configData);

        XolvyAdaptive.refresh();

    } catch (e) {
        console.error("Admin Boot Error:", e);
        showNotification("Error: " + e.message, "error");
    }
};





