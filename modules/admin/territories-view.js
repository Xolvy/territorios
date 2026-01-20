
import {
    getConfiguracion, getTerritorios, addTerritorio, deleteTerritorio, updateTerritorio,
    assignTerritorioParcial, assignTerritorio, returnTerritorio, returnTerritorioMultiple,
    transferTerritory, getTerritoryHistory, getHistorialReport, addHistoryRecord,
    updateHistoryRecord, deleteHistoryRecord, cancelarAsignacion, updateAssignmentData,
    getConductores, getPublicadores, getProgramaSemanal, saveProgramaSemanal,
    deleteProgramaSemanal, syncSlotWithTerritories, getRecursos, addRecurso,
    updateRecurso, getCampanas, saveCampana, getGroupsConfig, returnTerritorioParcial,
    rebuildHistoryFromSchedule, runSystemDiagnosticsAndRepair, masterResetAssignments
} from '../../data/firestore-services.js?v=2.0.1';
import {
    formatPhoneNumber, getStatusColor, showNotification, formatMapUrl,
    ensureOnline, generatePlainXLS
} from '../utils/helpers.js?v=2.0.1';
import { UIHelpers, showModal, showCustomConfirm, showCustomPrompt } from '../services/ui-helpers.js?v=2.0.1';
import { GlassCard, GlassButton, GlassInput } from '../services/ui-components.js?v=2.0.1';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { renderHistoryTab, renderS13CommandCenter } from '../report-s13.js?v=2.0.1';

const fmtDate = UIHelpers.fmtDate;
const getMonday = UIHelpers.getMonday;
const formatDateId = UIHelpers.formatDateId;
const formatDisplayDateRange = UIHelpers.formatDisplayDateRange;

// --- SHARED STATE ---
let _globalTerritorios = [];
let _globalConductores = [];
let _globalHistory = [];
let _globalConfig = {};
let _globalPrograma = null;
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

export const renderRecursosTab = async (container) => {
    const recursos = await getRecursos();

    container.innerHTML = `
        <div class="flex flex-wrap justify-between items-center mb-10 gap-6">
            <div>
                <h3 class="text-h3 text-slate-900 dark:text-white">Material de Apoyo</h3>
                <p class="text-xs text-slate-500 mt-1">Recursos útiles para los publicadores</p>
            </div>
            <button id="add-recurso-btn" class="bg-primary hover:bg-primary-light text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-3 text-xs uppercase tracking-wider">
                <i class="fas fa-plus"></i>
                Agregar Recurso
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            ${recursos.length === 0 ? `
                <div class="col-span-full modern-card !py-20 text-center opacity-60 italic">
                    <i class="fas fa-folder-open text-4xl mb-4 block"></i>
                    No hay recursos agregados aún.
                </div>
            ` :
            recursos.map(r => `
                <div class="modern-card !p-0 overflow-hidden flex flex-col group border border-slate-200 dark:border-white/5">
                    <div class="h-44 bg-slate-100 dark:bg-white/5 relative overflow-hidden">
                        ${r.imagen ? `<img src="${r.imagen}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">` :
                    `<div class="w-full h-full flex items-center justify-center text-slate-300 text-5xl opacity-40">
                            <i class="fas fa-book"></i>
                        </div>`}
                        <div class="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onclick="window.editRecurso('${r.id}')" class="bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-md hover:bg-primary hover:text-white transition-colors">
                                <i class="fas fa-edit text-xs"></i>
                             </button>
                             <button onclick="window.deleteRecurso('${r.id}')" class="bg-white/90 dark:bg-slate-900/90 text-red-500 w-9 h-9 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-md hover:bg-red-500 hover:text-white transition-colors">
                                <i class="fas fa-trash-alt text-xs"></i>
                             </button>
                        </div>
                    </div>
                    <div class="p-6 flex-1 flex flex-col">
                        <h4 class="text-lg font-bold text-slate-900 dark:text-white mb-3 leading-tight group-hover:text-primary transition-colors">${r.titulo}</h4>
                        <p class="text-[13px] text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 flex-1 leading-relaxed">${r.descripcion || 'Sin descripción adicional.'}</p>
                        <a href="${r.url}" target="_blank" class="flex items-center justify-center gap-3 w-full bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 py-3.5 rounded-xl border border-slate-100 dark:border-white/5 text-xs font-bold hover:bg-primary hover:text-white hover:border-primary transition-all group/link">
                            Abrir Recurso
                            <i class="fas fa-external-link-alt text-[10px] group-hover/link:translate-x-0.5 transition-transform"></i>
                        </a>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('add-recurso-btn').addEventListener('click', () => {
        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-plus"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Nueva Ayuda</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Agregar Material de Apoyo</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Título de la Ayuda</label>
                            <input type="text" id="rec-title" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase shadow-inner" placeholder="Ej: Video: ¿Por qué estudiar la Biblia?">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">URL del Enlace</label>
                            <input type="url" id="rec-url" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner" placeholder="https://jw.org/...">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">URL Imagen (Opcional)</label>
                            <input type="url" id="rec-img" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner" placeholder="https://...">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Descripción</label>
                            <textarea id="rec-desc" rows="3" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all resize-none shadow-inner" placeholder="¿De qué trata este recurso?"></textarea>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-rec" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10 transition-all active:scale-95">
                        Cancelar
                    </button>
                    <button id="save-rec-btn" class="flex-[1.5] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> Guardar Recurso
                    </button>
                </footer>
            </div>
        `, async (modal) => {
            modal.querySelector('#btn-cancel-rec').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#save-rec-btn').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const title = modal.querySelector('#rec-title').value;
                const url = modal.querySelector('#rec-url').value;
                const img = modal.querySelector('#rec-img').value;
                const desc = modal.querySelector('#rec-desc').value;

                if (!title || !url) return showNotification("Título y URL requeridos", "warning");

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...';

                try {
                    await addRecurso({ titulo: title, url, imagen: img, descripcion: desc });
                    showNotification("Recurso agregado correctamente", "success");
                    modal.classList.add('hidden');
                    if (window.dispatchModuleSync) window.dispatchModuleSync();
                    else renderRecursosTab(container);
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Guardar Recurso';
                }
            });
        });
    });

    // Expose delete
    window.deleteRecurso = async (id) => {
        showCustomConfirm("¿Eliminar este material de apoyo?", async () => {
            await deleteRecurso(id);
            showNotification("Recurso eliminado", "success");
            if (window.dispatchModuleSync) window.dispatchModuleSync();
            else renderRecursosTab(container);
        });
    };

    // Expose edit
    window.editRecurso = (id) => {
        const recurso = recursos.find(r => r.id === id);
        if (!recurso) return;

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-edit"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Editar Ayuda</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">${recurso.titulo}</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Título de la Ayuda</label>
                            <input type="text" id="edit-rec-title" value="${recurso.titulo || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase shadow-inner" placeholder="Ej: Video: ¿Por qué estudiar la Biblia?">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">URL del Enlace</label>
                            <input type="url" id="edit-rec-url" value="${recurso.url || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner" placeholder="https://jw.org/...">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">URL Imagen (Opcional)</label>
                            <input type="url" id="edit-rec-img" value="${recurso.imagen || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner" placeholder="https://...">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Breve Descripción</label>
                            <textarea id="edit-rec-desc" rows="3" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all resize-none shadow-inner" placeholder="¿De qué trata este recurso?">${recurso.descripcion || ''}</textarea>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-edit-rec" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10 transition-all active:scale-95">
                        Cancelar
                    </button>
                    <button id="update-rec-btn" class="flex-[1.5] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> Actualizar Material
                    </button>
                </footer>
            </div>
        `, async (modal) => {
            modal.querySelector('#btn-cancel-edit-rec').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#update-rec-btn').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const title = modal.querySelector('#edit-rec-title').value;
                const url = modal.querySelector('#edit-rec-url').value;
                const img = modal.querySelector('#edit-rec-img').value;
                const desc = modal.querySelector('#edit-rec-desc').value;

                if (!title || !url) return showNotification("Título y URL requeridos", "warning");

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Actualizando...';

                try {
                    await updateRecurso(id, { titulo: title, url, imagen: img, descripcion: desc });
                    showNotification("Recurso actualizado", "success");
                    modal.classList.add('hidden');
                    if (window.dispatchModuleSync) window.dispatchModuleSync();
                    else renderRecursosTab(container);
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Actualizar Material';
                }
            });
        });
    };
};

