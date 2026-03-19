import { addPublicador, updatePublicador, deletePublicador, getGroupsConfig, startLivePool } from '../../data/firestore-services.js';
import { showNotification, normalize } from '../utils/helpers.js';
import { showModal, showCustomConfirm } from '../services/ui-helpers.js';
import { setAdminLivePool } from '../admin-dashboard.js';

export const renderPersonalTab = async (container) => {
    // Xolvy Data Shield: Robust normalization & ghost filtering for Personnel
    // Xolvy Data Shield: Robust normalization & ghost filtering for Personnel
    const groups = await getGroupsConfig();
    let publicadores = [];

    const renderMainLayout = () => {
        container.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6 px-4">
                <div class="space-y-1">
                    <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Directorio de Personal</h3>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] ml-1">Gestión centralizada de publicadores</p>
                </div>
                
                <div class="flex gap-4 w-full sm:w-auto">
                    <button id="btn-manage-groups" class="flex-1 sm:flex-none bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 hover:bg-indigo-500 hover:text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-users"></i> Grupos
                    </button>
                    <button id="btn-add-person" class="flex-[1.5] sm:flex-none bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-plus"></i> Nuevo Registro
                    </button>
                </div>
            </div>

            <div class="hidden md:block modern-card !p-0 overflow-hidden border-slate-200 dark:border-white/5 shadow-2xl">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50 dark:bg-black/20 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100 dark:border-white/5">
                                <th class="p-6">Nombre y Apellido</th>
                                <th class="p-6 text-center">Grupo</th>
                                <th class="p-6 text-center">Rol / Estado</th>
                                <th class="p-6 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                            ${publicadores.map(p => `
                                <tr class="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td class="p-6">
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${p.genero === 'Mujer' ? 'from-rose-500 to-pink-500' : 'from-primary to-blue-600'} flex items-center justify-center text-white font-black text-sm shadow-lg group-hover:scale-110 transition-transform">
                                                ${p.nombre.charAt(0)}
                                            </div>
                                            <div>
                                                <p class="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">${p.nombre}</p>
                                                <p class="text-[9px] text-slate-400 font-mono">${p.telefono || 'SIN TELÉFONO'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="p-6 text-center">
                                        <span class="text-[10px] font-black uppercase text-slate-400 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 shadow-inner">
                                            ${p.grupo || '?'}
                                        </span>
                                    </td>
                                    <td class="p-6">
                                        <div class="flex flex-wrap items-center justify-center gap-2">
                                            ${p.privilegios?.includes('Superintendente de Circuito') ? `
                                                <span class="text-[8px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full">Sup. Circuito</span>
                                            ` : ''}
                                            ${p.es_conductor ? `
                                                <button onclick="event.stopPropagation(); window.showPublicadorAvailability('${p.id}')" class="text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full hover:bg-emerald-500 hover:text-white transition-all">
                                                    <i class="fas fa-check-circle mr-1"></i> Conductor
                                                </button>
                                            ` : `
                                                ${!p.privilegios?.includes('Superintendente de Circuito') ? `<span class="text-[8px] font-black uppercase tracking-widest text-slate-400 opacity-40">Publicador</span>` : ''}
                                            `}
                                            ${p.privilegios?.includes('Administrador') ? `
                                                <span class="text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 border border-amber-500/20 px-3 py-1 rounded-full">Admin</span>
                                            ` : ''}
                                        </div>
                                    </td>
                                    <td class="p-6">
                                        <div class="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                            <button onclick="window.editPerson('${p.id}')" class="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl border border-slate-200 dark:border-white/10 hover:border-primary/40 transition-all shadow-sm">
                                                <i class="fas fa-edit text-[10px]"></i>
                                            </button>
                                            <button onclick="window.deletePerson('${p.id}')" class="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-500 rounded-xl border border-slate-200 dark:border-white/10 hover:border-rose-500/40 transition-all shadow-sm">
                                                <i class="fas fa-trash-alt text-[10px]"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="md:hidden space-y-4 px-2">
                ${publicadores.map(p => `
                    <div onclick="window.editPerson('${p.id}')" class="modern-card p-5 border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md space-y-4 relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer">
                        <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br ${p.genero === 'Mujer' ? 'from-rose-500 to-pink-500' : 'from-primary to-blue-600'} flex items-center justify-center text-white font-black text-lg shadow-lg">
                                    ${p.nombre.charAt(0)}
                                </div>
                                <div class="min-w-0">
                                    <p class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">${p.nombre}</p>
                                    <p class="text-[10px] text-slate-400 font-mono font-bold">${p.telefono || 'SIN TELÉFONO'}</p>
                                </div>
                            </div>
                            <div class="flex-shrink-0">
                                <span class="bg-slate-100 dark:bg-white/5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-[9px] font-black text-slate-500">
                                    G ${p.grupo || '?'}
                                </span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.querySelector('#btn-add-person').onclick = () => openPersonModal();
        container.querySelector('#btn-manage-groups').onclick = () => openGroupsConfigModal();
    };

    // Xolvy Live Pool: Real-time synchronization for Personnel
    const unsub = startLivePool("publicadores", [], (data) => {
        publicadores = data
            .filter(p => {
                const hasName = p.nombre && normalize(p.nombre).length > 0;
                if (!hasName) console.warn(`🛡️ [Data Shield] Personnel Ghost Record Filtered: ${p.id}`);
                return hasName;
            })
            .map(p => ({
                ...p,
                nombre: normalize(p.nombre),
                telefono: normalize(p.telefono),
                email: normalize(p.email).toLowerCase()
            }))
            .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

        console.log("👥 [Live Pool] Personnel Directory Updated.");
        renderMainLayout();
    });
    setAdminLivePool(unsub);

    window.showPublicadorAvailability = (id) => {
        const p = publicadores.find(x => x.id === id);
        if (!p || !Array.isArray(p.disponibilidad) || p.disponibilidad.length === 0) return;
        const shiftLabels = { 'manana': 'Mañana', 'tarde': 'Tarde', 'noche': 'Noche' };
        const daysOrder = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6 };
        const sorted = [...p.disponibilidad].sort((a, b) => {
            const [da, sa] = a.split('_'), [db, sb] = b.split('_');
            return (daysOrder[da] - daysOrder[db]) || (sa.localeCompare(sb));
        });
        const listHtml = sorted.map(item => `
            <div class="flex justify-between items-center p-4 border-b border-slate-100 dark:border-white/5 last:border-0 group hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                <span class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">${item.split('_')[0]}</span>
                <span class="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-1 rounded-md tracking-widest border border-primary/20">
                    ${shiftLabels[item.split('_')[1]] || item.split('_')[1]}
                </span>
            </div> `).join('');

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-6 text-white relative">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-xl"></div>
                    <div class="relative z-10 flex justify-between items-center">
                        <div>
                             <h3 class="text-xl font-black uppercase tracking-tight">Disponibilidad</h3>
                             <p class="text-[9px] opacity-70 font-bold uppercase mt-1 tracking-[0.2em]">${p.nombre}</p>
                        </div>
                        <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl shadow-lg border border-white/30">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                    </div>
                </header>
                <div class="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="modern-card !p-0 overflow-hidden shadow-xl border-slate-200 dark:border-white/5">
                        ${listHtml}
                    </div>
                </div>
            </div>
        `);
    };

    const openPersonModal = (person = null) => {
        const isEdit = !!person;
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const shifts = [{ id: 'manana', label: 'Mañ.', color: 'text-yellow-500' }, { id: 'tarde', label: 'Tar.', color: 'text-orange-500' }, { id: 'noche', label: 'Noc.', color: 'text-blue-500' }];

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-6 md:p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-user-circle"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">${isEdit ? 'Editar Registro' : 'Nuevo Registro'}</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Gestión de Personal</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-5 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="space-y-6 md:space-y-8">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                                <input type="text" id="p-name" value="${person?.nombre || ''}" placeholder="Ej: Juan Pérez" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp / Teléfono</label>
                                <input type="text" id="p-phone" value="${person?.telefono || ''}" placeholder="+593..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white font-mono">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 md:gap-6">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Género</label>
                                <select id="p-gender" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white appearance-none cursor-pointer">
                                    <option value="Hombre" ${person?.genero === 'Hombre' ? 'selected' : ''}>Hombre</option>
                                    <option value="Mujer" ${person?.genero === 'Mujer' ? 'selected' : ''}>Mujer</option>
                                </select>
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grupo Asignado</label>
                                <select id="p-group" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white appearance-none cursor-pointer">
                                    <option value="0" ${!person?.grupo || person?.grupo === 0 ? 'selected' : ''}>Sin asignar</option>
                                    ${(groups || []).map(g => `<option value="${g.id}" ${person?.grupo == g.id ? 'selected' : ''}>${g.nombre || `Grupo ${g.id}`}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div id="p-email-container" class="${person?.privilegios?.includes('Administrador') ? '' : 'hidden'} animate-fade-in space-y-3">
                            <label class="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Acceso Google (Email)</label>
                            <input type="email" id="p-email" value="${person?.email || ''}" placeholder="usuario@gmail.com" class="w-full bg-primary/5 border border-primary/20 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-inner transition-all text-primary">
                            <p class="text-[9px] text-slate-400 ml-1 italic font-bold uppercase tracking-tighter">Requerido para administradores y accesos de nube.</p>
                        </div>

                        <div class="space-y-4">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Privilegios y Roles</label>
                            <div id="privs-container" class="flex flex-wrap gap-3"></div>
                        </div>

                        <div class="bg-primary/5 rounded-[2rem] border border-primary/10 overflow-hidden">
                            <div class="p-6 border-b border-primary/10 flex items-center justify-between cursor-pointer hover:bg-primary/10 transition-colors group/avail-header" id="header-toggle-avail">
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-calendar-check text-primary group-hover/avail-header:rotate-12 transition-transform"></i>
                                    <span class="text-[10px] font-black uppercase text-primary tracking-widest">Disponibilidad de Conductor</span>
                                </div>
                                <button type="button" id="btn-toggle-avail" class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-all">
                                    <i class="fas fa-chevron-down transition-transform duration-300" id="avail-chevron"></i>
                                </button>
                            </div>
                            <div id="p-avail-grid" class="p-6 hidden transition-all duration-500 bg-white/40 dark:bg-black/20">
                                 <div class="grid grid-cols-4 gap-2 mb-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                     <div class="text-left pl-2">Día</div>
                                     ${shifts.map(s => `<div>${s.label}</div>`).join('')}
                                 </div>
                                 <div class="space-y-2">
                                     ${days.map(day => `
                                         <div class="grid grid-cols-4 gap-2 items-center modern-card !p-3">
                                             <div class="text-[10px] font-black text-slate-600 dark:text-slate-300 pl-2 uppercase">${day.slice(0, 3)}</div>
                                             ${shifts.map(sh => `<div class="flex justify-center"><input type="checkbox" class="p-avail-check w-5 h-5 accent-primary cursor-pointer" value="${day}_${sh.id}" ${(Array.isArray(person?.disponibilidad) ? person.disponibilidad : []).includes(`${day}_${sh.id}`) ? 'checked' : ''}></div>`).join('')}
                                         </div>
                                     `).join('')}
                                 </div>
                            </div>
                        </div>

                        <div id="p-modules-section" class="bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10 overflow-hidden transition-all duration-500">
                            <div class="p-6 border-b border-indigo-500/10 flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-th-large text-indigo-600"></i>
                                    <label class="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Módulos Habilitados</label>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="p-mod-enabled" class="sr-only peer" ${person?.modulos?.habilitado !== false ? 'checked' : ''}>
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                            <div class="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-8">
                                ${[
                { id: 'mod-agenda', label: 'Agenda Inteligente', checked: person?.modulos?.agenda !== false },
                { id: 'mod-programa', label: 'Cronograma de Salidas', checked: person?.modulos?.programa !== false },
                { id: 'mod-disponibilidad', label: 'Mi disponibilidad', checked: person?.modulos?.disponibilidad !== false },
                { id: 'mod-telefonos', label: 'Predicación Telefónica', checked: person?.modulos?.telefonos !== false },
                { id: 'mod-mapas', label: 'Explorador de Mapas', checked: person?.modulos?.mapas !== false },
                { id: 'mod-ayudas', label: 'Recursos del Ministerio', checked: person?.modulos?.ayudas !== false }
            ].map(mod => `
                                    <label class="flex items-center justify-between p-4 modern-card hover:border-indigo-500/30 transition-all cursor-pointer group">
                                        <span class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight group-hover:text-indigo-600">${mod.label}</span>
                                        <input type="checkbox" id="${mod.id}" class="p-mod-check w-5 h-5 accent-indigo-600" ${mod.checked ? 'checked' : ''}>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="shrink-0 p-6 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                    <button id="save-person" class="w-full bg-primary py-5 rounded-2xl text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all">
                        <i class="fas fa-save mr-2"></i> ${isEdit ? 'Guardar Cambios' : 'Crear Registro'}
                    </button>
                </div>
            </div>
        `, (modal) => {
            const genderSelect = modal.querySelector('#p-gender');
            const privsContainer = modal.querySelector('#privs-container');
            const saveBtn = modal.querySelector('#save-person');

            const syncConductorUI = () => {
                const isConductor = Array.from(privsContainer.querySelectorAll('.p-priv-check:checked')).some(cb => cb.value === 'Conductor');
                const availGrid = modal.querySelector('#p-avail-grid');
                const modulesSection = modal.querySelector('#p-modules-section');
                const modDisponibilidad = modal.querySelector('#mod-disponibilidad');
                const isModulesMasterEnabled = modal.querySelector('#p-mod-enabled')?.checked;
                const isModuleEnabled = modDisponibilidad?.checked;

                const headerAvail = modal.querySelector('#header-toggle-avail');
                const availContainer = headerAvail?.parentElement;

                if (!isConductor) {
                    if (availContainer) availContainer.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
                    if (availGrid) availGrid.classList.add('opacity-20', 'pointer-events-none', 'grayscale');
                } else {
                    if (availContainer) availContainer.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
                    const shouldBeLocked = !isModuleEnabled;
                    if (availGrid) {
                        availGrid.classList.toggle('opacity-20', shouldBeLocked);
                        availGrid.classList.toggle('pointer-events-none', shouldBeLocked);
                        availGrid.classList.toggle('grayscale', shouldBeLocked);
                    }
                }

                const modChecks = modulesSection ? modulesSection.querySelectorAll('.p-mod-check') : [];
                if (!isModulesMasterEnabled) {
                    if (modulesSection) modulesSection.classList.add('opacity-40');
                    modChecks.forEach(m => {
                        m.disabled = true;
                        m.closest('label').classList.add('pointer-events-none', 'opacity-60');
                    });
                } else {
                    if (modulesSection) modulesSection.classList.remove('opacity-40');
                    modChecks.forEach(m => {
                        m.disabled = false;
                        m.closest('label').classList.remove('pointer-events-none', 'opacity-60');
                    });
                }
            };

            const headerToggleAvail = modal.querySelector('#header-toggle-avail');
            if (headerToggleAvail) {
                headerToggleAvail.onclick = () => {
                    modal.querySelector('#p-avail-grid').classList.toggle('hidden');
                    const chevron = modal.querySelector('#avail-chevron');
                    if (chevron) chevron.classList.toggle('rotate-180');
                };
            }

            const updatePrivsList = () => {
                const gender = genderSelect.value;
                const malePrivs = ['Superintendente de Circuito', 'Anciano', 'Siervo ministerial', 'Conductor', 'Administrador'];
                const femalePrivs = ['Conductor', 'Administrador'];
                const currentPrivs = person?.privilegios || [];
                const list = gender === 'Hombre' ? malePrivs : femalePrivs;

                privsContainer.innerHTML = list.map(pr => `
                    <label class="flex items-center gap-3 bg-white dark:bg-white/5 px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-primary/50 cursor-pointer transition-all group shadow-sm active:scale-[0.98] relative">
                        <input type="checkbox" class="p-priv-check w-5 h-5 accent-primary cursor-pointer" value="${pr}" ${currentPrivs.includes(pr) ? 'checked' : ''}>
                        <span class="text-[10px] font-black text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200 uppercase tracking-widest">${pr}</span>
                    </label>
                `).join('');

                privsContainer.querySelectorAll('.p-priv-check').forEach(cb => {
                    cb.addEventListener('change', syncConductorUI);
                    if (cb.value === 'Administrador') {
                        cb.addEventListener('change', () => {
                            modal.querySelector('#p-email-container').classList.toggle('hidden', !cb.checked);
                        });
                    }
                });
                syncConductorUI();
            };

            genderSelect.addEventListener('change', updatePrivsList);
            updatePrivsList();

            modal.querySelector('#mod-disponibilidad').addEventListener('change', syncConductorUI);
            modal.querySelector('#p-mod-enabled').addEventListener('change', syncConductorUI);

            saveBtn.onclick = async () => {
                const original = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...';
                saveBtn.disabled = true;

                const data = {
                    nombre: modal.querySelector('#p-name').value.trim(),
                    telefono: modal.querySelector('#p-phone').value.trim(),
                    genero: modal.querySelector('#p-gender').value,
                    grupo: parseInt(modal.querySelector('#p-group').value),
                    es_conductor: Array.from(modal.querySelectorAll('.p-priv-check:checked')).some(cb => cb.value === 'Conductor'),
                    email: modal.querySelector('#p-email').value.trim().toLowerCase(),
                    privilegios: Array.from(modal.querySelectorAll('.p-priv-check:checked')).map(cb => cb.value),
                    disponibilidad: Array.from(modal.querySelectorAll('.p-priv-check:checked')).some(cb => cb.value === 'Conductor')
                        ? Array.from(modal.querySelectorAll('.p-avail-check:checked')).map(cb => cb.value) : [],
                    modulos: {
                        habilitado: modal.querySelector('#p-mod-enabled').checked,
                        agenda: modal.querySelector('#mod-agenda').checked,
                        programa: modal.querySelector('#mod-programa').checked,
                        disponibilidad: modal.querySelector('#mod-disponibilidad').checked,
                        telefonos: modal.querySelector('#mod-telefonos').checked,
                        mapas: modal.querySelector('#mod-mapas').checked,
                        ayudas: modal.querySelector('#mod-ayudas').checked,
                        rescue: modal.querySelector('#mod-agenda').checked
                    }
                };

                if (!data.nombre) {
                    showNotification("El nombre es obligatorio", "error");
                    saveBtn.innerHTML = original; saveBtn.disabled = false;
                    return;
                }

                try {
                    if (isEdit) await updatePublicador(person.id, data);
                    else await addPublicador(data);
                    showNotification("Personal actualizado");
                    modal.classList.add('hidden');
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                    saveBtn.innerHTML = original; saveBtn.disabled = false;
                }
            };
        }, 'max-w-2xl');
    };

    const openGroupsConfigModal = async () => {
        const { saveGroupsConfig } = await import('../../data/firestore-services.js');
        let localGroups = JSON.parse(JSON.stringify(groups));
        const personnel = publicadores;

        const renderGroupsList = (modal) => {
            const list = modal.querySelector('#groups-config-list');
            list.innerHTML = localGroups.map((g, idx) => `
                <div class="p-6 modern-card border-slate-100 dark:border-white/5 space-y-4 group/group-card relative">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <span class="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-black text-xs">#${g.id}</span>
                            <input type="text" value="${g.nombre}" onchange="window.updateGroupField(${idx}, 'nombre', this.value)" placeholder="Nombre del Grupo" class="bg-transparent border-b border-dashed border-slate-200 focus:border-indigo-500 outline-none font-black text-sm uppercase tracking-tight text-slate-800 dark:text-white">
                        </div>
                        <button onclick="window.removeGroup(${idx})" class="w-8 h-8 rounded-lg hover:bg-rose-500/10 text-slate-300 hover:text-rose-500 transition-all">
                            <i class="fas fa-trash-alt text-xs"></i>
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="space-y-1.5">
                            <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Lugar de Salida</label>
                            <input type="text" value="${g.casa_salida || ''}" onchange="window.updateGroupField(${idx}, 'casa_salida', this.value)" placeholder="Ej: Familia Barrera" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl p-3 text-[11px] font-bold outline-none focus:border-indigo-500/50">
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Superintendente</label>
                            <select onchange="window.updateGroupField(${idx}, 'lider', this.value)" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl p-3 text-[11px] font-bold outline-none focus:border-indigo-500/50 appearance-none">
                                <option value="">— Sin asignar —</option>
                                ${personnel.map(p => `<option value="${p.nombre}" ${g.lider === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Auxiliar</label>
                            <select onchange="window.updateGroupField(${idx}, 'asistente', this.value)" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl p-3 text-[11px] font-bold outline-none focus:border-indigo-500/50 appearance-none">
                                <option value="">— Sin asignar —</option>
                                ${personnel.map(p => `<option value="${p.nombre}" ${g.asistente === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            `).join('');
        };

        window.updateGroupField = (idx, field, val) => { localGroups[idx][field] = val; };
        window.removeGroup = (idx) => { localGroups.splice(idx, 1); renderGroupsList(document.getElementById('modal-container')); };

        showModal(`
            <div class="flex flex-col h-[85vh] bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-indigo-600 p-8 text-white relative">
                    <div class="absolute inset-0 bg-gradient-to-br from-indigo-500 to-primary/40 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex justify-between items-center">
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Configuración de Grupos</h3>
                            <p class="text-[10px] opacity-70 font-bold uppercase tracking-[0.2em]">Estructura de la Congregación</p>
                        </div>
                        <div class="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-2xl shadow-2xl border border-white/20">
                            <i class="fas fa-users-cog"></i>
                        </div>
                    </div>
                </header>
                <div class="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div id="groups-config-list" class="space-y-4"></div>
                    <button id="add-new-group-btn" class="w-full py-4 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500 hover:border-indigo-500/50 transition-all flex items-center justify-center gap-3">
                        <i class="fas fa-plus-circle"></i> Añadir Nuevo Grupo
                    </button>
                </div>
                <div class="shrink-0 p-6 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
                    <button id="save-groups-btn" class="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.99]">
                        Guardar Configuración
                    </button>
                </div>
            </div>
        `, (modal) => {
            renderGroupsList(modal);
            modal.querySelector('#add-new-group-btn').onclick = () => {
                const nextId = localGroups.length > 0 ? Math.max(...localGroups.map(g => g.id)) + 1 : 1;
                localGroups.push({ id: nextId, nombre: `Grupo ${nextId}`, lider: "", asistente: "", casa_salida: "" });
                renderGroupsList(modal);
            };
            modal.querySelector('#save-groups-btn').onclick = async () => {
                const btn = modal.querySelector('#save-groups-btn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
                await saveGroupsConfig(localGroups);
                showNotification("Configuración de grupos guardada");
                modal.classList.add('hidden');
            };
        }, 'max-w-3xl');
    };

    window.editPerson = (id) => openPersonModal(publicadores.find(x => x.id === id));
    window.deletePerson = (id) => showCustomConfirm("¿Eliminar este registro permanentemente?", async () => {
        await deletePublicador(id);
    });
};
