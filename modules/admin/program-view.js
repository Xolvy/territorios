import {
    getTerritorios, getConfiguracion, getPublicadores, getConductores,
    getProgramaSemanal, saveProgramaSemanal, getGroupsConfig, returnTerritorioMultiple,
    getHistorialReport, returnTerritorioParcial
} from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';
import { UIHelpers, showModal, showTerritorySelectionModal } from '../services/ui-helpers.js';

const { getMonday, formatDateId } = UIHelpers;

const formatGroups = (val) => {
    if (!val) return '—';
    let cleanVal = val.replace(/grupos?/gi, '').replace(/[:\s,]+$/, '').replace(/^[:\s,]+/, '').trim();
    if (!cleanVal) return '—';
    let parts = cleanVal.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) return cleanVal;
    const last = parts.pop();
    return parts.join(', ') + ' y ' + last;
};

const getFieldIcon = (field) => {
    const map = {
        'Lugar': 'fa-map-marker-alt',
        'Hora': 'fa-clock',
        'Conductor': 'fa-user-tie',
        'Auxiliar': 'fa-user',
        'Faceta': 'fa-tag',
        'Grupos': 'fa-users',
        'Territorio': 'fa-map'
    };
    return map[field] || 'fa-info-circle';
};

export const renderProgramaTab = async (container) => {
    const today = new Date();
    let currentWeekStart = getMonday(today);
    let programa = { dias: [] };
    let activeDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
    let activeTurns = new Set(['manana', 'tarde', 'noche', 'zoom']);

    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const [territorios, config, allPersonnel, historial] = await Promise.all([
        getTerritorios(), getConfiguracion(), getPublicadores(), getHistorialReport()
    ]);

    territorios.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));
    const activeConductors = allPersonnel.filter(p => p.es_conductor).sort((a, b) => a.nombre.localeCompare(b.nombre));

    const options = {
        Lugar: config.lugares || ['Salón del Reino'],
        Hora: config.horarios_programa || ['09:00', '15:00', '19:00'],
        Conductor: activeConductors.map(c => c.nombre),
        Auxiliar: activeConductors.map(p => p.nombre),
        Faceta: config.facetas || ['Casa en casa', 'Carritos'],
        Territorio: territorios.map(t => t.numero),
        Grupos: ['Todos', 'Grupos 1 y 5', 'Grupos 2 y 6', 'Grupos 3 y 4', ...Array.from({ length: 12 }, (_, i) => `Grupo ${i + 1}`)]
    };

    container.innerHTML = `
        <div class="max-w-[1700px] mx-auto space-y-6 md:space-y-8 animate-fade-in p-2 md:p-6">
            <header class="flex flex-col xl:flex-row items-center justify-between gap-6">
                <div class="flex items-center gap-5">
                    <div class="w-14 h-14 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl flex items-center justify-center text-2xl text-white shadow-xl shadow-primary/20">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-0.5 uppercase tracking-tighter">Programa Semanal</h3>
                        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Planificación de salidas de campo</p>
                    </div>
                </div>
                
                <div class="flex flex-wrap items-center justify-center gap-3 w-full xl:w-auto">
                    <div class="flex items-center bg-slate-100 dark:bg-white/5 rounded-2xl p-1 border border-slate-200 dark:border-white/5 shadow-inner">
                         <button id="prev-week" class="p-4 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-primary">
                            <i class="fas fa-chevron-left"></i>
                         </button>
                         <div class="px-8 py-2 min-w-[200px] text-center">
                             <span id="week-range-label" class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Cargando...</span>
                         </div>
                         <button id="next-week" class="p-4 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-primary">
                            <i class="fas fa-chevron-right"></i>
                         </button>
                    </div>

                    <div class="flex gap-2">
                        <button id="btn-sync-all-prog" class="flex items-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95 group">
                            <i class="fas fa-project-diagram group-hover:rotate-12 transition-transform"></i>
                            Formalizar Asignaciones
                        </button>

                        <button id="btn-reset-today" class="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-6 py-4 rounded-xl font-black hover:bg-slate-50 transition-all text-[10px] uppercase tracking-widest">Hoy</button>
                        <button id="btn-reception-prog" class="flex items-center gap-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-rose-500 px-6 py-4 rounded-xl font-black hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all text-[10px] uppercase tracking-widest group" title="Recibir territorios finalizados">
                            <i class="fas fa-file-import group-hover:-translate-x-1 transition-transform"></i>
                            Recepción
                        </button>
                         <button id="btn-resync-prog" class="p-4 bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-white rounded-xl transition-all shadow-lg shadow-primary/5" title="Sincronizar">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>
            </header>

            <div id="day-selector-container" class="flex flex-wrap items-center justify-center gap-2 mt-8 animate-fade-in"></div>

            <div class="relative group min-h-[500px]">
                <div id="prog-loading-overlay" class="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-50 backdrop-blur-sm flex items-center justify-center hidden rounded-[2.5rem]">
                     <div class="flex flex-col items-center gap-4">
                        <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <p class="text-[10px] font-black uppercase text-primary tracking-widest animate-pulse">Sincronizando...</p>
                     </div>
                </div>
                
                <div class="modern-card !p-0 overflow-x-auto custom-scrollbar border border-slate-200 dark:border-white/5 shadow-inner" id="admin-prog-table"></div>

                <div class="flex flex-col sm:flex-row justify-between items-center px-8 mt-6 gap-4">
                    <div class="flex items-center gap-6">
                        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                            <i class="fas fa-cloud-upload-alt text-emerald-500"></i> Autoguardado inteligente
                        </p>
                    </div>
                    <div id="turn-filters" class="flex items-center gap-2"></div>
                </div>
            </div>
        </div>
    `;

    const loadWeekData = async () => {
        const overlay = container.querySelector('#prog-loading-overlay');
        overlay?.classList.remove('hidden');

        try {
            const weekId = formatDateId(currentWeekStart);
            const data = await getProgramaSemanal(weekId);

            if (data && data.dias && data.dias.length > 0) {
                programa = data;
                // Sincronizar fechas por si acaso el documento tiene fechas desactualizadas
                programa.dias.forEach((dia, idx) => {
                    const expectedDate = new Date(currentWeekStart);
                    expectedDate.setDate(expectedDate.getDate() + idx);
                    dia.fecha = formatDateId(expectedDate);
                });
            } else {
                programa = {
                    id: weekId,
                    dias: dayNames.map((name, idx) => {
                        const dayDate = new Date(currentWeekStart);
                        dayDate.setDate(dayDate.getDate() + idx);
                        const turns = { manana: {}, tarde: {}, noche: {} };
                        if (name === 'Martes') turns.zoom = {};
                        return { nombre: name, fecha: formatDateId(dayDate), ...turns };
                    })
                };
            }

            const lblRange = container.querySelector('#week-range-label');
            if (lblRange) {
                const monday = currentWeekStart;
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                lblRange.innerText = `${monday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — ${sunday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`.toUpperCase();
            }

            renderDaySelector();
            renderFilters();
            renderTable();
        } catch (error) {
            console.error(error);
            showNotification("Error cargando programa", "error");
        } finally {
            overlay?.classList.add('hidden');
        }
    };

    const renderDaySelector = () => {
        const dayBar = container.querySelector('#day-selector-container');
        dayBar.innerHTML = `
            <div class="flex flex-wrap items-center justify-center gap-1.5 p-1.5 bg-slate-100 dark:bg-white/5 rounded-[2rem] border border-slate-200 dark:border-white/10">
                ${dayNames.map((n, i) => `
                    <button onclick="window.setActiveDay(${i})" 
                            class="relative px-5 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeDayIndex === i ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-slate-500 hover:text-primary hover:bg-white dark:hover:bg-white/10'}">
                        ${n}
                    </button>
                `).join('')}
                <div class="w-px h-6 bg-slate-200 dark:bg-white/10 mx-2"></div>
                <button onclick="window.setActiveDay(-1)" 
                        class="px-5 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeDayIndex === -1 ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xl' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}">
                    Ver Toda la Semana
                </button>
            </div>
        `;
    };



    const renderFilters = () => {
        const turnFilters = container.querySelector('#turn-filters');
        const turnosArr = [
            { id: 'manana', icon: 'fa-sun', label: 'Mañana', color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { id: 'tarde', icon: 'fa-cloud-sun', label: 'Tarde', color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { id: 'noche', icon: 'fa-moon', label: 'Noche', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { id: 'zoom', icon: 'fa-video', label: 'Zoom', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
        ];

        turnFilters.innerHTML = `
            <div class="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                ${turnosArr.map(t => {
            const isActive = activeTurns.has(t.id);
            return `
                        <button onclick="window.toggleTurnFilter('${t.id}')" 
                                class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[9px] font-black uppercase tracking-wider ${isActive ? t.bg + ' ' + t.color : 'text-slate-400 opacity-40 hover:opacity-100'}">
                            <i class="fas ${t.icon}"></i>
                            ${t.label}
                        </button>
                    `;
        }).join('')}
            </div>
        `;
    };

    const renderTable = async () => {
        // Refresh territories and personnel in memory to get up-to-date status and availability
        const [freshTerritorios, freshPersonnel] = await Promise.all([
            getTerritorios(), getPublicadores()
        ]);
        const territoryMap = freshTerritorios.reduce((acc, t) => { acc[t.numero] = t; return acc; }, {});
        const activeConductors = freshPersonnel.filter(p => p.es_conductor).sort((a, b) => a.nombre.localeCompare(b.nombre));

        const tableContainer = container.querySelector('#admin-prog-table');
        let html = `<div class="space-y-12 pb-20">`;
        programa.dias.forEach((dia, dayIndex) => {
            if (activeDayIndex !== -1 && activeDayIndex !== dayIndex) return;

            const isWeekend = dia.nombre === 'Sábado' || dia.nombre === 'Domingo';
            const turnos = [
                { id: 'manana', icon: 'fa-sun', label: 'Mañana', color: 'text-amber-500', bg: 'bg-amber-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', ...(isWeekend ? ['Grupos'] : []), 'Territorio'] },
                { id: 'tarde', icon: 'fa-cloud-sun', label: 'Tarde', color: 'text-orange-500', bg: 'bg-orange-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', ...(isWeekend ? ['Grupos'] : []), 'Territorio'] },
                { id: 'noche', icon: 'fa-moon', label: 'Noche', color: 'text-indigo-500', bg: 'bg-indigo-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', ...(isWeekend ? ['Grupos'] : []), 'Territorio'] },
                { id: 'zoom', icon: 'fa-video', label: 'Zoom', color: 'text-emerald-500', bg: 'bg-emerald-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Faceta'] }
            ];

            html += `
                <div class="day-group animate-fade-in px-4 md:px-8 ${activeDayIndex === -1 && dayIndex > 0 ? 'mt-20 md:mt-32' : 'mt-6 md:mt-10'}">
                    <div class="flex items-center gap-8 mb-12">
                        <div class="flex flex-col">
                            <h4 class="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">${dia.nombre}</h4>
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 ml-1 opacity-60">${dia.fecha}</p>
                        </div>
                        <div class="h-0.5 flex-1 bg-gradient-to-r from-primary/30 to-transparent rounded-full opacity-30"></div>
                    </div>

                    <div class="flex flex-wrap gap-4 md:gap-8">
            `;

            turnos.forEach(t => {
                const turnoId = t.id;
                if (turnoId === 'zoom' && dia.nombre !== 'Martes') return;
                if (!activeTurns.has(turnoId)) return;

                const data = dia[turnoId] || {};

                html += `
                    <div class="flex-1 min-w-[280px] max-w-full lg:max-w-[400px] modern-card !p-4 md:!p-8 border-slate-100 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all group/turn relative">
                        <div class="flex items-center gap-4 mb-8">
                            <div class="w-12 h-12 ${t.bg} ${t.color} rounded-2xl flex items-center justify-center text-lg shadow-inner group-hover/turn:scale-110 transition-transform duration-500">
                                <i class="fas ${t.icon}"></i>
                            </div>
                            <span class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block mb-0.5">${t.label}</span>
                        </div>

                        <div class="space-y-4 md:space-y-6">
                `;

                t.fields.forEach(field => {
                    const fieldId = field.toLowerCase();
                    const val = data[fieldId] || '';
                    const icon = getFieldIcon(field);
                    const opts = options[field] || [];

                    html += `<div class="space-y-1.5">`;

                    if (field === 'Territorio') {
                        const tInfo = territoryMap[val];
                        const isAssigned = tInfo && tInfo.estado === 'Asignado';
                        const isSync = isAssigned && tInfo.asignado_a === dia[turnoId].conductor;
                        const isConflict = isAssigned && tInfo.asignado_a !== dia[turnoId].conductor;

                        html += `
                            <label class="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center justify-between">
                                <span><i class="fas fa-map-marked-alt opacity-30"></i> ${field}</span>
                                <div id="status-badge-${dayIndex}-${turnoId}">
                                    ${val ? (isSync ?
                                '<span class="text-emerald-500 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> LISTO</span>' :
                                (isConflict ?
                                    '<span class="text-rose-500 font-bold flex items-center gap-1" title="Ocupado por otro publicador"><i class="fas fa-exclamation-triangle"></i> OCUPADO</span>' :
                                    `<span class="text-primary font-bold flex items-center gap-1 cursor-pointer hover:underline" onclick="window.syncAssignmentFromProg(${dayIndex}, '${turnoId}')"><i class="fas fa-link animate-pulse"></i> ASIGNAR</span>`)) : ''}
                                </div>
                            </label>
                            <button onclick="window.openTerritorySelector(${dayIndex}, '${turnoId}', this)" 
                                    class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5 rounded-2xl hover:border-primary transition-all flex items-center justify-between shadow-sm">
                                <span id="val-territorio-${dayIndex}-${turnoId}" class="text-[11px] font-black truncate ${val ? 'text-primary' : 'text-slate-400 opacity-40'}">${val || '—'}</span>
                            </button>`;
                    } else if (field === 'Grupos') {
                        html += `
                            <label class="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                                <i class="fas fa-users opacity-30"></i> ${field}
                            </label>
                            <button onclick="window.openGroupSelector(${dayIndex}, '${turnoId}', this)" 
                                    class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5 rounded-2xl hover:border-indigo-500 transition-all flex items-center justify-between shadow-sm">
                                <span id="val-grupos-${dayIndex}-${turnoId}" class="text-[11px] font-black truncate ${val ? 'text-indigo-500' : 'text-slate-400 opacity-40'}">
                                    ${formatGroups(val)}
                                </span>
                            </button>`;
                    } else {
                        let finalOpts = opts;
                        if (field === 'Conductor' || field === 'Auxiliar') {
                            const availKey = `${dia.nombre}_${turnoId}`;
                            const available = activeConductors.filter(c => c.disponibilidad && c.disponibilidad.includes(availKey));
                            const nonAvailable = activeConductors.filter(c => !c.disponibilidad || !c.disponibilidad.includes(availKey));

                            finalOpts = [
                                ...available.map(c => ({ name: c.nombre, isAvail: true })),
                                ...nonAvailable.map(c => ({ name: c.nombre, isAvail: false }))
                            ];

                            html += `
                                <label class="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                                    <i class="fas ${icon} opacity-30"></i> ${field}
                                </label>
                                <div class="relative">
                                    <select onchange="window.updateWeekData(${dayIndex}, '${turnoId}', '${fieldId}', this.value)" 
                                            class="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white outline-none focus:border-primary appearance-none cursor-pointer shadow-sm transition-all focus:ring-1 focus:ring-primary/20">
                                        <option value="">—</option>
                                        ${finalOpts.map(o => `<option value="${o.name}" ${val === o.name ? 'selected' : ''} class="${o.isAvail ? 'text-emerald-500 font-bold' : ''}">
                                            ${o.isAvail ? '✅ ' : ''}${o.name}
                                        </option>`).join('')}
                                    </select>
                                    <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[9px] opacity-20 pointer-events-none"></i>
                                </div>`;
                        } else {
                            html += `
                                <label class="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                                    <i class="fas ${icon} opacity-30"></i> ${field}
                                </label>
                                <div class="relative">
                                    <select onchange="window.updateWeekData(${dayIndex}, '${turnoId}', '${fieldId}', this.value)" 
                                            class="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white outline-none focus:border-primary appearance-none cursor-pointer shadow-sm transition-all focus:ring-1 focus:ring-primary/20">
                                        <option value="">—</option>
                                        ${opts.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
                                    </select>
                                    <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[9px] opacity-20 pointer-events-none"></i>
                                </div>`;
                        }
                    }
                    html += `</div>`;
                });

                html += `</div></div> `;
            });

            html += `</div></div> `;
        });

        html += `</div> `;
        tableContainer.innerHTML = html;
    };

    window.setActiveDay = (idx) => {
        activeDayIndex = idx;
        renderDaySelector();
        renderTable();
    };

    window.toggleTurnFilter = (id) => {
        if (activeTurns.has(id)) activeTurns.delete(id);
        else activeTurns.add(id);
        renderFilters();
        renderTable();
    };

    window.updateWeekData = async (dayIdx, turnoId, fieldId, val) => {
        // Optimistic update
        programa.dias[dayIdx][turnoId][fieldId] = val;

        // Update visual value if it was a custom selector (territorio)
        const valEl = container.querySelector(`#val-${fieldId}-${dayIdx}-${turnoId}`);
        if (valEl) {
            valEl.innerText = val || '—';
            valEl.className = `text-[11px] font-black truncate ${val ? 'text-primary' : 'text-slate-400 opacity-40'}`;
        }

        // Silent background save
        saveProgramaSemanal(programa.id, programa).catch(e => {
            console.error("Error background saving:", e);
            showNotification("Error al sincronizar cambio", "error");
        });

        // Update status badge if territory or conductor changed
        if (fieldId === 'territorio' || fieldId === 'conductor') {
            const badgeContainer = container.querySelector(`#status-badge-${dayIdx}-${turnoId}`);
            if (badgeContainer) {
                const tNums = String(programa.dias[dayIdx][turnoId].territorio).split(/[,;]/).map(n => n.trim()).filter(n => n);

                const statuses = tNums.map(num => {
                    const tInfo = freshT.find(t => t.numero === num);
                    const isAssigned = tInfo && tInfo.estado === 'Asignado';
                    const isSync = isAssigned && tInfo.asignado_a === programa.dias[dayIdx][turnoId].conductor;
                    const isConflict = isAssigned && tInfo.asignado_a !== programa.dias[dayIdx][turnoId].conductor;
                    return { isSync, isConflict, isAssigned };
                });

                const allSync = statuses.length > 0 && statuses.every(s => s.isSync);
                const anyConflict = statuses.some(s => s.isConflict);
                const allAssigned = statuses.length > 0 && statuses.every(s => s.isAssigned);
                const v = programa.dias[dayIdx][turnoId].territorio;

                badgeContainer.innerHTML = v ? (allSync ?
                    '<span class="text-emerald-500 font-bold flex items-center gap-1 animate-fade-in"><i class="fas fa-check-circle"></i> LISTO</span>' :
                    (anyConflict ?
                        '<span class="text-rose-500 font-bold flex items-center gap-1 animate-fade-in" title="Ocupado por otro publicador"><i class="fas fa-exclamation-triangle"></i> OCUPADO</span>' :
                        `<span class="text-primary font-bold flex items-center gap-1 cursor-pointer hover:underline animate-fade-in" onclick="window.syncAssignmentFromProg(${dayIdx}, '${turnoId}')"><i class="fas fa-link animate-pulse"></i> ASIGNAR</span>`)) : '';
            }
        }
    };

    window.syncAssignmentFromProg = async (dayIdx, turnoId) => {
        const dia = programa.dias[dayIdx];
        const data = dia[turnoId];
        const rawNum = data.territorio;
        const cond = data.conductor;

        if (!rawNum || !cond) return showNotification("Faltan datos en el programa para asignar", "warning");

        const tNums = String(rawNum).split(/[,;]/).map(n => n.trim()).filter(n => n);
        const freshT = await getTerritorios();
        const foundTs = tNums.map(num => freshT.find(t => t.numero === num)).filter(Boolean);

        if (foundTs.length === 0) return showNotification("Territorios no encontrados", "error");

        showModal(`
            <div class="p-8 space-y-10">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-3xl text-primary shadow-inner">
                        <i class="fas fa-link"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Formalizar Asignación</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Sincronización Inteligente de S-13</p>
                    </div>
                </header>

                <div class="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] border border-slate-200 dark:border-white/10 space-y-4">
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-400 font-bold uppercase tracking-widest">Publicador</span>
                        <span class="font-black text-slate-800 dark:text-white uppercase">${cond}</span>
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-400 font-bold uppercase tracking-widest">Territorios</span>
                        <div class="flex gap-2">
                            ${foundTs.map(t => `<span class="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg">#${t.numero}</span>`).join('')}
                        </div>
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-400 font-bold uppercase tracking-widest">Salida Programada</span>
                        <span class="font-black text-slate-600 dark:text-gray-300 uppercase">${dia.nombre} (${dia.fecha})</span>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">¿Cuándo se asignó físicamente?</label>
                        <span class="text-[9px] font-bold text-primary uppercase bg-primary/5 px-2 py-0.5 rounded">Sugerencia S-13: Domingo anterior</span>
                    </div>
                    <input type="date" id="sync-asig-date" value="${(() => {
                const d = new Date(currentWeekStart);
                d.setDate(d.getDate() - 1);
                return d.toISOString().split('T')[0];
            })()}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[14px] font-black text-primary outline-none focus:border-primary transition-all uppercase shadow-inner">
                </div>

                <div class="flex gap-4 pt-6 border-t border-slate-50 dark:border-white/5">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
                    <button id="confirm-sync-asig" class="flex-[2] py-5 bg-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">ASIGNAR FORMALMENTE</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#confirm-sync-asig').onclick = async (e) => {
                const date = modal.querySelector('#sync-asig-date').value;
                if (!date) return;

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

                const { assignTerritorio } = await import('../../data/firestore-services.js');

                for (const t of foundTs) {
                    await assignTerritorio(t.id, cond, {
                        fecha_asignacion: new Date(date + 'T12:00:00Z').toISOString(),
                        lugar: data.lugar || null,
                        hora: data.hora || null,
                        faceta: data.faceta || null,
                        turnoId
                    });
                }

                showNotification(`¡Asignación formalizada! (${foundTs.length} territorios)`, 'success');
                modal.classList.add('hidden');

                // Refresh data and table
                const updatedT = await getTerritorios();
                territorios.length = 0;
                territorios.push(...updatedT);
                renderTable();
            };
        });
    };

    window.openTerritorySelector = (dayIdx, turnoId, btn) => {
        // Mostramos todos los territorios en el selector para evitar que aparezca vacío
        // El modal ya indica visualmente cuáles están disponibles o saturados
        showTerritorySelectionModal(btn.dataset.current || '', territorios, (res) => {
            window.updateWeekData(dayIdx, turnoId, 'territorio', res);
        }, 'modal-container-nested', historial);
    };

    window.openGroupSelector = async (dayIdx, turnoId, btn) => {
        const groups = await getGroupsConfig();
        const current = btn.querySelector('span').innerText.trim() || '—';

        showModal(`
            <div class="p-8 space-y-8">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-3xl text-indigo-500 shadow-inner">
                        <i class="fas fa-users"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Asignar Grupos</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Configuración del Salida</p>
                    </div>
                </header>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    <button onclick="window.setProgramGroup(${dayIdx}, '${turnoId}', 'Todos')" class="p-5 modern-card border-slate-100 dark:border-white/5 hover:border-indigo-500 transition-all text-left group">
                        <p class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Todos los Grupos</p>
                        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Salida General</p>
                    </button>
                    ${groups.map(g => `
                        <button onclick="window.setProgramGroup(${dayIdx}, '${turnoId}', '${g.nombre}')" class="p-5 modern-card border-slate-100 dark:border-white/5 hover:border-indigo-500 transition-all text-left group">
                            <p class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">${g.nombre}</p>
                            <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">${g.casa_salida || 'Sin lugar fojo'}</p>
                        </button>
                    `).join('')}
                </div>

                <div class="pt-6 border-t border-slate-50 dark:border-white/5 flex gap-4">
                    <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cerrar</button>
                </div>
            </div>
        `);
    };

    window.setProgramGroup = (dayIdx, turnoId, val) => {
        window.updateWeekData(dayIdx, turnoId, 'grupos', val);
        document.getElementById('modal-container').classList.add('hidden');
    };

    container.querySelector('#prev-week').onclick = () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        loadWeekData();
    };

    container.querySelector('#next-week').onclick = () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        loadWeekData();
    };

    container.querySelector('#btn-resync-prog').onclick = loadWeekData;

    container.querySelector('#btn-reset-today').onclick = () => {
        currentWeekStart = getMonday(new Date());
        loadWeekData();
    };

    container.querySelector('#btn-reception-prog').onclick = async () => {
        // Filter by currently viewed week
        const monday = new Date(currentWeekStart);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 7);

        const assigned = territorios.filter(t => {
            if (t.estado !== 'Asignado' || !t.fecha_asignacion) return false;
            const d = new Date(t.fecha_asignacion);
            return d >= monday && d < sunday;
        });

        if (assigned.length === 0) return showNotification("No hay territorios asignados en la semana seleccionada", "info");

        showModal(`
            <div class="flex flex-col h-full max-h-[85vh] w-full max-w-xl mx-auto">
                <header class="p-6 pb-2 shrink-0 border-b border-slate-50 dark:border-white/5">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-2xl text-rose-500 shadow-inner">
                            <i class="fas fa-file-import"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none">Recepción Manual</h3>
                            <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Devolver territorios</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto px-6 space-y-4 custom-scrollbar py-4">
                    <div class="flex justify-between items-center">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Registros de esta semana:</p>
                        <button id="reception-select-all" class="px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all border border-slate-200/50">Seleccionar Todos</button>
                    </div>

                    <div id="bulk-reception-list" class="space-y-2">
                        ${assigned.map(t => `
                            <div class="flex items-center gap-2 group">
                                <label class="flex-1 flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]">
                                    <input type="checkbox" class="reception-check w-5 h-5 rounded accent-rose-500 shrink-0" value="${t.id}" checked>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-[11px] font-black text-slate-800 dark:text-white uppercase truncate">#${t.numero} • ${t.asignado_a}</p>
                                        <div class="flex items-center gap-2 mt-1">
                                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest">${UIHelpers.fmtDateAt(t.fecha_asignacion)}</span>
                                            ${t.faceta ? `<span class="text-[7px] font-black text-primary uppercase px-1.5 py-0.5 bg-primary/10 rounded">${t.faceta}</span>` : ''}
                                        </div>
                                    </div>
                                </label>
                                <button onclick="window.openPartialReception('${t.id}')" class="w-12 h-12 flex items-center justify-center bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm shrink-0" title="Devolución Parcial">
                                    <i class="fas fa-scissors text-xs"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>

                <div class="space-y-4">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha de Entrega/Devolución</label>
                    <input type="date" id="reception-global-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[14px] font-black text-rose-500 outline-none focus:border-rose-500 transition-all uppercase shadow-inner">
                </div>

                <div class="pt-6 border-t border-slate-50 dark:border-white/5 flex gap-4">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
                    <button id="confirm-bulk-reception" class="flex-[2] py-5 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 transition-transform active:scale-95">
                        <i class="fas fa-check-circle"></i> Confirmar Devolución
                    </button>
                </div>
            </div>
        `, (modal) => {
            let allSelected = false;
            modal.querySelector('#reception-select-all').onclick = () => {
                allSelected = !allSelected;
                modal.querySelectorAll('.reception-check').forEach(cb => cb.checked = allSelected);
                modal.querySelector('#reception-select-all').innerText = allSelected ? 'Deseleccionar' : 'Seleccionar Todos';
            };

            modal.querySelector('#confirm-bulk-reception').onclick = async (e) => {
                const checked = Array.from(modal.querySelectorAll('.reception-check:checked')).map(cb => cb.value);
                if (checked.length === 0) return showNotification("Seleccione al menos un territorio", "warning");

                const dateInput = modal.querySelector('#reception-global-date');
                const date = dateInput.value;
                if (!date) return;

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

                await returnTerritorioMultiple(checked, "Recepción desde Programa", new Date(date + 'T12:00:00Z').toISOString(), "Completado");

                showNotification(`Se recibieron ${checked.length} territorios`);
                modal.classList.add('hidden');

                // Actualizar datos locales
                const updatedT = await getTerritorios();
                territorios.length = 0;
                territorios.push(...updatedT);
                renderTable();
            };
        });
    };

    container.querySelector('#btn-sync-all-prog').onclick = async () => {
        // Collect all planned assignments that are not sync
        const freshTerritorios = await getTerritorios();
        const territoryMap = freshTerritorios.reduce((acc, t) => { acc[t.numero] = t; return acc; }, {});

        const toSync = [];
        programa.dias.forEach((dia, dayIdx) => {
            ['manana', 'tarde', 'noche', 'zoom'].forEach(turnoId => {
                const data = dia[turnoId];
                if (data && data.territorio) {
                    // Split by comma or semicolon and normalize
                    const tNums = String(data.territorio).split(/[,;]/).map(n => n.trim()).filter(n => n);

                    tNums.forEach(tNum => {
                        const tInfo = territoryMap[tNum] || null;
                        toSync.push({ dayIdx, turnoId, dia, data, tInfo, specificT: tNum });
                    });
                }
            });
        });

        if (toSync.length === 0) return showNotification("No hay asignaciones programadas para formalizar", "info");

        showModal(`
            <div class="flex flex-col max-h-[80vh] p-6 space-y-4">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-3xl text-emerald-500 shadow-inner">
                        <i class="fas fa-project-diagram"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Formalización Masiva</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Procesar semana actual</p>
                    </div>
                </header>

                <div class="flex justify-between items-center mt-4">
                    <p class="text-[11px] font-bold text-slate-500 uppercase px-1">Seleccione las asignaciones:</p>
                    <button id="sync-select-all" class="px-6 py-3 bg-slate-100 dark:bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-primary transition-all border border-slate-200/50">Deseleccionar Todo</button>
                </div>
                <div class="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                        ${toSync.map((item, idx) => {
            const isSync = item.tInfo && item.tInfo.estado === 'Asignado' && item.tInfo.asignado_a === item.data.conductor;
            const exists = !!item.tInfo;
            const hasConductor = !!item.data.conductor;
            const canSync = exists && hasConductor;

            return `
                        <label class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border ${isSync ? 'border-emerald-500/10 opacity-70' : (canSync ? 'border-slate-100 dark:border-white/5' : 'border-amber-500/30')} flex items-center justify-between group cursor-pointer hover:bg-white dark:hover:bg-white/5 transition-all">
                            <div class="flex items-center gap-3">
                                <input type="checkbox" class="sync-check w-4 h-4 rounded accent-emerald-500" value="${idx}" ${canSync && !isSync ? 'checked' : ''} ${!canSync ? 'disabled' : ''}>
                                <div class="w-8 h-8 ${exists ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500'} flex items-center justify-center rounded-lg font-black text-[10px] shrink-0">${item.specificT}</div>
                                <div class="flex flex-col">
                                    <span class="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-tight">${item.data.conductor || 'Sin Conductor'}</span>
                                    <div class="flex items-center gap-2">
                                        <span class="text-[7px] font-bold text-slate-400 uppercase tracking-widest">${item.dia.nombre}</span>
                                        ${isSync ? '<span class="text-[7px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-1 py-0.5 rounded">Listo</span>' : ''}
                                        ${!exists ? '<span class="text-[7px] font-black text-amber-500 uppercase bg-amber-500/10 px-1 py-0.5 rounded">No en Inventario</span>' : ''}
                                        ${exists && !hasConductor ? '<span class="text-[7px] font-black text-amber-500 uppercase bg-amber-500/10 px-1 py-0.5 rounded">Falta Conductor</span>' : ''}
                                    </div>
                                </div>
                            </div>
                            <i class="fas ${isSync ? 'fa-check-circle text-emerald-500/30' : (canSync ? 'fa-arrow-right text-slate-200' : 'fa-exclamation-triangle text-amber-500')} text-[10px]"></i>
                        </label>
                    `}).join('')}
                </div>

                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha Global de Asignación</label>
                        <span class="text-[9px] font-bold text-emerald-500 uppercase bg-emerald-500/5 px-2 py-0.5 rounded">Recomendado: Domingo anterior</span>
                    </div>
                    <input type="date" id="sync-all-date" value="${(() => {
                const d = new Date(currentWeekStart);
                d.setDate(d.getDate() - 1);
                // Local date string YYYY-MM-DD
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            })()}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[14px] font-black text-primary outline-none focus:border-primary transition-all uppercase shadow-inner">
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-tight ml-1 leading-relaxed">
                        Esta fecha se usará para el registro histórico (S-13). Por defecto hemos seleccionado el Domingo anterior al inicio de esta semana (${(() => {
                const d = new Date(currentWeekStart);
                d.setDate(d.getDate() - 1);
                return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' });
            })()}).
                    </p>
                </div>

                 <div class="flex gap-4 pt-4 border-t border-slate-50 dark:border-white/5 shrink-0">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-4 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-lg text-[10px] uppercase tracking-widest">Cerrar</button>
                    <button id="confirm-sync-all" class="flex-[2] py-4 bg-emerald-500 text-white font-black rounded-lg text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all">Formalizar Selección</button>
                </div>
            </div>
        `, (modal) => {
            let syncSelected = true;
            modal.querySelector('#sync-select-all').onclick = () => {
                syncSelected = !syncSelected;
                modal.querySelectorAll('.sync-check').forEach(cb => cb.checked = syncSelected);
                modal.querySelector('#sync-select-all').innerText = syncSelected ? 'Deseleccionar Todo' : 'Seleccionar Todo';
            };

            modal.querySelector('#confirm-sync-all').onclick = async (e) => {
                const checkedIdxs = Array.from(modal.querySelectorAll('.sync-check:checked')).map(cb => parseInt(cb.value));
                if (checkedIdxs.length === 0) return showNotification("Seleccione al menos una asignación", "warning");

                const date = modal.querySelector('#sync-all-date').value;
                if (!date) return;

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

                const { assignTerritorio } = await import('../../data/firestore-services.js');
                showNotification(`Formalizando ${checkedIdxs.length} asignaciones...`, 'info');

                for (const idx of checkedIdxs) {
                    const item = toSync[idx];
                    if (!item.tInfo || !item.data.conductor) {
                        console.warn(`Skipping invalid item: ${item.data.territorio}`);
                        continue;
                    }
                    await assignTerritorio(item.tInfo.id, item.data.conductor, {
                        fecha_asignacion: new Date(date + 'T12:00:00Z').toISOString(),
                        lugar: item.data.lugar || null,
                        hora: item.data.hora || null,
                        faceta: item.data.faceta || null,
                        turno: item.turnoId
                    });
                }

                showNotification(`¡${checkedIdxs.length} asignaciones formalizadas con éxito!`, 'success');
                modal.classList.add('hidden');
                loadWeekData();
            };
        });
    };

    window.openPartialReception = async (id) => {
        const t = territorios.find(x => x.id === id);
        if (!t) return;

        const apples = t.manzanas ? t.manzanas.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (apples.length <= 1) {
            return showNotification("El territorio no tiene múltiples manzanas para dividir. Use recepción total.", "warning");
        }

        showModal(`
            <div class="p-8 space-y-8 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] max-w-lg">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-amber-500/10 rounded-3xl flex items-center justify-center text-3xl text-amber-500 shadow-inner">
                        <i class="fas fa-scissors"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Devolución Parcial</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">#${t.numero} • ${t.asignado_a}</p>
                    </div>
                </header>

                <p class="text-[11px] font-bold text-slate-500 uppercase px-1">Seleccione las manzanas completadas:</p>
                <div class="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    ${apples.map(a => `
                        <label class="flex items-center gap-3 p-4 modern-card border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-all">
                            <input type="checkbox" class="apple-check w-5 h-5 rounded accent-amber-500" value="${a}">
                            <span class="text-xs font-black text-slate-700 dark:text-white">${a}</span>
                        </label>
                    `).join('')}
                </div>

                <div class="space-y-4">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Acción con el resto</label>
                    <select id="partial-unassign" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-white outline-none">
                        <option value="true">Devolver resto al inventario</option>
                        <option value="false">Mantener resto asignado a ${t.asignado_a}</option>
                    </select>
                </div>

                <div class="pt-6 border-t border-slate-50 dark:border-white/5 flex gap-4">
                    <button id="cancel-partial" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
                    <button id="confirm-partial" class="flex-[2] py-5 bg-amber-500 hover:bg-amber-400 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-amber-500/20 active:scale-95 transition-all">PROCESAR DEVOLUCIÓN</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#cancel-partial').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#confirm-partial').onclick = async (e) => {
                const checked = Array.from(modal.querySelectorAll('.apple-check:checked')).map(cb => cb.value);
                if (checked.length === 0) return showNotification("Seleccione al menos una manzana", "warning");

                const unassign = modal.querySelector('#partial-unassign').value === 'true';
                const remaining = apples.filter(a => !checked.includes(a));

                if (remaining.length === 0 && !unassign) {
                    return showNotification("Si devuelve todas las manzanas, no puede mantener el resto asignado.", "warning");
                }

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

                try {
                    await returnTerritorioParcial(t.id, checked, remaining, unassign, "Devolución parcial desde Programa", new Date().toISOString());
                    showNotification(`Se devolvieron ${checked.length} manzanas.`);
                    modal.classList.add('hidden');
                    document.getElementById('modal-container').classList.add('hidden'); // Close reception modal too
                    renderTable(); // Update program view
                } catch (err) {
                    console.error(err);
                    showNotification("Error procesando devolución parcial", "error");
                    btn.disabled = false;
                    btn.innerHTML = 'PROCESAR DEVOLUCIÓN';
                }
            };
        }, 'max-w-lg', 'modal-container-nested');
    };

    await loadWeekData();
};
