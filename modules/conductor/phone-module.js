import { updateTelefono, updateTelefonoStatus } from "../../data/firestore-services.js";
import { showModal } from "../services/ui-helpers.js";
import { formatPhoneNumber, showNotification } from "../utils/helpers.js";

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE ESTADOS — Fuente única de verdad para UI
// ═══════════════════════════════════════════════════════════════════
const STATUS_CONFIG = {
    Contestaron: { icon: "fa-check-circle", color: "emerald", label: "Contestó" },
    "No contestan": { icon: "fa-phone-slash", color: "rose", label: "No Contestó" },
    Colgaron: { icon: "fa-phone-alt", color: "amber", label: "Colgaron" },
    Revisita: { icon: "fa-bookmark", color: "indigo", label: "Revisita" },
    "No llamar": { icon: "fa-ban", color: "slate", label: "No Llamar" },
    Suspendido: { icon: "fa-exclamation-triangle", color: "red", label: "Suspendido" },
    Testigo: { icon: "fa-home", color: "teal", label: "Testigo JW" },
};

const COLOR_CLASSES = {
    emerald: {
        bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
        border: "border-emerald-500/25",
        text: "text-emerald-600 dark:text-emerald-400",
        solid: "bg-emerald-500",
        hover: "hover:bg-emerald-500/20",
    },
    rose: {
        bg: "bg-rose-500/10 dark:bg-rose-500/15",
        border: "border-rose-500/25",
        text: "text-rose-600 dark:text-rose-400",
        solid: "bg-rose-500",
        hover: "hover:bg-rose-500/20",
    },
    amber: {
        bg: "bg-amber-500/10 dark:bg-amber-500/15",
        border: "border-amber-500/25",
        text: "text-amber-600 dark:text-amber-400",
        solid: "bg-amber-500",
        hover: "hover:bg-amber-500/20",
    },
    indigo: {
        bg: "bg-indigo-500/10 dark:bg-indigo-500/15",
        border: "border-indigo-500/25",
        text: "text-indigo-600 dark:text-indigo-400",
        solid: "bg-indigo-500",
        hover: "hover:bg-indigo-500/20",
    },
    slate: {
        bg: "bg-slate-500/10 dark:bg-slate-500/15",
        border: "border-slate-500/25",
        text: "text-slate-600 dark:text-slate-400",
        solid: "bg-slate-500",
        hover: "hover:bg-slate-500/20",
    },
    red: {
        bg: "bg-red-500/10 dark:bg-red-500/15",
        border: "border-red-500/25",
        text: "text-red-600 dark:text-red-400",
        solid: "bg-red-500",
        hover: "hover:bg-red-500/20",
    },
    teal: {
        bg: "bg-teal-500/10 dark:bg-teal-500/15",
        border: "border-teal-500/25",
        text: "text-teal-600 dark:text-teal-400",
        solid: "bg-teal-500",
        hover: "hover:bg-teal-500/20",
    },
};

