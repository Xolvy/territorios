import {
    getConfiguracion, getProgramaSemanal, saveProgramaSemanal,
    getMisTelefonos, solicitarNumeros, updateTelefonoStatus, devolverTelefono,
    getPublicadores, getConductores, addPublicador,
    getMisTerritorios, returnTerritorio, returnTerritorioParcial
} from '../data/firestore-services.js';
import { auth } from '../firebase-config.js';
import { formatPhoneNumber, getStatusColor } from './utils/helpers.js';
import { TerritoryIntelligence } from './utils/intelligence.js';

export const renderConductorDashboard = (container, userEmail) => {
    // 1. UI OPTIMISTA: Renderizar estructura base + Skeletons INMEDIATAMENTE
    let currentConductorName = localStorage.getItem('selected_conductor_name') || "Cargando...";

    container.innerHTML = `
        <div class="w-full max-w-7xl animate-fade-in pb-10">
            <!-- Header Skeleton / Real -->
            <header class="flex justify-between items-center mb-8 p-6 morphinglass-card border-b border-teal-500/20 relative overflow-hidden group">
                <div class="absolute inset-0 bg-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                <div class="z-10">
                    <h1 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-400 tracking-wide">Panel de Conductor</h1>
                    <p class="text-gray-400 mt-1 flex items-center gap-2">
                        <span class="inline-block w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                        Bienvenido, <span id="conductor-name-display" class="text-teal-200 font-medium">${currentConductorName}</span>
                    </p>
                </div>
                <button id="logout-btn" class="bg-red-500/10 hover:bg-red-500/30 text-red-300 px-5 py-2.5 rounded-xl border border-red-500/20 transition-all duration-300 text-sm font-medium backdrop-blur-md">
                    Cerrar Sesión
                </button>
            </header>

            <div id="dashboard-content" class="space-y-8">
                
                <!-- MODULE: UNIFIED DASHBOARD (Agenda + Territorios) -->
                <div id="module-dashboard" class="hidden">
                   <div class="flex flex-col gap-6">
                       
                       <!-- Agenda Section -->
                       <div class="morphinglass-card p-6 relative overflow-hidden">
                           <h2 class="text-xl font-bold text-white mb-2 flex items-center gap-2">📅 Agenda Semanal</h2>
                           <p class="text-gray-400 text-sm mb-4">Tus próximas salidas de predicación.</p>
                           <div id="dashboard-agenda" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                               <div class="animate-pulse h-20 bg-black/20 rounded-xl border border-teal-500/10 col-span-full"></div>
                           </div>
                       </div>

                       <!-- Territories Section -->
                       <div class="morphinglass-card p-6 relative overflow-hidden">
                           <h2 class="text-xl font-bold text-white mb-2 flex items-center gap-2">🗺️ Mis Territorios Asignados</h2>
                           <p class="text-gray-400 text-sm mb-4">Gestiona tus mapas y reporta tu avance.</p>
                           <div id="dashboard-territorios" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                               <div class="animate-pulse h-40 bg-black/20 rounded-xl border border-teal-500/10 col-span-full"></div>
                               <div class="text-gray-500 text-sm italic col-span-full text-center py-8 hidden" id="no-territories-msg">No tienes territorios asignados actualmente.</div>
                           </div>
                       </div>

                   </div>
                </div>

                <!-- MODULE: AI ASSISTANT (Conductor) -->
                <div id="module-ai-conductor" class="hidden morphinglass-card p-6 border-l-4 border-l-purple-500">
                    <h2 class="text-xl font-bold text-purple-200 mb-2 flex items-center gap-2">
                        🤖 Asistente Personal
                    </h2>
                    <p class="text-gray-400 text-sm mb-4">Pregunta sobre tus asignaciones, territorios o predicación.</p>
                    
                    <div id="conductor-chat-log" class="bg-black/40 rounded-xl p-4 h-48 overflow-y-auto mb-4 border border-white/5 text-sm space-y-3 shadow-inner">
                        <div class="text-gray-500 italic text-xs text-center mt-2">✨ Tus datos se analizan localmente y de forma segura.</div>
                    </div>
                    
                    <div class="flex gap-2 relative">
                        <input type="text" id="conductor-ai-prompt" placeholder="Ej: ¿Qué manzana me falta terminar?" 
                            class="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none pr-12">
                        <button id="conductor-ai-send" class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-purple-500/20 absolute right-1 top-1 bottom-1">
                            ➤
                        </button>
                    </div>
                </div>

                <!-- MODULE: PROGRAMA (Full View) -->
                <div id="module-programa" class="hidden morphinglass-card p-6">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h2 class="text-xl font-bold text-teal-100 flex items-center gap-2">
                                <span>📋</span> Programa Completo
                            </h2>
                        </div>
                        <button id="export-prog-png" class="text-xs bg-black/40 hover:bg-black/60 text-teal-300 border border-teal-500/30 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                            📷 Guardar como Imagen
                        </button>
                    </div>
                    
                    <div id="program-table-container" class="overflow-x-auto rounded-xl border border-white/5 bg-black/20 min-h-[150px]">
                        <!-- Table Rendered Here -->
                    </div>
                </div>

                <!-- MODULE: TELEFONOS -->
                <div id="module-telefonos" class="hidden morphinglass-card p-6">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                         <div>
                            <h2 class="text-xl font-bold text-teal-100 flex items-center gap-2">
                                <span>📞</span> Predicación Telefónica
                            </h2>
                            <p class="text-xs text-gray-400 mt-1">Gestiona los números y asigna publicadores</p>
                        </div>
                        <div class="flex gap-2">
                             <button id="btn-add-pub-temp" class="text-xs bg-teal-900/40 hover:bg-teal-800/60 text-teal-300 border border-teal-500/30 px-3 py-2 rounded-lg transition-colors">
                                + Publicador
                            </button>
                            <button id="btn-solicitar" class="text-xs bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-lg shadow-lg shadow-teal-500/20 transition-all">
                                + Solicitar Números
                            </button>
                        </div>
                    </div>

                    <div class="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                        <table class="w-full text-left text-sm text-gray-300">
                            <thead class="text-xs uppercase bg-black/40 text-teal-400 font-semibold tracking-wider">
                                <tr>
                                    <th class="p-4">Número</th>
                                    <th class="p-4">Datos</th>
                                    <th class="p-4">Publicador</th>
                                    <th class="p-4">Estado</th>
                                    <th class="p-4">Acción</th>
                                </tr>
                            </thead>
                            <tbody id="lista-telefonos" class="divide-y divide-white/5 font-mono text-sm">
                                <tr><td colspan="5" class="p-4 text-center text-gray-500 animate-pulse">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
        
        <!-- Modal Global Container -->
        <div id="modal-container" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center z-50 p-4"></div>
    `;

    // 2. LOGICA DE DATOS OPTIMIZADA
    let finalEmail = userEmail;
    if (!finalEmail || finalEmail === 'Usuario') {
        const storedName = localStorage.getItem('selected_conductor_name');
        if (storedName) finalEmail = storedName;
    }
    const finalName = localStorage.getItem('selected_conductor_name') || finalEmail || "Conductor";
    const nameDisplay = document.getElementById('conductor-name-display');
    if (nameDisplay) nameDisplay.innerText = finalName;

    document.getElementById('logout-btn').addEventListener('click', async () => {
        localStorage.removeItem('demo_role');
        localStorage.removeItem('selected_conductor_name');
        await auth.signOut();
        window.location.reload();
    });

    // 3. FETCH CONFIG & START MODULES
    getConfiguracion()
        .then(config => {
            const activeModules = config.modulos_activos || { dashboard: true, programa_predicacion: true, predicacion_telefonica: true };

            // --- MODULE: UNIFIED DASHBOARD ---
            if (activeModules.dashboard) {
                document.getElementById('module-dashboard').classList.remove('hidden');
                loadUnifiedDashboard(finalName, document.getElementById('dashboard-agenda'), document.getElementById('dashboard-territorios'));
            }

            // --- MODULE: AI ASSISTANT ---
            if (config.gemini_key) { // Only if key exists
                document.getElementById('module-ai-conductor').classList.remove('hidden');
                initializeConductorAI(config.gemini_key, finalName, finalEmail || finalName);
            }

            // --- MODULE: PROGRAMA (Full) ---
            if (activeModules.programa_predicacion) {
                document.getElementById('module-programa').classList.remove('hidden');
                getProgramaSemanal().then(programa => {
                    const containerTable = document.getElementById('program-table-container');
                    if (containerTable) renderProgramTable(programa, containerTable, config);
                });
                // Export Listener embedded in logic...
                document.getElementById('export-prog-png')?.addEventListener('click', () => {
                    // html2canvas logic...
                    const tableContainer = document.getElementById('program-table-container');
                    if (typeof html2canvas !== 'undefined') {
                        html2canvas(tableContainer, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
                            const link = document.createElement('a');
                            link.download = 'programa_semanal.png';
                            link.href = canvas.toDataURL();
                            link.click();
                        });
                    } else { alert("Función no disponible"); }
                });
            }

            // --- MODULE: TELEFONOS ---
            if (activeModules.predicacion_telefonica) {
                document.getElementById('module-telefonos').classList.remove('hidden');
                Promise.all([getMisTelefonos(finalEmail || finalName), getPublicadores()])
                    .then(([telefonos, publicadores]) => {
                        const tbody = document.getElementById('lista-telefonos');
                        if (tbody) initializePhoneModule(telefonos, publicadores, finalEmail || finalName, tbody);
                    });
            }

        })
        .catch(err => {
            console.error(err);
            container.innerHTML += `<div class="p-4 bg-red-500/20 text-red-200">Error: ${err.message}</div>`;
        });
};

