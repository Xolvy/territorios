import { where } from "firebase/firestore";
import { returnTerritorio, returnTerritorioParcial, startLivePool, getConductores } from "../../data/firestore-services.js";
import { showNotification, normalizeRobust } from "../utils/helpers.js";
import { UIHelpers } from "./ui-date-helpers.js";
import { auth } from "../../firebase-config.js";

/**
 * Singleton instance tracker to prevent memory leaks and state contamination.
 */
let runningHubInstance = null;

/**
 * @class ReceptionHub
 * @description Centro unificado de recepción y entrega de territorios (Live Pool).
 *              Sincroniza en tiempo real las asignaciones para Administradores y Conductores.
 */
export class ReceptionHub {
    constructor(config = {}) {
        // --- 1. PERSISTENCIA ESTRICTA DEL ESTADO ---
        this.viewMode = config.viewMode || "conductor"; // 'admin' | 'conductor'
        this.displayName = config.displayName || "";
        this.scheduledConductor = config.scheduledConductor || "";
        this.scheduledAuxiliar = config.scheduledAuxiliar || "";
        this.isAdmin = config.isAdmin || false;
        this.preSelectedId = config.preSelectedId || null;
        this.preSelectedIds = config.preSelectedIds || null; // NEW: support multiple IDs

        this.unsubscribe = null;
        this.territories = [];
        this.selections = {}; // Estado temporal: { [tId]: { mode: 'full'|'partial'|'return', manzanas: [], notes: '', conductorFinal: string } }
        this.conductores = [];
    }

    /**
     * Punto de entrada principal estático que maneja el ciclo de vida de la instancia.
     * @param {Object} config - Configuración de la vista ({ viewMode, displayName, isAdmin, preSelectedId })
     */
    static async openModal(config = {}) {
        // Matar instancia previa (Fuga de memoria y contaminación de estado)
        if (runningHubInstance) runningHubInstance.closeModal();

        // Crear instancia limpia
        runningHubInstance = new ReceptionHub(config);
        await runningHubInstance.init();
    }

    /**
     * Inicialización de la instancia y carga de datos.
     */
    async init() {
        try {
            const user = window.XolvyApp?.user;

            // Si no se pasaron datos, intentar resolver del contexto global
            if (!this.displayName && user) {
                this.displayName = user.nombre;
                this.isAdmin = user.role === "Administrador" || user.role === "SuperAdmin";
            }

            // Cargar conductores para el dropdown
            getConductores()
                .then((list) => {
                    this.conductores = list;
                    this.updateConductorSelect();
                    this.renderList();
                })
                .catch((err) => {
                    console.error("❌ Error loading conductors:", err);
                    showNotification(`Error al cargar conductores: ${err.message}`, "error");
                });

            // --- 3. FILTRO DE SERVIDOR (RBAC S-13) ---
            // Identity Shield: Use canonical identity for absolute resolution
            const identity = window.XolvyApp?.identity;
            const myCanonicalName = identity?.nombreCanonico || this.displayName;

            const filtros = this.isAdmin || !myCanonicalName ? [] : [where("asignado_a", "==", myCanonicalName)];

            this.unsubscribe = startLivePool(
                "territorios",
                filtros,
                (data) => {
                    try {
                        this.territories = data;

                        // Autoselección del conductor para administradores
                        if (this.isAdmin) {
                            if (this.preSelectedId) {
                                const target = this.territories.find((t) => t.id === this.preSelectedId);
                                if (target?.asignado_a) {
                                    this.displayName = target.asignado_a;
                                }
                            } else if (this.preSelectedIds && this.preSelectedIds.length > 0) {
                                const target = this.territories.find((t) => this.preSelectedIds.includes(t.id));
                                if (target?.asignado_a) {
                                    this.displayName = target.asignado_a;
                                }
                            }
                        }

                        this.updateConductorSelect();
                        this.renderList();
                    } catch (callbackErr) {
                        console.error("❌ Error in live pool callback:", callbackErr);
                    }
                },
                (error) => {
                    console.error("❌ Error in live pool subscription:", error);
                    showNotification(`Error de conexión con base de datos: ${error.message}`, "error");
                }
            );

            this.renderShell();
        } catch (initErr) {
            console.error("❌ Error initializing ReceptionHub:", initErr);
            showNotification(`Error al iniciar recepción: ${initErr.message}`, "error");
            this.closeModal();
        }
    }

