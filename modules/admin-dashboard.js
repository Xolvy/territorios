import {
    getConfiguracion, saveConfiguracion, getSystemVersion, setSystemVersion,
    getTerritorios, addTerritorio, deleteTerritorio, updateTerritorio, assignTerritorioParcial, assignTerritorio, returnTerritorio, returnTerritorioMultiple, transferTerritory, getTerritoryHistory, getHistorialReport, addHistoryRecord, updateHistoryRecord, deleteHistoryRecord, cancelarAsignacion, updateAssignmentData,
    getConductores, addConductor, deleteConductor, updateConductor,
    getPublicadores, addPublicador, deletePublicador, updatePublicador,
    getTelefonos, addTelefono, deleteTelefono, updateTelefono,
    getPredicacionPublica, savePredicacionPublica,
    getProgramaSemanal, saveProgramaSemanal, rebuildHistoryFromSchedule, runSystemDiagnosticsAndRepair, deleteProgramaSemanal,
    getRecursos, addRecurso, deleteRecurso, updateRecurso, restoreSystemBackup,
    getCampanas, saveCampana, deleteCampana,
    getGroupsConfig, saveGroupsConfig,
    getDiffusionMessage, saveDiffusionMessage
} from '../data/firestore-services.js?v=3.7.1.1';
import { formatPhoneNumber, getStatusColor, showNotification, formatMapUrl, ensureOnline, generatePlainXLS } from './utils/helpers.js?v=3.7.1.1';
import { TerritoryIntelligence } from './utils/intelligence.js?v=3.7.1.1';
import { renderHistoryTab } from './report-s13.js?v=3.7.1.1';
import { renderAnalyticsView } from './analytics-view.js?v=3.7.1.1';
import { getGlobalSettings, saveGlobalSettings } from '../data/firestore-services.js?v=3.7.1.1';
import { auth } from '../firebase-config.js?v=3.7.1.1';
import { animateEntry } from './utils/animations.js?v=3.7.1.1';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '';




// --- Global UI Helpers ---
const showCustomAlert = (message) => {
    if (!message) return;
    const type = message.toLowerCase().includes('error') ? 'error' : 'success';
    showNotification(message, type);
};
window.showCustomAlert = showCustomAlert;

const showCustomConfirm = (message, onConfirm) => {
    showModal(`
        <div class="p-8 text-center space-y-6 flex flex-col items-center">
            <div class="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 text-2xl">
                <i class="fas fa-question-circle"></i>
            </div>
            <div>
                <h3 class="text-h3 text-slate-900 dark:text-white">${message}</h3>
                <p class="text-[10px] text-slate-600 dark:text-slate-400 mt-2 font-black uppercase tracking-widest">Confirmación de Administrador</p>
            </div>
            <div class="flex gap-3 w-full mt-4">
                <button id="confirm-cancel" class="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 font-bold hover:bg-slate-200 transition-all text-xs uppercase">Cancelar</button>
                <button id="confirm-ok" class="flex-[1.5] py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary-light shadow-lg shadow-primary/20 transition-all text-xs uppercase">Confirmar</button>
            </div>
        </div>
    `, (modal) => {
        modal.querySelector('#confirm-cancel').onclick = () => modal.classList.add('hidden');
        modal.querySelector('#confirm-ok').onclick = () => {
            modal.classList.add('hidden');
            onConfirm();
        };
    }, 'max-w-sm');
};
window.showCustomConfirm = showCustomConfirm;

