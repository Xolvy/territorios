import Chart from 'chart.js/auto';
import { getTerritorios, getConductores, getGlobalSettings, getHistorialReport, getGlobalStats, resyncGlobalStats } from '../data/firestore-services.js';
import { showNotification } from './utils/helpers.js';
import { UIHelpers, showModal } from './services/ui-helpers.js';
import { ServiceCache } from '../data/services/base-service.js';
import { ReceptionHub } from './services/reception-hub.js';

// --- Helper UI Components ---
const renderStatCard = (label, id, icon, color, sub) => `
    <div class="flex flex-col bg-white dark:bg-slate-900 p-5 lg:p-8 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
        <div class="flex justify-between items-start mb-4">
             <div class="w-10 h-10 lg:w-12 lg:h-12 bg-slate-50 dark:bg-white/5 text-slate-400 group-hover:text-blue-600 rounded-xl flex items-center justify-center text-sm lg:text-lg transition-colors border border-slate-100 dark:border-white/5">
                <i class="${icon}"></i>
            </div>
            <div class="h-1.5 w-1.5 rounded-full bg-slate-200 dark:bg-white/10 group-hover:bg-blue-500 transition-colors"></div>
        </div>
        <div>
            <p class="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1 font-sans truncate">${label}</p>
            <div class="flex items-baseline gap-2">
                <span class="text-3xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tighter tabular-nums" id="${id}">0</span>
                <span class="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest pb-1 border-b border-slate-100 dark:border-white/5 truncate">${sub.split(' ')[0]}</span>
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
                    backgroundColor: ['#e2e8f0', '#3b82f6', '#ef4444'],
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
                    backgroundColor: '#3b82f6',
                    borderRadius: 6,
                    maxBarThickness: 32,
                    hoverBackgroundColor: '#059669'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { size: window.innerWidth < 768 ? 8 : 9 } } },
                    x: { grid: { display: false }, ticks: { font: { size: window.innerWidth < 768 ? 8 : 10, weight: 'bold' } } }
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
                    backgroundColor: ['#3b82f6', 'rgba(0,0,0,0.05)'],
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
        const date = UIHelpers.parseFirebaseDate(t.fecha_asignacion) || new Date();
        const diff = Math.ceil(Math.abs(now - date) / (1000 * 60 * 60 * 24));
        const gravity = diff > 2 ? 'CRÍTICO' : 'PRECAUCIÓN';
        const color = diff > 2 ? 'red' : 'yellow';

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors group">
                <td class="px-4 lg:px-8 py-5">
                    <div class="flex items-center gap-4">
                        <span class="w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-sm transition-transform">${t.numero}</span>
                        <div class="flex flex-col min-w-0">
                            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase truncate max-w-[150px] font-sans">${t.localidad || 'Congregación'}</span>
                            ${(() => {
                                const todas = t.manzanas ? t.manzanas.split(',').map(m => m.trim()).filter(Boolean) : [];
                                const faltantes = todas.filter(m => !t.manzanas_trabajadas?.includes(m));
                                if (t.manzanas_trabajadas?.length > 0 && faltantes.length > 0) {
                                    const label = faltantes.length === 1 ? 'Falta Mz' : 'Faltan Mz';
                                    return `<span class="text-[8px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest mt-0.5">Territorio incompleto: ${label} ${faltantes.join(', ')}</span>`;
                                }
                                return '';
                            })()}
                        </div>
                    </div>
                </td>
                <td class="px-4 lg:px-8 py-5 whitespace-nowrap">
                    <span class="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">${t.asignado_a}</span>
                </td>
                <td class="px-4 lg:px-8 py-5 text-[11px] font-medium text-slate-400 whitespace-nowrap">
                    ${date.toLocaleDateString()}
                </td>
                <td class="px-4 lg:px-8 py-5 whitespace-nowrap">
                    <span class="text-[11px] font-bold text-${color}-700 bg-${color}-50 px-2.5 py-1 rounded-full ring-1 ring-${color}-200/50 whitespace-nowrap">${diff} días</span>
                </td>
                <td class="px-4 lg:px-8 py-5 whitespace-nowrap text-right">
                    <span class="text-[10px] font-bold text-${color}-600 uppercase tracking-wider">${gravity}</span>
                </td>
            </tr>
        `;
    }).join('');
};

