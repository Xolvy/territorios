import { getPublicadores, updatePublicador } from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';

export const renderAvailabilitySection = async (container, currentUserName) => {
    if (!container) return;

    const publicadores = await getPublicadores();
    const me = publicadores.find(p => p.nombre.trim().toLowerCase() === currentUserName.trim().toLowerCase());

    if (!me) return;

    const currentDisp = me.disponibilidad || { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] };
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const turnos = ['mañana', 'tarde', 'noche'];

    container.innerHTML = `
        <div class="space-y-8 animate-fade-in">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 shadow-inner">
                    <i class="fas fa-clock"></i>
                </div>
                <div>
                    <h4 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Mi Disponibilidad</h4>
                    <p class="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.3em]">Gestiona tus horarios para el programa</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                ${dias.map(dia => `
                    <div class="modern-card p-5 border-slate-100 dark:border-white/5 space-y-4">
                        <h5 class="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 dark:border-white/5 pb-2">${dia}</h5>
                        <div class="flex flex-col gap-2">
                            ${turnos.map(turno => {
        const isChecked = currentDisp[dia]?.includes(turno);
        return `
                                    <label class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-emerald-500/30 transition-all cursor-pointer group">
                                        <span class="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300">${turno}</span>
                                        <input type="checkbox" data-dia="${dia}" data-turno="${turno}" ${isChecked ? 'checked' : ''} class="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-white/10 text-emerald-500 focus:ring-emerald-500 transition-all cursor-pointer">
                                    </label>
                                `;
    }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="flex justify-end pt-4">
                <button id="btn-save-disp" class="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-3">
                    <i class="fas fa-save"></i> Guardar Disponibilidad
                </button>
            </div>
        </div>
    `;

    container.querySelector('#btn-save-disp').onclick = async () => {
        const btn = container.querySelector('#btn-save-disp');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';

        const newDisp = { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] };
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.checked) {
                newDisp[cb.dataset.dia].push(cb.dataset.turno);
            }
        });

        try {
            await updatePublicador(me.id, { disponibilidad: newDisp });
            showNotification("Disponibilidad actualizada", "success");
        } catch (e) {
            showNotification("Error al guardar", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar Disponibilidad';
        }
    };
};
