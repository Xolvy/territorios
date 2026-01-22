import {
    getPublicadores, addPublicador, updatePublicador, deletePublicador,
    getGroupsConfig
} from '../../data/firestore-services.js?v=2.2.1';
import { showNotification, ensureOnline } from '../utils/helpers.js?v=2.2.1';
import { showModal, showCustomConfirm } from '../services/ui-helpers.js?v=2.2.1';

export const renderPersonalTab = async (container) => {
    const publicadores = await getPublicadores();
    const groups = await getGroupsConfig();
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

    const renderAvailPreview = (p) => {
        const disp = p.disponibilidad || [];
        if (!p.es_conductor) return '';
        if (disp.length === 0) return '<span class="text-[9px] text-gray-500 italic">Precedencia sin turnos</span>';
        return `<button onclick = "event.stopPropagation(); window.showPublicadorAvailability('${p.id}')" class="text-[9px] text-teal-600 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 rounded border border-teal-500/20 underline decoration-teal-500/30 cursor-pointer transition-colors font-medium"> Conductor: ${disp.length} turnos</button> `;
    };

    window.showPublicadorAvailability = (id) => {
        const p = publicadores.find(x => x.id === id);
        if (!p || !p.disponibilidad || p.disponibilidad.length === 0) return;
        const shiftLabels = { 'manana': 'Mañana', 'tarde': 'Tarde', 'noche': 'Noche' };
        const daysOrder = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6 };
        const sorted = [...p.disponibilidad].sort((a, b) => {
            const [da, sa] = a.split('_'), [db, sb] = b.split('_');
            return (daysOrder[da] - daysOrder[db]) || (sa.localeCompare(sb));
        });
        const listHtml = sorted.map(item => `
            <div class="flex justify-between items-center p-4 border-b border-slate-100 dark:border-white/5 last:border-0 group hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                <span class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">${item.split('_')[0]}</span>
                <span class="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-1 rounded-md tracking-widest border border-primary/20">
                    ${shiftLabels[item.split('_')[1]] || item.split('_')[1]}
                </span>
            </div> `).join('');

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-6 text-white relative">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-xl"></div>
                    <div class="relative z-10 flex justify-between items-center">
                        <div>
                             <h3 class="text-xl font-black uppercase tracking-tight">Disponibilidad</h3>
                             <p class="text-[9px] opacity-70 font-bold uppercase mt-1 tracking-[0.2em]">${p.nombre}</p>
                        </div>
                        <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl shadow-lg border border-white/30">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                    </div>
                </header>
                <div class="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="modern-card !p-0 overflow-hidden shadow-xl border-slate-200 dark:border-white/5">
                        ${listHtml}
                    </div>
                </div>
            </div>
        `);
    };

    container.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6 px-4">
            <div class="space-y-1">
                <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Directorio de Personal</h3>
                <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] ml-1">Gestión centralizada de publicadores</p>
            </div>
            
            <button id="btn-add-person" class="w-full sm:w-auto bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                <i class="fas fa-plus"></i> Nuevo Registro
            </button>
        </div>

        <div class="hidden md:block modern-card !p-0 overflow-hidden border-slate-200 dark:border-white/5 shadow-2xl">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-slate-50 dark:bg-black/20 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100 dark:border-white/5">
                            <th class="p-6">Nombre y Apellido</th>
                            <th class="p-6 text-center">Grupo</th>
                            <th class="p-6 text-center">Rol / Estado</th>
                            <th class="p-6 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                        ${publicadores.map(p => `
                            <tr class="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                <td class="p-6">
                                    <div class="flex items-center gap-4">
                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${p.genero === 'Mujer' ? 'from-rose-500 to-pink-500' : 'from-primary to-blue-600'} flex items-center justify-center text-white font-black text-sm shadow-lg group-hover:scale-110 transition-transform">
                                            ${p.nombre.charAt(0)}
                                        </div>
                                        <div>
                                            <p class="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">${p.nombre}</p>
                                            <p class="text-[9px] text-slate-400 font-mono">${p.telefono || 'SIN TELÉFONO'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td class="p-6 text-center">
                                    <span class="text-[10px] font-black uppercase text-slate-400 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 shadow-inner">
                                        ${p.grupo || '?'}
                                    </span>
                                </td>
                                <td class="p-6">
                                    <div class="flex flex-wrap items-center justify-center gap-2">
                                        ${p.privilegios?.includes('Superintendente de Circuito') ? `
                                            <span class="text-[8px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full">Sup. Circuito</span>
                                        ` : ''}
                                        ${p.es_conductor ? `
                                            <button onclick="event.stopPropagation(); window.showPublicadorAvailability('${p.id}')" class="text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full hover:bg-emerald-500 hover:text-white transition-all">
                                                <i class="fas fa-check-circle mr-1"></i> Conductor
                                            </button>
                                        ` : `
                                            ${!p.privilegios?.includes('Superintendente de Circuito') ? `<span class="text-[8px] font-black uppercase tracking-widest text-slate-400 opacity-40">Publicador</span>` : ''}
                                        `}
                                        ${p.privilegios?.includes('Administrador') ? `
                                            <span class="text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 border border-amber-500/20 px-3 py-1 rounded-full">Admin</span>
                                        ` : ''}
                                    </div>
                                </td>
                                <td class="p-6">
                                    <div class="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <button onclick="window.editPerson('${p.id}')" class="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl border border-slate-200 dark:border-white/10 hover:border-primary/40 transition-all shadow-sm">
                                            <i class="fas fa-edit text-[10px]"></i>
                                        </button>
                                        <button onclick="window.deletePerson('${p.id}')" class="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-500 rounded-xl border border-slate-200 dark:border-white/10 hover:border-rose-500/40 transition-all shadow-sm">
                                            <i class="fas fa-trash-alt text-[10px]"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="md:hidden space-y-4 px-2">
            ${publicadores.map(p => `
                <div class="modern-card p-5 border-slate-200 dark:border-white/5 shadow-xl space-y-4 relative overflow-hidden active:scale-[0.98] transition-all">
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br ${p.genero === 'Mujer' ? 'from-rose-500 to-pink-500' : 'from-primary to-blue-600'} flex items-center justify-center text-white font-black text-lg shadow-lg">
                                ${p.nombre.charAt(0)}
                            </div>
                            <div class="min-w-0">
                                <p class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">${p.nombre}</p>
                                <p class="text-[10px] text-slate-400 font-mono font-bold">${p.telefono || 'SIN TELÉFONO'}</p>
                            </div>
                        </div>
                        <div class="flex-shrink-0">
                            <span class="bg-slate-100 dark:bg-white/5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-[9px] font-black text-slate-500">
                                G ${p.grupo || '?'}
                            </span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // ... Implementation of openPersonModal (to be moved/shared)
    // For now, I'll export a simple placeholder or copy the whole logic.
    // Given the complexity, I'll export the rendering and rely on window for actions.

    container.querySelector('#btn-add-person').onclick = () => window.openPersonModal();
    window.editPerson = (id) => window.openPersonModal(publicadores.find(x => x.id === id));
    window.deletePerson = (id) => showCustomConfirm("¿Eliminar este registro permanentemente?", async () => {
        await deletePublicador(id);
        renderPersonalTab(container);
    });
};
