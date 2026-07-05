import Chart from "chart.js/auto";
import {
    getConductores,
    getGlobalSettings,
    getGlobalStats,
    getHistorialReport,
    getTerritorios,
    resyncGlobalStats,
} from "../data/firestore-services.js";
import { ServiceCache } from "../data/services/base-service.js";
import { UIHelpers } from "./services/ui-helpers.js";
import { showNotification } from "./utils/helpers.js";

// --- Helper UI Components ---
const renderStatCard = (label, id, icon, _color, sub) => {
    let theme = {
        bg: "from-blue-500/10 to-indigo-500/5",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-500/20 dark:border-blue-500/10",
        light: "bg-blue-500/20",
        dot: "bg-blue-500",
    };
    if (id === "stat-assigned") {
        theme = {
            bg: "from-emerald-500/10 to-teal-500/5",
            text: "text-emerald-600 dark:text-emerald-400",
            border: "border-emerald-500/20 dark:border-emerald-500/10",
            light: "bg-emerald-500/20",
            dot: "bg-emerald-500",
        };
    } else if (id === "stat-conductors") {
        theme = {
            bg: "from-violet-500/10 to-purple-500/5",
            text: "text-violet-600 dark:text-violet-400",
            border: "border-violet-500/20 dark:border-violet-500/10",
            light: "bg-violet-500/20",
            dot: "bg-violet-500",
        };
    } else if (id === "stat-late") {
        theme = {
            bg: "from-rose-500/10 to-red-500/5",
            text: "text-rose-600 dark:text-rose-400",
            border: "border-rose-500/20 dark:border-rose-500/10",
            light: "bg-rose-500/20",
            dot: "bg-rose-500",
        };
    }

    return `
    <div class="super-card flex flex-col p-6 lg:p-8 hover:-translate-y-1.5 transition-all group overflow-hidden relative">
        <div class="absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-30 group-hover:opacity-100 transition-opacity pointer-events-none duration-500"></div>
        <div class="flex justify-between items-start mb-6 relative z-10">
             <div class="w-12 h-12 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center text-lg ${theme.text} transition-colors border border-slate-100 dark:border-white/5 shadow-sm group-hover:scale-110 duration-500 shrink-0">
                <i class="${icon}"></i>
            </div>
            <span class="relative flex h-2 w-2">
                <span class="saas-spinner-ring animate-ping ${theme.light} opacity-75 rounded-full w-2 h-2"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 ${theme.dot}"></span>
            </span>
        </div>
        <div class="relative z-10">
            <p class="text-[9px] lg:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 font-sans truncate">${label}</p>
            <div class="flex items-baseline gap-2">
                <span class="text-3xl lg:text-5xl font-black text-slate-800 dark:text-white tracking-tighter tabular-nums" id="${id}">0</span>
                <span class="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest pb-1 border-b border-slate-200/50 dark:border-white/5 truncate">${sub}</span>
            </div>
        </div>
    </div>
    `;
};

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
    // --- XOLVY DARK MODE ADAPTATION ---
    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#94a3b8" : "#64748b"; // slate-400 / slate-500
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    const trackColor = isDark ? "rgba(255, 255, 255, 0.05)" : "#f1f5f9"; // slate-100
    const strokeColor = isDark ? "#0f172a" : "#ffffff"; // slate-900 / white

    // Prevenir superposición de instancias de Chart.js al cambiar de tema (Hot Reload)
    ["chart-status", "chart-territories", "chart-s13-mini"].forEach((id) => {
        const existingChart = Chart.getChart(id);
        if (existingChart) existingChart.destroy();
    });

    // Doughnut: Status
    const ctxStatus = document.getElementById("chart-status")?.getContext("2d");
    if (ctxStatus) {
        new Chart(ctxStatus, {
            type: "doughnut",
            data: {
                labels: ["Disponibles", "En Tiempo", "Vencidos"],
                datasets: [
                    {
                        data: [total - assigned, assigned - late, late],
                        backgroundColor: [trackColor, "#3b82f6", "#f43f5e"],
                        borderColor: strokeColor,
                        borderWidth: 2,
                        hoverOffset: 10,
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "82%",
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: textColor,
                            usePointStyle: true,
                            padding: 25,
                            font: { weight: "bold", size: 10 },
                        },
                    },
                },
            },
        });
    }

    // Bar: Frequency
    const ctxFreq = document.getElementById("chart-territories")?.getContext("2d");
    if (ctxFreq) {
        const sorted = Object.entries(freqMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        new Chart(ctxFreq, {
            type: "bar",
            data: {
                labels: sorted.map((x) => `#${x[0]}`),
                datasets: [
                    {
                        label: "Veces Trabajado",
                        data: sorted.map((x) => x[1]),
                        backgroundColor: "#3b82f6",
                        borderRadius: 6,
                        maxBarThickness: 32,
                        hoverBackgroundColor: "#10b981", // emerald-500
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        border: { display: false },
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { size: window.innerWidth < 768 ? 8 : 9 } },
                    },
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { color: textColor, font: { size: window.innerWidth < 768 ? 8 : 10, weight: "bold" } },
                    },
                },
                plugins: { legend: { display: false } },
            },
        });
    }

    // Radial: Tiny S-13
    const ctxMini = document.getElementById("chart-s13-mini")?.getContext("2d");
    if (ctxMini) {
        new Chart(ctxMini, {
            type: "doughnut",
            data: {
                datasets: [
                    {
                        data: [coverage, 100 - coverage],
                        backgroundColor: ["#3b82f6", trackColor],
                        borderWidth: 0,
                        circumference: 270,
                        rotation: 225,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "88%",
                plugins: { tooltip: { enabled: false } },
            },
        });
    }
};

const renderLateTable = (list, now, exp) => {
    const tbody = document.getElementById("late-table-body");
    if (!tbody) return;
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-24 text-center opacity-30 text-[10px] font-black uppercase tracking-widest italic">Excelente: No hay territorios con atraso crítico</td></tr>`;
        return;
    }

    tbody.innerHTML = list
        .map((t) => {
            const date = UIHelpers.parseFirebaseDate(t.fecha_asignacion) || new Date();
            const diff = Math.ceil((now - date) / (1000 * 60 * 60 * 24));
            const threshold = exp || 120;
            const isCritical = diff >= threshold;
            const gravity = isCritical ? "CRÍTICO" : "PRECAUCIÓN";
            const color = isCritical ? "red" : "yellow";

            return `
            <tr class="block md:table-row mb-4 md:mb-0 border border-slate-100 dark:border-white/5 md:border-0 rounded-xl md:rounded-none bg-white dark:bg-white/[0.01] md:bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group p-4 md:p-0 animate-fade-in">
                <td class="block md:table-cell px-2 md:px-4 lg:px-8 py-3 md:py-5 border-b border-slate-50 dark:border-white/5 md:border-0 text-left">
                    <div class="flex items-center gap-4">
                        <span class="w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-sm transition-transform">${t.numero}</span>
                        <div class="flex flex-col min-w-0">
                            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase truncate max-w-[150px] font-sans">${t.localidad || "Congregación"}</span>
                            ${(() => {
                                const todas = t.manzanas
                                    ? t.manzanas
                                          .split(",")
                                          .map((m) => m.trim())
                                          .filter(Boolean)
                                    : [];
                                const faltantes = todas.filter((m) => !t.manzanas_trabajadas?.includes(m));
                                if (t.manzanas_trabajadas?.length > 0 && faltantes.length > 0) {
                                    const label = faltantes.length === 1 ? "Falta Mz" : "Faltan Mz";
                                    return `<span class="text-[8px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest mt-0.5">Territorio incompleto: ${label} ${faltantes.join(", ")}</span>`;
                                }
                                return "";
                            })()}
                        </div>
                    </div>
                </td>
                <td class="block md:table-cell px-2 md:px-4 lg:px-8 py-3 md:py-5 border-b border-slate-50 dark:border-white/5 md:border-0 text-left">
                    <div class="flex justify-between md:block w-full">
                        <span class="md:hidden text-[9px] font-black uppercase text-slate-400">Responsable:</span>
                        <span class="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">${t.asignado_a}</span>
                    </div>
                </td>
                <td class="block md:table-cell px-2 md:px-4 lg:px-8 py-3 md:py-5 border-b border-slate-50 dark:border-white/5 md:border-0 text-left">
                    <div class="flex justify-between md:block w-full">
                        <span class="md:hidden text-[9px] font-black uppercase text-slate-400">Asignación:</span>
                        <span class="text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">${date.toLocaleDateString()}</span>
                    </div>
                </td>
                <td class="block md:table-cell px-2 md:px-4 lg:px-8 py-3 md:py-5 border-b border-slate-50 dark:border-white/5 md:border-0 text-left">
                    <div class="flex justify-between md:block w-full">
                        <span class="md:hidden text-[9px] font-black uppercase text-slate-400">Tiempo:</span>
                        <span class="text-[11px] font-bold text-${color}-700 bg-${color}-50 px-2.5 py-1 rounded-full ring-1 ring-${color}-200/50 whitespace-nowrap">${diff} días</span>
                    </div>
                </td>
                <td class="block md:table-cell px-2 md:px-4 lg:px-8 py-3 md:py-5 text-right border-b border-slate-50 dark:border-white/5 md:border-0">
                    <div class="flex justify-between md:block w-full text-right">
                        <span class="md:hidden text-[9px] font-black uppercase text-slate-400">Gravedad:</span>
                        <span class="text-[10px] font-bold text-${color}-600 uppercase tracking-wider">${gravity}</span>
                    </div>
                </td>
                <td class="block md:table-cell px-2 md:px-4 lg:px-8 py-3 md:py-5 text-right">
                    <div class="flex justify-between md:block w-full text-right">
                        <span class="md:hidden text-[9px] font-black uppercase text-slate-400">Acción:</span>
                        <button class="btn-entregar-critico px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 inline-flex items-center justify-center gap-1 shadow-md shadow-emerald-500/10" data-tid="${t.id}" data-num="${t.numero}">
                            <i class="fas fa-check-circle"></i> Entregar
                        </button>
                    </div>
                </td>
            </tr>
        `;
        })
        .join("");
};

