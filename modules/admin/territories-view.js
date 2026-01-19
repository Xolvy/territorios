
import {
    getConfiguracion, getTerritories, addTerritorio, deleteTerritorio, updateTerritorio,
    assignTerritorioParcial, assignTerritorio, returnTerritorio, returnTerritorioMultiple,
    transferTerritory, getTerritoryHistory, getHistorialReport, addHistoryRecord,
    updateHistoryRecord, deleteHistoryRecord, cancelarAsignacion, updateAssignmentData,
    getConductores, getPublicadores, getProgramaSemanal, saveProgramaSemanal,
    deleteProgramaSemanal, syncSlotWithTerritories, getRecursos, addRecurso,
    updateRecurso, getCampanas, saveCampana, getGroupsConfig, returnTerritorioParcial
} from '../../data/firestore-services.js?v=1.9.9.0';
import {
    formatPhoneNumber, getStatusColor, showNotification, formatMapUrl,
    ensureOnline, generatePlainXLS
} from '../utils/helpers.js?v=1.9.9.0';
import { UIHelpers, showModal, showCustomConfirm, showCustomPrompt } from '../services/ui-helpers.js?v=1.9.9.0';
import { GlassCard, GlassButton, GlassInput } from '../services/ui-components.js?v=1.9.9.0';

const fmtDate = UIHelpers.fmtDate;
const getMonday = UIHelpers.getMonday;
const formatDateId = UIHelpers.formatDateId;
const formatDisplayDateRange = UIHelpers.formatDisplayDateRange;

// --- SHARED STATE ---
let _globalTerritorios = [];
let _globalConductores = [];
let _globalHistory = [];
let _globalConfig = {};
let _selectedIds = new Set();
let _currentView = 'activas';

// --- SHARED MODAL HELPERS ---

export const showTerritorySelectionModal = (current, territorios, onSelect, containerId = 'modal-container') => {
    let selectedNums = new Set();
    if (current) {
        current.split(',').forEach(p => {
            const num = p.trim().split(' ')[0];
            if (num) {
                const cleaned = num.replace(/[()]/g, '').trim();
                if (cleaned) selectedNums.add(cleaned);
            }
        });
    }

    const modalHtml = `
        <div class="flex flex-col h-[85vh] sm:h-[600px] bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
            <header class="shrink-0 bg-slate-900 p-6 text-white flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl"><i class="fas fa-map-marked-alt"></i></div>
                    <h3 class="text-lg font-black uppercase tracking-tight">Seleccionar Territorios</h3>
                </div>
                <button id="close-terr-selection" class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors">✕</button>
            </header>
            
            <div class="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20">
                <input type="text" id="search-terr-selection" placeholder="Filtrar por número..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-2xl text-sm font-bold outline-none focus:border-primary transition-all shadow-inner">
            </div>

            <div id="terr-selection-grid" class="flex-1 overflow-y-auto p-6 grid grid-cols-4 sm:grid-cols-6 gap-3 custom-scrollbar">
                ${territorios.map(t => {
        const isSel = selectedNums.has(t.numero);
        return `
                        <button class="terr-sel-btn aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${isSel ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-400 opacity-60 hover:opacity-100 hover:border-primary/30'}" data-num="${t.numero}">
                            <span class="text-lg font-black">${t.numero}</span>
                            <span class="text-[8px] font-black uppercase opacity-60">Terr-H</span>
                        </button>
                    `;
    }).join('')}
            </div>

            <footer class="shrink-0 p-6 bg-slate-50 dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                <button id="confirm-terr-selection" class="flex-1 bg-primary hover:bg-primary-light py-4 rounded-xl text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 active:scale-95 transition-all">Confirmar Selección (${selectedNums.size})</button>
            </footer>
        </div>
    `;

    showModal(modalHtml, (modal) => {
        const grid = modal.querySelector('#terr-selection-grid');
        const confirmBtn = modal.querySelector('#confirm-terr-selection');
        const searchInput = modal.querySelector('#search-terr-selection');

        const updateBtn = () => {
            confirmBtn.innerText = `Confirmar Selección (${selectedNums.size})`;
        };

        grid.querySelectorAll('.terr-sel-btn').forEach(btn => {
            btn.onclick = () => {
                const num = btn.dataset.num;
                if (selectedNums.has(num)) {
                    selectedNums.delete(num);
                } else {
                    selectedNums.add(num);
                }
                const isNowSel = selectedNums.has(num);
                btn.className = isNowSel ? "terr-sel-btn aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10" : "terr-sel-btn aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-400 opacity-60 hover:opacity-100 hover:border-primary/30";
                updateBtn();
            };
        });

        searchInput.oninput = (e) => {
            const val = e.target.value.toLowerCase();
            grid.querySelectorAll('.terr-sel-btn').forEach(btn => {
                const match = btn.dataset.num.includes(val);
                btn.classList.toggle('hidden', !match);
            });
        };

        modal.querySelector('#close-terr-selection').onclick = () => modal.remove();
        confirmBtn.onclick = () => {
            const result = Array.from(selectedNums).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ');
            onSelect(result);
            modal.remove();
        };
    }, 'max-w-2xl', containerId);
};

// --- CORE RENDERER ---

