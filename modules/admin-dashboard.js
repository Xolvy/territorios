import {
    getConfiguracion, saveConfiguracion, getSystemVersion, setSystemVersion,
    getTerritorios, addTerritorio, deleteTerritorio, updateTerritorio, assignTerritorioParcial, assignTerritorio, returnTerritorio, returnTerritorioMultiple, transferTerritory, getTerritoryHistory, getHistorialReport, addHistoryRecord, updateHistoryRecord, deleteHistoryRecord, cancelarAsignacion, updateAssignmentData,
    getConductores, addConductor, deleteConductor, updateConductor,
    getPublicadores, addPublicador, deletePublicador, updatePublicador,
    getTelefonos, addTelefono, deleteTelefono, updateTelefono,
    getPredicacionPublica, savePredicacionPublica,
    getProgramaSemanal, saveProgramaSemanal, rebuildHistoryFromSchedule, runSystemDiagnosticsAndRepair, deleteProgramaSemanal,
    getRecursos, addRecurso, deleteRecurso, updateRecurso, restoreSystemBackup,
    getCampanas, saveCampana, deleteCampana,
    getGroupsConfig, saveGroupsConfig,
    getDiffusionMessage, saveDiffusionMessage
} from '../data/firestore-services.js?v=3.0.0';
import { formatPhoneNumber, getStatusColor, showNotification, formatMapUrl, ensureOnline, generatePlainXLS } from './utils/helpers.js?v=3.0.0';
import { TerritoryIntelligence } from './utils/intelligence.js?v=3.0.0';
import { renderHistoryTab } from './report-s13.js?v=3.0.0';
import { renderAnalyticsView } from './analytics-view.js?v=3.0.0';
import { getGlobalSettings, saveGlobalSettings } from '../data/firestore-services.js?v=3.0.0';
import { auth } from '../firebase-config.js?v=3.0.0';

import { animateEntry } from './utils/animations.js?v=3.0.0';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '';




// --- Global UI Helpers ---
const showCustomAlert = (message) => {
    if (!message) return;
    const type = message.toLowerCase().includes('error') ? 'error' : 'success';
    showNotification(message, type);
};
window.showCustomAlert = showCustomAlert;

const showCustomConfirm = (message, onConfirm) => {
    showModal(`
        <div class="p-8 text-center space-y-4">
            <div class="text-5xl mb-4">❓</div>
            <h3 class="text-xl font-bold text-gray-800 dark:text-white leading-tight">${message}</h3>
            <div class="flex gap-3 justify-center mt-8">
                <button id="confirm-cancel" class="px-8 py-3 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 font-black hover:bg-gray-200 transition-all uppercase tracking-widest text-[10px]">Cancelar</button>
                <button id="confirm-ok" class="px-8 py-3 rounded-2xl bg-teal-600 text-white font-black hover:bg-teal-500 shadow-xl shadow-teal-500/30 transition-all uppercase tracking-widest text-[10px]">Aceptar</button>
            </div>
        </div>
    `, (modal) => {
        modal.querySelector('#confirm-cancel').onclick = () => modal.classList.add('hidden');
        modal.querySelector('#confirm-ok').onclick = () => {
            modal.classList.add('hidden');
            onConfirm();
        };
    });
};
window.showCustomConfirm = showCustomConfirm;

const showCustomPrompt = (message, defaultValue, onConfirm) => {
    showModal(`
        <div class="p-8 space-y-6">
            <div>
                <h3 class="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight mb-1">${message}</h3>
                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Entrada de datos</p>
            </div>
            <input type="text" id="prompt-input" value="${defaultValue || ''}" class="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-teal-500/50 rounded-2xl p-4 text-gray-900 dark:text-white outline-none shadow-inner font-bold">
            <div class="flex gap-3 justify-end mt-6">
                <button id="prompt-cancel" class="px-8 py-3 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 font-black hover:bg-gray-200 transition-all uppercase tracking-widest text-[10px]">Cancelar</button>
                <button id="prompt-ok" class="px-8 py-3 rounded-2xl bg-teal-600 text-white font-black hover:bg-teal-500 shadow-xl shadow-teal-500/30 transition-all uppercase tracking-widest text-[10px]">Aceptar</button>
            </div>
        </div>
    `, (modal) => {
        const input = modal.querySelector('#prompt-input');
        input.focus();
        input.select();
        modal.querySelector('#prompt-cancel').onclick = () => modal.classList.add('hidden');
        modal.querySelector('#prompt-ok').onclick = () => {
            const val = input.value.trim();
            if (val) {
                modal.classList.add('hidden');
                onConfirm(val);
            }
        };
    });
};
window.showCustomPrompt = showCustomPrompt;

// Add scrollbar-hide style
const style = document.createElement('style');
style.textContent = `
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }

    /* Premium Navigation Styles */
    .nav-item {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 0.875rem 1.25rem;
        margin-bottom: 0.5rem;
        border-radius: 1rem;
        color: #64748b;
        font-size: 0.9rem;
        font-weight: 600;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background: transparent;
        border: 1px solid transparent;
        text-align: left;
    }
    .dark .nav-item { color: #94a3b8; }
    
    .nav-item:hover {
        background-color: rgba(0, 150, 136, 0.08);
        color: #0d9488;
        transform: translateX(4px);
    }
    .dark .nav-item:hover {
        background-color: rgba(255, 255, 255, 0.05);
        color: #2dd4bf;
    }

    .nav-item.active {
        background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
        color: white;
        box-shadow: 0 10px 20px -5px rgba(13, 148, 136, 0.4);
        border: 1px solid rgba(255,255,255,0.1);
    }
    .dark .nav-item.active {
        background: linear-gradient(135deg, #0d9488 0%, #115e59 100%);
        color: white;
        box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.4);
    }

    .nav-icon {
        font-size: 1.25rem;
        margin-right: 1rem;
        width: 1.5rem;
        display: flex;
        justify-content: center;
        transition: transform 0.3s ease;
    }
    .nav-item:hover .nav-icon { transform: scale(1.15) rotate(5deg); }
    .nav-item.active .nav-icon { color: white; }
    
    .nav-label { font-family: 'Inter', sans-serif; letter-spacing: 0.01em; }
`;
document.head.appendChild(style);

// --- Module Level Globals (Cache/Scope Guard) ---
let _globalTerritorios = [];
let _globalPrograma = null;

// Global Date Helpers
const getMonday = (d) => {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

const formatDateId = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDisplayDateRange = (date) => {
    try {
        const start = new Date(date);
        if (isNaN(start.getTime())) return '';
        const end = new Date(date);
        end.setDate(start.getDate() + 6);
        // Use premium Date-fns if available, fallback to basic logic
        if (window.dateFns) {
            return `${window.dateFns.format(start, 'd MMM')} - ${window.dateFns.format(end, 'd MMM yyyy')}`;
        }
        const f = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
        return `${f(start)} - ${f(end)}, ${start.getFullYear()}`;
    } catch (e) { return date; }
};

// Ensure functions exist immediately upon module load

// --- SELECTION MODALS (Fixes non-functional buttons) ---
const showTerritorySelectionModal = (current, territorios, onSelect) => {
    let filtered = [...territorios].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

    showModal(`
        <div class="flex flex-col h-full">
            <header class="shrink-0 flex justify-between items-center bg-teal-600 p-6 text-white shadow-lg">
                <div>
                    <h3 class="font-black uppercase tracking-widest text-sm">Seleccionar Territorio</h3>
                    <p class="text-[9px] opacity-70 font-bold uppercase mt-1">Total: ${territorios.length} registros</p>
                </div>
                <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">📍</div>
            </header>
            
            <div class="flex-1 p-6 space-y-4 overflow-y-auto">
                <div class="relative group">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input type="text" id="modal-terr-search" placeholder="Buscar por número..." class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-teal-500 transition-all font-bold placeholder-gray-400">
                </div>

                <div id="modal-terr-grid" class="grid grid-cols-4 sm:grid-cols-5 gap-2 p-1 custom-scrollbar">
                    <!-- Injected via render -->
                </div>
            </div>

            <div class="shrink-0 p-6 bg-gray-50 dark:bg-black/40 border-t border-black/5 dark:border-white/5">
                <button id="modal-terr-none" class="w-full bg-white dark:bg-white/5 py-4 rounded-xl text-[10px] font-black text-gray-400 hover:text-red-500 transition-colors uppercase tracking-[0.2em] border border-black/5 dark:border-white/5 shadow-sm">
                    ❌ Eliminar Selección
                </button>
            </div>
        </div>
    `, (modal) => {
        const grid = modal.querySelector('#modal-terr-grid');
        const searchInput = modal.querySelector('#modal-terr-search');

        const render = () => {
            const query = searchInput.value.trim();
            const items = query ? filtered.filter(t => t.numero.includes(query)) : filtered;

            grid.innerHTML = items.map(t => {
                const isActive = t.numero === current;
                return `
                    <button class="terr-pick-btn h-12 flex items-center justify-center rounded-xl border font-mono font-black text-sm transition-all
                        ${isActive ? 'bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-500/20 scale-105' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-teal-500/50 hover:bg-teal-500/5'}
                    " data-num="${t.numero}">
                        ${t.numero}
                    </button>
                `;
            }).join('');

            modal.querySelectorAll('.terr-pick-btn').forEach(btn => {
                btn.onclick = () => {
                    onSelect(btn.dataset.num);
                    modal.classList.add('hidden');
                };
            });
        };

        searchInput.oninput = render;
        modal.querySelector('#modal-terr-none').onclick = () => {
            onSelect('');
            modal.classList.add('hidden');
        };
        render();
    }, 'max-w-md');
};

const showGroupSelectionModal = (current, onSelect) => {
    const groups = ['Todos', 'Grupos 1 y 5', 'Grupos 2 y 6', 'Grupos 3 y 4', 'Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5', 'Grupo 6', 'Grupo 7', 'Grupo 8', 'Grupo 9', 'Grupo 10', 'Grupo 11', 'Grupo 12'];

    showModal(`
        <div class="flex flex-col h-full">
            <header class="shrink-0 flex justify-between items-center bg-indigo-600 p-6 text-white shadow-lg">
                <div>
                    <h3 class="font-black uppercase tracking-widest text-sm">Seleccionar Grupos</h3>
                    <p class="text-[9px] opacity-70 font-bold uppercase mt-1">Filtrado por congregación</p>
                </div>
                <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">👥</div>
            </header>
            
            <div class="flex-1 p-6 space-y-2 overflow-y-auto">
                ${groups.map(g => `
                    <button class="group-pick-btn w-full p-4 rounded-xl border text-left text-sm font-bold transition-all flex items-center justify-between
                        ${g === current ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg scale-[1.02]' : 'bg-gray-50 dark:bg-white/5 border-black/5 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-indigo-500/5 hover:border-indigo-500/30'}
                    " data-val="${g}">
                        <span>${g}</span>
                        ${g === current ? '<span>✅</span>' : ''}
                    </button>
                `).join('')}
            </div>

            <div class="shrink-0 p-6 bg-gray-50 dark:bg-black/40 border-t border-black/5 dark:border-white/5">
                <button id="modal-grp-none" class="w-full bg-white dark:bg-white/5 py-4 rounded-xl text-[10px] font-black text-gray-400 hover:text-red-500 transition-colors uppercase tracking-[0.2em] border border-black/5 dark:border-white/5 shadow-sm">
                    ❌ Sin Grupo Específico
                </button>
            </div>
        </div>
    `, (modal) => {
        modal.querySelectorAll('.group-pick-btn').forEach(btn => {
            btn.onclick = () => {
                onSelect(btn.dataset.val);
                modal.classList.add('hidden');
            };
        });
        modal.querySelector('#modal-grp-none').onclick = () => {
            onSelect('');
            modal.classList.add('hidden');
        };
    }, 'max-w-xs');
};

window.openTerritorySelector = (dayIndex, turnId, btnElement) => {
    if (!btnElement || !_globalPrograma) return;
    const currentVal = btnElement.dataset.current;

    if (typeof showTerritorySelectionModal === 'function') {
        showTerritorySelectionModal(currentVal, _globalTerritorios, (newValue) => {
            if (!_globalPrograma.dias[dayIndex][turnId]) _globalPrograma.dias[dayIndex][turnId] = {};
            _globalPrograma.dias[dayIndex][turnId].territorio = newValue;

            btnElement.dataset.current = newValue;
            const span = btnElement.querySelector('span.truncate');
            if (span) {
                span.textContent = newValue || 'Asignar';
                span.className = `truncate font-mono ${newValue ? 'text-teal-400 font-bold' : 'text-gray-500 italic'}`;
            }
        });
    }
};

window.openGroupSelector = (dayIndex, turnId, btnElement) => {
    if (!btnElement || !_globalPrograma) return;
    const currentVal = btnElement.dataset.current;
    if (typeof showGroupSelectionModal === 'function') {
        showGroupSelectionModal(currentVal, (newValue) => {
            if (!_globalPrograma.dias[dayIndex][turnId]) _globalPrograma.dias[dayIndex][turnId] = {};
            _globalPrograma.dias[dayIndex][turnId].grupos = newValue;

            btnElement.dataset.current = newValue;
            const span = btnElement.querySelector('span.truncate');
            if (span) {
                span.textContent = newValue || 'Seleccionar';
                span.className = `truncate ${newValue ? 'text-teal-400 font-bold' : 'text-gray-500 italic'}`;
            }
        });
    }
};


// --- Main Render (Admin) ---
export const renderAdminDashboard = async (container, appVersion, initialTab = 'dashboard') => { // Accepted version for auto-sync
    try {
        // --- AUTO UPDATE REMOTE VERSION LOGIC ---
        if (appVersion) {
            getSystemVersion().then(async (remoteVer) => {
                if (appVersion !== remoteVer) {
                    console.log(`[Auto-Update] Bumping remote version from ${remoteVer} to ${appVersion}`);
                    await setSystemVersion(appVersion);
                    showNotification(`Versión del sistema actualizada automáticamente a ${appVersion}`);
                }
            }).catch(e => console.warn("Auto-update check failed", e));
        }
        // ----------------------------------------

        container.innerHTML = `
   <div class="w-full max-w-7xl animate-fade-in pb-10">
            <header class="flex justify-between items-center mb-6 p-4 morphinglass-card">
                <div>
                    <h1 class="text-2xl font-bold text-teal-600 dark:text-teal-400">Panel de Administrador</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Configuración y Gestión</p>
                </div>
                <button id="logout-btn" class="bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-500/20 dark:hover:bg-red-500/40 dark:text-red-200 px-4 py-2 rounded-lg border border-red-200 dark:border-red-500/30 transition-colors shadow-sm dark:shadow-none font-medium">
                    Cerrar Sesión
                </button>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <!-- Sidebar -->
                <nav class="lg:col-span-1 bg-white/40 dark:bg-black/20 backdrop-blur-xl border border-black/5 dark:border-white/5 p-4 rounded-[2.5rem] h-fit flex flex-col gap-2 relative lg:sticky lg:top-4 z-20 shadow-xl">
                    <div class="px-4 py-3 mb-2 border-b border-black/5 dark:border-white/5">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Navegación</p>
                    </div>
                    
                    <button class="nav-item group ${initialTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
                        <span class="nav-icon">📊</span>
                        <span class="nav-label">Panel de Control</span>
                    </button>
                    <button class="nav-item group ${initialTab === 'casa-en-casa' ? 'active' : ''}" data-tab="casa-en-casa">
                        <span class="nav-icon">🏘️</span>
                        <span class="nav-label">Casa en Casa</span>
                    </button>
                    <button class="nav-item group ${initialTab === 'predicacion' ? 'active' : ''}" data-tab="predicacion">
                        <span class="nav-icon">📢</span>
                        <span class="nav-label">P. Pública</span>
                    </button>
                    <button class="nav-item group ${initialTab === 'telefonos' ? 'active' : ''}" data-tab="telefonos">
                        <span class="nav-icon">📞</span>
                        <span class="nav-label">P. Telefónica</span>
                    </button>
                    <div class="h-6"></div> <!-- Spacer -->

                    <button class="nav-item group ${initialTab === 'config' ? 'active' : ''}" data-tab="config">
                        <span class="nav-icon">⚙️</span>
                        <span class="nav-label">Configuración</span>
                    </button>
                </nav>

                <!-- Content -->
                <div class="lg:col-span-4 morphinglass-card min-h-[600px]" id="admin-content">
                    <!-- Dynamic Content -->
                </div>
            </div>
        </div>
        
    <div id="modal-container" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden overflow-y-auto z-50 p-4 md:p-10 flex justify-center items-start"></div>
`;

        document.getElementById('logout-btn').addEventListener('click', async () => {
            localStorage.removeItem('demo_role');
            await auth.signOut();
            window.location.href = '/login'; // Redirect to login route
        });

        const tabs = document.querySelectorAll('.nav-item');
        tabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active state from all
                tabs.forEach(t => t.classList.remove('active'));

                // Add active state to clicked
                const target = e.currentTarget;
                target.classList.add('active');

                // URL Mapping
                const tabId = target.dataset.tab;
                const urlMap = {
                    'dashboard': 'dashboard',
                    'casa-en-casa': 'territorios',
                    'predicacion': 'predicacion',
                    'telefonos': 'telefonos',
                    'config': 'config'
                };

                // Update URL
                const newPath = `/administrador/${urlMap[tabId] || 'dashboard'}`;
                window.history.pushState({}, '', newPath);

                loadTab(tabId, appVersion);
            });
        });

        const currentLoadTab = (tab) => loadTab(tab, appVersion);
        loadTab(initialTab, appVersion);
        renderAdminAI();
    } catch (e) {
        console.error("Error in Admin Dashboard:", e);
        showNotification("Error cargando panel: " + e.message, "error");
    }
};

const renderSkeleton = (container) => {
    container.innerHTML = `
        <div class="p-8 space-y-8 animate-pulse">
            <div class="flex justify-between items-center mb-10">
                <div class="h-10 w-48 skeleton"></div>
                <div class="h-10 w-32 skeleton rounded-full"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div class="h-64 skeleton-card skeleton"></div>
                <div class="h-64 skeleton-card skeleton"></div>
                <div class="h-64 skeleton-card skeleton"></div>
            </div>
            <div class="h-96 skeleton-card skeleton mt-8"></div>
        </div>
    `;
};

const loadTab = async (tabName, appVersion) => {
    const contentDiv = document.getElementById('admin-content');
    renderSkeleton(contentDiv); // Premium Loading State

    if (tabName === 'config') {
        await renderConfigTab(contentDiv, 'reglas', appVersion);
    } else if (tabName === 'casa-en-casa') {
        await renderCasaEnCasaTab(contentDiv);
    } else if (tabName === 'predicacion') {
        await renderPredicacionTab(contentDiv);
    } else if (tabName === 'telefonos') {
        await renderTelefonosTab(contentDiv);
    } else if (tabName === 'dashboard') {
        await renderAnalyticsView(contentDiv);
    }
};

/* --- FLOATING AI (ADMIN) --- */
const renderAdminAI = async () => {
    // 1. Fetch Data State
    const telefonos = await getTelefonos();
    const publicadores = await getPublicadores();
    const territorios = await getTerritorios();
    const programa = await getProgramaSemanal();
    const conductores = await getConductores();
    const config = await getConfiguracion();

    // 2. Intelligence Engine
    const brain = new TerritoryIntelligence(telefonos, publicadores, territorios, programa, conductores);

    // 3. Inject UI
    const aiUI = document.createElement('div');
    aiUI.id = 'admin-ai-overlay';
    aiUI.innerHTML = `
   <button id="admin-ai-fab" class="fixed bottom-6 right-6 z-50 bg-teal-600 hover:bg-teal-500 text-white rounded-full p-4 shadow-2xl shadow-teal-900/50 transition-all hover:scale-110 active:scale-95 animate-bounce-in group">
            <span class="text-2xl group-hover:rotate-12 transition-transform block">🧠</span>
            <span class="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Admin AI
            </span>
        </button >

    <div id="admin-ai-panel" class="fixed bottom-24 right-6 w-96 bg-gray-900/95 backdrop-blur-xl border border-teal-500/30 rounded-2xl shadow-2xl z-50 transform translate-y-10 opacity-0 pointer-events-none transition-all duration-300 flex flex-col max-h-[70vh]">
        <!-- Header -->
        <div class="flex justify-between items-center p-4 border-b border-white/10 bg-gradient-to-r from-teal-900/20 to-blue-900/20 rounded-t-2xl">
            <h3 class="font-bold text-teal-100 flex items-center gap-2">
                <span>🧠</span> Command Center
            </h3>
            <button id="admin-ai-close" class="text-white/50 hover:text-white transition-colors">✕</button>
        </div>

        <!-- Chat Log -->
        <div id="admin-chat-log" class="flex-1 overflow-y-auto p-4 space-y-3 text-xs custom-scrollbar min-h-[300px]">
            <div class="bg-teal-500/10 p-3 rounded-lg rounded-tl-none border border-teal-500/20 text-gray-300">
                Panel de Control Inteligente activado. Puedo analizar datos y asignar territorios.
            </div>
        </div>

        <!-- Input -->
        <div class="p-3 border-t border-white/10 bg-black/20 rounded-b-2xl flex gap-2">
            <input type="text" id="admin-chat-input"
                placeholder="Orden: 'Asigna el 25 a Juan'..."
                class="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none placeholder-gray-500">
                <button id="admin-chat-send" class="bg-teal-600 hover:bg-teal-500 text-white px-3 rounded-lg transition-colors flex items-center justify-center">
                    ➤
                </button>
        </div>
    </div>
`;

    // Clean up old
    const existing = document.getElementById('admin-ai-overlay');
    if (existing) existing.remove();
    document.body.appendChild(aiUI);

    const fab = document.getElementById('admin-ai-fab');
    const panel = document.getElementById('admin-ai-panel');
    const close = document.getElementById('admin-ai-close');
    const input = document.getElementById('admin-chat-input');
    const send = document.getElementById('admin-chat-send');
    const log = document.getElementById('admin-chat-log');

    let isOpen = false;
    const togglePanel = () => {
        isOpen = !isOpen;
        if (isOpen) {
            panel.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
            input.focus();
        } else {
            panel.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
        }
    };

    fab.addEventListener('click', togglePanel);
    close.addEventListener('click', togglePanel);

    const handleSend = async () => {
        const prompt = input.value.trim();
        if (!prompt) return;

        log.innerHTML += `<div class="flex justify-end"> <div class="bg-teal-600/80 text-white px-3 py-2 rounded-lg rounded-tr-none text-xs max-w-[85%]">${prompt}</div></div> `;
        log.scrollTop = log.scrollHeight;
        input.value = '';
        input.disabled = true;

        const loadingId = 'loading-' + Date.now();
        log.innerHTML += `<div id="${loadingId}" class="text-gray-500 text-[10px] animate-pulse"> Procesando comando...</div> `;
        log.scrollTop = log.scrollHeight;

        try {
            // --- Command Execution Logic ---
            let responseText = await brain.askGemini(config.gemini_key, prompt);

            // Regex for Commands
            const commandRegex = /\|\|(ASSIGN_TERR|UNASSIGN_TERR):(.+?)\|\|/g;
            const matches = [...responseText.matchAll(commandRegex)];
            let actionLogs = "";

            for (const match of matches) {
                const fullCommand = match[0];
                const commandContent = match[2];
                const actionType = match[1];

                // Remove command from visible text
                responseText = responseText.replace(fullCommand, '');

                try {
                    if (actionType === 'ASSIGN_TERR') {
                        const parts = commandContent.split(':');
                        const tId = parts[0];
                        const cName = parts[1];
                        let details = {};
                        if (parts[2]) {
                            try { details = JSON.parse(parts[2]); } catch (err) { console.error("AI Params Error:", err); }
                        }
                        if (tId && cName) {
                            await assignTerritorio(tId, cName, details);
                            actionLogs += `<div class="text-green-400 text-[10px] mt-1 p-1 bg-green-500/10 border border-green-500/20 rounded">✅ Asignado: <b>${tId}</b> a <b>${cName}</b> ${details.lugar ? `en ${details.lugar}` : ''}</div>`;
                            showNotification(`IA: Asignado territorio ${tId} a ${cName}`);
                        }
                    }
                } catch (e) {
                    console.error("AI Action Error:", e);
                    actionLogs += `<div class="text-red-400 text-[10px] mt-1">❌ Error: ${e.message}</div> `;
                }
            }

            document.getElementById(loadingId).remove();

            const htmlResponse = responseText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

            log.innerHTML += `<div class="flex justify-start flex-col gap-1 max-w-[90%]">
    <div class="bg-white/10 text-gray-200 px-3 py-2 rounded-lg rounded-tl-none text-xs border border-white/5">
        ${htmlResponse}
    </div>
                ${actionLogs}
            </div> `;

        } catch (err) {
            console.error(err);
            if (document.getElementById(loadingId)) document.getElementById(loadingId).remove();
            log.innerHTML += `<div class="text-red-400 text-[10px] p-2"> Error: ${err.message}</div> `;
        } finally {
            input.disabled = false;
            input.focus();
            log.scrollTop = log.scrollHeight;
        }
    };

    send.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
};

/* --- CASA EN CASA TAB --- */
/* --- CASA EN CASA TAB --- */
const renderCasaEnCasaTab = async (container) => {
    const config = await getConfiguracion();

    container.innerHTML = `
   <h2 class="text-xl font-bold mb-6 border-b border-black/10 dark:border-white/10 pb-2 text-teal-800 dark:text-teal-100 flex items-center gap-2">
        <span>🏘️</span> Predicación de Casa en Casa
   </h2>
        
        <div class="flex flex-wrap gap-2 mb-6 text-sm border-b border-black/10 dark:border-white/10 pb-4 overflow-x-auto scrollbar-hide">
            <button class="sub-tab-casa active bg-teal-500/20 text-teal-800 dark:text-teal-200 px-4 py-2 rounded-lg border border-teal-500/30 transition-all font-medium whitespace-nowrap" data-sub="asignaciones">
                📋 Asignaciones
            </button>
            <button class="sub-tab-casa bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10 transition-all whitespace-nowrap" data-sub="programa">
                📅 Programa Semanal
            </button>
             <button class="sub-tab-casa bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10 transition-all whitespace-nowrap" data-sub="gestion">
                🛠️ Reporte S-13 y Gestión
            </button>
            <div class="h-4 w-px bg-gray-300 dark:bg-white/20 mx-1 self-center"></div>
            <button class="sub-tab-casa bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10 transition-all whitespace-nowrap" data-sub="recursos">
                🧰 Ayudas Ministerio
            </button>
        </div>

        <div id="casa-content" class="min-h-[400px]"></div>
`;

    const loadCasaSub = async (sub) => {
        const subContainer = container.querySelector('#casa-content');
        subContainer.innerHTML = '<div class="flex justify-center p-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>';

        // Update buttons
        container.querySelectorAll('.sub-tab-casa').forEach(b => {
            // Reset style
            b.className = "sub-tab-casa bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10 transition-all whitespace-nowrap";
            // Set active
            if (b.dataset.sub === sub) {
                b.className = "sub-tab-casa active bg-teal-500/20 text-teal-800 dark:text-teal-200 px-4 py-2 rounded-lg border border-teal-500/30 transition-all font-medium whitespace-nowrap";
            }
        });

        if (sub === 'asignaciones') {
            await renderAsignacionesView(subContainer);
        } else if (sub === 'programa') {
            await renderProgramaTab(subContainer);
        } else if (sub === 'gestion') {
            // Unify S-13 and Advanced History
            subContainer.innerHTML = '<div id="s13-container"></div><div class="h-10"></div><div id="adv-hist-container"></div>';
            await renderHistoryTab(subContainer.querySelector('#s13-container'));
            await renderAdvancedHistoryView(subContainer.querySelector('#adv-hist-container'));
        } else if (sub === 'recursos') {
            await renderRecursosTab(subContainer);
        }
    };

    container.querySelectorAll('.sub-tab-casa').forEach(btn => {
        btn.addEventListener('click', (e) => loadCasaSub(e.currentTarget.dataset.sub));
    });

    // Initial load
    loadCasaSub('asignaciones');
};

