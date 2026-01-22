
export const UIHelpers = {
    fmtDate: (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '',

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
            if (window.dateFns) {
                return `${window.dateFns.format(start, 'd MMM')} - ${window.dateFns.format(end, 'd MMM yyyy')}`;
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
        <div class="relative w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-black/5 dark:border-white/10 animate-scale-in overflow-hidden z-10">
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

export const showTerritorySelectionModal = (current, territorios, onSelect, containerId = 'modal-container') => {
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
            <header class="shrink-0 bg-slate-900 p-8 text-white relative overflow-hidden">
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

                <div id="modal-terr-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                        <label class="flex items-center gap-3 p-2 cursor-pointer">
                             <input type="checkbox" class="terr-check w-5 h-5 rounded border-2 border-slate-300 dark:border-white/10 text-primary focus:ring-primary transition-all cursor-pointer" 
                                    data-num="${t.numero}" ${isSelected ? 'checked' : ''}>
                             <div class="flex-1 min-w-0">
                                 <div class="flex items-baseline justify-between gap-2">
                                     <span class="text-[11px] font-black text-slate-800 dark:text-white uppercase truncate">#${t.numero}</span>
                                     <span class="text-[8px] font-black text-slate-400 uppercase tracking-tighter shrink-0">${allMzs.length} MZ</span>
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
            const modalEl = document.getElementById(containerId);
            if (modalEl) {
                modalEl.classList.add('hidden');
                modalEl.innerHTML = '';
            }
        };

        render();
        updatePreview();
    }, 'max-w-2xl', containerId);
};

window.showTerritorySelectionModal = showTerritorySelectionModal;
