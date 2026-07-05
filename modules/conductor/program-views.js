import { formatGroups } from "../utils/helpers.js";

export const renderFullProgramaCards = (
    programa,
    container,
    _territoryMap = {},
    currentConductorName,
    activeDayIndex = -1,
    _activeTurns = new Set(["manana", "tarde", "noche", "zoom"]),
) => {
    const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const shifts = ["manana", "tarde", "noche", "zoom"];
    const shiftLabels = { manana: "Mañana", tarde: "Tarde", noche: "Noche", zoom: "Zoom" };
    const shiftIcons = { manana: "fa-sun", tarde: "fa-cloud-sun", noche: "fa-moon", zoom: "fa-video" };
    const shiftColors = {
        manana: "text-amber-500",
        tarde: "text-orange-500",
        noche: "text-indigo-400",
        zoom: "text-emerald-500",
    };

    if (!programa?.dias || programa.dias.length === 0) {
        if (container) {
            container.innerHTML = `
                <div class="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-5 animate-fade-in opacity-30 group">
                    <div class="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-[3rem] flex items-center justify-center text-4xl mb-2 transition-transform group-hover:scale-110 duration-700">
                        <i class="fas fa-calendar-day"></i>
                    </div>
                    <div class="space-y-2">
                        <p class="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.4em]">No hay actividades para esta semana</p>
                        <p class="text-[10px] text-slate-600 dark:text-slate-400 italic font-bold uppercase tracking-widest">Consulta con el responsable del grupo</p>
                    </div>
                </div > `;
        }
        return;
    }

    const hasVisibleContent = (sData) => {
        return (
            sData &&
            sData.enabled !== false &&
            ((sData.conductor?.trim() && sData.conductor.trim() !== "—") ||
                (sData.territorio?.trim() && sData.territorio.trim() !== "—") ||
                (sData.lugar?.trim() && sData.lugar.trim() !== "—") ||
                (sData.hora?.trim() && sData.hora.trim() !== "—") ||
                (sData.faceta?.trim() && sData.faceta.trim() !== "—"))
        );
    };

    const html = `
        <div class="col-span-full animate-fade-in">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            ${days
                .map((dayName, dayIdx) => {
                    // Filter by activeDayIndex
                    if (activeDayIndex !== -1 && activeDayIndex !== dayIdx) return "";

                    const d = (programa.dias || []).find((x) => x.nombre === dayName);
                    if (!d) return "";

                    // Check if day has any visible shift with activity content
                    const hasVisibleData = shifts.some((s) => {
                        const sData = d[s];
                        return hasVisibleContent(sData);
                    });

                    if (!hasVisibleData) {
                        if (activeDayIndex !== -1) {
                            return `
                    <div class="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-30">
                        <i class="fas fa-calendar-day text-4xl mb-4"></i>
                        <p class="text-[10px] font-black uppercase tracking-widest italic">No hay salidas programadas para este día</p>
                    </div>`;
                        }
                        return "";
                    }

                    return `
                    <div class="modern-card !p-6 border-slate-100 dark:border-white/10 shadow-xl bg-white dark:bg-slate-900/40 space-y-6 hover:shadow-2xl transition-all duration-500">
                        <div class="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4">
                            <div>
                                <h3 class="font-black text-xl text-slate-800 dark:text-white tracking-tighter uppercase leading-none mb-1">${dayName}</h3>
                                <span class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mt-1">${d?.fecha ? d.fecha.split("-").reverse().join("/") : "-"}</span>
                            </div>
                            <div class="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                                <i class="fas fa-calendar-day"></i>
                            </div>
                        </div>
                        <div class="space-y-4">
                            ${shifts
                                .map((shift) => {
                                    const sData = d ? d[shift] : null;
                                    if (!hasVisibleContent(sData)) return "";

                                    const isConductor = sData.conductor === currentConductorName;
                                    const isAuxiliar = sData.auxiliar === currentConductorName;
                                    const isImpacted = isConductor || isAuxiliar;

                                    return `
                                <div class="p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] ${isImpacted ? "ring-2 ring-primary/20 bg-primary/5" : ""}">
                                    <div class="flex items-center justify-between gap-2 mb-3">
                                        <div class="flex items-center gap-2">
                                            <i class="fas ${shiftIcons[shift]} ${shiftColors[shift]} text-[10px]"></i>
                                            <span class="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">${shiftLabels[shift]}</span>
                                        </div>
                                        ${
                                            sData.hora
                                                ? `
                                        <div class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-white/5 rounded-full border border-slate-200/50 dark:border-white/5">
                                            <i class="far fa-clock text-[10px] text-slate-600 dark:text-slate-400"></i>
                                            <span class="text-[11px] font-black text-slate-600 dark:text-slate-400 tabular-nums">${sData.hora}</span>
                                        </div>`
                                                : ""
                                        }
                                    </div>
                                    
                                    <div class="space-y-3">
                                        ${
                                            sData.lugar
                                                ? `
                                            <div class="flex items-start gap-2">
                                                <i class="fas fa-map-marker-alt text-slate-700 dark:text-slate-300 mt-1 text-[8px]"></i>
                                                <p class="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase leading-snug">${sData.lugar}</p>
                                            </div>`
                                                : ""
                                        }
 
                                        <div class="grid grid-cols-1 gap-1.5">
                                            <div class="flex items-center gap-2">
                                                <div class="w-1 h-3 ${isConductor ? "bg-indigo-600 dark:bg-indigo-400" : "bg-slate-300"} rounded-full"></div>
                                                <span class="text-[10px] font-black ${isConductor ? "text-indigo-600 dark:text-indigo-400 font-extrabold" : "text-slate-700 dark:text-slate-200"} truncate uppercase">${sData.conductor || "—"}</span>
                                            </div>
                                            ${
                                                sData.auxiliar
                                                    ? `
                                            <div class="flex items-center gap-2">
                                                <div class="w-1 h-2 ${isAuxiliar ? "bg-indigo-400" : "bg-slate-200"} rounded-full"></div>
                                                <span class="text-[8px] font-bold ${isAuxiliar ? "text-indigo-500" : "text-slate-600 dark:text-slate-400"} truncate uppercase">${sData.auxiliar}</span>
                                            </div>`
                                                    : ""
                                            }
                                        </div>
 
                                        <div class="mt-2 pt-2 border-t border-black/5 dark:border-white/5 space-y-2">
                                            <div class="flex flex-wrap gap-1.5 items-center">
                                                ${(() => {
                                                    const territoriesList = sData.territorio
                                                        ? Array.from(
                                                              new Set(
                                                                  String(sData.territorio)
                                                                      .split(/[,;/]/)
                                                                      .map((t) => t.trim())
                                                                      .filter(Boolean),
                                                              ),
                                                          )
                                                        : [];
                                                    let chipHtml = "";

                                                    if (territoriesList.length > 0) {
                                                        chipHtml += territoriesList
                                                            .map((t) => {
                                                                const dropId =
                                                                    `dropdown-prog-${dayIdx}-${shift}-${t}`.replace(
                                                                        /\s+/g,
                                                                        "-",
                                                                    );
                                                                return `
                                                            <div class="relative inline-block text-left">
                                                                <button onclick="window.toggleTerritoryDropdown(event, '${dropId}')" 
                                                                        class="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all group/tbtn shadow-sm select-none">
                                                                    <span class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">${t}</span>
                                                                    <i class="fas fa-map-marked-alt text-[10px] text-indigo-500 group-hover/tbtn:scale-110 transition-transform"></i>
                                                                </button>
                                                                <!-- Dropdown Menu -->
                                                                <div id="${dropId}" class="hidden absolute left-0 mt-1.5 w-28 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                                                                    <button onclick="window.abrirMapaTerritorio('${t}', 'satelital')" class="w-full text-left px-3 py-2 text-[10px] font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 border-b border-slate-100 dark:border-white/5">
                                                                        <i class="fas fa-satellite text-indigo-500 text-[10px]"></i> Mapa
                                                                    </button>
                                                                    <button onclick="window.abrirMapaTerritorio('${t}', 'croquis')" class="w-full text-left px-3 py-2 text-[10px] font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2">
                                                                        <i class="fas fa-map text-indigo-500 text-[10px]"></i> Croquis
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            `;
                                                            })
                                                            .join("");

                                                        if (isConductor) {
                                                            chipHtml += `
                                                            <button onclick="window.openTerritorySelector(${dayIdx}, '${shift}', this)" 
                                                                    data-current="${sData.territorio || ""}"
                                                                    class="flex items-center justify-center w-7 h-7 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition-all shadow-sm shrink-0"
                                                                    title="Modificar Territorios">
                                                                <i class="fas fa-pen-to-square text-[10px]"></i>
                                                            </button>
                                                            `;
                                                        }
                                                    } else {
                                                        if (isConductor) {
                                                            chipHtml = `
                                                            <button onclick="window.openTerritorySelector(${dayIdx}, '${shift}', this)" 
                                                                    data-current=""
                                                                    class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all group/tbtn shadow-sm">
                                                                <i class="fas fa-map-location-dot text-[10px] text-slate-400 dark:text-slate-500 opacity-60 group-hover/tbtn:text-indigo-600 transition-colors"></i>
                                                                <span class="text-[10px] font-black text-slate-500 dark:text-slate-400 truncate max-w-[100px] uppercase">
                                                                    Asignar...
                                                                </span>
                                                            </button>
                                                            `;
                                                        } else {
                                                            chipHtml = `<span class="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase italic opacity-40">Libre</span>`;
                                                        }
                                                    }
                                                    return chipHtml;
                                                })()}
                                            </div>
                                            ${
                                                sData.faceta
                                                    ? `
                                            <div class="flex items-center gap-1.5 mt-2">
                                                <i class="fas fa-bullhorn text-[10px] text-indigo-500 dark:text-indigo-400"></i>
                                                <span class="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">${sData.faceta}</span>
                                            </div>
                                            `
                                                    : ""
                                            }
                                        </div>
                                    </div>
                                </div>`;
                                })
                                .join("")}
                        </div>
                    </div>`;
                })
                .join("")}
        </div>
    </div>
    `;

    if (container) {
        container.innerHTML = html;
    } else {
        console.warn("[ProgramViews] container no encontrado para renderFullProgramaCards");
    }
};