export const renderAnalyticsView = async (container, appVersion, _configData = null) => {
    // 1. Fetch settings (global_settings) while acknowledging injected config (general)
    let settings = {};
    try {
        settings = await getGlobalSettings();
    } catch (e) {
        console.warn("Could not fetch settings for initial render", e);
    }

    container.innerHTML = `
        <div class="flex flex-col gap-12 animate-fade-in w-full max-w-[100vw] overflow-hidden">
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

                <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button id="btn-resync-stats" class="flex-1 min-w-0 md:flex-none px-5 py-3.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-600 transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm active:scale-95 group whitespace-normal text-center h-auto min-h-[48px]">
                        <i class="fas fa-shield-halved opacity-40 group-hover:opacity-100"></i> Recalcular
                    </button>
                    <button id="btn-refresh-analytics" class="flex-1 min-w-0 md:flex-none px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm shadow-blue-200 active:scale-95 group whitespace-normal text-center h-auto min-h-[48px]">
                        <i class="fas fa-sync-alt opacity-70 group-hover:rotate-180 transition-transform duration-700"></i> Actualizar Informe
                    </button>
                </div>
            </header>

            <!-- Grid de Tarjetas de Impacto -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                ${renderStatCard("Inventario Total", "stat-total-terr", "fas fa-boxes-stacked", "blue", "Catálogo Maestro")}
                ${renderStatCard("Territorios en Calle", "stat-assigned", "fas fa-map-location-dot", "blue", "Asignados ahora")}
                ${renderStatCard("Fuerza Operativa", "stat-conductors", "fas fa-users-gear", "blue", "Conductores activos")}
                ${renderStatCard("Atrasos Críticos", "stat-late", "fas fa-triangle-exclamation", "rose", "Requiere intervención")}
            </div>

            <!-- Insights Section (Middle Row) -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- S-13 Mastery Card -->
                <div class="lg:col-span-2 super-card p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-50 pointer-events-none"></div>
                        <div class="flex-1 min-w-0 space-y-6 relative z-10 w-full">
                            <div class="flex items-center gap-3 text-slate-900 dark:text-white">
                                <h3 class="text-base sm:text-lg font-black tracking-tight uppercase font-sans">Cobertura Global S-13</h3>
                                <div class="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-lg border border-emerald-500/20">Live Status</div>
                            </div>
                            <div class="flex items-baseline gap-2 lg:gap-3 flex-wrap">
                                <span class="text-4xl lg:text-7xl font-black text-slate-800 dark:text-white tracking-tighter tabular-nums" id="stat-s13-coverage">0%</span>
                                <span class="text-emerald-600 dark:text-emerald-400 font-black text-[9px] lg:text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg whitespace-nowrap tracking-wider" id="stat-s13-diff">+0% Trend</span>
                            </div>
                            <div class="h-2.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden border border-slate-200/40 dark:border-white/5 shadow-inner">
                                <div id="stat-s13-progress-bar" class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(16,185,129,0.5)]" style="width: 0%"></div>
                            </div>
                            <p class="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed max-w-md" id="stat-s13-coverage-info">
                                Analizando profundidad del catálogo maestro y niveles de rotación...
                            </p>
                        </div>
                        <div class="w-full md:w-44 h-44 bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl rounded-3xl flex items-center justify-center p-4 border border-slate-200/40 dark:border-white/5 shadow-inner relative z-10 shrink-0">
                            <canvas id="chart-s13-mini"></canvas>
                        </div>
                </div>

                <!-- Strategic Quick Look (Hyper-Tech Glowing Terminal Card) -->
                <div class="bg-gradient-to-br from-[#0c1020] to-[#040814] dark:from-slate-950/90 dark:to-blue-950/60 rounded-[2.5rem] p-8 border border-blue-500/20 dark:border-blue-500/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] flex flex-col justify-between group overflow-hidden relative min-h-[300px]">
                    <!-- Futuristic Glowing Radial Overlays -->
                    <div class="absolute top-[-20%] right-[-20%] w-48 h-48 bg-blue-500/20 rounded-full blur-[40px] pointer-events-none group-hover:scale-125 transition-transform duration-700"></div>
                    <div class="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-amber-500/10 rounded-full blur-[30px] pointer-events-none"></div>
                    
                    <div class="flex justify-between items-start mb-6 relative z-10">
                        <div class="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center text-amber-400 border border-white/20 shadow-md">
                            <i class="fas fa-bolt-lightning text-sm animate-pulse"></i>
                        </div>
                        <span class="text-[9px] font-black text-blue-400 uppercase tracking-[0.25em]">S-13 Priority</span>
                    </div>
                    <div class="space-y-6 relative z-10">
                        <div class="space-y-1.5">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none opacity-80">Mayor Rezago</p>
                            <p class="text-3xl font-black text-white tracking-tight" id="stat-s13-oldest">#--</p>
                            <p class="text-[10px] text-amber-300 font-bold uppercase tracking-wider leading-none" id="stat-s13-oldest-info">Escaneando historial...</p>
                        </div>
                        <div class="h-px bg-white/5 w-full"></div>
                        <div class="space-y-1.5">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none opacity-80">Punto de Enfoque</p>
                            <p class="text-2xl font-black text-emerald-400 tracking-tight truncate w-full" id="stat-s13-frequent">--</p>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none" id="stat-s13-frequent-info">Nivel de rotación</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Charts Row -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Current Status Chart -->
                <div class="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-white/5 shadow-sm flex flex-col">
                    <h3 class="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                        Estado Operativo
                    </h3>
                    <div class="flex-1 min-w-0 relative min-h-[260px]">
                        <canvas id="chart-status"></canvas>
                    </div>
                </div>

                <!-- Frequency Chart -->
                <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-white/5 shadow-sm flex flex-col">
                    <h3 class="text-[10px] lg:text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                        <span class="truncate">Frecuencia de Trabajo (Top 10 S-13)</span>
                    </h3>
                    <div class="flex-1 min-w-0 relative min-h-[260px]">
                        <canvas id="chart-territories"></canvas>
                    </div>
                </div>
            </div>

            <!-- Critical Table Row -->
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex-1 min-w-0 flex flex-col min-h-[400px]">
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
                    <div class="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full sm:w-auto">
                        <div class="px-4 py-2 bg-rose-50 text-rose-700 ring-1 ring-rose-200 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                            Intervención Requerida
                        </div>
                        <button onclick="ReceptionHub.openModal({ viewMode: 'admin', isAdmin: true })" 
                                class="flex-1 min-w-0 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 whitespace-normal text-center h-auto min-h-[44px]">
                            GESTIONAR ENTREGAS
                        </button>
                    </div>
                </div>
                <div class="w-full overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left border-collapse min-w-0">
                        <thead class="hidden md:table-header-group">
                            <tr class="bg-gray-100/50 dark:bg-black/40 text-[10px] uppercase font-black text-slate-500 tracking-widest border-b border-slate-100 dark:border-white/5">
                                <th class="px-4 lg:px-8 py-6 text-left">Territorio</th>
                                <th class="px-4 lg:px-8 py-6 text-left">Responsable</th>
                                <th class="px-4 lg:px-8 py-6 text-left">Asignación</th>
                                <th class="px-4 lg:px-8 py-6 text-left">Tiempo</th>
                                <th class="px-4 lg:px-8 py-6 text-right">Gravedad</th>
                                <th class="px-4 lg:px-8 py-6 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="late-table-body" class="block md:table-row-group divide-y-0 md:divide-y divide-gray-100 dark:divide-white/5 text-sm">
                            <!-- Inyectado dinámicamente -->
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="text-center py-6">
                <p class="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.5em] opacity-30">Xolvy Analytics Engine v${appVersion} • Aurora Architecture</p>
            </div>
        </div>
    `;

    // --- Data Management & Chart Initialization ---
    const loadData = async () => {
        try {
            // PASO 3: Invalidar caché para asegurar datos frescos en métricas
            ServiceCache.clear("territorios_combined");

            const [territorios, conductores, historial, _globalStats] = await Promise.all([
                getTerritorios(),
                getConductores(),
                getHistorialReport(),
                getGlobalStats(),
            ]);

            // PASO 2: Logs de diagnóstico temporales
            console.log("[Analytics Debug] Total territorios obtenidos:", territorios.length);
            console.log("[Analytics Debug] Estados únicos encontrados:", [
                ...new Set(territorios.map((t) => t.estado)),
            ]);
            console.log(
                "[Analytics Debug] Territorios con estado Asignado:",
                territorios
                    .filter((t) => t.estado === "Asignado")
                    .map((t) => ({ id: t.id, numero: t.numero, estado: t.estado, asignado_a: t.asignado_a })),
            );

            const expDays = settings?.expiration_days || 120;

            // Xolvy Intelligence: Absolute consistency. Calculate EVERYTHING from the real documents.
            // Avoid globalStats for primary counters to prevent desync.
            const realAssigned = territorios.filter((t) => t.estado === "Asignado");
            const total = territorios.length;
            const assignedCount = realAssigned.length;
            const assigned = realAssigned;

            const now = new Date();
            const lateTerritories = assigned
                .filter((t) => {
                    if (!t.fecha_asignacion) return false;
                    const d = UIHelpers.parseFirebaseDate(t.fecha_asignacion) || new Date();
                    const diffDays = Math.ceil((now - d) / (1000 * 60 * 60 * 24));
                    return diffDays >= Math.floor(expDays * 0.8);
                })
                .sort((a, b) => {
                    const dA = UIHelpers.parseFirebaseDate(a.fecha_asignacion) || new Date();
                    const dB = UIHelpers.parseFirebaseDate(b.fecha_asignacion) || new Date();
                    return dA - dB;
                });

            // --- Strategic Metrics Logic (S-13 Filtered) ---
            const allUniqueTouched = new Set();
            let totalWorkActs = 0;
            const territoryFreq = {};

            historial.forEach((h) => {
                // Xolvy Logic: Only SUCCESS logs count for coverage and frequency
                if (h.estado !== "Completado" && h.estado !== "Predicado") return;

                if (!h.numero) return;
                const nums = h.numero
                    .toString()
                    .split(/[,;]/)
                    .map((n) => n.trim())
                    .filter((n) => n);
                nums.forEach((num) => {
                    allUniqueTouched.add(num);
                    territoryFreq[num] = (territoryFreq[num] || 0) + 1;
                    totalWorkActs++;
                });
            });

            const uniqueWorkedCount = allUniqueTouched.size;
            const s13CoveragePercent = total > 0 ? Math.min(100, Math.round((uniqueWorkedCount / total) * 100)) : 0;
            const workRounds = total > 0 ? (totalWorkActs / total).toFixed(1) : 0;

            const mostFreqSorted = Object.entries(territoryFreq).sort((a, b) => b[1] - a[1]);
            const topTerritory = mostFreqSorted[0]?.[0] || "--";
            const topCount = mostFreqSorted[0]?.[1] || 0;

            const latestTouch = {};
            historial.forEach((h) => {
                if (h.estado !== "Completado" && h.estado !== "Predicado") return;
                const d = h.fecha_entrega || h.fecha_asignacion;
                if (!d || !h.numero) return;
                const nums = h.numero
                    .toString()
                    .split(/[,;]/)
                    .map((n) => n.trim())
                    .filter((n) => n);
                nums.forEach((num) => {
                    if (!latestTouch[num] || new Date(d) > new Date(latestTouch[num])) {
                        latestTouch[num] = d;
                    }
                });
            });

            const rezagoSorted = territorios
                .filter((t) => latestTouch[t.numero])
                .sort((a, b) => {
                    const dA = UIHelpers.parseFirebaseDate(latestTouch[a.numero]) || new Date(0);
                    const dB = UIHelpers.parseFirebaseDate(latestTouch[b.numero]) || new Date(0);
                    return dA - dB;
                });
            const oldestTerritory = rezagoSorted[0]?.numero || "--";
            const latestDate = UIHelpers.parseFirebaseDate(latestTouch[oldestTerritory]) || new Date();
            const daysRezago =
                oldestTerritory !== "--" ? Math.floor((Date.now() - latestDate) / (1000 * 60 * 60 * 24)) : 0;

            // --- UI Animation/Updates ---
            if (!document.getElementById("stat-total-terr")) return;

            animateValue("stat-total-terr", 0, total, 1000);
            animateValue("stat-assigned", 0, assignedCount, 1000);
            animateValue("stat-conductors", 0, conductores.length, 1000);
            animateValue("stat-late", 0, lateTerritories.length, 1000);

            // S-13 Visual Shield: If coverage is 100% but late is high, highlight the bottleneck
            const s13Label = document.getElementById("stat-s13-coverage");
            s13Label.innerText = `${s13CoveragePercent}%`;
            if (lateTerritories.length > total * 0.5) {
                s13Label.classList.add("text-rose-500");
            } else {
                s13Label.classList.remove("text-rose-500");
            }
            document.getElementById("stat-s13-progress-bar").style.width = `${s13CoveragePercent}%`;
            document.getElementById("stat-s13-coverage-info").innerText =
                `${uniqueWorkedCount} de ${total} territorios cubiertos en este ciclo • ${workRounds} vueltas al catálogo`;

            document.getElementById("stat-s13-oldest").innerText =
                oldestTerritory === "--" ? "--" : `#${oldestTerritory}`;
            document.getElementById("stat-s13-oldest-info").innerText = `Último informe: hace ${daysRezago} días`;

            document.getElementById("stat-s13-frequent").innerText =
                topTerritory === "--" ? "--" : `Territorio ${topTerritory}`;
            document.getElementById("stat-s13-frequent-info").innerText = `Registrado ${topCount} veces recientemente`;

            // --- Charts Initialization ---
            initMainCharts(total, assignedCount, lateTerritories.length, territoryFreq, s13CoveragePercent);

            // --- Late Table Rendering ---
            renderLateTable(lateTerritories, now, expDays);

            // Bind click events to Entregar buttons
            const tbody = document.getElementById("late-table-body");
            if (tbody) {
                tbody.querySelectorAll(".btn-entregar-critico").forEach((btn) => {
                    btn.onclick = () => {
                        const tid = btn.dataset.tid;
                        const num = btn.dataset.num;
                        if (window.promptReturnTerritorio) {
                            window.promptReturnTerritorio(tid, num);
                        }
                    };
                });
            }
        } catch (e) {
            console.error("Critical error loading analytics:", e);
        }

        // No actions needed for individual IDs as per BUG 3 requirements
    };

    // --- Helper UI Functions ---

    loadData();
    const refreshBtn = document.getElementById("btn-refresh-analytics");
    if (refreshBtn) {
        refreshBtn.onclick = () => renderAnalyticsView(container, appVersion);
    }

    // Unificar actualización reactiva en tiempo real al liberar/actualizar un territorio
    if (window._analyticsReleaseListener) {
        window.removeEventListener("territorio-liberado", window._analyticsReleaseListener);
        window.removeEventListener("territorio-actualizado", window._analyticsReleaseListener);
    }

    window._analyticsReleaseListener = () => {
        // Verificar si el panel de analíticas sigue montado en el DOM
        if (document.getElementById("btn-refresh-analytics")) {
            console.log("[Analytics] Refreshing view due to territory update...");
            renderAnalyticsView(container, appVersion);
        } else {
            // Si ya no está en el DOM, limpiar el listener global
            window.removeEventListener("territorio-liberado", window._analyticsReleaseListener);
            window.removeEventListener("territorio-actualizado", window._analyticsReleaseListener);
            window._analyticsReleaseListener = null;
        }
    };

    window.addEventListener("territorio-liberado", window._analyticsReleaseListener);
    window.addEventListener("territorio-actualizado", window._analyticsReleaseListener);

    const resyncBtn = document.getElementById("btn-resync-stats");
    if (resyncBtn) {
        resyncBtn.onclick = async () => {
            const icon = resyncBtn.querySelector("i");
            icon.classList.add("fa-spin");
            resyncBtn.disabled = true;

            const result = await resyncGlobalStats();

            if (result && result.healed > 0) {
                showNotification(`Sincronización completa. Se sanaron ${result.healed} estados desfasados.`, "success");
            } else {
                showNotification("Estadísticas sincronizadas con el Banco Común", "success");
            }
            renderAnalyticsView(container, appVersion);
        };
    }
};
