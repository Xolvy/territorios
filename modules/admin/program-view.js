import {
    getTerritorios, getConfiguracion, getPublicadores,
    getProgramaSemanal, saveProgramaSemanal, getGroupsConfig, returnTerritorioMultiple,
    getHistorialReport, returnTerritorioParcial, startLivePool,
    returnTerritorio, syncSlotWithTerritories
} from '../../data/firestore-services.js';
import { showNotification, formatGroups, getBaseTerritoryNumber, normalize } from '../utils/helpers.js';
import { UIHelpers, showModal, showTerritorySelectionModal, showCustomConfirm } from '../services/ui-helpers.js';
import { generateProgramPNG } from './program-generator.js';
import { where } from "firebase/firestore";

const { getMonday, formatDateId } = UIHelpers;

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

const getEffectiveShiftId = (turnoId, horaStr) => {
    if (turnoId === 'zoom') return 'zoom';
    if (!horaStr || horaStr === '—') return turnoId;

    let hours = -1;
    const time = horaStr.toLowerCase().trim();
    const match = time.match(/(\d{1,2})[:.]?(\d{0,2})?\s*(am|pm)?/);

    if (match) {
        hours = parseInt(match[1]);
        const ampm = match[3];
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
    }

    if (hours === -1) return turnoId;
    if (hours < 12) return 'manana';
    if (hours < 18) return 'tarde';
    return 'noche';
};

