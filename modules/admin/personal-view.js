import {
    addPublicador,
    deletePublicador,
    getGroupsConfig,
    startLivePool,
    updatePublicador,
} from "../../data/firestore-services.js";
import { setAdminLivePool } from "../admin-dashboard.js";
import { showCustomConfirm, showModal } from "../services/ui-helpers.js";
import { normalize, showNotification, toTitleCase } from "../utils/helpers.js";

export const renderPersonalTab = async (container, _configData = null, _appVersion = null) => {
    // Xolvy Data Shield: Robust normalization & ghost filtering for Personnel
    // Xolvy Data Shield: Robust normalization & ghost filtering for Personnel
    const groups = await getGroupsConfig();
    let publicadores = [];

    const renderMainLayout = () => {
        container.innerHTML = `
            <div class="space-y-12 animate-fade-in">
                <!-- Header Clean Aesthetic -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-2 border-b border-slate-100 dark:border-white/5">
                    <div class="flex flex-col">
                        <div class="flex items-center gap-3 mb-2">
                            <span class="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-widest rounded border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-400/20">Active Directory</span>
                            <div class="h-px w-8 bg-slate-200 dark:bg-white/10"></div>
                        </div>
                        <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Directorio de Personal</h2>
                        <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Gestión estratégica de la congregación</p>
                    </div>

                    <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <button id="btn-manage-groups" class="px-5 py-3.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-500 hover:text-indigo-600 transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm active:scale-95 group">
                            <i class="fas fa-users opacity-40 group-hover:opacity-100"></i> Roles y Grupos
                        </button>
                        <button id="btn-add-person" class="flex-1 min-w-0 md:flex-none px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm shadow-indigo-200 active:scale-95 group">
                            <i class="fas fa-plus opacity-70"></i> Nuevo Registro
                        </button>
                    </div>
                </div>

            <div class="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden mt-8">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50/50 dark:bg-black/20 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                                <th class="px-8 py-6">Nombre y Apellido</th>
                                <th class="px-8 py-6 text-center">Grupo</th>
                                <th class="px-8 py-6 text-center">Rol / Estado</th>
                                <th class="px-8 py-6 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50 dark:divide-white/5">
                            ${publicadores
                                .map(
                                    (p) => `
                                <tr class="group hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                                    <td class="px-8 py-5">
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white/10 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                                ${p.nombre.charAt(0)}
                                            </div>
                                            <div>
                                                <p class="text-sm font-bold text-slate-900 dark:text-white tracking-tight">${toTitleCase(p.nombre)}</p>
                                                <p class="text-[10px] text-slate-600 dark:text-slate-400 font-medium">${p.telefono || "Sin teléfono"}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-8 py-5 text-center">
                                        <span class="text-[10px] font-bold uppercase text-slate-500 bg-slate-100/50 dark:bg-white/5 px-3 py-1.5 rounded-lg ring-1 ring-slate-200/50 dark:ring-white/10">
                                            ${toTitleCase(groups.find((g) => g.id === p.grupo)?.numero_nombre || (p.grupo ? `Grupo ${p.grupo}` : "—"))}
                                        </span>
                                    </td>
                                    <td class="px-8 py-5">
                                        <div class="flex flex-wrap items-center justify-center gap-2">
                                            ${
                                                p.privilegios?.includes("Superintendente de Circuito")
                                                    ? `
                                                <span class="text-[9px] font-bold uppercase tracking-widest bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 ring-1 ring-indigo-200 px-3 py-1 rounded-full">Sup. Circuito</span>
                                            `
                                                    : ""
                                            }
                                            ${
                                                p.es_conductor
                                                    ? `
                                                <button onclick="event.stopPropagation(); window.showPublicadorAvailability('${p.id}')" class="text-[9px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-200 px-3 py-1 rounded-full hover:bg-emerald-600 hover:text-white transition-all">
                                                    Conductor
                                                </button>
                                            `
                                                    : `
                                                ${!p.privilegios?.includes("Superintendente de Circuito") ? `<span class="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 opacity-40">Publicador</span>` : ""}
                                            `
                                            }
                                        </div>
                                    </td>
                                    <td class="px-8 py-5">
                                        <div class="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onclick="window.editPerson('${p.id}')" class="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                                <i class="fas fa-edit text-xs"></i>
                                            </button>
                                            <button onclick="window.deletePerson('${p.id}')" class="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                                                <i class="fas fa-trash-alt text-xs"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `,
                                )
                                .join("")}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="md:hidden space-y-3 mt-4">
                ${publicadores
                    .map(
                        (p) => `
                    <div onclick="window.editPerson('${p.id}')" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm p-5 space-y-4 relative active:scale-[0.98] transition-all cursor-pointer">
                        <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-4">
                                <div class="w-11 h-11 rounded-xl bg-slate-900 dark:bg-white/10 flex items-center justify-center text-white font-bold text-lg">
                                    ${p.nombre.charAt(0)}
                                </div>
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">${toTitleCase(p.nombre)}</p>
                                    <p class="text-[11px] text-slate-600 dark:text-slate-400 font-medium">${p.telefono || "Sin teléfono"}</p>
                                </div>
                            </div>
                            <div class="flex-shrink-0">
                                <span class="bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-white/10 text-[10px] font-bold text-slate-500 uppercase">
                                    ${toTitleCase(groups.find((g) => g.id === p.grupo)?.numero_nombre || (p.grupo ? `G${p.grupo}` : "—"))}
                                </span>
                            </div>
                        </div>
                    </div>
                `,
                    )
                    .join("")}
                </div>
            </div>
        `;

        container.querySelector("#btn-add-person").onclick = () => openPersonModal();
        container.querySelector("#btn-manage-groups").onclick = () => openGroupsConfigModal();
    };

    // Xolvy Live Pool: Real-time synchronization for Personnel
    const unsub = startLivePool("publicadores", [], (data) => {
        publicadores = data
            .filter((p) => {
                const hasName = p.nombre && normalize(p.nombre).length > 0;
                if (!hasName) console.warn(`🛡️ [Data Shield] Personnel Ghost Record Filtered: ${p.id}`);
                return hasName;
            })
            .map((p) => ({
                ...p,
                nombre: normalize(p.nombre),
                telefono: normalize(p.telefono),
                email: normalize(p.email).toLowerCase(),
            }))
            .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

        console.log("👥 [Live Pool] Personnel Directory Updated.");
        renderMainLayout();
    });
    setAdminLivePool(unsub);

    window.showPublicadorAvailability = (id) => {
        const p = publicadores.find((x) => x.id === id);
        if (!p || !Array.isArray(p.disponibilidad) || p.disponibilidad.length === 0) return;
        const shiftLabels = { manana: "Mañana", tarde: "Tarde", noche: "Noche" };
        const daysOrder = { Lunes: 0, Martes: 1, Miércoles: 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6 };
        const sorted = [...p.disponibilidad].sort((a, b) => {
            const [da, sa] = a.split("_"),
                [db, sb] = b.split("_");
            return daysOrder[da] - daysOrder[db] || sa.localeCompare(sb);
        });
        const listHtml = sorted
            .map(
                (item) => `
            <div class="flex justify-between items-center p-4 border-b border-slate-100 dark:border-white/5 last:border-0 group hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                <span class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">${item.split("_")[0]}</span>
                <span class="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-1 rounded-md tracking-widest border border-primary/20">
                    ${shiftLabels[item.split("_")[1]] || item.split("_")[1]}
                </span>
            </div> `,
            )
            .join("");

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2rem] overflow-hidden">
                <header class="shrink-0 bg-blue-600 p-6 text-white relative">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-xl"></div>
                    <div class="relative z-10 flex justify-between items-center">
                        <div>
                             <h3 class="text-xl font-black uppercase tracking-tight">Disponibilidad</h3>
                             <p class="text-[9px] opacity-70 font-bold uppercase mt-1 tracking-[0.2em]">${toTitleCase(p.nombre)}</p>
                        </div>
                        <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl shadow-lg border border-white/30">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                    </div>
                </header>
                <div class="flex-1 min-w-0 p-6 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="modern-card !p-0 overflow-hidden shadow-xl border-slate-200 dark:border-white/5">
                        ${listHtml}
                    </div>
                </div>
            </div>
        `);
    };

    const openPersonModal = (person = null) => {
        const isEdit = !!person;
        const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        const shifts = [
            { id: "manana", label: "Mañ.", color: "text-yellow-500" },
            { id: "tarde", label: "Tar.", color: "text-orange-500" },
            { id: "noche", label: "Noc.", color: "text-blue-500" },
        ];

        showModal(
            `
            <div class="flex flex-col h-full bg-white dark:bg-slate-950 rounded-[2.5rem] overflow-hidden animate-scale-in">
                <header class="shrink-0 p-8 flex items-center gap-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                        <div class="w-14 h-14 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-2xl flex items-center justify-center text-2xl border border-indigo-100 dark:border-indigo-400/20">
                            <i class="fas fa-user-plus"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">${isEdit ? "Editar Registro" : "Nuevo Registro"}</h3>
                            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 uppercase tracking-widest">Información del Publicador</p>
                        </div>
                </header>

                <div class="flex-1 min-w-0 p-5 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-black/20 pb-8">
                    <div class="space-y-6 md:space-y-8">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div class="space-y-2 group/input">
                                <label class="label-premium">Nombre Completo</label>
                                <input type="text" id="p-name" value="${toTitleCase(person?.nombre || "")}" placeholder="Ej: Juan Pérez" class="input-premium capitalize">
                            </div>
                            <div class="space-y-2 group/input">
                                <label class="label-premium">WhatsApp / Teléfono</label>
                                <input type="text" id="p-phone" value="${person?.telefono || ""}" placeholder="+593..." class="input-premium font-mono">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 md:gap-6">
                            <div class="space-y-2 group/input">
                                <label class="label-premium">Género</label>
                                <div class="relative">
                                    <select id="p-gender" class="input-premium appearance-none cursor-pointer pr-10">
                                        <option value="Hombre" ${person?.genero === "Hombre" ? "selected" : ""}>Hombre</option>
                                        <option value="Mujer" ${person?.genero === "Mujer" ? "selected" : ""}>Mujer</option>
                                    </select>
                                    <i class="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            </div>
                            <div class="space-y-2 group/input">
                                <label class="label-premium">Grupo Asignado</label>
                                <div class="relative">
                                    <select id="p-group" class="input-premium appearance-none cursor-pointer pr-10">
                                        <option value="0" ${!person?.grupo || person?.grupo === 0 ? "selected" : ""}>Sin asignar</option>
                                        ${(groups || []).map((g) => `<option value="${g.id}" ${person?.grupo === g.id ? "selected" : ""}>${g.numero_nombre || `Grupo ${g.id}`} - ${g.lugar || "Sin ubicación"}</option>`).join("")}
                                    </select>
                                    <i class="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            </div>
                        </div>

                        <div id="p-email-container" class="${person?.privilegios?.includes("Administrador") ? "" : "hidden"} animate-fade-in space-y-2 group/input">
                            <label class="label-premium !text-blue-600 dark:!text-blue-400">Acceso Google (Email)</label>
                            <input type="email" id="p-email" value="${person?.email || ""}" placeholder="usuario@gmail.com" class="input-premium !bg-blue-600/5 !border-blue-600/20 !text-blue-600 dark:!text-blue-400">
                            <p class="text-[9px] text-slate-600 dark:text-slate-400 ml-2 italic font-medium">Requerido para administradores y accesos de nube.</p>
                        </div>

                        <div class="space-y-4 pt-2 pb-2">
                            <label class="label-premium block">Privilegios y Roles</label>
                            <div id="privs-container" class="flex flex-col sm:flex-row flex-wrap gap-3"></div>
                        </div>

                        <div class="enterprise-card !p-0 overflow-hidden">
                            <div class="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group/avail-header" id="header-toggle-avail">
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-calendar-check text-blue-600 group-hover/avail-header:rotate-12 transition-transform"></i>
                                    <span class="text-[10px] font-black uppercase text-blue-600 tracking-widest">Disponibilidad de Conductor</span>
                                </div>
                                <button type="button" id="btn-toggle-avail" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 flex items-center justify-center hover:bg-slate-200 transition-all">
                                    <i class="fas fa-chevron-down transition-transform duration-300" id="avail-chevron"></i>
                                </button>
                            </div>
                            <div id="p-avail-grid" class="p-6 hidden transition-all duration-500 bg-slate-50/50 dark:bg-black/20">
                                 <div class="grid grid-cols-4 gap-2 mb-4 text-center text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                                     <div class="text-left pl-2">Día</div>
                                     ${shifts.map((s) => `<div>${s.label}</div>`).join("")}
                                 </div>
                                 <div class="space-y-2">
                                     ${days
                                         .map(
                                             (day) => `
                                         <div class="grid grid-cols-4 gap-2 items-center bg-white dark:bg-white/5 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                                             <div class="text-[10px] font-black text-slate-600 dark:text-slate-300 pl-2 uppercase">${day.slice(0, 3)}</div>
                                              ${shifts
                                                  .map(
                                                      (sh) => `
                                                <div class="flex justify-center">
                                                    <label class="relative inline-flex items-center cursor-pointer group">
                                                        <input type="checkbox" class="p-avail-check peer sr-only" value="${day}_${sh.id}" ${(Array.isArray(person?.disponibilidad) ? person.disponibilidad : []).includes(`${day}_${sh.id}`) ? "checked" : ""}>
                                                        <div class="w-10 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:border after:border-gray-200 after:transition-all"></div>
                                                    </label>
                                                </div>`,
                                                  )
                                                  .join("")}
                                         </div>
                                     `,
                                         )
                                         .join("")}
                                 </div>
                            </div>
                        </div>

                        <div id="p-modules-section" class="enterprise-card !p-0 overflow-hidden transition-all duration-500">
                            <div class="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-th-large text-indigo-600"></i>
                                    <label class="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Módulos Habilitados</label>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer group">
                                    <input type="checkbox" id="p-mod-enabled" class="peer sr-only" ${person?.modulos?.habilitado !== false ? "checked" : ""}>
                                    <div class="w-11 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-md after:border after:border-gray-200 after:transition-all"></div>
                                </label>
                            </div>
                            <div class="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                ${[
                                    {
                                        id: "mod-agenda",
                                        label: "Agenda Inteligente",
                                        icon: "fa-calendar-day",
                                        checked: person?.modulos?.agenda !== false,
                                    },
                                    {
                                        id: "mod-programa",
                                        label: "Cronograma de Salidas",
                                        icon: "fa-clock",
                                        checked: person?.modulos?.programa !== false,
                                    },
                                    {
                                        id: "mod-disponibilidad",
                                        label: "Mi disponibilidad",
                                        icon: "fa-user-check",
                                        checked: person?.modulos?.disponibilidad !== false,
                                    },
                                    {
                                        id: "mod-telefonos",
                                        label: "Predicación Telefónica",
                                        icon: "fa-phone",
                                        checked: person?.modulos?.telefonos !== false,
                                    },
                                    {
                                        id: "mod-mapas",
                                        label: "Explorador de Mapas",
                                        icon: "fa-map-marked-alt",
                                        checked: person?.modulos?.mapas !== false,
                                    },
                                    {
                                        id: "mod-ayudas",
                                        label: "Recursos del Ministerio",
                                        icon: "fa-book",
                                        checked: person?.modulos?.ayudas !== false,
                                    },
                                    {
                                        id: "mod-cerebro",
                                        label: "Cerebro Nexo (IA)",
                                        icon: "fa-brain",
                                        checked: person?.modulos?.cerebro !== false,
                                    },
                                ]
                                    .map(
                                        (mod) => `
                                    <div class="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-xs">
                                                <i class="fas ${m.icon}"></i>
                                            </div>
                                            <span class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">${m.label}</span>
                                        </div>
                                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                            <input type="checkbox" class="p-mod-check peer sr-only" id="${m.id}" ${(person?.modulos?.[m.id.replace("mod-", "")] ?? true) ? "checked" : ""}>
                                            <div class="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-md after:border after:border-slate-200 peer-checked:after:translate-x-[18px] after:transition-all"></div>
                                        </label>
                                    </div>
                                `,
                                    )
                                    .join("")}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="shrink-0 p-6 bg-white/50 dark:bg-black/40 backdrop-blur-sm border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-4 pt-6 mt-6 w-full">
                    <button type="button" onclick="window.closeModal()" class="btn-pro px-6 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors">Cancelar</button>
                    <button id="save-person" class="btn-pro w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                        <i class="fas fa-save text-xs opacity-70"></i> ${isEdit ? "Guardar Cambios" : "Crear Registro"}
                    </button>
                </div>
            </div>
        `,
            (modal) => {
                const genderSelect = modal.querySelector("#p-gender");
                const privsContainer = modal.querySelector("#privs-container");
                const saveBtn = modal.querySelector("#save-person");

                const syncConductorUI = () => {
                    const isConductor = Array.from(privsContainer.querySelectorAll(".p-priv-check:checked")).some(
                        (cb) => cb.value === "Conductor",
                    );
                    const availGrid = modal.querySelector("#p-avail-grid");
                    const modulesSection = modal.querySelector("#p-modules-section");
                    const modDisponibilidad = modal.querySelector("#mod-disponibilidad");
                    const isModulesMasterEnabled = modal.querySelector("#p-mod-enabled")?.checked;
                    const isModuleEnabled = modDisponibilidad?.checked;

                    const headerAvail = modal.querySelector("#header-toggle-avail");
                    const availContainer = headerAvail?.parentElement;

                    if (!isConductor) {
                        if (availContainer)
                            availContainer.classList.add("opacity-40", "pointer-events-none", "grayscale");
                        if (availGrid) availGrid.classList.add("opacity-20", "pointer-events-none", "grayscale");
                    } else {
                        if (availContainer)
                            availContainer.classList.remove("opacity-40", "pointer-events-none", "grayscale");
                        const shouldBeLocked = !isModuleEnabled;
                        if (availGrid) {
                            availGrid.classList.toggle("opacity-20", shouldBeLocked);
                            availGrid.classList.toggle("pointer-events-none", shouldBeLocked);
                            availGrid.classList.toggle("grayscale", shouldBeLocked);
                        }
                    }

                    const modChecks = modulesSection ? modulesSection.querySelectorAll(".p-mod-check") : [];
                    if (!isModulesMasterEnabled) {
                        if (modulesSection) modulesSection.classList.add("opacity-40");
                        modChecks.forEach((m) => {
                            m.disabled = true;
                            m.closest("div").classList.add("pointer-events-none", "opacity-60");
                        });
                    } else {
                        if (modulesSection) modulesSection.classList.remove("opacity-40");
                        modChecks.forEach((m) => {
                            m.disabled = false;
                            m.closest("div").classList.remove("pointer-events-none", "opacity-60");
                        });
                    }
                };

                const headerToggleAvail = modal.querySelector("#header-toggle-avail");
                if (headerToggleAvail) {
                    headerToggleAvail.onclick = () => {
                        modal.querySelector("#p-avail-grid").classList.toggle("hidden");
                        const chevron = modal.querySelector("#avail-chevron");
                        if (chevron) chevron.classList.toggle("rotate-180");
                    };
                }

                const updatePrivsList = () => {
                    const gender = genderSelect.value;
                    const malePrivs = [
                        "Superintendente de Circuito",
                        "Anciano",
                        "Siervo ministerial",
                        "Conductor",
                        "Administrador",
                    ];
                    const femalePrivs = ["Conductor", "Administrador"];
                    const currentPrivs = person?.privilegios || [];
                    const list = gender === "Hombre" ? malePrivs : femalePrivs;

                    privsContainer.innerHTML = list
                        .map(
                            (pr) => `
                    <label class="enterprise-card p-5 flex items-center justify-between cursor-pointer group transition-all hover:border-primary/50">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><i class="fas fa-shield-alt"></i></div>
                            <div>
                                <h5 class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none mb-1">${pr}</h5>
                                <p class="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest">Nivel de Acceso</p>
                            </div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" class="p-priv-check peer sr-only" value="${pr}" ${currentPrivs.includes(pr) ? "checked" : ""}>
                            <div class="w-11 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-md after:border after:border-gray-200 after:transition-all"></div>
                        </label>
                    </label>
                `,
                        )
                        .join("");

                    privsContainer.querySelectorAll(".p-priv-check").forEach((cb) => {
                        cb.addEventListener("change", syncConductorUI);
                        if (cb.value === "Administrador") {
                            cb.addEventListener("change", () => {
                                modal.querySelector("#p-email-container").classList.toggle("hidden", !cb.checked);
                            });
                        }
                    });
                    syncConductorUI();
                };

                genderSelect.addEventListener("change", updatePrivsList);
                updatePrivsList();

                modal.querySelector("#mod-disponibilidad").addEventListener("change", syncConductorUI);
                modal.querySelector("#p-mod-enabled").addEventListener("change", syncConductorUI);

                saveBtn.onclick = async () => {
                    const original = saveBtn.innerHTML;
                    saveBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...';
                    saveBtn.disabled = true;

                    const data = {
                        nombre: modal.querySelector("#p-name").value.trim(),
                        telefono: modal.querySelector("#p-phone").value.trim(),
                        genero: modal.querySelector("#p-gender").value,
                        grupo: parseInt(modal.querySelector("#p-group").value, 10),
                        es_conductor: Array.from(modal.querySelectorAll(".p-priv-check:checked")).some(
                            (cb) => cb.value === "Conductor",
                        ),
                        email: modal.querySelector("#p-email").value.trim().toLowerCase(),
                        privilegios: Array.from(modal.querySelectorAll(".p-priv-check:checked")).map((cb) => cb.value),
                        disponibilidad: Array.from(modal.querySelectorAll(".p-priv-check:checked")).some(
                            (cb) => cb.value === "Conductor",
                        )
                            ? Array.from(modal.querySelectorAll(".p-avail-check:checked")).map((cb) => cb.value)
                            : [],
                        modulos: {
                            habilitado: modal.querySelector("#p-mod-enabled").checked,
                            agenda: modal.querySelector("#mod-agenda").checked,
                            programa: modal.querySelector("#mod-programa").checked,
                            disponibilidad: modal.querySelector("#mod-disponibilidad").checked,
                            telefonos: modal.querySelector("#mod-telefonos").checked,
                            mapas: modal.querySelector("#mod-mapas").checked,
                            ayudas: modal.querySelector("#mod-ayudas").checked,
                            cerebro: modal.querySelector("#mod-cerebro").checked,
                            rescue: modal.querySelector("#mod-agenda").checked,
                        },
                    };

                    if (!data.nombre) {
                        showNotification("El nombre es obligatorio", "error");
                        saveBtn.innerHTML = original;
                        saveBtn.disabled = false;
                        return;
                    }

                    try {
                        if (isEdit) await updatePublicador(person.id, data);
                        else await addPublicador(data);
                        showNotification("Personal actualizado");
                        modal.classList.add("hidden");
                        modal.innerHTML = "";
                        renderMainLayout(); // Optimistic Redraw
                    } catch (e) {
                        showNotification(`Error: ${e.message}`, "error");
                        saveBtn.innerHTML = original;
                        saveBtn.disabled = false;
                    }
                };
            },
            "max-w-2xl",
        );
    };

    const openGroupsConfigModal = async () => {
        const { saveGroupsConfig } = await import("../../data/firestore-services.js");
        const localGroups = JSON.parse(JSON.stringify(groups));
        const personnel = publicadores;

        const renderGroupsList = (modal) => {
            const list = modal.querySelector("#groups-config-list");
            list.innerHTML = localGroups
                .map(
                    (g, idx) => `
                <div class="p-6 modern-card border-slate-100 dark:border-white/5 space-y-4 group/group-card relative group-item-block">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <span class="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-black text-xs">#${g.id}</span>
                            <input type="text" value="${toTitleCase(g.numero_nombre || g.nombre || `Grupo ${g.id}`)}" data-field="numero_nombre" placeholder="Nombre del Grupo" class="bg-transparent border-b border-dashed border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none font-black text-sm capitalize tracking-tight text-slate-800 dark:text-white group-input">
                        </div>
                        <button onclick="window.removeGroupConfig(${idx})" class="w-8 h-8 rounded-lg hover:bg-rose-500/10 text-slate-700 dark:text-slate-300 hover:text-rose-500 transition-all">
                            <i class="fas fa-trash-alt text-xs"></i>
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="space-y-1.5">
                            <label class="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Lugar de Salida</label>
                            <input type="text" value="${toTitleCase(g.lugar || g.casa_salida || "")}" data-field="lugar" placeholder="Ej: Familia Barrera" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl p-3 text-[11px] font-bold outline-none focus:border-indigo-500/50 group-input capitalize shadow-inner">
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Superintendente</label>
                            <select data-field="superintendente" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl p-3 text-[11px] font-bold outline-none focus:border-indigo-500/50 appearance-none group-input">
                                <option value="">— Sin asignar —</option>
                                ${personnel
                                    .filter((p) => p.genero === "Hombre")
                                    .map(
                                        (p) =>
                                            `<option value="${p.nombre}" ${(g.superintendente || g.lider) === p.nombre ? "selected" : ""}>${toTitleCase(p.nombre)}</option>`,
                                    )
                                    .join("")}
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Auxiliar</label>
                            <select data-field="auxiliar" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl p-3 text-[11px] font-bold outline-none focus:border-indigo-500/50 appearance-none group-input">
                                <option value="">— Sin asignar —</option>
                                ${personnel
                                    .filter((p) => p.genero === "Hombre")
                                    .map(
                                        (p) =>
                                            `<option value="${p.nombre}" ${(g.auxiliar || g.asistente) === p.nombre ? "selected" : ""}>${toTitleCase(p.nombre)}</option>`,
                                    )
                                    .join("")}
                            </select>
                        </div>
                    </div>
                </div>
            `,
                )
                .join("");
        };

        window.removeGroupConfig = (idx) => {
            localGroups.splice(idx, 1);
            renderGroupsList(document.getElementById("modal-container"));
        };

        showModal(
            `
            <div class="flex flex-col h-[85vh] bg-white dark:bg-slate-950 rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 p-8 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                        <div class="flex items-center gap-6">
                            <div class="w-14 h-14 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-2xl flex items-center justify-center text-2xl border border-indigo-100 dark:border-indigo-400/20">
                                <i class="fas fa-users-cog"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Estructura Grupal</h3>
                                <p class="text-xs text-slate-500 font-medium mt-0.5 uppercase tracking-widest">Configuración de Salidas</p>
                            </div>
                        </div>
                </header>
                <div class="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-black/20 pb-12">
                    <div id="groups-config-list" class="space-y-4"></div>
                    <button id="add-new-group-btn" class="w-full py-4 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-400 transition-all flex items-center justify-center gap-3">
                        <i class="fas fa-plus-circle"></i> Añadir Nuevo Grupo
                    </button>
                </div>
                <div class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="flex-1 min-w-0 py-4 bg-slate-50 dark:bg-white/5 text-slate-500 font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors">Cancelar</button>
                    <button id="save-groups-btn" class="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-sm shadow-indigo-200 transition-all active:scale-[0.99]">
                        Guardar Configuración
                    </button>
                </div>
            </div>
        `,
            (modal) => {
                renderGroupsList(modal);
                modal.querySelector("#add-new-group-btn").onclick = () => {
                    const nextId =
                        localGroups.length > 0 ? Math.max(...localGroups.map((g) => parseInt(g.id, 10))) + 1 : 1;
                    localGroups.push({
                        id: nextId,
                        numero_nombre: `Grupo ${nextId}`,
                        superintendente: "",
                        auxiliar: "",
                        lugar: "",
                    });
                    renderGroupsList(modal);
                };
                modal.querySelector("#save-groups-btn").onclick = async () => {
                    const btn = modal.querySelector("#save-groups-btn");
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';

                    // Recolección manual del DOM para asegurar integridad absoluta
                    const groupBlocks = modal.querySelectorAll(".group-item-block");
                    const finalGroups = Array.from(groupBlocks).map((block) => {
                        const id = parseInt(block.querySelector("span").innerText.replace("#", ""), 10);
                        const inputs = block.querySelectorAll(".group-input");
                        const data = { id };
                        inputs.forEach((input) => {
                            const field = input.dataset.field;
                            data[field] = input.value;
                        });
                        return data;
                    });

                    try {
                        await saveGroupsConfig(finalGroups);
                        // Actualizamos caché local para el closure de Personal
                        groups.length = 0;
                        groups.push(...finalGroups);

                        showNotification("Configuración de grupos guardada exitosamente");
                        modal.classList.add("hidden");
                        modal.innerHTML = "";
                        renderMainLayout(); // Re-render para mostrar grupos actualizados en la tabla si fuera necesario
                    } catch (e) {
                        console.error("Save groups error:", e);
                        showNotification("Error al guardar grupos", "error");
                        btn.disabled = false;
                        btn.innerHTML = "Guardar Configuración";
                    }
                };
            },
            "max-w-3xl",
        );
    };

    window.editPerson = (id) => openPersonModal(publicadores.find((x) => x.id === id));
    window.deletePerson = (id) =>
        showCustomConfirm("¿Eliminar este registro permanentemente?", async () => {
            await deletePublicador(id);
        });
};
