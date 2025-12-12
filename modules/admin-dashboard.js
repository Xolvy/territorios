import {
    getConfiguracion, saveConfiguracion,
    getTerritorios, addTerritorio, deleteTerritorio, updateTerritorio,
    getConductores, addConductor, deleteConductor, updateConductor,
    getPublicadores, addPublicador, deletePublicador, updatePublicador,
    getTelefonos, addTelefono, deleteTelefono, updateTelefono,
    getPredicacionPublica, savePredicacionPublica,
    getProgramaSemanal, saveProgramaSemanal
} from '../data/firestore-services.js?v=3.10';
import { formatPhoneNumber, getStatusColor, showNotification } from './utils/helpers.js';
import { TerritoryIntelligence } from './utils/intelligence.js';
import { auth } from '../firebase-config.js';

export const renderAdminDashboard = async (container) => {
    container.innerHTML = `
        <div class="w-full max-w-7xl animate-fade-in pb-10">
            <header class="flex justify-between items-center mb-6 p-4 morphinglass-card">
                <div>
                    <h1 class="text-2xl font-bold text-teal-400">Panel de Administrador</h1>
                    <p class="text-sm text-gray-400">Configuración y Gestión</p>
                </div>
                <button id="logout-btn" class="bg-red-500/20 hover:bg-red-500/40 text-red-200 px-4 py-2 rounded-lg border border-red-500/30 transition-colors">
                    Cerrar Sesión
                </button>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <!-- Sidebar -->
                <nav class="lg:col-span-1 morphinglass-card h-fit flex flex-col gap-2 sticky top-4">
                    <button class="tab-btn active text-left p-3 rounded-lg hover:bg-white/5 transition-colors text-teal-300 font-medium" data-tab="config">
                        ⚙️ Configuración
                    </button>
                    <button class="tab-btn text-left p-3 rounded-lg hover:bg-white/5 transition-colors text-gray-300" data-tab="predicacion">
                        📢 Predicación Pública
                    </button>
                    <button class="tab-btn text-left p-3 rounded-lg hover:bg-white/5 transition-colors text-gray-300" data-tab="telefonos">
                        📞 Predicación Telefónica
                    </button>
                    <button class="tab-btn text-left p-3 rounded-lg hover:bg-white/5 transition-colors text-gray-300" data-tab="programa">
                        📅 Programa Semanal
                    </button>
                    <div class="mt-4 pt-4 border-t border-white/10">
                         <button class="tab-btn w-full text-left p-3 rounded-lg hover:bg-teal-500/10 transition-colors text-purple-300 font-medium animate-pulse" data-tab="ai">
                            🧠 Asistente IA
                        </button>
                    </div>
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
        window.location.reload();
    });

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabs.forEach(t => {
                t.classList.remove('text-teal-300', 'font-medium', 'bg-white/10');
                t.classList.add('text-gray-300');
            });
            e.target.classList.remove('text-gray-300');
            e.target.classList.add('text-teal-300', 'font-medium', 'bg-white/10');
            loadTab(e.target.dataset.tab);
        });
    });

    loadTab('config');
};

const loadTab = async (tabName) => {
    const contentDiv = document.getElementById('admin-content');
    contentDiv.innerHTML = '<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>';

    if (tabName === 'config') {
        await renderConfigTab(contentDiv);
    } else if (tabName === 'predicacion') {
        await renderPredicacionTab(contentDiv);
    } else if (tabName === 'telefonos') {
        await renderTelefonosTab(contentDiv);
    } else if (tabName === 'programa') {
        await renderProgramaTab(contentDiv);
    } else if (tabName === 'ai') {
        await renderAITab(contentDiv);
    }
};

const renderAITab = async (container) => {
    // 1. Fetch Data State
    const telefonos = await getTelefonos();
    const publicadores = await getPublicadores();
    const territorios = await getTerritorios();
    const programa = await getProgramaSemanal();
    const config = await getConfiguracion();

    // 2. Initialize Intelligence Engine
    const brain = new TerritoryIntelligence(telefonos, publicadores, territorios, programa);

    // 3. Generate Analysis
    const insights = brain.generateInsights();

    // 4. Render UI
    let insightsDisplay = insights.map(i => `
        <div class="p-4 rounded-lg bg-black/20 border border-white/5 mb-3">
            <h4 class="font-bold ${i.type === 'positive' ? 'text-green-400' : 'text-blue-400'} mb-1">${i.title}</h4>
            <p class="text-sm text-gray-300">${i.message}</p>
        </div>
    `).join('');

    if (insights.length === 0) insightsDisplay = '<p class="text-gray-500 italic">No hay suficientes datos para generar insights aún.</p>';

    // Gemini Section HTML
    const geminiSection = config.gemini_key ? `
        <div class="bg-gradient-to-br from-purple-900/20 to-black/40 rounded-xl p-6 border border-purple-500/30">
            <h3 class="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
                🤖 Consultar a Gemini AI
            </h3>
            <div id="gemini-chat-log" class="bg-black/50 rounded-lg p-4 h-48 overflow-y-auto mb-4 border border-white/5 text-sm space-y-3">
                <div class="text-gray-400 italic">Hola, soy tu asistente de territorios. ¿En qué puedo ayudarte hoy?</div>
            </div>
            <div class="flex gap-2">
                <input type="text" id="gemini-prompt" placeholder="Ej: ¿Qué territorios necesitan atención urgente?" 
                    class="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none">
                <button id="send-gemini" class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition-colors">
                    Enviar
                </button>
            </div>
        </div>
    ` : `
        <div class="bg-gray-800/50 rounded-xl p-6 border border-gray-700 text-center">
            <div class="text-4xl mb-3">🔒</div>
            <h3 class="text-lg font-semibold text-gray-300 mb-2">IA Avanzada Desactivada</h3>
            <p class="text-sm text-gray-400 mb-4">Para usar la inteligencia de Gemini, configura tu API Key en la pestaña de Configuración.</p>
            <button onclick="document.querySelector('[data-tab=config]').click()" class="text-teal-400 hover:text-teal-300 underline">Ir a Configuración</button>
        </div>
    `;

    container.innerHTML = `
        <h2 class="text-xl font-bold mb-6 border-b border-white/10 pb-2 text-purple-300">Asistente Inteligente de Territorios</h2>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Columna Izquierda: Insights + Gemini -->
            <div class="space-y-6">
                 <!-- Sección de Insights -->
                <div class="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h3 class="text-lg font-semibold text-teal-100 mb-4 flex items-center gap-2">
                        📊 Análisis del Sistema
                    </h3>
                    <div class="space-y-4">
                        ${insightsDisplay}
                    </div>
                </div>

                <!-- Sección Gemini -->
                ${geminiSection}
            </div>

            <!-- Columna Derecha: Autosustentabilidad -->
            <div class="bg-white/5 rounded-xl p-6 border border-white/10 h-fit">
                <h3 class="text-lg font-semibold text-teal-100 mb-4 flex items-center gap-2">
                    🛠️ Mantenimiento Automático
                </h3>
                <p class="text-xs text-gray-400 mb-4">
                    El sistema detecta y repara inconsistencias automáticamente para mantener la base de datos saludable.
                </p>
                
                <div id="maintenance-log" class="bg-black/40 rounded p-4 text-xs font-mono text-gray-400 h-64 overflow-y-auto">
                    Esperando ejecución...
                </div>
                
                <button id="run-maintenance" class="w-full mt-4 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg py-2 text-sm transition-colors border border-purple-500/50">
                    Ejecutar Diagnóstico y Reparación
                </button>
            </div>
        </div>
    `;

    // Listeners
    if (config.gemini_key) {
        document.getElementById('send-gemini').addEventListener('click', async () => {
            const input = document.getElementById('gemini-prompt');
            const log = document.getElementById('gemini-chat-log');
            const prompt = input.value.trim();
            if (!prompt) return;

            // Add User Message
            log.innerHTML += `<div class="text-right"><span class="bg-purple-600/20 text-purple-200 px-3 py-1.5 rounded-lg inline-block">${prompt}</span></div>`;
            log.scrollTop = log.scrollHeight;
            input.value = '';
            input.disabled = true;

            try {
                // Add Loading
                const loadingId = 'loading-' + Date.now();
                log.innerHTML += `<div id="${loadingId}" class="text-left text-gray-500 text-xs animate-pulse">Escribiendo...</div>`;

                const response = await brain.askGemini(config.gemini_key, prompt);

                document.getElementById(loadingId).remove();
                // Parse basic Markdown (bold) to HTML
                const htmlResponse = response.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
                log.innerHTML += `<div class="text-left"><span class="bg-white/5 text-gray-200 px-3 py-1.5 rounded-lg inline-block border border-white/10">${htmlResponse}</span></div>`;
            } catch (err) {
                log.innerHTML += `<div class="text-red-400 text-xs text-center mt-2">Error: ${err.message}</div>`;
            } finally {
                input.disabled = false;
                input.focus();
                log.scrollTop = log.scrollHeight;
            }
        });
    }

    document.getElementById('run-maintenance').addEventListener('click', async () => {
        const log = document.getElementById('maintenance-log');
        log.innerHTML = '<span class="text-yellow-500">Ejecutando escaneo del sistema...</span><br>';

        try {
            const report = await brain.runAutoMaintenence();
            if (report.actions.length > 0) {
                log.innerHTML += report.actions.map(a => `<span class="text-green-400">✓ ${a}</span>`).join('<br>');
                log.innerHTML += `<br><span class="text-white">Operación completada. Se repararon ${report.fixedIds.length} registros.</span>`;
            } else {
                log.innerHTML += '<span class="text-green-500">✓ Sistema saludable. No se encontraron inconsistencias.</span>';
            }
        } catch (e) {
            log.innerHTML += `<span class="text-red-500">Error: ${e.message}</span>`;
        }
    });
};

const renderConfigTab = async (container) => {
    const config = await getConfiguracion();

    container.innerHTML = `
        <h2 class="text-xl font-bold mb-6 border-b border-white/10 pb-2 text-teal-100">Configuración del Sistema</h2>
        
        <div class="flex flex-wrap gap-2 mb-6 text-sm border-b border-white/10 pb-4">
            <button class="sub-tab-btn active bg-teal-500/20 text-teal-200 px-4 py-2 rounded-lg border border-teal-500/30" data-sub="modulos">Módulos</button>
            <button class="sub-tab-btn bg-white/5 text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10" data-sub="congregacion">Congregación</button>
            <button class="sub-tab-btn bg-white/5 text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10" data-sub="territorios">Territorios</button>
            <button class="sub-tab-btn bg-white/5 text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10" data-sub="conductores">Conductores</button>
            <button class="sub-tab-btn bg-white/5 text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10" data-sub="publicadores">Publicadores</button>
        </div>

        <div id="config-content" class="animate-fade-in">
            <!-- Content loaded here -->
        </div>
    `;

    const subTabs = container.querySelectorAll('.sub-tab-btn');
    subTabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            subTabs.forEach(b => b.className = 'sub-tab-btn bg-white/5 text-gray-400 px-4 py-2 rounded-lg hover:bg-white/10');
            e.target.className = 'sub-tab-btn bg-teal-500/20 text-teal-200 px-4 py-2 rounded-lg border border-teal-500/30';
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
                <h3 class="font-semibold text-lg text-teal-100">Módulos del Conductor</h3>
                <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <span>Dashboard</span>
                    <input type="checkbox" id="check-dashboard" ${config.modulos_activos.dashboard ? 'checked' : ''} class="w-5 h-5 accent-teal-500">
                </div>
                <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <span>Programa de Predicación</span>
                    <input type="checkbox" id="check-programa" ${config.modulos_activos.programa_predicacion ? 'checked' : ''} class="w-5 h-5 accent-teal-500">
                </div>
                <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <span>Predicación Telefónica</span>
                    <input type="checkbox" id="check-telefonos" ${config.modulos_activos.predicacion_telefonica ? 'checked' : ''} class="w-5 h-5 accent-teal-500">
                </div>

                <div class="pt-4 mt-6 border-t border-white/10">
                    <h3 class="font-semibold text-lg text-teal-100 mb-2">Integración IA (Gemini)</h3>
                    <div class="p-4 bg-white/5 rounded-lg border border-white/10">
                        <label class="block text-xs uppercase text-teal-400 mb-2">API Key (Google Gemini)</label>
                        <input type="password" id="gemini-key" value="${config.gemini_key || ''}" class="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-teal-500 outline-none" placeholder="AIxa...">
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
                <!-- Datos Generales Card -->
                <div class="morphinglass p-6 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden group">
                    <div class="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div class="relative z-10 space-y-6">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="p-2 bg-teal-500/20 rounded-lg text-teal-300">🏢</div>
                            <h3 class="font-bold text-xl text-teal-50">Datos Generales</h3>
                        </div>
                        
                        <div class="space-y-4">
                            <div class="group/input">
                                <label class="block text-xs uppercase tracking-wider text-teal-400 mb-1.5 font-medium ml-1">Nombre Congregación</label>
                                <input type="text" id="conf-nombre" value="${config.congregacion?.nombre || ''}" 
                                    class="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:border-teal-500/50 focus:bg-black/40 focus:ring-1 focus:ring-teal-500/50 transition-all outline-none">
                            </div>
                            <div class="group/input">
                                <label class="block text-xs uppercase tracking-wider text-teal-400 mb-1.5 font-medium ml-1">Número</label>
                                <input type="text" id="conf-numero" value="${config.congregacion?.numero || ''}" 
                                    class="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:border-teal-500/50 focus:bg-black/40 focus:ring-1 focus:ring-teal-500/50 transition-all outline-none">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Horarios y Lugares Card -->
                <div class="morphinglass p-6 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden group">
                    <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div class="relative z-10 space-y-6">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="p-2 bg-blue-500/20 rounded-lg text-blue-300">🕰️</div>
                            <h3 class="font-bold text-xl text-teal-50">Configuración Programa</h3>
                        </div>

                        <div class="space-y-5">
                            <div>
                                <label class="block text-xs uppercase tracking-wider text-teal-400 mb-1.5 font-medium ml-1">Horarios para Predicación (separados por coma)</label>
                                <input type="text" id="conf-prog-horarios" value="${config.horarios_programa?.join(', ') || ''}" 
                                    class="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-teal-500/50 transition-all font-mono" 
                                    placeholder="Ej: 08:45, 09:15, 16:00, 19:15">
                                <p class="text-[10px] text-gray-400 mt-2 ml-1 opacity-60">Estos horarios aparecerán como opciones disponibles en el Programa Semanal.</p>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs uppercase tracking-wider text-teal-400 mb-1.5 font-medium ml-1">Lugares Validos</label>
                                    <textarea id="conf-lugares" class="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-xs h-24 focus:border-teal-500/50 transition-all resize-none leading-relaxed">${config.lugares?.join(', ') || ''}</textarea>
                                </div>
                                <div>
                                    <label class="block text-xs uppercase tracking-wider text-teal-400 mb-1.5 font-medium ml-1">Facetas Validas</label>
                                    <textarea id="conf-facetas" class="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-xs h-24 focus:border-teal-500/50 transition-all resize-none leading-relaxed">${config.facetas?.join(', ') || ''}</textarea>
                                </div>
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

    } else if (subTab === 'territorios') {
        const territorios = await getTerritorios();
        territorios.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));
        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-semibold text-lg text-teal-100">Gestión de Territorios</h3>
                <button id="btn-add-territorio" class="bg-teal-600 text-sm px-4 py-2 rounded-lg hover:bg-teal-500">+ Agregar Territorio</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${territorios.map(t => `
                    <div class="bg-white/5 p-4 rounded-lg border border-white/10 relative group">
                        <div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button class="text-blue-400 hover:text-blue-300 bg-black/50 p-1 rounded" onclick="window.editTerritorio('${t.id}')">✏️</button>
                            <button class="text-red-400 hover:text-red-300 bg-black/50 p-1 rounded" onclick="window.deleteTerritorio('${t.id}')">🗑️</button>
                        </div>
                        <div class="h-32 bg-black/40 rounded mb-3 overflow-hidden">
                            <img src="${t.imagen || 'https://via.placeholder.com/300x200?text=No+Map'}" class="w-full h-full object-cover">
                        </div>
                        <div class="font-bold text-teal-300 text-lg">Territorio ${t.numero}</div>
                        <div class="text-xs text-gray-400">${t.manzanas}</div>
                    </div>
                `).join('')}
            </div>
        `;

        document.getElementById('btn-add-territorio').addEventListener('click', () => {
            showModal(`
                <h3 class="text-xl font-bold mb-4 text-teal-400">Nuevo Territorio</h3>
                <input type="text" id="new-t-num" placeholder="Número (ej. 101)" class="w-full mb-3">
                <input type="text" id="new-t-manzanas" placeholder="Manzanas (ej. Mz.1, Mz.2)" class="w-full mb-3">
                <input type="text" id="new-t-img" placeholder="URL Imagen Mapa" class="w-full mb-4">
                <button id="save-new-territorio" class="w-full bg-teal-600 py-2 rounded-lg text-white">Guardar</button>
            `, async (modal) => {
                document.getElementById('save-new-territorio').addEventListener('click', async () => {
                    await addTerritorio({
                        numero: document.getElementById('new-t-num').value,
                        manzanas: document.getElementById('new-t-manzanas').value,
                        imagen: document.getElementById('new-t-img').value
                    });
                    modal.classList.add('hidden');
                    loadSubTab('territorios', container, config);
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
                <h3 class="text-xl font-bold mb-4 text-teal-400">Editar Territorio</h3>
                <input type="text" id="edit-t-num" value="${t.numero}" placeholder="Número" class="w-full mb-3">
                <input type="text" id="edit-t-manzanas" value="${t.manzanas}" placeholder="Manzanas" class="w-full mb-3">
                <input type="text" id="edit-t-img" value="${t.imagen || ''}" placeholder="URL Imagen Mapa" class="w-full mb-4">
                <button id="update-territorio" class="w-full bg-teal-600 py-2 rounded-lg text-white">Actualizar</button>
            `, async (modal) => {
                document.getElementById('update-territorio').addEventListener('click', async () => {
                    await updateTerritorio(id, {
                        numero: document.getElementById('edit-t-num').value,
                        manzanas: document.getElementById('edit-t-manzanas').value,
                        imagen: document.getElementById('edit-t-img').value
                    });
                    modal.classList.add('hidden');
                    loadSubTab('territorios', container, config);
                });
            });
        };

    } else if (subTab === 'conductores') {
        const conductores = await getConductores();
        conductores.sort((a, b) => a.nombre.localeCompare(b.nombre));
        renderListCRUD(container, 'Conductores', conductores, ['nombre', 'telefono'], async (data) => {
            await addConductor(data);
        }, async (id) => {
            await deleteConductor(id);
        }, async (id, data) => {
            await updateConductor(id, data);
        });
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
    }
};

const renderTelefonosTab = async (container) => {
    const telefonos = await getTelefonos();
    const publicadores = await getPublicadores();
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

    container.innerHTML = `
        <h3 class="font-semibold text-lg text-teal-100 mb-4">Gestión de Predicación Telefónica</h3>
        
        <!-- Controls Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div class="flex gap-2">
                <button id="btn-add-phone" class="bg-teal-600 px-4 py-2 rounded-lg text-sm hover:bg-teal-500 transition-colors whitespace-nowrap">+ Manual</button>
                <input type="file" id="csv-upload" accept=".csv" class="hidden">
                <button id="btn-csv" class="bg-white/10 px-4 py-2 rounded-lg text-sm border border-white/10 hover:bg-white/20 transition-colors whitespace-nowrap">📂 CSV</button>
            </div>
            
            <div class="flex gap-2 flex-wrap">
                <input type="text" id="search-number" placeholder="Buscar número..." class="w-full md:w-auto flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-teal-500 outline-none">
                <select id="filter-publisher" class="w-full md:w-auto flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-teal-500 outline-none">
                    <option value="">Todos los Publicadores</option>
                    <option value="Sin asignar">Sin asignar</option>
                    ${publicadores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                </select>
                <select id="filter-status" class="w-full md:w-auto flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-teal-500 outline-none">
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

        <!-- Progress Bar Container -->
        <div id="upload-progress-container" class="hidden mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <div class="flex justify-between text-sm text-gray-300 mb-2">
                <span id="progress-text">Cargando...</span>
                <span id="progress-percent">0%</span>
            </div>
            <div class="w-full bg-black/50 rounded-full h-2.5">
                <div id="upload-progress-bar" class="bg-teal-500 h-2.5 rounded-full" style="width: 0%"></div>
            </div>
        </div>
        <div id="phone-list-container" class="bg-black/20 rounded-lg border border-white/5 h-[600px] overflow-y-auto relative">
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
            listContainer.innerHTML = '<div class="p-8 text-center text-gray-500">No se encontraron registros coinciden con los filtros</div>';
            return;
        }

        listContainer.innerHTML = `
            <table class="w-full text-left text-sm text-gray-300">
                <thead class="text-teal-400 uppercase bg-black/40 text-xs tracking-wider sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                        <th class="p-4 font-semibold">Propietario</th>
                        <th class="p-4 font-semibold">Dirección</th>
                        <th class="p-4 font-semibold">Número</th>
                        <th class="p-4 font-semibold">Publicador</th>
                        <th class="p-4 font-semibold">Estado</th>
                        <th class="p-4 font-semibold">Comentarios</th>
                        <th class="p-4 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                ${filtered.map(t => {
            // Resolve Publisher Name for Display
            const rawAssigned = t.asignado_a || t.publicador_asignado;
            let assignedDisplay = 'Sin asignar';
            if (rawAssigned) {
                const p = publicadores.find(pub => pub.id === rawAssigned || pub.email === rawAssigned || pub.nombre === rawAssigned);
                assignedDisplay = p ? p.nombre : (rawAssigned === 'Pendiente' ? 'Sin asignar' : rawAssigned);
            }

            // Resolve Status
            const displayStatus = (!t.estado || t.estado === 'Pendiente') ? 'Sin asignar' : t.estado;
            const statusColor = getStatusColor(displayStatus);

            // Custom Phone Format: XXX XXXX (for 7 digits)
            let phoneDisplay = t.numero || '';
            const cleanNum = phoneDisplay.replace(/\D/g, '');
            if (cleanNum.length === 7) {
                phoneDisplay = `${cleanNum.slice(0, 3)} ${cleanNum.slice(3)}`;
            } else {
                phoneDisplay = formatPhoneNumber(phoneDisplay); // Fallback to existing formatter
            }

            return `
                    <tr class="hover:bg-white/5 transition-colors group">
                        <td class="p-4 text-gray-300 text-sm font-bold uppercase tracking-wide">${t.propietario || '-'}</td>
                        <td class="p-4 text-gray-400 text-xs uppercase">${t.direccion || '-'}</td>
                        <td class="p-4 font-mono text-teal-300 text-base tracking-wider">${phoneDisplay}</td>
                        <td class="p-4">
                            <span class="text-xs bg-white/5 px-2 py-1 rounded text-gray-300 border border-white/5 whitespace-nowrap">${assignedDisplay}</span>
                        </td>
                        <td class="p-4">
                             <span class="${statusColor} text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-white/5 border border-white/5 whitespace-nowrap">${displayStatus}</span>
                        </td>
                        <td class="p-4">
                            <span class="text-xs text-gray-500 italic truncate max-w-[150px] block" title="${t.comentario || ''}">${t.comentario || '-'}</span>
                        </td>
                        <td class="p-4 text-right">
                             <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="window.editTelefonoAdmin('${t.id}')" class="text-blue-400 p-1.5 hover:bg-blue-500/20 rounded transition-colors" title="Editar">✏️</button>
                                <button onclick="window.deleteTelefonoAdmin('${t.id}')" class="text-red-400 p-1.5 hover:bg-red-500/20 rounded transition-colors" title="Eliminar">✕</button>
                             </div>
                        </td>
                    </tr>
                `;
        }).join('')}
                </tbody>
            </table>
        `;
    };

    // Initial Render
    renderList();

    // Filter Listeners
    document.getElementById('search-number').addEventListener('input', renderList);
    document.getElementById('filter-publisher').addEventListener('change', renderList);
    document.getElementById('filter-status').addEventListener('change', renderList);
    document.getElementById('filter-status').addEventListener('change', renderList);

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
    <h3 class="text-xl font-bold mb-4 text-teal-400">Editar Registro Telefónico</h3>

                            <div class="space-y-4">
                                <div>
                                    <label class="block text-xs text-teal-500 mb-1">Número</label>
                                    <input type="text" id="edit-p-num" value="${t.numero}" class="w-full bg-white/5 border border-white/10 rounded p-2 text-white focus:border-teal-500 outline-none font-mono">
                                </div>

                                <div>
                                    <label class="block text-xs text-teal-500 mb-1">Nombre Propietario</label>
                                    <input type="text" id="edit-p-prop" value="${t.propietario || ''}" class="w-full bg-white/5 border border-white/10 rounded p-2 text-white focus:border-teal-500 outline-none">
                                </div>

                                <div>
                                    <label class="block text-xs text-teal-500 mb-1">Dirección</label>
                                    <input type="text" id="edit-p-dir" value="${t.direccion || ''}" class="w-full bg-white/5 border border-white/10 rounded p-2 text-white focus:border-teal-500 outline-none">
                                </div>

                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-xs text-teal-500 mb-1">Asignado a (Publicador)</label>
                                        <select id="edit-p-pub" class="w-full bg-white/5 border border-white/10 rounded p-2 text-white focus:border-teal-500 outline-none cursor-pointer">
                                            <option value="" class="bg-gray-900 text-gray-400">Sin asignar</option>
                                            ${publicadores.map(p => `<option value="${p.nombre}" ${t.asignado_a === p.nombre ? 'selected' : ''} class="bg-gray-900">${p.nombre}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-xs text-teal-500 mb-1">Estado</label>
                                        <select id="edit-p-estado" class="w-full bg-white/5 border border-white/10 rounded p-2 text-white focus:border-teal-500 outline-none cursor-pointer">
                                            ${estados.map(st => `<option value="${st}" ${t.estado === st ? 'selected' : ''} class="bg-gray-900">${st}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button id="update-phone" class="w-full bg-teal-600 py-2 rounded-lg text-white hover:bg-teal-500 transition-colors mt-6 font-medium shadow-lg shadow-teal-500/20">Actualizar Registro</button>
`, async (modal) => {
            document.getElementById('update-phone').addEventListener('click', async () => {
                await updateTelefono(id, {
                    numero: document.getElementById('edit-p-num').value,
                    direccion: document.getElementById('edit-p-dir').value,
                    propietario: document.getElementById('edit-p-prop').value,
                    asignado_a: document.getElementById('edit-p-pub').value,
                    estado: document.getElementById('edit-p-estado').value
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
    <h3 class="text-xl font-bold mb-4 text-teal-400">Nuevo Teléfono</h3>
            
            <label class="block text-xs text-teal-500 mb-1">Número</label>
            <input type="text" id="new-p-num" placeholder="Ej. 0991234567" class="w-full mb-3 bg-white/5 border border-white/10 rounded p-2 text-white focus:border-teal-500 outline-none">
            
            <label class="block text-xs text-teal-500 mb-1">Dirección</label>
            <input type="text" id="new-p-dir" placeholder="Ej. Av. Principal 123" class="w-full mb-3 bg-white/5 border border-white/10 rounded p-2 text-white focus:border-teal-500 outline-none">
            
            <label class="block text-xs text-teal-500 mb-1">Propietario</label>
            <input type="text" id="new-p-prop" placeholder="Ej. Juan Pérez" class="w-full mb-4 bg-white/5 border border-white/10 rounded p-2 text-white focus:border-teal-500 outline-none">
            
            <button id="save-new-phone" class="w-full bg-teal-600 py-2 rounded-lg text-white hover:bg-teal-500 transition-colors">Guardar</button>
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
            <h3 class="font-semibold text-lg text-teal-100">${title}</h3>
            <button id="btn-add-item" class="bg-teal-600 text-sm px-4 py-2 rounded-lg hover:bg-teal-500">+ Agregar</button>
        </div>
        <div class="space-y-2 max-h-96 overflow-y-auto">
            ${items.map(item => `
                <div class="flex justify-between items-center p-3 bg-white/5 rounded border border-white/10 group">
                    <div>
                        <div class="font-medium text-gray-200">${item[fields[0]]}</div>
                        ${fields[1] ? `<div class="text-xs text-gray-500">${item[fields[1]]}</div>` : ''}
                    </div>
                    <div class="flex gap-2">
                         ${onEdit ? `<button class="text-teal-400 hover:text-teal-300 p-2 bg-teal-500/10 rounded-lg transition-colors" onclick="window.editItem_${title.replace(/\s/g, '')}('${item.id}')">✏️</button>` : ''}
                        <button class="text-red-400 hover:text-red-300 p-2 bg-red-500/10 rounded-lg transition-colors" onclick="window.deleteItem_${title.replace(/\s/g, '')}('${item.id}')">✕</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('btn-add-item').addEventListener('click', () => {
        const inputs = fields.map(f => `<input type="text" id="field-${f}" placeholder="${f.charAt(0).toUpperCase() + f.slice(1)}" class="w-full mb-3">`).join('');
        showModal(`
                                                <h3 class="text-xl font-bold mb-4 text-teal-400">Nuevo ${title}</h3>
                                                ${inputs}
                                                <button id="save-item" class="w-full bg-teal-600 py-2 rounded-lg text-white">Guardar</button>
        `, async (modal) => {
            document.getElementById('save-item').addEventListener('click', async () => {
                const data = {};
                fields.forEach(f => data[f] = document.getElementById(`field-${f}`).value);
                await onAdd(data);
                modal.classList.add('hidden');
                // showCustomAlert("Guardado."); // Removed alert
                if (window.reloadCurrentSubTab) window.reloadCurrentSubTab();
            });
        });
    });

    const safeTitle = title.replace(/\s/g, '');

    window[`deleteItem_${safeTitle}`] = async (id) => {
        showCustomConfirm('¿Eliminar este elemento?', async () => {
            await onDelete(id);
            // showCustomAlert("Eliminado."); // Removed alert
            if (window.reloadCurrentSubTab) window.reloadCurrentSubTab();
        });
    };

    if (onEdit) {
        window[`editItem_${safeTitle}`] = async (id) => {
            const item = items.find(x => x.id === id);
            if (!item) return;
            const inputs = fields.map(f => `<input type="text" id="edit-field-${f}" value="${item[f] || ''}" placeholder="${f.charAt(0).toUpperCase() + f.slice(1)}" class="w-full mb-3">`).join('');

            showModal(`
                <h3 class="text-xl font-bold mb-4 text-teal-400">Editar ${title}</h3>
                ${inputs}
                <button id="update-item" class="w-full bg-teal-600 py-2 rounded-lg text-white">Actualizar</button>
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
                                                    <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
                                                        <div>
                                                            <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-teal-400">Predicación Pública</h2>
                                                            <p class="text-sm text-gray-400">Gestiona los turnos y asignaciones semanales</p>
                                                        </div>
                                                        <div class="flex gap-3">
                                                            <button id="add-row-btn" class="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/20 transition-all transform hover:scale-105">
                                                                <span>+</span> Nuevo Turno
                                                            </button>
                                                            <button id="export-pdf" class="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl border border-white/10 transition-colors">
                                                                📄 PDF
                                                            </button>
                                                        </div>
                                                    </header>

                                                    <div class="morphinglass-card overflow-hidden rounded-2xl border border-white/10 shadow-2xl" id="pdf-content">
                                                        <div class="overflow-x-auto">
                                                            <table class="w-full text-left border-collapse">
                                                                <thead>
                                                                    <tr class="bg-gradient-to-r from-teal-900/40 to-black/40 text-teal-100 uppercase text-xs tracking-wider">
                                                                        <th class="p-4 font-semibold border-b border-white/10">Día</th>
                                                                        <th class="p-4 font-semibold border-b border-white/10 text-center">Horario</th>
                                                                        <th class="p-4 font-semibold border-b border-white/10">Lugar</th>
                                                                        <th class="p-4 font-semibold border-b border-white/10 w-1/5">Publicador</th>
                                                                        <th class="p-4 font-semibold border-b border-white/10 w-1/5">Compañero</th>
                                                                        <th class="p-4 font-semibold border-b border-white/10 text-center w-16 no-print">Acción</th>
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
                                                <tr class="hover:bg-white/5 transition-colors group">
                                                    <td class="p-2">
                                                        <select class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-teal-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all appearance-none cursor-pointer"
                                                            onchange="updateRow(${index}, 'dia', this.value)">
                                                            <option value="" disabled ${!row.dia ? 'selected' : ''}>Seleccionar</option>
                                                            ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d =>
            `<option value="${d}" ${row.dia === d ? 'selected' : ''} class="bg-gray-900">${d}</option>`
        ).join('')}
                                                        </select>
                                                    </td>
                                                    <td class="p-2">
                                                        <div class="flex items-center gap-1">
                                                            <input type="time" class="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-gray-200 focus:outline-none focus:border-teal-500 transition-all font-mono text-center text-xs"
                                                                value="${row.hora || ''}"
                                                                title="Hora Inicio"
                                                                onchange="updateRow(${index}, 'hora', this.value)">
                                                            <span class="text-gray-500">-</span>
                                                            <input type="time" class="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-gray-200 focus:outline-none focus:border-teal-500 transition-all font-mono text-center text-xs"
                                                                value="${row.hora_fin || ''}"
                                                                title="Hora Fin"
                                                                onchange="updateRow(${index}, 'hora_fin', this.value)">
                                                        </div>
                                                    </td>
                                                    <td class="p-2">
                                                        <div class="relative w-full h-full group/select">
                                                            <select class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-teal-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all appearance-none cursor-pointer"
                                                                onchange="updateRow(${index}, 'lugar', this.value)">
                                                                <option value="" disabled ${!row.lugar ? 'selected' : ''}>Seleccionar Lugar</option>
                                                                ${(config.lugares || []).map(lugar =>
            `<option value="${lugar}" ${row.lugar === lugar ? 'selected' : ''} class="bg-gray-900">${lugar}</option>`
        ).join('')}
                                                                ${row.lugar && !(config.lugares || []).includes(row.lugar) ? `<option value="${row.lugar}" selected class="bg-gray-900 text-yellow-500">${row.lugar} (No listado)</option>` : ''}
                                                            </select>
                                                            <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-teal-500/30 group-hover/select:text-teal-400 transition-colors text-[10px]">▼</div>
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

const showModal = (content, onOpen) => {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
                                                <div class="morphinglass-card w-full max-w-md m-4 relative animate-fade-in bg-black">
                                                    <button class="absolute top-4 right-4 text-gray-400 hover:text-white" onclick="document.getElementById('modal-container').classList.add('hidden')">✕</button>
                                                    ${content}
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
             <h3 class="text-xl font-bold text-teal-400 mb-2">Confirmar Acción</h3>
             <p class="text-gray-300 mb-6 text-sm">${message}</p>
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

    // 2. Setup Container Structure with Navigation
    container.innerHTML = `
        <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-6">
            <div>
                <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-200 to-teal-400">📅 Programa de Predicación</h2>
                <p class="text-gray-400 text-sm">Organiza las salidas de servicio de la semana</p>
            </div>

            <div class="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto bg-black/40 p-1.5 rounded-2xl border border-white/5">
                <div class="flex items-center gap-2 bg-[#0f1115] rounded-xl px-2 py-1 border border-white/5 shadow-inner">
                    <button id="prev-week" class="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors group">
                        <span class="group-hover:-translate-x-0.5 transition-transform block">◀</span>
                    </button>
                    <div class="text-center px-2 min-w-[140px]">
                        <span class="block text-[10px] text-teal-500 font-bold uppercase tracking-widest leading-none mb-1">Semana</span>
                        <span id="week-range-label" class="text-gray-200 font-bold text-sm block leading-none whitespace-nowrap">Cargando...</span>
                    </div>
                    <button id="next-week" class="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors group">
                        <span class="group-hover:translate-x-0.5 transition-transform block">▶</span>
                    </button>
                    <button id="reset-today" class="hidden ml-2 text-[10px] bg-teal-500/10 text-teal-400 px-2 py-1 rounded border border-teal-500/20 hover:bg-teal-500/20 transition-colors">Hoy</button>
                </div>
                
                <button id="save-admin-prog" class="w-full sm:w-auto group relative px-6 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 rounded-xl text-white font-semibold shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.02] transition-all duration-300">
                    <span class="relative flex items-center justify-center gap-2">💾 Guardar</span>
                </button>
            </div>
        </div>

        <div class="space-y-1 relative">
            <div id="prog-loading-overlay" class="absolute inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-center justify-center hidden rounded-xl">
                 <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
            </div>
            <div class="overflow-x-auto rounded-xl border border-white/10 shadow-2xl bg-[#0f1115] scrollbar-thin scrollbar-thumb-teal-900 scrollbar-track-black min-h-[400px]" id="admin-prog-table">
                <!-- Table will be injected here -->
            </div>
            <p class="text-[10px] text-gray-500 text-right px-2">* Los cambios se guardan por semana específica.</p>
        </div>
    `;

    const tableContainer = document.getElementById('admin-prog-table');
    const loadingOverlay = document.getElementById('prog-loading-overlay');
    const rangeLabel = document.getElementById('week-range-label');
    const btnResetToday = document.getElementById('reset-today');

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

    // 3. Render Logic Function
    const renderTable = () => {
        const turnos = [
            {
                id: 'manana',
                label: '🌅 MAÑANA',
                headerColor: 'bg-gradient-to-r from-cyan-950/80 to-cyan-900/80 text-cyan-200 border-l-4 border-cyan-500',
                rowColor: 'bg-gradient-to-r from-cyan-900/5 to-transparent',
                accent: 'text-cyan-400',
                fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio']
            },
            {
                id: 'tarde',
                label: '☀️ TARDE',
                headerColor: 'bg-gradient-to-r from-orange-950/80 to-orange-900/80 text-orange-200 border-l-4 border-orange-500',
                rowColor: 'bg-gradient-to-r from-orange-900/5 to-transparent',
                accent: 'text-orange-400',
                fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio']
            },
            {
                id: 'noche',
                label: '🌙 NOCHE',
                headerColor: 'bg-gradient-to-r from-indigo-950/80 to-indigo-900/80 text-indigo-200 border-l-4 border-indigo-500',
                rowColor: 'bg-gradient-to-r from-indigo-900/5 to-transparent',
                accent: 'text-indigo-400',
                fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio']
            },
            {
                id: 'zoom',
                label: '📹 ZOOM',
                headerColor: 'bg-gradient-to-r from-emerald-950/80 to-emerald-900/80 text-emerald-200 border-l-4 border-emerald-500',
                rowColor: 'bg-gradient-to-r from-emerald-900/5 to-transparent',
                accent: 'text-emerald-400',
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

        let html = `
            <div class="overflow-hidden rounded-2xl shadow-2xl border border-white/5 bg-[#0f1115] relative group/table">
                <!-- Background decoration -->
                <div class="absolute inset-0 bg-gradient-to-br from-teal-900/5 to-purple-900/5 pointer-events-none"></div>
                
                <div class="overflow-x-auto relative z-10 [&::-webkit-scrollbar]:hidden" style="scrollbar-width: none; -ms-overflow-style: none;">
                    <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="sticky top-0 z-30 bg-[#0f1115]/95 backdrop-blur-xl border-b border-white/10 text-xs font-bold uppercase tracking-widest text-gray-400 shadow-md">
                            <th class="p-3 sticky left-0 bg-[#0f1115] z-40 border-b border-white/10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                                <span class="bg-gradient-to-r from-gray-200 to-gray-400 bg-clip-text text-transparent">Día</span>
                            </th>
                            <th class="p-3 min-w-[160px] text-center border-l border-white/5 relative overflow-hidden group/th">
                                <div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                                <span class="bg-gradient-to-r from-cyan-200 to-cyan-400 bg-clip-text text-transparent relative z-10 flex items-center justify-center gap-2">
                                    <span class="text-lg">🌅</span> Mañana
                                </span>
                            </th>
                            <th class="p-3 min-w-[160px] text-center border-l border-white/5 relative overflow-hidden group/th">
                                <div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50"></div>
                                <span class="bg-gradient-to-r from-orange-200 to-orange-400 bg-clip-text text-transparent relative z-10 flex items-center justify-center gap-2">
                                    <span class="text-lg">☀️</span> Tarde
                                </span>
                            </th>
                            <th class="p-3 min-w-[160px] text-center border-l border-white/5 relative overflow-hidden group/th">
                                <div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
                                <span class="bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent relative z-10 flex items-center justify-center gap-2">
                                    <span class="text-lg">🌙</span> Noche
                                </span>
                            </th>
                            <th class="p-3 min-w-[160px] text-center border-l border-white/5 relative overflow-hidden group/th">
                                <div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
                                <span class="bg-gradient-to-r from-emerald-200 to-emerald-400 bg-clip-text text-transparent relative z-10 flex items-center justify-center gap-2">
                                    <span class="text-lg">📹</span> Zoom
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
        `;

        programa.dias.forEach((dia, dayIndex) => {
            html += `<tr class="group/row hover:bg-white/[0.02] transition-colors">
                <!-- Day Column -->
                <td class="p-4 font-bold text-teal-100 sticky left-0 bg-[#0f1115] z-20 border-r border-white/10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] group-hover/row:bg-[#15181e] transition-colors">
                    <div class="flex flex-col items-center justify-center h-full gap-1.5 relative">
                        <div class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-teal-500/50 rounded-r-full"></div>
                        <span class="text-xl font-black tracking-tight bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">${dia.nombre.substring(0, 3)}</span>
                        <span class="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-medium">${dia.nombre}</span>
                    </div>
                </td>`;

            // Turns Columns
            ['manana', 'tarde', 'noche', 'zoom'].forEach(turnoId => {
                const turnoConfig = turnos.find(t => t.id === turnoId) || {}; // fallback

                // Logic: Zoom only shows on Tuesday (Martes)
                if (turnoId === 'zoom' && dia.nombre !== 'Martes') {
                    html += `<td class="p-3 border-l border-white/5 align-top"></td>`;
                    return;
                }
                // Zoom on Tuesday corresponds intuitively to Morning time usually, but in data model it's a separate key 'zoom'.

                if (!dia[turnoId]) dia[turnoId] = {};
                const data = dia[turnoId];

                // Fields to show for this cell
                // We use a mini-form layout inside the cell

                const accent = turnoId === 'manana' ? 'cyan' :
                    turnoId === 'tarde' ? 'orange' :
                        turnoId === 'noche' ? 'indigo' : 'emerald';

                const cardColor = turnoId === 'manana' ? 'hover:bg-cyan-500/[0.03] hover:shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]' :
                    turnoId === 'tarde' ? 'hover:bg-orange-500/[0.03] hover:shadow-[inset_0_0_20px_rgba(249,115,22,0.05)]' :
                        turnoId === 'noche' ? 'hover:bg-indigo-500/[0.03] hover:shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]' : 'hover:bg-emerald-500/[0.03] hover:shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]';

                html += `<td class="p-2 border-l border-white/5 align-top transition-colors duration-300 ${cardColor}">
                    <div class="flex flex-col gap-3 h-full">
                `;

                // Render fields
                turnoConfig.fields.forEach(field => {
                    const val = data[field.toLowerCase()] || '';
                    const icon = getFieldIcon(field);
                    let inputHtml = '';

                    if (field === 'Territorio') {
                        const safeVal = (val || '').replace(/"/g, '&quot;');
                        inputHtml = `<button class="w-full relative group/btn flex items-center justify-between text-xs bg-black/40 hover:bg-black/60 text-gray-300 py-2 px-3 rounded-lg border border-white/5 hover:border-${accent}-500/30 shadow-sm transition-all duration-200"
                                    onclick="window.openTerritorySelector(${dayIndex}, '${turnoId}', this)"
                                    data-current="${safeVal}">
                                    <span class="truncate font-mono ${val ? `text-${accent}-300 font-medium` : 'text-gray-500 italic'}">${val || 'Asignar'}</span>
                                    <span class="opacity-0 group-hover/btn:opacity-100 transition-opacity text-${accent}-400">✏️</span>
                                    </button>`;
                    } else if (field === 'Grupos') {
                        // Show "Groups" ONLY in Sunday (All turns: Mañana, Tarde, Noche)
                        if (dia.nombre !== 'Domingo') return;

                        // Sunday logic
                        const safeVal = (val || '').replace(/"/g, '&quot;');
                        inputHtml = `
                         <button class="w-full relative group/btn flex items-center justify-between text-xs bg-black/40 hover:bg-black/60 text-gray-300 py-2 px-3 rounded-lg border border-white/5 hover:border-${accent}-500/30 shadow-sm transition-all duration-200"
                                    onclick="window.openGroupSelector(${dayIndex}, '${turnoId}', this)"
                                    data-current="${safeVal}">
                                    <span class="truncate ${val ? `text-${accent}-300 font-medium` : 'text-gray-500 italic'}">${val || 'Seleccionar'}</span>
                                    <span class="opacity-0 group-hover/btn:opacity-100 transition-opacity text-${accent}-400">✏️</span>
                                    </button>`;
                    } else {
                        // Selects
                        const opts = options[field] || [];
                        inputHtml = `<div class="relative group/sel">
                            <select class="w-full bg-black/40 hover:bg-black/60 text-gray-300 text-xs py-2 pl-3 pr-8 rounded-lg border border-white/5 focus:border-${accent}-500/50 appearance-none transition-all shadow-sm focus:shadow-[0_0_0_2px_rgba(0,0,0,0.5)] outline-none cursor-pointer"
                                data-day="${dayIndex}" data-turno="${turnoId}" data-field="${field.toLowerCase()}">
                                <option value="" class="bg-[#1a1c23]">-</option>
                                ${opts.map(o => `<option value="${o}" ${val === o ? 'selected' : ''} class="bg-[#1a1c23]">${o}</option>`).join('')}
                                ${val && !opts.includes(val) ? `<option value="${val}" selected class="bg-[#1a1c23] text-amber-500">${val}*</option>` : ''}
                            </select>
                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-600 group-hover/sel:text-${accent}-400 transition-colors">
                                <svg class="fill-current h-3 w-3 drop-shadow-sm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                            </div>
                         </div>`;
                    }
                    /* ... */
                    html += `
                        <div class="grid grid-cols-[24px_1fr] items-center gap-1.5 group/field hover:bg-white/[0.02] -mx-2 px-2 py-0.5 rounded transition-colors">
                             <div class="flex items-center justify-center w-6 h-6 rounded-md bg-white/5 text-gray-400 group-hover/field:text-${accent}-300 group-hover/field:bg-${accent}-900/20 transition-all text-xs border border-white/5 shadow-sm">
                                ${icon}
                            </div>
                            <div class="w-full min-w-0">${inputHtml}</div>
                        </div>
                     `;
                });

                html += `</div></td>`;
            });

            html += `</tr>`;
        });

        html += `</tbody></table></div>`;

        tableContainer.innerHTML = html;
        bindTableEvents();
    };

    const bindTableEvents = () => {
        tableContainer.querySelectorAll('select, input').forEach(input => {
            input.addEventListener('change', (e) => {
                const dayIdx = e.target.dataset.day;
                const turno = e.target.dataset.turno;
                const field = e.target.dataset.field;
                if (!programa.dias[dayIdx][turno]) programa.dias[dayIdx][turno] = {};
                programa.dias[dayIdx][turno][field] = e.target.value;
            });
        });
    };

    // Helper: Sunday Toggle
    window.toggleSundayMorningMode = (dayIdx, turnoId) => {
        if (!programa.dias[dayIdx][turnoId]) programa.dias[dayIdx][turnoId] = {};
        const currentLugar = programa.dias[dayIdx][turnoId]['lugar'] || '';

        // Logic: if currently Salón del Reino, switch to Empty/Custom. Else switch to Salón del Reino.
        if (currentLugar === 'Salón del Reino') {
            programa.dias[dayIdx][turnoId]['lugar'] = '';
            programa.dias[dayIdx][turnoId]['grupos'] = '';
            programa.dias[dayIdx][turnoId]['hora'] = '';
            // Allow user to fill in specific groups
            showCustomAlert("Modo: Grupos / Personalizado activado");
        } else {
            programa.dias[dayIdx][turnoId]['lugar'] = 'Salón del Reino';
            programa.dias[dayIdx][turnoId]['grupos'] = 'Todos';
            programa.dias[dayIdx][turnoId]['hora'] = '09:15';
            showCustomAlert("Modo: Congregación (Todos) activado");
        }
        renderTable(); // Re-render to reflect changes
    };

    // Helper: Group selector opener
    window.openGroupSelector = (dayIdx, turnoId, btnElement) => {
        const currentVal = programa.dias[dayIdx][turnoId]['grupos'] || '';
        showGroupSelectionModal(currentVal, (newVal) => {
            if (!programa.dias[dayIdx][turnoId]) programa.dias[dayIdx][turnoId] = {};
            programa.dias[dayIdx][turnoId]['grupos'] = newVal;
            renderTable(); // Re-render to reflect changes
        });
    };

    // Helper: Territory selector opener
    window.openTerritorySelector = (dayIdx, turnoId, btnElement) => {
        const currentVal = programa.dias[dayIdx][turnoId]['territorio'] || '';
        showTerritorySelectionModal(currentVal, territorios, (newVal) => {
            if (!programa.dias[dayIdx][turnoId]) programa.dias[dayIdx][turnoId] = {};
            programa.dias[dayIdx][turnoId]['territorio'] = newVal;
            renderTable(); // Re-render to reflect changes easily
        });
    };

    // Helper Icons
    function getFieldIcon(f) {
        const icons = { 'Lugar': '📍', 'Hora': '⏰', 'Conductor': '👤', 'Auxiliar': '🤝', 'Faceta': '🏷️', 'Territorio': '🗺️', 'Grupos': '👥' };
        return icons[f] || '•';
    }

    // Initial Render
    loadWeekData();

    // Event Listeners for Navigation
    document.getElementById('prev-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        loadWeekData();
    });

    document.getElementById('next-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        loadWeekData();
    });

    document.getElementById('reset-today').addEventListener('click', () => {
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
            await saveProgramaSemanal(programa, weekId);

            // AUTO-ASSIGN TERRITORIES LOGIC
            // 1. Reset all territories to 'Libre' first? No, that's dangerous if we only edit one day.
            // Better: Find ALL territories mentioned in this NEW program.
            const mentionedTerritories = new Set();
            const turnos = ['manana', 'tarde', 'noche'];

            programa.dias.forEach(d => {
                turnos.forEach(t => {
                    const tData = d[t];
                    if (tData && tData.territorio && tData.conductor) {
                        // Parse numbers from string like "10, 12 (Mz 1)"
                        // Simple regex to find standalone numbers
                        const matches = tData.territorio.match(/\b\d+\b/g);
                        if (matches) {
                            matches.forEach(num => mentionedTerritories.add({
                                numero: num,
                                conductor: tData.conductor
                            }));
                        }
                    }
                });
            });

            // 2. Update Firestore for each mentioned territory
            // We need to match 'Número' to ID. We have 'territorios' array available in scope.
            const updates = [];
            mentionedTerritories.forEach(mt => {
                const tObj = territorios.find(t => t.numero == mt.numero);
                if (tObj) {
                    // Check if already assigned to him to avoid write costs? 
                    // Let's just update to be safe and ensure latest date.
                    updates.push(assignTerritorio(tObj.id, mt.conductor));
                }
            });

            if (updates.length > 0) {
                await Promise.all(updates);
                console.log(`Auto-assigned ${updates.length} territories.`);
            }

            showCustomAlert("Programa guardado y territorios asignados.");
        } catch (e) {
            console.error(e);
            showCustomAlert("Error al guardar: " + e.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

/* --- Group Selection Modal --- */
const showGroupSelectionModal = (currentValue, onSave) => {
    // 12 Fixed Groups (can be dynamic if needed)
    const groups = Array.from({ length: 12 }, (_, i) => ({ id: `g${i + 1}`, label: `Grupo ${i + 1}` }));

    // Parse current state
    const selectedLabels = new Set();
    const isTodos = (currentValue || '').toLowerCase().includes('todos');

    if (!isTodos && currentValue) {
        groups.forEach(g => {
            if (currentValue.includes(g.label) || currentValue.match(new RegExp(`\\b${g.label.replace('Grupo ', '')}\\b`))) {
                selectedLabels.add(g.label);
            }
        });
    }

    const render = () => `
        <div class="flex flex-col h-[400px]">
            <header class="mb-4 border-b border-white/10 pb-2">
                <h3 class="text-xl font-bold text-teal-400">Seleccionar Grupos de Predicación</h3>
                <p class="text-xs text-gray-500">Selecciona uno o varios grupos para este turno.</p>
            </header>
            
            <div class="flex-1 overflow-y-auto space-y-2 pr-2">
                <label class="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer border border-transparent hover:border-teal-500/30 transition-all ${isTodos ? 'bg-teal-900/20 border-teal-500/50' : ''}">
                     <input type="checkbox" id="chk-todos-groups" class="accent-teal-500 w-5 h-5" ${isTodos ? 'checked' : ''}>
                     <span class="text-white font-bold">Todos</span>
                </label>
                <div class="grid grid-cols-2 gap-2">
                    ${groups.map(g => `
                        <label class="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer group/g border border-transparent hover:border-teal-500/30 transition-all ${selectedLabels.has(g.label) ? 'bg-teal-900/10 border-teal-500/30' : ''}">
                            <input type="checkbox" value="${g.label}" class="accent-teal-500 w-5 h-5 group-chk" ${selectedLabels.has(g.label) ? 'checked' : ''}>
                            <span class="text-gray-300 group-hover/g:text-white">${g.label}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <div class="mt-4 flex justify-end gap-3 pt-4 border-t border-white/10">
                 <button id="btn-cancel-groups" class="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancelar</button>
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
                        onSave(`Grupo ${nums[0]}`);
                    } else {
                        const last = nums.pop();
                        onSave(`Grupos ${nums.join(', ')} y ${last}`);
                    }
                }
            }
            modal.classList.add('hidden');
        });
    });
};

/* --- Territory Selector Modal Logic --- */

const showTerritorySelectionModal = (currentValue, allTerritories, onSave) => {
    // 1. Parsing current value
    const selectionState = {};
    allTerritories.forEach(t => {
        selectionState[t.id] = {
            selected: false,
            partial: false,
            manzanas: [],
            allManzanas: t.manzanas ? t.manzanas.split(/[,\\s]+/).map(m => m.trim()).filter(Boolean) : []
        };
    });

    if (currentValue) {
        const normVal = currentValue;
        allTerritories.forEach(t => {
            // Precise matching for "Territory Number" to avoid "1" matching "10"
            // Typically "1, 2, 4 (Mz..)"
            // Regex: Word boundary check
            const regex = new RegExp(`\\b${t.numero}\\b`);
            if (regex.test(normVal)) {
                selectionState[t.id].selected = true;

                // Check partials: "(Mz 1, Mz 2)" or "Mz.1" associated with this?
                // Since the string is flat like "4 (Mz 1, Mz 2)", we can check if parens follow the number.
                // This is advanced but let's try a simple includes check for now if the number is unique.
                // Better: just check if any of its manzanas are in the string?
                // Risk: Mz.1 exists in T1 and T4.

                // If we find the number, check the immediate following parenthesis group?
                // Simplification: We don't restore partial checkboxes perfectly from text yet.
                // We just select the territory. User re-selects partials if needed.
            }
        });
    }

    const renderModalContent = () => {
        return `
            <div class="flex flex-col h-[600px] text-left">
                <header class="mb-4 border-b border-white/10 pb-2">
                    <h3 class="text-xl font-bold text-teal-400">Seleccionar Territorios</h3>
                    <p class="text-xs text-gray-500">Marca los territorios para este turno. Expande para seleccionar manzanas específicas.</p>
                </header>
                
                <div class="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    ${allTerritories.map(t => {
            const state = selectionState[t.id];
            const isChecked = state.selected ? 'checked' : '';

            // Manzanas rendering
            const manzanasHtml = state.allManzanas.length > 0 ? `
                             <div class="ml-8 mt-2 pl-2 border-l border-white/10 ${isChecked ? '' : 'hidden'}" id="manzanas-${t.id}">
                                <div class="text-[9px] uppercase tracking-wider text-gray-500 mb-2">Manzanas Específicas (Opcional)</div>
                                <div class="grid grid-cols-2 gap-2">
                                     ${state.allManzanas.map(m => `
                                        <label class="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded group/mz">
                                            <input type="checkbox" class="accent-teal-500 manzana-check w-3 h-3" value="${m}" data-tid="${t.id}"
                                                ${state.manzanas.includes(m) ? 'checked' : ''}>
                                            <span class="text-xs text-gray-400 group-hover/mz:text-gray-200">${m}</span>
                                        </label>
                                     `).join('')}
                                </div>
                             </div>
                        ` : '';

            return `
                        <div class="bg-black/40 rounded-lg border border-white/5 p-3 transition-all hover:bg-white/5 hover:border-white/10 ${isChecked ? 'border-teal-500/30 bg-teal-900/10' : ''}">
                            <div class="flex items-center justify-between">
                                <label class="flex items-center gap-3 cursor-pointer select-none flex-1">
                                    <input type="checkbox" class="w-5 h-5 accent-teal-500 terr-check rounded" value="${t.id}" ${isChecked}>
                                    <div>
                                        <div class="font-bold text-gray-200">Territorio ${t.numero}</div>
                                        <div class="text-[10px] text-gray-500">${state.allManzanas.length} Manzanas</div>
                                    </div>
                                </label>
                            </div>
                            ${manzanasHtml}
                        </div>
                        `;
        }).join('')}
                </div>

                <div class="mt-4 pt-4 border-t border-white/10 flex justify-end gap-3 z-10 bg-black/80 backdrop-blur-md">
                    <button class="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors" onclick="document.getElementById('modal-container').classList.add('hidden')">Cancelar</button>
                    <button class="px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white rounded-lg font-medium shadow-lg shadow-teal-500/20" id="confirm-terr-selection">Confirmar Selección</button>
                </div>
            </div>
        `;
    };

    showModal(renderModalContent(), (modal) => {
        const container = modal.querySelector('.custom-scrollbar');

        // 1. Territory Checkbox Toggle
        container.querySelectorAll('.terr-check').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const tId = e.target.value;
                selectionState[tId].selected = e.target.checked;

                const mDiv = document.getElementById(`manzanas-${tId}`);
                if (mDiv) {
                    if (e.target.checked) {
                        mDiv.classList.remove('hidden');
                        // Animation maybe?
                    } else {
                        mDiv.classList.add('hidden');
                        // Clear selected manzanas if unchecking territory?
                        // selectionState[tId].manzanas = [];
                        // container.querySelectorAll(`.manzana-check[data-tid="${tId}"]`).forEach(mc => mc.checked = false);
                    }
                }
            });
        });

        // 2. Manzana Checkbox Toggle
        container.querySelectorAll('.manzana-check').forEach(mhk => {
            mhk.addEventListener('change', (e) => {
                const tId = e.target.dataset.tid;
                const val = e.target.value;
                if (e.target.checked) {
                    if (!selectionState[tId].manzanas.includes(val)) selectionState[tId].manzanas.push(val);
                } else {
                    selectionState[tId].manzanas = selectionState[tId].manzanas.filter(m => m !== val);
                }
            });
        });

        // 3. Confirm
        modal.querySelector('#confirm-terr-selection').addEventListener('click', () => {
            const parts = [];
            allTerritories.forEach(t => {
                const s = selectionState[t.id];
                if (s.selected) {
                    let str = t.numero;
                    if (s.manzanas.length > 0) {
                        str += ` (${s.manzanas.join(', ')})`;
                    }
                    parts.push(str);
                }
            });

            const finalString = parts.join(', ');
            onSave(finalString);
            modal.classList.add('hidden');
        });
    });
};
