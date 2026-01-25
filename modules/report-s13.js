import { getHistorialReport, rebuildHistoryFromSchedule, getConfiguracion, getTerritorios, runSystemDiagnosticsAndRepair } from '../data/firestore-services.js?v=2.2.3';
import { showNotification, generatePlainXLS } from './utils/helpers.js?v=2.2.3';
import { S13Exporter } from './services/s13-exporter.js?v=2.2.3';

export const renderS13CommandCenter = async (container) => {
    const [history, config, territories] = await Promise.all([
        getHistorialReport(),
        getConfiguracion(),
        getTerritorios()
    ]);

    let activeView = 'management';

    // --- Metric Calculations ---
    const touchedNums = new Set(history.map(h => String(h.numero)));
    const totalT = territories.length;
    const coveragePercent = totalT > 0 ? Math.round((touchedNums.size / totalT) * 100) : 0;
    const missingCount = territories.filter(t => !touchedNums.has(String(t.numero))).length;

    const territoryFreq = {};
    history.forEach(h => {
        if (!h.numero) return;
        territoryFreq[h.numero] = (territoryFreq[h.numero] || 0) + 1;
    });
    const mostFreqSorted = Object.entries(territoryFreq).sort((a, b) => b[1] - a[1]);
    const topTerritory = mostFreqSorted[0]?.[0] || '--';
    const topCount = mostFreqSorted[0]?.[1] || 0;

    const latestTouch = {};
    history.forEach(h => {
        const d = h.fecha_entrega || h.fecha_asignacion;
        if (!d) return;
        if (!latestTouch[h.numero] || new Date(d) > new Date(latestTouch[h.numero])) {
            latestTouch[h.numero] = d;
        }
    });

    const rezagoSorted = territories.filter(t => latestTouch[t.numero]).sort((a, b) => new Date(latestTouch[a.numero]) - new Date(latestTouch[b.numero]));
    const oldestTerritory = rezagoSorted[0]?.numero || '--';
    const daysRezago = rezagoSorted[0] ? Math.floor((new Date() - new Date(latestTouch[rezagoSorted[0].numero])) / (1000 * 60 * 60 * 24)) : 0;

    container.innerHTML = `
        <div class="space-y-8 animate-fade-in">
            <!--Stats Dashboard-->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- Cobertura -->
                <div class="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-500/20 group relative overflow-hidden transition-all hover:scale-[1.02]">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                    <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-2">Cobertura Global</p>
                    <p class="text-4xl font-black tabular-nums">${coveragePercent}%</p>
                    <div class="flex items-center gap-2 mt-4 text-[9px] font-bold uppercase tracking-widest opacity-60">
                         <i class="fas fa-chart-pie"></i> ${touchedNums.size} de ${totalT} abarcados
                    </div>
                </div>
                
                <!-- Faltantes -->
                <div class="bg-white dark:bg-white/5 p-8 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:scale-[1.02]">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Territorios Faltantes</p>
                    <p class="text-4xl font-black text-red-500 tabular-nums">${missingCount}</p>
                    <div class="flex items-center gap-3 mt-4">
                        <div class="flex-1 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full bg-red-500 rounded-full" style="width: ${100 - coveragePercent}%"></div>
                        </div>
                        <span class="text-[10px] font-black text-red-500 uppercase">Faltan</span>
                    </div>
                </div>

                <!-- Uso Frecuente -->
                <div class="bg-white dark:bg-white/5 p-8 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:scale-[1.02]">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Uso Frecuente</p>
                    <p class="text-2xl font-black text-slate-800 dark:text-white truncate">Territorio ${topTerritory}</p>
                    <div class="flex items-center gap-2 mt-4 text-[9px] text-indigo-500 font-bold uppercase tracking-widest">
                        <i class="fas fa-redo-alt"></i> Asignado ${topCount} ${topCount === 1 ? 'vez' : 'veces'}
                    </div>
                </div>

                <!-- Rezago -->
                <div class="bg-white dark:bg-white/5 p-8 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all hover:scale-[1.02]">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Mayor Rezago</p>
                    <p class="text-2xl font-black text-orange-600 truncate">#${oldestTerritory}</p>
                    <div class="flex items-center gap-2 mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        <i class="fas fa-history"></i> Hace ${daysRezago} días
                    </div>
                </div>
            </div>

            <!--Unified Control Bar-->
            <div class="modern-card !p-6 flex flex-col lg:flex-row items-center gap-6 border-slate-200 dark:border-white/5 shadow-2xl">
                <!-- Left: Date Filters -->
                <div class="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Año</label>
                        <select id="report-year-select" class="bg-white dark:bg-slate-800 border-none rounded-xl px-4 p-2 text-xs font-bold outline-none text-slate-700 dark:text-white shadow-sm cursor-pointer">
                             <!-- Year options -->
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Desde</label>
                        <input type="date" id="report-start" class="bg-white dark:bg-slate-800 border-none rounded-xl px-4 p-2 text-xs font-bold outline-none text-slate-700 dark:text-white shadow-sm">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Hasta</label>
                        <input type="date" id="report-end" class="bg-white dark:bg-slate-800 border-none rounded-xl px-4 p-2 text-xs font-bold outline-none text-slate-700 dark:text-white shadow-sm">
                    </div>
                </div>

                <!-- Center: Universal Search -->
                <div class="relative flex-1 group min-w-[200px] w-full lg:w-auto">
                    <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">
                        <i class="fas fa-search"></i>
                    </span>
                    <input type="text" id="cc-universal-search" placeholder="Búsqueda global (Conductor, #, Estado)..." class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-4 text-xs font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white placeholder:text-slate-400">
                </div>

                <!-- Right: Actions -->
                <div class="flex items-center gap-3">
                    <button id="cc-btn-generate" class="bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-3 whitespace-nowrap">
                        <i class="fas fa-file-invoice"></i> Generar Reporte
                    </button>
                    <div class="h-10 w-px bg-slate-200 dark:bg-white/10 mx-2"></div>
                    <button id="cc-btn-tools" class="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all border border-slate-200 dark:border-white/5" title="Herramientas Avanzadas">
                        <i class="fas fa-tools"></i>
                    </button>
                </div>
            </div>

            <!--View Toggle & Sub-Content-->
                    <div class="space-y-6">
                        <nav class="flex gap-2 p-1.5 bg-slate-100 dark:bg-white/5 w-fit rounded-2xl border border-slate-200 dark:border-white/5">
                            <button class="cc-view-btn px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 whitespace-nowrap" data-view="management">
                                <i class="fas fa-database"></i> Gestión de Historial
                            </button>
                            <button class="cc-view-btn px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 whitespace-nowrap" data-view="s13">
                                <i class="fas fa-list-alt"></i> Reporte S-13
                            </button>
                        </nav>

                        <div id="cc-main-container" class="min-h-[600px] modern-card !p-0 overflow-hidden border-slate-100 dark:border-white/5">
                            <!-- Dynamic View Content -->
                        </div>
                    </div>
        </div>
    `;

    // Initialize Year Selector
    const yearSelect = container.querySelector('#report-year-select');
    const startInput = container.querySelector('#report-start');
    const endInput = container.querySelector('#report-end');

    const now = new Date();
    const serviceYear = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
    for (let y = serviceYear - 5; y <= serviceYear + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === serviceYear) opt.selected = true;
        opt.className = "dark:bg-slate-800 text-slate-800 dark:text-white";
        yearSelect.appendChild(opt);
    }

    const setDatesFromSY = (sy) => {
        const y = parseInt(sy);
        const start = `${y - 1}-09-01`;
        const end = `${y}-08-31`;
        if (startInput) startInput.value = start;
        if (endInput) endInput.value = end;
    };
    setDatesFromSY(serviceYear);
    if (yearSelect) yearSelect.onchange = (e) => setDatesFromSY(e.target.value);

    // View Loading Logic
    const loadView = async (view) => {
        activeView = view;
        const mainCont = container.querySelector('#cc-main-container');
        if (!mainCont) return;

        window.dispatchModuleSync = () => {
            loadView(view);
        };

        mainCont.innerHTML = `
            <div class="flex flex-col items-center justify-center p-40 gap-4 animate-pulse">
                <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p class="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Preparando vista inteligente...</p>
            </div>`;

        // Update Buttons Styling
        container.querySelectorAll('.cc-view-btn').forEach(btn => {
            const isActive = btn.dataset.view === view;
            btn.classList.toggle('active', isActive);

            if (isActive) {
                btn.className = "cc-view-btn active px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 bg-slate-900 dark:bg-white/10 text-white shadow-xl whitespace-nowrap";
            } else {
                btn.className = "cc-view-btn px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-primary whitespace-nowrap";
            }
        });

        if (view === 's13') {
            await renderHistoryTab(mainCont, {
                showHeader: false,
                startInput: startInput,
                endInput: endInput
            });
            const genBtn = container.querySelector('#cc-btn-generate');
            if (genBtn) {
                genBtn.innerHTML = '<i class="fas fa-file-invoice"></i> Generar Reporte';
                genBtn.onclick = () => document.getElementById('btn-generate-report')?.click();
            }
        } else {
            await renderAdvancedHistoryView(mainCont, {
                showHeader: false,
                searchInputId: 'cc-universal-search'
            });
            const genBtn = container.querySelector('#cc-btn-generate');
            if (genBtn) {
                genBtn.innerHTML = '<i class="fas fa-bolt-lightning"></i> Power Sync Global';
                genBtn.onclick = async () => {
                    const innerCont = container.querySelector('#cc-main-container');
                    innerCont.innerHTML = `
                        <div class="flex flex-col items-center justify-center p-32 gap-10 animate-fade-in">
                            <div class="relative w-32 h-32">
                                <svg class="w-full h-full -rotate-90">
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" stroke-width="8" fill="transparent" class="text-slate-100 dark:text-white/5" />
                                    <circle id="diag-progress-circle" cx="64" cy="64" r="58" stroke="currentColor" stroke-width="8" fill="transparent" stroke-dasharray="364.42" stroke-dashoffset="364.42" class="text-primary transition-all duration-500 stroke-round" />
                                </svg>
                                <div id="diag-pc" class="absolute inset-0 flex items-center justify-center text-xl font-black text-slate-800 dark:text-white">0%</div>
                            </div>
                            <div class="text-center space-y-4 max-w-sm">
                                 <div class="bg-primary/10 text-primary text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] inline-block mb-2">Power Up: Sincronización</div>
                                 <h4 class="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white">Optimizando Base de Datos</h4>
                                 <p id="diag-msg" class="text-[11px] font-bold text-slate-400 leading-relaxed">Iniciando protocolo de diagnóstico profundo...</p>
                            </div>
                        </div>`;

                    const circle = innerCont.querySelector('#diag-progress-circle');
                    const pcText = innerCont.querySelector('#diag-pc');
                    const msgText = innerCont.querySelector('#diag-msg');
                    const circumference = 364.42;

                    const report = await runSystemDiagnosticsAndRepair((msg, pc) => {
                        if (pcText) pcText.textContent = `${pc}%`;
                        if (msgText) msgText.textContent = msg;
                        if (circle) {
                            const offset = circumference - (pc / 100) * circumference;
                            circle.style.strokeDashoffset = offset;
                        }
                    });

                    // Results Modal
                    showModal(`
                        <div class="p-10 space-y-8 animate-fade-in">
                            <header class="flex items-center gap-6 border-b border-slate-100 dark:border-white/5 pb-8">
                                <div class="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center text-2xl shadow-inner">
                                    <i class="fas fa-check-double"></i>
                                </div>
                                <div>
                                    <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Optimización Exitosa</h3>
                                    <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Resultados del Diagnóstico</p>
                                </div>
                            </header>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border border-slate-200 dark:border-white/5 text-center">
                                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">S13</p>
                                    <p class="text-2xl font-black text-slate-800 dark:text-white">${report.rebuiltHistory}</p>
                                </div>
                                <div class="bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border border-slate-200 dark:border-white/5 text-center">
                                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ajustes</p>
                                    <p class="text-2xl font-black text-slate-800 dark:text-white">${report.fixedTerritories}</p>
                                </div>
                            </div>
                            <button onclick="closeModal(); renderS13CommandCenter(document.getElementById('cc-main-container').parentElement.parentElement)" class="w-full bg-primary text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest">Finalizar</button>
                        </div>
                    `);
                    renderS13CommandCenter(container);
                };
            }
        }
    };

    container.querySelectorAll('.cc-view-btn').forEach(btn => {
        btn.onclick = () => loadView(btn.dataset.view);
    });

    const toolBtn = container.querySelector('#cc-btn-tools');
    if (toolBtn) {
        toolBtn.onclick = () => {
            showModal(`
                <div class="p-8 space-y-6">
                    <h3 class="text-xl font-black uppercase">Mantenimiento Global</h3>
                    <button id="tool-rebuild" class="w-full text-left p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200">Reconstruir Historial</button>
                </div>
            `, (modal) => {
                modal.querySelector('#tool-rebuild').onclick = () => {
                    modal.classList.add('hidden');
                    document.getElementById('btn-rebuild-history')?.click();
                };
            });
        };
    }

    loadView('management');
};