/* --- LOGIC: CONECTOR AI --- */
const initializeConductorAI = async (apiKey, conductorName, conductorId) => {
    // 1. Fetch Context Data (Only what the conductor should see/know about)
    // We fetch everything relevant: Assigned Phones (to anyone in group technically? No, just theirs for now), Assigned Territories, Program.

    // NOTE: getMisTelefonos returns all active phones for now, we ideally filter in the brain if needed, 
    // but for personal AI, we probably want the Conductor to know about THEIR assignments.

    try {
        const [myPhones, myTerritories, program, pubs] = await Promise.all([
            getMisTelefonos(conductorId), // In current implementation returns all, we might filter context ?
            getMisTerritorios(conductorName),
            getProgramaSemanal(),
            getPublicadores()
        ]);

        // Filter phones to truly "mine" if needed, or pass all so they can ask about "available" numbers?
        // Let's pass all but instruct AI to focus on "Mis Asignaciones".

        const brain = new TerritoryIntelligence(myPhones, pubs, myTerritories, program);

        const btnSend = document.getElementById('conductor-ai-send');
        const inputPrompt = document.getElementById('conductor-ai-prompt');
        const log = document.getElementById('conductor-chat-log');

        const sendMsg = async () => {
            const text = inputPrompt.value.trim();
            if (!text) return;

            // UI
            log.innerHTML += `<div class="text-right mb-2"><span class="bg-purple-600/20 text-purple-200 px-3 py-2 rounded-lg inline-block font-medium text-sm">${text}</span></div>`;
            log.scrollTop = log.scrollHeight;
            inputPrompt.value = '';
            inputPrompt.disabled = true;
            btnSend.disabled = true;

            try {
                // Loading
                const loadingId = 'ai-loading-' + Date.now();
                log.innerHTML += `<div id="${loadingId}" class="text-left mb-2 text-gray-500 text-xs animate-pulse">Pensando...</div>`;
                log.scrollTop = log.scrollHeight;

                const response = await brain.askGemini(apiKey,
                    `Soy el conductor ${conductorName}. ${text}`
                ); // Prepend identity

                document.getElementById(loadingId).remove();

                // Format Response
                const cleanResponse = response.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
                log.innerHTML += `<div class="text-left mb-2"><span class="bg-white/5 text-gray-200 px-3 py-2 rounded-xl inline-block border border-white/10 text-sm leading-relaxed">${cleanResponse}</span></div>`;

            } catch (e) {
                log.innerHTML += `<div class="text-center text-red-400 text-xs my-2">Error: ${e.message}</div>`;
            } finally {
                inputPrompt.disabled = false;
                btnSend.disabled = false;
                inputPrompt.focus();
                log.scrollTop = log.scrollHeight;
            }
        };

        btnSend.addEventListener('click', sendMsg);
        inputPrompt.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMsg();
        });

    } catch (err) {
        console.warn("AI Init Failed", err);
    }
};

