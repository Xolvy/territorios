import { renderHistorialView } from './history-view.js?v=2.4.0.5';
import { renderS12View } from './s12-view.js?v=2.4.0.5';

export const renderReportsTab = async (container, config, appVersion) => {
    let _activeReport = 's13'; // Default to S-13

    container.innerHTML = `
        <div class="animate-fade-in space-y-8">
            <nav class="flex items-center gap-3 p-1.5 bg-slate-100/50 dark:bg-white/5 rounded-[2rem] w-max border border-slate-200 dark:border-white/10 mx-auto transition-all">
                <button id="btn-show-s13" class="px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3">
                    <i class="fas fa-chart-line text-xs"></i> Reporte S-13
                </button>
                <button id="btn-show-s12" class="px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3">
                    <i class="fas fa-shield-alt text-xs"></i> Base S-12
                </button>
            </nav>
            
            <div id="report-content-area" class="min-h-[50vh] transition-all"></div>
        </div>
    `;

    const loadReport = async (type) => {
        _activeReport = type;
        const target = container.querySelector('#report-content-area');

        // Update Nav UI
        container.querySelectorAll('button').forEach(btn => {
            const isS13 = btn.id === 'btn-show-s13' && type === 's13';
            const isS12 = btn.id === 'btn-show-s12' && type === 's12';
            const isActive = isS13 || isS12;

            btn.className = `px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${isActive ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
                }`;
        });

        target.innerHTML = `<div class="p-20 text-center opacity-30"><i class="fas fa-circle-notch fa-spin text-3xl"></i></div>`;

        if (type === 's13') {
            await renderHistorialView(target, config, appVersion);
        } else {
            await renderS12View(target, config, appVersion);
        }
    };

    container.querySelector('#btn-show-s13').onclick = () => loadReport('s13');
    container.querySelector('#btn-show-s12').onclick = () => loadReport('s12');

    loadReport('s13');
};
