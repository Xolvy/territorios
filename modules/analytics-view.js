import Chart from 'chart.js/auto';
import { getTerritorios, getConductores, getGlobalSettings, getHistorialReport, getGlobalStats, resyncGlobalStats } from '../data/firestore-services.js';
import { showNotification } from './utils/helpers.js';

// --- Helper UI Components ---
const renderStatCard = (label, id, icon, color, sub) => `
    <div class="flex flex-col bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
        <div class="flex justify-between items-start mb-4">
             <div class="w-10 h-10 lg:w-12 lg:h-12 bg-slate-50 dark:bg-white/5 text-slate-400 group-hover:text-indigo-600 rounded-xl flex items-center justify-center text-sm lg:text-lg transition-colors border border-slate-100 dark:border-white/5">
                <i class="${icon}"></i>
            </div>
            <div class="h-1.5 w-1.5 rounded-full bg-slate-200 dark:bg-white/10 group-hover:bg-indigo-500 transition-colors"></div>
        </div>
        <div>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1 font-sans">${label}</p>
            <div class="flex items-baseline gap-2">
                <span class="text-3xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tighter tabular-nums" id="${id}">0</span>
                <span class="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest pb-1 border-b border-slate-100 dark:border-white/5">${sub.split(' ')[0]}</span>
            </div>
        </div>
    </div>
`;

// --- Helper UI Functions ---
const animateValue = (id, start, end, duration) => {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
};

