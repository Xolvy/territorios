import { getTerritorios, getHistorialReport } from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';
import { renderHistorialView } from './history-view.js';

export const renderReportsTab = async (container, config, appVersion) => {
    let _activeMainTab = 'historial'; // New main navigation
    let _activeReportSubTab = 's13'; // Sub-tab for printing section

    const renderMain = () => {
        container.innerHTML = `
            <div class="animate-fade-in space-y-8 max-w-7xl mx-auto p-4 md:p-6 overflow-x-hidden">
                <!-- Main Nav: Historial vs Reportes -->
                <nav class="flex items-center gap-3 p-1.5 bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl rounded-[2.2rem] w-max border border-slate-200 dark:border-white/5 mx-auto transition-all shadow-sm">
                    <button id="main-btn-historial" class="px-10 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 border border-transparent">
                        <i class="fas fa-history"></i> Historial
                    </button>
                    <button id="main-btn-reportes" class="px-10 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 border border-transparent">
                        <i class="fas fa-print"></i> Reportes (S-12/S-13)
                    </button>
                </nav>
                
                <div id="main-report-content" class="min-h-[60vh] transition-all"></div>
            </div>
        `;

        const updateNav = () => {
            const hBtn = container.querySelector('#main-btn-historial');
            const rBtn = container.querySelector('#main-btn-reportes');

            [hBtn, rBtn].forEach(btn => {
                const isActive = (btn.id === 'main-btn-historial' && _activeMainTab === 'historial') ||
                    (btn.id === 'main-btn-reportes' && _activeMainTab === 'reportes');
                btn.className = `px-10 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${isActive ? 'bg-slate-900 dark:bg-white/10 text-white shadow-xl shadow-slate-900/20 md:scale-105' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`;
            });
        };

        container.querySelector('#main-btn-historial').onclick = () => { _activeMainTab = 'historial'; updateNav(); renderHistorialSection(); };
        container.querySelector('#main-btn-reportes').onclick = () => { _activeMainTab = 'reportes'; updateNav(); renderReportesSection(); };

        updateNav();
        if (_activeMainTab === 'historial') renderHistorialSection();
        else renderReportesSection();
    };

    const renderHistorialSection = async () => {
        const target = container.querySelector('#main-report-content');
        target.innerHTML = `<div class="py-20 text-center opacity-30"><i class="fas fa-circle-notch fa-spin text-3xl"></i></div>`;

        // Use history-view.js logic but injected here
        await renderHistorialView(target, config, appVersion);

        // Add "Historial de Observaciones" Global Toggle/Filter to the history-view UI if possible, 
        // or just let history-view handle it.
        // Actually, I'll modify history-view.js later to add the "Observaciones" toggle.
    };

    const renderReportesSection = async () => {
        const target = container.querySelector('#main-report-content');
        let terrs = [];
        let history = [];

        try {
            [terrs, history] = await Promise.all([getTerritorios(), getHistorialReport()]);
            terrs.sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }));
        } catch (e) { console.error(e); }

        target.innerHTML = `
            <div class="space-y-8 animate-fade-in">
                <nav class="flex items-center gap-3 p-1.5 bg-slate-100/50 dark:bg-white/5 rounded-2xl w-max mx-auto transition-all">
                    <button id="sub-btn-s13" class="px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Registro S-13</button>
                    <button id="sub-btn-s12" class="px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Tarjetas S-12</button>
                </nav>
                <div id="report-print-area" class="mt-8"></div>
            </div>
        `;

        const loadSubReport = (type) => {
            _activeReportSubTab = type;
            const printArea = target.querySelector('#report-print-area');

            target.querySelectorAll('nav button').forEach(btn => {
                const isActive = (btn.id === 'sub-btn-s13' && type === 's13') || (btn.id === 'sub-btn-s12' && type === 's12');
                btn.className = `px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`;
            });

            if (type === 's13') renderS13Print(printArea, history);
            else renderS12Print(printArea, terrs);
        };

        target.querySelector('#sub-btn-s13').onclick = () => loadSubReport('s13');
        target.querySelector('#sub-btn-s12').onclick = () => loadSubReport('s12');

        loadSubReport(_activeReportSubTab);
    };

    const renderS13Print = (target, history) => {
        target.innerHTML = `
            <div class="modern-card p-10 space-y-8 animate-fade-in border-slate-100 dark:border-white/5 shadow-2xl max-w-3xl mx-auto">
                <div class="flex items-center gap-6 mb-4">
                    <div class="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-3xl text-emerald-600 shadow-inner">
                        <i class="fas fa-file-invoice"></i>
                    </div>
                    <div>
                        <h4 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Reporte S-13</h4>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Impresión de Registro Oficial</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Desde</label>
                        <input type="date" id="print-s13-from" value="${new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-indigo-500 transition-all shadow-inner">
                    </div>
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Hasta</label>
                        <input type="date" id="print-s13-to" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-indigo-500 transition-all shadow-inner">
                    </div>
                </div>
                <button id="btn-do-print-s13" class="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-[12px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-4">
                    <i class="fas fa-print"></i> Generar Registro S-13 (PDF)
                </button>
            </div>
        `;
        target.querySelector('#btn-do-print-s13').onclick = async () => {
            const from = target.querySelector('#print-s13-from').value;
            const to = target.querySelector('#print-s13-to').value;
            const { generateS13Report } = await import('./reports-generator.js');
            generateS13Report(history, from, to);
        };
    };

    const renderS12Print = (target, terrs) => {
        target.innerHTML = `
            <div class="space-y-8 animate-fade-in max-w-5xl mx-auto">
                <div class="modern-card p-6 flex flex-col md:flex-row justify-between items-center gap-6 border-slate-100 dark:border-white/5 shadow-xl">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 text-xl shadow-inner">
                            <i class="fas fa-check-double"></i>
                        </div>
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Territorios Seleccionados</p>
                            <p id="sel-count-print" class="text-xl font-black text-slate-800 dark:text-white">0 / ${terrs.length}</p>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <button id="btn-print-sel-all" class="px-6 py-3 bg-slate-100 dark:bg-white/5 text-slate-500 font-extrabold rounded-xl text-[9px] uppercase tracking-widest border border-slate-200 dark:border-white/10 hover:bg-slate-200 transition-all">Todos</button>
                        <button id="btn-print-sel-none" class="px-6 py-3 bg-slate-100 dark:bg-white/5 text-slate-500 font-extrabold rounded-xl text-[9px] uppercase tracking-widest border border-slate-200 dark:border-white/10 hover:bg-slate-200 transition-all">Ninguno</button>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${renderLayoutBtnPrint(1, 'fas fa-stop', '1 por hoja')}
                    ${renderLayoutBtnPrint(2, 'fas fa-columns', '2 por hoja')}
                    ${renderLayoutBtnPrint(4, 'fas fa-th-large', '4 por hoja')}
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" id="print-s12-grid-sel">
                    ${terrs.map(t => `
                        <div class="modern-card !p-4 border-slate-100 dark:border-white/5 shadow-sm cursor-pointer select-none transition-all hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 flex items-center gap-3 group" onclick="this.querySelector('input').click()">
                            <input type="checkbox" value="${t.id}" class="w-5 h-5 rounded-lg border-2 border-slate-200 checked:bg-indigo-500 transition-all cursor-pointer" onclick="event.stopPropagation()">
                            <span class="text-[12px] font-black text-slate-700 dark:text-white uppercase transition-all group-hover:text-indigo-500">${t.numero}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const updateCount = () => {
            const count = target.querySelectorAll('input[type="checkbox"]:checked').length;
            target.querySelector('#sel-count-print').innerText = `${count} / ${terrs.length}`;
        };

        target.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.onchange = updateCount; });
        target.querySelector('#btn-print-sel-all').onclick = () => { target.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true); updateCount(); };
        target.querySelector('#btn-print-sel-none').onclick = () => { target.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); updateCount(); };

        target.querySelectorAll('.btn-print-layout-action').forEach(btn => {
            btn.onclick = async () => {
                const layout = parseInt(btn.dataset.layout);
                const selectedIds = Array.from(target.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
                if (selectedIds.length === 0) return showNotification("Seleccione territorios", "warning");
                const selectedTerrs = terrs.filter(t => selectedIds.includes(t.id));
                const { generateS12Report } = await import('./reports-generator.js');
                generateS12Report(selectedTerrs, layout);
            };
        });
    };

    const renderLayoutBtnPrint = (num, icon, label) => `
        <button class="btn-print-layout-action modern-card !p-6 flex items-center justify-center gap-4 bg-white dark:bg-white/5 hover:bg-slate-900 hover:text-white transition-all border border-slate-100 dark:border-white/10 group shadow-lg active:scale-95 flex-col" data-layout="${num}">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-slate-50 dark:bg-white/5 group-hover:bg-white/20 transition-all">
                <i class="${icon}"></i>
            </div>
            <div class="text-center">
                <p class="text-[10px] font-black uppercase tracking-widest">${label}</p>
                <p class="text-[8px] font-bold uppercase opacity-50 mt-1">Imprimir Tarjeta</p>
            </div>
        </button>
    `;

    renderMain();
};
