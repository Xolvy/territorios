import { getTerritorios, getConductores, getGlobalSettings, getHistorialReport } from '../data/firestore-services.js?v=2.5.1';

export const renderAnalyticsView = async (container) => {
    // 1. Fetch settings FIRST to use in the template
    let settings = {};
    try {
        settings = await getGlobalSettings();
    } catch (e) {
        console.warn("Could not fetch settings for initial render", e);
    }

    container.innerHTML = `
        <div class="h-full flex flex-col gap-6 animate-fade-in custom-scrollbar">
            <header class="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-6">
                <div>
                    <h2 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-500">
                        📊 Panel de Control
                    </h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        Visión general del estado de la congregación y métricas clave.
                    </p>
                </div>
                <button id="btn-refresh-analytics" class="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="Actualizar">
                    <span class="text-xl">↻</span>
                </button>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-white dark:bg-[#181a1f] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group">
                    <div class="absolute right-0 top-0 w-24 h-24 bg-teal-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <h3 class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Territorios</h3>
                    <div class="text-4xl font-black text-gray-800 dark:text-gray-100" id="stat-total-terr">-</div>
                    <div class="text-xs text-teal-600 mt-2 font-medium">Cobertura Global</div>
                </div>
                
                <div class="bg-white dark:bg-[#181a1f] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group">
                    <div class="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <h3 class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Asignados</h3>
                    <div class="text-4xl font-black text-gray-800 dark:text-gray-100" id="stat-assigned">-</div>
                    <div class="text-xs text-blue-500 mt-2 font-medium" id="stat-assigned-pct">0% del total</div>
                </div>

                <div class="bg-white dark:bg-[#181a1f] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group">
                    <div class="absolute right-0 top-0 w-24 h-24 bg-purple-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <h3 class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Conductores</h3>
                    <div class="text-4xl font-black text-gray-800 dark:text-gray-100" id="stat-conductors">-</div>
                    <div class="text-xs text-purple-500 mt-2 font-medium">Activos en servicio</div>
                </div>

                <div class="bg-white dark:bg-[#181a1f] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group">
                    <div class="absolute right-0 top-0 w-24 h-24 bg-red-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <h3 class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Atrasados (>${settings?.expiration_days ? Math.round(settings.expiration_days / 30) : 4}m)</h3>
                    <div class="text-4xl font-black text-gray-800 dark:text-gray-100" id="stat-late">-</div>
                    <div class="text-xs text-red-500 mt-2 font-medium">Requieren atención</div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
                <div class="bg-white dark:bg-[#181a1f] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 flex flex-col">
                    <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6">Estado de Territorios</h3>
                    <div class="flex-1 relative">
                        <canvas id="chart-status"></canvas>
                    </div>
                </div>

                <div class="lg:col-span-2 bg-white dark:bg-[#181a1f] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 flex flex-col">
                    <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 font-primary">Frecuencia de Trabajo por Territorio</h3>
                    <div class="flex-1 relative">
                        <canvas id="chart-territories"></canvas>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-[#181a1f] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden flex-1 flex flex-col min-h-[300px]">
                <div class="p-6 border-b border-black/5 dark:border-white/5 flex justify-between items-center">
                    <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100">🚫 Territorios que requieren atención inmediata</h3>
                    <span class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg font-bold animate-pulse">Prioridad Alta</span>
                </div>
                <div class="overflow-auto flex-1 p-0">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-gray-50 dark:bg-black/20 text-xs uppercase text-gray-500 dark:text-gray-400 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th class="p-4 font-semibold">Territorio</th>
                                <th class="p-4 font-semibold">Conductor</th>
                                <th class="p-4 font-semibold">Fecha Asignación</th>
                                <th class="p-4 font-semibold">Tiempo Transcurrido</th>
                            </tr>
                        </thead>
                        <tbody id="late-table-body" class="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="text-center text-xs text-gray-400 py-4">
                App Territorios v2.5.1 Oficial • Powered by Antigravity
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
                    labels: sortedTerrFreq.map(x => `Terr. ${x[0]}`),
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
                        x: { grid: { display: false } }
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
                tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-gray-400">🎉 ¡Excelente! No hay territorios atrasados.</td></tr>`;
            }

        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="text-red-500 p-5">Error cargando analytics: ${e.message}</div>`;
        }
    };

    loadData();
    document.getElementById('btn-refresh-analytics').addEventListener('click', () => {
        // Simple re-render
        renderAnalyticsView(container);
    });
};





