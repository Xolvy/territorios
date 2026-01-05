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
    getGroupsConfig, saveGroupsConfig
} from '../data/firestore-services.js?v=2.5.5';
import { formatPhoneNumber, getStatusColor, showNotification, formatMapUrl, ensureOnline, generatePlainXLS } from './utils/helpers.js?v=2.5.5';
import { TerritoryIntelligence } from './utils/intelligence.js?v=2.5.5';
import { renderHistoryTab } from './report-s13.js?v=2.5.5';
import { renderAnalyticsView } from './analytics-view.js?v=2.5.5';
import { getGlobalSettings, saveGlobalSettings } from '../data/firestore-services.js?v=2.5.5';
import { auth } from '/firebase-config.js?v=2.5.5';

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
        <div class="text-center space-y-4">
            <div class="text-4xl">❓</div>
            <h3 class="text-lg font-bold text-gray-800 dark:text-white">${message}</h3>
            <div class="flex gap-3 justify-center mt-6">
                <button id="confirm-cancel" class="px-6 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 font-bold hover:bg-gray-200 transition-all">Cancelar</button>
                <button id="confirm-ok" class="px-6 py-2 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-500 shadow-lg shadow-teal-500/20 transition-all">Aceptar</button>
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
        <div class="space-y-4">
            <h3 class="text-lg font-bold text-gray-800 dark:text-white">${message}</h3>
            <input type="text" id="prompt-input" value="${defaultValue || ''}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white outline-none focus:border-teal-500 shadow-sm">
            <div class="flex gap-3 justify-end mt-6">
                <button id="prompt-cancel" class="px-6 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 font-bold hover:bg-gray-200 transition-all">Cancelar</button>
                <button id="prompt-ok" class="px-6 py-2 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-500 shadow-lg shadow-teal-500/20 transition-all">Aceptar</button>
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
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(start.getDate() + 6);
    const f = (d) => {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${d.getDate()} ${months[d.getMonth()]}`;
    };
    return `${f(start)} - ${f(end)}, ${start.getFullYear()}`;
};

// Ensure functions exist immediately upon module load
window.openTerritorySelector = (dayIndex, turnId, btnElement) => {
    console.log("Global openTerritorySelector called", dayIndex, turnId);
    console.log("Global territories count:", _globalTerritorios.length);
    console.log("Global programa:", _globalPrograma);

    if (!btnElement || !_globalPrograma) {
        console.warn("Global state not ready or invalid args");

        showNotification("⚠️ Estado no listo. Por favor espere a que cargue la página completa.", "warning");
        return;
    }

    if (_globalTerritorios.length === 0) {
        console.warn("No territories loaded");

        showNotification("⚠️ No hay territorios configurados. Por favor agregue territorios en Configuración > Territorios.", "warning");
        return;
    }

    const currentVal = btnElement.dataset.current;

    // We assume showTerritorySelectionModal is defined in this module scope (hoisted or available)
    if (typeof showTerritorySelectionModal === 'function') {
        console.log("Opening territory modal with", _globalTerritorios.length, "territories");
        showTerritorySelectionModal(currentVal, _globalTerritorios, (newValue) => {
            if (!_globalPrograma.dias[dayIndex][turnId]) _globalPrograma.dias[dayIndex][turnId] = {};
            _globalPrograma.dias[dayIndex][turnId].territorio = newValue;

            // Basic UI Update
            btnElement.dataset.current = newValue.replace(/"/g, '&quot;');
            const span = btnElement.querySelector('span.truncate');
            if (span) {
                span.textContent = newValue || 'Asignar';
                span.className = `truncate font-mono ${newValue ? 'text-teal-300 font-medium' : 'text-gray-500 italic'} `;
            }
        });
    } else {
        console.error("showTerritorySelectionModal not found");
        showNotification("Error: Componente modal no cargado. Por favor refresque la página.", "error");
    }
};

window.openGroupSelector = (dayIndex, turnId, btnElement) => {
    if (!btnElement || !_globalPrograma) return;
    const currentVal = btnElement.dataset.current;
    if (typeof showGroupSelectionModal === 'function') {
        showGroupSelectionModal(currentVal, (newValue) => {
            if (!_globalPrograma.dias[dayIndex][turnId]) _globalPrograma.dias[dayIndex][turnId] = {};
            _globalPrograma.dias[dayIndex][turnId].grupos = newValue;

            btnElement.dataset.current = newValue.replace(/"/g, '&quot;');
            const span = btnElement.querySelector('span.truncate');
            if (span) {
                span.textContent = newValue || 'Seleccionar';
                span.className = `truncate ${newValue ? 'text-teal-300 font-medium' : 'text-gray-500 italic'} `;
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
                    <button class="nav-item group ${initialTab === 'historial' ? 'active' : ''}" data-tab="historial">
                        <span class="nav-icon">📄</span>
                        <span class="nav-label">Exportar S-13</span>
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
                    'historial': 'historial',
                    'config': 'config'
                };

                // Update URL
                const newPath = `/administrador/${urlMap[tabId] || 'dashboard'}`;
                window.history.pushState({}, '', newPath);

                loadTab(tabId);
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

const loadTab = async (tabName, appVersion) => {
    const contentDiv = document.getElementById('admin-content');
    contentDiv.innerHTML = '<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>';

    if (tabName === 'config') {
        await renderConfigTab(contentDiv, 'reglas', appVersion);
    } else if (tabName === 'casa-en-casa') {
        await renderCasaEnCasaTab(contentDiv);
    } else if (tabName === 'predicacion') {
        await renderPredicacionTab(contentDiv);
    } else if (tabName === 'telefonos') {
        await renderTelefonosTab(contentDiv);
    } else if (tabName === 'historial') {
        await renderHistoryTab(contentDiv);
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
const renderCasaEnCasaTab = async (container) => {
    const config = await getConfiguracion();

    container.innerHTML = `
   <h2 class="text-xl font-bold mb-6 border-b border-black/10 dark:border-white/10 pb-2 text-teal-800 dark:text-teal-100"> Predicación de Casa en Casa</h2 >
        
        <div class="flex flex-wrap gap-2 mb-6 text-sm border-b border-black/10 dark:border-white/10 pb-4">
            <button class="sub-tab-casa active bg-teal-500/20 text-teal-800 dark:text-teal-200 px-4 py-2 rounded-lg border border-teal-500/30 transition-all font-medium" data-sub="asignaciones">
                📋 Asignaciones
            </button>
            <button class="sub-tab-casa bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10 transition-all" data-sub="programa">
                📅 Programa Semanal
            </button>
            <button class="sub-tab-casa bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10 transition-all" data-sub="recursos">
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
            b.className = "sub-tab-casa bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10 transition-all";
            if (b.dataset.sub === sub) {
                b.className = "sub-tab-casa active bg-teal-500/20 text-teal-800 dark:text-teal-200 px-4 py-2 rounded-lg border border-teal-500/30 transition-all font-medium";
            }
        });

        if (sub === 'asignaciones') {
            await renderAsignacionesView(subContainer);
        } else if (sub === 'programa') {
            await renderProgramaTab(subContainer);
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
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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

    const toggleSelect = (id) => {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        renderGrid();
    };

    const handleNewAssignment = async (editId = null) => {
        const item = editId ? territorios.find(x => x.id === editId) : null;

        showModal(`
            <div class="p-2">
                <header class="flex items-center gap-3 mb-6 bg-purple-600 -mx-8 -mt-8 p-6 text-white rounded-t-2xl shadow-lg">
                    <div class="text-3xl">🟪</div>
                    <div>
                        <h3 class="text-xl font-bold">${editId ? 'Editar Asignación' : 'Nueva Asignación'}</h3>
                        <p class="text-[10px] opacity-80 uppercase tracking-widest font-black">Planificador Central</p>
                    </div>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase mb-1">Territorio</label>
                        <select id="asig-terr" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold">
                            <option value="" disabled ${!editId ? 'selected' : ''}>Seleccionar...</option>
                            ${territorios
                .filter(t => editId ? t.id === editId : (t.estado !== 'Asignado' && t.estado !== 'Pendiente'))
                .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
                .map(t => `<option value="${t.id}" ${editId === t.id ? 'selected' : ''}>${t.numero} - ${t.nombre || 'Sin nombre'}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase mb-1">Campaña (Opcional)</label>
                        <input type="text" id="asig-campana" value="${item?.campana || ''}" list="campanas-list" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold" placeholder="Ej: Conmemoración 2024">
                        <datalist id="campanas-list">
                            ${[...new Set(allHistory.map(h => h.campana).filter(Boolean))].map(c => `<option value="${c}">`).join('')}
                        </datalist>
                    </div>

                    <div class="md:col-span-2 border-t border-black/5 dark:border-white/5 my-2 pt-4">
                        <p class="text-[10px] font-black text-purple-600 mb-2 uppercase tracking-widest">Equipo de Servicio</p>
                    </div>

                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase mb-1">Conductor</label>
                        <select id="asig-cond" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold">
                            <option value="" disabled ${!item ? 'selected' : ''}>Seleccionar...</option>
                            ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `<option value="${c.nombre}" ${item?.asignado_a === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase mb-1">Auxiliar (Opcional)</label>
                        <select id="asig-aux" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold">
                            <option value="">Ninguno</option>
                            ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `<option value="${c.nombre}" ${item?.auxiliar === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                        </select>
                    </div>

                    <div class="md:col-span-2 border-t border-black/5 dark:border-white/5 my-2 pt-4">
                        <p class="text-[10px] font-black text-purple-600 mb-2 uppercase tracking-widest">Logística y Horario</p>
                    </div>

                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase mb-1">Día de Asignación</label>
                        <input type="date" id="asig-date" value="${item?.fecha_asignacion ? item.fecha_asignacion.split('T')[0] : new Date().toISOString().split('T')[0]}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold">
                    </div>

                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase mb-1">Día de Salida (Predicación)</label>
                        <select id="asig-date-salida" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold">
                            <option value="">Seleccionar día...</option>
                            ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => `
                                <option value="${d}" ${item?.fecha_salida && ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(item.fecha_salida).getUTCDay()] === d ? 'selected' : ''}>${d}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase mb-1">Turno</label>
                        <select id="asig-turno" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold">
                            <option value="manana" ${item?.turno === 'manana' ? 'selected' : ''}>${config.jornadas?.manana || '🌅 Mañana'}</option>
                            <option value="tarde" ${item?.turno === 'tarde' ? 'selected' : ''}>${config.jornadas?.tarde || '☀️ Tarde'}</option>
                            <option value="noche" ${item?.turno === 'noche' ? 'selected' : ''}>${config.jornadas?.noche || '🌙 Noche'}</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase mb-1">Lugar de Salida</label>
                        <select id="asig-lugar" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold">
                            <option value="">Seleccionar...</option>
                            ${(config.lugares || []).map(l => `<option value="${l}" ${item?.lugar === l ? 'selected' : ''}>${l}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase mb-1">Hora</label>
                        <input type="time" id="asig-hora" value="${item?.hora || '09:00'}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold">
                    </div>
                </div>

                <div id="sunday-logic" class="hidden mt-6 bg-purple-50 dark:bg-purple-950/20 p-4 rounded-2xl border border-purple-200 dark:border-purple-800/30">
                    <div class="flex items-center justify-between mb-4">
                        <p class="text-xs font-black text-purple-700 dark:text-purple-300 uppercase flex items-center gap-2"><span>🛡️</span> División de Grupos (Domingo)</p>
                        <select id="asig-split-count" class="bg-white dark:bg-black/40 border border-purple-200 dark:border-purple-800/30 rounded-lg text-xs font-bold px-2 py-1">
                            <option value="1">1 Bloque</option>
                            <option value="2">2 Bloques</option>
                            <option value="3">3 Bloques</option>
                        </select>
                    </div>

                    <div id="sunday-blocks" class="space-y-4">
                        <!-- Blocks will be injected here if split > 1 -->
                    </div>

                    <div id="asig-group-single" class="mt-4">
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Combinación de Grupos</label>
                        <select id="asig-grupos" class="w-full bg-white dark:bg-black/40 border border-purple-200 dark:border-purple-800/30 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 font-bold text-sm">
                            <option value="">Sin división específica</option>
                            <option value="Grupos 1 y 5">Grupos 1 y 5</option>
                            <option value="Grupos 2 y 6">Grupos 2 y 6</option>
                            <option value="Grupos 3 y 4">Grupos 3 y 4</option>
                            <option value="Grupos 1-2">Grupos 1 y 2</option>
                            <option value="Grupos 3-4">Grupos 3 y 4</option>
                            <option value="Grupos 5-6">Grupos 5 y 6</option>
                            ${Array.from({ length: 12 }, (_, i) => `<option value="Grupo ${i + 1}">Grupo ${i + 1}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <button id="confirm-asig" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-xl shadow-xl shadow-purple-500/20 transition-all mt-8 uppercase tracking-widest">
                    ${editId ? 'Guardar Cambios' : 'Confirmar Asignación'}
                </button>
            </div>
        `, (modal) => {
            const dateInput = modal.querySelector('#asig-date');
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
                const d = new Date(dateInput.value);
                // getUTCDay() avoids timezone issues with date-only strings
                if (d.getUTCDay() === 0) sunLogic.classList.remove('hidden');
                else sunLogic.classList.add('hidden');
            };

            dateInput.onchange = checkSunday;
            splitSelect.onchange = renderBlocks;
            checkSunday();

            modal.querySelector('#confirm-asig').onclick = async (e) => {
                const terrId = modal.querySelector('#asig-terr').value;
                const cond = modal.querySelector('#asig-cond').value;
                const aux = modal.querySelector('#asig-aux').value;
                const date = modal.querySelector('#asig-date').value;
                const dateSalida = modal.querySelector('#asig-date-salida').value;
                const turno = modal.querySelector('#asig-turno').value;
                const lugar = modal.querySelector('#asig-lugar').value;
                const hora = modal.querySelector('#asig-hora').value;
                const camp = modal.querySelector('#asig-campana').value;
                const groups = modal.querySelector('#asig-grupos').value;
                const splitCount = parseInt(splitSelect.value);

                if (!terrId || !cond || !date) return showNotification("Faltan campos críticos", "warning");

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
                    const daysMap = { 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6, 'Domingo': 0 };
                    const targetDay = daysMap[dayName];
                    const d = new Date(assignDateStr);
                    const currentDay = d.getUTCDay();
                    const currentDayShifted = currentDay === 0 ? 7 : currentDay;
                    const targetDayShifted = targetDay === 0 ? 7 : targetDay;
                    const diff = targetDayShifted - currentDayShifted;
                    d.setUTCDate(d.getUTCDate() + diff);
                    return d.toISOString();
                };

                try {
                    const finalFechaSalida = calculateSalidaDate(date, dateSalida);

                    await assignTerritorio(terrId, cond, {
                        auxiliar: aux,
                        fecha_asignacion: new Date(date).toISOString(),
                        fecha_salida: finalFechaSalida,
                        turno, lugar, hora, campana: camp, grupos: groups,
                        blocks: blocks.length > 0 ? blocks : null
                    });

                    if (camp) await saveCampana(camp);

                    showNotification(editId ? "Asignación actualizada" : "Territorio asignado con éxito", "success");
                    modal.classList.add('hidden');
                    reloadData();
                } catch (err) {
                    showNotification("Error: " + err.message, "error");
                    e.target.disabled = false;
                }
            };
        });
    };

    const handleBulkReturn = async () => {
        const assignedTerritories = territorios.filter(t => t.estado === 'Asignado' || t.estado === 'Pendiente')
            .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

        if (assignedTerritories.length === 0) return showNotification("No hay territorios asignados para devolver", "info");

        showModal(`
            <div class="p-2">
                <header class="flex items-center gap-3 mb-6 bg-red-600 -mx-8 -mt-8 p-6 text-white rounded-t-2xl shadow-lg">
                    <div class="text-3xl">🟥</div>
                    <div>
                        <h3 class="text-xl font-bold">Devolver Territorios</h3>
                        <p class="text-[10px] opacity-80 uppercase tracking-widest font-black">Selección Selectiva</p>
                    </div>
                </header>

                <div class="mb-6">
                    <div class="flex justify-between items-center mb-3">
                        <label class="block text-xs font-black text-gray-400 uppercase">Selecciona los territorios</label>
                        <button id="select-all-returns" class="text-[10px] font-black text-red-600 uppercase hover:underline">Marcar Todos</button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-3 bg-gray-50 dark:bg-black/20 rounded-2xl border border-black/5 custom-scrollbar">
                        ${assignedTerritories.map(t => `
                            <label class="flex items-center gap-3 p-3 bg-white dark:bg-white/5 rounded-xl border border-black/[0.03] dark:border-white/[0.05] cursor-pointer hover:border-red-500/30 transition-all group">
                                <input type="checkbox" class="return-check w-5 h-5 accent-red-600 rounded-lg" value="${t.id}" ${selectedIds.has(t.id) ? 'checked' : ''}>
                                <div class="min-w-0">
                                    <p class="text-sm font-black text-gray-800 dark:text-gray-200">#${t.numero}</p>
                                    <p class="text-[10px] text-gray-500 truncate font-bold uppercase tracking-tighter">${t.asignado_a}</p>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Fecha de Devolución</label>
                        <input type="date" id="bulk-return-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-red-500 font-bold text-sm">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Estado Final</label>
                        <select id="bulk-return-status" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 outline-none focus:ring-2 focus:ring-red-500 font-bold text-sm">
                            <option value="Completado" selected>✅ Completado</option>
                            <option value="Perdido">❌ Perdido / Extraviado</option>
                        </select>
                    </div>
                </div>

                <div class="space-y-3 mb-8">
                    <label class="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/5 rounded-2xl border border-red-100 dark:border-red-500/10 cursor-pointer hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors">
                        <input type="checkbox" id="bulk-repeat" class="w-5 h-5 accent-red-600 rounded">
                        <div>
                            <p class="text-sm font-black text-red-800 dark:text-red-400">Repetir Asignación</p>
                            <p class="text-[9px] text-red-600/60 uppercase font-bold tracking-tighter">Mantiene el territorio al mismo conductor con fecha de hoy</p>
                        </div>
                    </label>
                </div>

                <button id="confirm-bulk-return" class="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-500/20 transition-all uppercase tracking-widest text-sm">
                    Confirmar Devolución
                </button>
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
            <h3 class="text-xl font-bold mb-4 text-purple-600 dark:text-purple-400">Editar Asignación Activa</h3>
            <p class="text-[10px] text-gray-500 mb-6 font-black uppercase tracking-widest">Territorio ${num} - ${conductor}</p>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">Fecha de Asignación</label>
                    <input type="date" id="edit-asig-date" value="${t.fecha_asignacion ? t.fecha_asignacion.split('T')[0] : ''}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none">
                </div>

                <div>
                    <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">Día de Salida (Predicación)</label>
                    <select id="edit-asig-date-salida" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none font-bold">
                        <option value="">Seleccionar día...</option>
                        ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => `
                            <option value="${d}" ${t.fecha_salida && ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(t.fecha_salida).getUTCDay()] === d ? 'selected' : ''}>${d}</option>
                        `).join('')}
                    </select>
                </div>

                <div>
                    <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">Estado</label>
                    <select id="edit-asig-status" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none font-bold">
                        <option value="Asignado" ${t.estado === 'Asignado' ? 'selected' : ''}>Activo (Asignado)</option>
                        <option value="Pendiente" ${t.estado === 'Pendiente' ? 'selected' : ''}>Entregado (Pendiente)</option>
                    </select>
                </div>
            </div>

            <button id="save-active-edit" class="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-xl text-white font-black shadow-xl shadow-purple-500/20 mt-8 transition-all uppercase tracking-widest text-xs">Guardar Cambios</button>
        `, (modal) => {
            modal.querySelector('#save-active-edit').onclick = async (e) => {
                const newDate = modal.querySelector('#edit-asig-date').value;
                const newDateSalida = modal.querySelector('#edit-asig-date-salida').value;
                const newStatus = modal.querySelector('#edit-asig-status').value;

                const calculateSalidaDate = (assignDateStr, dayName) => {
                    if (!dayName) return null;
                    const daysMap = { 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6, 'Domingo': 0 };
                    const targetDay = daysMap[dayName];
                    const d = new Date(assignDateStr);
                    const currentDay = d.getUTCDay();
                    const currentDayShifted = currentDay === 0 ? 7 : currentDay;
                    const targetDayShifted = targetDay === 0 ? 7 : targetDay;
                    const diff = targetDayShifted - currentDayShifted;
                    d.setUTCDate(d.getUTCDate() + diff);
                    return d.toISOString();
                };

                e.target.disabled = true;
                e.target.innerHTML = "GUARDANDO...";
                try {
                    const finalFechaSalida = calculateSalidaDate(newDate, newDateSalida);

                    await updateAssignmentData(
                        id,
                        newDate ? new Date(newDate).toISOString() : t.fecha_asignacion,
                        finalFechaSalida,
                        null,
                        newStatus
                    );
                    showNotification("Asignación actualizada");
                    modal.classList.add('hidden');
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
            <div class= "p-2" >
                <header class="flex items-center gap-3 mb-6 bg-indigo-600 -mx-8 -mt-8 p-6 text-white rounded-t-2xl shadow-lg relative">
                    <div class="text-3xl">📄</div>
                    <div>
                        <h3 class="text-xl font-bold uppercase tracking-tighter">Historial: ${territoryNum}</h3>
                        <p class="text-[10px] opacity-80 uppercase tracking-widest font-black">${history.length} Registros</p>
                    </div>
                </header>
                
                <div class="max-h-[60vh] overflow-y-auto custom-scrollbar -mr-4 pr-4 space-y-4">
                    ${history.length === 0 ? `
                        <div class="py-20 text-center opacity-30">
                            <div class="text-5xl mb-4">📜</div>
                            <p class="font-black uppercase tracking-widest text-xs">Sin registros</p>
                        </div>
                    ` : `
                        <div class="space-y-3">
                            ${history.map(h => `
                                <div class="bg-gray-50 dark:bg-black/20 p-4 rounded-3xl border border-black/5 flex justify-between items-center group hover:border-indigo-500/30 transition-all shadow-sm">
                                    <div class="min-w-0">
                                        <div class="text-sm font-black dark:text-gray-100 flex items-center gap-2">
                                            <span class="w-2 h-2 rounded-full ${h.fecha_entrega ? 'bg-gray-300' : 'bg-teal-500 animate-pulse'}"></span>
                                            ${h.conductor}
                                        </div>
                                        <div class="text-[10px] text-gray-400 mt-1 flex flex-wrap gap-x-4 gap-y-1 font-black uppercase tracking-tighter">
                                            <span>📅 ${h.fecha_asignacion ? new Date(h.fecha_asignacion).toLocaleDateString() : '--'}</span>
                                            ${h.fecha_entrega ? `<span>✅ ${new Date(h.fecha_entrega).toLocaleDateString()}</span>` : `<span>⚡ EN CURSO</span>`}
                                        </div>
                                    </div>
                                    <button onclick="window.actionEditHist('${h.id}')" class="p-3 bg-white dark:bg-black/40 text-indigo-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-600 hover:text-white shadow-xl border border-black/5">
                                        ✏️
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
    `, null, 'max-w-lg');
    };

    const handleManualHistoryEntry = () => {
        showModal(`
    <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400" > Nuevo Registro de Historial</h3>
            
            <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">Territorio</label>
            <select id="hist-terr-num" class="w-full mb-3 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white outline-none">
                ${territorios.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true })).map(t => `<option value="${t.numero}" data-id="${t.id}">${t.numero}</option>`).join('')}
            </select>

            <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">Conductor</label>
            <select id="hist-conductor" class="w-full mb-3 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white outline-none">
                ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
            </select>

            <div class="grid grid-cols-2 gap-3 mb-4">
                <div>
                     <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">F. Asignación</label>
                     <input type="date" id="hist-start" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-xs text-gray-900 dark:text-white outline-none">
                </div>
                <div>
                     <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">F. Entrega</label>
                     <input type="date" id="hist-end" class="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-xs text-gray-900 dark:text-white outline-none">
                </div>
            </div>

            <button id="save-hist-manual" class="w-full bg-teal-600 py-3 rounded-xl text-white font-bold shadow-lg shadow-teal-500/20 hover:scale-[1.02] transition-transform">Crear Registro</button>
`, (modal) => {
            modal.querySelector('#save-hist-manual').addEventListener('click', async (e) => {
                const sel = modal.querySelector('#hist-terr-num');
                const opt = sel.options[sel.selectedIndex];
                const data = {
                    numero: sel.value,
                    territorio_id: opt.getAttribute('data-id'),
                    conductor: modal.querySelector('#hist-conductor').value,
                    fecha_asignacion: modal.querySelector('#hist-start').value,
                    fecha_entrega: modal.querySelector('#hist-end').value || null,
                    estado: modal.querySelector('#hist-end').value ? 'Completado' : 'Asignado'
                };

                e.target.disabled = true;
                await addHistoryRecord(data);
                showNotification("Registro histórico creado");
                modal.classList.add('hidden');
                reloadData();
            });
        });
    };

    const handleEditHistory = async (hId) => {
        const h = allHistory.find(x => x.id === hId);
        if (!h) return;

        showModal(`
    <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400" > Editar Registro Histórico</h3>
            <p class="text-[10px] text-gray-500 mb-4">Territorio ${h.numero} - ${h.conductor}</p>
            
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div>
                     <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">F. Asignación</label>
                     <input type="date" id="edit-hist-start" value="${h.fecha_asignacion ? h.fecha_asignacion.split('T')[0] : ''}" class="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-xs text-gray-900 dark:text-white outline-none">
                </div>
                <div>
                     <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">F. Entrega</label>
                     <input type="date" id="edit-hist-end" value="${h.fecha_entrega ? h.fecha_entrega.split('T')[0] : ''}" class="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-xs text-gray-900 dark:text-white outline-none">
                </div>
            </div>

            <div class="flex gap-2">
                <button id="del-hist-record" class="bg-red-500/10 text-red-500 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-colors">Eliminar</button>
                <button id="update-hist-manual" class="flex-1 bg-teal-600 py-2 rounded-lg text-white font-bold shadow-lg shadow-teal-500/20">Guardar Cambios</button>
            </div>
`, (modal) => {
            modal.querySelector('#update-hist-manual').onclick = async () => {
                const fStart = modal.querySelector('#edit-hist-start').value;
                const fEnd = modal.querySelector('#edit-hist-end').value;
                await updateHistoryRecord(hId, {
                    fecha_asignacion: fStart,
                    fecha_entrega: fEnd || null,
                    estado: fEnd ? 'Completado' : 'Asignado'
                });
                modal.classList.add('hidden');
                reloadData();
            };
            modal.querySelector('#del-hist-record').onclick = async () => {
                showCustomConfirm('¿Seguro que deseas eliminar este registro histórico?', async () => {
                    await deleteHistoryRecord(hId);
                    modal.classList.add('hidden');
                    reloadData();
                });
            };
        });
    };

    const renderMain = () => {
        container.innerHTML = `
    <div class="space-y-8 animate-fade-in px-2" >
                < !--DASHBOARD MENU-- >
                <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <button id="hub-btn-assign" class="group relative bg-white dark:bg-[#121212] overflow-hidden p-6 rounded-[2.5rem] border border-black/[0.03] dark:border-white/5 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(147,51,234,0.2)]">
                        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/10 blur-[30px] rounded-full group-hover:bg-purple-500/20 transition-all"></div>
                        <div class="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform shadow-inner">➕</div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Operación</p>
                        <p class="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tighter">Asignar</p>
                    </button>

                    <button id="hub-btn-return" class="group relative bg-white dark:bg-[#121212] overflow-hidden p-6 rounded-[2.5rem] border border-black/[0.03] dark:border-white/5 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(239,68,68,0.2)]">
                        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-red-500/10 blur-[30px] rounded-full group-hover:bg-red-500/20 transition-all"></div>
                        <div class="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform shadow-inner">📥</div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Recepción</p>
                        <p class="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tighter">Devolver</p>
                        ${selectedIds.size > 0 ? `<div class="absolute top-6 right-6 bg-red-600 text-white w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center animate-bounce shadow-lg ring-4 ring-white dark:ring-[#121212]">${selectedIds.size}</div>` : ''}
                    </button>

                    <button id="hub-btn-active" class="group relative bg-white dark:bg-[#121212] overflow-hidden p-6 rounded-[2.5rem] border border-black/[0.03] dark:border-white/5 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(20,184,166,0.2)]">
                        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-teal-500/10 blur-[30px] rounded-full group-hover:bg-teal-500/20 transition-all"></div>
                        <div class="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform shadow-inner">🗺️</div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Visualización</p>
                        <p class="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tighter">Gestión</p>
                    </button>

                    <button id="hub-btn-history" class="group relative bg-white dark:bg-[#121212] overflow-hidden p-6 rounded-[2.5rem] border border-black/[0.03] dark:border-white/5 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.2)]">
                        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/10 blur-[30px] rounded-full group-hover:bg-blue-500/20 transition-all"></div>
                        <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform shadow-inner">📜</div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Registros</p>
                        <p class="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tighter">Historial Global</p>
                    </button>

                    <button id="hub-btn-export-xls" class="group relative bg-white dark:bg-[#121212] overflow-hidden p-6 rounded-[2.5rem] border border-black/[0.03] dark:border-white/5 shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(34,197,94,0.2)] col-span-2 lg:col-span-1">
                        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-green-500/10 blur-[30px] rounded-full group-hover:bg-green-500/20 transition-all"></div>
                        <div class="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform shadow-inner">📊</div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Reportes</p>
                        <p class="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tighter">Exportar XLS</p>
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

                <div id="assigns-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in pb-20"></div>
            </div>
    `;

        // Bind Main Buttons
        container.querySelector('#hub-btn-assign').onclick = () => handleNewAssignment();
        container.querySelector('#hub-btn-return').onclick = () => handleBulkReturn();
        container.querySelector('#hub-btn-active').onclick = () => { currentView = 'activas'; renderGrid(); };
        container.querySelector('#hub-btn-history').onclick = () => { currentView = 'historial'; renderGrid(); };
        container.querySelector('#hub-btn-export-xls').onclick = () => {
            // Unify: Point to S-13 which is more complete
            document.querySelector('[data-tab="historial"]').click();
            showNotification("Generando reporte S-13...", "info");
        };
        container.querySelector('#hub-btn-export-xls').innerHTML = '<span>📊</span> Reporte S-13';

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

        title.innerText = currentView === 'activas' ? 'MAPA DE TERRITORIOS' : 'REGISTRO HISTÓRICO';
        const query = search ? search.value.toLowerCase() : '';
        let items = [];

        if (currentView === 'activas') {
            // SHOW ALL sorted by number
            items = [...territorios].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
        } else if (currentView === 'historial') {
            items = [...allHistory].sort((a, b) => new Date(b.fecha_entrega || b.fecha_asignacion) - new Date(a.fecha_entrega || a.fecha_asignacion)).slice(0, 100);
        }

        const filtered = items.filter(t => {
            const num = (t.numero || '').toString();
            const cond = (t.asignado_a || t.conductor || '').toLowerCase();
            const camp = (t.campana || '').toLowerCase();
            return num.includes(query) || cond.includes(query) || camp.includes(query);
        });

        const activeCount = territorios.filter(t => t.estado === 'Asignado').length;
        const availableCount = territorios.length - activeCount;
        const recentCount = allHistory.filter(h => {
            if (!h.fecha_entrega) return false;
            const diff = (new Date() - new Date(h.fecha_entrega)) / (1000 * 60 * 60 * 24);
            return diff <= 7;
        }).length;

        stats.innerHTML = `
    <div class="flex items-center gap-4" >
                <span class="text-gray-400">${filtered.length} RESULTADOS</span>
                <span class="hidden md:inline-block h-3 w-px bg-gray-200 dark:bg-gray-800"></span>
                <span class="text-teal-600 dark:text-teal-400 font-black">⚡ ${activeCount} ACTIVOS</span>
                <span class="text-indigo-500 dark:text-indigo-400 font-black">📖 ${availableCount} DISPONIBLES</span>
                <span class="text-emerald-500 font-black">✅ ${recentCount} ESTA SEMANA</span>
            </div>
    `;

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-40 text-center opacity-30 font-black text-sm uppercase tracking-widest" > Nada que mostrar</div> `;
            return;
        }

        grid.innerHTML = filtered.map(item => {
            const isHist = currentView === 'historial';
            const isSelected = selectedIds.has(item.id);
            const num = item.numero;
            const conductor = isHist ? item.conductor : (item.asignado_a || 'Disponible');
            const fechaAsig = isHist ? item.fecha_asignacion : item.fecha_asignacion;
            const fechaSalida = isHist ? item.fecha_salida : item.fecha_salida;
            const isAssigned = item.estado === 'Asignado' || item.estado === 'Pendiente';

            return `
                <div class="relative group cursor-pointer transition-all duration-500" 
                     ${isAssigned && !isHist ? `onclick="window.actionToggleSelect('${item.id}')"` : ''}>
                    
                    <!-- Main Card Container -->
                    <div class="h-full bg-white dark:bg-[#121212] rounded-[2.5rem] border border-black/5 dark:border-white/[0.05] p-6 flex flex-col gap-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(20,184,166,0.12)] hover:border-teal-500/30 transition-all duration-500 relative overflow-hidden group-hover:-translate-y-2">
                        
                        <!-- Premium Background Glow -->
                        <div class="absolute -right-12 -top-12 w-40 h-40 bg-teal-500/5 blur-[50px] rounded-full group-hover:bg-teal-500/10 transition-colors"></div>
                        
                        <!-- Top Header: ID & Status -->
                        <div class="flex justify-between items-start relative z-10">
                            <div class="flex items-center gap-3">
                                <div class="w-14 h-14 rounded-3xl bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 flex items-center justify-center shadow-sm">
                                    <span class="text-2xl font-black text-teal-700 dark:text-teal-400">${num}</span>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Registro</span>
                                    <div class="flex items-center gap-1.5">
                                        <span class="w-1.5 h-1.5 rounded-full ${isAssigned ? 'bg-teal-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-700'}"></span>
                                        <span class="text-[11px] font-bold ${isAssigned ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500'} tracking-tight">${isAssigned ? 'ACTIVO' : 'DISPONIBLE'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-1 p-1 bg-gray-50 dark:bg-white/5 rounded-2xl border border-black/[0.03] dark:border-white/[0.05]">
                                <button onclick="event.stopPropagation(); window.actionEditActive('${item.id}')" class="p-2.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors bg-white dark:bg-black/20 rounded-xl shadow-sm hover:shadow-md" title="Editar">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                </button>
                                <button onclick="event.stopPropagation(); window.actionHistory('${item.id}', '${num}')" class="p-2.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hover:bg-white dark:hover:bg-black/20 rounded-xl" title="Historial">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </button>
                            </div>
                        </div>

                        <!-- Publicador Section -->
                        <div class="bg-gray-50/50 dark:bg-white/[0.01] rounded-[2rem] p-5 border border-black/[0.03] dark:border-white/[0.03] relative z-10">
                            <div class="flex items-center gap-4 mb-4">
                                <div class="w-12 h-12 rounded-2xl ${isAssigned ? 'bg-gradient-to-br from-teal-500 to-teal-700' : 'bg-gray-200 dark:bg-white/10'} flex items-center justify-center text-white shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform duration-500">
                                    <span class="font-black text-xl">${(conductor[0] || 'D').toUpperCase()}</span>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">${isAssigned ? 'Conductor Principal' : 'Estado Actual'}</p>
                                    <p class="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">
                                        ${conductor}
                                    </p>
                                </div>
                            </div>
                            
                            ${item.auxiliar ? `
                                <div class="flex items-center gap-3 pl-4 border-l-2 border-teal-500/30">
                                    <div class="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-xs opacity-60">👤</div>
                                    <div class="min-w-0">
                                        <p class="text-[8px] font-black text-gray-500 uppercase tracking-tighter">Auxiliar Asignado</p>
                                        <p class="text-xs font-bold text-gray-600 dark:text-gray-400 truncate">${item.auxiliar}</p>
                                    </div>
                                </div>
                            ` : `
                                <div class="flex items-center gap-3 pl-4 border-l-2 border-dashed border-gray-200 dark:border-white/10 opacity-30">
                                    <div class="w-7 h-7 rounded-lg bg-transparent flex items-center justify-center text-xs">👤</div>
                                    <p class="text-[10px] font-bold text-gray-400">Sin auxiliar</p>
                                </div>
                            `}
                        </div>

                        <!-- Logistics Footer -->
                        <div class="grid grid-cols-2 gap-3 relative z-10">
                            <div class="bg-indigo-50/30 dark:bg-indigo-500/[0.03] p-4 rounded-[1.5rem] border border-indigo-500/10 flex flex-col gap-1">
                                <p class="text-[8px] font-black text-indigo-400 dark:text-indigo-500/70 uppercase tracking-widest">🗓️ Asignado</p>
                                <p class="text-[13px] font-black text-indigo-700 dark:text-indigo-400">${fmtDate(fechaAsig)}</p>
                            </div>
                            <div class="bg-emerald-50/30 dark:bg-emerald-500/[0.03] p-4 rounded-[1.5rem] border border-emerald-500/10 flex flex-col gap-1">
                                <p class="text-[8px] font-black text-emerald-400 dark:text-emerald-500/70 uppercase tracking-widest">📅 Salida</p>
                                <p class="text-[13px] font-black ${fechaSalida ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400'}">${fechaSalida ? fmtDate(fechaSalida) : 'Pn.'}</p>
                            </div>
                        </div>

                        ${item.lugar || item.turno ? `
                            <div class="mt-auto relative z-10">
                                <div class="bg-gradient-to-r from-gray-50 to-white dark:from-white/[0.02] dark:to-transparent px-4 py-3 rounded-2xl border border-black/[0.03] dark:border-white/[0.05] flex items-center gap-3">
                                    <span class="text-sm opacity-70">📍</span>
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest truncate">
                                            ${item.lugar || 'Punto de Encuentro'}
                                        </span>
                                        <span class="text-[8px] font-bold text-gray-400 uppercase">${item.turno || 'Sin Horario'}</span>
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        <!-- Selection Overlay (only when multi-selecting) -->
                        ${isSelected ? `
                            <div class="absolute inset-0 bg-teal-500/10 backdrop-blur-[2px] border-4 border-teal-500 z-20 flex items-center justify-center rounded-[2.5rem] transition-all animate-in fade-in duration-300">
                                <div class="bg-teal-500 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl scale-125 animate-in zoom-in duration-300">
                                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                            </div>
                        ` : ''}
                        
                        <!-- Progress Bottom Accent -->
                        <div class="absolute bottom-0 left-0 h-1.5 w-full bg-gray-50 dark:bg-white/5 overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-1000" style="width: ${isAssigned ? '100%' : '0%'}"></div>
                        </div>

                    </div>
                </div>
            `;
        }).join('');
    };

    window.actionToggleSelect = (id) => toggleSelect(id);
    window.actionEditActive = (id) => handleNewAssignment(id);
    window.actionHistory = (id, num) => handleHistory(id, num);
    window.actionEditHist = (id) => handleEditHistory(id);

    renderMain();
};


const loadSubTab = async (subTab, container, config, appVersion) => {
    container.innerHTML = '<div class="animate-pulse flex space-x-4"><div class="h-4 bg-white/10 rounded w-3/4"></div></div>';

    if (subTab === 'modulos') {
        container.innerHTML = `
    <div class="space-y-4 max-w-lg" >
                <h3 class="font-semibold text-lg text-teal-800 dark:text-teal-100">Módulos del Conductor</h3>
                <div class="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10">
                    <span>Dashboard</span>
                    <input type="checkbox" id="check-dashboard" ${config.modulos_activos.dashboard ? 'checked' : ''} class="w-5 h-5 accent-teal-500">
                </div>
                <div class="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10">
                    <span>Programa de Predicación</span>
                    <input type="checkbox" id="check-programa" ${config.modulos_activos.programa_predicacion ? 'checked' : ''} class="w-5 h-5 accent-teal-500">
                </div>
                <div class="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10">
                    <span>Predicación Telefónica</span>
                    <input type="checkbox" id="check-telefonos" ${config.modulos_activos.predicacion_telefonica ? 'checked' : ''} class="w-5 h-5 accent-teal-500">
                </div>

                <div class="pt-4 mt-6 border-t border-black/10 dark:border-white/10">
                    <h3 class="font-semibold text-lg text-teal-800 dark:text-teal-100 mb-2">Integración IA (Gemini)</h3>
                    <div class="p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10">
                        <label class="block text-xs uppercase text-teal-600 dark:text-teal-400 mb-2">API Key (Google Gemini)</label>
                        <input type="password" id="gemini-key" value="${config.gemini_key || ''}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-3 text-gray-900 dark:text-white focus:border-teal-500 outline-none" placeholder="AIxa...">
                        <p class="text-[10px] text-gray-500 mt-2">Esta clave se guarda localmente en la base de datos para habilitar el Asistente Inteligente.</p>
                    </div>
                </div>

                <button id="save-modules" class="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg mt-4 w-full shadow-lg shadow-teal-500/20">Guardar Cambios</button>
            </div>
    `;
        container.querySelector('#save-modules').addEventListener('click', async () => {
            config.modulos_activos = {
                dashboard: document.getElementById('check-dashboard').checked,
                programa_predicacion: document.getElementById('check-programa').checked,
                predicacion_telefonica: document.getElementById('check-telefonos').checked
            };
            config.gemini_key = document.getElementById('gemini-key').value;
            await saveConfiguracion(config);
            showCustomAlert("Configuración guardada");
        });

    } else if (subTab === 'congregacion') {
        container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up" >
                <!-- Datos Generales Card -->
                <div class="morphinglass-card p-6 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl relative overflow-hidden group">
                    <div class="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div class="relative z-10 space-y-6">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="p-2 bg-teal-500/20 rounded-lg text-teal-700 dark:text-teal-300">🏢</div>
                            <h3 class="font-bold text-xl text-teal-900 dark:text-teal-50">Datos Generales</h3>
                        </div>
                        
                        <div class="space-y-4">
                            <div class="group/input">
                                <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">Nombre Congregación</label>
                                <input type="text" id="conf-nombre" value="${config.congregacion?.nombre || ''}" 
                                    class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white placeholder-gray-500 focus:border-teal-500/50 focus:bg-white dark:focus:bg-black/40 focus:ring-1 focus:ring-teal-500/50 transition-all outline-none shadow-sm">
                            </div>
                            <div class="group/input">
                                <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">Número</label>
                                <input type="text" id="conf-numero" value="${config.congregacion?.numero || ''}" 
                                    class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white placeholder-gray-500 focus:border-teal-500/50 focus:bg-white dark:focus:bg-black/40 focus:ring-1 focus:ring-teal-500/50 transition-all outline-none shadow-sm">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Horarios y Lugares Card -->
    <div class="morphinglass-card p-6 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl relative overflow-hidden group">
        <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div class="relative z-10 space-y-6">
            <div class="flex items-center gap-3 mb-2">
                <div class="p-2 bg-blue-500/20 rounded-lg text-blue-700 dark:text-blue-300">🕰️</div>
                <h3 class="font-bold text-xl text-teal-900 dark:text-teal-50">Configuración Programa</h3>
            </div>

            <div class="space-y-5">
                <div>
                    <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">Horarios para Predicación (separados por coma)</label>
                    <input type="text" id="conf-prog-horarios" value="${config.horarios_programa?.join(', ') || ''}"
                        class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white text-sm focus:border-teal-500/50 transition-all font-mono shadow-sm"
                        placeholder="Ej: 08:45, 09:15, 16:00, 19:15">
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-2 ml-1 opacity-60">Estos horarios aparecerán como opciones disponibles en el Programa Semanal.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">Lugares Validos</label>
                        <textarea id="conf-lugares" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white text-xs h-24 focus:border-teal-500/50 transition-all resize-none leading-relaxed shadow-sm">${config.lugares?.join(', ') || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5 font-medium ml-1">Facetas Validas</label>
                        <textarea id="conf-facetas" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-gray-900 dark:text-white text-xs h-24 focus:border-teal-500/50 transition-all resize-none leading-relaxed shadow-sm">${config.facetas?.join(', ') || ''}</textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>
        <div class="mt-8 flex justify-end">
            <button id="save-congregacion" class="group relative px-8 py-3 bg-gradient-to-r from-teal-500 to-teal-400 rounded-xl text-white font-semibold shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <span class="relative flex items-center gap-2">
                    💾 Guardar Cambios
                </span>
            </button>
        </div>
    </div>
    `;

        container.querySelector('#save-congregacion').addEventListener('click', async () => {
            const btn = container.querySelector('#save-congregacion');
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<span class="animate-pulse">⏳ Guardando...</span>';

            try {
                config.congregacion = {
                    nombre: document.getElementById('conf-nombre').value,
                    numero: document.getElementById('conf-numero').value
                };

                config.lugares = document.getElementById('conf-lugares').value.split(',').map(s => s.trim()).filter(s => s);
                config.facetas = document.getElementById('conf-facetas').value.split(',').map(s => s.trim()).filter(s => s);
                config.horarios_programa = document.getElementById('conf-prog-horarios').value.split(',').map(s => s.trim()).filter(s => s);

                await saveConfiguracion(config);
                showCustomAlert("Configuración actualizada correctamente");
            } catch (error) {
                console.error(error);
                showCustomAlert("Error al guardar la configuración");
            } finally {
                btn.innerHTML = originalContent;
            }
        });

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
    <div class="space-y-6 max-w-4xl animate-fade-in p-4 md:p-6" >
            <h3 class="font-bold text-xl text-teal-800 dark:text-teal-100 flex items-center gap-3">
                <span class="p-2 bg-teal-500/10 rounded-lg">🛠️</span> Mantenimiento del Sistema
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white dark:bg-white/5 p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-between group hover:border-teal-500/30 transition-colors">
                    <div>
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Territorios</p>
                        <p class="text-3xl font-black text-teal-600 dark:text-teal-400">${tCount}</p>
                    </div>
                    <div class="p-4 bg-teal-50 dark:bg-teal-500/10 rounded-2xl text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">🗺️</div>
                </div>
                <div class="bg-white dark:bg-white/5 p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-between group hover:border-blue-500/30 transition-colors">
                    <div>
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Conductores</p>
                        <p class="text-3xl font-black text-blue-600 dark:text-blue-400">${cCount}</p>
                    </div>
                    <div class="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">👤</div>
                </div>
                <div class="bg-white dark:bg-white/5 p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-between group hover:border-green-500/30 transition-colors">
                    <div>
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Registros</p>
                        <p class="text-3xl font-black text-green-600 dark:text-green-400">${pCount}</p>
                    </div>
                    <div class="p-4 bg-green-50 dark:bg-green-500/10 rounded-2xl text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">📞</div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="space-y-6">
                     <div class="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-200 dark:border-amber-900/30 shadow-sm">
                        <h4 class="font-bold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                            <span>🧹</span> Reconstruir Historial (S-13)
                        </h4>
                        <p class="text-xs text-amber-700/80 dark:text-amber-300/80 mb-4 leading-relaxed">
                            Analiza el Programa Semanal para recuperar asignaciones perdidas en el historial.
                        </p>
                        <button id="btn-rebuild-history" class="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl shadow-lg shadow-amber-500/20 transition-all font-bold text-sm">
                            Ejecutar Diagnóstico
                        </button>
                    </div>

                    <div class="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/30 shadow-sm">
                        <h4 class="font-bold text-indigo-800 dark:text-indigo-200 mb-4 flex items-center gap-2">
                            <span>💾</span> Datos y Seguridad
                        </h4>
                        <div class="grid grid-cols-2 gap-4">
                            <button id="btn-backup-json" class="bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold text-sm">
                                Backup
                            </button>
                            <label class="bg-white dark:bg-black/40 border border-indigo-200 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300 py-3 rounded-xl text-center cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all font-bold text-sm">
                                Restaurar
                                <input type="file" id="input-restore-json" class="hidden" accept=".json">
                            </label>
                        </div>
                    </div>

                    <div class="bg-teal-50 dark:bg-teal-900/10 p-6 rounded-2xl border border-teal-200 dark:border-teal-900/30 shadow-sm">
                        <h4 class="font-bold text-teal-800 dark:text-teal-200 mb-2 flex items-center gap-2">
                            <span>🚀</span> Actualización de Sistema
                        </h4>
                        <p class="text-[10px] text-teal-700/60 dark:text-teal-300/60 mb-4 font-medium uppercase tracking-wider">Última Versión: v${appVersion}</p>
                        <div class="grid grid-cols-2 gap-4">
                            <button id="btn-force-update" class="bg-teal-600 hover:bg-teal-500 text-white py-3 rounded-xl shadow-lg shadow-teal-500/20 transition-all font-bold text-xs" title="Limpieza local">
                                Reinstalar Local
                            </button>
                            <button id="btn-set-remote-version" class="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all font-bold text-xs" title="Actualizar congregación">
                                Forzar a Todos
                            </button>
                        </div>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="bg-gray-50 dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/10 h-full">
                        <h4 class="font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-2">
                            <span class="text-xl">🤖</span> Inteligencia y Diagnóstico
                        </h4>
                        
                        <div class="space-y-4 mb-8">
                            <button id="btn-smart-repair" class="w-full flex items-center justify-between p-4 bg-white dark:bg-black/20 rounded-xl border border-amber-500/30 group hover:border-amber-500 transition-all text-left shadow-lg shadow-amber-500/10">
                                <div>
                                    <p class="font-bold text-amber-600 dark:text-amber-400 text-sm">Reparación Inteligente (Teléfonos)</p>
                                    <p class="text-[10px] text-gray-400">Analiza y corrige discrepancias de estados y asignaciones.</p>
                                </div>
                                <span class="text-amber-500 group-hover:scale-110 transition-transform text-lg">✨</span>
                            </button>
                            
                            <button id="btn-fix-territories" class="w-full flex items-center justify-between p-4 bg-white dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5 group hover:border-teal-500/50 transition-all text-left">
                                <div>
                                    <p class="font-bold text-gray-700 dark:text-gray-300 text-sm">Normalizar Terrenos</p>
                                    <p class="text-[10px] text-gray-400">Corrige formatos de numeración</p>
                                </div>
                                <span class="text-teal-500 group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        </div>

                        <div class="p-4 bg-teal-500/5 rounded-xl border border-teal-500/10">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Modelo Gemini</span>
                                <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic">
                                "Optimizado para análisis histórico y asistencia proactiva en la gestión de conductores."
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div id="maint-console" class="hidden bg-black/80 backdrop-blur-xl p-5 rounded-2xl font-mono text-[10px] text-teal-400 max-h-60 overflow-y-auto border border-white/10 shadow-2xl"></div>
        </div>
    `;

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
            showCustomConfirm('¿Quieres reconstruir el historial S-13 desde el programa semanal? (Puede tardar unos segundos)', async () => {
                const original = btn.innerHTML;
                btn.innerHTML = '<span class="animate-pulse">🔄 Procesando...</span>';
                btn.disabled = true;
                const count = await rebuildHistoryFromSchedule();
                showCustomAlert(`✅ Éxito: Se sincronizaron ${count} registros históricos.`);
                btn.innerHTML = original;
                btn.disabled = false;
            });
        });

        // 2. Backup
        bind('btn-backup-json', async (btn) => {
            const original = btn.innerHTML;
            btn.innerHTML = '📦 ...';
            btn.disabled = true;
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
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `Backup_Territorios_${formatDateId(new Date())}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            showCustomAlert("📥 Backup descargado con éxito");
            btn.innerHTML = original;
            btn.disabled = false;
        });

        // 3. Restore
        const fileInput = container.querySelector('#input-restore-json');
        if (fileInput) fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file || !ensureOnline()) return;
            showCustomConfirm('⚠️ ALERTA: Esto borrará TODOS los datos actuales y los reemplazará con el backup. ¿Continuar?', async () => {
                const consoleUI = document.getElementById('maint-console');
                consoleUI.classList.remove('hidden');
                consoleUI.innerHTML = '<div class="text-teal-400 font-bold mb-2">🚀 Restaurando registros...</div>';
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        await restoreSystemBackup(data, (msg, progress) => {
                            consoleUI.innerHTML += `<div class="mb-1 text-gray-400" > [${progress} %] ${msg}</div> `;
                            consoleUI.scrollTop = consoleUI.scrollHeight;
                        });
                        showNotification("✅ Base de datos restaurada correctamente", "success");
                        setTimeout(() => window.location.reload(), 1500);
                    } catch (err) {
                        consoleUI.innerHTML += `<div class="mt-2 text-red-400" >❌ Error: ${err.message}</div> `;
                    }
                };
                reader.readAsText(file);
            });
        };

        // 4. Local Reinstall
        bind('btn-force-update', async (btn) => {
            showCustomConfirm('Esto limpiará el caché local y forzará la descarga de la última versión. Los datos no se perderán.', async () => {
                const original = btn.innerHTML;
                btn.innerHTML = '⚡ Limpiando...';

                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let r of registrations) await r.unregister();
                }
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                }
                localStorage.removeItem('app_version');
                localStorage.removeItem('programs_cache');

                showNotification("⚙️ Caché limpio. Reiniciando...", "warning");
                setTimeout(() => window.location.reload(true), 1000);
            });
        });

        // 5. Force All Update
        bind('btn-set-remote-version', async (btn) => {
            showCustomConfirm(`¿Deseas activar la actualización forzada a v${appVersion} para todos los usuarios de la congregación ? `, async () => {
                const original = btn.innerHTML;
                btn.innerHTML = '🌐 Enviando...';
                await setSystemVersion(appVersion);
                showCustomAlert(`✅ Versión central actualizada a v${appVersion} `);
                btn.innerHTML = original;
            });
        });

        // 6. Proactive Fixes (Consolidated)
        bind('btn-smart-repair', async (btn) => {
            const original = btn.innerHTML;
            btn.innerHTML = '<div class="flex items-center gap-2"><span class="animate-spin">⏳</span> Analizando...</div>';

            const report = await runSystemDiagnosticsAndRepair();

            let msg = `✅ Reparación Inteligente Completada\n\n`;
            msg += `- Historial sincronizado: ${report.rebuiltHistory}\n`;
            msg += `- Teléfonos corregidos: ${report.fixedPhones}\n`;

            if (report.details && report.details.length > 0) {
                // Show sample details if many
                const detailsToShow = report.details.slice(0, 5).map(d => `• ${d}`).join('\n');
                msg += `\nDetalles:\n${detailsToShow}`;
                if (report.details.length > 5) msg += `\n... y ${report.details.length - 5} más.`;
            } else {
                msg += `\nSistema estable. No se encontraron errores críticos.`;
            }

            showCustomAlert(msg);
            btn.innerHTML = original;
        });

        bind('btn-fix-territories', async (btn) => {
            const original = btn.innerHTML;
            btn.innerHTML = '⏳ Procesando...';
            const terrs = await getTerritorios();
            let fixed = 0;
            for (const t of terrs) {
                if (t.numero && t.numero.includes(',')) {
                    await updateTerritorio(t.id, { numero: t.numero.replace(',', '') });
                    fixed++;
                }
            }
            showCustomAlert(`✅ Normalización terminada.${fixed} cambios realizados.`);
            btn.innerHTML = original;
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
                        <div class="font-bold text-teal-600 dark:text-teal-300 text-lg">Territorio ${t.numero}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">${t.manzanas}</div>
                    </div>
                `).join('')}
    </div>
`;

        document.getElementById('btn-add-territorio').addEventListener('click', () => {
            showModal(`
    <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400" > Nuevo Territorio</h3>
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
                loadSubTab('territorios', container, config);
            });
        };

        window.editTerritorio = async (id) => {
            const t = territorios.find(x => x.id === id);
            if (!t) return;

            showModal(`
    <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400" > Editar Territorio</h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Número</label>
                        <input type="text" id="edit-t-num" value="${t.numero}" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
                    </div>
                    <div>
                        <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Manzanas</label>
                        <input type="text" id="edit-t-manzanas" value="${t.manzanas || ''}" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
                    </div>

                    <div>
                        <label class="block text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">Imagen del Mapa</label>
                        <div class="flex items-center gap-4">
                            <label class="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                                <span>🔄 Cambiar Imagen</span>
                                <input type="file" id="edit-t-file" accept="image/png, image/jpeg, image/webp" class="hidden">
                            </label>
                            <span id="file-name-edit" class="text-xs text-gray-500 italic truncate max-w-[150px]">Mantener actual</span>
                        </div>
                        <input type="hidden" id="edit-t-base64" value="${t.imagen || ''}">
                        
                        <div id="preview-edit-container" class="mt-2 ${t.imagen ? '' : 'hidden'}">
                             <p class="text-[10px] text-gray-500 mb-1">Vista Previa:</p>
                             <img id="preview-edit" src="${t.imagen || ''}" class="h-32 w-auto max-w-full rounded border border-gray-200 dark:border-white/20 object-contain mx-auto bg-white dark:bg-black">
                        </div>
                    </div>
                </div>
                <button id="update-territorio" class="w-full bg-teal-600 py-3 rounded-lg text-white font-bold mt-6 shadow-lg shadow-teal-500/20 hover:scale-[1.02] transition-all">
                    Actualizar Cambios
                </button>
`, async (modal) => {
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
                        loadSubTab('territorios', container, config);
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
            showModal(`<h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400">📅 Disponibilidad: ${p.nombre}</h3><div class="bg-gray-50 dark:bg-black/40 rounded-xl overflow-y-auto max-h-[60vh]">${listHtml}</div><button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full bg-teal-600 text-white py-2 rounded-lg mt-6 font-bold">Cerrar</button>`, () => { });
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
                <h3 class="text-2xl font-black mb-6 text-teal-600 dark:text-teal-400">${isEdit ? 'Editar Registro' : 'Nuevo Registro'}</h3>
                <div class="space-y-5 px-1">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Nombre Completo</label>
                            <input type="text" id="p-name" value="${person?.nombre || ''}" class="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm font-bold focus:border-teal-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Teléfono (WhatsApp)</label>
                            <input type="text" id="p-phone" value="${person?.telefono || ''}" placeholder="+593..." class="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm font-mono focus:border-teal-500 outline-none">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Género</label>
                            <select id="p-gender" class="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm font-bold focus:border-teal-500 outline-none">
                                <option value="Hombre" ${person?.genero === 'Hombre' ? 'selected' : ''}>Hombre</option>
                                <option value="Mujer" ${person?.genero === 'Mujer' ? 'selected' : ''}>Mujer</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black uppercase text-gray-400 mb-1 ml-1">Grupo</label>
                            <select id="p-group" class="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm font-bold focus:border-teal-500 outline-none">
                                <option value="0" ${!person?.grupo || person?.grupo === 0 ? 'selected' : ''}>Sin asignar</option>
                                ${Array.from({ length: 6 }, (_, i) => `<option value="${i + 1}" ${person?.grupo == (i + 1) ? 'selected' : ''}>Grupo ${i + 1}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black uppercase text-gray-400 mb-2 ml-1">Privilegios / Roles</label>
                        <div id="privs-container" class="flex flex-wrap gap-2">
                        </div>
                    </div>
                    <div class="p-4 bg-teal-500/5 rounded-2xl border border-teal-500/10">
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-xs font-black uppercase text-teal-600">Disponibilidad (Conductor)</span>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="p-is-cond" class="sr-only peer" ${person?.es_conductor ? 'checked' : ''}>
                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                <span class="ml-3 text-xs font-bold text-gray-500">Activo</span>
                            </label>
                        </div>
                        <div id="p-avail-grid" class="${person?.es_conductor ? '' : 'opacity-30 pointer-events-none'} transition-all">
                            <div class="grid grid-cols-4 gap-1 mb-2 text-center text-[10px] font-black text-gray-400 uppercase">
                                <div class="text-left pl-2">Día</div>
                                ${shifts.map(s => `<div class="${s.color}">${s.label}</div>`).join('')}
                            </div>
                            <div class="space-y-1">
                                ${days.map(day => `
                                    <div class="grid grid-cols-4 gap-1 items-center bg-white/50 dark:bg-black/20 rounded-lg p-1.5 border border-white/5">
                                        <div class="text-[11px] font-black text-gray-700 dark:text-gray-300 pl-2">${day.slice(0, 3)}</div>
                                        ${shifts.map(sh => `<div class="flex justify-center"><input type="checkbox" class="p-avail-check accent-teal-500 w-4 h-4" value="${day}_${sh.id}" ${person?.disponibilidad?.includes(`${day}_${sh.id}`) ? 'checked' : ''}></div>`).join('')}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <button id="save-person" class="btn-premium w-full py-4 rounded-2xl mt-8 uppercase tracking-widest font-black text-xs shadow-2xl">Confirmar Registro</button>
            `, (modal) => {
                const genderSelect = modal.querySelector('#p-gender');
                const privsContainer = modal.querySelector('#privs-container');

                const updatePrivsList = () => {
                    const gender = genderSelect.value;
                    const malePrivs = ['Superintendente de Circuito', 'Anciano', 'Siervo ministerial', 'Conductor', 'Administrador'];
                    const femalePrivs = [];
                    const currentPrivs = person?.privilegios || [];
                    const list = gender === 'Hombre' ? malePrivs : femalePrivs;

                    privsContainer.innerHTML = list.map(pr => `
                        <label class="flex items-center gap-2 px-3 py-2 bg-black/5 dark:bg-white/5 rounded-xl border border-white/5 cursor-pointer hover:bg-teal-500/10 transition-colors">
                            <input type="checkbox" class="p-priv accent-teal-500 w-4 h-4" value="${pr}" ${currentPrivs.includes(pr) ? 'checked' : ''}>
                            <span class="text-xs font-bold text-gray-600 dark:text-gray-300">${pr}</span>
                        </label>
                    `).join('');
                };

                genderSelect.addEventListener('change', updatePrivsList);
                updatePrivsList();

                const isCondCheck = modal.querySelector('#p-is-cond');
                const availGrid = modal.querySelector('#p-avail-grid');
                isCondCheck.addEventListener('change', () => {
                    availGrid.classList.toggle('opacity-30', !isCondCheck.checked);
                    availGrid.classList.toggle('pointer-events-none', !isCondCheck.checked);
                });

                modal.querySelector('#save-person').onclick = async () => {
                    const btn = modal.querySelector('#save-person');
                    const original = btn.innerText;
                    btn.innerText = 'GUARDANDO...';
                    btn.disabled = true;

                    const data = {
                        nombre: modal.querySelector('#p-name').value.trim(),
                        telefono: modal.querySelector('#p-phone').value.trim(),
                        genero: modal.querySelector('#p-gender').value,
                        grupo: parseInt(modal.querySelector('#p-group').value),
                        es_conductor: isCondCheck.checked,
                        privilegios: Array.from(modal.querySelectorAll('.p-priv:checked')).map(cb => cb.value),
                        disponibilidad: isCondCheck.checked ? Array.from(modal.querySelectorAll('.p-avail-check:checked')).map(cb => cb.value) : []
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
                        loadSubTab('personal', container, config);
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
            loadSubTab('personal', container, config);
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

            <div class="mt-12 flex justify-center">
                <button id="save-groups" class="btn-premium px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl flex items-center gap-3">
                    <span>💾</span> Guardar Configuración de Grupos
                </button>
            </div>
        `;

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
                <button id="btn-csv" class="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center gap-2">
                    <span>📂</span> CSV
                </button>
            </div>
            
            <div class="flex gap-3 flex-wrap xl:justify-end">
                <div class="relative flex-1 xl:flex-none xl:w-64">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input type="text" id="search-number" placeholder="Buscar número, nombre..." class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none transition-shadow shadow-sm">
                </div>
                
                <select id="filter-publisher" class="flex-1 xl:flex-none xl:w-48 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:border-teal-500 outline-none cursor-pointer shadow-sm">
                    <option value="">Todos los Publicadores</option>
                    <option value="Sin asignar">Sin asignar</option>
                    ${publicadores.map(p => ` <option value="${p.nombre}">${p.nombre}</option > `).join('')}
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
            const { getSessionSummaries } = await import('../data/firestore-services.js?v=2.4.0');
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
    listDiv.className = 'bg-white dark:bg-[#0f1115] rounded-2xl border border-gray-200 dark:border-white/10 h-[600px] overflow-y-auto relative shadow-sm custom-scrollbar';
    container.appendChild(listDiv);

    // Render Logic with Filtering
    const renderList = () => {
        const listContainer = document.getElementById('phone-list-container');
        // Check if elements exist to avoid errors during tab switching
        if (!listContainer) return;

        const searchInput = document.getElementById('search-number');
        const pubFilterInput = document.getElementById('filter-publisher');
        const statusFilterInput = document.getElementById('filter-status');

        if (!searchInput || !pubFilterInput || !statusFilterInput) return;

        // Update Progress Bar
        const processed = telefonos.filter(t => t.estado && t.estado !== 'Sin asignar').length;
        const total = telefonos.length || 1;
        const pct = Math.floor((processed / total) * 100);
        const pBar = document.getElementById('cycle-progress-bar');
        const pPct = document.getElementById('cycle-percentage');
        const pInfo = document.getElementById('cycle-processed-info');
        if (pBar) pBar.style.width = pct + '%';
        if (pPct) pPct.textContent = pct + '%';
        if (pInfo) pInfo.textContent = `Procesados: ${processed} `;

        const searchVal = searchInput.value.toLowerCase();
        const pubFilter = pubFilterInput.value;
        const statusFilter = statusFilterInput.value;

        const filtered = telefonos.filter(t => {
            // Publisher Name Logic for Filtering
            const rawAssigned = t.asignado_a || t.publicador_asignado;
            let assignedName = 'Sin asignar';

            if (rawAssigned) {
                const p = publicadores.find(pub => pub.id === rawAssigned || pub.email === rawAssigned || pub.nombre === rawAssigned);
                if (p) assignedName = p.nombre;
            }

            const matchSearch = !searchVal || t.numero.toLowerCase().includes(searchVal) || (t.propietario && t.propietario.toLowerCase().includes(searchVal));

            // Fix: Check if rawAssigned is actually a specific person
            const isActuallyAssigned = rawAssigned && rawAssigned !== 'Sin asignar' && rawAssigned !== 'Pendiente';
            const matchPub = !pubFilter || (pubFilter === 'Sin asignar' ? !isActuallyAssigned : assignedName === pubFilter);

            // Status Logic: Treat 'Pendiente' or empty as 'Sin asignar'
            const currentStatus = (t.estado === 'Pendiente' || !t.estado) ? 'Sin asignar' : t.estado;
            const matchStatus = !statusFilter || (statusFilter === 'Sin asignar' ? currentStatus === 'Sin asignar' : currentStatus === statusFilter);

            return matchSearch && matchPub && matchStatus;
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `
        < div class="flex flex-col items-center justify-center h-full text-gray-400" >
                    <span class="text-4xl mb-2">🔍</span>
                    <p class="text-sm">No se encontraron registros</p>
                </div > `;
            return;
        }

        const getStatusBadge = (status) => {
            const colors = {
                'Sin asignar': 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
                'Contestaron': 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
                'No contestan': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
                'Colgaron': 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
                'Revisita': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
                'No llamar': 'bg-gray-800 text-white dark:bg-black/40',
                'Suspendido': 'bg-red-50 text-red-400 border border-red-100 dark:border-red-900',
                'Testigo': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
            };
            return `< span class="${colors[status] || colors['Sin asignar']} text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border border-black/5 dark:border-white/5 whitespace-nowrap shadow-sm" > ${status}</span > `;
        };

        listContainer.innerHTML = `
    < table class="w-full text-left text-sm text-gray-600 dark:text-gray-300" >
                <thead class="bg-gray-50 dark:bg-[#12141a] text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider sticky top-0 z-10 border-b border-gray-200 dark:border-white/5">
                    <tr>
                        <th class="p-4 font-bold">Propietario</th>
                        <th class="p-4 font-bold">Dirección</th>
                        <th class="p-4 font-bold">Número</th>
                        <th class="p-4 font-bold">Publicador</th>
                        <th class="p-4 font-bold text-center">Estado</th>
                        <th class="p-4 font-bold">Comentarios</th>
                        <th class="p-4 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                ${filtered.map(t => {
            // Resolve Publisher Name for Display
            const rawAssigned = t.asignado_a || t.publicador_asignado;
            let assignedDisplay = 'Sin asignar';
            let isAssigned = false;

            if (rawAssigned && rawAssigned !== 'Sin asignar' && rawAssigned !== 'Pendiente') {
                const p = publicadores.find(pub => pub.id === rawAssigned || pub.email === rawAssigned || pub.nombre === rawAssigned);
                if (p) {
                    assignedDisplay = p.nombre;
                    isAssigned = true;
                } else {
                    assignedDisplay = rawAssigned;
                    isAssigned = true;
                }
            }

            // Resolve Status
            const displayStatus = (!t.estado || t.estado === 'Pendiente') ? 'Sin asignar' : t.estado;

            // Custom Phone Format: XXX XXXX (for 7 digits)
            let phoneDisplay = t.numero || '';
            const cleanNum = phoneDisplay.replace(/\D/g, '');
            if (cleanNum.length === 7) {
                phoneDisplay = `${cleanNum.slice(0, 3)} ${cleanNum.slice(3)}`;
            } else {
                phoneDisplay = formatPhoneNumber(phoneDisplay); // Fallback to existing formatter
            }

            return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                        <td class="p-4">
                            <span class="block font-bold text-gray-900 dark:text-gray-100 uppercase text-sm">${t.propietario || '-'}</span>
                        </td>
                        <td class="p-4 text-xs uppercase text-gray-500 dark:text-gray-400">${t.direccion || '-'}</td>
                        <td class="p-4 font-mono text-teal-700 dark:text-teal-400 font-bold tracking-wide">${phoneDisplay}</td>
                        <td class="p-4">
                             ${isAssigned
                    ? `<span class="text-xs bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-800/30 font-medium">${assignedDisplay}</span>`
                    : `<span class="text-xs text-gray-400 italic">Sin asignar</span>`
                }
                        </td>
                        <td class="p-4 text-center">
                             ${getStatusBadge(displayStatus)}
                        </td>
                        <td class="p-4">
                            <div class="flex flex-col gap-1">
                                <span class="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[150px] block font-medium" title="${t.comentario || ''}">${t.comentario || '-'}</span>
                                ${t.ultima_observacion_ciclo ? `
                                    <span class="text-[9px] text-amber-600/70 dark:text-amber-400/50 italic border-l-2 border-amber-500/30 pl-2 mt-1" title="Ciclo Anterior: ${t.ultima_observacion_ciclo}">
                                        Anterior: ${t.ultima_observacion_ciclo.substring(0, 20)}...
                                    </span>
                                ` : ''}
                            </div>
                        </td>
                        <td class="p-4 text-right">
                             <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="window.editTelefonoAdmin('${t.id}')" class="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-1.5 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Editar">✏️</button>
                                <button onclick="window.deleteTelefonoAdmin('${t.id}')" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Eliminar">🗑️</button>
                             </div>
                        </td>
                    </tr>
                `;
        }).join('')}
                </tbody>
            </table >
    `;
    };

    // Filter Listeners
    const searchInput = document.getElementById('search-number');
    const pubFilterInput = document.getElementById('filter-publisher');
    const statusFilterInput = document.getElementById('filter-status');

    // Restore state
    if (currentSearch) searchInput.value = currentSearch;
    if (currentPub) pubFilterInput.value = currentPub;
    if (currentStatus) statusFilterInput.value = currentStatus;

    // Initial Render
    renderList();

    searchInput.addEventListener('input', renderList);
    pubFilterInput.addEventListener('change', renderList);
    statusFilterInput.addEventListener('change', renderList);

    window.deleteTelefonoAdmin = async (id) => {
        showCustomConfirm('¿Eliminar este registro?', async () => {
            await deleteTelefono(id);
            renderTelefonosTab(container);
        });
    };

    window.editTelefonoAdmin = async (id) => {
        const t = telefonos.find(x => x.id === id);
        if (!t) return;

        const estados = ['Sin asignar', 'Asignado', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];

        showModal(`
    < h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400" > Editar Registro Telefónico</h3 >

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
            document.getElementById('update-phone').addEventListener('click', async () => {
                const assignedTo = document.getElementById('edit-p-pub').value;
                const updateData = {
                    numero: document.getElementById('edit-p-num').value,
                    direccion: document.getElementById('edit-p-dir').value,
                    propietario: document.getElementById('edit-p-prop').value,
                    asignado_a: assignedTo,
                    estado: document.getElementById('edit-p-estado').value,
                    comentario: document.getElementById('edit-p-obs').value
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
                    // If it was assigned, reset status
                    if (updateData.estado === 'Asignado') updateData.estado = 'Sin asignar';
                }

                await updateTelefono(id, updateData);
                modal.classList.add('hidden');
                renderTelefonosTab(container);
            });
        });
    };

    document.getElementById('btn-csv').addEventListener('click', () => {
        document.getElementById('csv-upload').click();
    });

    document.getElementById('csv-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            let count = 0;

            // Show progress bar
            const progressContainer = document.getElementById('upload-progress-container');
            const progressBar = document.getElementById('upload-progress-bar');
            const progressText = document.getElementById('progress-text');
            const progressPercent = document.getElementById('progress-percent');

            progressContainer.classList.remove('hidden');

            const validLines = lines.filter(l => l.trim() && !l.toLowerCase().startsWith('numero') && !l.toLowerCase().startsWith('número'));
            const total = validLines.length;

            if (total === 0) {
                showCustomAlert("El archivo está vacío o no tiene formato válido.");
                progressContainer.classList.add('hidden');
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
                                propietario: name
                            });
                            count++;
                        }
                    } catch (err) { console.error(err); }
                }

                // Update progress every 5 items or last item
                if (i % 5 === 0 || i === total - 1) {
                    const percent = Math.round(((i + 1) / total) * 100);
                    progressBar.style.width = `${percent}% `;
                    progressPercent.innerText = `${percent}% `;
                    progressText.innerText = `Cargando ${i + 1} de ${total}...`;
                    // Allow UI to update
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            progressText.innerText = "Completado";
            progressBar.style.width = "100%";
            progressPercent.innerText = "100%";

            setTimeout(() => {
                progressContainer.classList.add('hidden');
                showCustomAlert(`Se cargaron ${count} teléfonos correctamente.`);
                renderTelefonosTab(container);
            }, 500);
        };
        reader.readAsText(file);
    });

    document.getElementById('btn-add-phone').addEventListener('click', () => {
        showModal(`
    < h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400" > Nuevo Teléfono</h3 >
            
            <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Número</label>
            <input type="text" id="new-p-num" placeholder="Ej. 0991234567" class="w-full mb-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
            
            <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Dirección</label>
            <input type="text" id="new-p-dir" placeholder="Ej. Av. Principal 123" class="w-full mb-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
            
            <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Propietario</label>
            <input type="text" id="new-p-prop" placeholder="Ej. Juan Pérez" class="w-full mb-4 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded p-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none">
            
            <button id="save-new-phone" class="w-full bg-teal-600 py-2 rounded-lg text-white hover:bg-teal-500 transition-colors font-bold shadow-lg shadow-teal-500/20">Guardar</button>
        `, async (modal) => {
            document.getElementById('save-new-phone').addEventListener('click', async () => {
                await addTelefono({
                    numero: document.getElementById('new-p-num').value,
                    direccion: document.getElementById('new-p-dir').value,
                    propietario: document.getElementById('new-p-prop').value
                });
                modal.classList.add('hidden');
                renderTelefonosTab(container);
                showCustomAlert("Teléfono agregado");
            });
        });
    });
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
                                                                <button id="export-pdf" class="flex items-center gap-2 bg-white/5 dark:bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl border border-white/10 dark:border-white/10 transition-colors">
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
    modalContainer.innerHTML = `
        <div class="w-full ${maxWidth} relative animate-fade-in bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 flex flex-col rounded-2xl shadow-2xl h-fit">
            <button class="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:hover:text-white z-50 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors" onclick="document.getElementById('modal-container').classList.add('hidden')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <div class="p-6">
                ${content}
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');
    if (onOpen) onOpen(modalContainer);
};

// showCustomAlert and showCustomConfirm were moved to top level
const renderProgramaTab = async (container) => {
    // FORCE Current Week Only as per user request
    const today = new Date();
    let currentWeekStart = getMonday(today);
    let programa = { dias: [] };

    // Helper for Auto-Save with automatic territory assignment
    const autoSave = async (dayIdx, turnId, field) => {
        const statusIndicator = document.getElementById('save-status');
        if (statusIndicator) statusIndicator.style.opacity = '1';

        try {
            const weekId = formatDateId(currentWeekStart);
            if (!weekId) throw new Error("Invalid weekId");

            await saveProgramaSemanal(weekId, programa);

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
                            <div class="flex flex-col items-center gap-1">
                                <div class="flex items-center bg-gray-50 dark:bg-black/60 rounded-lg border border-gray-200 dark:border-white/10 p-1 shadow-inner">
                                    <span id="range-label" class="mx-3 text-sm font-mono text-teal-700 dark:text-teal-300 min-w-[140px] text-center font-bold tracking-tight">
                                        Cargando...
                                    </span>
                                </div>
                                <div class="text-[9px] font-black text-teal-600 dark:text-teal-400/80 uppercase tracking-widest bg-teal-500/10 px-2 py-0.5 rounded-full">
                                    Semana en curso
                                </div>
                            </div>

                        <div class="flex flex-wrap items-center gap-2">
                             <button id="prev-week" class="p-2.5 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl hover:bg-teal-500/10 transition-all text-gray-500 hover:text-teal-600 shadow-sm">⬅️</button>
                             <div class="bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm shadow-black/5">
                                 <span class="text-xs font-black text-gray-400 uppercase tracking-widest hidden sm:inline">Semana</span>
                                 <span id="range-label-2" class="text-sm font-black text-teal-600 dark:text-teal-400 min-w-[120px] text-center tracking-tighter">Cargando...</span>
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
    const rangeLabel = document.getElementById('range-label'); // Changed from week-range-label
    const btnResetToday = document.getElementById('btn-reset-today'); // Changed from reset-today

    // Load Logic
    const loadWeekData = async () => {
        const overlay = container.querySelector('#prog-loading-overlay');
        const range = container.querySelector('#range-label');
        if (overlay) overlay.classList.remove('hidden');

        try {
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

            const label1 = container.querySelector('#range-label');
            const label2 = container.querySelector('#range-label-2');
            if (label1) label1.innerText = rangeText;
            if (label2) label2.innerText = rangeText;

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
                <div class="responsive-table-container relative z-10 custom-scrollbar">
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
                            <select onchange="window.updateProgramaField(${dayIndex}, '${turnoId}', '${fieldId}', this.value)"
                                    class="w-full bg-white dark:bg-black/20 text-gray-700 dark:text-gray-200 text-xs py-2 px-3 rounded-lg border border-white/10 focus:border-teal-500 outline-none transition-all shadow-sm cursor-pointer appearance-none hover:bg-gray-50/50 dark:hover:bg-white/5">
                                <option value="" ${!val ? 'selected' : ''}>${field}...</option>
                                ${opts.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
                                ${val && !opts.includes(val) ? `<option value="${val}" selected>${val}</option>` : ''}
                            </select>`;
                    } else if (field === 'Hora') {
                        inputHtml = `
                            <input type="time" value="${val}" 
                                   onchange="window.updateProgramaField(${dayIndex}, '${turnoId}', '${fieldId}', this.value)"
                                   class="w-full bg-white dark:bg-black/20 text-gray-700 dark:text-gray-200 text-xs py-2 px-3 rounded-lg border border-white/10 focus:border-teal-500 outline-none transition-all shadow-sm font-mono">`;
                    } else {
                        inputHtml = `
                            <input type="text" value="${val}" placeholder="${field}..."
                                   onchange="window.updateProgramaField(${dayIndex}, '${turnoId}', '${fieldId}', this.value)"
                                   class="w-full bg-white dark:bg-black/20 text-gray-700 dark:text-gray-200 text-xs py-2 px-3 rounded-lg border border-white/10 focus:border-teal-500 outline-none transition-all shadow-sm">`;
                    }

                    html += `
                        <div class="grid grid-cols-1 items-center gap-1.5 group/field">
                             <span class="text-[9px] font-bold text-gray-400 uppercase tracking-tight ml-1 flex items-center gap-1.5">
                                <span class="opacity-40 italic">${icon}</span> ${field}
                             </span>
                             ${inputHtml}
                        </div>`;
                }); // End fields loop

                html += `</div></td>`;
            }); // End turnos loop

            html += `</tr>`;
        }); // End dias loop

        html += `</tbody></table></div></div> `;

        tableContainer.innerHTML = html;
        loadingOverlay.classList.add('hidden');


        window.updateProgramaField = async (day, turn, field, value) => {
            if (!programa.dias[day][turn]) programa.dias[day][turn] = {};
            programa.dias[day][turn][field] = value;
            await autoSave(day, turn, field);
        };

    };
    document.getElementById('btn-reset-today')?.addEventListener('click', () => {
        currentWeekStart = getMonday(new Date());
        loadWeekData();
    });

    // Manual Save button removed as per request (now auto-save)

    // Next/Prev Week Handlers
    document.getElementById('prev-week')?.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        loadWeekData();
    });


    document.getElementById('next-week')?.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        loadWeekData();
    });

    // Clear Week Logic
    document.getElementById('btn-clear-week')?.addEventListener('click', async () => {
        showCustomConfirm('¿Estás seguro de que deseas BORRAR toda la programación de esta semana?', async () => {
            const btn = document.getElementById('btn-clear-week');
            if (btn) btn.innerHTML = '⌛';
            if (btn) btn.disabled = true;

            try {
                const weekId = formatDateId(currentWeekStart);
                await deleteProgramaSemanal(weekId);
                showNotification('Semana borrada exitosamente.', 'success');
                loadWeekData(); // Reload to show empty state/defaults
            } catch (e) {
                console.error(e);
                showNotification("Error borrando semana: " + e.message, "error");
            } finally {
                if (btn) {
                    btn.innerHTML = `<span class="group-hover:scale-110 transition-transform text-sm">🗑️</span> <span class="hidden lg:inline text-xs">Borrar</span>`;
                    btn.disabled = false;
                }
            }
        });
    });

    // --- Copy Previous Week Logic ---
    document.getElementById('btn-copy-prev')?.addEventListener('click', () => {
        showCustomConfirm("¿Copiar toda la programación de la semana pasada a esta semana?", async () => {
            const btn = document.getElementById('btn-copy-prev');
            if (!btn) return;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<span class="animate-spin">⌛</span>`;

            try {
                // Calculate previous week ID
                const prevDate = new Date(currentWeekStart);
                prevDate.setDate(prevDate.getDate() - 7);
                const prevWeekId = formatDateId(prevDate);

                const prevData = await getProgramaSemanal(prevWeekId);

                if (!prevData || !prevData.dias || prevData.dias.length === 0) {
                    showNotification("No hay programación en la semana anterior.", "warning");
                    return;
                }

                // Merge Data
                // Rule: We blindly overwrite slots with previous week data
                if (!programa.dias) programa.dias = [];

                prevData.dias.forEach((prevDia, idx) => {
                    if (!programa.dias[idx]) {
                        programa.dias[idx] = { nombre: prevDia.nombre, manana: {}, tarde: {}, noche: {}, zoom: {} };
                    }

                    // Copy slots
                    ['manana', 'tarde', 'noche', 'zoom'].forEach(turno => {
                        if (prevDia[turno]) {
                            // Clone object to break reference
                            programa.dias[idx][turno] = JSON.parse(JSON.stringify(prevDia[turno]));
                        }
                    });
                });

                renderTable();

                // Trigger bulk save
                const weekId = formatDateId(currentWeekStart);
                await saveProgramaSemanal(weekId, programa);

                // Auto-Assign copied territories
                const updates = [];
                programa.dias.forEach((d, dIdx) => {
                    ['manana', 'tarde', 'noche', 'zoom'].forEach(t => {
                        const tData = d[t];
                        if (tData && tData.territorio && tData.conductor) {
                            const parts = tData.territorio.split(',').map(s => s.trim());
                            for (const part of parts) {
                                const match = part.match(/^(\d+)(?:\s*\((.*)\))?$/);
                                if (match) {
                                    const num = match[1];
                                    const mzs = match[2];
                                    const cond = tData.conductor;
                                    const candidates = territorios.filter(terr => terr.numero == num);
                                    let targetId = null;
                                    if (mzs) {
                                        const mzsArr = mzs.split(',').map(m => m.trim());
                                        const perfectMatch = candidates.find(c => {
                                            if (!c.manzanas) return false;
                                            const cMzs = c.manzanas.split(',').map(s => s.trim());
                                            return mzsArr.every(m => cMzs.includes(m));
                                        });
                                        if (perfectMatch) targetId = perfectMatch.id;
                                        if (targetId) updates.push(assignTerritorioParcial(targetId, mzsArr, cond));
                                    } else if (candidates.length > 0) {
                                        targetId = candidates[0].id;
                                        updates.push(assignTerritorio(targetId, cond));
                                    }
                                }
                            }
                        }
                    });
                });

                if (updates.length > 0) await Promise.all(updates);
                showNotification("Programación copiada y guardada automáticamente. ✅", "success");

            } catch (error) {
                console.error("Copy Error:", error);
                showNotification("Error al copiar datos: " + error.message, "error");
            } finally {
                btn.innerHTML = originalHtml;
            }
        });
    });


    // --- Export PNG Logic ---
    // --- Export PNG Logic (Final Polish) ---
    document.getElementById('export-png')?.addEventListener('click', async () => {
        const btn = document.getElementById('export-png');
        if (!btn) return;
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<span>⏳</span>`;
        btn.disabled = true;

        try {
            const getDayDate = (offset) => {
                const d = new Date(currentWeekStart);
                d.setDate(d.getDate() + offset);
                return d.getDate();
            };

            const gv = (dayIndex, turn, field) => {
                const day = programa.dias[dayIndex];
                if (!day) return '';
                const t = day[turn];
                if (!t) return '';
                return t[field.toLowerCase()] || '';
            };

            const colors = {
                header: '#CCFFFF',

                mananaMain: '#FFCC00', // Gold (Vertical Bar)
                mananaLabel: '#FFE699',// Light Gold (Detail Column)
                mananaBg: '#FFF2CC',   // Pale Yellow (Data)

                tardeMain: '#ED7D31',  // Orange (Vertical Bar)
                tardeLabel: '#F8CBAD', // Peach (Detail Column)
                tardeBg: '#FCE4D6',    // Pale Orange (Data)

                nocheMain: '#4472C4',  // Blue (Vertical Bar)
                nocheLabel: '#B4C6E7', // Light Blue (Detail Column)
                nocheBg: '#D9E1F2',    // Pale Blue (Data)

                zoomMain: '#70AD47',    // Green (Vertical Bar)
                zoomLabel: '#C6E0B4',   // Light Green (Detail Column)
                zoomBg: '#E2EFDA'       // Pale Green (Data)
            };

            // Enhanced Styling
            const baseFont = "font-family: Arial, Helvetica, sans-serif;";
            const cellStyle = `${baseFont} padding: 4px 2px; border: 1px solid white; text-align: center; font-size: 13px; height: 26px; color: black; font-weight: 500; `;
            // Label column style
            const labelStyle = (bg) => `${baseFont} padding: 0 8px; border: 1px solid white; font-weight: bold; font-size: 11px; color: black; background-color: ${bg}; text-align: left; `;

            // Vertical Header Style (Fixed Rotation)
            // writing-mode: vertical-rl rotates text 90deg clockwise. rotate(180) flips it to read bottom-up.
            const verticalHeaderStyle = (bg) => `background-color: ${bg}; writing-mode: vertical-rl; transform: rotate(180deg); text-align: center; font-weight: bold; font-size: 14px; width: 35px; border: 1px solid white; color: black; letter-spacing: 2px; `;

            /* --- Light Theme Dashboard Layout Export --- */

            // Helper to get day name
            const getDayName = (idx) => ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][idx];
            const getDayLabel = (idx) => ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'][idx];

            const formatDateShort = (dateInput) => {
                if (!dateInput) return '';
                const d = new Date(dateInput);
                if (isNaN(d.getTime())) return '';
                const day = d.getDate();
                const month = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '').toUpperCase();
                return `${day} ${month}`;
            };



            const dashboardCellStyle = `
        padding: 8px;
        border: 1px solid #e5e7eb;
        min-height: 100px;
        vertical-align: top;
        font-size: 13px;
        width: 23 %; /* 4 columns approx equal */
        `;

            const rowHeaderStyle = `
        width: 8 %;
        background-color: #f3f4f6;
        color: #111827;
        font-weight: 800;
        text-align: center;
        vertical-align: middle;
        border: 1px solid #e5e7eb;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        `;

            const colHeaderStyle = (color) => `
        background-color: ${color};
        color: white;
        font-weight: 800;
        text-transform: uppercase;
        padding: 12px;
        font-size: 14px;
        letter-spacing: 0.05em;
        width: 23 %;
        `;

            const itemStyle = `
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
        color: #374151;
        `;

            const iconStyle = `
        font-size: 14px;
        width: 20px;
        text-align: center;
        color: #6b7280;
        `;

            // Helper to render content within a cell
            const renderTurnHTML = (t) => {
                if (!t || (!t.conductor && !t.lugar && !t.territorio && !t.hora))
                    return '';

                // Icons: 📍 Time, 👤 User, 👥 Group, 🏷️ Tag, 🗺️ Map
                return `
           <div style="display:flex; flex-direction:column; gap:2px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #f3f4f6;">
                ${t.grupos ? `
                        <div style="margin-bottom: 8px;">
                             <span style="background-color: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight:bold;">${t.grupos}</span>
                        </div>` : ''
                    }

                        ${t.lugar ? `
                        <div style="${itemStyle}">
                            <span style="${iconStyle}">📍</span>
                            <span style="font-weight:600; color:#111827;">${t.lugar}</span>
                        </div>` : ''
                    }

                        ${t.hora ? `
                        <div style="${itemStyle}">
                            <span style="${iconStyle}">⏰</span>
                            <span>${t.hora}</span>
                        </div>` : ''
                    }

                        ${t.conductor ? `
                        <div style="${itemStyle}">
                             <span style="${iconStyle}">👤</span>
                             <span style="font-weight:500;">${t.conductor}</span>
                        </div>` : ''
                    }

                         ${t.auxiliar ? `
                        <div style="${itemStyle}">
                             <span style="${iconStyle}">👥</span>
                             <span style="font-size:12px;">${t.auxiliar}</span>
                        </div>` : ''
                    }

                        ${t.faceta ? `
                        <div style="${itemStyle}">
                             <span style="${iconStyle}">🏷️</span>
                             <span style="font-size:12px; font-style:italic;">${t.faceta}</span>
                        </div>` : ''
                    }
                        
                        ${t.territorio ? `
                        <div style="${itemStyle}; margin-top:4px; border-top:1px dashed #e5e7eb; padding-top:4px;">
                             <span style="${iconStyle}">🗺️</span>
                             <span style="color:#059669; font-weight:700;">${t.territorio}</span>
                        </div>` : ''
                    }
                    </div>
    `;
            };

            const renderCellContent = (dayIndex, turnId) => {
                const d = programa.dias[dayIndex];
                if (!d || !d[turnId]) return '<div style="color:#d1d5db; font-style:italic; text-align:center; padding-top:20px;">-</div>';
                const html = renderTurnHTML(d[turnId]);
                return html || '<div style="color:#e5e7eb; font-style:italic; text-align:center;"></div>';
            };

            const html = `
   <div class="export-container" style="font-family: 'Roboto', sans-serif; background-color: white; padding: 30px; width: 1400px; color: #1f2937;">
                     <style>
                        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                     </style>

                    <!--Header -->
                    <div style="text-align:center; margin-bottom:24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px;">
                        <h1 style="font-size: 24px; font-weight: 800; color: #111827; text-transform: uppercase;">Congregación "Nueve de Octubre"</h1>
                        <h2 style="font-size: 16px; font-weight: 500; color: #4b5563; margin-top: 4px;">Programa de Predicación Semanal | <span style="color:#2563eb;">${formatDisplayDateRange(currentWeekStart)}</span></h2>
                    </div>

                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="width: 8%;"></th>
                                <th style="${colHeaderStyle('#0ea5e9')}">☀️ MAÑANA</th>
                                <th style="${colHeaderStyle('#f59e0b')}">⛅ TARDE</th>
                                <th style="${colHeaderStyle('#6366f1')}">🌙 NOCHE</th>
                                <th style="${colHeaderStyle('#10b981')}">📹 ZOOM</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${[0, 1, 2, 3, 4, 5, 6].map(dayIdx => {
                // Special Logic for Sunday (Index 6)
                if (dayIdx === 6) {
                    const d = programa.dias[6];
                    const allTurns = [d.manana, d.tarde, d.noche].filter(t => t && (t.conductor || t.lugar || t.hora));

                    // Sort by Hour if possible
                    allTurns.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

                    const stackedContent = allTurns.map(t => renderTurnHTML(t)).join('') || '<div style="color:#d1d5db; font-style:italic; text-align:center;">-</div>';

                    return `<tr>
                                        <td style="${rowHeaderStyle}">
                                            <div style="font-size:16px;">${getDayName(dayIdx)}</div>
                                            <div style="font-size:10px; color: #6b7280; font-weight:normal;">${getDayLabel(dayIdx)}</div>
                                            <div style="font-size:11px; margin-top:4px; font-weight:bold; color: #2563eb;">${getDayDate(dayIdx)}</div>
                                        </td>
                                        <td style="${dashboardCellStyle}" colspan="3"> <!-- Span across Manana, Tarde, Noche -->
                                             <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                                                ${stackedContent ? stackedContent : '<div style="grid-column: span 3; color:#d1d5db; text-align:center;">-</div>'}
                                             </div>
                                             <div style="text-align: center; color: #9ca3af; font-size: 10px; margin-top: 4px; border-top: 1px solid #f3f4f6; padding-top: 2px;">
                                                Asignaciones Consolidadas
                                             </div>
                                        </td>
                                        <td style="${dashboardCellStyle.replace('width: 23%', 'width: 23%')}"> <!-- Zoom stays separate -->
                                            ${renderCellContent(dayIdx, 'zoom')}
                                        </td>
                                    </tr>`;
                }

                return `
                                <tr>
                                    <td style="${rowHeaderStyle}">
                                        <div style="font-size:16px;">${getDayName(dayIdx)}</div>
                                        <div style="font-size:10px; color: #6b7280; font-weight:normal;">${getDayLabel(dayIdx)}</div>
                                        <div style="font-size:11px; margin-top:4px; font-weight:bold; color: #2563eb;">${getDayDate(dayIdx)}</div>
                                    </td>
                                    <td style="${dashboardCellStyle}">
                                        ${renderCellContent(dayIdx, 'manana')}
                                    </td>
                                    <td style="${dashboardCellStyle}">
                                        ${renderCellContent(dayIdx, 'tarde')}
                                    </td>
                                    <td style="${dashboardCellStyle}">
                                        ${renderCellContent(dayIdx, 'noche')}
                                    </td>
                                    <td style="${dashboardCellStyle}">
                                        ${renderCellContent(dayIdx, 'zoom')}
                                    </td>
                                </tr>
                            `;
            }).join('')}
                        </tbody>
                    </table>

                    <div style="margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px;">
                        <div>
                             <strong>DEPARTAMENTO DE TERRITORIOS</strong><br>
                             Italo Feijóo: 099 474 9286 • Paúl A. Quimís: 098 077 6844
                        </div>
                        <div style="text-align:right;">
                             <strong>CONEXIÓN ZOOM</strong><br>
                             ID: 883 665 43094 • Pascode: 909090
                        </div>
                    </div>
                </div>
    `;

            const containerBox = document.createElement('div');
            containerBox.style.position = 'absolute';
            containerBox.style.left = '-9999px';
            containerBox.style.top = '0';
            containerBox.innerHTML = html;
            document.body.appendChild(containerBox);

            await new Promise(resolve => setTimeout(resolve, 800));

            const canvas = await html2canvas(containerBox.firstElementChild, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            const link = document.createElement('a');
            link.download = `Programa_${formatDateId(currentWeekStart)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            document.body.removeChild(containerBox);
            showCustomAlert("Imagen generada con éxito 📷");

        } catch (error) {
            console.error("Export Error:", error);
            showCustomAlert("Error: " + error.message);
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });

    document.getElementById('export-excel')?.addEventListener('click', async () => {
        const btn = document.getElementById('export-excel');
        if (!btn) return;
        const originalContent = btn.innerHTML;
        try {
            btn.innerHTML = 'Scan...';
            btn.disabled = true;

            const config = await getConfiguracion();
            const congName = config.congregacion?.nombre || "NUEVE DE OCTUBRE";
            const congNum = config.congregacion?.numero || "14282";

            const getDate = (idx) => {
                const d = new Date(currentWeekStart);
                d.setDate(d.getDate() + idx);
                return d.getDate();
            };

            const styles = `
    <style >
     table { border-collapse: collapse; width: 100 %; font-family: Arial, sans-serif;}
th, td { border: 1px solid #000000; padding: 5px; text-align: center; font-size: 11px; vertical-align: middle;}
                    .header-main { background-color: #FFFFFF; font-size: 16px; font-weight: bold; border: none; padding-bottom: 2px;}
                    .header-sub { background-color: #FFFFFF; font-size: 14px; font-weight: bold; border: none; padding-bottom: 15px; border-bottom: 2px solid black;}

                    /* Headers Colors */
                    .col-header { background-color: #B4C6E7; font-weight: bold; border: 1px solid #000000;}

                    /* Side Column Colors (Left) */
                    .side-mañana { background-color: #FFC000; font-weight: bold; writing-mode: vertical-rl; transform: rotate(180deg); color: black; font-size: 12px;} 
                    .side-tarde { background-color: #ED7D31; font-weight: bold; writing-mode: vertical-rl; transform: rotate(180deg); color: black; font-size: 12px;}
                    .side-noche { background-color: #4472C4; color: white; font-weight: bold; writing-mode: vertical-rl; transform: rotate(180deg); font-size: 12px;}
                    .side-zoom { background-color: #70AD47; font-weight: bold; writing-mode: vertical-rl; transform: rotate(180deg); color: black; font-size: 12px;}

                    /* Detail Column Colors */
                    .row-yellow { background-color: #FFF2CC; font-weight: bold;}
                    .row-orange { background-color: #FCE4D6; font-weight: bold;}
                    .row-blue { background-color: #D9E1F2; font-weight: bold;}
                    .row-green { background-color: #E2EFDA; font-weight: bold;}

                    /* Data Cell Colors (Matching Detail Column) */
                    .bg-mañana { background-color: #FFF2CC;}
                    .bg-tarde { background-color: #FCE4D6;}
                    .bg-noche { background-color: #D9E1F2;}
                    .bg-zoom { background-color: #E2EFDA;}

                    /* Groups Column */
                    .bg-white-cell { background-color: #FFFFFF; vertical-align: top;}
                </style >
     `;

            // Helper to get safe value
            const gv = (dIndex, section, field) => {
                const day = programa.dias[dIndex];
                if (!day) return '';

                // Special handling for Sunday placement logic (matching the user's Excel)
                // Sunday Groups: G1 -> Noche(Physically Morning), G2 -> Tarde(Physically Morning), G3 -> Mañana(Physically Morning)
                // Actually based on image:
                // Mañana Row (Yellow) -> lists Group 3, 5 (Late Morning?)
                // Tarde Row (Orange) -> lists Group 2, 4
                // Noche Row (Blue) -> lists Group 1, 6

                // My data structure just has manana/tarde/noche.
                // If it's Sunday (Index 6):
                //   - If section is 'manana', we show Morning Group (Group 1 / Default)
                //   - If section is 'tarde', we show Afternoon Group (Group 2)
                //   - If section is 'noche', we show Night Group (Group 3)
                // Even if the time is 9:15 for all of them, they are stored in the respective "slots" in the JSON usually.
                // IF the user entered them all in "manana" in the UI, this might be blank for others.
                // BUT, in the UI (Conductor Dashboard), Sunday has 3 columns: Mañana, Tarde, Noche.
                // So assume data exists in the respective slots.

                const t = day[section];
                if (!t) return '';
                return t[field.toLowerCase()] || '';
            };

            const getGroupCol = (section) => {
                const sunday = programa.dias[6];
                if (sunday && sunday[section] && sunday[section].grupos) {
                    // "Grupos 1 y 2" -> "1 Y 2"
                    // If contains 'GRUPOS' or 'GRUPO'
                    const txt = sunday[section].grupos.toUpperCase();
                    let content = txt;
                    if (txt.includes('GRUPO')) {
                        content = txt.replace(/GRUPOS?/, '').trim();
                    }
                    return content;
                }
                return '';
            };

            const mon = getDate(0);
            const tue = getDate(1);
            const wed = getDate(2);
            const thu = getDate(3);
            const fri = getDate(4);
            const sat = getDate(5);
            const sun = getDate(6);

            const tableHtml = `
                ${styles}
<table>
    <!-- Title -->
    <tr>
        <td colspan="9" class="header-main">CONGREGACIÓN "${congName}" ${congNum}</td>
    </tr>
    <tr>
        <td colspan="9" class="header-sub">PROGRAMA DE PREDICACIÓN</td>
    </tr>
    <tr><td colspan="10" style="height: 10px;"></td></tr>

    <!-- Column Headers -->
    <tr>
        <th class="col-header" style="width: 30px;"></th>
        <th class="col-header" style="width: 100px;">DETALLE</th>
        <th class="col-header">LUNES ${mon}</th>
        <th class="col-header">MARTES ${tue}</th>
        <th class="col-header">MIÉRCOLES ${wed}</th>
        <th class="col-header">JUEVES ${thu}</th>
        <th class="col-header">VIERNES ${fri}</th>
        <th class="col-header">SÁBADO ${sat}</th>
        <th class="col-header">DOMINGO ${sun}</th>
        <th class="col-header">GRUPOS</th>
    </tr>

    <!-- MAÑANA SECTION -->
    ${['LUGAR', 'HORA', 'CONDUCTOR', 'AUXILIAR', 'FACETA', 'TERRITORIO'].map((field, i) => `
                        <tr>
                            ${i === 0 ? `<td rowspan="6" class="side-mañana">M<br>A<br>Ñ<br>A<br>N<br>A</td>` : ''}
                            <td class="row-yellow">${field}</td>
                            ${[0, 1, 2, 3, 4, 5, 6].map(d => `<td class="bg-mañana">${gv(d, 'manana', field)}</td>`).join('')}
                            ${i === 0 ? `<td rowspan="6" class="bg-white-cell" style="vertical-align:middle; text-align:center; border: 2px solid black; font-weight:bold;">${getGroupCol("manana")}</td>` : ''} 
                        </tr>
                    `).join('')}

    <!-- TARDE SECTION -->
    ${['LUGAR', 'HORA', 'CONDUCTOR', 'AUXILIAR', 'FACETA', 'TERRITORIO'].map((field, i) => `
                        <tr>
                             ${i === 0 ? `<td rowspan="6" class="side-tarde">T<br>A<br>R<br>D<br>E</td>` : ''}
                            <td class="row-orange">${field}</td>
                            ${[0, 1, 2, 3, 4, 5, 6].map(d => `<td class="bg-tarde">${gv(d, 'tarde', field)}</td>`).join('')}
                             ${i === 0 ? `<td rowspan="6" class="bg-white-cell" style="vertical-align:middle; text-align:center; border: 2px solid black; font-weight:bold;">${getGroupCol("tarde")}</td>` : ''}
                        </tr>
                    `).join('')}

    <!-- NOCHE SECTION -->
    ${['LUGAR', 'HORA', 'CONDUCTOR', 'AUXILIAR', 'FACETA', 'TERRITORIO'].map((field, i) => `
                        <tr>
                            ${i === 0 ? `<td rowspan="6" class="side-noche">N<br>O<br>C<br>H<br>E</td>` : ''}
                            <td class="row-blue">${field}</td>
                            ${[0, 1, 2, 3, 4, 5, 6].map(d => `<td class="bg-noche">${gv(d, 'noche', field)}</td>`).join('')}
                            ${i === 0 ? `<td rowspan="6" class="bg-white-cell" style="vertical-align:middle; text-align:center; border: 2px solid black; font-weight:bold;">${getGroupCol("noche")}</td>` : ''}
                        </tr>
                    `).join('')}

    <!-- ZOOM SECTION -->
    ${['LUGAR', 'HORA', 'CONDUCTOR', 'FACETA'].map((field, i) => `
                        <tr>
                            ${i === 0 ? `<td rowspan="4" class="side-zoom">Z<br>O<br>O<br>M</td>` : ''}
                            <td class="row-green">${field}</td>
                            ${[0, 1, 2, 3, 4, 5, 6].map(d => `<td class="bg-zoom">${gv(d, 'zoom', field)}</td>`).join('')}
                             ${i === 0 ? '<td rowspan="4"></td>' : ''}
                        </tr>
                    `).join('')}

    <tr><td colspan="9"></td></tr>
    <tr>
        <td colspan="9" style="text-align:center; font-size:10px;">
                            DEPARTAMENTO DE TERRITORIOS: [Italo Feijóo -> 099 474 9286 | Paúl A. Quimís -> 098 077 6844]<br>
                Zoom: [ ID: 883 665 43094 / Contraseña: 909090 ]
        </td>
    </tr>
</table>
`;

            const blob = new Blob(['\uFEFF', tableHtml], {
                type: 'application/vnd.ms-excel;charset=utf-8'
            });
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement("a");
            downloadLink.href = url;
            downloadLink.download = `Programa_${formatDateId(currentWeekStart)}.xls`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            showCustomAlert("Excel generado con éxito 📊");

        } catch (error) {
            console.error(error);
            showCustomAlert("Error generando Excel");
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });

    document.getElementById('export-excel-plain')?.addEventListener('click', async () => {
        const btn = document.getElementById('export-excel-plain');
        const originalContent = btn.innerHTML;
        try {
            btn.innerHTML = 'Scan...';
            btn.disabled = true;

            const gv = (dIndex, section, field) => {
                const day = programa.dias[dIndex];
                if (!day || !day[section]) return '';
                return day[section][field.toLowerCase()] || '';
            };

            const getGroupCol = (section) => {
                const sunday = programa.dias[6];
                if (!sunday || !sunday[section]) return '';
                return sunday[section].grupos || '';
            };

            const getDayLabel = (idx) => {
                const d = new Date(currentWeekStart);
                d.setDate(d.getDate() + idx);
                const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
                const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
                return `${days[d.getDay()]} ${d.getDate()} DE ${months[d.getMonth()]}`;
            };

            const plainStyles = `
                <style>
                    table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;}
                    th, td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 10pt; vertical-align: middle; color: #000; background-color: #FFF;}
                    .header { font-weight: bold; font-size: 14pt; border: none;}
                </style>
            `;

            let tableHtml = `
                ${plainStyles}
                <table>
                    <tr><td colspan="10" class="header">PROGRAMA SEMANAL</td></tr>
                    <tr><td colspan="10" class="header" style="padding-bottom:10px;">SEMANA DEL ${formatDisplayDateRange(currentWeekStart).toUpperCase()}</td></tr>
                    <tr>
                        <th style="width:100px;">TURNO</th>
                        <th style="width:100px;">DETALLE</th>
                        ${[0, 1, 2, 3, 4, 5, 6].map(i => `<th>${getDayLabel(i)}</th>`).join('')}
                        <th style="width:120px;">GRUPOS</th>
                    </tr>
            `;

            const sections = [
                { id: 'manana', label: 'MAÑANA', fields: ['LUGAR', 'HORA', 'CONDUCTOR', 'AUXILIAR', 'FACETA', 'TERRITORIO'] },
                { id: 'tarde', label: 'TARDE', fields: ['LUGAR', 'HORA', 'CONDUCTOR', 'AUXILIAR', 'FACETA', 'TERRITORIO'] },
                { id: 'noche', label: 'NOCHE', fields: ['LUGAR', 'HORA', 'CONDUCTOR', 'AUXILIAR', 'FACETA', 'TERRITORIO'] },
                { id: 'zoom', label: 'ZOOM', fields: ['LUGAR', 'HORA', 'CONDUCTOR', 'FACETA'] }
            ];

            sections.forEach(sec => {
                sec.fields.forEach((field, i) => {
                    tableHtml += `
                        <tr>
                            ${i === 0 ? `<td rowspan="${sec.fields.length}" style="font-weight:bold;">${sec.label}</td>` : ''}
                            <td style="font-weight:bold;">${field}</td>
                            ${[0, 1, 2, 3, 4, 5, 6].map(d => `<td>${gv(d, sec.id, field)}</td>`).join('')}
                            ${i === 0 ? `<td rowspan="${sec.fields.length}" style="font-weight:bold;">${getGroupCol(sec.id)}</td>` : ''}
                        </tr>
                    `;
                });
            });

            tableHtml += `</table>`;

            const blob = new Blob(['\uFEFF', tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement("a");
            downloadLink.href = url;
            downloadLink.download = `Plan_Semanal_${formatDateId(currentWeekStart)}_Plano.xls`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            showCustomAlert("Excel Plano generado con éxito 📋");
        } catch (error) {
            console.error(error);
            showCustomAlert("Error generando Excel");
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });

    // Table Event Delegation (One listener for lifecycle)
    tableContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        console.log('Action Click detected:', btn.dataset.action); // Debug

        const action = btn.dataset.action;
        const dayIndex = parseInt(btn.dataset.day);
        const turnId = btn.dataset.turn;
        const currentVal = btn.dataset.current;

        if (action === 'open-territory') {
            console.log('Event delegation: Opening territory modal');
            console.log('Territorios available:', territorios.length);
            console.log('Current value:', currentVal);

            showTerritorySelectionModal(currentVal, territorios, async (newValue) => {
                if (!programa.dias[dayIndex][turnId]) programa.dias[dayIndex][turnId] = {};
                programa.dias[dayIndex][turnId].territorio = newValue;

                // Update UI immediately (button might be re-rendered later but this gives instant feedback)
                btn.dataset.current = newValue.replace(/"/g, '&quot;');
                const spanState = btn.querySelector('span.truncate');
                if (spanState) {
                    spanState.textContent = newValue || 'Asignar';
                    spanState.className = `truncate font-mono ${newValue ? 'text-teal-300 font-medium' : 'text-gray-500 italic'}`;
                }

                await autoSave(dayIndex, turnId, 'territorio');
            });
        } else if (action === 'open-group') {
            showGroupSelectionModal(currentVal, async (newValue) => {
                if (!programa.dias[dayIndex][turnId]) programa.dias[dayIndex][turnId] = {};
                programa.dias[dayIndex][turnId].grupos = newValue;

                btn.dataset.current = newValue.replace(/"/g, '&quot;');
                const spanState = btn.querySelector('span.truncate');
                if (spanState) {
                    spanState.textContent = newValue || 'Seleccionar';
                    spanState.className = `truncate ${newValue ? 'text-teal-300 font-medium' : 'text-gray-500 italic'}`;
                }

                await autoSave(dayIndex, turnId, 'grupos');
            });
        }
    });
    loadWeekData();
};

const renderConfigTab = async (container, initialSubTab = 'reglas', appVersion) => {
    // Fetch config once for all sub-tabs
    const config = await getConfiguracion();

    container.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="flex-shrink-0 mb-4 border-b border-gray-200 dark:border-white/10 overflow-x-auto scrollbar-hide">
                <nav class="-mb-px flex space-x-4 md:space-x-8 min-w-max px-2" aria-label="Tabs">
                    <button data-subtab="reglas" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Reglas
                    </button>
                    <button data-subtab="congregacion" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Congregación
                    </button>
                    <button data-subtab="personal" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Personal 👤
                    </button>
                    <button data-subtab="grupos" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Grupos 🏘️
                    </button>
                    <button data-subtab="territorios" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Territorios
                    </button>

                    <button data-subtab="campanas" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Campañas
                    </button>
                    <button data-subtab="modulos" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Módulos
                    </button>
                    <button data-subtab="mantenimiento" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Mantenimiento
                    </button>
                </nav>
            </div>
            <div id="config-sub-content" class="flex-1 overflow-y-auto">
                <!-- Sub-tab content will be loaded here -->
            </div>
        </div>
    `;

    const subContent = document.getElementById('config-sub-content');
    const subTabs = container.querySelectorAll('.sub-tab-btn');

    const switchSubTab = async (targetSub) => {
        subTabs.forEach(btn => {
            if (btn.dataset.subtab === targetSub) {
                btn.classList.add('active', 'border-teal-500', 'text-teal-600', 'dark:text-teal-400');
                btn.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:text-gray-200');
            } else {
                btn.classList.remove('active', 'border-teal-500', 'text-teal-600', 'dark:text-teal-400');
                btn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:text-gray-200');
            }
        });

        subContent.innerHTML = '<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>';

        if (targetSub === 'reglas') {
            await renderReglasSubTab(subContent);
        } else if (targetSub === 'modulos') {
            await loadSubTab('modulos', subContent, config, appVersion);
        } else if (targetSub === 'congregacion') {
            await loadSubTab('congregacion', subContent, config, appVersion);
        } else if (targetSub === 'personal') {
            await loadSubTab('personal', subContent, config, appVersion);
        } else if (targetSub === 'grupos') {
            await loadSubTab('grupos', subContent, config, appVersion);
        } else if (targetSub === 'territorios') {
            await loadSubTab('territorios', subContent, config, appVersion);

        } else if (targetSub === 'campanas') {
            await loadSubTab('campanas', subContent, config, appVersion);
        } else if (targetSub === 'mantenimiento') {
            await loadSubTab('mantenimiento', subContent, config, appVersion);
        }
    };

    subTabs.forEach(btn => {
        btn.addEventListener('click', () => switchSubTab(btn.dataset.subtab));
    });

    // Initial defaults
    await switchSubTab(initialSubTab);
};

/* --- Missing Sub-Tab Implementations --- */

const renderReglasSubTab = async (container) => {
    const settings = await getGlobalSettings() || { expiration_days: 120, max_active_assignments: 0 };
    container.innerHTML = `
        <div class="p-6 max-w-2xl animate-fade-in">
            <h3 class="font-bold text-xl text-teal-800 dark:text-teal-100 mb-6 flex items-center gap-2">
                <span>⚖️</span> Reglas y Políticas del Sistema
            </h3>
            
            <div class="space-y-6">
                <div class="bg-white dark:bg-black/20 p-5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                    <label class="block text-sm font-bold text-gray-700 dark:text-teal-400 mb-2 uppercase tracking-wider">Expiración de Territorios (Días)</label>
                    <input type="number" id="regla-expiracion" value="${settings.expiration_days}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-3 text-gray-900 dark:text-white outline-none focus:border-teal-500">
                    <p class="text-[10px] text-gray-500 mt-2">Días recomendados para que un territorio vuelva a estar disponible si no ha sido informado.</p>
                </div>

                <div class="bg-white dark:bg-black/20 p-5 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                    <label class="block text-sm font-bold text-gray-700 dark:text-teal-400 mb-2 uppercase tracking-wider">Máximo de Asignaciones por Conductor</label>
                    <input type="number" id="regla-max-asign" value="${settings.max_active_assignments}" class="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-3 text-gray-900 dark:text-white outline-none focus:border-teal-500">
                    <p class="text-[10px] text-gray-500 mt-2">0 = Sin límite. Restringe cuántos territorios puede tener un conductor al mismo tiempo.</p>
                </div>

                <button id="btn-save-reglas" class="w-full bg-teal-600 hover:bg-teal-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2">
                    💾 Guardar Reglas del Sistema
                </button>
            </div>
        </div>
    `;

    container.querySelector('#btn-save-reglas').addEventListener('click', async () => {
        const btn = container.querySelector('#btn-save-reglas');
        btn.disabled = true;
        btn.innerHTML = '⏳ Guardando...';
        try {
            settings.expiration_days = parseInt(document.getElementById('regla-expiracion').value);
            settings.max_active_assignments = parseInt(document.getElementById('regla-max-asign').value);
            await saveGlobalSettings(settings);
            showNotification("Reglas actualizadas correctamente", "success");
        } catch (e) {
            showNotification("Error al guardar reglas", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = '💾 Guardar Reglas del Sistema';
        }
    });
};

const renderUsuariosSubTab = async (container) => {
    container.innerHTML = `
        <div class="p-10 text-center">
            <div class="text-4xl mb-4">👥</div>
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-200">Gestión de Usuarios</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-2">
                La gestión de acceso se basa en los correos electrónicos registrados en la pestaña <b>Conductores</b>.
            </p>
            <div class="mt-6 flex justify-center gap-4">
                 <button onclick="window.loadTab('config', 'conductores')" class="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-teal-500/20">Ir a Conductores</button>
            </div>
        </div>
    `;
};

/* --- Group Selection Modal --- */
const showGroupSelectionModal = (currentValue, onSave) => {
    // 12 Fixed Groups (can be dynamic if needed)
    const groups = Array.from({ length: 12 }, (_, i) => ({ id: 'g' + (i + 1), label: 'Grupo ' + (i + 1) }));

    // Parse current state
    const selectedLabels = new Set();
    const isTodos = (currentValue || '').toLowerCase().includes('todos');

    if (!isTodos && currentValue) {
        groups.forEach(g => {
            if (currentValue.includes(g.label) || currentValue.match(new RegExp('\\b' + g.label.replace('Grupo ', '') + '\\b'))) {
                selectedLabels.add(g.label);
            }
        });
    }

    const render = () => `
   <div class="flex flex-col h-[400px]">
            <header class="mb-4 border-b border-black/10 dark:border-white/10 pb-2">
                <h3 class="text-xl font-bold text-teal-600 dark:text-teal-400">Seleccionar Grupos de Predicación</h3>
                <p class="text-xs text-gray-500">Selecciona uno o varios grupos para este turno.</p>
            </header>
            
            <div class="flex-1 overflow-y-auto space-y-2 pr-2">
                <label class="flex items-center gap-3 p-3 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-white/10 cursor-pointer border border-transparent hover:border-teal-500/30 transition-all ${isTodos ? 'bg-teal-900/20 border-teal-500/50' : ''}">
                     <input type="checkbox" id="chk-todos-groups" class="accent-teal-500 w-5 h-5" ${isTodos ? 'checked' : ''}>
                     <span class="text-white font-bold">Todos</span>
                </label>
                <div class="grid grid-cols-2 gap-2">
                    ${groups.map(g => `
                        <label class="flex items-center gap-3 p-3 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-white/10 cursor-pointer group/g border border-transparent hover:border-teal-500/30 transition-all ${selectedLabels.has(g.label) ? 'bg-teal-900/10 border-teal-500/30' : ''}">
                            <input type="checkbox" value="${g.label}" class="accent-teal-500 w-5 h-5 group-chk" ${selectedLabels.has(g.label) ? 'checked' : ''}>
                            <span class="text-gray-700 dark:text-gray-300 group-hover/g:text-white">${g.label}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <div class="mt-4 flex justify-end gap-3 pt-4 border-t border-black/10 dark:border-white/10">
                 <button id="btn-cancel-groups" class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-white transition-colors">Cancelar</button>
                 <button id="btn-save-groups" class="px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white rounded-lg font-medium shadow-lg shadow-teal-500/20">Confirmar</button>
            </div>
        </div>
    `;

    showModal(render(), (modal) => {
        const chkTodos = modal.querySelector('#chk-todos-groups');
        const groupChks = modal.querySelectorAll('.group-chk');

        chkTodos.addEventListener('change', (e) => {
            if (e.target.checked) {
                groupChks.forEach(c => c.checked = false);
            }
        });

        groupChks.forEach(chk => {
            chk.addEventListener('change', () => {
                if (chk.checked) chkTodos.checked = false;
            });
        });

        modal.querySelector('#btn-cancel-groups').addEventListener('click', () => modal.classList.add('hidden'));

        modal.querySelector('#btn-save-groups').addEventListener('click', () => {
            if (chkTodos.checked) {
                onSave('Todos');
            } else {
                const selected = Array.from(groupChks).filter(c => c.checked).map(c => c.value);
                // Format: "Grupos 1, 2" or "Grupo 1"
                if (selected.length === 0) {
                    onSave('');
                } else if (selected.length === 1) {
                    onSave(selected[0]);
                } else {
                    const nums = selected.map(s => s.replace('Grupo ', '')).sort((a, b) => a - b);
                    // Format nicer: "Grupos 1, 2 y 3"
                    if (nums.length === 1) {
                        onSave('Grupo ' + nums[0]);
                    } else {
                        const last = nums.pop();
                        onSave('Grupos ' + nums.join(', ') + ' y ' + last);
                    }
                }
            }
            modal.classList.add('hidden');
        });
    });
};

/* --- Territory Selector Modal Logic --- */

const showTerritorySelectionModal = (currentValue, allTerritories, onSave) => {
    // Validación inicial: verificar que hay territorios configurados
    if (!allTerritories || allTerritories.length === 0) {
        showModal(`
            <div class="text-center p-8 bg-white dark:bg-gray-900 rounded-2xl">
                <div class="text-6xl mb-6 animate-bounce">📍</div>
                <h3 class="text-2xl font-black text-gray-900 dark:text-white mb-4">No hay territorios</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6 text-sm leading-relaxed">
                    Para poder asignar al programa semanal, primero debes configurar los territorios de la congregación.
                </p>
                <div class="bg-gray-50 dark:bg-black/40 border border-gray-100 dark:border-white/10 rounded-xl p-5 mb-8 text-left">
                    <p class="text-xs font-bold text-teal-600 dark:text-teal-400 mb-3 uppercase tracking-wider">Instrucciones:</p>
                    <ol class="text-xs text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside">
                        <li>Ve a <strong class="text-teal-600">Configuración</strong></li>
                        <li>Entra en <strong class="text-teal-600">Territorios</strong></li>
                        <li>Pulsa el botón <strong class="text-teal-600">+ Agregar</strong></li>
                    </ol>
                </div>
                <button onclick="document.getElementById('modal-container').classList.add('hidden')" 
                    class="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl font-bold shadow-xl shadow-teal-500/20 active:scale-95 transition-all">
                    Entendido
                </button>
            </div>
        `);
        return;
    }

    // 1. Parsing current value
    const selectionState = {};
    allTerritories.forEach(t => {
        selectionState[t.id] = {
            selected: false,
            partial: false,
            manzanas: [],
            allManzanas: t.manzanas ? t.manzanas.split(',').map(m => m.trim()).filter(Boolean) : []
        };
    });

    if (currentValue) {
        const normVal = currentValue;
        allTerritories.forEach(t => {
            const regex = new RegExp('\\\\b' + t.numero + '\\\\b');
            if (regex.test(normVal)) {
                selectionState[t.id].selected = true;
            }
        });
    }

    const renderModalContent = () => {
        return `
            <div class="flex flex-col text-left p-0">
                <header class="p-5 border-b border-gray-100 dark:border-white/5 shrink-0 bg-gradient-to-b from-white to-gray-50/30 dark:from-gray-900 dark:to-gray-900/50">
                    <div class="flex justify-between items-center mb-4">
                        <div>
                            <h3 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400">Seleccionar Territorios</h3>
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Varios pueden ser seleccionados para un mismo turno.</p>
                        </div>
                        <div class="px-3 py-1 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-bold rounded-full border border-teal-100 dark:border-teal-500/20 shadow-sm">
                            ${allTerritories.length} DISPONIBLES
                        </div>
                    </div>
                    
                    <!-- Search Bar -->
                    <div class="relative group">
                        <input type="text" id="terr-search" 
                            placeholder="Buscar por número o manzana..." 
                            class="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-700 dark:text-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all shadow-sm"
                            autocomplete="off">
                        <span class="absolute left-3.5 top-3 text-gray-400 group-focus-within:text-teal-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                    </div>
                </header>
                
                <div class="p-5 bg-gray-50/30 dark:bg-transparent">
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        ${allTerritories.map(t => {
            const state = selectionState[t.id];
            const isChecked = state.selected ? 'checked' : '';

            // Manzanas rendering
            const manzanasHtml = state.allManzanas.length > 0 ? `
                                <div class="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 ${isChecked ? '' : 'hidden'}" id="manzanas-${t.id}">
                                    <div class="flex flex-wrap gap-1.5">
                                        ${state.allManzanas.map(m => `
                                            <label class="cursor-pointer select-none group/mz">
                                                <input type="checkbox" class="hidden manzana-check peer" value="${m}" data-tid="${t.id}"
                                                    ${state.manzanas.includes(m) ? 'checked' : ''}>
                                                <span class="block text-[9px] px-2 py-1 rounded-md border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 bg-white dark:bg-white/5 hover:border-teal-500/50 peer-checked:bg-teal-500 peer-checked:text-white peer-checked:border-teal-500 peer-checked:shadow-lg peer-checked:shadow-teal-500/20 transition-all font-bold">
                                                    ${m.replace(/^Mz\./, '')}
                                                </span>
                                            </label>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : '';

            const isAssignedToOther = t.estado === 'Asignado' && t.asignado_a;

            return `
                                <div class="terr-item flex flex-col p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${isChecked
                    ? 'bg-white dark:bg-teal-500/10 border-teal-500 shadow-xl shadow-teal-500/10 ring-1 ring-teal-500'
                    : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/5 hover:border-teal-500/50 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-none translate-y-0 hover:-translate-y-1'}" 
                                     data-num="${t.numero}">
                                    <label class="flex items-start gap-3 cursor-pointer select-none w-full h-full">
                                        <div class="relative flex items-center h-5">
                                            <input type="checkbox" class="terr-check w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 transition-all cursor-pointer" value="${t.id}" ${isChecked}>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center justify-between mb-0.5">
                                                <div class="font-black text-gray-900 dark:text-gray-100 text-sm tracking-tight">T. ${t.numero}</div>
                                                ${isChecked ? '<span class="text-teal-500 animate-pulse">●</span>' : ''}
                                            </div>
                                            <div class="flex flex-col gap-0.5">
                                                <div class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">${state.allManzanas.length} Manzanas</div>
                                                ${isAssignedToOther ? `
                                                    <div class="flex items-center gap-1 mt-1">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                        <span class="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-tighter truncate">Ocupado: ${t.asignado_a}</span>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    </label>
                                    ${manzanasHtml}
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>

                <footer class="p-5 border-t border-gray-100 dark:border-white/5 flex justify-between items-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shrink-0">
                    <button class="px-6 py-2.5 text-xs font-bold text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors uppercase tracking-widest" onclick="document.getElementById('modal-container').classList.add('hidden')">
                        Cancelar
                    </button>
                    <button class="px-8 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl font-bold shadow-xl shadow-teal-500/20 active:scale-95 transition-all text-sm flex items-center gap-2" id="confirm-terr-selection">
                        <span>✅</span> Confirmar Selección
                    </button>
                </footer>
            </div>
        `;
    };

    showModal(renderModalContent(), (modal) => {
        const searchInput = modal.querySelector('#terr-search');

        // Focus search immediately
        setTimeout(() => searchInput.focus(), 100);

        // Search Filter Logic
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            modal.querySelectorAll('.terr-item').forEach(item => {
                const num = item.dataset.num.toLowerCase();
                // Match exact number or contains
                if (num.includes(term) || `territorio ${num} `.includes(term)) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        });

        // 1. Territory Checkbox Toggle
        modal.querySelectorAll('.terr-check').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const tId = e.target.value;
                selectionState[tId].selected = e.target.checked;

                // Toggle visual state of card
                const card = e.target.closest('.terr-item');
                if (e.target.checked) {
                    card.classList.add('border-teal-500', 'shadow-xl', 'shadow-teal-500/10', 'ring-1', 'ring-teal-500');
                    card.classList.remove('border-gray-100', 'dark:border-white/5', 'hover:shadow-lg');
                } else {
                    card.classList.remove('border-teal-500', 'shadow-xl', 'shadow-teal-500/10', 'ring-1', 'ring-teal-500');
                    card.classList.add('border-gray-100', 'dark:border-white/5', 'hover:shadow-lg');
                }

                const mDiv = document.getElementById(`manzanas-${tId}`);
                if (mDiv) {
                    if (e.target.checked) {
                        mDiv.classList.remove('hidden');
                    } else {
                        mDiv.classList.add('hidden');
                    }
                }
            });
        });

        // 2. Manzana Checkbox Toggle (Updated for compact labels)
        modal.addEventListener('change', (e) => {
            if (e.target.classList.contains('manzana-check')) {
                const tId = e.target.dataset.tid;
                const mVal = e.target.value;
                const checked = e.target.checked;

                if (checked) {
                    if (!selectionState[tId].manzanas.includes(mVal)) {
                        selectionState[tId].manzanas.push(mVal);
                    }
                } else {
                    selectionState[tId].manzanas = selectionState[tId].manzanas.filter(m => m !== mVal);
                }
                selectionState[tId].partial = selectionState[tId].manzanas.length > 0;
            }
        });

        // 3. Confirm Selection
        document.getElementById('confirm-terr-selection').addEventListener('click', () => {
            const selectedTerritories = [];

            Object.entries(selectionState).forEach(([tId, state]) => {
                if (state.selected) {
                    const t = allTerritories.find(item => item.id === tId);
                    if (state.manzanas.length > 0 && state.manzanas.length < state.allManzanas.length) {
                        // Partial (Specific Manzanas)
                        // Sort manzanas nicely: 1, 2, 3...
                        const sortedMz = state.manzanas.sort((a, b) => {
                            const numA = parseInt(a.replace(/\D/g, '')) || 0;
                            const numB = parseInt(b.replace(/\D/g, '')) || 0;
                            return numA - numB;
                        });
                        selectedTerritories.push(`${t.numero} (${sortedMz.join(', ')})`);
                    } else {
                        // Full Territory
                        selectedTerritories.push(t.numero);
                    }
                }
            });

            // Sort by territory number
            selectedTerritories.sort((a, b) => {
                const numA = parseInt(a.split(' ')[0]);
                const numB = parseInt(b.split(' ')[0]);
                return numA - numB;
            });

            onSave(selectedTerritories.join(', '));
            document.getElementById('modal-container').classList.add('hidden');
        });
    }, 'max-w-4xl');
};








