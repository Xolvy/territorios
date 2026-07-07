/* global Sortable */
import {
    addPuntoInteres,
    deletePuntoInteres,
    getPuntosInteres,
    getTerritorios,
    saveConfiguracion,
    updatePuntoInteres,
} from "../../data/firestore-services.js";
import { ServiceCache } from "../../data/services/base-service.js";
import { showCustomConfirm, showCustomPrompt, showModal } from "../services/ui-helpers.js";
import { showNotification } from "../utils/helpers.js";
import { broadcastCurrentVersion } from "../utils/update-manager.js";

/**
 * Ordena cronológicamente un array de strings de tiempo (soporta AM/PM y 24h).
 */
const sortChronologically = (times) => {
    if (!times || !Array.isArray(times)) return [];
    const parse = (s) => {
        if (!s || typeof s !== "string") return 0;
        const raw = s.toLowerCase().trim();
        const mod = raw.includes("pm") ? "pm" : raw.includes("am") ? "am" : null;
        let [h, m] = raw.replace(/[ap]m/g, "").split(":").map(Number);
        if (Number.isNaN(h)) h = 0;
        if (mod === "pm" && h < 12) h += 12;
        if (mod === "am" && h === 12) h = 0;
        // Inferencia: Si es < 8 y no tiene AM/PM, probablemente es de la mañana para JW (ej. 9:00),
        // pero si es < 8 y es tarde escolar/reunión, asumimos coherencia 24h o PM.
        if (!mod && h > 0 && h < 7) h += 12;
        return h * 60 + (m || 0);
    };
    return [...times].sort((a, b) => parse(a) - parse(b));
};

