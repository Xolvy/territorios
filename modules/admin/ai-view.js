import { TerritoryIntelligence } from '../utils/intelligence.js?v=2.3.9.4';
import { getTelefonos, getTerritorios, getProgramaSemanal, getConductores } from '../../data/firestore-services.js?v=2.3.9.4';
import { formatDateId } from '../utils/helpers.js?v=2.3.9.4';

export const renderAdminAI = async (container, appVersion) => {
    container.innerHTML = `
        <div class="space-y-10 animate-fade-in p-2 md:p-6 max-w-5xl mx-auto w-full overflow-x-hidden">
            <header class="flex items-center gap-6 mb-2">
                <div class="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-3xl text-emerald-400 shadow-2xl admin-ai-glow">
                    <i class="fas fa-brain"></i>
                </div>
                <div>
                    <h3 class="text-3xl font-black tracking-tighter text-slate-800 dark:text-white uppercase leading-none mb-2">Asistente Estratégico</h3>
                    <p class="text-[10px] text-slate-500 uppercase tracking-[0.4em] font-black">Inteligencia Artificial Gemini Pro</p>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="modern-card p-10 space-y-8 bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl border-slate-200 dark:border-white/5 shadow-2xl relative overflow-hidden group">
                     <div class="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>
                    
                    <div class="relative z-10 space-y-6">
                        <div class="space-y-4">
                            <h4 class="text-xs font-black uppercase text-emerald-500 tracking-[0.2em]">Consultas Activas</h4>
                            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-bold">Obtén análisis profundos sobre la rotación de territorios, predicciones de asignación y detección de anomalías.</p>
                        </div>

                        <div class="space-y-4 pt-4">
                            <button id="ai-btn-audit" class="w-full flex items-center justify-between p-5 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 hover:border-emerald-500/50 transition-all text-left shadow-sm group/btn">
                                <div>
                                    <p class="text-[11px] font-black text-slate-700 dark:text-white uppercase tracking-widest">Auditoría Global</p>
                                    <p class="text-[9px] text-slate-400 font-bold mt-1">Detección de discrepancias en S-13</p>
                                </div>
                                <i class="fas fa-microchip text-emerald-500 opacity-30 group-hover/btn:opacity-100 transition-opacity"></i>
                            </button>

                            <button id="ai-btn-predict" class="w-full flex items-center justify-between p-5 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 hover:border-emerald-500/50 transition-all text-left shadow-sm group/btn">
                                <div>
                                    <p class="text-[11px] font-black text-slate-700 dark:text-white uppercase tracking-widest">Predicción de Flujo</p>
                                    <p class="text-[9px] text-slate-400 font-bold mt-1">Sugerencias inteligentes de asignación</p>
                                </div>
                                <i class="fas fa-wand-magic-sparkles text-emerald-500 opacity-30 group-hover/btn:opacity-100 transition-opacity"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col gap-6">
                    <div class="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden flex-1 shadow-2xl min-h-[300px] flex flex-col">
                        <div class="absolute inset-0 opacity-10 pointer-events-none">
                            <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.2),transparent_70%)]"></div>
                        </div>
                        
                        <div class="relative z-10 flex flex-col h-full">
                            <div class="flex items-center gap-3 mb-6">
                                <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span class="text-[9px] font-black uppercase tracking-[0.4em] text-emerald-500/80">Terminal de Inteligencia</span>
                            </div>
                            
                            <div id="ai-response-stream" class="flex-1 font-mono text-xs leading-relaxed text-emerald-400/90 overflow-y-auto custom-scrollbar-dark pr-4 space-y-4">
                                <p class="animate-pulse">_ Esperando instrucción estratégica...</p>
                            </div>
                            
                            <div class="mt-6 pt-6 border-t border-white/5 text-[9px] font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center">
                                <span>Core v${appVersion}</span>
                                <span id="ai-status-indicator">Ready</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const stream = container.querySelector('#ai-response-stream');
    const status = container.querySelector('#ai-status-indicator');

    const logAI = (msg, type = 'info') => {
        const div = document.createElement('div');
        div.className = `p-4 rounded-2xl ${type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-emerald-400'} border border-white/5 animate-fade-in`;
        div.innerHTML = `<span class="opacity-40 mr-2">></span> ${msg}`;
        stream.innerHTML = '';
        stream.appendChild(div);
        stream.scrollTop = stream.scrollHeight;
    };

    const runAction = async (action) => {
        const { getConfiguracion } = await import('../../data/firestore-services.js');
        const config = await getConfiguracion();
        if (!config.gemini_key) {
            logAI("ERROR: API Key de Gemini no configurada. Ve a Ajustes > Reglas.", 'error');
            return;
        }

        status.innerText = 'Analyzing...';
        status.className = 'text-emerald-500 animate-pulse';
        logAI("Iniciando motor de inteligencia... Escaneando base de datos global.");

        try {
            const [phones, terrs, conds] = await Promise.all([
                getTelefonos(), getTerritorios(), getConductores()
            ]);
            const prog = await getProgramaSemanal(formatDateId(new Date()));
            const intellect = new TerritoryIntelligence(phones, [], terrs, prog, conds);

            let result = '';
            if (action === 'audit') {
                logAI("Ejecutando auditoría heurística de integridad de datos (S-13)...");
                result = await intellect.performFullAudit(config.gemini_key);
            } else {
                logAI("Calculando proyecciones de asignación basadas en historial de rotación...");
                result = await intellect.predictAssignments(config.gemini_key);
            }

            stream.innerHTML = `<div class="p-6 bg-white/5 rounded-2xl border border-white/5 leading-relaxed whitespace-pre-wrap">${result}</div>`;
        } catch (e) {
            logAI(`ERROR CRÍTICO: ${e.message}`, 'error');
        } finally {
            status.innerText = 'Ready';
            status.className = '';
        }
    };

    container.querySelector('#ai-btn-audit').onclick = () => runAction('audit');
    container.querySelector('#ai-btn-predict').onclick = () => runAction('predict');
};
