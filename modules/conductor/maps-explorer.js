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
            grid.innerHTML = list.map(t => `
                <div class="modern-card !p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-primary/40 hover:shadow-xl transition-all group/card cursor-pointer shadow-sm relative overflow-hidden" onclick="window.openInteractiveMapFromDashboard('${t.id}')">
                    <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none"></div>
                    <div class="flex justify-between items-start mb-4 relative z-10">
                        <span class="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-lg uppercase tracking-widest">T-${t.numero}</span>
                        <div class="flex items-center gap-2">
                             <div class="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/10 flex items-center justify-center group-hover/card:bg-primary group-hover/card:text-white transition-all text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-white/5">
                                 <i class="fas fa-location-arrow text-[10px]"></i>
                             </div>
                        </div>
                    </div>
                    <h5 class="text-[11px] font-bold text-slate-800 dark:text-gray-200 uppercase tracking-tight leading-relaxed line-clamp-2 relative z-10">${t.manzanas || 'Sin sector definido'}</h5>
                </div>
            `).join('');
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
