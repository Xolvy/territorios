// --- Imports ---
import {
    getConfiguracion, saveConfiguracion, getSystemVersion, setSystemVersion,
    getTerritorios, addTerritorio, deleteTerritorio, updateTerritorio, assignTerritorioParcial, assignTerritorio, returnTerritorio, transferTerritory, getTerritoryHistory, cancelarAsignacion, updateAssignmentData,
    getConductores, addConductor, deleteConductor, updateConductor,
    getPublicadores, addPublicador, deletePublicador, updatePublicador,
    getTelefonos, addTelefono, deleteTelefono, updateTelefono,
    getPredicacionPublica, savePredicacionPublica,
    getProgramaSemanal, saveProgramaSemanal, rebuildHistoryFromSchedule, runSystemDiagnosticsAndRepair, deleteProgramaSemanal,
    getRecursos, addRecurso, deleteRecurso, updateRecurso
} from '../data/firestore-services.js?v=5.0.3';
import { formatPhoneNumber, getStatusColor, showNotification, formatMapUrl } from './utils/helpers.js?v=5.0.3';
import { TerritoryIntelligence } from './utils/intelligence.js?v=5.0.3';
import { renderHistoryTab } from './report-s13.js?v=5.0.3';
import { renderAnalyticsView } from './analytics-view.js?v=5.0.3';
import { getGlobalSettings, saveGlobalSettings } from '../data/firestore-services.js?v=5.0.2';
import { auth } from '../firebase-config.js';

