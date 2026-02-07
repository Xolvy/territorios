import { formatGroups, formatManzanas } from '../utils/helpers.js';

export const renderFullProgramaCards = (programa, container, territoryMap = {}, currentConductorName, activeDayIndex = -1, activeTurns = new Set(['manana', 'tarde', 'noche', 'zoom'])) => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const shifts = ['manana', 'tarde', 'noche', 'zoom'];
    const shiftLabels = { 'manana': 'Mañana', 'tarde': 'Tarde', 'noche': 'Noche', 'zoom': 'Zoom' };
    const shiftIcons = { 'manana': 'fa-sun', 'tarde': 'fa-cloud-sun', 'noche': 'fa-moon', 'zoom': 'fa-video' };
    const shiftColors = { 'manana': 'text-amber-500', 'tarde': 'text-orange-500', 'noche': 'text-indigo-400', 'zoom': 'text-emerald-500' };

    if (!programa || !programa.dias || programa.dias.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-5 animate-fade-in opacity-30 group">
                <div class="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-[3rem] flex items-center justify-center text-4xl mb-2 transition-transform group-hover:scale-110 duration-700">
                    <i class="fas fa-calendar-day"></i>
                </div>
                <div class="space-y-2">
                    <p class="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">No hay actividades para esta semana</p>
                    <p class="text-[10px] text-slate-400 italic font-bold uppercase tracking-widest">Consulta con el responsable del grupo</p>
                </div>
            </div > `;
        return;
    }

    let html = `
        <div class="col-span-full animate-fade-in">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            ${days.map((dayName, dayIdx) => {
        // Filter by activeDayIndex
        if (activeDayIndex !== -1 && activeDayIndex !== dayIdx) return '';

        const d = (programa.dias || []).find(x => x.nombre === dayName);
        if (!d) return '';

        // Check if day has any visible shift
        const hasVisibleData = shifts.some(s => {
            if (!activeTurns.has(s)) return false;
            if (s === 'zoom' && dayName !== 'Martes') return false;
            const sData = d[s];
            return sData && (sData.conductor || sData.lugar || sData.hora);
        });

        if (!hasVisibleData) {
            if (activeDayIndex !== -1) {
                return `
                    <div class="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-30">
                        <i class="fas fa-calendar-day text-4xl mb-4"></i>
                        <p class="text-[10px] font-black uppercase tracking-widest italic">No hay salidas programadas para este día</p>
                    </div>`;
            }
            return '';
        }

        return `
                    <div class="modern-card !p-6 border-slate-100 dark:border-white/10 shadow-xl bg-white dark:bg-slate-900/40 space-y-6 hover:shadow-2xl transition-all duration-500">
                        <div class="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4">
                            <div>
                                <h3 class="font-black text-xl text-slate-800 dark:text-white tracking-tighter uppercase leading-none mb-1">${dayName}</h3>
                                <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">${d?.fecha ? d.fecha.split('-').reverse().join('/') : '-'}</span>
                            </div>
                            <div class="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                                <i class="fas fa-calendar-day"></i>
                            </div>
                        </div>

                        <div class="space-y-4">
                            ${shifts.map(shift => {
            if (!activeTurns.has(shift)) return '';
            if (shift === 'zoom' && dayName !== 'Martes') return '';

            const sData = d ? d[shift] : null;
            if (!sData || (!sData.conductor && !sData.lugar)) return '';

            const isConductor = sData.conductor === currentConductorName;
            const isAuxiliar = sData.auxiliar === currentConductorName;
            const isImpacted = isConductor || isAuxiliar;

            return `
                                <div class="p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] ${isImpacted ? 'ring-2 ring-primary/20 bg-primary/5' : ''}">
                                    <div class="flex items-center justify-between gap-2 mb-3">
                                        <div class="flex items-center gap-2">
                                            <i class="fas ${shiftIcons[shift]} ${shiftColors[shift]} text-[10px]"></i>
                                            <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">${shiftLabels[shift]}</span>
                                        </div>
                                        ${sData.hora ? `
                                        <div class="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full border border-slate-200/50 dark:border-white/5">
                                            <i class="far fa-clock text-[8px] text-slate-400"></i>
                                            <span class="text-[9px] font-black text-slate-600 dark:text-slate-400 tabular-nums">${sData.hora}</span>
                                        </div>` : ''}
                                    </div>
                                    
                                    <div class="space-y-3">
                                        ${sData.lugar ? `
                                            <div class="flex items-start gap-2">
                                                <i class="fas fa-map-marker-alt text-slate-300 mt-1 text-[8px]"></i>
                                                <p class="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase leading-snug">${sData.lugar}</p>
                                            </div>` : ''}

                                        <div class="grid grid-cols-1 gap-1.5">
                                            <div class="flex items-center gap-2">
                                                <div class="w-1 h-3 ${isConductor ? 'bg-primary' : 'bg-slate-300'} rounded-full"></div>
                                                <span class="text-[10px] font-black ${isConductor ? 'text-primary' : 'text-slate-700 dark:text-slate-200'} truncate uppercase">${sData.conductor || '—'}</span>
                                            </div>
                                            ${sData.auxiliar ? `
                                            <div class="flex items-center gap-2">
                                                <div class="w-1 h-2 ${isAuxiliar ? 'bg-indigo-400' : 'bg-slate-200'} rounded-full"></div>
                                                <span class="text-[8px] font-bold ${isAuxiliar ? 'text-indigo-500' : 'text-slate-400'} truncate uppercase">${sData.auxiliar}</span>
                                            </div>` : ''}
                                        </div>

                                        <div class="mt-2 pt-2 border-t border-black/5 dark:border-white/5 space-y-2">
                                            <div class="flex flex-wrap gap-1">
                                                ${isConductor ? `
                                                    <button onclick="window.openTerritorySelector(${dayIdx}, '${shift}', this)" 
                                                            data-current="${sData.territorio || ''}"
                                                            class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-white/10 hover:border-primary/50 transition-all group/tbtn shadow-sm">
                                                        <i class="fas fa-map-location-dot text-[10px] text-primary/40 group-hover/tbtn:text-primary transition-colors"></i>
                                                        <span class="text-[10px] font-black ${sData.territorio ? 'text-primary' : 'text-slate-400 opacity-40'} truncate max-w-[100px] uppercase">
                                                            ${sData.territorio || 'Seleccionar...'}
                                                        </span>
                                                    </button>
                                                ` : `
                                                    ${sData.territorio ? Array.from(new Set(String(sData.territorio).split(/[,;/]/).map(t => t.trim()).filter(Boolean))).map(t => `
                                                        <span class="px-2 py-1 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-black border border-slate-200 dark:border-white/10 uppercase">${t}</span>
                                                    `).join('') : '<span class="text-[9px] font-black text-slate-300 uppercase italic opacity-40">Libre</span>'}
                                                `}
                                            </div>
                                            ${sData.faceta ? `
                                            <div class="flex items-center gap-1.5 opacity-60">
                                                <i class="fas fa-bullhorn text-[8px] text-primary"></i>
                                                <span class="text-[9px] font-black text-primary uppercase tracking-tight">${sData.faceta}</span>
                                            </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>`;
        }).join('')}
                        </div>
                    </div>`;
    }).join('')}
        </div>
    </div>
    `;

    container.innerHTML = html;
};

export const generateLandscapePreviewHTML = (programa) => {
    if (!programa) return '';
    const turnosArr = [
        { id: 'manana', icon: 'fa-sun', label: 'MAÑANA', color: '#b45309', bg: '#fffbeb' },
        { id: 'tarde', icon: 'fa-cloud-sun', label: 'TARDE', color: '#c2410c', bg: '#fff7ed' },
        { id: 'noche', icon: 'fa-moon', label: 'NOCHE', color: '#3730a3', bg: '#f5f3ff' },
        { id: 'zoom', icon: 'fa-video', label: 'ZOOM', color: '#065f46', bg: '#f0fdf4' }
    ];

    const hasBusyDay = (programa.dias || []).some(dia => {
        const active = turnosArr.filter(t => {
            const data = dia[t.id];
            return data && (data.conductor || data.lugar);
        });
        return active.length > 2;
    });

    let html = `
            <div id="landscape-preview-content" class="bg-slate-50 text-slate-900 font-['Outfit'] relative overflow-hidden flex flex-col p-6 pt-0" style="width: 1920px; height: 1080px; box-sizing: border-box;">
                <header class="relative z-10 flex flex-col items-center mb-3 px-10 pt-4 w-full">
                    <h1 class="text-[54px] font-black uppercase tracking-[0.1em] leading-none mb-1 text-slate-900">Programa de Predicación</h1>
                    <p class="text-lg font-black uppercase tracking-[0.15em] text-slate-600 mb-3">Cronograma Semanal de Salidas</p>
                    <div class="w-full h-1.5 bg-slate-900 rounded-full"></div>
                </header>

            <div class="relative z-10 grid grid-cols-7 gap-3 flex-1 overflow-hidden px-4 pb-7">
                ${(programa.dias || []).map((dia, idx) => {
        const activeTurns = turnosArr.filter(t => {
            const data = dia[t.id];
            return data && (data.conductor || data.lugar);
        });

        return `
                        <div class="bg-white rounded-[2rem] flex flex-col shadow-xl shadow-slate-200/40 border border-slate-100/50 overflow-hidden relative h-full">
                            <div class="${hasBusyDay ? 'px-4 py-3 min-h-[100px]' : 'px-5 py-6 min-h-[140px]'} border-b border-slate-50 bg-slate-50/20 shrink-0 flex flex-col justify-center">
                                <h2 class="${hasBusyDay ? 'text-2xl' : 'text-3xl'} font-black uppercase tracking-tighter text-slate-900 leading-none mb-1">${dia.nombre}</h2>
                                <span class="text-[10px] font-bold uppercase tracking-widest text-slate-300 opacity-80">${dia.fecha ? dia.fecha.split('-').reverse().join('/') : ''}</span>
                            </div>
                            
                            <div class="${hasBusyDay ? 'p-2.5 space-y-5' : 'p-4 space-y-10'} flex-1 overflow-visible">
                                ${activeTurns.map(t => {
            const data = dia[t.id];
            const isSunday = dia.nombre.toLowerCase() === 'domingo';
            const hourInt = data.hora ? parseInt(data.hora) : (t.id === 'manana' ? 9 : t.id === 'tarde' ? 15 : 19);

            let labelText = t.label; let displayIcon = t.icon; let displayColor = t.color;

            if (isSunday && data.hora) {
                if (hourInt < 11) { labelText = 'MAÑANA'; displayIcon = 'fa-sun'; displayColor = '#b45309'; }
                else if (hourInt < 16) { labelText = 'MEDIODÍA'; displayIcon = 'fa-cloud-sun'; displayColor = '#c2410c'; }
                else if (hourInt < 19) { labelText = 'TARDE'; displayIcon = 'fa-sun-haze'; displayColor = '#c2410c'; }
                else { labelText = 'NOCHE'; displayIcon = 'fa-moon'; displayColor = '#3730a3'; }
            }

            return `
                                        <div class="${hasBusyDay ? 'space-y-1.5' : 'space-y-4'}">
                                            <div class="flex items-center gap-2">
                                                <i class="fas ${displayIcon} text-[18px]" style="color: ${displayColor}"></i>
                                                <span class="text-[18px] font-black uppercase tracking-[0.35em]" style="color: ${displayColor}">${labelText}</span>
                                            </div>
                                            
                                            <div class="${hasBusyDay ? 'space-y-1' : 'space-y-3'}">
                                                ${['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos'].map(field => {
                if (t.id === 'zoom' && field === 'Auxiliar') return '';
                let val = data[field.toLowerCase()];
                if (!val || val === '—' || val === '') return '';
                if (field === 'Grupos') { val = formatGroups(val); }
                const isKeyField = field === 'Lugar' || field === 'Hora';
                const fontSize = isKeyField ? (hasBusyDay ? '17px' : '22px') : (hasBusyDay ? '13px' : '15px');
                return `
                                                        <div class="flex flex-col leading-tight">
                                                             <span class="text-[6px] font-black uppercase tracking-widest text-slate-300 mb-0.5">${field}</span>
                                                             <span class="text-[${fontSize}] font-black uppercase tracking-tight text-slate-900">${val}</span>
                                                        </div>
                                                    `;
            }).join('')}
                                            </div>
                                        </div>
                                    `;
        }).join('')}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
    return html;
};
