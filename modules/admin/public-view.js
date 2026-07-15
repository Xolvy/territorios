import {
    getConfiguracion,
    getPublicadores,
    savePredicacionPublica,
    startLivePool,
} from "../../data/firestore-services.js";
import { setAdminLivePool } from "../admin-dashboard.js";
import { showCustomConfirm, showModal } from "../services/ui-helpers.js";
import { showNotification } from "../utils/helpers.js";

export const renderPredicacionTab = async (container, configData = null) => {
    let data = { asignaciones: [] };
    const [publicadores, config] = await Promise.all([getPublicadores(), configData || getConfiguracion()]);
    publicadores.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

    // Xolvy Live Pool: Real-time synchronization
    const unsub = startLivePool("predicacion_publica", [], (allData) => {
        if (allData.length > 0) {
            data = allData[0];
            // Legacy migration check
            if (data.dias && !data.asignaciones) data.asignaciones = data.dias;
            console.log("🏙️ [Live Pool] Public Preaching Updated.");
            renderCurrentView();
        }
    });
    setAdminLivePool(unsub);

    let currentSearchQuery = "";
    let currentView = window.innerWidth < 1024 ? "matrix" : "table";

    const formatTimeDisplay = (time) => {
        if (!time) return "—";
        const parts = time.split(":");
        const h = parts[0] || "00";
        const m = parts[1] || "00";
        return `${h.padStart(2, "0")}:${m.padEnd(2, "0")}`;
    };

    const renderMainLayout = () => {
        container.innerHTML = `
            <div class="space-y-12 animate-fade-in">
                <!-- Executive Header -->
                <header class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <div class="flex items-center gap-6">
                        <div class="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center text-3xl text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-white/5">
                            <i class="fas fa-street-view"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-2">Predicación Pública</h3>
                            <p class="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] ml-1 opacity-70">Logística de Turnos S-13</p>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                        <div class="relative flex-1 min-w-0 lg:min-w-[400px] group no-print">
                            <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 group-focus-within:text-blue-600 transition-colors"><i class="fas fa-search text-xs"></i></span>
                            <input type="text" id="public-search" placeholder="Filtrar día o publicador..." value="${currentSearchQuery}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl !pl-12 pr-4 py-4 text-xs font-black shadow-inner outline-none focus:border-blue-500 transition-all uppercase">
                        </div>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto no-print">
                            <button id="toggle-view-btn" class="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95">
                                <i class="fas ${currentView === "table" ? "fa-th-large" : "fa-list"}"></i> ${currentView === "table" ? "Matriz" : "Lista"}
                            </button>
                            <button id="add-row-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3">
                                <i class="fas fa-plus"></i> Nuevo
                            </button>
                            <button id="export-pdf" class="bg-white dark:bg-white/5 text-slate-500 hover:text-primary px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-white/10 transition-all flex items-center justify-center gap-3 active:scale-95">
                                <i class="fas fa-download"></i> PDF
                            </button>
                        </div>
                    </div>
                </header>

                <div id="public-save-status" class="hidden flex items-center justify-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-0 transition-opacity">
                    <span class="w-2 h-2 bg-primary rounded-full animate-pulse"></span> Sincronizado con éxito
                </div>

                <!-- Main Display Area -->
                <div class="enterprise-card overflow-visible min-h-[500px] relative bg-white dark:bg-slate-900 rounded-3xl" id="pdf-content">
                    <div id="matrix-bg" class="absolute inset-0 bg-slate-50 dark:bg-black/40 opacity-0 transition-opacity pointer-events-none rounded-3xl"></div>
                    
                    <div id="view-container" class="relative z-10 w-full">
                        <!-- Content depends on currentView -->
                    </div>

                    ${
                        !data.asignaciones || data.asignaciones.length === 0
                            ? `
                    <div class="flex flex-col items-center justify-center py-40 text-slate-300 dark:text-white/10 relative z-10" id="empty-state">
                        <div class="w-24 h-24 mb-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center text-4xl shadow-inner border border-slate-100 dark:border-white/5">
                            <i class="fas fa-calendar-alt opacity-20"></i>
                        </div>
                        <p class="text-[11px] font-black uppercase tracking-[0.5em] opacity-40">Agenda vacía</p>
                    </div>`
                            : ""
                    }
                </div>

                <datalist id="list-publicadores">
                    ${publicadores.map((p) => `<option value="${p.nombre}">`).join("")}
                </datalist>
            </div>
        `;

        // Bind Search
        const searchInput = container.querySelector("#public-search");
        if (searchInput) {
            searchInput.oninput = (e) => {
                currentSearchQuery = e.target.value.trim().toLowerCase();
                renderCurrentView();
            };
        }

        // Bind Toggle
        container.querySelector("#toggle-view-btn").onclick = () => {
            currentView = currentView === "table" ? "matrix" : "table";
            renderMainLayout();
            renderCurrentView();
        };

        // Bind Add — abre directamente el modal de edición
        container.querySelector("#add-row-btn").onclick = async () => {
            data.asignaciones = data.asignaciones || [];
            data.asignaciones.push({
                dia: "Lunes",
                hora: "",
                hora_fin: "",
                lugar: (config.lugares || [])[0] || "",
                publicador: "",
                companero: "",
            });
            await savePredicacionPublica(data);
            renderCurrentView();
            const newIdx = data.asignaciones.length - 1;
            window.editPublicRowModal(newIdx);
        };

        // Bind PDF
        container.querySelector("#export-pdf").onclick = () => {
            showNotification(
                "Para exportar, ve abajo el botón generador o usa el Centro Operativo S-13.",
                "info",
                5000,
            );
        };
    };

    const filterData = () => {
        if (!currentSearchQuery) return data.asignaciones || [];
        return (data.asignaciones || []).filter((row) => {
            const d = (row.dia || "").toLowerCase();
            const p = (row.publicador || "").toLowerCase();
            const c = (row.companero || "").toLowerCase();
            const l = (row.lugar || "").toLowerCase();
            return (
                d.includes(currentSearchQuery) ||
                p.includes(currentSearchQuery) ||
                c.includes(currentSearchQuery) ||
                l.includes(currentSearchQuery)
            );
        });
    };

    const renderCurrentView = () => {
        if (currentView === "table") renderTable();
        else renderMatrix();

        const exportBtn = container.querySelector("#export-pdf");
        if (exportBtn) {
            exportBtn.onclick = () => {
                showNotification(
                    "Para exportar, ve abajo el botón generador o usa el Centro Operativo S-13.",
                    "info",
                    5000,
                );
            };
        }
    };

    const renderTable = () => {
        const viewCont = container.querySelector("#view-container");
        if (!viewCont) return;

        const filtered = filterData();

        viewCont.innerHTML = `
            <div class="table-container p-4 lg:p-0 overflow-x-auto custom-scrollbar">
                <table class="w-full text-left border-collapse block lg:table">
                    <thead class="hidden lg:table-header-group bg-slate-50/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] border-b border-slate-100 dark:border-white/5">
                        <tr>
                            <th class="px-6 py-8 w-[140px] rounded-tl-[2.5rem]">Día</th>
                            <th class="px-4 py-8 text-center w-[250px]">Horario Estipulado</th>
                            <th class="px-4 py-8 w-[220px]">Punto de Predicación</th>
                            <th class="px-4 py-8 text-center w-[200px]">Publicador Principal</th>
                            <th class="px-4 py-8 text-center w-[200px]">Acompañante</th>
                            <th class="px-6 py-8 text-right no-print w-[120px] rounded-tr-[2.5rem]">Opciones</th>
                        </tr>
                    </thead>
                    <tbody id="public-table-body" class="block lg:table-row-group space-y-4 lg:space-y-0 lg:divide-y divide-slate-100 dark:divide-white/5">
                        ${filtered
                            .map((row) => {
                                const originalIndex = data.asignaciones.indexOf(row);
                                return `
                            <tr class="block lg:table-row bg-white dark:bg-white/[0.02] lg:bg-transparent lg:dark:bg-transparent border lg:border-none border-slate-100 dark:border-white/5 rounded-[2rem] lg:rounded-none p-5 lg:p-0 shadow-xl lg:shadow-none hover:bg-slate-50/50 lg:hover:bg-slate-50/50 dark:hover:bg-white/[0.03] transition-all group relative">
                                <td class="block lg:table-cell px-2 py-3 lg:px-6 lg:py-5 border-b lg:border-none border-slate-50 dark:border-white/5 last:border-none">
                                    <div class="flex flex-col lg:block gap-2">
                                        <span class="lg:hidden text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Día</span>
                                        <div class="relative w-full">
                                            <select class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-4 lg:px-3 py-3 lg:py-3.5 text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer uppercase tracking-tight appearance-none"
                                                onchange="window.updatePublicRow(${originalIndex}, 'dia', this.value)">
                                                <option value="" disabled ${!row.dia ? "selected" : ""}>— Día —</option>
                                                ${[
                                                    "Lunes",
                                                    "Martes",
                                                    "Miércoles",
                                                    "Jueves",
                                                    "Viernes",
                                                    "Sábado",
                                                    "Domingo",
                                                ]
                                                    .map(
                                                        (d) =>
                                                            `<option value="${d}" ${row.dia === d ? "selected" : ""}>${d}</option>`,
                                                    )
                                                    .join("")}
                                            </select>
                                            <i class="fas fa-chevron-down absolute right-4 lg:right-3 top-1/2 -translate-y-1/2 text-[10px] lg:text-[9px] opacity-40 lg:opacity-30 pointer-events-none"></i>
                                        </div>
                                    </div>
                                </td>
                                <td class="block lg:table-cell px-2 py-3 lg:px-4 lg:py-5 border-b lg:border-none border-slate-50 dark:border-white/5 last:border-none">
                                    <div class="flex flex-col lg:block gap-2">
                                        <span class="lg:hidden text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Horario Estipulado</span>
                                        <div class="flex items-center gap-1 justify-center w-full lg:w-auto">
                                            <div class="relative group/time flex-1 min-w-0">
                                                <input type="time" class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-2 py-3 lg:py-3.5 text-[11px] font-black text-center text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer appearance-none"
                                                    value="${formatTimeDisplay(row.hora)}"
                                                    onchange="window.updatePublicRow(${originalIndex}, 'hora', this.value)">
                                            </div>
                                            <span class="text-slate-300 dark:text-white/10 font-bold px-1">—</span>
                                            <div class="relative group/time flex-1 min-w-0">
                                                <input type="time" class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-2 py-3 lg:py-3.5 text-[11px] font-black text-center text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer appearance-none"
                                                    value="${formatTimeDisplay(row.hora_fin)}"
                                                    onchange="window.updatePublicRow(${originalIndex}, 'hora_fin', this.value)">
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td class="block lg:table-cell px-2 py-3 lg:px-4 lg:py-5 border-b lg:border-none border-slate-50 dark:border-white/5 last:border-none">
                                    <div class="flex flex-col lg:block gap-2">
                                        <span class="lg:hidden text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Punto de Predicación</span>
                                        <div class="relative w-full">
                                            <select class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-4 py-3.5 text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none uppercase"
                                                onchange="window.updatePublicRow(${originalIndex}, 'lugar', this.value)">
                                                <option value="" disabled ${!row.lugar ? "selected" : ""}>— Seleccionar Punto —</option>
                                                ${(config.lugares || [])
                                                    .map(
                                                        (lugar) =>
                                                            `<option value="${lugar}" ${row.lugar === lugar ? "selected" : ""}>${lugar}</option>`,
                                                    )
                                                    .join("")}
                                            </select>
                                            <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] lg:text-[9px] opacity-40 lg:opacity-30 pointer-events-none"></i>
                                        </div>
                                    </div>
                                </td>
                                <td class="block lg:table-cell px-2 py-3 lg:px-4 lg:py-5 border-b lg:border-none border-slate-50 dark:border-white/5 last:border-none">
                                    <div class="flex flex-col lg:block gap-2">
                                        <span class="lg:hidden text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Publicador Principal</span>
                                        <div class="relative group/input flex justify-center w-full">
                                            <input list="list-publicadores" type="text"
                                                class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-4 py-3.5 text-[11px] font-black text-center text-slate-700 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400/70 dark:placeholder:text-white/20 uppercase"
                                                value="${row.publicador || ""}"
                                                placeholder="Nombre..."
                                                onchange="window.updatePublicRow(${originalIndex}, 'publicador', this.value)">
                                        </div>
                                    </div>
                                </td>
                                <td class="block lg:table-cell px-2 py-3 lg:px-4 lg:py-5 border-b lg:border-none border-slate-50 dark:border-white/5 last:border-none">
                                    <div class="flex flex-col lg:block gap-2">
                                        <span class="lg:hidden text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Acompañante</span>
                                        <div class="relative group/input flex justify-center w-full">
                                            <input list="list-publicadores" type="text"
                                                class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-4 py-3.5 text-[11px] font-black text-center text-slate-700 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400/70 dark:placeholder:text-white/20 uppercase"
                                                value="${row.companero || ""}"
                                                placeholder="Nombre..."
                                                onchange="window.updatePublicRow(${originalIndex}, 'companero', this.value)">
                                        </div>
                                    </div>
                                </td>
                                <td class="block lg:table-cell px-2 py-3 lg:px-6 lg:py-5 no-print relative">
                                    <div class="flex items-center justify-end gap-2 lg:opacity-30 group-hover:opacity-100 transition-opacity">
                                        <button class="w-12 h-12 lg:w-10 lg:h-10 inline-flex items-center justify-center text-primary-light bg-primary/5 hover:bg-primary/20 lg:bg-transparent lg:hover:bg-primary/10 rounded-2xl lg:rounded-xl transition-all"
                                            onclick="window.editPublicRowModal(${originalIndex})" title="Editar Detalle">
                                            <i class="fas fa-edit text-sm lg:text-xs"></i>
                                        </button>
                                        <button class="w-12 h-12 lg:w-10 lg:h-10 inline-flex items-center justify-center text-rose-500 bg-rose-500/5 hover:bg-rose-500/20 lg:bg-transparent lg:hover:bg-rose-500/10 rounded-2xl lg:rounded-xl transition-all"
                                            onclick="window.deletePublicRow(${originalIndex})" title="Eliminar">
                                            <i class="fas fa-trash-alt text-sm lg:text-xs"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            `;
                            })
                            .join("")}
                    </tbody>
                </table>
            </div>
        `;
    };

    const renderMatrix = () => {
        const viewCont = container.querySelector("#view-container");
        if (!viewCont) return;

        const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        const ftd = (time) => {
            if (!time) return "—";
            const [h = "00", m = "00"] = time.split(":");
            return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
        };
        const filteredAsignaciones = filterData();

        container.querySelector("#matrix-bg")?.classList.remove("opacity-100");
        const emptyState = container.querySelector("#empty-state");
        if (emptyState) emptyState.classList.add("hidden");

        if (filteredAsignaciones.length === 0) {
            viewCont.innerHTML = `<div class="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
                <i class="fas fa-calendar-alt text-5xl text-slate-600 dark:text-slate-400"></i>
                <p class="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500">Sin turnos planificados</p>
            </div>`;
            return;
        }

        // Agrupar por día
        const porDia = {};
        dias.forEach((d) => {
            porDia[d] = [];
        });
        porDia["Sin Día"] = [];
        filteredAsignaciones.forEach((a) => {
            const key = dias.includes(a.dia) ? a.dia : "Sin Día";
            porDia[key].push(a);
        });

        const DAY_COLORS = {
            Lunes: {
                accent: "text-indigo-500",
                bg: "bg-indigo-500/10",
                border: "border-indigo-500/20",
                dot: "bg-indigo-500",
            },
            Martes: {
                accent: "text-violet-500",
                bg: "bg-violet-500/10",
                border: "border-violet-500/20",
                dot: "bg-violet-500",
            },
            Miércoles: { accent: "text-sky-500", bg: "bg-sky-500/10", border: "border-sky-500/20", dot: "bg-sky-500" },
            Jueves: {
                accent: "text-emerald-500",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
                dot: "bg-emerald-500",
            },
            Viernes: {
                accent: "text-amber-500",
                bg: "bg-amber-500/10",
                border: "border-amber-500/20",
                dot: "bg-amber-500",
            },
            Sábado: { accent: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", dot: "bg-rose-500" },
            Domingo: {
                accent: "text-orange-500",
                bg: "bg-orange-500/10",
                border: "border-orange-500/20",
                dot: "bg-orange-500",
            },
            "Sin Día": {
                accent: "text-slate-600 dark:text-slate-400",
                bg: "bg-slate-200/60 dark:bg-white/5",
                border: "border-slate-200 dark:border-white/10",
                dot: "bg-slate-400",
            },
        };

        const allDays = [...dias, "Sin Día"].filter((d) => porDia[d]?.length > 0);

        viewCont.innerHTML = `
            <div class="p-4 md:p-8 space-y-3">
                ${allDays
                    .map((dia, dayIdx) => {
                        const turnos = porDia[dia];
                        const c = DAY_COLORS[dia] || DAY_COLORS["Sin Día"];
                        const accordionId = `acc-day-${dayIdx}`;
                        return `
                    <div class="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] shadow-sm overflow-hidden transition-all">
                        <!-- Day Header (always visible, clickable) -->
                        <button type="button"
                            onclick="document.getElementById('${accordionId}').classList.toggle('hidden'); this.querySelector('.acc-arrow').classList.toggle('rotate-180')"
                            class="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group">
                            <div class="flex items-center gap-3">
                                <span class="w-2.5 h-2.5 rounded-full ${c.dot} shrink-0 shadow-sm"></span>
                                <span class="text-[11px] font-black uppercase tracking-[0.25em] ${c.accent}">${dia}</span>
                                <span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black ${c.bg} ${c.accent} border ${c.border}">${turnos.length}</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="hidden sm:block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">${turnos.length} turno${turnos.length !== 1 ? "s" : ""}</span>
                                <i class="acc-arrow fas fa-chevron-down text-[10px] text-slate-600 dark:text-slate-400 transition-transform duration-300"></i>
                            </div>
                        </button>

                        <!-- Turnos list (collapsible) -->
                        <div id="${accordionId}" class="hidden border-t border-slate-100 dark:border-white/[0.05] divide-y divide-slate-100 dark:divide-white/[0.04]">
                            ${turnos
                                .map((a) => {
                                    const idx = data.asignaciones.indexOf(a);
                                    const cardId = `turno-detail-${dayIdx}-${idx}`;
                                    const timeStr = `${ftd(a.hora)} – ${ftd(a.hora_fin)}`;
                                    const lugar = a.lugar || "Ubicación General";
                                    const pubInitial = (a.publicador || "?").charAt(0).toUpperCase();
                                    return `
                                <div class="group">
                                    <!-- Turno compact row -->
                                    <button type="button"
                                        onclick="document.getElementById('${cardId}').classList.toggle('hidden'); this.querySelector('.turno-arrow').classList.toggle('rotate-180')"
                                        class="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors text-left">
                                        <!-- Avatar -->
                                        <div class="w-9 h-9 rounded-xl ${c.bg} ${c.accent} flex items-center justify-center font-black text-sm shrink-0 border ${c.border}">
                                            ${pubInitial}
                                        </div>
                                        <!-- Info compact -->
                                        <div class="flex-1 min-w-0">
                                            <p class="text-[12px] font-black text-slate-800 dark:text-white truncate uppercase">${a.publicador || "—"}</p>
                                            <p class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">${lugar} &middot; ${timeStr}</p>
                                        </div>
                                        <!-- Expand arrow -->
                                        <i class="turno-arrow fas fa-chevron-down text-[9px] text-slate-300 dark:text-slate-600 transition-transform duration-200 shrink-0"></i>
                                    </button>

                                    <!-- Turno expanded detail -->
                                    <div id="${cardId}" class="hidden px-5 pb-4 pt-1 bg-slate-50/50 dark:bg-black/10 animate-fade-in">
                                        <div class="grid grid-cols-2 gap-3 mb-4">
                                            <div class="space-y-1">
                                                <p class="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em]">Lugar</p>
                                                <p class="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase">${lugar}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em]">Horario</p>
                                                <p class="text-[11px] font-black ${c.accent}">${timeStr}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em]">Publicador Principal</p>
                                                <p class="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase">${a.publicador || "—"}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em]">Acompañante</p>
                                                <p class="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase">${a.companero || "—"}</p>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <button onclick="window.editPublicRowModal(${idx})"
                                                class="flex-1 min-w-0 flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-50 dark:bg-white/5 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all active:scale-95">
                                                <i class="fas fa-pen text-[9px]"></i> Editar
                                            </button>
                                            <button onclick="window.deletePublicRow(${idx})"
                                                class="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all active:scale-95">
                                                <i class="fas fa-trash text-[9px]"></i>
                                            </button>
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
        `;

        // Expandir el primer día automáticamente
        const firstAccordion = viewCont.querySelector('[id^="acc-day-"]');
        if (firstAccordion) {
            firstAccordion.classList.remove("hidden");
            viewCont.querySelector("button .acc-arrow")?.classList.add("rotate-180");
        }
    };

    window.quickAddPublicRow = async (dia, lugar, hora, hora_fin) => {
        data.asignaciones = data.asignaciones || [];
        data.asignaciones.push({
            dia,
            hora: hora || "",
            hora_fin: hora_fin || "",
            lugar: lugar || "",
            publicador: "",
            companero: "",
        });
        await savePredicacionPublica(data);
        renderCurrentView();

        // Open edit modal directly for the newly created slot!
        const newIdx = data.asignaciones.length - 1;
        setTimeout(() => window.editPublicRowModal(newIdx), 100);
    };

    window.editPublicRowModal = (idx) => {
        const row = data.asignaciones[idx];
        // Opciones de publicadores para los selects del modal
        const pubOpts = publicadores
            .map(
                (p) =>
                    `<option value="${p.nombre}" ${(row.publicador || "") === p.nombre ? "selected" : ""}>${p.nombre}</option>`,
            )
            .join("");
        const socOpts = publicadores
            .map(
                (p) =>
                    `<option value="${p.nombre}" ${(row.companero || "") === p.nombre ? "selected" : ""}>${p.nombre}</option>`,
            )
            .join("");

        showModal(
            `
            <div class="p-8 space-y-8 bg-white dark:bg-[#0a0f18] rounded-[2.5rem]">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-3xl text-primary shadow-inner">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">${idx === data.asignaciones.length - 1 && !row.dia ? "Nuevo Turno" : "Editar Turno"}</h3>
                        <p class="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Modificar registro S-13</p>
                    </div>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Día</label>
                        <select id="edit-p-dia" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold uppercase text-slate-700 dark:text-white outline-none">
                            ${["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((d) => `<option value="${d}" ${row.dia === d ? "selected" : ""}>${d}</option>`).join("")}
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Horario</label>
                        <div class="flex items-center gap-2">
                            <input type="time" id="edit-p-hora" value="${row.hora || ""}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold text-primary outline-none text-center">
                            <span class="text-slate-700 dark:text-slate-300">—</span>
                            <input type="time" id="edit-p-hora-fin" value="${row.hora_fin || ""}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold text-primary outline-none text-center">
                        </div>
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Lugar de Predicación</label>
                        <select id="edit-p-lugar" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold uppercase text-slate-700 dark:text-white outline-none">
                            ${(config.lugares || []).map((l) => `<option value="${l}" ${row.lugar === l ? "selected" : ""}>${l}</option>`).join("")}
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Publicador Principal</label>
                        <select id="edit-p-pub" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold uppercase text-slate-700 dark:text-white outline-none">
                            <option value="">— Seleccionar —</option>
                            ${pubOpts}
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Acompañante</label>
                        <select id="edit-p-soc" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold uppercase text-slate-700 dark:text-white outline-none">
                            <option value="">— Ninguno —</option>
                            ${socOpts}
                        </select>
                    </div>
                </div>

                <div class="pt-6 border-t border-slate-50 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-edit-p" class="flex-1 min-w-0 py-5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
                    <button id="save-edit-public" class="flex-[2] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all">GUARDAR CAMBIOS</button>
                </div>
            </div>
        `,
            (modal) => {
                modal.querySelector("#btn-cancel-edit-p").onclick = () => modal.classList.add("hidden");
                modal.querySelector("#save-edit-public").onclick = async () => {
                    const updated = {
                        dia: modal.querySelector("#edit-p-dia").value,
                        hora: modal.querySelector("#edit-p-hora").value,
                        hora_fin: modal.querySelector("#edit-p-hora-fin").value,
                        lugar: modal.querySelector("#edit-p-lugar").value,
                        publicador: modal.querySelector("#edit-p-pub").value.trim(),
                        companero: modal.querySelector("#edit-p-soc").value.trim(),
                    };
                    data.asignaciones[idx] = updated;
                    await savePredicacionPublica(data);
                    showNotification("Turno actualizado correctamente");
                    renderCurrentView();
                    modal.classList.add("hidden");
                };
            },
        );
    };

    window.deletePublicRow = async (index) => {
        showCustomConfirm("¿Eliminar este turno de predicación del registro maestro?", async () => {
            data.asignaciones.splice(index, 1);
            await savePredicacionPublica(data);
            renderCurrentView();
            showNotification("Registro eliminado");
        });
    };

    window.updatePublicRow = async (index, field, value) => {
        const status = container.querySelector("#public-save-status");
        if (status) {
            status.classList.remove("hidden");
            status.classList.replace("opacity-0", "opacity-100");
        }

        data.asignaciones[index][field] = value;
        try {
            await savePredicacionPublica(data);
            // No full render here to avoid focus loss during typing if we had lots of inputs,
            // but for selects/times it's fine.
        } catch (_e) {
            showNotification("Error de sincronización", "error");
        } finally {
            if (status) setTimeout(() => status.classList.replace("opacity-100", "opacity-0"), 1000);
        }
    };

    renderMainLayout();
    renderCurrentView();

    // S-13 Export Logic (Moved inside to have access to container)
    const exportBtn = container.querySelector("#export-pdf");
    if (exportBtn) {
        exportBtn.onclick = async () => {
            const { renderS13CommandCenter } = await import("../report-s13.js");
            const modal = document.getElementById("modal-container");
            modal.classList.remove("hidden");
            modal.innerHTML = `
                <div class="w-full h-full flex items-center justify-center p-4">
                    <div class="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                        <header class="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                            <div class="flex items-center gap-4">
                                 <div class="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center text-2xl">
                                    <i class="fas fa-file-invoice"></i>
                                 </div>
                                 <div>
                                     <h3 class="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Centro de Exportación S-13</h3>
                                     <p class="text-[10px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-[0.2em]">Generación de Reportes Oficiales</p>
                                 </div>
                            </div>
                            <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 transition-all">
                                <i class="fas fa-times"></i>
                            </button>
                        </header>
                        <div id="s13-modal-content" class="flex-1 min-w-0 overflow-y-auto p-10 custom-scrollbar"></div>
                    </div>
                </div>
            `;
            await renderS13CommandCenter(document.getElementById("s13-modal-content"));
        };
    }
};
