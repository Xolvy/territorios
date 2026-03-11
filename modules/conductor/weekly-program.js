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

    // Internal State
    let _currentWeek = new Date(currentWeekStart);

    const loadWeekData = async () => {
        const weekId = getSafeDateId(_currentWeek);
        const monday = new Date(_currentWeek);
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

    // --- BUTTON LISTENERS ---
    const btnPrev = container.querySelector('#prog-prev-week');
    const btnNext = container.querySelector('#prog-next-week');
    const btnToday = container.querySelector('#prog-btn-today');
    const btnShare = container.querySelector('#prog-btn-share');
    const btnExport = container.querySelector('#prog-export-png');

    if (btnPrev) btnPrev.onclick = () => { _currentWeek.setDate(_currentWeek.getDate() - 7); loadWeekData(); };
    if (btnNext) btnNext.onclick = () => { _currentWeek.setDate(_currentWeek.getDate() + 7); loadWeekData(); };
    if (btnToday) btnToday.onclick = () => {
        const now = new Date();
        const monday = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)));
        _currentWeek = monday;
        loadWeekData();
    };

    if (btnShare) btnShare.onclick = () => {
        const weekStr = weekRangeLabel?.innerText || 'Programa';
        const text = `📅 *Programa Semanal (${weekStr})*\n\nConsulta los turnos y puntos de reunión actualizados en la aplicación.`;
        if (navigator.share) {
            navigator.share({ title: 'Programa Semanal', text: text, url: window.location.href });
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + window.location.href)}`, '_blank');
        }
    };

    if (btnExport) btnExport.onclick = async () => {
         showNotification("La exportación a imagen fue descontinuada. Por favor solicite a su administrador el archivo Excel.", "info", 5000);
    };

    // Navigation and Logic
    loadWeekData();
};