    /**
     * Renderiza el contenedor base del modal (Shell).
     */
    renderShell() {
        let modal = document.getElementById("reception-hub-modal");
        if (modal) modal.remove();

        modal = document.createElement("div");
        modal.id = "reception-hub-modal";
        modal.className =
            "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in";

        modal.onclick = (e) => {
            if (e.target.id === "reception-hub-modal") this.closeModal();
        };

        modal.innerHTML = `
            <div class="bg-white dark:bg-[#0b0e14] rounded-[20px] w-full max-w-[500px] max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up border border-slate-200 dark:border-white/10">
                <header class="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 text-lg">
                            <i class="fas ${this.viewMode === "admin" ? "fa-id-card" : "fa-clipboard-check"}"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">${this.viewMode === "admin" ? "Gestión HUB" : "Informar Actividad"}</h3>
                            <p class="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Live Pool S-13</p>
                        </div>
                    </div>
                    <button onclick="ReceptionHub.closeModal()" class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 transition-all active:scale-90">
                        <i class="fas fa-times"></i>
                    </button>
                </header>
                
                <div id="reception-hub-list" class="flex-1 min-w-0 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-black/10">
                    <!-- Contenido dinámico -->
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Genera el HTML de las opciones de conductor, priorizando el conductor y auxiliar programados.
     */
    buildConductorOptions(selectedValue) {
        const uniqueNames = new Set();
        const list = [];
        const selVal = (selectedValue || "").trim();

        // 1. Conductor programado
        if (this.scheduledConductor) {
            const name = this.scheduledConductor.trim();
            if (name && !uniqueNames.has(name)) {
                uniqueNames.add(name);
                list.push({ nombre: name, group: "Programados" });
            }
        }

        // 2. Auxiliar programado
        if (this.scheduledAuxiliar) {
            const name = this.scheduledAuxiliar.trim();
            if (name && !uniqueNames.has(name)) {
                uniqueNames.add(name);
                list.push({ nombre: name, group: "Programados" });
            }
        }

        // 3. Todos los demás conductores
        if (this.conductores) {
            this.conductores.forEach((c) => {
                const name = (c.nombre || "").trim();
                if (name && !uniqueNames.has(name)) {
                    uniqueNames.add(name);
                    list.push({ nombre: name, group: "Otros" });
                }
            });
        }

        // Si el valor seleccionado no está en la lista, agregarlo
        if (selVal && !uniqueNames.has(selVal)) {
            uniqueNames.add(selVal);
            list.push({ nombre: selVal, group: "Otros" });
        }

        let html = '<option value="">Seleccionar...</option>';
        const programados = list.filter((item) => item.group === "Programados");
        const otros = list.filter((item) => item.group === "Otros");

        if (programados.length > 0) {
            html += `<optgroup label="Programados para hoy">`;
            programados.forEach((item) => {
                html += `<option value="${item.nombre}" ${item.nombre === selVal ? "selected" : ""}>${item.nombre}</option>`;
            });
            html += `</optgroup>`;
        }

        if (otros.length > 0) {
            html += `<optgroup label="Otros Conductores">`;
            otros.forEach((item) => {
                html += `<option value="${item.nombre}" ${item.nombre === selVal ? "selected" : ""}>${item.nombre}</option>`;
            });
            html += `</optgroup>`;
        }

        return html;
    }

    /**
     * Actualiza dinámicamente el dropdown de conductor.
     */
    updateConductorSelect() {
        const select = document.getElementById("common-conductor");
        if (select) {
            const val = select.value || this.displayName;
            select.innerHTML = this.buildConductorOptions(val);
        }
    }

    /**
     * Renderiza la lista de tarjetas con filtro RBAC unificado.
     */
    renderList() {
        const list = document.getElementById("reception-hub-list");
        if (!list) return;

        // --- 2. INTERCEPTAR LOS DATOS Y APLICAR FILTRO ---
        const data = this.territories || [];
        const INACTIVE_STATES = ["Disponible", "Predicado", "Sin asignar", "Extraviado", "Libre"];
        let territoriosParaMostrar = data.filter(
            (t) => !INACTIVE_STATES.includes(t.estado) && !INACTIVE_STATES.includes(t.status),
        );

        // REGLA DE ORO: Si estoy en modo conductor (o no soy admin), solo veo LO MÍO.
        if (this.viewMode === "conductor" || !this.isAdmin) {
            const myName = (window.XolvyApp?.identity?.nombreCanonico || this.displayName || "").trim().toLowerCase();
            territoriosParaMostrar = territoriosParaMostrar.filter((t) => {
                const asignado = (t.asignado_a || "").trim().toLowerCase();
                const auxiliar = (t.auxiliar || "").trim().toLowerCase();
                return asignado === myName || auxiliar === myName;
            });
        }

        // Filtro por IDs preseleccionados (soporta preSelectedId y preSelectedIds)
        if (this.preSelectedIds && this.preSelectedIds.length > 0) {
            territoriosParaMostrar = territoriosParaMostrar.filter((t) => this.preSelectedIds.includes(t.id));
        } else if (this.preSelectedId) {
            territoriosParaMostrar = territoriosParaMostrar.filter((t) => t.id === this.preSelectedId);
        }

        if (territoriosParaMostrar.length === 0) {
            const emptyMsg =
                this.viewMode === "conductor"
                    ? "No tienes asignaciones pendientes de informar"
                    : "No hay territorios asignados en este momento";
            list.innerHTML = `
                <div class="py-20 text-center space-y-4 animate-fade-in opacity-50">
                    <div class="w-16 h-16 bg-slate-200 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-500 px-8 dark:text-slate-400">
                        <i class="fas fa-check-circle text-2xl"></i>
                    </div>
                    <p class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 px-8">${emptyMsg}</p>
                </div>`;
            return;
        }

        // --- ORDENAR Y AGRUPAR CRONOLÓGICAMENTE POR DÍA Y CONDUCTOR ---
        const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const sortedTerritories = [...territoriosParaMostrar].sort((a, b) => {
            const dateA = UIHelpers.parseFirebaseDate(a.fecha_salida || a.fecha_asignacion) || new Date(0);
            const dateB = UIHelpers.parseFirebaseDate(b.fecha_salida || b.fecha_asignacion) || new Date(0);
            return dateA.getTime() - dateB.getTime();
        });

        const groups = [];
        sortedTerritories.forEach((t) => {
            const dateObj = UIHelpers.parseFirebaseDate(t.fecha_salida || t.fecha_asignacion);
            const dayName = dateObj ? daysOfWeek[dateObj.getDay()] : "Sin Día";
            const dateStr = dateObj
                ? dateObj.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
                : "—";
            const conductor = t.asignado_a || "Sin Asignar";

            const dateKey = dateObj ? dateObj.toISOString().split("T")[0] : "no-date";
            const key = `${dateKey}_${conductor}`;

            let existingGroup = groups.find((g) => g.key === key);
            if (!existingGroup) {
                existingGroup = {
                    key,
                    dayName,
                    dateStr,
                    conductor,
                    items: [],
                };
                groups.push(existingGroup);
            }
            existingGroup.items.push(t);
        });

        // Rediseño Vista Unificada (Layout de la Imagen 2 para todos)
        let html = `<div class="space-y-6">`;

        html += groups
            .map((group) => {
                const groupCards = group.items
                    .map((t) => {
                        if (!this.selections[t.id]) {
                            this.selections[t.id] = {
                                manzanas: [],
                                notes: "",
                                conductorFinal: t.asignado_a || "",
                                date: UIHelpers.formatDateId(new Date()),
                                mode: "entregar",
                            };
                        }
                        const sel = this.selections[t.id];
                        const mzs = t.manzanas
                            ? t.manzanas
                                  .split(",")
                                  .map((m) => m.trim())
                                  .filter(Boolean)
                            : [];

                        const isEntregar = sel.mode !== "sin_predicar";

                        let statusBadge = "";
                        if (isEntregar) {
                            const allSelected = mzs.length > 0 && mzs.every((m) => sel.manzanas.includes(m));
                            const partialSelected = sel.manzanas.length > 0 && !allSelected;
                            if (allSelected) {
                                statusBadge = `<span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider rounded-lg">Entrega Total</span>`;
                            } else if (partialSelected) {
                                statusBadge = `<span class="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider rounded-lg">Entrega Parcial</span>`;
                            } else {
                                statusBadge = `<span class="px-2 py-0.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 text-[9px] font-black uppercase tracking-wider rounded-lg font-bold">Sin Entregar</span>`;
                            }
                        } else {
                            statusBadge = `<span class="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider rounded-lg">Sin Predicar</span>`;
                        }

                        const parsedAsigDate = UIHelpers.parseFirebaseDate(t.fecha_asignacion);
                        const asigDateStr = parsedAsigDate
                            ? parsedAsigDate.toLocaleDateString("es-ES", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                              })
                            : "—";

                        const toggleButtonHTML = `
                            <button class="btn-toggle-delivery px-2.5 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 ${
                                isEntregar
                                    ? "bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                                    : "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-550 dark:text-slate-400 border-slate-200 dark:border-white/5"
                            }" data-tid="${t.id}">
                                <i class="fas ${isEntregar ? "fa-clipboard-check" : "fa-undo"}"></i>
                                ${isEntregar ? "Devolver Predicado" : "Devolver sin Predicar"}
                            </button>
                        `;

                        let actionContentHTML = "";
                        if (isEntregar) {
                            actionContentHTML = `
                            <div class="space-y-3">
                                <div class="flex flex-wrap items-center gap-1.5">
                                    ${mzs
                                        .map((m) => {
                                            const isSelected = sel.manzanas.includes(m);
                                            return `
                                        <button class="mz-select-btn px-3 py-1.5 rounded-lg border text-[10px] font-black transition-all ${
                                            isSelected
                                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                                                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                                        }" data-val="${m}">
                                            ${String(m).trim().toLowerCase().startsWith("mz") ? m : `Mz. ${m}`}
                                        </button>
                                        `;
                                        })
                                        .join("")}
                                    ${
                                        mzs.length > 1
                                            ? `
                                    <button class="btn-mark-all-mzs ml-auto px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all" data-id="${t.id}">
                                        Marcar todas
                                    </button>
                                    `
                                            : ""
                                    }
                                </div>
                            </div>
                            `;
                        } else {
                            actionContentHTML = `
                            <div class="flex items-center gap-2 p-3.5 bg-slate-50 dark:bg-white/[0.01] rounded-2xl border border-slate-250/30 dark:border-white/5">
                                <i class="fas fa-info-circle text-[10.5px] text-amber-500 font-black"></i>
                                <span class="text-[9.5px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wide">El territorio se liberará y quedará libre en el mapa</span>
                            </div>
                            `;
                        }

                        return `
                        <div class="modern-card territory-report-card p-5 border-slate-200 dark:border-white/10 space-y-4 bg-white dark:bg-white/[0.02] animate-fade-in ${!isEntregar ? "opacity-60 transition-opacity duration-300" : ""}" data-id="${t.id}" data-manzanas="${t.manzanas || ""}" data-numero="${t.numero}">
                            <div class="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 bg-indigo-500 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-md shrink-0">
                                        ${t.numero}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <h4 class="text-[12px] font-black text-slate-800 dark:text-white uppercase truncate max-w-[180px]">${t.localidad || "Territorio"}</h4>
                                        <p class="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">${mzs.length} Manzanas • Asignado: ${asigDateStr}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    ${toggleButtonHTML}
                                    ${statusBadge}
                                </div>
                            </div>
                            ${actionContentHTML}
                        </div>
                    `;
                    })
                    .join("");

                const todayId = UIHelpers.formatDateId(new Date());

                return `
                <div class="assignment-group-block p-5 rounded-[2rem] border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] shadow-sm space-y-4 mb-6" data-group-key="${group.key}">
                    <div class="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3 mb-2">
                        <span class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] whitespace-nowrap">
                            ${group.conductor} (${group.dayName})
                        </span>
                        <span class="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">${group.dateStr}</span>
                    </div>
                    
                    <div class="space-y-4">
                        ${groupCards}
                    </div>

                    <!-- Panel de Controles Local por Asignación -->
                    <div class="mt-4 pt-4 border-t border-slate-200/80 dark:border-white/5 space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[8px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-widest ml-1 block">Fecha de devolución</label>
                                <input type="date" class="group-date w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white outline-none cursor-pointer" value="${group.key.split('_')[0] !== 'no-date' ? group.key.split('_')[0] : todayId}">
                            </div>
                            <div class="space-y-1">
                                <label class="text-[8px] font-black text-slate-555 dark:text-slate-400 uppercase tracking-widest ml-1 block">Conductor</label>
                                <select class="group-conductor w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white outline-none cursor-pointer">
                                    ${this.buildConductorOptions(group.conductor)}
                                </select>
                            </div>
                        </div>
                        <button class="btn-confirm-group w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2" data-group-key="${group.key}">
                            <i class="fas fa-check-double"></i> Confirmar y Guardar Asignación
                        </button>
                    </div>
                </div>
                `;
            })
            .join("");

        html += `</div>`;
        list.innerHTML = html;
        this.attachHubEvents(territoriosParaMostrar);
    }

    /**
     * Vincula los eventos de interacción de la vista unificada.
     */
    attachHubEvents(territoriosParaMostrar) {
        const list = document.getElementById("reception-hub-list");
        if (!list) return;

        territoriosParaMostrar.forEach((t) => {
            const card = list.querySelector(`.territory-report-card[data-id="${t.id}"]`);
            if (!card) return;

            const mzs = t.manzanas
                ? t.manzanas
                      .split(",")
                      .map((m) => m.trim())
                      .filter(Boolean)
                : [];

            // Toggle delivery button
            const toggleBtn = card.querySelector(".btn-toggle-delivery");
            if (toggleBtn) {
                toggleBtn.onclick = () => {
                    const sel = this.selections[t.id];
                    sel.mode = sel.mode === "sin_entregar" ? "entregar" : "sin_entregar";
                    this.renderList();
                };
            }

            // Manzanas Select Buttons
            card.querySelectorAll(".mz-select-btn").forEach((btn) => {
                btn.onclick = () => {
                    const val = btn.dataset.val;
                    const sel = this.selections[t.id];
                    const idx = sel.manzanas.indexOf(val);
                    if (idx > -1) {
                        sel.manzanas.splice(idx, 1);
                    } else {
                        sel.manzanas.push(val);
                    }
                    this.renderList();
                };
            });

            // Mark All button
            const markAllBtn = card.querySelector(".btn-mark-all-mzs");
            if (markAllBtn) {
                markAllBtn.onclick = () => {
                    const sel = this.selections[t.id];
                    const allSelected = mzs.every((m) => sel.manzanas.includes(m));
                    if (allSelected) {
                        sel.manzanas = []; // deselect all
                    } else {
                        sel.manzanas = [...mzs]; // select all
                    }
                    this.renderList();
                };
            }
        });

        // 3. Submit reports for group button
        list.querySelectorAll(".btn-confirm-group").forEach((btn) => {
            btn.onclick = async () => {
                const groupKey = btn.dataset.groupKey;
                const groupBlock = list.querySelector(`.assignment-group-block[data-group-key="${groupKey}"]`);
                if (!groupBlock) return;

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';

                try {
                    const dateInput = groupBlock.querySelector(".group-date");
                    const deliveryDate = dateInput ? dateInput.value : UIHelpers.formatDateId(new Date());
                    const conductorInput = groupBlock.querySelector(".group-conductor");
                    const conductor = conductorInput ? conductorInput.value : this.displayName || "Conductor";

                    // Find all territory cards inside this specific group block
                    const territoryCards = groupBlock.querySelectorAll(".territory-report-card");
                    const groupTerritories = [];
                    territoryCards.forEach((c) => {
                        const tid = c.dataset.id;
                        const t = this.territories.find((x) => x.id === tid);
                        if (t) groupTerritories.push(t);
                    });

                    // Check if any territory to deliver has zero apples selected (meaning Devolución)
                    const returningWithoutPreaching = groupTerritories.filter((t) => {
                        const sel = this.selections[t.id];
                        return sel?.mode !== "sin_predicar" && (!sel?.manzanas || sel.manzanas.length === 0);
                    });

                    if (returningWithoutPreaching.length > 0) {
                        const nums = returningWithoutPreaching.map((t) => `T-${t.numero}`).join(", ");
                        const confirmed = await this.showInlineConfirm(
                            "¿Devolver sin predicar?",
                            `Vas a devolver ${nums} al panel sin registrar actividad (quedarán Disponibles). ¿Confirmar devolución?`,
                        );
                        if (!confirmed) {
                            btn.disabled = false;
                            btn.innerHTML = '<i class="fas fa-check-double"></i> Confirmar y Guardar Asignación';
                            return;
                        }
                    }

                    // Process each territory in the group
                    let processedCount = 0;
                    for (const t of groupTerritories) {
                        const sel = this.selections[t.id];
                        if (sel?.mode === "sin_predicar") {
                            // Devolución sin predicar (Disponible)
                            await returnTerritorio(t.id, "Devolución sin predicar desde control unificado", null, "Disponible");
                            window.dispatchEvent(
                                new CustomEvent("territorio-liberado", { detail: { id: t.id, numero: t.numero } }),
                            );
                            continue;
                        }

                        processedCount++;
                        const mzs = t.manzanas
                            ? t.manzanas
                                  .split(",")
                                  .map((m) => m.trim())
                                  .filter(Boolean)
                            : [];
                        const checksMz = sel ? sel.manzanas : [];
                        const remaining = mzs.filter((x) => !checksMz.includes(x));

                        if (checksMz.length === 0) {
                            // Devolución sin predicar (Disponible)
                            await returnTerritorio(t.id, "Devolución desde control unificado", null, "Disponible");
                            window.dispatchEvent(
                                new CustomEvent("territorio-liberado", { detail: { id: t.id, numero: t.numero } }),
                            );
                        } else if (remaining.length === 0) {
                            // Entrega Total
                            await returnTerritorio(t.id, null, deliveryDate, "Completado", null, conductor);
                            window.dispatchEvent(
                                new CustomEvent("territorio-liberado", { detail: { id: t.id, numero: t.numero } }),
                            );
                        } else {
                            // Entrega Parcial
                            await returnTerritorioParcial(
                                t.id,
                                checksMz,
                                remaining,
                                true,
                                null,
                                deliveryDate,
                                null,
                                conductor,
                            );
                            window.dispatchEvent(
                                new CustomEvent("territorio-actualizado", { detail: { id: t.id, numero: t.numero } }),
                            );
                        }
                    }

                    showNotification("Actividad informada correctamente", "success");
                    if (window.renderTableCallback) window.renderTableCallback();

                    // Auto-close if everything in the hub is processed
                    const activeStateFilter = ["Disponible", "Predicado", "Sin asignar", "Extraviado", "Libre"];
                    const remainingActive = this.territories.filter(
                        (t) => !activeStateFilter.includes(t.estado) && !activeStateFilter.includes(t.status)
                    );
                    if (remainingActive.length === 0) {
                        setTimeout(() => {
                            this.closeModal();
                        }, 800);
                    }
                } catch (error) {
                    console.error("Error submitting reports:", error);
                    showNotification(error.message || "Error al guardar la actividad", "error");
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-check-double"></i> Confirmar y Guardar Asignación';
                }
            };
        });
    }

    showInlineConfirm(title, text) {
        return new Promise((resolve) => {
            const container = document.getElementById("reception-hub-modal");
            if (!container) {
                resolve(false);
                return;
            }

            const overlay = document.createElement("div");
            overlay.className =
                "absolute inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/60 dark:bg-black/70 backdrop-blur-md rounded-[20px] animate-fade-in";

            overlay.innerHTML = `
                <div class="bg-white dark:bg-[#0a0f18]/95 border border-slate-200/60 dark:border-white/10 p-6 rounded-[2rem] shadow-2xl max-w-sm w-full text-center space-y-4 animate-scale-in relative">
                    <div class="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center text-xl mx-auto shadow-inner border border-rose-500/10">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div>
                        <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">${title}</h4>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-semibold leading-relaxed">${text}</p>
                    </div>
                    <div class="flex gap-3 w-full pt-2">
                        <button id="inline-confirm-cancel" class="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-[9px] uppercase tracking-widest">Cancelar</button>
                        <button id="inline-confirm-ok" class="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all text-[9px] uppercase tracking-widest shadow-md shadow-rose-500/10">Sí, devolver</button>
                    </div>
                </div>
            `;

            container.appendChild(overlay);

            const cleanup = (value) => {
                overlay.remove();
                resolve(value);
            };

            overlay.querySelector("#inline-confirm-cancel").onclick = () => cleanup(false);
            overlay.querySelector("#inline-confirm-ok").onclick = () => cleanup(true);
        });
    }

    /**
     * Cierra el modal y limpia la instancia global.
     */
    closeModal() {
        if (this.unsubscribe) this.unsubscribe();
        const modal = document.getElementById("reception-hub-modal");
        if (modal) modal.remove();

        this.territories = [];
        this.selections = {};
        if (runningHubInstance === this) runningHubInstance = null;
    }

    /**
     * Cierre estático para llamadas externas.
     */
    static closeModal() {
        if (runningHubInstance) runningHubInstance.closeModal();
    }
}

// Exponer al scope global
window.ReceptionHub = ReceptionHub;
window.closeReceptionHub = () => ReceptionHub.closeModal();

window.promptReturnTerritorio = async (id, _numero) => {
    const user = window.XolvyApp?.user;
    const authUser = auth.currentUser;

    const resolvedName = normalizeRobust(user?.nombre || authUser?.displayName || authUser?.email || "Usuario");
    const isAdmin = user?.role === "Administrador" || user?.role === "SuperAdmin";

    await ReceptionHub.openModal({
        preSelectedId: id,
        viewMode: isAdmin ? "admin" : "conductor",
        displayName: resolvedName,
        isAdmin: isAdmin,
    });
};
