import { deleteTerritorio, getTerritorios, updateTerritorio } from "../../data/firestore-services.js";
import { MapViewer } from "../map-viewer.js";
import { showCustomConfirm, showModal } from "../services/ui-helpers.js";
import { showNotification } from "../utils/helpers.js";

export const renderS12View = async (container, config, appVersion) => {
    let terrs = [];
    try {
        const tRaw = await getTerritorios();

        // Xolvy Data Shield: Robust normalization & ghost filtering
        const normalizeT = (val) => String(val || "").trim();
        terrs = tRaw
            .filter((rec) => {
                const hasNum = rec.numero && String(rec.numero).trim().length > 0;
                return hasNum;
            })
            .map((rec) => ({
                ...rec,
                numero: normalizeT(rec.numero),
                manzanas: String(rec.manzanas || "")
                    .replace(/Salmo/gi, "Mz.")
                    .trim(),
                localidad: String(rec.localidad || "")
                    .replace(/grupos?/gi, "")
                    .trim(),
            }))
            .sort((a, b) => String(a.numero || "").localeCompare(String(b.numero || ""), undefined, { numeric: true }));
    } catch (e) {
        console.error("Error sorting S12:", e);
    }

    const renderGrid = (query = "") => {
        const filtered = query
            ? terrs.filter(
                  (t) =>
                      String(t.numero || "")
                          .toLowerCase()
                          .includes(query) ||
                      t.localidad?.toLowerCase().includes(query) ||
                      t.nombre?.toLowerCase().includes(query),
              )
            : terrs;

        const grid = container.querySelector("#s12-grid");
        if (!grid) return;

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">Sin territorios encontrados</div>`;
            return;
        }

        grid.innerHTML = filtered
            .map((t) => {
                try {
                    const isAssigned = t.estado === "Asignado" || t.estado === "Pendiente";
                    const allMzs = t.manzanas ? String(t.manzanas).split(",").filter(Boolean).length : 0;

                    return `
                <div class="modern-card p-5 md:p-6 border-slate-100 dark:border-white/5 shadow-sm group hover:border-primary/50 transition-all bg-white dark:bg-slate-900/40 flex flex-col h-full relative overflow-hidden">
                    <div class="flex justify-between items-start mb-6 shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 md:w-12 md:h-12 bg-slate-50 dark:bg-white/5 rounded-xl md:rounded-2xl flex items-center justify-center text-base md:text-lg font-black text-slate-800 dark:text-white shadow-inner shrink-0">
                                ${t.numero}
                            </div>
                            <div class="flex gap-1 p-1 bg-slate-50/50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                <button onclick="window.viewMapFromBaseS12('${t.id}')" class="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-white dark:bg-white/5 text-indigo-500 rounded-lg shadow-sm border border-black/5 dark:border-white/10 hover:bg-indigo-500 hover:text-white transition-all" title="Ver Mapa"><i class="fas fa-map-marked-alt text-[10px]"></i></button>
                                <button onclick="window.showHistoryFromBaseS12('${t.id}', '${t.numero}')" class="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-white dark:bg-white/5 text-amber-500 rounded-lg shadow-sm border border-black/5 dark:border-white/10 hover:bg-amber-500 hover:text-white transition-all" title="Historial"><i class="fas fa-history text-[10px]"></i></button>
                            </div>
                        </div>
                        
                        <div class="flex gap-1 opacity-10 md:opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button onclick="window.editTerritorioS12('${t.id}')" class="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-primary rounded-lg border border-slate-200 dark:border-white/10 transition-all"><i class="fas fa-edit text-[10px]"></i></button>
                            <button onclick="window.deleteTerritorioS12('${t.id}')" class="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-rose-500 rounded-lg border border-slate-200 dark:border-white/10 transition-all"><i class="fas fa-trash-alt text-[10px]"></i></button>
                        </div>
                    </div>
                    
                    <div class="flex-1 min-w-0 flex flex-col justify-between">
                        <p class="text-[11px] md:text-sm font-black text-slate-800 dark:text-white uppercase truncate flex items-center gap-2 mb-4" title="${t.localidad || t.nombre || ""}">
                            <i class="fas fa-location-dot text-[10px] text-primary/40 shrink-0"></i>
                            <span class="truncate">${t.localidad || t.nombre || "—"}</span>
                        </p>
                        
                        <div class="pt-4 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span class="text-[7px] md:text-[8px] font-black px-1.5 py-0.5 md:py-1 rounded-md ${isAssigned ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600"} uppercase tracking-tight shrink-0">${t.estado || "Disponible"}</span>
                                ${t.asignado_a ? `<span class="text-[7px] font-black text-slate-600 dark:text-slate-400 uppercase truncate max-w-[50px] md:max-w-[70px]">${t.asignado_a}</span>` : ""}
                            </div>
                            <div class="text-[7px] md:text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase bg-slate-50 dark:bg-white/5 px-1.5 py-0.5 md:py-1 rounded-md border border-slate-100 dark:border-white/5 shrink-0">${allMzs} MZ</div>
                        </div>
                    </div>
                </div>`;
                } catch (cardErr) {
                    console.error("Critical rendering error on territory card:", cardErr, t);
                    return `<div class="p-4 border border-rose-500/30 rounded-2xl text-[8px] font-black text-rose-500 uppercase">Error en registro ${t.numero || t.id}</div>`;
                }
            })
            .join("");
    };

    container.innerHTML = `
        <div class="animate-fade-in p-6 space-y-8 max-w-6xl mx-auto">
            <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-4">
                        <div class="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 shadow-inner">
                            <i class="fas fa-map-location-dot"></i>
                        </div>
                        Base de Datos (S-12)
                    </h3>
                    <p class="text-[10px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-[0.3em] mt-2 ml-1">Catálogo maestro de territorios</p>
                </div>
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <button id="btn-export-s12" class="bg-primary hover:bg-primary-light text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-3 transition-all shrink-0">
                        <i class="fas fa-print"></i> <span class="truncate">Imprimir Catálogo</span>
                    </button>
                    <input type="text" id="s12-search" placeholder="Buscar número o localidad..." class="w-full sm:w-64 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all">
                </div>
            </header>

            <div id="s12-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                <!-- Grid items -->
            </div>
        </div>
    `;

    const searchInput = container.querySelector("#s12-search");
    if (searchInput) {
        searchInput.oninput = (e) => renderGrid(e.target.value.trim().toLowerCase());
    }

    const exportBtn = container.querySelector("#btn-export-s12");
    if (exportBtn) {
        exportBtn.onclick = () => {
            // 📝 FASE 5: Redirigir al modulo oficial
            showNotification(
                "Para generar el catálogo S-12 Oficial, ve a la pestaña de Reportes y Genera el S-13 (Registro Maestro).",
                "info",
                5000,
            );
        };
    }

    window.deleteTerritorioS12 = (id) => {
        showCustomConfirm("¿Eliminar este territorio del catálogo maestro?", async () => {
            await deleteTerritorio(id);
            showNotification("Territorio eliminado");
            renderS12View(container, config, appVersion);
        });
    };

    window.editTerritorioS12 = async (id) => {
        const t = terrs.find((x) => x.id === id);
        if (!t) return;

        const tipos = config.tipos_territorio || ["Casa en Casa", "Negocios", "Pública"];

        showModal(
            `
             <header class="shrink-0 bg-indigo-600 p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-edit"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Editar S-12</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Territorio #${t.numero}</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-10 space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="grid grid-cols-1 gap-8">
                         <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Localidad</label>
                            <input type="text" id="edit-t-localidad" value="${t.localidad || t.nombre || ""}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-indigo-500 transition-all uppercase shadow-inner">
                        </div>
                        <div class="grid grid-cols-2 gap-6">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Número</label>
                                <input type="text" id="edit-t-numero" value="${t.numero || ""}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-indigo-500 transition-all uppercase shadow-inner">
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Tipo</label>
                                <select id="edit-t-tipo" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-indigo-500 cursor-pointer appearance-none shadow-inner">
                                    ${tipos.map((ti) => `<option value="${ti}" ${t.tipo === ti ? "selected" : ""}>${ti}</option>`).join("")}
                                </select>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Manzanas (Separadas por coma)</label>
                            <textarea id="edit-t-mzs" rows="3" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-bold text-slate-700 dark:text-white outline-none focus:border-indigo-500 resize-none shadow-inner">${t.manzanas || ""}</textarea>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-t-edit" class="flex-1 min-w-0 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10 transition-all active:scale-95">
                        Cancelar
                    </button>
                    <button id="btn-save-t-edit" class="flex-[1.5] py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> Actualizar Registro
                    </button>
                </footer>
    `,
            (modal) => {
                modal.querySelector("#btn-cancel-t-edit").onclick = () => modal.classList.add("hidden");
                modal.querySelector("#btn-save-t-edit").onclick = async () => {
                    const btn = modal.querySelector("#btn-save-t-edit");
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Actualizando...';

                    try {
                        await updateTerritorio(id, {
                            localidad: modal.querySelector("#edit-t-localidad").value.trim(),
                            nombre: modal.querySelector("#edit-t-localidad").value.trim(), // Keep sync for backward compat
                            numero: modal.querySelector("#edit-t-numero").value.trim(),
                            tipo: modal.querySelector("#edit-t-tipo").value,
                            manzanas: modal.querySelector("#edit-t-mzs").value.trim(),
                        });
                        showNotification("S-12 actualizado correctamente");
                        modal.classList.add("hidden");
                        renderS12View(container, config, appVersion);
                    } catch (e) {
                        showNotification(`Error: ${e.message}`, "error");
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-save"></i> Actualizar Registro';
                    }
                };
            },
        );
    };

    // Button Logic Proxy
    window.viewMapFromBaseS12 = async (id) => {
        showNotification("Cargando mapa...", "info");
        try {
            const t = terrs.find((x) => x.id === id);

            if (!t) {
                showNotification("Error: Territorio no encontrado en memoria. Intente recargar.", "error");
                return;
            }

            console.log(`🗺️ Opening map for T-${t.numero}`, { hasImage: !!t.imagen, coords: t.coordenadas });

            // Force modal container cleanup if needed
            const modal = document.getElementById("modal-container");
            if (modal) {
                // Ensure it has the right classes for visibility if MapViewer blindly toggles hidden
                if (!modal.classList.contains("flex")) modal.classList.add("flex", "items-center", "justify-center");
            }

            if (window.openInteractiveMap) window.openInteractiveMap(t);
            else MapViewer.openInteractiveMap(t);
        } catch (e) {
            console.error("Map Load Error:", e);
            showNotification("Error al cargar el visor de mapas", "error");
        }
    };

    window.showHistoryFromBaseS12 = async (id, num) => {
        await import(`../conductor-dashboard.js?v=${appVersion}`);
        if (window.showUnifiedTerritoryHistory) window.showUnifiedTerritoryHistory(id, num);
    };

    renderGrid();
};
