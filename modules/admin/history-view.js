import {
    getHistorialReport, getPublicadores, updateHistoryRecord, addHistoryRecord, returnTerritorio,
    getProgramaSemanal, getGlobalObservations, getTerritorios, assignTerritorio
} from '../../data/firestore-services.js';
import { UIHelpers, showModal, showCustomConfirm } from '../services/ui-helpers.js';
import { showNotification } from '../utils/helpers.js';

export const renderHistorialView = async (container) => {
    const monday = UIHelpers.getMonday(new Date());
    const weekId = UIHelpers.formatDateId(monday);

    const [history, tRaw, publicadoresRaw, currentProg] = await Promise.all([
        getHistorialReport(),
        getTerritorios(),
        getPublicadores(),
        getProgramaSemanal(weekId).catch(() => null)
    ]);

    const allPublicadores = publicadoresRaw.filter(p => p.es_conductor || p.privilegios?.includes('Conductor'));

    // Extract territory numbers from the current program to ensure they appear in Historial
    const programTerritories = new Set();
    if (currentProg && currentProg.dias) {
        currentProg.dias.forEach(d => {
            ['manana', 'tarde', 'noche', 'zoom'].forEach(turn => {
                if (d[turn] && d[turn].territorio) {
                    String(d[turn].territorio).split(/[,;/]/).forEach(n => {
                        const clean = String(n || '').trim();
                        if (clean) programTerritories.add(clean);
                    });
                }
            });
        });
    }

    // Force re-import if needed for repair
    const { runSystemDiagnosticsAndRepair } = await import('../../data/firestore-services.js');

    // Xolvy Data Shield: Unique numbers only (Removed 1-22 restriction to support all territories)
    const normalizeT = (val) => String(val || '').trim();
    const seen = new Set();
    const allTerritorios = tRaw
        .filter(rec => {
            const numStr = normalizeT(rec.numero);
            if (!numStr) return false;
            if (seen.has(numStr)) return false;
            seen.add(numStr);
            return true;
        })
        .map(rec => ({
            ...rec,
            numero: normalizeT(rec.numero),
            manzanas: String(rec.manzanas || '').replace(/Salmo/gi, 'Mz.').trim()
        }))
        .sort((a, b) => String(a.numero || '').localeCompare(String(b.numero || ''), undefined, { numeric: true, sensitivity: 'base' }));

    // Build ID to Num mapping for robust history linking
    const idToNum = {};
    allTerritorios.forEach(t => idToNum[t.id] = t.numero);

    const historyByNum = history.reduce((acc, h) => {
        // En el nuevo sistema banco_s13, h.numero ya viene del mapeo de h.territorio_id
        // Si no existe, usamos h.territorio_id directamente como número
        const rawNum = String(h.numero || h.territorio_id || '').trim();
        if (!rawNum) return acc;

        const nums = rawNum.split(/[,/]/).map(s => normalizeT(s)).filter(Boolean);

        nums.forEach(num => {
            if (!acc[num]) acc[num] = [];
            acc[num].push({ ...h, numero: num });
        });
        return acc;
    }, {});

    // --- HELPERS INTERNOS ---
    const getSortableDate = (h) => {
        const d = h.timestamp || h.fecha_entrega || h.fecha_asignacion;
        if (!d) return 0;
        const date = d.toDate ? d.toDate() : new Date(d);
        return isNaN(date.getTime()) ? 0 : date.getTime();
    };

    // Stats recalculation (radar)
    const assignedCount = allTerritorios.filter(t => t.estado === 'Asignado').length;
    const coverage = allTerritorios.length > 0 ? Math.round((assignedCount / allTerritorios.length) * 100) : 0;

    container.innerHTML = `
        <div class="relative animate-fade-in p-2 md:p-4 max-w-7xl mx-auto w-full overflow-x-hidden pb-20">
            <!-- Stats Bar (Xolvy Radar) -->
            <div class="flex flex-wrap justify-end gap-2 mb-6 pointer-events-none">
                <div class="pointer-events-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-2xl shadow-sm flex items-center gap-3">
                    <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span class="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">${coverage}% Cobertura</span>
                </div>
                <div class="pointer-events-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-2xl shadow-sm flex items-center gap-3">
                    <div class="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                    <span class="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">${assignedCount} Ocupados</span>
                </div>
            </div>

            <header class="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                <div class="relative group w-full md:w-96">
                    <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors cursor-default"><i class="fas fa-search text-xs"></i></span>
                    <input type="text" id="hist-search" placeholder="Filtrar actividad..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl !pl-12 pr-6 py-3.5 text-[12px] font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white">
                </div>
                <div class="flex items-center gap-3 w-full md:w-auto">
                    <button id="btn-global-obs" class="flex-1 md:flex-none h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-comment-alt"></i> Bitácora
                    </button>
                    <button id="btn-manual-log" class="flex-1 md:flex-none h-12 px-6 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-file-signature"></i> Cargar Manual
                    </button>
                    <select id="hist-filter-status" class="flex-1 md:flex-none h-12 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 text-[9px] font-black uppercase text-slate-500 outline-none focus:border-primary transition-all cursor-pointer">
                        <option value="">TODOS</option>
                        <option value="Asignado">Asignados</option>
                        <option value="Disponible">Libres</option>
                    </select>
                    <button id="btn-sync-history" class="w-12 h-12 bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-emerald-500 rounded-xl border border-slate-200 dark:border-white/10 transition-all flex items-center justify-center group" title="Sincronizar todo el historial">
                        <i class="fas fa-sync-alt group-hover:rotate-180 transition-transform duration-700"></i>
                    </button>
                </div>
            </header>

            <!-- Dynamic Grid System -->
            <div id="unified-control-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
                <!-- Injected by renderGrid -->
            </div>
        </div>

        <div id="modal-container-nested" class="hidden"></div>
    `;

    const grid = container.querySelector('#unified-control-grid');
    const searchInp = container.querySelector('#hist-search');
    const statusFilter = container.querySelector('#hist-filter-status');
    const syncBtn = container.querySelector('#btn-sync-history');

    if (syncBtn) {
        syncBtn.onclick = async () => {
            const icon = syncBtn.querySelector('i');
            icon.classList.add('fa-spin');
            syncBtn.disabled = true;

            try {
                await runSystemDiagnosticsAndRepair((msg, pc) => {
                    showNotification(`⚡ Sincronizando: ${msg}`, 'info');
                });
                showNotification("¡Historial reconstruido con éxito!", "success");
                // Re-render everything
                renderHistorialView(container);
            } catch (e) {
                showNotification("Error en sincronización: " + e.message, "error");
            } finally {
                icon.classList.remove('fa-spin');
                syncBtn.disabled = false;
            }
        };
    }

    const renderGrid = () => {
        const query = searchInp.value.toLowerCase().trim();
        const status = statusFilter.value;

        let displayList = allTerritorios
            .filter(t => {
                const n = (t.numero || '').toLowerCase();
                const matchesQuery = n.includes(query) ||
                    (t.asignado_a && t.asignado_a.toLowerCase().includes(query)) ||
                    (t.localidad && t.localidad.toLowerCase().includes(query));

                // --- RELEVANCE FILTER ---
                // Show if: Currently assigned, has completion history, is in current Program, or user is searching
                const tNumKey = String(t.numero || '');
                const isAsignado = t.estado === 'Asignado' || (t.asignado_a && t.asignado_a.trim() !== '');
                const hasHistory = (historyByNum[tNumKey] || []).length > 0;
                const inProgram = programTerritories.has(tNumKey);

                const isRelevant = isAsignado || hasHistory || inProgram || query.length > 0;

                const matchesStatus = !status || t.estado === status;
                return matchesQuery && matchesStatus && isRelevant;
            })
            .sort((a, b) => (a.numero || '').localeCompare(b.numero || '', undefined, { numeric: true }));

        if (displayList.length === 0) {
            grid.innerHTML = `<div class="py-20 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">Sin registros encontrados</div>`;
            return;
        }
        grid.innerHTML = displayList.map(t => {
            const isFree = t.estado === 'Libre' || t.estado === 'Disponible' || t.estado === 'Sin asignar';

            return `
                <div class="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all group overflow-hidden h-full"> 
                    <div class="flex flex-col p-6 gap-5 flex-1">
                        <div class="flex items-center justify-between gap-4">
                            <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm border ${isFree ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-400/20' : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-400/20'}">
                                ${t.numero}
                            </div>
                            <div class="flex flex-col items-end">
                                <span class="text-[9px] font-bold ${isFree ? 'text-emerald-600' : 'text-rose-600'} uppercase tracking-widest mb-1">${t.estado}</span>
                                ${t.asignado_a ? `<span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase truncate max-w-[110px] bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-white/5">${t.asignado_a}</span>` : ''}
                            </div>
                        </div>

                        <div class="space-y-4">
                            <div class="flex flex-col">
                                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Localidad</span>
                                <span class="text-xs font-bold text-slate-900 dark:text-white truncate uppercase tracking-tight">${t.localidad || 'Mi Ciudad'}</span>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Área Geográfica</span>
                                <span class="text-[10px] font-medium text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">${t.manzanas || 'Sin manzanas'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-auto border-t border-slate-50 dark:border-white/5 p-4 bg-slate-50/50 dark:bg-black/20">
                        <button onclick="window.viewTimeline('${t.numero}')" class="w-full h-11 flex items-center justify-center gap-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm active:scale-95 group">
                            <i class="fas fa-clock-rotate-left text-xs opacity-40 group-hover:opacity-100 group-hover:rotate-[-120deg] transition-transform duration-500"></i> Cronología
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    // --- NUEVO VISOR S-13 INTERACTIVO (TIMELINE REDESIGN) ---
    window.viewTimeline = async (num) => {
        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <header class="shrink-0 p-8 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                        <div class="flex items-center gap-6">
                            <div class="w-14 h-14 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-2xl flex items-center justify-center text-2xl border border-indigo-100 dark:border-indigo-400/20">
                                <i class="fas fa-history"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Registro S-13</h3>
                                <p class="text-xs text-slate-500 font-medium mt-0.5 uppercase tracking-widest">Territorio #${num}</p>
                            </div>
                        </div>
                        <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="w-10 h-10 rounded-full hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-center transition-all text-slate-400">
                            <i class="fas fa-times"></i>
                        </button>
                </header>

                <div id="timeline-view-content" class="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 space-y-10 bg-slate-50/50 dark:bg-black/20">
                    <div class="flex items-center gap-4 animate-pulse">
                        <div class="w-2 h-2 rounded-full bg-primary mb-1"></div>
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando línea de tiempo...</span>
                    </div>
                </div>

                <footer class="p-6 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-black/40 flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                    <div><i class="fas fa-info-circle mr-2"></i> Orden cronológico descendente</div>
                    <div id="timeline-total-count">...</div>
                </footer>
            </div>
        `, async (modal) => {
            const content = modal.querySelector('#timeline-view-content');
            const counter = modal.querySelector('#timeline-total-count');

            // Suscripción Live Pool para el territorio específico
            const { startLivePool } = await import('../../data/firestore-services.js');
            const { where } = await import('firebase/firestore');

            const unsub = startLivePool('banco_s13', [where('territorio_id', '==', String(num))], (data) => {
                const sorted = data.sort((a, b) => {
                    const getMs = (h) => {
                        const d = h.timestamp || h.fecha_entrega || h.fecha_asignacion;
                        if (!d) return 0;
                        return (d.toDate ? d.toDate() : new Date(d)).getTime();
                    };
                    return getMs(b) - getMs(a);
                });

                if (counter) counter.innerText = `${sorted.length} Registros Encontrados`;
                renderTimelineUI(content, sorted, num);
            });

            // Limpieza al cerrar modal
            const closeBtn = modal.querySelector('button[onclick]');
            const oldOnClick = closeBtn.onclick;
            closeBtn.onclick = () => {
                unsub();
                if (oldOnClick) oldOnClick.call(closeBtn);
            };
        }, 'max-w-3xl');
    };

    const renderTimelineUI = (container, history, num) => {
        if (history.length === 0) {
            container.innerHTML = `
                <div class="h-64 flex flex-col items-center justify-center opacity-30 gap-5 text-center">
                    <div class="w-20 h-20 bg-slate-200 dark:bg-white/5 rounded-3xl flex items-center justify-center text-4xl">
                        <i class="fas fa-folder-open"></i>
                    </div>
                    <p class="text-xs font-black uppercase tracking-widest">Sin historial registrado aún</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="relative space-y-12 before:absolute before:left-[21px] before:top-4 before:bottom-4 before:w-1 before:bg-gradient-to-b before:from-primary/30 before:via-slate-200 dark:before:via-white/5 before:to-transparent">
                ${history.map((h) => {
            const isEnCurso = !h.fecha_entrega;
            const dateAsig = UIHelpers.fmtDate(h.fecha_asignacion || h.timestamp);
            const dateEntr = h.fecha_entrega ? UIHelpers.fmtDate(h.fecha_entrega) : null;
            const badgeClass = isEnCurso
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            const dotClass = isEnCurso ? 'bg-amber-500 shadow-amber-500/40 animate-pulse' : 'bg-emerald-500 shadow-emerald-500/40';

            return `
                    <div class="relative pl-14 group/item">
                        <!-- Conector Dot -->
                        <div class="absolute left-0 top-1.5 w-11 h-11 flex items-center justify-center z-10 bg-slate-50 dark:bg-[#0a0f18] rounded-full">
                            <div class="w-4 h-4 rounded-full ${dotClass} shadow-lg border-2 border-white dark:border-slate-900"></div>
                        </div>

                        <!-- Tarjeta S-13 -->
                        <div id="card-h-${h.id}" class="bg-white dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.07] rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-500 group-hover/item:-translate-y-1">
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <h4 class="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">${h.conductor || 'Sin asignar'}</h4>
                                    <div class="flex items-center gap-3 mt-1.5">
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase border ${badgeClass}">
                                            <span class="w-1 h-1 rounded-full bg-current"></span>
                                            ${isEnCurso ? '🟠 En Curso' : '🟢 Completado'}
                                        </span>
                                        ${h.turno ? `<span class="text-[8px] font-bold text-slate-400 uppercase bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">${h.turno}</span>` : ''}
                                    </div>
                                </div>
                                <button onclick="window.surgicalEditS13('${h.id}', '${num}')" class="w-10 h-10 bg-slate-50 dark:bg-white/5 hover:bg-primary hover:text-white rounded-xl flex items-center justify-center text-slate-400 transition-all active:scale-90 shadow-inner">
                                    <i class="fas fa-pencil-alt text-xs"></i>
                                </button>
                            </div>

                            <div class="grid grid-cols-2 gap-8 pt-4 border-t border-slate-50 dark:border-white/5">
                                <div class="space-y-1">
                                    <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest block">FECHA EN QUE SE ASIGNÓ</span>
                                    <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                        <i class="far fa-calendar-alt opacity-40"></i> ${dateAsig}
                                    </span>
                                </div>
                                <div class="space-y-1">
                                    <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest block">FECHA EN QUE SE COMPLETÓ</span>
                                    <span class="text-[11px] font-black ${isEnCurso ? 'text-amber-500 italic opacity-60' : 'text-emerald-500'} flex items-center gap-2">
                                        <i class="fas fa-flag-checkered opacity-40"></i> ${dateEntr || '---'}
                                    </span>
                                </div>
                            </div>

                            ${h.observaciones ? `
                            <div class="mt-4 p-4 bg-slate-50/50 dark:bg-white/5 rounded-2xl italic text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                "${h.observaciones}"
                            </div>` : ''}
                        </div>
                    </div>
                    `;
        }).join('')}
            </div>
        `;
    };

    // --- CIRUGÍA DE DATOS (SURGICAL INLINE EDITING) ---
    window.surgicalEditS13 = async (hId, tNum) => {
        // Encontrar el registro en el cache local de la vista
        const h = historyByNum[tNum].find(x => x.id === hId);
        if (!h) return;

        const dateAsigVal = (h.fecha_asignacion || h.timestamp || new Date().toISOString()).split('T')[0];
        const dateEntrVal = h.fecha_entrega ? h.fecha_entrega.split('T')[0] : '';
        const cardEl = document.getElementById(`card-h-${hId}`);
        if (!cardEl) return;

        // Guardar HTML original para revertir si es necesario
        const originalHTML = cardEl.innerHTML;
        cardEl.classList.add('border-primary', 'shadow-primary/10');

        cardEl.innerHTML = `
            <div class="animate-fade-in space-y-5">
                <div class="flex items-center gap-4 mb-2">
                    <div class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div>
                        <h5 class="text-xs font-black uppercase tracking-tight text-primary">Modo Cirugía de Datos</h5>
                        <p class="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Ajustando S-13 · T-${tNum}</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Conductor</label>
                        <select id="edit-surgery-cond" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase cursor-pointer">
                            <option value="">Seleccionar responsable...</option>
                            ${allPublicadores.map(p => `
                                <option value="${p.nombre}" ${h.conductor === p.nombre ? 'selected' : ''}>${p.nombre}</option>
                            `).join('')}
                            ${(!allPublicadores.find(p => p.nombre === h.conductor) && h.conductor) ? `<option value="${h.conductor}" selected>${h.conductor}</option>` : ''}
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Turno</label>
                        <select id="edit-surgery-turno" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none cursor-pointer">
                            <option value="manana" ${h.turno === 'manana' ? 'selected' : ''}>MAÑANA</option>
                            <option value="tarde" ${h.turno === 'tarde' ? 'selected' : ''}>TARDE</option>
                            <option value="noche" ${h.turno === 'noche' ? 'selected' : ''}>NOCHE</option>
                            <option value="zoom" ${h.turno === 'zoom' ? 'selected' : ''}>ZOOM</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">FECHA EN QUE SE ASIGNÓ</label>
                        <input type="date" id="edit-surgery-asig" value="${dateAsigVal}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold text-blue-500 outline-none">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">FECHA EN QUE SE COMPLETÓ</label>
                        <input type="date" id="edit-surgery-entr" value="${dateEntrVal}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold text-emerald-500 outline-none">
                    </div>
                </div>

                <div class="flex gap-2 pt-2">
                    <button id="btn-surgery-cancel" class="btn-pro flex-1 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 font-black rounded-xl text-[9px] uppercase tracking-widest transition-all">Cancelar</button>
                    <button id="btn-surgery-save" class="btn-pro flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                         <i class="fas fa-save"></i> Aplicar Cambios
                    </button>
                </div>
            </div>
        `;

        cardEl.querySelector('#btn-surgery-cancel').onclick = () => {
            cardEl.innerHTML = originalHTML;
            cardEl.classList.remove('border-primary', 'shadow-primary/10');
        };

        cardEl.querySelector('#btn-surgery-save').onclick = async () => {
            const btn = cardEl.querySelector('#btn-surgery-save');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';

            const cond = cardEl.querySelector('#edit-surgery-cond').value.trim();
            const asig = cardEl.querySelector('#edit-surgery-asig').value;
            const entr = cardEl.querySelector('#edit-surgery-entr').value;
            const turno = cardEl.querySelector('#edit-surgery-turno').value;

            try {
                const updateData = {
                    conductor: cond,
                    fecha_asignacion: new Date(asig + 'T12:00:00Z').toISOString(),
                    turno: turno,
                    estado: entr ? 'Completado' : 'Asignado'
                };

                if (entr) {
                    updateData.fecha_entrega = new Date(entr + 'T12:00:00Z').toISOString();
                } else {
                    updateData.fecha_entrega = null; // En caso de que se borre la fecha
                }

                await updateHistoryRecord(hId, updateData);
                showNotification("S-13 Actualizado Quirúrgicamente", "success");
                // No necesitamos refrescar manualmente el cardEl, el Live Pool se encargará de re-renderizar todo el TimelineUI
            } catch (e) {
                showNotification("Error en sincronización: " + e.message, "error");
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Aplicar Cambios';
            }
        };
    };

    window._stopAllTimelineLivePools = () => {
        // Obsoleto pero mantenido por compatibilidad
    };

    window.showGlobalObservations = async () => {
        showNotification("Cargando bitácora...", "info");
        const obs = await getGlobalObservations();

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[3rem] overflow-hidden">
                <header class="shrink-0 bg-indigo-600 p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                            <i class="fas fa-comments"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Bitácora Global</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Observaciones de cada territorio</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-6 bg-slate-50 dark:bg-black/20">
                    ${obs.length === 0 ? `
                        <div class="py-20 text-center opacity-40">
                            <p class="text-xs font-black uppercase tracking-widest">No hay observaciones registradas aún.</p>
                        </div>
                    ` : obs.map(h => `
                        <div class="modern-card p-6 border-slate-100 dark:border-white/5 bg-white dark:bg-white/[0.02] shadow-sm hover:border-indigo-500/30 transition-all flex flex-col md:flex-row gap-6 md:items-center">
                            <div class="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                                ${h.territorio_id || h.numero}
                            </div>
                            <div class="flex-1 space-y-1">
                                <div class="flex items-center gap-3">
                                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${h.conductor}</span>
                                    <span class="w-1 h-1 bg-slate-200 dark:bg-white/10 rounded-full"></span>
                                    <span class="text-[9px] font-bold text-slate-400">${UIHelpers.fmtDateAt(h.timestamp || h.fecha)}</span>
                                </div>
                                <p class="text-[13px] font-bold text-slate-700 dark:text-white leading-relaxed italic">"${h.nota || h.observaciones}"</p>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <footer class="p-8 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-black/40 text-center">
                    <button onclick="this.closest('.fixed').classList.add('hidden')" class="px-10 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cerrar Bitácora</button>
                </footer>
            </div>
        `, null, 'max-w-3xl');
    };

    window.quickAssign = (id, num) => {
        showModal(`
            <div class="p-8 space-y-10">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-3xl text-primary shadow-inner">
                        <i class="fas fa-file-signature"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Nueva Asignación #${num}</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Control de Registro S-13</p>
                    </div>
                </header>

                <div class="space-y-6">
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Publicador</label>
                        <select id="asig-cond" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase cursor-pointer appearance-none shadow-inner">
                            <option value="">Seleccionar responsable...</option>
                            ${allPublicadores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha</label>
                        <input type="date" id="asig-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-primary outline-none focus:border-primary transition-all uppercase shadow-inner">
                    </div>
                </div>

                <div class="flex gap-4 pt-6 border-t border-slate-50 dark:border-white/5">
                    <button id="cancel-asig" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cerrar</button>
                    <button id="confirm-asig" class="flex-[2] py-5 bg-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">Registrar S-13</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#cancel-asig').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#confirm-asig').onclick = async () => {
                const cond = modal.querySelector('#asig-cond').value;
                const date = modal.querySelector('#asig-date').value;
                if (!cond || !date) return showNotification("Complete los datos", "warning");

                await assignTerritorio(id, cond, { fecha_asignacion: new Date(date + 'T12:00:00Z').toISOString() });
                showNotification("Asignación registrada");
                modal.classList.add('hidden');
                renderHistorialView(container);
            };
        });
    };

    // --- ELIMINADOS MODALES VIEJOS DE EDICIÓN ---

    window.quickComplete = async (tId) => {
        showCustomConfirm("¿Deseas marcar este territorio como completado ahora?", async () => {
            await returnTerritorio(tId, "Completado desde Historial", new Date().toISOString());
            showNotification("Territorio finalizado");
            renderHistorialView(container);
        });
    };

    window.showManualLogModal = () => {
        showModal(`
            <div class="p-8 space-y-10">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-teal-500/10 rounded-3xl flex items-center justify-center text-3xl text-teal-600 shadow-inner">
                        <i class="fas fa-file-signature"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Cargar Registro Manual</h3>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Saturación Histórica S-13</p>
                    </div>
                </header>

                <div class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Territorio</label>
                            <select id="manual-h-num" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase appearance-none cursor-pointer">
                                ${allTerritorios.map(t => `<option value="${t.numero}">${t.numero} - ${t.localidad}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Conductor</label>
                            <select id="manual-h-conductor" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase appearance-none cursor-pointer">
                                <option value="">Seleccionar responsable...</option>
                                ${allPublicadores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha Asignación</label>
                            <input type="date" id="manual-h-date-asig" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-blue-500 outline-none">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Turno</label>
                            <select id="manual-h-turno" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none">
                                <option value="manana">MAÑANA</option>
                                <option value="tarde">TARDE</option>
                                <option value="noche">NOCHE</option>
                                <option value="zoom">ZOOM</option>
                            </select>
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha Entrega (Opt)</label>
                            <input type="date" id="manual-h-date-ent" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-emerald-500 outline-none">
                        </div>
                    </div>
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Notas / Observaciones</label>
                        <textarea id="manual-h-notes" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[12px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary h-24" placeholder="Cargado manualmente para S-13..."></textarea>
                    </div>
                </div>

                <div class="flex gap-4 pt-6 border-t border-slate-50 dark:border-white/5">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="btn-pro flex-1 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cerrar</button>
                    <button id="confirm-manual-h" class="btn-pro flex-[2] py-5 bg-teal-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-teal-500/20 transition-all active:scale-95">Guardar Registro</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#confirm-manual-h').onclick = async () => {
                const num = modal.querySelector('#manual-h-num').value;
                const conductor = modal.querySelector('#manual-h-conductor').value;
                const asig = modal.querySelector('#manual-h-date-asig').value;
                const ent = modal.querySelector('#manual-h-date-ent').value;
                const turno = modal.querySelector('#manual-h-turno').value;
                const notes = modal.querySelector('#manual-h-notes').value;

                if (!num || !conductor || !asig) return showNotification("Faltan datos", "warning");

                const tObj = allTerritorios.find(x => x.numero === num);

                const { timestamp } = await import('firebase/firestore');

                await addHistoryRecord({
                    territorio_id: tObj ? tObj.id : 'manual-' + num,
                    numero: num,
                    conductor: conductor,
                    fecha_asignacion: new Date(asig + 'T12:00:00Z').toISOString(),
                    fecha_entrega: ent ? new Date(ent + 'T12:00:00Z').toISOString() : null,
                    turno: turno,
                    estado: ent ? 'Completado' : 'Asignado',
                    observaciones: notes || 'Carga manual',
                    timestamp: timestamp ? timestamp.now() : new Date()
                });

                showNotification("Registro manual guardado");
                modal.classList.add('hidden');
                renderHistorialView(container);
            };
        });
    };

    searchInp.oninput = renderGrid;
    statusFilter.onchange = renderGrid;
    const btnGlobal = container.querySelector('#btn-global-obs');
    if (btnGlobal) btnGlobal.onclick = window.showGlobalObservations;
    const btnManual = container.querySelector('#btn-manual-log');
    if (btnManual) btnManual.onclick = () => window.showManualLogModal();
    renderGrid();
};
