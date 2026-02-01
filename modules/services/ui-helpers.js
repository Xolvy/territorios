import * as dateFns from 'date-fns';

export const UIHelpers = {
    fmtDate: (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '',
    fmtDateAt: (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '',

    getMonday: (d) => {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    },

    formatDateId: (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    formatDisplayDateRange: (date) => {
        try {
            const start = new Date(date);
            if (isNaN(start.getTime())) return '';
            const end = new Date(date);
            end.setDate(start.getDate() + 6);
            if (dateFns) {
                return `${dateFns.format(start, 'd MMM')} - ${dateFns.format(end, 'd MMM yyyy')}`;
            }
            const f = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
            return `${f(start)} - ${f(end)}, ${start.getFullYear()}`;
        } catch (e) { return date; }
    }
};

export const showModal = (html, onRender, maxWidth = 'max-w-2xl', containerId = 'modal-container') => {
    const modal = document.getElementById(containerId);
    if (!modal) return;

    modal.innerHTML = `
        <div class="modal-backdrop-area absolute inset-0 cursor-default"></div>
        <div class="relative w-full ${maxWidth} max-h-[90vh] md:max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-black/5 dark:border-white/10 animate-scale-in overflow-hidden z-10">
            ${html}
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (onRender) onRender(modal);

    const close = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        window.removeEventListener('keydown', handleEsc);
    };

    const handleEsc = (e) => {
        if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleEsc);

    modal.querySelector('.modal-backdrop-area').onclick = close;
};

export const showCustomConfirm = (message, onConfirm) => {
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

export const showCustomPrompt = (message, defaultValue, onConfirm) => {
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

export const showCustomAlert = (message) => {
    if (!message) return;
    const type = message.toLowerCase().includes('error') ? 'error' : 'success';
    showNotification(message, type);
};

window.showModal = showModal;
window.showCustomConfirm = showCustomConfirm;
window.showCustomPrompt = showCustomPrompt;
window.showCustomAlert = showCustomAlert;

export const showTerritorySelectionModal = (current, territorios, onSelect, containerId = 'modal-container', historial = []) => {
    let filtered = [...territorios].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

    // --- Power Up: Process Stats ---
    const stats = {};
    if (historial && historial.length > 0) {
        historial.forEach(h => {
            const num = h.numero;
            if (!num) return;
            if (!stats[num]) stats[num] = { count: 0, lastAsig: null, lastEntrega: null };

            // Increment count for each history record (Total times preached)
            stats[num].count++;

            if (h.fecha_asignacion) {
                if (!stats[num].lastAsig || new Date(h.fecha_asignacion) > new Date(stats[num].lastAsig)) {
                    stats[num].lastAsig = h.fecha_asignacion;
                }
            }
            if (h.fecha_entrega) {
                if (!stats[num].lastEntrega || new Date(h.fecha_entrega) > new Date(stats[num].lastEntrega)) {
                    stats[num].lastEntrega = h.fecha_entrega;
                }
            }
        });
    }

    const getFrequencyColor = (count) => {
        if (count === 0) return 'bg-emerald-500'; // Fresco
        if (count < 2) return 'bg-teal-500';
        if (count < 4) return 'bg-amber-500';
        if (count < 6) return 'bg-orange-500';
        return 'bg-rose-500'; // Muy predicado
    };

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
        <div class="flex flex-col h-[85vh] sm:h-[750px] overflow-hidden">
            <header class="shrink-0 bg-slate-900 p-8 text-white relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-br from-primary/20 to-indigo-900/40 backdrop-blur-3xl"></div>
                <div class="relative z-10 flex justify-between items-center">
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Selector Inteligente</h3>
                        <p class="text-[10px] opacity-70 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                           <i class="fas fa-microchip animate-pulse text-primary"></i> 
                           Gestión avanzada de saturación
                        </p>
                    </div>
                    <div class="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-2xl shadow-2xl border border-white/20">
                        <i class="fas fa-map-marked-alt text-primary"></i>
                    </div>
                </div>
            </header>
            
            <div class="flex-1 p-6 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
                <!-- Power Up: Smart Suggestions Section -->
                <div id="modal-suggestions" class="space-y-4">
                     ${(() => {
            const OUTDATED_THRESHOLD = 120; // 4 months
            const now = new Date();

            const incomplete = filtered.filter(t => t.is_incomplete === true);
            const outdated = filtered.filter(t => {
                if (t.is_incomplete) return false; // Already in incomplete
                const s = stats[t.numero];
                if (!s || !s.lastEntrega) return true; // Never preached
                const diff = (now - new Date(s.lastEntrega)) / (1000 * 60 * 60 * 24);
                return diff >= OUTDATED_THRESHOLD;
            }).sort((a, b) => {
                const sa = stats[a.numero]?.lastEntrega || 0;
                const sb = stats[b.numero]?.lastEntrega || 0;
                return new Date(sa) - new Date(sb);
            }).slice(0, 10);

            if (incomplete.length === 0 && outdated.length === 0) return '';

            return `
                             <div class="flex items-center gap-3 mb-2 px-2">
                                 <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs shadow-inner">
                                     <i class="fas fa-magic"></i>
                                 </div>
                                 <h4 class="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Prioridades de Asignación</h4>
                             </div>
                             <div class="flex gap-4 overflow-x-auto pb-4 px-2 snap-x">
                                 ${incomplete.map(s => `
                                     <button onclick="window.modalToggleTerr('${s.numero}')" 
                                             class="snap-center shrink-0 flex flex-col items-start gap-2 p-5 bg-white dark:bg-white/5 border border-rose-500/30 rounded-3xl min-w-[210px] hover:border-rose-500 transition-all shadow-sm active:scale-95 text-left group">
                                         <div class="flex items-center justify-between w-full">
                                             <span class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">T-${s.numero}</span>
                                             <div class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
                                         </div>
                                         <p class="text-[9px] font-bold text-slate-500 dark:text-slate-400 overflow-hidden text-ellipsis line-clamp-1">${s.manzanas || 'Todo'}</p>
                                         <span class="text-[8px] font-black uppercase tracking-widest text-rose-500 mt-1">Urgente: Incompleto</span>
                                     </button>
                                 `).join('')}
                                 ${outdated.map(s => `
                                     <button onclick="window.modalToggleTerr('${s.numero}')" 
                                             class="snap-center shrink-0 flex flex-col items-start gap-2 p-5 bg-white dark:bg-white/5 border border-amber-500/30 rounded-3xl min-w-[210px] hover:border-amber-500 transition-all shadow-sm active:scale-95 text-left group">
                                         <div class="flex items-center justify-between w-full">
                                             <span class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter italic">T-${s.numero}</span>
                                             <div class="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                                         </div>
                                         <p class="text-[9px] font-bold text-slate-500 dark:text-slate-400 overflow-hidden text-ellipsis line-clamp-1">Última: ${stats[s.numero]?.lastEntrega ? UIHelpers.fmtDateAt(stats[s.numero].lastEntrega) : 'Nunca'}</p>
                                         <span class="text-[8px] font-black uppercase tracking-widest text-amber-500 mt-1">Sugerido: Desfasado</span>
                                     </button>
                                 `).join('')}
                             </div>
                             <div class="h-px bg-slate-200 dark:bg-white/10 mx-2 !my-6"></div>
                        `;
        })()}
                </div>

                <div class="flex flex-col md:flex-row gap-4">
                    <div class="relative group flex-1">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 group-focus-within:text-primary transition-colors">
                            <i class="fas fa-search"></i>
                        </span>
                        <input type="text" id="modal-terr-search" placeholder="Buscar por número o manzana..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:border-primary rounded-2xl pl-12 pr-4 py-4 text-sm font-bold shadow-sm outline-none transition-all">
                    </div>
                    <div class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saturación:</span>
                        <div class="flex gap-1">
                            <div class="w-2 h-2 rounded-full bg-emerald-500" title="Baja"></div>
                            <div class="w-2 h-2 rounded-full bg-amber-500" title="Media"></div>
                            <div class="w-2 h-2 rounded-full bg-rose-500" title="Alta"></div>
                        </div>
                    </div>
                </div>
 
                <div id="modal-terr-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        window.modalToggleTerr = (num) => {
            if (num in selections) delete selections[num];
            else selections[num] = null;
            render();
            updatePreview();
        };

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
                const tStats = stats[t.numero] || { count: 0, lastAsig: null, lastEntrega: null };
                const freqColor = getFrequencyColor(tStats.count);
                const allMzs = t.manzanas ? t.manzanas.split(',').map(m => m.trim()).filter(Boolean) : [];

                const fmtShortDate = (d) => {
                    if (!d) return '—';
                    const dt = new Date(d);
                    return dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                };

                return `
                    <div class="modern-card !p-0 transition-all duration-300 group ${isSelected ? 'border-primary shadow-xl ring-2 ring-primary/20' : 'border-slate-100 dark:border-white/5 shadow-sm hover:border-primary/30'}">
                        <label class="flex flex-col cursor-pointer p-4">
                             <div class="flex items-center justify-between mb-4">
                                 <div class="flex items-center gap-3">
                                    <input type="checkbox" class="terr-check w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-white/10 text-primary focus:ring-primary transition-all cursor-pointer" 
                                            data-num="${t.numero}" ${isSelected ? 'checked' : ''}>
                                     <span class="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">#${t.numero}</span>
                                     ${t.is_incomplete ? `<i class="fas fa-magic text-indigo-500 text-[10px] animate-pulse" title="Fragmento sugerido"></i>` : ''}
                                  </div>
                                  <div class="flex items-center gap-2">
                                     <div class="w-1.5 h-1.5 rounded-full ${freqColor} shadow-lg shadow-${freqColor.split('-')[1]}-500/50"></div>
                                     <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">${tStats.count} veces</span>
                                 </div>
                             </div>

                             <div class="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-white/5 pt-3">
                                 <div class="flex flex-col">
                                     <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest">Últ. Asignación</span>
                                     <span class="text-[10px] font-bold text-slate-600 dark:text-slate-300">${fmtShortDate(tStats.lastAsig)}</span>
                                 </div>
                                 <div class="flex flex-col border-l border-slate-100 dark:border-white/5 pl-2">
                                     <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest">Últ. Entrega</span>
                                     <span class="text-[10px] font-bold text-emerald-500">${fmtShortDate(tStats.lastEntrega)}</span>
                                 </div>
                             </div>
                        </label>
                        
                        ${isSelected && allMzs.length > 0 ? `
                            <div class="p-4 pt-0 bg-slate-50/50 dark:bg-black/10 animate-fade-in text-center">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[8px] font-black text-primary uppercase tracking-[0.2em]">Manzanas:</span>
                                    <button class="select-all-mzs text-[8px] font-black text-primary hover:underline" data-num="${t.numero}">Todas</button>
                                </div>
                                <div class="flex flex-wrap gap-1 justify-center">
                                    ${allMzs.map(mz => {
                    const isMzSelected = !selections[t.numero] || selections[t.numero].includes(mz);
                    return `
                                            <label class="px-2 py-1 bg-white dark:bg-white/5 border ${isMzSelected ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-white/5 text-slate-500'} rounded-lg cursor-pointer transition-all text-[9px] font-bold">
                                                <input type="checkbox" class="mz-check hidden" 
                                                       data-num="${t.numero}" data-mz="${mz}" ${isMzSelected ? 'checked' : ''}>
                                                ${mz}
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
            const modalEl = document.getElementById(containerId);
            if (modalEl) {
                modalEl.classList.add('hidden');
                modalEl.innerHTML = '';
            }
        };

        render();
        updatePreview();
    }, 'max-w-4xl', containerId);
};

window.showTerritorySelectionModal = showTerritorySelectionModal;

