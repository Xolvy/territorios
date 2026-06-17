import { showNotification } from '../utils/helpers.js';
import { UIHelpers } from '../services/ui-helpers.js';
const { formatDateId: getSafeDateId } = UIHelpers;
import { getProgramaSemanal, saveProgramaSemanal, syncSlotWithTerritories, getTerritorios } from '../../data/firestore-services.js';
import { renderFullProgramaCards, generateLandscapePreviewHTML } from './program-views.js';
export { renderFullProgramaCards, generateLandscapePreviewHTML };

export const initializeWeeklyProgram = (container, userMods, allTerritorios, territoryMap, name, currentWeekStart, activeDayIndex, activeTurns) => {
    if (userMods.programa === false) return;

    const programCardsContainer = container.querySelector('#weekly-program-cards');
    const weekRangeLabel = container.querySelector('#prog-week-range');
    const daySelector = container.querySelector('#prog-day-selector');
    const turnFilters = container.querySelector('#prog-turn-filters');
    if (!turnFilters) {
        console.warn('[WeeklyProgram] turnFilters no encontrado — abortando inicialización');
        return;
    }

    // Internal State
    const turnosArr = [
        { id: 'manana', label: 'Mañ', full: 'Mañana', icon: 'fa-sun', bg: 'bg-orange-500', color: 'text-slate-800 dark:text-slate-100' },
        { id: 'tarde', label: 'Tar', full: 'Tarde', icon: 'fa-cloud-sun', bg: 'bg-indigo-500', color: 'text-white' },
        { id: 'noche', label: 'Noc', full: 'Noche', icon: 'fa-moon', bg: 'bg-slate-800', color: 'text-white' },
        { id: 'zoom', label: 'Zoo', full: 'Zoom', icon: 'fa-video', bg: 'bg-blue-500', color: 'text-white' }
    ];
    // Xolvy Anti-TZ Shield: Ensure YYYY-MM-DD strings are parsed as local time to avoid previous-day shifts
    let _currentWeek = typeof currentWeekStart === 'string' && currentWeekStart.includes('-')
        ? new Date(currentWeekStart + 'T12:00:00')
        : new Date(currentWeekStart);

    const loadWeekData = async () => {
        const weekId = getSafeDateId(_currentWeek);
        const monday = new Date(_currentWeek);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        if (weekRangeLabel) {
            const fmtMonth = (d) => d.toLocaleDateString('es-ES', { month: 'long' });
            let rangeText = '';
            if (monday.getMonth() === sunday.getMonth()) {
                rangeText = `SEMANA DEL ${monday.getDate()} AL ${sunday.getDate()} DE ${fmtMonth(monday).toUpperCase()}`;
            } else {
                rangeText = `SEMANA DEL ${monday.getDate()} DE ${fmtMonth(monday).toUpperCase()} AL ${sunday.getDate()} DE ${fmtMonth(sunday).toUpperCase()}`;
            }
            weekRangeLabel.innerText = rangeText;
        }

        if (programCardsContainer) {
            programCardsContainer.innerHTML = `
                <div class="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                    <div class="w-16 h-16 border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Cargando programación...</p>
                </div>`;
        } else {
            console.warn('[WeeklyProgram] programCardsContainer no encontrado');
        }

        try {
            const prog = await getProgramaSemanal(weekId);

            // Xolvy Logic: If today is selected by default but has no activity, fallback to "Toda la semana"
            if (activeDayIndex !== -1 && prog && prog.dias) {
                const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
                const dayData = prog.dias.find(x => x.nombre === dayNames[activeDayIndex]);
                const shifts = ['manana', 'tarde', 'noche', 'zoom'];
                const hasActivity = dayData && shifts.some(s => {
                    const sd = dayData[s];
                    return sd && sd.enabled !== false && (sd.conductor || sd.lugar || sd.hora || sd.territorio || sd.faceta);
                });
                if (!hasActivity) activeDayIndex = -1;
            }

            // Xolvy Data Shield: Robust normalization & ghost filtering for Conductor View
            const normalizeT = (val) => String(val || '').trim();
            const shieldedTerritorios = allTerritorios
                .filter(rec => {
                    const hasNum = rec.numero && String(rec.numero).trim().length > 0;
                    return hasNum;
                })
                .map(rec => ({
                    ...rec,
                    numero: normalizeT(rec.numero),
                    manzanas: String(rec.manzanas || '').replace(/Salmo/gi, 'Mz.').trim()
                }));

            window._globalPrograma = prog;
            window._globalTerritorios = shieldedTerritorios;
            renderFilters();
            renderDaySelector();
            renderFullProgramaCards(prog, programCardsContainer, territoryMap, name, activeDayIndex, activeTurns);
        } catch (err) {
            console.error("Error loading week:", err);
            if (programCardsContainer) {
                programCardsContainer.innerHTML = '<p class="text-center text-rose-500 font-bold p-10">Error al cargar la programación</p>';
            }
        }
    };

    const renderFilters = () => {
        if (!turnFilters) {
            console.warn('[WeeklyProgram] turnFilters no encontrado');
            return;
        }
        turnFilters.innerHTML = turnosArr.map(t => {
            const isActive = activeTurns.has(t.id);
            return `
                <button onclick="window.toggleProgTurn('${t.id}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[9px] font-black uppercase tracking-wider ${isActive ? t.bg + ' ' + t.color : 'text-slate-600 dark:text-slate-400 opacity-40 hover:opacity-100'}">
                    <i class="fas ${t.icon}"></i>
                    <span class="hidden sm:inline">${t.full}</span>
                    <span class="inline sm:hidden">${t.label}</span>
                </button>`;
        }).join('');
    };

    const renderDaySelector = () => {
        if (!daySelector) {
            console.warn('[WeeklyProgram] daySelector no encontrado');
            return;
        }
        daySelector.className = "flex flex-col md:flex-row gap-3 items-center justify-center w-full";
        const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        daySelector.innerHTML = `
            <div class="flex gap-2 items-center justify-start md:justify-center overflow-x-auto no-scrollbar w-full pb-1 md:pb-0">
                ${dayNames.map((n, i) => {
                const isActive = activeDayIndex === i;
                const isToday = new Date().getDay() === (i === 6 ? 0 : i + 1);
                return `
                        <button onclick="window.setProgActiveDay(${i})" 
                                class="day-btn-tab day-tab relative px-4 sm:px-5 py-2 rounded-[1.25rem] text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-white dark:hover:bg-white/10'}">
                            <span class="hidden sm:inline">${n}</span><span class="sm:hidden">${n.substring(0, 3)}</span>
                            ${isToday ? '<span class="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800"></span>' : ''}
                        </button>`;
            }).join('')}
            </div>
            <div class="flex gap-2 items-center justify-center shrink-0 mt-2 md:mt-0">
                <button onclick="window.setProgActiveDay(-1)" 
                        class="day-tab px-4 py-2 rounded-[1.25rem] text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${activeDayIndex === -1 ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xl' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}">
                    <span class="hidden sm:inline">Toda la semana</span><span class="sm:hidden">Todos</span>
                </button>
                <div class="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1 shrink-0"></div>
                <button id="prog-btn-today" onclick="window.showTodayProg()" 
                        class="day-tab px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[1.25rem] text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all duration-300">
                    MOSTRAR HOY
                </button>
            </div>`;
    };

    window.toggleProgTurn = (id) => {
        if (activeTurns.has(id)) {
            if (activeTurns.size > 1) activeTurns.delete(id);
        } else {
            activeTurns.add(id);
        }
        renderFilters();
        renderFullProgramaCards(window._globalPrograma, programCardsContainer, territoryMap, name, activeDayIndex, activeTurns);
    };

    window.setProgActiveDay = (idx) => {
        activeDayIndex = idx;
        window._activeProgDayIndex = idx; // Persist global
        renderDaySelector();
        renderFullProgramaCards(window._globalPrograma, programCardsContainer, territoryMap, name, activeDayIndex, activeTurns);
    };

    // --- BUTTON LISTENERS & GLOBALS ---
    const btnPrev = container.querySelector('#prog-prev-week');
    const btnNext = container.querySelector('#prog-next-week');
    const btnShare = container.querySelector('#prog-btn-share');
    const btnExport = container.querySelector('#prog-export-png');

    // Expose dynamic showTodayProg handler
    window.showTodayProg = () => {
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const hoy = new Date();
        const nombreHoy = diasSemana[hoy.getDay()];
        
        // Find day tabs that are specifically day buttons (excluding "Mostrar hoy" or "Toda la semana")
        const tabs = container.querySelectorAll('.day-btn-tab');
        let tabEncontrado = false;
        
        tabs.forEach(tab => {
            const text = tab.textContent.trim().toLowerCase();
            if (text === nombreHoy.toLowerCase() || 
                text.startsWith(nombreHoy.substring(0,3).toLowerCase())) {
                tab.click();
                tabEncontrado = true;
            }
        });

        // Fallback: si hoy no hay salidas, seleccionar "Toda la semana"
        if (!tabEncontrado) {
            const tabsAll = container.querySelectorAll('.day-tab');
            const tabTodos = Array.from(tabsAll).find(t => t.textContent.includes('Toda') || t.textContent.includes('Todos'));
            if (tabTodos) tabTodos.click();
        }
    };

    // Both Share and Export are handled inline via window.generarImagenPrograma?.()

    // Navigation and Logic
    loadWeekData();
};