const renderRecursosTab = async (container) => {
    const recursos = await getRecursos();

    container.innerHTML = `
   <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold text-gray-800 dark:text-white">Recursos para el Ministerio</h3>
            <button id="add-recurso-btn" class="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-colors flex items-center gap-2">
                <span>➕</span> Agregar Ayuda
            </button>
        </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${recursos.length === 0 ? '<div class="col-span-full text-center text-gray-500 py-10 italic">No hay recursos agregados aún.</div>' :
            recursos.map(r => `
                <div class="bg-white dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden group hover:border-teal-500/30 transition-all shadow-sm hover:shadow-lg flex flex-col">
                    <div class="h-32 bg-gray-100 dark:bg-white/5 relative overflow-hidden">
                        ${r.imagen ? `<img src="${r.imagen}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">` :
                    `<div class="w-full h-full flex items-center justify-center text-4xl">📚</div>`}
                        <div class="absolute top-2 right-2 flex gap-1">
                             <button onclick="window.editRecurso('${r.id}')" class="bg-blue-500/80 hover:bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors" title="Editar">✏️</button>
                             <button onclick="window.deleteRecurso('${r.id}')" class="bg-red-500/80 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors" title="Eliminar">🗑️</button>
                        </div>
                    </div>
                    <div class="p-4 flex-1 flex flex-col">
                        <h4 class="font-bold text-gray-900 dark:text-white mb-2 leading-tight">${r.titulo}</h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-3 flex-1">${r.descripcion || 'Sin descripción'}</p>
                        <a href="${r.url}" target="_blank" class="block text-center w-full bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-300 py-2 rounded-lg border border-teal-100 dark:border-teal-500/20 text-sm font-bold hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors">
                            Abrir Enlace 🔗
                        </a>
                    </div>
                </div>
            `).join('')}
    </div>
`;

    document.getElementById('add-recurso-btn').addEventListener('click', () => {
        showModal(`
   <h3 class="text-xl font-bold mb-4 text-teal-800 dark:text-teal-200"> Agregar Nueva Ayuda</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título</label>
                    <input type="text" id="rec-title" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:border-teal-500 text-gray-900 dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL del Enlace</label>
                    <input type="url" id="rec-url" placeholder="https://..." class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:border-teal-500 text-gray-900 dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL Imagen (Opcional)</label>
                    <input type="url" id="rec-img" placeholder="https://... (jpg/png)" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:border-teal-500 text-gray-900 dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                    <textarea id="rec-desc" rows="3" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:border-teal-500 resize-none text-gray-900 dark:text-white"></textarea>
                </div>
            </div>
            <button id="save-rec-btn" class="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl mt-6">Guardar</button>
`, async (modal) => {
            modal.querySelector('#save-rec-btn').addEventListener('click', async () => {
                const title = modal.querySelector('#rec-title').value;
                const url = modal.querySelector('#rec-url').value;
                const img = modal.querySelector('#rec-img').value;
                const desc = modal.querySelector('#rec-desc').value;

                if (!title || !url) return showNotification("Título y URL requeridos", "warning");

                try {
                    await addRecurso({ titulo: title, url, imagen: img, descripcion: desc });
                    showNotification("Recurso agregado");
                    modal.classList.add('hidden');
                    renderRecursosTab(container);
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                }
            });
        });
    });

    // Expose delete
    window.deleteRecurso = async (id) => {
        showCustomConfirm("¿Eliminar este recurso?", async () => {
            await deleteRecurso(id);
            renderRecursosTab(container);
        });
    };

    // Expose edit
    window.editRecurso = (id) => {
        const recurso = recursos.find(r => r.id === id);
        if (!recurso) return;

        showModal(`
   <h3 class="text-xl font-bold mb-4 text-teal-800 dark:text-teal-200"> Editar Ayuda</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título</label>
                    <input type="text" id="edit-rec-title" value="${recurso.titulo || ''}" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:border-teal-500 text-gray-900 dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL del Enlace</label>
                    <input type="url" id="edit-rec-url" value="${recurso.url || ''}" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:border-teal-500 text-gray-900 dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL Imagen (Opcional)</label>
                    <input type="url" id="edit-rec-img" value="${recurso.imagen || ''}" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:border-teal-500 text-gray-900 dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                    <textarea id="edit-rec-desc" rows="3" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:border-teal-500 resize-none text-gray-900 dark:text-white">${recurso.descripcion || ''}</textarea>
                </div>
            </div>
            <button id="update-rec-btn" class="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl mt-6">Actualizar</button>
`, async (modal) => {
            modal.querySelector('#update-rec-btn').addEventListener('click', async () => {
                const title = modal.querySelector('#edit-rec-title').value;
                const url = modal.querySelector('#edit-rec-url').value;
                const img = modal.querySelector('#edit-rec-img').value;
                const desc = modal.querySelector('#edit-rec-desc').value;

                if (!title || !url) return showNotification("Título y URL requeridos", "warning");

                try {
                    await updateRecurso(id, { titulo: title, url, imagen: img, descripcion: desc });
                    showNotification("Recurso actualizado");
                    modal.classList.add('hidden');
                    renderRecursosTab(container);
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                }
            });
        });
    };
};