export const renderAdvancedHistoryView = async (container, options = {}) => {
    const history = await getHistorialReport();
    const config = await getConfiguracion();
    const territories = await getTerritorios();

    // Set sync global for admin actions
    window.dispatchModuleSync = () => {
        renderAdvancedHistoryView(container, options);
    };

    // Flatten history: one row per territory number
    const flatHistory = [];
    history.forEach(item => {
        if (!item.numero) return;
        const nums = item.numero.toString().split(/[,;]/).map(n => n.trim()).filter(n => n);
        nums.forEach(num => {
            flatHistory.push({
                ...item,
                numero: num // Virtual override for display
            });
        });
    });

    let filteredHistory = [...flatHistory].sort((a, b) => new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0));
    let currentPage = 1;
    const itemsPerPage = 20;

    const render = () => {
        // --- Metric Calculations (Sync with Dashboard Logic) ---
        const touchedNums = new Set(history.map(h => String(h.numero)));
        const totalT = territories.length;
        const coveragePercent = totalT > 0 ? Math.round((touchedNums.size / totalT) * 100) : 0;
        const missingCount = territories.filter(t => !touchedNums.has(String(t.numero))).length;

        const territoryFreq = {};
        history.forEach(h => {
            if (!h.numero) return;
            territoryFreq[h.numero] = (territoryFreq[h.numero] || 0) + 1;
        });
        const mostFreqSorted = Object.entries(territoryFreq).sort((a, b) => b[1] - a[1]);
        const topTerritory = mostFreqSorted[0]?.[0] || '--';
        const topCount = mostFreqSorted[0]?.[1] || 0;

        const latestTouch = {};
        history.forEach(h => {
            const d = h.fecha_entrega || h.fecha_asignacion;
            if (!d) return;
            if (!latestTouch[h.numero] || new Date(d) > new Date(latestTouch[h.numero])) {
                latestTouch[h.numero] = d;
            }
        });

        const rezagoSorted = territories.filter(t => latestTouch[t.numero]).sort((a, b) => new Date(latestTouch[a.numero]) - new Date(latestTouch[b.numero]));
        const oldestTerritory = rezagoSorted[0]?.numero || '--';
        const daysRezago = rezagoSorted[0] ? Math.floor((new Date() - new Date(latestTouch[rezagoSorted[0].numero])) / (1000 * 60 * 60 * 24)) : 0;

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = filteredHistory.slice(start, end);
        const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

        container.innerHTML = `
            <div class="space-y-8 animate-fade-in">
                <!-- Metrics Header (Consolidated) -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="bg-gradient-to-br from-primary to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-primary/20 group relative overflow-hidden transition-all hover:scale-[1.02]">
                        <div class="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                        <p class="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-2">Cobertura Global</p>
                        <p class="text-4xl font-black tabular-nums">${coveragePercent}%</p>
                        <div class="flex items-center gap-2 mt-4 text-[9px] font-bold uppercase tracking-widest opacity-60">
                             <i class="fas fa-chart-pie"></i> ${touchedNums.size} de ${totalT} abarcados
                        </div>
                    </div>
                    
                    <div class="bg-white dark:bg-white/[0.03] p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-xl transition-all hover:scale-[1.02]">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Faltantes</p>
                        <p class="text-4xl font-black text-rose-500 tabular-nums">${missingCount}</p>
                        <div class="flex items-center gap-3 mt-4">
                            <div class="flex-1 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                <div class="h-full bg-rose-500 rounded-full" style="width: ${100 - coveragePercent}%"></div>
                            </div>
                            <span class="text-[9px] font-black text-rose-500 uppercase tracking-widest">En espera</span>
                        </div>
                    </div>

                    <div class="bg-white dark:bg-white/[0.03] p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-xl transition-all hover:scale-[1.02]">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Uso Frecuente</p>
                        <p class="text-2xl font-black text-slate-800 dark:text-white truncate">Territorio ${topTerritory}</p>
                        <div class="flex items-center gap-2 mt-4 text-[9px] text-primary font-bold uppercase tracking-widest">
                            <i class="fas fa-redo-alt"></i> Asignado ${topCount} ${topCount === 1 ? 'vez' : 'veces'}
                        </div>
                    </div>

                    <div class="bg-white dark:bg-white/[0.03] p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-xl transition-all hover:scale-[1.02]">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Mayor Rezago</p>
                        <p class="text-2xl font-black text-orange-600 truncate">#${oldestTerritory}</p>
                        <div class="flex items-center gap-2 mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                            <i class="fas fa-history"></i> Hace ${daysRezago} días
                        </div>
                    </div>
                </div>

                <div class="flex flex-col h-full bg-white dark:bg-black/20 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-white/5 shadow-2xl">
                <div class="overflow-x-auto custom-scrollbar-horizontal px-6 pt-6">
                    <table class="w-full text-left border-separate border-spacing-y-4">
                        <thead>
                            <tr class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
                                <th class="px-8 pb-4">Territorio</th>
                                <th class="px-8 pb-4">Conductor / Asignado</th>
                                <th class="px-8 pb-4">Periodo Activo</th>
                                <th class="px-8 pb-4">Estado</th>
                                <th class="px-8 pb-4 text-right">Trazabilidad</th>
                            </tr>
                        </thead>
                        <tbody class="font-bold">
                            ${pageItems.map(h => {
            const getStatusStyles = (status) => {
                switch (status) {
                    case 'Completado': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                    case 'Pendiente': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
                    case 'Cancelado': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
                    case 'Asignado': return 'bg-primary/10 text-primary border-primary/20';
                    default: return 'bg-slate-50 text-slate-400 border-slate-200';
                }
            };
            const terr = territories.find(t => String(t.numero) === String(h.numero));
            return `
                                    <tr class="group bg-white dark:bg-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all duration-300 shadow-sm rounded-[2rem]">
                                        <td class="px-8 py-5 first:rounded-l-[1.5rem] last:rounded-r-[1.5rem] border-y border-l border-slate-100 dark:border-white/5">
                                            <div class="flex items-center gap-5">
                                                <div class="w-12 h-12 rounded-2xl bg-slate-900 text-white dark:bg-white/10 flex items-center justify-center font-black text-lg shadow-lg group-hover:scale-110 transition-transform">
                                                    ${h.numero}
                                                </div>
                                                <div class="flex flex-col">
                                                    <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-60">Ubicación</span>
                                                    <span class="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-white truncate max-w-[150px]">${terr?.localidad || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-8 py-5 border-y border-slate-100 dark:border-white/5">
                                            <div class="flex flex-col">
                                                <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-60 mb-1">Responsable</span>
                                                <span class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">${h.conductor}</span>
                                            </div>
                                        </td>
                                        <td class="px-8 py-5 border-y border-slate-100 dark:border-white/5 whitespace-nowrap">
                                            <div class="flex items-center gap-3">
                                                <div class="px-3 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                                                    ${h.fecha_asignacion ? new Date(h.fecha_asignacion).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                                                </div>
                                                <i class="fas fa-chevron-right text-[8px] text-slate-300"></i>
                                                <div class="px-3 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                                                    ${h.fecha_entrega ? new Date(h.fecha_entrega).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : (h.estado === 'Pendiente' || h.estado === 'Asignado' ? '<span class="text-primary">—</span>' : '—')}
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-8 py-5 border-y border-slate-100 dark:border-white/5">
                                            <span class="px-4 py-2 rounded-xl border-2 text-[8px] font-black uppercase tracking-[0.2em] shadow-sm ${getStatusStyles(h.estado)}">
                                                ${h.estado}
                                            </span>
                                        </td>
                                        <td class="px-8 py-5 border-y border-r border-slate-100 dark:border-white/5 text-right first:rounded-l-[1.5rem] last:rounded-r-[1.5rem]">
                                            <div class="flex justify-end gap-3 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                                <button onclick="window.editHistoryRecord('${h.id}')" class="w-10 h-10 flex items-center justify-center bg-white dark:bg-white/10 text-slate-600 dark:text-white hover:bg-primary hover:text-white rounded-[1rem] border border-slate-200 dark:border-white/10 shadow-xl transition-all active:scale-90" title="Editar Registro">
                                                    <i class="fas fa-edit text-xs"></i>
                                                </button>
                                                <button onclick="window.deleteHistoryRecordUI('${h.id}', '${h.conductor}', '${h.numero}')" class="w-10 h-10 flex items-center justify-center bg-white dark:bg-white/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-[1rem] border border-slate-200 dark:border-white/10 shadow-xl transition-all active:scale-90" title="Eliminar">
                                                    <i class="fas fa-trash-alt text-xs"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Footer / Paging -->
                <div class="p-8 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-primary text-xs shadow-inner">
                            <i class="fas fa-list-ul"></i>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Mostrando registros</p>
                            <p class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tighter">${start + 1}-${Math.min(end, filteredHistory.length)} de ${filteredHistory.length} totales</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-4">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Pág. ${currentPage} / ${totalPages}</span>
                        <div class="flex gap-2">
                            <button id="prev-page" class="w-12 h-12 flex items-center justify-center rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-primary disabled:opacity-30 transition-all shadow-xl hover:-translate-y-1" ${currentPage === 1 ? 'disabled' : ''}>
                                <i class="fas fa-chevron-left text-xs"></i>
                            </button>
                            <button id="next-page" class="w-12 h-12 flex items-center justify-center rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-primary disabled:opacity-30 transition-all shadow-xl hover:-translate-y-1" ${currentPage === totalPages ? 'disabled' : ''}>
                                <i class="fas fa-chevron-right text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (options.searchInputId) {
            const s = document.getElementById(options.searchInputId);
            if (s) s.oninput = (e) => {
                const q = e.target.value.toLowerCase();
                filteredHistory = flatHistory.filter(h =>
                    h.conductor.toLowerCase().includes(q) ||
                    String(h.numero).includes(q) ||
                    h.estado.toLowerCase().includes(q)
                );
                currentPage = 1;
                render();
            };
        }

        const prevBtn = container.querySelector('#prev-page');
        if (prevBtn) prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; render(); } };
        const nextBtn = container.querySelector('#next-page');
        if (nextBtn) nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; render(); } };
    };

    render();
};


