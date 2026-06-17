export const renderMapsExplorer = (container, allTerritorios, openMapFn) => {
    if (!container) return;

    const grid = container.querySelector('#conductor-maps-grid');
    const search = container.querySelector('#search-explorer-maps');

    const render = (filter = '') => {
        if (!grid) return;
        let list = [...allTerritorios];

        if (filter) {
            const f = filter.toLowerCase();
            list = list.filter(t =>
                t.numero?.toString().includes(f) ||
                t.manzanas?.toLowerCase().includes(f) ||
                t.localidad?.toLowerCase().includes(f)
            );
        }

        list.sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));

        if (list.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-20 text-center space-y-4 opacity-30 group">
                    <div class="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center text-3xl mx-auto group-hover:scale-110 transition-transform">
                        <i class="fas fa-search-location"></i>
                    </div>
                    <p class="font-black text-[10px] uppercase tracking-[0.4em]">Sin resultados</p>
                </div>
            `;
        } else {
            grid.innerHTML = list.map(t => {
                const mzCount = t.manzanas ? t.manzanas.split(',').filter(Boolean).length : 0;
                return `
                    <div class="relative overflow-hidden p-6 rounded-[2rem] bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-100 dark:border-white/10 hover:border-indigo-500/50 hover:shadow-[0_20px_55px_-10px_rgba(99,102,241,0.2)] transition-all duration-400 cursor-pointer group/card flex flex-col justify-between min-h-[160px] h-auto select-none hover:-translate-y-1.5 hover:scale-[1.02]" onclick="window.openInteractiveMapFromDashboard('${t.id}')">
                        <!-- Top gradient accent line -->
                        <div class="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover/card:opacity-100 transition-opacity duration-300"></div>
                        <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-550 pointer-events-none"></div>
                        
                        <!-- Header with Badge and Location Icon -->
                        <div class="flex justify-between items-center mb-3 relative z-10">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="px-2.5 py-1 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-xl uppercase tracking-widest border border-indigo-500/15 shadow-inner">T-${t.numero}</span>
                                <span class="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-lg uppercase tracking-wider border border-emerald-500/15">
                                    ${mzCount} ${mzCount === 1 ? 'MZ' : 'MZs'}
                                </span>
                            </div>
                            <div class="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover/card:text-white group-hover/card:bg-indigo-600 border border-slate-200/50 dark:border-white/5 shadow-sm transition-all duration-300">
                                 <i class="fas fa-location-arrow text-[10px] transform group-hover/card:rotate-45 transition-transform duration-350"></i>
                            </div>
                        </div>
                        
                        <!-- Locality / Name -->
                        <div class="mb-3.5 relative z-10 flex-1 flex flex-col justify-center">
                            <h4 class="text-[12.5px] font-black text-slate-800 dark:text-white uppercase tracking-tight leading-snug group-hover/card:text-indigo-500 dark:group-hover/card:text-indigo-400 transition-colors line-clamp-2" title="${t.localidad || 'Territorio ' + t.numero}">
                                ${t.localidad || 'Territorio ' + t.numero}
                            </h4>
                        </div>

                        <!-- Footer with Manzana list -->
                        <div class="relative z-10 bg-slate-50/50 dark:bg-black/25 p-2.5 rounded-xl border border-slate-100/50 dark:border-white/5 mt-auto">
                            <span class="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Sectores / Manzanas</span>
                            <p class="text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight truncate" title="${t.manzanas || 'Sin sector definido'}">${t.manzanas || 'Sin sector definido'}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
    };

    if (search) {
        search.oninput = (e) => render(e.target.value.trim());
    }

    render();

    window.openInteractiveMapFromDashboard = (tid) => {
        const t = allTerritorios.find(x => x.id === tid);
        if (t && openMapFn) openMapFn(t, { readOnly: true });
    };
};