// --- Module Level Globals (Cache/Scope Guard) ---
let _globalTerritorios = [];
let _globalPrograma = null;

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
                span.className = `truncate font-mono ${newValue ? 'text-teal-300 font-medium' : 'text-gray-500 italic'}`;
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
                span.className = `truncate ${newValue ? 'text-teal-300 font-medium' : 'text-gray-500 italic'}`;
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
                <nav class="lg:col-span-1 morphinglass-card h-fit flex flex-col gap-2 relative lg:sticky lg:top-4 z-20">
                    <button class="tab-btn ${initialTab === 'dashboard' ? 'active text-teal-600 dark:text-teal-300 font-medium bg-black/5 dark:bg-white/10' : 'text-gray-700 dark:text-gray-400'} text-left p-3 rounded-lg hover:bg-black/5 dark:bg-white/5 transition-colors" data-tab="dashboard">
                        📊 Panel de Control
                    </button>
                    <button class="tab-btn ${initialTab === 'casa-en-casa' ? 'active text-teal-600 dark:text-teal-300 font-medium bg-black/5 dark:bg-white/10' : 'text-gray-700 dark:text-gray-400'} text-left p-3 rounded-lg hover:bg-black/5 dark:bg-white/5 transition-colors" data-tab="casa-en-casa">
                        🏘️ Predicación de casa en casa
                    </button>
                    <button class="tab-btn ${initialTab === 'predicacion' ? 'active text-teal-600 dark:text-teal-300 font-medium bg-black/5 dark:bg-white/10' : 'text-gray-700 dark:text-gray-400'} text-left p-3 rounded-lg hover:bg-black/5 dark:bg-white/5 transition-colors" data-tab="predicacion">
                        📢 Predicación Pública
                    </button>
                    <button class="tab-btn ${initialTab === 'telefonos' ? 'active text-teal-600 dark:text-teal-300 font-medium bg-black/5 dark:bg-white/10' : 'text-gray-700 dark:text-gray-400'} text-left p-3 rounded-lg hover:bg-black/5 dark:bg-white/5 transition-colors" data-tab="telefonos">
                        📞 Predicación Telefónica
                    </button>
                    <button class="tab-btn ${initialTab === 'historial' ? 'active text-teal-600 dark:text-teal-300 font-medium bg-black/5 dark:bg-white/10' : 'text-gray-700 dark:text-gray-400'} text-left p-3 rounded-lg hover:bg-black/5 dark:bg-white/5 transition-colors" data-tab="historial">
                        📄 Exportar S-13
                    </button>
                    
                    <div class="h-4"></div> <!-- Spacer -->

                    <button class="tab-btn ${initialTab === 'config' ? 'active text-teal-600 dark:text-teal-300 font-medium bg-black/5 dark:bg-white/10' : 'text-gray-700 dark:text-gray-400'} text-left p-3 rounded-lg hover:bg-black/5 dark:bg-white/5 transition-colors" data-tab="config">
                        ⚙️ Configuración
                    </button>
                    <!-- AI is now Floating -->
                </nav>

                <!-- Content -->
                <div class="lg:col-span-4 morphinglass-card min-h-[600px]" id="admin-content">
                    <!-- Dynamic Content -->
                </div>
            </div>
        </div>
        
        <!-- Modal Container -->
        <div id="modal-container" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center z-50"></div>
    `;

        document.getElementById('logout-btn').addEventListener('click', async () => {
            localStorage.removeItem('demo_role');
            await auth.signOut();
            window.location.href = '/login'; // Redirect to login route
        });

        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active state from all
                tabs.forEach(t => {
                    t.classList.remove('text-teal-600', 'dark:text-teal-300', 'font-medium', 'bg-black/5', 'dark:bg-white/10');
                    t.classList.add('text-gray-700', 'dark:text-gray-400');
                });

                // Add active state to clicked
                const target = e.currentTarget;
                target.classList.remove('text-gray-700', 'dark:text-gray-400');
                target.classList.add('text-teal-600', 'dark:text-teal-300', 'font-medium', 'bg-black/5', 'dark:bg-white/10');

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

        loadTab(initialTab);
        renderAdminAI();
        // Move closing brace of renderAdminDashboard to the end of file or proper scoping block.
        // The previous edit likely truncated the function or blocked scope incorrectly at line 171?
        // Wait, line 171 shows '};'.
        // And then line 173 starts `const loadTab`.
        // This implies `loadTab` is defined OUTSIDE `renderAdminDashboard`? But it uses `renderConfigTab` which is below?
        // Ah, `renderAdminDashboard` seems to end at 171 based on this view.
        // BUT `renderConfigTab` is defined at line 984 (later in file).
        // If `renderAdminDashboard` ends at 171, `renderConfigTab` is undefined unless hoisted or imported. 
        // Usually these are helper functions INSIDE the module scope but outside the render function.
        // Let's check where `renderAdminDashboard` started. It started at line 82.
        // The lint error said "'catch' or 'finally' expected". This usually means a try block wasn't closed or something.
        // Line 64 in previous view showed a `try {`.
        // It seems `renderAdminDashboard` opens a `try` block.
        // Line 171 `};` suggests the function ends, but the `try` block inside might not be closed?
        // Let's close the try/catch block if it was left open.

        // Actually, looking at the previous REPLACE output (Step 125):
        /*
        export const renderAdminDashboard = async (container, appVersion) => { 
            try {
                if (appVersion) { ... }
                
                container.innerHTML = `...`; // This was the replacement
        */
        // The `try` block was opened but never closed in the replace block provided in Step 125?
        // Wait, the replace block REPLACED `container.innerHTML = ...`
        // It did NOT close the try block.
        // So the code currently looks like:
        /*
        export const renderAdminDashboard = async (container, appVersion) => {
            try {
                 ...
                 container.innerHTML = `...`;
                 
                 // listeners...
                 
                 loadTab('config');
                 renderAdminAI();
            }; // This is line 171
        */
        // The `try` block is NOT closed. It hits `};` which closes the function? No, `};` closes the block?
        // We need to add `} catch (e) { console.error(e); }` before the function closes.

    } catch (e) {
        console.error("Error in Admin Dashboard:", e);
        showNotification("Error cargando panel: " + e.message, "error");
    }
};

const loadTab = async (tabName) => {
    const contentDiv = document.getElementById('admin-content');
    contentDiv.innerHTML = '<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>';

    if (tabName === 'config') {
        await renderConfigTab(contentDiv);
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
        </button>

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

        log.innerHTML += `<div class="flex justify-end"><div class="bg-teal-600/80 text-white px-3 py-2 rounded-lg rounded-tr-none text-xs max-w-[85%]">${prompt}</div></div>`;
        log.scrollTop = log.scrollHeight;
        input.value = '';
        input.disabled = true;

        const loadingId = 'loading-' + Date.now();
        log.innerHTML += `<div id="${loadingId}" class="text-gray-500 text-[10px] animate-pulse">Procesando comando...</div>`;
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
                        const [tId, cName] = commandContent.split(':');
                        if (tId && cName) {
                            await assignTerritorio(tId, cName);
                            actionLogs += `<div class="text-green-400 text-[10px] mt-1 p-1 bg-green-500/10 border border-green-500/20 rounded">✅ Asignado: <b>${tId}</b> a <b>${cName}</b></div>`;
                            showNotification(`IA: Asignado territorio ${tId} a ${cName}`);
                        }
                    }
                } catch (e) {
                    console.error("AI Action Error:", e);
                    actionLogs += `<div class="text-red-400 text-[10px] mt-1">❌ Error: ${e.message}</div>`;
                }
            }

            document.getElementById(loadingId).remove();

            const htmlResponse = responseText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

            log.innerHTML += `<div class="flex justify-start flex-col gap-1 max-w-[90%]">
                <div class="bg-white/10 text-gray-200 px-3 py-2 rounded-lg rounded-tl-none text-xs border border-white/5">
                    ${htmlResponse}
                </div>
                ${actionLogs}
            </div>`;

        } catch (err) {
            console.error(err);
            if (document.getElementById(loadingId)) document.getElementById(loadingId).remove();
            log.innerHTML += `<div class="text-red-400 text-[10px] p-2">Error: ${err.message}</div>`;
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
        <h2 class="text-xl font-bold mb-6 border-b border-black/10 dark:border-white/10 pb-2 text-teal-800 dark:text-teal-100">Predicación de Casa en Casa</h2>
        
        <div class="flex flex-wrap gap-2 mb-6 text-sm border-b border-black/10 dark:border-white/10 pb-4">
            <button class="sub-tab-casa active bg-teal-500/20 text-teal-800 dark:text-teal-200 px-4 py-2 rounded-lg border border-teal-500/30 transition-all font-medium" data-sub="asignaciones">
                📋 Asignaciones Activas
            </button>
            <button class="sub-tab-casa bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10 transition-all" data-sub="territorios">
                🗺️ Gestión de Territorios
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
        } else if (sub === 'territorios') {
            await loadSubTab('territorios', subContainer, config);
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
                             <button onclick="window.editRecourso('${r.id}')" class="bg-blue-500/80 hover:bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors" title="Editar">✏️</button>
                             <button onclick="window.deleteRecourso('${r.id}')" class="bg-red-500/80 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors" title="Eliminar">🗑️</button>
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
            <h3 class="text-xl font-bold mb-4 text-teal-800 dark:text-teal-200">Agregar Nueva Ayuda</h3>
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
    window.deleteRecourso = async (id) => {
        if (confirm("¿Eliminar este recurso?")) {
            await deleteRecurso(id);
            renderRecursosTab(container);
        }
    };

    // Expose edit
    window.editRecourso = (id) => {
        const recurso = recursos.find(r => r.id === id);
        if (!recurso) return;

        showModal(`
            <h3 class="text-xl font-bold mb-4 text-teal-800 dark:text-teal-200">Editar Ayuda</h3>
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
    const territorios = await getTerritorios();
    const conductores = await getConductores();
    const programa = await getProgramaSemanal();
    const asignados = territorios.filter(t => t.estado === 'Asignado' || t.estado === 'Pendiente' || (t.asignado_a && t.asignado_a !== 'Sin asignar'));

    // Determine "Late" threshold based on current day
    const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon
    const currentDayNorm = todayIndex === 0 ? 6 : todayIndex - 1;

    // Helper to find assigned day
    const getAssignedDayIndex = (terrNum) => {
        if (!programa || !programa.dias) return -1;
        for (let i = 0; i < programa.dias.length; i++) {
            const d = programa.dias[i];
            if (['manana', 'tarde', 'noche'].some(turn => d[turn] && d[turn].territorio && d[turn].territorio.includes(terrNum))) {
                return i;
            }
        }
        return -1;
    };
    const handleReassign = async (territoryId, territoryNum, currentConductor) => {
        const t = territorios.find(x => x.id === territoryId);
        const manzanas = t && t.manzanas ? t.manzanas.split(',').map(s => s.trim()).filter(Boolean) : [];

        let checksHtml = '';
        if (manzanas.length > 0) {
            checksHtml = `
            <div class="mb-4">
                <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Manzanas Pendientes</label>
                <div class="grid grid-cols-3 gap-2 bg-white dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/10 max-h-32 overflow-y-auto custom-scrollbar shadow-inner">
                    ${manzanas.map(m => `
                        <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-gray-300 cursor-pointer hover:bg-teal-50 dark:hover:bg-white/5 p-1 rounded transition-colors select-none">
                            <input type="checkbox" value="${m}" class="reassign-apple-check accent-teal-600 w-4 h-4 rounded border-gray-300" checked>
                            <span class="font-medium">${m}</span>
                        </label>
                    `).join('')}
                </div>
                <p class="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Desmarca las manzanas que ${currentConductor} YA terminó.
                </p>
            </div>`;
        }

        showModal(`
            <h3 class="text-xl font-bold mb-4 text-teal-800 dark:text-teal-200">Reasignar Territorio ${territoryNum}</h3>
            <div class="mb-4 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/30">
                <p class="text-xs text-yellow-800 dark:text-yellow-200">
                    <span class="font-bold">Nota:</span> Se cerrará la asignación de <span class="font-bold">${currentConductor}</span> (Devuelto) y se creará una nueva para el conductor seleccionado.
                </p>
            </div>

            ${checksHtml}

            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nuevo Conductor</label>
            <div class="relative">
                <select id="new-conductor-select" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all appearance-none text-gray-900 dark:text-gray-200 shadow-sm font-medium">
                    <option value="" disabled selected>Seleccionar...</option>
                    ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `<option value="${c.nombre}" class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200">${c.nombre}</option>`).join('')}
                </select>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-teal-600 dark:text-teal-400">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </div>
            </div>
            <button id="confirm-reassign" class="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl mt-6 shadow-lg shadow-teal-500/20 transition-all">
                Confirmar Reasignación
            </button>
        `, async (modal) => {
            const btn = modal.querySelector('#confirm-reassign');
            const select = modal.querySelector('#new-conductor-select');

            btn.addEventListener('click', async () => {
                const newConductor = select.value;
                if (!newConductor) return showNotification("Selecciona un conductor", "warning");
                if (newConductor === currentConductor) return showNotification("El nuevo conductor es el mismo que el actual", "warning");

                // Get selected apples
                const selectedChecks = modal.querySelectorAll('.reassign-apple-check:checked');
                const selectedManzanas = Array.from(selectedChecks).map(c => c.value);

                if (manzanas.length > 0 && selectedManzanas.length === 0) {
                    return showNotification("Debes asignar al menos una manzana al nuevo conductor.", "warning");
                }

                btn.innerHTML = `<span class="animate-spin">🌀</span> Procesando...`;
                btn.disabled = true;

                try {
                    // Logic Switch: Full Reassign vs Transfer
                    const applesString = selectedManzanas.join(', ');

                    if (manzanas.length === 0 || selectedManzanas.length === manzanas.length) {
                        // Full Reassign (No apples defined OR All apples selected)
                        // This behaves as "Devuelto" -> "Asignado Fully"
                        await transferTerritory(territoryId, newConductor, t.manzanas || '');
                        // Note: transferTerritory sets Old to Devuelto, then updates T to New Conductor.
                        // If apples were defined, it preserves them.
                    } else {
                        // Partial Transfer
                        await transferTerritory(territoryId, newConductor, applesString);
                    }

                    // 3. Sync with Weekly Program (Best Effort)
                    const currentWeekId = formatDateId(getMonday(new Date()));
                    const program = await getProgramaSemanal(currentWeekId);

                    if (program && program.dias) {
                        let updated = false;
                        program.dias.forEach(d => {
                            ['manana', 'tarde', 'noche'].forEach(turn => {
                                if (d[turn] && d[turn].territorio) {
                                    // Match exact number logic "101" inside "101 (Mz...)"
                                    if (d[turn].territorio.includes(territoryNum.toString())) {
                                        d[turn].conductor = newConductor;
                                        updated = true;
                                    }
                                }
                            });
                        });

                        if (updated) {
                            await saveProgramaSemanal(program, currentWeekId);
                            showNotification("Programa Semanal actualizado", "success");
                        }
                    }

                    showNotification(`Territorio ${territoryNum} transferido a ${newConductor}`);
                    modal.classList.add('hidden');
                    // Reload view
                    renderAsignacionesView(container);

                } catch (e) {
                    console.error(e);
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerText = "Confirmar Reasignación";
                }
            });
        });
    };

    const handleEdit = async (territoryId, territoryNum, currentDateStr, currentConductor, currentStatus) => {
        const dateVal = currentDateStr ? new Date(currentDateStr).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10);
        const statuses = ['Asignado', 'Pendiente', 'Disponible', 'Predicado'];

        showModal(`
            <h3 class="text-xl font-bold mb-4 text-teal-800 dark:text-teal-200">Editar Asignación ${territoryNum}</h3>
            
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fecha de Asignación</label>
            <input type="date" id="edit-date-input" value="${dateVal}" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-teal-500 text-gray-900 dark:text-white mb-4">

            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estado</label>
            <select id="edit-status-input" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-teal-500 text-gray-900 dark:text-white mb-6">
                ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
            </select>

            <button id="confirm-edit" class="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-500/20 transition-all">
                Guardar Cambios
            </button>
        `, async (modal) => {
            const btn = modal.querySelector('#confirm-edit');
            const dateInput = modal.querySelector('#edit-date-input');
            const statusInput = modal.querySelector('#edit-status-input');

            btn.addEventListener('click', async () => {
                const newDate = dateInput.value;
                const newStatus = statusInput.value;

                if (!newDate) return showNotification("Fecha requerida", "warning");

                btn.innerHTML = `<span class="animate-spin">🌀</span> Guardando...`;
                btn.disabled = true;

                try {
                    // If changing from Asignado to Predicado via EDIT, we might want to warn or handle special?
                    // For now, we utilize the raw update which corrects the record. 
                    // If they mark Predicado here, it won't unassign automatically unless we do logic, 
                    // but normally Predicado implies no conductor.
                    // Let's assume this is for CORRECTION.

                    await updateAssignmentData(territoryId, new Date(newDate).toISOString(), null, newStatus);
                    showNotification("Datos actualizados");
                    modal.classList.add('hidden');
                    renderAsignacionesView(container);
                } catch (e) {
                    console.error(e);
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerText = "Guardar Cambios";
                }
            });
        });
    };

    const handleReturn = async (territoryId, territoryNum) => {
        showModal(`
            <h3 class="text-xl font-bold mb-4 text-teal-800 dark:text-teal-200">Completar Territorio ${territoryNum}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Si esta asignación pertenece a un programa anterior, selecciona la fecha real en la que se terminó.
            </p>
            
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fecha de Finalización</label>
            <input type="date" id="return-date-picker" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-teal-500 text-gray-900 dark:text-white mb-6" value="${new Date().toISOString().substring(0, 10)}">

            <div class="flex gap-3">
                 <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="flex-1 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all">Cancelar</button>
                 <button id="confirm-return-date" class="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-500/20 transition-all">TERMINAR</button>
            </div>
        `, (modal) => {
            const btn = modal.querySelector('#confirm-return-date');
            const dateInput = modal.querySelector('#return-date-picker');

            btn.addEventListener('click', async () => {
                const selectedDate = dateInput.value;
                if (!selectedDate) return showNotification("Selecciona una fecha válida", "warning");

                btn.innerHTML = '<span class="animate-spin">🌀</span> Procesando...';
                btn.disabled = true;

                try {
                    // Pass the custom date to returnTerritorio
                    await returnTerritorio(territoryId, null, selectedDate);
                    showNotification(`Territorio ${territoryNum} marcado como terminado el ${selectedDate}`);
                    modal.classList.add('hidden');
                    renderAsignacionesView(container);
                } catch (e) {
                    console.error(e);
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerText = "TERMINAR";
                }
            });
        });
    };


    const handleDelete = async (territoryId, territoryNum) => {
        showModal(`
            <h3 class="text-xl font-bold mb-4 text-red-600 dark:text-red-400">Eliminar Asignación</h3>
            <p class="text-gray-700 dark:text-gray-300 mb-6">
                ¿Estás seguro de que deseas eliminar la asignación del territorio <b>${territoryNum}</b>? 
                <br><br>
                <span class="text-sm text-red-500">Esto devolverá el territorio a estado 'Disponible' y <b>cancelará</b> el registro en el historial como si no hubiera sido asignado.</span>
            </p>

            <div class="flex gap-4">
                <button id="cancel-delete" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-xl transition-colors">Cancelar</button>
                <button id="confirm-delete" class="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-500/20 transition-all">
                    Sí, Eliminar
                </button>
            </div>
        `, async (modal) => {
            modal.querySelector('#cancel-delete').onclick = () => modal.classList.add('hidden');

            const btn = modal.querySelector('#confirm-delete');
            btn.addEventListener('click', async () => {
                btn.innerHTML = `<span class="animate-spin">🌀</span> Eliminando...`;
                btn.disabled = true;

                try {
                    await cancelarAsignacion(territoryId);
                    showNotification("Asignación eliminada");
                    modal.classList.add('hidden');
                    renderAsignacionesView(container);
                } catch (e) {
                    console.error(e);
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerText = "Sí, Eliminar";
                }
            });
        });
    };

    const handleHistory = async (territoryId, territoryNum) => {
        const historyData = await getTerritoryHistory(territoryId);
        showModal(`
            <h3 class="text-xl font-bold mb-4 text-teal-800 dark:text-teal-200">Historial Territorio ${territoryNum}</h3>
            <div class="max-h-[60vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                ${historyData.length === 0 ? '<p class="text-gray-500 italic text-center">Sin historial registrado.</p>' :
                historyData.map(h => `
                    <div class="bg-gray-100 dark:bg-white/5 p-3 rounded-lg border-l-4 ${h.estado === 'Asignado' ? 'border-teal-500' : (h.estado === 'Cancelado' ? 'border-red-500' : 'border-gray-400')}">
                        <div class="flex justify-between items-start">
                             <div class="font-bold text-gray-800 dark:text-gray-200">${h.conductor}</div>
                             <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded ${h.estado === 'Asignado' ? 'bg-teal-100 text-teal-700' : (h.estado === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600')}">${h.estado}</span>
                        </div>
                        <div class="text-xs text-gray-500 mt-1 flex gap-4">
                            <span>📅 Asig: ${new Date(h.fecha_asignacion).toLocaleDateString()}</span>
                            ${h.fecha_entrega ? `<span>✅ Entr: ${new Date(h.fecha_entrega).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            <button id="close-history" class="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 rounded-xl mt-4 transition-colors">Cerrar</button>
        `, (modal) => {
            modal.querySelector('#close-history').onclick = () => modal.classList.add('hidden');
        });
    };

    if (asignados.length === 0) {
        container.innerHTML = `
            <div class="text-center py-20 text-gray-500">
                <div class="text-4xl mb-4">🍃</div>
                <p>No hay territorios asignados actualmente.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
             <div class="text-sm text-gray-500 font-medium">
                Mostrando <span class="text-teal-600 font-bold">${asignados.length}</span> asignaciones activas
            </div>
            
            <div class="flex items-center gap-3 w-full md:w-auto">
                <div class="relative w-full md:w-64">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input type="text" id="search-assignments" placeholder="Buscar conductor o territorio..." 
                        class="w-full pl-9 pr-4 py-2 bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all">
                </div>
                
                <div class="flex items-center gap-2 flex-shrink-0">
                    <select id="sort-assignments" class="bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-500 transition-colors cursor-pointer">
                        <option value="number" selected>Número</option>
                        <option value="date-desc">Reciente</option>
                        <option value="date-old">Antiguo</option>
                        <option value="conductor">Conductor</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div id="assignments-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-fade-in-up">
            <!-- Grid Content -->
        </div>
    `;

    const grid = container.querySelector('#assignments-grid');
    const sortSelect = container.querySelector('#sort-assignments');
    const searchInput = container.querySelector('#search-assignments');

    // Expose handlers to window
    window.actionReassign = (id, num, conductor) => handleReassign(id, num, conductor);
    window.actionReturn = (id, num) => handleReturn(id, num);
    window.actionHistory = (id, num) => handleHistory(id, num);
    window.actionEdit = (id, num, date, cond, status) => handleEdit(id, num, date, cond, status);
    window.actionDelete = (id, num) => handleDelete(id, num);

    // Toggle Menu Handler
    window.toggleActionMenu = (id, btn) => {
        const menu = document.getElementById(`menu-${id}`);
        // Identify wrapper to boost z-index
        const currentWrapper = btn.closest('.relative-action-wrapper');
        const isHidden = menu.classList.contains('hidden');

        // 1. Close ALL menus & Reset Z-Indexes first
        document.querySelectorAll('.action-menu-dropdown').forEach(m => {
            m.classList.add('hidden');
            m.classList.remove('flex');

            const w = m.closest('.relative-action-wrapper');
            if (w) {
                w.style.zIndex = '30'; // Reset to default base
                const b = w.querySelector('button');
                if (b) {
                    b.classList.remove('rotate-45', 'bg-red-50', 'text-red-500', 'ring-2', 'ring-red-100');
                    b.classList.add('bg-white', 'text-teal-600');
                }
            }
        });

        // 2. Open current if it was hidden
        if (isHidden) {
            menu.classList.remove('hidden');
            menu.classList.add('flex');

            // Style Active Button
            btn.classList.add('rotate-45', 'bg-red-50', 'text-red-500', 'ring-2', 'ring-red-100');
            btn.classList.remove('bg-white', 'text-teal-600');

            // Boost Z-Index to overlap next cards
            if (currentWrapper) currentWrapper.style.zIndex = '100';
        }
    };

    const renderGrid = () => {
        const query = searchInput.value.toLowerCase();
        const sortMode = sortSelect.value;
        const now = new Date();

        // Filter
        let filtered = asignados.filter(t =>
            t.numero.toString().includes(query) ||
            (t.asignado_a && t.asignado_a.toLowerCase().includes(query))
        );

        // Sort
        filtered.sort((a, b) => {
            if (sortMode === 'date-desc') {
                return new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0);
            } else if (sortMode === 'date-old') {
                return new Date(a.fecha_asignacion || 0) - new Date(b.fecha_asignacion || 0);
            } else if (sortMode === 'number') {
                return parseInt(a.numero) - parseInt(b.numero);
            } else if (sortMode === 'conductor') {
                return (a.asignado_a || '').localeCompare(b.asignado_a || '');
            }
            return 0;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-10 text-gray-400 italic">
                    No se encontraron resultados para "${query}"
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(t => {
            const fecha = t.fecha_asignacion ? new Date(t.fecha_asignacion) : null;
            const now = new Date();

            // Logic for Status Colors & Texts
            let statusColor = 'bg-teal-500'; // Default strip color
            let statusText = '';
            let statusTextClass = 'text-teal-600 dark:text-teal-400';
            let statusBg = 'bg-teal-50 dark:bg-teal-500/10';
            let icon = '';

            let avatarClass = 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30';
            let conductorName = t.asignado_a || 'Sin Asignar';
            let conductorSub = 'Asignado';

            // Calculate diff
            let diffDays = 0;
            if (fecha) {
                const diffTime = Math.abs(now - fecha);
                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                statusText = `Hace ${diffDays} días`;
            } else {
                statusText = 'Sin fecha';
                statusTextClass = 'text-gray-400';
                statusBg = 'bg-gray-100 dark:bg-white/5';
                statusColor = 'bg-gray-300';
            }

            // Determine State
            if (t.estado === 'Pendiente') {
                statusColor = 'bg-orange-500';
                statusText = 'Devuelto';
                statusTextClass = 'text-orange-600 dark:text-orange-400';
                statusBg = 'bg-orange-50 dark:bg-orange-500/10';
                icon = '⚠️';
                conductorName = 'Pendiente';
                conductorSub = 'Requiere atención';
                avatarClass = 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-500/30';
            } else if (fecha) {
                // Late Logic
                let isLate = false;
                const pIndex = getAssignedDayIndex(t.numero);

                // >7 days OR past scheduled day
                if (diffDays > 7 || (pIndex !== -1 && pIndex < currentDayNorm)) {
                    isLate = true;
                }

                if (isLate) {
                    statusColor = 'bg-red-500';
                    statusText = 'Atrasado';
                    statusTextClass = 'text-red-600 dark:text-red-400 font-bold';
                    statusBg = 'bg-red-50 dark:bg-red-500/10';
                    icon = '⏰';
                } else if (diffDays > 120) {
                    statusColor = 'bg-red-500';
                    statusText = `Hace ${diffDays}d`;
                    icon = '⚠️';
                } else if (diffDays > 90) {
                    statusColor = 'bg-amber-500';
                }
            }

            const initials = conductorName === 'Pendiente' ? '⚠️' : (conductorName !== 'Sin Asignar' ? conductorName.charAt(0).toUpperCase() : '?');

            return `
            <div class="relative bg-white dark:bg-[#181a1f] rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 dark:border-white/5 group overflow-hidden flex flex-col justify-between min-h-[160px]">
                
                <!-- Status Strip -->
                <div class="absolute left-0 top-0 bottom-0 w-1 ${statusColor}"></div>
                
                <!-- Top Row -->
                <div class="flex justify-between items-start mb-4 pl-2">
                    <div>
                        <span class="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-0.5">Territorio</span>
                        <div class="text-4xl font-black text-gray-800 dark:text-gray-100 font-outfit leading-none">${t.numero}</div>
                    </div>
                    
                    <!-- Actions Menu (Absolute) -->
                    <div class="relative-action-wrapper z-30 flex flex-col items-end">
                         <button onclick="window.toggleActionMenu('${t.id}', this)" class="bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-300 w-8 h-8 rounded-full flex items-center justify-center transition-all" title="Opciones">
                            <span class="text-xs">⋮</span>
                        </button>
                        
                        <div id="menu-${t.id}" class="action-menu-dropdown hidden flex-col gap-2 mt-2 bg-white/95 dark:bg-[#12141a] backdrop-blur-md p-2 rounded-xl shadow-2xl border border-gray-100 dark:border-white/10 animate-fade-in-down origin-top-right min-w-[40px] items-center absolute right-0 top-8 z-50">
                             <button onclick="window.actionReassign('${t.id}', '${t.numero}', '${t.asignado_a}')" class="w-9 h-9 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors" title="Reasignar">
                                🔁
                            </button>
                            <button onclick="window.actionReturn('${t.id}', '${t.numero}')" class="w-9 h-9 flex items-center justify-center bg-green-50 dark:bg-green-900/20 hover:bg-green-100 text-green-600 rounded-lg transition-colors" title="Terminar">
                                ✅
                            </button>
                            <button onclick="window.actionEdit('${t.id}', '${t.numero}', '${t.fecha_asignacion || ''}', '${t.asignado_a}', '${t.estado}')" class="w-9 h-9 flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors" title="Editar">
                                ✏️
                            </button>
                            <hr class="w-full border-gray-100 dark:border-white/10 my-1">
                            <button onclick="window.actionHistory('${t.id}', '${t.numero}')" class="w-9 h-9 flex items-center justify-center bg-gray-50 dark:bg-white/5 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors" title="Historial">
                                📜
                            </button>
                            <button onclick="window.actionDelete('${t.id}', '${t.numero}')" class="w-9 h-9 flex items-center justify-center bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 rounded-lg transition-colors" title="Eliminar">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Middle: Info -->
                <div class="pl-2 mb-4">
                     ${t.manzanas ? `<div class="mb-2"><span class="text-[9px] bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400 font-medium truncate max-w-full inline-block" title="${t.manzanas}">${t.manzanas}</span></div>` : ''}
                    
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border ${avatarClass} flex-shrink-0">
                            ${initials}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-bold text-gray-900 dark:text-gray-100 truncate" title="${conductorName}">
                                ${conductorName}
                            </div>
                            <div class="text-[10px] text-gray-400 truncate">
                                ${conductorSub}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bottom: Badge & Dates -->
                <div class="pl-2 flex flex-col pt-3 mt-auto border-t border-gray-50 dark:border-white/5 gap-2">
                    <div class="flex items-center gap-1.5 ${statusBg} px-2 py-1 rounded-md w-fit">
                        ${icon ? `<span class="text-xs">${icon}</span>` : ''}
                        <span class="text-[10px] font-bold uppercase tracking-wide ${statusTextClass}">${statusText}</span>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2">
                         <div class="bg-gray-50 dark:bg-white/5 p-1.5 rounded text-center border border-gray-100 dark:border-white/5">
                             <span class="block text-[9px] font-bold text-gray-400 uppercase tracking-tight mb-0.5">Asignado</span>
                             <span class="block text-[10px] font-medium text-gray-700 dark:text-gray-300 font-mono">
                                ${fecha ? fecha.toLocaleDateString() : '--'}
                             </span>
                         </div>
                         <div class="bg-gray-50 dark:bg-white/5 p-1.5 rounded text-center border border-gray-100 dark:border-white/5">
                             <span class="block text-[9px] font-bold text-gray-400 uppercase tracking-tight mb-0.5">Última Vez</span>
                             <span class="block text-[10px] font-medium text-gray-700 dark:text-gray-300 font-mono">
                                ${(() => {
                    if (!t.ultima_fecha) return '&nbsp;';
                    const last = new Date(t.ultima_fecha);
                    const assign = t.fecha_asignacion ? new Date(t.fecha_asignacion) : null;
                    if (assign && last.toDateString() === assign.toDateString()) return '&nbsp;';
                    return last.toLocaleDateString();
                })()}
                             </span>
                         </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    };

    sortSelect.addEventListener('change', renderGrid);
    searchInput.addEventListener('input', renderGrid);

    // Initial render
    renderGrid();
};
const renderConfigTab = async (container) => {
    const config = await getConfiguracion();

    container.innerHTML = `
    <h2 class="text-xl font-bold mb-6 border-b border-black/10 dark:border-white/10 pb-2 text-teal-800 dark:text-teal-100">Configuración del Sistema</h2>
        
        <div class="flex flex-wrap gap-2 mb-6 text-sm border-b border-black/10 dark:border-white/10 pb-4">
            <button class="sub-tab-btn active bg-teal-500/20 text-teal-800 dark:text-teal-200 px-4 py-2 rounded-lg border border-teal-500/30" data-sub="reglas">⚖️ Reglas del Sistema</button>
            <button class="sub-tab-btn bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10" data-sub="modulos">Módulos</button>
            <button class="sub-tab-btn bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10" data-sub="congregacion">Congregación</button>
            <button class="sub-tab-btn bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10" data-sub="territorios">Territorios</button>
            <button class="sub-tab-btn bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10" data-sub="conductores">Conductores</button>
            <button class="sub-tab-btn bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10" data-sub="publicadores">Publicadores</button>
            <button class="sub-tab-btn bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10" data-sub="mantenimiento">🛠️ Mantenimiento</button>
        </div>

        <div id="config-content" class="animate-fade-in">
            <!-- Content loaded here -->
        </div>
`;

    const subTabs = container.querySelectorAll('.sub-tab-btn');
    subTabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            subTabs.forEach(b => b.className = 'sub-tab-btn bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10');
            e.target.className = 'sub-tab-btn bg-teal-500/20 text-teal-800 dark:text-teal-200 px-4 py-2 rounded-lg border border-teal-500/30';
            loadSubTab(e.target.dataset.sub, container.querySelector('#config-content'), config);
        });
    });

    const reloadAction = (subTabName) => {
        loadSubTab(subTabName, container.querySelector('#config-content'), config);
    };

    // Store the reloader globally so that list components can call it
    window.reloadCurrentSubTab = () => {
        const activeBtn = container.querySelector('.sub-tab-btn.bg-teal-500\\/20');
        if (activeBtn) {
            reloadAction(activeBtn.dataset.sub);
        }
    };

    loadSubTab('modulos', container.querySelector('#config-content'), config);
};