export const renderHistoryTab = (container, options = {}) => {
    const showHeader = options.showHeader !== false;

    container.innerHTML = `
        <div class="h-full flex flex-col gap-6 animate-fade-in relative">
            ${showHeader ? `
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-slate-100 dark:border-white/5 pb-8">
                <div class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-3xl text-primary shadow-inner border border-primary/10 animate-float">
                        <i class="fas fa-file-invoice"></i>
                    </div>
                    <div>
                        <h2 class="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                            Gestión y Reportes
                        </h2>
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1 opacity-70">
                            Registro Oficial de Asignaciones
                        </p>
                    </div>
                </div>
                <div class="flex flex-wrap items-end gap-3 bg-slate-50 dark:bg-white/[0.02] p-5 rounded-3xl border border-slate-100 dark:border-white/5 shadow-inner">
                    <div class="space-y-2">
                         <label class="block text-[10px] uppercase text-slate-400 font-black tracking-widest ml-1">Año Servicio</label>
                         <select id="report-year-select" class="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:border-primary outline-none font-black uppercase tracking-widest cursor-pointer shadow-sm">
                         </select>
                    </div>
                    <div class="space-y-2">
                        <label class="block text-[10px] uppercase text-slate-400 font-black tracking-widest ml-1">Desde</label>
                        <input type="date" id="report-start" class="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:border-primary outline-none font-black shadow-sm uppercase">
                    </div>
                     <div class="space-y-2">
                        <label class="block text-[10px] uppercase text-slate-400 font-black tracking-widest ml-1">Hasta</label>
                        <input type="date" id="report-end" class="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:border-primary outline-none font-black shadow-sm uppercase">
                    </div>
                    <button id="btn-generate-report" class="bg-primary hover:bg-primary-light text-white px-8 py-3 rounded-xl shadow-xl shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all h-fit self-end active:scale-95 flex items-center gap-2">
                        <i class="fas fa-magic"></i> Generar
                    </button>
                    <button id="btn-export-s13-pdf" class="hidden bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl shadow-xl shadow-rose-500/20 text-[10px] font-black uppercase tracking-widest transition-all h-fit self-end flex items-center gap-3 active:scale-95">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                    <button id="btn-export-s13-excel" class="hidden bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-xl shadow-emerald-500/20 text-[10px] font-black uppercase tracking-widest transition-all h-fit self-end flex items-center gap-3 active:scale-95">
                        <i class="fas fa-file-excel"></i> EXCEL
                    </button>
                    <!-- Tools -->
                    <button id="btn-rebuild-history" class="w-12 h-12 bg-slate-200/50 dark:bg-white/5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all h-fit self-end flex items-center justify-center border border-transparent hover:border-primary/20" title="Recuperar historial desde Programa Semanal">
                        <i class="fas fa-wrench"></i>
                    </button>
                </div>
            </header>
            ` : ''}

            <div id="report-preview" class="flex-1 overflow-auto bg-slate-50 dark:bg-black/20 rounded-[2.5rem] border border-slate-100 dark:border-white/5 p-4 sm:p-12 flex flex-col items-center gap-10 relative min-h-[600px] shadow-inner">
                 <div class="text-center mt-20 space-y-6 opacity-30 group">
                    <div class="w-24 h-24 bg-slate-200 dark:bg-white/5 rounded-[2rem] flex items-center justify-center text-4xl mx-auto group-hover:scale-110 transition-transform">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <p class="text-xs font-black uppercase tracking-[0.4em] max-w-xs leading-relaxed">Selecciona un rango de fechas para generar el reporte oficial</p>
                 </div>
            </div>
            
             <!-- Loading Overlay -->
            <div id="report-loading" class="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center hidden rounded-xl">
                <div class="flex flex-col items-center gap-3">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                    <span class="text-blue-300 font-medium animate-pulse">Procesando datos...</span>
                </div>
            </div>
        </div>
    `;

    // Initialize Dates (Current Month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Initialize Service Year Selector and Dates
    const yearSelect = showHeader ? document.getElementById('report-year-select') : null;
    const startInput = showHeader ? document.getElementById('report-start') : (options.startInput || null);
    const endInput = showHeader ? document.getElementById('report-end') : (options.endInput || null);

    // Calculate current Service Year
    // Service Year 2026 starts Sept 1, 2025.
    // If Month is >= 8 (Sept, 0-indexed), Service Year is Next Year.
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11. Sept is 8.
    const serviceYear = currentMonth >= 8 ? currentYear + 1 : currentYear;

    // Populate Selector (Range: Current - 5 to Current + 5)
    if (yearSelect) {
        for (let y = serviceYear - 5; y <= serviceYear + 5; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === serviceYear) opt.selected = true;
            // Style for light mode
            opt.className = "bg-white text-gray-900 dark:bg-black dark:text-white";
            yearSelect.appendChild(opt);
        }
    }

    // Function to set dates based on Service Year
    const setDatesFromServiceYear = (sy) => {
        if (!startInput || !endInput) return;
        // SY 2025 = Sept 1, 2024 to Aug 31, 2025
        const y = parseInt(sy);
        const start = new Date(y - 1, 8, 1); // Sept 1, Prev Year
        const end = new Date(y, 7, 31); // Aug 31, Current SY Year

        const fmt = (d) => {
            const yy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd}`;
        };
        startInput.value = fmt(start);
        endInput.value = fmt(end);
    };

    // Initial Set
    if (showHeader) setDatesFromServiceYear(serviceYear);

    // Listener
    if (yearSelect) {
        yearSelect.addEventListener('change', (e) => {
            setDatesFromServiceYear(e.target.value);
        });
    }

    document.getElementById('btn-generate-report').addEventListener('click', async () => {
        const start = document.getElementById('report-start').value;
        const end = document.getElementById('report-end').value;

        if (!start || !end) {
            showNotification("Selecciona un rango de fechas válido.", "warning");
            return;
        }

        const loader = document.getElementById('report-loading');
        loader.classList.remove('hidden');

        try {
            const [allHistory, allTerritorios] = await Promise.all([
                getHistorialReport(),
                getTerritorios()
            ]);

            // Filter data for the preview range
            const startMs = new Date(start).getTime();
            const endObj = new Date(end);
            endObj.setHours(23, 59, 59, 999);
            const endMs = endObj.getTime();

            const historyInRange = allHistory.filter(item => {
                const fAsig = new Date(item.fecha_asignacion).getTime();
                const fEntr = item.fecha_entrega ? new Date(item.fecha_entrega).getTime() : null;
                return (fAsig >= startMs && fAsig <= endMs) || (fEntr && fEntr >= startMs && fEntr <= endMs);
            });

            const config = await getConfiguracion();
            const congregationName = config?.congregacion?.nombre || 'Mi Congregación';
            const yearLabel = document.getElementById('report-year-select') ? document.getElementById('report-year-select').value : serviceYear;

            renderReport(historyInRange, allHistory, allTerritorios, start, end, yearLabel, congregationName);
            document.getElementById('btn-export-s13-pdf').classList.remove('hidden');
            document.getElementById('btn-export-s13-excel').classList.remove('hidden');

            // Save current data for excel export
            window._currentS13Data = historyInRange;
        } catch (e) {
            console.error(e);
            showNotification("Error generando reporte: " + e.message, "error");
        } finally {
            loader.classList.add('hidden');
        }
    });

    document.getElementById('btn-export-s13-pdf').addEventListener('click', async () => {
        const pages = document.querySelectorAll('.s13-page');
        if (pages.length === 0) return;

        const btn = document.getElementById('btn-export-s13-pdf');
        const isOffline = !navigator.onLine;

        if (isOffline) {
            showNotification("📡 Generando PDF en modo offline. Los estilos tipográficos podrían variar.", "warning");
        }

        const oldText = btn.innerHTML;
        btn.innerHTML = '⏳ Generando PDF...';
        btn.disabled = true;

        try {
            const { jsPDF } = window.jspdf;
            // Use A4 Portrait - 300DPI equivalent scaling handled by html2canvas
            const doc = new jsPDF('p', 'mm', 'a4');

            const pdfWidth = 210;
            const pdfHeight = 297;

            for (let i = 0; i < pages.length; i++) {
                if (i > 0) doc.addPage();

                // html2canvas works purely client-side with DOM. 
                // Any missing external images/fonts might be skipped if not already in cache.
                const canvas = await html2canvas(pages[i], {
                    scale: 2.5, // Better resolution for printing
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true,
                    allowTaint: true
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                const imgProps = doc.getImageProperties(imgData);
                const printHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(printHeight, pdfHeight));
            }

            const config = await getConfiguracion();
            const congName = config?.congregacion?.nombre || 'Mi_Congregacion';
            const fileName = `S13_Reporte_${congName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            showNotification("✅ PDF generado correctamente en tu dispositivo.", "success");

        } catch (e) {
            console.error(e);
            showNotification("Error exportando PDF: " + e.message, "error");
        } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    });

    document.getElementById('btn-export-s13-excel').addEventListener('click', () => {
        const data = window._currentS13Data;
        if (!data || data.length === 0) return;

        // Create a flat list: if multiple numbers were assigned together, split them
        const flatList = [];
        data.forEach(item => {
            const nums = item.numero.toString().split(',').map(n => n.trim());
            nums.forEach(num => {
                flatList.push({
                    'Territorio': num,
                    'Conductor': item.conductor || '-',
                    'Fecha Asignación': formatDateShort(item.fecha_asignacion),
                    'Fecha en que se completó': formatDateShort(item.fecha_entrega),
                    'Estado': item.estado || '-',
                    'Observaciones': item.observaciones || '-'
                });
            });
        });

        // Numerical Sort by Territory
        flatList.sort((a, b) => a.Territorio.localeCompare(b.Territorio, undefined, { numeric: true }));

        generatePlainXLS(flatList, `Listado_Asignaciones_S13_${document.getElementById('report-start').value}`);
        showNotification("Excel generado con éxito", "success");
    });

    // Rebuild Listener
    document.getElementById('btn-rebuild-history').addEventListener('click', async () => {
        const runRebuild = async () => {
            const loader = document.getElementById('report-loading');
            loader.classList.remove('hidden');
            try {
                const count = await rebuildHistoryFromSchedule();
                showNotification(`Historial reconstruido. Se recuperaron ${count} asignaciones.`, "success");
            } catch (e) {
                console.error(e);
                showNotification("Error en reconstrucción: " + e.message, "error");
            } finally {
                loader.classList.add('hidden');
            }
        };

        window.showCustomConfirm("¿Deseas analizar todos los Programas Semanales antiguos para reconstruir el historial de asignaciones?\n\nEsto es útil si no ves datos de semanas anteriores.", runRebuild);
    });
};