const getTurnoStyling = (turnoId, horaStr) => {
    const defaults = {
        manana: { label: 'Mañana', icon: 'fa-sun', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        tarde: { label: 'Tarde', icon: 'fa-cloud-sun', color: 'text-orange-500', bg: 'bg-orange-500/10' },
        noche: { label: 'Noche', icon: 'fa-moon', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        zoom: { label: 'Zoom', icon: 'fa-video', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
    };

    const effectiveId = getEffectiveShiftId(turnoId, horaStr);
    return defaults[effectiveId] || defaults.manana;
};

export const renderProgramaTab = async (container) => {
    const today = new Date();
    let currentWeekStart = getMonday(today);
    let programa = { dias: [] };
    let activeDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
    let activeTurns = new Set(['manana', 'tarde', 'noche', 'zoom']);
    let programUnsub = null;

    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const [rawTerritorios, config, allPersonnel, historial] = await Promise.all([
        getTerritorios(), getConfiguracion(), getPublicadores(), getHistorialReport()
    ]);

    // Xolvy Data Shield: Aggressive normalization & Ghost filtering
    const territorios = rawTerritorios
        .filter(t => {
            const hasNum = t.numero && normalize(t.numero).length > 0;
            if (!hasNum) console.warn(`🛡️ [Data Shield] Territory Ghost Record Filtered in Program: ${t.id}`);
            return hasNum;
        })
        .map(t => ({
            ...t,
            numero: normalize(t.numero),
            manzanas: String(t.manzanas || '').replace(/Salmo/gi, 'Mz.').trim()
        }))
        .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));

    const activeConductors = allPersonnel
        .filter(p => {
            const hasName = p.nombre && normalize(p.nombre).length > 0;
            return hasName && p.es_conductor;
        })
        .map(p => ({ ...p, nombre: normalize(p.nombre) }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Shared Robust Helpers
    const normalizeT = (val) => String(val || '').trim();
    const normalizeLower = (val) => normalizeT(val).toLowerCase();

    const getTStatus = (tNum, conductor, fechaISO, turno) => {
        const baseT = getBaseTerritoryNumber(tNum);
        const t = territorios.find(x => normalizeLower(x.numero) === normalizeLower(baseT));
        if (!t) return { isSync: false, isConflict: false, numero: tNum };
        if (t.estado !== 'Asignado') return { isSync: false, isConflict: false, numero: tNum };

        const dbDateKey = t.fecha_asignacion ? String(t.fecha_asignacion).split('T')[0] : null;
        const targetDateKey = fechaISO ? fechaISO.split('T')[0] : null;

        const nameMatch = normalizeLower(t.asignado_a) === normalizeLower(conductor);
        const dateMatch = dbDateKey === targetDateKey;
        const turnMatch = String(t.turno || '').toLowerCase() === String(turno || '').toLowerCase();

        const isSync = nameMatch && dateMatch && turnMatch;
        const isConflict = !isSync;

        return {
            isSync,
            isConflict,
            numero: tNum,
            details: {
                id: t.id,
                conductor: t.asignado_a,
                fecha: dbDateKey,
                turno: t.turno
            }
        };
    };

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
                         <button id="prev-week" class="p-4 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-primary active:scale-95">
                            <i class="fas fa-chevron-left"></i>
                         </button>
                         <div class="px-8 py-2 min-w-[200px] text-center">
                             <span id="week-range-label" class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Cargando...</span>
                         </div>
                         <button id="next-week" class="p-4 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-primary active:scale-95">
                            <i class="fas fa-chevron-right"></i>
                         </button>
                    </div>

                    <nav data-adaptive-wrap="true" class="flex flex-wrap items-center justify-center lg:justify-start gap-2 bg-slate-100/50 dark:bg-white/5 p-1.5 rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-sm w-full lg:w-max max-w-full">
                        <button id="btn-sync-all-prog" class="btn-pro flex items-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95 group shrink-0" title="Formalizar todas las asignaciones programadas">
                            <i class="fas fa-project-diagram group-hover:rotate-12 transition-transform"></i>
                            Formalizar
                        </button>

                        <button id="btn-reset-today" class="btn-pro bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-6 py-4 rounded-xl font-black hover:bg-slate-50 transition-all text-[10px] uppercase tracking-widest shrink-0">Hoy</button>
                        
                        <button id="btn-reception-prog" class="btn-pro flex items-center gap-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-rose-500 px-6 py-4 rounded-xl font-black hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all text-[10px] uppercase tracking-widest group shrink-0" title="Recibir territorios finalizados">
                            <i class="fas fa-file-import group-hover:-translate-x-1 transition-transform"></i>
                            Recepción
                        </button>
                        
                        <div class="h-4 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden lg:block"></div>

                        <button id="btn-copy-prev-week" class="btn-pro flex items-center gap-2 px-6 py-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/5 group shrink-0" title="Replicar estructura de la semana pasada">
                            <i class="fas fa-copy group-hover:scale-110 transition-transform"></i>
                            Replicar
                        </button>
                        
                        <div class="dropdown-container relative z-50">
                            <button id="btn-export-dropdown" class="btn-pro flex items-center gap-2 bg-emerald-500 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95 group shrink-0" title="Opciones de Exportación">
                                <i class="fas fa-file-export"></i>
                                Exportar
                                <i class="fas fa-chevron-down ml-1 text-[8px] opacity-70 group-hover:translate-y-0.5 transition-transform"></i>
                            </button>
                            <div id="export-menu-options" class="dropdown-content absolute right-0 min-w-[220px]">
                                <button id="btn-export-xls-prog">
                                    <i class="fas fa-file-excel text-emerald-500"></i>
                                    Programa Excel
                                </button>
                                <div class="h-px bg-slate-100 dark:bg-white/5 my-1"></div>
                                <button id="btn-export-png-cond-new">
                                    <i class="fas fa-user-tie text-indigo-500"></i>
                                    Formato Conductor
                                </button>
                                <button id="btn-export-png-pub-new">
                                    <i class="fas fa-users text-emerald-500"></i>
                                    Formato Publicador
                                </button>
                            </div>
                        </div>
                    </nav>


                </div>
            </header>

            <div id="day-selector-container" class="flex flex-wrap items-center justify-center gap-2 mt-8 animate-fade-in" data-adaptive-scroll="true"></div>

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

            // Xolvy Live Pool: Dynamic week synchronization
            if (programUnsub) { programUnsub(); programUnsub = null; }
            programUnsub = startLivePool("programa_semanal", [where("__name__", "==", weekId)], (data) => {
                if (data.length > 0) {
                    programa = data[0];
                    // Sync dates
                    programa.dias.forEach((dia, idx) => {
                        const expectedDate = new Date(currentWeekStart);
                        expectedDate.setDate(expectedDate.getDate() + idx);
                        dia.fecha = formatDateId(expectedDate);
                    });
                    console.log(`📅 [Live Pool] Week ${weekId} Updated.`);
                } else {
                    // Create dummy if doesn't exist to allow editing
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
                overlay?.classList.add('hidden');
            });
            // setAdminLivePool(programUnsub); // This line was removed as per the instruction's implied change.

        } catch (error) {
            console.error(error);
            showNotification("Error cargando programa", "error");
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

        // Update local territories cache
        territorios.length = 0;
        territorios.push(...freshTerritorios);

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

                    <div class="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 md:gap-8">
            `;

            turnos.forEach(t => {
                const turnoId = t.id;
                if (turnoId === 'zoom' && dia.nombre !== 'Martes') return;
                if (!activeTurns.has(turnoId)) return;

                const data = dia[turnoId] || {};
                const styling = getTurnoStyling(turnoId, data.hora);

                html += `
                    <div class="modern-card !p-4 md:!p-8 border-slate-100 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all group/turn relative">
                        <div class="flex items-center gap-4 mb-8">
                            <div class="w-12 h-12 ${styling.bg} ${styling.color} rounded-2xl flex items-center justify-center text-lg shadow-inner group-hover/turn:scale-110 transition-transform duration-500">
                                <i class="fas ${styling.icon}"></i>
                            </div>
                            <span class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block mb-0.5">${styling.label}</span>

                            <!-- Botón Limpiar -->
                            <button onclick="window.clearTurnData(${dayIndex}, '${turnoId}')" 
                                    class="absolute top-6 right-6 w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center text-[10px] opacity-0 group-hover/turn:opacity-100 shadow-sm border border-rose-500/20 active:scale-90"
                                    title="Limpiar datos del turno">
                                <i class="fas fa-trash-alt"></i>
                            </button>
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
                        const conductor = dia[turnoId].conductor;
                        html += `
                            <label class="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center justify-between">
                                <span><i class="fas fa-map-marked-alt opacity-30"></i> ${field}</span>
                                <div id="status-badge-${dayIndex}-${turnoId}">
                                    ${val ? (() => {
                                const results = Array.from(new Set(String(val).split(/[,;/]/).map(n => n.trim()).filter(Boolean))).map(n => getTStatus(n, conductor, dia.fecha, turnoId));
                                const allSync = results.every(r => r.isSync);
                                const conflict = results.find(r => r.isConflict);

                                if (allSync) {
                                    return `<button class="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all">
                                                <i class="fas fa-check-circle"></i> LISTO
                                            </button>`;
                                }

                                if (conflict && conflict.details) {
                                    return `<button onclick="window.showConflictDetails(${dayIndex}, '${turnoId}')" 
                                                    class="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-500 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-all animate-pulse shadow-lg shadow-rose-500/10">
                                                <i class="fas fa-exclamation-triangle"></i> OCUPADO
                                            </button>`;
                                }

                                return `<button onclick="window.syncAssignmentFromProg(${dayIndex}, '${turnoId}')" 
                                                class="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/10 group">
                                            <i class="fas fa-link group-hover:rotate-12 transition-transform"></i> ASIGNAR
                                        </button>`;
                            })() : ''}
                                </div>
                            </label>
                            <button onclick="window.openTerritorySelector(${dayIndex}, '${turnoId}', this)" 
                                    data-current="${val}"
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
                            const effectiveShiftId = getEffectiveShiftId(turnoId, data.hora);
                            const availKey = `${dia.nombre}_${effectiveShiftId}`;
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
            if (fieldId === 'territorio') {
                valEl.parentElement.dataset.current = val || '';
            }
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
                const dia = programa.dias[dayIdx];
                const v = dia[turnoId].territorio;
                const tNums = Array.from(new Set(String(v || '').split(/[,;/]/).map(n => n.trim()).filter(Boolean)));
                const conductor = dia[turnoId].conductor;

                const results = tNums.map(n => getTStatus(n, conductor, dia.fecha, turnoId));
                const allSync = results.every(r => r.isSync);
                const conflict = results.find(r => r.isConflict);

                if (!v) {
                    badgeContainer.innerHTML = '';
                    return;
                }

                if (allSync) {
                    badgeContainer.innerHTML = `<button class="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all">
                                                    <i class="fas fa-check-circle"></i> LISTO
                                                </button>`;
                } else if (conflict && conflict.details) {
                    badgeContainer.innerHTML = `<button onclick="window.showConflictDetails(${dayIdx}, '${turnoId}')" 
                                                        class="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-500 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-all animate-pulse shadow-lg shadow-rose-500/10">
                                                    <i class="fas fa-exclamation-triangle"></i> OCUPADO
                                                </button>`;
                } else {
                    badgeContainer.innerHTML = `<button onclick="window.syncAssignmentFromProg(${dayIdx}, '${turnoId}')" 
                                                        class="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/10 group">
                                                    <i class="fas fa-link group-hover:rotate-12 transition-transform"></i> ASIGNAR
                                                </button>`;
                }
            }
        }

        // Full re-render if time changed to update icon/label in header
        if (fieldId === 'hora') {
            renderTable();
        }
    };

    window.toggleTurnEnabled = async (dayIdx, turnoId) => {
        const dia = programa.dias[dayIdx];
        if (!dia[turnoId]) dia[turnoId] = {};

        dia[turnoId].enabled = !(dia[turnoId].enabled !== false);

        renderTable();
        saveProgramaSemanal(programa.id, programa).catch(e => console.error("Error toggling turn:", e));

        const action = dia[turnoId].enabled ? 'activada' : 'desactivada';
        showNotification(`Jornada ${action} con éxito`, 'info');
    };

    window.clearTurnData = async (dayIdx, turnoId) => {
        showCustomConfirm('¿Limpiar todos los datos de este turno?', async () => {
            programa.dias[dayIdx][turnoId] = {};

            try {
                showNotification("Limpiando turno...", "info");
                await saveProgramaSemanal(programa.id, programa);
                renderTable();
                showNotification("Datos del turno eliminados", "success");
            } catch (e) {
                console.error(e);
                showNotification("Error al limpiar datos", "error");
            }
        });
    };

    window.showConflictDetails = (dayIdx, turnoId) => {
        const dia = programa.dias[dayIdx];
        const data = dia[turnoId];
        const tNums = Array.from(new Set(String(data.territorio || '').split(/[,;/]/).map(n => n.trim()).filter(Boolean)));
        const conductor = data.conductor;
        const results = tNums.map(n => getTStatus(n, conductor, dia.fecha, turnoId));
        const conflicts = results.filter(r => r.isConflict);

        if (conflicts.length === 0) return;

        showModal(`
            <div class="p-8 space-y-8 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] max-w-lg border border-rose-500/20 animate-scale-in">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-rose-500/10 rounded-3xl flex items-center justify-center text-3xl text-rose-500 shadow-inner">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Conflicto detectado</h3>
                        <p class="text-[10px] text-rose-500 font-bold uppercase tracking-[0.3em] mt-1">S-13 ya tiene otras asignaciones</p>
                    </div>
                </header>

                <div class="space-y-4">
                    <p class="text-[11px] font-bold text-slate-500 uppercase px-1">Se han detectado los siguientes conflictos en el inventario:</p>
                    <div class="space-y-2">
                        ${conflicts.map(c => `
                            <div class="flex items-center justify-between p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10 transition-all hover:bg-rose-500/10">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 bg-rose-500 text-white flex items-center justify-center rounded-xl font-black text-xs shadow-lg shadow-rose-500/20">#${c.numero}</div>
                                    <div class="flex flex-col">
                                        <span class="text-xs font-black text-slate-800 dark:text-white uppercase leading-tight">${c.details.conductor}</span>
                                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">${UIHelpers.fmtDateAt(c.details.fecha)} • ${c.details.turno || 'Sin Turno'}</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 bg-rose-500/10 text-rose-500 text-[8px] font-black rounded-lg uppercase">Ocupado</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="p-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-slate-200 dark:border-white/10 relative overflow-hidden group">
                    <div class="absolute -right-4 -top-4 w-20 h-20 bg-rose-500/5 rotate-12 rounded-3xl group-hover:scale-110 transition-transform"></div>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i class="fas fa-shield-alt text-rose-500"></i> ¿Deseas corregir el S-13?
                    </p>
                    <p class="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                        Al <b>Forzar Asignación</b>, se liberarán inmediatamente estos territorios de sus poseedores actuales para asignarlos a <b>${conductor}</b> según este programa.
                    </p>
                </div>

                <div class="flex gap-4 pt-4 shrink-0">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Ignorar</button>
                    <button id="confirm-force-sync" class="flex-[2.5] py-5 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all group">
                        <i class="fas fa-bolt mr-2 group-hover:animate-bounce"></i> FORZAR ASIGNACIÓN
                    </button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#confirm-force-sync').onclick = async () => {
                modal.classList.add('hidden');
                await window.syncAssignmentFromProg(dayIdx, turnoId, true);
            };
        });
    };

    window.syncAssignmentFromProg = async (dayIdx, turnoId, force = false) => {
        const dia = programa.dias[dayIdx];
        const data = dia[turnoId];
        const rawNum = data.territorio;
        const cond = data.conductor;

        if (!rawNum || !cond) return showNotification("Faltan datos en el programa para asignar", "warning");

        const tNums = Array.from(new Set(String(rawNum).split(/[,;/]/).map(n => n.trim()).filter(Boolean)));
        const freshT = await getTerritorios();
        const foundTs = tNums.map(num => freshT.find(t => t.numero === num)).filter(Boolean);

        if (foundTs.length === 0) return showNotification("Territorios no encontrados", "error");

        if (force) {
            // Logic for force: Return conflicting territories first
            showNotification("Corrigiendo conflictos...", "info");
            const conflictTs = foundTs.filter(t => t.estado === 'Asignado');
            for (const t of conflictTs) {
                await returnTerritorio(t.id, "Liberación forzada por conflicto en programa semanal", new Date().toISOString(), 'Disponible');
            }
        }

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

                const assignmentDateISO = new Date(date + 'T12:00:00Z').toISOString();
                const preachingDateISO = new Date(dia.fecha + 'T12:00:00Z').toISOString();

                await syncSlotWithTerritories(programa.id, dayIdx, turnoId, {
                    ...data,
                    prog_sync: true
                }, preachingDateISO, assignmentDateISO);

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
        // Extract all territories already in this week's program to highlight them
        const weekAssignments = [];
        if (programa && programa.dias) {
            programa.dias.forEach(d => {
                ['manana', 'tarde', 'noche', 'zoom'].forEach(turn => {
                    const tStr = d[turn]?.territorio;
                    if (tStr) {
                        // Handle multiple territories like "1, 2(Mz 1), 3"
                        // Robust extraction: find numbers followed by start of parentheses or separators
                        const matches = tStr.matchAll(/(\d+)(?:\s*\(|$|[\s,;/])/g);
                        for (const match of matches) {
                            weekAssignments.push(match[1]);
                        }
                    }
                });
            });
        }

        showTerritorySelectionModal(btn.dataset.current || '', territorios, (res) => {
            window.updateWeekData(dayIdx, turnoId, 'territorio', res);
        }, 'modal-container-nested', historial, weekAssignments);
    };

    // Attach PNG & Share events (deferred until DOM binds)
    setTimeout(() => {
        const btnPngDropdown = container.querySelector('#btn-png-dropdown');
        const pngMenu = container.querySelector('#export-png-menu');

        const showProgramPreview = async (isConductores) => {
            const dataUrl = await generateProgramPNG(programa, isConductores);
            if (!dataUrl) return;

            showModal(`
                <div class="flex flex-col bg-white dark:bg-[#0a0f18] rounded-[2rem] overflow-hidden max-w-4xl w-full mx-auto shadow-2xl animate-scale-in">
                    <header class="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-indigo-500 text-white rounded-2xl flex items-center justify-center text-xl">
                                <i class="fas fa-image"></i>
                            </div>
                            <div>
                                <h3 class="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">Vista Previa</h3>
                                <p class="text-[9px] text-indigo-500 font-bold uppercase tracking-tighter">Programa de Predicación</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <button id="preview-share" class="w-10 h-10 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center justify-center shadow-lg shadow-emerald-500/20" title="Compartir">
                                <i class="fas fa-share-nodes"></i>
                            </button>
                            <button id="preview-download" class="w-10 h-10 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all flex items-center justify-center shadow-lg shadow-primary/20" title="Descargar">
                                <i class="fas fa-download"></i>
                            </button>
                            <button id="preview-print" class="w-10 h-10 rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition-all flex items-center justify-center shadow-lg shadow-slate-900/20" title="Imprimir">
                                <i class="fas fa-print"></i>
                            </button>
                            <div class="w-px h-6 bg-slate-200 dark:bg-white/10 mx-2"></div>
                            <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </header>

                    <div class="p-8 overflow-y-auto flex justify-center bg-slate-50 dark:bg-black/20">
                        <img src="${dataUrl}" class="max-w-full h-auto rounded-xl shadow-2xl border border-slate-200 dark:border-white/10">
                    </div>
                </div>
            `, async (modal) => {
                const startDay = programa.dias[0]?.fecha || '—';

                modal.querySelector('#preview-share').onclick = async () => {
                    const blob = await (await fetch(dataUrl)).blob();
                    const file = new File([blob], `Programa_${startDay}.png`, { type: 'image/png' });
                    if (navigator.share) {
                        await navigator.share({ files: [file], title: `Programa Semanal`, text: `Programa de la semana ${startDay}` });
                    }
                };

                modal.querySelector('#preview-download').onclick = async () => {
                    const { downloadImage } = await import('./program-generator.js');
                    downloadImage(dataUrl, isConductores, startDay);
                };

                modal.querySelector('#preview-print').onclick = () => {
                    const win = window.open("");
                    win.document.write(`<img src="${dataUrl}" style="width:100%" onload="window.print();window.close()">`);
                    win.document.close();
                };
            });
        };

        if (btnPngDropdown && pngMenu) {
            btnPngDropdown.onclick = (e) => {
                e.stopPropagation();
                pngMenu.classList.toggle('show');
            };

            document.addEventListener('click', () => {
                pngMenu.classList.remove('show');
            });

            const btnPngCond = container.querySelector('#btn-export-png-cond-new');
            if (btnPngCond) {
                btnPngCond.onclick = () => {
                    showProgramPreview(true);
                    pngMenu.classList.remove('show');
                };
            }

            const btnPngPub = container.querySelector('#btn-export-png-pub-new');
            if (btnPngPub) {
                btnPngPub.onclick = () => {
                    showProgramPreview(false);
                    pngMenu.classList.remove('show');
                };
            }
        }
    }, 100);

    window.openGroupSelector = async (dayIdx, turnoId) => {
        console.log("🛡️ [v2.4.1.9] Opening Multi-Group Selector...");
        const groups = await getGroupsConfig();
        const currentVal = programa.dias[dayIdx][turnoId].grupos || '';

        // Normalize: remove word "Grupo" if present to match keys
        const selected = new Set(currentVal.replace(/grupos?/gi, '').split(/[,;y&]+/).map(s => s.trim()).filter(Boolean));

        showModal(`
            <div class="flex flex-col max-h-[80vh] bg-white dark:bg-[#0a0f18] rounded-[2.5rem] border border-indigo-500/20 shadow-2xl overflow-hidden">
                <header class="p-8 pb-4 flex items-center gap-6 shrink-0">
                    <div class="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-3xl text-indigo-500 shadow-inner">
                        <i class="fas fa-check-double"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Seleccionar Grupos</h3>
                        <p class="text-[10px] text-indigo-500 font-bold uppercase tracking-[0.3em] mt-1 italic">Versión 2.4.1.9 • Selección Múltiple</p>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar px-8 py-2">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="group-selection-grid">
                        <label class="group-item p-5 modern-card border-slate-100 dark:border-white/5 hover:border-indigo-500 transition-all cursor-pointer flex items-center gap-4 ${selected.has('Todos') ? 'bg-indigo-500/5 border-indigo-500/50' : ''}">
                            <div class="relative w-6 h-6 shrink-0">
                                <input type="checkbox" class="group-checkbox absolute inset-0 opacity-0 cursor-pointer z-10" value="Todos" ${selected.has('Todos') ? 'checked' : ''}>
                                <div class="check-box-ui w-6 h-6 border-2 border-slate-200 dark:border-white/10 rounded-lg flex items-center justify-center transition-all ${selected.has('Todos') ? 'bg-indigo-500 border-indigo-500' : ''}">
                                    <i class="fas fa-check text-[10px] text-white ${selected.has('Todos') ? 'opacity-100' : 'opacity-0'} transition-opacity"></i>
                                </div>
                            </div>
                            <div class="flex-1">
                                <p class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Todos</p>
                                <p class="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Salida General</p>
                            </div>
                        </label>

                        ${groups.map(g => {
            const gNum = g.nombre.replace(/grupos?/gi, '').trim();
            const isSel = selected.has(gNum) || selected.has(g.nombre);
            return `
                            <label class="group-item p-5 modern-card border-slate-100 dark:border-white/5 hover:border-indigo-500 transition-all cursor-pointer flex items-center gap-4 ${isSel ? 'bg-indigo-500/5 border-indigo-500/50' : ''}">
                                <div class="relative w-6 h-6 shrink-0">
                                    <input type="checkbox" class="group-checkbox absolute inset-0 opacity-0 cursor-pointer z-10" value="${gNum}" ${isSel ? 'checked' : ''}>
                                    <div class="check-box-ui w-6 h-6 border-2 border-slate-200 dark:border-white/10 rounded-lg flex items-center justify-center transition-all ${isSel ? 'bg-indigo-500 border-indigo-500' : ''}">
                                        <i class="fas fa-check text-[10px] text-white ${isSel ? 'opacity-100' : 'opacity-0'} transition-opacity"></i>
                                    </div>
                                </div>
                                <div class="flex-1">
                                    <p class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">G. ${gNum}</p>
                                    <p class="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 truncate max-w-[120px]">${g.casa_salida || '—'}</p>
                                </div>
                            </label>
                        `;
        }).join('')}
                    </div>
                </div>

                <div class="p-8 pt-4 border-t border-slate-50 dark:border-white/5 flex gap-4 shrink-0">
                    <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
                    <button id="confirm-groups" class="flex-[2.5] py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">ASIGNAR SELECCIONADOS</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelectorAll('.group-checkbox').forEach(cb => {
                cb.onchange = (e) => {
                    const label = e.target.closest('.group-item');
                    const ui = label.querySelector('.check-box-ui');
                    const icon = ui.querySelector('i');

                    if (e.target.checked) {
                        label.classList.add('bg-indigo-500/5', 'border-indigo-500/50');
                        ui.classList.add('bg-indigo-600', 'border-indigo-600');
                        icon.classList.remove('opacity-0');
                    } else {
                        label.classList.remove('bg-indigo-500/5', 'border-indigo-500/50');
                        ui.classList.remove('bg-indigo-600', 'border-indigo-600');
                        icon.classList.add('opacity-0');
                    }
                };
            });

            modal.querySelector('#confirm-groups').onclick = () => {
                const checked = Array.from(modal.querySelectorAll('.group-checkbox:checked')).map(cb => cb.value);
                const rawVal = checked.includes('Todos') ? 'Todos' : checked.join(', ');
                const finalVal = formatGroups(rawVal);
                window.setProgramGroup(dayIdx, turnoId, finalVal);
                modal.classList.add('hidden');
            };
        });
    };

    window.setProgramGroup = (dayIdx, turnoId, val) => {
        window.updateWeekData(dayIdx, turnoId, 'grupos', val);
    };





    container.querySelector('#btn-reception-prog').onclick = async () => {
        // Show ALL assigned territories, regardless of the week, so users can return overdue ones
        const assigned = territorios.filter(t => t.estado === 'Asignado' && t.fecha_asignacion);

        if (assigned.length === 0) return showNotification("No hay territorios asignados para devolver", "info");

        let sortMode = 'territorio'; // 'territorio' | 'fecha'

        showModal(`
            <div class="flex flex-col h-full max-h-[85vh] w-full max-w-xl mx-auto">
                <header class="p-6 pb-2 shrink-0 border-b border-slate-50 dark:border-white/5">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-2xl text-rose-500 shadow-inner">
                                <i class="fas fa-file-import"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none">Recepción Manual</h3>
                                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Devolver territorios</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto px-6 space-y-4 custom-scrollbar py-4">
                    <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-black/20 p-3 rounded-2xl border border-slate-200/50 mb-2">
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2">Ordenar por:</span>
                            <button id="sort-by-terr" class="px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border border-transparent active-sort bg-primary text-white shadow-lg shadow-primary/20">Territorio</button>
                            <button id="sort-by-date" class="px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border border-slate-200/50 text-slate-500 hover:bg-white dark:hover:bg-white/10">Fecha</button>
                        </div>
                        <button id="reception-select-all" class="px-4 py-2 bg-white dark:bg-white/5 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all border border-slate-200/50 shadow-sm">Deseleccionar Todos</button>
                    </div>

                    <div id="bulk-reception-list" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <!-- List filled by script -->
                    </div>

                    <div class="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex items-center gap-4 group/toggle cursor-pointer" id="toggle-no-preached">
                         <div class="relative w-10 h-6 shrink-0">
                             <input type="checkbox" id="check-no-preached" class="absolute inset-0 opacity-0 cursor-pointer z-10">
                             <div class="toggle-bg w-10 h-6 bg-slate-200 dark:bg-slate-800 rounded-full transition-colors group-hover/toggle:bg-slate-300 dark:group-hover/toggle:bg-slate-700"></div>
                             <div class="toggle-dot absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm"></div>
                         </div>
                         <div class="flex-1">
                             <p class="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight leading-none mb-1">Devolver sin predicar</p>
                             <p class="text-[8px] font-bold text-slate-400 uppercase tracking-widest">No se marcará como "Abarcado" en el historial S-13</p>
                         </div>
                    </div>

                    <div class="space-y-4">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha de Entrega/Devolución</label>
                        <input type="date" id="reception-global-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[14px] font-black text-rose-500 outline-none focus:border-rose-500 transition-all uppercase shadow-inner">
                    </div>

                    <div class="pt-6 border-t border-slate-50 dark:border-white/5 flex gap-4">
                        <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all hover:bg-slate-100 dark:hover:bg-white/10">Cancelar</button>
                        <button id="confirm-bulk-reception" class="flex-[2] py-5 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 transition-transform active:scale-95 group">
                            <i class="fas fa-check-circle group-hover:scale-110 transition-transform"></i>
                            <span id="btn-reception-text">Confirmar Devolución</span>
                        </button>
                    </div>
                </div>
            </div>
        `, (modal) => {
            const listContainer = modal.querySelector('#bulk-reception-list');


            const renderList = () => {
                const now = new Date();
                const sorted = [...assigned].sort((a, b) => {
                    if (sortMode === 'territorio') {
                        return a.numero.localeCompare(b.numero, undefined, { numeric: true });
                    } else {
                        return new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion);
                    }
                });

                listContainer.innerHTML = sorted.map(t => {
                    const mzCount = t.manzanas ? String(t.manzanas).split(/[,;]/).map(s => s.trim()).filter(Boolean).length : 0;
                    const asigDate = new Date(t.fecha_asignacion);
                    const diffDays = Math.ceil(Math.abs(now - asigDate) / (1000 * 60 * 60 * 24));
                    const isLate = diffDays > 10;

                    return `
                    <div class="modern-card !p-5 ${isLate ? 'border-rose-500/20 bg-rose-500/[0.01]' : 'border-slate-100 dark:border-white/5'} group hover:border-rose-500/30 transition-all animate-fade-in relative overflow-hidden flex flex-col gap-4">
                        ${isLate ? '<div class="absolute -right-8 -top-8 w-16 h-16 bg-rose-500/10 rotate-45 flex items-end justify-center pb-1"><i class="fas fa-clock text-[8px] text-rose-500 mb-1"></i></div>' : ''}
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-2">
                                <div class="w-10 h-10 ${isLate ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white'} rounded-2xl flex items-center justify-center text-lg font-black shadow-inner">
                                    ${t.numero}
                                </div>
                                <div class="p-2 bg-indigo-500/5 text-indigo-500 rounded-xl">
                                    <i class="fas fa-map-marked-alt text-[10px]"></i>
                                </div>
                            </div>
                            <!-- Bulk Checkbox -->
                            <div class="reception-check-container relative w-6 h-6">
                                <input type="checkbox" class="reception-check absolute inset-0 opacity-0 cursor-pointer z-10" value="${t.id}" checked>
                                <div class="w-6 h-6 border-2 border-slate-200 dark:border-white/10 rounded-lg flex items-center justify-center transition-all bg-white dark:bg-transparent">
                                    <i class="fas fa-check text-[10px] text-rose-500 opacity-0 transition-opacity"></i>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-0.5 mt-1">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-location-dot text-[8px] text-slate-400 opacity-40"></i>
                                <h4 class="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">${t.nombre || 'Territorio ' + t.numero}</h4>
                            </div>
                            <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-4 truncate">${t.asignado_a || '—'}</p>
                        </div>

                        <div class="flex items-center justify-between mt-2 pt-3 border-t border-slate-50 dark:border-white/5">
                            <div class="flex flex-col gap-1">
                                <span class="text-[8px] font-black ${isLate ? 'text-rose-500' : 'text-slate-400'} uppercase tracking-tighter">
                                    ${UIHelpers.fmtDateAt(t.fecha_asignacion)}
                                    ${isLate ? ` • <span class="animate-pulse">${diffDays} DÍAS</span>` : ''}
                                </span>
                                ${mzCount > 0 ? `<span class="bg-indigo-500/5 text-indigo-500 text-[7px] font-black px-1.5 py-0.5 rounded w-fit uppercase">${mzCount} MZ</span>` : ''}
                            </div>
                            
                            <div class="flex items-center gap-1">
                                <!-- ✅ COMPLETO -->
                                <button onclick="window.quickReturn('${t.id}', 'Completado')" 
                                        class="w-8 h-8 flex items-center justify-center bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all shadow-sm group/btn" 
                                        title="Marcar como Completado">
                                    <i class="fas fa-check text-[10px] group-hover/btn:scale-110 transition-transform"></i>
                                </button>
                                
                                <!-- ✂️ PARCIAL -->
                                <button onclick="window.openPartialReception('${t.id}')" 
                                        class="w-8 h-8 flex items-center justify-center bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-white transition-all shadow-sm group/btn" 
                                        title="Devolución Parcial">
                                    <i class="fas fa-scissors text-[10px] group-hover/btn:scale-110 transition-transform"></i>
                                </button>

                                <!-- 🔄 LIBERAR -->
                                <button onclick="window.quickReturn('${t.id}', 'Disponible')" 
                                        class="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-white/10 text-slate-400 hover:bg-slate-700 dark:hover:bg-white hover:text-white transition-all shadow-sm group/btn" 
                                        title="Liberar sin predicar">
                                    <i class="fas fa-undo-alt text-[10px] group-hover/btn:rotate-[-45deg] transition-transform"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                }).join('');

                modal.querySelectorAll('.reception-check').forEach(cb => {
                    cb.onchange = (e) => {
                        const icon = e.target.parentElement.querySelector('i');
                        const box = e.target.parentElement.querySelector('div');
                        if (e.target.checked) {
                            icon.classList.remove('opacity-0');
                            box.classList.add('border-rose-500');
                        } else {
                            icon.classList.add('opacity-0');
                            box.classList.remove('border-rose-500');
                        }
                        updateCounter();
                    };
                    // Initial state
                    if (cb.checked) {
                        cb.parentElement.querySelector('i').classList.remove('opacity-0');
                        cb.parentElement.querySelector('div').classList.add('border-rose-500');
                    }
                });
                updateCounter();
            };

            // Helpers for per-item actions
            window.quickReturn = async (id, status) => {
                const date = modal.querySelector('#reception-global-date').value;
                const note = status === 'Disponible' ? "Liberación rápida (sin predicar)" : "Recepción rápida (completado)";

                try {
                    showNotification("Procesando...", "info");
                    await returnTerritorioMultiple([id], note, new Date(date + 'T12:00:00Z').toISOString(), status);

                    // Remove from local list and re-render
                    const idx = assigned.findIndex(x => x.id === id);
                    if (idx > -1) assigned.splice(idx, 1);

                    if (assigned.length === 0) modal.classList.add('hidden');
                    else renderList();

                    const updatedT = await getTerritorios();
                    territorios.length = 0;
                    territorios.push(...updatedT);
                    renderTable();
                    showNotification("Territorio procesado con éxito", "success");
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                }
            };

            const updateCounter = () => {
                const checked = modal.querySelectorAll('.reception-check:checked').length;
                const text = modal.querySelector('#btn-reception-text');
                if (text) text.innerText = `Confirmar Devolución (${checked})`;
            };

            const updateSortUI = () => {
                const btnTerr = modal.querySelector('#sort-by-terr');
                const btnDate = modal.querySelector('#sort-by-date');

                if (sortMode === 'territorio') {
                    btnTerr.classList.add('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20');
                    btnTerr.classList.remove('text-slate-500', 'border-slate-200/50');
                    btnDate.classList.remove('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20');
                    btnDate.classList.add('text-slate-500', 'border-slate-200/50');
                } else {
                    btnDate.classList.add('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20');
                    btnDate.classList.remove('text-slate-500', 'border-slate-200/50');
                    btnTerr.classList.remove('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20');
                    btnTerr.classList.add('text-slate-500', 'border-slate-200/50');
                }
                renderList();
            };

            modal.querySelector('#sort-by-terr').onclick = () => {
                sortMode = 'territorio';
                updateSortUI();
            };
            modal.querySelector('#sort-by-date').onclick = () => {
                sortMode = 'fecha';
                updateSortUI();
            };

            let allSelected = true;
            modal.querySelector('#reception-select-all').onclick = () => {
                allSelected = !allSelected;
                modal.querySelectorAll('.reception-check').forEach(cb => {
                    cb.checked = allSelected;
                    cb.dispatchEvent(new Event('change'));
                });
                modal.querySelector('#reception-select-all').innerText = allSelected ? 'Deseleccionar Todos' : 'Seleccionar Todos';
            };

            // Toggle "No Preached" UI Logic
            const checkNoPreached = modal.querySelector('#check-no-preached');
            const toggleBtn = modal.querySelector('#toggle-no-preached');
            const dot = modal.querySelector('.toggle-dot');
            const bg = modal.querySelector('.toggle-bg');

            toggleBtn.onclick = () => {
                checkNoPreached.checked = !checkNoPreached.checked;
                if (checkNoPreached.checked) {
                    dot.style.transform = 'translateX(1rem)';
                    bg.classList.add('bg-amber-500');
                    bg.classList.remove('bg-slate-200', 'dark:bg-slate-800');
                } else {
                    dot.style.transform = 'translateX(0)';
                    bg.classList.remove('bg-amber-500');
                    bg.classList.add('bg-slate-200', 'dark:bg-slate-800');
                }
            };

            modal.querySelector('#confirm-bulk-reception').onclick = async (e) => {
                const checked = Array.from(modal.querySelectorAll('.reception-check:checked')).map(cb => cb.value);
                if (checked.length === 0) return showNotification("Seleccione al menos un territorio", "warning");

                const dateInput = modal.querySelector('#reception-global-date');
                const date = dateInput.value;
                if (!date) return;

                const onlyReturn = checkNoPreached.checked;
                const finalStatus = onlyReturn ? 'Disponible' : 'Completado';
                const finalNotes = onlyReturn ? "Devolución sin predicar (Recepción Manual)" : "Recepción desde Programa";

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

                await returnTerritorioMultiple(checked, finalNotes, new Date(date + 'T12:00:00Z').toISOString(), finalStatus);

                showNotification(onlyReturn ? `Se liberaron ${checked.length} territorios.` : `Se recibieron ${checked.length} territorios.`);
                modal.classList.add('hidden');

                const updatedT = await getTerritorios();
                territorios.length = 0;
                territorios.push(...updatedT);
                renderTable();
            };

            renderList();
        });
    };

    container.querySelector('#btn-sync-all-prog').onclick = async () => {
        // Collect all planned assignments that are not sync
        const freshTerritorios = await getTerritorios();
        const normalize = (val) => String(val || '').trim();
        const territoryMap = freshTerritorios.reduce((acc, t) => { acc[normalize(t.numero)] = t; return acc; }, {});

        const toSync = [];
        programa.dias.forEach((dia, dayIdx) => {
            ['manana', 'tarde', 'noche', 'zoom'].forEach(turnoId => {
                const data = dia[turnoId];
                if (data && data.territorio) {
                    // Xolvy Robust Split: Handle all common separators
                    const tNums = String(data.territorio).split(/[,;/]/).map(n => n.trim()).filter(n => n);

                    tNums.forEach(tNum => {
                        const baseT = getBaseTerritoryNumber(tNum);
                        const tInfo = territoryMap[normalize(baseT)] || null;
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



                <div class="space-y-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 shrink-0">
                    <div class="flex items-center justify-between">
                        <label class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">¿Fecha general de asignación?</label>
                        <span class="text-[8px] font-bold text-emerald-500 uppercase bg-emerald-500/5 px-2 py-0.5 rounded">Sugerencia S-13: Domingo anterior</span>
                    </div>
                    <input type="date" id="sync-global-date" value="${(() => {
                const d = new Date(currentWeekStart);
                d.setDate(d.getDate() - 1);
                return d.toISOString().split('T')[0];
            })()}" class="w-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 p-4 rounded-xl text-[12px] font-black text-emerald-500 outline-none focus:border-emerald-500 transition-all uppercase shadow-inner">
                    <p class="text-[8px] text-slate-400 font-bold uppercase tracking-widest italic leading-normal px-1">
                        Si se deja vacío, se usará la fecha exacta del día de salida (Viernes, Sábado, etc.).
                    </p>
                </div>

                <div class="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-white/5 shrink-0">
                    <div class="flex items-center gap-2 opacity-20 hover:opacity-100 transition-opacity">
                        <i class="fas fa-shield-alt text-[8px] text-emerald-500"></i>
                        <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest">Sincronización Bilateral Activa</span>
                    </div>
                    <div class="flex gap-4">
                        <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="px-6 py-4 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-lg text-[10px] uppercase tracking-widest">Cerrar</button>
                        <button id="confirm-sync-all" class="px-8 py-4 bg-emerald-500 text-white font-black rounded-lg text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all">Formalizar Selección</button>
                    </div>
                </div>
            </div>
        `, (modal) => {
            const updateCounter = () => {
                const checked = modal.querySelectorAll('.sync-check:checked').length;
                const btn = modal.querySelector('#confirm-sync-all');
                if (btn) btn.innerText = `Formalizar Selección (${checked})`;
            };

            let syncSelected = true;
            updateCounter();

            modal.querySelector('#sync-select-all').onclick = () => {
                syncSelected = !syncSelected;
                modal.querySelectorAll('.sync-check').forEach(cb => cb.checked = syncSelected);
                modal.querySelector('#sync-select-all').innerText = syncSelected ? 'Deseleccionar Todo' : 'Seleccionar Todo';
                updateCounter();
            };

            modal.querySelectorAll('.sync-check').forEach(cb => {
                cb.onchange = updateCounter;
            });

            modal.querySelector('#confirm-sync-all').onclick = async (e) => {
                const checkedIdxs = Array.from(modal.querySelectorAll('.sync-check:checked')).map(cb => parseInt(cb.value));
                if (checkedIdxs.length === 0) return showNotification("Seleccione al menos una asignación", "warning");

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

                const { syncSlotWithTerritories } = await import('../../data/firestore-services.js');
                showNotification(`Formalizando ${checkedIdxs.length} asignaciones...`, 'info');

                // 1. Resolve and Group checked assignments by "Effective Slot" (Date + Turn)
                // This is CRITICAL to handle "Total Replacement" correctly without conflicts
                const weekId = programa.id;
                const globalDate = modal.querySelector('#sync-global-date').value;
                const effectiveSlots = new Map();

                for (const idx of checkedIdxs) {
                    const item = toSync[idx];

                    let resolvedDateISO;
                    if (globalDate) {
                        resolvedDateISO = new Date(globalDate + 'T12:00:00Z').toISOString();
                    } else {
                        const d = new Date(weekId + 'T12:00:00Z');
                        d.setUTCDate(d.getUTCDate() + item.dayIdx);
                        resolvedDateISO = d.toISOString();
                    }

                    // The Key for Bilateral Sync grouping is resolved Date + Turn
                    const slotKey = `${resolvedDateISO.split('T')[0]}_${item.turnoId}`;

                    if (!effectiveSlots.has(slotKey)) {
                        effectiveSlots.set(slotKey, {
                            dayIdx: item.dayIdx,
                            turnoId: item.turnoId,
                            dia: item.dia,
                            conductor: item.data.conductor,
                            tNums: [],
                            fullData: item.data,
                            resolvedDateISO
                        });
                    }
                    effectiveSlots.get(slotKey).tNums.push(item.specificT);
                }

                // 2. Synchronize each effective slot
                for (const [, slot] of effectiveSlots) {
                    const syncData = {
                        ...slot.fullData,
                        // Override territory list with ONLY the ones selected in the modal for this slot
                        territorio: slot.tNums.join(' / '),
                        prog_sync: true
                    };

                    console.log(`Bilateral Sync: Formalizing slot with resolved PREACHING date ${slot.resolvedDateISO} and ${slot.tNums.length} territories`);
                    const chosenAssignmentDate = globalDate ? new Date(globalDate + 'T12:00:00Z').toISOString() : null;
                    await syncSlotWithTerritories(weekId, slot.dayIdx, slot.turnoId, syncData, slot.resolvedDateISO, chosenAssignmentDate);
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

    container.querySelector('#prev-week').onclick = () => { currentWeekStart.setDate(currentWeekStart.getDate() - 7); loadWeekData(); };
    container.querySelector('#next-week').onclick = () => { currentWeekStart.setDate(currentWeekStart.getDate() + 7); loadWeekData(); };
    container.querySelector('#btn-reset-today').onclick = () => { currentWeekStart = getMonday(new Date()); loadWeekData(); };

    container.querySelector('#btn-copy-prev-week').onclick = async () => {
        showCustomConfirm("¿Seguro que deseas sobrescribir esta semana con los datos de la semana pasada? Se conservarán los turnos y conductores, pero se limpiarán los territorios.", async () => {
            try {
                const prev = new Date(currentWeekStart);
                prev.setDate(prev.getDate() - 7);
                const prevProgName = formatDateId(prev);
                const oldProg = await getProgramaSemanal(prevProgName);

                if (!oldProg.id || oldProg.id === 'default') return showNotification("No hay datos en la semana anterior para copiar", "warning");

                // Duplicate keeping conductors and places, clearing territories
                const newDias = oldProg.dias.map((d, i) => {
                    const nd = new Date(currentWeekStart);
                    nd.setDate(nd.getDate() + i);

                    const cloneTurn = (turn) => {
                        if (!turn) return {};
                        return { hora: turn.hora || '', lugar: turn.lugar || '', conductor: turn.conductor || '', auxiliar: turn.auxiliar || '', faceta: turn.faceta || '', grupos: turn.grupos || '', enabled: turn.enabled };
                    };

                    return {
                        nombre: d.nombre,
                        fecha: formatDateId(nd),
                        manana: cloneTurn(d.manana),
                        tarde: cloneTurn(d.tarde),
                        noche: cloneTurn(d.noche),
                        zoom: cloneTurn(d.zoom)
                    };
                });

                programa.dias = newDias;
                await saveProgramaSemanal(programa.id, programa);
                renderTable();
                showNotification("Plantilla de semana pasada replicada con éxito", "success");
            } catch (e) {
                console.error(e);
                showNotification("Error al copiar semana", "error");
            }
        });
    };

    container.querySelector('#btn-export-xls-prog').onclick = async () => {
        const { exportarProgramaExcel } = await import('../services/export-service.js');
        await exportarProgramaExcel(programa);
    };

    const dDown = container.querySelector('#btn-export-dropdown');
    const menuEl = container.querySelector('#export-menu-options');
    if (dDown && menuEl) {
        // Dropdown toggle logic
        dDown.onclick = (e) => {
            e.stopPropagation();
            menuEl.classList.toggle('show');
        };
        document.addEventListener('click', () => {
            if (menuEl.classList.contains('show')) menuEl.classList.remove('show');
        });

        // The button logic for export
        container.querySelector('#btn-export-png-cond-new').onclick = async () => {
             showNotification("El formato PNG para PDF ha sido delegado. Redirigiendo a Excel...", "info");
             const { exportarProgramaExcel } = await import('../services/export-service.js');
             await exportarProgramaExcel(programa, true);
        };
        container.querySelector('#btn-export-png-pub-new').onclick = async () => {
             showNotification("El formato PNG para PDF ha sido delegado. Redirigiendo a Excel...", "info");
             const { exportarProgramaExcel } = await import('../services/export-service.js');
             await exportarProgramaExcel(programa, false);
        };
    }

    await loadWeekData();
};