// ═══════════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export const initializePhoneModule = (initialPhones, publicadores, _displayName, tbody, _onRefresh) => {
    if (!tbody) return;

    // Xolvy Data Shield: normalizar campos de teléfono
    const normalize = (val) =>
        String(val || "")
            .replace(/[\s()-]/g, "")
            .trim();

    // Xolvy Batch Engine: almacenamiento local de cambios pendientes (closure privado)
    const pendingChanges = window.pendingPhoneChanges || {};
    window.pendingPhoneChanges = pendingChanges;

    const myPhones = (initialPhones || [])
        .filter(
            (p) => (p.telefono || p.phone || p.numero) && String(p.telefono || p.phone || p.numero).trim().length > 0,
        )
        .map((p) => ({
            ...p,
            telefono: normalize(p.telefono || p.phone || p.numero),
        }));

    // ═══════════════════════════════════════════════════════
    // RENDER PRINCIPAL
    // ═══════════════════════════════════════════════════════
    const render = () => {
        if (!tbody) return;

        const displayPhones = myPhones.map((p) => {
            const pending = pendingChanges[p.id] || {};
            return {
                ...p,
                estado: pending.estado !== undefined ? pending.estado : p.estado,
                publicador_asignado: pending.publicador_asignado || p.publicador_asignado,
                notas: pending.notas !== undefined ? pending.notas : p.notas || p.comentario || "",
            };
        });

        // ── Estadísticas ────────────────────────────────────
        const stats = {
            Contestaron: 0,
            "No contestan": 0,
            Colgaron: 0,
            Revisita: 0,
            "No llamar": 0,
            Suspendido: 0,
            Testigo: 0,
        };
        let marcados = 0;

        displayPhones.forEach((p) => {
            const e = (p.estado || "").toLowerCase().trim();
            if (["contestaron", "contestó"].includes(e)) {
                stats.Contestaron++;
                marcados++;
            } else if (["no contestan", "no contestó", "no contestaron"].includes(e)) {
                stats["No contestan"]++;
                marcados++;
            } else if (e === "colgaron") {
                stats.Colgaron++;
                marcados++;
            } else if (e === "revisita") {
                stats.Revisita++;
                marcados++;
            } else if (e === "no llamar") {
                stats["No llamar"]++;
                marcados++;
            } else if (e === "suspendido") {
                stats.Suspendido++;
                marcados++;
            } else if (e === "testigo") {
                stats.Testigo++;
                marcados++;
            }
        });

        // ── Barra de estadísticas ────────────────────────────
        const statsContainer = tbody.closest("#phone-module-card")?.querySelector("#phone-stats-bar");
        if (statsContainer) {
            const total = displayPhones.length;
            const pct = total > 0 ? Math.round((marcados / total) * 100) : 0;
            const pctColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-indigo-500";

            statsContainer.innerHTML = `
                <!-- Progreso de sesión -->
                <div class="col-span-3 sm:col-span-7 mb-1">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Progreso de Sesión</span>
                        <span class="text-[9px] font-black tabular-nums ${pct === 100 ? "text-emerald-500" : "text-slate-500 dark:text-slate-400"}">
                            ${marcados} / ${total} marcados
                            ${pct === 100 ? ' <i class="fas fa-check-circle text-emerald-500 ml-1"></i>' : ""}
                        </span>
                    </div>
                    <div class="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full ${pctColor} rounded-full transition-all duration-700 ease-out" style="width: ${pct}%"></div>
                    </div>
                </div>
                <!-- Chips de estado -->
                ${Object.entries(STATUS_CONFIG)
                    .map(([key, cfg]) => {
                        const count = stats[key] || 0;
                        const cls = COLOR_CLASSES[cfg.color];
                        return `
                    <div class="${cls.bg} border ${cls.border} rounded-2xl p-2.5 text-center flex flex-col justify-center min-w-0 ${count > 0 ? `ring-1 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ring-${cfg.color}-500/30` : ""}">
                        <i class="fas ${cfg.icon} text-[10px] ${cls.text} mb-0.5 opacity-70"></i>
                        <span class="block text-[7px] font-black ${cls.text} uppercase tracking-widest truncate">${cfg.label}</span>
                        <span class="text-sm font-black ${count > 0 ? cls.text : "text-slate-300 dark:text-white/20"} mt-0.5 block">${count}</span>
                    </div>`;
                    })
                    .join("")}
            `;
            statsContainer.className =
                "sticky top-[60px] lg:top-0 z-30 bg-white/97 dark:bg-[#0b0f19]/97 backdrop-blur-md py-3 px-1 grid grid-cols-3 sm:grid-cols-7 gap-2 border-b border-slate-200 dark:border-white/10 mb-4";
            // Sync table header sticky offset with the actual stats bar height
            requestAnimationFrame(() => {
                const thead = tbody.closest("table")?.querySelector("thead");
                if (thead && statsContainer) {
                    const statsH = statsContainer.getBoundingClientRect().height;
                    const isMobile = window.innerWidth < 1024;
                    const headerOffset = isMobile ? 60 : 0;
                    thead.style.top = `${statsH + headerOffset}px`;
                }
            });
        }

        // ── Filas de la tabla ────────────────────────────────
        tbody.innerHTML = displayPhones
            .map((p, idx) => {
                const strikes = p.intentos_fallidos || 0;
                const statusCfg = STATUS_CONFIG[p.estado] || null;
                const hasStatus = p.estado && !["Sin asignar", "En Sesión", ""].includes(p.estado);
                const statusColor = statusCfg ? COLOR_CLASSES[statusCfg.color] : null;

                // Strikes badge
                const strikesHtml =
                    strikes > 0
                        ? `<div class="flex items-center gap-1 ml-2" title="${strikes} de 3 intentos fallidos">
                    ${Array.from({ length: 3 })
                        .map(
                            (_, i) =>
                                `<span class="w-2 h-2 rounded-full transition-all ${
                                    i < strikes
                                        ? "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]"
                                        : "bg-slate-200 dark:bg-white/10"
                                }"></span>`,
                        )
                        .join("")}
                   </div>`
                        : "";

                // Botón de estado
                const statusBtnClasses =
                    hasStatus && statusColor
                        ? `${statusColor.bg} ${statusColor.text} border ${statusColor.border}`
                        : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-white/15 hover:border-indigo-500/40 hover:text-indigo-500";

                const statusBtnContent =
                    hasStatus && statusCfg
                        ? `<i class="fas ${statusCfg.icon}"></i> <span>${statusCfg.label || p.estado}</span>`
                        : `<i class="fas fa-tag opacity-40"></i> <span class="opacity-60">MARCAR</span>`;

                // Prefijo telefónico correcto (Ecuador: números ya incluyen el 0 inicial)
                const phoneHref = `tel:${p.telefono}`;

                // Nota truncada
                const notaHtml = p.notas
                    ? `<p class="text-[9px] text-amber-600 dark:text-amber-400/90 font-medium italic mt-1.5 flex items-center gap-1.5 max-w-full sm:max-w-[200px] truncate" title="${p.notas.replace(/"/g, "&quot;")}">
                       <i class="fas fa-sticky-note text-[8px] shrink-0"></i>
                       <span class="truncate">${p.notas}</span>
                   </p>`
                    : "";

                return `
            <tr class="flex flex-col sm:table-row hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors border-b border-black/5 dark:border-white/5 p-4 sm:p-0 gap-3 sm:gap-0 animate-fade-in" style="animation-delay: ${idx * 30}ms; animation-fill-mode: both;">

                <!-- Col 1: Teléfono -->
                <td class="p-0 sm:p-4 block sm:table-cell align-middle">
                    <div class="flex flex-col">
                        <div class="flex items-center justify-between sm:justify-start gap-2">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span class="text-[14px] sm:text-[13px] font-black text-slate-800 dark:text-white tabular-nums tracking-tight">
                                    <a href="${phoneHref}" class="md:pointer-events-none md:text-inherit text-indigo-600 dark:text-indigo-400 hover:underline decoration-2 underline-offset-4">
                                        ${formatPhoneNumber(p.telefono)}
                                    </a>
                                </span>
                                ${strikesHtml}
                            </div>
                            <!-- Mobile Status Badge -->
                            <div class="sm:hidden ${hasStatus && statusColor ? `${statusColor.bg} ${statusColor.text} border ${statusColor.border}` : "hidden"} px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border">
                                ${statusCfg ? statusCfg.label : p.estado}
                            </div>
                        </div>
                        <!-- Propietario en mobile -->
                        <p class="sm:hidden font-black text-[11px] text-slate-500 dark:text-slate-400 uppercase mt-0.5">${p.propietario || p.nombre || ""}</p>
                        ${notaHtml}
                    </div>
                </td>

                <!-- Col 2: Nombre (Desktop) -->
                <td class="p-4 hidden sm:table-cell align-middle">
                    <p class="font-black text-[10px] text-slate-600 dark:text-slate-300 uppercase">${p.propietario || p.nombre || ""}</p>
                </td>

                <!-- Col 3: Dirección -->
                <td class="p-0 sm:p-4 block sm:table-cell align-middle">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-map-marker-alt text-slate-300 dark:text-white/20 text-[9px] sm:hidden"></i>
                        <p class="text-[10px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate max-w-full sm:max-w-[150px]">${p.direccion || "—"}</p>
                    </div>
                </td>

                <!-- Col 4: Publicador + Acciones Mobile -->
                <td class="p-0 sm:p-4 block sm:table-cell align-middle">
                    <div class="flex flex-row items-center gap-2 sm:gap-4">
                        <div class="flex-1 min-w-0">
                            <p class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:hidden ml-1">Asignar Publicador</p>
                            <select data-id="${p.id}" data-action="staff"
                                class="w-full sm:w-auto bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-lg px-3 py-2.5 sm:py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer">
                                <option value=""></option>
                                ${[...(publicadores || [])]
                                    .sort((a, b) =>
                                        String(a.nombre || "")
                                            .trim()
                                            .localeCompare(String(b.nombre || "").trim(), "es", {
                                                sensitivity: "base",
                                            }),
                                    )
                                    .map((pub) => {
                                        const isSelected =
                                            p.publicador_asignado === pub.nombre ||
                                            p.publicador_asignado === pub.id ||
                                            p.asignado_a === pub.id;
                                        return `<option value="${pub.nombre.replace(/"/g, "&quot;")}" ${isSelected ? "selected" : ""}>${pub.nombre}</option>`;
                                    })
                                    .join("")}
                            </select>
                        </div>
                        <!-- Acciones Mobile -->
                        <div class="flex items-center gap-2 sm:hidden">
                            <button data-action="status" data-id="${p.id}" data-phone="${p.telefono}"
                                class="px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all whitespace-nowrap ${statusBtnClasses}">
                                ${statusBtnContent}
                            </button>
                            <button data-action="notes" data-id="${p.id}" data-phone="${p.telefono}" data-notes="${encodeURIComponent(p.notas || "")}"
                                class="w-11 h-11 flex items-center justify-center ${p.notas ? "text-amber-500 bg-amber-500/10" : "text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5"} rounded-xl border border-black/5 dark:border-white/10 active:scale-90 transition-all" title="Notas">
                                <i class="fas fa-sticky-note text-sm"></i>
                            </button>
                        </div>
                    </div>
                </td>

                <!-- Col 5: Estado (Desktop) -->
                <td class="p-4 hidden sm:table-cell text-center align-middle">
                    <div class="flex flex-col items-center gap-1.5">
                        <button data-action="status" data-id="${p.id}" data-phone="${p.telefono}"
                            class="min-w-[108px] px-3 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 border ${statusBtnClasses}">
                            ${statusBtnContent}
                        </button>
                        ${
                            p.estado === "Revisita"
                                ? `
                            <button data-action="devolver" data-id="${p.id}"
                                class="text-[8px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest hover:underline flex items-center gap-1 transition-colors">
                                <i class="fas fa-undo text-[7px]"></i> Devolver
                            </button>`
                                : ""
                        }
                    </div>
                </td>

                <!-- Col 6: Notas (Desktop) -->
                <td class="p-4 hidden sm:table-cell align-middle">
                    <div class="flex items-center gap-2">
                        <button data-action="notes" data-id="${p.id}" data-phone="${p.telefono}" data-notes="${encodeURIComponent(p.notas || "")}"
                            class="${p.notas ? "text-amber-500 hover:text-amber-600" : "text-slate-400 dark:text-slate-500 hover:text-indigo-500"} transition-colors" title="${p.notas ? "Editar nota" : "Agregar nota"}">
                            <i class="fas fa-sticky-note"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
            })
            .join("");

        // ── Event Delegation (una sola vez, sobre tbody persistente) ──
        attachDelegation();
    };

    // ═══════════════════════════════════════════════════════
    // EVENT DELEGATION — Sin duplicados, sin onclick inline
    // ═══════════════════════════════════════════════════════
    const attachDelegation = () => {
        // Guardamos las referencias dinámicas en el elemento DOM persistente
        tbody._phoneModule = {
            handleStatusClick,
            handleNotesClick,
            handleDevolverClick,
            handleStaffChange,
        };

        if (tbody._delegationAttached) return;
        tbody._delegationAttached = true;

        tbody.addEventListener("click", (e) => {
            const ctx = tbody._phoneModule;
            if (!ctx) return;
            const btn = e.target.closest("[data-action]");
            if (!btn || btn.tagName === "SELECT") return;
            const { action, id, phone, notes } = btn.dataset;

            if (action === "status") ctx.handleStatusClick(id, phone);
            if (action === "notes") ctx.handleNotesClick(id, phone, notes);
            if (action === "devolver") ctx.handleDevolverClick(id);
        });

        tbody.addEventListener("change", (e) => {
            const ctx = tbody._phoneModule;
            if (!ctx) return;
            const select = e.target.closest('select[data-id][data-action="staff"]');
            if (!select) return;
            ctx.handleStaffChange(select.dataset.id, select.value);
        });
    };

    // ═══════════════════════════════════════════════════════
    // HANDLERS DE ACCIÓN
    // ═══════════════════════════════════════════════════════

    /** Modal de selección de estado — con íconos y colores */
    const handleStatusClick = (id, phone) => {
        const statuses = Object.keys(STATUS_CONFIG);
        showModal(
            `
            <div class="p-6 space-y-5">
                <div class="flex items-center gap-4 pb-2 border-b border-slate-100 dark:border-white/5">
                    <div class="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 text-xl border border-indigo-500/10">
                        <i class="fas fa-phone-alt"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Marcar Estado</p>
                        <h3 class="text-lg font-black text-slate-800 dark:text-white tabular-nums">${formatPhoneNumber(phone)}</h3>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2.5">
                    ${statuses
                        .map((s) => {
                            const cfg = STATUS_CONFIG[s];
                            const cls = COLOR_CLASSES[cfg.color];
                            return `
                        <button data-status="${s}" id="status-btn-${s.replace(/\s/g, "_")}"
                            class="p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border ${cls.bg} ${cls.border} ${cls.text} ${cls.hover} flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            <i class="fas ${cfg.icon} text-base"></i>
                            <span>${cfg.label}</span>
                        </button>`;
                        })
                        .join("")}
                </div>
            </div>
        `,
            (modal) => {
                modal.querySelectorAll("[data-status]").forEach((btn) => {
                    btn.onclick = () => executeSetStatus(id, btn.dataset.status);
                });
            },
            "max-w-sm",
        );
    };

    /** Notas — pre-rellena con la nota existente (B1 fix) */
    const handleNotesClick = (id, phone, encodedNotes) => {
        const currentNotes = encodedNotes ? decodeURIComponent(encodedNotes) : "";
        const phone_obj = myPhones.find((p) => p.id === id);
        const realNotes = currentNotes || phone_obj?.notas || phone_obj?.comentario || "";

        showModal(
            `
            <div class="p-6 space-y-5">
                <div class="flex items-center gap-4 pb-3 border-b border-slate-100 dark:border-white/5">
                    <div class="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 text-xl border border-amber-500/10">
                        <i class="fas fa-sticky-note"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Notas del Número</p>
                        <h3 class="text-lg font-black text-slate-800 dark:text-white tabular-nums">${formatPhoneNumber(phone)}</h3>
                    </div>
                </div>
                <textarea id="phone-notes-textarea" rows="4"
                    class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm text-slate-800 dark:text-white resize-none outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all placeholder-slate-400"
                    placeholder="Escribe una nota sobre este número...">${realNotes}</textarea>
                <div class="flex gap-3">
                    <button id="phone-notes-cancel"
                        class="flex-1 py-3 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
                        Cancelar
                    </button>
                    <button id="phone-notes-save"
                        class="flex-[1.5] py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/20 transition-all active:scale-95">
                        <i class="fas fa-save mr-2"></i>Guardar Nota
                    </button>
                </div>
            </div>
        `,
            (modal) => {
                const textarea = modal.querySelector("#phone-notes-textarea");
                textarea.focus();
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);

                modal.querySelector("#phone-notes-cancel").onclick = () => window.closeModal();
                modal.querySelector("#phone-notes-save").onclick = async () => {
                    const newNotes = textarea.value.trim();
                    window.closeModal();
                    await executeUpdateNotes(id, newNotes);
                };
            },
            "max-w-sm",
        );
    };

    const handleDevolverClick = async (id) => {
        pendingChanges[id] = { ...(pendingChanges[id] || {}), estado: "" };
        render();
        try {
            await updateTelefonoStatus(id, "", "");
            showNotification("Revisita devuelta al pool central", "info");
        } catch (err) {
            console.error("Error devolviendo revisita:", err);
            showNotification("Error al devolver revisita", "error");
        } finally {
            if (pendingChanges[id]) {
                delete pendingChanges[id].estado;
                if (!Object.keys(pendingChanges[id]).length) delete pendingChanges[id];
            }
            render();
        }
    };

    const handleStaffChange = async (id, staff) => {
        pendingChanges[id] = { ...(pendingChanges[id] || {}), publicador_asignado: staff };
        render();
        try {
            const phone = myPhones.find((p) => p.id === id);
            await updateTelefonoStatus(id, phone?.estado || "", staff);
            showNotification("Publicador asignado", "success");
        } catch (err) {
            console.error("Error asignando publicador:", err);
            showNotification("Error al asignar publicador", "error");
        } finally {
            if (pendingChanges[id]) {
                delete pendingChanges[id].publicador_asignado;
                if (!Object.keys(pendingChanges[id]).length) delete pendingChanges[id];
            }
            render();
        }
    };

    // ═══════════════════════════════════════════════════════
    // OPERACIONES ATÓMICAS
    // ═══════════════════════════════════════════════════════

    const executeSetStatus = (id, status) => {
        const doUpdate = async () => {
            pendingChanges[id] = { ...(pendingChanges[id] || {}), estado: status };
            window.closeModal();
            render();
            try {
                const phone = myPhones.find((p) => p.id === id);
                const pub = phone?.publicador_asignado || phone?.asignado_a || "";
                await updateTelefonoStatus(id, status, pub);
                showNotification(`Estado "${STATUS_CONFIG[status]?.label || status}" guardado`, "success");
            } catch (err) {
                console.error("Error actualizando estado:", err);
                showNotification("Error al guardar estado", "error");
            } finally {
                if (pendingChanges[id]) {
                    delete pendingChanges[id].estado;
                    if (!Object.keys(pendingChanges[id]).length) delete pendingChanges[id];
                }
                render();
            }
        };

        if (status === "Suspendido" || status === "Testigo") {
            showModal(
                `
                <div class="p-8 space-y-6 text-center">
                    <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-[2rem] flex items-center justify-center text-2xl mx-auto shadow-xl border border-rose-500/20">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="space-y-2">
                        <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">¿Confirmar?</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase leading-relaxed px-4">
                            Este número será marcado como <strong class="text-rose-500">${status}</strong>.
                            ${
                                status === "Suspendido"
                                    ? "Indica que la persona solicitó no ser contactada."
                                    : "Indica que en esta dirección vive un Testigo de Jehová."
                            }
                            El registro será <strong>eliminado permanentemente</strong> del banco de números.
                        </p>
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button onclick="window.closeModal()" class="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                        <button id="btn-confirm-purge" class="flex-[1.5] py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95">Confirmar</button>
                    </div>
                </div>
            `,
                (modal) => {
                    modal.querySelector("#btn-confirm-purge").onclick = doUpdate;
                },
                "max-w-sm",
            );
        } else {
            doUpdate();
        }
    };

    const executeUpdateNotes = async (id, newNotes) => {
        // B4 fix: solo actualizar si el usuario realmente guardó (no canceló)
        pendingChanges[id] = { ...(pendingChanges[id] || {}), notas: newNotes };
        render();
        try {
            await updateTelefono(id, { notas: newNotes, comentario: newNotes });
            showNotification(newNotes ? "Nota guardada" : "Nota eliminada", "success");
        } catch (err) {
            console.error("Error guardando nota:", err);
            showNotification("Error al guardar nota", "error");
        } finally {
            if (pendingChanges[id]) {
                delete pendingChanges[id].notas;
                if (!Object.keys(pendingChanges[id]).length) delete pendingChanges[id];
            }
            render();
        }
    };

    // Render inicial
    render();
};
