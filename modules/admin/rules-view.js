/* global Sortable */
import {
    saveConfiguracion,
    getPuntosInteres, addPuntoInteres, deletePuntoInteres, updatePuntoInteres,
    getTerritorios
} from '../../data/firestore-services.js';
import { showCustomPrompt, showModal, showCustomConfirm } from '../services/ui-helpers.js';
import { showNotification } from '../utils/helpers.js';

export const renderConfigTab = async (container, config, appVersion, reloadTabFn) => {
    const [puntosInteres, territorios] = await Promise.all([
        getPuntosInteres(), getTerritorios()
    ]);

    // Helper for showing manual LED feedback
    const triggerManualLED = async (id) => {
        const el = container.querySelector(`#led-${id}`);
        if (!el) return () => { };
        el.innerHTML = '<div class="led-spinner"></div>';
        el.classList.remove('hidden', 'opacity-0');
        el.style.display = 'flex';
        return async (success = true) => {
            if (success) {
                el.innerHTML = '<i class="fas fa-check-circle led-check"></i>';
                await new Promise(r => setTimeout(r, 1200));
            }
            el.classList.add('hidden');
            el.style.display = 'none';
        };
    };

    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8 animate-fade-in pb-32 w-full overflow-x-hidden px-4">
                <!--Header Section-->
                <div class="flex items-center gap-6 mb-10">
                    <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-slate-900 rounded-2xl flex items-center justify-center text-2xl text-white shadow-xl shadow-indigo-500/20 transform -rotate-3">
                        <i class="fas fa-cog"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Ajustes del Sistema</h3>
                        <p class="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-[0.3em] mt-1">Configuración Maestra de la Congregación</p>
                    </div>
                </div>

                <div class="space-y-8" data-adaptive-container="true">
                    
                    <!-- 1. COMUNICACIÓN Y DIFUSIÓN DINÁMICA -->
                    <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden">
                        <div class="absolute -left-16 -bottom-16 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-broadcast-tower text-primary text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">1. Comunicación y Difusión Dinámica</h4>
                        </header>

                        <div class="space-y-6">
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    TEMA DE LA SEMANA (Enfoque Semanal)
                                    <span class="text-[8px] px-1.5 py-0.5 bg-primary/10 text-primary rounded uppercase tracking-tighter">Banner Principal</span>
                                </label>
                                <div class="relative">
                                    <textarea id="conf-tema-mes" rows="2" 
                                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 pr-12 text-xs font-bold shadow-inner outline-none focus:border-primary transition-all text-slate-800 dark:text-white"
                                        placeholder="Escribe el tema de conversación sugerido o enfoque semanal...">${config.tema_mes || ''}</textarea>
                                    <div class="led-status-container hidden" style="bottom: 2.5rem;"></div>
                                </div>
                            </div>

                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    Panel de Difusión (Anuncios Rotativos)
                                    <div class="flex items-center gap-2">
                                        <div id="led-diffusion" class="led-status-container !static hidden"></div>
                                        <button id="add-diffusion-msg" class="text-[9px] text-primary hover:underline">+ Añadir Mensaje</button>
                                    </div>
                                </label>
                                <div id="list-diffusion" class="space-y-2.5 p-4 bg-slate-100/50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[100px]">
                                    ${(config.diffusion_messages || []).map((msg, i) => `
                                        <div class="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-[11px] font-black flex items-start gap-4 animate-scale-in group/msg cursor-move">
                                            <div class="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0 mt-0.5 transition-transform group-hover/msg:rotate-12">
                                                <i class="fas fa-grip-vertical text-[10px]"></i>
                                            </div>
                                            <div class="flex-1 text-slate-600 dark:text-slate-300 leading-relaxed pt-1">${msg}</div>
                                            <button onclick="window.removeDiffusionMessage(${i})" class="text-slate-300 hover:text-red-500 transition-colors shrink-0 pt-1">
                                                <i class="fas fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    `).join('') || '<p class="text-[10px] text-slate-400 text-center py-6 italic">No hay anuncios de difusión activos. El banner solo mostrará el TEMA DE LA SEMANA.</p>'}
                                </div>
                                <p class="text-[9px] text-slate-400 mt-3 ml-1 italic leading-relaxed">Todo será visible en el banner dinámico del Modo Conductor cada 3 segundos.</p>
                            </div>
                        </div>
                    </section>

                    <!-- 2. IDENTIDAD LOCAL -->
                    <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden">
                        <div class="absolute -right-16 -top-16 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl"></div>
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-id-card text-teal-500 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">2. Identidad Local</h4>
                        </header>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="relative group/input">
                                <label class="label-premium">Nombre de la Congregación</label>
                                <div class="relative">
                                    <input type="text" id="conf-nombre" value="${config.congregacion?.nombre || ''}" 
                                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 pr-12 text-sm font-bold shadow-inner outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 dark:text-white"
                                        placeholder="Ej. Nueve de Octubre">
                                    <div class="led-status-container hidden"></div>
                                </div>
                            </div>

                            <div class="relative group/input">
                                <label class="label-premium">Número de Congregación</label>
                                <div class="relative">
                                    <input type="text" id="conf-numero" value="${config.congregacion?.numero || ''}" 
                                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 pr-12 text-sm font-bold shadow-inner outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 dark:text-white"
                                        placeholder="Ej. 14282">
                                    <div class="led-status-container hidden"></div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- 3. PLANIFICACIÓN DE SERVICIOS -->
                    <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden">
                        <div class="absolute -right-16 -bottom-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-calendar-check text-emerald-500 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">3. Planificación de Servicios</h4>
                        </header>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <!-- Horarios -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    Horarios de Salida
                                    <div class="flex items-center gap-2">
                                        <div id="led-horarios" class="led-status-container !static hidden"></div>
                                        <button id="add-horario" class="text-[9px] text-emerald-500 hover:underline">+ Añadir</button>
                                    </div>
                                </label>
                                <div id="list-horarios" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${(config.horarios_programa || []).map((h, i) => `
                                            <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move">
                                                <i class="fas fa-grip-vertical text-slate-300 text-[8px]"></i>
                                                ${h}
                                                <button onclick="window.removeConfigItem('horarios', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                            </div>
                                        `).join('')}
                                </div>
                            </div>

                            <!-- Lugares -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    Lugares de Reunión
                                    <div class="flex items-center gap-2">
                                        <div id="led-lugares" class="led-status-container !static hidden"></div>
                                        <button id="add-lugar" class="text-[9px] text-emerald-500 hover:underline">+ Añadir</button>
                                    </div>
                                </label>
                                 <div id="list-lugares" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${(config.lugares || []).map((l, i) => `
                                            <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move">
                                                <i class="fas fa-grip-vertical text-slate-300 text-[8px]"></i>
                                                ${l}
                                                <button onclick="window.removeConfigItem('lugares', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                            </div>
                                        `).join('')}
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- 4. GESTIÓN DE CATEGORÍAS (Unified Section with Zonas) -->
                    <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden">
                        <div class="absolute -right-16 -top-16 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-tags text-amber-500 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">4. Gestión de Categorías y Zonas</h4>
                        </header>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                            <!-- Facetas -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    OPCIONES DE SALIDA (Facetas)
                                    <div class="flex items-center gap-2">
                                        <div id="led-facetas" class="led-status-container !static hidden"></div>
                                        <button id="add-faceta" class="text-[9px] text-amber-500 hover:underline">+ Añadir</button>
                                    </div>
                                </label>
                                <div id="list-facetas" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${(config.facetas || []).map((f, i) => `
                                        <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move">
                                            <i class="fas fa-grip-vertical text-slate-300 text-[8px]"></i>
                                            ${f}
                                            <button onclick="window.removeConfigItem('facetas', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Tipos de Territorio -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    TIIPOS DE TERRITORIO (Mapa)
                                    <div class="flex items-center gap-2">
                                        <div id="led-tipos_t" class="led-status-container !static hidden"></div>
                                        <button id="add-tipo-t" class="text-[9px] text-blue-500 hover:underline">+ Añadir</button>
                                    </div>
                                </label>
                                <div id="list-tipos-t" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${(config.tipos_territorio || ['Casa en Casa', 'Negocios', 'Pública']).map((t, i) => `
                                        <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move">
                                            <i class="fas fa-grip-vertical text-slate-300 text-[8px]"></i>
                                            ${t}
                                            <button onclick="window.removeConfigItem('tipos_t', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- ZONAS ESPECIALES INTEGRATED -->
                        <div class="pt-8 border-t border-slate-100 dark:border-white/5">
                            <header class="flex justify-between items-center mb-6">
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-map-marker-alt text-amber-600 text-[10px]"></i>
                                    <h5 class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Zonas de Predicación Especial</h5>
                                    <div class="flex items-center gap-2">
                                        <div id="led-zonas" class="led-status-container !static hidden"></div>
                                        <button id="add-poi-btn" class="text-[9px] text-amber-500 hover:underline">+ Añadir</button>
                                    </div>
                                </div>
                            </header>

                            <div id="list-zonas" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                ${puntosInteres.length === 0 ? `
                                    <p class="text-[10px] text-slate-400 text-center py-4 italic w-full">Sin zonas registradas</p>
                                ` : puntosInteres.map((p) => `
                                    <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move group/tag" data-id="${p.id}">
                                        <i class="fas fa-grip-vertical text-slate-300 text-[8px]"></i>
                                        <div class="flex flex-col cursor-pointer" onclick="window.editPOI_Rules('${p.id}')">
                                            <span class="leading-none text-[11px]">${p.nombre}</span>
                                            <span class="text-[7px] text-slate-400 uppercase tracking-tighter">T-${p.territorio_numero || '??'}</span>
                                        </div>
                                        <button onclick="window.deletePOI_Rules('${p.id}')" class="text-slate-300 hover:text-red-500 transition-colors ml-1"><i class="fas fa-times"></i></button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </section>

                    <!-- 5. INTELIGENCIA ARTIFICIAL -->
                    <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden">
                        <div class="absolute -left-16 -bottom-16 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl"></div>
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-brain text-indigo-500 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">5. Inteligencia Artificial</h4>
                        </header>

                        <div class="relative group/input">
                            <label class="label-premium flex items-center justify-between">
                                Google Gemini API Key
                                <span class="text-[8px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded uppercase tracking-tighter">AI Assistant</span>
                            </label>
                            <div class="relative">
                                <input type="password" id="gemini-key" value="${config.gemini_key || ''}" 
                                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 pr-20 text-xs font-mono shadow-inner outline-none focus:border-indigo-500 transition-all text-slate-800 dark:text-white"
                                    placeholder="AIzaSy...">
                                <div class="led-status-container hidden" style="right: 3.5rem;"></div>
                                <button class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors" onclick="const p=this.parentElement.querySelector('input'); p.type=p.type==='password'?'text':'password'">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            <p class="text-[9px] text-slate-400 mt-3 ml-1 leading-relaxed italic">Habilita el asistente virtual para análisis predictivo y sugerencias inteligentes.</p>
                        </div>
                    </section>
                </div>
            </div>
        `;

    // --- DRAGGABLE LISTS INITIALIZATION ---
    setTimeout(() => {
        const listIds = {
            'list-horarios': 'horarios_programa',
            'list-lugares': 'lugares',
            'list-facetas': 'facetas',
            'list-tipos-t': 'tipos_territorio',
            'list-diffusion': 'diffusion_messages',
            'list-zonas': 'zonas'
        };

        Object.keys(listIds).forEach((id) => {
            const el = container.querySelector(`#${id}`);
            if (el && window.Sortable) {
                new Sortable(el, {
                    animation: 150,
                    ghostClass: 'opacity-50',
                    onEnd: async (evt) => {
                        if (evt.oldIndex === evt.newIndex) return;

                        const type = listIds[id];
                        const ledId = type === 'horarios_programa' ? 'horarios' :
                            type === 'diffusion_messages' ? 'diffusion' :
                                type === 'tipos_territorio' ? 'tipos_t' : type;
                        const finishLED = await triggerManualLED(ledId);

                        if (type === 'zonas') {
                            const tagEls = Array.from(el.querySelectorAll('[data-id]'));
                            const idChain = tagEls.map(tel => tel.dataset.id);

                            try {
                                const { updatePuntoInteres } = await import('../../data/firestore-services.js');
                                for (let i = 0; i < idChain.length; i++) {
                                    await updatePuntoInteres(idChain[i], { order: i });
                                }
                                await finishLED();
                                reloadTabFn('config');
                            } catch (e) {
                                console.error("POI Reorder error:", e);
                                await finishLED(false);
                            }
                            return;
                        }

                        const items = [...(config[type] || [])];
                        if (items.length > 0) {
                            const [moved] = items.splice(evt.oldIndex, 1);
                            items.splice(evt.newIndex, 0, moved);
                            config[type] = items;
                        }

                        await saveConfiguracion(config);
                        await finishLED();
                        reloadTabFn('config');
                    }
                });
            }
        });
    }, 100);

    // --- AUTO-SAVE LOGIC ---
    let saveTimeout;
    const triggerAutoSave = (id) => {
        const inputEl = container.querySelector(`#${id}`);
        const statusEl = inputEl?.parentElement?.querySelector('.led-status-container');

        if (statusEl) {
            statusEl.innerHTML = '<div class="led-spinner"></div>';
            statusEl.classList.remove('hidden', 'opacity-0');
        }

        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            try {
                config.congregacion = {
                    nombre: container.querySelector('#conf-nombre')?.value.trim() || config.congregacion?.nombre,
                    numero: container.querySelector('#conf-numero')?.value.trim() || config.congregacion?.numero
                };
                config.gemini_key = container.querySelector('#gemini-key')?.value.trim() || config.gemini_key;
                config.tema_mes = container.querySelector('#conf-tema-mes')?.value.trim() || config.tema_mes;

                await saveConfiguracion(config);

                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-check-circle led-check"></i>';
                    setTimeout(() => {
                        statusEl.classList.add('opacity-0');
                        setTimeout(() => {
                            statusEl.classList.add('hidden');
                            statusEl.innerHTML = '';
                        }, 500);
                    }, 2000);
                }
            } catch (e) {
                console.error("Auto-save error:", e);
                if (statusEl) statusEl.innerHTML = '<i class="fas fa-exclamation-circle text-red-500 text-[10px]"></i>';
            }
        }, 1500); // Trigger saving 1.5s after stop typing
    };

    // Attach to text inputs
    ['conf-nombre', 'conf-numero', 'gemini-key', 'conf-tema-mes'].forEach(id => {
        const el = container.querySelector(`#${id}`);
        if (el) {
            el.addEventListener('input', () => triggerAutoSave(id));
        }
    });

    // Helper functions for dynamic lists (modified to save immediately)
    const addConfigItem = (type) => {
        const labels = { horarios: 'Horario (ej. 09:00AM)', lugares: 'Lugar', facetas: 'Faceta', tipos_t: 'Tipo de Territorio' };
        showCustomPrompt(`Añadir ${labels[type]}:`, "", async (val) => {
            if (!val) return;
            const finishLED = await triggerManualLED(type);

            if (type === 'horarios') {
                config.horarios_programa = [...(config.horarios_programa || []), val];
            }
            if (type === 'lugares') config.lugares = [...(config.lugares || []), val];
            if (type === 'facetas') config.facetas = [...(config.facetas || []), val];
            if (type === 'tipos_t') config.tipos_territorio = [...(config.tipos_territorio || ['Casa en Casa', 'Negocios', 'Pública']), val];

            await saveConfiguracion(config);
            await finishLED();
            reloadTabFn('config');
        });
    };

    window.removeConfigItem = async (type, index) => {
        const finishLED = await triggerManualLED(type);
        if (type === 'horarios') config.horarios_programa.splice(index, 1);
        if (type === 'lugares') config.lugares.splice(index, 1);
        if (type === 'facetas') config.facetas.splice(index, 1);
        if (type === 'tipos_t') {
            if (!config.tipos_territorio) config.tipos_territorio = ['Casa en Casa', 'Negocios', 'Pública'];
            config.tipos_territorio.splice(index, 1);
        }
        await saveConfiguracion(config);
        await finishLED();
        reloadTabFn('config');
    };

    // --- POI (ZONAS) HANDLERS ---
    const openPOIModal = (poi = null) => {
        const isEdit = !!poi;
        showModal(`
            <div class="flex flex-col bg-white dark:bg-[#0a0f18] rounded-[2rem] overflow-hidden max-w-sm w-full mx-auto shadow-2xl">
                <header class="p-6 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-4">
                    <div class="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center text-lg">
                        <i class="fas ${isEdit ? 'fa-edit' : 'fa-plus'}"></i>
                    </div>
                    <div>
                        <h3 class="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">${isEdit ? 'Editar Zona' : 'Añadir Zona'}</h3>
                        <p class="text-[8px] text-amber-600 font-bold uppercase tracking-tighter">Predicación Especial</p>
                    </div>
                </header>

                <div class="p-6 space-y-6">
                    <div class="space-y-4">
                        <div class="space-y-1.5">
                            <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
                            <input type="text" id="poi-name" value="${poi?.nombre || ''}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white outline-none focus:border-amber-500 transition-all" placeholder="P. ej: Parada de Taxis Central">
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                                <select id="poi-type" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white outline-none focus:border-amber-500 transition-all uppercase">
                                    <option value="Taxi" ${poi?.tipo === 'Taxi' ? 'selected' : ''}>🚕 Taxis</option>
                                    <option value="Bus" ${poi?.tipo === 'Bus' ? 'selected' : ''}>🚌 Bus</option>
                                    <option value="Parque" ${poi?.tipo === 'Parque' ? 'selected' : ''}>🌳 Parque</option>
                                    <option value="Comercial" ${poi?.tipo === 'Comercial' ? 'selected' : ''}>🏪 Tiendas</option>
                                </select>
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Territorio</label>
                                <select id="poi-terr" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white outline-none focus:border-amber-500 transition-all uppercase">
                                    <option value="">Buscar T...</option>
                                    ${territorios.sort((a, b) => String(a.numero || '').localeCompare(String(b.numero || ''), undefined, { numeric: true })).map(t => `
                                        <option value="${t.id}" data-num="${t.numero}" ${poi?.territorio_id === t.id ? 'selected' : ''}>T-${t.numero}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Instrucciones</label>
                            <textarea id="poi-desc" rows="2" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-[11px] font-medium text-slate-700 dark:text-white outline-none focus:border-amber-500 transition-all resize-none" placeholder="Ubicación exacta...">${poi?.descripcion || ''}</textarea>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-poi" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10 transition-all active:scale-95">
                        Cancelar
                    </button>
                    <button id="save-poi-btn" class="flex-[1.5] py-5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-amber-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> ${isEdit ? 'Actualizar' : 'Guardar Zona'}
                    </button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-cancel-poi').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#save-poi-btn').onclick = async () => {
                const btn = modal.querySelector('#save-poi-btn');
                const name = modal.querySelector('#poi-name').value.trim();
                const type = modal.querySelector('#poi-type').value;
                const terrId = modal.querySelector('#poi-terr').value;
                const terrNum = modal.querySelector('#poi-terr').options[modal.querySelector('#poi-terr').selectedIndex].dataset.num;
                const desc = modal.querySelector('#poi-desc').value.trim();

                if (!name || !terrId) return showNotification("Nombre y Territorio obligatorios", "warning");

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Procesando...';

                try {
                    const finishLED = await triggerManualLED('zonas');
                    const data = { nombre: name, tipo: type, territorio_id: terrId, territorio_numero: terrNum, descripcion: desc };
                    if (isEdit) await updatePuntoInteres(poi.id, data);
                    else await addPuntoInteres(data);

                    modal.classList.add('hidden');
                    await finishLED();
                    showNotification(isEdit ? "Zona actualizada" : "Zona añadida");
                    reloadTabFn('config');
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Reintentar';
                }
            };
        });
    };

    const addHorBtn = container.querySelector('#add-horario');
    if (addHorBtn) addHorBtn.onclick = () => addConfigItem('horarios');

    const addLugBtn = container.querySelector('#add-lugar');
    if (addLugBtn) addLugBtn.onclick = () => addConfigItem('lugares');

    const addFacBtn = container.querySelector('#add-faceta');
    if (addFacBtn) addFacBtn.onclick = () => addConfigItem('facetas');

    const addTipBtn = container.querySelector('#add-tipo-t');
    if (addTipBtn) addTipBtn.onclick = () => addConfigItem('tipos_t');

    const addDiffBtn = container.querySelector('#add-diffusion-msg');
    if (addDiffBtn) {
        addDiffBtn.onclick = () => {
            showCustomPrompt("Contenido del Anuncio:", "", async (val) => {
                if (!val) return;
                const finishLED = await triggerManualLED('diffusion');
                config.diffusion_messages = [...(config.diffusion_messages || []), val];
                await saveConfiguracion(config);
                await finishLED();
                reloadTabFn('config');
            });
        };
    }

    const addPoiBtn = container.querySelector('#add-poi-btn');
    if (addPoiBtn) addPoiBtn.onclick = () => openPOIModal();

    window.editPOI_Rules = (id) => openPOIModal(puntosInteres.find(p => p.id === id));
    window.deletePOI_Rules = (id) => showCustomConfirm("¿Eliminar esta zona de predicación?", async () => {
        const finishLED = await triggerManualLED('zonas');
        await deletePuntoInteres(id);
        await finishLED();
        showNotification("Zona eliminada");
        reloadTabFn('config');
    });

    window.removeDiffusionMessage = async (index) => {
        if (!config.diffusion_messages) return;
        const finishLED = await triggerManualLED('diffusion');
        config.diffusion_messages.splice(index, 1);
        await saveConfiguracion(config);
        await finishLED();
        reloadTabFn('config');
    };
};

