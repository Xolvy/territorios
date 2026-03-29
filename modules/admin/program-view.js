import {
    getTerritorios, getConfiguracion, getPublicadores,
    getProgramaSemanal, saveProgramaSemanal, getGroupsConfig, returnTerritorioMultiple,
    getHistorialReport, returnTerritorioParcial, startLivePool,
    returnTerritorio, syncSlotWithTerritories, importProgramFromJSON, formalizeWeek
} from '../../data/firestore-services.js';
import { extractProgramFromImage } from '../services/ai-vision-service.js';
import { showNotification, formatGroups, getBaseTerritoryNumber, normalize } from '../utils/helpers.js';
import { UIHelpers, showModal, showTerritorySelectionModal, showCustomConfirm } from '../services/ui-helpers.js';
import { generateProgramPNG } from './program-generator.js';
import { db } from '../../firebase-config.js';
import { where, documentId, collection, getDocs } from "firebase/firestore";

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

/**
 * 🕵️‍♂️ SMART VALIDATION (NEXO AI CROSS-CHECK)
 * Evalúa la coherencia entre Jornada, Hora y Faceta.
 */
const checkIncongruences = (turnoId, hora, faceta) => {
    const findings = [];
    const t = (turnoId || '').toLowerCase();
    const h = (hora || '').toLowerCase();
    const f = (faceta || '').toLowerCase();

    // Regla A: Tiempo (AM en turnos de Noche estrictamente)
    if (t.includes('noche') && h.includes('am')) {
        findings.push("Horario AM en jornada nocturna");
    }

    // Regla B: Física vs Virtual (Casa en casa/Calles en Zoom)
    // FIXED: Telefonica y Cartas son COMPATIBLES con Zoom.
    if (t.includes('zoom') && (f.includes('casa') || f.includes('calle') || f.includes('negocio') || f.includes('carritos') || f.includes('digital (físico)'))) {
        findings.push("Faceta física en jornada virtual (Zoom)");
    }

    // Regla C: Eliminada (Telefónica/Cartas ahora es válida en cualquier jornada, sea Mañana, Tarde o Noche)

    return findings;
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

    const [rawTerritorios, config, , historial] = await Promise.all([
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

    window._pickerStateDate = new Date(currentWeekStart);

    window.openWeekSelector = () => {
        window._pickerStateDate = new Date(currentWeekStart);
        renderWeekSelectorModal();
    };

    const renderWeekSelectorModal = () => {
        const modalDiv = document.getElementById('modal-container');
        modalDiv.classList.remove('hidden');

        const year = window._pickerStateDate.getFullYear();
        const month = window._pickerStateDate.getMonth();
        const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(window._pickerStateDate).toUpperCase();
        
        const weeksHTML = [];
        let d = new Date(year, month, 1);
        const firstDay = d.getDay() || 7;
        d.setDate(d.getDate() - (firstDay - 1));
        
        for(let i = 0; i < 6; i++) {
            if (d.getMonth() > month && d.getFullYear() >= year) break;
            if (d.getFullYear() > year) break;
            
            const monday = new Date(d);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            
            const labelStr = `${monday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — ${sunday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`.toUpperCase();
            
            // Re-normalize hours for pure date comparison
            const mTime = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()).getTime();
            const currTime = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate()).getTime();
            const isCurrent = (mTime === currTime);
            
            weeksHTML.push(`
                <button onclick="window.selectWeekFromPicker(${monday.getTime()})" class="w-full p-4 rounded-2xl border ${isCurrent ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-white/5'} transition-all flex items-center justify-between group">
                    <span class="text-[11px] font-black uppercase tracking-widest">${labelStr}</span>
                    <i class="fas fa-check text-primary ${isCurrent ? 'opacity-100' : 'opacity-0'}"></i>
                </button>
            `);
            d.setDate(d.getDate() + 7);
        }

        modalDiv.innerHTML = `
            <div class="p-8 space-y-6 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] max-w-sm w-full shadow-2xl animate-scale-in flex flex-col mx-auto my-auto relative">
                <header class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                    <button onclick="window.navPickerMonth(-1)" class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors flex items-center justify-center">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <div class="text-center">
                        <h3 class="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">${monthName}</h3>
                    </div>
                    <button onclick="window.navPickerMonth(1)" class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors flex items-center justify-center">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </header>
                <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    ${weeksHTML.join('')}
                </div>
                <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full py-4 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all mt-2">Cerrar</button>
            </div>
        `;
    };

    window.navPickerMonth = (dir) => {
        window._pickerStateDate.setMonth(window._pickerStateDate.getMonth() + dir);
        renderWeekSelectorModal();
    };

    window.selectWeekFromPicker = (timeMs) => {
        document.getElementById('modal-container').classList.add('hidden');
        currentWeekStart = new Date(timeMs);
        loadWeekData();
    };

    container.innerHTML = `
        <div class="max-w-[1700px] mx-auto space-y-12 animate-fade-in pb-10">
            <!-- Header Clean Aesthetic -->
            <header class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-2 border-b border-slate-100 dark:border-white/5">
                <div class="flex flex-col">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-widest rounded border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-400/20">Operational Planning</span>
                        <div class="h-px w-8 bg-slate-200 dark:bg-white/10"></div>
                    </div>
                    <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Programa Semanal</h2>
                    <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Sincronización de territorios y salidas de campo</p>
                </div>

                <div class="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-white/10 shadow-sm">
                     <button id="btn-prev-week" class="p-3.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all text-slate-400 hover:text-indigo-600 active:scale-95">
                        <i class="fas fa-arrow-left text-xs"></i>
                     </button>
                     <button onclick="window.openWeekSelector()" class="px-6 py-2.5 min-w-[180px] flex flex-col items-center justify-center gap-0.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all group active:scale-95">
                         <span id="week-range-label" class="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Cargando Semana...</span>
                         <span class="text-[8px] text-slate-400 font-medium uppercase tracking-tighter">Calendario Maestro <i class="fas fa-chevron-down ml-1 text-[7px] opacity-50"></i></span>
                     </button>
                     <button id="btn-next-week" class="p-3.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all text-slate-400 hover:text-indigo-600 active:scale-95">
                        <i class="fas fa-arrow-right text-xs"></i>
                     </button>
                </div>
            </header>

                    <!-- Premium Toolbar -->
                    <nav data-adaptive-wrap="true" class="flex flex-wrap items-center gap-3 w-full lg:w-max">
                        <div class="flex items-center gap-2">
                            <button id="action-formalizar-prog" class="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm shadow-emerald-200 active:scale-95 group flex items-center gap-2">
                                <i class="fas fa-bolt-lightning text-emerald-200 group-hover:scale-110 transition-transform"></i> Formalizar
                            </button>
                            <button id="action-recepcion-prog" class="px-5 py-3.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 hover:border-rose-500 hover:text-rose-600 transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 group">
                                <i class="fas fa-inbox opacity-40 group-hover:opacity-100"></i> Recepción
                            </button>
                        </div>

                        <div class="toolbar-divider hidden md:block"></div>

                        <div class="flex items-center gap-2">
                            <button id="action-escanear-prog" class="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm shadow-indigo-200 active:scale-95 group flex items-center gap-2">
                                <i class="fas fa-wand-magic-sparkles text-indigo-200 group-hover:scale-110 transition-transform"></i> Nexo Vision
                            </button>
                            <button id="action-replicar-prog" class="px-5 py-3.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-500 hover:text-indigo-600 transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 group">
                                <i class="fas fa-clone opacity-40 group-hover:opacity-100"></i> Replicar
                            </button>
                        </div>

                        <div style="flex-grow: 1" class="hidden xl:block"></div>

                        <!-- Export Action -->
                        <button id="action-exportar-prog" class="px-6 py-3.5 bg-slate-900 dark:bg-white/10 hover:bg-slate-800 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 group flex items-center gap-2">
                            <i class="fas fa-share-nodes opacity-70"></i> Compartir
                            <i class="fas fa-chevron-down ml-1 text-[7px] opacity-40 group-hover:translate-y-0.5 transition-transform"></i>
                        </button>
                            <div id="export-menu-options" class="absolute right-0 top-full mt-3 min-w-[220px] bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-white/10 p-2 z-[99] origin-top-right transition-all duration-300 transform scale-95 opacity-0 pointer-events-none data-[visible=true]:scale-100 data-[visible=true]:opacity-100 data-[visible=true]:pointer-events-auto">
                                <button id="btn-export-xls-prog" class="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-emerald-500 rounded-xl transition-all text-left">
                                    <i class="fas fa-file-excel text-emerald-500 text-sm"></i>
                                    Programa Excel
                                </button>
                                <div class="h-px bg-slate-100 dark:bg-white/5 my-1 mx-2"></div>
                                <button id="btn-export-png-cond-new" class="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-indigo-500 rounded-xl transition-all text-left">
                                    <i class="fas fa-user-tie text-indigo-500 text-sm"></i>
                                    Formato Conductor
                                </button>
                                <button id="btn-export-png-pub-new" class="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-indigo-500 rounded-xl transition-all text-left">
                                    <i class="fas fa-users text-emerald-500 text-sm"></i>
                                    Formato Publicador
                                </button>
                            </div>
                        </div>
                    </nav>
                </div>
            </header>

            <!-- Nexo AI Progress HUD -->
            <div id="ai-scanning-overlay" class="absolute inset-0 backdrop-blur-md z-[9999] flex items-center justify-center hidden animate-fade-in nexo-loading-overlay" style="background:radial-gradient(ellipse at center,rgba(15,15,35,0.78)0%,rgba(5,5,20,0.90)100%);">
                <div style="position:absolute;top:-10%;left:-8%;width:420px;height:420px;background:radial-gradient(circle,rgba(99,102,241,0.20)0%,transparent 70%);border-radius:50%;filter:blur(40px);pointer-events:none;"></div>
                <div style="position:absolute;bottom:-15%;right:-5%;width:500px;height:500px;background:radial-gradient(circle,rgba(139,92,246,0.18)0%,transparent 70%);border-radius:50%;filter:blur(50px);pointer-events:none;"></div>
                <div style="position:absolute;top:15%;right:6%;width:280px;height:280px;background:radial-gradient(circle,rgba(34,211,238,0.09)0%,transparent 70%);border-radius:50%;filter:blur(35px);pointer-events:none;"></div>
                <div style="position:absolute;bottom:20%;left:4%;width:220px;height:220px;background:radial-gradient(circle,rgba(244,114,182,0.07)0%,transparent 70%);border-radius:50%;filter:blur(30px);pointer-events:none;"></div>
                <div class="relative mx-4 w-full max-w-sm p-10 text-center animate-scale-in nexo-modal-box" style="background:rgba(255,255,255,0.05);backdrop-filter:blur(24px);border-radius:2.5rem;border:1px solid rgba(255,255,255,0.10);box-shadow:0 0 0 1px rgba(99,102,241,0.18),0 40px 80px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.07);">
                    <div style="position:absolute;inset:0;border-radius:2.5rem;background:radial-gradient(ellipse at top,rgba(99,102,241,0.09)0%,transparent 60%);pointer-events:none;"></div>
                    <div class="relative w-24 h-24 mx-auto mb-8">
                        <div class="absolute inset-0 rounded-full" style="border:4px solid rgba(99,102,241,0.12);"></div>
                        <div class="absolute inset-2 rounded-full animate-spin" style="border:4px solid transparent;border-top-color:#6366f1;"></div>
                        <div class="absolute inset-5 rounded-full animate-spin" style="border:2px solid transparent;border-bottom-color:#a78bfa;animation-direction:reverse;animation-duration:1.4s;"></div>
                        <div class="absolute inset-0 flex items-center justify-center text-2xl" style="color:#818cf8;">
                            <i class="fas fa-wand-magic-sparkles animate-pulse"></i>
                        </div>
                    </div>
                    <h3 class="text-xl font-black uppercase tracking-wider mb-2" style="color:#fff;text-shadow:0 0 24px rgba(99,102,241,0.55);">Nexo Vision AI</h3>
                    <p class="font-bold text-xs uppercase tracking-widest animate-pulse" style="color:rgba(148,163,184,0.75);">Analizando imagen de programación...</p>
                    <div class="mt-6 h-0.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.06);">
                        <div class="h-full rounded-full animate-pulse" style="width:65%;background:linear-gradient(90deg,#6366f1,#a78bfa);box-shadow:0 0 10px rgba(99,102,241,0.8);"></div>
                    </div>
                </div>
            </div>



            <div id="day-selector-container" class="flex flex-wrap items-center justify-center gap-2 mt-8 animate-fade-in" data-adaptive-scroll="true"></div>

            <div class="relative group min-h-[500px]">
                <div class="modern-card !p-0 border-0 bg-transparent shadow-none" id="admin-prog-table">
                    <div class="h-[500px] bg-slate-200/50 dark:bg-white/5 rounded-[3rem] animate-pulse"></div>
                </div>

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
        try {
            const weekId = formatDateId(currentWeekStart);

            // Xolvy Live Pool: Dynamic week synchronization
            if (programUnsub) { programUnsub(); programUnsub = null; }
            programUnsub = startLivePool("programa_semanal", [where(documentId(), "==", weekId)], (data) => {
                const btnFormalizar = container.querySelector('#action-formalizar-prog');

                if (data.length > 0 && data[0].dias) {
                    programa = data[0];
                    // Sync dates
                    programa.dias.forEach((dia, idx) => {
                        const expectedDate = new Date(currentWeekStart);
                        expectedDate.setDate(expectedDate.getDate() + idx);
                        dia.fecha = formatDateId(expectedDate);
                        
                        // Xolvy Robust: Ensure all mandatory turns exist in each day even if empty
                        ['manana', 'tarde', 'noche'].forEach(tId => {
                            if (!dia[tId]) dia[tId] = {};
                        });
                        if (dia.nombre === 'Martes' && !dia.zoom) dia.zoom = {};
                    });
                    
                    // Actualizar estado del botón Formalizar
                    if (programa.isFormalized && btnFormalizar) {
                        btnFormalizar.disabled = true;
                        btnFormalizar.innerHTML = '<i class="fas fa-check-double mr-2"></i> Formalizado';
                        btnFormalizar.className = btnFormalizar.className.replace('bg-emerald-500', 'bg-slate-400').replace('hover:bg-emerald-600', '');
                    } else if (btnFormalizar) {
                        btnFormalizar.disabled = false;
                        btnFormalizar.innerHTML = '<i class="fas fa-project-diagram group-hover:rotate-12 transition-transform"></i> Formalizar';
                        if (!btnFormalizar.className.includes('bg-emerald-500')) {
                            btnFormalizar.className = btnFormalizar.className.replace('bg-slate-400', 'bg-emerald-500');
                        }
                    }

                    console.log(`📅 [Live Pool] Week ${weekId} Updated.`);
                } else {
                    // Reset Button
                    if (btnFormalizar) {
                        btnFormalizar.disabled = false;
                        btnFormalizar.innerHTML = '<i class="fas fa-project-diagram group-hover:rotate-12 transition-transform"></i> Formalizar';
                    }

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
            });
            // setAdminLivePool(programUnsub); // This line was removed as per the instruction's implied change.

        } catch (error) {
            console.error(error);
            showNotification("Error cargando programa", "error");
        }
    };

    // --- AI SCAN MEMORY INPUT (ATTACHED FOR IOS) ---
    let memoryScannerInput = document.getElementById('ai-scanner-input-global');
    if (!memoryScannerInput) {
        memoryScannerInput = document.createElement('input');
        memoryScannerInput.id = 'ai-scanner-input-global';
        memoryScannerInput.type = 'file';
        memoryScannerInput.accept = 'image/png, image/jpeg, image/webp';
        memoryScannerInput.style.position = 'absolute';
        memoryScannerInput.style.opacity = '0';
        memoryScannerInput.style.pointerEvents = 'none';
        document.body.appendChild(memoryScannerInput);
    }
    
    // Always clear old listeners to prevent duplicates on remount
    const clone = memoryScannerInput.cloneNode(true);
    memoryScannerInput.parentNode.replaceChild(clone, memoryScannerInput);
    memoryScannerInput = clone;

    const aiOverlay = container.querySelector('#ai-scanning-overlay');

    memoryScannerInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        aiOverlay?.classList.remove('hidden');
        document.body.classList.add('modal-open');

        try {
            // Fase 1: Extracción con Vision API
            const extractedData = await extractProgramFromImage(file);
            aiOverlay?.classList.add('hidden');
            document.body.classList.remove('modal-open');

            // Fase 2: Confirmación de Sobrescritura
            showCustomConfirm('Se han extraído los datos exitosamente. Al aplicar, se sobrescribirá TODA la semana actual. ¿Deseas continuar?', async () => {
                const weekId = formatDateId(currentWeekStart);
                showNotification("Importando datos...", "info");
                
                await importProgramFromJSON(weekId, extractedData);
                
                showNotification("Programa importado con éxito por Nexo AI", "success");
                loadWeekData(); // Refrescar vista
            });

        } catch (err) {
            console.error("❌ AI Scan Error:", err);
            aiOverlay?.classList.add('hidden');
            document.body.classList.remove('modal-open');
            showModal(`
                <div class="p-8 text-center space-y-6">
                    <div class="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-xl">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Fallo en Visión IA</h2>
                    <p class="text-slate-500 dark:text-slate-400 font-bold text-sm max-w-sm mx-auto">No se pudo leer la tabla con claridad. Por favor, sube una imagen con mejor resolución o mayor contraste.</p>
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all">Entendido</button>
                </div>
            `);
        } finally {
            memoryScannerInput.value = ''; // Reset input
        }
    });

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
        const [freshTerritorios, freshPersonnel, freshGroupsCfg] = await Promise.all([getTerritorios(), getPublicadores(), getGroupsConfig()]);
        const tableContainer = container.querySelector('#admin-prog-table');

        if (!programa || !programa.dias || programa.dias.length === 0) {
            programa = {
                id: formatDateId(currentWeekStart),
                dias: dayNames.map((name, idx) => {
                    const dayDate = new Date(currentWeekStart);
                    dayDate.setDate(dayDate.getDate() + idx);
                    return { nombre: name, fecha: formatDateId(dayDate) };
                })
            };
        }

        territorios.length = 0;
        territorios.push(...freshTerritorios);

        const activeConductorsFresh = freshPersonnel.filter(p => p.es_conductor && p.nombre).sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
        
        // Cache for modal
        window._progCache = { activeConductors: activeConductorsFresh, territorios, config, dayNames, grupos: freshGroupsCfg };

        let html = `<div class="flex flex-col gap-8 md:gap-12 pb-24 max-w-4xl mx-auto">`;
        
        programa.dias.forEach((dia, dayIndex) => {
            if (activeDayIndex !== -1 && activeDayIndex !== dayIndex) return;

            // Remove empty initializations that forced hardcoded views
            // Build dynamic turno list solely from DB properties
            const allTurnoIds = Object.keys(dia).filter(k => k !== 'nombre' && k !== 'fecha');
            
            // Filter out slots that have no actual data (e.g. empty strings)
            const activeTurnos = allTurnoIds.filter(id => {
                const data = dia[id];
                if (!data) return false;
                return Object.values(data).some(val => val !== "" && val !== null && val !== undefined && val !== false);
            });
            
            const sortOrder = { 'manana': 1, 'tarde': 2, 'noche': 3, 'zoom': 4 };
            const getOrder = (id) => sortOrder[id.split('_')[0]] || 99;
            activeTurnos.sort((a, b) => getOrder(a) - getOrder(b) || a.localeCompare(b));
            
            const turnos = activeTurnos.map(id => ({ id }));

            html += `
                <div class="day-group animate-fade-in relative">
                    <!-- Header Día Normal -->
                    <div class="py-4 mb-4 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                        <div>
                            <h4 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">${dia.nombre}</h4>
                            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">${dia.fecha}</p>
                        </div>
                        <div class="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent ml-6"></div>
                    </div>
                    
                    <div class="flex flex-col rounded-2xl md:rounded-3xl border border-slate-200/60 dark:border-white/5 bg-white dark:bg-white/[0.02] shadow-sm overflow-hidden">
            `;

            turnos.forEach(t => {
                const turnoId = t.id;
                const baseId = turnoId.split('_')[0]; // 'manana_2' → 'manana'
                if (baseId === 'zoom' && dia.nombre !== 'Martes') return;
                if (!activeTurns.has(baseId)) return;

                const data = dia[turnoId] || {};
                const styling = getTurnoStyling(baseId, data.hora);
                const hasData = data.conductor || data.territorio || data.grupos || data.faceta || data.lugar;

                // Status logic for territory badge
                let statusBadgeHTML = '';
                if (data.territorio) {
                     const results = Array.from(new Set(String(data.territorio).split(/[,;/]/).map(n => n.trim()).filter(Boolean))).map(n => getTStatus(n, data.conductor, dia.fecha, turnoId));
                     const conflict = results.find(r => r.isConflict);
                     if (conflict) {
                         statusBadgeHTML = `<span class="inline-flex items-center rounded bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-black text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-600/20 uppercase tracking-widest animate-pulse ml-1"><i class="fas fa-exclamation-triangle mr-1"></i>Ocup</span>`;
                     }
                }

                html += `
                    <div onclick="window.openEditTurnoSheet(${dayIndex}, '${turnoId}')" 
                         class="flex flex-col sm:flex-row sm:items-center gap-4 p-4 md:p-6 border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors active:bg-slate-100 w-full min-h-[56px] select-none group/row relative">
                        
                        ${(() => {
                            const warnings = checkIncongruences(turnoId, data.hora, data.faceta);
                            return warnings.length > 0 ? `
                                <div class="absolute top-2 right-12 text-amber-500 animate-pulse drop-shadow-sm" title="${warnings.join(', ')}">
                                    <i class="fas fa-exclamation-triangle text-[10px]"></i>
                                </div>
                            ` : '';
                         })()}

                        <div class="flex items-center gap-4 min-w-[140px] shrink-0">
                            <div class="w-10 h-10 ${styling.bg} ${styling.color} rounded-xl flex items-center justify-center text-sm shadow-inner shrink-0 transition-transform group-hover/row:scale-110">
                                <i class="fas ${styling.icon}"></i>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-[11px] font-black tracking-widest uppercase text-slate-800 dark:text-gray-200">${styling.label}</span>
                                <span class="text-[10px] font-bold text-slate-400 mt-0.5">${data.hora || 'Sin hora'}</span>
                            </div>
                        </div>

                        <div class="flex-1 flex flex-col gap-2 md:gap-1 pl-[56px] sm:pl-0">
                            ${hasData ? `
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="text-sm font-black text-slate-900 dark:text-white uppercase">${data.conductor || 'Sin Asignar'}</span>
                                    ${data.auxiliar ? `<span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">+ ${data.auxiliar}</span>` : ''}
                                </div>
                                <div class="flex flex-wrap items-center gap-1.5 mt-1">
                                    ${data.lugar ? `<span class="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[9px] font-black text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-white/5 uppercase tracking-widest"><i class="fas fa-map-marker-alt mr-1 text-[7px] opacity-50"></i>${data.lugar}</span>` : ''}
                                    ${data.faceta ? `<span class="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-[9px] font-black text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/20 uppercase tracking-widest">${data.faceta}</span>` : ''}
                                    ${data.territorio ? `<span class="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/10 dark:ring-emerald-400/20 uppercase tracking-widest">Terr: ${data.territorio}</span>${statusBadgeHTML}` : ''}
                                    ${data.grupos ? `<span class="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[9px] font-black text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-700/10 dark:ring-indigo-400/20 uppercase tracking-widest">${formatGroups(data.grupos)}</span>` : ''}
                                </div>
                            ` : `
                                <span class="text-[11px] font-bold italic text-slate-400 opacity-60">Turno vacío. Toque para asignar.</span>
                            `}
                        </div>
                        
                        <div class="hidden sm:flex items-center justify-end text-slate-300 dark:text-slate-600 opacity-50 group-hover/row:opacity-100 transition-all gap-4">
                            <button onclick="event.stopPropagation(); window.clearTurnData(${dayIndex}, '${turnoId}')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-500 hover:text-white transition-all text-slate-400 md:text-rose-400" title="Eliminar Horario">
                                <i class="fas fa-trash-alt text-[11px]"></i>
                            </button>
                            <i class="fas fa-chevron-right text-[10px] group-hover/row:translate-x-1 transition-transform"></i>
                        </div>
                        
                        <!-- Mobile Delete Button (Visible only on small screens) -->
                        <div class="sm:hidden absolute top-4 right-4">
                            <button onclick="event.stopPropagation(); window.clearTurnData(${dayIndex}, '${turnoId}')" class="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                                <i class="fas fa-trash-alt text-[11px]"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            html += `
                <div onclick="window.addNewSlot(${dayIndex})" class="flex items-center justify-center p-4 min-h-[56px] cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-400 hover:text-indigo-500 border-t border-slate-100 dark:border-white/5 border-dashed m-1.5 rounded-[1.5rem]">
                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 group">
                        <i class="fas fa-plus group-hover:scale-125 transition-transform"></i>
                        <span>Agregar Horario</span>
                    </div>
                </div>
            `;
            html += `</div></div>`;
        });
        html += `</div>`;
        tableContainer.innerHTML = html;
    };

    window.openEditTurnoSheet = (dayIdx, turnoId) => {
        const dia = programa.dias[dayIdx];
        const data = dia[turnoId] || {};
        const styling = getTurnoStyling(turnoId, data.hora);
        const isWeekend = dia.nombre === 'Sábado' || dia.nombre === 'Domingo';
        const fields = ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', ...(isWeekend && turnoId !== 'zoom' ? ['Grupos'] : []), ...(turnoId !== 'zoom' ? ['Territorio'] : [])];
        const localOptions = {
            Lugar: window._progCache.config.lugares || ['Salón del Reino'],
            Hora: window._progCache.config.horarios_programa || ['09:00', '15:00', '19:00'],
            Conductor: window._progCache.activeConductors.map(c => c.nombre),
            Auxiliar: window._progCache.activeConductors.map(p => p.nombre),
            Faceta: window._progCache.config.facetas || ['Casa en casa', 'Carritos'],
            Territorio: window._progCache.territorios.map(t => t.numero)
        };

        let fieldsHTML = fields.map(field => {
            const fieldId = field.toLowerCase();
            const val = data[fieldId] || '';
            const icon = getFieldIcon(field);
            
            if (field === 'Territorio') {
                return `
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center justify-between">
                            <span><i class="fas fa-map-marked-alt opacity-30 mr-1"></i> ${field}</span>
                        </label>
                        <div onclick="window.openTerritorySelector(${dayIdx}, '${turnoId}', this);" 
                             data-current="${val}"
                             class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-4 rounded-xl hover:border-primary transition-all flex items-center justify-between shadow-sm cursor-pointer block-scale-click">
                            <span id="val-territorio-modal" class="text-[12px] font-black truncate ${val ? 'text-primary' : 'text-slate-400 opacity-40'}">${val || '—'}</span>
                            <i class="fas fa-search text-slate-300"></i>
                        </div>
                        <input type="hidden" id="select-territorio" value="${val}">
                    </div>`;

            } else if (field === 'Grupos') {
                const currentGroups = val.split(',').map(g => g.trim()).filter(Boolean);
                const baseGrupos = window._progCache.grupos || [];
                const gList = [{nombre:'Todos'}].concat(baseGrupos);
                const displayText = currentGroups.length > 0 ? currentGroups.join(', ') : '-';
                
                const dropHtml = gList.map((g) => {
                    const gName = g.nombre.replace(/grupos?/gi, '').trim();
                    const groupStr = gName === 'Todos' ? 'Todos' : (gName.toLowerCase().startsWith('grupo') ? gName : `Grupo ${gName}`);
                    
                    const isChecked = currentGroups.some(c => c.toLowerCase() === groupStr.toLowerCase() || c === gName || c === `Grupo ${gName}`);
                    
                    return `
                        <label class="flex items-center p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors group/chk">
                            <div class="relative w-5 h-5 flex items-center justify-center shrink-0">
                                <input type="checkbox" value="${gName}" ${isChecked?'checked':''} onchange="window.handleSheetGroupToggle(this)" class="group-checkbox absolute opacity-0 inset-0 z-10 cursor-pointer w-full h-full">
                                <div class="w-4 h-4 rounded border-2 border-slate-300 dark:border-white/20 ${isChecked ? 'bg-primary border-primary' : ''} flex items-center justify-center transition-all peer-ui">
                                    <i class="fas fa-check text-[8px] text-white transition-opacity" style="opacity: ${isChecked ? '1' : '0'};"></i>
                                </div>
                            </div>
                            <span class="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 ml-3 group-hover/chk:text-primary transition-colors">${groupStr}</span>
                        </label>`;
                }).join('');

                return `
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center justify-between">
                            <span><i class="fas fa-users-cog opacity-30 mr-1"></i> ${field}</span>
                        </label>
                        <div class="custom-multiselect relative" id="sheet-groups-container">
                            <div onclick="window.toggleSheetGroupDropdown(event)" class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-4 rounded-xl hover:border-primary transition-all flex items-center justify-between shadow-sm cursor-pointer block-scale-click min-h-[52px]">
                                <span id="selected-groups-text" class="text-[12px] font-black truncate pr-4 ${currentGroups.length ? 'text-primary' : 'text-slate-400 opacity-40'}">${displayText}</span>
                                <i class="fas fa-chevron-down text-[10px] text-slate-400 opacity-50 transition-transform duration-300 pointer-events-none" id="groups-dropdown-icon"></i>
                            </div>
                            <div id="sheet-groups-dropdown" class="hidden absolute left-0 right-0 bottom-full mb-1 bg-white dark:bg-[#151a26] border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_-15px_35px_-10px_rgba(0,0,0,0.3)] dark:shadow-none z-50 max-h-56 overflow-y-auto custom-scrollbar p-2 animate-scale-in origin-bottom">
                                ${dropHtml}
                            </div>
                        </div>
                        <input type="hidden" id="select-grupos" value="${val}">
                    </div>`;

            } else if (field === 'Conductor' || field === 'Auxiliar') {
                const effectiveShiftId = getEffectiveShiftId(turnoId, data.hora);
                const availKey = `${dia.nombre}_${effectiveShiftId}`;
                const safeCheck = (disp) => (Array.isArray(disp) ? disp : []).includes(availKey);
                const available = window._progCache.activeConductors.filter(e => safeCheck(e.disponibilidad));
                const nonAvailable = window._progCache.activeConductors.filter(e => !safeCheck(e.disponibilidad));
                const finalOpts = [
                    ...available.map(c => ({ name: c.nombre, isAvail: true })),
                    ...nonAvailable.map(c => ({ name: c.nombre, isAvail: false }))
                ];

                return `
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                            <i class="fas ${icon} opacity-30"></i> ${field}
                        </label>
                        <div class="relative">
                            <select id="select-${fieldId}" 
                                    onchange="window.updateWeekDataSheet(${dayIdx}, '${turnoId}', '${fieldId}', this.value)" 
                                    class="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 py-5 px-4 rounded-xl text-[12px] font-black text-slate-700 dark:text-white outline-none focus:border-primary appearance-none cursor-pointer shadow-sm transition-all focus:ring-1 focus:ring-primary/20 min-h-[52px]">
                                <option value="">—</option>
                                ${finalOpts.map(o => `<option value="${o.name}" ${val === o.name ? 'selected' : ''} class="${o.isAvail ? 'text-emerald-500 font-bold' : ''}">${o.isAvail ? '✅ ' : ''}${o.name}</option>`).join('')}
                            </select>
                            <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] opacity-20 pointer-events-none"></i>
                        </div>
                    </div>`;
            } else {
                return `
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                            <i class="fas ${icon} opacity-30"></i> ${field}
                        </label>
                        <div class="relative">
                            <select id="${fieldId === 'lugar' || fieldId === 'hora' ? 'input-' + fieldId : 'select-' + fieldId}" 
                                    onchange="window.updateWeekDataSheet(${dayIdx}, '${turnoId}', '${fieldId}', this.value)" 
                                    class="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 py-5 px-4 rounded-xl text-[12px] font-black text-slate-700 dark:text-white outline-none focus:border-primary appearance-none cursor-pointer shadow-sm transition-all focus:ring-1 focus:ring-primary/20 min-h-[52px]">
                                <option value="">—</option>
                                ${localOptions[field].map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
                            </select>
                            <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] opacity-20 pointer-events-none"></i>
                        </div>
                    </div>`;
            }
        }).join('');

        const modalDiv = document.getElementById('modal-container');
        modalDiv.classList.remove('hidden');
        document.body.classList.add('overflow-hidden'); // Lock scroll

        const incongruences = checkIncongruences(turnoId, data.hora, data.faceta);

        modalDiv.innerHTML = `
            <div onclick="window.hideModal('modal-container')" class="absolute inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm z-0"></div>
            <div id="modal-sheet" onclick="event.stopPropagation()" class="relative w-[95vw] h-[90vh] max-h-[90vh] md:w-[540px] md:h-auto bg-white dark:bg-[#0a0f18] rounded-2xl md:rounded-[3rem] shadow-2xl flex flex-col overflow-y-auto z-50 transition-all duration-300 mx-auto my-auto custom-scrollbar">
                <div class="w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mt-4 mb-2 md:hidden shrink-0"></div>
                
                <header class="px-6 md:px-8 py-4 flex flex-col shrink-0 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#0a0f18]">
                    <div class="flex items-center justify-between w-full mb-1">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 ${styling.bg} ${styling.color} rounded-xl flex items-center justify-center shadow-inner">
                                <i class="fas ${styling.icon}"></i>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h3 class="text-[10px] font-black uppercase text-slate-400 tracking-widest">${dia.nombre}</h3>
                                    <span class="text-xs opacity-20">•</span>
                                    
                                    <!-- Custom Premium Dropdown -->
                                    <div class="relative inline-block">
                                        <button onclick="window.toggleJornadaDropdown(event)" 
                                                class="group flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-white/[0.05] rounded-full hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200/50 dark:border-white/5 transition-all active:scale-95 shadow-sm">
                                            <span id="modal-shift-label" class="text-[12px] font-black uppercase text-slate-800 dark:text-white tracking-tight">${styling.label}</span>
                                            <i class="fas fa-chevron-down text-[8px] opacity-30 group-hover:opacity-100 transition-opacity"></i>
                                        </button>
                                        
                                        <div id="jornada-dropdown" class="absolute top-full left-0 mt-3 w-40 bg-white dark:bg-[#151a26] rounded-[1.2rem] shadow-[0_15px_50px_-10px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-white/10 hidden z-[110] overflow-hidden backdrop-blur-xl animate-scale-in origin-top-left">
                                            ${[
                                                { id: 'manana', label: 'Mañana', icon: 'fa-sun', color: 'text-amber-500', bg: 'bg-amber-500/10' },
                                                { id: 'tarde', label: 'Tarde', icon: 'fa-cloud-sun', color: 'text-orange-500', bg: 'bg-orange-500/10' },
                                                { id: 'noche', label: 'Noche', icon: 'fa-moon', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                                                { id: 'zoom', label: 'Zoom', icon: 'fa-video', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
                                            ].map(opt => `
                                                <button onclick="window.selectJornada(${dayIdx}, '${turnoId}', '${opt.id}')" 
                                                        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-50 dark:border-white/5 last:border-0 group/opt">
                                                    <div class="w-7 h-7 ${opt.bg} ${opt.color} rounded-lg flex items-center justify-center text-[10px] group-hover/opt:scale-110 transition-transform">
                                                        <i class="fas ${opt.icon}"></i>
                                                    </div>
                                                    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">${opt.label}</span>
                                                </button>
                                            `).join('')}
                                        </div>
                                        <input type="hidden" id="select-turno-id" value="${turnoId.includes('zoom') ? 'zoom' : (turnoId.includes('noche') ? 'noche' : (turnoId.includes('tarde') ? 'tarde' : 'manana'))}">
                                    </div>
                                </div>
                                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">${dia.fecha}</p>
                            </div>
                        </div>
                        
                        <div class="flex gap-2">
                            <button onclick="window.clearTurnData(${dayIdx}, '${turnoId}'); document.getElementById('modal-sheet-close').click();" class="w-10 h-10 min-h-[44px] rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                                <i class="fas fa-trash-alt text-[12px]"></i>
                            </button>
                            <button id="modal-sheet-close" class="w-10 h-10 min-h-[44px] rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-all">
                                <i class="fas fa-times text-[14px]"></i>
                            </button>
                        </div>
                    </div>

                    ${incongruences.length > 0 ? `
                        <div class="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 animate-pulse">
                            <i class="fas fa-exclamation-triangle text-amber-500 text-xs"></i>
                            <div class="flex flex-col">
                                <p class="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Incongruencia detectada</p>
                                <p class="text-[8px] text-amber-500 font-bold leading-tight mt-0.5">${incongruences.join('. ')}.</p>
                            </div>
                        </div>
                    ` : ''}
                </header>

                <div class="px-6 md:px-8 py-6 space-y-6 form-scroller flex-1">
                    ${fieldsHTML}
                </div>
                
                <div class="px-6 pb-6 md:px-8 md:pb-8 mt-auto shrink-0 z-20">
                    <button onclick="window.saveTurnDataFromSheet(${dayIdx}, '${turnoId}')" class="w-full py-4 min-h-[48px] rounded-2xl bg-slate-900 dark:bg-primary text-white font-black text-[13px] uppercase tracking-widest shadow-xl shadow-slate-900/40 dark:shadow-primary/40 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        ACEPTAR Y GUARDAR
                    </button>
                </div>
            </div>
        `;

        // Animation logic
        setTimeout(() => {
            const sheet = document.getElementById('modal-sheet');
            if (sheet) {
                sheet.classList.add('animate-modal-pop');
            }
        }, 10);

        document.getElementById('modal-sheet-close').onclick = () => {
            const sheet = document.getElementById('modal-sheet');
            if (sheet) {
                sheet.style.transform = 'translate(-50%, -50%) scale(0.9)';
                sheet.style.opacity = '0';
            }
            setTimeout(() => { 
                window.hideModal('modal-container');
            }, 200);
        };
    };

    window.toggleSheetGroupDropdown = (e) => {
        if(e) e.stopPropagation();
        const drop = document.getElementById('sheet-groups-dropdown');
        const icon = document.getElementById('groups-dropdown-icon');
        if(drop) {
            drop.classList.toggle('hidden');
            if(!drop.classList.contains('hidden')) {
                icon.classList.add('rotate-180');
                const closeDrop = (evt) => {
                    const ct = document.getElementById('sheet-groups-container');
                    if (ct && !ct.contains(evt.target)) {
                        drop.classList.add('hidden');
                        icon.classList.remove('rotate-180');
                        document.removeEventListener('click', closeDrop);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeDrop), 10);
            } else {
                icon.classList.remove('rotate-180');
            }
        }
    };

    window.handleSheetGroupToggle = (checkbox) => {
        const container = document.getElementById('sheet-groups-dropdown');
        const peerUi = checkbox.nextElementSibling;
        const icon = peerUi.querySelector('i');
        
        if (checkbox.checked) {
             peerUi.classList.add('bg-primary', 'border-primary');
             icon.style.opacity = '1';
        } else {
             peerUi.classList.remove('bg-primary', 'border-primary');
             icon.style.opacity = '0';
        }

        const checkedBoxes = Array.from(container.querySelectorAll('.group-checkbox:checked'));
        
        let checkedVals = checkedBoxes.map(cb => {
             const v = cb.value;
             return v === 'Todos' ? 'Todos' : (v.toLowerCase().startsWith('grupo') ? v : `Grupo ${v}`);
        });
        
        let finalStr = checkedVals.includes('Todos') ? 'Todos' : checkedVals.join(', ');

        const hidden = document.getElementById('select-grupos');
        if (hidden) hidden.value = finalStr;

        const textSpan = document.getElementById('selected-groups-text');
        if (textSpan) {
            textSpan.innerText = finalStr || '-';
            textSpan.className = `text-[12px] font-black truncate pr-4 ${finalStr ? 'text-primary' : 'text-slate-400 opacity-40'}`;
        }
    };

    window.updateWeekDataSheet = async (dayIdx, turnoId, fieldId, val) => {
        programa.dias[dayIdx][turnoId][fieldId] = val || '';
        if (programa.isFormalized) programa.isFormalized = false;
        try {
            await saveProgramaSemanal(programa.id, programa);
            // Si cambia la hora, afecta visualmente la etiqueta del turno, forzamos re-render
            if (fieldId === 'hora') renderTable(); 
            // Also re-render list behind the sheet gently
            else renderTable(); 
        } catch (e) {
            console.error(e);
            showNotification("Error guardando dato", "error");
        }
    };

    window.toggleJornadaDropdown = (e) => {
        if (e) e.stopPropagation();
        const drop = document.getElementById('jornada-dropdown');
        if (drop) {
            const isHidden = drop.classList.contains('hidden');
            // Cerrar otros dropdowns si los hubiera
            drop.classList.toggle('hidden');
            
            if (isHidden) {
                const closeHandler = () => {
                    drop.classList.add('hidden');
                    window.removeEventListener('click', closeHandler);
                };
                window.addEventListener('click', closeHandler);
            }
        }
    };

    window.selectJornada = (dayIdx, turnoId, newBaseType) => {
        const input = document.getElementById('select-turno-id');
        if (input) input.value = newBaseType;
        
        const label = document.getElementById('modal-shift-label');
        if (label) {
            const optLabel = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche', zoom: 'Zoom' }[newBaseType];
            label.innerText = optLabel;
        }
        
        window.updateModalTurnoStyle(dayIdx, turnoId, newBaseType);
        document.getElementById('jornada-dropdown')?.classList.add('hidden');
    };

    window.updateModalTurnoStyle = (dayIdx, turnoId, newBaseType) => {
        // Obtenemos el styling basado en el nuevo tipo de turno
        // Solo para feedback visual inmediato en el modal
        const styling = getTurnoStyling(newBaseType, document.getElementById('input-hora')?.value);
        const iconContainer = document.querySelector('#modal-sheet header .shadow-inner');
        const icon = iconContainer.querySelector('i');
        
        iconContainer.className = `w-10 h-10 ${styling.bg} ${styling.color} rounded-xl flex items-center justify-center shadow-inner transition-colors duration-300`;
        icon.className = `fas ${styling.icon}`;
        
        // Re-validar incongruencias en tiempo real si es posible (opcional)
    };

    window.saveTurnDataFromSheet = async (dayIdx, turnoId) => {
        const newTurnoBase = document.getElementById('select-turno-id')?.value || turnoId;
        const horaVal = document.getElementById('input-hora')?.value || "";
        const facetaVal = document.getElementById('select-faceta')?.value || "";

        // Si el usuario cambió la base de la jornada (ej de Zoom a Mañana)
        // debemos ver si ya existe ese ID o generar uno nuevo si es necesario.
        // Por ahora, si es el ID original (ej: manana), lo sobreescribimos.
        // Si cambió la base, re-mapeamos el ID si es posible.
        
        const payload = {
            lugar: document.getElementById('input-lugar')?.value || "",
            hora: horaVal,
            conductor: document.getElementById('select-conductor')?.value || "",
            auxiliar: document.getElementById('select-auxiliar')?.value || "",
            faceta: facetaVal,
            territorio: document.getElementById('select-territorio')?.value || "",
            grupos: document.getElementById('select-grupos')?.value || ""
        };

        console.log("💾 [Save Payload]:", payload);
        const safePayload = JSON.parse(JSON.stringify(payload));

        const dia = programa.dias[dayIdx];
        const oldData = dia[turnoId] || {};

        // REGLA DE TRASPASO DE JORNADA:
        // Si el ID de turno cambió (ej de manana_2 a noche_2), debemos mover el objeto.
        let targetId = turnoId;
        if (!turnoId.includes(newTurnoBase)) {
            // Buscamos un nuevo ID único para la nueva base
            let suffix = 1;
            targetId = suffix === 1 ? newTurnoBase : `${newTurnoBase}_${suffix}`;
            while(dia[targetId] && targetId !== turnoId) {
                suffix++;
                targetId = `${newTurnoBase}_${suffix}`;
            }
            // Borrar el anterior
            delete dia[turnoId];
        }

        dia[targetId] = {
            ...oldData,
            ...safePayload
        };

        try {
            showNotification("Sincronizando...", "info");
            await saveProgramaSemanal(programa.id, programa);
            renderTable();
            const closeBtn = document.getElementById('modal-sheet-close');
            if (closeBtn) closeBtn.click();
            showNotification("Turno actualizado", "success");
        } catch (e) {
            console.error("❌ [Save error]:", e);
            showNotification("Error al guardar cambios", "error");
        }
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
        // Optimistic update with fallback
        programa.dias[dayIdx][turnoId][fieldId] = val || '';
        if (programa.isFormalized) programa.isFormalized = false;

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
                const turnData = dia[turnoId] || {};
                const v = turnData.territorio;
                const tNums = Array.from(new Set(String(v || '').split(/[,;/]/).map(n => n.trim()).filter(Boolean)));
                const conductor = turnData.conductor;

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
        showCustomConfirm('¿Eliminar por completo este horario de la jornada?', async () => {
            delete programa.dias[dayIdx][turnoId];
            if (programa.isFormalized) programa.isFormalized = false;

            try {
                showNotification("Eliminando horario...", "info");
                await saveProgramaSemanal(programa.id, programa);
                renderTable();
                showNotification("Horario eliminado", "success");
            } catch (e) {
                console.error(e);
                showNotification("Error al eliminar", "error");
            }
        });
    };

    window.addNewSlot = (dayIdx) => {
        const modalDiv = document.getElementById('modal-container');
        modalDiv.classList.remove('hidden');
        modalDiv.innerHTML = `
            <div class="p-8 space-y-6 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] max-w-sm w-full shadow-2xl animate-scale-in flex flex-col mx-auto my-auto relative pointer-events-auto">
                <header class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 text-xl">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Nuevo Horario</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Selecciona el tipo de salida</p>
                    </div>
                </header>
                <div class="grid grid-cols-2 gap-3">
                    ${[
                        { id: 'manana', label: 'Mañana', icon: 'fa-sun', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'hover:border-amber-500' },
                        { id: 'tarde', label: 'Tarde', icon: 'fa-cloud-sun', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'hover:border-orange-500' },
                        { id: 'noche', label: 'Noche', icon: 'fa-moon', color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'hover:border-indigo-500' },
                        { id: 'zoom', label: 'Zoom', icon: 'fa-video', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'hover:border-emerald-500' }
                    ].map(t => `
                        <button onclick="window.createSlot(${dayIdx}, '${t.id}')" class="flex flex-col items-center gap-3 p-5 rounded-3xl border border-slate-100 dark:border-white/5 ${t.border} transition-all group bg-slate-50 dark:bg-white/[0.02]">
                            <div class="w-10 h-10 rounded-xl ${t.bg} ${t.color} flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                                <i class="fas ${t.icon}"></i>
                            </div>
                            <span class="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">${t.label}</span>
                        </button>
                    `).join('')}
                </div>
                <button onclick="window.hideModal('modal-container')" class="w-full py-4 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all mt-4">Cancelar</button>
            </div>
        `;
    };

    window.createSlot = async (dayIdx, baseType) => {
        window.hideModal('modal-container');
        const dia = programa.dias[dayIdx];
        
        let newTurnoId = baseType;
        let suffix = 2;
        while(dia[newTurnoId]) {
            newTurnoId = `${baseType}_${suffix}`;
            suffix++;
        }
        
        dia[newTurnoId] = {};
        if (programa.isFormalized) programa.isFormalized = false;
        
        try {
            showNotification("Agregando horario...", "info");
            await saveProgramaSemanal(programa.id, programa);
            renderTable();
            window.openEditTurnoSheet(dayIdx, newTurnoId);
        } catch(e) {
            console.error(e);
            showNotification("Error creando horario", "error");
        }
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
                    <button onclick="window.hideModal('modal-container')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Ignorar</button>
                    <button id="confirm-force-sync" class="flex-[2.5] py-5 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all group">
                        <i class="fas fa-bolt mr-2 group-hover:animate-bounce"></i> FORZAR ASIGNACIÓN
                    </button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#confirm-force-sync').onclick = async () => {
                window.hideModal('modal-container');
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
                    <button onclick="window.hideModal('modal-container')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
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
                window.hideModal('modal-container');

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
            const hidden = document.getElementById('select-territorio');
            if (hidden) hidden.value = res || '';

            // Actualizar visualmente el campo en el modal sheet
            const displaySpan = document.getElementById('val-territorio-modal');
            if (displaySpan) {
                displaySpan.innerText = res || '—';
                displaySpan.className = `text-[12px] font-black truncate ${res ? 'text-primary' : 'text-slate-400 opacity-40'}`;
            }
            // Actualizar data-current del div clickeable para próximas aperturas
            if (btn) btn.dataset.current = res || '';

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
                            <button onclick="window.hideModal('modal-container')" class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center">
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

        window.showModal(`
            <div class="flex flex-col max-h-[75vh] overflow-hidden animate-scale-in">
                <header class="p-5 pb-2 flex items-center gap-3 shrink-0">
                    <div class="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center text-lg text-indigo-500 shadow-inner">
                        <i class="fas fa-check-double"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none">Grupos</h3>
                        <p class="text-[7px] text-indigo-500 font-bold uppercase tracking-wider mt-0.5 opacity-60">Selección Múltiple</p>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar px-5 py-2">
                    <div class="grid grid-cols-1 gap-1.5" id="group-selection-grid">
                        <label class="group-item p-2.5 modern-card border-slate-100 dark:border-white/5 hover:border-indigo-500 transition-all cursor-pointer flex items-center gap-3 ${selected.has('Todos') ? 'bg-indigo-500/5 border-indigo-500/50' : ''}">
                            <div class="relative w-4 h-4 shrink-0">
                                <input type="checkbox" class="group-checkbox absolute inset-0 opacity-0 cursor-pointer z-10" value="Todos" ${selected.has('Todos') ? 'checked' : ''}>
                                <div class="check-box-ui w-4 h-4 border-2 border-slate-200 dark:border-white/10 rounded flex items-center justify-center transition-all ${selected.has('Todos') ? 'bg-indigo-500 border-indigo-500' : ''}">
                                    <i class="fas fa-check text-[7px] text-white ${selected.has('Todos') ? 'opacity-100' : 'opacity-0'} transition-opacity"></i>
                                </div>
                            </div>
                            <div class="flex-1">
                                <p class="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-none mb-0.5">Todos</p>
                                <p class="text-[7px] text-slate-400 font-medium uppercase tracking-widest leading-none">Salida General</p>
                            </div>
                        </label>

                        ${groups.map(g => {
            const gNum = g.nombre.replace(/grupos?/gi, '').trim();
            const isSel = selected.has(gNum) || selected.has(g.nombre);
            return `
                            <label class="group-item p-2.5 modern-card border-slate-100 dark:border-white/5 hover:border-indigo-500 transition-all cursor-pointer flex items-center gap-3 ${isSel ? 'bg-indigo-500/5 border-indigo-500/50' : ''}">
                                <div class="relative w-4 h-4 shrink-0">
                                    <input type="checkbox" class="group-checkbox absolute inset-0 opacity-0 cursor-pointer z-10" value="${gNum}" ${isSel ? 'checked' : ''}>
                                    <div class="check-box-ui w-4 h-4 border-2 border-slate-200 dark:border-white/10 rounded flex items-center justify-center transition-all ${isSel ? 'bg-indigo-500 border-indigo-500' : ''}">
                                        <i class="fas fa-check text-[7px] text-white ${isSel ? 'opacity-100' : 'opacity-0'} transition-opacity"></i>
                                    </div>
                                </div>
                                <div class="flex-1">
                                    <p class="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-none mb-0.5">Grupo ${gNum}</p>
                                    <p class="text-[7px] text-slate-400 font-medium uppercase tracking-widest leading-none truncate max-w-[150px]">${g.casa_salida || '—'}</p>
                                </div>
                            </label>
                        `;
        }).join('')}
                    </div>
                </div>

                <div class="p-5 pt-3 border-t border-slate-50 dark:border-white/5 flex gap-2 shrink-0">
                    <button onclick="window.hideModal('modal-container-nested')" class="flex-1 py-3 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-lg text-[8px] uppercase tracking-widest hover:bg-slate-100 transition-all">Cancelar</button>
                    <button id="confirm-groups" class="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg text-[8px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Asignar Grupos</button>
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
                window.hideModal('modal-container-nested');
            };
        }, 'max-w-[340px]', 'modal-container-nested');
    };

    window.setProgramGroup = (dayIdx, turnoId, val) => {
        console.log(`🛡️ [v2.9.5] Setting Groups for Day ${dayIdx}, Turn ${turnoId}:`, val);
        const hidden = document.getElementById('select-grupos');
        if (hidden) {
            hidden.value = val || '';
            const spanVisual = document.getElementById('val-grupos-modal');
            if (spanVisual) {
                spanVisual.innerText = val || '—';
                spanVisual.className = `text-[12px] font-black truncate ${val ? 'text-primary' : 'text-slate-400 opacity-40'}`;
            }
            console.log("✅ Hidden input 'select-grupos' updated");
        } else {
            console.warn("⚠️ Element 'select-grupos' not found in DOM");
        }
        
        // Sincronizar con el objeto principal inmediatamente para evitar pérdida por refresco
        if (programa.dias[dayIdx] && programa.dias[dayIdx][turnoId]) {
            programa.dias[dayIdx][turnoId].grupos = val || '';
        }

        window.updateWeekData(dayIdx, turnoId, 'grupos', val);
    };





    const execActionRecepcion = async () => {
        showNotification("Actualizando lista de asignaciones...", "info");
        
        // LIMPIEZA EXPLÍCITA: Vaciar caché in-memory antes del fetch fresco
        territorios.length = 0; 

        // RASTREO CONTEXTUAL (Current Week Scope Limiting)
        // Extraemos todos los números base de territorio que la interfaz TIENE asginados en esta semana visualizada
        const currentWeekTerritorios = new Set();
        if (programa && programa.dias) {
            programa.dias.forEach(dia => {
                Object.keys(dia).filter(k => k !== 'nombre' && k !== 'fecha').forEach(tId => {
                    const data = dia[tId];
                    if (data && data.territorio) {
                        String(data.territorio).split(/[,;/]/).map(t => getBaseTerritoryNumber(t)).forEach(n => {
                            if (n) currentWeekTerritorios.add(normalizeLower(n));
                        });
                    }
                });
            });
        }
        
        // QUERY FRESCA AL MAESTRO IGNORANDO LA CACHÉ
        const snap = await getDocs(collection(db, "territorios"));
        
        const assigned = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => d.status === "Asignado" || d.estado === "Asignado")
            .map(data => ({
                id: data.id,
                numero: data.numero,
                manzanas: data.manzanas || '',
                status: data.status || data.estado,
                currentAssignee: data.currentAssignee || data.asignado_a,
                assignmentDate: data.assignmentDate || data.fecha_asignacion,
                master_status: data.status || data.estado,
            }));

        if (assigned.length === 0) return showNotification("No hay territorios asignados para devolver", "info");

        // Repoblar array local SOLO con los activos (para la vista de recepción actual)
        territorios.push(...assigned);

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
                        <button id="reception-select-all" class="px-4 py-2 bg-white dark:bg-white/5 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all border border-slate-200/50 shadow-sm">Alternar Selector</button>
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
                        <button onclick="window.hideModal('modal-container')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all hover:bg-slate-100 dark:hover:bg-white/10">Cancelar</button>
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
                        return new Date(a.assignmentDate) - new Date(b.assignmentDate);
                    }
                });

                listContainer.innerHTML = sorted.map(t => {
                    const mzCount = t.manzanas ? String(t.manzanas).split(/[,;]/).map(s => s.trim()).filter(Boolean).length : 0;
                    const asigDate = new Date(t.assignmentDate);
                    const diffDays = Math.ceil(Math.abs(now - asigDate) / (1000 * 60 * 60 * 24));
                    const isLate = diffDays > 10;
                    
                    const baseNum = normalizeLower(getBaseTerritoryNumber(t.numero));
                    const isFromCurrentWeek = currentWeekTerritorios.has(baseNum);
                    const isCheckedAttr = isFromCurrentWeek ? 'checked' : '';

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
                                <input type="checkbox" class="reception-check absolute inset-0 opacity-0 cursor-pointer z-10" value="${t.id}" ${isCheckedAttr}>
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
                            <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-4 truncate">${t.currentAssignee || '—'}</p>
                        </div>

                        <div class="flex items-center justify-between mt-2 pt-3 border-t border-slate-50 dark:border-white/5">
                            <div class="flex flex-col gap-1">
                                <span class="text-[8px] font-black ${isLate ? 'text-rose-500' : 'text-slate-400'} uppercase tracking-tighter">
                                    ${UIHelpers.fmtDateAt(t.assignmentDate)}
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

    const execActionFormalizar = async () => {
        // Collect all planned assignments that are not sync with a FRESH fetch
        const freshTerritorios = await getTerritorios();
        
        // Update local territories cache for consistency across the program view
        territorios.length = 0;
        territorios.push(...freshTerritorios);

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
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> PROCESANDO...';

                const weekId = programa.id;
                const globalDate = modal.querySelector('#sync-global-date').value;
                
                // Preparar asignaciones para el Formalize Masivo
                const assignments = checkedIdxs.map(idx => {
                    const item = toSync[idx];
                    let resolvedDateISO;
                    if (globalDate) {
                        resolvedDateISO = new Date(globalDate + 'T12:00:00Z').toISOString();
                    } else {
                        const d = new Date(weekId + 'T12:00:00Z');
                        d.setUTCDate(d.getUTCDate() + item.dayIdx);
                        resolvedDateISO = d.toISOString();
                    }
                    
                    return {
                        territorio_id: item.specificT,
                        conductor: item.data.conductor,
                        fecha_asignacion: resolvedDateISO,
                        turno: item.turnoId,
                        faceta: item.data.faceta || 'Casa en casa',
                        observaciones: item.data.observaciones || ''
                    };
                });

                try {
                    showNotification(`Formalizando ${assignments.length} asignaciones...`, 'info');
                    await formalizeWeek(weekId, assignments);

                    showNotification(`¡${assignments.length} asignaciones formalizadas con éxito!`, 'success');
                    modal.classList.add('hidden');
                    
                    // RECARGA OBLIGATORIA
                    await loadWeekData();
                } catch (err) {
                    console.error("Error formalizando:", err);
                    showNotification("Error en la formalización", "error");
                    btn.disabled = false;
                    btn.innerHTML = 'Formalizar Selección';
                }
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

    container.querySelector('#btn-prev-week').onclick = (e) => { 
        e.preventDefault();
        e.stopPropagation();
        currentWeekStart.setDate(currentWeekStart.getDate() - 7); 
        loadWeekData(); 
    };
    container.querySelector('#btn-next-week').onclick = (e) => { 
        e.preventDefault();
        e.stopPropagation();
        currentWeekStart.setDate(currentWeekStart.getDate() + 7); 
        loadWeekData(); 
    };
    const execActionHoy = () => { 
        const today = new Date();
        const day = today.getDay() || 7; 
        if(day !== 1) today.setHours(-24 * (day - 1));
        currentWeekStart = today; 
        loadWeekData(); 
    };

    const execActionReplicar = async () => {
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

    const execActionExportXls = async () => {
        const { exportarProgramaExcel } = await import('../services/export-service.js');
        await exportarProgramaExcel(programa);
    };

    // --- ACTION BAR EVENT DELEGATION (GHOST CLICK ERADICATOR) ---
    const navBar = container.querySelector('nav');
    navBar?.addEventListener('click', (e) => {
        const btn = e.target.closest('button, #action-exportar-prog');
        if (!btn) return;
        
        e.preventDefault();
        e.stopPropagation();

        const id = btn.id;

        if (id === 'action-formalizar-prog') {
            execActionFormalizar();
        } else if (id === 'action-hoy-prog') {
            execActionHoy();
        } else if (id === 'action-recepcion-prog') {
            execActionRecepcion();
        } else if (id === 'action-escanear-prog') {
            memoryScannerInput.click();
        } else if (id === 'action-replicar-prog') {
            execActionReplicar();
        } else if (id === 'action-exportar-prog') {
            const menuEl = container.querySelector('#export-menu-options');
            const isVisible = menuEl.getAttribute('data-visible') === 'true';
            menuEl.setAttribute('data-visible', !isVisible);
        } else if (id === 'btn-export-xls-prog') {
            execActionExportXls();
        } else if (id === 'btn-export-png-cond-new') {
            import('../services/export-service.js').then(m => m.exportarProgramaPNG(programa, 'conductor'));
        } else if (id === 'btn-export-png-pub-new') {
            import('../services/export-service.js').then(m => m.exportarProgramaPNG(programa, 'publicador'));
        }
    });

    const menuEl = container.querySelector('#export-menu-options');
    if (menuEl) {
        document.addEventListener('click', () => {
            menuEl.setAttribute('data-visible', 'false');
        });

        // Sub-buttons export logic moved to delegation
    }

    await loadWeekData();
};
