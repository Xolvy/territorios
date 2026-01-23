import { saveConfiguracion } from '../../data/firestore-services.js?v=2.2.5';
import { showNotification, showCustomPrompt, showCustomConfirm } from '../services/ui-helpers.js?v=2.2.5';
import { ensureOnline } from '../utils/helpers.js?v=2.2.5';

export const renderRulesTab = async (container, config, appVersion, reloadTabFn) => {
    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12 w-full overflow-x-hidden px-4">
            <!-- Header Section -->
            <div class="flex items-center gap-6 mb-10">
                <div class="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center text-2xl text-white shadow-xl shadow-teal-500/20 transform -rotate-3">
                    <i class="fas fa-sliders-h"></i>
                </div>
                <div>
                    <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Parámetros del Sistema</h3>
                    <p class="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-[0.3em] mt-1">Configuración Maestra de la Congregación</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- Left Column: Identity -->
                <div class="space-y-8">
                    <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden">
                        <div class="absolute -right-16 -top-16 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl"></div>
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-id-card text-teal-500 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Identidad Local</h4>
                        </header>

                        <div class="space-y-5">
                            <div class="relative group/input">
                                <label class="label-premium">Nombre de la Congregación</label>
                                <div class="relative">
                                    <input type="text" id="conf-nombre" value="${config.congregacion?.nombre || ''}" 
                                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 dark:text-white"
                                        placeholder="Ej. Nueve de Octubre">
                                    <i class="fas fa-briefcase absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-white/10 opacity-0 group-focus-within/input:opacity-100 transition-opacity"></i>
                                </div>
                            </div>

                            <div class="relative group/input">
                                <label class="label-premium">Número de Congregación</label>
                                <div class="relative">
                                    <input type="text" id="conf-numero" value="${config.congregacion?.numero || ''}" 
                                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 dark:text-white"
                                        placeholder="Ej. 14282">
                                    <i class="fas fa-hashtag absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-white/10 opacity-0 group-focus-within/input:opacity-100 transition-opacity"></i>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden">
                        <div class="absolute -left-16 -bottom-16 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl"></div>
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-brain text-indigo-500 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Inteligencia Artificial</h4>
                        </header>

                        <div class="relative group/input">
                            <label class="label-premium flex items-center justify-between">
                                Google Gemini API Key
                                <span class="text-[8px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded uppercase tracking-tighter">Recomendado</span>
                            </label>
                            <div class="relative">
                                <input type="password" id="gemini-key" value="${config.gemini_key || ''}" 
                                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-xs font-mono shadow-inner outline-none focus:border-indigo-500 transition-all text-slate-800 dark:text-white"
                                    placeholder="AIzaSy...">
                                <button class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors" onclick="const p=this.previousElementSibling; p.type=p.type==='password'?'text':'password'">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            <p class="text-[9px] text-slate-400 mt-3 ml-1 leading-relaxed italic">Habilita el asistente virtual en los paneles de control para análisis predictivo y sugerencias inteligentes.</p>
                        </div>
                    </section>
                </div>

                <!-- Right Column: Ministry Config -->
                <div class="space-y-8">
                    <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl">
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-calendar-check text-emerald-500 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Planificación de Ministerio</h4>
                        </header>

                        <div class="space-y-6">
                            <!-- Dynamic List for Schedules -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    Horarios de Salida
                                    <button id="add-horario" class="text-[9px] text-emerald-500 hover:underline">+ Añadir</button>
                                </label>
                                <div id="list-horarios" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${(config.horarios_programa || []).map((h, i) => `
                                        <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in">
                                            ${h}
                                            <button onclick="window.removeConfigItem('horarios', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Dynamic List for Places -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    Lugares de Reunión
                                    <button id="add-lugar" class="text-[9px] text-emerald-500 hover:underline">+ Añadir</button>
                                </label>
                                <div id="list-lugares" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${(config.lugares || []).map((l, i) => `
                                        <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in">
                                            ${l}
                                            <button onclick="window.removeConfigItem('lugares', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Dynamic List for Facets -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    Facetas de Predicación
                                    <button id="add-faceta" class="text-[9px] text-emerald-500 hover:underline">+ Añadir</button>
                                </label>
                                <div id="list-facetas" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${(config.facetas || []).map((f, i) => `
                                        <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in">
                                            ${f}
                                            <button onclick="window.removeConfigItem('facetas', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <!-- Action Bar -->
            <div class="sticky bottom-8 left-0 right-0 z-50 flex justify-center px-4">
                <div class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl px-6 py-4 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl flex items-center gap-10">
                    <div class="hidden sm:flex flex-col">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado de Sincronización</span>
                        <span class="text-[10px] font-bold text-emerald-500 flex items-center gap-1.5 uppercase">
                            <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Servidor en línea
                        </span>
                    </div>
                    <div class="h-8 w-px bg-slate-200 dark:bg-white/10 hidden sm:block"></div>
                    <button id="save-reglas" class="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl transition-all flex items-center gap-3">
                        <i class="fas fa-save"></i> Aplicar Cambios
                    </button>
                    <button id="btn-sync-master-reglas" class="bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20 transition-all flex items-center gap-3">
                        <i class="fas fa-sync-alt"></i> Sincronizar Maestro
                    </button>
                </div>
            </div>
        </div>
    `;

    // Helper functions for dynamic lists
    const addConfigItem = (type) => {
        const labels = { horarios: 'Horario (ej. 09:00AM)', lugares: 'Lugar', facetas: 'Faceta' };
        showCustomPrompt(`Añadir ${labels[type]}:`, "", (val) => {
            if (!val) return;
            if (type === 'horarios') {
                const newList = [...(config.horarios_programa || []), val];
                // Smart Sort for AM/PM times
                const toMinutes = (s) => {
                    const match = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
                    if (!match) return 0;
                    let h = parseInt(match[1]);
                    const m = parseInt(match[2]);
                    const p = (match[3] || 'AM').toUpperCase();
                    if (p === 'PM' && h < 12) h += 12;
                    if (p === 'AM' && h === 12) h = 0;
                    return h * 60 + m;
                };
                config.horarios_programa = newList.sort((a, b) => toMinutes(a) - toMinutes(b));
            }
            if (type === 'lugares') config.lugares = [...(config.lugares || []), val];
            if (type === 'facetas') config.facetas = [...(config.facetas || []), val];
            reloadTabFn('reglas');
        });
    };

    window.removeConfigItem = (type, index) => {
        if (type === 'horarios') config.horarios_programa.splice(index, 1);
        if (type === 'lugares') config.lugares.splice(index, 1);
        if (type === 'facetas') config.facetas.splice(index, 1);
        reloadTabFn('reglas');
    };

    container.querySelector('#add-horario').onclick = () => addConfigItem('horarios');
    container.querySelector('#add-lugar').onclick = () => addConfigItem('lugares');
    container.querySelector('#add-faceta').onclick = () => addConfigItem('facetas');

    container.querySelector('#save-reglas').onclick = async () => {
        const btn = container.querySelector('#save-reglas');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        btn.disabled = true;

        try {
            config.congregacion = {
                nombre: document.getElementById('conf-nombre').value.trim(),
                numero: document.getElementById('conf-numero').value.trim()
            };
            config.gemini_key = document.getElementById('gemini-key').value.trim();

            await saveConfiguracion(config);

            showNotification("Configuración de la congregación guardada con éxito", "success");
            reloadTabFn('reglas');
        } catch (e) {
            console.error(e);
            showNotification("Error al guardar: " + e.message, "error");
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    };

    const syncMasterBtn = container.querySelector('#btn-sync-master-reglas');
    if (syncMasterBtn) {
        syncMasterBtn.onclick = async () => {
            const btn = syncMasterBtn;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
            btn.disabled = true;
            try {
                const { runSystemDiagnosticsAndRepair } = await import('../../data/firestore-services.js?v=2.2.5');
                await runSystemDiagnosticsAndRepair((msg, pc) => {
                    console.log(`[SyncMaster] ${msg} (${pc}%)`);
                });
                showNotification("Sincronización maestra completada", "success");
                reloadTabFn('reglas');
            } catch (e) {
                console.error(e);
                showNotification("Error: " + e.message, "error");
            } finally {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        };
    }
};
