import { getTerritorios, getConductores, getGlobalSettings, getHistorialReport } from '../data/firestore-services.js?v=2.3.9.3';

export const renderAnalyticsView = async (container, appVersion) => {

    // 1. Fetch settings FIRST to use in the template
    let settings = {};
    try {
        settings = await getGlobalSettings();
    } catch (e) {
        console.warn("Could not fetch settings for initial render", e);
    }

    container.innerHTML = `
        <div class="h-full flex flex-col gap-4 md:gap-8 animate-fade-in custom-scrollbar pb-10 px-1 md:px-4">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 dark:border-white/5 pb-6 md:pb-8 gap-4 md:gap-6 px-4 md:px-6">
                <div class="flex items-center gap-4 md:gap-6">
                    <div class="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl md:text-3xl text-primary shadow-inner border border-primary/10 animate-float shrink-0">
                        <i class="fas fa-chart-pie"></i>
                    </div>
                    <div>
                        <h2 class="text-xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight md:tracking-tighter">
                            Panel de Control
                        </h2>
                        <p class="text-[9px] md:text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-[0.2em] md:tracking-[0.3em] mt-1 opacity-90">
                            Visión general y métricas clave
                        </p>
                    </div>
                </div>
                <button id="btn-refresh-analytics" class="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 rounded-2xl border border-slate-200 dark:border-white/10 transition-all font-black text-[9px] md:text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 md:gap-3 shadow-sm hover:shadow-md active:scale-95">
                    <i class="fas fa-sync-alt"></i> Actualizar
                </button>
            </header>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <!-- Operational Row -->
                <div class="modern-card !p-4 md:!p-8 relative overflow-hidden group hover:border-primary/30 transition-all shadow-xl hover:shadow-primary/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-12 h-12 md:w-32 md:h-32 bg-primary/5 rounded-bl-full -mr-4 -mt-4 sm:-mr-8 sm:-mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[8px] md:text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-[0.2em] mb-2 md:mb-4">Total Territorios</p>
                        <div class="text-2xl md:text-5xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter" id="stat-total-terr">-</div>
                        <div class="mt-4 md:mt-6 flex items-center gap-2 text-primary font-black text-[7px] md:text-[10px] uppercase tracking-widest">
                            <i class="fas fa-globe-americas"></i> <span class="hidden xs:inline">Catálogo Maestro</span>
                        </div>
                    </div>
                </div>
                
                <div class="modern-card !p-4 md:!p-8 relative overflow-hidden group hover:border-blue-500/30 transition-all shadow-xl hover:shadow-blue-500/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-12 h-12 md:w-32 md:h-32 bg-blue-500/5 rounded-bl-full -mr-4 -mt-4 sm:-mr-8 sm:-mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[8px] md:text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-[0.2em] mb-2 md:mb-4">Asignados</p>
                        <div class="text-2xl md:text-5xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter" id="stat-assigned">-</div>
                        <div class="mt-4 md:mt-6 flex items-center gap-2 text-blue-500 font-black text-[7px] md:text-[10px] uppercase tracking-widest" id="stat-assigned-pct">
                            <i class="fas fa-user-check"></i> <span class="hidden xs:inline">0% del total</span>
                        </div>
                    </div>
                </div>

                <div class="modern-card !p-4 md:!p-8 relative overflow-hidden group hover:border-indigo-500/30 transition-all shadow-xl hover:shadow-indigo-500/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-12 h-12 md:w-32 md:h-32 bg-indigo-500/5 rounded-bl-full -mr-4 -mt-4 sm:-mr-8 sm:-mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[8px] md:text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-[0.2em] mb-2 md:mb-4">Conductores</p>
                        <div class="text-2xl md:text-5xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter" id="stat-conductors">-</div>
                        <div class="mt-4 md:mt-6 flex items-center gap-2 text-indigo-500 font-black text-[7px] md:text-[10px] uppercase tracking-widest">
                            <i class="fas fa-users"></i> <span class="hidden xs:inline">En servicio</span>
                        </div>
                    </div>
                </div>

                <div class="modern-card !p-4 md:!p-8 relative overflow-hidden group hover:border-rose-500/30 transition-all shadow-xl hover:shadow-rose-500/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-12 h-12 md:w-32 md:h-32 bg-rose-500/5 rounded-bl-full -mr-4 -mt-4 sm:-mr-8 sm:-mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[8px] md:text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-[0.2em] mb-2 md:mb-4">Vencidos</p>
                        <div class="text-2xl md:text-5xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter" id="stat-late">-</div>
                        <div class="mt-4 md:mt-6 flex items-center gap-2 text-rose-500 font-black text-[7px] md:text-[10px] uppercase tracking-widest">
                            <i class="fas fa-exclamation-triangle"></i> <span class="hidden xs:inline">Atrasados</span>
                        </div>
                    </div>
                </div>

                <!-- S-13 History Row -->
                <div class="modern-card !p-4 md:!p-8 relative overflow-hidden group hover:border-emerald-500/30 transition-all shadow-xl hover:shadow-emerald-500/5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
                    <div class="absolute right-0 top-0 w-12 h-12 md:w-32 md:h-32 bg-white/10 rounded-bl-full -mr-4 -mt-4 sm:-mr-8 sm:-mt-8 transition-transform group-hover:scale-150 duration-700"></div>
                    <div class="relative z-10">
                        <p class="text-[8px] md:text-[10px] text-white/70 font-extrabold uppercase tracking-[0.2em] mb-2 md:mb-4">Cobertura S-13</p>
                        <div class="text-2xl md:text-5xl font-black tabular-nums tracking-tighter" id="stat-s13-coverage">-</div>
                        <div class="mt-4 md:mt-6 flex items-center gap-2 text-white/60 font-black text-[7px] md:text-[10px] uppercase tracking-widest" id="stat-s13-coverage-info">
                            <i class="fas fa-chart-pie"></i> <span class="hidden xs:inline">0 de 0 abarcados</span>
                        </div>
                    </div>
                </div>

                <div class="modern-card !p-4 md:!p-8 relative overflow-hidden group hover:border-orange-500/30 transition-all shadow-xl hover:shadow-orange-500/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-12 h-12 md:w-32 md:h-32 bg-orange-500/5 rounded-bl-full -mr-4 -mt-4 sm:-mr-8 sm:-mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[8px] md:text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-[0.2em] mb-2 md:mb-4">Faltantes</p>
                        <div class="text-2xl md:text-5xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter" id="stat-s13-missing">-</div>
                        <div class="mt-4 md:mt-6 flex items-center gap-2 text-orange-500 font-black text-[7px] md:text-[10px] uppercase tracking-widest">
                            <i class="fas fa-map-marked"></i> <span class="hidden xs:inline">Por Trabajar</span>
                        </div>
                    </div>
                </div>

                <div class="modern-card !p-4 md:!p-8 relative overflow-hidden group hover:border-violet-500/30 transition-all shadow-xl hover:shadow-violet-500/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-12 h-12 md:w-32 md:h-32 bg-violet-500/5 rounded-bl-full -mr-4 -mt-4 sm:-mr-8 sm:-mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[8px] md:text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-[0.2em] mb-2 md:mb-4">Uso Frecuente</p>
                        <div class="text-xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter truncate" id="stat-s13-frequent">-</div>
                        <div class="mt-4 md:mt-6 flex items-center gap-2 text-violet-500 font-black text-[7px] md:text-[10px] uppercase tracking-widest" id="stat-s13-frequent-info">
                            <i class="fas fa-redo-alt"></i> <span class="hidden xs:inline">0 veces</span>
                        </div>
                    </div>
                </div>

                <div class="modern-card !p-4 md:!p-8 relative overflow-hidden group hover:border-amber-500/30 transition-all shadow-xl hover:shadow-amber-500/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-12 h-12 md:w-32 md:h-32 bg-amber-500/5 rounded-bl-full -mr-4 -mt-4 sm:-mr-8 sm:-mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[8px] md:text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-[0.2em] mb-2 md:mb-4">Mayor Rezago</p>
                        <div class="text-xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter truncate" id="stat-s13-oldest">-</div>
                        <div class="mt-4 md:mt-6 flex items-center gap-2 text-amber-600 font-black text-[7px] md:text-[10px] uppercase tracking-widest" id="stat-s13-oldest-info">
                            <i class="fas fa-history"></i> <span class="hidden xs:inline">Hace 0 días</span>
                        </div>
                    </div>
                </div>

            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 overflow-hidden">
                <div class="modern-card p-4 sm:p-6 md:p-10 flex flex-col bg-white dark:bg-white/[0.02]">
                    <h3 class="text-[10px] md:text-[12px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] mb-6 md:mb-10 flex items-center gap-3">
                        <span class="w-6 md:w-8 h-[1px] bg-slate-300 dark:bg-white/10"></span>
                        Estado de Territorios
                    </h3>
                    <div class="flex-1 relative min-h-[220px] md:min-h-[300px]">
                        <canvas id="chart-status"></canvas>
                    </div>
                </div>

                <div class="lg:col-span-2 modern-card p-4 sm:p-6 md:p-10 flex flex-col bg-white dark:bg-white/[0.02]">
                    <h3 class="text-[10px] md:text-[12px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] mb-6 md:mb-10 flex items-center gap-3">
                        <span class="w-6 md:w-8 h-[1px] bg-slate-300 dark:bg-white/10"></span>
                        Frecuencia de Trabajo
                    </h3>
                    <div class="flex-1 relative min-h-[220px] md:min-h-[300px]">
                        <canvas id="chart-territories"></canvas>
                    </div>
                </div>
            </div>

            <div class="modern-card !p-0 overflow-hidden flex-1 flex flex-col min-h-[400px] border-rose-500/20 shadow-2xl bg-white dark:bg-white/[0.02]">
                <div class="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-rose-500/[0.02] gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 shrink-0">
                            <i class="fas fa-exclamation-circle"></i>
                        </div>
                        <h3 class="text-lg md:text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Territorios con Atraso Crítico</h3>
                    </div>
                    <span class="text-[9px] md:text-[10px] font-black bg-rose-500 text-white px-4 py-2 rounded-xl uppercase tracking-widest shadow-lg shadow-rose-500/20 animate-pulse">Prioridad Alta</span>
                </div>
                <div class="table-container overflow-auto flex-1 p-0">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-gray-100 dark:bg-black/40 text-xs uppercase text-slate-700 dark:text-slate-300 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th class="p-4 font-semibold whitespace-nowrap">Terr.</th>
                                <th class="p-4 font-semibold whitespace-nowrap">Conductor</th>
                                <th class="p-4 font-semibold whitespace-nowrap">Asignación</th>
                                <th class="p-4 font-semibold whitespace-nowrap">Tiempo</th>
                            </tr>
                        </thead>
                        <tbody id="late-table-body" class="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="text-center text-xs text-gray-400 py-4 font-black uppercase tracking-widest opacity-30">
                App Territorios v${appVersion || '2.3.6'} Oficial • Powered by XOLVY
            </div>
        </div>
    `;

    // Load Data
    const loadData = async () => {
        try {
            const [territorios, conductores, historial] = await Promise.all([
                getTerritorios(),
                getConductores(),
                getHistorialReport()
            ]);

            // Calculate Stats
            const expDays = settings?.expiration_days || 120;
            const total = territorios.length;
            const assigned = territorios.filter(t => t.estado === 'Asignado');
            const assignedCount = assigned.length;
            const assignedPct = total > 0 ? Math.round((assignedCount / total) * 100) : 0;

            const now = new Date();
            const lateTerritories = assigned.filter(t => {
                if (!t.fecha_asignacion) return false;
                const d = new Date(t.fecha_asignacion);
                const diffTime = Math.abs(now - d);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays > expDays;
            });

            // --- S-13 (Historical) Calculations ---
            const touchedNums = new Set(historial.map(h => String(h.numero)));
            const s13CoveragePercent = total > 0 ? Math.round((touchedNums.size / total) * 100) : 0;
            const s13MissingCount = territorios.filter(t => !touchedNums.has(String(t.numero))).length;

            const territoryFreq = {};
            historial.forEach(h => {
                if (!h.numero) return;
                const nums = h.numero.toString().split(/[,;]/).map(n => n.trim()).filter(n => n);
                nums.forEach(num => {
                    territoryFreq[num] = (territoryFreq[num] || 0) + 1;
                });
            });
            const mostFreqSorted = Object.entries(territoryFreq).sort((a, b) => b[1] - a[1]);
            const topTerritory = mostFreqSorted[0]?.[0] || '--';
            const topCount = mostFreqSorted[0]?.[1] || 0;

            const latestTouch = {};
            historial.forEach(h => {
                const d = h.fecha_entrega || h.fecha_asignacion;
                if (!d) return;
                const nums = h.numero.toString().split(/[,;]/).map(n => n.trim()).filter(n => n);
                nums.forEach(num => {
                    if (!latestTouch[num] || new Date(d) > new Date(latestTouch[num])) {
                        latestTouch[num] = d;
                    }
                });
            });

            const rezagoSorted = territorios.filter(t => latestTouch[t.numero]).sort((a, b) => new Date(latestTouch[a.numero]) - new Date(latestTouch[b.numero]));
            const oldestTerritory = rezagoSorted[0]?.numero || '--';
            const daysRezago = rezagoSorted[0] ? Math.floor((new Date() - new Date(latestTouch[rezagoSorted[0].numero])) / (1000 * 60 * 60 * 24)) : 0;


            // Safety check: is the container still in the DOM and has our elements?
            if (!document.getElementById('stat-total-terr')) return;

            // Update DOM Stats
            document.getElementById('stat-total-terr').innerText = total;
            document.getElementById('stat-assigned').innerText = assignedCount;
            document.getElementById('stat-assigned-pct').innerText = `${assignedPct}% del total`;
            document.getElementById('stat-conductors').innerText = conductores.length;
            document.getElementById('stat-late').innerText = lateTerritories.length;

            // Update S-13 Stats
            document.getElementById('stat-s13-coverage').innerText = `${s13CoveragePercent}%`;
            document.getElementById('stat-s13-coverage-info').innerText = `${touchedNums.size} de ${total} abarcados`;
            document.getElementById('stat-s13-missing').innerText = s13MissingCount;
            document.getElementById('stat-s13-frequent').innerText = topTerritory === '--' ? '--' : `Territorio ${topTerritory}`;
            document.getElementById('stat-s13-frequent-info').innerText = `${topCount} ${topCount === 1 ? 'vez' : 'veces'}`;
            document.getElementById('stat-s13-oldest').innerText = oldestTerritory === '--' ? '--' : `#${oldestTerritory}`;
            document.getElementById('stat-s13-oldest-info').innerText = `Hace ${daysRezago} días`;

            // Render Chart 1
            const chartStatusEl = document.getElementById('chart-status');
            if (chartStatusEl) {
                new Chart(chartStatusEl.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Disponible', 'Asignado', 'Atrasado'],
                        datasets: [{
                            data: [total - assignedCount, assignedCount - lateTerritories.length, lateTerritories.length],
                            backgroundColor: ['#e2e8f0', '#0f766e', '#ef4444'],
                            borderWidth: 0,
                            hoverOffset: 10
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { family: 'Inter' } } } } }
                });
            }

            // Render Chart 2
            const terrFreqMap = {};
            historial.forEach(entry => {
                if (entry.estado === 'Completado' && entry.numero) {
                    const num = entry.numero.toString().trim();
                    terrFreqMap[num] = (terrFreqMap[num] || 0) + 1;
                }
            });
            const sortedTerrFreq = Object.entries(terrFreqMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

            const chartTerrEl = document.getElementById('chart-territories');
            if (chartTerrEl && sortedTerrFreq.length > 0) {
                new Chart(chartTerrEl.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: sortedTerrFreq.map(x => `Terr.${x[0]} `),
                        datasets: [{ label: 'Veces Trabajado', data: sortedTerrFreq.map(x => x[1]), backgroundColor: '#0f766e', borderRadius: 6, barThickness: 20 }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { precision: 0 } }, x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, autoSkip: true } } }, plugins: { legend: { display: false } } }
                });
            }

            // Render Late Table
            const tbody = document.getElementById('late-table-body');
            if (tbody) {
                if (lateTerritories.length > 0) {
                    tbody.innerHTML = lateTerritories.sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion)).map(t => {
                        const d = new Date(t.fecha_asignacion);
                        const diffDays = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24));
                        return `<tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group cursor-pointer">
                            <td class="p-4 font-bold text-gray-800 dark:text-gray-200">${t.numero}</td>
                            <td class="p-4 text-gray-600 dark:text-gray-400">${t.asignado_a}</td>
                            <td class="p-4 text-gray-500">${d.toLocaleDateString()}</td>
                            <td class="p-4 font-bold text-red-500">${diffDays} días</td>
                        </tr>`;
                    }).join('');
                } else {
                    tbody.innerHTML = `<tr><td colspan="4" class="p-20 text-center"><div class="flex flex-col items-center gap-4 opacity-30 group"><div class="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-2xl text-emerald-500 group-hover:scale-110 transition-transform"><i class="fas fa-check-circle"></i></div><p class="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Sin territorios atrasados</p></div></td></tr>`;
                }
            }

        } catch (e) {
            console.error("Error in loadData:", e);
            if (container) container.innerHTML = `<div class="text-red-500 p-5"> Error cargando analytics: ${e.message}</div>`;
        }
    };

    loadData();
    const refreshBtn = document.getElementById('btn-refresh-analytics');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => renderAnalyticsView(container, appVersion));
    }
};
