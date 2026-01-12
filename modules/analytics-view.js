import { getTerritorios, getConductores, getGlobalSettings, getHistorialReport } from '../data/firestore-services.js?v=3.6.0';

export const renderAnalyticsView = async (container) => {
    // 1. Fetch settings FIRST to use in the template
    let settings = {};
    try {
        settings = await getGlobalSettings();
    } catch (e) {
        console.warn("Could not fetch settings for initial render", e);
    }

    container.innerHTML = `
        <div class="h-full flex flex-col gap-8 animate-fade-in custom-scrollbar pb-10">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 dark:border-white/5 pb-8 gap-6">
                <div class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-3xl text-primary shadow-inner border border-primary/10 animate-float">
                        <i class="fas fa-chart-pie"></i>
                    </div>
                    <div>
                        <h2 class="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                            Panel de Control
                        </h2>
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1 opacity-70">
                            Visión general y métricas clave
                        </p>
                    </div>
                </div>
                <button id="btn-refresh-analytics" class="w-full md:w-auto px-8 py-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 rounded-2xl border border-slate-200 dark:border-white/10 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-95">
                    <i class="fas fa-sync-alt"></i> Actualizar
                </button>
            </header>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="modern-card !p-5 md:!p-8 relative overflow-hidden group hover:border-primary/30 transition-all shadow-xl hover:shadow-primary/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-4">Total Territorios</p>
                        <div class="text-5xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter" id="stat-total-terr">-</div>
                        <div class="mt-6 flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                            <i class="fas fa-globe-americas"></i> Cobertura Global
                        </div>
                    </div>
                </div>
                
                <div class="modern-card !p-5 md:!p-8 relative overflow-hidden group hover:border-blue-500/30 transition-all shadow-xl hover:shadow-blue-500/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-4">Asignados</p>
                        <div class="text-5xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter" id="stat-assigned">-</div>
                        <div class="mt-6 flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase tracking-widest" id="stat-assigned-pct">
                            <i class="fas fa-user-check"></i> 0% del total
                        </div>
                    </div>
                </div>

                <div class="modern-card !p-5 md:!p-8 relative overflow-hidden group hover:border-indigo-500/30 transition-all shadow-xl hover:shadow-indigo-500/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-4">Conductores</p>
                        <div class="text-5xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter" id="stat-conductors">-</div>
                        <div class="mt-6 flex items-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-widest">
                            <i class="fas fa-users"></i> Activos en servicio
                        </div>
                    </div>
                </div>

                <div class="modern-card !p-5 md:!p-8 relative overflow-hidden group hover:border-rose-500/30 transition-all shadow-xl hover:shadow-rose-500/5 bg-white dark:bg-white/[0.02]">
                    <div class="absolute right-0 top-0 w-32 h-32 bg-rose-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="relative z-10">
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-4">Atrasados (>${settings?.expiration_days ? Math.round(settings.expiration_days / 30) : 4}m)</p>
                        <div class="text-5xl font-black text-slate-800 dark:text-white tabular-nums tracking-tighter" id="stat-late">-</div>
                        <div class="mt-6 flex items-center gap-2 text-rose-500 font-black text-[10px] uppercase tracking-widest">
                            <i class="fas fa-exclamation-triangle"></i> Requieren atención
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
                <div class="modern-card p-10 flex flex-col bg-white dark:bg-white/[0.02]">
                    <h3 class="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                        <span class="w-8 h-[1px] bg-slate-300 dark:bg-white/10"></span>
                        Estado de Territorios
                    </h3>
                    <div class="flex-1 relative min-h-[300px]">
                        <canvas id="chart-status"></canvas>
                    </div>
                </div>

                <div class="lg:col-span-2 modern-card p-10 flex flex-col bg-white dark:bg-white/[0.02]">
                    <h3 class="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                        <span class="w-8 h-[1px] bg-slate-300 dark:bg-white/10"></span>
                        Frecuencia de Trabajo
                    </h3>
                    <div class="flex-1 relative min-h-[300px]">
                        <canvas id="chart-territories"></canvas>
                    </div>
                </div>
            </div>

            <div class="modern-card !p-0 overflow-hidden flex-1 flex flex-col min-h-[400px] border-rose-500/20 shadow-2xl bg-white dark:bg-white/[0.02]">
                <div class="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-rose-500/[0.02]">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                            <i class="fas fa-exclamation-circle"></i>
                        </div>
                        <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Territorios con Atraso Crítico</h3>
                    </div>
                    <span class="text-[10px] font-black bg-rose-500 text-white px-4 py-2 rounded-xl uppercase tracking-widest shadow-lg shadow-rose-500/20 animate-pulse">Prioridad Alta</span>
                </div>
                <div class="table-container overflow-auto flex-1 p-0">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-gray-50 dark:bg-black/20 text-xs uppercase text-gray-500 dark:text-gray-400 sticky top-0 z-10 backdrop-blur-md">
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
            
            <div class="text-center text-xs text-gray-400 py-4">
                App Territorios v3.6.0 Oficial • Powered by Antigravity
            </div>
        </div>>
    `;

    // Load Data
    const loadData = async () => {
        try {
            const [territorios, conductores, historial] = await Promise.all([
                getTerritorios(),
                getConductores(),
                getHistorialReport()
            ]);

            // Reuse settings fetched at top

            const expDays = settings?.expiration_days || 120; // Default 120

            // Calculate Stats
            const total = territorios.length;
            const assigned = territorios.filter(t => t.estado === 'Asignado');
            const assignedCount = assigned.length;
            const assignedPct = total > 0 ? Math.round((assignedCount / total) * 100) : 0;

            // Check Late (> 4 months / 120 days)
            const now = new Date();
            const lateTerritories = assigned.filter(t => {
                if (!t.fecha_asignacion) return false;
                const d = new Date(t.fecha_asignacion);
                const diffTime = Math.abs(now - d);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays > expDays;
            });

            // Update DOM Stats
            document.getElementById('stat-total-terr').innerText = total;
            document.getElementById('stat-assigned').innerText = assignedCount;
            document.getElementById('stat-assigned-pct').innerText = `${assignedPct}% del total`;
            document.getElementById('stat-conductors').innerText = conductores.length;
            document.getElementById('stat-late').innerText = lateTerritories.length;

            // Render Chart 1: Status
            const ctxStatus = document.getElementById('chart-status').getContext('2d');
            new Chart(ctxStatus, {
                type: 'doughnut',
                data: {
                    labels: ['Disponible', 'Asignado', 'Atrasado'],
                    datasets: [{
                        data: [
                            total - assignedCount,
                            assignedCount - lateTerritories.length,
                            lateTerritories.length
                        ],
                        backgroundColor: ['#e2e8f0', '#0f766e', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { family: 'Inter' } } }
                    }
                }
            });

            // Render Chart 2: Most Worked Territories
            // Count completions per territory
            const terrFreqMap = {};
            historial.forEach(entry => {
                if (entry.estado === 'Completado' && entry.numero) {
                    const num = entry.numero.toString().trim();
                    terrFreqMap[num] = (terrFreqMap[num] || 0) + 1;
                }
            });

            // If history is empty, maybe count assignments (even if not yet completed)
            if (Object.keys(terrFreqMap).length === 0) {
                historial.forEach(entry => {
                    if (entry.numero) {
                        const num = entry.numero.toString().trim();
                        terrFreqMap[num] = (terrFreqMap[num] || 0) + 1;
                    }
                });
            }

            // Sort top 10
            const sortedTerrFreq = Object.entries(terrFreqMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const ctxTerr = document.getElementById('chart-territories').getContext('2d');
            new Chart(ctxTerr, {
                type: 'bar',
                data: {
                    labels: sortedTerrFreq.map(x => `Terr.${x[0]} `),
                    datasets: [{
                        label: 'Veces Trabajado',
                        data: sortedTerrFreq.map(x => x[1]),
                        backgroundColor: '#0f766e', // Teal color for consistency
                        borderRadius: 6,
                        barThickness: 20
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.05)' },
                            ticks: { precision: 0 }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                autoSkip: true
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `Trabajado ${context.raw} veces`
                            }
                        }
                    }
                }
            });

            // Render Late Table
            const tbody = document.getElementById('late-table-body');
            tbody.innerHTML = lateTerritories.sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion)).map(t => {
                const d = new Date(t.fecha_asignacion);
                const diffTime = Math.abs(now - d);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group cursor-pointer">
                        <td class="p-4 font-bold text-gray-800 dark:text-gray-200">${t.numero}</td>
                        <td class="p-4 text-gray-600 dark:text-gray-400">${t.asignado_a}</td>
                        <td class="p-4 text-gray-500">${d.toLocaleDateString()}</td>
                        <td class="p-4 font-bold text-red-500">${diffDays} días</td>
                    </tr>
                `;
            }).join('');

            if (lateTerritories.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="p-20 text-center">
                    <div class="flex flex-col items-center gap-4 opacity-30 group">
                        <div class="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-2xl text-emerald-500 group-hover:scale-110 transition-transform">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <p class="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Sin territorios atrasados</p>
                    </div>
                </td></tr>`;
            }

        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="text-red-500 p-5"> Error cargando analytics: ${e.message}</div>> `;
        }
    };

    loadData();
    document.getElementById('btn-refresh-analytics').addEventListener('click', () => {
        // Simple re-render
        renderAnalyticsView(container);
    });
};