export const renderAnalyticsView = async (container, appVersion, configData = null) => {
    // 1. Fetch settings (global_settings) while acknowledging injected config (general)
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
                        <span class="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-widest rounded border border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-400/20">Core Stats</span>
                        <div class="h-px w-8 bg-slate-200 dark:bg-white/10"></div>
                    </div>
                    <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Métricas Operativas</h2>
                    <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">S-13 Intelligence Engine</p>
                </div>

                <div class="flex items-center gap-3 w-full md:w-auto">
                    <button id="btn-resync-stats" class="px-5 py-3.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-600 transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm active:scale-95 group">
                        <i class="fas fa-shield-halved opacity-40 group-hover:opacity-100"></i> Recalcular
                    </button>
                    <button id="btn-refresh-analytics" class="flex-1 md:flex-none px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm shadow-blue-200 active:scale-95 group">
                        <i class="fas fa-sync-alt opacity-70 group-hover:rotate-180 transition-transform duration-700"></i> Actualizar Informe
                    </button>
                </div>
            </header>

            <!-- Grid de Tarjetas de Impacto -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                ${renderStatCard('Inventario Total', 'stat-total-terr', 'fas fa-boxes-stacked', 'blue', 'Catálogo Maestro')}
                ${renderStatCard('Territorios en Calle', 'stat-assigned', 'fas fa-map-location-dot', 'blue', 'Asignados ahora')}
                ${renderStatCard('Fuerza Operativa', 'stat-conductors', 'fas fa-users-gear', 'blue', 'Conductores activos')}
                ${renderStatCard('Atrasos Críticos', 'stat-late', 'fas fa-triangle-exclamation', 'rose', 'Requiere intervención')}
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
                            <div class="flex items-baseline gap-2 lg:gap-3 flex-wrap">
                                <span class="text-4xl lg:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tighter tabular-nums" id="stat-s13-coverage">0%</span>
                                <span class="text-blue-600 font-bold text-[10px] lg:text-xs bg-blue-50 px-2 py-1 rounded whitespace-nowrap" id="stat-s13-diff">+0% Trend</span>
                            </div>
                            <div class="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <div id="stat-s13-progress-bar" class="h-full bg-blue-600 rounded-full transition-all duration-1000" style="width: 0%"></div>
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
                <div class="bg-slate-900 dark:bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-lg shadow-slate-100 dark:shadow-none flex flex-col justify-between group">
                    <div class="flex justify-between items-start mb-6">
                        <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white border border-white/20">
                            <i class="fas fa-bolt-lightning text-xs"></i>
                        </div>
                        <span class="text-[9px] font-bold text-white/50 uppercase tracking-[0.2em]">S-13 Priority</span>
                    </div>
                    <div class="space-y-6">
                        <div class="space-y-1">
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Mayor Rezago</p>
                            <p class="text-3xl font-extrabold text-white tracking-tighter" id="stat-s13-oldest">#--</p>
                            <p class="text-[10px] text-white/60 font-medium" id="stat-s13-oldest-info">Escaneando historial...</p>
                        </div>
                        <div class="h-px bg-white/10"></div>
                        <div class="space-y-1">
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Punto de Enfoque</p>
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
                        <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                        Estado Operativo
                    </h3>
                    <div class="flex-1 relative min-h-[260px]">
                        <canvas id="chart-status"></canvas>
                    </div>
                </div>

                <!-- Frequency Chart -->
                <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-white/5 shadow-sm flex flex-col">
                    <h3 class="text-[10px] lg:text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                        <span class="truncate">Frecuencia de Trabajo (Top 10 S-13)</span>
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
                    <div class="flex items-center gap-3">
                        <div class="px-4 py-2 bg-rose-50 text-rose-700 ring-1 ring-rose-200 rounded-full text-[10px] font-bold uppercase tracking-widest">
                            Intervención Requerida
                        </div>
                        <button onclick="ReceptionHub.openModal({ viewMode: 'admin', isAdmin: true })" 
                                class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
                            GESTIONAR ENTREGAS
                        </button>
                    </div>
                </div>
                <div class="w-full overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left border-collapse min-w-max">
                        <thead class="table-header-group">
                            <tr class="bg-gray-100/50 dark:bg-black/40 text-[10px] uppercase font-black text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/5">
                                <th class="px-4 lg:px-8 py-6">Territorio</th>
                                <th class="px-4 lg:px-8 py-6">Responsable</th>
                                <th class="px-4 lg:px-8 py-6">Asignación</th>
                                <th class="px-4 lg:px-8 py-6">Tiempo</th>
                                <th class="px-4 lg:px-8 py-6 text-right">Gravedad</th>
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
            // PASO 3: Invalidar caché para asegurar datos frescos en métricas
            ServiceCache.clear('territorios_combined');

            const [territorios, conductores, historial, globalStats] = await Promise.all([
                getTerritorios(),
                getConductores(),
                getHistorialReport(),
                getGlobalStats()
            ]);

            // PASO 2: Logs de diagnóstico temporales
            console.log('[Analytics Debug] Total territorios obtenidos:', territorios.length);
            console.log('[Analytics Debug] Estados únicos encontrados:', 
                [...new Set(territorios.map(t => t.estado))]);
            console.log('[Analytics Debug] Territorios con estado Asignado:', 
                territorios.filter(t => t.estado === 'Asignado').map(t => ({ id: t.id, numero: t.numero, estado: t.estado, asignado_a: t.asignado_a })));


            const expDays = settings?.expiration_days || 120;

            // Xolvy Intelligence: Use aggregated stats for primary metrics, fallback to calculated if needed
            const total = globalStats.total_territorios || territorios.length;
            const assignedCount = globalStats.territorios_asignados !== undefined ? globalStats.territorios_asignados : territorios.filter(t => t.estado === 'Asignado').length;
            const assigned = territorios.filter(t => t.estado === 'Asignado');

            const now = new Date();
            const lateTerritories = assigned.filter(t => {
                if (!t.fecha_asignacion) return false;
                const d = UIHelpers.parseFirebaseDate(t.fecha_asignacion) || new Date();
                const diffDays = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24));
                return diffDays >= 2;
            }).sort((a, b) => {
                const dA = UIHelpers.parseFirebaseDate(a.fecha_asignacion) || new Date();
                const dB = UIHelpers.parseFirebaseDate(b.fecha_asignacion) || new Date();
                return dA - dB;
            });

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

            const rezagoSorted = territorios.filter(t => latestTouch[t.numero]).sort((a, b) => {
                const dA = UIHelpers.parseFirebaseDate(latestTouch[a.numero]) || new Date(0);
                const dB = UIHelpers.parseFirebaseDate(latestTouch[b.numero]) || new Date(0);
                return dA - dB;
            });
            const oldestTerritory = rezagoSorted[0]?.numero || '--';
            const latestDate = UIHelpers.parseFirebaseDate(latestTouch[oldestTerritory]) || new Date();
            const daysRezago = oldestTerritory !== '--' ? Math.floor((new Date() - latestDate) / (1000 * 60 * 60 * 24)) : 0;

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

        // No actions needed for individual IDs as per BUG 3 requirements
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
