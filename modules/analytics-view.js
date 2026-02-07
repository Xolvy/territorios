import Chart from 'chart.js/auto';
import { getTerritorios, getConductores, getGlobalSettings, getHistorialReport, getGlobalStats, resyncGlobalStats } from '../data/firestore-services.js';

// --- Helper UI Components ---
const renderStatCard = (label, id, icon, color, sub) => `
    <div class="glass-card bg-white dark:bg-white/[0.03] p-8 rounded-[2.2rem] border border-slate-200 dark:border-white/5 relative overflow-hidden group hover:scale-[1.02] transition-all shadow-xl">
        <div class="absolute -right-8 -top-8 w-24 h-24 bg-${color}-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
        <div class="relative z-10 space-y-4">
            <div class="w-12 h-12 bg-${color}-500/10 text-${color}-500 rounded-2xl flex items-center justify-center text-xl shadow-inner">
                <i class="${icon}"></i>
            </div>
            <div>
                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">${label}</p>
                <div class="text-4xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter mt-1" id="${id}">-</div>
            </div>
            <p class="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">${sub}</p>
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
            <tr class="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors group">
                <td class="px-8 py-6">
                    <div class="flex items-center gap-4">
                        <span class="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-lg group-hover:scale-110 transition-transform">${t.numero}</span>
                        <span class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase truncate max-w-[150px]">${t.localidad || 'Congregación'}</span>
                    </div>
                </td>
                <td class="px-8 py-6">
                    <span class="text-[11px] font-black text-slate-500 uppercase tracking-tight">${t.asignado_a}</span>
                </td>
                <td class="px-8 py-6 text-[11px] font-bold text-slate-400">
                    ${date.toLocaleDateString()}
                </td>
                <td class="px-8 py-6">
                    <span class="text-[11px] font-black text-${color}-600 bg-${color}-500/10 px-3 py-1 rounded-full border border-${color}-500/20">${diff} días</span>
                </td>
                <td class="px-8 py-6 text-right">
                    <div class="flex items-center justify-end gap-2">
                         <span class="text-[9px] font-black text-${color}-500 uppercase tracking-widest">${gravity}</span>
                         <div class="w-2 h-2 rounded-full bg-${color}-500 animate-pulse"></div>
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
        <div class="h-full flex flex-col gap-6 animate-fade-in custom-scrollbar pt-4 md:pt-8 pb-10 px-2 md:px-6">
            <!-- Header Premium con Estética Glassmorphism -->
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/10 gap-6">
                <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                <div class="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/20 blur-[80px] rounded-full"></div>
                
                <div class="flex items-center gap-6 relative z-10">
                    <div class="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center text-3xl text-indigo-400 shadow-inner border border-white/20 animate-float shrink-0">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">
                            Analytics <span class="text-indigo-400">Hub</span>
                        </h2>
                        <p class="text-[10px] text-indigo-200/60 font-black uppercase tracking-[0.4em] mt-1">
                            Monitoreo Estratégico de Territorios
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-3 relative z-10 w-full md:w-auto">
                    <div class="hidden lg:flex flex-col items-end mr-4">
                        <span class="text-[9px] font-black text-indigo-300/50 uppercase tracking-widest">Estado del Sistema</span>
                        <span class="text-xs font-bold text-emerald-400 flex items-center gap-2">
                             <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Sincronizado
                        </span>
                    </div>
                    <button id="btn-resync-stats" class="px-6 py-4 bg-white/5 hover:bg-emerald-500/10 text-emerald-400 rounded-2xl border border-white/5 backdrop-blur-md transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 group" title="Recalcular Banco Común">
                        <i class="fas fa-shield-halved group-hover:scale-110 transition-transform"></i> Recalcular
                    </button>
                    <button id="btn-refresh-analytics" class="flex-1 md:flex-none px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 backdrop-blur-md transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 group">
                        <i class="fas fa-sync-alt group-hover:rotate-180 transition-transform duration-700"></i> Actualizar
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
                <div class="lg:col-span-2 glass-card p-1 relative overflow-hidden group">
                    <div class="bg-indigo-50 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2.2rem] p-8 h-full border border-slate-200 dark:border-white/5 flex flex-col md:flex-row gap-8 items-center relative z-10">
                        <div class="flex-1 space-y-6">
                            <div class="flex items-center gap-3">
                                <span class="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">Registro S-13</span>
                                <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Cobertura Global</h3>
                            </div>
                            <div class="flex items-baseline gap-2">
                                <span class="text-6xl font-black text-slate-800 dark:text-white tracking-tighter tabular-nums" id="stat-s13-coverage">0%</span>
                                <span class="text-emerald-500 font-bold text-sm" id="stat-s13-diff">+0% vs mes ant.</span>
                            </div>
                            <div class="h-3 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-slate-100 dark:border-white/5">
                                <div id="stat-s13-progress-bar" class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000" style="width: 0%"></div>
                            </div>
                            <p class="text-[10px] text-slate-400 font-medium uppercase tracking-wider leading-relaxed" id="stat-s13-coverage-info">
                                Cargando métricas de profundidad...
                            </p>
                        </div>
                        <div class="w-full md:w-48 h-48 bg-white/5 rounded-3xl flex items-center justify-center p-6 border border-white/5 shadow-inner">
                            <canvas id="chart-s13-mini"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Strategic Quick Look -->
                <div class="glass-card bg-indigo-50/50 dark:bg-gradient-to-br dark:from-indigo-600/20 dark:to-violet-600/20 backdrop-blur-3xl rounded-[2.2rem] p-8 border border-slate-200 dark:border-white/10 flex flex-col justify-between group shadow-xl">
                    <div class="flex justify-between items-start">
                        <div class="w-12 h-12 bg-indigo-500/10 dark:bg-white/10 rounded-xl flex items-center justify-center text-xl text-indigo-600 dark:text-white shadow-inner border border-indigo-500/5 dark:border-white/5">
                            <i class="fas fa-wand-magic-sparkles"></i>
                        </div>
                        <span class="text-[8px] font-black text-slate-400 dark:text-white/50 uppercase tracking-[0.2em]">Foco Estratégico</span>
                    </div>
                    <div class="space-y-4">
                        <div class="space-y-1">
                            <p class="text-[10px] font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest">Mayor Rezago (S-13)</p>
                            <p class="text-2xl font-black text-slate-800 dark:text-white tracking-tighter" id="stat-s13-oldest">#--</p>
                            <p class="text-[9px] text-indigo-600/60 dark:text-indigo-200/40 font-bold uppercase" id="stat-s13-oldest-info">Escaneando historial...</p>
                        </div>
                        <div class="h-px bg-slate-200 dark:bg-white/10"></div>
                        <div class="space-y-1">
                            <p class="text-[10px] font-black text-violet-600 dark:text-violet-300 uppercase tracking-widest">Punto de Enfoque</p>
                            <p class="text-xl font-black text-slate-800 dark:text-white truncate" id="stat-s13-frequent">--</p>
                            <p class="text-[9px] text-violet-600/60 dark:text-violet-200/40 font-bold uppercase" id="stat-s13-frequent-info">Nivel de rotación</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Charts Row -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Current Status Chart -->
                <div class="modern-card p-4 sm:p-6 md:p-10 flex flex-col bg-white dark:bg-white/[0.02] shadow-xl hover:shadow-indigo-500/5 transition-all">
                    <h3 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                        <span class="w-8 h-[2px] bg-indigo-500 rounded-full"></span>
                        Estado Operativo
                    </h3>
                    <div class="flex-1 relative min-h-[250px]">
                        <canvas id="chart-status"></canvas>
                    </div>
                </div>

                <!-- Frequency Chart -->
                <div class="lg:col-span-2 modern-card p-4 sm:p-6 md:p-10 flex flex-col bg-white dark:bg-white/[0.02] shadow-xl hover:shadow-emerald-500/5 transition-all">
                    <h3 class="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                        <span class="w-8 h-[2px] bg-emerald-500 rounded-full"></span>
                        Frecuencia de Trabajo (Top 10 S-13)
                    </h3>
                    <div class="flex-1 relative min-h-[250px]">
                        <canvas id="chart-territories"></canvas>
                    </div>
                </div>
            </div>

            <!-- Critical Table Row -->
            <div class="modern-card !p-0 overflow-hidden flex-1 flex flex-col min-h-[400px] border-rose-500/20 shadow-2xl bg-white dark:bg-white/[0.02]">
                <div class="p-8 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center bg-rose-500/[0.02] gap-4">
                    <div class="flex items-center gap-5">
                        <div class="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 text-2xl relative">
                             <div class="absolute inset-0 bg-rose-500 animate-pulse opacity-10 rounded-2xl"></div>
                             <i class="fas fa-clock relative z-10"></i>
                        </div>
                        <div>
                            <h3 class="text-xl md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Atrasos en Posesión</h3>
                            <p class="text-[9px] text-rose-500/60 font-black uppercase tracking-[0.2em] mt-1">Intervención Urgente recomendada</p>
                        </div>
                    </div>
                    <div class="px-6 py-2.5 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/30 animate-pulse">
                        Acción Requerida
                    </div>
                </div>
                <div class="table-container overflow-x-auto p-0">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-100/50 dark:bg-black/40 text-[10px] uppercase font-black text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/5">
                                <th class="px-8 py-6">Territorio</th>
                                <th class="px-8 py-6">Responsable</th>
                                <th class="px-8 py-6">Asignación</th>
                                <th class="px-8 py-6">Tiempo</th>
                                <th class="px-8 py-6 text-right">Gravedad</th>
                            </tr>
                        </thead>
                        <tbody id="late-table-body" class="divide-y divide-gray-100 dark:divide-white/5 text-sm">
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