const renderAsignacionesView = async (container) => {
    const loadData = async () => {
        const [t, c, h, conf] = await Promise.all([
            getTerritorios(), getConductores(), getHistorialReport(), getConfiguracion()
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
                         <input type="text" id="search-assigns" placeholder="Buscar..." class="w-full pl-14 pr-5 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner">
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
                    <div class="relative z-10 flex items-center justify-between">
                        <div class="flex items-center gap-6">
                            <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                                <i class="fas fa-layer-group"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Planificar Asignación</h3>
                                <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Panel de Gestión Logística</p>
                            </div>
                        </div>
                        <button onclick="this.closest('#modal-container').classList.add('hidden')" class="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all">
                            <i class="fas fa-times"></i>
                        </button>
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
    window.actionEditActive = window.handleEditActive;

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
                        <div class="flex items-center gap-2">
                            <button id="admin-add-history" class="bg-white/20 hover:bg-white/30 text-white p-4 rounded-2xl backdrop-blur-md border border-white/20 transition-all active:scale-95 group">
                                <i class="fas fa-plus group-hover:rotate-90 transition-transform"></i>
                            </button>
                            <button onclick="this.closest('#modal-container').classList.add('hidden')" class="bg-white/20 hover:bg-white/30 text-white p-4 rounded-2xl backdrop-blur-md border border-white/20 transition-all active:scale-95">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
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

const showGroupSelectionModal = async (current, onSelect) => {
    const today = new Date().getDay();
    const isWeekend = today === 0 || today === 6;

    if (!isWeekend) {
        showNotification("La selección de grupos solo está disponible los Sábados y Domingos", "warning");
        return;
    }

    const configuredGroups = await getGroupsConfig();
    const currentList = current ? current.split(',').map(s => s.trim()) : [];

    showModal(`
        <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2rem] overflow-hidden">
            <header class="shrink-0 bg-primary p-6 text-white relative">
                <div class="absolute inset-0 bg-white/10 backdrop-blur-xl"></div>
                <div class="relative z-10 flex justify-between items-center">
                    <div>
                        <h3 class="font-black uppercase tracking-widest text-xs">Seleccionar Grupos</h3>
                        <p class="text-[9px] opacity-70 font-bold uppercase mt-0.5">Filtrado dominical</p>
                    </div>
                    <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl shadow-lg">
                        <i class="fas fa-users"></i>
                    </div>
                </div>
            </header>
            
            <div class="flex-1 p-5 space-y-3 overflow-y-auto custom-scrollbar">
                ${configuredGroups.map(g => `
                    <label class="flex items-center gap-3 p-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 cursor-pointer transition-all hover:border-primary/50">
                        <input type="checkbox" name="grp-check" value="${g.nombre}" ${currentList.includes(g.nombre) ? 'checked' : ''} class="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary accent-primary">
                        <span class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">${g.nombre}</span>
                    </label>
                `).join('')}
            </div>

            <footer class="shrink-0 p-5 bg-slate-50 dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex flex-col gap-3">
                <button id="modal-grp-confirm" class="w-full bg-primary text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <i class="fas fa-check-circle"></i> Confirmar Selección
                </button>
                <button id="modal-grp-none" class="w-full bg-white dark:bg-white/5 py-4 rounded-xl text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase tracking-[0.2em] border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-center gap-2">
                    <i class="fas fa-times-circle"></i> Limpiar Todo
                </button>
            </footer>
        </div>
    `, (modal) => {
        modal.querySelector('#modal-grp-confirm').onclick = () => {
            const selected = Array.from(modal.querySelectorAll('input[name="grp-check"]:checked')).map(i => i.value);
            modal.classList.add('hidden');
            onSelect(selected.join(', '));
        };
        modal.querySelector('#modal-grp-none').onclick = () => {
            modal.classList.add('hidden');
            onSelect('');
        };
    }, 'max-w-xs', 'modal-container-nested');
};

const renderProgramaTab = async (container) => {
    const today = new Date();
    let currentWeekStart = getMonday(today);
    let programa = { dias: [] };

    const saveCurrentWeek = async () => {
        const weekId = formatDateId(currentWeekStart);
        await saveProgramaSemanal(weekId, programa);
        if (window.dispatchModuleSync) window.dispatchModuleSync();
    };

    const territoriesPromise = getTerritorios();
    const configPromise = getConfiguracion();
    const conductorsPromise = getConductores();
    const publishersPromise = getPublicadores();

    const [territorios, config, allPersonnel] = await Promise.all([
        territoriesPromise, configPromise, publishersPromise
    ]);

    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    territorios.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));
    const activeConductors = allPersonnel.filter(p => p.es_conductor).sort((a, b) => a.nombre.localeCompare(b.nombre));

    _globalTerritorios = territorios;
    _globalPrograma = programa;

    const options = {
        Lugar: config.lugares && config.lugares.length > 0 ? config.lugares : ['Salón del Reino'],
        Hora: config.horarios_programa && config.horarios_programa.length > 0 ? config.horarios_programa : ['09:00', '15:00', '19:00'],
        Conductor: activeConductors.map(c => c.nombre),
        Auxiliar: activeConductors.map(p => p.nombre),
        Faceta: config.facetas && config.facetas.length > 0 ? config.facetas : ['Casa en casa', 'Carritos'],
        Territorio: territorios.map(t => t.numero),
        Grupos: ['Todos', 'Grupos 1 y 5', 'Grupos 2 y 6', 'Grupos 3 y 4', ...Array.from({ length: 12 }, (_, i) => `Grupo ${i + 1}`)]
    };

    container.innerHTML = `
        <div class="max-w-[1700px] mx-auto space-y-8 animate-fade-in p-2 md:p-6">
            <header class="flex flex-col xl:flex-row items-center justify-between gap-6">
                <div class="flex items-center gap-5">
                    <div class="w-14 h-14 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl flex items-center justify-center text-2xl text-white shadow-xl shadow-primary/20">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-0.5 uppercase tracking-tighter">Programa Semanal</h3>
                        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Planificación estratégica de salidas de campo</p>
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
                        <div class="w-px h-10 bg-slate-200 dark:bg-white/10 mx-1"></div>
                        <button id="btn-copy-prev" class="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-indigo-500 rounded-xl transition-all" title="Copiar Semana Anterior">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button id="btn-clear-week" class="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-red-500 rounded-xl transition-all" title="Limpiar Semana">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <button id="export-excel-prog" class="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-emerald-500 rounded-xl transition-all" title="Exportar Excel">
                            <i class="fas fa-file-excel"></i>
                        </button>
                         <button id="export-png-prog" class="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-sky-500 rounded-xl transition-all" title="Exportar PNG">
                            <i class="fas fa-file-image"></i>
                        </button>
                        <button id="btn-print-prog" class="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-amber-500 rounded-xl transition-all" title="Vista Previa e Imprimir">
                            <i class="fas fa-print"></i>
                        </button>
                    </div>
                </div>
            </header>

            <div class="relative group min-h-[500px]">
                <div id="prog-loading-overlay" class="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-50 backdrop-blur-sm flex items-center justify-center hidden rounded-[2.5rem]">
                     <div class="flex flex-col items-center gap-4">
                        <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <p class="text-[10px] font-black uppercase text-primary tracking-widest animate-pulse">Sincronizando...</p>
                     </div>
                </div>
                
                <div class="modern-card !p-0 overflow-x-auto custom-scrollbar border border-slate-200 dark:border-white/5 shadow-inner" id="admin-prog-table">
                    <!-- Table will be injected here -->
                </div>

                <div class="flex flex-col sm:flex-row justify-between items-center px-8 mt-6 gap-4">
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                        <i class="fas fa-cloud-upload-alt text-emerald-500"></i> Autoguardado inteligente activado
                    </p>
                    <div class="flex items-center gap-6 text-[9px] font-black uppercase tracking-widest opacity-60">
                        <span id="save-status" class="text-emerald-500 transition-opacity opacity-0 mr-4 font-bold flex items-center gap-2"></span>
                        <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/40"></span> Mañana</span>
                        <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-lg shadow-orange-500/40"></span> Tarde</span>
                        <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/40"></span> Noche</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    const tableContainer = document.getElementById('admin-prog-table');

    const loadWeekData = async () => {
        const overlay = container.querySelector('#prog-loading-overlay');
        if (overlay) overlay.classList.remove('hidden');

        try {
            window._currentWeekStartGlobal = currentWeekStart;
            const weekId = formatDateId(currentWeekStart);
            const data = await getProgramaSemanal(weekId);

            if (data && data.dias && data.dias.length > 0) {
                programa = data;
                programa.dias.forEach((dia, idx) => {
                    const dayDate = new Date(currentWeekStart);
                    dayDate.setDate(dayDate.getDate() + idx);
                    dia.fecha = formatDateId(dayDate);
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
            _globalPrograma = programa;

            const lblRange = container.querySelector('#week-range-label');
            if (lblRange) {
                const monday = currentWeekStart;
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                const rangeText = `${monday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — ${sunday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`.toUpperCase();
                lblRange.innerText = rangeText;
            }

            renderTable();
        } catch (error) {
            console.error(error);
            showNotification("Error cargando programa", "error");
        } finally {
            if (overlay) overlay.classList.add('hidden');
        }
    };

    const renderTable = () => {
        const turnos = [
            { id: 'manana', icon: 'fa-sun', label: 'Mañana', color: 'text-amber-500', bg: 'bg-amber-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'] },
            { id: 'tarde', icon: 'fa-cloud-sun', label: 'Tarde', color: 'text-orange-500', bg: 'bg-orange-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'] },
            { id: 'noche', icon: 'fa-moon', label: 'Noche', color: 'text-indigo-500', bg: 'bg-indigo-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'] },
            { id: 'zoom', icon: 'fa-video', label: 'Zoom', color: 'text-emerald-500', bg: 'bg-emerald-500/10', fields: ['Lugar', 'Hora', 'Conductor', 'Faceta'] }
        ];

        let html = `<div class="space-y-12 pb-20">`;

        programa.dias.forEach((dia, dayIndex) => {
            html += `
                <div class="day-group animate-fade-in px-8 ${dayIndex > 0 ? 'mt-32' : 'mt-10'}">
                    <div class="flex items-center gap-8 mb-12">
                        <div class="flex flex-col">
                            <h4 class="text-6xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">${dia.nombre}</h4>
                            <p class="text-[12px] font-black text-primary uppercase tracking-[0.6em] mt-4 opacity-70">Programación de Salidas</p>
                        </div>
                        <div class="h-1 flex-1 bg-gradient-to-r from-primary/40 via-primary/10 to-transparent rounded-full"></div>
                    </div>

                    <div class="flex flex-wrap gap-10">
            `;

            turnos.forEach(t => {
                const turnoId = t.id;
                if (turnoId === 'zoom' && dia.nombre !== 'Martes') return;

                if (!dia[turnoId]) dia[turnoId] = {};
                const data = dia[turnoId];

                html += `
                    <div class="flex-1 min-w-[300px] max-w-[400px] modern-card !p-8 border-slate-100 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all group/turn relative">
                        ${(() => {
                        if (!data.territorio || !data.conductor) return '';
                        const tNum = data.territorio.split(/[,/]/)[0].trim();
                        const terr = (_globalTerritorios || []).find(x => x.numero == tNum);
                        if (!terr) return '';
                        const isSynced = terr.asignado_a === data.conductor;
                        return `
                                <div class="absolute top-6 right-6 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800 ${isSynced ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'} animate-bounce-subtle" title="${isSynced ? 'Sincronizado' : 'Desajuste de Asignación'}">
                                    <i class="fas ${isSynced ? 'fa-check' : 'fa-exclamation-triangle'} text-[10px]"></i>
                                </div>`;
                    })()}

                        <div class="flex items-center gap-4 mb-8">
                            <div class="w-12 h-12 ${t.bg} ${t.color} rounded-2xl flex items-center justify-center text-lg shadow-inner group-hover/turn:scale-110 transition-transform duration-500">
                                <i class="fas ${t.icon}"></i>
                            </div>
                            <div>
                                <span class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block mb-0.5">${t.label}</span>
                            </div>
                        </div>

                        <div class="space-y-5">
                `;

                t.fields.forEach(field => {
                    const isWeekend = dia.nombre === 'Sábado' || dia.nombre === 'Domingo';
                    if (field === 'Grupos' && !isWeekend) return;

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
                                    data-current="${val.replace(/"/g, '&quot;')}"
                                    class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5 rounded-2xl hover:border-primary transition-all flex items-center justify-between group/btn shadow-sm">
                                <span class="text-[11px] font-black truncate ${val ? 'text-primary' : 'text-slate-400 opacity-40'}">${val || '—'}</span>
                                <i class="fas fa-chevron-down text-[9px] opacity-10 group-hover/btn:opacity-50"></i>
                            </button>`;
                    } else if (field === 'Grupos') {
                        html += `
                            <label class="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                                <i class="fas fa-users opacity-30"></i> ${field}
                            </label>
                            <button onclick="window.openGroupSelector(${dayIndex}, '${turnoId}', this)" 
                                    data-current="${val.replace(/"/g, '&quot;')}"
                                    class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5 rounded-2xl hover:border-indigo-500 transition-all flex items-center justify-between group/btn shadow-sm">
                                <span class="text-[11px] font-black truncate ${val ? 'text-indigo-500' : 'text-slate-400 opacity-40'}">${val || '—'}</span>
                                <i class="fas fa-chevron-down text-[9px] opacity-10 group-hover/btn:opacity-50"></i>
                            </button>`;
                    } else if (opts.length > 0) {
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

    container.querySelector('#prev-week').onclick = () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        loadWeekData();
    };

    container.querySelector('#next-week').onclick = () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        loadWeekData();
    };

    const btnReset = container.querySelector('#btn-reset-today');
    if (btnReset) {
        btnReset.onclick = () => {
            currentWeekStart = getMonday(new Date());
            loadWeekData();
        };
    }

    container.querySelector('#btn-copy-prev').onclick = async () => {
        showCustomConfirm("¿Copiar toda la programación de la semana pasada a esta?", async () => {
            const prevDate = new Date(currentWeekStart);
            prevDate.setDate(prevDate.getDate() - 7);
            const prevId = formatDateId(prevDate);
            try {
                const prevData = await getProgramaSemanal(prevId);
                if (prevData && prevData.dias) {
                    programa.dias = JSON.parse(JSON.stringify(prevData.dias));
                    _globalPrograma = programa;
                    renderTable();
                    await saveProgramaSemanal(programa.id, programa);
                    showNotification("Programación copiada exitosamente", "success");
                } else {
                    showNotification("No hay datos en la semana anterior", "warning");
                }
            } catch (e) {
                console.error(e);
                showNotification("Error copiando semana", "error");
            }
        });
    };

    container.querySelector('#btn-clear-week').onclick = () => {
        showCustomConfirm("¿Borrar toda la programación de esta semana?", async () => {
            try {
                await deleteProgramaSemanal(programa.id);
                programa.dias = dayNames.map(name => ({
                    nombre: name,
                    manana: {}, tarde: {}, noche: {}, zoom: {}
                }));
                _globalPrograma = programa;
                renderTable();
                showNotification("Semana limpiada exitosamente", "success");
            } catch (e) {
                showNotification("Error limpiando semana", "error");
            }
        });
    };

    const getExportableData = () => {
        const rows = [];
        const turnosMap = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche', zoom: 'Zoom' };
        programa.dias.forEach(dia => {
            ['manana', 'tarde', 'noche', 'zoom'].forEach(turnoId => {
                const data = dia[turnoId];
                // ONLY COMPLETE RECORDS (Both Conductor and Territory)
                if (data && data.conductor && data.territorio) {
                    rows.push({
                        "Día": dia.nombre,
                        "Fecha": dia.fecha || '',
                        "Turno": turnosMap[turnoId],
                        "Territorio": data.territorio || '',
                        "Conductor": data.conductor || '',
                        "Auxiliar": data.auxiliar || '',
                        "Lugar": data.lugar || '',
                        "Hora": data.hora || '',
                        "Faceta": data.faceta || '',
                        "Grupos": data.grupos || ''
                    });
                }
            });
        });
        return rows;
    };

    container.querySelector('#export-excel-prog').onclick = () => {
        const data = getExportableData();
        if (data.length === 0) return showNotification("No hay registros completos para exportar", "warning");
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Programa");
        XLSX.writeFile(wb, `Programa_${programa.id}.xlsx`);
        showNotification("Excel generado correctamente", "success");
    };

    const generatePreviewHTML = () => {
        const data = getExportableData();
        if (data.length === 0) return '<div class="p-20 text-center opacity-30 font-black uppercase tracking-widest">No hay registros completos para imprimir</div>';

        const days = {};
        data.forEach(row => {
            if (!days[row.Día]) days[row.Día] = [];
            days[row.Día].push(row);
        });

        return `
            <div id="print-preview-content" class="bg-white p-10 text-slate-900 font-['Outfit'] space-y-8" style="max-width: 1000px; margin: auto;">
                <header class="flex justify-between items-end border-b-4 border-slate-900 pb-5">
                    <div>
                        <h1 class="text-3xl font-black uppercase tracking-tighter">Programa de Salidas</h1>
                        <p class="text-[9px] font-black uppercase tracking-[0.4em] opacity-50 mt-1">SEMANA: ${programa.id}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Congregación Local</p>
                    </div>
                </header>

                <div class="space-y-6">
                    ${Object.keys(days).map(dayName => `
                        <div class="page-break-inside-avoid">
                            <h2 class="text-xl font-black border-l-4 border-primary pl-3 uppercase tracking-tight mb-4">${dayName}</h2>
                            <div class="grid grid-cols-2 gap-4">
                                ${days[dayName].map(slot => `
                                    <div class="border border-slate-200 p-4 rounded-xl space-y-2 bg-slate-50/30">
                                        <div class="flex justify-between items-center mb-1">
                                            <span class="text-[8px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-widest">${slot.Turno}</span>
                                            <span class="text-[9px] font-bold text-primary">${slot.Hora}</span>
                                        </div>
                                        <div class="space-y-0.5">
                                            <p class="text-[7px] font-black uppercase text-slate-400 tracking-widest">Conductor</p>
                                            <p class="text-[12px] font-black uppercase text-slate-800">${slot.Conductor}</p>
                                        </div>
                                        <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                                            <div class="space-y-0.5">
                                                <p class="text-[7px] font-black uppercase text-slate-400 tracking-widest">Territorio</p>
                                                <p class="text-[10px] font-bold">#${slot.Territorio}</p>
                                            </div>
                                            <div class="space-y-0.5">
                                                <p class="text-[7px] font-black uppercase text-slate-400 tracking-widest">Lugar</p>
                                                <p class="text-[10px] font-bold truncate">${slot.Lugar}</p>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <footer class="pt-8 border-t border-slate-100 text-center">
                    <p class="text-[7px] font-bold uppercase tracking-[0.3em] opacity-30 italic">Documento generado automáticamente • ${new Date().toLocaleDateString()}</p>
                </footer>
            </div>
            <style>
                .page-break-inside-avoid { page-break-inside: avoid; }
                @media print {
                    #print-preview-content { padding: 0 !important; width: 100% !important; max-width: none !important; }
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        `;
    };

    container.querySelector('#export-png-prog').onclick = async () => {
        const previewHTML = generatePreviewHTML();
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute'; tempDiv.style.left = '-9999px'; tempDiv.style.width = '1000px';
        tempDiv.innerHTML = previewHTML;
        document.body.appendChild(tempDiv);
        try {
            showNotification("Preparando imagen...", "info");
            const canvas = await html2canvas(tempDiv.querySelector('#print-preview-content'), { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = `Programa_${programa.id}.png`;
            link.href = canvas.toDataURL('image/png'); link.click();
            showNotification("Imagen exportada con éxito", "success");
        } catch (e) {
            console.error(e); showNotification("Error al generar PNG", "error");
        } finally { document.body.removeChild(tempDiv); }
    };

    container.querySelector('#btn-print-prog').onclick = () => {
        const previewHTML = generatePreviewHTML();
        showModal(`
            <div class="flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] overflow-hidden">
                <header class="p-8 bg-white dark:bg-slate-800 border-b flex justify-between items-center shrink-0">
                    <div>
                        <h3 class="text-xl font-black uppercase tracking-tight">Vista Previa Mejorada</h3>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Se imprimirán solo registros con Conductor + Territorio</p>
                    </div>
                    <button id="btn-do-print" class="bg-primary text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">
                        <i class="fas fa-print mr-2"></i> Imprimir a una página
                    </button>
                </header>
                <div class="flex-1 overflow-y-auto p-10 bg-black/5 dark:bg-black/50">
                    <div id="print-area-wrapper" class="max-w-[800px] mx-auto shadow-3xl bg-white">
                        ${previewHTML}
                    </div>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-do-print').onclick = () => {
                const printContents = modal.querySelector('#print-preview-content').outerHTML;
                const printFrame = document.createElement('iframe');
                Object.assign(printFrame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
                document.body.appendChild(printFrame);
                const frameDoc = printFrame.contentWindow.document;
                frameDoc.write(`
                    <html>
                        <head>
                            <title>Programa Semanal</title>
                            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
                            <script src="https://cdn.tailwindcss.com"></script>
                            <style>
                                @page { size: portrait; margin: 10mm; }
                                body { font-family: 'Outfit', sans-serif; }
                                .page-break-inside-avoid { page-break-inside: avoid; }
                            </style>
                        </head>
                        <body>${printContents}</body>
                    </html>
                `);
                frameDoc.close();
                setTimeout(() => {
                    printFrame.contentWindow.focus();
                    printFrame.contentWindow.print();
                    setTimeout(() => document.body.removeChild(printFrame), 1000);
                }, 800);
            };
        }, 'max-w-4xl');
    };

    window.openTerritorySelector = (dayIndex, turnId, btnElement) => {
        if (!btnElement || !_globalPrograma) return;
        const currentVal = btnElement.dataset.current;
        showTerritorySelectionModal(currentVal, _globalTerritorios, (newValue) => {
            if (!_globalPrograma.dias[dayIndex][turnId]) _globalPrograma.dias[dayIndex][turnId] = {};
            _globalPrograma.dias[dayIndex][turnId].territorio = newValue;
            btnElement.dataset.current = newValue;
            const span = btnElement.querySelector('span.truncate');
            if (span) {
                span.textContent = newValue || '—';
                span.className = `text-[11px] font-black truncate ${newValue ? 'text-primary' : 'text-slate-400 opacity-40'}`;
            }
            window.updateWeekData(dayIndex, turnId, 'territorio', newValue);
        });
    };

    window.openGroupSelector = (dayIndex, turnId, btnElement) => {
        if (!btnElement || !_globalPrograma) return;
        const currentVal = btnElement.dataset.current;
        showGroupSelectionModal(currentVal, (newValue) => {
            if (!_globalPrograma.dias[dayIndex][turnId]) _globalPrograma.dias[dayIndex][turnId] = {};
            _globalPrograma.dias[dayIndex][turnId].grupos = newValue;
            btnElement.dataset.current = newValue;
            const span = btnElement.querySelector('span.truncate');
            if (span) {
                span.textContent = newValue || '—';
                span.className = `text-[11px] font-black truncate ${newValue ? 'text-indigo-500' : 'text-slate-400 opacity-40'}`;
            }
            window.updateWeekData(dayIndex, turnId, 'grupos', newValue);
        });
    };

    window.updateWeekData = (dayIndex, turnoId, field, value) => {
        if (!_globalPrograma) return;
        if (!_globalPrograma.dias[dayIndex][turnoId]) _globalPrograma.dias[dayIndex][turnoId] = {};
        _globalPrograma.dias[dayIndex][turnoId][field] = value;
        const statusIndicator = document.getElementById('save-status');
        if (statusIndicator) {
            statusIndicator.style.opacity = '1';
            statusIndicator.innerHTML = '<span class="animate-pulse">●</span> Guardando...';
        }
        clearTimeout(window._saveTimer);
        window._saveTimer = setTimeout(async () => {
            try {
                const weekId = _globalPrograma.id;
                await saveProgramaSemanal(weekId, _globalPrograma);
                const tData = _globalPrograma.dias[dayIndex][turnoId];
                if (['conductor', 'territorio', 'auxiliar', 'lugar', 'hora', 'faceta', 'grupos'].includes(field)) {
                    const diaObj = _globalPrograma.dias[dayIndex];
                    const dateISO = new Date(diaObj.fecha + 'T12:00:00Z').toISOString();
                    await syncSlotWithTerritories(weekId, dayIndex, turnoId, tData, dateISO);
                }
                if (statusIndicator) {
                    statusIndicator.innerHTML = '✅ Guardado';
                    setTimeout(() => { if (statusIndicator.innerHTML === '✅ Guardado') statusIndicator.style.opacity = '0'; }, 2000);
                }
            } catch (e) {
                console.error("Auto-save error:", e);
                if (statusIndicator) statusIndicator.innerHTML = '❌ Error';
            }
        }, 1000);
    };

    loadWeekData();
};

export const renderS12View = async (container, config, appVersion) => {
    const territorios = await getTerritorios();

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
                     <input type="text" id="search-s12" placeholder="Filtrar por número..." class="w-full pl-12 pr-5 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all">
                 </div>
            </div>

            <div id="s12-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                <!-- Grid dinámico -->
            </div>
        </div>
    `;

    const renderGrid = (query = '') => {
        const grid = document.getElementById('s12-grid');
        if (!grid) return;
        const stats = document.getElementById('s12-stats');

        const filtered = territorios
            .filter(t => t.numero.toString().includes(query))
            .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));

        if (stats) stats.innerHTML = `<span class="opacity-60">${filtered.length} territorios encontrados</span>`;

        grid.innerHTML = filtered.map(t => `
            <div class="bg-white dark:bg-[#151515] rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/5 relative group shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col h-full">
                <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                
                <!-- Mini Actions Overlay -->
                <div class="absolute top-4 right-4 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:translate-x-4 lg:group-hover:translate-x-0 transition-all z-10">
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

    document.getElementById('btn-export-s12-single').onclick = () => window.exportS12Form(territorios, 1);
    document.getElementById('btn-export-s12-half').onclick = () => window.exportS12Form(territorios, 2);
    document.getElementById('btn-export-s12-quad').onclick = () => window.exportS12Form(territorios, 4);

    document.getElementById('btn-add-territorio').onclick = () => {
        showModal(`
            <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400"> Nuevo Territorio</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Número</label>
                    <input type="text" id="new-t-num" placeholder="Ej: 101" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Localidad (Recomendado)</label>
                    <input type="text" id="new-t-localidad" placeholder="Ej: Urbanización ..." class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">Manzanas / Sectores</label>
                    <input type="text" id="new-t-manzanas" placeholder="Ej: Mz. 1, Mz. 2" class="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white shadow-sm focus:border-teal-500 outline-none">
                </div>
                
                <div>
                    <label class="block text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">Imagen del Mapa</label>
                    <div class="flex items-center gap-4">
                        <label class="cursor-pointer bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                            <span>📂 Subir Imagen</span>
                            <input type="file" id="new-t-file" accept="image/png, image/jpeg, image/webp" class="hidden">
                        </label>
                        <span id="file-name-new" class="text-xs text-gray-500 italic truncate max-w-[150px]">Sin archivo</span>
                    </div>
                    <input type="hidden" id="new-t-base64">
                    <div id="preview-new-container" class="mt-2 hidden">
                        <img id="preview-new" class="h-32 w-auto max-w-full rounded border border-gray-200 dark:border-white/20 object-contain mx-auto bg-white dark:bg-black">
                    </div>
                </div>
            </div>
            <button id="save-new-territorio" class="w-full bg-teal-600 py-3 rounded-lg text-white font-bold mt-6 shadow-lg shadow-teal-500/20 hover:scale-[1.02] transition-all">
                Guardar Territorio
            </button>
        `, async (modal) => {
            const fileInput = document.getElementById('new-t-file');
            const nameDisplay = document.getElementById('file-name-new');
            const previewContainer = document.getElementById('preview-new-container');
            const previewImg = document.getElementById('preview-new');
            const base64Input = document.getElementById('new-t-base64');

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 800 * 1024) {
                        showNotification("La imagen es muy grande. Máx 800KB.", "warning");
                        fileInput.value = '';
                        return;
                    }
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

            document.getElementById('save-new-territorio').onclick = async () => {
                const num = document.getElementById('new-t-num').value;
                const img = base64Input.value;
                if (!num) return showNotification("El número es obligatorio", "error");

                const btn = document.getElementById('save-new-territorio');
                btn.textContent = "Guardando..."; btn.disabled = true;

                try {
                    await addTerritorio({
                        numero: num,
                        localidad: document.getElementById('new-t-localidad').value.trim(),
                        manzanas: document.getElementById('new-t-manzanas').value,
                        imagen: img
                    });
                    modal.remove();
                    renderS12View(container, config, appVersion);
                    showNotification("Territorio creado exitosamente");
                } catch (err) {
                    console.error(err);
                    showNotification("Error al guardar", "error");
                    btn.textContent = "Guardar Territorio"; btn.disabled = false;
                }
            };
        });
    };

    window.deleteTerritorio = async (id) => {
        showCustomConfirm('¿Eliminar este territorio?', async () => {
            await deleteTerritorio(id);
            renderS12View(container, config, appVersion);
        });
    };

    window.editTerritorio = async (id) => {
        const t = territorios.find(x => x.id === id);
        if (!t) return;

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center justify-between">
                        <div class="flex items-center gap-6">
                            <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                                <i class="fas fa-map-marked-alt"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Editar Territorio</h3>
                                <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Identificador #${t.numero}</p>
                            </div>
                        </div>
                        <button onclick="this.closest('#modal-container').classList.add('hidden')" class="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </header>
                <div class="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Número de Territorio</label>
                            <input type="text" id="edit-t-num" value="${t.numero}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Localidad</label>
                            <input type="text" id="edit-t-localidad" value="${t.localidad || ''}" placeholder="Ej: Urbanización ..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Sectores</label>
                            <input type="text" id="edit-t-manzanas" value="${t.manzanas || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Mapa</label>
                            <div class="bg-white dark:bg-white/5 p-6 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                                <div class="flex items-center gap-6">
                                    <label class="cursor-pointer bg-primary hover:bg-primary-light text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 flex items-center gap-3">
                                        <i class="fas fa-camera"></i> <span>Actualizar</span>
                                        <input type="file" id="edit-t-file" accept="image/*" class="hidden">
                                    </label>
                                    <span id="file-name-edit" class="text-[10px] text-slate-500 font-black uppercase truncate">Mantener actual</span>
                                </div>
                                <input type="hidden" id="edit-t-base64" value="${t.imagen || ''}">
                                <div id="preview-edit-container" class="mt-6 ${t.imagen ? '' : 'hidden'}">
                                     <img id="preview-edit" src="${t.imagen || ''}" class="w-full h-auto max-h-48 object-contain rounded-2xl border border-slate-100 dark:border-white/10">
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
            const previewImg = modal.querySelector('#edit-t-preview');
            const base64Input = modal.querySelector('#edit-t-base64');
            const updateBtn = modal.querySelector('#update-territorio');

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 800 * 1024) return showNotification("Máx 800KB", "warning");
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
                updateBtn.innerHTML = 'Actualizando...';
                try {
                    await updateTerritorio(id, {
                        numero: modal.querySelector('#edit-t-num').value.trim(),
                        localidad: modal.querySelector('#edit-t-localidad').value.trim(),
                        manzanas: modal.querySelector('#edit-t-manzanas').value.trim(),
                        imagen: base64Input.value
                    });
                    modal.remove();
                    renderS12View(container, config, appVersion);
                    showNotification("Actualizado correctamente", "success");
                } catch (err) {
                    showNotification("Error", "error");
                    updateBtn.disabled = false; updateBtn.innerText = "Confirmar Cambios";
                }
            };
        });
    };
};



window.exportS12Form = async (territorios, layout = 1) => {
    showNotification("Generando PDF...", "info");
    const config = await getConfiguracion();
    const sorted = [...territorios].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));
    const printWindow = window.open('', '_blank');
    const styles = `
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&family=Inter:wght@400;700&display=swap');
    @page { size: A4 ${layout === 4 ? 'landscape' : 'portrait'}; margin: 0; }
    body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: #f8fafc; }
    .page { width: ${layout === 4 ? '297mm' : '210mm'}; height: ${layout === 4 ? '210mm' : '297mm'}; padding: 5mm; margin: 0 auto; background: white; box-sizing: border-box; page-break-after: always; display: flex; flex-wrap: wrap; align-content: flex-start; justify-content: center; gap: 5mm; }
    .s12-card { width: 148mm; height: 104mm; border: 0.5pt solid #000; padding: 8mm; display: flex; flex-direction: column; position: relative; box-sizing: border-box; background: white; overflow: hidden; }
    .title { text-align: center; font-size: 16pt; font-weight: 800; margin-bottom: 8pt; font-family: 'Outfit', sans-serif; }
    .header-info { display: flex; align-items: flex-end; gap: 4pt; margin-bottom: 8pt; }
    .label { font-size: 11pt; font-weight: 700; white-space: nowrap; }
    .field-val { font-size: 11pt; border-bottom: 0.5pt solid #000; flex: 1; min-height: 1.2em; padding-bottom: 1pt; }
    .territory-num-box { border: 1pt solid #000; padding: 2pt 8pt; font-size: 14pt; font-weight: 800; min-width: 40pt; text-align: center; }
    .map-container { flex: 1; border: 0.5pt solid #000; margin: 4pt 0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff; position: relative; }
    .map-container img { width: 100%; height: 100%; object-fit: contain; }
    .footer-note { font-size: 8.5pt; text-align: justify; line-height: 1.2; margin-top: 6pt; }
    .footer-id { font-size: 8pt; margin-top: 4pt; display: flex; justify-content: space-between; }
    @media print { body { background: white; } .no-print { display: none!important; } .page { padding: 0; margin: 0; } }
    </style>`;

    const renderCard = (t) => `
    <div class="s12-card">
        <div class="title">Tarjeta del mapa del territorio</div>
        <div class="header-info">
            <span class="label">Localidad</span>
            <span class="field-val">${t.localidad || ''}</span>
            <span class="label" style="margin-left: 8pt;">Terr. núm.</span>
            <div class="territory-num-box">${t.numero}</div>
        </div>
        <div class="map-container">
            ${t.imagen ? `<img src="${formatMapUrl(t.imagen)}" onerror="this.parentElement.innerHTML='(Error mapa)'">` : '(No hay mapa)'}
        </div>
        <div class="footer-note">Sírvase mantener esta tarjeta en el sobre. No la manche, marque, ni doble...</div>
        <div class="footer-id"><span>S-12-S &nbsp;&nbsp; 6/72</span></div>
    </div>`;

    let html = `<html><head><title>S-12</title>${styles}</head><body>`;
    if (layout === 1) sorted.forEach(t => html += `<div class="page" style="align-items: center;">${renderCard(t)}</div>`);
    else if (layout === 2) {
        for (let i = 0; i < sorted.length; i += 2) {
            html += `<div class="page" style="flex-direction: column; justify-content: center;">${renderCard(sorted[i])}`;
            if (sorted[i + 1]) html += renderCard(sorted[i + 1]);
            html += `</div>`;
        }
    } else if (layout === 4) {
        for (let i = 0; i < sorted.length; i += 4) {
            html += `<div class="page">`;
            for (let j = 0; j < 4; j++) if (sorted[i + j]) html += renderCard(sorted[i + j]);
            html += `</div>`;
        }
    }
    html += `<div class="no-print" style="position:fixed; top:20px; right:20px; background:#111; color:white; padding:20px; border-radius:12px; z-index:9999;">
        <button onclick="window.print()" style="background:#14b8a6; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:800;">IMPRIMIR</button>
    </div></body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
};
