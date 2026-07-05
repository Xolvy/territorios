/**
 * @module program-actions
 * @description Acciones masivas, formales y recepciones de territorios en el Programa.
 * @layer Frontend / Utils
 */

import { collection, getDocs, query, where } from "firebase/firestore";
import { formalizeWeek, getTerritorios, returnTerritorioParcial } from "../../data/firestore-services.js";
import { db } from "../../firebase-config.js";
import { ReceptionHub } from "../services/reception-hub.js";
import { showModal } from "../services/ui-helpers.js";
import { getBaseTerritoryNumber, showNotification } from "../utils/helpers.js";

const _normalizeLower = (val) =>
    String(val || "")
        .trim()
        .toLowerCase();

/**
 * Handles bulk manual reception of territories.
 */
export const openReceptionModal = async (_programa, _territorios, _splitTerritories, renderTableCallback) => {
    // Vincular callback de renderizado para cuando el Hub termine
    window.renderTableCallback = renderTableCallback;
    const user = window.XolvyApp?.user;
    await ReceptionHub.openModal({
        viewMode: "admin",
        displayName: user?.nombre,
        isAdmin: true, // En esta vista siempre es Admin
    });
};

/**
 * Handles partial reception
 */
window.openPartialReceptionBulk = async (id, numero, asignado_a, manzanasRaw) => {
    const apples = manzanasRaw
        ? manzanasRaw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
        : [];
    if (apples.length <= 1) {
        return showNotification(
            "El territorio no tiene múltiples manzanas para dividir. Use recepción total.",
            "warning",
        );
    }

    showModal(
        `
        <div class="p-8 space-y-8 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] max-w-lg">
            <header class="flex items-center gap-6">
                <div class="w-16 h-16 bg-amber-500/10 rounded-3xl flex items-center justify-center text-3xl text-amber-500 shadow-inner">
                    <i class="fas fa-scissors"></i>
                </div>
                <div>
                    <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Devolución Parcial</h3>
                    <p class="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">#${numero} • ${asignado_a}</p>
                </div>
            </header>

            <p class="text-[11px] font-bold text-slate-500 uppercase px-1">Seleccione las manzanas completadas:</p>
            <div class="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                ${apples
                    .map(
                        (a) => `
                    <label class="flex items-center gap-3 p-4 modern-card border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-all group">
                        <input type="checkbox" class="apple-check peer sr-only" value="${a}">
                        <div class="relative w-10 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all shrink-0"></div>
                        <span class="text-xs font-black text-slate-700 dark:text-white uppercase">${a}</span>
                    </label>
                `,
                    )
                    .join("")}
            </div>

            <div class="space-y-4">
                <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Acción con el resto</label>
                <select id="partial-unassign" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-white outline-none">
                    <option value="true">Devolver resto al inventario</option>
                    <option value="false">Mantener resto asignado a ${asignado_a}</option>
                </select>
            </div>

            <div class="pt-6 border-t border-slate-50 dark:border-white/5 flex gap-4">
                <button id="cancel-partial" class="flex-1 min-w-0 py-5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
                <button id="confirm-partial" class="flex-[2] py-5 bg-amber-500 hover:bg-amber-400 text-slate-800 dark:text-slate-100 font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-amber-500/20 active:scale-95 transition-all">PROCESAR DEVOLUCIÓN</button>
            </div>
        </div>
    `,
        (modal) => {
            modal.querySelector("#cancel-partial").onclick = () => modal.classList.add("hidden");
            modal.querySelector("#confirm-partial").onclick = async (e) => {
                const checked = Array.from(modal.querySelectorAll(".apple-check:checked")).map((cb) => cb.value);
                if (checked.length === 0) return showNotification("Seleccione al menos una manzana", "warning");

                const unassign = modal.querySelector("#partial-unassign").value === "true";
                const remaining = apples.filter((a) => !checked.includes(a));
                if (remaining.length === 0 && !unassign) {
                    return showNotification(
                        "Si devuelve todas las manzanas, no puede mantener el resto asignado.",
                        "warning",
                    );
                }

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

                try {
                    await returnTerritorioParcial(
                        id,
                        checked,
                        remaining,
                        unassign,
                        "Devolución parcial desde Programa",
                        new Date().toISOString(),
                    );
                    showNotification(`Se devolvieron ${checked.length} manzanas.`);
                    modal.classList.add("hidden");
                    document.getElementById("modal-container").classList.add("hidden");
                    if (window._renderTableFallback) window._renderTableFallback();
                } catch (err) {
                    console.error(err);
                    showNotification("Error procesando devolución parcial", "error");
                    btn.disabled = false;
                    btn.innerHTML = "PROCESAR DEVOLUCIÓN";
                }
            };
        },
        "max-w-lg",
        "modal-container-nested",
    );
};

