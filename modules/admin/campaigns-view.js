import { getCampanas, saveCampana, deleteCampana } from '../../data/firestore-services.js?v=2.3.8';
import { showCustomConfirm, showCustomPrompt } from '../services/ui-helpers.js?v=2.3.8';

export const renderCampaignsTab = async (container, config, appVersion, reloadTabFn) => {
    const list = await getCampanas();
    container.innerHTML = `
        <div class="p-8 max-w-5xl animate-fade-in bg-white dark:bg-[#0f1115] rounded-[2.5rem] border border-slate-100 dark:border-white/10 shadow-2xl m-4 overflow-hidden relative">
            <div class="absolute -right-20 -top-20 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full pointer-events-none"></div>
            
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6 relative z-10">
                <div>
                    <h3 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-5 uppercase tracking-tighter">
                        <div class="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 shadow-inner">
                            <i class="fas fa-flag-checkered"></i>
                        </div>
                        Gestión de Campañas
                    </h3>
                    <p class="text-[10px] text-slate-400 uppercase tracking-[0.4em] font-black mt-2 ml-1">Eventos especiales y ministerio intensivo</p>
                </div>
                <button id="add-campana" class="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                    <i class="fas fa-plus-circle"></i> Nueva Campaña
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                ${list.length === 0 ? `
                    <div class="col-span-full py-32 text-center space-y-4 opacity-30">
                        <div class="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center text-3xl mx-auto"><i class="fas fa-scroll"></i></div>
                        <p class="font-black text-[10px] uppercase tracking-[0.4em]">Sin campañas activas</p>
                    </div>
                ` : ''}
                ${list.map(c => `
                    <div class="bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5 flex justify-between items-center group hover:border-red-500/30 transition-all shadow-sm">
                        <span class="font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight text-sm">${c}</span>
                        <button onclick="window.actionDeleteCampana('${c}')" class="w-10 h-10 bg-white dark:bg-[#1a1a1a] text-red-500 rounded-xl shadow-md border border-slate-100 dark:border-white/10 hover:scale-110 transition-transform flex items-center justify-center" title="Eliminar">
                            <i class="fas fa-trash-alt text-xs"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.querySelector('#add-campana').onclick = async () => {
        showCustomPrompt("Nombre de la nueva campaña:", "", async (name) => {
            await saveCampana(name);
            reloadTabFn('campanas');
        });
    };

    window.actionDeleteCampana = async (c) => {
        showCustomConfirm(`¿Borrar la campaña "${c}"? Los registros históricos no se verán afectados.`, async () => {
            await deleteCampana(c);
            reloadTabFn('campanas');
        });
    };
};