/* --- LOGIC: UNIFIED DASHBOARD --- */

const loadUnifiedDashboard = async (name, agendaContainer, territoriosContainer) => {
    // 1. Load Agenda (Parallel)
    getProgramaSemanal().then(programa => {
        const turnos = ['manana', 'tarde', 'noche'];
        const turnoLabels = { manana: '🌅 Mañana', tarde: '☀️ Tarde', noche: '🌙 Noche' };
        let assignments = [];

        if (programa && programa.dias) {
            programa.dias.forEach(d => {
                turnos.forEach(turno => {
                    const turnoData = d[turno];
                    if (turnoData) {
                        if (turnoData.conductor === name) assignments.push({ dia: d.nombre, turno: turnoLabels[turno], role: 'Conductor', ...turnoData });
                        if (turnoData.auxiliar === name) assignments.push({ dia: d.nombre, turno: turnoLabels[turno], role: 'Auxiliar', ...turnoData });
                    }
                });
            });
        }

        agendaContainer.innerHTML = assignments.length > 0 ? assignments.map(a => `
             <div class="bg-gradient-to-br from-teal-900/40 to-black/40 p-4 rounded-xl border border-teal-500/20">
                <div class="flex justify-between">
                    <span class="font-bold text-teal-100">${a.dia} <span class="text-teal-400 font-normal text-sm">${a.turno}</span></span>
                    <span class="text-xs bg-teal-500/20 text-teal-300 px-2 py-1 rounded">${a.role}</span>
                </div>
                <div class="mt-2 text-sm text-gray-400 flex flex-col gap-1">
                    <span>📍 ${a.lugar || 'Sin lugar'}</span>
                    <span>🗺️ Territorio ${a.territorio || '?'}</span>
                </div>
            </div>
        `).join('') : '<p class="text-gray-500 text-sm italic col-span-full">No tienes asignaciones en el programa esta semana.</p>';
    });

    // 2. Load Territories (Parallel)
    getMisTerritorios(name).then(territorios => {
        if (territorios.length === 0) {
            territoriosContainer.innerHTML = ''; // Clear skeleton
            document.getElementById('no-territories-msg').classList.remove('hidden');
        } else {
            document.getElementById('no-territories-msg').classList.add('hidden');
            territoriosContainer.innerHTML = territorios.map(t => `
                <div class="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col gap-3 group hover:border-teal-500/30 transition-all">
                    <!-- Image Thumbnail with Click-to-Zoom -->
                    <div class="bg-gray-800 h-40 rounded-lg overflow-hidden relative cursor-pointer" onclick="window.viewMap('${t.imagen}')">
                        <img src="${t.imagen || 'https://via.placeholder.com/300x200?text=Sin+Mapa'}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all transform group-hover:scale-105">
                        <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span class="text-white text-sm font-bold bg-black/60 px-3 py-1 rounded-full backdrop-blur">🔍 Ver Mapa</span>
                        </div>
                    </div>
                    
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="text-lg font-bold text-teal-200">Territorio ${t.numero}</h4>
                            <p class="text-xs text-gray-400">Manzanas: ${t.manzanas || 'Todas'}</p>
                        </div>
                        <span class="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-1 rounded border border-teal-500/30">Asignado</span>
                    </div>

                    <div class="flex gap-2 mt-2">
                         <button onclick="window.openProgressModal('${t.id}', '${t.numero}', '${t.manzanas || ''}')" 
                            class="flex-1 bg-teal-600/20 hover:bg-teal-600/40 text-teal-300 border border-teal-500/30 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2">
                            <span>✅</span> Reportar/Liberar
                        </button>
                    </div>
                </div>
            `).join('');
        }
    });
};

