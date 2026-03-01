import { getTerritorios, getHistorialReport, getSessionSummaries } from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';
import { renderHistorialView } from './history-view.js';
import { UIHelpers, showModal } from '../services/ui-helpers.js';

export const renderReportsTab = async (container, config, appVersion) => {
    let _activeMainTab = 'historial'; // New main navigation
    let _activeReportSubTab = 's13'; // Sub-tab for printing section

    const renderMain = () => {
        container.innerHTML = `
            <div class="animate-fade-in space-y-8 max-w-7xl mx-auto p-4 md:p-6 overflow-x-hidden">
                <!-- Main Nav: Historial vs Reportes -->
                <nav class="flex flex-wrap items-center gap-3 p-2 bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl rounded-[2.2rem] w-max border border-slate-200 dark:border-white/5 mx-auto transition-all shadow-sm overflow-hidden">
                    <button id="main-btn-historial" class="px-10 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 border border-transparent">
                        <i class="fas fa-history"></i> Historial
                    </button>
                    <button id="main-btn-reportes" class="px-10 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 border border-transparent">
                        <i class="fas fa-print"></i> S-12/S-13
                    </button>
                    <button id="main-btn-telefonia" class="px-10 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 border border-transparent">
                        <i class="fas fa-phone-alt"></i> Telefonía
                    </button>
                </nav>
                
                <div id="main-report-content" class="min-h-[60vh] transition-all"></div>
            </div>
        `;

        const updateNav = () => {
            const hBtn = container.querySelector('#main-btn-historial');
            const rBtn = container.querySelector('#main-btn-reportes');
            const tBtn = container.querySelector('#main-btn-telefonia');

            [hBtn, rBtn, tBtn].forEach(btn => {
                const isActive = (btn.id === 'main-btn-historial' && _activeMainTab === 'historial') ||
                    (btn.id === 'main-btn-reportes' && _activeMainTab === 'reportes') ||
                    (btn.id === 'main-btn-telefonia' && _activeMainTab === 'telefonia');
                btn.className = `px-10 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${isActive ? 'bg-slate-900 dark:bg-white/10 text-white shadow-xl shadow-slate-900/20 md:scale-105' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`;
            });
        };

        container.querySelector('#main-btn-historial').onclick = () => { _activeMainTab = 'historial'; updateNav(); renderHistorialSection(); };
        container.querySelector('#main-btn-reportes').onclick = () => { _activeMainTab = 'reportes'; updateNav(); renderReportesSection(); };
        container.querySelector('#main-btn-telefonia').onclick = () => { _activeMainTab = 'telefonia'; updateNav(); renderTelefoniaSection(); };

        updateNav();
        if (_activeMainTab === 'historial') renderHistorialSection();
        else if (_activeMainTab === 'reportes') renderReportesSection();
        else renderTelefoniaSection();
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
            <div class="space-y-8 animate-fade-in max-w-4xl mx-auto">
                <div class="modern-card p-10 space-y-8 border-slate-100 dark:border-white/5 shadow-2xl relative overflow-hidden">
                    <div class="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/5 rotate-12 rounded-[3rem] pointer-events-none"></div>
                    
                    <div class="flex items-center gap-6 mb-4">
                        <div class="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-3xl text-emerald-600 shadow-inner">
                            <i class="fas fa-file-invoice"></i>
                        </div>
                        <div>
                            <h4 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Reporte S-13 de Actividad</h4>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Registro Oficial de Territorios</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Desde</label>
                            <input type="date" id="print-s13-from" value="${new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-inner">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Hasta</label>
                            <input type="date" id="print-s13-to" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-inner">
                        </div>
                    </div>

                    <div class="flex justify-center pt-4">
                        <button id="btn-do-print-s13" class="px-16 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-4">
                            <i class="fas fa-magic"></i> Generar
                        </button>
                    </div>
                </div>

                <!-- Preview Area -->
                <div id="s13-preview-results" class="hidden animate-fade-in space-y-6 pb-20">
                    <div class="flex items-center justify-between px-6">
                        <div class="flex flex-col">
                            <h5 class="text-sm font-black text-slate-700 dark:text-gray-300 uppercase tracking-[0.3em]">Vista Previa</h5>
                            <p id="s13-preview-count" class="text-[9px] text-emerald-500 font-black uppercase mt-1">0 registros detectados</p>
                        </div>
                        <button id="btn-export-s13-pdf" class="flex items-center gap-3 px-8 py-4 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:scale-[1.02] transition-all shadow-xl shadow-rose-500/20 active:scale-95">
                            <i class="fas fa-file-pdf text-lg"></i> Descargar PDF
                        </button>
                    </div>
                    <div id="s13-preview-table-container" class="modern-card !p-8 border-slate-100 dark:border-white/5 shadow-2xl bg-white dark:bg-[#0a0f18] min-h-[400px]">
                        <!-- Table rendered here -->
                    </div>
                </div>
            </div>
        `;

        target.querySelector('#btn-do-print-s13').onclick = async () => {
            const from = target.querySelector('#print-s13-from').value;
            const to = target.querySelector('#print-s13-to').value;

            // Filter logic
            const filtered = history.filter(h => {
                const date = h.fecha_entrega || h.timestamp;
                if (!date) return false;
                const d = UIHelpers.formatDateId(date);
                const isSuccess = h.estado === 'Completado' || h.estado === 'Predicado';
                return isSuccess && d >= from && d <= to;
            });

            if (filtered.length === 0) {
                showNotification("No hay registros en ese rango de fechas", "warning");
                return;
            }

            const resultsArea = target.querySelector('#s13-preview-results');
            const countLabel = target.querySelector('#s13-preview-count');
            const tableContainer = target.querySelector('#s13-preview-table-container');

            resultsArea.classList.remove('hidden');
            countLabel.innerText = `${filtered.length} REGISTROS DETECTADOS`;

            tableContainer.innerHTML = `
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left border-separate border-spacing-y-2">
                        <thead>
                            <tr class="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <th class="px-6 pb-4">Territorio</th>
                                <th class="px-6 pb-4">Conductor / Publicador</th>
                                <th class="px-6 pb-4">Fecha Asig.</th>
                                <th class="px-6 pb-4">Fecha Entr.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(h => `
                                <tr class="bg-slate-50 dark:bg-white/[0.03] text-[11px] font-bold text-slate-700 dark:text-gray-300 shadow-sm transition-all hover:bg-white dark:hover:bg-white/10">
                                    <td class="px-6 py-4 rounded-l-2xl border-y border-l border-slate-200/50 dark:border-white/5">
                                        <span class="w-10 h-10 flex items-center justify-center bg-emerald-500/10 text-emerald-600 rounded-xl font-black">#${h.numero}</span>
                                    </td>
                                    <td class="px-6 py-4 border-y border-slate-200/50 dark:border-white/5 uppercase tracking-tight">${h.conductor || '—'}</td>
                                    <td class="px-6 py-4 border-y border-slate-200/50 dark:border-white/5 opacity-60">${UIHelpers.fmtDate(h.fecha_asignacion)}</td>
                                    <td class="px-6 py-4 rounded-r-2xl border-y border-r border-slate-200/50 dark:border-white/5 font-black text-emerald-500">
                                        <div class="flex items-center gap-2">
                                            <i class="fas fa-check-circle"></i>
                                            ${UIHelpers.fmtDate(h.fecha_entrega)}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            target.querySelector('#btn-export-s13-pdf').onclick = async () => {
                const { generateS13Report } = await import('./reports-generator.js');
                generateS13Report(history, from, to);
            };

            resultsArea.scrollIntoView({ behavior: 'smooth' });
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

    const renderTelefoniaSection = async () => {
        const target = container.querySelector('#main-report-content');
        target.innerHTML = `<div class="py-20 text-center opacity-30"><i class="fas fa-circle-notch fa-spin text-3xl"></i></div>`;

        try {
            const summaries = await getSessionSummaries();

            // Xolvy Intelligence: Weekly Grouping logic
            const today = new Date();
            const getWeekNumber = (d) => {
                const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
                const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
                return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
            };

            const currentWeek = getWeekNumber(today);

            target.innerHTML = `
                <div class="space-y-8 animate-fade-in max-w-5xl mx-auto">
                    <div class="flex justify-between items-center bg-white dark:bg-white/5 p-8 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm">
                        <div class="flex items-center gap-6">
                            <div class="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-2xl text-indigo-500 shadow-inner">
                                <i class="fas fa-file-invoice"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Reportes de Telefonía</h3>
                                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Sesiones agrupadas por semana</p>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-12 pb-20">
                        ${summaries.length === 0 ? `
                            <div class="py-20 text-center opacity-30">
                                <i class="fas fa-folder-open text-4xl mb-4"></i>
                                <p class="text-[10px] font-black uppercase tracking-widest">No hay reportes registrados</p>
                            </div>
                        ` : (() => {
                    const thisWeek = summaries.filter(s => getWeekNumber(s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.fecha)) === currentWeek);
                    const older = summaries.filter(s => getWeekNumber(s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.fecha)) !== currentWeek);

                    const renderList = (list) => list.map(s => {
                        const date = s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.fecha || Date.now());
                        return `
                                    <div class="modern-card p-6 bg-white dark:bg-white/[0.03] border-slate-100 dark:border-white/5 hover:border-primary/30 transition-all group shadow-sm">
                                        <div class="flex flex-col md:flex-row justify-between gap-6">
                                            <div class="flex items-start gap-4">
                                                <div class="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0">
                                                    <i class="fas fa-user-circle text-xl"></i>
                                                </div>
                                                <div>
                                                    <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">${s.conductor_id || 'Conductor Desconocido'}</h4>
                                                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                        ${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • 
                                                        ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div class="flex flex-wrap items-center gap-2">
                                                <div class="px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-500/10">
                                                    ${s.total} Registros
                                                </div>
                                                <button onclick="window.viewSessionDetail('${s.id}')" class="px-5 py-2 bg-slate-900 dark:bg-white/10 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10">
                                                    Ver Detalles
                                                </button>
                                            </div>
                                        </div>
                                        ${s.notas ? `<div class="mt-4 p-4 bg-slate-100/50 dark:bg-black/20 rounded-xl border border-dashed border-slate-200 dark:border-white/5"><p class="text-[10px] text-slate-500 dark:text-slate-400 italic">"${s.notas}"</p></div>` : ''}
                                    </div>
                                `;
                    }).join('');

                    return `
                                ${thisWeek.length > 0 ? `
                                    <div class="space-y-4">
                                        <div class="flex items-center gap-4 px-4 font-black">
                                            <span class="text-[10px] text-primary uppercase tracking-[0.3em]">Esta Semana</span>
                                            <div class="h-px bg-primary/20 flex-1"></div>
                                        </div>
                                        ${renderList(thisWeek)}
                                    </div>
                                ` : ''}
                                ${older.length > 0 ? `
                                    <div class="space-y-4">
                                        <div class="flex items-center gap-4 px-4 font-black">
                                            <span class="text-[10px] text-slate-400 uppercase tracking-[0.3em]">Anteriores</span>
                                            <div class="h-px bg-slate-200 dark:bg-white/10 flex-1"></div>
                                        </div>
                                        ${renderList(older)}
                                    </div>
                                ` : ''}
                            `;
                })()}
                    </div>
                </div>
            `;

            window.viewSessionDetail = (sid) => {
                const s = summaries.find(x => x.id === sid);
                if (!s) return;

                const statsHTML = Object.entries(s.stats || {})
                    .filter(([key, val]) => val > 0 && key)
                    .map(([key, val]) => `
                        <div class="p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col items-center text-center">
                            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">${key}</p>
                            <p class="text-2xl font-black text-slate-800 dark:text-white tabular-nums">${val}</p>
                        </div>
                    `).join('');

                window.showModal(`
                    <div class="p-8 space-y-8 bg-white dark:bg-[#0b0e14] rounded-[2.5rem] max-w-lg w-full">
                        <div class="flex items-center gap-6">
                            <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-3xl text-primary shadow-inner">
                                <i class="fas fa-clipboard-check"></i>
                            </div>
                            <div class="flex-1">
                                <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Resumen de Sesión</h3>
                                <p class="text-[8px] text-primary font-black uppercase tracking-[0.3em] mt-1">${s.conductor_id}</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            ${statsHTML}
                        </div>

                        ${s.notas ? `
                            <div class="space-y-3">
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas del Conductor</p>
                                <div class="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                                    <p class="text-xs text-slate-600 dark:text-gray-300 leading-relaxed font-medium">"${s.notas}"</p>
                                </div>
                            </div>
                        ` : ''}

                        <button onclick="window.closeModal()" class="w-full py-5 bg-slate-900 dark:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95">
                            Entendido
                        </button>
                    </div>
                `, null, 'max-w-xl');
            };

        } catch (e) {
            console.error(e);
            target.innerHTML = `<div class="py-20 text-center text-rose-500 font-bold">Error al cargar reportes</div>`;
        }
    };

    renderMain();
};