export const renderConfigTab = async (container, config, appVersion, reloadTabFn) => {
    const [puntosInteres, territorios] = await Promise.all([getPuntosInteres(), getTerritorios()]);

    // Helper for showing manual LED feedback
    const triggerManualLED = async (id) => {
        const el = container.querySelector(`#led-${id}`);
        if (!el) return () => {};
        el.innerHTML = '<div class="led-spinner"></div>';
        el.classList.remove("hidden", "opacity-0");
        el.style.display = "flex";
        return async (success = true) => {
            if (success) {
                el.innerHTML = '<i class="fas fa-check-circle led-check"></i>';
                await new Promise((r) => setTimeout(r, 1200));
            }
            el.classList.add("hidden");
            el.style.display = "none";
        };
    };

    const renderZonasUI = async () => {
        const freshPuntos = await getPuntosInteres();
        puntosInteres.length = 0;
        puntosInteres.push(...freshPuntos);
        const listZ = container.querySelector("#list-zonas");
        if (listZ) {
            listZ.innerHTML =
                puntosInteres.length === 0
                    ? '<p class="text-[10px] text-slate-600 dark:text-slate-400 text-center py-4 italic w-full">Sin zonas registradas</p>'
                    : puntosInteres
                          .map(
                              (p) => `
                <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move group/tag" data-id="${p.id}">
                    <i class="fas fa-grip-vertical text-slate-700 dark:text-slate-300 text-[8px]"></i>
                    <div class="flex flex-col cursor-pointer" onclick="window.editPOI_Rules('${p.id}')">
                        <span class="leading-none text-[11px]">${p.nombre}</span>
                        <span class="text-[7px] text-slate-600 dark:text-slate-400 uppercase tracking-tighter">T-${p.territorio_numero || "??"}</span>
                    </div>
                    <button onclick="window.deletePOI_Rules('${p.id}')" class="text-slate-700 dark:text-slate-300 hover:text-red-500 transition-colors ml-1"><i class="fas fa-times"></i></button>
                </div>
            `,
                          )
                          .join("");
        }
    };

    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-12 animate-fade-in pb-32 w-full overflow-x-hidden">
                <!--Header Section-->
                <div class="flex items-center gap-6 mb-10">
                    <div class="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-2xl text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5 transform -rotate-3 transition-transform hover:rotate-0">
                        <i class="fas fa-cog"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Ajustes del Sistema</h3>
                        <p class="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-[0.3em] mt-1">Configuración Maestra de la Congregación</p>
                    </div>
                </div>

                <div class="space-y-8" data-adaptive-container="true">
                    
                    <!-- 1. COMUNICACIÓN Y DIFUSIÓN DINÁMICA -->
                    <section class="enterprise-card p-8 relative overflow-hidden">
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-broadcast-tower text-blue-600 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">1. Comunicación y Difusión Dinámica</h4>
                        </header>

                        <div class="space-y-6">
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    TEMA DE LA SEMANA (Enfoque Semanal)
                                    <span class="text-[8px] px-1.5 py-0.5 bg-primary/10 text-primary rounded uppercase tracking-tighter">Banner Principal</span>
                                </label>
                                <div class="relative">
                                    <textarea id="conf-tema-mes" rows="2" 
                                        class="input-premium pr-12 text-sm w-full"
                                        placeholder="Escribe el tema de conversación sugerido o enfoque semanal...">${config.tema_mes || ""}</textarea>
                                    <div class="led-status-container hidden" style="bottom: 2.5rem;"></div>
                                </div>
                            </div>

                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    Panel de Difusión (Anuncios Rotativos)
                                    <div class="flex items-center gap-2">
                                        <div id="led-diffusion" class="led-status-container !static hidden"></div>
                                        <button id="add-diffusion-msg" class="text-[9px] text-blue-600 hover:underline">+ Añadir Mensaje</button>
                                    </div>
                                </label>
                                <div id="list-diffusion" class="space-y-2.5 p-4 bg-slate-100/50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[100px]">
                                    ${
                                        (config.diffusion_messages || [])
                                            .map(
                                                (msg, i) => `
                                        <div class="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-[11px] font-black flex items-start gap-4 animate-scale-in group/msg cursor-move">
                                            <div class="w-7 h-7 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-600 shrink-0 mt-0.5 transition-transform group-hover/msg:rotate-12">
                                                <i class="fas fa-grip-vertical text-[10px]"></i>
                                            </div>
                                            <div class="flex-1 min-w-0 text-slate-600 dark:text-slate-300 leading-relaxed pt-1">${msg}</div>
                                            <button onclick="window.removeDiffusionMessage(${i})" class="text-slate-700 dark:text-slate-300 hover:text-red-500 transition-colors shrink-0 pt-1">
                                                <i class="fas fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    `,
                                            )
                                            .join("") ||
                                        '<p class="text-[10px] text-slate-600 dark:text-slate-400 text-center py-6 italic">No hay anuncios de difusión activos. El banner solo mostrará el TEMA DE LA SEMANA.</p>'
                                    }
                                </div>
                                <p class="text-[9px] text-slate-600 dark:text-slate-400 mt-3 ml-1 italic leading-relaxed">Todo será visible en el banner dinámico del Modo Conductor cada 3 segundos.</p>
                            </div>
                        </div>
                    </section>

                    <!-- 2. IDENTIDAD LOCAL -->
                    <section class="enterprise-card p-8 relative overflow-hidden">
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-id-card text-blue-600 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">2. Identidad Local</h4>
                        </header>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="relative group/input">
                                <label class="label-premium">Nombre de la Congregación</label>
                                <div class="relative">
                                    <input type="text" id="conf-nombre" value="${config.congregacion?.nombre || ""}" 
                                        class="input-premium pr-12"
                                        placeholder="Ej. Nueve de Octubre">
                                    <div class="led-status-container hidden"></div>
                                </div>
                            </div>

                            <div class="relative group/input">
                                <label class="label-premium">Número de Congregación</label>
                                <div class="relative">
                                    <input type="text" id="conf-numero" value="${config.congregacion?.numero || ""}" 
                                        class="input-premium pr-12"
                                        placeholder="Ej. 14282">
                                    <div class="led-status-container hidden"></div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- 3. PLANIFICACIÓN DE SERVICIOS -->
                    <section class="enterprise-card p-8 relative overflow-hidden">
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-calendar-check text-blue-600 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">3. Planificación de Servicios</h4>
                        </header>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <!-- Horarios -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    Horarios de Salida
                                    <div class="flex items-center gap-2">
                                        <div id="led-horarios" class="led-status-container !static hidden"></div>
                                        <button id="add-horario" class="text-[9px] text-blue-600 hover:underline">+ Añadir</button>
                                    </div>
                                </label>
                                <div id="list-horarios" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${sortChronologically(config.horarios_programa || [])
                                        .map(
                                            (h, i) => `
                                            <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move">
                                                <i class="fas fa-grip-vertical text-slate-700 dark:text-slate-300 text-[8px]"></i>
                                                <span class="flex-1 min-w-0">${h}</span>
                                                <button data-action="remove-item" data-type="horarios" data-index="${i}" class="text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            </div>
                                        `,
                                        )
                                        .join("")}
                                </div>
                            </div>

                            <!-- Lugares -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    Lugares de Reunión
                                    <div class="flex items-center gap-2">
                                        <div id="led-lugares" class="led-status-container !static hidden"></div>
                                        <button id="add-lugar" class="text-[9px] text-blue-600 hover:underline">+ Añadir</button>
                                    </div>
                                </label>
                                 <div id="list-lugares" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${(config.lugares || [])
                                        .map(
                                            (l, i) => `
                                            <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move">
                                                <i class="fas fa-grip-vertical text-slate-700 dark:text-slate-300 text-[8px]"></i>
                                                <span class="flex-1 min-w-0">${l}</span>
                                                <button data-action="remove-item" data-type="lugares" data-index="${i}" class="text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            </div>
                                        `,
                                        )
                                        .join("")}
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- 4. GESTIÓN DE CATEGORÍAS (Unified Section with Zonas) -->
                    <section class="enterprise-card p-8 relative overflow-hidden">
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-tags text-blue-600 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">4. Gestión de Categorías y Zonas</h4>
                        </header>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start w-full mb-12">
                            <!-- Columna 1: OPCIONES DE SALIDA -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    OPCIONES DE SALIDA (Facetas)
                                    <div class="flex items-center gap-2">
                                        <div id="led-facetas" class="led-status-container !static hidden"></div>
                                        <button id="add-faceta" class="text-[9px] text-blue-600 hover:underline">+ Añadir</button>
                                    </div>
                                </label>
                                <div id="list-facetas" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${(config.facetas || [])
                                        .map(
                                            (f, i) => `
                                        <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move">
                                            <i class="fas fa-grip-vertical text-slate-700 dark:text-slate-300 text-[8px]"></i>
                                            <span class="flex-1 min-w-0">${f}</span>
                                            <button data-action="remove-item" data-type="facetas" data-index="${i}" class="text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    `,
                                        )
                                        .join("")}
                                </div>
                            </div>

                            <!-- Columna 2: TIPOS DE TERRITORIO -->
                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    TIPOS DE TERRITORIO (Mapa)
                                    <div class="flex items-center gap-2">
                                        <div id="led-tipos_t" class="led-status-container !static hidden"></div>
                                        <button id="add-tipo-t" class="text-[9px] text-blue-500 hover:underline">+ Añadir</button>
                                    </div>
                                </label>
                                <div id="list-tipos-t" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                    ${(config.tipos_territorio || ["Casa en Casa", "Negocios", "Pública"])
                                        .map(
                                            (t, i) => `
                                        <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move">
                                            <i class="fas fa-grip-vertical text-slate-700 dark:text-slate-300 text-[8px]"></i>
                                            <span class="flex-1 min-w-0">${t}</span>
                                            <button data-action="remove-item" data-type="tipos_t" data-index="${i}" class="text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    `,
                                        )
                                        .join("")}
                                </div>
                            </div>
                        </div>

                        <!-- ZONAS ESPECIALES INTEGRATED -->
                        <div class="pt-8 border-t border-slate-100 dark:border-white/5">
                            <header class="flex justify-between items-center mb-6">
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-map-marker-alt text-amber-600 text-[10px]"></i>
                                    <h5 class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Zonas de Predicación Especial</h5>
                                    <div class="flex items-center gap-2">
                                        <div id="led-zonas" class="led-status-container !static hidden"></div>
                                        <button id="add-poi-btn" class="text-[9px] text-blue-600 hover:underline">+ Añadir</button>
                                    </div>
                                </div>
                            </header>

                            <div id="list-zonas" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                ${
                                    puntosInteres.length === 0
                                        ? `
                                    <p class="text-[10px] text-slate-600 dark:text-slate-400 text-center py-4 italic w-full">Sin zonas registradas</p>
                                `
                                        : puntosInteres
                                              .map(
                                                  (p) => `
                                    <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move group/tag" data-id="${p.id}">
                                        <i class="fas fa-grip-vertical text-slate-700 dark:text-slate-300 text-[8px]"></i>
                                        <div class="flex flex-col cursor-pointer" onclick="window.editPOI_Rules('${p.id}')">
                                            <span class="leading-none text-[11px]">${p.nombre}</span>
                                            <span class="text-[7px] text-slate-600 dark:text-slate-400 uppercase tracking-tighter">T-${p.territorio_numero || "??"}</span>
                                        </div>
                                        <button onclick="window.deletePOI_Rules('${p.id}')" class="text-slate-700 dark:text-slate-300 hover:text-red-500 transition-colors ml-1"><i class="fas fa-times"></i></button>
                                    </div>
                                `,
                                              )
                                              .join("")
                                }
                            </div>
                        </div>
                    </section>

                    <!-- 5. INTELIGENCIA ARTIFICIAL -->
                    <section class="enterprise-card p-8 relative overflow-hidden">
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-brain text-blue-600 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">5. Inteligencia Artificial</h4>
                        </header>

                        <div class="relative group/input">
                            <label class="label-premium flex items-center justify-between">
                                Google Gemini API Key
                                <span class="text-[8px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded uppercase tracking-tighter">AI Assistant</span>
                            </label>
                            <div class="relative">
                                <input type="password" id="gemini-key" value="${config.gemini_key || ""}" 
                                    class="input-premium pr-20 font-mono"
                                    placeholder="AIzaSy...">
                                <div class="led-status-container hidden" style="right: 3.5rem;"></div>
                                <button class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-300 hover:text-indigo-500 transition-colors" onclick="const p=this.parentElement.querySelector('input'); p.type=p.type==='password'?'text':'password'">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            <p class="text-[9px] text-slate-600 dark:text-slate-400 mt-3 ml-1 leading-relaxed italic">Habilita el asistente virtual para análisis predictivo y sugerencias inteligentes.</p>
                        </div>
                    </section>

                    <!-- 6. CONTROL DE ACTUALIZACIONES GLOBALES -->
                    <section class="enterprise-card p-8 relative overflow-hidden">
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-sync-alt text-blue-600 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">6. Control de Actualizaciones Globales</h4>
                        </header>

                        <div class="space-y-4">
                            <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-relaxed">
                                Si has subido una nueva versión del sistema o hay problemas de carga en ciertos dispositivos, puedes forzar una recarga global en caliente.
                            </p>
                            <p class="text-[9px] font-bold text-rose-500 uppercase tracking-widest leading-relaxed bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                                <i class="fas fa-exclamation-triangle mr-1"></i> <strong>ADVERTENCIA:</strong> Al presionar este botón, todos los dispositivos activos en el mundo que tengan abierta la aplicación purgarán su caché de recursos inmediatamente y recargarán la página. Las sesiones de usuario activas se conservarán.
                            </p>
                            <button id="btn-force-global-reload" class="w-full bg-rose-600 hover:bg-rose-500 text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                                <i class="fas fa-sync-alt"></i> Forzar Recarga en Todos los Dispositivos
                            </button>
                        </div>
                    </section>

                    <!-- 7. NOTIFICACIONES PWA (ANUNCIOS GLOBALES) -->
                    <section class="enterprise-card p-8 relative overflow-hidden">
                        <header class="flex items-center gap-3 mb-6">
                            <i class="fas fa-bell text-blue-600 text-sm"></i>
                            <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">7. Notificaciones PWA (Anuncios Globales)</h4>
                        </header>

                        <div class="space-y-5">
                            <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-relaxed">
                                Envía un anuncio instantáneo a todos los dispositivos que tengan instalada la PWA y permisos activos.
                            </p>

                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    FCM Web Push VAPID Key
                                    <span class="text-[8px] px-1.5 py-0.5 bg-teal-500/10 text-teal-500 rounded uppercase tracking-tighter">Configuración</span>
                                </label>
                                <input type="text" id="fcm-vapid-key" value="${config.fcm_vapid_key || ""}" 
                                    class="input-premium font-mono"
                                    placeholder="Ej. BFG_...">
                                <div class="led-status-container hidden" style="right: 1.5rem; top: 2.5rem;"></div>
                            </div>

                            <div class="h-px bg-slate-200/50 dark:bg-emerald-900/30 my-4"></div>

                            <div class="relative group/input">
                                <label class="label-premium">Título de la Notificación</label>
                                <input type="text" id="notif-title" class="input-premium" placeholder="Ej. Cambio de horario o anuncio importante">
                            </div>

                            <div class="relative group/input">
                                <label class="label-premium">Mensaje de la Notificación</label>
                                <textarea id="notif-body" class="input-premium h-20 resize-none py-3" placeholder="Escribe el cuerpo del mensaje aquí..."></textarea>
                            </div>

                            <button id="btn-send-pwa-notif" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                                <i class="fas fa-paper-plane"></i> Enviar Notificación Push
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        `;

    // --- DRAGGABLE LISTS INITIALIZATION ---
    setTimeout(() => {
        const listIds = {
            "list-horarios": "horarios_programa",
            "list-lugares": "lugares",
            "list-facetas": "facetas",
            "list-tipos-t": "tipos_territorio",
            "list-diffusion": "diffusion_messages",
            "list-zonas": "zonas",
        };

        Object.keys(listIds).forEach((id) => {
            const el = container.querySelector(`#${id}`);
            if (el && window.Sortable) {
                new Sortable(el, {
                    animation: 150,
                    ghostClass: "opacity-50",
                    onEnd: async (evt) => {
                        if (evt.oldIndex === evt.newIndex) return;

                        const type = listIds[id];
                        const ledId =
                            type === "horarios_programa"
                                ? "horarios"
                                : type === "diffusion_messages"
                                  ? "diffusion"
                                  : type === "tipos_territorio"
                                    ? "tipos_t"
                                    : type;
                        const finishLED = await triggerManualLED(ledId);

                        if (type === "zonas") {
                            const tagEls = Array.from(el.querySelectorAll("[data-id]"));
                            const idChain = tagEls.map((tel) => tel.dataset.id);

                            try {
                                const { updatePuntoInteres } = await import("../../data/firestore-services.js");
                                for (let i = 0; i < idChain.length; i++) {
                                    await updatePuntoInteres(idChain[i], { order: i });
                                }
                                await finishLED();
                                renderZonasUI();
                            } catch (e) {
                                console.error("POI Reorder error:", e);
                                await finishLED(false);
                            }
                            return;
                        }

                        const items = [...(config[type] || [])];
                        if (items.length > 0) {
                            const [moved] = items.splice(evt.oldIndex, 1);
                            items.splice(evt.newIndex, 0, moved);
                            config[type] = items;
                        }

                        await saveConfiguracion(config);
                        await finishLED();
                        reloadTabFn("config");
                    },
                });
            }
        });
    }, 100);

    // --- AUTO-SAVE LOGIC (ENHANCED) ---
    let saveTimeout;
    const performSave = async (id = null) => {
        if (saveTimeout) clearTimeout(saveTimeout);

        const inputEl = id ? container.querySelector(`#${id}`) : null;
        const statusEl = inputEl?.parentElement?.querySelector(".led-status-container");

        if (statusEl) {
            statusEl.innerHTML = '<div class="led-spinner"></div>';
            statusEl.classList.remove("hidden", "opacity-0");
            statusEl.style.display = "flex";
        }

        try {
            const nombreVal = container.querySelector("#conf-nombre")?.value.trim();
            const numeroVal = container.querySelector("#conf-numero")?.value.trim();
            const geminiVal = container.querySelector("#gemini-key")?.value.trim();
            const temaVal = container.querySelector("#conf-tema-mes")?.value.trim();
            const fcmVapidVal = container.querySelector("#fcm-vapid-key")?.value.trim();

            // Sincronizar objeto config
            if (nombreVal !== undefined) {
                if (!config.congregacion) config.congregacion = {};
                config.congregacion.nombre = nombreVal;
            }
            if (numeroVal !== undefined) {
                if (!config.congregacion) config.congregacion = {};
                config.congregacion.numero = numeroVal;
            }
            if (geminiVal !== undefined) config.gemini_key = geminiVal;
            if (temaVal !== undefined) config.tema_mes = temaVal;
            if (fcmVapidVal !== undefined) config.fcm_vapid_key = fcmVapidVal;

            // Persistir en Firestore
            await saveConfiguracion(config);

            if (statusEl) {
                statusEl.innerHTML = '<i class="fas fa-check-circle led-check"></i>';
                setTimeout(() => {
                    statusEl.classList.add("opacity-0");
                    setTimeout(() => {
                        statusEl.classList.add("hidden");
                        statusEl.style.display = "none";
                    }, 500);
                }, 1500);
            }

            // Si es un cambio mayor, notificar brevemente
            if (!id || id === "conf-nombre") showNotification("Ajustes guardados", "success");
        } catch (e) {
            console.error("Auto-save error:", e);
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-exclamation-circle text-red-500 text-[10px]"></i>';
            showNotification("Error al guardar", "error");
        }
    };

    const triggerAutoSave = (id) => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => performSave(id), 1200);
    };

    // Attach listeners to text inputs (Blur for immediate, Input for debounced)
    ["conf-nombre", "conf-numero", "gemini-key", "conf-tema-mes", "fcm-vapid-key"].forEach((id) => {
        const el = container.querySelector(`#${id}`);
        if (el) {
            el.addEventListener("input", () => triggerAutoSave(id));
            el.addEventListener("blur", () => performSave(id));
        }
    });

    // Helper functions for dynamic lists (modified to save immediately)
    // --- OPTIMISTIC LIST RENDERING ---
    const renderListItems = (type) => {
        const containerId =
            type === "horarios"
                ? "list-horarios"
                : type === "lugares"
                  ? "list-lugares"
                  : type === "facetas"
                    ? "list-facetas"
                    : type === "tipos_t"
                      ? "list-tipos-t"
                      : null;
        if (!containerId) return;

        const listEl = container.querySelector(`#${containerId}`);
        if (!listEl) return;

        let items = [];
        if (type === "horarios") {
            config.horarios_programa = sortChronologically(config.horarios_programa || []);
            items = config.horarios_programa;
        } else if (type === "lugares") items = config.lugares || [];
        else if (type === "facetas") items = config.facetas || [];
        else if (type === "tipos_t") items = config.tipos_territorio || ["Casa en Casa", "Negocios", "Pública"];

        listEl.innerHTML = items
            .map(
                (val, i) => `
            <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in cursor-move">
                <i class="fas fa-grip-vertical text-slate-700 dark:text-slate-300 text-[8px]"></i>
                <span class="flex-1 min-w-0">${val}</span>
                <button data-action="remove-item" data-type="${type}" data-index="${i}" class="text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `,
            )
            .join("");
    };

    // Event Delegation para eliminación de badges
    container.addEventListener("click", (e) => {
        const btn = e.target.closest('button[data-action="remove-item"]');
        if (!btn) return;
        const { type, index } = btn.dataset;
        window.removeConfigItem(type, parseInt(index, 10));
    });

    const addConfigItem = (type) => {
        const labels = {
            horarios: "Horario (ej. 09:00AM)",
            lugares: "Lugar de Reunión",
            facetas: "Faceta de Servicio",
            tipos_t: "Tipo de Territorio",
        };

        showCustomPrompt(`Añadir ${labels[type]}:`, "", async (val) => {
            if (!val || val.trim() === "") return;
            const text = val.trim();

            // 1. Optimistic Update (UI)
            if (type === "horarios") {
                config.horarios_programa = [...(config.horarios_programa || []), text];
            } else if (type === "lugares") {
                config.lugares = [...(config.lugares || []), text];
            } else if (type === "facetas") {
                config.facetas = [...(config.facetas || []), text];
            } else if (type === "tipos_t") {
                config.tipos_territorio = [
                    ...(config.tipos_territorio || ["Casa en Casa", "Negocios", "Pública"]),
                    text,
                ];
            }

            renderListItems(type);
            showNotification("Añadido localmente", "success");

            // 2. Background Saving
            const finishLED = await triggerManualLED(type);
            try {
                await saveConfiguracion(config);
                await finishLED();
            } catch (e) {
                console.error("Add item error:", e);
                await finishLED(false);
                showNotification("Error al sincronizar", "error");
            }
        });
    };

    window.removeConfigItem = async (type, index) => {
        const finishLED = await triggerManualLED(type);

        // Optimistic UI
        if (type === "horarios") config.horarios_programa.splice(index, 1);
        if (type === "lugares") config.lugares.splice(index, 1);
        if (type === "facetas") config.facetas.splice(index, 1);
        if (type === "tipos_t") {
            if (!config.tipos_territorio) config.tipos_territorio = ["Casa en Casa", "Negocios", "Pública"];
            config.tipos_territorio.splice(index, 1);
        }

        renderListItems(type);

        try {
            await saveConfiguracion(config);
            await finishLED();
        } catch (e) {
            console.error("Remove item error:", e);
            await finishLED(false);
            showNotification("Error al sincronizar", "error");
        }
    };

    // --- POI (ZONAS) HANDLERS ---
    const openPOIModal = (poi = null) => {
        const isEdit = !!poi;
        showModal(
            `
            <div class="flex flex-col p-6 max-w-sm w-full mx-auto">
                <header class="mb-6">
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-1 uppercase tracking-tighter">${isEdit ? "Editar Zona" : "Añadir Zona"}</h3>
                    <p class="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest">Predicación Especial</p>
                </header>

                <div class="space-y-5">
                    <div class="space-y-2 group/input">
                        <label class="label-premium">Nombre de la Zona</label>
                        <input type="text" id="poi-name" value="${poi?.nombre || ""}" class="input-premium" placeholder="P. ej: Parada de Taxis Central">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2 group/input">
                            <label class="label-premium">Tipo</label>
                            <div class="relative">
                                <select id="poi-type" class="input-premium appearance-none cursor-pointer pr-10">
                                    <option value="Taxi" ${poi?.tipo === "Taxi" ? "selected" : ""}>🚕 Taxis</option>
                                    <option value="Bus" ${poi?.tipo === "Bus" ? "selected" : ""}>🚌 Bus</option>
                                    <option value="Parque" ${poi?.tipo === "Parque" ? "selected" : ""}>🌳 Parque</option>
                                    <option value="Comercial" ${poi?.tipo === "Comercial" ? "selected" : ""}>🏪 Tiendas</option>
                                </select>
                                <i class="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-[10px] pointer-events-none"></i>
                            </div>
                        </div>
                        <div class="space-y-2 group/input">
                            <label class="label-premium">Territorio</label>
                            <div class="relative">
                                <select id="poi-terr" class="input-premium appearance-none cursor-pointer pr-10">
                                    <option value="">Buscar T...</option>
                                    ${territorios
                                        .sort((a, b) =>
                                            String(a.numero || "").localeCompare(String(b.numero || ""), undefined, {
                                                numeric: true,
                                            }),
                                        )
                                        .map(
                                            (t) => `
                                        <option value="${t.id}" data-num="${t.numero}" ${poi?.territorio_id === t.id ? "selected" : ""}>T-${t.numero}</option>
                                    `,
                                        )
                                        .join("")}
                                </select>
                                <i class="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-[10px] pointer-events-none"></i>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-2 group/input">
                        <label class="label-premium">Instrucciones / Ubicación</label>
                        <textarea id="poi-desc" rows="2" class="input-premium resize-none" placeholder="Ubicación exacta...">${poi?.descripcion || ""}</textarea>
                    </div>
                </div>

                <footer class="mt-8 flex gap-3">
                    <button type="button" id="btn-cancel-poi" class="btn-pro flex-1 min-w-0 px-5 py-3.5 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors">
                        Omitir
                    </button>
                    <button type="button" id="save-poi-btn" class="btn-pro flex-[2] px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-3">
                        <i class="fas fa-save opacity-70"></i> ${isEdit ? "Actualizar" : "Guardar Zona"}
                    </button>
                </footer>
            </div>
        `,
            (modal) => {
                modal.querySelector("#btn-cancel-poi").onclick = (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                    }
                    modal.classList.add("hidden");
                    modal.innerHTML = ""; // Destrucción del DOM
                };

                modal.querySelector("#save-poi-btn").onclick = async (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                    }

                    const btn = modal.querySelector("#save-poi-btn");
                    const name = modal.querySelector("#poi-name").value.trim();
                    const type = modal.querySelector("#poi-type").value;
                    const terrId = modal.querySelector("#poi-terr").value;
                    const terrNum =
                        modal.querySelector("#poi-terr").options[modal.querySelector("#poi-terr").selectedIndex].dataset
                            .num;
                    const desc = modal.querySelector("#poi-desc").value.trim();

                    if (!name || !terrId) return showNotification("Nombre y Territorio obligatorios", "warning");

                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Procesando...';

                    try {
                        const finishLED = await triggerManualLED("zonas");
                        const data = {
                            nombre: name,
                            tipo: type,
                            territorio_id: terrId,
                            territorio_numero: terrNum,
                            descripcion: desc,
                        };
                        if (isEdit) await updatePuntoInteres(poi.id, data);
                        else await addPuntoInteres(data);

                        modal.classList.add("hidden");
                        modal.innerHTML = ""; // Destrucción completa
                        await finishLED();
                        showNotification(isEdit ? "Zona actualizada" : "Zona añadida");
                        renderZonasUI();
                    } catch (e) {
                        showNotification(`Error: ${e.message}`, "error");
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-save"></i> Reintentar';
                    }
                };
            },
            "max-w-sm",
        );
    };

    const addHorBtn = container.querySelector("#add-horario");
    if (addHorBtn) addHorBtn.onclick = () => addConfigItem("horarios");

    const addLugBtn = container.querySelector("#add-lugar");
    if (addLugBtn) addLugBtn.onclick = () => addConfigItem("lugares");

    const addFacBtn = container.querySelector("#add-faceta");
    if (addFacBtn) addFacBtn.onclick = () => addConfigItem("facetas");

    const addTipBtn = container.querySelector("#add-tipo-t");
    if (addTipBtn) addTipBtn.onclick = () => addConfigItem("tipos_t");

    const addDiffBtn = container.querySelector("#add-diffusion-msg");
    if (addDiffBtn) {
        addDiffBtn.onclick = null; // Purge stale
        addDiffBtn.onclick = () => {
            showCustomPrompt("Contenido del Anuncio:", "", async (val) => {
                if (!val) return;
                const finishLED = await triggerManualLED("diffusion");

                try {
                    // Carga fresca para evitar machacar cambios en paralelo
                    const freshConfig = await import("../../data/firestore-services.js").then((m) =>
                        m.getConfiguracion(),
                    );
                    const currentMsgs = Array.isArray(freshConfig.diffusion_messages)
                        ? freshConfig.diffusion_messages
                        : [];

                    // Solo añadir si no existe ya exactamente igual (opcional pero recomendado)
                    // if (currentMsgs.includes(val)) return showNotification("Mensaje ya existe", "warning");

                    freshConfig.diffusion_messages = [...currentMsgs, val];
                    await saveConfiguracion(freshConfig);

                    // Limpieza de caché local para asegurar que el re-render use datos nuevos
                    ServiceCache.clear("configuracion");

                    if (window.XolvyAlert) {
                        window.XolvyAlert.fire({
                            title: "Anuncio Publicado",
                            text: "El banner se actualizará en segundos.",
                            icon: "success",
                            timer: 2000,
                            showConfirmButton: false,
                            didClose: () => {
                                // Re-render sin skeleton (para evitar parpadeo agresivo)
                                renderSettingsView(container, freshConfig, appVersion, reloadTabFn);
                            },
                        });
                    } else {
                        await finishLED();
                        renderConfigTab(container, freshConfig, appVersion, reloadTabFn);
                    }
                } catch (e) {
                    console.error("Error al guardar anuncio:", e);
                    showNotification("Error al guardar", "error");
                    await finishLED(false);
                }
            });
        };
    }

    const addPoiBtn = container.querySelector("#add-poi-btn");
    if (addPoiBtn) addPoiBtn.onclick = () => openPOIModal();

    window.editPOI_Rules = (id) => openPOIModal(puntosInteres.find((p) => p.id === id));
    window.deletePOI_Rules = (id) =>
        showCustomConfirm("¿Eliminar esta zona de predicación?", async () => {
            const finishLED = await triggerManualLED("zonas");
            await deletePuntoInteres(id);
            await finishLED();
            showNotification("Zona eliminada");
            renderZonasUI();
        });

    window.removeDiffusionMessage = async (index) => {
        if (!config.diffusion_messages) return;
        const finishLED = await triggerManualLED("diffusion");
        config.diffusion_messages.splice(index, 1);
        await saveConfiguracion(config);

        // Sincronización Suave: Limpiar caché y re-renderizar sin skeleton
        ServiceCache.clear("configuracion");
        await finishLED();
        renderSettingsView(container, config, appVersion, reloadTabFn);
    };

    const btnForceReload = container.querySelector("#btn-force-global-reload");
    if (btnForceReload) {
        btnForceReload.onclick = () => {
            showCustomConfirm(
                "¿Estás seguro de que deseas forzar la recarga en todos los dispositivos activos?",
                async () => {
                    btnForceReload.disabled = true;
                    btnForceReload.innerHTML =
                        '<i class="fas fa-spinner fa-spin mr-2"></i> Propagando Actualización...';
                    try {
                        await broadcastCurrentVersion();
                        btnForceReload.innerHTML = '<i class="fas fa-check mr-2"></i> ¡Propagado Exitosamente!';
                        setTimeout(() => {
                            btnForceReload.disabled = false;
                            btnForceReload.innerHTML =
                                '<i class="fas fa-sync-alt"></i> Forzar Recarga en Todos los Dispositivos';
                        }, 3000);
                    } catch (err) {
                        console.error("Error al propagar recarga global:", err);
                        btnForceReload.disabled = false;
                        btnForceReload.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> Error al Propagar';
                        showNotification("Error al forzar recarga", "error");
                    }
                },
            );
        };
    }

    const btnSendNotif = container.querySelector("#btn-send-pwa-notif");
    if (btnSendNotif) {
        btnSendNotif.onclick = async () => {
            const titleInput = container.querySelector("#notif-title");
            const bodyInput = container.querySelector("#notif-body");
            const titulo = titleInput?.value.trim();
            const cuerpo = bodyInput?.value.trim();

            if (!titulo || !cuerpo) {
                showNotification("Título y mensaje son requeridos", "warning");
                return;
            }

            btnSendNotif.disabled = true;
            btnSendNotif.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enviando Notificación...';

            try {
                const { httpsCallable } = await import("firebase/functions");
                const { functions } = await import("../../firebase-config.js");
                const enviarNotif = httpsCallable(functions, "enviarNotificacionGlobal");
                await enviarNotif({ titulo, cuerpo });

                showNotification("Notificación enviada con éxito", "success");
                if (titleInput) titleInput.value = "";
                if (bodyInput) bodyInput.value = "";
            } catch (err) {
                console.error("Error al enviar notificación push:", err);
                showNotification("Error al enviar la notificación", "error");
            } finally {
                btnSendNotif.disabled = false;
                btnSendNotif.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Notificación Push';
            }
        };
    }
};

export const renderSettingsView = renderConfigTab;
