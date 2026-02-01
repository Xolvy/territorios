import {
    getGroupsConfig, getPublicadores, saveGroupsConfig
} from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';

export const renderGruposTab = async (container) => {
    const groups = await getGroupsConfig();
    const publicadores = await getPublicadores();
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

    container.innerHTML = `
        <div class="mb-8 px-4">
            <h3 class="font-black text-2xl md:text-3xl text-slate-800 dark:text-white flex items-center gap-4 uppercase tracking-tighter">
                <div class="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center text-teal-600 shadow-inner">
                    <i class="fas fa-layer-group"></i>
                </div>
                Configuración de Grupos
            </h3>
            <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-2 ml-1">Liderazgo y Puntos de Salida</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-4">
            ${groups.map(g => `
                <div class="modern-card group border-slate-200 dark:border-white/5 shadow-xl transition-all hover:scale-[1.02] relative overflow-hidden">
                    <div class="absolute -right-12 -top-12 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl"></div>
                    
                    <div class="relative z-10 space-y-6 p-2">
                        <div class="flex justify-between items-center bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                            <h4 class="font-black text-slate-800 dark:text-white uppercase tracking-tight text-lg">${g.nombre}</h4>
                            <span class="text-[10px] font-black uppercase text-teal-600 bg-teal-500/10 px-3 py-1 rounded-xl border border-teal-500/20 shadow-sm">ID: ${g.id}</span>
                        </div>

                        <div class="space-y-4">
                            <div class="space-y-2">
                                <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Superintendente</label>
                                <div class="relative">
                                    <select id="leader-${g.id}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-teal-500 outline-none shadow-sm appearance-none cursor-pointer">
                                        <option value="">Sin asignar</option>
                                        ${publicadores.map(p => `<option value="${p.nombre}" ${g.lider === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                                    </select>
                                    <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            </div>

                            <div class="space-y-2">
                                <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Auxiliar</label>
                                <div class="relative">
                                    <select id="assistant-${g.id}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-teal-500 outline-none shadow-sm appearance-none cursor-pointer">
                                        <option value="">Sin asignar</option>
                                        ${publicadores.map(p => `<option value="${p.nombre}" ${g.asistente === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                                    </select>
                                    <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            </div>

                            <div class="space-y-2">
                                <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Punto de Salida</label>
                                <div class="relative">
                                    <input type="text" id="house-${g.id}" value="${g.casa_salida || ''}" placeholder="Ej. Calle 123..." class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-teal-500 outline-none shadow-sm">
                                    <i class="fas fa-home absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-white/10"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="mt-16 flex flex-col md:flex-row justify-center items-center gap-6 pb-20">
            <button id="add-group-btn" class="w-full md:w-auto px-10 py-5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/10 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:border-teal-500 hover:text-teal-600 transition-all shadow-xl active:scale-95 group">
                <i class="fas fa-plus-circle mr-2 group-hover:rotate-90 transition-transform"></i> Agregar Grupo
            </button>
            <button id="save-groups" class="w-full md:w-auto px-12 py-5 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-teal-500/30 flex items-center justify-center gap-4 transition-all hover:-translate-y-1 active:scale-95">
                <i class="fas fa-cloud-upload-alt text-lg"></i> Guardar Cambios Globales
            </button>
        </div>
    `;

    container.querySelector('#add-group-btn').onclick = () => {
        const newId = groups.length > 0 ? (Math.max(...groups.map(g => g.id)) + 1) : 1;
        groups.push({
            id: newId,
            nombre: `Grupo ${newId}`,
            lider: "",
            asistente: "",
            casa_salida: ""
        });
        renderGruposTab(container);
    };

    container.querySelector('#save-groups').onclick = async () => {
        const btn = container.querySelector('#save-groups');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        btn.disabled = true;

        const updated = groups.map(g => ({
            ...g,
            lider: document.getElementById(`leader-${g.id}`).value,
            asistente: document.getElementById(`assistant-${g.id}`).value,
            casa_salida: document.getElementById(`house-${g.id}`).value.trim()
        }));

        try {
            await saveGroupsConfig(updated);
            showNotification("Configuración de grupos persistida correctamente", "success");
        } catch (e) {
            showNotification("Error: " + e.message, "error");
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    };
};