/**
 * Handles Formalizar Masivo
 */
export const openFormalizeModal = async (programa, territorios, loadWeekDataCallback) => {
    const freshTerritorios = await getTerritorios();
    territorios.length = 0;
    territorios.push(...freshTerritorios);

    const normalize = (val) => String(val || "").trim();
    const territoryMap = freshTerritorios.reduce((acc, t) => {
        acc[normalize(t.numero)] = t;
        return acc;
    }, {});

    // --- CAMBIO A: Detección dinámica de todos los slots (_2, _3, etc) ---
    const TURNOS_BASE = ["manana", "tarde", "noche", "zoom"];
    const toSync = [];

    // Pre-cargar asignaciones activas de banco_s13 para detección automática de conflictos
    const snapActivos = await getDocs(query(collection(db, "banco_s13"), where("fecha_entrega", "==", null)));
    const banco_activos = {}; // Map: numero -> Current S-13 Record
    snapActivos.docs.forEach((d) => {
        const data = d.data();
        banco_activos[String(data.numero || data.territorio_id).trim()] = data;
    });

    programa.dias.forEach((dia, dayIdx) => {
        Object.keys(dia).forEach((key) => {
            const isBase = TURNOS_BASE.some((base) => key === base || key.startsWith(`${base}_`));
            if (!isBase) return;

            const data = dia[key];
            if (data?.territorio) {
                const tNums = String(data.territorio)
                    .split(/[,;/]/)
                    .map((n) => n.trim())
                    .filter((n) => n);
                tNums.forEach((tNum) => {
                    const baseT = getBaseTerritoryNumber(tNum);
                    const tInfo = territoryMap[normalize(baseT)] || null;

                    const activeS13 = banco_activos[tNum];
                    // Un conflicto es si ya está asignado en S-13 pero a ALGUIEN MÁS o EN OTRA SEMANA
                    const isConflict =
                        activeS13 && (activeS13.weekId !== programa.id || activeS13.conductor !== data.conductor);
                    const isAlreadySync =
                        activeS13 && activeS13.weekId === programa.id && activeS13.conductor === data.conductor;

                    toSync.push({
                        dayIdx,
                        turnoId: key,
                        dia,
                        data,
                        tInfo,
                        specificT: tNum,
                        isConflict,
                        conflictOwner: isConflict ? activeS13.conductor : null,
                        isAlreadySync,
                    });
                });
            }
        });
    });

    if (toSync.length === 0) return showNotification("No hay asignaciones programadas para formalizar", "info");

    showModal(
        `
        <div class="flex flex-col max-h-[80vh] p-6 space-y-4">
            <header class="flex items-center gap-6">
                <div class="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-3xl text-emerald-500 shadow-inner">
                    <i class="fas fa-project-diagram"></i>
                </div>
                <div>
                    <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Asignación de Territorios (S-13)</h3>
                    <p class="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Sincronización masiva automática</p>
                </div>
            </header>

            <div class="flex justify-between items-center mt-4">
                <p class="text-[11px] font-bold text-slate-500 uppercase px-1">Seleccione las asignaciones:</p>
                <button id="sync-select-all" class="px-6 py-3 bg-slate-100 dark:bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-primary transition-all border border-slate-200/50">Deseleccionar Todo</button>
            </div>
            <div class="flex-1 min-w-0 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    ${toSync
                        .map((item, idx) => {
                            const exists = !!item.tInfo;
                            const hasConductor = !!item.data.conductor;
                            const isConflicted = item.isConflict;
                            const canSync = exists && hasConductor && !isConflicted;

                            return `
                    <label class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border ${item.isAlreadySync ? "border-emerald-500/10 opacity-70" : canSync ? "border-slate-100 dark:border-white/5" : "border-amber-500/30"} flex items-center justify-between group cursor-pointer hover:bg-white dark:hover:bg-white/5 transition-all">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" class="sync-check peer sr-only" value="${idx}" ${canSync && !item.isAlreadySync ? "checked" : ""} ${!canSync ? "disabled" : ""}>
                            <div class="relative w-10 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all shrink-0 transition-opacity ${!canSync ? "opacity-30" : ""}"></div>
                            <div class="w-8 h-8 ${exists ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500"} flex items-center justify-center rounded-lg font-black text-[10px] shrink-0">${item.specificT}</div>
                            <div class="flex flex-col">
                                <span class="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-tight">${item.data.conductor || "Sin Conductor"}</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-[7px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">${item.dia.nombre} • <span class="text-blue-500">${item.turnoId}</span></span>
                                    ${item.isAlreadySync ? '<span class="text-[7px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-1 py-0.5 rounded">Ya Sincronizado</span>' : ""}
                                    ${isConflicted ? `<span class="text-[7px] font-black text-rose-500 uppercase bg-rose-500/10 px-1 py-0.5 rounded font-black border border-rose-500/20"><i class="fas fa-ban mr-1"></i> No disponible / Ocupado por ${item.conflictOwner}</span>` : ""}
                                    ${!exists ? '<span class="text-[7px] font-black text-amber-500 uppercase bg-amber-500/10 px-1 py-0.5 rounded">No en Inventario</span>' : ""}
                                    ${exists && !hasConductor ? '<span class="text-[7px] font-black text-amber-500 uppercase bg-amber-500/10 px-1 py-0.5 rounded">Falta Conductor</span>' : ""}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-[9px] font-black uppercase" style="color:${isConflicted ? "#f43f5e" : item.isAlreadySync ? "#10b981" : "#cbd5e1"}">
                                ${isConflicted ? "×" : item.isAlreadySync ? "✓" : "—"}
                            </span>
                            <i class="fas ${item.isAlreadySync ? "fa-check-circle text-emerald-500/30" : canSync ? "fa-arrow-right text-slate-800 dark:text-slate-200" : isConflicted ? "fa-ban text-rose-500/30" : "fa-exclamation-triangle text-amber-500"} text-[10px]"></i>
                        </div>
                    </label>
                `;
                        })
                        .join("")}
            </div>

            <div class="space-y-3 p-4 bg-emerald-50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-600">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-tight">Fecha de Asignación Automática</p>
                        <p class="text-[8px] text-emerald-500/70 font-bold uppercase tracking-widest mt-0.5">S-13 registrará hoy: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-white/5 shrink-0">
                <div class="flex items-center gap-2 opacity-20 hover:opacity-100 transition-opacity">
                    <i class="fas fa-shield-alt text-[8px] text-emerald-500"></i>
                    <span class="text-[7px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Sincronización Bilateral Activa</span>
                </div>
                <div class="flex gap-4">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="px-6 py-4 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black rounded-lg text-[10px] uppercase tracking-widest">Cerrar</button>
                    <button id="confirm-sync-all" class="px-8 py-4 bg-emerald-500 text-white font-black rounded-lg text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all">Confirmar Asignaciones</button>
                </div>
            </div>
        </div>
    `,
        (modal) => {
            const updateCounter = () => {
                const checked = modal.querySelectorAll(".sync-check:checked").length;
                const btn = modal.querySelector("#confirm-sync-all");
                if (btn) btn.innerText = `Confirmar Asignaciones (${checked})`;
            };

            let syncSelected = true;
            updateCounter();

            modal.querySelector("#sync-select-all").onclick = () => {
                syncSelected = !syncSelected;
                modal.querySelectorAll(".sync-check:not(:disabled)").forEach((cb) => (cb.checked = syncSelected));
                modal.querySelector("#sync-select-all").innerText = syncSelected
                    ? "Deseleccionar Todo"
                    : "Seleccionar Todo";
                updateCounter();
            };

            modal.querySelectorAll(".sync-check").forEach((cb) => (cb.onchange = updateCounter));

            modal.querySelector("#confirm-sync-all").onclick = async (e) => {
                const checkedIdxs = Array.from(modal.querySelectorAll(".sync-check:checked")).map((cb) =>
                    parseInt(cb.value, 10),
                );
                if (checkedIdxs.length === 0) return showNotification("Seleccione al menos una asignación", "warning");

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> PROCESANDO...';

                const weekId = programa.id;

                const assignments = checkedIdxs.map((idx) => {
                    const item = toSync[idx];
                    return {
                        territorio_id: item.specificT,
                        conductor: item.data.conductor,
                        turno: item.turnoId,
                        faceta: item.data.faceta || "Casa en casa",
                        observaciones: item.data.observaciones || "",
                        fecha_salida: new Date(`${item.dia.fecha}T12:00:00Z`).toISOString(),
                    };
                });

                try {
                    showNotification(`Formalizando ${assignments.length} asignaciones...`, "info");
                    const result = await formalizeWeek(weekId, assignments);

                    if (result.warnings && result.warnings.length > 0) {
                        showNotification(
                            `¡Formalizado! ${result.warnings.length} territorios ya estaban asignados previamente.`,
                            "warning",
                        );
                    } else {
                        showNotification(`¡${assignments.length} asignaciones formalizadas con éxito!`, "success");
                    }

                    modal.classList.add("hidden");
                    if (loadWeekDataCallback) await loadWeekDataCallback();
                } catch (err) {
                    console.error("Error formalizando:", err);
                    showNotification("Error en la formalización", "error");
                    btn.disabled = false;
                    btn.innerHTML = "Formalizar Selección";
                }
            };
        },
    );
};
