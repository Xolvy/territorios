import { showModal } from '../services/ui-helpers.js';
import { formatManzanas } from '../utils/helpers.js';

export const renderRescueMissions = (allTerritorios, normalizedName, myExtraMissions, rescueCandidates, totalMissionCount) => {
    // This function is still called but the main UI is now handled in dashboard.js
    // However, we need to keep the Modal rendering logic here and modernize it.

    window.showRescueMissionsModal = () => {
        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[3rem] overflow-hidden">
                <header class="shrink-0 bg-indigo-600 p-8 text-white relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-8 opacity-10 text-8xl grayscale pointer-events-none">
                        <i class="fas fa-map-marked-alt"></i>
                    </div>
                    <div class="flex items-center gap-6 relative z-10">
                        <div class="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-lg backdrop-blur-md">
                            <i class="fas fa-rocket"></i>
                        </div>
                        <div class="space-y-1">
                            <h3 class="text-2xl font-black uppercase tracking-tighter">Por completar</h3>
                            <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Territorios pendientes y disponibles</p>
                        </div>
                    </div>
                </header>
    
                <div class="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-10 bg-slate-50 dark:bg-black/20">
                    <!-- Mis Misiones Actuales -->
                    ${myExtraMissions.length > 0 ? `
                    <section class="space-y-4">
                        <h4 class="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] ml-2">Mis Asignaciones Ad-Hoc</h4>
                        <div class="grid grid-cols-1 gap-4">
                            ${myExtraMissions.map(t => `
                                <div class="modern-card !p-5 bg-white dark:bg-white/5 border-l-4 border-indigo-500 shadow-sm flex justify-between items-center group">
                                    <div class="flex items-center gap-4">
                                        <span class="w-12 h-12 bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center font-black text-lg">T${t.numero}</span>
                                        <div>
                                            <p class="text-[10px] font-black text-slate-800 dark:text-white uppercase">${t.localidad || 'General'}</p>
                                            <p class="text-[8px] font-bold text-slate-400 uppercase truncate max-w-[150px]">${formatManzanas(t.manzanas)}</p>
                                        </div>
                                    </div>
                                    <button onclick="window.viewMapFromReport('${t.id}')" class="w-10 h-10 bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-indigo-500 rounded-xl transition-colors">
                                        <i class="fas fa-map-marked-alt"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                    ` : ''}

                    <!-- Oportunidades -->
                    <section class="space-y-4">
                        <h4 class="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] ml-2">Lista de Trabajo</h4>
                        ${rescueCandidates.length === 0 ? `
                        <div class="text-center py-12 px-8 bg-white dark:bg-white/5 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-white/10 opacity-60">
                            <i class="fas fa-check-circle text-4xl text-emerald-500 mb-4"></i>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">No hay territorios adicionales disponibles en este momento.</p>
                        </div>
                        ` : `
                            <div class="grid grid-cols-1 gap-6">
                                ${rescueCandidates.map(t => {
            const isFree = t.estado === 'Libre' || t.estado === 'Disponible' || t.estado === 'Sin asignar';
            const isIncomplete = t.is_incomplete === true;
            const accent = isIncomplete ? 'amber' : (isFree ? 'teal' : 'rose');
            const icon = isIncomplete ? 'fa-puzzle-piece' : (isFree ? 'fa-door-open' : 'fa-clock');
            const tag = isIncomplete ? 'INCOMPLETO' : (isFree ? 'DISPONIBLE' : 'RESISTENTE');

            return `
                                    <div class="modern-card !p-8 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
                                        <div class="absolute top-0 right-0 p-8 opacity-5 text-6xl grayscale">
                                            <i class="fas ${icon}"></i>
                                        </div>
                                        <div class="flex justify-between items-start mb-6">
                                            <div class="flex items-center gap-5">
                                                <div class="w-16 h-16 bg-${accent}-500/10 text-${accent}-600 rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-inner group-hover:scale-110 transition-transform">
                                                    T${t.numero}
                                                </div>
                                                <div class="space-y-1">
                                                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">LOCALIDAD</p>
                                                    <p class="text-sm font-black text-slate-800 dark:text-white uppercase truncate">${t.localidad || 'General'}</p>
                                                </div>
                                            </div>
                                            <div class="text-right">
                                                <span class="px-3 py-1 bg-${accent}-500/10 text-${accent}-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-${accent}-500/10">
                                                    ${tag}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div class="bg-slate-50 dark:bg-black/20 p-5 rounded-2xl border border-slate-100 dark:border-white/5 mb-8">
                                            <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed uppercase tracking-tight">
                                                <i class="fas fa-map-marker-alt mr-2 opacity-40"></i>
                                                ${formatManzanas(t.manzanas) || 'Territorio listo para predicar.'}
                                            </p>
                                        </div>

                                        <button onclick="window.handleRescueTerritory('${t.id}', '${t.numero}', '${normalizedName.replace(/'/g, "\\\'")}', '${(t.manzanas || '').replace(/'/g, "\\\'")}', true)"
                                                class="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                                            <i class="fas fa-plus"></i> 
                                            ${isIncomplete ? 'CONTINUAR PREDICACIÓN' : 'TOMAR TERRITORIO'}
                                        </button>
                                    </div>
                                    `;
        }).join('')}
                            </div>
                        `}
                    </section>
                </div>
                <footer class="p-8 border-t border-slate-100 dark:border-white/10 text-center">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest italic leading-relaxed">
                        * Los territorios tomados desde aquí aparecerán directamente en tu agenda inteligente.
                    </p>
                </footer>
            </div>
        `, null, 'max-w-xl');
    };

    return ''; // The button is now rendered in conductor-dashboard.js
};
