import { getDiffusionMessage, saveDiffusionMessage } from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';

export const renderDiffusionTab = async (container, config, appVersion, reloadTabFn) => {
    const diffusion = await getDiffusionMessage();
    container.innerHTML = `
        <div class="max-w-2xl mx-auto space-y-8 md:space-y-10 animate-fade-in p-6 md:p-10 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-2xl mt-4 md:mt-6 relative overflow-hidden">
            <div class="absolute -left-20 -bottom-20 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none"></div>

            <div class="flex items-center gap-4 md:gap-6 mb-2 relative z-10">
                <div class="w-16 h-16 md:w-20 md:h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-2xl md:text-3xl shadow-inner border border-blue-500/10 text-blue-500 transition-transform hover:rotate-12 duration-500">
                    <i class="fas fa-bullhorn"></i>
                </div>
                <div>
                    <h3 class="text-xl md:text-3xl font-black tracking-tighter text-slate-800 dark:text-white uppercase leading-none mb-2">Sistema de Difusión</h3>
                    <p class="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-[0.4em] font-black">Comunicación Masiva Directa</p>
                </div>
            </div>

            <div class="space-y-8 relative z-10">
                <div class="space-y-3">
                    <label class="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Contenido del Mensaje</label>
                    <textarea id="diff-content" placeholder="Escribe el anuncio para todos los conductores..." class="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 text-sm font-bold min-h-[140px] outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all shadow-inner dark:text-white">${diffusion?.content || ''}</textarea>
                </div>

                <div class="space-y-4">
                    <label class="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Prioridad del Anuncio</label>
                    <div class="grid grid-cols-2 gap-4 md:gap-6">
                        <button class="diff-type-btn p-4 md:p-6 rounded-2xl border-2 transition-all font-black uppercase tracking-widest flex flex-col items-center gap-3 ${diffusion?.type !== 'urgent' ? 'border-primary/50 bg-primary/10 text-primary shadow-lg shadow-primary/10' : 'border-slate-100 dark:border-white/5 opacity-40 hover:opacity-70'}" data-type="info">
                            <i class="fas fa-info-circle text-xl md:text-2xl"></i>
                            <span class="text-[9px] md:text-[10px]">Informativo</span>
                        </button>
                        <button class="diff-type-btn p-4 md:p-6 rounded-2xl border-2 transition-all font-black uppercase tracking-widest flex flex-col items-center gap-3 ${diffusion?.type === 'urgent' ? 'border-rose-500/50 bg-rose-500/10 text-rose-500 shadow-lg shadow-rose-500/10' : 'border-slate-100 dark:border-white/5 opacity-40 hover:opacity-70'}" data-type="urgent">
                            <i class="fas fa-exclamation-triangle text-xl md:text-2xl"></i>
                            <span class="text-[9px] md:text-[10px]">Urgente</span>
                        </button>
                    </div>
                </div>

                <div class="pt-8 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-save-diffusion" class="flex-1 bg-primary hover:bg-primary-light text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.99] transition-all uppercase tracking-[0.25em] text-[11px] flex items-center justify-center gap-3">
                        <i class="fas fa-broadcast-tower"></i> Publicar Anuncio
                    </button>
                    ${diffusion?.active ? `
                        <button id="btn-stop-diffusion" class="px-8 bg-slate-100 dark:bg-white/5 text-rose-500 font-black rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all uppercase tracking-widest text-[10px]">
                            <i class="fas fa-stop-circle mr-2"></i> Detener
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="bg-blue-500/5 rounded-[1.5rem] p-5 border border-blue-500/10 flex items-start gap-4">
                <i class="fas fa-lightbulb text-blue-500 mt-1"></i>
                <p class="text-[10px] text-blue-600/70 dark:text-blue-400 font-black uppercase tracking-wide leading-relaxed">
                    El anuncio aparecerá en la parte superior de la pantalla para todos los usuarios activos hasta que sea desactivado manualmente.
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
            const baseColor = selectedType === 'info' ? 'primary' : 'rose-500';

            b.className = `diff-type-btn p-6 rounded-2xl border-2 transition-all font-black uppercase tracking-widest flex flex-col items-center gap-3 ${isSelected ? `border-${baseColor}/50 bg-${baseColor}/10 text-${baseColor} shadow-lg shadow-${baseColor}/10` : 'border-slate-100 dark:border-white/5 opacity-40 hover:opacity-70'}`;
        });
    });

    container.querySelector('#btn-save-diffusion').onclick = async () => {
        const content = container.querySelector('#diff-content').value;
        if (!content) return showNotification("El mensaje no puede estar vacío", "error");

        try {
            await saveDiffusionMessage(content, selectedType);
            showNotification("Anuncio publicado exitosamente");
            reloadTabFn('difusion');
        } catch (e) {
            showNotification("Error: " + e.message, "error");
        }
    };

    const stopBtn = container.querySelector('#btn-stop-diffusion');
    if (stopBtn) {
        stopBtn.onclick = async () => {
            try {
                await saveDiffusionMessage(null);
                showNotification("Difusión finalizada");
                reloadTabFn('difusion');
            } catch (e) {
                showNotification("Error: " + e.message, "error");
            }
        };
    }
};
