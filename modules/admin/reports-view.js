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
            const raw = await getTerritorios();
            // Xolvy Shield: Prevent duplicates by Number (Fix Terr 9 issue)
            const seen = new Set();
            terrs = raw.filter(t => {
                const n = String(t.numero);
                if (seen.has(n)) return false;
                seen.add(n);
                return true;
            });
            history = await getHistorialReport();
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
            showS13Preview(history, from, to);
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
                showS12Preview(selectedTerrs, layout);
            };
        });
    };

    const showS12Preview = (selected, layout) => {
        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-indigo-600 p-8 text-white">
                    <h3 class="text-xl font-black uppercase tracking-widest">Vista Previa S-12</h3>
                    <p class="text-[9px] opacity-60 uppercase tracking-[0.4em] font-black">Revisión de ${selected.length} tarjetas</p>
                </header>
                <div class="flex-1 overflow-y-auto p-10 space-y-4 bg-slate-50 dark:bg-black/20">
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        ${selected.map(t => `
                            <div class="p-4 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 text-center">
                                <span class="text-lg font-black text-slate-800 dark:text-white">#${t.numero}</span>
                                <p class="text-[8px] font-bold text-slate-400 truncate uppercase mt-1">${t.localidad || '—'}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <footer class="p-8 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button onclick="this.closest('.fixed').classList.add('hidden')" class="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-xl text-[10px] uppercase">Atrás</button>
                    <button id="btn-final-s12" class="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest">Confirmar y Descargar PDF</button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-final-s12').onclick = async () => {
                const { generateS12Report } = await import('./reports-generator.js');
                generateS12Report(selected, layout);
                modal.closest('.fixed').classList.add('hidden');
            };
        });
    };

    const showS13Preview = (history, from, to) => {
        // Filter logic identical to generator
        const filtered = history.filter(h => {
            const date = h.fecha_entrega || h.timestamp;
            if (!date) return false;
            const d = date.toDate ? date.toDate().toISOString().split('T')[0] : String(date).split('T')[0];
            const isSuccess = h.estado === 'Completado' || h.estado === 'Predicado';
            return isSuccess && d >= from && d <= to;
        });

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[3rem] overflow-hidden">
                <header class="shrink-0 bg-emerald-600 p-8 text-white">
                    <h3 class="text-xl font-black uppercase tracking-widest">Vista Previa S-13</h3>
                    <p class="text-[9px] opacity-60 uppercase tracking-[0.4em] font-black">${filtered.length} Registros detectados</p>
                </header>
                <div class="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <table class="w-full text-left border-separate border-spacing-y-2">
                        <thead>
                            <tr class="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                <th class="px-4 pb-2">Terr</th>
                                <th class="px-4 pb-2">Conductor</th>
                                <th class="px-4 pb-2">Asignación</th>
                                <th class="px-4 pb-2">Entrega</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(h => `
                                <tr class="bg-white dark:bg-white/5 text-[10px] font-bold text-slate-700 dark:text-gray-300 shadow-sm">
                                    <td class="px-4 py-3 rounded-l-xl border-y border-l border-slate-100 dark:border-white/5">#${h.numero}</td>
                                    <td class="px-4 py-3 border-y border-slate-100 dark:border-white/5 uppercase">${h.conductor || '—'}</td>
                                    <td class="px-4 py-3 border-y border-slate-100 dark:border-white/5">${UIHelpers.fmtDate(h.fecha_asignacion)}</td>
                                    <td class="px-4 py-3 rounded-r-xl border-y border-r border-slate-100 dark:border-white/5 font-black text-emerald-500">${UIHelpers.fmtDate(h.fecha_entrega)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <footer class="p-8 border-t border-slate-100 dark:border-white/5 flex gap-4 bg-white dark:bg-black/30">
                    <button onclick="this.closest('.fixed').classList.add('hidden')" class="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-xl text-[10px] uppercase">Editar Filtro</button>
                    <button id="btn-final-s13" class="flex-[2] py-4 bg-emerald-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest">Imprimir Registro PDF</button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-final-s13').onclick = async () => {
                const { generateS13Report } = await import('./reports-generator.js');
                generateS13Report(history, from, to);
                modal.closest('.fixed').classList.add('hidden');
            };
        }, 'max-w-4xl');
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
