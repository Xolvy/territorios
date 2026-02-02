import { getSafeDateId, showNotification } from '../utils/helpers.js';
import { getProgramaSemanal, saveProgramaSemanal, syncSlotWithTerritories, getTerritorios } from '../../data/firestore-services.js';
import { renderFullProgramaCards } from './program-views.js';

export const initializeWeeklyProgram = (container, userMods, allTerritorios, territoryMap, name, currentWeekStart, activeDayIndex, activeTurns) => {
    if (userMods.programa === false) return;

    const programCardsContainer = container.querySelector('#weekly-program-cards');
    const weekRangeLabel = container.querySelector('#prog-week-range');
    const daySelector = container.querySelector('#prog-day-selector');
    const turnFilters = container.querySelector('#prog-turn-filters');

    const loadWeekData = async () => {
        const weekId = getSafeDateId(currentWeekStart);
        const monday = new Date(currentWeekStart);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        if (weekRangeLabel) {
            const fmt = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();
            weekRangeLabel.innerText = `${fmt(monday)} - ${fmt(sunday)}`;
        }

        if (programCardsContainer) {
            programCardsContainer.innerHTML = `
                <div class="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                    <div class="w-16 h-16 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando programación...</p>
                </div>`;
        }

        try {
            const prog = await getProgramaSemanal(weekId);
            window._globalPrograma = prog;
            window._globalTerritorios = allTerritorios;
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
        if (!turnFilters) return;
        const turnosArr = [
            { id: 'manana', icon: 'fa-sun', label: 'M', color: 'text-amber-500', bg: 'bg-amber-500/10', full: 'Mañana' },
            { id: 'tarde', icon: 'fa-cloud-sun', label: 'T', color: 'text-orange-500', bg: 'bg-orange-500/10', full: 'Tarde' },
            { id: 'noche', icon: 'fa-moon', label: 'N', color: 'text-indigo-400', bg: 'bg-indigo-400/10', full: 'Noche' },
            { id: 'zoom', icon: 'fa-video', label: 'Z', color: 'text-emerald-500', bg: 'bg-emerald-500/10', full: 'Zoom' }
        ];

        turnFilters.innerHTML = turnosArr.map(t => {
            const isActive = activeTurns.has(t.id);
            return `
                <button onclick="window.toggleProgTurn('${t.id}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[9px] font-black uppercase tracking-wider ${isActive ? t.bg + ' ' + t.color : 'text-slate-400 opacity-40 hover:opacity-100'}">
                    <i class="fas ${t.icon}"></i>
                    <span class="hidden sm:inline">${t.full}</span>
                    <span class="inline sm:hidden">${t.label}</span>
                </button>`;
        }).join('');
    };

    const renderDaySelector = () => {
        if (!daySelector) return;
        const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        daySelector.innerHTML = `
            ${dayNames.map((n, i) => {
            const isActive = activeDayIndex === i;
            const isToday = new Date().getDay() === (i === 6 ? 0 : i + 1);
            return `
                    <button onclick="window.setProgActiveDay(${i})" 
                            class="relative px-4 sm:px-5 py-2 rounded-[1.25rem] text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-105' : 'text-slate-500 hover:text-indigo-500 hover:bg-white dark:hover:bg-white/10'}">
                        ${n.substring(0, 3)}
                        ${isToday ? '<span class="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800"></span>' : ''}
                    </button>`;
        }).join('')}
            <div class="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1"></div>
            <button onclick="window.setProgActiveDay(-1)" 
                    class="px-4 py-2 rounded-[1.25rem] text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${activeDayIndex === -1 ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xl' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}">
                Toda
            </button>`;
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
        renderDaySelector();
        renderFullProgramaCards(window._globalPrograma, programCardsContainer, territoryMap, name, activeDayIndex, activeTurns);
    };

    // Navigation and Logic
    loadWeekData();
};