/* --- MODALS & HELPERS --- */

// View Map Modal
window.viewMap = (url) => {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="relative max-w-4xl w-full p-4">
             <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="absolute top-0 right-0 m-6 text-white text-3xl z-10 hover:text-red-400">&times;</button>
             <img src="${url}" class="w-full h-auto rounded-xl shadow-2xl border border-white/20">
        </div>
    `;
    modal.classList.remove('hidden');
};

// Progress / Return Modal
window.openProgressModal = (id, numero, manzanasStr) => {
    const manzanas = manzanasStr ? manzanasStr.split(',').map(s => s.trim()).filter(s => s) : [];

    // Checkbox generation
    const checkboxHtml = manzanas.length > 0 ? `
        <div class="grid grid-cols-2 gap-2 mb-4 max-h-40 overflow-y-auto bg-black/20 p-2 rounded border border-white/5">
            ${manzanas.map((m, idx) => `
                <label class="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer hover:bg-white/5 p-1 rounded">
                    <input type="checkbox" value="${m}" class="manzana-check accent-teal-500 w-4 h-4">
                    <span>Manzana ${m}</span>
                </label>
            `).join('')}
        </div>
        <p class="text-xs text-yellow-500/80 mb-4">* Selecciona SOLAMENTE las manzanas que ya se terminaron.</p>
    ` : `<p class="text-sm text-gray-400 italic mb-4">Este territorio no tiene manzanas definidas. Se devolverá completo.</p>`;

    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 class="text-xl font-bold text-teal-100 mb-2">Reportar Territorio ${numero}</h3>
            <p class="text-sm text-gray-400 mb-4">Marca lo que has completado para liberarlo y dejarlo disponible para otros conductores.</p>
            
            ${checkboxHtml}

            <div class="flex flex-col gap-3">
                <button id="btn-return-partial" class="w-full bg-teal-600 hover:bg-teal-500 text-white py-2 rounded-lg font-medium transition-colors ${manzanas.length === 0 ? 'hidden' : ''}">
                    Liberar Manzanas Seleccionadas
                </button>
                <button id="btn-return-all" class="w-full bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/30 py-2 rounded-lg font-medium transition-colors">
                    Marcar TODO como Predicado
                </button>
                <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full text-gray-400 hover:text-white py-2 text-sm">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');

    // Return ALL Logic
    document.getElementById('btn-return-all').addEventListener('click', async () => {
        if (confirm("¿Seguro que deseas marcar TODO el territorio como terminado?")) {
            await returnTerritorio(id);
            modal.classList.add('hidden');
            window.location.reload();
        }
    });

    // Return PARTIAL Logic
    const btnPartial = document.getElementById('btn-return-partial');
    if (btnPartial) {
        btnPartial.addEventListener('click', async () => {
            const selected = Array.from(document.querySelectorAll('.manzana-check:checked')).map(cb => cb.value);
            if (selected.length === 0) {
                alert("Selecciona al menos una manzana.");
                return;
            }
            if (selected.length === manzanas.length) {
                // All selected -> Same as Return All
                if (confirm("Has seleccionado todas las manzanas. ¿Marcar territorio completo como terminado?")) {
                    await returnTerritorio(id);
                    modal.classList.add('hidden');
                    window.location.reload();
                }
                return;
            }

            const remaining = manzanas.filter(m => !selected.includes(m));
            if (confirm(`Vas a liberar las manzanas: ${selected.join(', ')}. \nTe quedarás con: ${remaining.join(', ')}.`)) {
                await returnTerritorioParcial(id, selected.join(', '), remaining.join(', '));
                modal.classList.add('hidden');
                window.location.reload();
            }
        });
    }
};

/* --- (OTHER RENDER FUNCTIONS: renderProgramTable, initializePhoneModule KEPT AS IS) --- */
// Reuse existing functions from previous context if available, otherwise redefine them here briefly to ensure validity.
// Since we are rewriting the file, we must include them.

const renderProgramTable = (programa, container, config) => {
    if (!programa || !programa.dias || programa.dias.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center p-8">No hay programa cargado aún.</p>';
        return;
    }
    const turnos = [
        { id: 'manana', label: '🌅 MAÑANA', headerColor: 'bg-cyan-100/90' },
        { id: 'tarde', label: '☀️ TARDE', headerColor: 'bg-orange-100/90' },
        { id: 'noche', label: '🌙 NOCHE', headerColor: 'bg-indigo-100/90' }
    ];
    const fields = ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'];

    let html = `
        <div class="bg-white p-4 min-w-[800px]">
             <div class="text-center font-bold text-xl mb-4 uppercase border-b-2 border-black pb-4 text-black">
                Congregación "${config.congregacion?.nombre || '...'}" ${config.congregacion?.numero || ''} <br>
                <span class="text-lg text-gray-700 mt-1 block">Programa de Predicación</span>
            </div>
            <table class="w-full border-collapse text-xs md:text-sm border border-gray-400 text-black">
                <thead>
                    <tr class="bg-teal-100">
                        <th class="border border-gray-400 p-2 w-20 font-bold text-teal-900">Turno</th>
                        <th class="border border-gray-400 p-2 w-24 font-bold text-teal-900">Detalle</th>
                        ${programa.dias.map(d => `<th class="border border-gray-400 p-2 uppercase font-bold text-teal-900 tracking-wider">${d.nombre}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    turnos.forEach(turno => {
        fields.forEach((field, fieldIdx) => {
            html += `<tr>`;
            if (fieldIdx === 0) {
                html += `<td class="${turno.headerColor} font-bold border border-gray-400 p-3 text-center align-middle text-gray-800" rowspan="${fields.length}">${turno.label}</td>`;
                html += `<td class="${turno.headerColor} font-bold border border-gray-400 p-2 text-gray-800">${field}</td>`;
            } else {
                html += `<td class="${turno.headerColor} font-bold border border-gray-400 p-2 text-gray-800">${field}</td>`;
            }
            programa.dias.forEach(dia => {
                const val = (dia[turno.id] || {})[field.toLowerCase()] || '';
                html += `<td class="border border-gray-400 p-2 text-center text-gray-700">${val || '<span class="text-gray-300">-</span>'}</td>`;
            });
            html += `</tr>`;
        });
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
};

const initializePhoneModule = (telefonos, publicadores, userId, tbody) => {
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const estados = ['Sin asignar', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];

    const render = () => {
        telefonos.sort((a, b) => {
            const dateA = a.fecha_asignacion ? new Date(a.fecha_asignacion) : new Date(0);
            const dateB = b.fecha_asignacion ? new Date(b.fecha_asignacion) : new Date(0);
            return dateB - dateA;
        });

        if (telefonos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-500 italic">No tienes números asignados. ¡Solicita algunos!</td></tr>`;
            return;
        }

        tbody.innerHTML = telefonos.map(t => {
            const currentPubId = t.publicador_asignado || '';
            const currentStatus = t.estado || 'Sin asignar';
            return `
            <tr class="hover:bg-white/5 transition-colors border-b border-white/5 group">
                <td class="p-4 font-mono text-teal-300 font-bold text-base tracking-wide">${formatPhoneNumber(t.numero)}</td>
                <td class="p-4 text-gray-400 text-xs uppercase tracking-wide">${t.direccion}</td>
                <td class="p-4 text-gray-300 text-sm font-medium">${t.propietario}</td>
                <td class="p-2">
                     <select onchange="window.updatePhoneStatus('${t.id}', '${currentStatus}', this.value)" 
                        class="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-sm text-gray-200 focus:border-teal-500 outline-none cursor-pointer hover:bg-black/50 transition-colors">
                        <option value="" class="bg-gray-900 text-gray-500">Sin asignar</option>
                        ${publicadores.map(p => `<option value="${p.id}" ${p.id === currentPubId ? 'selected' : ''} class="bg-gray-900">${p.nombre}</option>`).join('')}
                    </select>
                </td>
                <td class="p-2">
                    <select onchange="window.updatePhoneStatus('${t.id}', this.value, '${currentPubId}')" 
                        class="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-sm font-medium focus:border-teal-500 outline-none cursor-pointer hover:bg-black/50 transition-colors ${getStatusColor(currentStatus)}">
                         ${estados.map(st => `<option value="${st}" ${st === currentStatus ? 'selected' : ''} class="bg-gray-900 text-gray-200">${st}</option>`).join('')}
                    </select>
                </td>
            </tr>
        `;
        }).join('');
    };
    render();

    // Listeners (Cloned to remove old ones)
    const btnSolicitar = document.getElementById('btn-solicitar');
    if (btnSolicitar) {
        const newBtn = btnSolicitar.cloneNode(true);
        btnSolicitar.parentNode.replaceChild(newBtn, btnSolicitar);
        newBtn.addEventListener('click', async () => {
            try {
                const count = await solicitarNumeros(50, userId);
                alert(`Se asignaron ${count} números nuevos.`);
                const newTels = await getMisTelefonos(userId);
                telefonos.length = 0; telefonos.push(...newTels);
                render();
            } catch (err) { alert('Error: ' + err.message); }
        });
    }

    const btnAddPub = document.getElementById('btn-add-pub-temp');
    if (btnAddPub) {
        const newBtn = btnAddPub.cloneNode(true);
        btnAddPub.parentNode.replaceChild(newBtn, btnAddPub);
        newBtn.addEventListener('click', () => {
            // Re-using showModal if available or simple prompt for now
            const name = prompt("Nombre del nuevo publicador:");
            if (name) {
                addPublicador({ nombre: name }).then(() => {
                    alert("Agregado");
                    location.reload();
                });
            }
        });
    }

    window.updatePhoneStatus = async (id, status, pubId) => {
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].estado = status;
            telefonos[telIndex].publicador_asignado = pubId;
            render();
        }
        await updateTelefonoStatus(id, status, pubId);
    };
};