const initMainCharts = (total, assigned, late, freqMap, coverage) => {
    // Doughnut: Status
    const ctxStatus = document.getElementById('chart-status')?.getContext('2d');
    if (ctxStatus) {
        new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Disponibles', 'En Tiempo', 'Vencidos'],
                datasets: [{
                    data: [total - assigned, assigned - late, late],
                    backgroundColor: ['#e2e8f0', '#6366f1', '#f43f5e'],
                    hoverOffset: 15,
                    borderWidth: 0,
                    borderRadius: 8,
                    spacing: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '82%',
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 25, font: { weight: 'bold', size: 10 } } } }
            }
        });
    }

    // Bar: Frequency
    const ctxFreq = document.getElementById('chart-territories')?.getContext('2d');
    if (ctxFreq) {
        const sorted = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
        new Chart(ctxFreq, {
            type: 'bar',
            data: {
                labels: sorted.map(x => `#${x[0]}`),
                datasets: [{
                    label: 'Veces Trabajado',
                    data: sorted.map(x => x[1]),
                    backgroundColor: '#10b981',
                    borderRadius: 6,
                    barThickness: 22,
                    hoverBackgroundColor: '#059669'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { size: 9 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // Radial: Tiny S-13
    const ctxMini = document.getElementById('chart-s13-mini')?.getContext('2d');
    if (ctxMini) {
        new Chart(ctxMini, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [coverage, 100 - coverage],
                    backgroundColor: ['#10b981', 'rgba(255,255,255,0.05)'],
                    borderWidth: 0,
                    circumference: 270,
                    rotation: 225
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '88%',
                plugins: { tooltip: { enabled: false } }
            }
        });
    }
};

const renderLateTable = (list, now, exp) => {
    const tbody = document.getElementById('late-table-body');
    if (!tbody) return;
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-24 text-center opacity-30 text-[10px] font-black uppercase tracking-widest italic">Excelente: No hay territorios con atraso crítico</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(t => {
        const date = new Date(t.fecha_asignacion);
        const diff = Math.ceil(Math.abs(now - date) / (1000 * 60 * 60 * 24));
        const gravity = diff > exp * 1.5 ? 'EXTREMO' : 'ALTO';
        const color = diff > exp * 1.5 ? 'rose' : 'amber';

        return `
            <!-- Fila Desktop -->
            <tr class="hidden md:table-row hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors group">
                <td class="px-8 py-5">
                    <div class="flex items-center gap-4">
                        <span class="w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-sm transition-transform">${t.numero}</span>
                        <span class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase truncate max-w-[150px] font-sans">${t.localidad || 'Congregación'}</span>
                    </div>
                </td>
                <td class="px-8 py-5">
                    <span class="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">${t.asignado_a}</span>
                </td>
                <td class="px-8 py-5 text-[11px] font-medium text-slate-400">
                    ${date.toLocaleDateString()}
                </td>
                <td class="px-8 py-5">
                    <span class="text-[11px] font-bold text-${color}-700 bg-${color}-50 px-2.5 py-1 rounded-full ring-1 ring-${color}-200/50">${diff} días</span>
                </td>
                <td class="px-8 py-5 text-right">
                    <div class="flex items-center justify-end gap-2">
                         <span class="text-[10px] font-bold text-${color}-600 uppercase tracking-wider">${gravity}</span>
                    </div>
                </td>
            </tr>
            <!-- Tarjeta Mobile (Lista Maestra) -->
            <tr class="md:hidden block w-full hover:bg-slate-50 dark:hover:bg-white/5 active:scale-[0.98] transition-all cursor-pointer border-b border-slate-100 dark:border-white/5">
                <td class="block p-5 w-full">
                    <div class="flex justify-between items-start gap-3 w-full">
                        <div class="flex items-center gap-4 w-full">
                            <span class="w-12 h-12 shrink-0 bg-slate-900 text-white rounded-[1rem] flex items-center justify-center font-black text-lg shadow-lg">${t.numero}</span>
                            <div class="flex flex-col gap-1 w-full min-w-0">
                                <div class="flex justify-between items-center w-full">
                                    <span class="text-sm font-black text-slate-800 dark:text-white uppercase truncate">${t.localidad || 'Congregación'}</span>
                                    <span class="shrink-0 text-[10px] font-black text-${color}-600 bg-${color}-500/10 px-2.5 py-1 rounded-lg border border-${color}-500/20">${diff} d</span>
                                </div>
                                <span class="text-[11px] font-bold text-slate-500 uppercase tracking-widest truncate">${t.asignado_a}</span>
                                <div class="flex justify-between items-center mt-1">
                                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]"><i class="far fa-calendar-alt"></i> ${date.toLocaleDateString()}</span>
                                    <span class="text-[9px] font-black text-${color}-500 uppercase tracking-widest flex items-center gap-1.5">${gravity} <span class="w-1.5 h-1.5 rounded-full bg-${color}-500 animate-pulse"></span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

export const renderAnalyticsView = async (container, appVersion) => {
    // 1. Fetch settings FIRST to use in the template
    let settings = {};
    try {
        settings = await getGlobalSettings();
    } catch (e) {
        console.warn("Could not fetch settings for initial render", e);
    }

    container.innerHTML = `
        <div class="flex flex-col gap-12 animate-fade-in">
            <!-- Header Premium con Estética Glassmorphism -->
            <!-- Header Refactor (Clean Aesthetic) -->
            <header class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-2 border-b border-slate-100 dark:border-white/5">
                <div class="flex flex-col">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-widest rounded border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-400/20">Core Stats</span>
                        <div class="h-px w-8 bg-slate-200 dark:bg-white/10"></div>
                    </div>
                    <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Métricas Operativas</h2>
                    <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">S-13 Intelligence Engine</p>
                </div>

                <div class="flex items-center gap-3 w-full md:w-auto">
                    <button id="btn-resync-stats" class="px-5 py-3.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-600 transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm active:scale-95 group">
                        <i class="fas fa-shield-halved opacity-40 group-hover:opacity-100"></i> Recalcular
                    </button>
                    <button id="btn-refresh-analytics" class="flex-1 md:flex-none px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm shadow-indigo-200 active:scale-95 group">
                        <i class="fas fa-sync-alt opacity-70 group-hover:rotate-180 transition-transform duration-700"></i> Actualizar Informe
                    </button>
                </div>
            </header>

            <!-- Grid de Tarjetas de Impacto -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                ${renderStatCard('Total Inventario', 'stat-total-terr', 'fas fa-layer-group', 'indigo', 'Catálogo Maestro')}
                ${renderStatCard('En circulación', 'stat-assigned', 'fas fa-user-clock', 'blue', 'En manos de publicadores')}
                ${renderStatCard('Fuerza de Conducción', 'stat-conductors', 'fas fa-users-viewfinder', 'violet', 'Conductores activos')}
                ${renderStatCard('Atrasos Críticos', 'stat-late', 'fas fa-skull-crossbones', 'rose', 'Requiere intervención', 'animate-pulse')}
            </div>

            <!-- Insights Section (Middle Row) -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- S-13 Mastery Card -->
                <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-white/5 shadow-sm flex flex-col md:flex-row gap-8 items-center relative overflow-hidden group">
                        <div class="flex-1 space-y-6">
                            <div class="flex items-center gap-3 text-slate-900 dark:text-white">
                                <h3 class="text-lg font-bold tracking-tight">Cobertura Global S-13</h3>
                                <div class="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-bold uppercase tracking-widest rounded border border-emerald-100">Live Status</div>
                            </div>
                            <div class="flex items-baseline gap-3">
                                <span class="text-5xl lg:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tighter tabular-nums" id="stat-s13-coverage">0%</span>
                                <span class="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded" id="stat-s13-diff">+0% Trend</span>
                            </div>
                            <div class="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <div id="stat-s13-progress-bar" class="h-full bg-indigo-600 rounded-full transition-all duration-1000" style="width: 0%"></div>
                            </div>
                            <p class="text-[11px] text-slate-500 font-medium leading-relaxed max-w-md" id="stat-s13-coverage-info">
                                Analizando profundidad del catálogo maestro y niveles de rotación...
                            </p>
                        </div>
                        <div class="w-full md:w-44 h-44 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center p-4 border border-slate-100 dark:border-white/5">
                            <canvas id="chart-s13-mini"></canvas>
                        </div>
                </div>

                <!-- Strategic Quick Look -->
                <div class="bg-indigo-600 dark:bg-indigo-900 rounded-2xl p-8 border border-indigo-500 shadow-lg shadow-indigo-100 dark:shadow-none flex flex-col justify-between group">
                    <div class="flex justify-between items-start mb-6">
                        <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white border border-white/20">
                            <i class="fas fa-bolt-lightning text-xs"></i>
                        </div>
                        <span class="text-[9px] font-bold text-white/50 uppercase tracking-[0.2em]">S-13 Priority</span>
                    </div>
                    <div class="space-y-6">
                        <div class="space-y-1">
                            <p class="text-[10px] font-bold text-indigo-100 uppercase tracking-widest opacity-70">Mayor Rezago</p>
                            <p class="text-3xl font-extrabold text-white tracking-tighter" id="stat-s13-oldest">#--</p>
                            <p class="text-[10px] text-white/60 font-medium" id="stat-s13-oldest-info">Escaneando historial...</p>
                        </div>
                        <div class="h-px bg-white/10"></div>
                        <div class="space-y-1">
                            <p class="text-[10px] font-bold text-indigo-100 uppercase tracking-widest opacity-70">Punto de Enfoque</p>
                            <p class="text-3xl font-extrabold text-white tracking-tighter truncate" id="stat-s13-frequent">--</p>
                            <p class="text-[10px] text-white/60 font-medium" id="stat-s13-frequent-info">Nivel de rotación</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Charts Row -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Current Status Chart -->
                <div class="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-white/5 shadow-sm flex flex-col">
                    <h3 class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-indigo-500"></div>
                        Estado Operativo
                    </h3>
                    <div class="flex-1 relative min-h-[260px]">
                        <canvas id="chart-status"></canvas>
                    </div>
                </div>

                <!-- Frequency Chart -->
                <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-white/5 shadow-sm flex flex-col">
                    <h3 class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                        Frecuencia de Trabajo (Top 10 S-13)
                    </h3>
                    <div class="flex-1 relative min-h-[260px]">
                        <canvas id="chart-territories"></canvas>
                    </div>
                </div>
            </div>

            <!-- Critical Table Row -->
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[400px]">
                <div class="p-8 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div class="flex items-center gap-5">
                        <div class="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex items-center justify-center text-xl">
                             <i class="fas fa-clock-rotate-left"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Atrasos Críticos</h3>
                            <p class="text-xs text-slate-500 font-medium mt-0.5">Territorios cuya posesión excede los límites S-13</p>
                        </div>
                    </div>
                    <div class="px-4 py-2 bg-rose-50 text-rose-700 ring-1 ring-rose-200 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        Intervención Requerida
                    </div>
                </div>
                <div class="table-container p-0">
                    <table class="w-full text-left border-collapse block md:table">
                        <thead class="hidden md:table-header-group">
                            <tr class="bg-gray-100/50 dark:bg-black/40 text-[10px] uppercase font-black text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/5">
                                <th class="px-8 py-6">Territorio</th>
                                <th class="px-8 py-6">Responsable</th>
                                <th class="px-8 py-6">Asignación</th>
                                <th class="px-8 py-6">Tiempo</th>
                                <th class="px-8 py-6 text-right">Gravedad</th>
                            </tr>
                        </thead>
                        <tbody id="late-table-body" class="block md:table-row-group divide-y-0 md:divide-y divide-gray-100 dark:divide-white/5 text-sm">
                            <!-- Inyectado dinámicamente -->
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="text-center py-6">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.5em] opacity-30">Xolvy Analytics Engine v${appVersion} • Aurora Architecture</p>
            </div>
        </div>
    `;

    // --- Data Management & Chart Initialization ---
    const loadData = async () => {
        try {
            const [territorios, conductores, historial, globalStats] = await Promise.all([
                getTerritorios(),
                getConductores(),
                getHistorialReport(),
                getGlobalStats()
            ]);

            const expDays = settings?.expiration_days || 120;

            // Xolvy Intelligence: Use aggregated stats for primary metrics, fallback to calculated if needed
            const total = globalStats.total_territorios || territorios.length;
            const assignedCount = globalStats.territorios_asignados !== undefined ? globalStats.territorios_asignados : territorios.filter(t => t.estado === 'Asignado').length;
            const assigned = territorios.filter(t => t.estado === 'Asignado');

            const now = new Date();
            const lateTerritories = assigned.filter(t => {
                if (!t.fecha_asignacion) return false;
                const d = new Date(t.fecha_asignacion);
                const diffDays = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24));
                return diffDays > expDays;
            }).sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion));

            // --- Strategic Metrics Logic (S-13 Filtered) ---
            const allUniqueTouched = new Set();
            let totalWorkActs = 0;
            const territoryFreq = {};

            historial.forEach(h => {
                // Xolvy Logic: Only SUCCESS logs count for coverage and frequency
                if (h.estado !== 'Completado' && h.estado !== 'Predicado') return;

                if (!h.numero) return;
                const nums = h.numero.toString().split(/[,;]/).map(n => n.trim()).filter(n => n);
                nums.forEach(num => {
                    allUniqueTouched.add(num);
                    territoryFreq[num] = (territoryFreq[num] || 0) + 1;
                    totalWorkActs++;
                });
            });

            const uniqueWorkedCount = allUniqueTouched.size;
            const s13CoveragePercent = total > 0 ? Math.min(100, Math.round((uniqueWorkedCount / total) * 100)) : 0;
            const workRounds = total > 0 ? (totalWorkActs / total).toFixed(1) : 0;

            const mostFreqSorted = Object.entries(territoryFreq).sort((a, b) => b[1] - a[1]);
            const topTerritory = mostFreqSorted[0]?.[0] || '--';
            const topCount = mostFreqSorted[0]?.[1] || 0;

            const latestTouch = {};
            historial.forEach(h => {
                if (h.estado !== 'Completado' && h.estado !== 'Predicado') return;
                const d = h.fecha_entrega || h.fecha_asignacion;
                if (!d || !h.numero) return;
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

            // --- UI Animation/Updates ---
            if (!document.getElementById('stat-total-terr')) return;

            animateValue('stat-total-terr', 0, total, 1000);
            animateValue('stat-assigned', 0, assignedCount, 1000);
            animateValue('stat-conductors', 0, conductores.length, 1000);
            animateValue('stat-late', 0, lateTerritories.length, 1000);

            document.getElementById('stat-s13-coverage').innerText = `${s13CoveragePercent}%`;
            document.getElementById('stat-s13-progress-bar').style.width = `${s13CoveragePercent}%`;
            document.getElementById('stat-s13-coverage-info').innerText = `${uniqueWorkedCount} de ${total} territorios cubiertos en este ciclo • ${workRounds} vueltas al catálogo`;

            document.getElementById('stat-s13-oldest').innerText = oldestTerritory === '--' ? '--' : `#${oldestTerritory}`;
            document.getElementById('stat-s13-oldest-info').innerText = `Último informe: hace ${daysRezago} días`;

            document.getElementById('stat-s13-frequent').innerText = topTerritory === '--' ? '--' : `Territorio ${topTerritory}`;
            document.getElementById('stat-s13-frequent-info').innerText = `Registrado ${topCount} veces recientemente`;

            // --- Charts Initialization ---
            initMainCharts(total, assignedCount, lateTerritories.length, territoryFreq, s13CoveragePercent);

            // --- Late Table Rendering ---
            renderLateTable(lateTerritories, now, expDays);

        } catch (e) {
            console.error("Critical error loading analytics:", e);
        }
    };

    // --- Helper UI Functions ---




    loadData();
    const refreshBtn = document.getElementById('btn-refresh-analytics');
    if (refreshBtn) {
        refreshBtn.onclick = () => renderAnalyticsView(container, appVersion);
    }

    const resyncBtn = document.getElementById('btn-resync-stats');
    if (resyncBtn) {
        resyncBtn.onclick = async () => {
            const icon = resyncBtn.querySelector('i');
            icon.classList.add('fa-spin');
            resyncBtn.disabled = true;

            await resyncGlobalStats();

            showNotification("Estadísticas sincronizadas con el Banco Común", "success");
            renderAnalyticsView(container, appVersion);
        };
    }
};
