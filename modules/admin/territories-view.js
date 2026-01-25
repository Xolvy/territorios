// --- TERRITORIOS VIEW SHELL ---
// This is a router module for Casa en Casa administration.
// Refactored in 2026 for modularity.

export const renderCasaEnCasaTab = async (container) => {
    let _activeSub = 'programa';

    container.innerHTML = `
        <div class="space-y-6 md:space-y-8 animate-fade-in px-1 md:px-6">
            <header class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-primary/30 border border-primary/20 shrink-0">
                        <i class="fas fa-home"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Territorios</h2>
                        <p class="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-1">Gestión Casa en Casa</p>
                    </div>
                </div>

                <nav class="flex flex-row overflow-x-auto scrollbar-hide items-center gap-1 bg-white/50 dark:bg-white/[0.03] p-1 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm w-full xl:w-auto backdrop-blur-xl">
                    ${renderSubTab('programa', 'fas fa-calendar-check', 'Programa')}
                    ${renderSubTab('historial', 'fas fa-chart-line', 'CONTROL')}
                    ${renderSubTab('s12', 'fas fa-shield-alt', 'Base S-12')}
                    <div class="w-px h-5 bg-slate-200 dark:bg-white/10 mx-2 shrink-0"></div>
                    ${renderSubTab('recursos', 'fas fa-folder-open', 'RECURSOS')}
                    ${renderSubTab('personal', 'fas fa-users', 'PERSONAL')}
                </nav>
            </header>
            
            <div id="casa-content" class="relative min-h-[60vh]"></div>
        </div>
    `;

    const loadCasaSub = async (sub) => {
        _activeSub = sub;
        const subContainer = container.querySelector('#casa-content');

        container.querySelectorAll('.sub-tab-casa').forEach(btn => {
            const isActive = btn.dataset.sub === sub;
            btn.classList.toggle('active', isActive);
            btn.className = `sub-tab-casa group px-5 py-3 rounded-xl transition-all flex items-center gap-3 whitespace-nowrap font-extrabold border shadow-sm ${isActive ? 'bg-slate-900 dark:bg-white/10 text-white border-slate-800' : 'text-slate-600 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-white/5'}`;
        });

        subContainer.innerHTML = `<div class="p-20 text-center opacity-30"><i class="fas fa-circle-notch fa-spin text-3xl"></i></div>`;

        try {
            switch (sub) {
                case 'programa':
                    const { renderProgramaTab } = await import('./program-view.js?v=2.3.0');
                    await renderProgramaTab(subContainer);
                    break;
                case 'historial':
                    const { renderHistorialView } = await import('./history-view.js?v=2.3.0');
                    await renderHistorialView(subContainer);
                    break;
                case 's12':
                    const { renderS12View } = await import('./s12-view.js?v=2.3.0');
                    await renderS12View(subContainer);
                    break;
                case 'recursos':
                    const { renderRecursosTab } = await import('./resources-view.js?v=2.3.0');
                    await renderRecursosTab(subContainer);
                    break;
                case 'personal':
                    const { renderPersonalTab } = await import('./personal-view.js?v=2.3.0');
                    await renderPersonalTab(subContainer);
                    break;
            }
        } catch (e) {
            console.error(e);
            subContainer.innerHTML = `<div class="p-20 text-center text-rose-500 font-bold uppercase tracking-widest text-xs">Error: ${e.message}</div>`;
        }
    };

    container.querySelectorAll('.sub-tab-casa').forEach(btn => {
        btn.onclick = (e) => loadCasaSub(e.currentTarget.dataset.sub);
    });

    loadCasaSub('programa');
};

const renderSubTab = (id, icon, label) => `
    <button class="sub-tab-casa group px-5 py-3 rounded-xl transition-all flex items-center gap-3 whitespace-nowrap font-extrabold" data-sub="${id}">
        <i class="${icon} text-sm"></i>
        <span class="text-[11px] font-extrabold uppercase tracking-wider">${label}</span>
    </button>
`;
