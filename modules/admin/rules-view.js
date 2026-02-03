import { saveConfiguracion } from '../../data/firestore-services.js';
import { showCustomPrompt, showCustomConfirm } from '../services/ui-helpers.js';
import { showNotification } from '../utils/helpers.js';
import { broadcastCurrentVersion } from '../utils/update-manager.js';

export const renderConfigTab = async (container, config, appVersion, reloadTabFn) => {
    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8 animate-fade-in pb-32 w-full overflow-x-hidden px-4">
            <!-- Header Section -->
            <div class="flex items-center gap-6 mb-10">
                <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-slate-900 rounded-2xl flex items-center justify-center text-2xl text-white shadow-xl shadow-indigo-500/20 transform -rotate-3">
                    <i class="fas fa-cog"></i>
                </div>
                <div>
                    <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Ajustes del Sistema</h3>
                    <p class="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-[0.3em] mt-1">Configuración Maestra de la Congregación</p>
                </div>
            </div>

            <div class="space-y-8">
                <!-- 1. IDENTIDAD LOCAL -->
                <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden">
                    <div class="absolute -right-16 -top-16 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl"></div>
                    <header class="flex items-center gap-3 mb-6">
                        <i class="fas fa-id-card text-teal-500 text-sm"></i>
                        <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Identidad Local</h4>
                    </header>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="relative group/input">
                            <label class="label-premium">Nombre de la Congregación</label>
                            <input type="text" id="conf-nombre" value="${config.congregacion?.nombre || ''}" 
                                class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 dark:text-white"
                                placeholder="Ej. Nueve de Octubre">
                        </div>

                        <div class="relative group/input">
                            <label class="label-premium">Número de Congregación</label>
                            <input type="text" id="conf-numero" value="${config.congregacion?.numero || ''}" 
                                class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 dark:text-white"
                                placeholder="Ej. 14282">
                        </div>
                    </div>
                </section>

                <!-- 2. INTELIGENCIA ARTIFICIAL -->
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

                <!-- 3. PLANIFICACIÓN DE SERVICIOS -->
                <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl">
                    <header class="flex items-center gap-3 mb-6">
                        <i class="fas fa-calendar-check text-emerald-500 text-sm"></i>
                        <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Planificación de Servicios</h4>
                    </header>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <!-- Horarios -->
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

                        <!-- Lugares -->
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
                    </div>
                </section>

                <!-- 4. FACETAS DE PREDICACIÓN -->
                <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl">
                    <header class="flex items-center gap-3 mb-6">
                        <i class="fas fa-bullhorn text-amber-500 text-sm"></i>
                        <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Facetas de Predicación</h4>
                    </header>

                    <div class="relative group/input">
                        <label class="label-premium flex items-center justify-between">
                            Opciones de Salida
                            <button id="add-faceta" class="text-[9px] text-amber-500 hover:underline">+ Añadir</button>
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
                </section>

                <!-- 5. TIPOS DE TERRITORIO -->
                <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl">
                    <header class="flex items-center gap-3 mb-6">
                        <i class="fas fa-map text-blue-500 text-sm"></i>
                        <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Tipos de Territorio</h4>
                    </header>

                    <div class="relative group/input">
                        <label class="label-premium flex items-center justify-between">
                            Categorías de Mapa
                            <button id="add-tipo-t" class="text-[9px] text-blue-500 hover:underline">+ Añadir</button>
                        </label>
                        <div id="list-tipos-t" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                            ${(config.tipos_territorio || ['Casa en Casa', 'Negocios', 'Pública']).map((t, i) => `
                                <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in">
                                    ${t}
                                    <button onclick="window.removeConfigItem('tipos_t', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <!-- 6. MANTENIMIENTO DE APP -->
                <section class="modern-card group border-rose-500/20 dark:border-rose-500/10 shadow-xl relative overflow-hidden bg-rose-500/[0.02]">
                    <div class="absolute -right-20 -bottom-20 w-40 h-40 bg-rose-500/5 rounded-full blur-3xl"></div>
                    <header class="flex items-center gap-3 mb-6">
                        <i class="fas fa-tools text-rose-500 text-sm"></i>
                        <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Mantenimiento de App (v${appVersion})</h4>
                    </header>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                        <div class="space-y-4">
                            <h5 class="text-[10px] font-black uppercase text-slate-700 dark:text-gray-300">Difusión de Versión</h5>
                            <button id="btn-broadcast-version" class="w-full bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-rose-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 leading-none">
                                <i class="fas fa-broadcast-tower animate-pulse"></i> Difundir v${appVersion} Globalmente
                            </button>
                        </div>
                        <div class="space-y-4">
                            <h5 class="text-[10px] font-black uppercase text-slate-700 dark:text-gray-300">Diagnóstico de Sistema</h5>
                            <button id="btn-sync-master-reglas" class="w-full bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 leading-none">
                                <i class="fas fa-sync-alt"></i> Reconstruir Base de Datos
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <!-- Action Bar -->
            <div class="fixed bottom-8 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
                <div class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl px-8 py-5 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] flex items-center gap-10 pointer-events-auto">
                    <button id="save-reglas" class="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4.5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-3 active:scale-95">
                        <i class="fas fa-save"></i> Aplicar Ajustes
                    </button>
                </div>
            </div>
        </div>
    `;

    // Helper functions for dynamic lists
    const addConfigItem = (type) => {
        const labels = { horarios: 'Horario (ej. 09:00AM)', lugares: 'Lugar', facetas: 'Faceta', tipos_t: 'Tipo de Territorio' };
        showCustomPrompt(`Añadir ${labels[type]}:`, "", (val) => {
            if (!val) return;
            if (type === 'horarios') {
                const newList = [...(config.horarios_programa || []), val];
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
            if (type === 'tipos_t') config.tipos_territorio = [...(config.tipos_territorio || ['Casa en Casa', 'Negocios', 'Pública']), val];
            reloadTabFn('config');
        });
    };

    window.removeConfigItem = (type, index) => {
        if (type === 'horarios') config.horarios_programa.splice(index, 1);
        if (type === 'lugares') config.lugares.splice(index, 1);
        if (type === 'facetas') config.facetas.splice(index, 1);
        if (type === 'tipos_t') {
            if (!config.tipos_territorio) config.tipos_territorio = ['Casa en Casa', 'Negocios', 'Pública'];
            config.tipos_territorio.splice(index, 1);
        }
        reloadTabFn('config');
    };

    container.querySelector('#add-horario').onclick = () => addConfigItem('horarios');
    container.querySelector('#add-lugar').onclick = () => addConfigItem('lugares');
    container.querySelector('#add-faceta').onclick = () => addConfigItem('facetas');
    container.querySelector('#add-tipo-t').onclick = () => addConfigItem('tipos_t');

    container.querySelector('#save-reglas').onclick = async () => {
        const btn = container.querySelector('#save-reglas');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;

        try {
            config.congregacion = {
                nombre: document.getElementById('conf-nombre').value.trim(),
                numero: document.getElementById('conf-numero').value.trim()
            };
            config.gemini_key = document.getElementById('gemini-key').value.trim();

            await saveConfiguracion(config);

            showNotification("Configuración guardada correctamente", "success");
            reloadTabFn('config');
        } catch (e) {
            console.error(e);
            showNotification("Error: " + e.message, "error");
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    };

    const syncMasterBtn = container.querySelector('#btn-sync-master-reglas');
    if (syncMasterBtn) {
        syncMasterBtn.onclick = async () => {
            const confirmed = await showCustomConfirm(
                "¿Ejecutar Diagnóstico?",
                "Esta acción analizará y reparará la integridad de toda la base de datos. Puede tardar unos segundos.",
                "fas fa-sync-alt",
                "Iniciar Diagnóstico"
            );
            if (!confirmed) return;

            const btn = syncMasterBtn;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Diagnosticando...';
            btn.disabled = true;
            try {
                const { runSystemDiagnosticsAndRepair } = await import('../../data/firestore-services.js');
                await runSystemDiagnosticsAndRepair((msg, pc) => {
                    console.log(`[SyncMaster] ${msg} (${pc}%)`);
                });
                showNotification("Diagnóstico y reparación completados", "success");
                reloadTabFn('config');
            } catch (e) {
                console.error(e);
                showNotification("Error: " + e.message, "error");
            } finally {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        };
    }

    const broadcastBtn = container.querySelector('#btn-broadcast-version');
    if (broadcastBtn) {
        broadcastBtn.onclick = async () => {
            const confirmed = await showCustomConfirm(
                "¿Confirmar Difusión Global?",
                `Esto forzará a TODOS los usuarios a actualizar a la v${appVersion}.`,
                "fas fa-broadcast-tower",
                "Sí, difundir actualización"
            );

            if (confirmed) {
                broadcastBtn.disabled = true;
                const originalHTML = broadcastBtn.innerHTML;
                broadcastBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Difundiendo...';

                await broadcastCurrentVersion();
                showNotification(`Versión ${appVersion} difundida con éxito`, "success");

                broadcastBtn.innerHTML = originalHTML;
                broadcastBtn.disabled = false;
            }
        };
    }
};
