import {
    addPuntoInteres,
    deletePuntoInteres,
    getPuntosInteres,
    getTerritorios,
    updatePuntoInteres,
} from "../../data/firestore-services.js";
import { showCustomConfirm, showModal } from "../services/ui-helpers.js";
import { showNotification } from "../utils/helpers.js";

export const renderPuntosInteresTab = async (container) => {
    const [puntosInteres, territorios] = await Promise.all([getPuntosInteres(), getTerritorios()]);

    const stats = {
        total: puntosInteres.length,
        carritos: puntosInteres.filter((p) => (p.tipo || "").toLowerCase().includes("carrito") || p.tipo === "Exhibidor").length,
        paradas: puntosInteres.filter((p) => ["bus", "taxi"].includes((p.tipo || "").toLowerCase())).length,
        plazas: puntosInteres.filter((p) => ["parque", "comercial"].includes((p.tipo || "").toLowerCase())).length,
    };

    container.innerHTML = `
        <div class="animate-fade-in p-2 md:p-6 space-y-10 max-w-7xl mx-auto pb-20">
            <!-- CABECERA DE PREDICACIÓN PÚBLICA -->
            <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-6 md:p-8 rounded-[2.5rem] border border-amber-500/20 backdrop-blur-xl">
                <div class="flex items-center gap-5">
                    <div class="w-16 h-16 bg-amber-500/20 rounded-3xl flex items-center justify-center text-amber-600 dark:text-amber-400 text-3xl shadow-xl border border-amber-500/30">
                        <i class="fas fa-store-alt"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Predicación Pública & Exhibidores</h3>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.25em] mt-1">Carritos, paradas estratégicas y plazas de la ciudad</p>
                    </div>
                </div>
                <button id="add-poi-btn" class="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                    <i class="fas fa-plus-circle text-sm"></i> Nueva Zona / Exhibidor
                </button>
            </header>

            <!-- TARJETAS DE MÉTRICAS -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl">
                        <i class="fas fa-map-marked-alt"></i>
                    </div>
                    <div>
                        <span class="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Puntos</span>
                        <span class="text-xl font-black text-slate-800 dark:text-white">${stats.total}</span>
                    </div>
                </div>

                <div class="bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-xl">
                        <i class="fas fa-shopping-cart"></i>
                    </div>
                    <div>
                        <span class="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Exhibidores Móviles</span>
                        <span class="text-xl font-black text-slate-800 dark:text-white">${stats.carritos}</span>
                    </div>
                </div>

                <div class="bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xl">
                        <i class="fas fa-bus"></i>
                    </div>
                    <div>
                        <span class="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Paradas de Transporte</span>
                        <span class="text-xl font-black text-slate-800 dark:text-white">${stats.paradas}</span>
                    </div>
                </div>

                <div class="bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-500 flex items-center justify-center text-xl">
                        <i class="fas fa-tree"></i>
                    </div>
                    <div>
                        <span class="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Plazas & Parques</span>
                        <span class="text-xl font-black text-slate-800 dark:text-white">${stats.plazas}</span>
                    </div>
                </div>
            </div>

            <!-- LISTADO DE ZONAS Y EXHIBIDORES -->
            <section class="space-y-6">
                <div class="flex items-center justify-between">
                    <h4 class="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                        <i class="fas fa-layer-group text-amber-500"></i> Puntos de Exhibidores Registrados
                    </h4>
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${puntosInteres.length} Puntos Activos</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${
                        puntosInteres.length === 0
                            ? `
                        <div class="col-span-full py-20 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2.5rem] opacity-40">
                            <i class="fas fa-store-alt text-4xl text-amber-500/40 mb-3 block"></i>
                            <p class="font-black text-[10px] uppercase tracking-[0.3em]">No hay exhibidores ni zonas especiales registradas</p>
                        </div>
                    `
                            : puntosInteres
                                  .map((p) => {
                                      const isExhibidor = (p.tipo || "").toLowerCase().includes("exhibidor") || (p.tipo || "").toLowerCase().includes("carrito");
                                      const iconClass = isExhibidor ? "fa-shopping-cart" : p.tipo === "Taxi" ? "fa-taxi" : p.tipo === "Bus" ? "fa-bus" : p.tipo === "Parque" ? "fa-tree" : "fa-street-view";
                                      const badgeColor = isExhibidor ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

                                      return `
                        <div class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-200/80 dark:border-white/10 hover:border-amber-500/40 transition-all shadow-md hover:shadow-2xl space-y-4 relative group">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl shrink-0">
                                    <i class="fas ${iconClass}"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">${p.nombre}</h4>
                                    <span class="inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeColor} mt-1">${p.tipo || "Exhibidor"}</span>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button onclick="window.editPOI('${p.id}')" class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-amber-500 flex items-center justify-center transition-colors"><i class="fas fa-edit text-xs"></i></button>
                                    <button onclick="window.deletePOI('${p.id}')" class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-500 flex items-center justify-center transition-colors"><i class="fas fa-trash-alt text-xs"></i></button>
                                </div>
                            </div>
                            <div class="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3">
                                <p class="text-[10px] text-slate-600 dark:text-slate-400 font-bold leading-relaxed line-clamp-2">${p.descripcion || "Sin observaciones adicionales"}</p>
                                <div class="flex items-center justify-between text-[9px] font-black uppercase">
                                    <span class="text-slate-400">Territorio Cercano:</span>
                                    <span class="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-xl border border-amber-500/20">T-${p.territorio_numero || "—"}</span>
                                </div>
                            </div>
                        </div>
                    `;
                                  })
                                  .join("")
                    }
                </div>
            </section>
        </div>
    `;

    const openPOIModal = (poi = null) => {
        const isEdit = !!poi;
        showModal(
            `
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden max-w-lg mx-auto">
                <header class="shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 p-8 text-white relative overflow-hidden">
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas ${isEdit ? "fa-edit" : "fa-store-alt"}"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">${isEdit ? "Editar Exhibidor" : "Nuevo Punto / Exhibidor"}</h3>
                            <p class="text-[10px] opacity-80 uppercase tracking-[0.3em] font-black">Predicación Pública</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-8 space-y-6 bg-slate-50 dark:bg-black/20">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest block">Nombre del Punto / Exhibidor</label>
                        <input type="text" id="poi-name" value="${poi?.nombre || ""}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-2xl text-xs font-black text-slate-800 dark:text-white outline-none focus:border-amber-500 uppercase" placeholder="Ej: Exhibidor Móvil Parque Central">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest block">Tipo de Exhibidor</label>
                            <select id="poi-type" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-2xl text-xs font-black text-slate-800 dark:text-white outline-none focus:border-amber-500 uppercase">
                                <option value="Exhibidor Móvil" ${poi?.tipo === "Exhibidor Móvil" ? "selected" : ""}>🛒 Exhibidor / Carrito</option>
                                <option value="Taxi" ${poi?.tipo === "Taxi" ? "selected" : ""}>🚕 Parada de Taxis</option>
                                <option value="Bus" ${poi?.tipo === "Bus" ? "selected" : ""}>🚌 Parada de Bus</option>
                                <option value="Parque" ${poi?.tipo === "Parque" ? "selected" : ""}>🌳 Parque / Plaza</option>
                                <option value="Comercial" ${poi?.tipo === "Comercial" ? "selected" : ""}>🏪 Zona Comercial</option>
                                <option value="Otro" ${poi?.tipo === "Otro" ? "selected" : ""}>📍 Otro Punto</option>
                            </select>
                        </div>

                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest block">Territorio Cercano</label>
                            <select id="poi-terr" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-2xl text-xs font-black text-slate-800 dark:text-white outline-none focus:border-amber-500 uppercase">
                                <option value="">Seleccionar territorio...</option>
                                ${territorios
                                    .sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }))
                                    .map(
                                        (t) => `
                                    <option value="${t.id}" data-num="${t.numero}" ${poi?.territorio_id === t.id ? "selected" : ""}>Territorio ${t.numero}</option>
                                `,
                                    )
                                    .join("")}
                            </select>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest block">Descripción / Indicaciones del Punto</label>
                        <textarea id="poi-desc" rows="3" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-amber-500 resize-none" placeholder="Horarios de mayor afluencia, parejas encargadas o instrucciones...">${poi?.descripcion || ""}</textarea>
                    </div>
                </div>

                <footer class="shrink-0 p-6 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-poi" class="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest">
                        Cancelar
                    </button>
                    <button id="save-poi-btn" class="flex-[1.5] py-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-amber-600/20 active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> ${isEdit ? "Actualizar" : "Guardar Registro"}
                    </button>
                </footer>
            </div>
        `,
            (modal) => {
                modal.querySelector("#btn-cancel-poi").onclick = () => modal.classList.add("hidden");
                modal.querySelector("#save-poi-btn").onclick = async () => {
                    const btn = modal.querySelector("#save-poi-btn");
                    const name = modal.querySelector("#poi-name").value.trim();
                    const type = modal.querySelector("#poi-type").value;
                    const terrId = modal.querySelector("#poi-terr").value;
                    const terrNum =
                        modal.querySelector("#poi-terr").options[modal.querySelector("#poi-terr").selectedIndex]?.dataset
                            ?.num || "";
                    const desc = modal.querySelector("#poi-desc").value.trim();

                    if (!name || !terrId) return showNotification("Nombre y Territorio obligatorios", "warning");

                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...';

                    try {
                        const data = {
                            nombre: name,
                            tipo: type,
                            territorio_id: terrId,
                            territorio_numero: terrNum,
                            descripcion: desc,
                        };
                        if (isEdit) await updatePuntoInteres(poi.id, data);
                        else await addPuntoInteres(data);
                        showNotification(isEdit ? "Exhibidor actualizado" : "Exhibidor registrado", "success");
                        modal.classList.add("hidden");
                        renderPuntosInteresTab(container);
                    } catch (e) {
                        showNotification(`Error: ${e.message}`, "error");
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-save"></i> Reintentar';
                    }
                };
            },
        );
    };

    container.querySelector("#add-poi-btn").onclick = () => openPOIModal();
    window.editPOI = (id) => openPOIModal(puntosInteres.find((p) => p.id === id));
    window.deletePOI = (id) =>
        showCustomConfirm("¿Eliminar este exhibidor / punto de predicación?", async () => {
            await deletePuntoInteres(id);
            showNotification("Registro eliminado", "info");
            renderPuntosInteresTab(container);
        });
};