const loadSubTab = async (subTab, container, config) => {
    container.innerHTML = '<div class="animate-pulse flex space-x-4"><div class="h-4 bg-white/10 rounded w-3/4"></div></div>';

    if (subTab === 'modulos') {
        container.innerHTML = `
    <div class="space-y-4 max-w-lg">
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
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up">
                <!--Datos Generales Card-->
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

                <!--Horarios y Lugares Card-- >
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

    } else if (subTab === 'mantenimiento') {
        const tCount = (await getTerritorios()).length;
        const cCount = (await getConductores()).length;
        const pCount = (await getTelefonos()).length;

        container.innerHTML = `
        <div class="space-y-6 max-w-4xl">
            <h3 class="font-semibold text-lg text-teal-800 dark:text-teal-100 flex items-center gap-2">
                <span>🛠️</span> Mantenimiento y Estado del Sistema
            </h3>

            <!-- System Stats -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Territorios</p>
                        <p class="text-2xl font-bold text-teal-600 dark:text-teal-400">${tCount}</p>
                    </div>
                    <div class="p-3 bg-teal-50 dark:bg-teal-500/10 rounded-full text-teal-600 dark:text-teal-400">🗺️</div>
                </div>
                <div class="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Conductores</p>
                        <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">${cCount}</p>
                    </div>
                    <div class="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-full text-blue-600 dark:text-blue-400">👤</div>
                </div>
                <div class="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Reg. Telefónicos</p>
                        <p class="text-2xl font-bold text-green-600 dark:text-green-400">${pCount}</p>
                    </div>
                    <div class="p-3 bg-green-50 dark:bg-green-500/10 rounded-full text-green-600 dark:text-green-400">📞</div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Data Tools -->
                <div class="space-y-6">
                     <div class="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-xl border border-amber-200 dark:border-amber-900/30">
                        <div class="flex items-start gap-4">
                            <div class="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-700 dark:text-amber-400 text-xl">🧹</div>
                            <div class="flex-1">
                                <h4 class="font-bold text-amber-800 dark:text-amber-200 mb-1">Limpieza de Historial (S-13)</h4>
                                <p class="text-xs text-amber-700/80 dark:text-amber-300/80 mb-4 leading-relaxed">
                                    Esta herramienta analiza todo el Programa Semanal histórico y reconstruye el historial de asignaciones de cada territorio. 
                                    Úsalo si notas que faltan registros recientes en el reporte S-13.
                                </p>
                                <button id="btn-rebuild-history" class="w-full bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-lg shadow-sm transition-all text-sm font-bold flex items-center justify-center gap-2">
                                    <span>⚙️</span> Ejecutar Diagnóstico y Reparación
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-200 dark:border-indigo-900/30">
                        <div class="flex items-start gap-4">
                            <div class="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-700 dark:text-indigo-400 text-xl">💾</div>
                            <div class="flex-1">
                                <h4 class="font-bold text-indigo-800 dark:text-indigo-200 mb-1">Copia de Seguridad</h4>
                                <p class="text-xs text-indigo-700/80 dark:text-indigo-300/80 mb-4 leading-relaxed">
                                    Descarga una copia completa de la base de datos (Territorios, Conductores, Teléfonos y Programa Semanal) en formato JSON.
                                </p>
                                <button id="btn-backup-json" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg shadow-sm transition-all text-sm font-bold flex items-center justify-center gap-2">
                                    <span>📥</span> Descargar Backup
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-teal-50 dark:bg-teal-900/10 p-5 rounded-xl border border-teal-200 dark:border-teal-900/30">
                        <div class="flex items-start gap-4">
                            <div class="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg text-teal-700 dark:text-teal-400 text-xl">🚀</div>
                            <div class="flex-1">
                                <h4 class="font-bold text-teal-800 dark:text-teal-200 mb-1">Actualización de Sistema</h4>
                                <p class="text-xs text-teal-700/80 dark:text-teal-300/80 mb-4 leading-relaxed">
                                    Esta acción eliminará todas las versiones antiguas cacheadas y descargará la última versión disponible.
                                </p>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button id="btn-force-update" class="w-full bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-lg shadow-sm transition-all text-sm font-bold flex items-center justify-center gap-2">
                                        <span>⚡</span> Reinstalar Local
                                    </button>
                                    <button id="btn-set-remote-version" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg shadow-sm transition-all text-sm font-bold flex items-center justify-center gap-2">
                                        <span>🌐</span> Forzar a Todos
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                <!-- AI Status -->
                <div class="bg-gray-50 dark:bg-white/5 p-5 rounded-xl border border-gray-200 dark:border-white/10 h-fit">
                    <h4 class="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                        <span class="text-lg">🤖</span> Estado de la IA
                    </h4>
                     <div class="flex items-center justify-between mb-4 p-3 bg-white dark:bg-black/20 rounded-lg border border-gray-100 dark:border-white/5">
                        <span class="text-sm text-gray-600 dark:text-gray-400">Modelo Activo</span>
                        <span class="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-2 py-1 rounded">Gemini 1.5 Flash</span>
                    </div>
                     <p class="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                        El Asistente Inteligente tiene acceso de lectura a:
                        <ul class="list-disc list-inside mt-2 space-y-1 ml-1">
                            <li>Territorios Disponibles/Asignados</li>
                            <li>Historial de Asignaciones (Contexto)</li>
                            <li>Disponibilidad de Conductores</li>
                        </ul>
                    </p>
                    <div class="text-[10px] text-center text-gray-400">
                        System Version: v${appVersion}
                    </div>
                </div>
            </div>
        </div>
        `;

        // Logic
        container.querySelector('#btn-rebuild-history')?.addEventListener('click', async (e) => {
            if (!confirm('¿Estás seguro? Esto puede tardar unos segundos.')) return;
            const btn = e.target.closest('button');
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Procesando...';
            btn.disabled = true;
            try {
                // Ensure import is handled if not global, but usually these are top level imports
                // Checking imports at top of file... Yes, rebuildHistoryFromSchedule is imported.
                const count = await rebuildHistoryFromSchedule();
                showCustomAlert(`Diagnóstico completado. Se sincronizaron ${count} registros históricos.`);
            } catch (err) {
                console.error(err);
                showCustomAlert('Error: ' + err.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

        // Backup Logic
        container.querySelector('#btn-backup-json')?.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            const originalText = btn.innerHTML;
            btn.innerHTML = '📦 Empaquetando...';
            btn.disabled = true;

            try {
                const fullData = {
                    timestamp: new Date().toISOString(),
                    territorios: await getTerritorios(),
                    conductores: await getConductores(),
                    telefonos: await getTelefonos(),
                    publicadores: await getPublicadores(),
                    programa: await getProgramaSemanal(formatDateId(new Date())), // Current week only for lite backup
                    config: await getConfiguracion()
                };

                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", "Backup_Morphin_" + formatDateId(new Date()) + ".json");
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();

                showCustomAlert("Copia de seguridad descargada correctamente 📥");
            } catch (e) {
                console.error(e);
                showCustomAlert("Error generando backup");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

        // Force Update Logic
        container.querySelector('#btn-force-update')?.addEventListener('click', async () => {
            if (!confirm('¿Estás seguro? Esto recargará la aplicación y asegurará que tengas la última versión.')) return;

            const btn = container.querySelector('#btn-force-update');
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Limpiando...';
            btn.disabled = true;

            try {
                // ... same logic ...
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let registration of registrations) {
                        await registration.unregister();
                    }
                }
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(key => caches.delete(key)));
                }
                localStorage.removeItem('app_version');
                localStorage.removeItem('programs_cache');
                window.location.reload(true);
            } catch (e) {
                console.error(e);
                showNotification("Error en actualización: " + e.message, "error");
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });

        // Push Version to All Users
        container.querySelector('#btn-set-remote-version')?.addEventListener('click', async () => {
            if (!confirm(`¿Deseas forzar a todos los usuarios a actualizar a la versión ${appVersion}?\n\nEsto actualizará el registro central y la próxima vez que los usuarios abran la app, se les pedirá actualizar.`)) return;

            const btn = container.querySelector('#btn-set-remote-version');
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Sincronizando...';
            btn.disabled = true;

            try {
                await setSystemVersion(appVersion);
                showNotification("Versión central actualizada correctamente 🌐", "success");
            } catch (e) {
                console.error(e);
                showNotification("Error al actualizar la versión central", "error");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    } else if (subTab === 'territorios') {
        const territorios = await getTerritorios();
        territorios.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));
        container.innerHTML = `
    <div class="flex justify-between items-center mb-4">
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
                loadSubTab('territorios', container, config);
            });
        };

        window.editTerritorio = async (id) => {
            const t = territorios.find(x => x.id === id);
            if (!t) return;

            showModal(`
    < h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400" > Editar Territorio</h3 >
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


    } else if (subTab === 'conductores') {
        const conductores = await getConductores();
        conductores.sort((a, b) => a.nombre.localeCompare(b.nombre));

        // Helper for mini-preview
        // Helper for mini-preview
        const renderAvailPreview = (c) => {
            const disp = c.disponibilidad;
            if (!disp || disp.length === 0) return '<span class="text-[9px] text-gray-600">Sin disponibilidad marcada</span>';
            const count = disp.length;
            return `<button onclick="event.stopPropagation(); window.showConductorAvailability('${c.id}')" class="text-[10px] text-teal-600 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 rounded border border-teal-500/20 underline decoration-teal-500/30 cursor-pointer transition-colors relative z-10 font-medium" title="Ver detalle">${count} turnos disp.</button>`;
        };

        // Availability Modal Logic
        window.showConductorAvailability = (id) => {
            const c = conductores.find(x => x.id === id);
            if (!c || !c.disponibilidad || c.disponibilidad.length === 0) return;

            const shiftLabels = { 'manana': 'Mañana', 'tarde': 'Tarde', 'noche': 'Noche' };
            const shiftColors = { 'manana': 'text-yellow-600 dark:text-yellow-400', 'tarde': 'text-orange-600 dark:text-orange-400', 'noche': 'text-blue-600 dark:text-blue-400' };
            const daysOrder = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6 };
            const shiftOrder = { 'manana': 0, 'tarde': 1, 'noche': 2 };

            const sorted = [...c.disponibilidad].sort((a, b) => {
                const [da, sa] = a.split('_');
                const [db, sb] = b.split('_');
                if (daysOrder[da] !== daysOrder[db]) return daysOrder[da] - daysOrder[db];
                return shiftOrder[sa] - shiftOrder[sb];
            });

            const listHtml = sorted.map(item => {
                const [day, shift] = item.split('_');
                return `
                    <div class="flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded border-b border-black/5 dark:border-white/5 last:border-0 transition-colors">
                        <span class="font-bold text-gray-700 dark:text-gray-300 text-sm">${day}</span>
                        <span class="text-[10px] font-bold uppercase ${shiftColors[shift] || 'text-gray-500'} bg-black/5 dark:bg-white/10 px-2 py-1 rounded">${shiftLabels[shift] || shift}</span>
                    </div>
                `;
            }).join('');

            showModal(`
                <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400">📅 Disponibilidad: ${c.nombre}</h3>
                <div class="bg-gray-50 dark:bg-black/40 rounded-xl border border-black/10 dark:border-white/10 overflow-hidden max-h-[60vh] overflow-y-auto custom-scrollbar">
                    ${listHtml}
                </div>
                <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full bg-teal-600 hover:bg-teal-500 text-white py-2 rounded-lg mt-6 font-bold shadow-lg shadow-teal-500/20 transition-all">Cerrar</button>
            `, (modal) => { });
        };

        container.innerHTML = `
    <div class="flex justify-between items-center mb-4">
                <h3 class="font-semibold text-lg text-teal-800 dark:text-teal-100">Gestión de Conductores</h3>
                <button id="btn-add-conductor" class="bg-teal-600 text-sm px-4 py-2 rounded-lg hover:bg-teal-500 shadow-lg shadow-teal-500/20 transition-all">+ Agregar Conductor</button>
            </div>
    <div class="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        ${conductores.map(c => `
                    <div class="bg-black/5 dark:bg-white/5 p-4 rounded-lg border border-black/10 dark:border-white/10 flex justify-between items-center group hover:bg-white/10 transition-colors">
                        <div>
                            <div class="font-bold text-teal-700 dark:text-teal-200 text-base">${c.nombre}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                ${c.telefono ? `<span>${c.telefono}</span>` : ''}
                            </div>
                            <div class="mt-1">${renderAvailPreview(c)}</div>
                        </div>
                        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="window.editConductor('${c.id}')" class="text-blue-400 hover:text-blue-300 p-2 bg-black/40 rounded border border-white/5 hover:border-blue-500/30 transition-all" title="Editar y Disponibilidad">✏️</button>
                            <button onclick="window.deleteConductor('${c.id}')" class="text-red-400 hover:text-red-300 p-2 bg-black/40 rounded border border-white/5 hover:border-red-500/30 transition-all" title="Eliminar">🗑️</button>
                        </div>
                    </div>
                `).join('')}
    </div>
`;

        // ADD Logic
        document.getElementById('btn-add-conductor').addEventListener('click', () => {
            showModal(`
    <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400">Nuevo Conductor</h3>
                <div class="space-y-3">
                    <div>
                        <label class="text-xs text-gray-700 dark:text-gray-400 uppercase font-bold">Nombre</label>
                        <input type="text" id="new-c-name" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
                    </div>
                    <div>
                        <label class="text-xs text-gray-700 dark:text-gray-400 uppercase font-bold">Teléfono</label>
                        <input type="text" id="new-c-phone" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
                    </div>
                    <!-- Email removed -->
                </div>
                <button id="save-new-conductor" class="w-full bg-teal-600 py-2 rounded-lg text-white mt-6 font-bold shadow-lg shadow-teal-500/20">Guardar</button>
`, (modal) => {
                modal.querySelector('#save-new-conductor').addEventListener('click', async () => {
                    const data = {
                        nombre: document.getElementById('new-c-name').value,
                        telefono: document.getElementById('new-c-phone').value,
                        role: 'Conductor'
                    };
                    if (!data.nombre) return showNotification("El nombre es requerido", "error");
                    await addConductor(data);
                    modal.classList.add('hidden');
                    loadSubTab('conductores', container, config);
                });
            });
        });

        // EDIT Logic (Including Availability)
        window.editConductor = (id) => {
            const c = conductores.find(x => x.id === id);
            if (!c) return;

            // Prepare Availability Data
            const dispon = c.disponibilidad || [];
            const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            const shirts = [
                { id: 'manana', label: 'Mañana', color: 'text-yellow-700 dark:text-yellow-200' },
                { id: 'tarde', label: 'Tarde', color: 'text-orange-700 dark:text-orange-200' },
                { id: 'noche', label: 'Noche', color: 'text-blue-700 dark:text-blue-200' }
            ];

            const gridHtml = `
    <div class="mt-6 pt-4 border-t border-gray-200 dark:border-white/10">
                    <h4 class="text-sm font-bold text-teal-800 dark:text-teal-200 mb-3 flex items-center justify-between">
                        Disponibilidad Semanal
                        <span class="text-[10px] text-gray-500 font-normal">Clic para editar</span>
                    </h4>
                    <div class="bg-gray-50 dark:bg-black/20 rounded-lg p-3 border border-gray-200 dark:border-white/5">
                        <!-- Header -->
                        <div class="grid grid-cols-4 gap-1 mb-2 text-center items-end">
                            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-left pl-2">Día</div>
                            ${shirts.map(s => `
                                <div class="text-[10px] font-bold uppercase ${s.color} bg-black/5 dark:bg-white/5 rounded py-1 border border-white/5">${s.label.slice(0, 3)}</div>
                            `).join('')}
                        </div>
                        
                        <!-- Rows -->
                        <div class="space-y-1">
                            ${days.map(day => `
                                <div class="grid grid-cols-4 gap-1 items-center hover:bg-white dark:hover:bg-white/5 transition-colors rounded p-1">
                                    <div class="text-[11px] font-bold text-teal-800 dark:text-teal-100 pl-2">${day.slice(0, 3)}</div>
                                    ${shirts.map(shift => {
                const key = `${day}_${shift.id}`;
                const isChecked = dispon.includes(key);
                return `
                                            <div class="flex justify-center">
                                                <input type="checkbox" class="edit-avail-check accent-teal-500 w-4 h-4 cursor-pointer rounded border-white/20 bg-black/40" 
                                                    value="${key}" ${isChecked ? 'checked' : ''}>
                                            </div>
                                        `;
            }).join('')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
    `;

            showModal(`
    <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400">Editar Conductor</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="text-xs text-gray-700 dark:text-gray-400 uppercase font-bold">Nombre</label>
                <input type="text" id="edit-c-name" value="${c.nombre}" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
            </div>
            <div>
                <label class="text-xs text-gray-700 dark:text-gray-400 uppercase font-bold">Teléfono</label>
                <input type="text" id="edit-c-phone" value="${c.telefono || ''}" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
            </div>
            <!-- Email removed -->
        </div>

                ${gridHtml}

<button id="update-conductor" class="w-full bg-teal-600 py-2 rounded-lg text-white mt-6 font-bold shadow-lg shadow-teal-500/20">Actualizar Datos</button>
`, (modal) => {
                modal.querySelector('#update-conductor').addEventListener('click', async () => {
                    // Gather basic data
                    const newData = {
                        nombre: document.getElementById('edit-c-name').value,
                        telefono: document.getElementById('edit-c-phone').value
                    };

                    // Gather Availability
                    const checkedBoxes = modal.querySelectorAll('.edit-avail-check:checked');
                    newData.disponibilidad = Array.from(checkedBoxes).map(cb => cb.value);

                    await updateConductor(id, newData);
                    modal.classList.add('hidden');
                    loadSubTab('conductores', container, config);
                    showCustomAlert("Conductor actualizado");
                });
            }, 'max-w-xl');
        };

        window.deleteConductor = async (id) => {
            showCustomConfirm("¿Eliminar este conductor?", async () => {
                await deleteConductor(id);
                loadSubTab('conductores', container, config);
            });
        };
    } else if (subTab === 'publicadores') {
        const publicadores = await getPublicadores();
        publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
        renderListCRUD(container, 'Publicadores', publicadores, ['nombre'], async (data) => {
            await addPublicador(data);
        }, async (id) => {
            await deletePublicador(id);
        }, async (id, data) => {
            await updatePublicador(id, data);
        });
    } else if (subTab === 'mantenimiento') {
        container.innerHTML = `
        <div class="space-y-6 max-w-2xl animate-fade-in">
             <div class="bg-black/5 dark:bg-white/5 p-6 rounded-xl border border-black/10 dark:border-white/10">
                <div class="flex items-start gap-4">
                    <div class="p-3 bg-blue-500/20 rounded-lg text-blue-400 text-2xl">🧹</div>
                    <div class="flex-1">
                        <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">Diagnóstico y Reparación del Sistema</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                            Esta herramienta realiza las siguientes acciones:
                            <br>• Reconstruye el historial de asignaciones S-13.
                            <br>• Detecta y corrige registros telefónicos asignados a usuarios inexistentes ("Usuario").
                            <br>• Sincroniza estados de asignación.
                        </p>
                         <button id="btn-run-maintenance" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                            Ejecutar Diagnóstico
                        </button>
                    </div>
                </div>
             </div>

             <div class="bg-black/5 dark:bg-white/5 p-6 rounded-xl border border-black/10 dark:border-white/10">
                <div class="flex items-start gap-4">
                    <div class="p-3 bg-teal-500/20 rounded-lg text-teal-600 dark:text-teal-400 text-2xl">🔧</div>
                    <div class="flex-1">
                        <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">Normalizar Datos de Territorios</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                            Corrige errores comunes en los números de territorio (ej. "10," -> "10") y elimina espacios innecesarios.
                        </p>
                         <button id="btn-fix-territories" class="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm shadow-lg shadow-teal-500/20 transition-all active:scale-95">
                            Corregir Números
                        </button>
                    </div>
                </div>
             </div>

             <!-- Console Output -->
             <div id="maint-console" class="hidden mt-4 bg-black/40 p-4 rounded-lg font-mono text-[10px] text-gray-300 max-h-40 overflow-y-auto border border-white/5"></div>
        </div>
        `;

        const btnRebuild = document.getElementById('btn-run-maintenance');
        const btnFix = document.getElementById('btn-fix-territories');
        const consoleDiv = document.getElementById('maint-console');

        if (btnRebuild) {
            btnRebuild.addEventListener('click', async () => {
                showCustomConfirm("¿Deseas ejecutar un diagnóstico completo? Esto corregirá registros telefónicos erróneos y reconstruirá el historial.", async () => {
                    const originalText = btnRebuild.innerHTML;
                    btnRebuild.disabled = true;
                    btnRebuild.innerHTML = `<span class="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></span> Procesando...`;

                    try {
                        const report = await runSystemDiagnosticsAndRepair();

                        let msg = `Diagnóstico completado:\n\n`;
                        msg += `• Historial: ${report.rebuiltHistory} registros auditados.\n`;
                        msg += `• Teléfonos: ${report.fixedPhones} errores corregidos.\n`;

                        if (report.fixedPhones > 0) {
                            console.log("Detalles de reparación:", report.details);
                        }

                        showNotification(msg, "success");
                    } catch (e) {
                        console.error(e);
                        showNotification("Error en mantenimiento: " + e.message, "error");
                    } finally {
                        btnRebuild.disabled = false;
                        btnRebuild.innerHTML = originalText;
                    }
                });
            });
        }

        // Logic for Fixing Territories
        btnFix.addEventListener('click', async () => {
            const confirmAction = confirm("¿Escanear y corregir números de territorio mal formados?");
            if (!confirmAction) return;

            btnFix.disabled = true;
            btnFix.innerHTML = '<span class="animate-spin">⏳</span> Escaneando...';
            consoleDiv.classList.remove('hidden');
            consoleDiv.innerHTML += `> 🔍 Iniciando escaneo de territorios...\n`;

            try {
                const ts = await getTerritorios();
                let fixedCount = 0;
                let errors = 0;

                for (const t of ts) {
                    let num = t.numero;
                    let cleanNum = num ? num.toString().trim() : '';
                    if (cleanNum.endsWith(',')) cleanNum = cleanNum = cleanNum.slice(0, -1);

                    if (cleanNum !== num) {
                        consoleDiv.innerHTML += `> ✏️ Corrigiendo: "${num}" -> "${cleanNum}"\n`;
                        try {
                            // Update logic 
                            await updateTerritorio(t.id, { numero: cleanNum });
                            fixedCount++;
                        } catch (err) {
                            console.error(err);
                            errors++;
                        }
                    }
                }

                consoleDiv.innerHTML += `> ✅ Escaneo finalizado.\n> Corregidos: ${fixedCount}\n> Errores: ${errors}`;
                btnFix.innerHTML = 'Corregir Números';
                showCustomAlert(`Se corrigieron ${fixedCount} territorios.`);

            } catch (e) {
                consoleDiv.innerHTML += `> ❌ Error Crítico: ${e.message}\n`;
            } finally {
                btnFix.disabled = false;
            }
        });

        // Logic for Fixing Phone Assignments
        const btnFixPhones = container.querySelector('#btn-fix-phones');
        if (btnFixPhones) {
            btnFixPhones.addEventListener('click', async () => {
                const confirmAction = confirm("¿Escanear y corregir inconsistencias en asignaciones telefónicas?");
                if (!confirmAction) return;

                btnFixPhones.disabled = true;
                btnFixPhones.innerHTML = '<span class="animate-spin">⏳</span> Escaneando...';
                consoleDiv.classList.remove('hidden');
                consoleDiv.innerHTML += `> 📞 Analizando asignaciones telefónicas...\n`;

                try {
                    const allPhones = await getTelefonos();
                    const allPubs = await getPublicadores();
                    let fixedCount = 0;
                    let errors = 0;

                    for (const t of allPhones) {
                        let dirty = false;
                        const updates = {};

                        // 1. Fix "Sin asignar" text vs Null ID
                        if (t.asignado_a === 'Sin asignar' && t.publicador_asignado) {
                            dirty = true;
                            updates.publicador_asignado = null;
                            updates.estado = 'Sin asignar';
                            updates.fecha_asignacion = null;
                            consoleDiv.innerHTML += `> ⚠️ ID ${t.numero}: Limpiando asignación fantasma.\n`;
                        }

                        // 2. Fix Name Mismatch (ID exists but Name is wrong or outdated)
                        if (t.publicador_asignado) {
                            const pub = allPubs.find(p => p.id === t.publicador_asignado);
                            if (pub && t.asignado_a !== pub.nombre) {
                                dirty = true;
                                updates.asignado_a = pub.nombre;
                                consoleDiv.innerHTML += `> 🔄 ID ${t.numero}: Nombre actualizado "${t.asignado_a}" -> "${pub.nombre}"\n`;
                            } else if (!pub) {
                                // Publisher deleted?
                                dirty = true;
                                updates.publicador_asignado = null;
                                updates.asignado_a = 'Sin asignar';
                                updates.estado = 'Sin asignar';
                                consoleDiv.innerHTML += `> 🚫 ID ${t.numero}: Publicador no existe. Desasignando.\n`;
                            }
                        }

                        // 3. Fix Status Inconsistency
                        if (t.publicador_asignado && (t.estado === 'Sin asignar' || !t.estado)) {
                            dirty = true;
                            updates.estado = 'Asignado';
                            consoleDiv.innerHTML += `> 📊 ID ${t.numero}: Estado corregido a "Asignado".\n`;
                        }

                        if (dirty) {
                            try {
                                await updateTelefono(t.id, updates);
                                fixedCount++;
                            } catch (err) {
                                errors++;
                            }
                        }
                    }

                    consoleDiv.innerHTML += `> ✅ Análisis telefónico finalizado.\n> Registros corregidos: ${fixedCount}\n`;
                    btnFixPhones.innerHTML = 'Corregir Teléfonos';
                    showCustomAlert(`Se corrigieron ${fixedCount} registros telefónicos.`);

                } catch (e) {
                    console.error(e);
                    consoleDiv.innerHTML += `> ❌ Error: ${e.message}\n`;
                    btnFixPhones.innerHTML = 'Reintentar Teléfonos';
                } finally {
                    btnFixPhones.disabled = false;
                }
            });
        }


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
    <h3 class="font-bold text-2xl text-teal-800 dark:text-teal-200 mb-6 flex items-center gap-3">
        <span class="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg text-xl">📞</span> Gestión de Predicación Telefónica
    </h3>
        
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

        <div id="phone-list-container" class="bg-white dark:bg-[#0f1115] rounded-2xl border border-gray-200 dark:border-white/10 h-[600px] overflow-y-auto relative shadow-sm custom-scrollbar">
            <!-- List will be rendered here -->
        </div>
