import { getPublicadores, updatePublicador } from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';

export const renderAvailabilitySection = async (container, currentUserName) => {
    if (!container) return;

    // Xolvy Data Shield: Robust normalization for user lookup
    const normalize = (val) => String(val || '').trim().toLowerCase();
    const publicadores = await getPublicadores();
    const me = publicadores.find(p => normalize(p.nombre) === normalize(currentUserName));

    if (!me) {
        console.warn(`🛡️ [Data Shield] User session mismatch for availability: ${currentUserName}`);
        return;
    }

    const currentDisp = me.disponibilidad || { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] };
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const turnos = ['mañana', 'tarde', 'noche'];

    container.innerHTML = `
        <div class="animate-fade-in space-y-2">
            <!-- Compact Single Card Grid -->
            <div class="modern-card bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 p-4 md:p-6">
                <!-- Header Labels -->
                <div class="grid grid-cols-4 gap-2 mb-4 px-4 opacity-50">
                    <div class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Día</div>
                    <div class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Mañana</div>
                    <div class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Tarde</div>
                    <div class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Noche</div>
                </div>

                <div class="space-y-1">
                    ${dias.map(dia => {
        const dayDisp = currentDisp[dia] || [];
        return `
                            <div class="grid grid-cols-4 gap-2 items-center p-3 hover:bg-white dark:hover:bg-white/5 rounded-2xl transition-all group border border-transparent hover:border-slate-200 dark:hover:border-white/5">
                                <span class="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest group-hover:text-primary transition-colors">${dia.substring(0, 3)} <span class="hidden sm:inline">${dia.substring(3)}</span></span>
                                
                                ${turnos.map(turno => {
            const isChecked = dayDisp.includes(turno);
            return `
                                        <div class="flex justify-center">
                                            <input type="checkbox" data-dia="${dia}" data-turno="${turno}" ${isChecked ? 'checked' : ''} 
                                                class="w-6 h-6 rounded-lg border-2 border-slate-200 dark:border-white/10 text-emerald-500 focus:ring-emerald-500 transition-all cursor-pointer bg-white dark:bg-slate-900">
                                        </div>
                                    `;
        }).join('')}
                            </div>
                        `;
    }).join('')}
                </div>
            </div>

            <div class="flex justify-center pt-4">
                <button id="btn-save-disp" class="w-full max-w-xs bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <i class="fas fa-save shadow-lg"></i> Guardar Disponibilidad
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
