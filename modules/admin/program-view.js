import {
    getTerritorios, getConfiguracion, getPublicadores, getConductores,
    getProgramaSemanal, saveProgramaSemanal, getGroupsConfig
} from '../../data/firestore-services.js?v=2.2.5';
import { showNotification } from '../utils/helpers.js?v=2.2.5';
import { UIHelpers, showModal, showTerritorySelectionModal } from '../services/ui-helpers.js?v=2.2.5';

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

    const [territorios, config, allPersonnel] = await Promise.all([
        getTerritorios(), getConfiguracion(), getPublicadores()
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
                        <button id="btn-reset-today" class="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-6 py-4 rounded-xl font-black hover:bg-slate-50 transition-all text-[10px] uppercase tracking-widest">Hoy</button>
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

    const renderTable = () => {
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
                        html += `
                            <label class="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                                <i class="fas fa-map-marked-alt opacity-30"></i> ${field}
                            </label>
                            <button onclick="window.openTerritorySelector(${dayIndex}, '${turnoId}', this)" 
                                    class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5 rounded-2xl hover:border-primary transition-all flex items-center justify-between shadow-sm">
                                <span class="text-[11px] font-black truncate ${val ? 'text-primary' : 'text-slate-400 opacity-40'}">${val || '—'}</span>
                            </button>`;
                    } else if (field === 'Grupos') {
                        html += `
                            <label class="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                                <i class="fas fa-users opacity-30"></i> ${field}
                            </label>
                            <button onclick="window.openGroupSelector(${dayIndex}, '${turnoId}', this)" 
                                    class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5 rounded-2xl hover:border-indigo-500 transition-all flex items-center justify-between shadow-sm">
                                <span class="text-[11px] font-black truncate ${val ? 'text-indigo-500' : 'text-slate-400 opacity-40'}">
                                    ${formatGroups(val)}
                                </span>
                            </button>`;
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
        programa.dias[dayIdx][turnoId][fieldId] = val;
        await saveProgramaSemanal(programa.id, programa);
        showNotification("Cambio guardado");
        renderTable();
    };

    window.openTerritorySelector = (dayIdx, turnoId, btn) => {
        const available = territorios.filter(t => t.estado === 'Disponible');
        showTerritorySelectionModal(btn.dataset.current || '', available, (res) => {
            window.updateWeekData(dayIdx, turnoId, 'territorio', res);
        }, 'modal-container-nested');
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

    container.querySelector('#btn-reset-today').onclick = () => {
        currentWeekStart = getMonday(new Date());
        loadWeekData();
    };

    await loadWeekData();
};
