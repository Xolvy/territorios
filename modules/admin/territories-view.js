import { renderSkeleton } from "../utils/helpers.js";

// --- TERRITORIOS VIEW SHELL ---

export const renderCasaEnCasaTab = async (container, config, appVersion) => {
    container.innerHTML = `
        <div class="space-y-8 md:space-y-12 animate-fade-in" data-adaptive-container="true">
            <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5 w-full" data-mobile-order="1" data-desktop-order="1">
                <div class="flex items-center gap-4 md:gap-6">
                    <div class="w-12 h-12 md:w-16 md:h-16 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-2xl flex items-center justify-center text-xl md:text-2xl border border-slate-200 dark:border-white/5 shrink-0">
                        <i class="fas fa-home"></i>
                    </div>
                    <div>
                        <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Territorios</h2>
                        <p class="text-[9px] md:text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-1.5">Gestión Casa en Casa</p>
                    </div>
                </div>

                <nav class="flex flex-row items-center justify-start gap-2 w-full sm:w-auto flex-1 sm:flex-initial min-w-0 mt-2 sm:mt-0">
                    ${renderSubTab("programa", "fas fa-calendar-check", "Programa")}
                    ${renderSubTab("mapas", "fas fa-map-marked-alt", "Mapas")}
                </nav>
            </header>
            
            <div id="casa-content" class="relative min-h-[60vh]" data-mobile-order="2" data-desktop-order="2"></div>
        </div>
    `;

    const loadCasaSub = async (sub) => {
        const subContainer = container.querySelector("#casa-content");

        container.querySelectorAll(".sub-tab-casa").forEach((btn) => {
            const isActive = btn.dataset.sub === sub;
            btn.classList.toggle("active", isActive);
            btn.className = `sub-tab-casa group px-3.5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center gap-2 md:gap-3 whitespace-nowrap font-black border text-[9px] sm:text-[10px] uppercase tracking-widest ${isActive ? "bg-slate-900 text-white dark:bg-white/10 dark:text-white border-slate-800 dark:border-white/5 shadow-sm" : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm"}`;
        });

        renderSkeleton(subContainer);

        try {
            switch (sub) {
                case "programa": {
                    const { renderProgramaTab } = await import("./program-view.js");
                    await renderProgramaTab(subContainer, config, appVersion);
                    break;
                }
                case "mapas": {
                    const { renderMapsView } = await import("./maps-view.js");
                    await renderMapsView(subContainer, config, appVersion);
                    break;
                }
            }
            // Trigger adaptive engine after sub-module load
            if (window.XolvyAdaptive) window.XolvyAdaptive.refresh();
        } catch (e) {
            console.error(e);
            subContainer.innerHTML = `<div class="p-20 text-center text-rose-500 font-bold uppercase tracking-widest text-xs">Error: ${e.message}</div>`;
        }
    };

    container.querySelectorAll(".sub-tab-casa").forEach((btn) => {
        btn.onclick = (e) => loadCasaSub(e.currentTarget.dataset.sub);
    });

    loadCasaSub("programa");

    // Initial adaptive refresh
    if (window.XolvyAdaptive) window.XolvyAdaptive.refresh();
};

const renderSubTab = (id, icon, label) => `
    <button class="sub-tab-casa group transition-all flex items-center justify-center whitespace-nowrap font-black text-[9px] sm:text-[10px] uppercase tracking-widest border rounded-xl" data-sub="${id}">
        <i class="${icon} text-sm"></i>
        <span class="ml-2">${label}</span>
    </button>
`;
