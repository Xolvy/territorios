/**
 * @file mi-informe.js
 * @description Módulo "Mi Informe" — Registro de actividad mensual de predicación.
 */
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase-config.js";
import { showNotification } from "../utils/helpers.js";

export const renderMiInformeModule = async (container, displayName) => {
    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();

    const selectedMonth = months[currentMonthIndex];
    const docId = `${displayName.toLowerCase().replace(/\s+/g, "_")}_${currentYear}_${currentMonthIndex + 1}`;

    let reportData = {
        horas: "",
        publicaciones: "",
        videos: "",
        revisitas: "",
        cursos: "",
        notas: "",
        enviado: false
    };

    try {
        const snap = await getDoc(doc(db, "informes_publicador", docId));
        if (snap.exists()) {
            reportData = { ...reportData, ...snap.data() };
        }
    } catch (e) {
        console.warn("⚠️ [Mi Informe] Error al cargar informe guardado:", e);
    }

    container.innerHTML = `
        <div class="modern-card !p-0 overflow-hidden">
            <details id="details-mi-informe" class="group/informe-details">
                <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-10 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-transparent group-open/informe-details:border-slate-100 dark:group-open/informe-details:border-white/5 relative">
                    <div class="flex items-start gap-4 md:gap-8 relative z-10 w-full md:w-auto">
                        <div class="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-2xl md:text-3xl text-indigo-500 border border-indigo-500/10">
                            <i class="fas fa-file-invoice"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-4">
                                <h3 class="text-xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Mi Informe</h3>
                                <i class="fas fa-chevron-down text-sm text-slate-600 dark:text-slate-400 group-open/informe-details:rotate-180 transition-transform"></i>
                            </div>
                            <p class="text-[9px] md:text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 opacity-80">Registro de predicación — ${selectedMonth} ${currentYear}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 mt-4 md:mt-0">
                        <span id="informe-status-badge" class="px-3 py-1.5 ${reportData.enviado ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"} border rounded-xl text-[9px] font-black uppercase tracking-widest">
                            ${reportData.enviado ? "✓ Enviado" : "Pendiente"}
                        </span>
                    </div>
                </summary>

                <div class="p-6 md:p-10 space-y-6 animate-fade-in group-open/informe-details:block hidden bg-slate-50/50 dark:bg-black/20">
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div class="bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Horas</label>
                            <input type="number" min="0" id="inf-horas" value="${reportData.horas || ""}" placeholder="0" class="w-full text-xl font-black text-slate-800 dark:text-white bg-transparent outline-none">
                        </div>
                        <div class="bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Publicaciones</label>
                            <input type="number" min="0" id="inf-publicaciones" value="${reportData.publicaciones || ""}" placeholder="0" class="w-full text-xl font-black text-slate-800 dark:text-white bg-transparent outline-none">
                        </div>
                        <div class="bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Videos</label>
                            <input type="number" min="0" id="inf-videos" value="${reportData.videos || ""}" placeholder="0" class="w-full text-xl font-black text-slate-800 dark:text-white bg-transparent outline-none">
                        </div>
                        <div class="bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Revisitas</label>
                            <input type="number" min="0" id="inf-revisitas" value="${reportData.revisitas || ""}" placeholder="0" class="w-full text-xl font-black text-slate-800 dark:text-white bg-transparent outline-none">
                        </div>
                        <div class="bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 space-y-2 col-span-2 sm:col-span-1">
                            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Cursos Bíblicos</label>
                            <input type="number" min="0" id="inf-cursos" value="${reportData.cursos || ""}" placeholder="0" class="w-full text-xl font-black text-slate-800 dark:text-white bg-transparent outline-none">
                        </div>
                    </div>

                    <div class="bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 space-y-2">
                        <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Observaciones / Notas</label>
                        <input type="text" id="inf-notas" value="${reportData.notas || ""}" placeholder="Notas adicionales..." class="w-full text-xs font-bold text-slate-800 dark:text-white bg-transparent outline-none">
                    </div>

                    <div class="flex justify-end pt-2">
                        <button id="btn-save-informe" class="btn-pro px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2">
                            <i class="fas fa-paper-plane"></i> Enviar Informe
                        </button>
                    </div>
                </div>
            </details>
        </div>
    `;

    const btnSave = container.querySelector("#btn-save-informe");
    if (btnSave) {
        btnSave.onclick = async () => {
            const horas = container.querySelector("#inf-horas")?.value || 0;
            const publicaciones = container.querySelector("#inf-publicaciones")?.value || 0;
            const videos = container.querySelector("#inf-videos")?.value || 0;
            const revisitas = container.querySelector("#inf-revisitas")?.value || 0;
            const cursos = container.querySelector("#inf-cursos")?.value || 0;
            const notas = container.querySelector("#inf-notas")?.value || "";

            const updatedData = {
                publicador: displayName,
                mes: selectedMonth,
                anio: currentYear,
                horas: Number(horas),
                publicaciones: Number(publicaciones),
                videos: Number(videos),
                revisitas: Number(revisitas),
                cursos: Number(cursos),
                notas,
                enviado: true,
                fecha_envio: new Date().toISOString()
            };

            try {
                btnSave.disabled = true;
                btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
                await setDoc(doc(db, "informes_publicador", docId), updatedData, { merge: true });
                showNotification("¡Informe de predicación guardado con éxito!", "success");

                const badge = container.querySelector("#informe-status-badge");
                if (badge) {
                    badge.className = "px-3 py-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border rounded-xl text-[9px] font-black uppercase tracking-widest";
                    badge.textContent = "✓ Enviado";
                }
            } catch (e) {
                console.error("❌ [Mi Informe] Error al guardar informe:", e);
                showNotification("Error al guardar el informe", "error");
            } finally {
                btnSave.disabled = false;
                btnSave.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Informe';
            }
        };
    }
};
