import { getPublicadores, updatePublicador } from "../../data/firestore-services.js";
import { showNotification } from "../utils/helpers.js";

export const renderAvailabilitySection = async (container, currentUserName) => {
    if (!container) return;

    // Xolvy Data Shield: Robust normalization for user lookup
    const normalize = (val) =>
        String(val || "")
            .trim()
            .toLowerCase();
    const normalizePhone = (val) => String(val || "").replace(/\D/g, "");

    const publicadores = await getPublicadores();
    const me = publicadores.find((p) => {
        const u = normalize(currentUserName);
        const up = normalizePhone(currentUserName);
        return (
            normalize(p.nombre) === u ||
            normalize(p.email) === u ||
            normalizePhone(p.telefono) === up ||
            normalizePhone(p.email) === up
        ); // Fallback for email as id
    });

    if (!me) {
        console.warn(`🛡️ [Data Shield] User session mismatch for availability: "${currentUserName}"`);
        return;
    }

    const currentDisp = me.disponibilidad || {
        lunes: [],
        martes: [],
        miercoles: [],
        jueves: [],
        viernes: [],
        sabado: [],
        domingo: [],
    };
    const dias = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    const turnos = ["mañana", "tarde", "noche"];

    container.innerHTML = `
        <div class="animate-fade-in space-y-6 max-w-3xl mx-auto w-full">
            <!-- Grid Header Labels -->
            <div class="grid grid-cols-4 gap-4 px-6 py-3 bg-slate-50/50 dark:bg-black/10 rounded-2xl border border-slate-150/40 dark:border-white/5">
                <div class="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <i class="fas fa-calendar-day text-[9px]"></i> Día
                </div>
                <div class="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400 text-center flex items-center justify-center gap-1.5">
                    <i class="fas fa-sun text-[10px] text-amber-500 animate-spin-slow"></i> Mañana
                </div>
                <div class="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400 text-center flex items-center justify-center gap-1.5">
                    <i class="fas fa-cloud-sun text-[10px] text-orange-500"></i> Tarde
                </div>
                <div class="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400 text-center flex items-center justify-center gap-1.5">
                    <i class="fas fa-moon text-[10px] text-indigo-500 animate-pulse"></i> Noche
                </div>
            </div>

            <!-- Day Rows -->
            <div class="space-y-3">
                ${dias
                    .map((dia) => {
                        const dayDisp = currentDisp[dia] || [];
                        return `
                        <div class="grid grid-cols-4 gap-4 items-center p-4 bg-white/40 dark:bg-slate-900/10 backdrop-blur-md border border-slate-150/30 dark:border-white/5 rounded-3xl transition-all duration-300 hover:bg-white/80 dark:hover:bg-slate-900/30 hover:border-indigo-500/20 hover:shadow-lg group">
                            <span class="text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-widest group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors pl-2">
                                ${dia.substring(0, 3)}<span class="hidden sm:inline">${dia.substring(3)}</span>
                            </span>
                            
                            ${turnos
                                .map((turno) => {
                                    const isChecked = dayDisp.includes(turno);
                                    const icon =
                                        turno === "mañana" ? "fa-sun" : turno === "tarde" ? "fa-cloud-sun" : "fa-moon";
                                    const styling =
                                        turno === "mañana"
                                            ? "peer-checked:bg-gradient-to-r peer-checked:from-amber-400 peer-checked:to-orange-500 peer-checked:shadow-amber-500/20 text-amber-600 dark:text-amber-450 hover:bg-amber-500/5 hover:border-amber-500/30"
                                            : turno === "tarde"
                                              ? "peer-checked:bg-gradient-to-r peer-checked:from-orange-400 peer-checked:to-rose-500 peer-checked:shadow-orange-500/20 text-orange-600 dark:text-orange-450 hover:bg-orange-500/5 hover:border-orange-500/30"
                                              : "peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-600 peer-checked:shadow-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/5 hover:border-indigo-500/30";

                                    return `
                                    <div class="flex justify-center">
                                        <label class="cursor-pointer select-none w-full max-w-[120px]">
                                            <input type="checkbox" data-dia="${dia}" data-turno="${turno}" ${isChecked ? "checked" : ""} class="peer sr-only">
                                            <div class="flex items-center justify-center gap-2 py-3 rounded-2xl border text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-300 peer-checked:text-white peer-checked:scale-105 peer-checked:border-transparent peer-checked:shadow-lg bg-slate-50/60 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:scale-[1.02] ${styling}">
                                                <i class="fas ${icon} text-[10px] sm:text-[12px] shrink-0"></i>
                                                <span class="hidden sm:inline">${turno}</span>
                                                <span class="inline sm:hidden">${turno.substring(0, 3)}</span>
                                            </div>
                                        </label>
                                    </div>
                                `;
                                })
                                .join("")}
                        </div>
                    `;
                    })
                    .join("")}
            </div>

            <!-- Save Action Button -->
            <div class="flex justify-center pt-4">
                <button id="btn-save-disp" class="btn-pro w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white py-5 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.25em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <i class="fas fa-save shadow-lg"></i> Guardar Disponibilidad
                </button>
            </div>
        </div>
    `;

    container.querySelector("#btn-save-disp").onclick = async () => {
        const btn = container.querySelector("#btn-save-disp");
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';

        const newDisp = { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] };
        container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
            if (cb.checked) {
                newDisp[cb.dataset.dia].push(cb.dataset.turno);
            }
        });

        try {
            await updatePublicador(me.id, { disponibilidad: newDisp });
            showNotification("Disponibilidad actualizada", "success");
        } catch (_e) {
            showNotification("Error al guardar", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar Disponibilidad';
        }
    };
};
