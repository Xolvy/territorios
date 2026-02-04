import Chart from 'chart.js/auto';
// --- TERRITORIOS VIEW SHELL ---
// This is a router module for Casa en Casa administration.
// Refactored in 2026 for modularity.

export const renderCasaEnCasaTab = async (container, config, appVersion) => {
    let _activeSub = 'programa';

    container.innerHTML = `
        <div class="space-y-6 md:space-y-8 animate-fade-in px-1 md:px-6" data-adaptive-container="true">
            <header class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6" data-mobile-order="1" data-desktop-order="1">
                <div class="flex items-center gap-4 md:gap-6">
                    <div class="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-primary/30 border border-primary/20 shrink-0">
                        <i class="fas fa-home"></i>
                    </div>
                    <div>
                        <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Territorios</h2>
                        <p class="text-[9px] md:text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-1.5">Gestión Casa en Casa</p>
                    </div>
                </div>

                <nav data-adaptive-wrap="true" class="flex flex-row items-center gap-1 bg-white/50 dark:bg-white/[0.03] p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm w-full lg:w-max max-w-full backdrop-blur-xl shrink-0 overflow-hidden">
                    ${renderSubTab('programa', 'fas fa-calendar-check', 'Programa')}
                    ${renderSubTab('mapas', 'fas fa-map-marked-alt', 'MAPAS')}
                    ${renderSubTab('reportes', 'fas fa-chart-bar', 'REPORTES')}
                    ${renderSubTab('puntos', 'fas fa-map-marker-alt', 'ZONAS ESPECIALES')}
                    <div class="w-px h-5 bg-slate-200 dark:bg-white/10 mx-2 shrink-0"></div>
                    ${renderSubTab('recursos', 'fas fa-folder-open', 'RECURSOS')}
                    ${renderSubTab('personal', 'fas fa-users', 'PERSONAL')}
                </nav>
            </header>
            
            <div id="casa-content" class="relative min-h-[60vh]" data-mobile-order="2" data-desktop-order="2"></div>
        </div>
    `;

    const loadCasaSub = async (sub) => {
        _activeSub = sub;
        const subContainer = container.querySelector('#casa-content');

        container.querySelectorAll('.sub-tab-casa').forEach(btn => {
            const isActive = btn.dataset.sub === sub;
            btn.classList.toggle('active', isActive);
            btn.className = `sub-tab-casa group px-5 py-3 rounded-xl transition-all flex items-center gap-3 whitespace-nowrap font-extrabold border shadow-sm ${isActive ? 'bg-slate-900 dark:bg-white/10 text-white border-slate-800 shadow-lg' : 'text-slate-600 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-white/5'}`;
        });

        subContainer.innerHTML = `<div class="p-20 text-center opacity-30"><i class="fas fa-circle-notch fa-spin text-3xl"></i></div>`;

        try {
            switch (sub) {
                case 'programa':
                    const { renderProgramaTab } = await import('./program-view.js');
                    await renderProgramaTab(subContainer, config, appVersion);
                    break;
                case 'mapas':
                    const { renderMapsView } = await import('./maps-view.js');
                    await renderMapsView(subContainer, config, appVersion);
                    break;
                case 'reportes':
                    const { renderReportsTab } = await import('./reports-view.js');
                    await renderReportsTab(subContainer, config, appVersion);
                    break;
                case 'puntos':
                    const { renderPuntosInteresTab } = await import('./puntos-view.js');
                    await renderPuntosInteresTab(subContainer, config, appVersion);
                    break;
                case 'recursos':
                    const { renderRecursosTab } = await import('./resources-view.js');
                    await renderRecursosTab(subContainer, config, appVersion);
                    break;
                case 'personal':
                    const { renderPersonalTab } = await import('./personal-view.js');
                    await renderPersonalTab(subContainer, config, appVersion);
                    break;
            }
            // Trigger adaptive engine after sub-module load
            if (window.XolvyAdaptive) window.XolvyAdaptive.refresh();

        } catch (e) {
            console.error(e);
            subContainer.innerHTML = `<div class="p-20 text-center text-rose-500 font-bold uppercase tracking-widest text-xs">Error: ${e.message}</div>`;
        }
    };

    container.querySelectorAll('.sub-tab-casa').forEach(btn => {
        btn.onclick = (e) => loadCasaSub(e.currentTarget.dataset.sub);
    });

    loadCasaSub('programa');

    // Initial adaptive refresh
    if (window.XolvyAdaptive) window.XolvyAdaptive.refresh();
};

const renderSubTab = (id, icon, label) => `
    <button class="sub-tab-casa group px-3 md:px-5 py-2.5 md:py-3 rounded-xl transition-all flex items-center justify-center gap-2 md:gap-3 whitespace-nowrap font-extrabold flex-1 sm:flex-none" data-sub="${id}">
        <i class="${icon} text-xs md:text-sm"></i>
        <span class="text-[9px] md:text-[11px] font-extrabold uppercase tracking-tight md:tracking-wider truncate max-w-[100px] md:max-w-none">${label}</span>
    </button>
`;