export const renderCasaEnCasaTab = async (container) => {
    let _activeSub = 'asignaciones';
    container.innerHTML = `
        <div class="space-y-6 md:space-y-8 animate-fade-in px-1 md:px-6">
            <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 md:gap-8">
                <div class="flex items-center gap-4 md:gap-6">
                    <div class="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl shadow-xl shadow-primary/30 border border-primary/20 dark:border-white/10 shrink-0">
                        <i class="fas fa-home shadow-sm"></i>
                    </div>
                    <div class="space-y-0.5 md:space-y-1">
                        <h2 class="text-xl md:text-h2 font-black text-slate-900 dark:text-white uppercase tracking-tight line-clamp-1">Territorios</h2>
                        <div class="flex items-center gap-2">
                             <span class="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                              <p class="text-[9px] md:text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-widest">Gestión Casa en Casa</p>
                        </div>
                    </div>
                </div>

                <nav class="flex flex-row overflow-x-auto scrollbar-hide items-center gap-1.5 bg-white/50 dark:bg-white/[0.03] p-1 md:p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm w-full xl:w-auto backdrop-blur-xl">
                    <button class="sub-tab-casa group px-3 md:px-5 py-2.5 md:py-3 rounded-xl transition-all flex items-center gap-2 md:gap-3 whitespace-nowrap font-extrabold" data-sub="asignaciones">
                        <i class="fas fa-clipboard-list text-xs md:text-sm"></i>
                        <span class="text-[10px] md:text-[11px] font-extrabold uppercase tracking-wider">Asignaciones</span>
                    </button>
                    <button class="sub-tab-casa group px-3 md:px-5 py-2.5 md:py-3 rounded-xl transition-all flex items-center gap-2 md:gap-3 whitespace-nowrap font-extrabold" data-sub="programa">
                        <i class="fas fa-calendar-alt text-xs md:text-sm"></i>
                        <span class="text-[10px] md:text-[11px] font-extrabold uppercase tracking-wider">Programa</span>
                    </button>
                    <button class="sub-tab-casa group px-3 md:px-5 py-2.5 md:py-3 rounded-xl transition-all flex items-center gap-2 md:gap-3 whitespace-nowrap font-extrabold" data-sub="s12">
                        <i class="fas fa-map text-xs md:text-sm"></i>
                        <span class="text-[10px] md:text-[11px] font-extrabold uppercase tracking-wider">S-12</span>
                    </button>
                    <button class="sub-tab-casa group px-3 md:px-5 py-2.5 md:py-3 rounded-xl transition-all flex items-center gap-2 md:gap-3 whitespace-nowrap font-extrabold" data-sub="gestion">
                        <i class="fas fa-history text-xs md:text-sm"></i>
                        <span class="text-[10px] md:text-[11px] font-extrabold uppercase tracking-wider">Reportes</span>
                    </button>
                    <div class="w-px h-6 bg-slate-200 dark:bg-white/10 mx-0.5 md:mx-1 shrink-0"></div>
                    <button class="sub-tab-casa group px-3 md:px-5 py-2.5 md:py-3 rounded-xl transition-all flex items-center gap-2 md:gap-3 whitespace-nowrap font-extrabold" data-sub="recursos">
                        <i class="fas fa-briefcase text-xs md:text-sm"></i>
                        <span class="text-[10px] md:text-[11px] font-extrabold uppercase tracking-wider">Ayudas</span>
                    </button>
                </nav>
            </div>
            
            <div id="casa-content" class="relative min-h-[60vh]"></div>
            
            <div id="super-sync-indicator" class="hidden fixed bottom-10 left-0 right-0 mx-auto w-max flex items-center gap-3 bg-primary text-white px-6 py-3 rounded-2xl shadow-2xl z-[60] animate-bounce-in">
                <i class="fas fa-sync-alt animate-spin"></i>
                <span class="text-xs font-bold uppercase tracking-widest">Sincronizando...</span>
            </div>
        </div>
    `;

    const loadCasaSub = async (sub, isSync = false) => {
        _activeSub = sub;
        const subContainer = container.querySelector('#casa-content');
        const syncIndicator = container.querySelector('#super-sync-indicator');

        if (!isSync) {
            subContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-48 gap-6 opacity-20">
                    <div class="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                    <p class="text-[12px] font-black uppercase tracking-[0.4em]">Iniciando Super Módulo...</p>
                </div>
            `;
        } else {
            syncIndicator?.classList.remove('hidden');
        }

        container.querySelectorAll('.sub-tab-casa').forEach(btn => {
            const isActive = btn.dataset.sub === sub;
            btn.classList.toggle('active', isActive);
            if (isActive) {
                btn.className = "sub-tab-casa active group px-3 md:px-5 py-2.5 md:py-3 rounded-xl bg-slate-900 dark:bg-white/10 text-white shadow-xl transition-all flex items-center gap-2 md:gap-3 font-extrabold border border-slate-800 dark:border-white/10 whitespace-nowrap";
            } else {
                btn.className = "sub-tab-casa group px-3 md:px-5 py-2.5 md:py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light hover:bg-white dark:hover:bg-white/5 transition-all flex items-center gap-2 md:gap-3 font-extrabold border border-transparent shadow-sm whitespace-nowrap";
            }
        });

        try {
            const views = {
                'asignaciones': renderAsignacionesView,
                'programa': renderProgramaTab,
                's12': renderS12View,
                'gestion': renderS13CommandCenter,
                'recursos': renderRecursosTab
            };

            if (views[sub]) {
                await views[sub](subContainer);
                setTimeout(() => { if (syncIndicator) syncIndicator.classList.add('hidden'); }, 1000);
            }
        } catch (error) {
            console.error(`Error loading Super Module [${sub}]:`, error);
            if (subContainer) subContainer.innerHTML = `<div class="p-10 text-center text-red-500 font-bold">Error al cargar el módulo: ${error.message}</div>`;
            if (syncIndicator) syncIndicator.classList.add('hidden');
        }
    };

    window.dispatchModuleSync = () => {
        loadCasaSub(_activeSub, true);
    };

    container.querySelectorAll('.sub-tab-casa').forEach(btn => {
        btn.addEventListener('click', (e) => loadCasaSub(e.currentTarget.dataset.sub));
    });

    loadCasaSub('asignaciones');
};

// --- HELPER LOGIC DE EXTRACCIÓN ---

const calculateSalidaDate = (assignDateStr, dayName) => {
    if (!dayName) return null;
    const daysMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
    const targetDay = daysMap[dayName];
    const [y, m, d] = assignDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const currentDay = dateObj.getDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    dateObj.setDate(dateObj.getDate() + diff);
    const finalY = dateObj.getFullYear();
    const finalM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const finalD = String(dateObj.getDate()).padStart(2, '0');
    return `${finalY}-${finalM}-${finalD}T12:00:00Z`;
};

// --- SUB-VIEWS ---

const renderRecursosTab = async (container) => {
    const recursos = await getRecursos();
    container.innerHTML = `
        <div class="flex flex-wrap justify-between items-center mb-10 gap-6">
            <div>
                <h3 class="text-h3 text-slate-900 dark:text-white">Material de Apoyo</h3>
                <p class="text-xs text-slate-500 mt-1">Recursos útiles para los publicadores</p>
            </div>
            <button id="add-recurso-btn" class="bg-primary hover:bg-primary-light text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-3 text-xs uppercase tracking-wider">
                <i class="fas fa-plus"></i> Agregar Recurso
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            ${recursos.length === 0 ? '<p class="col-span-full text-center opacity-50 py-20 italic">No hay recursos disponibles.</p>' :
            recursos.map(r => `
                <div class="modern-card !p-0 overflow-hidden flex flex-col group border border-slate-200 dark:border-white/5">
                    <div class="h-44 bg-slate-100 dark:bg-white/5 relative overflow-hidden">
                        ${r.imagen ? `<img src="${r.imagen}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">` :
                    `<div class="w-full h-full flex items-center justify-center text-slate-300 text-5xl opacity-40"><i class="fas fa-book"></i></div>`}
                    </div>
                    <div class="p-6 flex-1 flex flex-col">
                        <h4 class="text-lg font-bold text-slate-900 dark:text-white mb-3 leading-tight group-hover:text-primary transition-colors">${r.titulo}</h4>
                        <p class="text-[13px] text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 flex-1 leading-relaxed">${r.descripcion || 'Sin descripción adicional.'}</p>
                        <a href="${r.url}" target="_blank" class="flex items-center justify-center gap-3 w-full bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 py-3.5 rounded-xl border border-slate-100 dark:border-white/5 text-xs font-bold hover:bg-primary hover:text-white hover:border-primary transition-all">
                            Abrir Recurso <i class="fas fa-external-link-alt text-[10px]"></i>
                        </a>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
};

const renderAsignacionesView = async (container) => {
    const loadData = async () => {
        const [t, c, h, conf] = await Promise.all([
            getTerritories(), getConductores(), getHistorialReport(), getConfiguracion()
        ]);
        _globalTerritorios = t.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
        _globalConductores = c.sort((a, b) => a.nombre.localeCompare(b.nombre));
        _globalHistory = h;
        _globalConfig = conf;
        renderInternal();
    };

    const renderInternal = () => {
        container.innerHTML = `
            <div class="space-y-6 md:space-y-8 animate-fade-in px-1">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <button id="hub-btn-assign" class="group relative bg-white dark:bg-[#121212]/40 backdrop-blur-3xl overflow-hidden p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_60px_-10px_rgba(59,130,246,0.3)]">
                        <div class="absolute -right-10 -bottom-10 w-24 h-24 md:w-40 md:h-40 bg-primary/10 blur-[40px] md:blur-[60px] rounded-full group-hover:bg-primary/30 transition-all duration-700"></div>
                        <div class="flex items-center gap-4 md:gap-6">
                            <div class="w-10 h-10 md:w-16 md:h-16 rounded-[1rem] md:rounded-[1.5rem] bg-primary flex items-center justify-center text-xl md:text-3xl text-white group-hover:scale-110 group-hover:rotate-6 transition-all shadow-lg shadow-primary/30"><i class="fas fa-plus"></i></div>
                            <div class="text-left">
                                <p class="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-0.5 md:mb-1">Operación</p>
                                <p class="text-base md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Nueva Asignación</p>
                            </div>
                        </div>
                    </button>
                    <button id="hub-btn-return" class="group relative bg-white dark:bg-[#121212]/40 backdrop-blur-3xl overflow-hidden p-4 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_60px_-10px_rgba(244,63,94,0.3)]">
                        <div class="absolute -right-10 -bottom-10 w-24 h-24 md:w-40 md:h-40 bg-rose-600/10 blur-[40px] md:blur-[60px] rounded-full group-hover:bg-rose-600/30 transition-all duration-700"></div>
                        <div class="flex items-center gap-4 md:gap-6">
                            <div class="w-10 h-10 md:w-16 md:h-16 rounded-[1rem] md:rounded-[1.5rem] bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-xl md:text-3xl text-white group-hover:scale-110 group-hover:-rotate-6 transition-all shadow-lg shadow-rose-500/30"><i class="fas fa-file-import"></i></div>
                            <div class="text-left relative">
                                <p class="text-[8px] md:text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] mb-0.5 md:mb-1">Recepción</p>
                                <p class="text-base md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Devolver Territorios</p>
                                ${_selectedIds.size > 0 ? `<div class="absolute -top-2 -right-6 md:-top-4 md:-right-12 bg-rose-600 text-white w-5 h-5 md:w-8 md:h-8 rounded-full text-[9px] md:text-xs font-black flex items-center justify-center animate-bounce shadow-lg ring-2 md:ring-4 ring-white dark:ring-[#121212]">${_selectedIds.size}</div>` : ''}
                            </div>
                        </div>
                    </button>
                </div>

                <div class="flex flex-col md:flex-row justify-between items-center gap-6 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-lg">
                     <div class="flex items-center gap-5">
                        <div class="flex flex-col">
                            <h2 class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1">MAPA DE TERRITORIOS</h2>
                            <div id="view-stats" class="text-[11px] font-black text-primary flex flex-wrap items-center gap-3">
                                <span class="opacity-60">${_globalTerritorios.filter(t => t.estado === 'Asignado').length} asignados - ${_globalTerritorios.filter(t => t.estado === 'Disponible').length} disponibles</span>
                            </div>
                        </div>
                     </div>
                     <div class="relative w-full md:w-80 group">
                         <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"><i class="fas fa-search text-xs"></i></span>
                         <input type="text" id="search-assigns" placeholder="Buscar..." class="w-full pl-12 pr-5 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner">
                     </div>
                </div>

                <div id="assigns-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                    ${_globalTerritorios.map(t => {
            const isAssigned = t.estado === 'Asignado' || t.estado === 'Pendiente';
            const isSelected = _selectedIds.has(t.id);
            return `
                            <div class="modern-card !p-5 relative group transition-all duration-300 ${isAssigned ? 'border-primary/20 bg-primary/5 shadow-primary/5' : 'border-slate-100 dark:border-white/5'} ${isSelected ? 'ring-2 ring-primary/50' : ''}" onclick="window.actionToggleSelect('${t.id}')">
                                <div class="flex justify-between items-start mb-4">
                                    <span class="bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-inner">#${t.numero}</span>
                                    <span class="text-[9px] font-black uppercase tracking-[0.2em] ${isAssigned ? 'text-primary animate-pulse' : 'text-slate-400 opacity-40'}">${t.estado}</span>
                                </div>
                                <div class="space-y-1 mb-6">
                                    <h4 class="font-black text-lg text-slate-800 dark:text-white truncate uppercase tracking-tight">${t.asignado_a || 'Disponible'}</h4>
                                    <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate uppercase font-bold tracking-widest">${t.localidad || 'Ubicación General'}</p>
                                </div>
                                <div class="flex gap-2 relative z-10" onclick="event.stopPropagation()">
                                     ${isAssigned ? `
                                        <button class="flex-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 py-3 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-bold hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm" onclick="window.handleEditActive('${t.id}', '${t.numero}', '${t.asignado_a}')"><i class="fas fa-edit"></i></button>
                                     ` : ''}
                                     <button class="flex-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 py-3 rounded-xl text-xs text-slate-400 hover:text-primary transition-all shadow-sm" onclick="window.actionHistory('${t.id}', '${t.numero}')"><i class="fas fa-history"></i></button>
                                     ${isAssigned ? `
                                        <label class="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl cursor-pointer hover:border-primary transition-all">
                                            <input type="checkbox" class="sr-only" onchange="window.actionToggleSelect('${t.id}')" ${isSelected ? 'checked' : ''}>
                                            <i class="fas fa-check-circle ${isSelected ? 'text-primary' : 'text-slate-200 dark:text-white/5'} text-lg"></i>
                                        </label>
                                     ` : ''}
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;

        container.querySelector('#hub-btn-assign').onclick = () => window.handleNewAssignment();
        container.querySelector('#hub-btn-return').onclick = () => window.handleBulkReturn();
        container.querySelector('#search-assigns').oninput = (e) => {
            const q = e.target.value.toLowerCase();
            container.querySelectorAll('#assigns-grid > div').forEach(card => {
                const text = card.innerText.toLowerCase();
                card.classList.toggle('hidden', !text.includes(q));
            });
        };
    };

    window.actionToggleSelect = (id) => {
        if (_selectedIds.has(id)) _selectedIds.delete(id);
        else _selectedIds.add(id);
        renderInternal();
    };

    window.handleNewAssignment = async (editId = null, prefill = null) => {
        const item = editId ? _globalTerritorios.find(x => x.id === editId) : null;
        const todayStr = prefill?.date || (item?.fecha_asignacion ? item.fecha_asignacion.split('T')[0] : new Date().toISOString().split('T')[0]);

        const horasOptions = (_globalConfig.horarios_programa && _globalConfig.horarios_programa.length > 0) ? _globalConfig.horarios_programa : ['09:00', '15:00', '19:00'];
        const lugaresOptions = (_globalConfig.lugares && _globalConfig.lugares.length > 0) ? _globalConfig.lugares : ['Salón del Reino'];
        const facetasOptions = (_globalConfig.facetas && _globalConfig.facetas.length > 0) ? _globalConfig.facetas : ['Casa en casa', 'Carritos'];

        const campaigns = await getCampanas();
        const activeConductors = _globalConductores.filter(p => p.es_conductor);

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-layer-group"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Planificar Asignación</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Panel de Gestión Logística</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20 space-y-8">
                    <div class="space-y-4">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                             <i class="fas fa-map-marked-alt text-primary"></i> Territorios Seleccionados
                        </label>
                        ${editId ? `
                            <div class="modern-card flex items-center justify-between !p-5 bg-white dark:bg-white/5 border-primary/20 ring-1 ring-primary/10">
                                <div class="flex items-center gap-4">
                                    <div class="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary text-xl"><i class="fas fa-map"></i></div>
                                    <div class="text-left">
                                        <span class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Territorio ${item.numero}</span>
                                    </div>
                                </div>
                                <input type="hidden" id="asig-terr-single" value="${item.id}" data-num="${item.numero}">
                            </div>
                        ` : `
                            <button id="btn-open-terr-modal" class="w-full flex items-center justify-between p-6 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl transition-all hover:border-primary/50 group shadow-sm hover:shadow-xl hover:shadow-primary/10">
                                <div class="flex items-center gap-4">
                                    <div class="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary text-2xl transition-transform group-hover:scale-110 shadow-inner"><i class="fas fa-search-location"></i></div>
                                    <div class="text-left">
                                        <span id="asig-terr-summary" class="text-sm font-black ${prefill?.territoriesRaw ? 'text-primary' : 'text-slate-900 dark:text-white'} uppercase block leading-tight">${prefill?.territoriesRaw || 'Click para seleccionar...'}</span>
                                    </div>
                                </div>
                                <i class="fas fa-arrow-right text-slate-300 group-hover:translate-x-1 group-hover:text-primary transition-all"></i>
                            </button>
                            <input type="hidden" id="asig-terr-raw" value="${prefill?.territoriesRaw || ''}">
                        `}
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Conductor Principal</label>
                            <select id="asig-cond" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white hover:border-primary outline-none">
                                <option value="" disabled selected>Elegir...</option>
                                ${activeConductors.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Auxiliar (Opcional)</label>
                            <select id="asig-aux" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white outline-none">
                                <option value="">Ninguno</option>
                                ${_globalConductores.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-6 bg-white/50 dark:bg-black/20 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center">Fecha Planificada</label>
                            <input type="date" id="asig-date" value="${todayStr}" class="w-full bg-white dark:bg-white/10 border-none p-4 rounded-2xl font-black text-primary text-center outline-none">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center">Día de Salida</label>
                            <select id="asig-date-salida" class="w-full bg-white dark:bg-white/10 border-none p-4 rounded-2xl font-black text-primary text-center outline-none">
                                <option value="">Elegir...</option>
                                ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => `<option value="${d}">${d}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 flex gap-4">
                    <button id="confirm-asig" class="w-full py-5 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3">
                        <i class="fas fa-check-circle"></i> Confirmar Asignación
                    </button>
                </footer>
            </div>
        `, (modal) => {
            if (!editId) {
                modal.querySelector('#btn-open-terr-modal').onclick = () => {
                    const available = _globalTerritorios.filter(t => t.estado !== 'Asignado' && t.estado !== 'Pendiente');
                    const rawInput = modal.querySelector('#asig-terr-raw');
                    const summaryLabel = modal.querySelector('#asig-terr-summary');
                    showTerritorySelectionModal(rawInput.value, available, (res) => {
                        rawInput.value = res;
                        summaryLabel.innerText = res || 'Click para seleccionar...';
                    }, 'modal-container-nested');
                };
            }

            modal.querySelector('#confirm-asig').onclick = async () => {
                const cond = modal.querySelector('#asig-cond').value;
                const rawTerrs = modal.querySelector('#asig-terr-raw')?.value || modal.querySelector('#asig-terr-single')?.dataset.num;
                if (!cond || !rawTerrs) return showNotification("Faltan datos requeridos", "warning");

                const date = modal.querySelector('#asig-date').value;
                const dayName = modal.querySelector('#asig-date-salida').value;
                const fechaSalida = calculateSalidaDate(date, dayName);

                try {
                    const reqNums = rawTerrs.split(',').map(n => n.trim());
                    for (const num of reqNums) {
                        const t = _globalTerritorios.find(x => x.numero == num);
                        if (t) {
                            await assignTerritorio(t.id, cond, {
                                auxiliar: modal.querySelector('#asig-aux').value || null,
                                fecha_asignacion: new Date(date + 'T12:00:00Z').toISOString(),
                                fecha_salida: fechaSalida,
                                estado: 'Asignado'
                            });
                        }
                    }
                    showNotification("Operación exitosa");
                    modal.remove();
                    await loadData();
                    if (window.dispatchModuleSync) window.dispatchModuleSync();
                } catch (e) { showNotification(e.message, "error"); }
            };
        });
    };

    window.handleBulkReturn = async () => {
        const assigned = _globalTerritorios.filter(t => t.estado === 'Asignado' || t.estado === 'Pendiente');
        if (assigned.length === 0) return showNotification("No hay territorios para devolver", "info");

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-md"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-3xl"><i class="fas fa-file-import"></i></div>
                        <div><h3 class="text-2xl font-black uppercase">Recepción de Informes</h3></div>
                    </div>
                </header>
                <div class="flex-1 p-8 overflow-y-auto space-y-6">
                    ${assigned.map(t => `
                        <div class="p-5 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <input type="checkbox" class="return-check w-6 h-6 rounded-lg accent-primary" value="${t.id}">
                                <div><p class="font-black text-sm">#${t.numero}</p><p class="text-[10px] opacity-60">${t.asignado_a}</p></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <footer class="p-8 border-t"><button id="btn-confirm-return" class="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase">Finalizar Seleccionados</button></footer>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-confirm-return').onclick = async () => {
                const ids = Array.from(modal.querySelectorAll('.return-check:checked')).map(c => c.value);
                if (ids.length === 0) return showNotification("Selecciona al menos uno", "warning");

                try {
                    for (const id of ids) {
                        await returnTerritorio(id, "Devolución masiva", new Date().toISOString().split('T')[0], "Completado");
                    }
                    showNotification("Procesado.");
                    modal.remove();
                    await loadData();
                    if (window.dispatchModuleSync) window.dispatchModuleSync();
                } catch (e) { showNotification(e.message, "error"); }
            };
        });
    };

    window.handleEditActive = async (id, num, cond) => {
        // Logic to update existing assignment
        await window.handleNewAssignment(id);
    };

    window.viewHistoryPhoto = (src) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[2000] bg-black/95 flex items-center justify-center p-4 animate-fade-in touch-none';
        overlay.innerHTML = `
        <button class="absolute top-6 right-6 text-white text-3xl transition-transform hover:rotate-90 p-4"><i class="fas fa-times"></i></button>
        <img src="${src}" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-scale-in">
    `;
        overlay.querySelector('button').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    };

    window.openHistoryEditor = async (recId, territoryId, territoryNum) => {
        try {
            const hFull = await getTerritoryHistory(territoryId);
            const rec = recId ? hFull.find(h => h.id === recId) : null;
            const config = await getConfiguracion();
            const allP = await getPublicadores();

            showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0b0e14] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-slate-900 p-8 text-white relative">
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-2xl">
                            <i class="fas fa-edit"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">${rec ? 'Editar Entrada' : 'Nuevo Registro'}</h3>
                            <p class="text-[10px] opacity-40 uppercase tracking-[0.4em] font-black">Historial T-${territoryNum}</p>
                        </div>
                    </div>
                </header>
                
                <div class="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conductor</label>
                            <select id="h-edit-cond" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white appearance-none">
                                <option value="">Seleccionar...</option>
                                ${allP.filter(p => p.es_conductor).map(p => `<option value="${p.nombre}" ${rec?.conductor === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Auxiliar</label>
                            <select id="h-edit-aux" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white appearance-none">
                                <option value="">Ninguno</option>
                                ${allP.map(p => `<option value="${p.nombre}" ${rec?.auxiliar === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Asignación</label>
                            <input type="date" id="h-edit-date-asig" value="${rec?.fecha_asignacion ? rec.fecha_asignacion.split('T')[0] : new Date().toISOString().split('T')[0]}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Entrega</label>
                            <input type="date" id="h-edit-date-ent" value="${rec?.fecha_entrega ? rec.fecha_entrega.split('T')[0] : ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label>
                            <select id="h-edit-estado" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white appearance-none">
                                <option value="Asignado" ${rec?.estado === 'Asignado' ? 'selected' : ''}>Asignado</option>
                                <option value="Completado" ${rec?.estado === 'Completado' ? 'selected' : ''}>Completado</option>
                                <option value="Pendiente" ${rec?.estado === 'Pendiente' ? 'selected' : ''}>Incompleto</option>
                                <option value="Devuelto" ${rec?.estado === 'Devuelto' ? 'selected' : ''}>Devuelto</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Faceta</label>
                            <select id="h-edit-faceta" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white appearance-none">
                                ${(config.facetas || ['Casa en Casa']).map(f => `<option value="${f}" ${rec?.faceta === f ? 'selected' : ''}>${f}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones</label>
                        <textarea id="h-edit-obs" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white min-h-[100px]">${rec?.observaciones || ''}</textarea>
                    </div>

                    <div class="space-y-4">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Evidencia Fotográfica</label>
                        <div id="h-edit-photos-grid" class="flex flex-wrap gap-4 min-h-[80px] p-6 bg-white dark:bg-black/20 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10">
                            ${(rec?.fotos || []).map((f, i) => `
                                <div class="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 group">
                                    <img src="${f}" class="w-full h-full object-cover">
                                    <button onclick="this.parentElement.remove()" class="absolute inset-0 bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity delete-photo" data-src="${f}">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            `).join('')}
                            <label class="flex flex-col items-center justify-center w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-xl cursor-pointer hover:bg-primary/10 hover:text-primary transition-all text-slate-400 border border-transparent hover:border-primary/20">
                                <i class="fas fa-camera text-xl mb-1"></i>
                                <span class="text-[7px] font-black tracking-widest uppercase">Subir</span>
                                <input type="file" id="h-photo-input" accept="image/*" class="hidden" multiple>
                            </label>
                        </div>
                    </div>
                </div>
                
                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button onclick="this.closest('#modal-container').classList.add('hidden')" class="flex-1 py-5 rounded-2xl bg-slate-50 dark:bg-white/5 text-slate-400 font-black text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
                    <button id="h-save-btn" class="flex-[2] py-5 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all">Guardar Cambios</button>
                </footer>
            </div>
        `, (modal) => {
                const photoInput = modal.querySelector('#h-photo-input');
                const photoGrid = modal.querySelector('#h-edit-photos-grid');

                photoInput.onchange = (e) => {
                    Array.from(e.target.files).forEach(file => {
                        if (file.size > 800 * 1024) return showNotification("Foto muy grande (max 800KB)", "warning");
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const container = document.createElement('div');
                            container.className = 'relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 group animate-scale-in';
                            container.innerHTML = `
                            <img src="${ev.target.result}" class="w-full h-full object-cover">
                            <button onclick="this.parentElement.remove()" class="absolute inset-0 bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        `;
                            photoGrid.insertBefore(container, photoGrid.lastElementChild);
                        };
                        reader.readAsDataURL(file);
                    });
                };

                modal.querySelector('#h-save-btn').onclick = async () => {
                    const btn = modal.querySelector('#h-save-btn');
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Procesando...';

                    try {
                        const photos = Array.from(photoGrid.querySelectorAll('img')).map(img => img.src);
                        const data = {
                            territorio_id: territoryId,
                            numero: territoryNum,
                            conductor: modal.querySelector('#h-edit-cond').value,
                            auxiliar: modal.querySelector('#h-edit-aux').value || null,
                            fecha_asignacion: modal.querySelector('#h-edit-date-asig').value,
                            fecha_entrega: modal.querySelector('#h-edit-date-ent').value || null,
                            estado: modal.querySelector('#h-edit-estado').value,
                            faceta: modal.querySelector('#h-edit-faceta').value,
                            observaciones: modal.querySelector('#h-edit-obs').value.trim(),
                            fotos: photos
                        };

                        if (!data.conductor || !data.fecha_asignacion) {
                            throw new Error("Conductor y fecha de asignación son requeridos");
                        }

                        if (recId) await updateHistoryRecord(recId, data);
                        else await addHistoryRecord(data);

                        showNotification("Registro de historial guardado exitosamente", "success");
                        modal.remove();
                        window.showTerritoryHistoryAdmin(territoryId, territoryNum);
                    } catch (e) {
                        showNotification(e.message, "error");
                        btn.disabled = false;
                        btn.innerHTML = 'Guardar Cambios';
                    }
                };
            });
        } catch (e) {
            console.error(e);
            showNotification("Error: " + e.message, "error");
        }
    };

    window.editHistoryEntry = (recId, territoryId, territoryNum) => window.openHistoryEditor(recId, territoryId, territoryNum);

    window.deleteHistoryEntry = (recId, territoryId, territoryNum) => {
        showCustomConfirm("¿Seguro que quieres eliminar este registro del historial?", async () => {
            try {
                await deleteHistoryRecord(recId);
                showNotification("Registro eliminado");
                window.showTerritoryHistoryAdmin(territoryId, territoryNum);
            } catch (e) {
                showNotification("Error: " + e.message, "error");
            }
        });
    };

    window.showTerritoryHistoryAdmin = async (id, num) => {
        try {
            const history = await getTerritoryHistory(id);
            const config = await getConfiguracion();
            const allPublicadores = await getPublicadores();

            showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden shadow-2xl">
                <header class="shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 p-8 text-white relative overflow-hidden">
                     <div class="absolute -right-20 -top-20 w-64 h-64 bg-white/10 blur-[80px] rounded-full"></div>
                     <div class="relative z-10 flex justify-between items-center">
                        <div class="flex items-center gap-6">
                            <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30 animate-float">
                                <i class="fas fa-history"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Historial T-${num}</h3>
                                <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Control de Administración</p>
                            </div>
                        </div>
                        <button id="admin-add-history" class="bg-white/20 hover:bg-white/30 text-white p-4 rounded-2xl backdrop-blur-md border border-white/20 transition-all active:scale-95 group">
                            <i class="fas fa-plus group-hover:rotate-90 transition-transform"></i>
                        </button>
                     </div>
                </header>
                
                <div id="admin-history-list" class="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20 space-y-6">
                    ${history.length === 0 ? `
                        <div class="flex flex-col items-center justify-center py-20 opacity-30 text-center space-y-6">
                            <div class="w-24 h-24 bg-slate-200 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center text-4xl mx-auto mb-6">
                                <i class="fas fa-scroll"></i>
                            </div>
                            <p class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Sin registros en el sistema</p>
                        </div>
                    ` : history.map(rec => {
                const dateVal = rec.fecha_salida || rec.fecha_asignacion;
                const fmtDate = dateVal ? new Date(dateVal).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                const isCompleted = rec.estado === 'Completado' || rec.estado === 'Predicado' || rec.estado === 'Devuelto';

                return `
                                <div class="modern-card !p-6 bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-amber-500/30 transition-all duration-300 shadow-sm relative group">
                                    <div class="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                                        <div class="flex items-center gap-4">
                                            <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl shadow_inner border border-amber-500/10">
                                                <i class="fas fa-user-circle"></i>
                                            </div>
                                            <div>
                                                <h4 class="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none mb-1.5">${rec.conductor || 'Sin nombre'}</h4>
                                                <p class="text-[9px] text-amber-500 font-black uppercase tracking-widest">${rec.faceta || 'Predicación'}</p>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-3 w-full md:w-auto">
                                             <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-black/20 px-4 py-2 rounded-xl border border-slate-100 dark:border-white/10 flex-1 md:flex-none text-center">${fmtDate}</span>
                                             <div class="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                 <button onclick="window.editHistoryEntry('${rec.id}', '${id}', '${num}')" class="w-9 h-9 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all"><i class="fas fa-edit text-xs"></i></button>
                                                 <button onclick="window.deleteHistoryEntry('${rec.id}', '${id}', '${num}')" class="w-9 h-9 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i class="fas fa-trash-alt text-xs"></i></button>
                                             </div>
                                        </div>
                                    </div>
                                    
                                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                                        <div class="p-4 bg-slate-50 dark:bg-black/30 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <p class="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Estado</p>
                                            <p class="text-[10px] font-black ${isCompleted ? 'text-emerald-500' : 'text-amber-500'} uppercase">${rec.estado || '---'}</p>
                                        </div>
                                        <div class="p-4 bg-slate-50 dark:bg-black/30 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <p class="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Auxiliar</p>
                                            <p class="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase truncate">${rec.auxiliar || '---'}</p>
                                        </div>
                                        <div class="p-4 bg-slate-50 dark:bg-black/30 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <p class="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Turno</p>
                                            <p class="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">${rec.turno || '---'}</p>
                                        </div>
                                        <div class="p-4 bg-slate-50 dark:bg-black/30 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <p class="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Entrega</p>
                                            <p class="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">${rec.fecha_entrega ? new Date(rec.fecha_entrega).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'Asignado'}</p>
                                        </div>
                                    </div>

                                    ${rec.observaciones ? `
                                        <div class="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 mb-4">
                                            <p class="text-[10px] text-amber-600/80 dark:text-amber-400/80 italic font-bold">"${rec.observaciones}"</p>
                                        </div>
                                    ` : ''}

                                    ${rec.fotos && rec.fotos.length > 0 ? `
                                        <div class="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                            ${rec.fotos.map(f => `
                                                <div class="shrink-0 w-24 h-24 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-black shadow-sm group/photo cursor-pointer" onclick="window.viewHistoryPhoto('${f}')">
                                                    <img src="${f}" class="w-full h-full object-cover group-hover:scale-110 transition-transform">
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>`;
            }).join('')}
                </div>
            </div>
        `, (modal) => {
                modal.querySelector('#admin-add-history').onclick = () => window.openHistoryEditor(null, id, num);
            }, 'max-w-3xl');
        } catch (e) {
            console.error(e);
            showNotification("Error: " + e.message, "error");
        }
    };

    window.actionHistory = (id, num) => window.showTerritoryHistoryAdmin(id, num);

    await loadData();
};

const renderS12View = async (container) => {
    const territorios = await getTerritories();
    const config = await getConfiguracion();

    container.innerHTML = `
        <div class="space-y-8 p-2 animate-fade-in">
            <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div>
                    <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Registro Maestro S-12</h3>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1 ml-1">Configuración técnica de mapas y sectores</p>
                </div>
                
                <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <button id="btn-export-s12-single" class="bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/10 hover:bg-slate-50 transition-all flex items-center gap-2">
                        <i class="fas fa-file-pdf"></i> S-12 (1 p/h)
                    </button>
                    <button id="btn-export-s12-half" class="bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/10 hover:bg-slate-50 transition-all flex items-center gap-2">
                        <i class="fas fa-columns"></i> S-12 (2 p/h)
                    </button>
                    <button id="btn-export-s12-quad" class="bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/10 hover:bg-slate-50 transition-all flex items-center gap-2">
                        <i class="fas fa-th-large"></i> S-12 (4 p/h)
                    </button>
                    <button id="btn-add-territorio" class="bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all flex items-center gap-2">
                        <i class="fas fa-plus"></i> Nuevo Territorio
                    </button>
                </div>
            </div>

            <div class="flex flex-col md:flex-row justify-between items-center gap-6 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-lg">
                 <div class="flex items-center gap-5">
                    <div class="flex flex-col">
                        <h2 class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1">Buscador</h2>
                        <div id="s12-stats" class="text-[11px] font-black text-primary flex items-center gap-3"></div>
                    </div>
                 </div>
                 
                 <div class="relative w-full md:w-80 group">
                     <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500">
                        <i class="fas fa-search text-xs"></i>
                     </span>
                     <input type="text" id="search-s12" placeholder="Filtrar por número..." class="w-full pl-12 pr-5 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner">
                 </div>
            </div>

            <div id="s12-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-20">
                <!-- Grid dinámico -->
            </div>
        </div>
    `;

    const renderGrid = (query = '') => {
        const grid = document.getElementById('s12-grid');
        const stats = document.getElementById('s12-stats');
        if (!grid || !stats) return;

        const filtered = territorios
            .filter(t => t.numero.toString().toLowerCase().includes(query.toLowerCase()))
            .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));

        stats.innerHTML = `<span class="opacity-60">${filtered.length} territorios encontrados</span>`;

        grid.innerHTML = filtered.map(t => `
            <div class="bg-white dark:bg-[#151515] rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/5 relative group shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col h-full">
                <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                
                <!-- Mini Actions Overlay -->
                <div class="absolute top-4 right-4 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:translate-x-4 lg:group-hover:translate-x-0 transition-all z-20">
                     <button class="w-10 h-10 bg-white dark:bg-[#222] text-amber-500 rounded-xl shadow-lg border border-slate-100 dark:border-white/10 hover:scale-110 transition-transform flex items-center justify-center active:scale-95" onclick="window.showTerritoryHistoryAdmin('${t.id}', '${t.numero}')" title="Ver Historial">
                        <i class="fas fa-history text-xs"></i>
                     </button>
                     <button class="w-10 h-10 bg-white dark:bg-[#222] text-blue-500 rounded-xl shadow-lg border border-slate-100 dark:border-white/10 hover:scale-110 transition-transform flex items-center justify-center active:scale-95" onclick="window.editTerritorio('${t.id}')" title="Editar">
                        <i class="fas fa-edit text-xs"></i>
                     </button>
                    <button class="w-10 h-10 bg-white dark:bg-[#222] text-rose-500 rounded-xl shadow-lg border border-slate-100 dark:border-white/10 hover:scale-110 transition-transform flex items-center justify-center active:scale-95" onclick="window.deleteTerritorio('${t.id}')" title="Eliminar">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>

                <!-- Map Preview -->
                <div class="h-44 bg-slate-50 dark:bg-black/40 rounded-[2rem] mb-6 overflow-hidden border border-slate-100 dark:border-white/5 flex items-center justify-center relative shadow-inner group-hover:shadow-none transition-shadow">
                    <img src="${formatMapUrl(t.imagen) || 'https://via.placeholder.com/300x200?text=No+Map'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                </div>

                <!-- Content Info -->
                <div class="relative z-10 flex-1 flex flex-col">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest shadow-inner">#${t.numero}</span>
                        <h4 class="font-black text-slate-800 dark:text-white uppercase tracking-tight text-lg">Territorio ${t.numero}</h4>
                    </div>
                    <div class="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-[0.1em] mt-auto border-l-2 border-slate-200 dark:border-white/10 pl-3 py-1 space-y-0.5">
                        <div class="truncate">${t.localidad ? `<span class="text-primary/70 mr-1">LOC:</span> ${t.localidad}` : (t.manzanas || 'Sin sectores definidos')}</div>
                        ${t.localidad ? `<div class="truncate opacity-50 text-[8px]">${t.manzanas || ''}</div>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    };

    renderGrid();

    document.getElementById('search-s12').oninput = (e) => renderGrid(e.target.value);

    document.getElementById('btn-export-s12-single').onclick = () => window.exportS12Form && window.exportS12Form(territorios, 1);
    document.getElementById('btn-export-s12-half').onclick = () => window.exportS12Form && window.exportS12Form(territorios, 2);
    document.getElementById('btn-export-s12-quad').onclick = () => window.exportS12Form && window.exportS12Form(territorios, 4);

    document.getElementById('btn-add-territorio').onclick = () => {
        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-plus"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Nuevo Territorio</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Registro Maestro S-12</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Número de Territorio</label>
                            <input type="text" id="new-t-num" placeholder="Ej: 101" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Localidad (Recomendado)</label>
                            <input type="text" id="new-t-localidad" placeholder="Ej: Urbanización ..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Manzanas / Sectores</label>
                            <input type="text" id="new-t-manzanas" placeholder="Ej: Mz. 1, Mz. 2" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                        </div>

                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Imagen del Mapa</label>
                            <div class="bg-white dark:bg-white/5 p-6 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                                <div class="flex items-center gap-6">
                                    <label class="cursor-pointer bg-primary hover:bg-primary-light text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 flex items-center gap-3">
                                        <i class="fas fa-camera"></i> <span>Subir Mapa</span>
                                        <input type="file" id="new-t-file" accept="image/*" class="hidden">
                                    </label>
                                    <span id="file-name-new" class="text-[10px] text-slate-500 font-black uppercase">Sin archivo seleccionado</span>
                                </div>
                                <input type="hidden" id="new-t-base64">
                                <div id="preview-new-container" class="mt-6 hidden">
                                     <div class="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-black/40">
                                         <img id="preview-new" class="w-full h-auto max-h-48 object-contain mx-auto">
                                     </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="shrink-0 p-6 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                    <button id="save-new-territorio" class="w-full bg-primary py-5 rounded-2xl text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all">
                        Registrar Territorio
                    </button>
                </div>
            </div>
        `, async (modal) => {
            const fileInput = modal.querySelector('#new-t-file');
            const nameDisplay = modal.querySelector('#file-name-new');
            const previewContainer = modal.querySelector('#preview-new-container');
            const previewImg = modal.querySelector('#preview-new');
            const base64Input = modal.querySelector('#new-t-base64');
            const saveBtn = modal.querySelector('#save-new-territorio');

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 800 * 1024) return showNotification("La imagen es muy grande. Máx 800KB.", "warning");
                    nameDisplay.textContent = file.name;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        base64Input.value = ev.target.result;
                        previewImg.src = ev.target.result;
                        previewContainer.classList.remove('hidden');
                    };
                    reader.readAsDataURL(file);
                }
            });

            saveBtn.onclick = async () => {
                const num = modal.querySelector('#new-t-num').value.trim();
                if (!num) return showNotification("El número es obligatorio", "error");

                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...';

                try {
                    await addTerritorio({
                        numero: num,
                        localidad: modal.querySelector('#new-t-localidad').value.trim(),
                        manzanas: modal.querySelector('#new-t-manzanas').value.trim(),
                        imagen: base64Input.value
                    });
                    modal.remove();
                    renderS12View(container);
                    showNotification("Territorio registrado exitosamente", "success");
                } catch (err) {
                    console.error(err);
                    showNotification("Error al registrar territorio", "error");
                    saveBtn.disabled = false; saveBtn.innerText = "Registrar Territorio";
                }
            };
        });
    };

    window.deleteTerritorio = async (id) => {
        showCustomConfirm('¿Eliminar este territorio? Se perderán todos sus datos maestros.', async () => {
            try {
                await deleteTerritorio(id);
                showNotification("Territorio eliminado");
                renderS12View(container);
            } catch (e) {
                showNotification("Error: " + e.message, "error");
            }
        });
    };

    window.editTerritorio = async (id) => {
        const t = territorios.find(x => x.id === id);
        if (!t) return;

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-edit"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Editar Territorio</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Identificador #${t.numero}</p>
                        </div>
                    </div>
                </header>
                <div class="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Número de Territorio</label>
                            <input type="text" id="edit-t-num" value="${t.numero}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Localidad (Aparece en S-12)</label>
                            <input type="text" id="edit-t-localidad" value="${t.localidad || ''}" placeholder="Ej: Urbanización ..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Manzanas / Sectores</label>
                            <input type="text" id="edit-t-manzanas" value="${t.manzanas || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Imagen del Mapa</label>
                            <div class="bg-white dark:bg-white/5 p-6 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                                <div class="flex items-center gap-6">
                                    <label class="cursor-pointer bg-primary hover:bg-primary-light text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 flex items-center gap-3">
                                        <i class="fas fa-camera"></i> <span>Actualizar</span>
                                        <input type="file" id="edit-t-file" accept="image/*" class="hidden">
                                    </label>
                                    <span id="file-name-edit" class="text-[10px] text-slate-500 font-black uppercase truncate">${t.imagen ? 'Imagen Actual' : 'Sin imagen'}</span>
                                </div>
                                <input type="hidden" id="edit-t-base64" value="${t.imagen || ''}">
                                <div id="preview-edit-container" class="mt-6 ${t.imagen ? '' : 'hidden'}">
                                     <div class="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-black/40">
                                         <img id="preview-edit" src="${t.imagen || ''}" class="w-full h-auto max-h-48 object-contain mx-auto">
                                     </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="shrink-0 p-6 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                    <button id="update-territorio" class="w-full bg-primary py-5 rounded-2xl text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all">
                        Confirmar Cambios
                    </button>
                </div>
            </div>
        `, async (modal) => {
            const fileInput = modal.querySelector('#edit-t-file');
            const nameDisplay = modal.querySelector('#file-name-edit');
            const previewContainer = modal.querySelector('#preview-edit-container');
            const previewImg = modal.querySelector('#preview-edit');
            const base64Input = modal.querySelector('#edit-t-base64');
            const updateBtn = modal.querySelector('#update-territorio');

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 800 * 1024) return showNotification("La imagen es muy grande. Máx 800KB.", "warning");
                    nameDisplay.textContent = file.name;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        base64Input.value = ev.target.result;
                        previewImg.src = ev.target.result;
                        previewContainer.classList.remove('hidden');
                    };
                    reader.readAsDataURL(file);
                }
            });

            updateBtn.onclick = async () => {
                updateBtn.disabled = true;
                updateBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Actualizando...';
                try {
                    await updateTerritorio(id, {
                        numero: modal.querySelector('#edit-t-num').value.trim(),
                        localidad: modal.querySelector('#edit-t-localidad').value.trim(),
                        manzanas: modal.querySelector('#edit-t-manzanas').value.trim(),
                        imagen: base64Input.value
                    });
                    modal.remove();
                    renderS12View(container);
                    showNotification("Territorio actualizado correctamente", "success");
                } catch (err) {
                    console.error(err);
                    showNotification("Error al actualizar territorio", "error");
                    updateBtn.disabled = false; updateBtn.innerText = "Confirmar Cambios";
                }
            };
        });
    };
};

const renderS13CommandCenter = async (container) => {
    container.innerHTML = `<div class="p-16 text-center opacity-30 italic">Módulo de gestión masiva S-13 en desarrollo...</div>`;
};

const renderProgramaTab = async (container) => {
    const today = new Date();
    let currentWeekStart = getMonday(today);

    container.innerHTML = `
        <div class="max-w-[1700px] mx-auto space-y-8 p-6">
            <header class="flex justify-between items-center">
                <h3 class="text-2xl font-black">Planificación Semanal</h3>
                <div class="flex gap-4">
                    <button id="prev-week" class="p-4 bg-white rounded-2xl shadow-sm"><i class="fas fa-chevron-left"></i></button>
                    <button id="next-week" class="p-4 bg-white rounded-2xl shadow-sm"><i class="fas fa-chevron-right"></i></button>
                </div>
            </header>
            <div id="prog-content" class="min-h-[400px]"></div>
        </div>
    `;
};