const renderAsignacionesView = async (container) => {
    let currentView = 'activas'; // dashboard, activas, historial, campañas
    let selectedIds = new Set();

    // Fetch initial data
    const initData = async () => {
        const [territorios, conductores, programa, allHistory, config] = await Promise.all([
            getTerritorios(),
            getConductores(),
            getProgramaSemanal(),
            getHistorialReport(),
            getConfiguracion()
        ]);
        return { territorios, conductores, programa, allHistory, config };
    };

    let { territorios, conductores, programa, allHistory, config } = await initData();

    const reloadData = async () => {
        const data = await initData();
        territorios = data.territorios;
        conductores = data.conductores;
        programa = data.programa;
        allHistory = data.allHistory;
        config = data.config;
        renderMain();
    };

    const toggleSelect = async (id) => {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        renderMain();
    };

    window.actionToggleSelect = toggleSelect;

    const handleNewAssignment = async (editId = null) => {
        const item = editId ? territorios.find(x => x.id === editId) : null;
        const todayStr = new Date().toISOString().split('T')[0];

        // Prepare hours from config or default
        const horasOptions = (config.horarios_programa && config.horarios_programa.length > 0)
            ? config.horarios_programa
            : ['08:30', '08:45', '09:00', '09:15', '09:30', '14:30', '16:00', '18:00'];

        const configuredGroups = await getGroupsConfig();

        showModal(`
            <div class="flex flex-col h-full">
                <header class="shrink-0 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-700 p-6 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    <div class="relative z-10 flex items-center gap-4">
                        <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/20">📋</div>
                        <div>
                            <h3 class="text-xl font-black tracking-tight">${editId ? 'Editar Registro' : 'Nueva Asignación'}</h3>
                            <p class="text-[9px] opacity-70 uppercase tracking-[0.3em] font-black">Planificador de Territorio</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-6 space-y-6 overflow-y-auto">
                    <div class="p-1 space-y-6">
                        <div class="space-y-2">
                            <label class="block text-[11px] font-black text-indigo-500 uppercase tracking-widest ml-1">📍 ${editId ? 'Territorio Seleccionado' : 'Seleccionar Territorios (Múltiple)'}</label>
                            ${editId ? `
                                <div class="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-2xl border-2 border-indigo-500/20 flex items-center gap-3">
                                    <span class="text-2xl">📍</span>
                                    <div>
                                        <p class="text-sm font-black text-indigo-600 dark:text-indigo-400">Territorio ${item.numero}</p>
                                        <p class="text-[10px] opacity-60 uppercase">${item.nombre || 'Área general'}</p>
                                    </div>
                                    <input type="hidden" id="asig-terr-single" value="${item.id}">
                                </div>
                            ` : `
                                <div class="flex flex-col gap-3">
                                    <div class="flex justify-between items-center px-1">
                                        <button type="button" id="btn-select-all-terr" class="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-tighter">Seleccionar Todos</button>
                                        <span id="selected-count" class="text-[10px] font-black text-gray-400 uppercase">0 Seleccionados</span>
                                    </div>
                                    <div id="terr-checklist" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-gray-50 dark:bg-black/40 rounded-3xl p-4 border-2 border-transparent focus-within:border-indigo-500/30 transition-all max-h-48 overflow-y-auto custom-scrollbar">
                                        ${territorios
                .filter(t => (t.estado !== 'Asignado' && t.estado !== 'Pendiente'))
                .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
                .map(t => `
                                                <label class="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-white/5 rounded-xl cursor-pointer transition-all border border-transparent hover:border-indigo-500/20 group">
                                                    <input type="checkbox" name="asig-terr-check" value="${t.id}" data-num="${t.numero}" class="w-5 h-5 rounded-lg border-2 border-indigo-200 dark:border-white/10 bg-transparent accent-indigo-600 transition-transform group-active:scale-90">
                                                    <span class="text-xs font-bold text-gray-700 dark:text-gray-200">#${t.numero}</span>
                                                </label>
                                            `).join('')}
                                        ${territorios.filter(t => t.estado !== 'Asignado' && t.estado !== 'Pendiente').length === 0 ? '<p class="col-span-full py-4 text-center text-[10px] text-gray-400 font-bold uppercase">No hay territorios disponibles</p>' : ''}
                                    </div>
                                </div>
                            `}
                        </div>

                        <div class="space-y-2">
                            <label class="block text-[11px] font-black text-indigo-500 uppercase tracking-widest ml-1">🚩 Campaña Especial</label>
                            <div class="relative group">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">#</span>
                                <input type="text" id="asig-campana" value="${item?.campana || ''}" list="campanas-list" class="w-full pl-8 bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 dark:border-white/5 rounded-2xl p-4 outline-none transition-all font-bold text-gray-800 dark:text-gray-100 placeholder-gray-400 shadow-sm" placeholder="Opcional">
                                <datalist id="campanas-list">
                                    ${[...new Set(allHistory.map(h => h.campana).filter(Boolean))].map(c => `<option value="${c}">`).join('')}
                                </datalist>
                            </div>
                        </div>
                    </div>

                    <!-- Sección Responsables -->
                    <div class="bg-indigo-500/[0.03] dark:bg-indigo-500/[0.05] p-6 rounded-[2rem] border border-indigo-500/10 space-y-6">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-xs font-black text-indigo-600 uppercase tracking-wider">👤 Equipo de Predicación</span>
                            <div class="h-px flex-1 bg-indigo-500/10"></div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-2">
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Conductor Principal</label>
                                <div class="relative group">
                                    <select id="asig-cond" class="w-full bg-white dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 dark:border-white/5 rounded-2xl p-4 outline-none transition-all font-bold text-gray-800 dark:text-gray-100 appearance-none shadow-sm">
                                        <option value="" disabled ${!item ? 'selected' : ''}>Elegir publicador...</option>
                                        ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `<option value="${c.nombre}" ${item?.asignado_a === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                                    </select>
                                    <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">▼</div>
                                </div>
                            </div>

                            <div class="space-y-2">
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Auxiliar de Apoyo</label>
                                <div class="relative group">
                                    <select id="asig-aux" class="w-full bg-white dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 dark:border-white/5 rounded-2xl p-4 outline-none transition-all font-bold text-gray-800 dark:text-gray-100 appearance-none shadow-sm">
                                        <option value="">Ningún auxiliar</option>
                                        ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `<option value="${c.nombre}" ${item?.auxiliar === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                                    </select>
                                    <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">▼</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sección Logística -->
                    <div class="p-1 space-y-6">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-xs font-black text-gray-400 uppercase tracking-wider">🕒 Logística y Horario</span>
                            <div class="h-px flex-1 bg-gray-200 dark:bg-white/5"></div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div class="space-y-2">
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Día de Salida</label>
                                <select id="asig-date-salida" class="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 dark:border-white/5 rounded-2xl p-4 outline-none transition-all font-bold text-gray-800 dark:text-gray-100 shadow-sm appearance-none">
                                    <option value="">Seleccionar día...</option>
                                    ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => `
                                        <option value="${d}" ${item?.fecha_salida && ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(item.fecha_salida).getUTCDay()] === d ? 'selected' : ''}>${d}</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="space-y-2">
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Turno</label>
                                <select id="asig-turno" class="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 dark:border-white/5 rounded-2xl p-4 outline-none transition-all font-bold text-gray-800 dark:text-gray-100 shadow-sm appearance-none">
                                    <option value="manana" ${item?.turno === 'manana' ? 'selected' : ''}>${config.jornadas?.manana || '🌅 Mañana'}</option>
                                    <option value="tarde" ${item?.turno === 'tarde' ? 'selected' : ''}>${config.jornadas?.tarde || '☀️ Tarde'}</option>
                                    <option value="noche" ${item?.turno === 'noche' ? 'selected' : ''}>${config.jornadas?.noche || '🌙 Noche'}</option>
                                </select>
                            </div>

                            <div class="space-y-2">
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Faceta</label>
                                <select id="asig-faceta" class="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 dark:border-white/5 rounded-2xl p-4 outline-none transition-all font-bold text-gray-800 dark:text-gray-100 shadow-sm appearance-none">
                                    ${(config.facetas || ['Casa en Casa', 'Telefónica', 'Pública', 'Cartas']).map(f => `<option value="${f}" ${item?.faceta === f ? 'selected' : ''}>${f}</option>`).join('')}
                                </select>
                            </div>

                            <div class="space-y-2">
                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Hora de Salida</label>
                                <select id="asig-hora" class="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 dark:border-white/5 rounded-2xl p-4 outline-none transition-all font-bold text-gray-800 dark:text-gray-100 shadow-sm appearance-none">
                                     ${horasOptions.map(h => `<option value="${h}" ${item?.hora === h ? 'selected' : ''}>${h}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Punto de Encuentro</label>
                            <select id="asig-lugar" class="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 dark:border-white/5 rounded-2xl p-4 outline-none transition-all font-bold text-gray-800 dark:text-gray-100 shadow-sm appearance-none">
                                <option value="">Estándar de la congregación...</option>
                                ${(config.lugares || []).map(l => `<option value="${l}" ${item?.lugar === l ? 'selected' : ''}>${l}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Lógica Especial Fines de Semana -->
                    <div id="sunday-logic" class="hidden bg-gradient-to-br from-indigo-600 to-purple-800 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                        <div class="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                        <div class="relative z-10">
                            <div class="flex items-center justify-between mb-6">
                                <p class="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2"><span>🛡️</span> División de Grupos</p>
                                <select id="asig-split-count" class="bg-white/20 border border-white/20 rounded-xl text-xs font-bold px-3 py-1.5 outline-none backdrop-blur-md">
                                    <option value="1" class="text-gray-800">1 Bloque Único</option>
                                    <option value="2" class="text-gray-800">2 Grupos Separados</option>
                                    <option value="3" class="text-gray-800">3 Grupos Separados</option>
                                </select>
                            </div>
                            <div id="sunday-blocks" class="space-y-4"></div>
                            <div id="asig-group-single" class="mt-4">
                                <label class="block text-[10px] font-black opacity-60 uppercase mb-3 ml-1">Seleccionar Grupos Participantes</label>
                                <div id="groups-checklist" class="grid grid-cols-2 gap-2 bg-black/10 rounded-2xl p-4 border border-white/10 max-h-40 overflow-y-auto custom-scrollbar">
                                    ${configuredGroups.map(g => `
                                        <label class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl cursor-pointer transition-all">
                                            <input type="checkbox" name="asig-group-check" value="${g.nombre}" class="w-5 h-5 rounded-lg border-2 border-white/20 bg-transparent accent-white">
                                            <span class="text-xs font-bold">${g.nombre}</span>
                                        </label>
                                    `).join('')}
                                    ${configuredGroups.length === 0 ? '<p class="text-[9px] opacity-50 col-span-2 text-center py-2">No hay grupos configurados</p>' : ''}
                                </div>
                                <input type="hidden" id="asig-grupos" value="${item?.grupos || ''}">
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-2 bg-indigo-50/50 dark:bg-white/5 rounded-3xl border border-indigo-100 dark:border-white/10">
                        <div class="space-y-2 p-2">
                            <label class="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest ml-1">Fecha de Asignación</label>
                            <input type="date" id="asig-date" value="${todayStr}" class="w-full bg-white dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl p-4 outline-none font-bold text-sm shadow-sm transition-all">
                        </div>
                        <div class="p-4 flex items-center">
                            <p class="text-[10px] text-gray-400 font-medium leading-relaxed italic">Normalmente es hoy, pero puedes ajustarla para registros pasados.</p>
                        </div>
                    </div>

                </div>

                <div class="shrink-0 p-6 bg-gray-50 dark:bg-black/40 border-t border-black/5 dark:border-white/5 sticky bottom-0 z-30">
                    <button id="confirm-asig" class="w-full group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-700 py-6 rounded-[2rem] text-white font-black shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-sm">
                        <span class="relative z-10">${editId ? 'Guardar Cambios' : 'Confirmar Asignación'}</span>
                        <div class="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                    </button>
                </div>
            </div>
        `, (modal) => {
            const dateInput = modal.querySelector('#asig-date');
            const salidaInput = modal.querySelector('#asig-date-salida');
            const sunLogic = modal.querySelector('#sunday-logic');
            const splitSelect = modal.querySelector('#asig-split-count');
            const blocksContainer = modal.querySelector('#sunday-blocks');
            const singleGroupContainer = modal.querySelector('#asig-group-single');

            const renderBlocks = () => {
                const count = parseInt(splitSelect.value);
                if (count === 1) {
                    blocksContainer.innerHTML = '';
                    singleGroupContainer.classList.remove('hidden');
                    return;
                }
                singleGroupContainer.classList.add('hidden');

                let html = '';
                for (let i = 1; i <= count; i++) {
                    html += `
                        <div class="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-purple-100 dark:border-purple-900/30 space-y-2">
                            <p class="text-[9px] font-black text-purple-400 uppercase">BLOQUE ${i}</p>
                            <div class="grid grid-cols-2 gap-2">
                                <select class="block-cond w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs font-bold">
                                    <option value="">Conductor...</option>
                                    ${conductores.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                                </select>
                                <select class="block-group w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs font-bold">
                                    <option value="">Grupo...</option>
                                    <option value="G1-5">G1-5</option><option value="G2-6">G2-6</option><option value="G3-4">G3-4</option>
                                    ${Array.from({ length: 12 }, (_, i) => `<option value="G${i + 1}">G${i + 1}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    `;
                }
                blocksContainer.innerHTML = html;
            };

            const checkSunday = () => {
                const dayName = salidaInput.value;
                if (dayName === 'Domingo' || dayName === 'Sábado') sunLogic.classList.remove('hidden');
                else sunLogic.classList.add('hidden');
            };

            const hiddenGroupsInput = modal.querySelector('#asig-grupos');
            const checkboxes = modal.querySelectorAll('input[name="asig-group-check"]');

            // Logic for multiple territory selection
            const terrCheckboxes = modal.querySelectorAll('input[name="asig-terr-check"]');
            const selectedCountLabel = modal.querySelector('#selected-count');
            const btnSelectAll = modal.querySelector('#btn-select-all-terr');

            if (selectedCountLabel) {
                const updateCount = () => {
                    const count = Array.from(terrCheckboxes).filter(cb => cb.checked).length;
                    selectedCountLabel.innerText = `${count} Seleccionados`;
                };
                terrCheckboxes.forEach(cb => cb.onchange = updateCount);
                if (btnSelectAll) {
                    btnSelectAll.onclick = () => {
                        const allChecked = Array.from(terrCheckboxes).every(cb => cb.checked);
                        terrCheckboxes.forEach(cb => cb.checked = !allChecked);
                        updateCount();
                    };
                }
            }

            // Re-sync checkboxes if editing
            if (hiddenGroupsInput.value) {
                const selected = hiddenGroupsInput.value.split(', ');
                checkboxes.forEach(cb => { if (selected.includes(cb.value)) cb.checked = true; });
            }

            checkboxes.forEach(cb => {
                cb.onchange = () => {
                    const values = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
                    hiddenGroupsInput.value = values.join(', ');
                };
            });

            salidaInput.onchange = checkSunday;
            splitSelect.onchange = renderBlocks;
            checkSunday();

            modal.querySelector('#confirm-asig').onclick = async (e) => {
                let terrIDs = [];
                if (editId) {
                    terrIDs = [modal.querySelector('#asig-terr-single').value];
                } else {
                    terrIDs = Array.from(modal.querySelectorAll('input[name="asig-terr-check"]:checked')).map(cb => cb.value);
                }

                const cond = modal.querySelector('#asig-cond').value;
                const aux = modal.querySelector('#asig-aux').value;
                const date = modal.querySelector('#asig-date').value;
                const dateSalida = modal.querySelector('#asig-date-salida').value;
                const turno = modal.querySelector('#asig-turno').value;
                const faceta = modal.querySelector('#asig-faceta').value;
                const lugar = modal.querySelector('#asig-lugar').value;
                const hora = modal.querySelector('#asig-hora').value;
                const camp = modal.querySelector('#asig-campana').value;
                const groups = modal.querySelector('#asig-grupos').value;
                const splitCount = parseInt(splitSelect.value);

                if (terrIDs.length === 0 || !cond || !date) return showNotification("Faltan campos críticos (Territorio, Conductor o Fecha)", "warning");

                const blocks = [];
                if (splitCount > 1) {
                    const conds = modal.querySelectorAll('.block-cond');
                    const grps = modal.querySelectorAll('.block-group');
                    conds.forEach((c, i) => {
                        if (c.value) blocks.push({ conductor: c.value, grupos: grps[i].value });
                    });
                }

                e.target.disabled = true;
                e.target.innerHTML = "PROCESANDO...";

                const calculateSalidaDate = (assignDateStr, dayName) => {
                    if (!dayName) return null;
                    const daysMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
                    const targetDay = daysMap[dayName];

                    // Parse as local components to avoid UTC shift
                    const [y, m, d] = assignDateStr.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);

                    const currentDay = dateObj.getDay();
                    let diff = targetDay - currentDay;
                    if (diff <= 0) diff += 7;
                    dateObj.setDate(dateObj.getDate() + diff);

                    // Return T12:00:00Z to ensure it lands on the correct day regardless of browser timezone
                    const finalY = dateObj.getFullYear();
                    const finalM = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const finalD = String(dateObj.getDate()).padStart(2, '0');
                    return `${finalY}-${finalM}-${finalD}T12:00:00Z`;
                };

                try {
                    const finalFechaSalida = calculateSalidaDate(date, dateSalida);

                    // Bulk assign processing
                    for (const tid of terrIDs) {
                        await assignTerritorio(tid, cond, {
                            auxiliar: aux,
                            fecha_asignacion: new Date(date + 'T12:00:00Z').toISOString(),
                            fecha_salida: finalFechaSalida,
                            turno, faceta, lugar, hora, campana: camp, grupos: groups,
                            blocks: blocks.length > 0 ? blocks : null
                        });
                    }

                    if (camp) await saveCampana(camp);

                    showNotification(terrIDs.length > 1 ? `${terrIDs.length} territorios asignados` : (editId ? "Asignación actualizada" : "Territorio asignado con éxito"), "success");
                    modal.classList.add('hidden');
                    reloadData();
                } catch (err) {
                    showNotification("Error: " + err.message, "error");
                    e.target.disabled = false;
                    e.target.innerHTML = editId ? "GUARDAR" : "CONFIRMAR";
                }
            };
        });
    };

    const handleBulkReturn = async () => {
        const assignedTerritories = territorios.filter(t => t.estado === 'Asignado' || t.estado === 'Pendiente')
            .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

        if (assignedTerritories.length === 0) return showNotification("No hay territorios asignados para devolver", "info");

        showModal(`
            <div class="overflow-hidden">
                <header class="shrink-0 flex items-center justify-between bg-gradient-to-r from-red-600 to-rose-700 p-6 text-white shadow-2xl relative overflow-hidden">
                    <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    <div class="relative z-10 flex items-center gap-4">
                        <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/20">📥</div>
                        <div>
                            <h3 class="text-xl font-black tracking-tight">Cerrar Asignaciones</h3>
                            <p class="text-[9px] opacity-70 uppercase tracking-[0.3em] font-black">Recepción de Informes</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-6 space-y-6 overflow-y-auto">
                <div class="space-y-6 animate-fade-in-up">
                    <!-- Selección de Territorios -->
                    <div class="space-y-4">
                        <div class="flex justify-between items-center px-1">
                            <label class="text-[11px] font-black text-rose-600 uppercase tracking-widest">Seleccionar Registros</label>
                            <button id="select-all-returns" class="text-[10px] font-black text-rose-600 uppercase hover:underline tracking-wider">Marcar Todos</button>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-black/20 rounded-[2.5rem] border border-black/5 custom-scrollbar-dark ring-8 ring-gray-100 dark:ring-white/5 mx-1">
                            ${assignedTerritories.map(t => `
                                <label class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border-2 border-transparent hover:border-rose-500/30 cursor-pointer transition-all group scale-95 hover:scale-100 shadow-sm">
                                    <div class="relative">
                                        <input type="checkbox" class="return-check w-6 h-6 accent-rose-600 rounded-lg" value="${t.id}" ${selectedIds.has(t.id) ? 'checked' : ''}>
                                    </div>
                                    <div class="min-w-0">
                                        <p class="text-sm font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                            <span class="w-6 h-6 bg-rose-500/10 text-rose-600 rounded flex items-center justify-center text-[10px]">${t.numero}</span>
                                            ${t.asignado_a}
                                        </p>
                                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Pendiente de cierre</p>
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Logística de Cierre -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                        <div class="space-y-2">
                            <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Fecha de Devolución</label>
                            <input type="date" id="bulk-return-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-rose-500/50 rounded-2xl p-4 outline-none font-bold text-sm shadow-sm">
                        </div>
                        <div class="space-y-2">
                            <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Estado Final de los Datos</label>
                            <div class="relative">
                                <select id="bulk-return-status" class="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-rose-500/50 rounded-2xl p-4 outline-none font-bold text-sm shadow-sm appearance-none">
                                    <option value="Completado" selected>✅ Territorios Completados</option>
                                    <option value="Perdido">⚠️ Reportar como Perdido</option>
                                </select>
                                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">▼</div>
                            </div>
                        </div>
                    </div>

                    <!-- Acción Especial -->
                    <div class="px-1">
                        <label class="flex items-center gap-4 p-5 bg-rose-500/[0.03] dark:bg-rose-500/[0.05] rounded-3xl border border-rose-500/10 cursor-pointer hover:bg-rose-500/[0.06] transition-all group shadow-sm">
                            <input type="checkbox" id="bulk-repeat" class="w-6 h-6 accent-rose-600 rounded-lg">
                            <div>
                                <p class="text-[13px] font-black text-rose-800 dark:text-rose-400 leading-tight">Mismo publicador mantiene el territorio</p>
                                <p class="text-[10px] text-rose-600/60 uppercase font-black tracking-tighter mt-0.5">Reinicia el ciclo de predicación automáticamente hoy</p>
                            </div>
                        </label>
                    </div>

                    <div class="pt-2">
                        <button id="confirm-bulk-return" class="w-full group relative overflow-hidden bg-gradient-to-r from-red-600 to-rose-700 py-5 rounded-2xl text-white font-black shadow-2xl shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-[1.02] transition-all uppercase tracking-[0.2em] text-sm">
                            <span class="relative z-10">Confirmar Devolución</span>
                            <div class="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                        </button>
                    </div>
                </div>
                </div>
        `, (modal) => {
            const selectAll = modal.querySelector('#select-all-returns');
            const checks = modal.querySelectorAll('.return-check');

            selectAll.onclick = () => {
                const someUnchecked = Array.from(checks).some(c => !c.checked);
                checks.forEach(c => c.checked = someUnchecked);
                selectAll.innerText = someUnchecked ? 'Desmarcar Todos' : 'Marcar Todos';
            };

            modal.querySelector('#confirm-bulk-return').onclick = async (e) => {
                const targetIds = Array.from(checks).filter(c => c.checked).map(c => c.value);
                if (targetIds.length === 0) return showNotification("Selecciona al menos un territorio", "warning");

                const date = modal.querySelector('#bulk-return-date').value;
                const status = modal.querySelector('#bulk-return-status').value;
                const repeat = modal.querySelector('#bulk-repeat').checked;

                const itemsToProcess = assignedTerritories.filter(t => targetIds.includes(t.id));

                e.target.disabled = true;
                e.target.innerHTML = "PROCESANDO...";

                try {
                    for (const item of itemsToProcess) {
                        await returnTerritorio(item.id, repeat ? "Repetición automática" : "Devolución masiva", date, status);
                        if (repeat) {
                            await assignTerritorio(item.id, item.asignado_a, {
                                auxiliar: item.auxiliar,
                                lugar: item.lugar,
                                hora: item.hora,
                                faceta: item.faceta,
                                turno: item.turno,
                                campana: item.campana,
                                grupos: item.grupos,
                                fecha_asignacion: new Date().toISOString()
                            });
                        }
                    }

                    showNotification(`${targetIds.length} territorios procesados con éxito`, "success");
                    selectedIds.clear();
                    modal.classList.add('hidden');
                    reloadData();
                } catch (err) {
                    showNotification("Error: " + err.message, "error");
                    e.target.disabled = false;
                }
            };
        });
    };

    const handleEditActive = async (id, num, conductor) => {
        const t = territorios.find(x => x.id === id);
        if (!t) return;

        showModal(`
             <div class="flex flex-col h-full">
                <header class="shrink-0 flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-700 p-6 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    <div class="relative z-10 flex items-center gap-4">
                        <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/20">✏️</div>
                        <div>
                            <h3 class="text-xl font-black tracking-tight">Editar Asignación</h3>
                            <p class="text-[9px] opacity-70 uppercase tracking-[0.3em] font-black">Territorio ${num}</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-6 space-y-5 overflow-y-auto">
                    <div class="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-black/5 flex items-center gap-3 mb-2">
                         <span class="text-xl">👤</span>
                         <div class="min-w-0">
                            <p class="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em]">Actual</p>
                            <p class="font-bold text-sm truncate">${conductor}</p>
                         </div>
                    </div>

                    <div class="space-y-4">
                        <div class="space-y-2">
                             <label class="block text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Cambiar Conductor</label>
                             <select id="edit-asig-new-cond" class="w-full bg-white dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl p-4 outline-none font-bold text-sm shadow-sm">
                                ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `
                                     <option value="${c.nombre}" ${c.nombre === t.asignado_a ? 'selected' : ''}>${c.nombre}</option>
                                `).join('')}
                             </select>
                        </div>

                        <div class="space-y-2">
                             <label class="block text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Auxiliar de Apoyo</label>
                             <select id="edit-asig-aux" class="w-full bg-white dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl p-4 outline-none font-bold text-sm shadow-sm">
                                <option value="">Ningún auxiliar</option>
                                ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `
                                     <option value="${c.nombre}" ${c.nombre === t.auxiliar ? 'selected' : ''}>${c.nombre}</option>
                                `).join('')}
                             </select>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <label class="block text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Jornada</label>
                                <select id="edit-asig-turno" class="w-full bg-white dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl p-4 outline-none font-bold text-sm shadow-sm">
                                    <option value="manana" ${t.turno === 'manana' ? 'selected' : ''}>🌅 Mañana</option>
                                    <option value="tarde" ${t.turno === 'tarde' ? 'selected' : ''}>☀️ Tarde</option>
                                    <option value="noche" ${t.turno === 'noche' ? 'selected' : ''}>🌙 Noche</option>
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="block text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Horario</label>
                                <select id="edit-asig-hora" class="w-full bg-white dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl p-4 outline-none font-bold text-sm shadow-sm">
                                    ${(config.horarios_programa && config.horarios_programa.length > 0 ? config.horarios_programa : ['08:30', '08:45', '09:00', '09:15', '09:30', '14:30', '16:00', '18:00']).map(h => `
                                        <option value="${h}" ${t.hora === h ? 'selected' : ''}>${h}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <label class="block text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Faceta</label>
                            <select id="edit-asig-faceta" class="w-full bg-white dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl p-4 outline-none font-bold text-sm shadow-sm">
                                ${(config.facetas || ['Casa en Casa', 'Telefónica', 'Pública', 'Cartas']).map(f => `
                                    <option value="${f}" ${t.faceta === f ? 'selected' : ''}>${f}</option>
                                `).join('')}
                            </select>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <label class="block text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Fecha Asignación</label>
                                <input type="date" id="edit-asig-date" value="${t.fecha_asignacion ? t.fecha_asignacion.split('T')[0] : ''}" class="w-full bg-white dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl p-4 outline-none font-bold text-sm shadow-sm">
                            </div>

                            <div class="space-y-2">
                                <label class="block text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Día Salida</label>
                                <select id="edit-asig-date-salida" class="w-full bg-white dark:bg-black/40 border-2 border-transparent focus:border-indigo-500/50 rounded-2xl p-4 outline-none font-bold text-sm shadow-sm">
                                    <option value="">Seleccionar día...</option>
                                    ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => `
                                        <option value="${d}" ${t.fecha_salida && ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(t.fecha_salida).getUTCDay()] === d ? 'selected' : ''}>${d}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="shrink-0 p-6 bg-gray-50 dark:bg-black/40 border-t border-black/5 dark:border-white/5 flex gap-4 sticky bottom-0 z-30">
                     <button id="delete-active-assign" class="flex-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 py-5 rounded-2xl font-black transition-all uppercase tracking-widest text-[10px] border border-red-200 dark:border-red-500/20">
                        ❌ Eliminar
                     </button>
                     <button id="save-active-edit" class="flex-[2] bg-purple-600 hover:bg-purple-500 py-5 rounded-2xl text-white font-black shadow-xl shadow-purple-500/20 transition-all uppercase tracking-widest text-[10px]">
                        Guardar Cambios
                     </button>
                </div>
            </div>
        `, (modal) => {

            modal.querySelector('#delete-active-assign').onclick = async () => {
                showCustomConfirm(`
                    <div class="text-left">
                        <h4 class="font-bold text-lg mb-2">¿Eliminar asignación de ${num}?</h4>
                        <p class="text-sm text-gray-600 mb-4">Esta acción liberará el territorio y borrará esta asignación actual sin guardarla en el historial histórico de completados.</p>
                        <p class="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">⚠️ Úsalo solo si te equivocaste al asignar.</p>
                    </div>
                 `, async () => {
                    try {
                        await cancelarAsignacion(id);
                        showNotification("Asignación eliminada correctamente");
                        modal.classList.add('hidden');
                        reloadData();
                    } catch (e) {
                        showNotification("Error: " + e.message, "error");
                    }
                });
            };

            modal.querySelector('#save-active-edit').onclick = async (e) => {
                const newDate = modal.querySelector('#edit-asig-date').value;
                const newDateSalida = modal.querySelector('#edit-asig-date-salida').value;
                const newCond = modal.querySelector('#edit-asig-new-cond').value;

                const calculateSalidaDate = (assignDateStr, dayName) => {
                    if (!dayName) return null;
                    const daysMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
                    const targetDay = daysMap[dayName];
                    const [y, m, d] = assignDateStr.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    const currentDay = dateObj.getDay();
                    let diff = targetDay - currentDay;
                    if (diff <= 0) diff += 7;
                    dateObj.setDate(dateObj.getDate() + diff);
                    const finalY = dateObj.getFullYear();
                    const finalM = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const finalD = String(dateObj.getDate()).padStart(2, '0');
                    return `${finalY}-${finalM}-${finalD}T12:00:00Z`;
                };

                e.target.disabled = true;
                e.target.innerHTML = "GUARDANDO...";
                try {
                    const finalFechaSalida = calculateSalidaDate(newDate, newDateSalida);

                    await updateAssignmentData(id, {
                        fecha_asignacion: newDate ? new Date(newDate + 'T12:00:00Z').toISOString() : t.fecha_asignacion,
                        fecha_salida: finalFechaSalida,
                        asignado_a: newCond,
                        auxiliar: modal.querySelector('#edit-asig-aux').value,
                        turno: modal.querySelector('#edit-asig-turno').value,
                        hora: modal.querySelector('#edit-asig-hora').value,
                        faceta: modal.querySelector('#edit-asig-faceta').value,
                        estado: t.estado
                    });
                    showNotification("Asignación actualizada");
                    modal.closest('#modal-container').classList.add('hidden');
                    reloadData();
                } catch (err) {
                    showNotification("Error: " + err.message, "error");
                    e.target.disabled = false;
                    e.target.innerHTML = "Guardar Cambios";
                }
            };
        });
    };

    const handleHistory = (territoryId, territoryNum) => {
        const history = allHistory.filter(h => h.territorio_id === territoryId || h.numero === territoryNum)
            .sort((a, b) => new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0));

        showModal(`
            <div class="flex flex-col h-full">
                <header class="shrink-0 flex items-center justify-between bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                    <div class="relative z-10 flex items-center gap-4">
                        <div class="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl border border-white/10 shadow-2xl">📜</div>
                        <div>
                            <h3 class="text-xl font-black tracking-tight">Timeline de Vida</h3>
                            <p class="text-[9px] opacity-60 uppercase tracking-[0.3em] font-black">Territorio ${territoryNum}</p>
                        </div>
                    </div>
                </header>
                
                <div class="flex-1 p-6 relative overflow-y-auto">
                    <!-- Vertical Line -->
                    <div class="absolute left-12 top-8 bottom-8 w-0.5 bg-gradient-to-b from-teal-500/50 via-gray-200 dark:via-white/10 to-transparent"></div>

                    <div class="space-y-12">
                        ${history.length === 0 ? `
                            <div class="py-20 text-center opacity-30 ml-8">
                                <div class="text-5xl mb-4">📜</div>
                                <p class="font-black uppercase tracking-widest text-xs">Sin registros históricos</p>
                            </div>
                        ` : history.map((h, index) => {
            const dateAsig = h.fecha_asignacion ? new Date(h.fecha_asignacion) : null;
            const dateEntrega = h.fecha_entrega ? new Date(h.fecha_entrega) : null;
            const isCurrent = !h.fecha_entrega && h.estado !== 'Completado' && h.estado !== 'Devuelto';

            return `
                                <div class="relative pl-12 group">
                                    <!-- Indicator Dot -->
                                    <div class="absolute left-[3.35rem] top-1.5 w-4 h-4 rounded-full border-4 ${isCurrent ? 'bg-teal-500 border-teal-500/30 animate-pulse' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-white/10'} z-10 group-hover:scale-125 transition-transform"></div>
                                    
                                    <div class="morphinglass-card !p-6 border-l-4 ${isCurrent ? 'border-l-teal-500 shadow-teal-500/10' : 'border-l-transparent'} hover:border-l-teal-500 transition-all">
                                        <div class="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 class="font-black text-gray-900 dark:text-white text-lg">${h.conductor}</h4>
                                                <div class="flex items-center gap-2 mt-1">
                                                    <span class="text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-teal-600' : 'text-gray-400'}">${isCurrent ? '⚡ En curso' : '✅ Finalizado'}</span>
                                                    ${h.auxiliar ? `<span class="text-[10px] text-gray-400">w/ ${h.auxiliar}</span>` : ''}
                                                </div>
                                            </div>
                                            <div class="flex flex-col items-end">
                                                <span class="text-[10px] font-bold text-gray-400 uppercase">Ciclo #${history.length - index}</span>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-2 gap-4">
                                            <div class="bg-black/5 dark:bg-white/5 rounded-xl p-3 border border-black/5 dark:border-white/5">
                                                <span class="block text-[8px] font-black text-gray-400 uppercase mb-1">Inició</span>
                                                <span class="text-xs font-bold text-gray-700 dark:text-gray-300">${dateAsig ? dateAsig.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'}</span>
                                            </div>
                                            <div class="bg-black/5 dark:bg-white/5 rounded-xl p-3 border border-black/5 dark:border-white/5">
                                                <span class="block text-[8px] font-black text-gray-400 uppercase mb-1">Finalizó</span>
                                                <span class="text-xs font-bold text-gray-700 dark:text-gray-300">${dateEntrega ? dateEntrega.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : (isCurrent ? 'Actual' : '--')}</span>
                                            </div>
                                        </div>

                                        ${h.observaciones ? `
                                            <div class="mt-4 p-3 bg-teal-500/5 rounded-xl border border-teal-500/10 text-left">
                                                <p class="text-[10px] text-teal-700 dark:text-teal-400 leading-relaxed italic">"${h.observaciones}"</p>
                                            </div>
                                        ` : ''}

                                        <div class="mt-6 flex justify-end gap-2 pt-4 border-t border-black/5 dark:border-white/5">
                                            <button onclick="window.actionEditHist('${h.id}')" class="p-2 text-gray-400 hover:text-teal-600 transition-colors" title="Editar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            <button onclick="window.actionDeleteHistUI('${h.id}', '${h.conductor}', '${h.numero}')" class="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Borrar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `, null, 'max-w-xl');
    };

    // --- GLOBAL HISTORY MANAGER (Move here to be always ready) ---
    const showEditHistoryModal = async (recordId, sourceData = null) => {
        // Source data can be the 'allHistory' or 'history' from a specific view
        const historyList = sourceData || allHistory;
        const rec = historyList.find(r => r.id === recordId);
        if (!rec) {
            // Fallback: try to fetch it if not in memory
            showNotification("Cargando datos del registro...");
            const fullHist = await getHistorialReport();
            const freshRec = fullHist.find(r => r.id === recordId);
            if (!freshRec) return showNotification("No se encontró el registro", "error");
            return showEditHistoryModal(recordId, fullHist);
        }

        showModal(`
            <div class="p-8 space-y-6">
                <div>
                    <h3 class="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Editar Historial</h3>
                    <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Territorio ${rec.numero || ''}</p>
                </div>
                <div class="space-y-4">
                 <div>
                    <label class="text-xs font-bold text-gray-400 uppercase">Fecha Asignación Original</label>
                    <input type="date" id="edit-h-date" value="${rec.fecha_asignacion ? rec.fecha_asignacion.split("T")[0] : ""}" class="w-full bg-gray-50 dark:bg-black/40 text-gray-800 dark:text-white p-3 rounded-xl border border-gray-200 dark:border-white/10 outline-none focus:border-teal-500">
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-400 uppercase">Conductor</label>
                     <input type="text" id="edit-h-cond" value="${rec.conductor}" class="w-full bg-gray-50 dark:bg-black/40 text-gray-800 dark:text-white p-3 rounded-xl border border-gray-200 dark:border-white/10 outline-none focus:border-teal-500">
                </div>
                <div>
                    <label class="text-xs font-bold text-gray-400 uppercase">Estado</label>
                    <select id="edit-h-status" class="w-full bg-gray-50 dark:bg-black/40 text-gray-800 dark:text-white p-3 rounded-xl border border-gray-200 dark:border-white/10 outline-none focus:border-teal-500">
                        <option value="Asignado" ${rec.estado === "Asignado" ? "selected" : ""}>Asignado (Activo)</option>
                        <option value="Completado" ${rec.estado === "Completado" ? "selected" : ""}>Completado</option>
                        <option value="Devuelto" ${rec.estado === "Devuelto" ? "selected" : ""}>Devuelto</option>
                        <option value="Predicado" ${rec.estado === "Predicado" ? "selected" : ""}>Predicado</option>
                    </select>
                </div>
                 <div class="flex items-center gap-3 mt-4 bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-200 dark:border-yellow-700/30">
                    <input type="checkbox" id="edit-h-sync" checked class="w-5 h-5 accent-teal-600 rounded">
                    <label for="edit-h-sync" class="text-xs text-yellow-800 dark:text-yellow-200 leading-tight">
                        <b>Sincronizar Territorio Actual:</b><br>
                        Si marcas esto, también se actualizará el estado actual del territorio "${rec.numero}" con estos datos.
                    </label>
                </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
                <button class="px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 font-bold hover:bg-gray-200 transition-all text-xs uppercase tracking-wider" id="btn-cancel-hist">Cancelar</button>
                <button class="px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold shadow-lg shadow-teal-500/30 hover:bg-teal-500 transition-all text-xs uppercase tracking-wider" id="btn-save-hist">Guardar Cambios</button>
            </div>
        `, (modal) => {
            modal.querySelector("#btn-cancel-hist").onclick = () => modal.classList.add("hidden");
            modal.querySelector("#btn-save-hist").onclick = async () => {
                const btn = modal.querySelector("#btn-save-hist");
                btn.innerText = "Guadando..."; btn.disabled = true;
                try {
                    const newDate = modal.querySelector("#edit-h-date").value;
                    const newC = modal.querySelector("#edit-h-cond").value;
                    const newS = modal.querySelector("#edit-h-status").value;
                    const sync = modal.querySelector("#edit-h-sync").checked;
                    const payload = { conductor: newC, estado: newS };
                    if (newDate) payload.fecha_asignacion = new Date(newDate + 'T12:00:00Z').toISOString();
                    await updateHistoryRecord(recordId, payload);
                    if (sync && rec.territorio_id) {
                        const tUpdate = { asignado_a: newC, estado: newS };
                        if (newS !== 'Asignado') {
                            tUpdate.asignado_a = null;
                            tUpdate.fecha_asignacion = null;
                            tUpdate.estado = (newS === 'Completado' || newS === 'Predicado') ? 'Predicado' : newS;
                        }
                        await updateTerritorio(rec.territorio_id, tUpdate);
                    }
                    showNotification("Registro actualizado");
                    modal.classList.add("hidden");
                    reloadData();
                } catch (e) { showNotification(e.message, "error"); btn.innerText = "Error"; btn.disabled = false; }
            };
        });
    };

    const showDeleteHistoryModal = (recordId, cond, num, sourceData = null) => {
        showCustomConfirm(`
            <div class="text-left">
                <p class="mb-4 text-gray-800 dark:text-gray-200">¿Eliminar registro de <b>${num}</b> (${cond})?</p>
                <div class="text-xs text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 mb-4">
                    ⚠️ Esta acción borrará el registro para siempre.
                </div>
                <div class="flex items-start gap-3 bg-gray-50 dark:bg-white/5 p-3 rounded-xl">
                    <input type="checkbox" id="del-h-reset-global" class="w-5 h-5 accent-red-600 mt-0.5">
                    <label for="del-h-reset-global" class="text-xs text-gray-600 dark:text-gray-400">
                         <b>Liberar Territorio</b> (Sin asignado)
                    </label>
                </div>
            </div>
        `, async () => {
            const resetTerr = document.getElementById("del-h-reset-global")?.checked;
            try {
                const historyList = sourceData || allHistory;
                const rec = historyList.find(r => r.id === recordId);
                await deleteHistoryRecord(recordId);
                if (resetTerr && rec && rec.territorio_id) {
                    await updateTerritorio(rec.territorio_id, { estado: "Disponible", asignado_a: null, fecha_asignacion: null, fecha_salida: null });
                }
                showNotification("Registro eliminado");
                reloadData();
            } catch (e) { showNotification(e.message, "error"); }
        });
    };

    window.actionEditActive = handleEditActive;
    window.actionHistory = handleHistory;
    window.actionEditHist = (id) => showEditHistoryModal(id);
    window.actionDeleteHistUI = (id, c, n) => showDeleteHistoryModal(id, c, n);
    window.editHistoryRecord = (id) => showEditHistoryModal(id);
    window.deleteHistoryRecordUI = (id, c, n) => showDeleteHistoryModal(id, c, n);

    const handleGlobalHistory = async () => {
        const allTerrs = [...territorios].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

        showModal(`
            <div class="overflow-hidden">
                <header class="flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-blue-700 p-8 text-white shadow-2xl relative overflow-hidden">
                    <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    <div class="relative z-10 flex items-center gap-4">
                        <div class="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-white/20">📜</div>
                        <div>
                            <h3 class="text-2xl font-black tracking-tight">Registro Maestro</h3>
                            <p class="text-[10px] opacity-70 uppercase tracking-[0.3em] font-black">Historial por Territorio</p>
                        </div>
                    </div>
                </header>
                
                <div class="p-8 grid grid-cols-4 sm:grid-cols-6 gap-3 bg-gray-50 dark:bg-black/20">
                    ${allTerrs.map(t => `
                        <button onclick="window.actionHistory('${t.id}', '${t.numero}')" class="h-16 flex flex-col items-center justify-center rounded-2xl bg-white dark:bg-white/5 border border-black/5 hover:border-indigo-500 hover:scale-110 active:scale-95 transition-all group shadow-sm">
                            <span class="text-[10px] font-black text-gray-400 group-hover:text-indigo-600">ID</span>
                            <span class="text-lg font-black text-gray-800 dark:text-gray-100">${t.numero}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `, null, 'max-w-xl');
    };

    const renderMain = () => {
        container.innerHTML = `
    <div class="space-y-8 animate-fade-in px-2" >
                
                <div class="grid grid-cols-2 gap-4">
                    <button id="hub-btn-assign" class="group relative bg-white dark:bg-[#121212] overflow-hidden p-6 rounded-[2.5rem] border border-black/[0.03] dark:border-white/5 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(147,51,234,0.2)]">
                        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/10 blur-[30px] rounded-full group-hover:bg-purple-500/20 transition-all"></div>
                        <div class="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform shadow-inner">➕</div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Operación</p>
                        <p class="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tighter">Nueva Asignación</p>
                    </button>

                    <button id="hub-btn-return" class="group relative bg-white dark:bg-[#121212] overflow-hidden p-6 rounded-[2.5rem] border border-black/[0.03] dark:border-white/5 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(239,68,68,0.2)]">
                        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-red-500/10 blur-[30px] rounded-full group-hover:bg-red-500/20 transition-all"></div>
                        <div class="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform shadow-inner">📥</div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Recepción</p>
                        <p class="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tighter">Devolver Territorios</p>
                        ${selectedIds.size > 0 ? `<div class="absolute top-6 right-6 bg-red-600 text-white w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center animate-bounce shadow-lg ring-4 ring-white dark:ring-[#121212]">${selectedIds.size}</div>` : ''}
                    </button>

                    <button id="hub-btn-global-history" class="col-span-2 group relative bg-white dark:bg-[#121212] overflow-hidden p-6 rounded-[2.5rem] border border-black/[0.03] dark:border-white/5 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(79,70,229,0.2)]">
                        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/10 blur-[30px] rounded-full group-hover:bg-indigo-500/20 transition-all"></div>
                        <div class="flex items-center gap-6">
                            <div class="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-inner">📜</div>
                            <div class="text-left">
                                <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Historial General</p>
                                <p class="text-base font-black text-gray-800 dark:text-white uppercase tracking-tighter">Explorar Pasado de Territorios</p>
                            </div>
                        </div>
                    </button>
                    
                     <button id="hub-btn-export-xls" class="col-span-2 group flex items-center justify-center gap-3 bg-white dark:bg-[#121212] p-4 rounded-2xl border border-black/[0.03] dark:border-white/5 shadow-sm hover:shadow-lg transition-all text-xs font-bold text-gray-500 hover:text-green-600 uppercase tracking-widest">
                        <span>📊</span> Ir a Reportes S-13
                    </button>
                </div>

                <div class="flex flex-col md:flex-row justify-between items-center gap-6 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-lg">
                     <div class="flex items-center gap-5">
                        <div class="flex flex-col">
                            <h2 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-0.5" id="hub-view-title">MAPA DE TERRITORIOS</h2>
                            <div id="view-stats" class="text-[11px] font-bold text-teal-600 dark:text-teal-400 flex items-center gap-2"></div>
                        </div>
                     </div>
                     
                     <div class="relative w-full md:w-80 group">
                         <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-teal-500">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                         </span>
                         <input type="text" id="search-assigns" placeholder="Buscar ID o Publicador..." class="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-white/5 border border-black/[0.03] dark:border-white/[0.05] rounded-2xl text-[13px] font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-4 focus:ring-teal-500/10 transition-all shadow-inner placeholder-gray-400">
                     </div>
                </div>

                <div id="assigns-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in pb-20"></div>
            </div>
    `;

        container.querySelector('#hub-btn-assign').onclick = () => handleNewAssignment();
        container.querySelector('#hub-btn-return').onclick = () => handleBulkReturn();
        container.querySelector('#hub-btn-global-history').onclick = () => handleGlobalHistory();

        container.querySelector('#hub-btn-export-xls').onclick = () => {
            document.querySelector('[data-tab="historial"]').click();
        };

        const search = container.querySelector('#search-assigns');
        search.oninput = () => renderGrid();

        renderGrid();
    };

    const renderGrid = () => {
        const grid = container.querySelector('#assigns-grid');
        const search = container.querySelector('#search-assigns');
        const title = container.querySelector('#hub-view-title');
        const stats = container.querySelector('#view-stats');
        if (!grid) return;

        title.innerText = 'MAPA DE TERRITORIOS';
        const query = search ? search.value.toLowerCase() : '';

        let items = [...territorios].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

        // Filter for "Active" view: Only show Assigned or Pendiente
        if (currentView === 'activas' && !query) {
            items = items.filter(t => t.estado === 'Asignado' || t.estado === 'Pendiente');
        }

        const filtered = items.filter(t => {
            const num = (t.numero || '').toString();
            const cond = (t.asignado_a || t.conductor || '').toLowerCase();
            const camp = (t.campana || '').toLowerCase();
            return num.includes(query) || cond.includes(query) || camp.includes(query);
        });

        const activeCount = territorios.filter(t => t.estado === 'Asignado').length;
        const availableCount = territorios.length - activeCount;

        stats.innerHTML = `
            <div class="flex items-center gap-4" >
                <span class="text-gray-400">${filtered.length} / ${territorios.length}</span>
                <span class="hidden md:inline-block h-3 w-px bg-gray-200 dark:bg-gray-800"></span>
                <span class="text-indigo-500 dark:text-indigo-400 font-black">⚡ ${activeCount} ACTIVOS</span>
                <span class="text-emerald-500 font-black">📖 ${availableCount} LIBRES</span>
            </div>
    `;

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-40 text-center opacity-30 font-black text-sm uppercase tracking-widest" > Nada que mostrar</div> `;
            return;
        }

        grid.innerHTML = filtered.map(item => {
            const isSelected = selectedIds.has(item.id);
            const num = item.numero;
            const isAssigned = item.estado === 'Asignado' || item.estado === 'Pendiente';

            return `
                <div class="relative group cursor-pointer transition-all duration-300" onclick="window.actionToggleSelect('${item.id}')">
                     <!-- Card Body -->
                     <div class="bg-white dark:bg-[#151515] rounded-[2rem] p-5 border ${isSelected ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-black/5 dark:border-white/5'} shadow-sm hover:shadow-lg transition-all flex flex-col justify-between h-48 relative overflow-hidden">
                        
                        <!-- Status Dot & Number -->
                        <div class="flex justify-between items-start z-10">
                            <div class="w-12 h-12 rounded-2xl ${isAssigned ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'} flex items-center justify-center text-xl font-black shadow-inner">
                                ${num}
                            </div>
                            
                            <div class="flex flex-col items-end">
                                <span class="text-[9px] font-black uppercase tracking-widest ${isAssigned ? 'text-indigo-400' : 'text-emerald-400'} mb-1">${isAssigned ? 'ASIGNADO' : 'LIBRE'}</span>
                                ${isSelected ? '<span class="text-xl text-teal-500 animate-bounce">✅</span>' : ''}
                            </div>
                        </div>
                        
                        <!-- Conductor Info -->
                        <div class="z-10 mt-2">
                             ${isAssigned ? `
                                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Responsable</p>
                                <p class="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight line-clamp-2">${item.asignado_a}</p>
                                ${item.fecha_salida ? `
                                    <div class="mt-2 flex items-center gap-2">
                                        <span class="px-2 py-0.5 bg-gray-100 dark:bg-white/5 rounded text-[10px] font-mono text-gray-500">📅 ${new Date(item.fecha_salida).toLocaleDateString("es-ES", { weekday: 'short' })}</span>
                                    </div>
                                ` : ''}
                             ` : `
                                <div class="h-full flex flex-col justify-end opacity-40">
                                    <p class="text-sm font-bold text-gray-400 italic">Disponible para asignar</p>
                                </div>
                             `}
                        </div>

                        <!-- Actions (Hover) -->
                        <div class="absolute bottom-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                             <button onclick="event.stopPropagation(); window.actionEditActive('${item.id}', '${num}', '${item.asignado_a || ''}')" class="p-2 bg-white dark:bg-black/50 text-gray-600 dark:text-white rounded-full shadow-lg border border-black/5 hover:scale-110 transition-transform" title="Editar / Ver Detalles">
                                ✏️
                             </button>
                        </div>
                        
                        <!-- Decorative BG -->
                        <div class="absolute -right-10 -bottom-10 w-32 h-32 rounded-full blur-[40px] ${isAssigned ? 'bg-indigo-500/5' : 'bg-emerald-500/5'} pointer-events-none"></div>
                     </div>
                </div>
            `;
        }).join('');
    };

    renderMain();
};

// --- Render Config Tab (Restored) ---
const renderConfigTab = async (container, initialSub = 'reglas', appVersion) => {
    container.innerHTML = `
            <div class="space-y-6 animate-fade-in">
                <header class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Configuración del Sistema</h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Ajusta los parámetros de la congregación</p>
                    </div>
                </header>

                <div class="flex flex-wrap gap-2 border-b border-gray-200 dark:border-white/10 pb-4 overflow-x-auto scrollbar-hide">
                    <button class="conf-nav-btn active px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap bg-teal-600 text-white shadow-lg shadow-teal-500/30" data-sub="reglas">📏 Reglas</button>
                    <button class="conf-nav-btn px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all whitespace-nowrap" data-sub="territorios">🗺️ Territorios</button>
                    <button class="conf-nav-btn px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all whitespace-nowrap" data-sub="personal">👥 Personal</button>
                    <button class="conf-nav-btn px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all whitespace-nowrap" data-sub="grupos">🏘️ Grupos</button>
                    <button class="conf-nav-btn px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all whitespace-nowrap" data-sub="campanas">🚩 Campañas</button>
                    <button class="conf-nav-btn px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all whitespace-nowrap" data-sub="difusion">📢 Difusión</button>
                    <button class="conf-nav-btn px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all whitespace-nowrap" data-sub="mantenimiento">🛠️ Mantenimiento</button>
                </div>

                <div id="config-content" class="min-h-[400px]"></div>
            </div>
        `;

    const btns = container.querySelectorAll('.conf-nav-btn');
    const content = container.querySelector('#config-content');

    const load = async (sub) => {
        btns.forEach(b => {
            if (b.dataset.sub === sub) {
                b.className = "conf-nav-btn active px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap bg-teal-600 text-white shadow-lg shadow-teal-500/30";
            } else {
                b.className = "conf-nav-btn px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all whitespace-nowrap";
            }
        });
        await loadSubTab(sub, content, await getConfiguracion(), appVersion);
    };

    btns.forEach(b => b.onclick = () => load(b.dataset.sub));
    load(initialSub);
};

const loadSubTab = async (subTab, container, config, appVersion) => {
    container.innerHTML = '<div class="animate-pulse flex space-x-4"><div class="h-4 bg-white/10 rounded w-3/4"></div></div>';

    if (subTab === 'reglas') {
        const tCount = (await getTerritorios()).length;

        container.innerHTML = `
            <div class="space-y-6 max-w-2xl animate-fade-in p-6 bg-white dark:bg-[#0f1115] rounded-3xl border border-black/5 dark:border-white/10 shadow-xl m-4">
                <div class="mb-6 pb-6 border-b border-black/5 dark:border-white/5">
                    <h3 class="font-bold text-xl text-teal-800 dark:text-teal-200">Reglas Generales</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Define los parámetros básicos de la congregación.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">Nombre Congregación</label>
                        <input type="text" id="conf-nombre" value="${config.congregacion?.nombre || ''}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white font-bold outline-none focus:border-teal-500 lg:text-sm">
                    </div>
                     <div>
                        <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">Número Congregación</label>
                        <input type="text" id="conf-numero" value="${config.congregacion?.numero || ''}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white font-bold outline-none focus:border-teal-500 lg:text-sm">
                    </div>
                </div>

                <!-- Additional inputs -->
                <div>
                    <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">Horarios Predicación</label>
                    <input type="text" id="conf-prog-horarios" value="${config.horarios_programa?.join(', ') || ''}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:border-teal-500 outline-none font-mono" placeholder="08:30, 09:00...">
                </div>
                 <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">Lugares</label>
                        <textarea id="conf-lugares" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs h-20 outline-none resize-none">${config.lugares?.join(', ') || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">Facetas</label>
                        <textarea id="conf-facetas" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs h-20 outline-none resize-none">${config.facetas?.join(', ') || ''}</textarea>
                    </div>
                </div>

                <!-- Gemini Section -->
                <div class="pt-4 border-t border-black/5 dark:border-white/5">
                    <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">API Key (Google Gemini)</label>
                    <input type="password" id="gemini-key" value="${config.gemini_key || ''}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm focus:border-teal-500 outline-none font-mono" placeholder="AIxa...">
                    <p class="text-[10px] text-gray-400 mt-2 ml-1 italic">Habilita el Asistente Inteligente en los paneles de control.</p>
                </div>

                 <div class="mt-8 flex justify-end">
                    <button id="save-reglas" class="bg-teal-600 hover:bg-teal-500 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-teal-500/20 hover:scale-105 transition-all">
                        Guardar Cambios
                    </button>
                </div>
            </div>
         `;

        container.querySelector('#save-reglas').onclick = async () => {
            const btn = container.querySelector('#save-reglas');
            btn.innerHTML = '⏳ Guardando...';
            btn.disabled = true;

            try {
                config.congregacion = {
                    nombre: document.getElementById('conf-nombre').value,
                    numero: document.getElementById('conf-numero').value
                };
                config.gemini_key = document.getElementById('gemini-key').value;
                config.horarios_programa = document.getElementById('conf-prog-horarios').value.split(',').map(s => s.trim()).filter(Boolean);
                config.lugares = document.getElementById('conf-lugares').value.split(',').map(s => s.trim()).filter(Boolean);
                config.facetas = document.getElementById('conf-facetas').value.split(',').map(s => s.trim()).filter(Boolean);

                await saveConfiguracion(config);

                showCustomAlert("Configuración Actualizada");
                loadSubTab('reglas', container, config, appVersion);
            } catch (e) {
                console.error(e);
                showCustomAlert("Error: " + e.message);
            } finally {
                btn.innerHTML = 'Guardar Cambios';
                btn.disabled = false;
            }
        };


    } else if (subTab === 'campanas') {
        const list = await getCampanas();
        container.innerHTML = `
    <div class="p-6 max-w-4xl animate-fade-in shadow-xl bg-white dark:bg-[#0f1115] rounded-3xl border border-black/5 dark:border-white/10 m-4" >
                <div class="flex justify-between items-center mb-8 border-b border-black/5 dark:border-white/5 pb-6">
                    <div>
                        <h3 class="text-2xl font-black dark:text-white flex items-center gap-3">
                            <span class="p-2 bg-red-500/10 rounded-xl text-red-500">🚩</span> Gestión de Campañas
                        </h3>
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-black mt-1 ml-14">Eventos especiales y ministerio intensivo</p>
                    </div>
                    <button id="add-campana" class="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-red-500/20 transition-all hover:-translate-y-1">
                        + Nueva Campaña
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${list.length === 0 ? '<div class="col-span-full py-20 text-center opacity-30 font-black uppercase tracking-widest">No hay campañas registradas</div>' : ''}
                    ${list.map(c => `
                        <div class="bg-gray-50 dark:bg-black/20 p-5 rounded-[2rem] border border-black/5 dark:border-white/10 flex justify-between items-center group hover:border-red-500/30 transition-all shadow-sm">
                            <span class="font-black text-gray-700 dark:text-gray-200 uppercase tracking-tighter text-sm">${c}</span>
                            <button onclick="window.actionDeleteCampana('${c}')" class="bg-white dark:bg-white/10 hover:bg-red-50 text-red-500 p-3 rounded-xl transition-all shadow-md group-hover:scale-105" title="Eliminar">🗑️</button>
                        </div>
                    `).join('')}
                </div>
            </div>
    `;
        container.querySelector('#add-campana').onclick = async () => {
            showCustomPrompt("Nombre de la nueva campaña:", "", async (name) => {
                await saveCampana(name);
                loadSubTab('campanas', container, config, appVersion);
            });
        };
        window.actionDeleteCampana = async (c) => {
            showCustomConfirm(`¿Borrar la campaña "${c}" ? Los registros históricos no se verán afectados.`, async () => {
                await deleteCampana(c);
                loadSubTab('campanas', container, config, appVersion);
            });
        };
    } else if (subTab === 'difusion') {
        const diffusion = await getDiffusionMessage();
        container.innerHTML = `
            <div class="max-w-xl mx-auto space-y-8 animate-fade-in p-8 morphinglass-card mt-6">
                <div class="flex items-center gap-4 mb-2">
                    <div class="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-blue-500/10">📢</div>
                    <div>
                        <h3 class="text-2xl font-black tracking-tight text-gray-800 dark:text-white">Sistema de Difusión</h3>
                        <p class="text-[10px] text-gray-500 uppercase tracking-widest font-black">Comunicación Masiva Directa</p>
                    </div>
                </div>

                <div class="space-y-6">
                    <div>
                        <label class="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Contenido del Mensaje</label>
                        <textarea id="diff-content" placeholder="Escribe el anuncio para todos los conductores..." class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-[1.5rem] p-5 text-sm font-bold min-h-[120px] outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner">${diffusion?.content || ''}</textarea>
                    </div>

                    <div>
                        <label class="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Prioridad Visual</label>
                        <div class="grid grid-cols-2 gap-4">
                            <button class="diff-type-btn p-4 rounded-2xl border-2 transition-all font-bold flex flex-col items-center gap-2 ${diffusion?.type !== 'urgent' ? 'border-blue-500/50 bg-blue-500/10 text-blue-600' : 'border-black/5 dark:border-white/5 opacity-50'}" data-type="info">
                                <span class="text-xl">ℹ️</span>
                                <span class="text-xs">Informativo</span>
                            </button>
                            <button class="diff-type-btn p-4 rounded-2xl border-2 transition-all font-bold flex flex-col items-center gap-2 ${diffusion?.type === 'urgent' ? 'border-red-500/50 bg-red-500/10 text-red-600' : 'border-black/5 dark:border-white/5 opacity-50'}" data-type="urgent">
                                <span class="text-xl">🚨</span>
                                <span class="text-xs">Urgente</span>
                            </button>
                        </div>
                    </div>

                    <div class="pt-6 border-t border-black/5 dark:border-white/5 flex gap-4">
                        <button id="btn-save-diffusion" class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-xs">
                            📣 Publicar Anuncio
                        </button>
                        ${diffusion?.active ? `
                            <button id="btn-stop-diffusion" class="px-6 bg-red-50 dark:bg-red-500/10 text-red-600 font-black rounded-2xl border border-red-200 dark:border-red-500/20 hover:bg-red-100 transition-colors uppercase tracking-tight text-[10px]">
                                Detener
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="bg-blue-500/5 rounded-2xl p-4 border border-blue-500/10">
                    <p class="text-[10px] text-blue-600 dark:text-blue-400 italic">
                        "El anuncio aparecerá en la parte superior de la pantalla para todos los usuarios logueados hasta que sea desactivado."
                    </p>
                </div>
            </div>
        `;

        let selectedType = diffusion?.type || 'info';
        const typeBtns = container.querySelectorAll('.diff-type-btn');
        typeBtns.forEach(btn => btn.onclick = () => {
            selectedType = btn.dataset.type;
            typeBtns.forEach(b => {
                const isSelected = b.dataset.type === selectedType;
                const activeColor = selectedType === 'info' ? 'blue' : 'red';
                b.className = `diff-type-btn p-4 rounded-2xl border-2 transition-all font-bold flex flex-col items-center gap-2 ${isSelected ? `border-${activeColor}-500/50 bg-${activeColor}-500/10 text-${activeColor}-600` : 'border-black/5 dark:border-white/5 opacity-50'}`;
            });
        });

        document.getElementById('btn-save-diffusion').onclick = async () => {
            const content = document.getElementById('diff-content').value;
            if (!content) return showNotification("El mensaje no puede estar vacío", "error");

            try {
                await saveDiffusionMessage(content, selectedType);
                showNotification("Anuncio publicado exitosamente");
                loadSubTab('difusion', container, config, appVersion);
            } catch (e) {
                showNotification("Error: " + e.message, "error");
            }
        };

        const stopBtn = document.getElementById('btn-stop-diffusion');
        if (stopBtn) stopBtn.onclick = async () => {
            try {
                await saveDiffusionMessage(null);
                showNotification("Difusión finalizada");
                loadSubTab('difusion', container, config, appVersion);
            } catch (e) {
                showNotification("Error: " + e.message, "error");
            }
        };

    } else if (subTab === 'mantenimiento') {
        const [terrs, conds, phones] = await Promise.all([
            getTerritorios(),
            getConductores(),
            getTelefonos()
        ]);

        const tCount = terrs.length;
        const cCount = conds.length;
        const pCount = phones.length;

        container.innerHTML = `
            <div class="space-y-8 animate-fade-in p-2 md:p-6 max-w-6xl mx-auto">
                <!-- Header with System Health -->
                <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div>
                        <h3 class="font-black text-2xl md:text-3xl text-teal-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-teal-200 dark:to-teal-500 flex items-center gap-3">
                            <span class="p-2.5 bg-teal-500/10 rounded-xl border border-teal-500/20 shadow-lg shadow-teal-500/5">🛡️</span> 
                            Mantenimiento
                        </h3>
                        <p class="text-gray-500 dark:text-gray-400 text-xs md:text-sm mt-1 ml-1 opacity-80">Monitorización y reparación proactiva del sistema.</p>
                    </div>
                    <div class="flex items-center gap-3 bg-white/50 dark:bg-white/5 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-black/5 dark:border-white/5 backdrop-blur-xl shadow-xl w-full sm:w-auto justify-between sm:justify-start">
                        <div class="text-left sm:text-right">
                            <p class="text-[8px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest">Estado Global</p>
                            <p class="text-xs md:text-sm font-bold text-green-500 flex items-center gap-2 sm:justify-end">
                                <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Estable
                            </p>
                        </div>
                        <div class="h-8 w-px bg-black/10 dark:bg-white/10 mx-1 md:mx-2 hidden xs:block"></div>
                        <div class="flex -space-x-2 md:-space-x-3">
                            <div class="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-teal-500/20 border-2 border-white dark:border-gray-900 flex items-center justify-center text-sm md:text-lg" title="Territorios">🗺️</div>
                            <div class="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-500/20 border-2 border-white dark:border-gray-900 flex items-center justify-center text-sm md:text-lg" title="Conductores">👤</div>
                            <div class="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-amber-500/20 border-2 border-white dark:border-gray-900 flex items-center justify-center text-sm md:text-lg" title="Registros">📞</div>
                        </div>
                    </div>
                </header>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                    <!-- Control Panel (Left Column) -->
                    <div class="lg:col-span-4 space-y-6">
                        <!-- Stats Grid -->
                        <div class="grid grid-cols-3 gap-2 md:gap-4">
                            <div class="bg-white dark:bg-white/5 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-black/5 dark:border-white/5 text-center flex flex-col items-center justify-center">
                                <p class="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase mb-1">Terrenos</p>
                                <p class="text-lg md:text-xl font-black text-teal-600">${tCount}</p>
                            </div>
                            <div class="bg-white dark:bg-white/5 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-black/5 dark:border-white/5 text-center flex flex-col items-center justify-center">
                                <p class="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase mb-1">Equipos</p>
                                <p class="text-lg md:text-xl font-black text-blue-600">${cCount}</p>
                            </div>
                            <div class="bg-white dark:bg-white/5 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-black/5 dark:border-white/5 text-center flex flex-col items-center justify-center">
                                <p class="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase mb-1">Líneas</p>
                                <p class="text-lg md:text-xl font-black text-amber-600">${pCount}</p>
                            </div>
                        </div>

                        <!-- Main Actions -->
                        <div class="p-4 md:p-6 bg-white/50 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl space-y-4">
                            <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Herramientas Nucleares</h4>
                            
                            <button id="btn-smart-repair" class="w-full group relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 p-px rounded-xl md:rounded-2xl shadow-lg shadow-orange-500/10 transition-all">
                                <div class="bg-[#12141c] hover:bg-transparent transition-colors p-3 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-between">
                                    <div class="text-left">
                                        <p class="text-[11px] md:text-xs font-black text-white group-hover:text-black">REPARACIÓN CUÁNTICA</p>
                                        <p class="text-[8px] md:text-[9px] text-orange-400/80 group-hover:text-black/60 font-medium">✨ Motor avanzado</p>
                                    </div>
                                    <span class="text-lg md:text-xl group-hover:rotate-12 transition-transform">⚡</span>
                                </div>
                            </button>

                            <button id="btn-rebuild-history" class="w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-white dark:bg-white/5 rounded-xl md:rounded-2xl border border-black/5 dark:border-white/5 hover:bg-teal-500/5 transition-all text-left">
                                <div class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-500 text-sm md:text-lg">🧹</div>
                                <div>
                                    <p class="text-[10px] md:text-xs font-black text-gray-800 dark:text-gray-100 uppercase tracking-wider">Sincronizar S-13</p>
                                    <p class="text-[8px] md:text-[9px] text-gray-500">Recuperar historial</p>
                                </div>
                            </button>

                            <div class="grid grid-cols-2 gap-2 md:gap-3">
                                <button id="btn-backup-json" class="flex flex-col items-center justify-center gap-1 md:gap-2 p-3 md:p-4 bg-white dark:bg-white/5 rounded-xl md:rounded-2xl border border-black/5 dark:border-white/5 hover:bg-blue-500/5 transition-all">
                                    <span class="text-lg md:text-xl">📥</span>
                                    <span class="text-[8px] md:text-[9px] font-black uppercase text-gray-500 tracking-wider">Backup</span>
                                </button>
                                <label class="flex flex-col items-center justify-center gap-1 md:gap-2 p-3 md:p-4 bg-white dark:bg-white/5 rounded-xl md:rounded-2xl border border-black/5 dark:border-white/5 hover:bg-purple-500/5 transition-all cursor-pointer">
                                    <span class="text-lg md:text-xl">📤</span>
                                    <span class="text-[8px] md:text-[9px] font-black uppercase text-gray-500 tracking-wider">Restore</span>
                                    <input type="file" id="input-restore-json" class="hidden" accept=".json">
                                </label>
                            </div>

                            <button id="btn-ai-audit" class="w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-violet-500/10 rounded-xl md:rounded-2xl border border-violet-500/20 hover:bg-violet-500/20 transition-all text-left">
                                <div class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-violet-600 flex items-center justify-center text-white text-sm md:text-lg">🤖</div>
                                <div>
                                    <p class="text-[10px] md:text-xs font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider">Auditoría IA (Gemini)</p>
                                    <p class="text-[8px] md:text-[9px] text-gray-500">Detección de inconsistencias</p>
                                </div>
                            </button>
                        </div>

                            <button id="btn-fix-territories" class="w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-white dark:bg-white/5 rounded-xl md:rounded-2xl border border-black/5 dark:border-white/5 hover:bg-indigo-500/5 transition-all text-left">
                                <div class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-sm md:text-lg">🔢</div>
                                <div>
                                    <p class="text-[10px] md:text-xs font-black text-gray-800 dark:text-gray-100 uppercase tracking-wider">Normalizar</p>
                                    <p class="text-[8px] md:text-[9px] text-gray-500">Formateo de datos</p>
                                </div>
                            </button>

                            <button id="btn-ai-predict" class="w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-emerald-500/10 rounded-xl md:rounded-2xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-left">
                                <div class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-emerald-600 flex items-center justify-center text-white text-sm md:text-lg">📈</div>
                                <div>
                                    <p class="text-[10px] md:text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Predicción IA (Gemini)</p>
                                    <p class="text-[8px] md:text-[9px] text-gray-500">Sugerencia de asignaciones</p>
                                </div>
                            </button>
                        </div>

                        <!-- System Version Info Card -->
                        <div class="bg-gradient-to-br from-teal-500 to-emerald-600 p-5 md:p-6 rounded-3xl shadow-xl text-white relative overflow-hidden group">
                           <div class="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-125 transition-transform duration-1000">
                               <svg class="w-24 h-24 md:w-32 md:h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
                           </div>
                           <h4 class="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Núcleo del Sistema</h4>
                           <p class="text-xl md:text-2xl font-black mb-4 md:mb-6">Versión ${appVersion}</p>
                           
                           <div class="grid grid-cols-2 gap-2 md:gap-3">
                               <button id="btn-force-update" class="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white py-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-wider transition-all">Reinstalar</button>
                               <button id="btn-set-remote-version" class="bg-black/20 hover:bg-black/40 backdrop-blur-md text-white py-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-wider transition-all">Forzar</button>
                           </div>
                        </div>
                    </div>

                    <!-- Terminal / Console Area (Right Column) -->
                    <div class="lg:col-span-8 flex flex-col gap-6">
                        <div class="flex-1 bg-[#0b0c10] rounded-3xl border border-white/10 shadow-3xl flex flex-col overflow-hidden min-h-[400px] md:min-h-[500px] relative">
                            <!-- Terminal Header -->
                            <div class="bg-white/5 border-b border-white/5 p-4 flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="flex gap-1.5 px-2">
                                        <div class="w-3 h-3 rounded-full bg-red-500/50"></div>
                                        <div class="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                                        <div class="w-3 h-3 rounded-full bg-green-500/50"></div>
                                    </div>
                                    <div class="h-4 w-px bg-white/10 mx-2"></div>
                                    <p class="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Console: <span class="text-teal-500">System_Diagnostics_v2.0</span></p>
                                </div>
                                <button id="btn-clear-console" class="text-[9px] font-black text-gray-500 hover:text-white uppercase transition-colors">Limpiar Log</button>
                            </div>
                            
                            <!-- Terminal Body -->
                            <div id="maint-console" class="flex-1 p-6 font-mono text-[11px] leading-relaxed overflow-y-auto custom-scrollbar-dark touch-pan-y">
                                <div class="space-y-1" id="console-output-stream">
                                    <div class="text-teal-400/50 mb-4 animate-pulse">_ CONFIGURANDO ENTORNO DE DIAGNÓSTICO...</div>
                                    <div class="text-gray-600">> Inicializando módulos de integridad de Firebase...</div>
                                    <div class="text-gray-600">> Conexión establecida con clúster v3.0.0.</div>
                                    <div class="text-gray-600 text-[9px] opacity-40 italic mt-2">Ready for operation. System health: 100% stable.</div>
                                </div>
                            </div>

                            <!-- Terminal Overlay Progress -->
                            <div id="console-progress-overlay" class="hidden absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-12 transition-all">
                                <div class="w-full max-w-sm space-y-4">
                                     <div class="flex justify-between items-end">
                                        <p id="progress-status-text" class="text-[10px] font-black text-teal-400 uppercase tracking-widest animate-pulse">Ejecutando proceso...</p>
                                        <p id="progress-percent-text" class="text-2xl font-black text-white">0%</p>
                                     </div>
                                     <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <div id="repair-progress-bar" class="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(20,184,166,0.5)]" style="width: 0%"></div>
                                     </div>
                                </div>
                            </div>

                            <!-- Gemini Intelligence Footer -->
                            <div class="bg-teal-500/5 border-t border-teal-500/10 p-5 flex items-start gap-4">
                                <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                                     <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center justify-between mb-1">
                                        <h5 class="text-[10px] font-black uppercase text-teal-400 tracking-widest">Inteligencia Predictiva Gemini</h5>
                                        <span class="px-2 py-0.5 bg-teal-500/20 text-teal-400 text-[8px] font-bold rounded-full uppercase">Activa</span>
                                    </div>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 italic">"El mantenimiento proactivo previene discrepancias en el historial S-13 y asegura que el ciclo de predicación telefónica se complete sin redundancias."</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // -- Consolidated UI Handlers --
        const oStream = container.querySelector('#console-output-stream');
        const progressOverlay = container.querySelector('#console-progress-overlay');
        const progressBar = container.querySelector('#repair-progress-bar');
        const progressPc = container.querySelector('#progress-percent-text');
        const progressStatus = container.querySelector('#progress-status-text');

        const logToConsole = (msg, type = 'info') => {
            const entry = document.createElement('div');
            const colorClass = type === 'error' ? 'text-red-400' : type === 'success' ? 'text-green-400' : type === 'warning' ? 'text-amber-400' : 'text-teal-400/80';
            const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
            entry.className = `flex gap-3 py-0.5 ${colorClass}`;
            entry.innerHTML = `<span class="opacity-30 flex-shrink-0">[${timestamp}]</span> <span>${msg}</span>`;
            oStream.appendChild(entry);
            const consoleDiv = container.querySelector('#maint-console');
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
        };

        const updateProgress = (pc, status) => {
            progressOverlay.classList.remove('hidden');
            progressBar.style.width = `${pc}%`;
            progressPc.innerText = `${pc}%`;
            if (status) progressStatus.innerText = status;
        };

        container.querySelector('#btn-clear-console').onclick = () => {
            oStream.innerHTML = '<div class="text-gray-600 text-[9px] opacity-40 italic">> Consola purgada. Esperando comandos...</div>';
        };

        // -- Event Binding --
        const bind = (id, handler) => {
            const el = container.querySelector(`#${id} `);
            if (el) el.onclick = async () => {
                if (!ensureOnline()) return;
                try {
                    await handler(el);
                } catch (err) {
                    console.error(`Error in ${id}: `, err);
                    showCustomAlert(`Error inesperado: ${err.message} `);
                }
            };
        };

        // 1. Rebuild History
        bind('btn-rebuild-history', async (btn) => {
            showCustomConfirm('¿Quieres reconstruir el historial S-13 desde el programa semanal?', async () => {
                logToConsole("Iniciando reconstrucción de historial S-13...");
                updateProgress(10, "Escaneando programa semanal...");
                try {
                    const count = await rebuildHistoryFromSchedule();
                    updateProgress(100, "Sincronización completa");
                    logToConsole(`✅ ÉXITO: Se sincronizaron ${count} registros históricos.`, 'success');
                    showNotification(`Sincronización completada: ${count} registros.`);
                    setTimeout(() => progressOverlay.classList.add('hidden'), 2000);
                } catch (err) {
                    logToConsole(`❌ ERROR: ${err.message}`, 'error');
                    updateProgress(0, "Error crítico");
                }
            });
        });

        // 2. Backup
        bind('btn-backup-json', async (btn) => {
            logToConsole("Iniciando empaquetado de backup del sistema...");
            updateProgress(20, "Recopilando colecciones...");
            try {
                const fullData = {
                    timestamp: new Date().toISOString(),
                    territorios: await getTerritorios(),
                    conductores: await getConductores(),
                    telefonos: await getTelefonos(),
                    publicadores: await getPublicadores(),
                    programa: await getProgramaSemanal(formatDateId(new Date())),
                    config: await getConfiguracion(),
                    historial: await getHistorialReport()
                };
                updateProgress(60, "Generando archivo JSON...");
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", `Backup_Territorios_${formatDateId(new Date())}.json`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
                updateProgress(100, "Backup finalizado");
                logToConsole("📥 Backup generado y descargado correctamente.", "success");
                setTimeout(() => progressOverlay.classList.add('hidden'), 2000);
            } catch (err) {
                logToConsole(`❌ ERROR: ${err.message}`, "error");
            }
        });

        // 3. Restore
        const fileInput = container.querySelector('#input-restore-json');
        if (fileInput) fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file || !ensureOnline()) return;
            showCustomConfirm('⚠️ ALERTA: Esto reemplazará todos los datos actuales. ¿Continuar?', async () => {
                logToConsole("🚀 INICIANDO RESTAURACIÓN DE BACKUP...");
                updateProgress(5, "Iniciando...");
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        await restoreSystemBackup(data, (msg, progress) => {
                            logToConsole(`[Restore] ${msg}`);
                            updateProgress(progress, msg);
                        });
                        logToConsole("✅ SISTEMA RESTAURADO COMPLETAMENTE", "success");
                        updateProgress(100, "Finalizado");
                        setTimeout(() => window.location.reload(), 1500);
                    } catch (err) {
                        logToConsole(`❌ ERROR: ${err.message}`, "error");
                        updateProgress(0, "Fallo en restauración");
                    }
                };
                reader.readAsText(file);
            });
        };

        // 4. Local Reinstall
        bind('btn-force-update', async (btn) => {
            showCustomConfirm('¿Limpiar caché local y reinstalar?', async () => {
                logToConsole("Iniciando purga de caché local...");
                updateProgress(40, "Unregistering SW...");
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let r of registrations) await r.unregister();
                }
                updateProgress(70, "Deleting caches...");
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                }
                updateProgress(100, "Purge complete");
                logToConsole("⚡ Purga completada. Reiniciando versión local...", "warning");
                localStorage.removeItem('app_version');
                setTimeout(() => window.location.reload(true), 1000);
            });
        });

        // 5. Force All Update
        bind('btn-set-remote-version', async (btn) => {
            showCustomConfirm(`¿Publicar v${appVersion} como versión obligatoria?`, async () => {
                logToConsole(`Enviando señal de actualización remota (v${appVersion})...`);
                await setSystemVersion(appVersion);
                logToConsole("🌐 Versión remota sincronizada.", "success");
                showNotification("Configuración de flota actualizada.");
            });
        });

        // 6. Proactive Fixes (Consolidated)
        bind('btn-smart-repair', async (btn) => {
            logToConsole("✨ INICIANDO PROTOCOLO DE REPARACIÓN CUÁNTICA...");
            updateProgress(5, "Inicializando motor de diagnóstico...");

            try {
                const report = await runSystemDiagnosticsAndRepair((msg, pc) => {
                    logToConsole(msg);
                    updateProgress(pc, "Reparando registros...");
                });

                logToConsole(`✅ PROTOCOLO FINALIZADO`, 'success');
                logToConsole(`> Historial sincronizado: ${report.rebuiltHistory}`);
                logToConsole(`> Teléfonos corregidos: ${report.fixedPhones}`);

                if (report.details && report.details.length > 0) {
                    report.details.slice(0, 10).forEach(d => logToConsole(`• ${d}`, 'info'));
                    if (report.details.length > 10) logToConsole(`... y ${report.details.length - 10} correcciones adicionales.`);
                }

                updateProgress(100, "Sistema optimizado");
                showNotification("Reparación completada con éxito.");
                setTimeout(() => progressOverlay.classList.add('hidden'), 3000);
            } catch (err) {
                logToConsole(`❌ ERROR CRÍTICO: ${err.message}`, 'error');
                updateProgress(0, "Interrupción de sistema");
            }
        });

        bind('btn-fix-territories', async (btn) => {
            logToConsole("Iniciando normalización de datos maestros (Territorios)...");
            updateProgress(10, "Cargando registros...");
            try {
                const terrs = await getTerritorios();
                let fixed = 0;
                for (let i = 0; i < terrs.length; i++) {
                    const t = terrs[i];
                    const num = String(t.numero).trim();
                    if (t.numero !== num) {
                        await updateTerritorio(t.id, { numero: num });
                        fixed++;
                        logToConsole(`Normalizado: #${num} (Espacios corregidos)`);
                    }
                    if (i % 5 === 0) updateProgress(10 + Math.floor((i / terrs.length) * 80), `Analizando #${num}`);
                }
                updateProgress(100, "Normalización completa");
                logToConsole(`✅ Operación finalizada. ${fixed} registros normalizados.`, 'success');
                setTimeout(() => {
                    progressOverlay.classList.add('hidden');
                    loadSubTab('mantenimiento', container, config, appVersion);
                }, 2000);
            } catch (err) {
                logToConsole(`❌ Error: ${err.message}`, 'error');
                updateProgress(0, "Fallo");
            }
        });

        // --- AI Full Audit ---
        bind('btn-ai-audit', async (btn) => {
            if (!config.gemini_key) {
                return showNotification("Configura tu API Key de Gemini en la pestaña 'Reglas' para usar esta función.", "warning");
            }

            logToConsole("🧠 INICIALIZANDO CONSULTORÍA IA DE DATOS...");
            updateProgress(20, "Recopilando snapshot del sistema...");

            try {
                const terrs = await getTerritorios(); // Refresh
                const intellect = new TerritoryIntelligence(phones, [], terrs, await getProgramaSemanal(formatDateId(new Date())), conds);
                updateProgress(40, "Enviando a Gemini para análisis profundo...");

                const report = await intellect.performFullAudit(config.gemini_key);

                updateProgress(100, "Auditoría completada");
                logToConsole("✨ INFORME ESTRATÉGICO DE AUDITORÍA IA:", 'success');

                // Format the markdownish report for the console
                report.split('\n').forEach(line => {
                    if (line.trim()) {
                        const type = line.startsWith('###') ? 'success' : (line.startsWith('-') ? 'info' : 'warning');
                        logToConsole(line.replace('###', '>>').trim(), type);
                    }
                });

                showNotification("Auditoría IA finalizada con éxito.");
            } catch (err) {
                logToConsole(`❌ ERROR IA: ${err.message}`, 'error');
                updateProgress(0, "Interrupción de inteligencia");
            }
        });

        // --- AI Prediction ---
        bind('btn-ai-predict', async (btn) => {
            if (!config.gemini_key) {
                return showNotification("Configura tu API Key de Gemini", "warning");
            }
            logToConsole("🔮 CALCULANDO PREDICCIONES DE ASIGNACIÓN...");
            updateProgress(30, "Analizando patrones de rotación...");
            try {
                const terrs = await getTerritorios();
                const intellect = new TerritoryIntelligence(phones, [], terrs, await getProgramaSemanal(formatDateId(new Date())), conds);
                const prediction = await intellect.predictAssignments(config.gemini_key);
                updateProgress(100, "Predicción lista");
                logToConsole("✨ RECOMENDACIONES DE LA IA:", 'success');
                prediction.split('\n').forEach(line => {
                    if (line.trim()) logToConsole(line.trim(), 'info');
                });
            } catch (err) {
                logToConsole(`❌ Error IA: ${err.message}`, 'error');
                updateProgress(0, "Fallo en predicción");
            }
        });

    } else if (subTab === 'territorios') {
        const territorios = await getTerritorios();
        territorios.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));
        container.innerHTML = `
    <div class="flex justify-between items-center mb-4" >
                <h3 class="font-semibold text-lg text-teal-800 dark:text-teal-100">Gestión de Territorios</h3>
                <button id="btn-add-territorio" class="bg-teal-600 text-sm px-4 py-2 rounded-lg hover:bg-teal-500">+ Agregar Territorio</button>
            </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${territorios.map(t => `
                    <div class="bg-white dark:bg-black/40 p-4 rounded-lg border border-gray-200 dark:border-white/10 relative group shadow-sm dark:shadow-none">
                        <div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button class="text-blue-500 hover:text-blue-400 bg-white/90 dark:bg-black/50 p-1.5 rounded shadow-sm" onclick="window.editTerritorio('${t.id}')">✏️</button>
                            <button class="text-red-500 hover:text-red-400 bg-white/90 dark:bg-black/50 p-1.5 rounded shadow-sm" onclick="window.deleteTerritorio('${t.id}')">🗑️</button>
                        </div>
                        <div class="h-32 bg-white dark:bg-black rounded mb-3 overflow-hidden border border-gray-100 dark:border-white/5 flex items-center justify-center">
                            <img src="${formatMapUrl(t.imagen) || 'https://via.placeholder.com/300x200?text=No+Map'}" class="w-full h-full object-contain">
                        </div>
                        <div class="font-black text-teal-600 dark:text-teal-300 text-lg leading-tight mb-1">Territorio ${t.numero}</div>
                        <div class="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold truncate tracking-tighter" title="${t.manzanas || ''}">${t.manzanas || 'Sin descripción'}</div>
                    </div>
                `).join('')}
    </div>
`;

        document.getElementById('btn-add-territorio').addEventListener('click', () => {
            showModal(`
    <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400">Nuevo Territorio</h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Número</label>
                        <input type="text" id="new-t-num" placeholder="Ej: 101" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
                    </div>
                    <div>
                        <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Manzanas</label>
                        <input type="text" id="new-t-manzanas" placeholder="Ej: Mz. 1, Mz. 2" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
                    </div>
                    
                    <div>
                        <label class="block text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">Imagen del Mapa</label>
                        <div class="flex items-center gap-4">
                            <label class="cursor-pointer bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                                <span>📂 Subir Imagen</span>
                                <input type="file" id="new-t-file" accept="image/png, image/jpeg, image/webp" class="hidden">
                            </label>
                            <span id="file-name-new" class="text-xs text-gray-500 italic truncate max-w-[150px]">Sin archivo</span>
                        </div>
                        <input type="hidden" id="new-t-base64">
                        <div id="preview-new-container" class="mt-2 hidden">
                            <img id="preview-new" class="h-32 w-auto max-w-full rounded border border-gray-200 dark:border-white/20 object-contain mx-auto bg-white dark:bg-black">
                        </div>
                    </div>
                </div>
                <button id="save-new-territorio" class="w-full bg-teal-600 py-3 rounded-lg text-white font-bold mt-6 shadow-lg shadow-teal-500/20 hover:scale-[1.02] transition-all">
                    Guardar Territorio
                </button>
`, async (modal) => {
                // File Handler
                const fileInput = document.getElementById('new-t-file');
                const nameDisplay = document.getElementById('file-name-new');
                const previewContainer = document.getElementById('preview-new-container');
                const previewImg = document.getElementById('preview-new');
                const base64Input = document.getElementById('new-t-base64');

                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        if (file.size > 800 * 1024) { // 800KB limit
                            showNotification("La imagen es muy grande. Máx 800KB.", "warning");
                            fileInput.value = '';
                            return;
                        }
                        nameDisplay.textContent = file.name;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const result = ev.target.result;
                            base64Input.value = result;
                            previewImg.src = result;
                            previewContainer.classList.remove('hidden');
                        };
                        reader.readAsDataURL(file);
                    }
                });

                // Save Logic
                document.getElementById('save-new-territorio').addEventListener('click', async () => {
                    const num = document.getElementById('new-t-num').value;
                    const img = base64Input.value;

                    if (!num) return showNotification("El número es obligatorio", "error");

                    const btn = document.getElementById('save-new-territorio');
                    btn.textContent = "Guardando...";
                    btn.disabled = true;

                    try {
                        await addTerritorio({
                            numero: num,
                            manzanas: document.getElementById('new-t-manzanas').value,
                            imagen: img // Saves Base64 directly
                        });
                        modal.classList.add('hidden');
                        loadSubTab('territorios', container, config);
                        showNotification("Territorio creado exitosamente");
                    } catch (err) {
                        console.error(err);
                        showNotification("Error al guardar", "error");
                        btn.textContent = "Guardar Territorio";
                        btn.disabled = false;
                    }
                });
            });
        });

        window.deleteTerritorio = async (id) => {
            showCustomConfirm('¿Eliminar esté territorio?', async () => {
                await deleteTerritorio(id);
                loadSubTab('territorios', container, config, appVersion);
            });
        };

        window.editTerritorio = async (id) => {
            const t = territorios.find(x => x.id === id);
            if (!t) return;

            showModal(`
                <div class="flex flex-col h-full">
                    <header class="shrink-0 flex items-center justify-between bg-gradient-to-r from-teal-600 to-emerald-700 p-6 text-white relative overflow-hidden">
                        <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                        <div class="relative z-10 flex items-center gap-4">
                            <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/20">🗺️</div>
                            <div>
                                <h3 class="text-xl font-black tracking-tight">Editar Territorio</h3>
                                <p class="text-[9px] opacity-70 uppercase tracking-[0.3em] font-black">Identificador ${t.numero}</p>
                            </div>
                        </div>
                    </header>

                    <div class="flex-1 p-6 space-y-6 overflow-y-auto">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-[10px] uppercase font-black text-teal-600 mb-1.5 ml-1">Número de Territorio</label>
                                <input type="text" id="edit-t-num" value="${t.numero}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-gray-900 dark:text-white font-bold outline-none focus:border-teal-500 shadow-sm">
                            </div>
                            <div>
                                <label class="block text-[10px] uppercase font-black text-teal-600 mb-1.5 ml-1">Manzanas / Sectores</label>
                                <input type="text" id="edit-t-manzanas" value="${t.manzanas || ''}" placeholder="Ej: 1, 2, 3..." class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-gray-900 dark:text-white font-bold outline-none focus:border-teal-500 shadow-sm">
                            </div>

                            <div>
                                <label class="block text-[10px] uppercase font-black text-teal-600 mb-1.5 ml-1">Imagen del Mapa</label>
                                <div class="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-dashed border-gray-300 dark:border-white/10">
                                    <div class="flex items-center gap-4">
                                        <label class="cursor-pointer bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-teal-500/20 active:scale-95 flex items-center gap-2">
                                            <span>🔄 Cambiar</span>
                                            <input type="file" id="edit-t-file" accept="image/*" class="hidden">
                                        </label>
                                        <div class="flex flex-col min-w-0">
                                            <span id="file-name-edit" class="text-[10px] text-gray-500 font-bold uppercase truncate">Mantener actual</span>
                                            <p class="text-[8px] text-gray-400">Dimensión recomendada: 1200x800px</p>
                                        </div>
                                    </div>
                                    <input type="hidden" id="edit-t-base64" value="${t.imagen || ''}">
                                    
                                    <div id="preview-edit-container" class="mt-4 ${t.imagen ? '' : 'hidden'}">
                                         <div class="relative rounded-xl overflow-hidden border border-black/5 dark:border-white/10 bg-white">
                                             <img id="preview-edit" src="${t.imagen || ''}" class="w-full h-auto max-h-48 object-contain mx-auto">
                                         </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="shrink-0 p-6 bg-gray-50 dark:bg-black/40 border-t border-black/5 dark:border-white/5">
                        <button id="update-territorio" class="w-full bg-teal-600 py-4 rounded-2xl text-white font-black shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all uppercase tracking-[0.2em] text-[11px]">
                            Actualizar Territorio
                        </button>
                    </div>
                </div>`, async (modal) => {
                // File Handler
                const fileInput = document.getElementById('edit-t-file');
                const nameDisplay = document.getElementById('file-name-edit');
                const previewContainer = document.getElementById('preview-edit-container');
                const previewImg = document.getElementById('preview-edit');
                const base64Input = document.getElementById('edit-t-base64');

                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        if (file.size > 800 * 1024) {
                            showNotification("La imagen es muy grande. Máx 800KB.", "warning");
                            fileInput.value = '';
                            return;
                        }
                        nameDisplay.textContent = file.name;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const result = ev.target.result;
                            base64Input.value = result;
                            previewImg.src = result;
                            previewContainer.classList.remove('hidden');
                        };
                        reader.readAsDataURL(file);
                    }
                });

                document.getElementById('update-territorio').addEventListener('click', async () => {
                    const btn = document.getElementById('update-territorio');
                    btn.textContent = "Actualizando...";
                    btn.disabled = true;

                    try {
                        await updateTerritorio(id, {
                            numero: document.getElementById('edit-t-num').value,
                            manzanas: document.getElementById('edit-t-manzanas').value,
                            imagen: base64Input.value
                        });
                        modal.classList.add('hidden');
                        loadSubTab('territorios', container, config, appVersion);
                        showNotification("Territorio actualizado");
                    } catch (err) {
                        console.error(err);
                        showNotification("Error al actualizar", "error");
                        btn.textContent = "Actualizar Cambios";
                        btn.disabled = false;
                    }
                });
            });
        };


    } else if (subTab === 'personal') {
        const publicadores = await getPublicadores();
        const groups = await getGroupsConfig();
        publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const renderAvailPreview = (p) => {
            const disp = p.disponibilidad || [];
            if (!p.es_conductor) return '';
            if (disp.length === 0) return '<span class="text-[9px] text-gray-500 italic">Precedencia sin turnos</span>';
            return `<button onclick="event.stopPropagation(); window.showPublicadorAvailability('${p.id}')" class="text-[9px] text-teal-600 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 rounded border border-teal-500/20 underline decoration-teal-500/30 cursor-pointer transition-colors font-medium">Conductor: ${disp.length} turnos</button>`;
        };

        window.showPublicadorAvailability = (id) => {
            const p = publicadores.find(x => x.id === id);
            if (!p || !p.disponibilidad || p.disponibilidad.length === 0) return;
            const shiftLabels = { 'manana': 'Mañana', 'tarde': 'Tarde', 'noche': 'Noche' };
            const daysOrder = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6 };
            const sorted = [...p.disponibilidad].sort((a, b) => {
                const [da, sa] = a.split('_'), [db, sb] = b.split('_');
                return (daysOrder[da] - daysOrder[db]) || (sa.localeCompare(sb));
            });
            const listHtml = sorted.map(item => `<div class="flex justify-between p-2 border-b border-black/5 dark:border-white/5 last:border-0"><span class="text-sm font-bold text-gray-700 dark:text-gray-300">${item.split('_')[0]}</span><span class="text-[10px] font-bold uppercase text-teal-500">${shiftLabels[item.split('_')[1]] || item.split('_')[1]}</span></div>`).join('');
            showModal(`
                <div class="flex flex-col h-full">
                    <header class="shrink-0 flex items-center justify-between bg-teal-600 p-6 text-white shadow-lg">
                        <div>
                             <h3 class="text-xl font-black uppercase tracking-widest">Disponibilidad</h3>
                             <p class="text-[9px] opacity-70 font-bold uppercase mt-1 tracking-[0.2em]">${p.nombre}</p>
                        </div>
                        <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">📅</div>
                    </header>
                    <div class="flex-1 p-6 overflow-y-auto">
                        <div class="bg-gray-50 dark:bg-black/40 rounded-[2rem] border border-black/5 dark:border-white/10 overflow-hidden shadow-inner">
                            ${listHtml}
                        </div>
                    </div>
                    <div class="shrink-0 p-4 bg-gray-50 dark:bg-black/40 border-t border-black/5 dark:border-white/5">
                        <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full bg-white dark:bg-white/5 py-3 rounded-xl text-[10px] font-black text-gray-400 hover:text-teal-600 transition-colors uppercase tracking-[0.2em] border border-black/5 dark:border-white/5 shadow-sm">
                            Cerrar Vista
                        </button>
                    </div>
                </div>`, () => { });
        };

        container.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h3 class="font-bold text-xl text-teal-800 dark:text-teal-100">Directorio de Personal</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Gestiona publicadores, conductores y administradores</p>
                </div>
                <button id="btn-add-person" class="btn-premium px-6 py-2.5 rounded-xl text-sm">+ Nuevo Registro</button>
            </div>
            <div class="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                ${publicadores.map(p => `
                    <div class="premium-glass p-5 rounded-2xl flex justify-between items-center group">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-br ${p.genero === 'Mujer' ? 'from-pink-500 to-rose-400' : 'from-blue-600 to-cyan-500'} flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                ${p.nombre.charAt(0)}
                            </div>
                            <div>
                                <div class="font-black text-gray-800 dark:text-white text-base flex items-center gap-2">
                                    ${p.nombre}
                                    ${p.privilegios?.includes('Administrador') ? '<span class="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Admin</span>' : ''}
                                </div>
                                <div class="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">${p.telefono || 'Sin teléfono'} • <span class="text-teal-600 dark:text-teal-400 font-bold uppercase">Grupo ${p.grupo || '?'}</span></div>
                                <div class="mt-2">${renderAvailPreview(p)}</div>
                            </div>
                        </div>
                        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                            <button onclick="window.editPerson('${p.id}')" class="p-2.5 bg-white/10 dark:bg-black/40 rounded-xl border border-white/10 hover:border-teal-500/50 hover:text-teal-500 transition-all" title="Editar">✏️</button>
                            <button onclick="window.deletePerson('${p.id}')" class="p-2.5 bg-white/10 dark:bg-black/40 rounded-xl border border-white/10 hover:border-red-500/50 hover:text-red-500 transition-all" title="Eliminar">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        const openPersonModal = (person = null) => {
            const isEdit = !!person;
            const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            const shifts = [{ id: 'manana', label: 'Mañ.', color: 'text-yellow-500' }, { id: 'tarde', label: 'Tar.', color: 'text-orange-500' }, { id: 'noche', label: 'Noc.', color: 'text-blue-500' }];
            const privs = ['Conductor', 'Administrador', 'Secretario', 'Servicio', 'Visitante'];

            showModal(`
                <div class="flex flex-col h-full">
                    <header class="shrink-0 flex items-center justify-between bg-gradient-to-r from-teal-700 to-indigo-800 p-6 text-white relative overflow-hidden">
                        <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                        <div class="relative z-10 flex items-center gap-4">
                            <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/20">👤</div>
                            <div>
                                <h3 class="text-xl font-black tracking-tight">${isEdit ? 'Editar Registro' : 'Nuevo Registro'}</h3>
                                <p class="text-[9px] opacity-70 uppercase tracking-[0.3em] font-black">Gestión de Personal</p>
                            </div>
                        </div>
                    </header>

                    <div class="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
                        <div class="space-y-6">
                            <!-- Datos Básicos -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[10px] font-black uppercase text-teal-600 mb-1.5 ml-1 tracking-widest">Nombre Completo</label>
                                    <input type="text" id="p-name" value="${person?.nombre || ''}" placeholder="Ej: Juan Pérez" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-sm font-bold focus:border-indigo-500 outline-none shadow-sm transition-all">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-black uppercase text-teal-600 mb-1.5 ml-1 tracking-widest">WhatsApp / Teléfono</label>
                                    <input type="text" id="p-phone" value="${person?.telefono || ''}" placeholder="+593..." class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-sm font-mono font-bold focus:border-indigo-500 outline-none shadow-sm transition-all">
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[10px] font-black uppercase text-teal-600 mb-1.5 ml-1 tracking-widest">Género</label>
                                    <select id="p-gender" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-sm font-bold focus:border-indigo-500 outline-none shadow-sm appearance-none cursor-pointer">
                                        <option value="Hombre" ${person?.genero === 'Hombre' ? 'selected' : ''}>Hombre</option>
                                        <option value="Mujer" ${person?.genero === 'Mujer' ? 'selected' : ''}>Mujer</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-black uppercase text-teal-600 mb-1.5 ml-1 tracking-widest">Grupo Asignado</label>
                                    <select id="p-group" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-sm font-bold focus:border-indigo-500 outline-none shadow-sm appearance-none cursor-pointer">
                                        <option value="0" ${!person?.grupo || person?.grupo === 0 ? 'selected' : ''}>Sin asignar</option>
                                        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${person?.grupo == (i + 1) ? 'selected' : ''}>Grupo ${i + 1}</option>`).join('')}
                                    </select>
                                </div>
                            </div>

                            <div id="p-email-container" class="${person?.privilegios?.includes('Administrador') ? '' : 'hidden'} animate-fade-in-up">
                                <label class="block text-[10px] font-black uppercase text-indigo-600 mb-1.5 ml-1 tracking-widest">Acceso Google (Email)</label>
                                <input type="email" id="p-email" value="${person?.email || ''}" placeholder="usuario@gmail.com" class="w-full bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-3.5 text-sm font-bold focus:border-indigo-500 outline-none shadow-sm transition-all text-indigo-700 dark:text-indigo-300">
                                <p class="text-[8px] text-gray-400 mt-1.5 ml-1 italic font-medium">Requerido para administradores y conductores con acceso a la nube.</p>
                            </div>

                            <div class="space-y-3">
                                <label class="block text-[10px] font-black uppercase text-teal-600 ml-1 tracking-widest">Privilegios y Roles</label>
                                <div id="privs-container" class="flex flex-wrap gap-2 p-1">
                                    ${privs.map(pr => `
                                        <label class="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-4 py-2.5 rounded-xl border border-transparent hover:border-indigo-500/30 cursor-pointer transition-all group">
                                            <input type="checkbox" class="p-priv-check sr-only peer" value="${pr}" ${person?.privilegios?.includes(pr) ? 'checked' : ''}>
                                            <div class="w-4 h-4 rounded border-2 border-gray-300 dark:border-white/20 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 flex items-center justify-center transition-all">
                                                <svg class="w-3 h-3 text-white hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <span class="text-xs font-bold text-gray-600 dark:text-gray-400 peer-checked:text-indigo-600 dark:peer-checked:text-indigo-400 transition-colors uppercase tracking-widest">${pr}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Disponibilidad -->
                            <div class="p-5 bg-teal-500/5 rounded-[2rem] border border-teal-500/10 space-y-4">
                                <div class="flex items-center justify-between">
                                    <span class="text-[10px] font-black uppercase text-teal-600 tracking-widest">Disponibilidad de Conductor</span>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="p-is-cond" class="sr-only peer" ${person?.es_conductor ? 'checked' : ''}>
                                        <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                    </label>
                                </div>
                                <div id="p-avail-grid" class="${person?.es_conductor ? '' : 'opacity-20 pointer-events-none grayscale'} transition-all duration-500">
                                     <div class="grid grid-cols-4 gap-1 mb-2 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                         <div class="text-left pl-2">Día</div>
                                         ${shifts.map(s => `<div class="${s.color}">${s.label}</div>`).join('')}
                                     </div>
                                     <div class="space-y-1.5">
                                         ${days.map(day => `
                                             <div class="grid grid-cols-4 gap-1 items-center bg-white/40 dark:bg-black/20 rounded-xl p-2 border border-black/5 dark:border-white/5">
                                                 <div class="text-[10px] font-black text-gray-700 dark:text-gray-300 pl-2 uppercase">${day.slice(0, 3)}</div>
                                                 ${shifts.map(sh => `<div class="flex justify-center"><input type="checkbox" class="p-avail-check w-5 h-5 accent-teal-600 cursor-pointer" value="${day}_${sh.id}" ${person?.disponibilidad?.includes(`${day}_${sh.id}`) ? 'checked' : ''}></div>`).join('')}
                                             </div>
                                         `).join('')}
                                     </div>
                                </div>
                            </div>

                            <!-- Módulos -->
                            <div id="p-modules-section" class="p-5 bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10 ${person?.es_conductor ? '' : 'opacity-20 pointer-events-none grayscale'} transition-all duration-500">
                                <label class="block text-[10px] font-black uppercase text-indigo-600 mb-4 ml-1 tracking-widest">Módulos Habilitados</label>
                                <div class="grid grid-cols-1 gap-2">
                                    <label class="flex items-center justify-between p-4 bg-white/40 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 cursor-pointer hover:bg-indigo-500/5 transition-all group">
                                        <span class="text-xs font-bold text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">Dashboard de Conductor</span>
                                        <input type="checkbox" id="mod-dashboard" class="p-mod-check w-5 h-5 accent-indigo-600" ${person?.modulos?.dashboard !== false ? 'checked' : ''}>
                                    </label>
                                    <label class="flex items-center justify-between p-4 bg-white/40 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 cursor-pointer hover:bg-indigo-500/5 transition-all group">
                                        <span class="text-xs font-bold text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">Programa Semanal</span>
                                        <input type="checkbox" id="mod-programa" class="p-mod-check w-5 h-5 accent-indigo-600" ${person?.modulos?.programa !== false ? 'checked' : ''}>
                                    </label>
                                    <label class="flex items-center justify-between p-4 bg-white/40 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 cursor-pointer hover:bg-indigo-500/5 transition-all group">
                                        <span class="text-xs font-bold text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">Predicación Telefónica</span>
                                        <input type="checkbox" id="mod-telefonos" class="p-mod-check w-5 h-5 accent-indigo-600" ${person?.modulos?.telefonos !== false ? 'checked' : ''}>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="shrink-0 p-6 bg-gray-100 dark:bg-black/60 border-t border-black/5 dark:border-white/10">
                        <button id="save-person" class="w-full bg-gradient-to-r from-teal-600 to-indigo-700 py-4 rounded-2xl text-white font-black shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all uppercase tracking-[0.2em] text-[11px]">
                            ${isEdit ? 'Guardar Cambios' : 'Crear Registro'}
                        </button>
                    </div>
                </div>
            `, (modal) => {
                const genderSelect = modal.querySelector('#p-gender');
                const privsContainer = modal.querySelector('#privs-container');

                const updatePrivsList = () => {
                    const gender = genderSelect.value;
                    const malePrivs = ['Superintendente de Circuito', 'Anciano', 'Siervo ministerial', 'Conductor', 'Administrador'];
                    const femalePrivs = ['Conductor', 'Administrador']; // Added these to women as well for flexibility
                    const currentPrivs = person?.privilegios || [];
                    const list = gender === 'Hombre' ? malePrivs : femalePrivs;

                    privsContainer.innerHTML = list.map(pr => `
                        <label class="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-4 py-2.5 rounded-xl border border-transparent hover:border-indigo-500/30 cursor-pointer transition-all group">
                            <input type="checkbox" class="p-priv sr-only peer" value="${pr}" ${currentPrivs.includes(pr) ? 'checked' : ''}>
                            <div class="w-4 h-4 rounded border-2 border-gray-300 dark:border-white/20 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 flex items-center justify-center transition-all">
                                <svg class="w-3 h-3 text-white hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <span class="text-[10px] font-black text-gray-400 peer-checked:text-indigo-600 dark:peer-checked:text-indigo-400 transition-colors uppercase tracking-widest">${pr}</span>
                        </label>
                    `).join('');

                    const conductorCheckboxes = privsContainer.querySelectorAll('input[value="Conductor"]');
                    const isCondToggle = modal.querySelector('#p-is-cond');
                    const availGrid = modal.querySelector('#p-avail-grid');
                    const modulesSection = modal.querySelector('#p-modules-section');

                    conductorCheckboxes.forEach(cb => {
                        cb.addEventListener('change', () => {
                            if (cb.checked) {
                                isCondToggle.checked = true;
                                availGrid.classList.remove('opacity-30', 'pointer-events-none');
                                modulesSection.classList.remove('opacity-30', 'pointer-events-none');
                            }
                        });
                    });

                    // Logic for Admin email
                    const adminCheckboxes = privsContainer.querySelectorAll('input[value="Administrador"]');
                    const emailContainer = modal.querySelector('#p-email-container');
                    adminCheckboxes.forEach(cb => {
                        cb.addEventListener('change', () => {
                            emailContainer.classList.toggle('hidden', !cb.checked);
                        });
                    });
                };

                genderSelect.addEventListener('change', updatePrivsList);
                updatePrivsList();

                const isCondCheck = modal.querySelector('#p-is-cond');
                const availGrid = modal.querySelector('#p-avail-grid');
                const modulesSection = modal.querySelector('#p-modules-section');

                isCondCheck.addEventListener('change', () => {
                    const active = isCondCheck.checked;
                    availGrid.classList.toggle('opacity-30', !active);
                    availGrid.classList.toggle('pointer-events-none', !active);
                    modulesSection.classList.toggle('opacity-30', !active);
                    modulesSection.classList.toggle('pointer-events-none', !active);
                });

                modal.querySelector('#save-person').onclick = async () => {
                    const btn = modal.querySelector('#save-person');
                    const original = btn.innerText;
                    btn.innerText = 'GUARDANDO...';
                    btn.disabled = true;

                    const isConductorPriv = Array.from(modal.querySelectorAll('.p-priv:checked')).map(cb => cb.value).includes('Conductor');
                    const data = {
                        nombre: modal.querySelector('#p-name').value.trim(),
                        telefono: modal.querySelector('#p-phone').value.trim(),
                        genero: modal.querySelector('#p-gender').value,
                        grupo: parseInt(modal.querySelector('#p-group').value),
                        es_conductor: isCondCheck.checked || isConductorPriv,
                        email: modal.querySelector('#p-email').value.trim().toLowerCase(),
                        privilegios: Array.from(modal.querySelectorAll('.p-priv:checked')).map(cb => cb.value),
                        disponibilidad: isCondCheck.checked ? Array.from(modal.querySelectorAll('.p-avail-check:checked')).map(cb => cb.value) : [],
                        modulos: {
                            dashboard: (isCondCheck.checked || isConductorPriv) ? modal.querySelector('#mod-dashboard').checked : (person?.modulos?.dashboard || false),
                            programa: (isCondCheck.checked || isConductorPriv) ? modal.querySelector('#mod-programa').checked : (person?.modulos?.programa || false),
                            telefonos: true // Siempre habilitado según requerimiento
                        }
                    };

                    if (!data.nombre) {
                        showNotification("El nombre es obligatorio", "error");
                        btn.innerText = original; btn.disabled = false;
                        return;
                    }

                    try {
                        if (isEdit) await updatePublicador(person.id, data);
                        else await addPublicador(data);
                        showNotification("Personal actualizado");
                        modal.classList.add('hidden');
                        loadSubTab('personal', container, config, appVersion);
                    } catch (e) {
                        showNotification("Error: " + e.message, "error");
                        btn.innerText = original; btn.disabled = false;
                    }
                };
            }, 'max-w-2xl');
        };

        container.querySelector('#btn-add-person').onclick = () => openPersonModal();
        window.editPerson = (id) => openPersonModal(publicadores.find(x => x.id === id));
        window.deletePerson = (id) => showCustomConfirm("¿Eliminar este registro permanentemente?", async () => {
            await deletePublicador(id);
            loadSubTab('personal', container, config, appVersion);
        });

    } else if (subTab === 'grupos') {
        const groups = await getGroupsConfig();
        const publicadores = await getPublicadores();
        publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

        container.innerHTML = `
            <div class="mb-8">
                <h3 class="font-bold text-xl text-teal-800 dark:text-teal-100 flex items-center gap-3">
                    <span class="p-2 bg-teal-500/10 rounded-xl">🏘️</span> Configuración de Grupos
                </h3>
                <p class="text-[10px] text-gray-500 uppercase tracking-widest font-black mt-1 ml-12">Asignación de liderazgo y puntos de salida</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${groups.map(g => `
                    <div class="premium-glass p-6 rounded-[2rem] border border-white/5 hover:border-teal-500/30 transition-all relative group overflow-hidden">
                        <div class="absolute -top-4 -right-4 w-20 h-20 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all"></div>
                        <div class="relative z-10">
                            <div class="flex justify-between items-start mb-4">
                                <h4 class="font-black text-gray-800 dark:text-white uppercase tracking-tighter text-lg">${g.nombre}</h4>
                                <span class="text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded-full">#${g.id}</span>
                            </div>
                            <div class="space-y-4">
                                <div class="bg-black/5 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
                                    <label class="block text-[8px] font-black uppercase text-teal-600/60 mb-1 tracking-widest">Superintendente de Grupo</label>
                                    <select id="leader-${g.id}" class="w-full bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer">
                                        <option value="">Sin asignar</option>
                                        ${publicadores.map(p => `<option value="${p.nombre}" ${g.lider === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="bg-black/5 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
                                    <label class="block text-[8px] font-black uppercase text-teal-600/60 mb-1 tracking-widest">Auxiliar</label>
                                    <select id="assistant-${g.id}" class="w-full bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer">
                                        <option value="">Sin asignar</option>
                                        ${publicadores.map(p => `<option value="${p.nombre}" ${g.asistente === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="bg-black/5 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
                                    <label class="block text-[8px] font-black uppercase text-teal-600/60 mb-1 tracking-widest">Punto de Salida / Casa</label>
                                    <input type="text" id="house-${g.id}" value="${g.casa_salida || ''}" placeholder="Dirección..." class="w-full bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none placeholder-gray-500">
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="mt-12 flex flex-col md:flex-row justify-center items-center gap-4">
                <button id="add-group-btn" class="px-8 py-4 bg-white dark:bg-white/5 border border-teal-500/30 rounded-2xl font-black uppercase tracking-widest text-[10px] text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white transition-all shadow-lg active:scale-95">
                    + Agregar Grupo
                </button>
                <button id="save-groups" class="btn-premium px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl flex items-center gap-3">
                    <span>💾</span> Guardar Configuración de Grupos
                </button>
            </div>
        `;

        container.querySelector('#add-group-btn').onclick = () => {
            const newId = groups.length > 0 ? (Math.max(...groups.map(g => g.id)) + 1) : 1;
            groups.push({
                id: newId,
                nombre: `Grupo ${newId}`,
                lider: "",
                asistente: "",
                casa_salida: ""
            });
            // Re-render subtab
            loadSubTab('grupos', container, config, appVersion);
        };

        container.querySelector('#save-groups').onclick = async () => {
            const btn = container.querySelector('#save-groups');
            btn.innerHTML = '<span class="animate-pulse italic">Sincronizando...</span>';
            btn.disabled = true;

            const updated = groups.map(g => ({
                ...g,
                lider: document.getElementById(`leader-${g.id}`).value,
                asistente: document.getElementById(`assistant-${g.id}`).value,
                casa_salida: document.getElementById(`house-${g.id}`).value.trim()
            }));

            try {
                await saveGroupsConfig(updated);
                showNotification("Configuración de grupos guardada");
            } catch (e) {
                showNotification("Error: " + e.message, "error");
            } finally {
                btn.innerHTML = '<span>💾</span> Guardar Configuración de Grupos';
                btn.disabled = false;
            }
        };
    }
};

const renderTelefonosTab = async (container) => {
    const telefonos = await getTelefonos();
    const publicadores = await getPublicadores();
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Capture previous state if this is a re-render
    let currentSearch = '';
    let currentPub = '';
    let currentStatus = '';

    const existingSearch = document.getElementById('search-number');
    const existingPub = document.getElementById('filter-publisher');
    const existingStatus = document.getElementById('filter-status');

    if (existingSearch) {
        currentSearch = existingSearch.value;
        currentPub = existingPub.value;
        currentStatus = existingStatus.value;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h3 class="font-bold text-2xl text-teal-800 dark:text-teal-200 flex items-center gap-3">
                <span class="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg text-xl">📞</span> Gestión de Predicación Telefónica
            </h3>
            <button id="btn-view-session-summaries" class="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2">
                📋 Resúmenes de Sesión
            </button>
        </div>

        <!-- Progress Bar (Cycle) -->
        <div class="bg-white dark:bg-[#0f1115] p-5 rounded-2xl mb-6 shadow-sm border border-black/5 dark:border-white/5">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Progreso del Ciclo (~1124 registros)</span>
                <span id="cycle-percentage" class="text-xs font-black text-teal-600 dark:text-teal-400">0%</span>
            </div>
            <div class="w-full h-2.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div id="cycle-progress-bar" class="h-full bg-gradient-to-r from-teal-500 to-emerald-500 shadow-[0_0_10px_rgba(20,184,166,0.3)] transition-all duration-1000" style="width: 0%"></div>
            </div>
            <div id="cycle-info-text" class="text-[9px] text-gray-400 mt-2 italic flex justify-between">
                <span>Total registros: ${telefonos.length}</span>
                <span id="cycle-processed-info">Procesados: 0</span>
            </div>
        </div>
        
        <!--Controls Grid-->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
             <div class="flex gap-3">
                <button id="btn-add-phone" class="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all active:scale-95 flex items-center gap-2">
                    <span>+</span> Manual
                </button>
                <input type="file" id="csv-upload" accept=".csv" class="hidden">
                <button id="btn-csv" class="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center gap-2" title="Importar desde CSV">
                    <span>☁️</span> Importar
                </button>
                <button id="btn-export-phones" class="bg-green-600/10 hover:bg-green-600/20 text-green-700 dark:text-green-400 px-5 py-2.5 rounded-xl font-bold border border-green-200 dark:border-green-500/30 transition-all flex items-center gap-2 shadow-sm" title="Exportar a Excel">
                    <span>📊</span> Exportar
                </button>
            </div>
            
            <div class="flex gap-3 flex-wrap xl:justify-end items-center">
                 <div class="relative flex-1 xl:flex-none xl:w-64">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input type="text" id="search-number" placeholder="Buscar número, nombre..." class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none transition-shadow shadow-sm">
                </div>
                
                <select id="filter-publisher" class="flex-1 xl:flex-none xl:w-48 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:border-teal-500 outline-none cursor-pointer shadow-sm">
                    <option value="">Todos los Publicadores</option>
                    <option value="Sin asignar">Sin asignar</option>
                    ${publicadores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                </select>
                
                <select id="filter-status" class="flex-1 xl:flex-none xl:w-48 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:border-teal-500 outline-none cursor-pointer shadow-sm">
                    <option value="">Todos los Estados</option>
                    <option value="Sin asignar">Sin asignar</option>
                    <option value="Contestaron">Contestaron</option>
                    <option value="No contestan">No contestan</option>
                    <option value="Colgaron">Colgaron</option>
                    <option value="Revisita">Revisita</option>
                    <option value="No llamar">No llamar</option>
                    <option value="Suspendido">Suspendido</option>
                    <option value="Testigo">Testigo</option>
                </select>
            </div>
        </div>

        <!--Progress Bar Container-->
        <div id="upload-progress-container" class="hidden mb-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
            <div class="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-2 font-medium">
                <span id="progress-text">Cargando...</span>
                <span id="progress-percent">0%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-black/40 rounded-full h-2">
                <div id="upload-progress-bar" class="bg-teal-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
            </div>
        </div>
    `;

    // ADDED: Logic for Session Summaries Button
    const btnSummaries = document.getElementById('btn-view-session-summaries');
    if (btnSummaries) {
        btnSummaries.addEventListener('click', async () => {
            const { getSessionSummaries } = await import('../data/firestore-services.js?v=3.0.0');
            const summaries = await getSessionSummaries();

            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in';
            modal.innerHTML = `
                <div class="bg-white dark:bg-[#0f1115] w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                    <div class="p-6 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                        <h3 class="text-xl font-black">📋 Resúmenes de Sesión (Zoom)</h3>
                        <button id="close-summaries" class="p-2 hover:bg-white/20 rounded-full transition-colors font-bold">✕</button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        ${summaries.length === 0 ? `
                            <div class="text-center py-20 text-gray-400">
                                <span class="text-5xl block mb-4">📭</span>
                                <p>No hay resúmenes de sesión registrados aún.</p>
                            </div>
                        ` : `
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${summaries.map(s => `
                                    <div class="p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-gray-50 dark:bg-white/5 hover:border-blue-500/30 transition-all">
                                        <div class="flex justify-between items-start mb-3">
                                            <span class="text-[10px] font-black uppercase tracking-tighter text-blue-500 bg-blue-500/10 px-2 py-1 rounded-md">Sesión #${s.id.substring(0, 5)}</span>
                                            <span class="text-[10px] text-gray-400 font-bold">${new Date(s.timestamp?.toDate ? s.timestamp.toDate() : s.timestamp).toLocaleString()}</span>
                                        </div>
                                        <div class="mb-3">
                                            <p class="text-xs text-gray-500 dark:text-gray-400">Total Llamadas: <b class="text-gray-900 dark:text-white">${s.total}</b></p>
                                            ${s.contestaron > 0 ? `<p class="text-xs text-green-600">✅ Contestaron: <b>${s.contestaron}</b></p>` : ''}
                                            ${s.revisitas > 0 ? `<p class="text-xs text-amber-600">↺ Revisitas: <b>${s.revisitas}</b></p>` : ''}
                                            ${s.noContestan > 0 ? `<p class="text-xs text-gray-400">🔇 No contestan: <b>${s.noContestan}</b></p>` : ''}
                                        </div>
                                        <div class="text-[11px] text-gray-600 dark:text-gray-300 italic bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-black/5">
                                            "${s.resumen.substring(0, 150)}${s.resumen.length > 150 ? '...' : ''}"
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('close-summaries').onclick = () => modal.remove();
        });
    }

    // List Container
    const listDiv = document.createElement('div');
    listDiv.id = 'phone-list-container';
    listDiv.className = 'bg-white dark:bg-[#0f1115] rounded-2xl border border-gray-200 dark:border-white/10 h-[600px] overflow-auto relative shadow-sm custom-scrollbar';
    container.appendChild(listDiv);


    // Render Logic with Filtering
    const renderList = () => {
        const listContainer = document.getElementById('phone-list-container');
        if (!listContainer) return;

        const searchVal = document.getElementById('search-number')?.value.toLowerCase() || '';
        const pubFilter = document.getElementById('filter-publisher')?.value || '';
        const statusFilter = document.getElementById('filter-status')?.value || '';

        // Update Progress Bar
        const processed = telefonos.filter(t => t.estado && t.estado !== 'Sin asignar').length;
        const total = telefonos.length || 1;
        const pct = Math.floor((processed / total) * 100);
        const pBar = document.getElementById('cycle-progress-bar');
        const pPct = document.getElementById('cycle-percentage');
        const pInfo = document.getElementById('cycle-processed-info');
        if (pBar) pBar.style.width = pct + '%';
        if (pPct) pPct.textContent = pct + '%';
        if (pInfo) pInfo.textContent = `Procesados: ${processed}`;

        const filtered = telefonos.filter(t => {
            const rawAssigned = t.asignado_a || t.publicador_asignado;
            let assignedName = 'Sin asignar';
            if (rawAssigned) {
                const p = publicadores.find(pub => pub.id === rawAssigned || pub.email === rawAssigned || pub.nombre === rawAssigned);
                assignedName = p ? p.nombre : rawAssigned;
            }

            const matchSearch = !searchVal || t.numero.toLowerCase().includes(searchVal) || (t.propietario && t.propietario.toLowerCase().includes(searchVal));
            const isActuallyAssigned = rawAssigned && rawAssigned !== 'Sin asignar' && rawAssigned !== 'Pendiente';
            const matchPub = !pubFilter || (pubFilter === 'Sin asignar' ? !isActuallyAssigned : assignedName === pubFilter);
            const currentStatus = (!t.estado || t.estado === 'Pendiente') ? 'Sin asignar' : t.estado;
            const matchStatus = !statusFilter || (statusFilter === 'Sin asignar' ? currentStatus === 'Sin asignar' : currentStatus === statusFilter);

            return matchSearch && matchPub && matchStatus;
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                    <span class="text-4xl mb-2">🔍</span>
                    <p class="text-sm font-bold uppercase tracking-widest opacity-50">No se encontraron registros</p>
                </div>`;
            return;
        }

        const colors = {
            'Contestaron': 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300',
            'No contestan': 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300',
            'Colgaron': 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300',
            'No llamar': 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300',
            'Revisita': 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
            'Sin asignar': 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400'
        };

        const getStatusBadge = (status) => `
            <span class="${colors[status] || colors['Sin asignar']} text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border border-black/5 dark:border-white/5 whitespace-nowrap shadow-sm">
                ${status === 'Contestaron' ? '✅ ' : status === 'Revisita' ? '↺ ' : ''}${status}
            </span>`;

        listContainer.innerHTML = `
            <table class="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead class="bg-gray-50 dark:bg-[#12141a] text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-widest sticky top-0 z-10 border-b border-gray-200 dark:border-white/5">
                    <tr>
                        <th class="p-4">Propietario / Dirección</th>
                        <th class="p-4">Número</th>
                        <th class="p-4">Publicador</th>
                        <th class="p-4 text-center">Estado</th>
                        <th class="p-4">Comentarios</th>
                        <th class="p-4 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                    ${filtered.map(t => {
            const rawAssigned = t.asignado_a || t.publicador_asignado;
            let assignedDisplay = 'Sin asignar';
            let isAssigned = false;
            if (rawAssigned && rawAssigned !== 'Sin asignar' && rawAssigned !== 'Pendiente') {
                const p = publicadores.find(pub => pub.id === rawAssigned || pub.email === rawAssigned || pub.nombre === rawAssigned);
                assignedDisplay = p ? p.nombre : rawAssigned;
                isAssigned = true;
            }

            const displayStatus = (!t.estado || t.estado === 'Pendiente') ? 'Sin asignar' : t.estado;
            let phoneDisplay = t.numero || '';
            const cleanNum = phoneDisplay.replace(/\D/g, '');
            if (cleanNum.length === 7) phoneDisplay = `${cleanNum.slice(0, 3)} ${cleanNum.slice(3)}`;
            else phoneDisplay = formatPhoneNumber(phoneDisplay);

            return `
                        <tr class="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                            <td class="p-4">
                                <span class="block font-black text-gray-900 dark:text-gray-100 uppercase text-xs">${t.propietario || '-'}</span>
                                <span class="text-[10px] uppercase text-gray-400 font-bold">${t.direccion || '-'}</span>
                            </td>
                            <td class="p-4 font-bold text-teal-700 dark:text-teal-400 tracking-wider text-xs">${phoneDisplay}</td>
                            <td class="p-4">
                                ${isAssigned
                    ? `<span class="text-[10px] bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2 py-1 rounded-lg border border-teal-100 dark:border-teal-500/20 font-black uppercase tracking-tighter">${assignedDisplay}</span>`
                    : `<span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-30 italic">Sin asignar</span>`
                }
                            </td>
                            <td class="p-4 text-center">${getStatusBadge(displayStatus)}</td>
                            <td class="p-4">
                                <div class="flex flex-col gap-1 max-w-[200px]">
                                    <span class="text-[11px] text-gray-600 dark:text-gray-300 truncate font-medium" title="${t.comentario || ''}">${t.comentario || '-'}</span>
                                    ${t.ultima_observacion_ciclo ? `
                                        <span class="text-[9px] text-amber-600/70 dark:text-amber-500/40 italic border-l-2 border-amber-500/30 pl-2" title="Ciclo Anterior">
                                            Ant: ${t.ultima_observacion_ciclo.substring(0, 30)}...
                                        </span>
                                    ` : ''}
                                </div>
                            </td>
                            <td class="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="window.editTelefonoAdmin('${t.id}')" class="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all">✏️</button>
                                <button onclick="window.deleteTelefonoAdmin('${t.id}')" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all">🗑️</button>
                            </td>
                        </tr>`;
        }).join('')}
                </tbody>
            </table>`;
    };

    // Initialize search/filter inputs once
    const searchInput = document.getElementById('search-number');
    const pubFilterInput = document.getElementById('filter-publisher');
    const statusFilterInput = document.getElementById('filter-status');

    if (searchInput) {
        if (currentSearch) searchInput.value = currentSearch;
        searchInput.addEventListener('input', () => {
            currentSearch = searchInput.value;
            renderList();
        });
    }
    if (pubFilterInput) {
        if (currentPub) pubFilterInput.value = currentPub;
        pubFilterInput.addEventListener('change', () => {
            currentPub = pubFilterInput.value;
            renderList();
        });
    }
    if (statusFilterInput) {
        if (currentStatus) statusFilterInput.value = currentStatus;
        statusFilterInput.addEventListener('change', () => {
            currentStatus = statusFilterInput.value;
            renderList();
        });
    }

    // Initial Render
    renderList();

    // Event Listeners (Local to renderTelefonosTab)
    const btnCsv = document.getElementById('btn-csv');
    const csvUpload = document.getElementById('csv-upload');
    const btnAddPhone = document.getElementById('btn-add-phone');
    const btnExport = document.getElementById('btn-export-phones');

    if (btnCsv) btnCsv.onclick = () => csvUpload.click();

    if (csvUpload) csvUpload.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            let count = 0;

            const progressContainer = document.getElementById('upload-progress-container');
            const progressBar = document.getElementById('upload-progress-bar');
            const progressText = document.getElementById('progress-text');
            const progressPercent = document.getElementById('progress-percent');

            if (progressContainer) progressContainer.classList.remove('hidden');

            const validLines = lines.filter(l => l.trim() && !l.toLowerCase().startsWith('numero') && !l.toLowerCase().startsWith('número'));
            const total = validLines.length;

            if (total === 0) {
                showNotification("El archivo está vacío o no tiene formato válido.", "warning");
                if (progressContainer) progressContainer.classList.add('hidden');
                return;
            }

            for (let i = 0; i < validLines.length; i++) {
                const line = validLines[i].trim();
                const parts = line.split(',');

                if (parts.length >= 2) {
                    try {
                        const name = parts[0]?.trim();
                        const num = parts[parts.length - 1]?.trim();
                        const address = parts.length > 2 ? parts[1]?.trim() : '';

                        if (num && num.length > 5) {
                            await addTelefono({
                                numero: num,
                                direccion: address,
                                propietario: name,
                                estado: 'Sin asignar'
                            });
                            count++;
                        }
                    } catch (err) { console.error(err); }
                }

                if (i % 5 === 0 || i === total - 1) {
                    const percent = Math.round(((i + 1) / total) * 100);
                    if (progressBar) progressBar.style.width = `${percent}%`;
                    if (progressPercent) progressPercent.innerText = `${percent}%`;
                    if (progressText) progressText.innerText = `Cargando ${i + 1} de ${total}...`;
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            if (progressText) progressText.innerText = "Completado";

            setTimeout(() => {
                if (progressContainer) progressContainer.classList.add('hidden');
                showNotification(`Se cargaron ${count} teléfonos correctamente.`, "success");
                renderTelefonosTab(container);
            }, 500);
        };
        reader.readAsText(file);
    };

    if (btnAddPhone) btnAddPhone.onclick = () => {
        showModal(`
            <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400">Nuevo Teléfono</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Número</label>
                    <input type="text" id="new-p-num" placeholder="Ej. 0991234567" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Dirección</label>
                    <input type="text" id="new-p-dir" placeholder="Ej. Av. Principal 123" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Propietario</label>
                    <input type="text" id="new-p-prop" placeholder="Ej. Juan Pérez" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
                </div>
                <button id="save-new-phone" class="w-full bg-teal-600 py-3 rounded-xl text-white hover:bg-teal-500 transition-colors font-bold shadow-lg shadow-teal-500/20 mt-4">Guardar</button>
            </div>
        `, async (modal) => {
            modal.querySelector('#save-new-phone').onclick = async () => {
                await addTelefono({
                    numero: modal.querySelector('#new-p-num').value,
                    direccion: modal.querySelector('#new-p-dir').value,
                    propietario: modal.querySelector('#new-p-prop').value,
                    estado: 'Sin asignar'
                });
                modal.classList.add('hidden');
                renderTelefonosTab(container);
                showNotification("Teléfono agregado con éxito.");
            };
        });
    };

    if (btnExport) btnExport.onclick = () => {
        const dataToExport = telefonos.map(t => ({
            'Propietario': t.propietario || '-',
            'Dirección': t.direccion || '-',
            'Número': t.numero || '-',
            'Publicador': t.asignado_a || t.publicador_asignado || 'Sin asignar',
            'Estado': t.estado || 'Sin asignar',
            'Comentario': t.comentario || '-'
        }));
        generatePlainXLS(dataToExport, `Directorio_Telefonico_${new Date().toISOString().split('T')[0]}`);
        showNotification("Generando archivo Excel...");
    };

    window.deleteTelefonoAdmin = async (id) => {
        showCustomConfirm('¿Eliminar este registro?', async () => {
            await deleteTelefono(id);
            renderTelefonosTab(container);
            showNotification("Registro eliminado.");
        });
    };

    window.editTelefonoAdmin = async (id) => {
        const t = telefonos.find(x => x.id === id);
        if (!t) return;

        const estados = ['Sin asignar', 'Asignado', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];

        showModal(`
            <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400">Editar Registro Telefónico</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Número</label>
                    <input type="text" id="edit-p-num" value="${t.numero}" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Nombre Propietario</label>
                    <input type="text" id="edit-p-prop" value="${t.propietario || ''}" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Dirección</label>
                    <input type="text" id="edit-p-dir" value="${t.direccion || ''}" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                     <div>
                        <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Asignado a (Publicador)</label>
                        <select id="edit-p-pub" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
                            <option value="">Sin asignar</option>
                            ${publicadores.map(p => `<option value="${p.nombre}" ${t.asignado_a === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Estado</label>
                        <select id="edit-p-estado" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
                            ${estados.map(e => `<option value="${e}" ${t.estado === e ? 'selected' : ''}>${e}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Observaciones / Comentarios</label>
                    <textarea id="edit-p-obs" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none h-20 resize-none">${t.comentario || t.observaciones || ''}</textarea>
                </div>
            </div>
            <button id="update-phone" class="w-full bg-teal-600 py-3 rounded-lg text-white mt-6 hover:bg-teal-500 transition-colors font-bold shadow-lg shadow-teal-500/20">Actualizar Registro</button>
        `, async (modal) => {
            modal.querySelector('#update-phone').addEventListener('click', async () => {
                const assignedTo = modal.querySelector('#edit-p-pub').value;
                const updateData = {
                    numero: modal.querySelector('#edit-p-num').value,
                    direccion: modal.querySelector('#edit-p-dir').value,
                    propietario: modal.querySelector('#edit-p-prop').value,
                    asignado_a: assignedTo,
                    publicador_asignado: assignedTo,
                    estado: modal.querySelector('#edit-p-estado').value,
                    comentario: modal.querySelector('#edit-p-obs').value
                };

                // If state is unassigned, clear assignment fields
                if (updateData.estado === 'Sin asignar') {
                    updateData.asignado_a = null;
                    updateData.publicador_asignado = null;
                    updateData.fecha_asignacion = null;
                    updateData.solicitado_por = null;
                }

                // If explicitly set to empty/Sin asignar in the publisher select, clear both assignment fields
                if (!assignedTo || assignedTo === 'Sin asignar') {
                    updateData.asignado_a = null;
                    updateData.publicador_asignado = null;
                    updateData.fecha_asignacion = null;
                    updateData.solicitado_por = null;
                    if (updateData.estado === 'Asignado') updateData.estado = 'Sin asignar';
                }

                await updateTelefono(id, updateData);
                modal.classList.add('hidden');
                renderTelefonosTab(container);
                showNotification("Registro actualizado.");
            });
        });
    };
};



/* Updated Helper for simple CRUD lists with Edit support */
const renderListCRUD = (container, title, items, fields, onAdd, onDelete, onEdit) => {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="font-semibold text-lg text-teal-800 dark:text-teal-100">${title}</h3>
            <button id="btn-add-item" class="bg-teal-600 text-sm px-4 py-2 rounded-lg hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20">+ Agregar</button>
        </div>
        <div class="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            ${items.map(item => `
                <div class="flex justify-between items-center p-3 bg-black/5 dark:bg-white/5 rounded border border-black/10 dark:border-white/10 group hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                    <div>
                        <div class="font-medium text-gray-800 dark:text-gray-200 text-base">${item[fields[0]]}</div>
                        ${fields[1] ? `<div class="text-xs text-gray-500 dark:text-gray-400">${item[fields[1]]}</div>` : ''}
                    </div>
                    <div class="flex gap-2">
                         ${onEdit ? `<button class="text-teal-600 dark:text-teal-400 hover:text-teal-500 hover:bg-teal-500/10 p-2 rounded-lg transition-colors" onclick="window.editItem_${title.replace(/\s/g, '')}('${item.id}')">✏️</button>` : ''}
                        <button class="text-red-500/70 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors" onclick="window.deleteItem_${title.replace(/\s/g, '')}('${item.id}')">✕</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    const inputClasses = "w-full mb-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none transition-all shadow-sm";

    document.getElementById('btn-add-item').addEventListener('click', () => {
        const inputs = fields.map(f => `
            <div>
                <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">${f}</label>
                <input type="text" id="field-${f}" class="${inputClasses}" placeholder="${f.charAt(0).toUpperCase() + f.slice(1)}">
            </div>
        `).join('');

        showModal(`
            <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400">Nuevo ${title}</h3>
            <div class="space-y-2">
                ${inputs}
            </div>
            <button id="save-item" class="w-full bg-teal-600 py-3 rounded-lg text-white font-bold mt-4 shadow-lg shadow-teal-500/20">Guardar</button>
        `, async (modal) => {
            document.getElementById('save-item').addEventListener('click', async () => {
                const data = {};
                fields.forEach(f => data[f] = document.getElementById(`field-${f}`).value);
                await onAdd(data);
                modal.classList.add('hidden');
                if (window.reloadCurrentSubTab) window.reloadCurrentSubTab();
            });
        });
    });

    const safeTitle = title.replace(/\s/g, '');

    window[`deleteItem_${safeTitle}`] = async (id) => {
        showCustomConfirm('¿Eliminar este elemento?', async () => {
            await onDelete(id);
            if (window.reloadCurrentSubTab) window.reloadCurrentSubTab();
        });
    };

    if (onEdit) {
        window[`editItem_${safeTitle}`] = async (id) => {
            const item = items.find(x => x.id === id);
            if (!item) return;

            const inputs = fields.map(f => `
                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">${f}</label>
                    <input type="text" id="edit-field-${f}" value="${item[f] || ''}" class="${inputClasses}">
                </div>
            `).join('');

            showModal(`
                <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400">Editar ${title}</h3>
                <div class="space-y-2">
                    ${inputs}
                </div>
                <button id="update-item" class="w-full bg-teal-600 py-3 rounded-lg text-white font-bold mt-4 shadow-lg shadow-teal-500/20">Actualizar</button>
            `, async (modal) => {
                document.getElementById('update-item').addEventListener('click', async () => {
                    const data = {};
                    fields.forEach(f => data[f] = document.getElementById(`edit-field-${f}`).value);
                    await onEdit(id, data);
                    modal.classList.add('hidden');
                    // showCustomAlert("Actualizado."); // Removed alert
                    if (window.reloadCurrentSubTab) window.reloadCurrentSubTab();
                });
            });
        };
    }
};

// --- PUBLIC PREACHING TAB ---

const renderPredicacionTab = async (container) => {
    const data = await getPredicacionPublica();
    const publicadores = await getPublicadores();
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const config = await getConfiguracion();

    container.innerHTML = `
                                                <div class="space-y-6">
                                                    <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-black/10 dark:border-white/10 pb-6">
                                                        <div>
                                                            <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-teal-400">Predicación Pública</h2>
                                                            <p class="text-sm text-gray-500 dark:text-gray-400">Gestiona los turnos y asignaciones semanales</p>
                                                        </div>
                                                        <div class="flex items-center gap-4">
                                                            <div id="public-save-status" class="flex items-center gap-2 text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest opacity-0 transition-opacity whitespace-nowrap">
                                                                <span class="animate-pulse">●</span> Guardando...
                                                            </div>
                                                            <div class="flex gap-3">
                                                                <button id="toggle-view-btn" class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-105">
                                                                    <span>📊</span> Vista Matriz
                                                                </button>
                                                                <button id="add-row-btn" class="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/20 transition-all transform hover:scale-105">
                                                                    <span>+</span> Nuevo Turno
                                                                </button>
                                                                <button id="export-pdf" class="flex items-center gap-2 bg-white/5 dark:bg-white/5 hover:bg-white/10 text-gray-700 dark:text-gray-200 px-5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 transition-colors">
                                                                    <span>📄</span> PDF
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </header>

                                                    <div class="morphinglass-card overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl" id="pdf-content">
                                                        <div class="overflow-x-auto">
                                                            <table class="w-full text-left border-collapse">
                                                                <thead>
                                                                    <tr class="bg-gray-100 dark:bg-black/40 dark:bg-gradient-to-r dark:from-teal-900/40 dark:to-black/40 text-teal-800 dark:text-teal-100 uppercase text-xs tracking-wider">
                                                                        <th class="p-4 font-semibold border-b border-black/10 dark:border-white/10">Día</th>
                                                                        <th class="p-4 font-semibold border-b border-black/10 dark:border-white/10 text-center">Horario</th>
                                                                        <th class="p-4 font-semibold border-b border-black/10 dark:border-white/10">Lugar</th>
                                                                        <th class="p-4 font-semibold border-b border-black/10 dark:border-white/10 w-1/5">Publicador</th>
                                                                        <th class="p-4 font-semibold border-b border-black/10 dark:border-white/10 w-1/5">Compañero</th>
                                                                        <th class="p-4 font-semibold border-b border-black/10 dark:border-white/10 text-center w-16 no-print">Acción</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody id="public-table-body" class="divide-y divide-white/5 text-sm text-gray-200">
                                                                    <!-- Rows generated here -->
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        ${!data.asignaciones || data.asignaciones.length === 0 ?
            '<div class="p-8 text-center text-gray-500 italic">No hay turnos registrados. Añade uno nuevo.</div>' : ''}
                                                    </div>

                                                    <datalist id="list-publicadores">
                                                        ${publicadores.map(p => `<option value="${p.nombre}">`).join('')}
                                                    </datalist>
                                                </div>
                                                `;

    const tbody = document.getElementById('public-table-body');

    const renderRows = () => {
        if (!tbody) return;
        tbody.innerHTML = (data.asignaciones || []).map((row, index) => `
                                                <tr class="hover:bg-black/5 dark:bg-white/5 transition-colors group">
                                                    <td class="p-2">
                                                        <select class="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-teal-800 dark:text-teal-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all appearance-none cursor-pointer"
                                                            onchange="updateRow(${index}, 'dia', this.value)">
                                                            <option value="" disabled ${!row.dia ? 'selected' : ''} class="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">Seleccionar</option>
                                                            ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d =>
            `<option value="${d}" ${row.dia === d ? 'selected' : ''} class="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">${d}</option>`
        ).join('')}
                                                        </select>
                                                    </td>
                                                    <td class="p-2">
                                                        <div class="flex items-center gap-1">
                                                            <input type="time" class="w-24 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-2 text-gray-200 focus:outline-none focus:border-teal-500 transition-all font-mono text-center text-xs"
                                                                value="${row.hora || ''}"
                                                                title="Hora Inicio"
                                                                onchange="updateRow(${index}, 'hora', this.value)">
                                                            <span class="text-gray-500">-</span>
                                                            <input type="time" class="w-24 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-2 text-gray-200 focus:outline-none focus:border-teal-500 transition-all font-mono text-center text-xs"
                                                                value="${row.hora_fin || ''}"
                                                                title="Hora Fin"
                                                                onchange="updateRow(${index}, 'hora_fin', this.value)">
                                                        </div>
                                                    </td>
                                                    <td class="p-2">
                                                        <div class="relative w-full h-full group/select">
                                                            <select class="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-teal-800 dark:text-teal-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all appearance-none cursor-pointer"
                                                                onchange="updateRow(${index}, 'lugar', this.value)">
                                                                <option value="" disabled ${!row.lugar ? 'selected' : ''} class="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">Seleccionar Lugar</option>
                                                                ${(config.lugares || []).map(lugar =>
            `<option value="${lugar}" ${row.lugar === lugar ? 'selected' : ''} class="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">${lugar}</option>`
        ).join('')}
                                                                ${row.lugar && !(config.lugares || []).includes(row.lugar) ? `<option value="${row.lugar}" selected class="bg-white text-yellow-600 dark:bg-gray-900 dark:text-yellow-500">${row.lugar} (No listado)</option>` : ''}
                                                            </select>
                                                            <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-teal-500/30 group-hover/select:text-teal-600 dark:text-teal-400 transition-colors text-[10px]">▼</div>
                                                        </div>
                                                    </td>
                                                    <td class="p-2">
                                                        <div class="relative">
                                                            <input list="list-publicadores" type="text"
                                                                class="w-full bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2 text-teal-200 placeholder-teal-500/50 focus:outline-none focus:border-teal-500 focus:bg-teal-500/20 transition-all"
                                                                value="${row.publicador || ''}"
                                                                placeholder="Buscar publicador..."
                                                                onchange="updateRow(${index}, 'publicador', this.value)">
                                                        </div>
                                                    </td>
                                                    <td class="p-2">
                                                        <div class="relative">
                                                            <input list="list-publicadores" type="text"
                                                                class="w-full bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2 text-teal-200 placeholder-teal-500/50 focus:outline-none focus:border-teal-500 focus:bg-teal-500/20 transition-all"
                                                                value="${row.companero || ''}"
                                                                placeholder="Buscar compañero..."
                                                                onchange="updateRow(${index}, 'companero', this.value)">
                                                        </div>
                                                    </td>
                                                    <td class="p-2 text-center no-print">
                                                        <button class="bg-red-500/10 hover:bg-red-500/30 text-red-400 p-2 rounded-lg transition-all transform hover:scale-110"
                                                            onclick="deletePublicRow(${index})" title="Eliminar Turno">
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                                `).join('');
    };
    renderRows();

    window.deletePublicRow = async (index) => {
        showCustomConfirm("¿Eliminar este turno de predicación?", async () => {
            data.asignaciones.splice(index, 1);
            await savePredicacionPublica(data);
            renderRows();
            showCustomAlert("Turno eliminado");
        });
    };

    document.getElementById('add-row-btn').addEventListener('click', async () => {
        data.asignaciones = data.asignaciones || [];
        // CREAR EN BLANCO SEGUN SOLICITUD DEL USUARIO
        data.asignaciones.push({ dia: '', hora: '', hora_fin: '', lugar: '', publicador: '', companero: '' });
        await savePredicacionPublica(data);
        renderRows(); // Re-render to show new row
        // Scroll to bottom
        setTimeout(() => {
            const tableContainer = document.querySelector('.overflow-x-auto');
            if (tableContainer) tableContainer.scrollTop = tableContainer.scrollHeight;
        }, 100);
    });

    window.updateRow = async (index, field, value) => {
        const status = document.getElementById('public-save-status');
        if (status) status.style.opacity = '1';

        data.asignaciones[index][field] = value;
        try {
            await savePredicacionPublica(data);
        } catch (e) {
            console.error(e);
            showNotification("Error al autoguardar", "error");
        } finally {
            if (status) {
                setTimeout(() => {
                    status.style.opacity = '0';
                }, 1000);
            }
        }
    };

    // PDF Export Logic
    document.getElementById('export-pdf').addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Temporarily style for print
        const content = document.getElementById('pdf-content');

        // Use html2canvas
        html2canvas(content, {
            scale: 2,
            backgroundColor: '#ffffff', // White background for PDF
            ignoreElements: (element) => element.classList.contains('no-print')
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            doc.save('predicacion_publica.pdf');
        });
    });

    const renderMatrix = () => {
        const matrixContainer = document.getElementById('pdf-content');
        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const byDay = {};
        dias.forEach(d => byDay[d] = (data.asignaciones || []).filter(a => a.dia === d && (a.hora || a.lugar || a.publicador)).sort((a, b) => (a.hora || '').localeCompare(b.hora || '')));

        matrixContainer.innerHTML = `
            <div class="p-6 grid grid-cols-1 md:grid-cols-7 gap-4 bg-gray-50 dark:bg-black/20 overflow-x-auto min-h-[400px]">
                ${dias.map(dia => `
                    <div class="flex flex-col gap-3 min-w-[120px]">
                        <div class="p-3 bg-teal-600 text-white text-center font-bold rounded-xl shadow-md text-xs uppercase tracking-wider">${dia}</div>
                        <div class="flex flex-col gap-2">
                            ${byDay[dia].length > 0 ? byDay[dia].map(row => {
            const originalIdx = (data.asignaciones || []).indexOf(row);
            return `
                                    <div class="p-3 bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl shadow-sm group relative hover:border-teal-500/50 transition-all">
                                        <div class="text-[10px] font-bold text-teal-600 dark:text-teal-400 mb-1">${row.hora || '??:??'} - ${row.hora_fin || '??:??'}</div>
                                        <div class="text-[11px] font-bold text-gray-800 dark:text-gray-100 truncate mb-2 leading-tight">${row.lugar || 'Sin lugar'}</div>
                                        <div class="space-y-1">
                                             <div class="text-[10px] text-gray-500 flex items-center gap-1 truncate" title="${row.publicador || '-'}">👤 ${row.publicador || '-'}</div>
                                             <div class="text-[10px] text-gray-400 flex items-center gap-1 truncate" title="${row.companero || '-'}">👥 ${row.companero || '-'}</div>
                                        </div>
                                        <button class="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-lg" 
                                            onclick="if(ensureOnline()) deletePublicRow(${originalIdx})">✕</button>
                                    </div>
                                `;
        }).join('') : '<div class="text-[10px] text-gray-400 text-center py-8 italic border border-dashed border-gray-300 dark:border-white/10 rounded-xl">Libre</div>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    let currentView = 'table';
    const originalTableContent = document.getElementById('pdf-content').innerHTML;

    document.getElementById('toggle-view-btn')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        if (currentView === 'table') {
            currentView = 'matrix';
            btn.innerHTML = '<span>📋</span> Vista Tabla';
            renderMatrix();
        } else {
            currentView = 'table';
            btn.innerHTML = '<span>📊</span> Vista Matriz';
            document.getElementById('pdf-content').innerHTML = originalTableContent;
            renderRows(); // Restore table data
        }
    });
};

// --- UTILS ---

const showModal = (content, onOpen, maxWidth = 'max-w-md') => {
    const modalContainer = document.getElementById('modal-container');

    const handleEsc = (e) => {
        if (e.key === 'Escape') closeModal();
    };

    const closeModal = () => {
        modalContainer.classList.add('hidden');
        modalContainer.innerHTML = '';
        window.removeEventListener('keydown', handleEsc);
    };

    modalContainer.innerHTML = `
        <div class="w-full ${maxWidth} relative animate-fade-in bg-white dark:bg-[#0a0a0a] flex flex-col rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] max-h-[95vh] border border-gray-100 dark:border-white/10 overflow-hidden m-2 sm:m-4">
            <button class="absolute top-4 right-4 text-white/50 hover:text-white z-[60] p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-all border border-white/5 group shadow-lg" 
                    id="modal-close-btn">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                ${content}
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');

    const closeBtn = modalContainer.querySelector('#modal-close-btn');
    if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closeModal(); };

    modalContainer.onclick = (e) => { if (e.target === modalContainer) closeModal(); };

    window.addEventListener('keydown', handleEsc);

    if (onOpen) onOpen(modalContainer);
};

// showCustomAlert and showCustomConfirm were moved to top level
const renderProgramaTab = async (container) => {
    // FORCE Current Week Only as per user request
    const today = new Date();
    let currentWeekStart = getMonday(today);
    let programa = { dias: [] };

    const saveCurrentWeek = async () => {
        const weekId = formatDateId(currentWeekStart);
        await saveProgramaSemanal(weekId, programa);
    };

    // Helper for Auto-Save with automatic territory assignment
    const autoSave = async (dayIdx, turnId, field) => {
        const statusIndicator = document.getElementById('save-status');
        if (statusIndicator) statusIndicator.style.opacity = '1';

        try {
            const weekId = formatDateId(currentWeekStart);
            if (!weekId) throw new Error("Invalid weekId");

            await saveCurrentWeek();

            // Check if we need to auto-assign territory
            // ONLY for present or future weeks (to avoid overwriting current status with past data)
            const thisWeekStart = getMonday(new Date());
            const isPast = currentWeekStart.getTime() < thisWeekStart.getTime();

            if (!isPast) {
                const tData = programa.dias[dayIdx][turnId];

                // CASE 1: Data exists -> SYNC / ASSIGN
                if (tData && tData.territorio && tData.conductor) {
                    const extra = {
                        auxiliar: tData.auxiliar || '',
                        lugar: tData.lugar || '',
                        hora: tData.hora || '',
                        turno: turnId,
                        faceta: tData.faceta || '',
                        grupos: tData.grupos || '',
                        fecha_asignacion: new Date(currentWeekStart).toISOString()
                    };

                    const parts = tData.territorio.split(',').map(s => s.trim());
                    for (const part of parts) {
                        const match = part.match(/^(\d+)(?:\s*\((.*)\))?$/);
                        if (match) {
                            const num = match[1];
                            const manzanasStr = match[2];
                            const conductor = tData.conductor;

                            const candidates = territorios.filter(terr => terr.numero == num);
                            let targetId = null;
                            let manzanasToAssign = [];

                            if (manzanasStr) {
                                manzanasToAssign = manzanasStr.split(',').map(m => m.trim());
                                const perfectMatch = candidates.find(c => {
                                    if (!c.manzanas) return false;
                                    const cManzanas = c.manzanas.split(',').map(s => s.trim());
                                    return manzanasToAssign.every(m => cManzanas.includes(m));
                                });
                                if (perfectMatch) targetId = perfectMatch.id;
                            } else if (candidates.length > 0) {
                                targetId = candidates[0].id;
                            }

                            if (targetId) {
                                if (manzanasToAssign.length > 0) {
                                    await assignTerritorioParcial(targetId, manzanasToAssign, conductor, extra);
                                } else {
                                    await assignTerritorio(targetId, conductor, extra);
                                }
                            }
                        }
                    }
                }
                // CASE 2: Conductor or Territory cleared -> UNASSIGN?
                // If we are in 'conductor' field and it's empty, we might want to free the territory that was there.
                else if (field === 'conductor' && (!tData.conductor || tData.conductor === '')) {
                    const parts = (tData.territorio || '').split(',').map(s => s.trim());
                    for (const part of parts) {
                        const num = part.split('(')[0].trim();
                        const target = territorios.find(t => t.numero == num && t.estado === 'Asignado');
                        if (target) {
                            await cancelarAsignacion(target.id);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Auto-save failed:", err);
            // Non-intrusive notification for auto-save errors
            showNotification("⚠️ Error guardando cambios: " + err.message, "error");
        } finally {
            if (statusIndicator) {
                setTimeout(() => {
                    statusIndicator.style.opacity = '0';
                }, 1000);
            }
        }
    };

    // 1. Fetch Metadata Once
    const territoriesPromise = getTerritorios();
    const configPromise = getConfiguracion();
    const conductorsPromise = getConductores();
    const publishersPromise = getPublicadores();

    const [territorios, config, conductores, publicadores] = await Promise.all([
        territoriesPromise, configPromise, conductorsPromise, publishersPromise
    ]);

    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];


    // Sort lists
    territorios.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));
    conductores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // SYNC GLOBALS for Compatibility
    _globalTerritorios = territorios;
    _globalPrograma = programa;


    // Options Configuration
    const options = {
        Lugar: config.lugares || [],
        Hora: config.horarios_programa && config.horarios_programa.length > 0 ? config.horarios_programa : ['09:00', '15:00', '19:00'],
        Conductor: conductores.map(c => c.nombre),
        Auxiliar: conductores.map(c => c.nombre),
        Faceta: config.facetas || ['Casa en casa', 'Carritos'],
        Territorio: territorios.map(t => t.numero),
        Grupos: ['Todos', 'Grupos 1 y 5', 'Grupos 2 y 6', 'Grupos 3 y 4', ...Array.from({ length: 12 }, (_, i) => `Grupo ${i + 1}`)]
    };

    // 2. Setup Container Structure        // Initial Controls
    const controlsHtml = `
            <div class="flex items-center justify-between mb-6 bg-white dark:bg-[#0f1115] p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm transition-colors">
                 <div>
                    <h2 class="text-2xl font-bold text-teal-700 dark:text-teal-400 flex items-center gap-3">
                        <span class="p-2 bg-teal-50 dark:bg-teal-500/10 rounded-lg border border-teal-100 dark:border-teal-500/20 text-xl">📅</span> 
                        Programa Semanal
                    </h2>
                    <p class="text-gray-500 dark:text-gray-400 text-xs mt-1 ml-14">Organiza las salidas de servicio de la semana</p>
                </div>
                
                <div class="flex items-center gap-4">
                        <div class="flex flex-wrap items-center gap-2">
                             <button id="prev-week" class="p-2.5 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl hover:bg-teal-500/10 transition-all text-gray-500 hover:text-teal-600 shadow-sm">⬅️</button>
                             <div class="bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm shadow-black/5">
                                 <span class="text-xs font-black text-gray-400 uppercase tracking-widest hidden sm:inline">Semana</span>
                                 <span id="week-range-label" class="text-sm font-black text-teal-600 dark:text-teal-400 min-w-[120px] text-center tracking-tighter">Cargando...</span>
                             </div>
                             <button id="next-week" class="p-2.5 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl hover:bg-teal-500/10 transition-all text-gray-500 hover:text-teal-600 shadow-sm">➡️</button>
                             <button id="btn-reset-today" class="px-4 py-2.5 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-teal-600 transition-all shadow-sm">Hoy</button>
                        </div>

                        <div class="flex flex-wrap items-center justify-end gap-2 pl-0 sm:pl-4 border-l-0 sm:border-l border-gray-200 dark:border-white/10 w-full sm:w-auto">
                            <button id="btn-copy-prev" class="flex items-center gap-2 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 p-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-teal-600 transition-all shadow-sm" title="Copiar de la semana anterior">
                                📋 Copiar Anterior
                            </button>
                            <button id="btn-clear-week" class="flex items-center gap-2 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 p-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-all shadow-sm" title="Limpiar semana">
                                🗑️ Limpiar
                            </button>
                            <div class="h-6 w-px bg-gray-200 dark:bg-white/10 mx-1"></div>
                            <button id="export-excel-plain" class="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-black py-2.5 px-4 rounded-xl shadow-lg hover:shadow-green-500/30 transition-all active:scale-95 border border-green-400/20 group uppercase tracking-widest text-[10px]">
                                <span class="group-hover:translate-y-0.5 transition-transform text-sm">📊</span> Excel Plano
                            </button>
                            <button id="export-png" class="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 px-4 rounded-xl shadow-lg hover:shadow-purple-500/30 transition-all active:scale-95 border border-purple-400/20 group uppercase tracking-widest text-[10px]">
                                <span class="group-hover:rotate-12 transition-transform text-sm">📷</span> Imagen
                            </button>
                            
                            <div id="save-status" class="flex items-center gap-2 text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest opacity-0 transition-opacity whitespace-nowrap">
                                <span class="animate-pulse">●</span> Guardando...
                            </div>
                        </div>
                    </div>
            </div>
        `;
    container.innerHTML = `
        ${controlsHtml}
        <div class="space-y-1 relative">
            <div id="prog-loading-overlay" class="absolute inset-0 bg-white/50 dark:bg-black/60 z-50 backdrop-blur-sm flex items-center justify-center hidden rounded-xl">
                 <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
            </div>
            <div class="relative w-full" id="admin-prog-table">
                <!-- Table will be injected here -->
            </div>
            <p class="text-[10px] text-gray-500 text-right px-2">* Los cambios se guardan por semana específica.</p>
        </div>
    `;

    const tableContainer = document.getElementById('admin-prog-table');
    const loadingOverlay = document.getElementById('prog-loading-overlay');
    const rangeLabel = document.getElementById('week-range-label');
    const btnResetToday = document.getElementById('btn-reset-today');

    // Load Logic
    const loadWeekData = async () => {
        const overlay = container.querySelector('#prog-loading-overlay');
        const range = container.querySelector('#range-label');
        if (overlay) overlay.classList.remove('hidden');

        try {
            window._currentWeekStartGlobal = currentWeekStart; // Set global for auto-save
            const weekId = formatDateId(currentWeekStart);
            const data = await getProgramaSemanal(weekId);

            if (data && data.dias && data.dias.length > 0) {
                programa = data;
            } else {
                programa = {
                    id: weekId,
                    dias: dayNames.map(name => ({
                        nombre: name,
                        manana: {}, tarde: {}, noche: {}, zoom: {}
                    }))
                };
            }
            _globalPrograma = programa;

            // Format Label Header
            const monday = currentWeekStart;
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            const rangeText = `${monday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - ${sunday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`;

            const lblRange = container.querySelector('#week-range-label');
            if (lblRange) lblRange.innerText = rangeText;

            renderTable();
        } catch (error) {
            console.error(error);
            showNotification("Error cargando programa", "error");
        } finally {
            if (overlay) overlay.classList.add('hidden');
        }
    };


    // 3. Render Logic Function
    const renderTable = () => {
        const turnos = [
            {
                id: 'manana',
                label: config.jornadas?.manana || '🌅 MAÑANA',
                headerColor: 'bg-gradient-to-r from-cyan-100 to-cyan-200 dark:from-cyan-950/80 dark:to-cyan-900/80 text-cyan-800 dark:text-cyan-200 border-l-4 border-cyan-500',
                rowColor: 'bg-gradient-to-r from-cyan-50 to-transparent dark:from-cyan-900/5 dark:to-transparent',
                accent: 'text-cyan-600 dark:text-cyan-400',
                fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio']
            },
            {
                id: 'tarde',
                label: config.jornadas?.tarde || '☀️ TARDE',
                headerColor: 'bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-950/80 dark:to-orange-900/80 text-orange-800 dark:text-orange-200 border-l-4 border-orange-500',
                rowColor: 'bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-900/5 dark:to-transparent',
                accent: 'text-orange-600 dark:text-orange-400',
                fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio']
            },
            {
                id: 'noche',
                label: config.jornadas?.noche || '🌙 NOCHE',
                headerColor: 'bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-950/80 dark:to-blue-900/80 text-blue-800 dark:text-blue-200 border-l-4 border-blue-500',
                rowColor: 'bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/5 dark:to-transparent',
                accent: 'text-blue-600 dark:text-blue-400',
                fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio']
            },
            {
                id: 'zoom',
                label: '📹 ZOOM',
                headerColor: 'bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-950/80 dark:to-purple-900/80 text-purple-800 dark:text-purple-200 border-l-4 border-purple-500',
                rowColor: 'bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-900/5 dark:to-transparent',
                accent: 'text-purple-600 dark:text-purple-400',
                fields: ['Lugar', 'Hora', 'Conductor', 'Faceta']
            }
        ];

        // Grid Layout: 3 Columns of cards (Morning, Afternoon, Night/Zoom mixed or stacked)
        // Or grouped by Day? Users usually plan by Turn across the week, or by Day?
        // Let's trying grouping by TURN across the week, but using Cards instead of a big table.
        // Actually, the user asked for "more stylized and ordered".
        // A clean vertical list of days, where each day has the 3 turns clearly separated?

        // Let's try: A tabular view but with much cleaner UI. 
        // Rows = Days. Cols = Turns.  (Standard Calendar View)
        // Previous view was Rows = Fields, Cols = Days. That was "transposed" and maybe confusing.
        // Let's Pivot: Rows = Days (Lunes...Domingo). Columns = Mañana, Tarde, Noche.

        // Grid Layout: Rows = Days, Columns = Turns.
        // Modern, cleaner, light-friendly design.

        let html = `
            <div class="overflow-hidden rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1115] relative transition-colors duration-500">
                <div class="overflow-x-auto relative z-10 custom-scrollbar">
                    <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                            <th class="p-4 sticky left-0 bg-gray-50 dark:bg-[#12141a] z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-gray-200 dark:border-white/5 w-24 text-center">
                                Día
                            </th>
                            <th class="p-4 min-w-[200px] text-center border-l border-gray-200 dark:border-white/5">
                                <span class="bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 px-3 py-1 rounded-full border border-cyan-200 dark:border-cyan-800/30 flex items-center justify-center gap-2 mx-auto w-fit">
                                    🌅 Mañana
                                </span>
                            </th>
                            <th class="p-4 min-w-[200px] text-center border-l border-gray-200 dark:border-white/5">
                                <span class="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-3 py-1 rounded-full border border-orange-200 dark:border-orange-800/30 flex items-center justify-center gap-2 mx-auto w-fit">
                                    ☀️ Tarde
                                </span>
                            </th>
                            <th class="p-4 min-w-[200px] text-center border-l border-gray-200 dark:border-white/5">
                                <span class="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800/30 flex items-center justify-center gap-2 mx-auto w-fit">
                                    🌙 Noche
                                </span>
                            </th>
                            <th class="p-4 min-w-[200px] text-center border-l border-gray-200 dark:border-white/5">
                                <span class="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/30 flex items-center justify-center gap-2 mx-auto w-fit">
                                    📹 Zoom
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
        `;

        programa.dias.forEach((dia, dayIndex) => {
            // Determine active/inactive turns for styling
            html += `<tr class="group/row hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                <!-- Day Column -->
                <td class="p-4 font-bold text-gray-700 dark:text-gray-200 sticky left-0 bg-white dark:bg-[#0f1115] z-10 border-r border-gray-200 dark:border-white/5 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover/row:bg-gray-50 dark:group-hover/row:bg-[#15181e] transition-colors text-center align-middle">
                    <div class="flex flex-col items-center justify-center">
                        <span class="text-xs text-gray-400 uppercase tracking-widest font-medium mb-1">${dia.nombre}</span>
                        <span class="text-xl font-black text-teal-600 dark:text-teal-400">${dia.nombre.substring(0, 3)}</span>
                    </div>
                </td>`;

            // Turns Columns
            ['manana', 'tarde', 'noche', 'zoom'].forEach(turnoId => {
                const turnoConfig = turnos.find(t => t.id === turnoId) || {};

                // Zoom Logic (Only Tuesday)
                if (turnoId === 'zoom' && dia.nombre !== 'Martes') {
                    html += `<td class="p-3 border-l border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.01]"></td>`;
                    return;
                }

                if (!dia[turnoId]) dia[turnoId] = {};
                const data = dia[turnoId];
                const accent = turnoConfig.accent ? turnoConfig.accent.split('-')[1] : 'teal'; // extract color name roughly

                // Determine border color based on shift
                const hoverBorder =
                    turnoId === 'manana' ? 'group-hover/cell:border-cyan-300 dark:group-hover/cell:border-cyan-700' :
                        turnoId === 'tarde' ? 'group-hover/cell:border-orange-300 dark:group-hover/cell:border-orange-700' :
                            turnoId === 'noche' ? 'group-hover/cell:border-indigo-300 dark:group-hover/cell:border-indigo-700' :
                                'group-hover/cell:border-emerald-300 dark:group-hover/cell:border-emerald-700';

                html += `<td class="p-3 border-l border-gray-100 dark:border-white/5 align-top group/cell transition-colors relative">
                    <!-- Sync Indicator -->
                    <div class="absolute top-2 right-2 z-20">
                        ${(() => {
                        if (!data.territorio) return '';
                        const t = territorios.find(x => x.numero === data.territorio);
                        if (!t) return `<span title="Territorio no existe" class="cursor-help grayscale">❓</span>`;

                        const isSynced = t.asignado_a === data.conductor &&
                            (!data.auxiliar || t.auxiliar === data.auxiliar);

                        if (isSynced && t.estado === 'Asignado') {
                            return `<span title="Sincronizado" class="text-[10px] filter drop-shadow-sm opacity-60 group-hover/cell:opacity-100 transition-opacity">✅</span>`;
                        } else if (t.asignado_a === data.conductor || t.estado === 'Asignado') {
                            return `<span title="Desincronizado o Parcial" class="text-[10px] filter drop-shadow-sm animate-pulse">⚠️</span>`;
                        } else {
                            return `<span title="No asignado en base de datos" class="text-[10px] filter drop-shadow-sm">❌</span>`;
                        }
                    })()}
                    </div>
                    <div class="flex flex-col gap-2.5 h-full relative z-10">
                `;

                // Render fields
                turnoConfig.fields.forEach(field => {
                    const fieldId = field.toLowerCase();
                    const val = data[fieldId] || '';
                    const icon = getFieldIcon(field);
                    let inputHtml = '';

                    const opts = options[field] || [];

                    if (field === 'Territorio') {
                        inputHtml = `
                            <button onclick="window.openTerritorySelector(${dayIndex}, '${turnoId}', this)" 
                                    data-current="${val.replace(/"/g, '&quot;')}"
                                    class="w-full text-left text-xs bg-white dark:bg-black/20 text-gray-700 dark:text-gray-300 py-2 px-3 rounded-lg border border-black/10 dark:border-white/10 hover:border-teal-500/50 transition-all flex items-center justify-between group/btn shadow-sm">
                                <span class="truncate font-mono ${val ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-gray-400 italic'}">${val || 'Asignar'}</span>
                                <span class="text-teal-500 transition-transform group-hover/btn:scale-125">📍</span>
                            </button>`;
                    } else if (field === 'Grupos') {
                        inputHtml = `
                            <button onclick="window.openGroupSelector(${dayIndex}, '${turnoId}', this)" 
                                    data-current="${val.replace(/"/g, '&quot;')}"
                                    class="w-full text-left text-xs bg-white dark:bg-black/20 text-gray-700 dark:text-gray-300 py-2 px-3 rounded-lg border border-black/10 dark:border-white/10 hover:border-teal-500/50 transition-all flex items-center justify-between group/btn shadow-sm">
                                <span class="truncate ${val ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-400 italic'}">${val || 'Seleccionar'}</span>
                                <span class="text-indigo-400 transition-transform group-hover/btn:scale-125">👥</span>
                            </button>`;
                    } else if (opts.length > 0) {
                        inputHtml = `
                            <div class="relative group/select">
                                <select onchange="updateWeekData(${dayIndex}, '${turnoId}', '${fieldId}', this.value)" 
                                        class="w-full bg-white dark:bg-black/20 text-gray-700 dark:text-gray-300 text-xs border border-black/10 dark:border-white/10 rounded-lg p-2 pr-8 outline-none focus:border-teal-500 appearance-none transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                                    <option value="">${field}...</option>
                                    ${opts.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
                                </select>
                                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[10px] group-hover/select:text-teal-600 transition-colors">▼</span>
                            </div>`;
                    } else {
                        inputHtml = `<input type="text" 
                                       value="${val}" 
                                       onchange="updateWeekData(${dayIndex}, '${turnoId}', '${fieldId}', this.value)"
                                       placeholder="${field}..."
                                       class="w-full bg-transparent border-b border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 text-xs p-1 outline-none focus:border-teal-500 placeholder-gray-400 transition-colors">`;
                    }

                    // Field Row
                    html += `
                        <div class="flex items-center gap-2 group/field">
                            <span class="text-xs w-5 text-center opacity-60 grayscale group-hover/field:grayscale-0 transition-all" title="${field}">${icon}</span>
                            <div class="flex-1 min-w-0">
                                ${inputHtml}
                            </div>
                        </div>`;
                });

                html += `</div></td>`;
            });
            html += `</tr>`;
        });

        html += `</tbody></table></div></div>`;

        // Responsive Cards (Mobile Only)
        // Hidden by default, shown via CSS media queries or we can just rely on the horizontal scroll above with "responsive-table-container". 
        // Given the requirement "no cards overflow", horizontal scroll is safer for complex tables.

        tableContainer.innerHTML = html;
        // attachTableEvents(); // Re-attach strict events if needed (Removed: undefined)
    };

    // --- Helper for Icons (Fixes the Bug) ---
    const getFieldIcon = (field) => {
        const map = {
            'Lugar': '📍',
            'Hora': '⏰',
            'Conductor': '👔',
            'Auxiliar': '👤',
            'Faceta': '🏷️',
            'Grupos': '👥',
            'Territorio': '🗺️'
        };
        return map[field] || '🔹';
    };

    // --- Controls Events ---
    // (Existing event listeners logic matches variable names defined above)
    container.querySelector('#prev-week').onclick = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() - 7);
        currentWeekStart = d;
        loadWeekData();
    };

    container.querySelector('#next-week').onclick = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + 7);
        currentWeekStart = d;
        loadWeekData();
    };

    if (btnResetToday) btnResetToday.onclick = () => {
        currentWeekStart = getMonday(new Date());
        loadWeekData();
    };

    // Copy Previous
    container.querySelector('#btn-copy-prev').onclick = async () => {
        showCustomConfirm("¿Copiar toda la programación de la semana pasada a esta?", async () => {
            const prevDate = new Date(currentWeekStart);
            prevDate.setDate(prevDate.getDate() - 7);
            const prevId = formatDateId(prevDate);

            try {
                const prevData = await getProgramaSemanal(prevId);
                if (prevData && prevData.dias) {
                    // Deep copy to avoid ref issues
                    const newDays = JSON.parse(JSON.stringify(prevData.dias));
                    programa.dias = newDays;
                    _globalPrograma = programa;
                    renderTable();
                    await saveProgramaSemanal(programa.id, programa); // Auto-save
                    showNotification("Programación copiada exitosamente");
                } else {
                    showNotification("No hay datos en la semana anterior", "warning");
                }
            } catch (e) {
                console.error(e);
                showNotification("Error copiando semana", "error");
            }
        });
    };

    // Clear Week
    container.querySelector('#btn-clear-week').onclick = () => {
        showCustomConfirm("¿Borrar toda la programación de esta semana? Esta acción no se puede deshacer.", async () => {
            try {
                await deleteProgramaSemanal(programa.id);
                // Reset local state
                programa.dias = dayNames.map(name => ({
                    nombre: name,
                    manana: {}, tarde: {}, noche: {}, zoom: {}
                }));
                _globalPrograma = programa;
                renderTable();
                showNotification("Semana limpiada exitosamente");
            } catch (e) {
                showNotification("Error limpiando semana", "error");
            }
        });
    };

    // Export Excel
    container.querySelector('#export-excel-plain').onclick = () => {
        generatePlainXLS(programa, `Programa_${formatDateId(currentWeekStart)}`);
    };

    // Export Image -> Use canvas or html2canvas
    container.querySelector('#export-png').onclick = async () => {
        // Simple alert for now as html2canvas might not be imported.
        // Assuming user has it or we use window.print logic.
        // For SaaS feel, we can use a dedicated library or just print style.
        window.print();
        // showNotification("Función de imagen en desarrollo. Use 'Imprimir' del navegador por ahora.");
    };

    // Initialize
    loadWeekData();
};

window.updateWeekData = (dayIndex, turnoId, field, value) => {
    if (!_globalPrograma) return;
    if (!_globalPrograma.dias[dayIndex][turnoId]) _globalPrograma.dias[dayIndex][turnoId] = {};

    _globalPrograma.dias[dayIndex][turnoId][field] = value;

    // Debounced Save
    clearTimeout(window._saveTimer);
    const saveStatus = document.getElementById('save-status');
    if (saveStatus) saveStatus.style.opacity = '1';

    window._saveTimer = setTimeout(async () => {
        try {
            // Re-fetch ID just in case
            _globalPrograma.id = formatDateId(window._currentWeekStartGlobal || new Date());
            // We need to access the variable 'currentWeekStart' from closure. 
            // Since this is global, let's trust the ID in _globalPrograma object or pass it.
            // Actually, best to expose a 'saveCurrentWeek' inside the closure.

            // Workaround: Call the internal saver if accessible, or just save directly.
            await saveProgramaSemanal(_globalPrograma);
            if (saveStatus) {
                saveStatus.innerHTML = '✅ Guardado';
                setTimeout(() => { saveStatus.style.opacity = '0'; setTimeout(() => saveStatus.innerHTML = '<span class="animate-pulse">●</span> Guardando...', 500); }, 2000);
            }
        } catch (e) {
            console.error(e);
            if (saveStatus) saveStatus.innerHTML = '❌ Error';
        }
    }, 1000);
};


/* --- ADVANCED HISTORY VIEW --- */
export const renderAdvancedHistoryView = async (container) => {
    container.innerHTML = `
        <div class="space-y-6 animate-fade-in">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                <div>
                    <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <span>🛠️</span> Historial y Gestión Avanzada
                    </h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Visualiza, corrige o elimina registros históricos de asignaciones.
                    </p>
                </div>
                <div class="flex gap-2 w-full md:w-auto">
                    <input type="text" id="hist-search" placeholder="🔍 Buscar conductor, numero..." class="bg-gray-100 dark:bg-black/20 border-none rounded-xl px-4 py-2 text-sm w-full md:w-64 focus:ring-2 ring-teal-500/50 outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400">
                </div>
            </header>

            <div class="bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden shadow-sm min-h-[400px]" id="hist-table-container">
                <div class="p-10 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
                    <span class="text-2xl animate-bounce">⏳</span>
                    Cargando historial completo...
                </div>
            </div>
        </div>
    `;

    try {
        const [history, territorios] = await Promise.all([
            getHistorialReport(),
            getTerritorios()
        ]);

        // Sort by Date Descending
        let filtered = [...history].sort((a, b) => {
            const tA = a.timestamp ? a.timestamp.toDate() : new Date(a.fecha_asignacion);
            const tB = b.timestamp ? b.timestamp.toDate() : new Date(b.fecha_asignacion);
            return tB - tA;
        });

        const render = () => {
            const searchVal = document.getElementById("hist-search").value.toLowerCase();
            const list = filtered.filter(h =>
                (h.conductor || "").toLowerCase().includes(searchVal) ||
                (String(h.numero) || "").toLowerCase().includes(searchVal) ||
                (h.estado || "").toLowerCase().includes(searchVal)
            ).slice(0, 50); // Pagination/Limit

            if (list.length === 0) {
                document.getElementById("hist-table-container").innerHTML = `
                    <div class="p-10 text-center text-gray-400 text-sm">
                        No se encontraron registros.
                    </div>
                 `;
                return;
            }

            let html = `
                <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-sm text-left align-middle">
                    <thead class="bg-gray-50 dark:bg-black/20 text-[10px] uppercase font-bold text-gray-400 border-b border-gray-100 dark:border-white/5">
                        <tr>
                            <th class="px-6 py-4 whitespace-nowrap">Fecha Evento</th>
                            <th class="px-6 py-4 whitespace-nowrap">Territorio</th>
                            <th class="px-6 py-4 whitespace-nowrap">Conductor</th>
                            <th class="px-6 py-4 whitespace-nowrap text-center">Estado</th>
                            <th class="px-6 py-4 whitespace-nowrap text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                        ${list.map(h => {
                const dVal = h.fecha_asignacion || h.timestamp?.toDate();
                const dateStr = dVal ? new Date(dVal).toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" }) : "-";

                const statusColor = h.estado === "Asignado" ? "text-teal-600 bg-teal-50 dark:bg-teal-500/10 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20" :
                    h.estado === "Completado" || h.estado === "Predicado" ? "text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20" :
                        h.estado === "Devuelto" ? "text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20" :
                            "text-gray-500 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10";

                return `
                                <tr class="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                    <td class="px-6 py-4 text-gray-600 dark:text-gray-300 font-mono text-xs whitespace-nowrap">${dateStr}</td>
                                    <td class="px-6 py-4 font-bold text-gray-800 dark:text-white text-base">
                                        <div class="flex items-center gap-2">
                                            <span class="p-1.5 bg-gray-100 dark:bg-white/10 rounded text-xs">🗺️</span>
                                            ${h.numero}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-gray-600 dark:text-gray-300">
                                        <div class="flex flex-col">
                                            <span class="font-medium">${h.conductor}</span>
                                            ${h.auxiliar ? `<span class="text-[10px] text-gray-400 flex items-center gap-1">👤 ${h.auxiliar}</span>` : ""}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-center">
                                        <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColor}">${h.estado}</span>
                                    </td>
                                    <td class="px-6 py-4 text-right">
                                        <div class="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button onclick="window.editHistoryRecord('${h.id}')" class="p-2 hover:bg-teal-50 dark:hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded-lg transition" title="Editar Registro">
                                                ✏️
                                            </button>
                                            <button onclick="window.deleteHistoryRecordUI('${h.id}', '${h.conductor}', '${h.numero}')" class="p-2 hover:bg-red-50 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition" title="Eliminar Definitivamente">
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
            }).join("")}
                    </tbody>
                </table>
                </div>
                <div class="p-4 bg-gray-50 dark:bg-black/20 text-center text-[10px] text-gray-400 border-t border-gray-100 dark:border-white/5 uppercase tracking-widest">
                    Mostrando últimos ${list.length} registros
                </div>
             `;
            const tableCont = document.getElementById("hist-table-container");
            if (tableCont) tableCont.innerHTML = html;
        };

        const searchEl = document.getElementById("hist-search");
        if (searchEl) searchEl.addEventListener("input", render);

        render(); // Initial Render


    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="p-8 text-center text-red-500 border border-red-200 bg-red-50 rounded-xl">Error cargando historial: ${e.message}</div>`;
    }
};