// --- LOGIC ENGINE ---

const renderReport = (dataInRange, allHistory, allTerritorios, startDate, endDate, yearLabel, congregationName) => {
    const container = document.getElementById('report-preview');
    if (!container) return;
    container.innerHTML = '';

    // 1. Map all territories
    const territoriesMap = new Map();

    // Sort all territories numerically by number
    const sortedTerrs = [...allTerritorios].sort((a, b) =>
        String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true })
    );

    sortedTerrs.forEach(t => {
        const numStr = String(t.numero).padStart(2, '0');
        if (!territoriesMap.has(numStr)) territoriesMap.set(numStr, []);
    });

    // Populate with assignments in range
    dataInRange.forEach(item => {
        if (!item.numero) return;
        const nums = item.numero.toString().split(/[,/]/).map(n => n.trim().padStart(2, '0'));
        nums.forEach(num => {
            if (territoriesMap.has(num)) {
                territoriesMap.get(num).push({ ...item, numero: num });
            }
        });
    });

    const sortedKeys = Array.from(territoriesMap.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    // 2. Pagination State (Image shows 22 rows per page)
    let pageHtmls = [];
    const TERR_PER_PAGE = 25;
    const ASSIGNS_PER_PAGE = 4;

    for (let i = 0; i < sortedKeys.length; i += TERR_PER_PAGE) {
        const terrChunkKeys = sortedKeys.slice(i, i + TERR_PER_PAGE);

        // Calculate Max Assignments across this chunk to see if we need multiple HORIZONTAL pages
        let maxAssigns = 0;
        terrChunkKeys.forEach(k => {
            const count = territoriesMap.get(k).length;
            if (count > maxAssigns) maxAssigns = count;
        });
        if (maxAssigns === 0) maxAssigns = 1;

        const sheetsNeeded = Math.ceil(maxAssigns / ASSIGNS_PER_PAGE);

        for (let s = 0; s < sheetsNeeded; s++) {
            const assignStartIndex = s * ASSIGNS_PER_PAGE;
            pageHtmls.push(S13Exporter.generatePageHtml(
                terrChunkKeys,
                territoriesMap,
                allHistory, // Pass all history to find "Last Completion"
                startDate,
                assignStartIndex,
                ASSIGNS_PER_PAGE,
                yearLabel,
                congregationName
            ));
        }
    }

    if (pageHtmls.length === 0) {
        container.innerHTML = `
            <div class="text-center mt-32 space-y-6 opacity-30">
                <div class="w-24 h-24 bg-slate-200 dark:bg-white/5 rounded-[2rem] flex items-center justify-center text-4xl mx-auto">
                    <i class="fas fa-folder-open"></i>
                </div>
                <p class="text-xs font-black uppercase tracking-[0.4em]">No hay asignaciones en este rango</p>
            </div>
        `;
        return;
    }

    container.innerHTML = pageHtmls.join('');
};

const formatDateShort = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};





