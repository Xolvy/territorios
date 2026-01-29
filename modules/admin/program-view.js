import {
    getTerritorios, getConfiguracion, getPublicadores, getConductores,
    getProgramaSemanal, saveProgramaSemanal, getGroupsConfig, returnTerritorioMultiple,
    getHistorialReport, returnTerritorioParcial
} from '../../data/firestore-services.js?v=2.4.0.7';
import { showNotification } from '../utils/helpers.js?v=2.4.0.7';
import { UIHelpers, showModal, showTerritorySelectionModal } from '../services/ui-helpers.js?v=2.4.0.7';

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
                        <button id="btn-sync-all-prog" class="hidden xl:flex items-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95 group">
                            <i class="fas fa-project-diagram group-hover:rotate-12 transition-transform"></i>
                            Formalizar Asignaciones
                        </button>
                        <button id="btn-s13-export" class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-4 rounded-xl font-black transition-all text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 group" title="Exportar Registro de Asignaciones (S-13)">
                            <i class="fas fa-file-pdf"></i>
                            S-13
                        </button>
                        <button id="btn-s12-export-direct" class="flex items-center gap-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 px-6 py-4 rounded-xl font-black transition-all text-[10px] uppercase tracking-widest shadow-sm active:scale-95 group" title="Exportar Registro de Territorios (S-12)">
                            <i class="fas fa-shield-alt"></i>
                            S-12
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

    container.querySelector('#btn-s13-export').onclick = async () => {
        const modal = document.getElementById('modal-container');
        modal.classList.remove('hidden');
        modal.innerHTML = `
            <div class="w-full h-full flex items-center justify-center p-4">
                <div class="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                    <header class="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                        <div class="flex items-center gap-4">
                             <div class="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center text-2xl">
                                <i class="fas fa-file-invoice"></i>
                             </div>
                             <div>
                                 <h3 class="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Centro de Exportación S-13</h3>
                                 <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Generación de Reportes Oficiales</p>
                             </div>
                        </div>
                        <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 transition-all">
                            <i class="fas fa-times"></i>
                        </button>
                    </header>
                    <div id="s13-modal-content" class="flex-1 overflow-y-auto p-10 custom-scrollbar">
                        <div class="flex items-center justify-center py-20 animate-pulse">
                            <div class="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        const { renderS13CommandCenter } = await import('../report-s13.js');
        await renderS13CommandCenter(document.getElementById('s13-modal-content'));
    };

    container.querySelector('#btn-s12-export-direct').onclick = async () => {
        const modal = document.getElementById('modal-container');
        modal.classList.remove('hidden');
        modal.innerHTML = `
            <div class="w-full h-full flex items-center justify-center p-4">
                <div class="bg-white dark:bg-slate-900 w-full max-w-7xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-slate-100 dark:border-white/5">
                    <header class="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.02]">
                        <div class="flex items-center gap-6">
                             <div class="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center text-3xl shadow-inner border border-amber-500/10">
                                <i class="fas fa-database"></i>
                             </div>
                             <div>
                                 <h3 class="text-2xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Base de Datos (S-12)</h3>
                                 <p class="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.4em] mt-1 opacity-70">Catálogo Maestro de Territorios</p>
                             </div>
                        </div>
                        <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-12 h-12 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                            <i class="fas fa-times"></i>
                        </button>
                    </header>
                    <div id="s12-modal-content" class="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar bg-slate-50/30 dark:bg-transparent">
                        <div class="flex flex-col items-center justify-center py-32 gap-6 opacity-30">
                            <i class="fas fa-circle-notch fa-spin text-4xl text-amber-500"></i>
                            <p class="text-xs font-black uppercase tracking-widest">Cargando Base S-12...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        const { renderS12View } = await import('./s12-view.js');
        await renderS12View(document.getElementById('s12-modal-content'));
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
        const turnos = [
            { id: 'manana', icon: 'fa-sun', label: 'Mañana', color: 'text-amber-500', bg: 'bg-amber-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'] },
            { id: 'tarde', icon: 'fa-cloud-sun', label: 'Tarde', color: 'text-orange-500', bg: 'bg-orange-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'] },
            { id: 'noche', icon: 'fa-moon', label: 'Noche', color: 'text-indigo-500', bg: 'bg-indigo-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'] },
            { id: 'zoom', icon: 'fa-video', label: 'Zoom', color: 'text-emerald-500', bg: 'bg-emerald-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Faceta'] }
        ];

        let html = `<div class="space-y-12 pb-20">`;

        programa.dias.forEach((dia, dayIndex) => {
            if (activeDayIndex !== -1 && activeDayIndex !== dayIndex) return;

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
                const freshT = await getTerritorios();
                const tInfo = freshT.find(t => t.numero === programa.dias[dayIdx][turnoId].territorio);
                const isAssigned = tInfo && tInfo.estado === 'Asignado';
                const isSync = isAssigned && tInfo.asignado_a === programa.dias[dayIdx][turnoId].conductor;
                const isConflict = isAssigned && tInfo.asignado_a !== programa.dias[dayIdx][turnoId].conductor;
                const v = programa.dias[dayIdx][turnoId].territorio;

                badgeContainer.innerHTML = v ? (isSync ?
                    '<span class="text-emerald-500 font-bold flex items-center gap-1 animate-fade-in"><i class="fas fa-check-circle"></i> LISTO</span>' :
                    (isConflict ?
                        '<span class="text-rose-500 font-bold flex items-center gap-1 animate-fade-in" title="Ocupado por otro publicador"><i class="fas fa-exclamation-triangle"></i> OCUPADO</span>' :
                        `<span class="text-primary font-bold flex items-center gap-1 cursor-pointer hover:underline animate-fade-in" onclick="window.syncAssignmentFromProg(${dayIdx}, '${turnoId}')"><i class="fas fa-link animate-pulse"></i> ASIGNAR</span>`)) : '';
            }
        }
    };

    window.syncAssignmentFromProg = (dayIdx, turnoId) => {
        const dia = programa.dias[dayIdx];
        const data = dia[turnoId];
        const num = data.territorio;
        const cond = data.conductor;

        if (!num || !cond) return showNotification("Faltan datos en el programa para asignar", "warning");

        const tInfo = territorios.find(t => t.numero === num);
        if (!tInfo) return showNotification("Territorio no encontrado", "error");

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
                        <span class="text-slate-400 font-bold uppercase tracking-widest">Territorio</span>
                        <span class="font-black text-primary uppercase">#${num}</span>
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-400 font-bold uppercase tracking-widest">Salida Programada</span>
                        <span class="font-black text-slate-600 dark:text-gray-300 uppercase">${dia.nombre} (${dia.fecha})</span>
                    </div>
                </div>

                <div class="space-y-4">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">¿Cuándo se entregó la tarjeta física?</label>
                    <input type="date" id="sync-asig-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[14px] font-black text-primary outline-none focus:border-primary transition-all uppercase shadow-inner">
                </div>

                <div class="flex gap-4 pt-6 border-t border-slate-50 dark:border-white/5">
                    <button id="cancel-sync" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
                    <button id="confirm-sync" class="flex-[2] py-5 bg-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">ASIGNAR FORMALMENTE</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#cancel-sync').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#confirm-sync').onclick = async () => {
                const date = modal.querySelector('#sync-asig-date').value;
                if (!date) return;

                const { assignTerritorio } = await import('../../data/firestore-services.js?v=2.4.0.7');
                await assignTerritorio(tInfo.id, cond, {
                    fecha_asignacion: new Date(date + 'T12:00:00Z').toISOString(),
                    lugar: data.lugar || null,
                    hora: data.hora || null,
                    faceta: data.faceta || null,
                    turno: turnoId
                });

                showNotification(`¡Territorio ${num} asignado a ${cond}!`);
                modal.classList.add('hidden');

                // Refresh local territories and table
                const updatedT = await getTerritorios();
                territorios.length = 0;
                territorios.push(...updatedT);
                renderTable();
            };
        });
    };

    window.openTerritorySelector = (dayIdx, turnoId, btn) => {
        const available = territorios.filter(t =>
            t.estado === 'Disponible' ||
            t.estado === 'Sin asignar' ||
            t.estado === 'Libre' ||
            t.is_incomplete === true
        );
        showTerritorySelectionModal(btn.dataset.current || '', available, (res) => {
            window.updateWeekData(dayIdx, turnoId, 'territorio', res);
        }, 'modal-container-nested', historial);
    };

    window.openGroupSelector = async (dayIdx, turnoId, btn) => {
        const groups = await getGroupsConfig();
        // ... (Similar modal to original) ...
        showNotification("Módulo de grupos en desarrollo");
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
        const assigned = territorios.filter(t => t.estado === 'Asignado');
        if (assigned.length === 0) return showNotification("No hay territorios asignados actualmente", "info");

        showModal(`
            <div class="p-8 space-y-8 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-rose-500/10 rounded-3xl flex items-center justify-center text-3xl text-rose-500 shadow-inner">
                        <i class="fas fa-file-import"></i>
                    </div>
                    <div>
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Recepción Manual</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Devolver territorios al inventario</p>
                    </div>
                    <button id="reception-select-all" class="px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all">Seleccionar Todos</button>
                </div>

                <div class="space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar pr-2 pb-6">
                    <div id="bulk-reception-list" class="space-y-3">
                        ${assigned.map(t => `
                            <div class="flex items-center gap-3 w-full group">
                                <label class="flex-1 flex items-center gap-4 p-5 modern-card border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98] relative overflow-hidden">
                                     <div class="absolute inset-0 bg-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    <input type="checkbox" class="reception-check w-6 h-6 rounded-lg accent-rose-500 relative z-10" value="${t.id}">
                                    <div class="flex-1 relative z-10">
                                        <div class="flex justify-between items-center mb-1">
                                            <p class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">#${t.numero} • ${t.asignado_a}</p>
                                            <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">${UIHelpers.fmtDateAt(t.fecha_asignacion)}</span>
                                        </div>
                                        <div class="flex items-center gap-3">
                                             ${t.faceta ? `<span class="text-[8px] font-black text-primary uppercase tracking-widest px-2 py-0.5 bg-primary/10 rounded-md"><i class="fas fa-bullhorn mr-1"></i>${t.faceta}</span>` : ''}
                                             ${t.turno ? `<span class="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-md">${t.turno}</span>` : ''}
                                        </div>
                                    </div>
                                </label>
                                <button onclick="window.openPartialReception('${t.id}')" class="p-5 modern-card border-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center shadow-sm" title="Devolución Parcial">
                                    <i class="fas fa-scissors"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="pt-6 border-t border-slate-50 dark:border-white/5 flex gap-4">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
                    <button id="confirm-bulk-reception" class="flex-[2] py-5 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 transition-transform active:scale-95">
                        <i class="fas fa-check-circle"></i> Marcar como Devueltos
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
                if (checked.length === 0) return;

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

                await returnTerritorioMultiple(checked, "Recepción desde Programa", new Date().toISOString(), "Completado");

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
                if (data && data.territorio && data.conductor) {
                    const tInfo = territoryMap[data.territorio];
                    // Skip if already assigned to the same person
                    const isSync = tInfo && tInfo.estado === 'Asignado' && tInfo.asignado_a === data.conductor;
                    if (tInfo && !isSync) {
                        toSync.push({ dayIdx, turnoId, dia, data, tInfo });
                    }
                }
            });
        });

        if (toSync.length === 0) return showNotification("No hay nuevas asignaciones para formalizar", "info");

        showModal(`
            <div class="p-8 space-y-8 max-w-xl">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-3xl text-emerald-500 shadow-inner">
                        <i class="fas fa-project-diagram"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Formalización Masiva</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Procesar semana actual</p>
                    </div>
                </header>

                <div class="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    <p class="text-[11px] font-bold text-slate-500 uppercase px-1">Se procesarán las siguientes asignaciones:</p>
                    ${toSync.map(item => `
                        <div class="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <span class="w-10 h-10 bg-primary text-white flex items-center justify-center rounded-xl font-black text-xs">${item.data.territorio}</span>
                                <div class="flex flex-col">
                                    <span class="text-xs font-black text-slate-800 dark:text-white uppercase">${item.data.conductor}</span>
                                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${item.dia.nombre}</span>
                                </div>
                            </div>
                            <i class="fas fa-arrow-right text-slate-200"></i>
                        </div>
                    `).join('')}
                </div>

                <div class="space-y-4">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha Global de Asignación</label>
                    <input type="date" id="sync-all-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[14px] font-black text-primary outline-none focus:border-primary transition-all uppercase shadow-inner">
                </div>

                 <div class="flex gap-4 pt-6 border-t border-slate-50 dark:border-white/5">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cerrar</button>
                    <button id="confirm-sync-all" class="flex-[2] py-5 bg-emerald-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all">PROCESAR ${toSync.length} REGISTROS</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#confirm-sync-all').onclick = async () => {
                const date = modal.querySelector('#sync-all-date').value;
                if (!date) return;

                const { assignTerritorio } = await import('../../data/firestore-services.js?v=2.4.0.7');

                showNotification(`Procesando ${toSync.length} asignaciones...`, 'info');

                for (const item of toSync) {
                    await assignTerritorio(item.tInfo.id, item.data.conductor, {
                        fecha_asignacion: new Date(date + 'T12:00:00Z').toISOString(),
                        lugar: item.data.lugar || null,
                        hora: item.data.hora || null,
                        faceta: item.data.faceta || null,
                        turno: item.turnoId
                    });
                }

                showNotification(`¡${toSync.length} asignaciones formalizadas con éxito!`, 'success');
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