export const generateLandscapePreviewHTML = (programa) => {
    if (!programa) return "";

    // Get congregation name from storage if available
    const congName = localStorage.getItem("cached_congregation_name") || 'CONGREGACIÓN "NUEVE DE OCTUBRE"';
    const congId = "14282"; // Placeholder or get from config if exists

    const turnosArr = [
        { id: "manana", icon: "fa-cog", label: "MAÑANA", color: "#b45309" },
        { id: "tarde", icon: "fa-cloud-sun", label: "TARDE", color: "#c2410c" },
        { id: "noche", icon: "fa-moon", label: "NOCHE", color: "#1e1b4b" },
        { id: "zoom", icon: "fa-video", label: "ZOOM", color: "#064e3b" },
    ];

    const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    const html = `
    <div id="landscape-preview-content" class="bg-[#f8fafc] text-slate-900 font-['Outfit'] relative overflow-hidden flex flex-col" style="width: 1920px; height: 1080px; box-sizing: border-box; padding: 40px;">
        <!-- Background decorative elements -->
        <div class="absolute -top-40 -right-40 w-[600px] h-[600px] bg-slate-200/20 blur-[100px] rounded-full"></div>
        <div class="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-slate-200/20 blur-[100px] rounded-full"></div>

        <header class="relative z-10 flex flex-col items-center mb-10 w-full">
            <h1 class="text-[80px] font-black uppercase tracking-[0.1em] leading-none mb-2 text-[#1e293b]">Programa de Predicación</h1>
            <p class="text-[20px] font-black uppercase tracking-[0.3em] text-[#64748b] mb-6">${congName.toUpperCase()} ${congId}</p>
            <div class="w-full h-1 bg-[#1e293b] rounded-full opacity-100"></div>
        </header>

        <div class="relative z-10 grid grid-cols-7 gap-5 flex-1 min-w-0">
            ${days
                .map((dayName) => {
                    const dia = (programa.dias || []).find((d) => d.nombre === dayName) || {
                        nombre: dayName,
                        fecha: "",
                    };
                    const activeTurns = turnosArr.filter((t) => {
                        const data = dia[t.id];
                        return data && (data.conductor || data.lugar || data.hora);
                    });

                    return `
                <div class="bg-white dark:bg-slate-900 rounded-[40px] flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100/50 overflow-hidden h-full">
                    <!-- Day Header -->
                    <div class="px-8 py-10 border-b border-slate-50 bg-[#f8fafc]/50 text-center shrink-0">
                        <h2 class="text-[32px] font-black uppercase tracking-tight text-[#1e293b] leading-none mb-2">${dayName}</h2>
                        <span class="text-[14px] font-black uppercase tracking-[0.2em] text-[#94a3b8]">${dia.fecha ? dia.fecha.split("-").reverse().join("/") : ""}</span>
                    </div>
                    
                    <!-- Content -->
                    <div class="p-8 space-y-12 flex-1 min-w-0">
                        ${activeTurns
                            .map((t) => {
                                const data = dia[t.id];
                                const fields = [
                                    { label: "LUGAR", val: data.lugar },
                                    { label: "HORA", val: data.hora },
                                    { label: "CONDUCTOR", val: data.conductor },
                                    { label: "AUXILIAR", val: data.auxiliar },
                                    { label: "FACETA", val: data.faceta },
                                    { label: "TERRITORIO", val: data.territorio },
                                    { label: "GRUPOS", val: data.grupos },
                                ].filter((f) => f.val && f.val !== "—");

                                return `
                            <div class="space-y-6">
                                <div class="flex items-center gap-3">
                                    <i class="fas ${t.icon} text-[24px]" style="color: ${t.color}"></i>
                                    <span class="text-[22px] font-black uppercase tracking-[0.2em]" style="color: ${t.color}">${t.label}</span>
                                </div>
                                
                                <div class="space-y-4 ml-1">
                                    ${fields
                                        .map(
                                            (f) => `
                                        <div class="flex flex-col leading-tight">
                                            <span class="text-[10px] font-black uppercase tracking-[0.2em] text-[#cbd5e1] mb-1">${f.label}</span>
                                            <span class="text-[18px] font-black uppercase tracking-tight text-[#334155] whitespace-pre-line">${f.label === "GRUPOS" ? formatGroups(f.val) : f.val}</span>
                                        </div>
                                    `,
                                        )
                                        .join("")}
                                </div>
                            </div>
                            `;
                            })
                            .join("")}
                    </div>
                </div>
                `;
                })
                .join("")}
        </div>
    </div>
    
    <style>
        #landscape-preview-content {
            font-family: 'Outfit', sans-serif;
            -webkit-font-smoothing: antialiased;
        }
    </style>
    `;
    return html;
};