`;

    // Render Logic with Filtering
    const renderList = () => {
        const listContainer = document.getElementById('phone-list-container');
        // Check if elements exist to avoid errors during tab switching
        if (!listContainer) return;

        const searchInput = document.getElementById('search-number');
        const pubFilterInput = document.getElementById('filter-publisher');
        const statusFilterInput = document.getElementById('filter-status');

        if (!searchInput || !pubFilterInput || !statusFilterInput) return;

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
            const matchPub = !pubFilter || (pubFilter === 'Sin asignar' ? !rawAssigned : assignedName === pubFilter);

            // Status Logic: Treat 'Pendiente' or empty as 'Sin asignar'
            const currentStatus = (t.estado === 'Pendiente' || !t.estado) ? 'Sin asignar' : t.estado;
            const matchStatus = !statusFilter || (statusFilter === 'Sin asignar' ? currentStatus === 'Sin asignar' : currentStatus === statusFilter);

            return matchSearch && matchPub && matchStatus;
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-400">
                    <span class="text-4xl mb-2">🔍</span>
                    <p class="text-sm">No se encontraron registros</p>
                </div>`;
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
            return `<span class="${colors[status] || colors['Sin asignar']} text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border border-black/5 dark:border-white/5 whitespace-nowrap shadow-sm">${status}</span>`;
        };

        listContainer.innerHTML = `
    <table class="w-full text-left text-sm text-gray-600 dark:text-gray-300">
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

            if (rawAssigned) {
                const p = publicadores.find(pub => pub.id === rawAssigned || pub.email === rawAssigned || pub.nombre === rawAssigned);
                if (p) {
                    assignedDisplay = p.nombre;
                    isAssigned = true;
                } else if (rawAssigned !== 'Pendiente') {
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
                            <span class="text-xs text-gray-500 italic truncate max-w-[150px] block" title="${t.comentario || ''}">${t.comentario || '-'}</span>
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

        const estados = ['Sin asignar', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];

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
            document.getElementById('update-phone').addEventListener('click', async () => {
                await updateTelefono(id, {
                    numero: document.getElementById('edit-p-num').value,
                    direccion: document.getElementById('edit-p-dir').value,
                    propietario: document.getElementById('edit-p-prop').value,
                    asignado_a: document.getElementById('edit-p-pub').value,
                    estado: document.getElementById('edit-p-estado').value,
                    comentario: document.getElementById('edit-p-obs').value
                });
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
            <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400">Nuevo Teléfono</h3>
            
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
                                                        <div class="flex gap-3">
                                                            <button id="add-row-btn" class="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/20 transition-all transform hover:scale-105">
                                                                <span>+</span> Nuevo Turno
                                                            </button>
                                                            <button id="export-pdf" class="flex items-center gap-2 bg-black/5 dark:bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 transition-colors">
                                                                📄 PDF
                                                            </button>
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
        data.asignaciones.push({ dia: 'Lunes', hora: '08:00', hora_fin: '10:00', lugar: 'Parque', publicador: '', companero: '' });
        await savePredicacionPublica(data);
        renderRows(); // Re-render to show new row
        // Scroll to bottom
        setTimeout(() => {
            const tableContainer = document.querySelector('.overflow-x-auto');
            if (tableContainer) tableContainer.scrollTop = tableContainer.scrollHeight;
        }, 100);
    });

    window.updateRow = async (index, field, value) => {
        data.asignaciones[index][field] = value;
        // Small debounce could be good here, but direct save is fine for now
        await savePredicacionPublica(data);
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
};

// --- UTILS ---

const showModal = (content, onOpen, maxWidth = 'max-w-md') => {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="w-full ${maxWidth} m-4 relative animate-fade-in bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 flex flex-col max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden">
            <button class="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:hover:text-white z-50 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors" onclick="document.getElementById('modal-container').classList.add('hidden')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <div class="p-6 overflow-y-auto custom-scrollbar">
                ${content}
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');
    if (onOpen) onOpen(modalContainer);
};

// --- CUSTOM DIALOGS ---

const showCustomAlert = (message) => {
    const type = message.toLowerCase().includes('error') ? 'error' : 'success';
    showNotification(message, type);
};

const showCustomConfirm = (message, onConfirm) => {
    showModal(`
        <div class="text-center p-4">
             <div class="text-4xl mb-4">⚠️</div>
             <h3 class="text-xl font-bold text-teal-600 dark:text-teal-400 mb-2">Confirmar Acción</h3>
             <p class="text-gray-700 dark:text-gray-300 mb-6 text-sm">${message}</p>
             <div class="flex justify-center gap-3">
                <button id="confirm-cancel" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg w-1/2">Cancelar</button>
                <button id="confirm-ok" class="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg w-1/2">Confirmar</button>
             </div>
        </div>
    `, (modal) => {
        modal.querySelector('#confirm-cancel').addEventListener('click', () => modal.classList.add('hidden'));
        modal.querySelector('#confirm-ok').addEventListener('click', () => {
            modal.classList.add('hidden');
            onConfirm();
        });
    });
};
const renderProgramaTab = async (container) => {
    // Helpers
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
        end.setDate(end.getDate() + 6);
        const options = { month: 'short', day: 'numeric' };
        return `${start.toLocaleDateString('es-ES', options)} - ${end.toLocaleDateString('es-ES', options)}`;
    };

    let currentWeekStart = getMonday(new Date());
    let programa = { dias: [] };

    // 1. Fetch Metadata Once
    const territoriesPromise = getTerritorios();
    const configPromise = getConfiguracion();
    const conductorsPromise = getConductores();
    const publishersPromise = getPublicadores();

    const [territorios, config, conductores, publicadores] = await Promise.all([
        territoriesPromise, configPromise, conductorsPromise, publishersPromise
    ]);

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
                                    <button id="prev-week" class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-md transition-all active:scale-95" title="Semana Anterior">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                                    </button>
                                    <span id="range-label" class="mx-3 text-sm font-mono text-teal-700 dark:text-teal-300 min-w-[140px] text-center font-bold tracking-tight">
                                        Cargando...
                                    </span>
                                    <button id="next-week" class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-md transition-all active:scale-95" title="Siguiente Semana">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                                <button id="btn-reset-today" class="hidden text-[10px] font-bold text-teal-600 dark:text-teal-400/80 hover:text-teal-500 uppercase tracking-widest transition-all hover:underline decoration-teal-500/50 underline-offset-4">
                                    Volver a Hoy
                                </button>
                            </div>

                        <div class="flex items-center gap-2 pl-4 border-l border-gray-200 dark:border-white/10">
                            <button id="btn-copy-prev" class="flex items-center gap-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-bold py-2 px-3 rounded-lg shadow-sm border border-gray-200 dark:border-white/10 transition-all active:scale-95 group" title="Copiar datos de la semana anterior">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                </svg>
                                <span class="hidden xl:inline text-xs">Copiar Ant.</span>
                            </button>

                            <button id="export-png" class="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-3 rounded-lg shadow-lg hover:shadow-purple-500/30 transition-all active:scale-95 border border-purple-400/20 group">
                                <span class="group-hover:rotate-12 transition-transform text-sm">📷</span> <span class="hidden lg:inline text-xs">IMG</span>
                            </button>
                            
                            <button id="btn-clear-week" class="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-3 rounded-lg shadow-lg hover:shadow-red-500/30 transition-all active:scale-95 border border-red-400/20 group" title="Borrar semana actual">
                                <span class="group-hover:scale-110 transition-transform text-sm">🗑️</span> <span class="hidden lg:inline text-xs">Borrar</span>
                            </button>

                            <button id="export-excel" class="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-3 rounded-lg shadow-lg hover:shadow-green-500/30 transition-all active:scale-95 border border-green-400/20 group">
                                <span class="group-hover:rotate-12 transition-transform text-sm">📊</span> <span class="hidden lg:inline text-xs">XLS</span>
                            </button>
                            
                            <button id="save-admin-prog" class="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-5 rounded-lg shadow-lg hover:shadow-teal-500/30 transition-all active:scale-95 border border-teal-400/20 ml-2">
                                <span class="text-sm">💾</span> <span class="hidden sm:inline text-xs uppercase tracking-wide">Guardar</span>
                            </button>
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
        loadingOverlay.classList.remove('hidden');
        const weekId = formatDateId(currentWeekStart);

        // Update UI info
        rangeLabel.textContent = formatDisplayDateRange(currentWeekStart);

        // Check if current week is selected to show "Hoy" button or highlight
        const todayMonday = getMonday(new Date()); // Strip time
        todayMonday.setHours(0, 0, 0, 0);
        const viewingMonday = new Date(currentWeekStart);
        viewingMonday.setHours(0, 0, 0, 0);

        if (viewingMonday.getTime() !== todayMonday.getTime()) {
            btnResetToday.classList.remove('hidden');
        } else {
            btnResetToday.classList.add('hidden');
        }

        try {
            const data = await getProgramaSemanal(weekId);
            if (data && data.dias && data.dias.length > 0) {
                programa = data;
            } else {
                // Initialize default
                programa = {
                    id: weekId,
                    dias: [
                        { nombre: 'Lunes', manana: {}, tarde: {}, noche: {} },
                        { nombre: 'Martes', manana: {}, tarde: {}, noche: {} },
                        { nombre: 'Miércoles', manana: {}, tarde: {}, noche: {} },
                        { nombre: 'Jueves', manana: {}, tarde: {}, noche: {} },
                        { nombre: 'Viernes', manana: {}, tarde: {}, noche: {} },
                        { nombre: 'Sábado', manana: {}, tarde: {}, noche: {} },
                        { nombre: 'Domingo', manana: {}, tarde: {}, noche: {} }
                    ]
                };
            }
            renderTable();
        } catch (error) {
            console.error(error);
            showCustomAlert("Error cargando semana: " + error.message);
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    };

    const getFieldIcon = (field) => {
        switch (field) {
            case 'Lugar': return '📍';
            case 'Hora': return '⏰';
            case 'Conductor': return '👤';
            case 'Auxiliar': return '👥';
            case 'Faceta': return '🏷️';
            case 'Grupos': return '👥';
            case 'Territorio': return '🗺️';
            default: return '🔹';
        }
    };

    // 3. Render Logic Function
    const renderTable = () => {
        const turnos = [
            {
                id: 'manana',
                label: '🌅 MAÑANA',
                headerColor: 'bg-gradient-to-r from-cyan-100 to-cyan-200 dark:from-cyan-950/80 dark:to-cyan-900/80 text-cyan-800 dark:text-cyan-200 border-l-4 border-cyan-500',
                rowColor: 'bg-gradient-to-r from-cyan-50 to-transparent dark:from-cyan-900/5 dark:to-transparent',
                accent: 'text-cyan-600 dark:text-cyan-400',
                fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio']
            },
            {
                id: 'tarde',
                label: '☀️ TARDE',
                headerColor: 'bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-950/80 dark:to-orange-900/80 text-orange-800 dark:text-orange-200 border-l-4 border-orange-500',
                rowColor: 'bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-900/5 dark:to-transparent',
                accent: 'text-orange-600 dark:text-orange-400',
                fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio']
            },
            {
                id: 'noche',
                label: '🌙 NOCHE',
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
                    <div class="flex flex-col gap-2.5 h-full relative z-10">
                `;

                // Render fields
                turnoConfig.fields.forEach(field => {
                    const val = data[field.toLowerCase()] || '';
                    const icon = getFieldIcon(field);
                    let inputHtml = '';

                    if (field === 'Territorio') {
                        const safeVal = (val || '').replace(/"/g, '&quot;');
                        inputHtml = `<button class="w-full text-left text-xs bg-white dark:bg-black/20 hover:bg-gray-50 dark:hover:bg-black/40 text-gray-700 dark:text-gray-300 py-2 px-3 rounded-lg border border-gray-200 dark:border-white/10 ${hoverBorder} shadow-sm transition-all duration-200 flex items-center justify-between group/btn"
                                     data-action="open-territory"
                                     data-day="${dayIndex}" data-turn="${turnoId}"
                                     data-current="${safeVal}">
                                     <div class="flex items-center gap-2 overflow-hidden">
                                        <span class="text-gray-400 opacity-50 text-[10px]">${icon}</span>
                                        <span class="truncate font-medium ${val ? 'text-gray-900 dark:text-white' : 'text-gray-400 italic'}">${val || 'Asignar Territorio'}</span>
                                     </div>
                                     <span class="opacity-0 group-hover/btn:opacity-100 transition-opacity text-gray-400 text-[10px]">✏️</span>
                                     </button>`;
                    } else if (field === 'Grupos') {
                        if (dia.nombre !== 'Domingo') return;
                        const safeVal = (val || '').replace(/"/g, '&quot;');
                        inputHtml = `<button class="w-full text-left text-xs bg-white dark:bg-black/20 hover:bg-gray-50 dark:hover:bg-black/40 text-gray-700 dark:text-gray-300 py-2 px-3 rounded-lg border border-gray-200 dark:border-white/10 ${hoverBorder} shadow-sm transition-all duration-200 flex items-center justify-between group/btn"
                                     data-action="open-group"
                                     data-day="${dayIndex}" data-turn="${turnoId}"
                                     data-current="${safeVal}">
                                      <div class="flex items-center gap-2 overflow-hidden">
                                        <span class="text-gray-400 opacity-50 text-[10px]">${icon}</span>
                                        <span class="truncate font-medium ${val ? 'text-gray-900 dark:text-white' : 'text-gray-400 italic'}">${val || 'Seleccionar Grupo'}</span>
                                     </div>
                                     <span class="opacity-0 group-hover/btn:opacity-100 transition-opacity text-gray-400 text-[10px]">✏️</span>
                                     </button>`;
                    } else {
                        // Regular Selects
                        let opts = options[field] || [];
                        if (field === 'Conductor' || field === 'Auxiliar') {
                            const availabilityKey = `${dia.nombre}_${turnoId}`;
                            opts = [...opts].sort((a, b) => {
                                const condA = conductores.find(c => c.nombre === a);
                                const condB = conductores.find(c => c.nombre === b);
                                const aAvail = condA && condA.disponibilidad && condA.disponibilidad.includes(availabilityKey);
                                const bAvail = condB && condB.disponibilidad && condB.disponibilidad.includes(availabilityKey);
                                if (aAvail && !bAvail) return -1;
                                if (!aAvail && bAvail) return 1;
                                return 0;
                            });
                        }

                        inputHtml = `<div class="relative group/sel">
                            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] grayscale opacity-40 pointer-events-none">${icon}</span>
                            <select class="w-full bg-white dark:bg-black/20 hover:bg-gray-50 dark:hover:bg-black/40 text-gray-700 dark:text-gray-300 text-xs py-2 pl-7 pr-4 rounded-lg border border-gray-200 dark:border-white/10 ${hoverBorder} focus:border-gray-400 dark:focus:border-white/30 appearance-none transition-all shadow-sm outline-none cursor-pointer placeholder-gray-400 truncate"
                                data-day="${dayIndex}" data-turno="${turnoId}" data-field="${field.toLowerCase()}">
                                <option value="" class="text-gray-400">-</option>
                                ${opts.map(o => {
                            const condObj = conductores.find(c => c.nombre === o);
                            const isAvail = condObj && condObj.disponibilidad && condObj.disponibilidad.includes(`${dia.nombre}_${turnoId}`);
                            return `<option value="${o}" ${val === o ? 'selected' : ''} class="${isAvail ? 'font-bold text-teal-600' : ''}">${isAvail ? '✓ ' : ''}${o}</option>`;
                        }).join('')}
                                ${val && !opts.includes(val) ? `<option value="${val}" selected>${val}</option>` : ''}
                            </select>
                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-600 group-hover/sel:text-${accent}-400 transition-colors">
                                <svg class="fill-current h-3 w-3 drop-shadow-sm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                            </div>
                         </div>`;
                    }
                    /* ... */
                    html += `
                        <div class="grid grid-cols-[24px_1fr] items-center gap-1.5 group/field hover:bg-white/[0.02] -mx-2 px-2 py-0.5 rounded transition-colors">
                             <div class="text-center text-gray-600 group-hover/field:text-teal-500/50 transition-colors pt-1">
                                <span class="text-sm">${icon}</span>
                             </div>
                             ${inputHtml}
                        </div>`;
                }); // End fields loop

                html += `</div></td>`;
            }); // End turnos loop

            html += `</tr>`;
        }); // End dias loop

        html += `</tbody></table></div ></div > `;

        tableContainer.innerHTML = html;
        loadingOverlay.classList.add('hidden');

        // Add Change Listeners
        tableContainer.querySelectorAll('select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const day = parseInt(e.target.dataset.day);
                const turn = e.target.dataset.turno;
                const fld = e.target.dataset.field;
                if (!programa.dias[day][turn]) programa.dias[day][turn] = {};
                programa.dias[day][turn][fld] = e.target.value;
            });
        });


    };
    document.getElementById('btn-reset-today').addEventListener('click', () => {
        currentWeekStart = getMonday(new Date());
        loadWeekData();
    });

    // Init Save Button
    document.getElementById('save-admin-prog').addEventListener('click', async () => {
        const btn = document.getElementById('save-admin-prog');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="animate-pulse">⏳ Guardando...</span>';
        btn.disabled = true;
        try {
            const weekId = formatDateId(currentWeekStart);
            await saveProgramaSemanal(weekId, programa);

            // AUTO-ASSIGN TERRITORIES LOGIC
            const turnos = ['manana', 'tarde', 'noche'];
            const updates = [];
            const processedTerritories = new Set(); // Avoid double assignment in same batch

            for (const d of programa.dias) {
                for (const t of turnos) {
                    const tData = d[t];
                    if (tData && tData.territorio && tData.conductor) {
                        // Parse: "101" or "101 (Mz.1, Mz.2)"
                        // Regex to capture Number and Content in parenthesis
                        const parts = tData.territorio.split(',').map(s => s.trim());

                        for (const part of parts) {
                            const match = part.match(/^(\d+)(?:\s*\((.*)\))?$/);
                            if (match) {
                                const num = match[1];
                                const manzanasStr = match[2]; // "Mz.1, Mz.2"
                                const conductor = tData.conductor;
                                const key = `${num} -${manzanasStr || 'ALL'} `;

                                if (!processedTerritories.has(key)) {
                                    processedTerritories.add(key);

                                    // Find territory candidate
                                    // If specific manzanas requested, find territory that HAS them.
                                    // If no manzanas (ALL), find any free or assignable?
                                    // We look for a territory with matching number.
                                    const candidates = territorios.filter(terr => terr.numero == num);

                                    // Filter candidates that Contain the requested apples (if any)
                                    let targetId = null;
                                    let manzanasToAssign = [];

                                    if (manzanasStr) {
                                        manzanasToAssign = manzanasStr.split(',').map(m => m.trim());
                                        // Find candidate that contains ALL these apples
                                        const perfectMatch = candidates.find(c => {
                                            if (!c.manzanas) return false;
                                            const cManzanas = c.manzanas.split(',').map(s => s.trim());
                                            return manzanasToAssign.every(m => cManzanas.includes(m));
                                        });
                                        if (perfectMatch) targetId = perfectMatch.id;
                                    } else {
                                        // Assigning Update whole territory
                                        // Pick the one that seems "Main" or just the first found
                                        if (candidates.length > 0) targetId = candidates[0].id;
                                    }

                                    if (targetId) {
                                        if (manzanasToAssign.length > 0) {
                                            updates.push(assignTerritorioParcial(targetId, manzanasToAssign, conductor));
                                        } else {
                                            updates.push(assignTerritorio(targetId, conductor));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
                showCustomAlert(`Programa guardado y ${updates.length} territorios asignados.`);
            } else {
                showCustomAlert("Programa guardado.");
            }

        } catch (e) {
            console.error(e);
            showCustomAlert("Error al guardar: " + e.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // Next/Prev Week Handlers
    document.getElementById('prev-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        loadWeekData();
    });


    document.getElementById('next-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        loadWeekData();
    });

    // Clear Week Logic
    document.getElementById('btn-clear-week').addEventListener('click', async () => {
        showCustomConfirm('¿Estás seguro de que deseas BORRAR toda la programación de esta semana?', async () => {
            const btn = document.getElementById('btn-clear-week');
            btn.innerHTML = '⌛';
            btn.disabled = true;

            try {
                const weekId = formatDateId(currentWeekStart);
                await deleteProgramaSemanal(weekId);
                showNotification('Semana borrada exitosamente.', 'success');
                loadWeekData(); // Reload to show empty state/defaults
            } catch (e) {
                console.error(e);
                showNotification("Error borrando semana: " + e.message, "error");
            } finally {
                btn.innerHTML = `<span class="group-hover:scale-110 transition-transform text-sm">🗑️</span> <span class="hidden lg:inline text-xs">Borrar</span>`;
                btn.disabled = false;
            }
        });
    });

    // --- Copy Previous Week Logic ---
    document.getElementById('btn-copy-prev').addEventListener('click', () => {
        showCustomConfirm("¿Copiar toda la programación de la semana pasada a esta semana?", async () => {
            const btn = document.getElementById('btn-copy-prev');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `< span class="animate-spin" >⌛</span > `;

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
                showNotification("Datos copiados exitosamente. No olvides GUARDAR.");

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
    document.getElementById('export-png').addEventListener('click', async () => {
        const btn = document.getElementById('export-png');
        const originalContent = btn.innerHTML;
        btn.innerHTML = `< span >⏳</span > `;
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
            const cellStyle = `${baseFont} padding: 4px 2px; border: 1px solid white; text - align: center; font - size: 13px; height: 26px; color: black; font - weight: 500; `;
            // Label column style
            const labelStyle = (bg) => `${baseFont} padding: 0 8px; border: 1px solid white; font - weight: bold; font - size: 11px; color: black; background - color: ${bg}; text - align: left; `;

            // Vertical Header Style (Fixed Rotation)
            // writing-mode: vertical-rl rotates text 90deg clockwise. rotate(180) flips it to read bottom-up.
            const verticalHeaderStyle = (bg) => `background - color: ${bg}; writing - mode: vertical - rl; transform: rotate(180deg); text - align: center; font - weight: bold; font - size: 14px; width: 35px; border: 1px solid white; color: black; letter - spacing: 2px; `;

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
        min - height: 100px;
        vertical - align: top;
        font - size: 13px;
        width: 23 %; /* 4 columns approx equal */
        `;

            const rowHeaderStyle = `
        width: 8 %;
        background - color: #f3f4f6;
        color: #111827;
        font - weight: 800;
        text - align: center;
        vertical - align: middle;
        border: 1px solid #e5e7eb;
        text - transform: uppercase;
        letter - spacing: 0.05em;
        `;

            const colHeaderStyle = (color) => `
        background - color: ${color};
        color: white;
        font - weight: 800;
        text - transform: uppercase;
        padding: 12px;
        font - size: 14px;
        letter - spacing: 0.05em;
        width: 23 %;
        `;

            const itemStyle = `
        display: flex;
        align - items: center;
        gap: 6px;
        margin - bottom: 6px;
        color: #374151;
        `;

            const iconStyle = `
        font - size: 14px;
        width: 20px;
        text - align: center;
        color: #6b7280;
        `;

            // Helper to render content within a cell
            const renderTurnHTML = (t) => {
                if (!t || (!t.conductor && !t.lugar && !t.territorio && !t.hora))
                    return '';

                // Icons: 📍 Time, 👤 User, 👥 Group, 🏷️ Tag, 🗺️ Map
                return `
            < div style = "display:flex; flex-direction:column; gap:2px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #f3f4f6;" >
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
                    </div >
    `;
            };

            const renderCellContent = (dayIndex, turnId) => {
                const d = programa.dias[dayIndex];
                if (!d || !d[turnId]) return '<div style="color:#d1d5db; font-style:italic; text-align:center; padding-top:20px;">-</div>';
                const html = renderTurnHTML(d[turnId]);
                return html || '<div style="color:#e5e7eb; font-style:italic; text-align:center;"></div>';
            };

            const html = `
    < div class="export-container" style = "font-family: 'Roboto', sans-serif; background-color: white; padding: 30px; width: 1400px; color: #1f2937;" >
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
                </div >
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

    document.getElementById('export-excel').addEventListener('click', async () => {
        const btn = document.getElementById('export-excel');
        const originalContent = btn.innerHTML;
        try {
            btn.innerHTML = 'Scan...';
            btn.disabled = true;

            const getDate = (idx) => {
                const d = new Date(currentWeekStart);
                d.setDate(d.getDate() + idx);
                return d.getDate();
            };

            const styles = `
    < style >
    table { border - collapse: collapse; width: 100 %; font - family: Arial, sans - serif; }
th, td { border: 1px solid #000000; padding: 5px; text - align: center; font - size: 11px; vertical - align: middle; }
                    .header - main { background - color: #FFFFFF; font - size: 16px; font - weight: bold; border: none; padding - bottom: 2px; }
                    .header - sub { background - color: #FFFFFF; font - size: 14px; font - weight: bold; border: none; padding - bottom: 15px; border - bottom: 2px solid black; }

                    /* Headers Colors */
                    .col - header { background - color: #B4C6E7; font - weight: bold; border: 1px solid #000000; }

                    /* Side Column Colors (Left) */
                    .side - mañana { background - color: #FFC000; font - weight: bold; writing - mode: vertical - rl; transform: rotate(180deg); color: black; font - size: 12px; } 
                    .side - tarde { background - color: #ED7D31; font - weight: bold; writing - mode: vertical - rl; transform: rotate(180deg); color: black; font - size: 12px; }
                    .side - noche { background - color: #4472C4; color: white; font - weight: bold; writing - mode: vertical - rl; transform: rotate(180deg); font - size: 12px; }
                    .side - zoom { background - color: #70AD47; font - weight: bold; writing - mode: vertical - rl; transform: rotate(180deg); color: black; font - size: 12px; }

                    /* Detail Column Colors */
                    .row - yellow { background - color: #FFF2CC; font - weight: bold; }
                    .row - orange { background - color: #FCE4D6; font - weight: bold; }
                    .row - blue { background - color: #D9E1F2; font - weight: bold; }
                    .row - green { background - color: #E2EFDA; font - weight: bold; }

                    /* Data Cell Colors (Matching Detail Column) */
                    .bg - mañana { background - color: #FFF2CC; }
                    .bg - tarde { background - color: #FCE4D6; }
                    .bg - noche { background - color: #D9E1F2; }
                    .bg - zoom { background - color: #E2EFDA; }

                    /* Groups Column */
                    .bg - white - cell { background - color: #FFFFFF; vertical - align: top; }
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
        <td colspan="9" class="header-main">CONGREGACIÓN "NUEVE DE OCTUBRE" 14282</td>
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

            showTerritorySelectionModal(currentVal, territorios, (newValue) => {
                if (!programa.dias[dayIndex][turnId]) programa.dias[dayIndex][turnId] = {};
                programa.dias[dayIndex][turnId].territorio = newValue;

                // Update UI immediately (button might be re-rendered later but this gives instant feedback)
                btn.dataset.current = newValue.replace(/"/g, '&quot;');
                const spanState = btn.querySelector('span.truncate');
                if (spanState) {
                    spanState.textContent = newValue || 'Asignar';
                    spanState.className = `truncate font - mono ${newValue ? 'text-teal-300 font-medium' : 'text-gray-500 italic'} `;
                }
            });
        } else if (action === 'open-group') {
            showGroupSelectionModal(currentVal, (newValue) => {
                if (!programa.dias[dayIndex][turnId]) programa.dias[dayIndex][turnId] = {};
                programa.dias[dayIndex][turnId].grupos = newValue;

                btn.dataset.current = newValue.replace(/"/g, '&quot;');
                const spanState = btn.querySelector('span.truncate');
                if (spanState) {
                    spanState.textContent = newValue || 'Seleccionar';
                    spanState.className = `truncate ${newValue ? 'text-teal-300 font-medium' : 'text-gray-500 italic'} `;
                }
            });
        }
    });

    // Initial Load
    loadWeekData();
};

// Assuming renderConfigTab exists elsewhere and needs modification
// Example of how renderConfigTab might be modified to include the new sub-tab:
/*
const renderConfigTab = async (container, initialSubTab = 'reglas') => {
    container.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="flex-shrink-0 mb-4 border-b border-gray-200 dark:border-white/10">
                <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                    <button data-subtab="reglas" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Reglas del Sistema
                    </button>
                    <button data-subtab="modulos" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Módulos
                    </button>
                    <button data-subtab="usuarios" class="sub-tab-btn whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        Usuarios
                    </button>
                </nav>
            </div>
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
            // await renderModulosSubTab(subContent);
            subContent.innerHTML = '<p class="text-gray-500">Contenido de Módulos (próximamente)</p>';
        } else if (targetSub === 'usuarios') {
            // await renderUsuariosSubTab(subContent);
            subContent.innerHTML = '<p class="text-gray-500">Contenido de Usuarios (próximamente)</p>';
        }
    };

    subTabs.forEach(btn => {
        btn.addEventListener('click', () => switchSubTab(btn.dataset.subtab));
    });

    // Initial defaults
    await switchSubTab(initialSubTab);
};
*/

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
    < div class="flex flex-col h-[400px]" >
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
        </div >
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
    < div class="text-center p-6" >
                <div class="text-6xl mb-4">📍</div>
                <h3 class="text-xl font-bold text-teal-600 dark:text-teal-400 mb-3">No hay territorios configurados</h3>
                <p class="text-gray-700 dark:text-gray-300 mb-4 text-sm">
                    Para poder asignar territorios al programa semanal, primero debes configurar al menos un territorio.
                </p>
                <div class="bg-black/40 border border-black/10 dark:border-white/10 rounded-lg p-4 mb-4 text-left">
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Pasos para agregar territorios:</p>
                    <ol class="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                        <li>Ve a la pestaña <strong class="text-teal-600 dark:text-teal-400">Configuración</strong></li>
                        <li>Selecciona la subpestaña <strong class="text-teal-600 dark:text-teal-400">Territorios</strong></li>
                        <li>Haz clic en <strong class="text-teal-600 dark:text-teal-400">+ Agregar Territorio</strong></li>
                        <li>Completa el número y las manzanas del territorio</li>
                        <li>Guarda y regresa al Programa Semanal</li>
                    </ol>
                </div>
                <button onclick="document.getElementById('modal-container').classList.add('hidden')" 
                    class="px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white rounded-lg font-medium shadow-lg shadow-teal-500/20">
                    Entendido
                </button>
            </div >
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
    < div class="flex flex-col h-full text-left overflow-hidden p-1" >
                <header class="mb-2 border-b border-black/10 dark:border-white/10 pb-2 shrink-0">
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="text-lg font-bold text-teal-600 dark:text-teal-400">Seleccionar Territorios</h3>
                        <div class="text-[10px] text-gray-500 dark:text-gray-400 bg-black/30 px-2 py-0.5 rounded border border-white/5">
                            ${allTerritories.length} disp.
                        </div>
                    </div>
                    
                    <!-- Search Bar -->
                    <div class="relative">
                        <input type="text" id="terr-search" 
                            placeholder="Buscar... (ej. 10)" 
                            class="w-full bg-black/20 border border-black/10 dark:border-white/10 rounded-lg py-1.5 pl-8 pr-4 text-sm text-white focus:ring-2 focus:ring-teal-500/50 focus:outline-none transition-colors"
                            autocomplete="off">
                        <span class="absolute left-2.5 top-2 text-gray-500 text-xs">🔍</span>
                    </div>
                </header>
                
                <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        ${allTerritories.map(t => {
            const state = selectionState[t.id];
            const isChecked = state.selected ? 'checked' : '';

            // Manzanas rendering
            const manzanasHtml = state.allManzanas.length > 0 ? `
                                <div class="mt-2 pt-2 border-t border-white/5 ${isChecked ? '' : 'hidden'}" id="manzanas-${t.id}">
                                    <div class="flex flex-wrap gap-1">
                                        ${state.allManzanas.map(m => `
                                            <label class="cursor-pointer select-none group/mz">
                                                <input type="checkbox" class="hidden manzana-check peer" value="${m}" data-tid="${t.id}"
                                                    ${state.manzanas.includes(m) ? 'checked' : ''}>
                                                <span class="block text-[9px] px-1 py-0.5 rounded border border-black/10 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:bg-white/5 peer-checked:bg-teal-500/20 peer-checked:text-teal-300 peer-checked:border-teal-500/30 transition-all">
                                                    ${m.replace(/^Mz\./, '')}
                                                </span>
                                            </label>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : '';

            return `
                                <div class="terr-item bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 p-2 transition-all hover:bg-gray-100 dark:hover:bg-white/10 ${isChecked ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/10' : ''}" 
                                     data-num="${t.numero}">
                                    <label class="flex items-start gap-2 cursor-pointer select-none w-full">
                                        <input type="checkbox" class="mt-0.5 w-3.5 h-3.5 accent-teal-500 terr-check rounded border-gray-300 dark:border-white/20 bg-white dark:bg-black/50" value="${t.id}" ${isChecked}>
                                        <div class="flex-1 min-w-0">
                                            <div class="font-bold text-gray-800 dark:text-gray-200 text-xs truncate">T. ${t.numero}</div>
                                            <div class="text-[9px] text-gray-500 truncate">${state.allManzanas.length} Mz.</div>
                                        </div>
                                    </label>
                                    ${manzanasHtml}
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>

                <div class="mt-2 pt-2 border-t border-black/10 dark:border-white/10 flex justify-end gap-2 z-10 bg-black/80 backdrop-blur-md shrink-0">
                    <button class="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-white transition-colors" onclick="document.getElementById('modal-container').classList.add('hidden')">Cancelar</button>
                    <button class="px-4 py-1.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white rounded-lg font-medium shadow-lg shadow-teal-500/20 text-xs" id="confirm-terr-selection">Confirmar</button>
                </div>
            </div >
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
                    card.classList.add('border-teal-500/30', 'bg-teal-900/10');
                } else {
                    card.classList.remove('border-teal-500/30', 'bg-teal-900/10');
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

                // Visual toggle for the span
                const span = e.target.nextElementSibling;
                if (checked) {
                    span.classList.add('bg-teal-500/20', 'text-teal-300', 'border-teal-500/30');
                } else {
                    span.classList.remove('bg-teal-500/20', 'text-teal-300', 'border-teal-500/30');
                }

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