const showCustomPrompt = (message, defaultValue, onConfirm) => {
    showModal(`
        <div class="p-8 space-y-6">
            <div class="text-center">
                <h3 class="text-h3 text-slate-900 dark:text-white">${message}</h3>
                <p class="text-[10px] text-primary font-bold uppercase tracking-widest mt-1 italic">Entrada de Sistema</p>
            </div>
            <div class="relative">
                <input type="text" id="prompt-input" value="${defaultValue || ''}" 
                    class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:border-primary/50 rounded-2xl p-4 text-slate-900 dark:text-white outline-none font-bold text-center text-base transition-all">
            </div>
            <div class="flex gap-3 mt-4">
                <button id="prompt-cancel" class="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 font-bold hover:bg-slate-200 transition-all text-xs uppercase">Omitir</button>
                <button id="prompt-ok" class="flex-[1.5] py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary-light shadow-lg shadow-primary/20 transition-all text-xs uppercase">Guardar</button>
            </div>
        </div>
    `, (modal) => {
        const input = modal.querySelector('#prompt-input');
        input.focus();
        input.select();

        const handleConfirm = () => {
            const val = input.value.trim();
            if (val) {
                modal.classList.add('hidden');
                onConfirm(val);
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') modal.classList.add('hidden');
        };

        modal.querySelector('#prompt-cancel').onclick = () => modal.classList.add('hidden');
        modal.querySelector('#prompt-ok').onclick = handleConfirm;
    }, 'max-w-sm');
};
window.showCustomPrompt = showCustomPrompt;

// Add scrollbar-hide style
const style = document.createElement('style');
style.textContent = `
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }

    /* 2026 Admin Navigation */
    .nav-item {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.9rem 1.25rem;
        border-radius: var(--radius-md);
        color: hsl(var(--text-muted));
        font-size: 0.875rem;
        font-weight: 700;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background: transparent;
        white-space: nowrap;
        border: 1px solid transparent;
        position: relative;
    }
    
    .nav-item:hover {
        background: hsla(var(--primary) / 0.05);
        color: hsl(var(--primary));
        transform: translateX(4px);
    }

    .nav-item.active {
        background: hsla(var(--primary) / 0.1);
        color: hsl(var(--primary));
        border-color: hsla(var(--primary) / 0.1);
    }
    
    .nav-item.active::before {
        content: '';
        position: absolute;
        left: -4px;
        top: 20%;
        bottom: 20%;
        width: 4px;
        background: hsl(var(--primary));
        border-radius: 0 4px 4px 0;
    }

    .nav-icon {
        font-size: 1.15rem;
        width: 24px;
        text-align: center;
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.3, 1.275);
    }
    .nav-item:hover .nav-icon { transform: scale(1.2) rotate(-5deg); }
    
    .nav-label { 
        font-family: 'Outfit', sans-serif;
        letter-spacing: -0.01em;
    }

    /* Layout Utilities */
    .admin-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2rem;
    }
    @media (min-width: 1024px) {
        .admin-grid {
            grid-template-columns: 240px 1fr;
            align-items: start;
        }
    }
    
    .sticky-nav {
        position: sticky;
        top: 2rem;
        z-index: 40;
    }

    @media (max-width: 1023px) {
        .sticky-nav {
            position: fixed;
            bottom: 0px;
            left: 0;
            right: 0;
            top: auto;
            z-index: 1000;
        }
        
        .sticky-nav nav {
            background: rgba(15, 23, 42, 0.9) !important;
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
            padding: 0.5rem 0.25rem calc(0.5rem + env(safe-area-inset-bottom)) !important;
            border-radius: 2rem 2rem 0 0;
            border-top: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 -10px 40px rgba(0,0,0,0.3);
            justify-content: space-around;
            width: 100%;
        }

        .nav-item {
            flex-direction: column;
            gap: 2px;
            padding: 8px 4px;
            flex: 1;
            align-items: center;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }

        .nav-item:hover {
            transform: translateY(-2px);
        }

        .nav-icon {
            font-size: 1.1rem;
            width: auto;
        }

        .nav-label {
            font-size: 8px !important;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.02em;
            display: block !important;
            opacity: 0.6;
        }
        
        .nav-item.active .nav-label {
            opacity: 1;
            color: #ffffff;
        }
        
        .nav-item.active .nav-icon {
            color: #3b82f6;
            transform: translateY(-2px);
        }

        .nav-item.active::before {
            left: 50%;
            top: -2px;
            bottom: auto;
            width: 16px;
            height: 3px;
            transform: translateX(-50%);
            border-radius: 0 0 4px 4px;
            background: #ffffff;
        }

        .admin-content-wrapper {
            padding-bottom: 6rem;
        }
    }
    
    /* Global High Contrast active state for all sub-navigation buttons */
    .conf-nav-btn.active, .sub-tab-casa.active, .cc-view-btn.active {
        background: #0f172a !important; /* Slate 900 */
        color: #ffffff !important;
        box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.4) !important;
        transform: scale(1.05);
        z-index: 10;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    /* Fixed visibility for important confirm buttons in light mode */
    #modal-terr-confirm, #confirm-bulk-return, #confirm-asig, #confirm-ok, #prompt-ok, #save-rec-btn, #btn-force-update, #btn-run-diagnostics {
        background: #0f172a !important;
        color: #ffffff !important;
        border: none !important;
    }
    
    /* Ensure secondary buttons are visible */
    #prompt-cancel, #confirm-cancel, #btn-cancel-rec {
        background: #f1f5f9 !important;
        color: #475569 !important;
        border: 1px solid #e2e8f0 !important;
    }

    .dark #modal-terr-confirm, .dark #confirm-bulk-return, .dark #confirm-asig, .dark #confirm-ok, .dark #prompt-ok, .dark #save-rec-btn, 
    .dark #btn-force-update, .dark #btn-run-diagnostics {
        background: hsl(var(--primary)) !important;
    }
    
    .dark #prompt-cancel, .dark #confirm-cancel, .dark #btn-cancel-rec {
        background: rgba(255,255,255,0.05) !important;
        color: #94a3b8 !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
    }
`;
document.head.appendChild(style);

// --- Module Level Globals (Cache/Scope Guard) ---
let _globalTerritorios = [];
let _globalPrograma = null;

// Global Date Helpers
const getMonday = (d) => {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

const formatDateId = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDisplayDateRange = (date) => {
    try {
        const start = new Date(date);
        if (isNaN(start.getTime())) return '';
        const end = new Date(date);
        end.setDate(start.getDate() + 6);
        // Use premium Date-fns if available, fallback to basic logic
        if (window.dateFns) {
            return `${window.dateFns.format(start, 'd MMM')} - ${window.dateFns.format(end, 'd MMM yyyy')}`;
        }
        const f = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
        return `${f(start)} - ${f(end)}, ${start.getFullYear()}`;
    } catch (e) { return date; }
};

// Ensure functions exist immediately upon module load

// --- SELECTION MODALS (Fixes non-functional buttons) ---
// --- SELECTION MODALS (Enhanced for Multiple Selection and Manzanas) ---
const showTerritorySelectionModal = (current, territorios, onSelect, containerId = 'modal-container') => {
    let filtered = [...territorios].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

    // Parse current value: "1, 2(Mz 1, Mz 2), 3"
    const parseCurrent = (str) => {
        const selections = {};
        if (!str) return selections;
        str.split(',').forEach(p => {
            const part = p.trim();
            if (!part) return;
            const match = part.match(/^([^(\s,]+)(?:\s*\((.*)\))?$/);
            if (match) {
                const num = match[1];
                const mzs = match[2] ? match[2].split(',').map(m => m.trim()) : null;
                selections[num] = mzs;
            }
        });
        return selections;
    };

    let selections = parseCurrent(current);

    showModal(`
        <div class="flex flex-col h-[80vh] sm:h-[700px] overflow-hidden">
            <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                <div class="relative z-10 flex justify-between items-center">
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Seleccionar Territorios</h3>
                        <p class="text-[10px] opacity-70 font-bold uppercase tracking-[0.2em]">Gestión Granular de Manzanas</p>
                    </div>
                    <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shadow-2xl border border-white/30">
                        <i class="fas fa-map-marked-alt"></i>
                    </div>
                </div>
            </header>
            
            <div class="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                <div class="relative group">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within:text-primary transition-colors">
                        <i class="fas fa-search"></i>
                    </span>
                    <input type="text" id="modal-terr-search" placeholder="Buscar por número o manzana..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:border-primary rounded-2xl pl-12 pr-4 py-4 text-sm font-bold shadow-sm outline-none transition-all">
                </div>

                <div id="modal-terr-list" class="space-y-3">
                    <!-- Injected via render -->
                </div>
            </div>

            <div class="shrink-0 p-6 bg-white dark:bg-[#0a0f18] border-t border-slate-100 dark:border-white/5 flex flex-col gap-4">
                <div class="bg-primary/5 p-5 rounded-3xl border border-primary/10">
                    <div class="flex items-center justify-between mb-3 px-1">
                        <span class="text-[10px] font-black text-primary uppercase tracking-widest">Resumen de Selección:</span>
                        <button id="modal-terr-clear" class="text-[10px] font-black text-red-500 hover:text-red-600 uppercase tracking-widest transition-colors flex items-center gap-2">
                            <i class="fas fa-undo-alt"></i> Limpiar
                        </button>
                    </div>
                    <div id="modal-selection-preview" class="text-[11px] font-mono text-primary font-bold break-all bg-white dark:bg-white/5 p-4 rounded-xl border border-primary/10 min-h-[48px] shadow-inner">
                        ${current || 'Nada seleccionado'}
                    </div>
                </div>
                
                <button id="modal-terr-confirm" class="w-full bg-primary hover:bg-primary-light text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]">
                    Confirmar Selección
                </button>
            </div>
        </div>
    `, (modal) => {
        const listContainer = modal.querySelector('#modal-terr-list');
        const searchInput = modal.querySelector('#modal-terr-search');
        const preview = modal.querySelector('#modal-selection-preview');
        const confirmBtn = modal.querySelector('#modal-terr-confirm');

        const updatePreview = () => {
            const keys = Object.keys(selections).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            if (keys.length === 0) {
                preview.innerText = 'Nada seleccionado';
                return;
            }

            const result = keys.map(num => {
                const mzs = selections[num];
                if (!mzs) return num;
                return `${num}(${mzs.join(', ')})`;
            }).join(', ');
            preview.innerText = result;
        };

        const render = () => {
            const query = searchInput.value.trim().toLowerCase();
            const items = query ? filtered.filter(t => t.numero.toLowerCase().includes(query) || (t.manzanas && t.manzanas.toLowerCase().includes(query))) : filtered;

            listContainer.innerHTML = items.map(t => {
                const isSelected = t.numero in selections;
                const selectedMzs = selections[t.numero] || [];
                const allMzs = t.manzanas ? t.manzanas.split(',').map(m => m.trim()).filter(Boolean) : [];

                return `
                    <div class="modern-card !p-2 transition-all duration-300 group ${isSelected ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-slate-100 dark:border-white/5 shadow-sm'}">
                        <label class="flex items-center gap-4 p-3 cursor-pointer">
                             <input type="checkbox" class="terr-check w-6 h-6 rounded-lg border-2 border-slate-300 dark:border-white/10 text-primary focus:ring-primary transition-all cursor-pointer" 
                                    data-num="${t.numero}" ${isSelected ? 'checked' : ''}>
                             <div class="flex-1">
                                 <div class="flex items-center justify-between">
                                     <span class="font-black text-slate-800 dark:text-white uppercase tracking-tight">Territorio ${t.numero}</span>
                                     <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-md">${allMzs.length} Manzanas</span>
                                 </div>
                             </div>
                        </label>
                        
                        ${isSelected && allMzs.length > 0 ? `
                            <div class="mt-2 p-4 bg-slate-50 dark:bg-black/40 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4 animate-fade-in">
                                <div class="flex items-center justify-between px-1">
                                    <span class="text-[9px] font-black text-primary uppercase tracking-widest">Manzanas:</span>
                                    <button class="select-all-mzs text-[8px] font-black text-primary hover:text-primary-light uppercase tracking-widest flex items-center gap-1" data-num="${t.numero}">
                                        <i class="fas fa-check-square"></i> Todas
                                    </button>
                                </div>
                                <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    ${allMzs.map(mz => {
                    const isMzSelected = !selections[t.numero] || selections[t.numero].includes(mz);
                    return `
                                            <label class="flex items-center gap-2 p-2 bg-white dark:bg-white/5 rounded-xl cursor-pointer hover:bg-teal-500/5 transition-colors border border-black/[0.03] dark:border-white/[0.03]">
                                                <input type="checkbox" class="mz-check w-4 h-4 rounded-lg border-gray-300 dark:border-white/10 text-teal-600" 
                                                       data-num="${t.numero}" data-mz="${mz}" ${isMzSelected ? 'checked' : ''}>
                                                <span class="text-[10px] font-bold text-gray-600 dark:text-gray-400 truncate">${mz}</span>
                                            </label>
                                        `;
                }).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            // Bind Events
            modal.querySelectorAll('.terr-check').forEach(cb => {
                cb.onchange = (e) => {
                    const num = cb.dataset.num;
                    if (e.target.checked) selections[num] = null;
                    else delete selections[num];
                    render();
                    updatePreview();
                };
            });

            modal.querySelectorAll('.mz-check').forEach(cb => {
                cb.onchange = (e) => {
                    const num = cb.dataset.num;
                    const mz = cb.dataset.mz;
                    const terr = territorios.find(x => x.numero == num);
                    const allMzs = terr.manzanas.split(',').map(m => m.trim());
                    let current = selections[num] || [...allMzs];

                    if (e.target.checked) {
                        if (!current.includes(mz)) current.push(mz);
                    } else {
                        current = current.filter(m => m !== mz);
                    }

                    if (current.length === allMzs.length) selections[num] = null;
                    else if (current.length === 0) delete selections[num];
                    else selections[num] = current.sort();

                    render();
                    updatePreview();
                };
            });

            modal.querySelectorAll('.select-all-mzs').forEach(btn => {
                btn.onclick = () => {
                    selections[btn.dataset.num] = null;
                    render();
                    updatePreview();
                };
            });
        };

        searchInput.oninput = render;

        modal.querySelector('#modal-terr-clear').onclick = () => {
            selections = {};
            render();
            updatePreview();
        };

        confirmBtn.onclick = () => {
            const displayStr = preview.innerText === 'Nada seleccionado' ? '' : preview.innerText;
            onSelect(displayStr, selections);
            // Properly close the CURRENT modal container
            const container = document.getElementById(containerId);
            if (container) {
                container.classList.add('hidden');
                container.innerHTML = '';
                window.removeEventListener('keydown', handleEsc);
            }
        };

        render();
        updatePreview();
    }, 'max-w-2xl', containerId);
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

window.openTerritorySelector = (dayIndex, turnId, btnElement) => {
    if (!btnElement || !_globalPrograma) return;
    const currentVal = btnElement.dataset.current;

    if (typeof showTerritorySelectionModal === 'function') {
        showTerritorySelectionModal(currentVal, _globalTerritorios, (newValue) => {
            if (!_globalPrograma.dias[dayIndex][turnId]) _globalPrograma.dias[dayIndex][turnId] = {};
            _globalPrograma.dias[dayIndex][turnId].territorio = newValue;

            btnElement.dataset.current = newValue;
            const span = btnElement.querySelector('span.truncate');
            if (span) {
                span.textContent = newValue || 'Asignar';
                span.className = `truncate font-mono ${newValue ? 'text-primary' : 'text-slate-400 opacity-50'}`;
            }
            // Trigger auto-save
            window.updateWeekData(dayIndex, turnId, 'territorio', newValue);
        });
    }
};

window.openGroupSelector = (dayIndex, turnId, btnElement) => {
    if (!btnElement || !_globalPrograma) return;
    const currentVal = btnElement.dataset.current;
    if (typeof showGroupSelectionModal === 'function') {
        showGroupSelectionModal(currentVal, (newValue) => {
            if (!_globalPrograma.dias[dayIndex][turnId]) _globalPrograma.dias[dayIndex][turnId] = {};
            _globalPrograma.dias[dayIndex][turnId].grupos = newValue;

            btnElement.dataset.current = newValue;
            const span = btnElement.querySelector('span.truncate');
            if (span) {
                span.textContent = newValue || 'Seleccionar';
                span.className = `truncate ${newValue ? 'text-indigo-500' : 'text-slate-400 opacity-50'}`;
            }
            // Trigger auto-save
            window.updateWeekData(dayIndex, turnId, 'grupos', newValue);
        });
    }
};


// --- Main Render (Admin) ---
export const renderAdminDashboard = async (container, appVersion, initialTab = 'dashboard') => { // Accepted version for auto-sync
    try {
        window.isAdminMode = true; // Flag para herramientas compartidas
        // --- AUTO UPDATE REMOTE VERSION LOGIC ---
        if (appVersion) {
            getSystemVersion().then(async (remoteVer) => {
                if (appVersion !== remoteVer) {
                    console.log(`[Auto-Update] Bumping remote version from ${remoteVer} to ${appVersion}`);
                    await setSystemVersion(appVersion);
                }
            }).catch(e => console.warn("Auto-update check failed", e));
        }

        container.innerHTML = `
            <div class="animate-fade-in pb-32 lg:pb-8 w-full max-w-[1600px] mx-auto p-4 md:p-8">
                <!-- Dashboard Header 2026 -->
                <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 lg:mb-10 p-5 md:p-8 glass-morphism rounded-2xl lg:rounded-[2rem] gap-6">
                    <div class="flex items-center gap-4 md:gap-5">
                        <div class="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary to-secondary rounded-xl md:rounded-2xl flex items-center justify-center text-2xl md:text-3xl shadow-xl shadow-primary/30 border border-primary/20 dark:border-white/10 transition-transform hover:scale-105 duration-500">
                            <i class="fas fa-landmark text-white shadow-sm"></i>
                        </div>
                        <div class="space-y-0.5 md:space-y-1">
                            <h1 class="text-[18px] md:text-h2 font-black text-slate-900 dark:text-white leading-tight">Panel de Administración</h1>
                            <div class="flex items-center gap-2">
                                <span class="relative flex h-2 w-2">
                                   <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-light opacity-75"></span>
                                   <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                </span>
                                 <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Sincronizado con la nube</p>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-4 w-full md:w-auto">
                        <div class="hidden sm:flex flex-col items-end mr-4">
                             <p class="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tighter">Versión del Sistema</p>
                             <p class="text-[11px] font-black text-primary bg-primary/5 px-3 py-1 rounded-lg">Build ${appVersion || '3.6.0'}</p>
                        </div>
                        <button onclick="window.location.href='/conductores'" class="flex-1 md:flex-none bg-indigo-600/10 hover:bg-indigo-600 text-indigo-700 hover:text-white px-6 py-4 rounded-xl border border-indigo-500/30 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm">
                            <i class="fas fa-user-circle"></i>
                            Vista Conductor
                        </button>
                        <button id="logout-btn" class="flex-1 md:flex-none bg-slate-900 dark:bg-white/5 hover:bg-rose-600 dark:hover:bg-rose-500/10 text-white dark:text-slate-300 px-6 py-4 rounded-xl border border-slate-900 dark:border-white/5 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-black/10">
                            <i class="fas fa-sign-out-alt"></i>
                            Cerrar Sesión
                        </button>
                    </div>
                </header>

                <div class="admin-grid">
                    <!-- Sidebar Navigation -->
                    <aside class="sticky-nav">
                        <nav class="flex flex-row lg:flex-col gap-1.5 overflow-x-auto scrollbar-hide">
                            <button class="nav-item ${initialTab === 'dashboard' ? 'active' : ''} group" data-tab="dashboard">
                                <span class="nav-icon"><i class="fas fa-chart-pie"></i></span>
                                <span class="nav-label hidden lg:block">Dashboard</span>
                            </button>
                            <button class="nav-item ${initialTab === 'casa-en-casa' ? 'active' : ''} group" data-tab="casa-en-casa">
                                <span class="nav-icon"><i class="fas fa-map-marked-alt"></i></span>
                                <span class="nav-label hidden lg:block">Territorios</span>
                            </button>
                            <button class="nav-item ${initialTab === 'predicacion' ? 'active' : ''} group" data-tab="predicacion">
                                <span class="nav-icon"><i class="fas fa-broadcast-tower"></i></span>
                                <span class="nav-label hidden lg:block">P. Pública</span>
                            </button>
                            <button class="nav-item ${initialTab === 'telefonos' ? 'active' : ''} group" data-tab="telefonos">
                                <span class="nav-icon"><i class="fas fa-phone-alt"></i></span>
                                <span class="nav-label hidden lg:block">Telefonía</span>
                            </button>
                            <div class="hidden lg:block h-px mx-4 my-3 bg-slate-200 dark:bg-white/5"></div>
                            <button class="nav-item ${initialTab === 'config' ? 'active' : ''} group" data-tab="config">
                                <span class="nav-icon"><i class="fas fa-cog"></i></span>
                                <span class="nav-label hidden lg:block">Ajustes</span>
                            </button>
                        </nav>
                    </aside>

                    <!-- Content Area -->
                    <main id="admin-content" class="w-full min-h-[70vh] admin-content-wrapper">
                        <!-- Dynamic Content -->
                    </main>
                </div>
            </div>
            
            <div id="modal-container" class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm hidden overflow-y-auto z-[100] p-4 flex justify-center items-center transition-all duration-300"></div>
            <div id="modal-container-nested" class="fixed inset-0 bg-slate-950/60 backdrop-blur-md hidden overflow-y-auto z-[500] p-4 flex justify-center items-center transition-all duration-300"></div>
        `;

        document.getElementById('logout-btn').addEventListener('click', async () => {
            localStorage.removeItem('demo_role');
            await auth.signOut();
            window.location.href = '/login';
        });

        const tabs = document.querySelectorAll('.nav-item');
        tabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');

                const tabId = target.dataset.tab;
                const urlMap = {
                    'dashboard': 'dashboard',
                    'casa-en-casa': 'territorios',
                    'predicacion': 'predicacion',
                    'telefonos': 'telefonos',
                    'config': 'config'
                };

                const newPath = `/administrador/${urlMap[tabId] || 'dashboard'}`;
                window.history.pushState({}, '', newPath);
                loadTab(tabId, appVersion);
            });
        });

        loadTab(initialTab, appVersion);
        renderAdminAI();
    } catch (e) {
        console.error("Error in Admin Dashboard:", e);
        showNotification("Error cargando panel: " + e.message, "error");
    }
};

const renderSkeleton = (container) => {
    container.innerHTML = `
        <div class="p-8 space-y-10">
            <header class="flex justify-between items-center mb-12">
                <div class="h-14 w-64 skeleton-pro rounded-3xl"></div>
                <div class="h-14 w-40 skeleton-pro rounded-full"></div>
            </header>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                <div class="h-72 skeleton-pro rounded-[2.5rem]"></div>
                <div class="h-72 skeleton-pro rounded-[2.5rem]"></div>
                <div class="h-72 skeleton-pro rounded-[2.5rem]"></div>
            </div>
            <div class="h-[400px] skeleton-pro rounded-[3rem] mt-10"></div>
        </div>
    `;
};

const loadTab = async (tabName, appVersion) => {
    const contentDiv = document.getElementById('admin-content');
    renderSkeleton(contentDiv); // Premium Loading State

    if (tabName === 'config') {
        await renderConfigTab(contentDiv, 'reglas', appVersion);
    } else if (tabName === 'casa-en-casa') {
        await renderCasaEnCasaTab(contentDiv);
    } else if (tabName === 'predicacion') {
        await renderPredicacionTab(contentDiv);
    } else if (tabName === 'telefonos') {
        await renderTelefonosTab(contentDiv);
    } else if (tabName === 'dashboard') {
        await renderAnalyticsView(contentDiv);
    }
};

/* --- FLOATING AI (ADMIN) --- */
/* --- FLOATING AI (ADMIN) --- */
const renderAdminAI = async () => {
    const config = await getConfiguracion();
    if (!config.gemini_key) return;

    const [telefonos, publicadores, territorios, programa, conductores] = await Promise.all([
        getTelefonos(), getPublicadores(), getTerritorios(), getProgramaSemanal(), getConductores()
    ]);

    const brain = new TerritoryIntelligence(telefonos, publicadores, territorios, programa, conductores);

    // Inject styles
    if (!document.getElementById('ai-admin-styles')) {
        const style = document.createElement('style');
        style.id = 'ai-admin-styles';
        style.innerHTML = `
            @keyframes admin-pulse {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.7); }
                70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(79, 70, 229, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
            }
            .admin-ai-glow { animation: admin-pulse 2s infinite alternate; filter: drop-shadow(0 0 10px rgba(0, 255, 200, 0.3)); }
        `;
        document.head.appendChild(style);
    }

    const aiUI = document.createElement('div');
    aiUI.id = 'admin-ai-overlay';
    aiUI.innerHTML = `
        <button id="admin-ai-fab" class="fixed bottom-6 right-6 z-50 bg-indigo-900 border border-indigo-400/30 text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110 active:scale-95 group admin-ai-glow">
            <span class="text-3xl group-hover:rotate-12 transition-transform block">🧠</span>
            <span class="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-black uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none tracking-widest border border-indigo-500/20">
                Centro de Mando IA
            </span>
        </button>

        <div id="admin-ai-panel" class="fixed bottom-24 right-6 w-[calc(100vw-3rem)] md:w-96 glass-morphism border border-indigo-500/20 rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.6)] z-50 transform translate-y-10 opacity-0 pointer-events-none transition-all duration-500 ease-out flex flex-col max-h-[75vh] overflow-hidden">
            <div class="flex justify-between items-center p-6 bg-gradient-to-r from-indigo-900/40 to-blue-900/40">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-3xl shadow-inner shadow-indigo-500/10">🧠</div>
                    <div>
                        <h3 class="font-black text-white text-sm uppercase tracking-tighter">Command Center</h3>
                        <p class="text-[9px] text-teal-400 font-bold uppercase tracking-widest animate-pulse">Algoritmos Activos • v${appVersion || '3.5.0'}</p>
                    </div>
                </div>
                <button id="admin-ai-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all text-lg">✕</button>
            </div>
            
            <div id="admin-chat-log" class="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar min-h-[350px]">
                <div class="bg-indigo-500/10 p-4 rounded-3xl rounded-tl-none border border-indigo-500/20 text-gray-200 leading-relaxed shadow-sm">
                    <b>Sistema de Auditoría Proactiva</b> cargado. ¿Deseas un informe de inconsistencias o necesitas ejecutar una asignación masiva mediante lenguaje natural?
                </div>
            </div>

            <div class="p-4 bg-black/50 border-t border-white/5 flex gap-2">
                <input type="text" id="admin-chat-input" 
                    placeholder="Ej: 'Asigna el 05 a Juan Pérez'..." 
                    class="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:border-indigo-500 outline-none placeholder-gray-500 transition-all">
                <button id="admin-chat-send" class="bg-indigo-600 hover:bg-indigo-500 text-white w-12 h-12 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center active:scale-90">
                    <span class="text-xl">⚡</span>
                </button>
            </div>
        </div>
    `;

    const existing = document.getElementById('admin-ai-overlay');
    if (existing) existing.remove();
    document.body.appendChild(aiUI);

    const fab = document.getElementById('admin-ai-fab');
    const panel = document.getElementById('admin-ai-panel');
    const close = document.getElementById('admin-ai-close');
    const input = document.getElementById('admin-chat-input');
    const send = document.getElementById('admin-chat-send');
    const log = document.getElementById('admin-chat-log');

    let isOpen = false;
    const togglePanel = () => {
        isOpen = !isOpen;
        if (isOpen) {
            panel.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
            input.focus();
        } else {
            panel.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
        }
    };

    fab.addEventListener('click', togglePanel);
    close.addEventListener('click', togglePanel);

    const handleSend = async () => {
        const prompt = input.value.trim();
        if (!prompt) return;

        log.innerHTML += `<div class="flex justify-end"><div class="bg-indigo-600 text-white px-4 py-3 rounded-3xl rounded-tr-none text-xs max-w-[85%] font-medium shadow-lg">${prompt}</div></div>`;
        log.scrollTop = log.scrollHeight;
        input.value = '';
        input.disabled = true;

        try {
            const loadingId = 'loading-' + Date.now();
            log.innerHTML += `<div id="${loadingId}" class="flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest"><span class="animate-ping">🧠</span> Procesando...</div>`;
            log.scrollTop = log.scrollHeight;

            let responseText = await brain.askGemini(config.gemini_key, prompt);

            // Regex for Commands
            const commandRegex = /\|\|(ASSIGN_TERR|UNASSIGN_TERR):(.+?)\|\|/g;
            const matches = [...responseText.matchAll(commandRegex)];
            let actionLogs = "";

            for (const match of matches) {
                const fullCommand = match[0];
                const commandContent = match[2];
                const actionType = match[1];

                responseText = responseText.replace(fullCommand, '');

                try {
                    if (actionType === 'ASSIGN_TERR') {
                        const parts = commandContent.split(':');
                        const tId = parts[0];
                        const cName = parts[1];
                        if (tId && cName) {
                            await assignTerritorio(tId, cName);
                            actionLogs += `<div class="text-teal-400 text-[10px] mt-2 p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center gap-2">✅ Asignado: <b>${tId}</b> → <b>${cName}</b></div>`;
                        }
                    }
                } catch (e) {
                    console.error(e);
                    actionLogs += `<div class="text-red-400 text-[10px] mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">❌ Error en acción: ${e.message}</div>`;
                }
            }

            document.getElementById(loadingId)?.remove();
            const htmlResponse = responseText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

            log.innerHTML += `<div class="flex items-start flex-col gap-2 max-w-[95%] animate-fade-in">
                <div class="bg-white/10 text-gray-200 px-4 py-3 rounded-3xl rounded-tl-none text-xs border border-white/10 leading-relaxed shadow-sm">
                    ${htmlResponse}
                </div>
                ${actionLogs}
            </div>`;

        } catch (err) {
            console.error(err);
            log.innerHTML += `<div class="bg-red-500/10 text-red-400 text-[10px] p-4 rounded-2xl border border-red-500/20 shadow-lg">Error: ${err.message}</div>`;
        } finally {
            input.disabled = false;
            input.focus();
            log.scrollTop = log.scrollHeight;
        }
    };

    send.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
};


/* --- CASA EN CASA TAB (SUPER MODULE) --- */
const renderCasaEnCasaTab = async (container) => {
    let _activeSub = 'asignaciones';
    container.innerHTML = `
        <div class="space-y-8 animate-fade-in px-2 lg:px-6">
            <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
                <div class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-primary/30 border border-primary/20 dark:border-white/10">
                        <i class="fas fa-home shadow-sm"></i>
                    </div>
                    <div class="space-y-1">
                        <h2 class="text-h2 text-slate-900 dark:text-white">Predicación Casa en Casa</h2>
                        <div class="flex items-center gap-2">
                             <span class="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                              <p class="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-widest">Módulo de Territorios JW</p>
                        </div>
                    </div>
                </div>

                <!-- 2026 Sub Navigation -->
                <nav class="flex flex-wrap items-center gap-2 bg-white/50 dark:bg-white/[0.03] p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm w-full xl:w-auto backdrop-blur-xl">
                    <button class="sub-tab-casa group px-5 py-3 rounded-xl transition-all flex items-center gap-3 whitespace-nowrap" data-sub="asignaciones">
                        <i class="fas fa-clipboard-list text-sm"></i>
                        <span class="text-[11px] font-bold uppercase tracking-wider">Asignaciones</span>
                    </button>
                    <button class="sub-tab-casa group px-5 py-3 rounded-xl transition-all flex items-center gap-3 whitespace-nowrap" data-sub="programa">
                        <i class="fas fa-calendar-alt text-sm"></i>
                        <span class="text-[11px] font-bold uppercase tracking-wider">Programa</span>
                    </button>
                    <button class="sub-tab-casa group px-5 py-3 rounded-xl transition-all flex items-center gap-3 whitespace-nowrap" data-sub="s12">
                        <i class="fas fa-map text-sm"></i>
                        <span class="text-[11px] font-bold uppercase tracking-wider">S-12</span>
                    </button>
                    <button class="sub-tab-casa group px-5 py-3 rounded-xl transition-all flex items-center gap-3 whitespace-nowrap" data-sub="gestion">
                        <i class="fas fa-history text-sm"></i>
                        <span class="text-[11px] font-bold uppercase tracking-wider">Historial S-13</span>
                    </button>
                    <div class="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1 shrink-0"></div>
                    <button class="sub-tab-casa group px-5 py-3 rounded-xl transition-all flex items-center gap-3 whitespace-nowrap" data-sub="recursos">
                        <i class="fas fa-briefcase text-sm"></i>
                        <span class="text-[11px] font-bold uppercase tracking-wider">Ayudas</span>
                    </button>
                </nav>
            </div>
            
            <div id="casa-content" class="relative min-h-[60vh]">
                <!-- Contenido dinámico -->
            </div>
            
            <!-- Sync Indicator -->
            <div id="super-sync-indicator" class="hidden fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-primary text-white px-6 py-3 rounded-2xl shadow-2xl z-[60] animate-bounce-in">
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
            syncIndicator.classList.remove('hidden');
        }

        // Update Nav UI
        container.querySelectorAll('.sub-tab-casa').forEach(btn => {
            const isActive = btn.dataset.sub === sub;
            btn.classList.toggle('active', isActive);
            if (!isActive) {
                btn.className = "sub-tab-casa group px-5 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light hover:bg-white dark:hover:bg-white/5 transition-all flex items-center gap-3 font-extrabold border border-transparent hover:border-slate-200 dark:hover:border-white/10 shadow-sm";
            }
        });

        try {
            // Unified render mapping
            const views = {
                'asignaciones': renderAsignacionesView,
                'programa': renderProgramaTab,
                's12': renderS12View,
                'gestion': renderS13CommandCenter,
                'recursos': renderRecursosTab
            };

            if (views[sub]) {
                await views[sub](subContainer);
                setTimeout(() => syncIndicator.classList.add('hidden'), 1000);
            }
        } catch (error) {
            console.error(`Error loading Super Module [${sub}]:`, error);
            subContainer.innerHTML = `<div class="p-10 text-center text-red-500 font-bold">Error al cargar el módulo: ${error.message}</div>`;
            syncIndicator.classList.add('hidden');
        }
    };

    // Shared Module Broadcaster
    window.dispatchModuleSync = () => {
        console.log("[SuperModule] Remote Sync Triggered");
        loadCasaSub(_activeSub, true);
    };

    container.querySelectorAll('.sub-tab-casa').forEach(btn => {
        btn.addEventListener('click', (e) => loadCasaSub(e.currentTarget.dataset.sub));
    });

    // Default to Asignaciones
    loadCasaSub('asignaciones');
};

const renderRecursosTab = async (container) => {
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
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...';

                try {
                    await updateRecurso(id, { titulo: title, url, imagen: img, descripcion: desc });
                    showNotification("Recurso actualizado", "success");
                    modal.classList.add('hidden');
                    renderRecursosTab(container);
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
    let currentView = 'activas'; // dashboard, activas, historial, campañas
    let selectedIds = new Set();

    // Fetch initial data
    const initData = async () => {
        const [territorios, conductores, programa, allHistory, config] = await Promise.all([
            getTerritorios(),
            getConductores(),
            getProgramaSemanal(),
            getHistorialReport(),
            getConfiguracion()
        ]);
        return { territorios, conductores, programa, allHistory, config };
    };

    let { territorios, conductores, programa, allHistory, config } = await initData();

    const reloadData = async () => {
        const data = await initData();
        territorios = data.territorios;
        conductores = data.conductores;
        programa = data.programa;
        allHistory = data.allHistory;
        config = data.config;
        renderMain();
    };

    const toggleSelect = async (id) => {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        renderMain();
    };

    window.actionToggleSelect = toggleSelect;

    const handleNewAssignment = async (editId = null, prefill = null) => {
        const item = editId ? territorios.find(x => x.id === editId) : null;
        const todayStr = prefill?.date || (item?.fecha_asignacion ? item.fecha_asignacion.split('T')[0] : new Date().toISOString().split('T')[0]);

        // Strict config based options
        const horasOptions = (config.horarios_programa && config.horarios_programa.length > 0) ? config.horarios_programa : ['09:00', '15:00', '19:00'];
        const lugaresOptions = (config.lugares && config.lugares.length > 0) ? config.lugares : ['Salón del Reino'];
        const facetasOptions = (config.facetas && config.facetas.length > 0) ? config.facetas : ['Casa en casa', 'Carritos'];

        const configuredGroups = await getGroupsConfig();
        const activeConductors = conductores.filter(p => p.es_conductor).sort((a, b) => a.nombre.localeCompare(b.nombre));
        const activeAuxiliares = conductores.filter(p => !p.es_conductor).sort((a, b) => a.nombre.localeCompare(b.nombre));

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
                    <!-- Territorios -->
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
                                        <span class="text-[10px] text-slate-500 uppercase font-black opacity-60">${item.nombre || 'Área General'}</span>
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
                                        <span class="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1 block">Gestión Granular</span>
                                    </div>
                                </div>
                                <i class="fas fa-arrow-right text-slate-300 group-hover:translate-x-1 group-hover:text-primary transition-all"></i>
                            </button>
                            <input type="hidden" id="asig-terr-raw" value="${prefill?.territoriesRaw || ''}">
                        `}
                    </div>

                    <!-- Equipo y Faceta -->
                    <div class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Conductor Principal</label>
                                <select id="asig-cond" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white hover:border-primary transition-all appearance-none cursor-pointer uppercase shadow-sm">
                                    <option value="" disabled ${(!item && !prefill?.cond) ? 'selected' : ''}>Elegir conductor...</option>
                                    ${activeConductors.map(c => `<option value="${c.nombre}" ${(prefill?.cond ? prefill.cond === c.nombre : item?.asignado_a === c.nombre) ? 'selected' : ''} class="text-slate-900">${c.nombre}</option>`).join('')}
                                </select>
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Auxiliar de Apoyo</label>
                                <select id="asig-aux" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white hover:border-primary transition-all appearance-none cursor-pointer uppercase shadow-sm">
                                    <option value="" class="text-slate-900">Ninguno</option>
                                    ${activeConductors.map(c => `<option value="${c.nombre}" ${(prefill?.aux ? prefill.aux === c.nombre : item?.auxiliar === c.nombre) ? 'selected' : ''} class="text-slate-900">${c.nombre}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Faceta de Predicación</label>
                                <select id="asig-faceta" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white hover:border-primary transition-all appearance-none cursor-pointer uppercase shadow-sm">
                                    ${facetasOptions.map(f => `<option value="${f}" ${(prefill?.faceta === f || item?.faceta === f) ? 'selected' : ''} class="text-slate-900">${f}</option>`).join('')}
                                </select>
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Campaña Especial</label>
                                <input type="text" id="asig-campana" value="${prefill?.campana || item?.campana || ''}" list="campanas-list" placeholder="Opcional..." 
                                    class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white outline-none focus:border-red-400 transition-all placeholder-slate-500 uppercase shadow-sm">
                                <datalist id="campanas-list">
                                    ${[...new Set(allHistory.map(h => h.campana).filter(Boolean))].map(c => `<option value="${c}">`).join('')}
                                </datalist>
                            </div>
                        </div>
                    </div>

                    <!-- Logística -->
                    <!-- Logística: 2x2 Columnas para mejor uso de espacio -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 bg-white/50 dark:bg-black/20 p-6 md:p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-inner">
                        <div class="space-y-3">
                            <label class="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <i class="far fa-calendar-alt text-primary/60"></i> Fecha
                            </label>
                            <input type="date" id="asig-date" value="${todayStr}" class="w-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 p-4 rounded-2xl text-[11px] font-black text-primary outline-none shadow-sm focus:border-primary transition-all">
                        </div>
                        <div class="space-y-3">
                             <label class="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <i class="far fa-clock text-primary/60"></i> Día Salida
                             </label>
                             <select id="asig-date-salida" class="w-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 p-4 rounded-2xl text-[11px] font-black text-primary outline-none appearance-none cursor-pointer uppercase shadow-sm focus:border-primary transition-all">
                                <option value="" class="text-slate-900">Elegir...</option>
                                ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => {
            const currentSalida = prefill?.salida || (item?.fecha_salida ? ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(item.fecha_salida).getUTCDay()] : '');
            return `<option value="${d}" ${currentSalida === d ? 'selected' : ''} class="text-slate-900">${d}</option>`;
        }).join('')}
                             </select>
                        </div>
                        <div class="space-y-3">
                             <label class="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <i class="fas fa-hourglass-start text-primary/60"></i> Hora
                             </label>
                             <select id="asig-hora" class="w-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 p-4 rounded-2xl text-[11px] font-black text-primary outline-none appearance-none cursor-pointer uppercase shadow-sm focus:border-primary transition-all">
                                ${horasOptions.map(h => `<option value="${h}" ${(prefill?.hora === h || item?.hora === h || prefill?.turno === h) ? 'selected' : ''} class="text-slate-900">${h}</option>`).join('')}
                             </select>
                        </div>
                        <div class="space-y-3">
                             <label class="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <i class="fas fa-map-marker-alt text-primary/60"></i> Lugar
                             </label>
                             <select id="asig-lugar" class="w-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 p-4 rounded-2xl text-[11px] font-black text-primary outline-none appearance-none cursor-pointer uppercase shadow-sm focus:border-primary transition-all">
                                ${lugaresOptions.map(l => `<option value="${l}" ${(prefill?.lugar === l || item?.lugar === l) ? 'selected' : ''} class="text-slate-900">${l}</option>`).join('')}
                             </select>
                        </div>
                    </div>
                    
                    <!-- Grupos y Divisiones (Opcional - Sábado/Domingo) -->
                    <div id="sunday-logic" class="hidden space-y-6 animate-slide-up bg-slate-100/50 dark:bg-black/20 p-6 md:p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-inner">
                        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-white dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10 mb-4 shadow-sm">
                            <div class="flex items-center gap-4 text-center sm:text-left">
                                <div class="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary text-xl"><i class="fas fa-users-viewfinder"></i></div>
                                <div>
                                    <p class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">División de Grupos</p>
                                    <p class="text-[9px] text-slate-500 font-bold uppercase tracking-widest">¿Dividir territorio en sub-equipos?</p>
                                </div>
                            </div>
                            <select id="asig-split-count" class="w-full sm:w-auto bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/20 px-6 py-3 rounded-2xl text-[11px] font-black text-primary outline-none appearance-none cursor-pointer uppercase shadow-inner">
                                <option value="1">No (1 Equipo)</option>
                                <option value="2">2 Equipos</option>
                                <option value="3">3 Equipos</option>
                                <option value="4">4 Equipos</option>
                            </select>
                        </div>

                        <div id="asig-group-single" class="space-y-4">
                            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block text-center sm:text-left flex items-center gap-2">
                                <i class="fas fa-tags text-primary/60"></i> Seleccionar Grupos de Servicio
                            </label>
                            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                ${['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'].map(g => `
                                    <label class="flex items-center gap-3 p-3 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 cursor-pointer hover:border-primary/50 transition-all group relative overflow-hidden shadow-sm">
                                        <input type="checkbox" name="asig-group-check" class="peer absolute inset-0 opacity-0 z-10 cursor-pointer" value="${g}">
                                        <div class="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-white/10 peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center text-white text-[10px] transition-all bg-slate-50 dark:bg-black/20">
                                            <i class="fas fa-check opacity-0 peer-checked:opacity-100"></i>
                                        </div>
                                        <span class="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">${g}</span>
                                    </label>
                                `).join('')}
                            </div>
                            <input type="hidden" id="asig-grupos" value="${prefill?.grupos || item?.grupos || ''}">
                        </div>

                        <div id="sunday-blocks" class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in"></div>
                    </div>
                    
                    <!-- Hidden field for compatibility with legacyturno logic if needed -->
                    <input type="hidden" id="asig-turno" value="">
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                    <button id="confirm-asig" class="w-full py-5 bg-primary hover:bg-primary-light text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3">
                        <i class="fas fa-check-circle"></i>
                        ${editId ? 'Guardar Cambios' : 'Confirmar Asignación'}
                    </button>
                </footer>
            </div>
        `, (modal) => {
            const dateInput = modal.querySelector('#asig-date');
            const salidaInput = modal.querySelector('#asig-date-salida');
            const sunLogic = modal.querySelector('#sunday-logic');
            const splitSelect = modal.querySelector('#asig-split-count');
            const blocksContainer = modal.querySelector('#sunday-blocks');
            const singleGroupContainer = modal.querySelector('#asig-group-single');
            const confirmBtn = modal.querySelector('#confirm-asig');
            const hiddenGroupsInput = modal.querySelector('#asig-grupos');
            const checkboxes = modal.querySelectorAll('input[name="asig-group-check"]');

            if (!sunLogic || !splitSelect || !blocksContainer || !hiddenGroupsInput) {
                console.error("Critical elements missing from Asignacion Modal");
            }

            const renderBlocks = () => {
                const count = parseInt(splitSelect.value);
                if (count === 1) {
                    if (blocksContainer) blocksContainer.innerHTML = '';
                    if (singleGroupContainer) singleGroupContainer.classList.remove('hidden');
                    return;
                }
                if (singleGroupContainer) singleGroupContainer.classList.add('hidden');

                let html = '';
                for (let i = 1; i <= count; i++) {
                    html += `
                        <div class="modern-card !p-5 bg-white/40 dark:bg-white/5 border-primary/20 space-y-4">
                            <div class="flex items-center justify-between border-b border-white/5 pb-2">
                                <p class="text-[9px] font-black text-primary uppercase tracking-widest">Sub-Equipo ${i}</p>
                                <i class="fas fa-users-cog text-primary/40"></i>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="space-y-1">
                                    <label class="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Responsable</label>
                                    <select class="block-cond w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-[10px] font-black text-slate-700 dark:text-white uppercase outline-none shadow-inner">
                                        <option value="" class="text-slate-900">Elegir...</option>
                                        ${conductores.map(c => `<option value="${c.nombre}" class="text-slate-900">${c.nombre}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Grupo/Sectores</label>
                                    <select class="block-group w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-[10px] font-black text-slate-700 dark:text-white uppercase outline-none shadow-inner">
                                        <option value="" class="text-slate-900">Elegir...</option>
                                        <option value="G1-5" class="text-slate-900">G1-5</option>
                                        <option value="G2-6" class="text-slate-900">G2-6</option>
                                        <option value="G3-4" class="text-slate-900">G3-4</option>
                                        ${Array.from({ length: 12 }, (_, i) => `<option value="G${i + 1}" class="text-slate-900">G${i + 1}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                    `;
                }
                blocksContainer.innerHTML = html;
            };

            const checkSunday = () => {
                if (!salidaInput || !sunLogic) return;
                const dayName = salidaInput.value;
                if (dayName === 'Domingo' || dayName === 'Sábado') sunLogic.classList.remove('hidden');
                else sunLogic.classList.add('hidden');
            };

            if (!editId) {
                const btnOpen = modal.querySelector('#btn-open-terr-modal');
                const summaryLabel = modal.querySelector('#asig-terr-summary');
                const rawInput = modal.querySelector('#asig-terr-raw');

                btnOpen.onclick = () => {
                    const available = territorios.filter(t => t.estado !== 'Asignado' && t.estado !== 'Pendiente');



                    showTerritorySelectionModal(rawInput.value, available, (displayStr) => {
                        if (displayStr) {
                            summaryLabel.innerText = displayStr;
                            summaryLabel.classList.add('text-primary');
                            summaryLabel.classList.remove('text-slate-900', 'dark:text-white');
                            rawInput.value = displayStr;
                        } else {
                            summaryLabel.innerText = 'Click para seleccionar...';
                            summaryLabel.classList.remove('text-primary');
                            summaryLabel.classList.add('text-slate-900', 'dark:text-white');
                            rawInput.value = '';
                        }
                    }, 'modal-container-nested');
                };
            }

            if (hiddenGroupsInput.value) {
                const selected = hiddenGroupsInput.value.split(', ');
                checkboxes.forEach(cb => { if (selected.includes(cb.value)) cb.checked = true; });
            }

            checkboxes.forEach(cb => {
                cb.onchange = () => {
                    const values = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
                    hiddenGroupsInput.value = values.join(', ');
                };
            });

            salidaInput.onchange = checkSunday;
            splitSelect.onchange = renderBlocks;
            checkSunday();

            confirmBtn.onclick = async (e) => {
                let terrRequests = [];
                if (editId) {
                    const tid = modal.querySelector('#asig-terr-single').value;
                    const num = modal.querySelector('#asig-terr-single').dataset.num;
                    terrRequests.push({ id: tid, num: num, manzanas: null });
                } else {
                    const rawValue = modal.querySelector('#asig-terr-raw').value;
                    if (!rawValue) return showNotification("Debes seleccionar al menos un territorio", "warning");

                    rawValue.split(',').forEach(p => {
                        const part = p.trim();
                        if (!part) return;
                        const match = part.match(/^([^(\s,]+)(?:\s*\((.*)\))?$/);
                        if (match) {
                            const num = match[1];
                            const mzs = match[2] ? match[2].split(',').map(m => m.trim()) : null;
                            const t = territorios.find(x => x.numero == num);
                            if (t) terrRequests.push({ id: t.id, num: num, manzanas: mzs });
                        }
                    });
                }

                const cond = modal.querySelector('#asig-cond').value;
                const aux = modal.querySelector('#asig-aux').value;
                const date = modal.querySelector('#asig-date').value;
                const dateSalida = modal.querySelector('#asig-date-salida').value;
                const turno = modal.querySelector('#asig-turno').value;
                const faceta = modal.querySelector('#asig-faceta').value;
                const lugar = modal.querySelector('#asig-lugar').value;
                const hora = modal.querySelector('#asig-hora').value;
                const camp = modal.querySelector('#asig-campana').value;
                const groups = modal.querySelector('#asig-grupos').value;
                const splitCount = parseInt(splitSelect.value);

                if (terrRequests.length === 0 || !cond || !date) return showNotification("Faltan campos críticos (Territorio, Conductor o Fecha)", "warning");

                const blocks = [];
                if (splitCount > 1) {
                    const conds = modal.querySelectorAll('.block-cond');
                    const grps = modal.querySelectorAll('.block-group');
                    conds.forEach((c, i) => {
                        if (c.value) blocks.push({ conductor: c.value, grupos: grps[i].value });
                    });
                }

                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Procesando...';

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

                try {
                    const finalFechaSalida = calculateSalidaDate(date, dateSalida);
                    for (const req of terrRequests) {
                        const sharedDetails = {
                            auxiliar: aux,
                            fecha_asignacion: new Date(date + 'T12:00:00Z').toISOString(),
                            fecha_salida: finalFechaSalida,
                            turno, faceta, lugar, hora, campana: camp, grupos: groups,
                            blocks: blocks.length > 0 ? blocks : null
                        };

                        if (req.manzanas) {
                            await assignTerritorioParcial(req.id, req.manzanas, cond, sharedDetails);
                        } else {
                            await assignTerritorio(req.id, cond, sharedDetails);
                        }
                    }

                    if (camp) await saveCampana(camp);
                    showNotification(terrRequests.length > 1 ? `${terrRequests.length} territorios asignados` : (editId ? "Asignación actualizada" : "Territorio asignado con éxito"), "success");
                    modal.classList.add('hidden');
                    await reloadData();
                    if (window.dispatchModuleSync) window.dispatchModuleSync();
                } catch (err) {
                    console.error(err);
                    showNotification("Error: " + err.message, "error");
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = editId ? "Guardar Cambios" : "Confirmar Asignación";
                }
            };
        });
    };

    const handleBulkReturn = async () => {
        const assignedTerritories = territorios.filter(t => t.estado === 'Asignado' || t.estado === 'Pendiente')
            .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

        if (assignedTerritories.length === 0) return showNotification("No hay territorios asignados para devolver", "info");

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden shadow-2xl">
                <!-- 2026 Admin Header (Return Style) -->
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-file-invoice"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Recepción de Informes</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Cierre de Asignaciones y Registro S-13</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-8 bg-slate-50 dark:bg-black/20">
                    <!-- Registros Seleccionados -->
                    <div class="space-y-4">
                        <div class="flex justify-between items-center px-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Territorios en curso</label>
                            <button id="select-all-returns" class="text-[10px] font-black text-primary uppercase hover:text-primary-light transition-colors tracking-widest">Seleccionar Todos</button>
                        </div>
                        
                        <div class="grid grid-cols-1 gap-3">
                            ${assignedTerritories.map(t => {
            const isChecked = selectedIds.has(t.id);
            return `
                                    <div class="return-item-container modern-card !p-4 border ${isChecked ? 'border-primary/50 ring-2 ring-primary/5' : 'border-slate-100 dark:border-white/5'} transition-all group">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-4">
                                                <div class="relative">
                                                    <input type="checkbox" class="return-check peer sr-only" value="${t.id}" ${isChecked ? 'checked' : ''}>
                                                    <div class="w-6 h-6 rounded-lg border-2 border-slate-200 dark:border-white/10 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center text-white text-[10px]">
                                                        <i class="fas fa-check"></i>
                                                    </div>
                                                </div>
                                                <div class="text-left">
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs font-black text-slate-900 dark:text-white">#${t.numero}</span>
                                                        <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[150px]">${t.asignado_a}</span>
                                                    </div>
                                                    <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">${t.manzanas ? t.manzanas.split(',').length + ' Manzanas' : 'Territorio Completo'}</p>
                                                </div>
                                            </div>
                                            <div class="return-details ${isChecked ? '' : 'hidden'} flex gap-3">
                                                <button class="completion-toggle w-10 h-10 rounded-xl flex items-center justify-center text-sm active border border-primary/20 bg-primary/10 text-primary shadow-sm hover:scale-105 transition-transform" data-val="full" data-tid="${t.id}" title="Completo">
                                                    <i class="fas fa-check-double"></i>
                                                </button>
                                                <button class="completion-toggle w-10 h-10 rounded-xl flex items-center justify-center text-sm opacity-40 grayscale border border-slate-200 dark:border-white/10 hover:opacity-100 hover:grayscale-0 transition-all hover:scale-105" data-val="partial" data-tid="${t.id}" title="Parcial">
                                                    <i class="fas fa-adjust"></i>
                                                </button>
                                            </div>
                                        </div>

                                        <!-- Partial selection (hidden by default) -->
                                        <div class="partial-selector hidden mt-4 pt-4 border-t border-slate-100 dark:border-white/5" data-tid="${t.id}">
                                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Marcar sectores completados:</p>
                                            <div class="flex flex-wrap gap-2">
                                                ${(t.manzanas || '').split(',').map(m => m.trim()).filter(Boolean).map(mz => `
                                                    <label class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10 cursor-pointer hover:border-primary/50 transition-all">
                                                        <input type="checkbox" class="mz-done-check peer sr-only" value="${mz}" data-tid="${t.id}">
                                                        <div class="w-4 h-4 rounded border border-slate-300 dark:border-white/20 peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center text-white text-[8px]">
                                                            <i class="fas fa-check"></i>
                                                        </div>
                                                        <span class="text-[10px] font-bold text-slate-600 dark:text-white uppercase">${mz}</span>
                                                    </label>
                                                `).join('')}
                                            </div>
                                        </div>
                                    </div>
                                `;
        }).join('')}
                        </div>
                    </div>

                    <!-- Logística de Cierre -->
                    <div class="modern-card !p-8 space-y-8 bg-white dark:bg-white/5 border-primary/10 ring-1 ring-primary/5">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha de Devolución</label>
                                <div class="relative">
                                    <input type="date" id="bulk-return-date" value="${new Date().toISOString().split('T')[0]}" class="w-full p-5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-primary outline-none focus:border-primary transition-all shadow-inner uppercase text-center">
                                    <div class="absolute inset-y-0 right-5 flex items-center pointer-events-none text-primary/40"><i class="fas fa-calendar-day"></i></div>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Estado del Registro</label>
                                <div class="relative">
                                    <select id="bulk-return-status" class="w-full p-5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner uppercase text-center appearance-none cursor-pointer">
                                        <option value="Completado" selected>TERMINADO</option>
                                        <option value="Incompleto">PENDIENTE</option>
                                        <option value="Perdido">PERDIDO</option>
                                    </select>
                                    <div class="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-400"><i class="fas fa-chevron-down text-[10px]"></i></div>
                                </div>
                            </div>
                        </div>

                        <label class="flex items-center gap-5 p-6 bg-slate-50 dark:bg-black/20 rounded-3xl border border-slate-100 dark:border-white/5 cursor-pointer hover:border-primary/20 transition-all group">
                            <div class="relative">
                                <input type="checkbox" id="bulk-repeat" class="peer sr-only">
                                <div class="w-6 h-6 rounded-lg border-2 border-slate-300 dark:border-white/20 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center text-white text-[10px] shadow-sm">
                                    <i class="fas fa-redo-alt"></i>
                                </div>
                            </div>
                            <div>
                                <p class="text-[11px] font-black text-slate-700 dark:text-white uppercase tracking-tight">Reiniciar ciclo automáticamente</p>
                                <p class="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-0.5 opacity-60 italic">El publicador conserva el registro para una nueva vuelta</p>
                            </div>
                        </label>
                    </div>

                </div>

                <!-- Sticky Footer -->
                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex flex-col gap-6">
                    <button id="confirm-bulk-return" class="w-full py-6 bg-primary hover:bg-primary-light text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3">
                        <i class="fas fa-file-archive"></i>
                        Confirmar Cierre de Registros
                    </button>
                    <p class="text-[9px] text-slate-400 text-center font-black uppercase tracking-widest opacity-40">
                        Los datos se archivarán permanentemente en el historial S-13
                    </p>
                </footer>
            </div>
        `, (modal) => {
            const selectAll = modal.querySelector('#select-all-returns');
            const checks = modal.querySelectorAll('.return-check');

            const updateItemVisibility = (cb) => {
                const container = cb.closest('.return-item-container');
                const details = container.querySelector('.return-details');
                if (cb.checked) {
                    details.classList.remove('hidden');
                    container.classList.add('border-primary/30', 'ring-4', 'ring-primary/5');
                } else {
                    details.classList.add('hidden');
                    container.classList.remove('border-primary/30', 'ring-4', 'ring-primary/5');
                    // Also hide partial selector if unchecked
                    const pSelector = container.querySelector('.partial-selector');
                    if (pSelector) pSelector.classList.add('hidden');
                }
            };

            checks.forEach(cb => {
                cb.onchange = () => updateItemVisibility(cb);
            });

            selectAll.onclick = () => {
                const someUnchecked = Array.from(checks).some(c => !c.checked);
                checks.forEach(c => {
                    c.checked = someUnchecked;
                    updateItemVisibility(c);
                });
                selectAll.innerText = someUnchecked ? 'Deseleccionar Todos' : 'Seleccionar Todos';
            };

            // Logic for Full/Partial Toggle
            modal.querySelectorAll('.completion-toggle').forEach(btn => {
                btn.onclick = () => {
                    const tid = btn.dataset.tid;
                    const val = btn.dataset.val;
                    const group = modal.querySelectorAll(`.completion-toggle[data-tid="${tid}"]`);
                    group.forEach(b => {
                        b.classList.add('opacity-40', 'grayscale');
                        b.classList.remove('active', 'border-primary/20', 'bg-primary/10', 'text-primary');
                        b.classList.add('border-slate-200', 'dark:border-white/10');
                    });
                    btn.classList.remove('opacity-40', 'grayscale', 'border-slate-200', 'dark:border-white/10');
                    btn.classList.add('active', 'border-primary/20', 'bg-primary/10', 'text-primary');

                    const selector = modal.querySelector(`.partial-selector[data-tid="${tid}"]`);
                    if (selector) {
                        if (val === 'partial') selector.classList.remove('hidden');
                        else selector.classList.add('hidden');
                    }
                };
            });

            modal.querySelector('#confirm-bulk-return').onclick = async (e) => {
                const targetIds = Array.from(checks).filter(c => c.checked).map(c => c.value);
                if (targetIds.length === 0) return showNotification("Selecciona al menos un territorio", "warning");

                const date = modal.querySelector('#bulk-return-date').value;
                const status = modal.querySelector('#bulk-return-status').value;
                const repeat = modal.querySelector('#bulk-repeat').checked;

                const itemsToProcess = assignedTerritories.filter(t => targetIds.includes(t.id));

                e.target.disabled = true;
                e.target.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-3"></i> Procesando Informes...';

                try {
                    for (const item of itemsToProcess) {
                        const togglePartial = modal.querySelector(`.completion-toggle[data-tid="${item.id}"].active`).dataset.val === 'partial';
                        const allMzs = item.manzanas ? item.manzanas.split(',').map(m => m.trim()) : [];

                        if (togglePartial) {
                            const completedMzs = Array.from(modal.querySelectorAll(`.mz-done-check[data-tid="${item.id}"]:checked`)).map(c => c.value);
                            const remainingMzs = allMzs.filter(m => !completedMzs.includes(m));

                            if (remainingMzs.length === 0) {
                                // Effectively a full return
                                await returnTerritorio(item.id, repeat ? "Repetición automática (Full)" : "Devolución masiva (Full)", date, status);
                            } else {
                                await returnTerritorioParcial(
                                    item.id,
                                    completedMzs,
                                    remainingMzs,
                                    !repeat, // If repeat is false, we unassign the remaining part
                                    repeat ? "Repetición parcial" : "Devolución parcial masiva",
                                    date
                                );
                            }
                        } else {
                            await returnTerritorio(item.id, repeat ? "Repetición automática" : "Devolución masiva", date, status);
                        }

                        // If repeat is requested, we need to reassign IF the territory became free
                        const isEffectivelyFull = !togglePartial || (togglePartial && allMzs.filter(m => !Array.from(modal.querySelectorAll(`.mz-done-check[data-tid="${item.id}"]:checked`)).map(c => c.value).includes(m)).length === 0);

                        if (repeat && isEffectivelyFull) {
                            await assignTerritorio(item.id, item.asignado_a, {
                                auxiliar: item.auxiliar || null,
                                lugar: item.lugar || null,
                                hora: item.hora || null,
                                faceta: item.faceta || null,
                                turno: item.turno || null,
                                campana: item.campana || null,
                                grupos: item.grupos || null,
                                fecha_asignacion: new Date().toISOString()
                            });
                        }
                    }

                    showNotification(`${targetIds.length} territorios procesados con éxito`, "success");
                    selectedIds.clear();
                    modal.closest('#modal-container').classList.add('hidden');
                    await reloadData();
                    if (window.dispatchModuleSync) window.dispatchModuleSync();
                } catch (err) {
                    showNotification("Error: " + err.message, "error");
                    e.target.disabled = false;
                    e.target.innerHTML = "Reintentar Acción";
                }
            };
        });
    };


    const handleEditActive = async (id, num, conductor) => {
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
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Editar Asignación</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Territorio ${num}</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="modern-card !p-5 bg-white dark:bg-white/5 border-primary/20 ring-1 ring-primary/10 flex items-center gap-5">
                         <div class="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary text-2xl shadow-inner"><i class="fas fa-user-circle"></i></div>
                         <div class="min-w-0">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsable Actual</p>
                            <p class="font-black text-lg text-slate-800 dark:text-white truncate leading-tight">${conductor}</p>
                         </div>
                    </div>

                    <div class="space-y-6">
                        <div class="space-y-3">
                             <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Cambiar Conductor</label>
                             <select id="edit-asig-new-cond" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white hover:border-primary transition-all appearance-none cursor-pointer uppercase shadow-sm">
                                ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `
                                     <option value="${c.nombre}" ${c.nombre === t.asignado_a ? 'selected' : ''}>${c.nombre}</option>
                                `).join('')}
                             </select>
                        </div>

                        <div class="space-y-3">
                             <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Auxiliar de Apoyo</label>
                             <select id="edit-asig-aux" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white hover:border-primary transition-all appearance-none cursor-pointer uppercase shadow-sm">
                                <option value="">Ningún auxiliar</option>
                                ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => `
                                     <option value="${c.nombre}" ${c.nombre === t.auxiliar ? 'selected' : ''}>${c.nombre}</option>
                                `).join('')}
                             </select>
                        </div>

                        <div class="grid grid-cols-2 gap-6">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Jornada</label>
                                <select id="edit-asig-turno" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white hover:border-primary transition-all appearance-none cursor-pointer uppercase shadow-sm">
                                    <option value="manana" ${t.turno === 'manana' ? 'selected' : ''}>Mañana</option>
                                    <option value="tarde" ${t.turno === 'tarde' ? 'selected' : ''}>Tarde</option>
                                    <option value="noche" ${t.turno === 'noche' ? 'selected' : ''}>Noche</option>
                                </select>
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Horario</label>
                                <select id="edit-asig-hora" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white hover:border-primary transition-all appearance-none cursor-pointer uppercase shadow-sm">
                                    ${(config.horarios_programa && config.horarios_programa.length > 0 ? config.horarios_programa : ['08:30', '08:45', '09:00', '09:15', '09:30', '14:30', '16:00', '18:00']).map(h => `
                                        <option value="${h}" ${t.hora === h ? 'selected' : ''}>${h}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Faceta</label>
                            <select id="edit-asig-faceta" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white hover:border-primary transition-all appearance-none cursor-pointer uppercase shadow-sm">
                                ${(config.facetas || ['Casa en Casa', 'Telefónica', 'Pública', 'Cartas']).map(f => `
                                    <option value="${f}" ${t.faceta === f ? 'selected' : ''}>${f}</option>
                                `).join('')}
                            </select>
                        </div>

                        <div class="grid grid-cols-2 gap-6 bg-white/50 dark:bg-black/40 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5">
                            <div class="space-y-2">
                                <label class="text-[8px] font-black text-slate-400 uppercase text-center block tracking-widest">Fecha Asignación</label>
                                <input type="date" id="edit-asig-date" value="${t.fecha_asignacion ? t.fecha_asignacion.split('T')[0] : ''}" class="w-full bg-transparent text-[10px] font-black text-primary outline-none text-center">
                            </div>

                            <div class="space-y-2">
                                <label class="text-[8px] font-black text-slate-400 uppercase text-center block tracking-widest">Día Salida</label>
                                <select id="edit-asig-date-salida" class="w-full bg-transparent text-[10px] font-black text-primary outline-none text-center appearance-none cursor-pointer uppercase">
                                    <option value="">Elegir...</option>
                                    ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => `
                                        <option value="${d}" ${t.fecha_salida && ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(t.fecha_salida).getUTCDay()] === d ? 'selected' : ''}>${d}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                     <button id="delete-active-assign" class="flex-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 py-5 rounded-2xl font-black transition-all uppercase tracking-[0.2em] text-[10px] border border-red-200 dark:border-red-500/20 active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-trash-alt"></i> Eliminar
                     </button>
                     <button id="save-active-edit" class="flex-[2] bg-primary hover:bg-primary-light py-5 rounded-2xl text-white font-black shadow-xl shadow-primary/20 transition-all uppercase tracking-[0.2em] text-[10px] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> Guardar Cambios
                     </button>
                </footer>
            </div>
        `, (modal) => {

            modal.querySelector('#delete-active-assign').onclick = async () => {
                showCustomConfirm(`
                    <div class="text-left space-y-4">
                        <div class="flex items-center gap-4 text-red-600">
                             <div class="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-xl shadow-inner"><i class="fas fa-exclamation-triangle"></i></div>
                             <h4 class="font-black uppercase tracking-tight text-xl">¿Eliminar asignación?</h4>
                        </div>
                        <p class="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed uppercase tracking-wide">Esta acción liberará el territorio "${num}" y borrará la asignación actual sin enviarla al historial. Úselo con precaución.</p>
                        <div class="p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20">
                             <p class="text-[9px] text-red-600 dark:text-red-400 font-black uppercase tracking-widest italic text-center">⚠️ Esta acción es irreversible</p>
                        </div>
                    </div>
                 `, async () => {
                    try {
                        await cancelarAsignacion(id);
                        showNotification("Asignación eliminada correctamente", "success");
                        modal.classList.add('hidden');
                        reloadData();
                    } catch (e) {
                        showNotification("Error: " + e.message, "error");
                    }
                });
            };

            modal.querySelector('#save-active-edit').onclick = async (e) => {
                const btn = e.currentTarget;
                const newDate = modal.querySelector('#edit-asig-date').value;
                const newDateSalida = modal.querySelector('#edit-asig-date-salida').value;
                const newCond = modal.querySelector('#edit-asig-new-cond').value;

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

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...';
                try {
                    const finalFechaSalida = calculateSalidaDate(newDate, newDateSalida);

                    await updateAssignmentData(id, {
                        fecha_asignacion: newDate ? new Date(newDate + 'T12:00:00Z').toISOString() : t.fecha_asignacion,
                        fecha_salida: finalFechaSalida,
                        asignado_a: newCond,
                        auxiliar: modal.querySelector('#edit-asig-aux').value,
                        turno: modal.querySelector('#edit-asig-turno').value,
                        hora: modal.querySelector('#edit-asig-hora').value,
                        faceta: modal.querySelector('#edit-asig-faceta').value,
                        estado: t.estado
                    });
                    showNotification("Asignación actualizada correctamente", "success");
                    modal.closest('#modal-container').classList.add('hidden');
                    reloadData();
                } catch (err) {
                    showNotification("Error: " + err.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save mr-2"></i> Guardar Cambios';
                }
            };
        });
    };

    const handleHistory = (territoryId, territoryNum) => {
        const history = allHistory.filter(h => h.territorio_id === territoryId || h.numero === territoryNum)
            .sort((a, b) => new Date(b.fecha_asignacion || 0) - new Date(a.fecha_asignacion || 0));

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden shadow-2xl border border-transparent dark:border-white/5">
                <header class="shrink-0 flex items-center justify-between p-8 bg-white dark:bg-black/40 border-b border-slate-100 dark:border-white/5">
                    <button id="modal-back-btn" class="flex items-center gap-3 group px-4 py-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                        <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                             <i class="fas fa-arrow-left text-xs"></i>
                        </div>
                        <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-primary transition-colors">Volver</span>
                    </button>
                    
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Registro Maestro</span>
                        <h3 class="text-2xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">Territorio ${territoryNum}</h3>
                    </div>
                </header>
                
                <div class="flex-1 p-8 relative overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="space-y-6 max-w-2xl mx-auto pb-10">
                        ${history.length === 0 ? `
                            <div class="py-24 text-center">
                                <div class="w-24 h-24 bg-slate-200/50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center text-4xl mx-auto mb-6 text-slate-300 dark:text-slate-600">
                                    <i class="fas fa-scroll opacity-40"></i>
                                </div>
                                <p class="font-black uppercase tracking-[0.3em] text-[10px] text-slate-400">Sin registros históricos disponibles</p>
                            </div>
                        ` : history.map((h, index) => {
            const dateAsig = h.fecha_asignacion ? new Date(h.fecha_asignacion) : null;
            const dateEntrega = h.fecha_entrega ? new Date(h.fecha_entrega) : null;
            const isCurrent = !h.fecha_entrega && h.estado !== 'Completado' && h.estado !== 'Devuelto';

            return `
                            <div class="relative group">
                                <div class="modern-card !p-6 bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 hover:border-primary/30 transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-primary/5">
                                    <div class="flex justify-between items-start mb-6">
                                        <div class="flex items-center gap-5">
                                            <div class="w-14 h-14 rounded-2xl ${isCurrent ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-white/5 text-slate-400'} flex items-center justify-center text-2xl shadow-inner">
                                                <i class="fas ${isCurrent ? 'fa-bolt' : 'fa-user-check'}"></i>
                                            </div>
                                            <div>
                                                <h4 class="font-black text-slate-800 dark:text-white text-xl leading-none uppercase tracking-tight mb-2">${h.conductor}</h4>
                                                <div class="flex items-center gap-3">
                                                    ${isCurrent ?
                    '<span class="text-[9px] font-black text-primary bg-primary/10 px-2 py-1 rounded-md uppercase tracking-widest border border-primary/20">En Curso</span>' :
                    '<span class="text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md uppercase tracking-widest border border-slate-200 dark:border-white/10">Finalizado</span>'
                }
                                                    ${h.auxiliar ? `<div class="w-1 h-1 rounded-full bg-slate-300"></div> <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Apoyo: ${h.auxiliar}</span>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <span class="text-[9px] font-black text-slate-400 bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-white/5 uppercase tracking-widest">Registro #${history.length - index}</span>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-black/40 rounded-3xl border border-slate-100 dark:border-white/5">
                                        <div class="space-y-1">
                                            <span class="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">F. Asignación</span>
                                            <span class="text-[11px] font-black text-slate-700 dark:text-white uppercase">
                                                ${dateAsig ? dateAsig.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'}
                                            </span>
                                        </div>
                                        <div class="space-y-1 border-l border-slate-200 dark:border-white/10 pl-4">
                                            <span class="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">F. Devolución</span>
                                            <span class="text-[11px] font-black text-slate-700 dark:text-white uppercase">
                                                ${dateEntrega ? dateEntrega.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : (isCurrent ? '<span class="text-primary">Activo</span>' : '--')}
                                            </span>
                                        </div>
                                    </div>

                                    ${h.observaciones ? `
                                        <div class="mt-5 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                            <p class="text-[10px] text-primary/70 italic font-black uppercase tracking-wide leading-relaxed">"${h.observaciones}"</p>
                                        </div>
                                    ` : ''}

                                    <div class="flex justify-end gap-3 mt-6">
                                        <button onclick="window.actionEditHist('${h.id}')" class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-primary hover:bg-primary/10 border border-slate-200 dark:border-white/10 transition-all duration-300 group/btn shadow-sm">
                                            <i class="fas fa-edit text-sm group-hover/btn:scale-110"></i>
                                        </button>
                                        <button onclick="window.actionDeleteHistUI('${h.id}', '${h.conductor}', '${h.numero}')" class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 dark:border-white/10 transition-all duration-300 group/btn shadow-sm">
                                            <i class="fas fa-trash-alt text-sm group-hover/btn:scale-110"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `, null, 'max-w-2xl');

        setTimeout(() => {
            const backBtn = document.getElementById('modal-back-btn');
            if (backBtn) {
                backBtn.onclick = () => {
                    if (window.openGlobalHistory) window.openGlobalHistory();
                };
            }
        }, 0);
    };

    const showEditHistoryModal = async (recordId, sourceData = null) => {
        const historyList = sourceData || allHistory;
        const rec = historyList.find(r => r.id === recordId);
        if (!rec) {
            showNotification("Cargando datos del registro...", "info");
            const fullHist = await getHistorialReport();
            const freshRec = fullHist.find(r => r.id === recordId);
            if (!freshRec) return showNotification("No se encontró el registro", "error");
            return showEditHistoryModal(recordId, fullHist);
        }

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-history"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Editar Registro</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Identificador: ${rec.numero || 'T-ERR'}</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Conductor</label>
                             <input type="text" id="edit-h-cond" value="${rec.conductor}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase shadow-inner">
                        </div>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha Original</label>
                                <input type="date" id="edit-h-date" value="${rec.fecha_asignacion ? rec.fecha_asignacion.split("T")[0] : ""}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[11px] font-black text-primary outline-none focus:border-primary transition-all shadow-inner uppercase">
                            </div>

                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Estado del Registro</label>
                                <select id="edit-h-status" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase shadow-inner cursor-pointer appearance-none">
                                    <option value="Asignado" ${rec.estado === "Asignado" ? "selected" : ""}>Asignado (Activo)</option>
                                    <option value="Completado" ${rec.estado === "Completado" ? "selected" : ""}>Completado</option>
                                    <option value="Devuelto" ${rec.estado === "Devuelto" ? "selected" : ""}>Devuelto</option>
                                    <option value="Predicado" ${rec.estado === "Predicado" ? "selected" : ""}>Predicado</option>
                                </select>
                            </div>
                        </div>

                        <div class="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 space-y-4">
                            <label class="flex items-start gap-4 cursor-pointer group">
                                <div class="relative mt-1">
                                    <input type="checkbox" id="edit-h-sync" checked class="peer sr-only">
                                    <div class="w-6 h-6 rounded-lg border-2 border-slate-200 dark:border-white/10 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center text-white text-[10px]">
                                        <i class="fas fa-check"></i>
                                    </div>
                                </div>
                                <div class="flex-1">
                                    <span class="block text-[10px] font-black text-primary uppercase tracking-widest mb-1">Sincronizar Maestro actual</span>
                                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-wide leading-relaxed opacity-60">Si se activa, el estado actual del territorio "${rec.numero}" se actualizará para coincidir con este cambio histórico.</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-hist" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10 transition-all active:scale-95">
                        Cancelar
                    </button>
                    <button id="btn-save-hist" class="flex-[1.5] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> Guardar Cambios
                    </button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector("#btn-cancel-hist").onclick = () => modal.classList.add("hidden");
            modal.querySelector("#btn-save-hist").onclick = async (e) => {
                const btn = e.currentTarget;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...'; btn.disabled = true;
                try {
                    const newDate = modal.querySelector("#edit-h-date").value;
                    const newC = modal.querySelector("#edit-h-cond").value;
                    const newS = modal.querySelector("#edit-h-status").value;
                    const sync = modal.querySelector("#edit-h-sync").checked;
                    const payload = { conductor: newC, estado: newS };
                    if (newDate) payload.fecha_asignacion = new Date(newDate + 'T12:00:00Z').toISOString();
                    await updateHistoryRecord(recordId, payload);
                    if (sync && rec.territorio_id) {
                        const tUpdate = { asignado_a: newC, estado: newS };
                        if (newS !== 'Asignado') {
                            tUpdate.asignado_a = null;
                            tUpdate.fecha_asignacion = null;
                            tUpdate.estado = (newS === 'Completado' || newS === 'Predicado') ? 'Predicado' : newS;
                        }
                        await updateTerritorio(rec.territorio_id, tUpdate);
                    }
                    showNotification("Registro actualizado");
                    modal.classList.add("hidden");
                    await reloadData();
                    if (window.dispatchModuleSync) window.dispatchModuleSync();
                } catch (e) { showNotification(e.message, "error"); btn.innerText = "Error"; btn.disabled = false; }
            };
        });
    };

    const showDeleteHistoryModal = (recordId, cond, num, sourceData = null) => {
        showCustomConfirm(`
             <div class="text-left space-y-4">
                <div class="flex items-center gap-4 text-red-600">
                     <div class="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-xl shadow-inner"><i class="fas fa-trash-alt"></i></div>
                     <h4 class="font-black uppercase tracking-tight text-xl">¿Eliminar registro?</h4>
                </div>
                
                <p class="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed uppercase tracking-wide">
                    Estás a punto de borrar permanentemente el historial de <b>${cond}</b> para el territorio <b>${num}</b>.
                </p>

                <div class="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-100 dark:border-red-500/20">
                     <p class="text-[9px] text-red-600 dark:text-red-400 font-black uppercase tracking-widest italic text-center leading-normal">
                        <i class="fas fa-exclamation-triangle mr-1"></i> Esta acción no se puede deshacer y afectará las estadísticas.
                     </p>
                </div>

                <div class="p-5 bg-slate-50 dark:bg-black/20 rounded-[2rem] border border-slate-100 dark:border-white/5">
                    <label class="flex items-start gap-4 cursor-pointer group">
                        <div class="relative mt-1">
                            <input type="checkbox" id="del-h-reset-global" class="peer sr-only">
                            <div class="w-6 h-6 rounded-lg border-2 border-slate-200 dark:border-white/10 peer-checked:bg-red-500 peer-checked:border-red-500 transition-all flex items-center justify-center text-white text-[10px]">
                                <i class="fas fa-check"></i>
                            </div>
                        </div>
                        <div class="flex-1">
                            <span class="block text-[10px] font-black text-slate-700 dark:text-white uppercase tracking-widest mb-1">Liberar Territorio</span>
                            <p class="text-[8px] font-black text-slate-400 uppercase tracking-wide opacity-60">Si se activa, el territorio volverá a estar "Disponible" inmediatamente.</p>
                        </div>
                    </label>
                </div>
            </div>
        `, async () => {
            const resetTerr = document.getElementById("del-h-reset-global")?.checked;
            try {
                const historyList = sourceData || allHistory;
                const rec = historyList.find(r => r.id === recordId);
                await deleteHistoryRecord(recordId);
                if (resetTerr && rec && rec.territorio_id) {
                    await updateTerritorio(rec.territorio_id, { estado: "Disponible", asignado_a: null, fecha_asignacion: null, fecha_salida: null });
                }
                showNotification("Registro eliminado correctamente", "success");
                reloadData();
            } catch (e) { showNotification(e.message, "error"); }
        });
    };

    const handleTransfer = async (id, num, currentConductor) => {
        const t = territorios.find(x => x.id === id);
        if (!t) return;

        const allMzs = t.manzanas ? t.manzanas.split(',').map(m => m.trim()).filter(Boolean) : [];

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-exchange-alt"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Transferir Territorio</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">${num} • De ${currentConductor}</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="modern-card !p-6 bg-white dark:bg-white/5 border-primary/10 ring-1 ring-primary/5">
                        <div class="flex items-start gap-4 text-primary mb-6">
                            <div class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-lg shadow-inner"><i class="fas fa-info-circle"></i></div>
                            <p class="text-[11px] font-black uppercase tracking-wide leading-relaxed">
                                Se generará un registro de finalización para <b>${currentConductor}</b> y se abrirá una nueva asignación para el próximo responsable.
                            </p>
                        </div>
                        
                        ${allMzs.length > 0 ? `
                            <div class="space-y-4">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Área a Transferir (Manzanas)</label>
                                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    ${allMzs.map(mz => `
                                        <label class="flex items-center gap-3 p-3 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 cursor-pointer hover:border-primary/50 transition-all group overflow-hidden relative">
                                            <input type="checkbox" class="transfer-mz-check peer sr-only" value="${mz}" checked>
                                            <div class="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-white/10 peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center text-white text-[10px] transition-all">
                                                <i class="fas fa-check"></i>
                                            </div>
                                            <span class="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase truncate">${mz}</span>
                                        </label>
                                    `).join('')}
                                </div>
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest italic opacity-60"><i class="fas fa-hand-pointer mr-1"></i> Desmarca las áreas que ya se completaron.</p>
                            </div>
                        ` : ''}
                    </div>

                    <div class="space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Nuevo Responsable</label>
                            <select id="transfer-new-cond" class="w-full p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white hover:border-primary transition-all appearance-none cursor-pointer uppercase shadow-sm">
                                <option value="" disabled selected>Elegir nuevo conductor...</option>
                                ${conductores.sort((a, b) => a.nombre.localeCompare(b.nombre))
                .filter(c => c.nombre !== currentConductor)
                .map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                            </select>
                        </div>

                        <div class="grid grid-cols-2 gap-6 bg-white/50 dark:bg-black/40 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5">
                            <div class="space-y-2">
                                <label class="text-[8px] font-black text-slate-400 uppercase text-center block tracking-widest">Nueva Fecha Salida</label>
                                <input type="date" id="transfer-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-transparent text-[10px] font-black text-primary outline-none text-center">
                            </div>
                            <div class="space-y-2 border-l border-slate-200 dark:border-white/10">
                                <label class="text-[8px] font-black text-slate-400 uppercase text-center block tracking-widest">Turno</label>
                                <select id="transfer-turno" class="w-full bg-transparent text-[10px] font-black text-primary outline-none text-center appearance-none cursor-pointer uppercase">
                                    <option value="manana">🌅 Mañana</option>
                                    <option value="tarde" selected>☀️ Tarde</option>
                                    <option value="noche">🌙 Noche</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                    <button id="confirm-transfer" class="w-full py-5 bg-primary hover:bg-primary-light text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3">
                        <i class="fas fa-exchange-alt"></i> Confirmar Transferencia
                    </button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector('#confirm-transfer').onclick = async (e) => {
                const btn = e.currentTarget;
                const newCond = modal.querySelector('#transfer-new-cond').value;
                if (!newCond) return showNotification("Selecciona un nuevo conductor", "warning");

                const checks = modal.querySelectorAll('.transfer-mz-check:checked');
                const mzsToTransfer = Array.from(checks).map(c => c.value);

                if (allMzs.length > 0 && mzsToTransfer.length === 0) return showNotification("Debes transferir al menos una manzana", "warning");

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Procesando...';

                try {
                    await transferTerritorio(id, newCond, mzsToTransfer.join(', '), {
                    });

                    showNotification(`Territorio ${num} transferido con éxito`, "success");
                    modal.closest('#modal-container').classList.add('hidden');
                    reloadData();
                } catch (err) {
                    showNotification("Error: " + err.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-exchange-alt"></i> Confirmar Transferencia';
                }
            };
        });
    };

    window.actionDeleteHistUI = (id, c, n) => showDeleteHistoryModal(id, c, n);
    window.editHistoryRecord = (id) => showEditHistoryModal(id);
    window.deleteHistoryRecordUI = (id, c, n) => showDeleteHistoryModal(id, c, n);

    // --- EXPOSE GLOBAL HISTORY ---
    const handleGlobalHistory = async () => {
        const allTerrs = [...territorios].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

        showModal(`
            <div class="rounded-[2.5rem] overflow-hidden bg-white dark:bg-[#0a0f18] shadow-2xl max-w-4xl w-full border border-transparent dark:border-white/5">
                <header class="bg-primary p-10 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center justify-between">
                         <div class="flex items-center gap-6">
                            <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                                <i class="fas fa-scroll"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Registro Maestro</h3>
                                <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Control Histórico de Territorios</p>
                            </div>
                        </div>
                        <div class="hidden sm:flex flex-col items-end">
                             <span class="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Total Territorios</span>
                             <span class="text-4xl font-black">${allTerrs.length}</span>
                        </div>
                    </div>
                </header>
                
                <div class="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                    <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                        ${allTerrs.map(t => {
            const isAssigned = t.estado === 'Asignado' || t.estado === 'Pendiente';
            const tHistory = allHistory.filter(h => (h.territorio_id === t.id || h.numero === t.numero) && h.fecha_entrega)
                .sort((a, b) => new Date(b.fecha_entrega) - new Date(a.fecha_entrega));
            const lastDate = tHistory.length > 0 ? new Date(tHistory[0].fecha_entrega) : null;
            const dateStr = lastDate ? lastDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'LISTO';

            return `
                            <div class="relative group">
                                <button onclick="window.showUnifiedTerritoryHistory('${t.id}', '${t.numero}')" class="w-full aspect-[4/5] flex flex-col items-center justify-center rounded-[2rem] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3 hover:border-primary transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 overflow-hidden relative group">
                                    <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    
                                    ${isAssigned ? `<div class="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary ring-4 ring-primary/10 shadow-sm animate-pulse"></div>` : ''}
                                    
                                    <div class="relative z-10 flex flex-col items-center">
                                        <span class="text-[8px] font-black text-slate-400 group-hover:text-primary uppercase tracking-widest mb-1 transition-colors">T-${t.id.slice(-2)}</span>
                                        <span class="text-2xl font-black text-slate-800 dark:text-white group-hover:scale-110 transition-transform">${t.numero}</span>
                                    </div>
                                    
                                    <div class="mt-3 w-full relative z-10">
                                        <div class="h-px w-8 bg-slate-100 dark:bg-white/10 mx-auto mb-2 group-hover:w-12 transition-all"></div>
                                        <span class="block text-[8px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest text-center group-hover:text-slate-500 truncate">${dateStr}</span>
                                    </div>
                                    
                                    <button onclick="event.stopPropagation(); window.viewMapFromAdmin('${t.id}')" class="absolute inset-x-0 bottom-0 bg-primary text-white py-2 opacity-0 group-hover:opacity-100 transition-all translate-y-full group-hover:translate-y-0 flex items-center justify-center gap-1.5 font-black uppercase text-[8px] tracking-widest">
                                        <i class="fas fa-map-marked-alt text-[10px]"></i> Ver Mapa
                                    </button>
                                </button>
                            </div>
            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `, null, 'max-w-4xl');
    };
    window.openGlobalHistory = handleGlobalHistory;

    window.viewMapFromAdmin = async (id) => {
        showNotification("Cargando mapa...", "info");
        const terrs = await getTerritorios();
        const t = terrs.find(x => x.id === id);
        if (t) {
            if (window.openInteractiveMap) window.openInteractiveMap(t);
            else showNotification("MapViewer no inicializado", "error");
        }
    };

    window.actionHistory = async (id, num) => {
        try {
            // We use the local allHistory which is already synchronized with S-13 data.
            // This avoids extra network calls and the need for composite indices in Firestore.
            const history = allHistory.filter(h => {
                if (h.territorio_id === id) return true;
                if (h.numero) {
                    const nums = h.numero.toString().split(/[,/]/).map(n => n.trim().padStart(2, '0'));
                    const targetNum = num.toString().padStart(2, '0');
                    if (nums.includes(targetNum)) return true;
                }
                return false;
            });

            // Sort by date descending (using fecha_asignacion or timestamp)
            history.sort((a, b) => {
                const dateA = new Date(a.fecha_asignacion || a.timestamp?.toDate?.() || 0);
                const dateB = new Date(b.fecha_asignacion || b.timestamp?.toDate?.() || 0);
                return dateB - dateA;
            });

            showModal(`
                <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden shadow-2xl border border-transparent dark:border-white/5">
                    <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                         <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                         <div class="relative z-10 flex items-center gap-6">
                            <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                                <i class="fas fa-history"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Historial T-${num}</h3>
                                <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Cronología de Asignaciones</p>
                            </div>
                         </div>
                    </header>
                    
                    <div class="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                        ${history.length === 0 ? `
                            <div class="flex flex-col items-center justify-center h-full py-20 opacity-30 text-center space-y-6">
                                <div class="w-24 h-24 bg-slate-200/50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center text-4xl mx-auto mb-6 text-slate-300 dark:text-slate-600">
                                    <i class="fas fa-scroll opacity-40"></i>
                                </div>
                                <p class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Sin registros previos en el sistema</p>
                            </div>
                        ` : `
                            <div class="space-y-6 max-w-2xl mx-auto">
                                ${history.map(rec => {
                const dateVal = rec.fecha_salida || rec.fecha_asignacion;
                const fmtDate = dateVal ? new Date(dateVal).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                const isCompleted = rec.estado === 'Completado' || rec.estado === 'Predicado';

                return `
                                    <div class="modern-card !p-6 bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 hover:border-primary/30 transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-primary/5 group">
                                        <div class="flex justify-between items-start mb-6">
                                            <div class="flex items-center gap-5">
                                                <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                                                    <i class="fas fa-user-circle"></i>
                                                </div>
                                                <div>
                                                    <p class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none mb-2">${rec.conductor || 'Sin nombre'}</p>
                                                    <p class="text-[9px] text-primary font-black uppercase tracking-widest leading-none mt-1 opacity-60">${rec.faceta || 'Casa en Casa'}</p>
                                                </div>
                                            </div>
                                            <div class="text-right">
                                                <span class="px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200 dark:border-white/10">
                                                    ${fmtDate}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-slate-50 dark:bg-black/40 rounded-3xl border border-slate-100 dark:border-white/5">
                                            <div class="space-y-2">
                                                <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estado Final</p>
                                                <div class="flex items-center gap-2">
                                                    <span class="text-[11px] ${isCompleted ? 'text-emerald-500' : 'text-amber-500'} font-black uppercase flex items-center gap-2">
                                                        <i class="fas ${isCompleted ? 'fa-check-circle' : 'fa-clock'}"></i> ${rec.estado || 'Finalizado'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div class="space-y-2 border-l border-slate-200 dark:border-white/10 pl-5">
                                                <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fecha Reporte</p>
                                                <p class="text-[11px] font-black text-slate-700 dark:text-white uppercase">
                                                    ${rec.fecha_entrega ? new Date(rec.fecha_entrega).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'Pendiente'}
                                                </p>
                                            </div>
                                        </div>

                                        ${rec.observaciones ? `
                                            <div class="mt-5 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                                <p class="text-[10px] text-primary/70 italic font-black uppercase tracking-wider leading-relaxed">"${rec.observaciones}"</p>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
            }).join('')}
                            </div>
                        `}
                    </div>
                    
                    <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                         <button onclick="this.closest('#modal-container').classList.add('hidden')" class="w-full py-5 rounded-2xl bg-slate-50 dark:bg-white/5 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] shadow-sm hover:bg-slate-100 dark:hover:bg-white/10 transition-all border border-slate-200 dark:border-white/10 active:scale-95">
                            Cerrar Historial
                         </button>
                    </footer>
                </div>
            `, null, 'max-w-2xl');
        } catch (e) {
            console.error(e);
            showNotification("Error cargando historial: " + e.message, "error");
        }

    };

    window.showTerritoryHistoryAdmin = async (id, num) => {
        const loadHistory = async () => {
            try {
                const history = await getTerritoryHistory(id);
                const config = await getConfiguracion();
                const allPublicadores = await getPublicadores();
                renderModal(history, config, allPublicadores);
            } catch (e) {
                console.error(e);
                showNotification("Error: " + e.message, "error");
            }
        };

        const renderModal = (history, config, allPublicadores) => {
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
                const isCompleted = rec.estado === 'Completado' || rec.estado === 'Predicado';

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
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `, (modal) => {
                modal.querySelector('#admin-add-history').onclick = () => window.openHistoryEditor(null, id, num);
            }, 'max-w-3xl');
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
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Evidencia Fotográfica (Marcados)</label>
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
                        modal.classList.add('hidden');
                        if (window.showUnifiedTerritoryHistory) window.showUnifiedTerritoryHistory(territoryId, territoryNum);
                        else window.showTerritoryHistoryAdmin(territoryId, territoryNum);
                    } catch (e) {
                        showNotification(e.message, "error");
                        btn.disabled = false;
                        btn.innerHTML = 'Guardar Cambios';
                    }
                };
            }, 'max-w-2xl');
        };

        window.editHistoryEntry = (recId, territoryId, territoryNum) => window.openHistoryEditor(recId, territoryId, territoryNum);

        window.deleteHistoryEntry = (recId, territoryId, territoryNum) => {
            showCustomConfirm("¿Seguro que quieres eliminar este registro del historial?", async () => {
                await deleteHistoryRecord(recId);
                showNotification("Registro eliminado");
                if (window.showUnifiedTerritoryHistory) window.showUnifiedTerritoryHistory(territoryId, territoryNum);
                else window.showTerritoryHistoryAdmin(territoryId, territoryNum);
            });
        };

        loadHistory();
    };

    const renderMain = () => {
        container.innerHTML = `
            <div class="space-y-8 animate-fade-in px-2">
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <!-- Nueva Asignación Card -->
                    <button id="hub-btn-assign" class="group relative bg-white dark:bg-[#121212]/40 backdrop-blur-3xl overflow-hidden p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_60px_-10px_rgba(59,130,246,0.3)]">
                        <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/10 blur-[60px] rounded-full group-hover:bg-primary/30 transition-all duration-700"></div>
                        <div class="flex items-center gap-4 md:gap-6">
                            <div class="w-12 h-12 md:w-16 md:h-16 rounded-[1.2rem] md:rounded-[1.5rem] bg-primary flex items-center justify-center text-2xl md:text-3xl text-white group-hover:scale-110 group-hover:rotate-6 transition-all shadow-lg shadow-primary/30">
                                <i class="fas fa-plus"></i>
                            </div>
                            <div class="text-left">
                                <p class="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-0.5 md:mb-1">Operación</p>
                                <p class="text-lg md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Nueva Asignación</p>
                            </div>
                        </div>
                    </button>
                    <!-- Devolver Territorios Card -->
                    <button id="hub-btn-return" class="group relative bg-white dark:bg-[#121212]/40 backdrop-blur-3xl overflow-hidden p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_60px_-10px_rgba(244,63,94,0.3)]">
                        <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-rose-600/10 blur-[60px] rounded-full group-hover:bg-rose-600/30 transition-all duration-700"></div>
                        <div class="flex items-center gap-4 md:gap-6">
                            <div class="w-12 h-12 md:w-16 md:h-16 rounded-[1.2rem] md:rounded-[1.5rem] bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-2xl md:text-3xl text-white group-hover:scale-110 group-hover:-rotate-6 transition-all shadow-lg shadow-rose-500/30">
                                <i class="fas fa-file-import"></i>
                            </div>
                            <div class="text-left relative">
                                <p class="text-[8px] md:text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] mb-0.5 md:mb-1">Recepción</p>
                                <p class="text-lg md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Devolver Territorios</p>
                                ${selectedIds.size > 0 ? `<div class="absolute -top-3 -right-8 md:-top-4 md:-right-12 bg-rose-600 text-white w-6 h-6 md:w-8 md:h-8 rounded-full text-[10px] md:text-xs font-black flex items-center justify-center animate-bounce shadow-lg ring-4 ring-white dark:ring-[#121212]">${selectedIds.size}</div>` : ''}
                            </div>
                        </div>
                    </button>
                </div>

                <div class="flex flex-col md:flex-row justify-between items-center gap-6 bg-white/40 dark:bg-black/20 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-lg">
                     <div class="flex items-center gap-5">
                        <div class="flex flex-col">
                            <h2 class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1" id="hub-view-title">MAPA DE TERRITORIOS</h2>
                            <div id="view-stats" class="text-[11px] font-black text-primary flex flex-wrap items-center gap-3"></div>
                        </div>
                     </div>
                     
                     <div class="relative w-full md:w-80 group">
                         <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-primary">
                            <i class="fas fa-search text-xs"></i>
                         </span>
                         <input type="text" id="search-assigns" placeholder="Buscar por número o publicador..." class="w-full pl-12 pr-5 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner placeholder-slate-500">
                     </div>
                </div>

                <div id="assigns-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in pb-20"></div>
            </div>

            ${selectedIds.size > 0 ? `
                <div class="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] animate-bounce-in">
                    <div class="bg-slate-900/95 backdrop-blur-2xl border border-white/20 rounded-3xl p-3 shadow-2xl flex items-center gap-3 ring-[12px] ring-black/5">
                        <div class="px-6 py-2 border-r border-white/10">
                            <p class="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1.5">Seleccionados</p>
                            <p class="text-2xl font-black text-white leading-none">${selectedIds.size}</p>
                        </div>
                        
                        <div class="flex items-center gap-2">
                            <button id="fab-delete" class="flex items-center gap-3 px-6 py-4 rounded-2xl hover:bg-red-500/20 text-red-500 transition-all group">
                                 <i class="fas fa-trash-alt text-lg group-hover:scale-110 transition-transform"></i>
                                 <span class="text-[10px] font-black uppercase tracking-widest hidden sm:block">Eliminar</span>
                            </button>
                            
                            <button id="fab-complete" class="flex items-center gap-4 px-8 py-4 bg-primary hover:bg-primary-light text-white rounded-2xl shadow-xl shadow-primary/20 transition-all group active:scale-95">
                                 <i class="fas fa-check-double text-lg group-hover:rotate-12 transition-transform"></i>
                                 <span class="text-[10px] font-black uppercase tracking-widest">Devolver</span>
                            </button>
    
                            <button id="fab-clear" class="w-12 h-12 hover:bg-white/10 text-white/40 hover:text-white rounded-2xl transition-all flex items-center justify-center">
                                 <i class="fas fa-times text-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;

        if (selectedIds.size > 0) {
            container.querySelector('#fab-delete').onclick = () => {
                showCustomConfirm(`
                    <div class="text-left space-y-4">
                        <div class="flex items-center gap-4 text-red-600">
                             <div class="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-xl shadow-inner"><i class="fas fa-trash-alt"></i></div>
                             <h4 class="font-black uppercase tracking-tight text-xl">¿Eliminar selección?</h4>
                        </div>
                        <p class="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed uppercase tracking-wide">Estás a punto de eliminar <b>${selectedIds.size}</b> asignaciones. Esta acción no se puede deshacer.</p>
                    </div>
                `, async () => {
                    try {
                        for (const id of selectedIds) {
                            await cancelarAsignacion(id);
                        }
                        showNotification(`${selectedIds.size} asignaciones eliminadas`, "success");
                        selectedIds.clear();
                        reloadData();
                    } catch (e) {
                        showNotification("Error: " + e.message, "error");
                    }
                });
            };
            container.querySelector('#fab-complete').onclick = () => handleBulkReturn();
            container.querySelector('#fab-clear').onclick = () => {
                selectedIds.clear();
                renderMain();
            };
        }


        container.querySelector('#hub-btn-assign').onclick = () => handleNewAssignment();
        container.querySelector('#hub-btn-return').onclick = () => handleBulkReturn();

        const search = container.querySelector('#search-assigns');
        search.oninput = () => renderGrid();

        renderGrid();
    };

    const renderGrid = () => {
        const grid = container.querySelector('#assigns-grid');
        const search = container.querySelector('#search-assigns');
        const stats = container.querySelector('#view-stats');
        if (!grid) return;

        const query = search ? search.value.toLowerCase() : '';

        let items = [...territorios].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

        // Filter for "Active" view: Only show Assigned or Pendiente
        if (currentView === 'activas' && !query) {
            items = items.filter(t => t.estado === 'Asignado' || t.estado === 'Pendiente');
        }

        const filtered = items.filter(t => {
            const num = (t.numero || '').toString();
            const cond = (t.asignado_a || t.conductor || '').toLowerCase();
            const camp = (t.campana || '').toLowerCase();
            return num.includes(query) || cond.includes(query) || camp.includes(query);
        });

        const activeCount = territorios.filter(t => t.estado === 'Asignado').length;
        const availableCount = territorios.length - activeCount;

        stats.innerHTML = `
            <span class="opacity-40 font-mono tracking-tighter">${filtered.length} / ${territorios.length}</span>
            <span class="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/10"></span>
            <span class="text-primary uppercase tracking-widest text-[10px] flex items-center gap-2"><i class="fas fa-bolt-lightning text-[9px]"></i> ${activeCount} ACTIVOS</span>
            <span class="text-emerald-500 uppercase tracking-widest text-[10px] flex items-center gap-2"><i class="fas fa-map text-[9px]"></i> ${availableCount} LIBRES</span>
        `;

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-40 text-center space-y-4 opacity-30 group">
                    <div class="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center text-3xl mx-auto group-hover:scale-110 transition-transform"><i class="fas fa-search"></i></div>
                    <p class="font-black text-[10px] uppercase tracking-[0.4em]">Nada que mostrar</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(item => {
            const isSelected = selectedIds.has(item.id);
            const num = item.numero;
            const isAssigned = item.estado === 'Asignado' || item.estado === 'Pendiente';

            return `
                <div class="relative group cursor-pointer transition-all duration-300" onclick="window.actionToggleSelect('${item.id}')">
                     <!-- Card Body -->
                     <div class="bg-white dark:bg-[#151515] rounded-[2.5rem] p-6 border ${isSelected ? 'border-primary ring-4 ring-primary/10' : 'border-slate-100 dark:border-white/5'} shadow-sm hover:shadow-2xl transition-all flex flex-col justify-between h-52 relative overflow-hidden group/card shadow-primary/5">
                        
                        <!-- Status & Number -->
                        <div class="flex justify-between items-start z-10">
                            <div class="w-14 h-14 rounded-2xl ${isAssigned ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-500'} flex items-center justify-center text-2xl font-black shadow-inner">
                                ${num}
                            </div>
                            
                            <div class="flex flex-col items-end">
                                <span class="text-[9px] font-black uppercase tracking-widest ${isAssigned ? 'text-primary' : 'text-emerald-500'} mb-1 opacity-90">${isAssigned ? 'ASIGNADO' : 'LIBRE'}</span>
                                ${isSelected ? '<span class="text-xl text-primary animate-bounce-in"><i class="fas fa-check-circle"></i></span>' : ''}
                            </div>
                        </div>
                        
                        <!-- Info Content -->
                        <div class="z-10 mt-3">
                             ${isAssigned ? `
                                <p class="text-[9px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-1.5">Responsable</p>
                                <p class="text-base font-black text-slate-800 dark:text-white leading-tight line-clamp-2 uppercase tracking-tight">${item.asignado_a}</p>
                                ${item.fecha_salida ? `
                                    <div class="mt-3 flex items-center gap-2">
                                        <div class="px-3 py-1 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10 flex items-center gap-2">
                                            <i class="far fa-calendar-alt text-[10px] text-primary/60"></i>
                                            <span class="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">${new Date(item.fecha_salida).toLocaleDateString("es-ES", { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                                        </div>
                                    </div>
                                ` : ''}
                             ` : `
                                <div class="h-full flex flex-col justify-end opacity-40">
                                    <p class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest italic opacity-80">Disponible para asignar</p>
                                </div>
                             `}
                        </div>

                        <!-- Hover Actions -->
                        <div class="absolute bottom-6 right-6 z-20 opacity-0 group-hover/card:opacity-100 transition-all translate-y-2 group-hover/card:translate-y-0 flex gap-2">
                             <button onclick="event.stopPropagation(); window.viewMapFromAdmin('${item.id}')" class="w-10 h-10 bg-primary text-white rounded-xl shadow-xl shadow-primary/20 hover:scale-110 transition-transform flex items-center justify-center" title="Ver Mapa">
                                <i class="fas fa-map-marked-alt text-xs"></i>
                             </button>
                             ${isAssigned ? `
                                <button onclick="event.stopPropagation(); window.actionTransfer('${item.id}', '${num}', '${item.asignado_a}')" class="w-10 h-10 bg-white dark:bg-[#222] text-slate-600 dark:text-white rounded-xl shadow-lg border border-slate-100 dark:border-white/10 hover:scale-110 transition-transform flex items-center justify-center" title="Transferir">
                                    <i class="fas fa-exchange-alt text-xs"></i>
                                </button>
                             ` : ''}
                             <button onclick="event.stopPropagation(); window.actionEditActive('${item.id}', '${num}', '${item.asignado_a || ''}')" class="w-10 h-10 bg-white dark:bg-[#222] text-slate-600 dark:text-white rounded-xl shadow-lg border border-slate-100 dark:border-white/10 hover:scale-110 transition-transform flex items-center justify-center" title="Editar">
                                <i class="fas fa-edit text-xs"></i>
                             </button>
                        </div>
                        
                        <!-- Decoration -->
                        <div class="absolute -right-8 -bottom-8 w-24 h-24 rounded-full blur-[30px] ${isAssigned ? 'bg-primary/5' : 'bg-emerald-500/5'} pointer-events-none group-hover/card:scale-150 transition-transform duration-700"></div>
                     </div>
                </div>
            `;
        }).join('');
    };

    renderMain();
};

// --- Render Config Tab (Restored) ---
const renderConfigTab = async (container, initialSub = 'reglas', appVersion) => {
    container.innerHTML = `
        <div class="space-y-8 animate-fade-in px-2">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 p-2">
                <div>
                    <h2 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Configuración del Sistema</h2>
                    <p class="text-[10px] text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-[0.3em] mt-1 ml-1">Ajustes globales y gestión técnica</p>
                </div>
                <div class="px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    v${appVersion}
                </div>
            </header>

            <!-- 2026 Settings Sub Navigation -->
            <nav class="flex flex-wrap items-center gap-2 bg-white/50 dark:bg-white/[0.03] p-2 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm backdrop-blur-xl mb-8">
                <button class="conf-nav-btn group px-4 md:px-5 py-3 rounded-xl transition-all flex items-center gap-3" data-sub="reglas">
                    <i class="fas fa-ruler"></i>
                    <span class="text-[10px] md:text-[11px] font-bold uppercase tracking-wider">Reglas</span>
                </button>
                <button class="conf-nav-btn group px-4 md:px-5 py-3 rounded-xl transition-all flex items-center gap-3" data-sub="s12">
                    <i class="fas fa-map"></i>
                    <span class="text-[10px] md:text-[11px] font-bold uppercase tracking-wider">S-12</span>
                </button>
                <button class="conf-nav-btn group px-4 md:px-5 py-3 rounded-xl transition-all flex items-center gap-3" data-sub="personal">
                    <i class="fas fa-users"></i>
                    <span class="text-[10px] md:text-[11px] font-bold uppercase tracking-wider">Personal</span>
                </button>
                <button class="conf-nav-btn group px-4 md:px-5 py-3 rounded-xl transition-all flex items-center gap-3" data-sub="grupos">
                    <i class="fas fa-layer-group"></i>
                    <span class="text-[10px] md:text-[11px] font-bold uppercase tracking-wider">Grupos</span>
                </button>
                <button class="conf-nav-btn group px-4 md:px-5 py-3 rounded-xl transition-all flex items-center gap-3" data-sub="campanas">
                    <i class="fas fa-flag-checkered"></i>
                    <span class="text-[10px] md:text-[11px] font-bold uppercase tracking-wider">Campañas</span>
                </button>
                <button class="conf-nav-btn group px-4 md:px-5 py-3 rounded-xl transition-all flex items-center gap-3" data-sub="difusion">
                    <i class="fas fa-bullhorn"></i>
                    <span class="text-[10px] md:text-[11px] font-bold uppercase tracking-wider">Difusión</span>
                </button>
                <button class="conf-nav-btn group px-4 md:px-5 py-3 rounded-xl transition-all flex items-center gap-3" data-sub="mantenimiento">
                    <i class="fas fa-tools"></i>
                    <span class="text-[10px] md:text-[11px] font-bold uppercase tracking-wider">Mantenimiento</span>
                </button>
            </nav>

            <div id="config-content" class="min-h-[500px] relative">
                 <!-- Contenido dinámico -->
            </div>
        </div>
    `;

    const btns = container.querySelectorAll('.conf-nav-btn');
    const content = container.querySelector('#config-content');

    const load = async (sub) => {
        // Shimmer loading
        content.innerHTML = `
            <div class="p-10 flex flex-col items-center justify-center space-y-4 opacity-20">
                <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p class="text-[10px] font-black uppercase tracking-[0.4em]">Sincronizando Ajustes...</p>
            </div>
        `;

        btns.forEach(b => {
            const isActive = b.dataset.sub === sub;
            if (isActive) {
                b.className = "conf-nav-btn active group px-5 py-3 rounded-xl bg-primary dark:bg-primary text-white shadow-lg shadow-primary/20 transition-all flex items-center gap-3 scale-105 z-10 font-bold";
            } else {
                b.className = "conf-nav-btn group px-5 py-3 rounded-xl text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary-light hover:bg-white/80 dark:hover:bg-white/5 transition-all flex items-center gap-3";
            }
        });
        await loadSubTab(sub, content, await getConfiguracion(), appVersion);
    };

    btns.forEach(b => b.onclick = () => load(b.dataset.sub));
    load(initialSub);
};

const renderS12View = async (container, config, appVersion) => {
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
        const stats = document.getElementById('s12-stats');

        const filtered = territorios
            .filter(t => t.numero.toString().includes(query))
            .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));

        stats.innerHTML = `<span class="opacity-60">${filtered.length} territorios encontrados</span>`;

        grid.innerHTML = filtered.map(t => `
            <div class="bg-white dark:bg-[#151515] rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/5 relative group shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col h-full">
                <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                
                <!-- Mini Actions Overlay -->
                <div class="absolute top-4 right-4 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:translate-x-4 lg:group-hover:translate-x-0 transition-all z-20">
                     <button class="w-10 h-10 bg-white dark:bg-[#222] text-amber-500 rounded-xl shadow-lg border border-slate-100 dark:border-white/10 hover:scale-110 transition-transform flex items-center justify-center active:scale-95" onclick="window.showUnifiedTerritoryHistory('${t.id}', '${t.numero}')" title="Ver Historial">
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

    document.getElementById('btn-add-territorio').addEventListener('click', () => {
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

            document.getElementById('save-new-territorio').addEventListener('click', async () => {
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
                    modal.classList.add('hidden');
                    renderS12View(container, config, appVersion);
                    showNotification("Territorio creado exitosamente");
                } catch (err) {
                    console.error(err);
                    showNotification("Error al guardar", "error");
                    btn.textContent = "Guardar Territorio"; btn.disabled = false;
                }
            });
        });
    });

    window.deleteTerritorio = async (id) => {
        showCustomConfirm('¿Eliminar esté territorio?', async () => {
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
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-map-marked-alt"></i>
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
                                    <div class="flex flex-col min-w-0">
                                        <span id="file-name-edit" class="text-[10px] text-slate-500 font-black uppercase truncate">Mantener actual</span>
                                    </div>
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
                    modal.classList.add('hidden');
                    renderS12View(container, config, appVersion);
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

const loadSubTab = async (subTab, container, config, appVersion) => {
    container.innerHTML = '<div class="animate-pulse flex space-x-4"><div class="h-4 bg-white/10 rounded w-3/4"></div></div>';

    if (subTab === 'reglas') {
        container.innerHTML = `
            <div class="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
                <!-- Header Section -->
                <div class="flex items-center gap-6 mb-10">
                    <div class="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center text-2xl text-white shadow-xl shadow-teal-500/20 transform -rotate-3">
                        <i class="fas fa-sliders-h"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Parámetros del Sistema</h3>
                        <p class="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-[0.3em] mt-1">Configuración Maestra de la Congregación</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <!-- Left Column: Identity -->
                    <div class="space-y-8">
                        <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden">
                            <div class="absolute -right-16 -top-16 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl"></div>
                            <header class="flex items-center gap-3 mb-6">
                                <i class="fas fa-id-card text-teal-500 text-sm"></i>
                                <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Identidad Local</h4>
                            </header>

                            <div class="space-y-5">
                                <div class="relative group/input">
                                    <label class="label-premium">Nombre de la Congregación</label>
                                    <div class="relative">
                                        <input type="text" id="conf-nombre" value="${config.congregacion?.nombre || ''}" 
                                            class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 dark:text-white"
                                            placeholder="Ej. Nueve de Octubre">
                                        <i class="fas fa-briefcase absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-white/10 opacity-0 group-focus-within/input:opacity-100 transition-opacity"></i>
                                    </div>
                                </div>

                                <div class="relative group/input">
                                    <label class="label-premium">Número de Congregación</label>
                                    <div class="relative">
                                        <input type="text" id="conf-numero" value="${config.congregacion?.numero || ''}" 
                                            class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 dark:text-white"
                                            placeholder="Ej. 14282">
                                        <i class="fas fa-hashtag absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-white/10 opacity-0 group-focus-within/input:opacity-100 transition-opacity"></i>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden">
                            <div class="absolute -left-16 -bottom-16 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl"></div>
                            <header class="flex items-center gap-3 mb-6">
                                <i class="fas fa-brain text-indigo-500 text-sm"></i>
                                <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Inteligencia Artificial</h4>
                            </header>

                            <div class="relative group/input">
                                <label class="label-premium flex items-center justify-between">
                                    Google Gemini API Key
                                    <span class="text-[8px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded uppercase tracking-tighter">Recomendado</span>
                                </label>
                                <div class="relative">
                                    <input type="password" id="gemini-key" value="${config.gemini_key || ''}" 
                                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-xs font-mono shadow-inner outline-none focus:border-indigo-500 transition-all text-slate-800 dark:text-white"
                                        placeholder="AIzaSy...">
                                    <button class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors" onclick="const p=this.previousElementSibling; p.type=p.type==='password'?'text':'password'">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                                <p class="text-[9px] text-slate-400 mt-3 ml-1 leading-relaxed italic">Habilita el asistente virtual en los paneles de control para análisis predictivo y sugerencias inteligentes.</p>
                            </div>
                        </section>
                    </div>

                    <!-- Right Column: Ministry Config -->
                    <div class="space-y-8">
                        <section class="modern-card group border-slate-200 dark:border-white/5 shadow-xl">
                            <header class="flex items-center gap-3 mb-6">
                                <i class="fas fa-calendar-check text-emerald-500 text-sm"></i>
                                <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Planificación de Ministerio</h4>
                            </header>

                            <div class="space-y-6">
                                <!-- Dynamic List for Schedules -->
                                <div class="relative group/input">
                                    <label class="label-premium flex items-center justify-between">
                                        Horarios de Salida
                                        <button class="text-[9px] text-emerald-500 hover:underline" onclick="window.addConfigItem('horarios')">+ Añadir</button>
                                    </label>
                                    <div id="list-horarios" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                        ${(config.horarios_programa || []).map((h, i) => `
                                            <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in">
                                                ${h}
                                                <button onclick="window.removeConfigItem('horarios', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>

                                <!-- Dynamic List for Places -->
                                <div class="relative group/input">
                                    <label class="label-premium flex items-center justify-between">
                                        Lugares de Reunión
                                        <button class="text-[9px] text-emerald-500 hover:underline" onclick="window.addConfigItem('lugares')">+ Añadir</button>
                                    </label>
                                    <div id="list-lugares" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                        ${(config.lugares || []).map((l, i) => `
                                            <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in">
                                                ${l}
                                                <button onclick="window.removeConfigItem('lugares', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>

                                <!-- Dynamic List for Facets -->
                                <div class="relative group/input">
                                    <label class="label-premium flex items-center justify-between">
                                        Facetas de Predicación
                                        <button class="text-[9px] text-emerald-500 hover:underline" onclick="window.addConfigItem('facetas')">+ Añadir</button>
                                    </label>
                                    <div id="list-facetas" class="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[60px]">
                                        ${(config.facetas || []).map((f, i) => `
                                            <div class="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 shadow-sm animate-scale-in">
                                                ${f}
                                                <button onclick="window.removeConfigItem('facetas', ${i})" class="text-slate-400 hover:text-red-500 transition-colors"><i class="fas fa-times"></i></button>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <!-- Action Bar -->
                <div class="sticky bottom-8 left-0 right-0 z-50 flex justify-center px-4">
                    <div class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl px-6 py-4 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl flex items-center gap-10">
                        <div class="hidden sm:flex flex-col">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado de Sincronización</span>
                            <span class="text-[10px] font-bold text-emerald-500 flex items-center gap-1.5 uppercase">
                                <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Servidor en línea
                            </span>
                        </div>
                        <div class="h-8 w-px bg-slate-200 dark:bg-white/10 hidden sm:block"></div>
                        <button id="save-reglas" class="bg-slate-900 dark:bg-teal-600 hover:bg-teal-500 dark:hover:bg-teal-500 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-teal-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                            <i class="fas fa-cloud-upload-alt"></i> Aplicar Cambios
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Helper functions for dynamic lists
        window.addConfigItem = (type) => {
            const labels = { horarios: 'Horario (ej. 09:00AM)', lugares: 'Lugar', facetas: 'Faceta' };
            showCustomPrompt(`Añadir ${labels[type]}:`, "", (val) => {
                if (!val) return;
                if (type === 'horarios') {
                    const newList = [...(config.horarios_programa || []), val];
                    // Smart Sort for AM/PM times
                    const toMinutes = (s) => {
                        const match = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
                        if (!match) return 0;
                        let h = parseInt(match[1]);
                        const m = parseInt(match[2]);
                        const p = (match[3] || 'AM').toUpperCase();
                        if (p === 'PM' && h < 12) h += 12;
                        if (p === 'AM' && h === 12) h = 0;
                        return h * 60 + m;
                    };
                    config.horarios_programa = newList.sort((a, b) => toMinutes(a) - toMinutes(b));
                }
                if (type === 'lugares') config.lugares = [...(config.lugares || []), val];
                if (type === 'facetas') config.facetas = [...(config.facetas || []), val];
                loadSubTab('reglas', container, config, appVersion);
            });
        };

        window.removeConfigItem = (type, index) => {
            if (type === 'horarios') config.horarios_programa.splice(index, 1);
            if (type === 'lugares') config.lugares.splice(index, 1);
            if (type === 'facetas') config.facetas.splice(index, 1);
            loadSubTab('reglas', container, config, appVersion);
        };

        container.querySelector('#save-reglas').onclick = async () => {
            const btn = container.querySelector('#save-reglas');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
            btn.disabled = true;

            try {
                config.congregacion = {
                    nombre: document.getElementById('conf-nombre').value.trim(),
                    numero: document.getElementById('conf-numero').value.trim()
                };
                config.gemini_key = document.getElementById('gemini-key').value.trim();
                // Lists are already updated in the 'config' object by helper functions

                await saveConfiguracion(config);

                showNotification("Configuración de la congregación guardada con éxito", "success");
                loadSubTab('reglas', container, config, appVersion);
            } catch (e) {
                console.error(e);
                showNotification("Error al guardar: " + e.message, "error");
            } finally {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        };


    } else if (subTab === 'campanas') {
        const list = await getCampanas();
        container.innerHTML = `
    <div class="p-8 max-w-5xl animate-fade-in bg-white dark:bg-[#0f1115] rounded-[2.5rem] border border-slate-100 dark:border-white/10 shadow-2xl m-4 overflow-hidden relative">
                <div class="absolute -right-20 -top-20 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full pointer-events-none"></div>
                
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6 relative z-10">
                    <div>
                        <h3 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-5 uppercase tracking-tighter">
                            <div class="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 shadow-inner">
                                <i class="fas fa-flag-checkered"></i>
                            </div>
                            Gestión de Campañas
                        </h3>
                        <p class="text-[10px] text-slate-400 uppercase tracking-[0.4em] font-black mt-2 ml-1">Eventos especiales y ministerio intensivo</p>
                    </div>
                    <button id="add-campana" class="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-plus-circle"></i> Nueva Campaña
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                    ${list.length === 0 ? `
                        <div class="col-span-full py-32 text-center space-y-4 opacity-30">
                            <div class="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center text-3xl mx-auto"><i class="fas fa-scroll"></i></div>
                            <p class="font-black text-[10px] uppercase tracking-[0.4em]">Sin campañas activas</p>
                        </div>
                    ` : ''}
                    ${list.map(c => `
                        <div class="bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5 flex justify-between items-center group hover:border-red-500/30 transition-all shadow-sm">
                            <span class="font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight text-sm">${c}</span>
                            <button onclick="window.actionDeleteCampana('${c}')" class="w-10 h-10 bg-white dark:bg-[#1a1a1a] text-red-500 rounded-xl shadow-md border border-slate-100 dark:border-white/10 hover:scale-110 transition-transform flex items-center justify-center" title="Eliminar">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
    `;
        container.querySelector('#add-campana').onclick = async () => {
            showCustomPrompt("Nombre de la nueva campaña:", "", async (name) => {
                await saveCampana(name);
                loadSubTab('campanas', container, config, appVersion);
            });
        };
        window.actionDeleteCampana = async (c) => {
            showCustomConfirm(`¿Borrar la campaña "${c}" ? Los registros históricos no se verán afectados.`, async () => {
                await deleteCampana(c);
                loadSubTab('campanas', container, config, appVersion);
            });
        };
    } else if (subTab === 'difusion') {
        const diffusion = await getDiffusionMessage();
        container.innerHTML = `
    <div class="max-w-2xl mx-auto space-y-10 animate-fade-in p-10 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-2xl mt-6 relative overflow-hidden">
                <div class="absolute -left-20 -bottom-20 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none"></div>

                <div class="flex items-center gap-6 mb-2 relative z-10">
                    <div class="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-3xl shadow-inner border border-blue-500/10 text-blue-500 transition-transform hover:rotate-12 duration-500">
                        <i class="fas fa-bullhorn"></i>
                    </div>
                    <div>
                        <h3 class="text-3xl font-black tracking-tighter text-slate-800 dark:text-white uppercase leading-none mb-2">Sistema de Difusión</h3>
                        <p class="text-[10px] text-slate-500 uppercase tracking-[0.4em] font-black">Comunicación Masiva Directa</p>
                    </div>
                </div>

                <div class="space-y-8 relative z-10">
                    <div class="space-y-3">
                        <label class="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Contenido del Mensaje</label>
                        <textarea id="diff-content" placeholder="Escribe el anuncio para todos los conductores..." class="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 text-sm font-bold min-h-[140px] outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all shadow-inner dark:text-white">${diffusion?.content || ''}</textarea>
                    </div>

                    <div class="space-y-4">
                        <label class="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Prioridad del Anuncio</label>
                        <div class="grid grid-cols-2 gap-6">
                            <button class="diff-type-btn p-6 rounded-2xl border-2 transition-all font-black uppercase tracking-widest flex flex-col items-center gap-3 ${diffusion?.type !== 'urgent' ? 'border-primary/50 bg-primary/10 text-primary shadow-lg shadow-primary/10' : 'border-slate-100 dark:border-white/5 opacity-40 hover:opacity-70'}" data-type="info">
                                <i class="fas fa-info-circle text-2xl"></i>
                                <span class="text-[10px]">Informativo</span>
                            </button>
                            <button class="diff-type-btn p-6 rounded-2xl border-2 transition-all font-black uppercase tracking-widest flex flex-col items-center gap-3 ${diffusion?.type === 'urgent' ? 'border-rose-500/50 bg-rose-500/10 text-rose-500 shadow-lg shadow-rose-500/10' : 'border-slate-100 dark:border-white/5 opacity-40 hover:opacity-70'}" data-type="urgent">
                                <i class="fas fa-exclamation-triangle text-2xl"></i>
                                <span class="text-[10px]">Urgente</span>
                            </button>
                        </div>
                    </div>

                    <div class="pt-8 border-t border-slate-100 dark:border-white/5 flex gap-4">
                        <button id="btn-save-diffusion" class="flex-1 bg-primary hover:bg-primary-light text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-[0.25em] text-[11px] flex items-center justify-center gap-3">
                            <i class="fas fa-broadcast-tower"></i> Publicar Anuncio
                        </button>
                        ${diffusion?.active ? `
                            <button id="btn-stop-diffusion" class="px-8 bg-slate-100 dark:bg-white/5 text-rose-500 font-black rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all uppercase tracking-widest text-[10px]">
                                <i class="fas fa-stop-circle mr-2"></i> Detener
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="bg-blue-500/5 rounded-[1.5rem] p-5 border border-blue-500/10 flex items-start gap-4">
                    <i class="fas fa-lightbulb text-blue-500 mt-1"></i>
                    <p class="text-[10px] text-blue-600/70 dark:text-blue-400 font-black uppercase tracking-wide leading-relaxed">
                        El anuncio aparecerá en la parte superior de la pantalla para todos los usuarios activos hasta que sea desactivado manualmente.
                    </p>
                </div>
            </div>
    `;

        let selectedType = diffusion?.type || 'info';
        const typeBtns = container.querySelectorAll('.diff-type-btn');
        typeBtns.forEach(btn => btn.onclick = () => {
            selectedType = btn.dataset.type;
            typeBtns.forEach(b => {
                const isSelected = b.dataset.type === selectedType;
                const activeColor = selectedType === 'info' ? 'blue' : 'rose';
                const baseColor = selectedType === 'info' ? 'primary' : 'rose-500';

                b.className = `diff-type-btn p-6 rounded-2xl border-2 transition-all font-black uppercase tracking-widest flex flex-col items-center gap-3 ${isSelected ? `border-${baseColor}/50 bg-${baseColor}/10 text-${baseColor} shadow-lg shadow-${baseColor}/10` : 'border-slate-100 dark:border-white/5 opacity-40 hover:opacity-70'}`;
            });
        });

        document.getElementById('btn-save-diffusion').onclick = async () => {
            const content = document.getElementById('diff-content').value;
            if (!content) return showNotification("El mensaje no puede estar vacío", "error");

            try {
                await saveDiffusionMessage(content, selectedType);
                showNotification("Anuncio publicado exitosamente");
                loadSubTab('difusion', container, config, appVersion);
            } catch (e) {
                showNotification("Error: " + e.message, "error");
            }
        };

        const stopBtn = document.getElementById('btn-stop-diffusion');
        if (stopBtn) stopBtn.onclick = async () => {
            try {
                await saveDiffusionMessage(null);
                showNotification("Difusión finalizada");
                loadSubTab('difusion', container, config, appVersion);
            } catch (e) {
                showNotification("Error: " + e.message, "error");
            }
        };

    } else if (subTab === 'mantenimiento') {
        const [terrs, conds, phones] = await Promise.all([
            getTerritorios(),
            getConductores(),
            getTelefonos()
        ]);

        const tCount = terrs.length;
        const cCount = conds.length;
        const pCount = phones.length;

        container.innerHTML = `
            <div class="space-y-8 animate-fade-in p-2 md:p-6 max-w-6xl mx-auto">
                <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div>
                        <h3 class="font-black text-2xl md:text-3xl text-slate-800 dark:text-white flex items-center gap-4">
                            <div class="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                                <i class="fas fa-shield-halved"></i>
                            </div>
                            Mantenimiento
                        </h3>
                        <p class="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1 ml-1">Monitorización y reparación proactiva del sistema</p>
                    </div>
                    <div class="flex items-center gap-4 bg-white/50 dark:bg-white/[0.03] p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 backdrop-blur-xl shadow-sm w-full sm:w-auto">
                        <div class="text-left sm:text-right px-2">
                            <p class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Estado Global</p>
                            <p class="text-xs font-black text-emerald-500 flex items-center gap-2 sm:justify-end">
                                <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                ESTABLE
                            </p>
                        </div>
                        <div class="h-8 w-px bg-slate-200 dark:bg-white/10 mx-1"></div>
                        <div class="flex -space-x-3">
                            <div class="w-10 h-10 rounded-xl bg-primary/10 border-2 border-white dark:border-slate-900 flex items-center justify-center text-primary shadow-sm" title="Territorios"><i class="fas fa-map"></i></div>
                            <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border-2 border-white dark:border-slate-900 flex items-center justify-center text-indigo-500 shadow-sm" title="Conductores"><i class="fas fa-user-tie"></i></div>
                            <div class="w-10 h-10 rounded-xl bg-amber-500/10 border-2 border-white dark:border-slate-900 flex items-center justify-center text-amber-600 shadow-sm" title="Registros"><i class="fas fa-phone-alt"></i></div>
                        </div>
                    </div>
                </header>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <!-- Control Panel (Left Column) -->
                    <div class="lg:col-span-5 flex flex-col gap-8 w-full">
                        <!-- Stats Grid -->
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div class="modern-card group !p-4 border-slate-100 dark:border-white/5 text-center flex flex-col items-center justify-center transition-all hover:bg-primary/5">
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Territorios</p>
                                <p class="text-2xl font-black text-primary tabular-nums">${tCount}</p>
                            </div>
                            <div class="modern-card group !p-4 border-slate-100 dark:border-white/5 text-center flex flex-col items-center justify-center transition-all hover:bg-indigo-500/5">
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Conductores</p>
                                <p class="text-2xl font-black text-indigo-500 tabular-nums">${cCount}</p>
                            </div>
                            <div class="modern-card group !p-4 border-slate-100 dark:border-white/5 text-center flex flex-col items-center justify-center transition-all hover:bg-amber-500/5">
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfonos</p>
                                <p class="text-2xl font-black text-amber-500 tabular-nums">${pCount}</p>
                            </div>
                        </div>

                        <!-- Main Actions -->
                        <div class="p-8 bg-white/50 dark:bg-white/[0.03] rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl space-y-6 backdrop-blur-xl">
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                <i class="fas fa-microchip opacity-30"></i> Herramientas de Núcleo
                            </h4>
                            
                            <button id="btn-smart-repair" class="w-full group relative overflow-hidden bg-primary p-[1.5px] rounded-2xl shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95">
                                <div class="bg-white dark:bg-[#0f1420] group-hover:bg-transparent transition-colors p-5 rounded-2xl flex items-center justify-between text-left">
                                    <div>
                                        <p class="text-[11px] font-black text-primary group-hover:text-white uppercase tracking-widest">Reparación Cuántica</p>
                                        <p class="text-[9px] text-slate-500 group-hover:text-white/70 font-bold mt-0.5">Diagnóstico profundo y limpieza total</p>
                                    </div>
                                    <span class="text-xl text-primary group-hover:text-white transition-transform group-hover:scale-125 group-hover:rotate-12">
                                        <i class="fas fa-bolt-lightning"></i>
                                    </span>
                                </div>
                            </button>

                            <div class="grid grid-cols-1 gap-3">
                                <button id="btn-rebuild-history" class="w-full flex items-center gap-5 p-5 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-primary/30 transition-all text-left group">
                                    <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-lg group-hover:scale-110 transition-transform">
                                        <i class="fas fa-sync"></i>
                                    </div>
                                    <div>
                                        <p class="text-xs font-black text-slate-700 dark:text-gray-100 uppercase tracking-wide">Sincronizar S-13</p>
                                        <p class="text-[9px] text-slate-400 font-bold">Recuperar historial desde programas</p>
                                    </div>
                                </button>

                                <div class="grid grid-cols-2 gap-3">
                                    <button id="btn-backup-json" class="flex flex-col items-center justify-center gap-3 p-5 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-indigo-500/30 transition-all group">
                                        <i class="fas fa-file-export text-xl text-indigo-500 group-hover:scale-110 transition-transform"></i>
                                        <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Backup</span>
                                    </button>
                                    <label class="flex flex-col items-center justify-center gap-3 p-5 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-purple-500/30 transition-all cursor-pointer group">
                                        <i class="fas fa-file-import text-xl text-purple-500 group-hover:scale-110 transition-transform"></i>
                                        <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Restore</span>
                                        <input type="file" id="input-restore-json" class="hidden" accept=".json">
                                    </label>
                                </div>
                            </div>

                            <button id="btn-ai-audit" class="w-full flex items-center gap-5 p-5 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 hover:border-indigo-500/40 transition-all text-left group">
                                <div class="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg group-hover:scale-110 group-hover:rotate-12 transition-transform shadow-lg shadow-indigo-600/20">
                                    <i class="fas fa-brain"></i>
                                </div>
                                <div>
                                    <p class="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Auditoría IA (Gemini)</p>
                                    <p class="text-[9px] text-slate-400 font-bold">Detección heurística de discrepancias</p>
                                </div>
                            </button>

                            <div class="grid grid-cols-2 gap-3">
                                <button id="btn-fix-territories" class="flex items-center gap-4 p-4 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-teal-500/30 transition-all text-left group">
                                    <div class="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-500 text-sm group-hover:scale-110 transition-transform">
                                        <i class="fas fa-spell-check"></i>
                                    </div>
                                    <p class="text-[9px] font-black text-slate-700 dark:text-white uppercase tracking-widest leading-tight">Normalizar</p>
                                </button>
                                <button id="btn-ai-predict" class="flex items-center gap-4 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 hover:border-emerald-500/40 transition-all text-left group">
                                    <div class="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-sm group-hover:scale-110 transition-transform shadow-md">
                                        <i class="fas fa-wand-magic-sparkles"></i>
                                    </div>
                                    <p class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-tight">Predicción</p>
                                </button>
                            </div>
                        </div>

                        <!-- System Version Info Card -->
                        <div class="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2.5rem] shadow-2xl shadow-slate-900/40 text-white relative overflow-hidden group">
                           <div class="absolute -right-10 -bottom-10 opacity-5 group-hover:scale-125 transition-transform duration-1000">
                               <i class="fas fa-microchip text-[12rem]"></i>
                           </div>
                           <div class="relative z-10">
                               <p class="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">Core Kernel Version</p>
                               <h4 class="text-4xl font-black mb-10 tracking-tighter tabular-nums">v${appVersion}</h4>
                               
                               <div class="flex flex-col gap-3">
                                   <div class="flex flex-col sm:flex-row items-center gap-3">
                                       <button id="btn-force-update" class="w-full sm:flex-1 bg-white/10 hover:bg-white text-white hover:text-slate-950 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 active:scale-95">Reinstalar</button>
                                       <button id="btn-clear-cache" class="w-full sm:flex-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 active:scale-95">Borrar Caché</button>
                                   </div>
                                   <button id="btn-set-remote-version" class="w-full bg-emerald-500/20 hover:bg-emerald-500 text-emerald-500 hover:text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/20 active:scale-95 flex items-center justify-center gap-2">
                                       <i class="fas fa-cloud-arrow-up"></i>
                                       Publicar v${appVersion} como obligatoria
                                   </button>
                               </div>
                           </div>
                        </div>
                    </div>

                    <!-- Terminal / Console Area (Right Column) -->
                    <div class="lg:col-span-7 flex flex-col gap-6">

                        <div class="flex-1 bg-[#0b0c10] rounded-3xl border border-white/10 shadow-3xl flex flex-col overflow-hidden min-h-[400px] md:min-h-[500px] relative">
                            <!-- Terminal Header -->
                            <div class="bg-white/5 border-b border-white/5 p-4 flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="flex gap-1.5 px-2">
                                        <div class="w-3 h-3 rounded-full bg-red-500/50"></div>
                                        <div class="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                                        <div class="w-3 h-3 rounded-full bg-green-500/50"></div>
                                    </div>
                                    <div class="h-4 w-px bg-white/10 mx-2"></div>
                                    <p class="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Console: <span class="text-teal-500">System_Diagnostics_v2.0</span></p>
                                </div>
                                <button id="btn-clear-console" class="text-[9px] font-black text-gray-500 hover:text-white uppercase transition-colors">Limpiar Log</button>
                            </div>
                            
                            <!-- Terminal Body -->
                            <div id="maint-console" class="flex-1 p-6 font-mono text-[11px] leading-relaxed overflow-y-auto custom-scrollbar-dark touch-pan-y">
                                <div class="space-y-1" id="console-output-stream">
                                    <div class="text-teal-400/50 mb-4 animate-pulse">_ CONFIGURANDO ENTORNO DE DIAGNÓSTICO...</div>
                                    <div class="text-gray-600">> Inicializando módulos de integridad de Firebase...</div>
                                    <div class="text-gray-600">> Conexión establecida con clúster v3.2.1.</div>
                                    <div class="text-gray-600 text-[9px] opacity-40 italic mt-2">Ready for operation. System health: 100% stable.</div>
                                </div>
                            </div>

                            <!-- Terminal Overlay Progress -->
                            <div id="console-progress-overlay" class="hidden absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-12 transition-all">
                                <div class="w-full max-w-sm space-y-4">
                                     <div class="flex justify-between items-end">
                                        <p id="progress-status-text" class="text-[10px] font-black text-teal-400 uppercase tracking-widest animate-pulse">Ejecutando proceso...</p>
                                        <p id="progress-percent-text" class="text-2xl font-black text-white">0%</p>
                                     </div>
                                     <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <div id="repair-progress-bar" class="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(20,184,166,0.5)]" style="width: 0%"></div>
                                     </div>
                                </div>
                            </div>

                            <!-- Gemini Intelligence Footer -->
                            <div class="bg-teal-500/5 border-t border-teal-500/10 p-5 flex items-start gap-4">
                                <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                                     <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center justify-between mb-1">
                                        <h5 class="text-[10px] font-black uppercase text-teal-400 tracking-widest">Inteligencia Predictiva Gemini</h5>
                                        <span class="px-2 py-0.5 bg-teal-500/20 text-teal-400 text-[8px] font-bold rounded-full uppercase">Activa</span>
                                    </div>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 italic">"El mantenimiento proactivo previene discrepancias en el historial S-13 y asegura que el ciclo de predicación telefónica se complete sin redundancias."</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    `;

        // -- Consolidated UI Handlers --
        const oStream = container.querySelector('#console-output-stream');
        const progressOverlay = container.querySelector('#console-progress-overlay');
        const progressBar = container.querySelector('#repair-progress-bar');
        const progressPc = container.querySelector('#progress-percent-text');
        const progressStatus = container.querySelector('#progress-status-text');

        const logToConsole = (msg, type = 'info') => {
            const entry = document.createElement('div');
            const colorClass = type === 'error' ? 'text-red-400' : type === 'success' ? 'text-green-400' : type === 'warning' ? 'text-amber-400' : 'text-teal-400/80';
            const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
            entry.className = `flex gap - 3 py - 0.5 ${colorClass} `;
            entry.innerHTML = `<span class="opacity-30 flex-shrink-0"> [${timestamp}]</span> <span>${msg}</span>`;
            oStream.appendChild(entry);
            const consoleDiv = container.querySelector('#maint-console');
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
        };

        const updateProgress = (pc, status) => {
            progressOverlay.classList.remove('hidden');
            progressBar.style.width = `${pc}% `;
            progressPc.innerText = `${pc}% `;
            if (status) progressStatus.innerText = status;
        };

        container.querySelector('#btn-clear-console').onclick = () => {
            oStream.innerHTML = '<div class="text-gray-600 text-[9px] opacity-40 italic">> Consola purgada. Esperando comandos...</div>';
        };

        // -- Event Binding --
        const bind = (id, handler) => {
            const el = container.querySelector(`#${id} `);
            if (el) el.onclick = async () => {
                if (!ensureOnline()) return;
                try {
                    await handler(el);
                } catch (err) {
                    console.error(`Error in ${id}: `, err);
                    showCustomAlert(`Error inesperado: ${err.message} `);
                }
            };
        };

        // 1. Rebuild History
        bind('btn-rebuild-history', async (btn) => {
            showCustomConfirm('¿Quieres reconstruir el historial S-13 desde el programa semanal?', async () => {
                logToConsole("Iniciando reconstrucción de historial S-13...");
                updateProgress(10, "Escaneando programa semanal...");
                try {
                    const count = await rebuildHistoryFromSchedule();
                    updateProgress(100, "Sincronización completa");
                    logToConsole(`✅ ÉXITO: Se sincronizaron ${count} registros históricos.`, 'success');
                    showNotification(`Sincronización completada: ${count} registros.`);
                    setTimeout(() => progressOverlay.classList.add('hidden'), 2000);
                } catch (err) {
                    logToConsole(`❌ ERROR: ${err.message} `, 'error');
                    updateProgress(0, "Error crítico");
                }
            });
        });

        // 2. Backup
        bind('btn-backup-json', async (btn) => {
            logToConsole("Iniciando empaquetado de backup del sistema...");
            updateProgress(20, "Recopilando colecciones...");
            try {
                const fullData = {
                    timestamp: new Date().toISOString(),
                    territorios: await getTerritorios(),
                    conductores: await getConductores(),
                    telefonos: await getTelefonos(),
                    publicadores: await getPublicadores(),
                    programa: await getProgramaSemanal(formatDateId(new Date())),
                    config: await getConfiguracion(),
                    historial: await getHistorialReport()
                };
                updateProgress(60, "Generando archivo JSON...");
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", `Backup_Territorios_${formatDateId(new Date())}.json`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
                updateProgress(100, "Backup finalizado");
                logToConsole("📥 Backup generado y descargado correctamente.", "success");
                setTimeout(() => progressOverlay.classList.add('hidden'), 2000);
            } catch (err) {
                logToConsole(`❌ ERROR: ${err.message} `, "error");
            }
        });

        // 3. Restore
        const fileInput = container.querySelector('#input-restore-json');
        if (fileInput) fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file || !ensureOnline()) return;
            showCustomConfirm('⚠️ ALERTA: Esto reemplazará todos los datos actuales. ¿Continuar?', async () => {
                logToConsole("🚀 INICIANDO RESTAURACIÓN DE BACKUP...");
                updateProgress(5, "Iniciando...");
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        await restoreSystemBackup(data, (msg, progress) => {
                            logToConsole(`[Restore] ${msg} `);
                            updateProgress(progress, msg);
                        });
                        logToConsole("✅ SISTEMA RESTAURADO COMPLETAMENTE", "success");
                        updateProgress(100, "Finalizado");
                        setTimeout(() => window.location.reload(), 1500);
                    } catch (err) {
                        logToConsole(`❌ ERROR: ${err.message} `, "error");
                        updateProgress(0, "Fallo en restauración");
                    }
                };
                reader.readAsText(file);
            });
        };

        // 4. Local Reinstall
        bind('btn-force-update', async (btn) => {
            showCustomConfirm('¿Limpiar caché local y reinstalar?', async () => {
                logToConsole("Iniciando purga de caché local...");
                updateProgress(40, "Unregistering SW...");
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let r of registrations) await r.unregister();
                }
                updateProgress(70, "Deleting caches...");
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                }
                updateProgress(100, "Purge complete");
                logToConsole("⚡ Purga completada. Reiniciando versión local...", "warning");
                localStorage.removeItem('app_version');
                setTimeout(() => window.location.reload(true), 1000);
            });
        });

        // 5. Force All Update
        bind('btn-set-remote-version', async (btn) => {
            showCustomConfirm(`¿Publicar v${appVersion} como versión obligatoria ? `, async () => {
                logToConsole(`Enviando señal de actualización remota(v${appVersion})...`);
                await setSystemVersion(appVersion);
                logToConsole("🌐 Versión remota sincronizada.", "success");
                showNotification("Configuración de flota actualizada.");
            });
        });

        // 6. Proactive Fixes (Consolidated)
        bind('btn-smart-repair', async (btn) => {
            logToConsole("✨ INICIANDO PROTOCOLO DE REPARACIÓN CUÁNTICA...");
            updateProgress(5, "Inicializando motor de diagnóstico...");

            try {
                const report = await runSystemDiagnosticsAndRepair((msg, pc) => {
                    logToConsole(msg);
                    updateProgress(pc, "Reparando registros...");
                });

                logToConsole(`✅ PROTOCOLO FINALIZADO`, 'success');
                logToConsole(`> Historial sincronizado: ${report.rebuiltHistory} `);
                logToConsole(`> Teléfonos corregidos: ${report.fixedPhones} `);

                if (report.details && report.details.length > 0) {
                    report.details.slice(0, 10).forEach(d => logToConsole(`• ${d} `, 'info'));
                    if (report.details.length > 10) logToConsole(`... y ${report.details.length - 10} correcciones adicionales.`);
                }

                updateProgress(100, "Sistema optimizado");
                showNotification("Reparación completada con éxito.");
                setTimeout(() => progressOverlay.classList.add('hidden'), 3000);
            } catch (err) {
                logToConsole(`❌ ERROR CRÍTICO: ${err.message} `, 'error');
                updateProgress(0, "Interrupción de sistema");
            }
        });

        bind('btn-fix-territories', async (btn) => {
            logToConsole("Iniciando normalización de datos maestros (Territorios)...");
            updateProgress(10, "Cargando registros...");
            try {
                const terrs = await getTerritorios();
                let fixed = 0;
                for (let i = 0; i < terrs.length; i++) {
                    const t = terrs[i];
                    const num = String(t.numero).trim();
                    if (t.numero !== num) {
                        await updateTerritorio(t.id, { numero: num });
                        fixed++;
                        logToConsole(`Normalizado: #${num} (Espacios corregidos)`);
                    }
                    if (i % 5 === 0) updateProgress(10 + Math.floor((i / terrs.length) * 80), `Analizando #${num} `);
                }
                updateProgress(100, "Normalización completa");
                logToConsole(`✅ Operación finalizada.${fixed} registros normalizados.`, 'success');
                setTimeout(() => {
                    progressOverlay.classList.add('hidden');
                    loadSubTab('mantenimiento', container, config, appVersion);
                }, 2000);
            } catch (err) {
                logToConsole(`❌ Error: ${err.message} `, 'error');
                updateProgress(0, "Fallo");
            }
        });

        // --- AI Full Audit ---
        bind('btn-ai-audit', async (btn) => {
            if (!config.gemini_key) {
                return showNotification("Configura tu API Key de Gemini en la pestaña 'Reglas' para usar esta función.", "warning");
            }

            logToConsole("🧠 INICIALIZANDO CONSULTORÍA IA DE DATOS...");
            updateProgress(20, "Recopilando snapshot del sistema...");

            try {
                const terrs = await getTerritorios(); // Refresh
                const intellect = new TerritoryIntelligence(phones, [], terrs, await getProgramaSemanal(formatDateId(new Date())), conds);
                updateProgress(40, "Enviando a Gemini para análisis profundo...");

                const report = await intellect.performFullAudit(config.gemini_key);

                updateProgress(100, "Auditoría completada");
                logToConsole("✨ INFORME ESTRATÉGICO DE AUDITORÍA IA:", 'success');

                // Format the markdownish report for the console
                report.split('\n').forEach(line => {
                    if (line.trim()) {
                        const type = line.startsWith('###') ? 'success' : (line.startsWith('-') ? 'info' : 'warning');
                        logToConsole(line.replace('###', '>>').trim(), type);
                    }
                });

                showNotification("Auditoría IA finalizada con éxito.");
            } catch (err) {
                logToConsole(`❌ ERROR IA: ${err.message} `, 'error');
                updateProgress(0, "Interrupción de inteligencia");
            }
        });

        // --- AI Prediction ---
        bind('btn-ai-predict', async (btn) => {
            if (!config.gemini_key) {
                return showNotification("Configura tu API Key de Gemini", "warning");
            }
            logToConsole("🔮 CALCULANDO PREDICCIONES DE ASIGNACIÓN...");
            updateProgress(30, "Analizando patrones de rotación...");
            try {
                const terrs = await getTerritorios();
                const intellect = new TerritoryIntelligence(phones, [], terrs, await getProgramaSemanal(formatDateId(new Date())), conds);
                const prediction = await intellect.predictAssignments(config.gemini_key);
                updateProgress(100, "Predicción lista");
                logToConsole("✨ RECOMENDACIONES DE LA IA:", 'success');
                prediction.split('\n').forEach(line => {
                    if (line.trim()) logToConsole(line.trim(), 'info');
                });
            } catch (err) {
                logToConsole(`❌ Error IA: ${err.message} `, 'error');
                updateProgress(0, "Fallo en predicción");
            }
        });

    } else if (subTab === 'territorios' || subTab === 's12') {
        await renderS12View(container, config, appVersion);
    } else if (subTab === 'personal') {
        const publicadores = await getPublicadores();
        const groups = await getGroupsConfig();
        publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const renderAvailPreview = (p) => {
            const disp = p.disponibilidad || [];
            if (!p.es_conductor) return '';
            if (disp.length === 0) return '<span class="text-[9px] text-gray-500 italic">Precedencia sin turnos</span>';
            return `<button onclick = "event.stopPropagation(); window.showPublicadorAvailability('${p.id}')" class="text-[9px] text-teal-600 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 rounded border border-teal-500/20 underline decoration-teal-500/30 cursor-pointer transition-colors font-medium"> Conductor: ${disp.length} turnos</button> `;
        };

        window.showPublicadorAvailability = (id) => {
            const p = publicadores.find(x => x.id === id);
            if (!p || !p.disponibilidad || p.disponibilidad.length === 0) return;
            const shiftLabels = { 'manana': 'Mañana', 'tarde': 'Tarde', 'noche': 'Noche' };
            const daysOrder = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6 };
            const sorted = [...p.disponibilidad].sort((a, b) => {
                const [da, sa] = a.split('_'), [db, sb] = b.split('_');
                return (daysOrder[da] - daysOrder[db]) || (sa.localeCompare(sb));
            });
            const listHtml = sorted.map(item => `
    <div class="flex justify-between items-center p-4 border-b border-slate-100 dark:border-white/5 last:border-0 group hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                    <span class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">${item.split('_')[0]}</span>
                    <span class="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-1 rounded-md tracking-widest border border-primary/20">
                        ${shiftLabels[item.split('_')[1]] || item.split('_')[1]}
                    </span>
                </div> `).join('');

            showModal(`
    <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2rem] overflow-hidden">
                    <header class="shrink-0 bg-primary p-6 text-white relative">
                        <div class="absolute inset-0 bg-white/10 backdrop-blur-xl"></div>
                        <div class="relative z-10 flex justify-between items-center">
                            <div>
                                 <h3 class="text-xl font-black uppercase tracking-tight">Disponibilidad</h3>
                                 <p class="text-[9px] opacity-70 font-bold uppercase mt-1 tracking-[0.2em]">${p.nombre}</p>
                            </div>
                            <div class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl shadow-lg border border-white/30">
                                <i class="fas fa-calendar-alt"></i>
                            </div>
                        </div>
                    </header>
                    <div class="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                        <div class="modern-card !p-0 overflow-hidden shadow-xl border-slate-200 dark:border-white/5">
                            ${listHtml}
                        </div>
                    </div>
                </div>
    `);
        };

        container.innerHTML = `
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6 px-2">
                <div>
                    <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Directorio de Personal</h3>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1 ml-1">Gestión centralizada de publicadores</p>
                </div>
                
                <button id="btn-add-person" class="w-full sm:w-auto bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                    <i class="fas fa-plus"></i> Nuevo Registro
                </button>
            </div>

            <div class="modern-card !p-0 overflow-hidden border-slate-200 dark:border-white/5 shadow-2xl">
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr class="bg-slate-50 dark:bg-black/20 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100 dark:border-white/5">
                                <th class="p-6">Nombre y Apellido</th>
                                <th class="p-6 text-center">Grupo</th>
                                <th class="p-6 text-center">Rol / Estado</th>
                                <th class="p-6 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                            ${publicadores.map(p => `
                                <tr class="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td class="p-6">
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${p.genero === 'Mujer' ? 'from-rose-500 to-pink-500' : 'from-primary to-blue-600'} flex items-center justify-center text-white font-black text-sm shadow-lg group-hover:scale-110 transition-transform">
                                                ${p.nombre.charAt(0)}
                                            </div>
                                            <div>
                                                <p class="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">${p.nombre}</p>
                                                <p class="text-[9px] text-slate-400 font-mono">${p.telefono || 'SIN TELÉFONO'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="p-6 text-center">
                                        <span class="text-[10px] font-black uppercase text-slate-400 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 shadow-inner">
                                            ${p.grupo || '?'}
                                        </span>
                                    </td>
                                    <td class="p-6">
                                        <div class="flex flex-wrap items-center justify-center gap-2">
                                            ${p.es_conductor ? `
                                                <button onclick="event.stopPropagation(); window.showPublicadorAvailability('${p.id}')" class="text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full hover:bg-emerald-500 hover:text-white transition-all">
                                                    <i class="fas fa-check-circle mr-1"></i> Conductor
                                                </button>
                                            ` : `
                                                <span class="text-[8px] font-black uppercase tracking-widest text-slate-400 opacity-40">Publicador</span>
                                            `}
                                            ${p.privilegios?.includes('Administrador') ? `
                                                <span class="text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 border border-amber-500/20 px-3 py-1 rounded-full">Admin</span>
                                            ` : ''}
                                        </div>
                                    </td>
                                    <td class="p-6">
                                        <div class="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                            <button onclick="window.editPerson('${p.id}')" class="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl border border-slate-200 dark:border-white/10 hover:border-primary/40 transition-all shadow-sm">
                                                <i class="fas fa-edit text-[10px]"></i>
                                            </button>
                                            <button onclick="window.deletePerson('${p.id}')" class="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-500 rounded-xl border border-slate-200 dark:border-white/10 hover:border-rose-500/40 transition-all shadow-sm">
                                                <i class="fas fa-trash-alt text-[10px]"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
`;



        const openPersonModal = (person = null) => {
            const isEdit = !!person;
            const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            const shifts = [{ id: 'manana', label: 'Mañ.', color: 'text-yellow-500' }, { id: 'tarde', label: 'Tar.', color: 'text-orange-500' }, { id: 'noche', label: 'Noc.', color: 'text-blue-500' }];
            const privs = ['Conductor', 'Administrador', 'Secretario', 'Servicio', 'Visitante'];

            showModal(`
    <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                    <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                        <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                        <div class="relative z-10 flex items-center gap-6">
                            <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                                <i class="fas fa-user-circle"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">${isEdit ? 'Editar Registro' : 'Nuevo Registro'}</h3>
                                <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Gestión de Personal</p>
                            </div>
                        </div>
                    </header>

                    <div class="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                        <div class="space-y-8">
                            <!-- Datos Básicos -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                                    <input type="text" id="p-name" value="${person?.nombre || ''}" placeholder="Ej: Juan Pérez" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white">
                                </div>
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp / Teléfono</label>
                                    <input type="text" id="p-phone" value="${person?.telefono || ''}" placeholder="+593..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white font-mono">
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-6">
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Género</label>
                                    <select id="p-gender" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white appearance-none cursor-pointer">
                                        <option value="Hombre" ${person?.genero === 'Hombre' ? 'selected' : ''}>Hombre</option>
                                        <option value="Mujer" ${person?.genero === 'Mujer' ? 'selected' : ''}>Mujer</option>
                                    </select>
                                </div>
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grupo Asignado</label>
                                    <select id="p-group" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-sm transition-all text-slate-700 dark:text-white appearance-none cursor-pointer">
                                        <option value="0" ${!person?.grupo || person?.grupo === 0 ? 'selected' : ''}>Sin asignar</option>
                                        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${person?.grupo == (i + 1) ? 'selected' : ''}>Grupo ${i + 1}</option>`).join('')}
                                    </select>
                                </div>
                            </div>

                            <div id="p-email-container" class="${person?.privilegios?.includes('Administrador') ? '' : 'hidden'} animate-fade-in space-y-3">
                                <label class="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Acceso Google (Email)</label>
                                <input type="email" id="p-email" value="${person?.email || ''}" placeholder="usuario@gmail.com" class="w-full bg-primary/5 border border-primary/20 rounded-2xl p-4 text-sm font-bold focus:border-primary outline-none shadow-inner transition-all text-primary">
                                <p class="text-[9px] text-slate-400 ml-1 italic font-bold uppercase tracking-tighter">Requerido para administradores y accesos de nube.</p>
                            </div>

                            <div class="space-y-4">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Privilegios y Roles</label>
                                <div id="privs-container" class="flex flex-wrap gap-3">
                                    <!-- Dynamic Privs List -->
                                </div>
                            </div>

                            <!-- Disponibilidad (Conductor Only) -->
                            <div class="bg-primary/5 rounded-[2rem] border border-primary/10 overflow-hidden">
                                <div class="p-6 border-b border-primary/10 flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <i class="fas fa-calendar-check text-primary"></i>
                                        <span class="text-[10px] font-black uppercase text-primary tracking-widest">Disponibilidad de Conductor</span>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="p-is-cond" class="sr-only peer" ${person?.es_conductor ? 'checked' : ''}>
                                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                                <div id="p-avail-grid" class="p-6 ${person?.es_conductor ? '' : 'opacity-20 pointer-events-none grayscale'} transition-all duration-500 bg-white/40 dark:bg-black/20">
                                     <div class="grid grid-cols-4 gap-2 mb-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                         <div class="text-left pl-2">Día</div>
                                         ${shifts.map(s => `<div>${s.label}</div>`).join('')}
                                     </div>
                                     <div class="space-y-2">
                                         ${days.map(day => `
                                             <div class="grid grid-cols-4 gap-2 items-center modern-card !p-3">
                                                 <div class="text-[10px] font-black text-slate-600 dark:text-slate-300 pl-2 uppercase">${day.slice(0, 3)}</div>
                                                 ${shifts.map(sh => `<div class="flex justify-center"><input type="checkbox" class="p-avail-check w-5 h-5 accent-primary cursor-pointer" value="${day}_${sh.id}" ${person?.disponibilidad?.includes(`${day}_${sh.id}`) ? 'checked' : ''}></div>`).join('')}
                                             </div>
                                         `).join('')}
                                     </div>
                                </div>
                            </div>

                            <!-- Módulos Habilitados -->
                            <div id="p-modules-section" class="bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10 overflow-hidden ${person?.es_conductor ? '' : 'opacity-20 pointer-events-none grayscale'} transition-all duration-500">
                                <div class="p-6 border-b border-indigo-500/10 flex items-center gap-3">
                                    <i class="fas fa-th-large text-indigo-600"></i>
                                    <label class="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Módulos Habilitados</label>
                                </div>
                                <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    ${[
                    { id: 'mod-agenda', label: 'Agenda Semanal', checked: person?.modulos?.agenda !== false && person?.modulos?.dashboard !== false },
                    { id: 'mod-programa', label: 'Programa Semanal', checked: person?.modulos?.programa !== false },
                    { id: 'mod-telefonos', label: 'Predicación Telefónica', checked: person?.modulos?.telefonos !== false },
                    { id: 'mod-rescue', label: 'Misión Rescate', checked: person?.modulos?.rescue, accent: 'accent-red-500' }
                ].map(mod => `
                                        <label class="flex items-center justify-between p-4 modern-card hover:border-indigo-500/30 transition-all cursor-pointer group">
                                            <span class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight group-hover:text-indigo-600">${mod.label}</span>
                                            <input type="checkbox" id="${mod.id}" class="p-mod-check w-5 h-5 ${mod.accent || 'accent-indigo-600'}" ${mod.checked ? 'checked' : ''}>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="shrink-0 p-6 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                        <button id="save-person" class="w-full bg-primary py-5 rounded-2xl text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all">
                            <i class="fas fa-save mr-2"></i> ${isEdit ? 'Guardar Cambios' : 'Crear Registro'}
                        </button>
                    </div>
                </div>
    `, (modal) => {
                const genderSelect = modal.querySelector('#p-gender');
                const privsContainer = modal.querySelector('#privs-container');
                const isCondCheck = modal.querySelector('#p-is-cond');
                const saveBtn = modal.querySelector('#save-person');

                const syncConductorUI = () => {
                    const isConductor = Array.from(privsContainer.querySelectorAll('.p-priv-check:checked')).some(cb => cb.value === 'Conductor');
                    const availGrid = modal.querySelector('#p-avail-grid');
                    const modulesSection = modal.querySelector('#p-modules-section');
                    const isAvailable = isCondCheck.checked;

                    if (!isConductor) {
                        isCondCheck.disabled = true;
                        isCondCheck.checked = false;
                        availGrid.classList.add('opacity-20', 'pointer-events-none', 'grayscale');
                        modulesSection.classList.add('opacity-20', 'pointer-events-none', 'grayscale');
                    } else {
                        isCondCheck.disabled = false;
                        availGrid.classList.toggle('opacity-20', !isAvailable);
                        availGrid.classList.toggle('pointer-events-none', !isAvailable);
                        availGrid.classList.toggle('grayscale', !isAvailable);
                        modulesSection.classList.remove('opacity-20', 'pointer-events-none', 'grayscale');

                        // Granular modules logic
                        const modAgenda = modal.querySelector('#mod-agenda');
                        const modRescue = modal.querySelector('#mod-rescue');

                        if (!isAvailable) {
                            [modAgenda, modRescue].forEach(m => {
                                m.disabled = true;
                                m.checked = false;
                                m.closest('label').classList.add('opacity-40', 'pointer-events-none');
                            });
                        } else {
                            [modAgenda, modRescue].forEach(m => {
                                m.disabled = false;
                                m.closest('label').classList.remove('opacity-40', 'pointer-events-none');
                            });
                        }
                    }
                };

                const updatePrivsList = () => {
                    const gender = genderSelect.value;
                    const malePrivs = ['Superintendente de Circuito', 'Anciano', 'Siervo ministerial', 'Conductor', 'Administrador'];
                    const femalePrivs = ['Conductor', 'Administrador'];
                    const currentPrivs = person?.privilegios || [];
                    const list = gender === 'Hombre' ? malePrivs : femalePrivs;

                    privsContainer.innerHTML = list.map(pr => `
                        <label class="flex items-center gap-3 bg-white dark:bg-white/5 px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-primary/50 cursor-pointer transition-all group shadow-sm active:scale-[0.98] relative">
                            <input type="checkbox" class="p-priv-check w-5 h-5 accent-primary cursor-pointer" value="${pr}" ${currentPrivs.includes(pr) ? 'checked' : ''}>
                            <span class="text-[10px] font-black text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200 uppercase tracking-widest">${pr}</span>
                        </label>
                    `).join('');

                    privsContainer.querySelectorAll('.p-priv-check').forEach(cb => {
                        cb.addEventListener('change', syncConductorUI);
                        if (cb.value === 'Administrador') {
                            cb.addEventListener('change', () => {
                                modal.querySelector('#p-email-container').classList.toggle('hidden', !cb.checked);
                            });
                        }
                    });

                    syncConductorUI();
                };

                genderSelect.addEventListener('change', updatePrivsList);
                updatePrivsList();

                isCondCheck.addEventListener('change', syncConductorUI);

                saveBtn.onclick = async () => {
                    const original = saveBtn.innerHTML;
                    saveBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...';
                    saveBtn.disabled = true;

                    const data = {
                        nombre: modal.querySelector('#p-name').value.trim(),
                        telefono: modal.querySelector('#p-phone').value.trim(),
                        genero: modal.querySelector('#p-gender').value,
                        grupo: parseInt(modal.querySelector('#p-group').value),
                        es_conductor: isCondCheck.checked,
                        email: modal.querySelector('#p-email').value.trim().toLowerCase(),
                        privilegios: Array.from(modal.querySelectorAll('.p-priv-check:checked')).map(cb => cb.value),
                        disponibilidad: isCondCheck.checked ? Array.from(modal.querySelectorAll('.p-avail-check:checked')).map(cb => cb.value) : [],
                        modulos: {
                            agenda: isCondCheck.checked ? modal.querySelector('#mod-agenda').checked : (person?.modulos?.agenda || person?.modulos?.dashboard || false),
                            programa: isCondCheck.checked ? modal.querySelector('#mod-programa').checked : (person?.modulos?.programa || false),
                            telefonos: isCondCheck.checked ? modal.querySelector('#mod-telefonos').checked : (person?.modulos?.telefonos || false),
                            rescue: isCondCheck.checked ? modal.querySelector('#mod-rescue').checked : (person?.modulos?.rescue || false)
                        }
                    };

                    if (!data.nombre) {
                        showNotification("El nombre es obligatorio", "error");
                        saveBtn.innerHTML = original; saveBtn.disabled = false;
                        return;
                    }

                    try {
                        if (isEdit) await updatePublicador(person.id, data);
                        else await addPublicador(data);
                        showNotification("Personal actualizado");
                        modal.classList.add('hidden');
                        loadSubTab('personal', container, config, appVersion);
                    } catch (e) {
                        showNotification("Error: " + e.message, "error");
                        btn.innerText = original; btn.disabled = false;
                    }
                };
            }, 'max-w-2xl');
        };

        container.querySelector('#btn-add-person').onclick = () => openPersonModal();
        window.editPerson = (id) => openPersonModal(publicadores.find(x => x.id === id));
        window.deletePerson = (id) => showCustomConfirm("¿Eliminar este registro permanentemente?", async () => {
            await deletePublicador(id);
            loadSubTab('personal', container, config, appVersion);
        });

    } else if (subTab === 'grupos') {
        const groups = await getGroupsConfig();
        const publicadores = await getPublicadores();
        publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

        container.innerHTML = `
    <div class="mb-8">
                <h3 class="font-bold text-xl text-teal-800 dark:text-teal-100 flex items-center gap-3">
                    <span class="p-2 bg-teal-500/10 rounded-xl">🏘️</span> Configuración de Grupos
                </h3>
                <p class="text-[10px] text-gray-500 uppercase tracking-widest font-black mt-1 ml-12">Asignación de liderazgo y puntos de salida</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${groups.map(g => `
                    <div class="premium-glass p-6 rounded-[2rem] border border-white/5 hover:border-teal-500/30 transition-all relative group overflow-hidden">
                        <div class="absolute -top-4 -right-4 w-20 h-20 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all"></div>
                        <div class="relative z-10">
                            <div class="flex justify-between items-start mb-4">
                                <h4 class="font-black text-gray-800 dark:text-white uppercase tracking-tighter text-lg">${g.nombre}</h4>
                                <span class="text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded-full">#${g.id}</span>
                            </div>
                            <div class="space-y-4">
                                <div class="bg-black/5 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
                                    <label class="block text-[8px] font-black uppercase text-teal-600/60 mb-1 tracking-widest">Superintendente de Grupo</label>
                                    <select id="leader-${g.id}" class="w-full bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer">
                                        <option value="">Sin asignar</option>
                                        ${publicadores.map(p => `<option value="${p.nombre}" ${g.lider === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="bg-black/5 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
                                    <label class="block text-[8px] font-black uppercase text-teal-600/60 mb-1 tracking-widest">Auxiliar</label>
                                    <select id="assistant-${g.id}" class="w-full bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer">
                                        <option value="">Sin asignar</option>
                                        ${publicadores.map(p => `<option value="${p.nombre}" ${g.asistente === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="bg-black/5 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
                                    <label class="block text-[8px] font-black uppercase text-teal-600/60 mb-1 tracking-widest">Punto de Salida / Casa</label>
                                    <input type="text" id="house-${g.id}" value="${g.casa_salida || ''}" placeholder="Dirección..." class="w-full bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 outline-none placeholder-gray-500">
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="mt-12 flex flex-col md:flex-row justify-center items-center gap-4">
                <button id="add-group-btn" class="px-8 py-4 bg-white dark:bg-white/5 border border-teal-500/30 rounded-2xl font-black uppercase tracking-widest text-[10px] text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white transition-all shadow-lg active:scale-95">
                    + Agregar Grupo
                </button>
                <button id="save-groups" class="btn-premium px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl flex items-center gap-3">
                    <span>💾</span> Guardar Configuración de Grupos
                </button>
            </div>
`;

        container.querySelector('#add-group-btn').onclick = () => {
            const newId = groups.length > 0 ? (Math.max(...groups.map(g => g.id)) + 1) : 1;
            groups.push({
                id: newId,
                nombre: `Grupo ${newId} `,
                lider: "",
                asistente: "",
                casa_salida: ""
            });
            // Re-render subtab
            loadSubTab('grupos', container, config, appVersion);
        };

        container.querySelector('#save-groups').onclick = async () => {
            const btn = container.querySelector('#save-groups');
            btn.innerHTML = '<span class="animate-pulse italic">Sincronizando...</span>';
            btn.disabled = true;

            const updated = groups.map(g => ({
                ...g,
                lider: document.getElementById(`leader - ${g.id} `).value,
                asistente: document.getElementById(`assistant - ${g.id} `).value,
                casa_salida: document.getElementById(`house - ${g.id} `).value.trim()
            }));

            try {
                await saveGroupsConfig(updated);
                showNotification("Configuración de grupos guardada");
            } catch (e) {
                showNotification("Error: " + e.message, "error");
            } finally {
                btn.innerHTML = '<span>💾</span> Guardar Configuración de Grupos';
                btn.disabled = false;
            }
        };
    }
};

const renderTelefonosTab = async (container) => {
    const telefonos = await getTelefonos();
    const publicadores = await getPublicadores();
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

    container.innerHTML = `
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
            <div>
                <h3 class="text-h3 text-slate-900 dark:text-white flex items-center gap-3">
                    <i class="fas fa-phone-alt text-primary"></i> Predicación Telefónica
                </h3>
                <p class="text-xs text-slate-500 mt-1">Gestión centralizada de registros y contactos</p>
            </div>
            <button id="btn-view-session-summaries" class="bg-primary hover:bg-primary-light text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-3 text-xs uppercase tracking-wider">
                <i class="fas fa-file-invoice"></i> Resúmenes de Zoom
            </button>
        </div>

        <!--Progress Cycle 2026 -->
        <div class="modern-card !p-8 mb-8 border border-slate-200 dark:border-white/5">
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div>
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Progreso del Ciclo Actual</span>
                        <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Meta: Todos los registros procesados</span>
                    </div>
                </div>
                <span id="cycle-percentage" class="text-2xl font-black text-primary italic">0%</span>
            </div>
            <div class="w-full h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mb-3">
                <div id="cycle-progress-bar" class="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000" style="width: 0%"></div>
            </div>
            <div id="cycle-info-text" class="flex justify-between items-center px-1">
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter italic">Total en base de datos: ${telefonos.length}</span>
                <span id="cycle-processed-info" class="text-[10px] text-primary font-bold uppercase tracking-widest">Procesados: 0</span>
            </div>
        </div>
        
        <!--Advanced Controls 2026 -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
             <div class="lg:col-span-5 flex flex-wrap gap-2 md:gap-3">
                <button id="btn-add-phone" class="flex-1 sm:flex-none justify-center bg-primary hover:bg-primary-light text-white px-5 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-3 text-xs uppercase tracking-wider shadow-lg shadow-primary/20">
                    <i class="fas fa-plus-circle"></i> Agregar
                </button>
                <input type="file" id="csv-upload" accept=".csv" class="hidden">
                <button id="btn-csv" class="flex-1 sm:flex-none justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-3 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20">
                    <i class="fas fa-cloud-upload-alt"></i> Importar
                </button>
                <button id="btn-export-phones" class="w-full sm:w-auto justify-center bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-3 text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20">
                    <i class="fas fa-download"></i> Exportar
                </button>
            </div>
            
            <div class="lg:col-span-7 flex flex-col sm:flex-row flex-wrap lg:flex-nowrap gap-3 items-center">
                 <div class="relative w-full flex-1">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input type="text" id="search-number" placeholder="Buscar..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-primary transition-all shadow-sm">
                </div>
                
                <div class="flex w-full sm:w-auto gap-2 flex-1">
                    <select id="filter-publisher" class="flex-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer focus:border-primary transition-all shadow-sm">
                        <option value="">Publicadores</option>
                        <option value="Sin asignar">Sin asignar</option>
                        ${publicadores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                    </select>
                    
                    <select id="filter-status" class="flex-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer focus:border-primary transition-all shadow-sm">
                        <option value="">Estados</option>
                        <option value="Sin asignar">Sin asignar</option>
                        <option value="Contestaron">Contestaron</option>
                        <option value="No contestan">No contestan</option>
                        <option value="Colgaron">Colgaron</option>
                        <option value="Revisita">Revisita</option>
                        <option value="No llamar">No llamar</option>
                        <option value="Suspendido">Suspendido</option>
                        <option value="Testigo">Testigo</option>
                    </select>
                </div>
            </div>
        </div>

        <!--Progress Bar Container-->
    <div id="upload-progress-container" class="hidden mb-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
        <div class="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-2 font-medium">
            <span id="progress-text">Cargando...</span>
            <span id="progress-percent">0%</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-black/40 rounded-full h-2">
            <div id="upload-progress-bar" class="bg-teal-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
    </div>
`;

    // ADDED: Logic for Session Summaries Button
    const btnSummaries = document.getElementById('btn-view-session-summaries');
    if (btnSummaries) {
        btnSummaries.addEventListener('click', async () => {
            const { getSessionSummaries } = await import('../data/firestore-services.js?v=3.2.5');
            const summaries = await getSessionSummaries();

            showModal(`
    <div class="flex flex-col h-full bg-white dark:bg-[#0f1115]">
                    <header class="shrink-0 flex items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-800 p-8 text-white">
                        <div class="flex items-center gap-5">
                            <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shadow-xl">
                                <i class="fas fa-file-invoice"></i>
                            </div>
                            <div>
                                <h3 class="text-h3 text-white !mb-0.5">Resúmenes de Sesión</h3>
                                <p class="text-[10px] uppercase font-bold tracking-widest opacity-70 italic">Interacciones de Zoom</p>
                            </div>
                        </div>
                    </header>

                    <div class="flex-1 p-8 overflow-y-auto custom-scrollbar">
                        ${summaries.length === 0 ? `
                            <div class="flex flex-col items-center justify-center py-20 text-slate-400">
                                <div class="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-3xl mb-4">
                                    <i class="fas fa-inbox opacity-20"></i>
                                </div>
                                <p class="text-xs font-bold uppercase tracking-widest opacity-50">No hay resúmenes registrados</p>
                            </div>
                        ` : `
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${summaries.map(s => `
                                    <div class="p-6 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-primary/30 transition-all group">
                                        <div class="flex justify-between items-start mb-4">
                                            <div class="flex flex-col">
                                                <span class="text-[10px] font-black uppercase tracking-tighter text-primary px-0 rounded-md">Sesión #${s.id.substring(0, 8).toUpperCase()}</span>
                                                <span class="text-[10px] text-slate-400 font-bold mt-0.5">
                                                    <i class="far fa-calendar-alt mr-1"></i> ${new Date(s.timestamp?.toDate ? s.timestamp.toDate() : s.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <div class="flex gap-1">
                                                <div class="w-8 h-8 bg-white dark:bg-white/10 rounded-lg flex items-center justify-center shadow-sm text-xs text-slate-600 dark:text-slate-300">
                                                    <i class="fas fa-phone-alt scale-75"></i>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="grid grid-cols-3 gap-2 mb-4">
                                            <div class="bg-white dark:bg-black/20 p-2 rounded-xl border border-slate-100 dark:border-white/5 text-center">
                                                <span class="block text-xs font-black text-slate-900 dark:text-white">${s.total}</span>
                                                <span class="text-[8px] uppercase text-slate-400 font-bold tracking-tighter">Total</span>
                                            </div>
                                            <div class="bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10 text-center">
                                                <span class="block text-xs font-black text-emerald-600">${s.contestaron}</span>
                                                <span class="text-[8px] uppercase text-emerald-600/60 font-bold tracking-tighter">OK</span>
                                            </div>
                                            <div class="bg-blue-500/5 p-2 rounded-xl border border-blue-500/10 text-center">
                                                <span class="block text-xs font-black text-blue-600">${s.revisitas}</span>
                                                <span class="text-[8px] uppercase text-blue-600/60 font-bold tracking-tighter">Rev</span>
                                            </div>
                                        </div>
                                        <div class="text-[11px] text-slate-600 dark:text-slate-300 italic leading-relaxed bg-white/50 dark:bg-black/40 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                                            "${s.resumen.substring(0, 160)}${s.resumen.length > 160 ? '...' : ''}"
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>

                    <footer class="shrink-0 p-8 bg-slate-50 dark:bg-black/40 border-t border-slate-200 dark:border-white/5 flex justify-end">
                        <button id="close-summaries-modal" class="bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 px-8 py-3 rounded-xl font-bold transition-all hover:bg-slate-300 dark:hover:bg-white/20 text-xs uppercase tracking-widest">
                            Cerrar
                        </button>
                    </footer>
                </div>
    `, (modal) => {
                modal.querySelector('#close-summaries-modal').onclick = () => modal.remove();
            }, 'max-w-4xl');
        });
    }

    // List Container 2026
    const listDiv = document.createElement('div');
    listDiv.id = 'phone-list-container';
    listDiv.className = 'modern-card !p-0 max-h-[700px] overflow-auto relative border border-slate-200 dark:border-white/5 shadow-sm custom-scrollbar';
    container.appendChild(listDiv);


    // Render Logic with Filtering
    const renderList = () => {
        const listContainer = document.getElementById('phone-list-container');
        if (!listContainer) return;

        const searchVal = document.getElementById('search-number')?.value.toLowerCase() || '';
        const pubFilter = document.getElementById('filter-publisher')?.value || '';
        const statusFilter = document.getElementById('filter-status')?.value || '';

        // Update Progress Bar
        const processed = telefonos.filter(t => t.estado && t.estado !== 'Sin asignar').length;
        const total = telefonos.length || 1;
        const pct = Math.floor((processed / total) * 100);
        const pBar = document.getElementById('cycle-progress-bar');
        const pPct = document.getElementById('cycle-percentage');
        const pInfo = document.getElementById('cycle-processed-info');
        if (pBar) pBar.style.width = pct + '%';
        if (pPct) pPct.textContent = pct + '%';
        if (pInfo) pInfo.textContent = `Procesados: ${processed} `;

        const filtered = telefonos.filter(t => {
            const rawAssigned = t.asignado_a || t.publicador_asignado;
            let assignedName = 'Sin asignar';
            if (rawAssigned) {
                const p = publicadores.find(pub => pub.id === rawAssigned || pub.email === rawAssigned || pub.nombre === rawAssigned);
                assignedName = p ? p.nombre : rawAssigned;
            }

            const matchSearch = !searchVal || t.numero.toLowerCase().includes(searchVal) || (t.propietario && t.propietario.toLowerCase().includes(searchVal));
            const isActuallyAssigned = rawAssigned && rawAssigned !== 'Sin asignar' && rawAssigned !== 'Pendiente';
            const matchPub = !pubFilter || (pubFilter === 'Sin asignar' ? !isActuallyAssigned : assignedName === pubFilter);
            const currentStatus = (!t.estado || t.estado === 'Pendiente') ? 'Sin asignar' : t.estado;
            const matchStatus = !statusFilter || (statusFilter === 'Sin asignar' ? currentStatus === 'Sin asignar' : currentStatus === statusFilter);

            return matchSearch && matchPub && matchStatus;
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `
    <div class="flex flex-col items-center justify-center py-24 text-slate-300 dark:text-white/10">
                    <div class="w-24 h-24 mb-6 relative">
                        <div class="absolute inset-0 bg-primary/10 rounded-full animate-ping"></div>
                        <div class="relative w-full h-full bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-4xl">
                            <i class="fas fa-search"></i>
                        </div>
                    </div>
                    <p class="text-xs font-black uppercase tracking-[0.3em] opacity-50">No se encontraron registros</p>
                    <p class="text-[10px] mt-2 opacity-30 italic">Intenta con otros términos o filtros</p>
                </div> `;
            return;
        }

        const colors = {
            'Contestaron': { class: 'bg-emerald-500/10 text-emerald-600', icon: 'fa-check-circle' },
            'No contestan': { class: 'bg-slate-400/10 text-slate-500', icon: 'fa-microphone-slash' },
            'Colgaron': { class: 'bg-amber-500/10 text-amber-600', icon: 'fa-phone-slash' },
            'No llamar': { class: 'bg-red-500/10 text-red-600', icon: 'fa-ban' },
            'Revisita': { class: 'bg-blue-500/10 text-blue-600', icon: 'fa-history' },
            'Sin asignar': { class: 'bg-slate-50 dark:bg-white/5 text-slate-400', icon: 'fa-question-circle' },
            'Suspendido': { class: 'bg-rose-500/10 text-rose-600', icon: 'fa-pause-circle' },
            'Testigo': { class: 'bg-indigo-500/10 text-indigo-600', icon: 'fa-user-check' }
        };

        const getStatusBadge = (status) => {
            const config = colors[status] || colors['Sin asignar'];
            return `
    <span class="${config.class} text-[9px] uppercase font-black tracking-widest px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center justify-center gap-1.5 mx-auto w-fit">
        <i class="fas ${config.icon} opacity-70"></i>
                ${status}
            </span> `;
        };

        listContainer.innerHTML = `
    <table class="w-full text-left text-sm border-collapse">
                <thead class="bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] sticky top-0 z-20 border-b border-slate-200 dark:border-white/5">
                    <tr>
                        <th class="p-6 font-black"><div class="flex items-center gap-2"><i class="fas fa-user-circle opacity-30"></i> Propietario / Dirección</div></th>
                        <th class="p-6 font-black"><div class="flex items-center gap-2"><i class="fas fa-phone opacity-30"></i> Contacto</div></th>
                        <th class="p-6 font-black"><div class="flex items-center gap-2"><i class="fas fa-user-tie opacity-30"></i> Responsable</div></th>
                        <th class="p-6 font-black text-center"><div class="flex items-center justify-center gap-2"><i class="fas fa-tasks opacity-30"></i> Gestión</div></th>
                        <th class="p-6 font-black"><div class="flex items-center gap-2"><i class="fas fa-comment-alt opacity-30"></i> Observaciones</div></th>
                        <th class="p-6 font-black text-right">Opciones</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                    ${filtered.map(t => {
            const rawAssigned = t.asignado_a || t.publicador_asignado;
            let assignedDisplay = 'Sin asignar';
            let isAssigned = false;
            if (rawAssigned && rawAssigned !== 'Sin asignar' && rawAssigned !== 'Pendiente') {
                const p = publicadores.find(pub => pub.id === rawAssigned || pub.email === rawAssigned || pub.nombre === rawAssigned);
                assignedDisplay = p ? p.nombre : rawAssigned;
                isAssigned = true;
            }

            const displayStatus = (!t.estado || t.estado === 'Pendiente') ? 'Sin asignar' : t.estado;
            let phoneDisplay = t.numero || '';
            const cleanNum = phoneDisplay.replace(/\D/g, '');
            if (cleanNum.length === 7) phoneDisplay = `${cleanNum.slice(0, 3)} ${cleanNum.slice(3)}`;
            else phoneDisplay = formatPhoneNumber(phoneDisplay);

            return `
                        <tr class="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                            <td class="p-4">
                                <span class="block font-black text-gray-900 dark:text-gray-100 uppercase text-xs">${t.propietario || '-'}</span>
                                <span class="text-[10px] uppercase text-gray-400 font-bold">${t.direccion || '-'}</span>
                            </td>
                            <td class="p-4 font-bold text-teal-700 dark:text-teal-400 tracking-wider text-xs">${phoneDisplay}</td>
                            <td class="p-4">
                                ${isAssigned
                    ? `<span class="text-[10px] bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2 py-1 rounded-lg border border-teal-100 dark:border-teal-500/20 font-black uppercase tracking-tighter">${assignedDisplay}</span>`
                    : `<span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest opacity-30 italic">Sin asignar</span>`
                }
                            </td>
                            <td class="p-4 text-center">${getStatusBadge(displayStatus)}</td>
                            <td class="p-4">
                                <div class="flex flex-col gap-1 max-w-[200px]">
                                    <span class="text-[11px] text-gray-600 dark:text-gray-300 truncate font-medium" title="${t.comentario || ''}">${t.comentario || '-'}</span>
                                    ${t.ultima_observacion_ciclo ? `
                                        <span class="text-[9px] text-amber-600/70 dark:text-amber-500/40 italic border-l-2 border-amber-500/30 pl-2" title="Ciclo Anterior">
                                            Ant: ${t.ultima_observacion_ciclo.substring(0, 30)}...
                                        </span>
                                    ` : ''}
                                </div>
                            </td>
                            <td class="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                <div class="flex justify-end gap-2">
                                    <button onclick="window.editTelefonoAdmin('${t.id}')" class="w-9 h-9 flex items-center justify-center text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all" title="Editar">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="window.deleteTelefonoAdmin('${t.id}')" class="w-9 h-9 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-xl transition-all" title="Eliminar">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
        }).join('')}
                </tbody>
            </table> `;
    };

    // Initialize search/filter inputs once
    const searchInput = document.getElementById('search-number');
    const pubFilterInput = document.getElementById('filter-publisher');
    const statusFilterInput = document.getElementById('filter-status');

    if (searchInput) {
        if (currentSearch) searchInput.value = currentSearch;
        searchInput.addEventListener('input', () => {
            currentSearch = searchInput.value;
            renderList();
        });
    }
    if (pubFilterInput) {
        if (currentPub) pubFilterInput.value = currentPub;
        pubFilterInput.addEventListener('change', () => {
            currentPub = pubFilterInput.value;
            renderList();
        });
    }
    if (statusFilterInput) {
        if (currentStatus) statusFilterInput.value = currentStatus;
        statusFilterInput.addEventListener('change', () => {
            currentStatus = statusFilterInput.value;
            renderList();
        });
    }

    // Initial Render
    renderList();

    // Event Listeners (Local to renderTelefonosTab)
    const btnCsv = document.getElementById('btn-csv');
    const csvUpload = document.getElementById('csv-upload');
    const btnAddPhone = document.getElementById('btn-add-phone');
    const btnExport = document.getElementById('btn-export-phones');

    if (btnCsv) btnCsv.onclick = () => csvUpload.click();

    if (csvUpload) csvUpload.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            let count = 0;

            const progressContainer = document.getElementById('upload-progress-container');
            const progressBar = document.getElementById('upload-progress-bar');
            const progressText = document.getElementById('progress-text');
            const progressPercent = document.getElementById('progress-percent');

            if (progressContainer) progressContainer.classList.remove('hidden');

            const validLines = lines.filter(l => l.trim() && !l.toLowerCase().startsWith('numero') && !l.toLowerCase().startsWith('número'));
            const total = validLines.length;

            if (total === 0) {
                showNotification("El archivo está vacío o no tiene formato válido.", "warning");
                if (progressContainer) progressContainer.classList.add('hidden');
                return;
            }

            for (let i = 0; i < validLines.length; i++) {
                const line = validLines[i].trim();
                const parts = line.split(',');

                if (parts.length >= 2) {
                    try {
                        const name = parts[0]?.trim();
                        const num = parts[parts.length - 1]?.trim();
                        const address = parts.length > 2 ? parts[1]?.trim() : '';

                        if (num && num.length > 5) {
                            await addTelefono({
                                numero: num,
                                direccion: address,
                                propietario: name,
                                estado: 'Sin asignar'
                            });
                            count++;
                        }
                    } catch (err) { console.error(err); }
                }

                if (i % 5 === 0 || i === total - 1) {
                    const percent = Math.round(((i + 1) / total) * 100);
                    if (progressBar) progressBar.style.width = `${percent}% `;
                    if (progressPercent) progressPercent.innerText = `${percent}% `;
                    if (progressText) progressText.innerText = `Cargando ${i + 1} de ${total}...`;
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            if (progressText) progressText.innerText = "Completado";

            setTimeout(() => {
                if (progressContainer) progressContainer.classList.add('hidden');
                showNotification(`Se cargaron ${count} teléfonos correctamente.`, "success");
                renderTelefonosTab(container);
            }, 500);
        };
        reader.readAsText(file);
    };

    if (btnAddPhone) btnAddPhone.onclick = () => {
        showModal(`
    <div class="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
                <header class="shrink-0 flex items-center justify-between bg-gradient-to-r from-primary to-accent p-8 text-white">
                    <div class="flex items-center gap-5">
                        <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shadow-xl">
                            <i class="fas fa-plus-circle"></i>
                        </div>
                        <div>
                            <h3 class="text-h3 text-white !mb-0.5">Nuevo Registro</h3>
                            <p class="text-[10px] uppercase font-bold tracking-widest opacity-70 italic">Predicación Telefónica</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-8 space-y-6 overflow-y-auto">
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Número Telefónico</label>
                            <input type="text" id="new-p-num" placeholder="0991234567" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-all">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Propietario (Nombre)</label>
                            <input type="text" id="new-p-prop" placeholder="Ej: Juan Pérez" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-all">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dirección Referencial</label>
                            <input type="text" id="new-p-dir" placeholder="Av. Principal N-45" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-all">
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-slate-50 dark:bg-black/40 border-t border-slate-200 dark:border-white/5">
                    <button id="save-new-phone" class="w-full bg-primary hover:bg-primary-light text-white font-bold py-4 rounded-xl shadow-lg transition-all text-sm uppercase tracking-widest">
                        Guardar Registro
                    </button>
                </footer>
            </div>
    `, async (modal) => {
            modal.querySelector('#save-new-phone').onclick = async () => {
                const num = modal.querySelector('#new-p-num').value.trim();
                if (!num) return showNotification("Número requerido", "warning");

                await addTelefono({
                    numero: num,
                    direccion: modal.querySelector('#new-p-dir').value,
                    propietario: modal.querySelector('#new-p-prop').value,
                    estado: 'Sin asignar'
                });
                modal.classList.add('hidden');
                renderTelefonosTab(container);
                showNotification("Teléfono agregado con éxito.");
            };
        });
    };

    if (btnExport) btnExport.onclick = () => {
        const dataToExport = telefonos.map(t => ({
            'Propietario': t.propietario || '-',
            'Dirección': t.direccion || '-',
            'Número': t.numero || '-',
            'Publicador': t.asignado_a || t.publicador_asignado || 'Sin asignar',
            'Estado': t.estado || 'Sin asignar',
            'Comentario': t.comentario || '-'
        }));
        generatePlainXLS(dataToExport, `Directorio_Telefonico_${new Date().toISOString().split('T')[0]} `);
        showNotification("Generando archivo Excel...");
    };

    window.deleteTelefonoAdmin = async (id) => {
        showCustomConfirm('¿Eliminar este registro?', async () => {
            await deleteTelefono(id);
            renderTelefonosTab(container);
            showNotification("Registro eliminado.");
        });
    };

    window.editTelefonoAdmin = async (id) => {
        const t = telefonos.find(x => x.id === id);
        if (!t) return;

        const estados = ['Sin asignar', 'Asignado', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];

        showModal(`
    <div class="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
                <header class="shrink-0 flex items-center justify-between bg-gradient-to-r from-teal-600 to-indigo-700 p-8 text-white relative">
                    <div class="flex items-center gap-5">
                        <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shadow-xl">
                            <i class="fas fa-phone-alt"></i>
                        </div>
                        <div>
                            <h3 class="text-h3 text-white !mb-0.5">Editar Registro</h3>
                            <p class="text-[10px] uppercase font-bold tracking-widest opacity-70 italic">ID: ${t.numero.slice(-4).toUpperCase()}</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Número Telefónico</label>
                            <input type="text" id="edit-p-num" value="${t.numero}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-all font-bold">
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre Propietario</label>
                            <input type="text" id="edit-p-prop" value="${t.propietario || ''}" list="prop-list" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-all font-bold">
                            <datalist id="prop-list">
                                ${[...new Set(telefonos.map(x => x.propietario).filter(Boolean))].map(p => `<option value="${p}">`).join('')}
                            </datalist>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dirección Referencial</label>
                        <input type="text" id="edit-p-dir" value="${t.direccion || ''}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-all">
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                         <div class="space-y-2">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Asignado a</label>
                            <select id="edit-p-pub" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-all font-bold cursor-pointer">
                                <option value="">Sin asignar</option>
                                ${publicadores.map(p => `<option value="${p.nombre}" ${t.asignado_a === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Estado de Registro</label>
                            <select id="edit-p-estado" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-all font-bold cursor-pointer">
                                ${estados.map(e => `<option value="${e}" ${t.estado === e ? 'selected' : ''}>${e}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Observaciones / Comentarios</label>
                        <textarea id="edit-p-obs" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-all min-h-[100px] resize-none">${t.comentario || t.observaciones || ''}</textarea>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-slate-50 dark:bg-black/40 border-t border-slate-200 dark:border-white/5">
                    <button id="update-phone" class="w-full bg-primary hover:bg-primary-light text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all text-xs uppercase tracking-[0.2em]">
                        Guardar Cambios
                    </button>
                </footer>
            </div>
    `, async (modal) => {
            modal.querySelector('#update-phone').addEventListener('click', async () => {
                const assignedTo = modal.querySelector('#edit-p-pub').value;
                const updateData = {
                    numero: modal.querySelector('#edit-p-num').value,
                    direccion: modal.querySelector('#edit-p-dir').value,
                    propietario: modal.querySelector('#edit-p-prop').value,
                    asignado_a: assignedTo,
                    publicador_asignado: assignedTo,
                    estado: modal.querySelector('#edit-p-estado').value,
                    comentario: modal.querySelector('#edit-p-obs').value
                };

                // If state is unassigned, clear assignment fields
                if (updateData.estado === 'Sin asignar') {
                    updateData.asignado_a = null;
                    updateData.publicador_asignado = null;
                    updateData.fecha_asignacion = null;
                    updateData.solicitado_por = null;
                }

                // If explicitly set to empty/Sin asignar in the publisher select, clear both assignment fields
                if (!assignedTo || assignedTo === 'Sin asignar') {
                    updateData.asignado_a = null;
                    updateData.publicador_asignado = null;
                    updateData.fecha_asignacion = null;
                    updateData.solicitado_por = null;
                    if (updateData.estado === 'Asignado') updateData.estado = 'Sin asignar';
                }

                await updateTelefono(id, updateData);
                modal.remove();
                renderTelefonosTab(container);
                showNotification("Registro actualizado.");
            });
        });
    };
};



/* Updated Helper for simple CRUD lists with Edit support */
const renderListCRUD = (container, title, items, fields, onAdd, onDelete, onEdit) => {
    container.innerHTML = `
    <div class="flex justify-between items-center mb-4">
            <h3 class="font-semibold text-lg text-teal-800 dark:text-teal-100">${title}</h3>
            <button id="btn-add-item" class="bg-teal-600 text-sm px-4 py-2 rounded-lg hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20">+ Agregar</button>
        </div>
    <div class="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        ${items.map(item => `
                <div class="flex justify-between items-center p-3 bg-black/5 dark:bg-white/5 rounded border border-black/10 dark:border-white/10 group hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                    <div>
                        <div class="font-medium text-gray-800 dark:text-gray-200 text-base">${item[fields[0]]}</div>
                        ${fields[1] ? `<div class="text-xs text-gray-500 dark:text-gray-400">${item[fields[1]]}</div>` : ''}
                    </div>
                    <div class="flex gap-2">
                         ${onEdit ? `<button class="text-teal-600 dark:text-teal-400 hover:text-teal-500 hover:bg-teal-500/10 p-2 rounded-lg transition-colors" onclick="window.editItem_${title.replace(/\s/g, '')}('${item.id}')">✏️</button>` : ''}
                        <button class="text-red-500/70 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors" onclick="window.deleteItem_${title.replace(/\s/g, '')}('${item.id}')">✕</button>
                    </div>
                </div>
            `).join('')}
    </div>
`;

    const inputClasses = "w-full mb-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-900 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none transition-all shadow-sm";

    document.getElementById('btn-add-item').addEventListener('click', () => {
        const inputs = fields.map(f => `
    <div>
                <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">${f}</label>
                <input type="text" id="field-${f}" class="${inputClasses}" placeholder="${f.charAt(0).toUpperCase() + f.slice(1)}">
            </div>
`).join('');

        showModal(`
    <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400"> Nuevo ${title}</h3>
            <div class="space-y-2">
                ${inputs}
            </div>
            <button id="save-item" class="w-full bg-teal-600 py-3 rounded-lg text-white font-bold mt-4 shadow-lg shadow-teal-500/20">Guardar</button>
`, async (modal) => {
            document.getElementById('save-item').addEventListener('click', async () => {
                const data = {};
                fields.forEach(f => data[f] = document.getElementById(`field - ${f} `).value);
                await onAdd(data);
                modal.classList.add('hidden');
                if (window.reloadCurrentSubTab) window.reloadCurrentSubTab();
            });
        });
    });

    const safeTitle = title.replace(/\s/g, '');

    window[`deleteItem_${safeTitle} `] = async (id) => {
        showCustomConfirm('¿Eliminar este elemento?', async () => {
            await onDelete(id);
            if (window.reloadCurrentSubTab) window.reloadCurrentSubTab();
        });
    };

    if (onEdit) {
        window[`editItem_${safeTitle} `] = async (id) => {
            const item = items.find(x => x.id === id);
            if (!item) return;

            const inputs = fields.map(f => `
    <div>
                    <label class="block text-xs uppercase text-gray-700 dark:text-gray-400 mb-1 font-bold">${f}</label>
                    <input type="text" id="edit-field-${f}" value="${item[f] || ''}" class="${inputClasses}">
                </div>
`).join('');

            showModal(`
    <h3 class="text-xl font-bold mb-4 text-teal-600 dark:text-teal-400"> Editar ${title}</h3>
                <div class="space-y-2">
                    ${inputs}
                </div>
                <button id="update-item" class="w-full bg-teal-600 py-3 rounded-lg text-white font-bold mt-4 shadow-lg shadow-teal-500/20">Actualizar</button>
`, async (modal) => {
                document.getElementById('update-item').addEventListener('click', async () => {
                    const data = {};
                    fields.forEach(f => data[f] = document.getElementById(`edit - field - ${f} `).value);
                    await onEdit(id, data);
                    modal.classList.add('hidden');
                    // showCustomAlert("Actualizado."); // Removed alert
                    if (window.reloadCurrentSubTab) window.reloadCurrentSubTab();
                });
            });
        };
    }
};

// --- PUBLIC PREACHING TAB ---

const renderPredicacionTab = async (container) => {
    const data = await getPredicacionPublica();
    const publicadores = await getPublicadores();
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const config = await getConfiguracion();

    container.innerHTML = `
    <div class="space-y-8">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h3 class="text-h3 text-slate-900 dark:text-white flex items-center gap-3">
                        <i class="fas fa-street-view text-primary"></i> Predicación Pública
                    </h3>
                    <p class="text-xs text-slate-500 mt-1">Gestión centralizada de turnos y puestos de predicación</p>
                </div>
                <div class="flex items-center gap-4">
                    <div id="public-save-status" class="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest opacity-0 transition-opacity">
                        <span class="w-2 h-2 bg-primary rounded-full animate-pulse"></span> Guardando cambios...
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button id="toggle-view-btn" class="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-5 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-3 text-xs uppercase tracking-wider">
                            <i class="fas fa-th-large"></i> Vista Matriz
                        </button>
                        <button id="add-row-btn" class="bg-primary hover:bg-primary-light text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-3 text-xs uppercase tracking-wider">
                            <i class="fas fa-plus-circle"></i> Nuevo Turno
                        </button>
                        <button id="export-pdf" class="bg-accent/10 hover:bg-accent/20 text-accent px-5 py-3 rounded-xl font-bold border border-accent/20 transition-all flex items-center gap-3 text-xs uppercase tracking-wider">
                            <i class="fas fa-file-pdf"></i> Exportar
                        </button>
                    </div>
                </div>
            </header>

            <div class="md:hidden flex items-center justify-center gap-2 p-3 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-widest border-y border-primary/10">
                <i class="fas fa-arrows-alt-h animate-pulse"></i> Desliza para ver más columnas
            </div>

            <div class="modern-card !p-0 overflow-hidden border border-slate-200 dark:border-white/5 min-h-[400px] overflow-x-auto" id="pdf-content">
                <div class="table-container custom-scrollbar overflow-x-auto">
                    <table class="w-full text-left border-collapse min-w-[700px] mb-8">
                        <thead class="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[8px] md:text-[9px] font-bold uppercase tracking-[0.2em] sticky top-0 z-10 border-b border-slate-200 dark:border-white/5">
                            <tr>
                                <th class="p-4 md:p-5 w-32 md:w-40">Día</th>
                                <th class="p-4 md:p-5 w-40 md:w-48 text-center">Horario</th>
                                <th class="p-4 md:p-5">Lugar</th>
                                <th class="p-4 md:p-5 w-1/4">Publicador</th>
                                <th class="p-4 md:p-5 w-1/4">Compañero</th>
                                <th class="p-4 md:p-5 text-right no-print">Op.</th>
                            </tr>
                        </thead>
                        <tbody id="public-table-body" class="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                            <!-- Rows generated here -->
                        </tbody>
                    </table>
                </div>
                ${!data.asignaciones || data.asignaciones.length === 0 ? `
                <div class="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-white/10">
                    <div class="w-20 h-20 mb-4 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center text-3xl">
                        <i class="fas fa-calendar-plus opacity-20"></i>
                    </div>
                    <p class="text-xs font-black uppercase tracking-widest opacity-50">No hay turnos registrados</p>
                </div>` : ''}
            </div>

            <datalist id="list-publicadores">
                ${publicadores.map(p => `<option value="${p.nombre}">`).join('')}
            </datalist>
        </div>
    `;

    const tbody = document.getElementById('public-table-body');

    const renderRows = () => {
        if (!tbody) return;
        tbody.innerHTML = (data.asignaciones || []).map((row, index) => `
    <tr class="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                <td class="p-3">
                    <select class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-primary transition-all cursor-pointer appearance-none"
                        onchange="updateRow(${index}, 'dia', this.value)">
                        <option value="" disabled ${!row.dia ? 'selected' : ''}>Día...</option>
                        ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d =>
            `<option value="${d}" ${row.dia === d ? 'selected' : ''}>${d}</option>`
        ).join('')}
                    </select>
                </td>
                <td class="p-3">
                    <div class="flex items-center gap-1.5 justify-center">
                        <input type="time" class="w-24 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-100 outline-none focus:border-primary transition-all text-center"
                            value="${row.hora || ''}"
                            onchange="updateRow(${index}, 'hora', this.value)">
                        <span class="text-slate-300 dark:text-white/10">—</span>
                        <input type="time" class="w-24 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-100 outline-none focus:border-primary transition-all text-center"
                            value="${row.hora_fin || ''}"
                            onchange="updateRow(${index}, 'hora_fin', this.value)">
                    </div>
                </td>
                <td class="p-3">
                    <select class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-primary transition-all cursor-pointer appearance-none"
                        onchange="updateRow(${index}, 'lugar', this.value)">
                        <option value="" disabled ${!row.lugar ? 'selected' : ''}>Puesto...</option>
                        ${(config.lugares || []).map(lugar =>
            `<option value="${lugar}" ${row.lugar === lugar ? 'selected' : ''}>${lugar}</option>`
        ).join('')}
                        ${row.lugar && !(config.lugares || []).includes(row.lugar) ? `<option value="${row.lugar}" selected>${row.lugar} (Personalizado)</option>` : ''}
                    </select>
                </td>
                <td class="p-3">
                    <input list="list-publicadores" type="text"
                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-200 outline-none focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-white/10"
                        value="${row.publicador || ''}"
                        placeholder="Publicador..."
                        onchange="updateRow(${index}, 'publicador', this.value)">
                </td>
                <td class="p-3">
                    <input list="list-publicadores" type="text"
                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-200 outline-none focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-white/10"
                        value="${row.companero || ''}"
                        placeholder="Compañero..."
                        onchange="updateRow(${index}, 'companero', this.value)">
                </td>
                <td class="p-2 md:p-3 text-right no-print opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                        onclick="deletePublicRow(${index})" title="Eliminar Turno">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    };
    renderRows();

    window.deletePublicRow = async (index) => {
        showCustomConfirm("¿Eliminar este turno de predicación?", async () => {
            data.asignaciones.splice(index, 1);
            await savePredicacionPublica(data);
            renderRows();
            showNotification("Turno eliminado correctamente");
        });
    };

    document.getElementById('add-row-btn').addEventListener('click', async () => {
        data.asignaciones = data.asignaciones || [];
        data.asignaciones.push({ dia: '', hora: '', hora_fin: '', lugar: '', publicador: '', companero: '' });
        await savePredicacionPublica(data);
        renderRows();
        setTimeout(() => {
            const tableContainer = document.querySelector('.overflow-x-auto');
            if (tableContainer) tableContainer.scrollTop = tableContainer.scrollHeight;
        }, 100);
    });

    window.updateRow = async (index, field, value) => {
        const status = document.getElementById('public-save-status');
        if (status) status.classList.replace('opacity-0', 'opacity-100');

        data.asignaciones[index][field] = value;
        try {
            await savePredicacionPublica(data);
        } catch (e) {
            console.error(e);
            showNotification("Error al autoguardar", "error");
        } finally {
            if (status) {
                setTimeout(() => {
                    status.classList.replace('opacity-100', 'opacity-0');
                }, 1000);
            }
        }
    };

    // PDF Export Logic
    document.getElementById('export-pdf').addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');

        const content = document.getElementById('pdf-content');

        showNotification("Generando documento PDF...", "info");

        html2canvas(content, {
            scale: 2,
            backgroundColor: '#ffffff',
            ignoreElements: (element) => element.classList.contains('no-print')
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            doc.save(`Predicacion_Publica_${new Date().toISOString().split('T')[0]}.pdf`);
            showNotification("PDF descargado con éxito", "success");
        });
    });

    const renderMatrix = () => {
        const matrixContainer = document.getElementById('pdf-content');
        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const byDay = {};
        dias.forEach(d => byDay[d] = (data.asignaciones || []).filter(a => a.dia === d && (a.hora || a.lugar || a.publicador)).sort((a, b) => (a.hora || '').localeCompare(b.hora || '')));

        matrixContainer.innerHTML = `
            <div class="p-4 md:p-8 grid grid-cols-1 md:grid-cols-7 gap-4 md:gap-5 bg-slate-50 dark:bg-black/20 overflow-x-auto custom-scrollbar min-h-[500px]">
                ${dias.map(dia => `
                    <div class="flex flex-col gap-4 min-w-[150px]">
                        <div class="p-4 bg-primary text-white text-center font-black rounded-2xl shadow-lg text-[10px] uppercase tracking-[0.2em] shadow-primary/20">${dia}</div>
                        <div class="flex flex-col gap-3">
                            ${byDay[dia].length > 0 ? byDay[dia].map(row => {
            const originalIdx = (data.asignaciones || []).indexOf(row);
            return `
                                    <div class="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm group relative hover:border-primary transition-all duration-300">
                                        <div class="text-[9px] font-black text-primary mb-2 flex items-center gap-2">
                                            <i class="far fa-clock"></i>
                                            ${row.hora || '??:??'} - ${row.hora_fin || '??:??'}
                                        </div>
                                        <div class="text-[11px] font-extrabold text-slate-800 dark:text-white truncate mb-3 leading-tight uppercase tracking-tight">${row.lugar || 'Sin lugar'}</div>
                                        <div class="space-y-1.5 border-t border-slate-100 dark:border-white/5 pt-3">
                                             <div class="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 truncate font-bold" title="${row.publicador || '-'}">
                                                <i class="fas fa-user-circle opacity-40"></i> ${row.publicador || '-'}
                                             </div>
                                             <div class="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-2 truncate" title="${row.companero || '-'}">
                                                <i class="fas fa-users opacity-40"></i> ${row.companero || '-'}
                                             </div>
                                        </div>
                                        <button class="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-all bg-red-500 text-white rounded-xl w-7 h-7 flex items-center justify-center text-[10px] shadow-lg hover:scale-110 active:scale-95" 
                                            onclick="deletePublicRow(${originalIdx})">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                `;
        }).join('') : `
                                <div class="text-[10px] text-slate-400 text-center py-10 italic border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl flex flex-col items-center gap-2">
                                    <i class="fas fa-calendar-check opacity-20 text-xl"></i>
                                    Libre
                                </div>`}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    let currentView = 'table';
    const originalTableContent = document.getElementById('pdf-content').innerHTML;

    document.getElementById('toggle-view-btn')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        if (currentView === 'table') {
            currentView = 'matrix';
            btn.innerHTML = '<i class="fas fa-list"></i> Vista Tabla';
            renderMatrix();
        } else {
            currentView = 'table';
            btn.innerHTML = '<i class="fas fa-th-large"></i> Vista Matriz';
            document.getElementById('pdf-content').innerHTML = originalTableContent;
            renderRows();
        }
    });
};

// --- UTILS ---

const showModal = (content, onOpen, maxWidth = 'max-w-md', containerId = 'modal-container') => {
    const modalContainer = document.getElementById(containerId);

    const handleEsc = (e) => {
        if (e.key === 'Escape') closeModal();
    };

    const closeModal = () => {
        modalContainer.classList.add('hidden');
        modalContainer.innerHTML = '';
        window.removeEventListener('keydown', handleEsc);
    };

    modalContainer.innerHTML = `
        <div class="w-full ${maxWidth} relative animate-fade-in bg-white dark:bg-[#0a0a0a] flex flex-col rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] max-h-[95vh] border border-gray-100 dark:border-white/10 overflow-hidden m-2 sm:m-4">
            <button class="absolute top-4 right-4 text-white/50 hover:text-white z-[60] p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-all border border-white/5 group shadow-lg" 
                    id="modal-close-btn">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                ${content}
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');

    const closeBtn = modalContainer.querySelector('#modal-close-btn');
    if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closeModal(); };

    modalContainer.onclick = (e) => { if (e.target === modalContainer) closeModal(); };

    window.addEventListener('keydown', handleEsc);

    if (onOpen) onOpen(modalContainer);
};

// showCustomAlert and showCustomConfirm were moved to top level
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

    // Filter personnel by 'es_conductor' for both Conductor and Auxiliar roles
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
        <div class="max-w-[1700px] mx-auto space-y-8 animate-fade-in">
            <header class="flex flex-col xl:flex-row items-center justify-between gap-6">
                <div class="flex items-center gap-5">
                    <div class="w-14 h-14 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl flex items-center justify-center text-2xl text-white shadow-xl shadow-primary/20">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <div>
                        <h3 class="text-h3 text-slate-900 dark:text-white !mb-0.5">Programa Semanal</h3>
                        <p class="text-xs text-slate-500">Planificación estratégica de salidas de campo</p>
                    </div>
                </div>
                
                <div class="flex flex-wrap items-center justify-center gap-3">
                    <div class="flex items-center bg-slate-100 dark:bg-white/5 rounded-2xl p-1 border border-slate-200 dark:border-white/5">
                         <button id="prev-week" class="p-3 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-primary">
                            <i class="fas fa-chevron-left"></i>
                         </button>
                         <div class="px-6 py-2 min-w-[180px] text-center">
                             <span id="week-range-label" class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Cargando...</span>
                         </div>
                         <button id="next-week" class="p-3 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-primary">
                            <i class="fas fa-chevron-right"></i>
                         </button>
                    </div>

                    <div class="flex gap-2">
                        <button id="btn-reset-today" class="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-5 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs uppercase tracking-wider">Hoy</button>
                        <div class="w-px h-10 bg-slate-200 dark:bg-white/10 mx-1"></div>
                        <button id="btn-copy-prev" class="p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-indigo-500 rounded-xl transition-all" title="Copiar Semana Anterior">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button id="btn-clear-week" class="p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-red-500 rounded-xl transition-all" title="Limpiar Semana">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <button id="export-excel-plain" class="p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-emerald-500 rounded-xl transition-all" title="Exportar Excel">
                            <i class="fas fa-file-excel"></i>
                        </button>
                        <button id="export-png" class="p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-amber-500 rounded-xl transition-all" title="Imprimir / PDF">
                            <i class="fas fa-print"></i>
                        </button>
                    </div>
                </div>
            </header>

            <div class="relative group">
                <div id="prog-loading-overlay" class="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-50 backdrop-blur-sm flex items-center justify-center hidden rounded-3xl">
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
            } else {
                programa = {
                    id: weekId,
                    dias: dayNames.map(name => ({
                        nombre: name,
                        manana: {}, tarde: {}, noche: {}, zoom: {}
                    }))
                };
            }
            _globalPrograma = programa;

            const monday = currentWeekStart;
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            const rangeText = `${monday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — ${sunday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`.toUpperCase();

            const lblRange = container.querySelector('#week-range-label');
            if (lblRange) lblRange.innerText = rangeText;

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
            { id: 'manana', icon: 'fa-sun', label: 'Mañana', color: 'text-cyan-500', bg: 'bg-cyan-500/5', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'] },
            { id: 'tarde', icon: 'fa-cloud-sun', label: 'Tarde', color: 'text-orange-500', bg: 'bg-orange-500/5', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'] },
            { id: 'noche', icon: 'fa-moon', label: 'Noche', color: 'text-indigo-500', bg: 'bg-indigo-500/5', fields: ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'] },
            { id: 'zoom', icon: 'fa-video', label: 'Zoom', color: 'text-emerald-500', bg: 'bg-emerald-500/5', fields: ['Lugar', 'Hora', 'Conductor', 'Faceta'] }
        ];

        let html = `
            <!-- Sroll Indicator mobile -->
            <div class="sm:hidden flex items-center justify-center gap-2 mb-4 animate-pulse">
                <i class="fas fa-arrows-left-right text-primary"></i>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Desliza para ver más columnas</span>
            </div>

            <div class="table-container overflow-x-auto custom-scrollbar">
                <table class="w-full text-left border-collapse min-w-[1300px] table-fixed">
                    <thead>
                        <tr class="bg-slate-50 dark:bg-black/20 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-200 dark:border-white/5">
                            <th class="p-4 w-24 sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-white/5">Día</th>
                            ${turnos.map(t => `
                                <th class="p-4">
                                    <div class="flex items-center gap-2">
                                        <div class="w-7 h-7 ${t.bg} ${t.color} rounded-lg flex items-center justify-center text-[10px] shadow-sm">
                                            <i class="fas ${t.icon}"></i>
                                        </div>
                                        <span class="tracking-widest">${t.label}</span>
                                    </div>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-white/5">
        `;

        programa.dias.forEach((dia, dayIndex) => {
            html += `<tr class="group/row">
                <td class="p-4 sticky left-0 z-20 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 group-hover/row:bg-slate-50 dark:group-hover/row:bg-white/[0.02] transition-colors">
                    <div class="flex flex-col items-center">
                        <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">${dia.nombre}</span>
                        <span class="text-lg font-black text-slate-800 dark:text-white uppercase">${dia.nombre.substring(0, 3)}</span>
                    </div>
                </td>`;

            turnos.forEach(t => {
                const turnoId = t.id;
                // Allow Zoom turn for all days in Admin view to provide maximum flexibility

                if (!dia[turnoId]) dia[turnoId] = {};
                const data = dia[turnoId];

                html += `
                    <td class="p-3 align-top transition-colors border-r border-slate-100 dark:border-white/5 last:border-r-0">
                        <div class="space-y-3 relative">
                            ${(() => {
                        if (!data.territorio) return '';
                        const tNum = data.territorio.split(',')[0].trim();
                        const terr = territorios.find(x => x.numero == tNum);
                        if (!terr) return '';

                        // Informational entry if missing Conductor or Territory (already checked)
                        if (!data.conductor) return '';

                        // Check sync status: Assigned to this conductor
                        const isSynced = terr.asignado_a === data.conductor;
                        return `
                            <div class="absolute -top-1 -right-1 z-10 w-6 h-6 rounded-lg flex items-center justify-center shadow-lg border border-white dark:border-slate-800 ${isSynced ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}" title="${isSynced ? 'Sincronizado con Asignaciones' : 'Desajuste de Asignación'}">
                                <i class="fas ${isSynced ? 'fa-check' : 'fa-exclamation-triangle'} text-[10px]"></i>
                            </div>`;
                    })()}

                            <div class="space-y-3">
                `;

                t.fields.forEach(field => {
                    const isWeekend = dia.nombre === 'Sábado' || dia.nombre === 'Domingo';
                    if (field === 'Grupos' && !isWeekend) return;

                    const fieldId = field.toLowerCase();
                    const val = data[fieldId] || '';
                    const icon = getFieldIcon(field);
                    const opts = options[field] || [];

                    if (field === 'Territorio') {
                        html += `
                            <div class="space-y-1">
                                <label class="text-[8px] font-bold text-slate-400 tracking-widest uppercase ml-1 flex items-center gap-1.5">
                                    <i class="fas fa-map-marked-alt opacity-50"></i> ${field}
                                </label>
                                <button onclick="window.openTerritorySelector(${dayIndex}, '${turnoId}', this)" 
                                        data-current="${val.replace(/"/g, '&quot;')}"
                                        class="w-full text-left bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 p-2.5 rounded-xl hover:border-primary transition-all flex items-center justify-between group/btn shadow-sm">
                                    <span class="text-[11px] font-bold truncate ${val ? 'text-primary' : 'text-slate-400 opacity-50'}">${val || 'S-##'}</span>
                                    <i class="fas fa-chevron-down text-[9px] opacity-20 group-hover/btn:opacity-100"></i>
                                </button>
                            </div>`;
                    } else if (field === 'Grupos') {
                        html += `
                            <div class="space-y-1">
                                <label class="text-[8px] font-bold text-slate-400 tracking-widest uppercase ml-1 flex items-center gap-1.5">
                                    <i class="fas fa-users opacity-50"></i> ${field}
                                </label>
                                <button onclick="window.openGroupSelector(${dayIndex}, '${turnoId}', this)" 
                                        data-current="${val.replace(/"/g, '&quot;')}"
                                        class="w-full text-left bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 p-2.5 rounded-xl hover:border-indigo-500 transition-all flex items-center justify-between group/btn shadow-sm">
                                    <span class="text-[11px] font-bold truncate ${val ? 'text-indigo-500' : 'text-slate-400 opacity-50'}">${val || 'Punto de reunión'}</span>
                                    <i class="fas fa-chevron-down text-[9px] opacity-20 group-hover/btn:opacity-100"></i>
                                </button>
                            </div>`;
                    } else if (opts.length > 0) {
                        html += `
                            <div class="space-y-1">
                                <label class="text-[8px] font-bold text-slate-400 tracking-widest uppercase ml-1 flex items-center gap-1.5">
                                    <i class="fas ${icon} opacity-50"></i> ${field}
                                </label>
                                <div class="relative">
                                    <select onchange="window.updateWeekData(${dayIndex}, '${turnoId}', '${fieldId}', this.value)" 
                                            class="w-full bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 p-2.5 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary appearance-none cursor-pointer shadow-sm">
                                        <option value="">${field}...</option>
                                        ${opts.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
                                    </select>
                                    <i class="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[9px] opacity-20 pointer-events-none"></i>
                                </div>
                            </div>`;
                    }
                });

                html += `</div></div></td>`;
            });
            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        tableContainer.innerHTML = html;
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

    container.querySelector('#prev-week').onclick = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() - 7);
        currentWeekStart = d;
        loadWeekData();
    };

    container.querySelector('#next-week').onclick = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + 7);
        currentWeekStart = d;
        loadWeekData();
    };

    if (container.querySelector('#btn-reset-today')) {
        container.querySelector('#btn-reset-today').onclick = () => {
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

    container.querySelector('#export-excel-plain').onclick = () => {
        generatePlainXLS(programa, `Programa_${formatDateId(currentWeekStart)} `);
        showNotification("Generando Excel...", "info");
    };

    container.querySelector('#export-png').onclick = async () => {
        window.print();
    };

    loadWeekData();
};

window.updateWeekData = (dayIndex, turnoId, field, value) => {
    if (!_globalPrograma) return;
    if (!_globalPrograma.dias[dayIndex][turnoId]) _globalPrograma.dias[dayIndex][turnoId] = {};

    _globalPrograma.dias[dayIndex][turnoId][field] = value;

    // Visual Status
    const statusIndicator = document.getElementById('save-status');
    if (statusIndicator) {
        statusIndicator.style.opacity = '1';
        statusIndicator.innerHTML = '<span class="animate-pulse">●</span> Guardando...';
    }

    // Debounced Save
    clearTimeout(window._saveTimer);
    window._saveTimer = setTimeout(async () => {
        try {
            const weekId = _globalPrograma.id || formatDateId(window._currentWeekStartGlobal || new Date());

            // 1. Save Weekly Program document
            await saveProgramaSemanal(weekId, _globalPrograma);

            // 2. Bilateral Sync: Check if we need to Create/Cancel Assignment in 'territorios' collection
            const today = new Date();
            const thisWeekNum = getMonday(today).getTime();
            const progWeekDate = new Date(weekId + 'T12:00:00Z');
            const progWeekNum = progWeekDate.getTime();

            // Only sync for present or future weeks
            if (progWeekNum >= (thisWeekNum - 86400000)) { // Small buffer
                const tData = _globalPrograma.dias[dayIndex][turnoId];

                // If it's a sync-critical field (territory or conductor)
                if (['conductor', 'territorio', 'auxiliar', 'lugar', 'hora', 'faceta', 'grupos'].includes(field)) {
                    if (tData.territorio && tData.conductor) {
                        const extra = {
                            auxiliar: tData.auxiliar || '',
                            lugar: tData.lugar || '',
                            hora: tData.hora || '',
                            turno: turnoId,
                            faceta: tData.faceta || '',
                            grupos: tData.grupos || '',
                            fecha_asignacion: progWeekDate.toISOString()
                        };

                        const parts = tData.territorio.split(',').map(s => s.trim());
                        for (const part of parts) {
                            const match = part.match(/^(\d+)(?:\s*\((.*)\))?$/);
                            if (match) {
                                const num = match[1];
                                const mzsStr = match[2];
                                const conductor = tData.conductor;
                                const candidates = _globalTerritorios.filter(t => t.numero == num);

                                let targetId = null;
                                let mzsToAssign = [];

                                if (mzsStr) {
                                    mzsToAssign = mzsStr.split(',').map(m => m.trim());
                                    const perfect = candidates.find(c => {
                                        if (!c.manzanas) return false;
                                        const cMzs = c.manzanas.split(',').map(s => s.trim());
                                        return mzsToAssign.every(m => cMzs.includes(m));
                                    });
                                    if (perfect) targetId = perfect.id;
                                } else if (candidates.length > 0) {
                                    targetId = candidates[0].id;
                                }

                                if (targetId) {
                                    if (mzsToAssign.length > 0) await assignTerritorioParcial(targetId, mzsToAssign, conductor, extra);
                                    else await assignTerritorio(targetId, conductor, extra);
                                }
                            }
                        }
                    }
                }
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


/* --- S-13 COMMAND CENTER (POWER UP) --- */
const renderS13CommandCenter = async (container) => {
    const [history, config, territories] = await Promise.all([
        getHistorialReport(),
        getConfiguracion(),
        getTerritorios()
    ]);

    let activeView = 'management';

    // --- Metric Calculations ---
    const touchedNums = new Set(history.map(h => String(h.numero)));
    const totalT = territories.length;
    const coveragePercent = totalT > 0 ? Math.round((touchedNums.size / totalT) * 100) : 0;
    const missingCount = territories.filter(t => !touchedNums.has(String(t.numero))).length;

    const territoryFreq = {};
    history.forEach(h => {
        if (!h.numero) return;
        territoryFreq[h.numero] = (territoryFreq[h.numero] || 0) + 1;
    });
    const mostFreqSorted = Object.entries(territoryFreq).sort((a, b) => b[1] - a[1]);
    const topTerritory = mostFreqSorted[0]?.[0] || '--';
    const topCount = mostFreqSorted[0]?.[1] || 0;

    const latestTouch = {};
    history.forEach(h => {
        const d = h.fecha_entrega || h.fecha_asignacion;
        if (!d) return;
        if (!latestTouch[h.numero] || new Date(d) > new Date(latestTouch[h.numero])) {
            latestTouch[h.numero] = d;
        }
    });

    const rezagoSorted = territories.filter(t => latestTouch[t.numero]).sort((a, b) => new Date(latestTouch[a.numero]) - new Date(latestTouch[b.numero]));
    const oldestTerritory = rezagoSorted[0]?.numero || '--';
    const daysRezago = rezagoSorted[0] ? Math.floor((new Date() - new Date(latestTouch[rezagoSorted[0].numero])) / (1000 * 60 * 60 * 24)) : 0;

    container.innerHTML = `
    <div class="space-y-8 animate-fade-in">
            <!--Stats Dashboard-->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="bg-gradient-to-br from-primary to-indigo-600 p-8 rounded-[2rem] text-white shadow-xl shadow-primary/20 group relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                    <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-2">Cobertura Global</p>
                    <p class="text-4xl font-black tabular-nums">${coveragePercent}%</p>
                    <div class="flex items-center gap-2 mt-4 text-[9px] font-bold uppercase tracking-widest opacity-60">
                         <i class="fas fa-chart-pie"></i> ${touchedNums.size} de ${totalT} abarcados
                    </div>
                </div>
                
                <div class="modern-card group border-slate-200 dark:border-white/5 shadow-xl">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Territorios Faltantes</p>
                    <p class="text-4xl font-black text-red-500 tabular-nums">${missingCount}</p>
                    <div class="flex items-center gap-3 mt-4">
                        <div class="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div class="h-full bg-red-500 rounded-full" style="width: ${100 - coveragePercent}%"></div>
                        </div>
                        <span class="text-[10px] font-black text-red-500 uppercase">Faltan</span>
                    </div>
                </div>

                <div class="modern-card border-slate-200 dark:border-white/5 shadow-xl">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Uso Frecuente</p>
                    <p class="text-2xl font-black text-slate-800 dark:text-white truncate">Territorio ${topTerritory}</p>
                    <div class="flex items-center gap-2 mt-4 text-[9px] text-indigo-500 font-bold uppercase tracking-widest">
                        <i class="fas fa-redo-alt"></i> Predicado ${topCount} veces
                    </div>
                </div>

                <div class="modern-card border-slate-200 dark:border-white/5 shadow-xl">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Mayor Rezago</p>
                    <p class="text-2xl font-black text-orange-600 truncate">#${oldestTerritory}</p>
                    <div class="flex items-center gap-2 mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        <i class="fas fa-history"></i> Hace ${daysRezago} días
                    </div>
                </div>
            </div>

            <!--Unified Control Bar-->
            <div class="modern-card !p-6 flex flex-col lg:flex-row items-center gap-6 border-slate-200 dark:border-white/5 shadow-2xl">
                <!-- Left: Date Filters -->
                <div class="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Año</label>
                        <select id="report-year-select" class="bg-white dark:bg-slate-800 border-none rounded-xl px-4 p-2 text-xs font-bold outline-none text-slate-700 dark:text-white shadow-sm cursor-pointer">
                             <!-- Year options -->
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Desde</label>
                        <input type="date" id="report-start" class="bg-white dark:bg-slate-800 border-none rounded-xl px-4 p-2 text-xs font-bold outline-none text-slate-700 dark:text-white shadow-sm">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Hasta</label>
                        <input type="date" id="report-end" class="bg-white dark:bg-slate-800 border-none rounded-xl px-4 p-2 text-xs font-bold outline-none text-slate-700 dark:text-white shadow-sm">
                    </div>
                </div>

                <!-- Center: Universal Search -->
                <div class="relative flex-1 group min-w-[200px] w-full lg:w-auto">
                    <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">
                        <i class="fas fa-search"></i>
                    </span>
                    <input type="text" id="cc-universal-search" placeholder="Búsqueda global (Conductor, #, Estado)..." class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl pl-12 pr-6 py-4 text-xs font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white placeholder:text-slate-400">
                </div>

                <!-- Right: Actions -->
                <div class="flex items-center gap-3">
                    <button id="cc-btn-generate" class="bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-3 whitespace-nowrap">
                        <i class="fas fa-file-invoice"></i> Generar Reporte
                    </button>
                    <div class="h-10 w-px bg-slate-200 dark:bg-white/10 mx-2"></div>
                    <button id="cc-btn-tools" class="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all border border-slate-200 dark:border-white/5" title="Herramientas Avanzadas">
                        <i class="fas fa-tools"></i>
                    </button>
                </div>
            </div>

            <!--View Toggle & Sub - Content-->
    <div class="space-y-6">
        <nav class="flex gap-2 p-1.5 bg-slate-100 dark:bg-white/5 w-fit rounded-2xl border border-slate-200 dark:border-white/5">
            <button class="cc-view-btn px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeView === 'management' ? 'bg-white dark:bg-white/10 shadow-lg text-accent' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}" data-view="management">
                <i class="fas fa-database"></i> Gestión de Historial
            </button>
            <button class="cc-view-btn px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeView === 's13' ? 'bg-white dark:bg-white/10 shadow-lg text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}" data-view="s13">
                <i class="fas fa-list-alt"></i> Reporte S-13
            </button>
        </nav>

        <div id="cc-main-container" class="min-h-[600px] modern-card !p-0 overflow-hidden border-slate-100 dark:border-white/5">
            <!-- Dynamic View Content -->
        </div>
    </div>
        </div>
    `;

    // Initialize Year Selector
    const yearSelect = container.querySelector('#report-year-select');
    const startInput = container.querySelector('#report-start');
    const endInput = container.querySelector('#report-end');

    const now = new Date();
    const serviceYear = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
    for (let y = serviceYear - 5; y <= serviceYear + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === serviceYear) opt.selected = true;
        opt.className = "dark:bg-slate-800 text-slate-800 dark:text-white";
        yearSelect.appendChild(opt);
    }

    const setDatesFromSY = (sy) => {
        const y = parseInt(sy);
        const start = `${y - 1} -09-01`;
        const end = `${y} -08 - 31`;
        startInput.value = start;
        endInput.value = end;
    };
    setDatesFromSY(serviceYear);
    yearSelect.onchange = (e) => setDatesFromSY(e.target.value);

    // View Loading Logic
    const loadView = async (view) => {
        activeView = view;
        const mainCont = container.querySelector('#cc-main-container');
        mainCont.innerHTML = `
    <div class="flex flex-col items-center justify-center p-40 gap-4 animate-pulse">
                <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p class="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Preparando vista inteligente...</p>
            </div> `;

        // Update Buttons
        container.querySelectorAll('.cc-view-btn').forEach(btn => {
            const isActive = btn.dataset.view === view;
            btn.classList.toggle('active', isActive);
            if (!isActive) {
                btn.className = "cc-view-btn px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200";
            }
        });

        if (view === 's13') {
            await renderHistoryTab(mainCont, {
                showHeader: false,
                startInput: startInput,
                endInput: endInput
            });
            const genBtn = container.querySelector('#cc-btn-generate');
            genBtn.innerHTML = '<i class="fas fa-file-invoice"></i> Generar S-13';
            genBtn.onclick = () => document.getElementById('btn-generate-report')?.click();
        } else {
            await renderAdvancedHistoryView(mainCont, {
                showHeader: false,
                searchInputId: 'cc-universal-search'
            });
            const genBtn = container.querySelector('#cc-btn-generate');
            genBtn.innerHTML = '<i class="fas fa-sync"></i> Sincronizar';
            genBtn.onclick = () => renderS13CommandCenter(container);
        }
    };

    container.querySelectorAll('.cc-view-btn').forEach(btn => {
        btn.onclick = () => loadView(btn.dataset.view);
    });

    container.querySelector('#cc-btn-tools').onclick = () => {
        showModal(`
    <div class="p-8 space-y-8 animate-fade-in">
                <header class="flex items-center gap-4 border-b border-slate-100 dark:border-white/5 pb-6">
                    <div class="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center text-xl shadow-inner">
                        <i class="fas fa-microchip"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Mantenimiento Global</h3>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Herramientas críticas para integridad de datos</p>
                    </div>
                </header>

                <div class="grid grid-cols-1 gap-4">
                    <button id="tool-rebuild" class="flex items-center gap-5 p-6 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all border border-slate-200 dark:border-white/5 group shadow-sm">
                        <div class="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                            <i class="fas fa-hammer"></i>
                        </div>
                        <div class="text-left">
                            <span class="block text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Reconstruir Historial</span>
                            <span class="block text-[10px] text-slate-500 opacity-60 uppercase font-bold mt-1">Escanea programas antiguos para recuperar registros s13 perdidos</span>
                        </div>
                        <i class="fas fa-chevron-right ml-auto text-slate-300 opacity-0 group-hover:opacity-100 transition-all"></i>
                    </button>

                    <button id="tool-repair" class="flex items-center gap-5 p-6 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all border border-slate-200 dark:border-white/5 group shadow-sm">
                        <div class="w-14 h-14 bg-teal-500 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-teal-500/20 group-hover:scale-110 transition-transform">
                            <i class="fas fa-magic"></i>
                        </div>
                        <div class="text-left">
                            <span class="block text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Diagnóstico y Limpieza</span>
                            <span class="block text-[10px] text-slate-500 opacity-60 uppercase font-bold mt-1">Resuelve inconsistencias en asignaciones y estados huérfanos</span>
                        </div>
                        <i class="fas fa-chevron-right ml-auto text-slate-300 opacity-0 group-hover:opacity-100 transition-all"></i>
                    </button>
                    
                    <button onclick="window.repairPhoneStatusOnly()" class="flex items-center gap-5 p-6 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all border border-slate-200 dark:border-white/5 group shadow-sm">
                         <div class="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                            <i class="fas fa-phone-slash"></i>
                        </div>
                        <div class="text-left">
                            <span class="block text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Reparar Telefonía</span>
                            <span class="block text-[10px] text-slate-500 opacity-60 uppercase font-bold mt-1">Resetea estados inconsistentes en registros telefónicos</span>
                        </div>
                        <i class="fas fa-chevron-right ml-auto text-slate-300 opacity-0 group-hover:opacity-100 transition-all"></i>
                    </button>
                </div>
                
                <footer class="pt-4 text-center">
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 dark:bg-white/5 py-3 rounded-xl border border-slate-200 dark:border-white/5">
                        <i class="fas fa-exclamation-triangle text-amber-500 mr-2"></i> Estas acciones modifican la base de datos global
                    </p>
                </footer>
            </div>
    `, (modal) => {
            modal.querySelector('#tool-rebuild').onclick = () => {
                modal.classList.add('hidden');
                document.getElementById('btn-rebuild-history')?.click();
            };
            modal.querySelector('#tool-repair').onclick = async () => {
                modal.classList.add('hidden');
                showNotification("Iniciando diagnóstico profundo...", "info");
                const report = await runSystemDiagnosticsAndRepair(msg => showNotification(msg, 'info'));
                showNotification(`Diagnóstico completo: ${report.fixedPhones} errores corregidos.`, 'success');
            };
        });
    };

    // Initial Load
    loadView('s13');
};


export const renderAdvancedHistoryView = async (container, options = {}) => {
    const showHeader = options.showHeader !== false;

    if (options.showHeader !== false) {
        container.innerHTML = `
    <div class="space-y-6">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h3 class="text-h3 text-slate-900 dark:text-white flex items-center gap-3">
                        <i class="fas fa-database text-accent"></i> Centro de Gestión
                    </h3>
                    <p class="text-xs text-slate-500 mt-1">Auditoría y control total del historial de territorios</p>
                </div>
                <div class="relative w-full md:w-80 group">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-accent transition-colors">
                        <i class="fas fa-search"></i>
                    </span>
                    <input type="text" id="hist-search" placeholder="Buscar conductor, # o estado..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs font-bold outline-none focus:border-accent transition-all text-slate-700 dark:text-white">
                </div>
            </header>

            <div class="modern-card !p-0 overflow-hidden border border-slate-200 dark:border-white/5 min-h-[400px]" id="hist-table-container">
                 <!-- Table content -->
            </div>
        </div>
    `;
    } else {
        container.innerHTML = `
    <div class="min-h-[400px]" id = "hist-table-container">
                <!--Table content-->
            </div>
    `;
    }

    try {
        const [history, territorios] = await Promise.all([
            getHistorialReport(),
            getTerritorios()
        ]);

        // Sort by Date Descending
        let filtered = [...history].sort((a, b) => {
            const tA = a.timestamp ? a.timestamp.toDate() : new Date(a.fecha_asignacion);
            const tB = b.timestamp ? b.timestamp.toDate() : new Date(b.fecha_asignacion);
            return tB - tA;
        });

        const selectedIds = new Set();

        const render = () => {
            const searchEl = document.getElementById(options.searchInputId || "hist-search");
            const searchVal = searchEl ? searchEl.value.toLowerCase() : "";
            const list = filtered.filter(h =>
                (h.conductor || "").toLowerCase().includes(searchVal) ||
                (String(h.numero) || "").toLowerCase().includes(searchVal) ||
                (h.estado || "").toLowerCase().includes(searchVal)
            ).slice(0, 100);

            const bulkBar = `
    <div id = "hist-bulk-bar" class="${selectedIds.size > 0 ? 'flex' : 'hidden'} flex-col md:flex-row items-start md:items-center gap-4 bg-accent/5 p-4 px-6 rounded-2xl border border-accent/20 animate-fade-in mb-6">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-accent text-white rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
                            <i class="fas fa-check-double"></i>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-accent uppercase tracking-widest">Selección Masiva</span>
                            <span class="text-xs font-black text-slate-700 dark:text-white">${selectedIds.size} registros seleccionados</span>
                        </div>
                    </div>
                    <div class="h-8 w-px bg-accent/20 mx-2"></div>
                    <button id="hist-select-all-btn" class="px-5 py-2.5 bg-white dark:bg-white/5 text-accent rounded-xl text-[10px] font-black uppercase tracking-widest border border-accent/20 hover:bg-accent hover:text-white transition-all">
                        Seleccionar todos
                    </button>
                    <button id="hist-bulk-delete" class="ml-auto bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-500/20 transition-all active:scale-95 flex items-center gap-2">
                        <i class="fas fa-trash-alt"></i> Eliminar Selección
                    </button>
                </div>
    `;

            if (list.length === 0) {
                const tableTarget = document.getElementById("hist-table-container");
                if (tableTarget) {
                    tableTarget.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-white/10">
                            <div class="w-20 h-20 mb-4 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center text-3xl">
                                <i class="fas fa-search opacity-20"></i>
                            </div>
                            <p class="text-xs font-black uppercase tracking-widest opacity-50">No se encontraron registros</p>
                        </div> `;
                }
                return;
            }

            let html = `
    <div class="p-4"> ${bulkBar}</div>
                <div class="table-container custom-scrollbar">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] border-b border-slate-200 dark:border-white/5">
                            <tr>
                                <th class="p-6 w-12 text-center">
                                    <input type="checkbox" id="master-select-hist" class="w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-white/10 accent-accent cursor-pointer transition-all" ${selectedIds.size === list.length ? 'checked' : ''}>
                                </th>
                                <th class="p-6 whitespace-nowrap">Fecha Evento</th>
                                <th class="p-6 whitespace-nowrap">Territorio</th>
                                <th class="p-6 whitespace-nowrap">Conductor</th>
                                <th class="p-6 text-center whitespace-nowrap">Estado</th>
                                <th class="p-6 text-right whitespace-nowrap no-print">Opciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                            ${list.map(h => {
                const isSelected = selectedIds.has(h.id);
                const dVal = h.fecha_asignacion || h.timestamp?.toDate();
                const dateStr = dVal ? new Date(dVal).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "-";

                const getStatusStyles = (status) => {
                    const s = (status || "").toLowerCase();
                    if (s === "asignado") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
                    if (s === "completado" || s === "predicado") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                    if (s === "devuelto") return "bg-orange-500/10 text-orange-500 border-orange-500/20";
                    return "bg-slate-500/10 text-slate-500 border-slate-500/20";
                };

                return `
                                <tr class="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group ${isSelected ? 'bg-accent/5' : ''}">
                                    <td class="p-4 text-center">
                                        <input type="checkbox" class="hist-row-check w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-white/10 accent-accent cursor-pointer transition-all" data-id="${h.id}" ${isSelected ? 'checked' : ''}>
                                    </td>
                                    <td class="p-6 font-mono text-[11px] text-slate-500 uppercase tracking-tighter">${dateStr}</td>
                                    <td class="p-6">
                                        <div class="flex items-center gap-2">
                                            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-400">
                                                <i class="fas fa-map"></i>
                                            </div>
                                            <span class="font-black text-slate-800 dark:text-white">Territorio ${h.numero}</span>
                                        </div>
                                    </td>
                                    <td class="p-6">
                                        <div class="flex flex-col">
                                            <span class="font-bold text-slate-700 dark:text-slate-200">${h.conductor}</span>
                                            ${h.auxiliar ? `<span class="text-[10px] text-slate-400 mt-0.5"><i class="fas fa-user-friends mr-1"></i> ${h.auxiliar}</span>` : ""}
                                        </div>
                                    </td>
                                    <td class="p-6 text-center">
                                        <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusStyles(h.estado)}">
                                            ${h.estado}
                                        </span>
                                    </td>
                                    <td class="p-6 text-right">
                                        <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onclick="window.editHistoryRecord('${h.id}')" class="w-9 h-9 flex items-center justify-center text-primary hover:bg-primary/10 rounded-xl transition-all" title="Editar Registro">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="window.deleteHistoryRecordUI('${h.id}', '${h.conductor}', '${h.numero}')" class="w-9 h-9 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all" title="Eliminar Registro">
                                                <i class="fas fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
            }).join("")}
                        </tbody>
                    </table>
                </div>
                <div class="p-6 bg-slate-50/50 dark:bg-black/20 text-center">
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Auditoría: Mostrando últimos ${list.length} movimientos detectados</p>
                </div>
`;
            const tableCont = document.getElementById("hist-table-container");
            if (tableCont) {
                tableCont.innerHTML = html;

                // Event Listeners for checkboxes
                tableCont.querySelectorAll('.hist-row-check').forEach(cb => {
                    cb.onchange = (e) => {
                        const id = cb.dataset.id;
                        if (e.target.checked) selectedIds.add(id);
                        else selectedIds.delete(id);
                        render();
                    };
                });

                const masterCb = tableCont.querySelector('#master-select-hist');
                if (masterCb) {
                    masterCb.onchange = (e) => {
                        if (e.target.checked) {
                            list.forEach(h => selectedIds.add(h.id));
                        } else {
                            list.forEach(h => selectedIds.delete(h.id));
                        }
                        render();
                    };
                }

                const selectAllBtn = tableCont.querySelector('#hist-select-all-btn');
                if (selectAllBtn) {
                    selectAllBtn.onclick = () => {
                        list.forEach(h => selectedIds.add(h.id));
                        render();
                    };
                }

                const bulkDelBtn = tableCont.querySelector('#hist-bulk-delete');
                if (bulkDelBtn) {
                    bulkDelBtn.onclick = async () => {
                        showCustomConfirm(`¿Estás seguro de eliminar los ${selectedIds.size} registros seleccionados de forma permanente ? `, async () => {
                            try {
                                showNotification(`Eliminando ${selectedIds.size} registros...`, "info");
                                const idsToRemove = Array.from(selectedIds);
                                for (const id of idsToRemove) {
                                    await deleteHistoryRecord(id);
                                }
                                showNotification(`${idsToRemove.length} registros eliminados con éxito`, "success");
                                selectedIds.clear();
                                renderAdvancedHistoryView(container, options);
                            } catch (e) {
                                showNotification("Error en eliminación masiva: " + e.message, "error");
                            }
                        });
                    };
                }
            }
        };

        const searchEl = document.getElementById(options.searchInputId || "hist-search");
        if (searchEl) searchEl.addEventListener("input", () => {
            selectedIds.clear(); // Clear selection on search to avoid hidden selections
            render();
        });

        render(); // Initial Render
    } catch (e) {
        console.error(e);
        container.innerHTML = `
    <div class="p-10 text-center">
                <div class="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase">Error en el Centro de Gestión</h4>
                <p class="text-xs text-slate-400 mt-2">${e.message}</p>
            </div> `;
    }
};

window.exportS12Form = async (territorios, layout = 1) => {
    const config = await getConfiguracion();
    const congregacion = config.congregacion?.nombre || "CONGREGACIÓN";

    // Sort territories by number
    const sorted = [...territorios].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: 'base' }));

    const printWindow = window.open('', '_blank');

    const styles = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&family=Inter:wght@400;700&display=swap');
            
            @page { 
                size: A4 ${layout === 4 ? 'landscape' : 'portrait'}; 
                margin: 0; 
            }
            
            body { 
                margin: 0; 
                padding: 0; 
                font-family: 'Inter', sans-serif;
                background: #f8fafc;
            }

            .page { 
                width: ${layout === 4 ? '297mm' : '210mm'}; 
                height: ${layout === 4 ? '210mm' : '297mm'}; 
                padding: 5mm;
                margin: 0 auto; 
                background: white; 
                box-sizing: border-box; 
                page-break-after: always;
                display: flex;
                flex-wrap: wrap;
                align-content: flex-start;
                justify-content: center;
                gap: 5mm;
            }
            
            .s12-card { 
                width: 148mm;
                height: 104mm;
                border: 0.5pt solid #000; 
                padding: 8mm; 
                display: flex; 
                flex-direction: column; 
                position: relative;
                box-sizing: border-box;
                background: white;
                overflow: hidden;
            }
            
            .title { 
                text-align: center; 
                font-size: 16pt; 
                font-weight: 800; 
                margin-bottom: 8pt; 
                text-transform: none;
                font-family: 'Outfit', sans-serif;
                color: #000;
            }

            .header-info { 
                display: flex; 
                align-items: flex-end; 
                gap: 4pt;
                margin-bottom: 8pt; 
            }

            .label { 
                font-size: 11pt; 
                font-weight: 700;
                white-space: nowrap;
            }

            .field-val { 
                font-size: 11pt; 
                border-bottom: 0.5pt solid #000; 
                flex: 1;
                min-height: 1.2em;
                padding-bottom: 1pt;
            }

            .territory-num-box {
                border: 1pt solid #000;
                padding: 2pt 8pt;
                font-size: 14pt;
                font-weight: 800;
                min-width: 40pt;
                text-align: center;
            }
            
            .map-container { 
                flex: 1; 
                border: 0.5pt solid #000; 
                margin: 4pt 0; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                overflow: hidden; 
                background: #fff; 
                position: relative;
            }

            .map-container img { 
                width: 100%; 
                height: 100%; 
                object-fit: contain; 
                display: block;
            }

            .map-placeholder {
                font-size: 10pt;
                color: #666;
                text-align: center;
                font-style: italic;
            }
            
            .footer-note { 
                font-size: 8.5pt; 
                text-align: justify; 
                line-height: 1.2; 
                margin-top: 6pt; 
                font-weight: 400;
                color: #000;
            }

            .footer-id { 
                font-size: 8pt; 
                margin-top: 4pt; 
                display: flex; 
                justify-content: space-between;
                font-weight: 400;
            }
            
            @media print {
                body { background: white; }
                .no-print { display: none !important; }
                .page { padding: 0; margin: 0; }
            }
        </style>
    `;

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
                ${t.imagen ? `<img src="${formatMapUrl(t.imagen)}" onerror="this.parentElement.innerHTML='<div class=\"map-placeholder\">(Error al cargar mapa)</div>'">` : '<div class="map-placeholder">(Pegue el mapa arriba o dibuje el territorio)</div>'}
            </div>

            <div class="footer-note">
                Sírvase mantener esta tarjeta en el sobre. No la manche, marque, ni doble. Cada vez que se haya trabajado completamente el territorio, infórmelo al hermano que atiende los archivos del territorio.
            </div>
            
            <div class="footer-id">
                <span>S-12-S &nbsp;&nbsp; 6/72</span>
            </div>
        </div>
    `;

    let html = `<html><head><title>Formularios S-12</title>${styles}</head><body>`;

    if (layout === 1) {
        sorted.forEach(t => {
            html += `<div class="page" style="justify-content: center; align-items: center;">${renderCard(t)}</div>`;
        });
    } else if (layout === 2) {
        for (let i = 0; i < sorted.length; i += 2) {
            html += `<div class="page" style="flex-direction: column; justify-content: center;">`;
            html += renderCard(sorted[i]);
            if (sorted[i + 1]) html += renderCard(sorted[i + 1]);
            html += `</div>`;
        }
    } else if (layout === 4) {
        for (let i = 0; i < sorted.length; i += 4) {
            html += `<div class="page">`;
            for (let j = 0; j < 4; j++) {
                if (sorted[i + j]) html += renderCard(sorted[i + j]);
            }
            html += `</div>`;
        }
    }

    html += `
        <div class="no-print" style="position: fixed; top: 20px; right: 20px; background: rgba(15, 23, 42, 0.95); color: white; padding: 24px; border-radius: 20px; font-family: 'Outfit', sans-serif; z-index: 9999; box-shadow: 0 20px 50px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px); width: 280px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                <div style="width: 40px; height: 40px; background: #14b8a6; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🖨️</div>
                <div>
                    <p style="margin: 0; font-weight: 800; font-size: 14px; text-transform: uppercase; tracking: 0.1em;">Vista de Impresión</p>
                    <p style="margin: 0; font-size: 11px; opacity: 0.6;">S-12 Configurado</p>
                </div>
            </div>
            <button onclick="window.print()" style="background: #14b8a6; border: none; color: white; padding: 12px 20px; border-radius: 12px; cursor: pointer; font-weight: 800; width: 100%; transition: all 0.3s; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3);">Imprimir S-12</button>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                <p style="margin: 0; font-size: 10px; opacity: 0.7; line-height: 1.4;">
                    <strong>Nota:</strong> Ajuste el destino a "Guardar como PDF" o su impresora, y asegúrese de que el tamaño sea <b>A4</b> y los márgenes <b>Ninguno</b>.
                </p>
            </div>
        </div>
    `;

    html += `</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
};
