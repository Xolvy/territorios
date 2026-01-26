import {
    getSystemVersion, setSystemVersion, getHistorialReport
} from '../data/firestore-services.js?v=2.3.1';
import { auth } from '../firebase-config.js?v=2.3.1';
import { showNotification } from './utils/helpers.js?v=2.3.1';
import { GlassButton } from './services/ui-components.js?v=2.3.1';

// Import Views
import { renderAnalyticsView } from './analytics-view.js?v=2.3.1';
import { renderCasaEnCasaTab } from './admin/territories-view.js?v=2.3.1';
import { renderPredicacionTab } from './admin/public-view.js?v=2.3.1';
import { renderTelefonosTab } from './admin/phones-view.js?v=2.3.1';
import { renderConfigTab } from './admin/rules-view.js?v=2.3.1';

/**
 * Main Entry Point for the Administration Control Panel
 * Refactored in 2026 for modular architecture and performance.
 */
export const renderAdminDashboard = async (container, appVersion, initialTab = 'dashboard') => {
    try {
        window.isAdminMode = true;

        // --- GLOBAL ADMIN HELPERS ---
        window.editHistoryRecord = async (id) => {
            const { editHistoryRecord } = await import('./admin/history-view.js?v=2.3.1');
            await editHistoryRecord(id);
        };

        window.deleteHistoryRecordUI = async (id, cond, num) => {
            const { deleteHistoryRecordUI } = await import('./admin/history-view.js?v=2.3.1');
            await deleteHistoryRecordUI(id, cond, num);
        };

        window.dispatchModuleSync = () => {
            const currentTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (currentTab) loadTab(currentTab, appVersion);
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
            <div class="animate-fade-in pb-32 lg:pb-8 w-full max-w-[1600px] mx-auto p-2 md:p-8 overflow-x-hidden">
                <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 lg:mb-10 p-4 md:p-8 glass-morphism rounded-2xl lg:rounded-[2rem] gap-6">
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
                                <p class="text-[10px] text-slate-500 font-black uppercase tracking-widest">Sincronizado • v${appVersion}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <!-- Version Badge (Requested in Image) -->
                        <div class="hidden sm:flex flex-col items-center bg-slate-50 dark:bg-white/5 px-6 py-2.5 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-[0.3em] mb-0.5">Versión del Sistema</span>
                            <span class="text-[11px] font-black text-primary uppercase tracking-tighter">Build ${appVersion}</span>
                        </div>

                        <div class="flex items-center gap-3 flex-1 md:flex-none">
                            ${GlassButton('Vista Conductor', 'fas fa-id-badge', 'secondary', 'flex-1 md:flex-none uppercase tracking-widest text-[10px] py-4', 'btn-goto-conductores')}
                            ${GlassButton('Salir', 'fas fa-sign-out-alt', 'danger', 'flex-1 md:flex-none uppercase tracking-widest text-[10px] py-4', 'logout-btn')}
                        </div>
                    </div>
                </header>

                <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
                    <!-- Navigation -->
                    <aside class="sticky top-8 h-fit z-40">
                        <nav class="flex flex-row lg:flex-col gap-2 overflow-x-auto scrollbar-hide lg:overflow-visible p-1">
                            ${renderNavItem('dashboard', 'fas fa-chart-line', 'Estadísticas', initialTab === 'dashboard')}
                            ${renderNavItem('casa-en-casa', 'fas fa-map-location-dot', 'Territorios', initialTab === 'casa-en-casa')}
                            ${renderNavItem('predicacion', 'fas fa-bullhorn', 'P. Pública', initialTab === 'predicacion')}
                            ${renderNavItem('telefonos', 'fas fa-phone-volume', 'Telefonía', initialTab === 'telefonos')}
                            <div class="hidden lg:block h-px bg-slate-100 dark:bg-white/5 my-4 mx-4"></div>
                            ${renderNavItem('config', 'fas fa-sliders', 'Ajustes', initialTab === 'config')}
                        </nav>
                    </aside>

                    <!-- Main Content -->
                    <main id="admin-content" class="min-h-[70vh] rounded-[2.5rem] bg-white/30 dark:bg-black/10 backdrop-blur-sm border border-slate-100 dark:border-white/5 shadow-inner">
                        <!-- Dynamic views load here -->
                    </main>
                </div>
            </div>
            
            <div id="modal-container" class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm hidden overflow-y-auto z-[100] p-4 flex justify-center items-center transition-all duration-300"></div>
            <div id="modal-container-nested" class="fixed inset-0 bg-slate-950/60 backdrop-blur-md hidden overflow-y-auto z-[500] p-4 flex justify-center items-center transition-all duration-300"></div>
        `;

        setupNavigation(appVersion);
        loadTab(initialTab, appVersion);

    } catch (e) {
        console.error("Admin Boot Error:", e);
        showNotification("Error: " + e.message, "error");
    }
};

const renderNavItem = (id, icon, label, active) => `
    <button class="nav-item ${active ? 'active' : ''} flex-1 lg:flex-none flex items-center gap-4 p-5 rounded-2xl transition-all group ${active ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'hover:bg-primary/5 text-slate-500 dark:text-gray-400'}" data-tab="${id}">
        <i class="${icon} text-lg transition-transform group-hover:scale-125"></i>
        <span class="text-[11px] font-black uppercase tracking-widest hidden lg:block">${label}</span>
        ${active ? '<div class="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-50"></div>' : ''}
    </button>
`;

const setupNavigation = (appVersion) => {
    // Logout Logic
    document.getElementById('logout-btn').onclick = async () => {
        localStorage.removeItem('demo_role');
        await auth.signOut();
        window.location.href = '/login';
    };

    // View Switching
    document.getElementById('btn-goto-conductores').onclick = () => window.location.href = '/conductores';

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
        };
    });
};

const loadTab = async (tabName, appVersion) => {
    const contentDiv = document.getElementById('admin-content');
    renderSkeleton(contentDiv);

    try {
        switch (tabName) {
            case 'config':
                await renderConfigTab(contentDiv, 'reglas', appVersion);
                break;
            case 'casa-en-casa':
                await renderCasaEnCasaTab(contentDiv);
                break;
            case 'predicacion':
                await renderPredicacionTab(contentDiv);
                break;
            case 'telefonos':
                await renderTelefonosTab(contentDiv);
                break;
            case 'dashboard':
            default:
                await renderAnalyticsView(contentDiv, appVersion);
                break;
        }
    } catch (e) {
        contentDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center py-32 text-center space-y-4">
                <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center text-2xl"><i class="fas fa-triangle-exclamation"></i></div>
                <h4 class="text-sm font-black uppercase text-slate-800 dark:text-white">Error de Carga</h4>
                <p class="text-xs text-slate-400 max-w-xs">${e.message}</p>
                <button onclick="location.reload()" class="bg-primary px-6 py-2 rounded-xl text-[10px] font-black uppercase text-white tracking-widest mt-4">Reintentar</button>
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
