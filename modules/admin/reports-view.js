import { getTerritorios, getHistorialReport } from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';

export const renderReportsTab = async (container, config, appVersion) => {
    let _activeTab = 's13';
    let terrs = [];
    let history = [];

    const loadData = async () => {
        try {
            [terrs, history] = await Promise.all([getTerritorios(), getHistorialReport()]);
            terrs.sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }));
        } catch (e) {
            console.error("Error loading reports data:", e);
        }
    };

    const renderS13Tab = () => {
        const target = container.querySelector('#report-content-area');
        target.innerHTML = `
            <div class="modern-card p-10 space-y-8 animate-fade-in border-slate-100 dark:border-white/5 shadow-2xl">
                <div class="flex items-center gap-6 mb-4">
                    <div class="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-3xl text-emerald-600 shadow-inner">
                        <i class="fas fa-file-invoice"></i>
                    </div>
                    <div>
                        <h4 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Reporte S-13</h4>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Registro de Asignación de Territorio</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Desde</label>
                        <input type="date" id="s13-from" value="${new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner">
                    </div>
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Hasta</label>
                        <input type="date" id="s13-to" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner">
                    </div>
                </div>

                <div class="pt-6">
                    <button id="btn-print-s13" class="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-4">
                        <i class="fas fa-print"></i> Generar Reporte S-13 (PDF)
                    </button>
                    <p class="text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest mt-6 opacity-60">El reporte incluirá todos los registros históricos dentro del rango seleccionado.</p>
                </div>
            </div>
        `;

        target.querySelector('#btn-print-s13').onclick = async () => {
            const from = target.querySelector('#s13-from').value;
            const to = target.querySelector('#s13-to').value;
            const { generateS13Report } = await import('./reports-generator.js');
            generateS13Report(history, from, to);
        };
    };

    const renderS12Tab = () => {
        const target = container.querySelector('#report-content-area');
        target.innerHTML = `
            <div class="space-y-8 animate-fade-in">
                <!-- Selection Bar -->
                <div class="modern-card p-6 flex flex-col md:flex-row justify-between items-center gap-6 border-slate-100 dark:border-white/5 shadow-xl">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 text-xl shadow-inner">
                            <i class="fas fa-check-double"></i>
                        </div>
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Territorios Seleccionados</p>
                            <p id="selected-count" class="text-xl font-black text-slate-800 dark:text-white">0 / ${terrs.length}</p>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <button id="btn-sel-all" class="flex-1 md:flex-none px-6 py-3 bg-slate-100 dark:bg-white/5 text-slate-500 font-extrabold rounded-xl text-[9px] uppercase tracking-widest border border-slate-200 dark:border-white/10 hover:bg-slate-200 transition-all">Todos</button>
                        <button id="btn-sel-none" class="flex-1 md:flex-none px-6 py-3 bg-slate-100 dark:bg-white/5 text-slate-500 font-extrabold rounded-xl text-[9px] uppercase tracking-widest border border-slate-200 dark:border-white/10 hover:bg-slate-200 transition-all">Ninguno</button>
                    </div>
                </div>

                <!-- Layout Options -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${renderLayoutBtn(1, 'fas fa-stop', '1 por hoja')}
                    ${renderLayoutBtn(2, 'fas fa-columns', '2 por hoja')}
                    ${renderLayoutBtn(4, 'fas fa-th-large', '4 por hoja')}
                </div>

                <!-- Territories Grid for Selection -->
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" id="s12-selection-grid">
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
            target.querySelector('#selected-count').innerText = `${count} / ${terrs.length}`;
        };

        target.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.onchange = updateCount;
        });

        target.querySelector('#btn-sel-all').onclick = () => {
            target.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
            updateCount();
        };

        target.querySelector('#btn-sel-none').onclick = () => {
            target.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            updateCount();
        };

        target.querySelectorAll('.btn-print-layout').forEach(btn => {
            btn.onclick = async () => {
                const layout = parseInt(btn.dataset.layout);
                const selectedIds = Array.from(target.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
                if (selectedIds.length === 0) return showNotification("Seleccione al menos un territorio", "warning");

                const selectedTerrs = terrs.filter(t => selectedIds.includes(t.id));
                const { generateS12Report } = await import('./reports-generator.js');
                generateS12Report(selectedTerrs, layout);
            };
        });
    };

    const renderLayoutBtn = (num, icon, label) => `
        <button class="btn-print-layout modern-card !p-6 flex items-center justify-center gap-4 bg-white dark:bg-white/5 hover:bg-slate-900 hover:text-white dark:hover:bg-indigo-600 transition-all border border-slate-100 dark:border-white/10 group shadow-lg active:scale-95 flex-col" data-layout="${num}">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-slate-50 dark:bg-white/5 group-hover:bg-white/20 transition-all">
                <i class="${icon}"></i>
            </div>
            <div class="text-center">
                <p class="text-[10px] font-black uppercase tracking-widest">${label}</p>
                <p class="text-[8px] font-bold uppercase opacity-50 mt-1">Imprimir S-12</p>
            </div>
        </button>
    `;

    container.innerHTML = `
        <div class="animate-fade-in space-y-8 max-w-6xl mx-auto p-6 overflow-x-hidden">
            <nav class="flex items-center gap-3 p-1.5 bg-white/50 dark:bg-white/[0.03] backdrop-blur-xl rounded-[2rem] w-max border border-slate-200 dark:border-white/5 mx-auto transition-all shadow-sm">
                <button id="btn-show-s13" class="px-8 py-4 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all flex items-center gap-3 border border-transparent">
                    <i class="fas fa-chart-line"></i> Registro S-13
                </button>
                <button id="btn-show-s12" class="px-8 py-4 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all flex items-center gap-3 border border-transparent">
                    <i class="fas fa-id-card"></i> Tarjetas S-12
                </button>
            </nav>
            
            <div id="report-content-area" class="min-h-[50vh] transition-all"></div>
        </div>
    `;

    const loadReport = (type) => {
        _activeTab = type;
        container.querySelectorAll('nav button').forEach(btn => {
            const isActive = (btn.id === 'btn-show-s13' && type === 's13') || (btn.id === 'btn-show-s12' && type === 's12');
            btn.className = `px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${isActive ? 'bg-slate-900 dark:bg-white/10 text-white shadow-xl shadow-slate-900/20 md:scale-105 border-slate-800' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white border-transparent'}`;
        });

        if (type === 's13') renderS13Tab();
        else renderS12Tab();
    };

    container.querySelector('#btn-show-s13').onclick = () => loadReport('s13');
    container.querySelector('#btn-show-s12').onclick = () => loadReport('s12');

    await loadData();
    loadReport('s13');
};
