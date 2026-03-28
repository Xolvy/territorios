import Chart from 'chart.js/auto';
import {
    getHistorialReport, getConductores, getTerritorios, getPublicadores, getConfiguracion,
    assignTerritorio, returnTerritorio, transferTerritory, addHistoryRecord, updateHistoryRecord, deleteHistoryRecord, updateTerritorio,
    getProgramaSemanal, getGlobalObservations, startLivePool
} from '../../data/firestore-services.js';
import { UIHelpers, showModal, showCustomConfirm, showCustomPrompt, showTerritorySelectionModal } from '../services/ui-helpers.js';
import { formatPhoneNumber, getStatusColor, showNotification } from '../utils/helpers.js';

const { formatDisplayDateRange } = UIHelpers;

export const renderHistorialView = async (container) => {
    const monday = UIHelpers.getMonday(new Date());
    const weekId = UIHelpers.formatDateId(monday);

    const [history, tRaw, allPublicadores, currentProg] = await Promise.all([
        getHistorialReport(),
        getTerritorios(),
        getPublicadores(),
        getProgramaSemanal(weekId).catch(() => null)
    ]);

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

    // Helper to extract a sortable value from different date formats
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

            <!-- List Section -->
            <div class="space-y-4">
                <div id="unified-control-grid" class="space-y-3">
                    <!-- Dynamic Grid -->
                </div>
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
            const tNumKey = String(t.numero || '');
            const tHistory = (historyByNum[tNumKey] || [])
                .sort((a, b) => getSortableDate(b) - getSortableDate(a));

            const isFree = t.estado === 'Libre' || t.estado === 'Disponible' || t.estado === 'Sin asignar';
            const numBg = isFree ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-rose-500 shadow-rose-500/30';

            return `
                <div class="modern-card !p-0 border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col bg-white dark:bg-[#0d1117]">
                    <div class="flex flex-col p-4 lg:p-6 gap-6">
                        <div class="flex items-center gap-6 w-full">
                            <div class="w-16 h-16 ${numBg} rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shrink-0 group-hover:scale-110 transition-transform duration-500">
                                ${t.numero}
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
                                <div class="flex flex-col">
                                    <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">Localidad</span>
                                    <div class="flex items-center gap-2 text-slate-700 dark:text-white">
                                        <span class="text-[13px] font-black uppercase truncate">${t.localidad || 'Mi Ciudad'}</span>
                                    </div>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">Manzanas</span>
                                    <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <span class="text-[11px] font-bold truncate">${t.manzanas || 'Sin manzanas'}</span>
                                    </div>
                                </div>
                                <div class="flex flex-col lg:items-end justify-center">
                                    ${t.asignado_a ? `<span class="text-[9px] font-black text-slate-400 uppercase truncate max-w-[150px] bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/5">${t.asignado_a}</span>` : ''}
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 w-full pt-4 border-t border-slate-50 dark:border-white/5">
                            <button onclick="window.viewTimeline('${t.numero}', 's13')" class="flex-1 h-14 flex items-center justify-center gap-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                                <i class="fas fa-clock-rotate-left text-xs"></i> Cronología
                            </button>
                            <button onclick="window.viewTimeline('${t.numero}', 'obs')" class="flex-1 h-14 flex items-center justify-center gap-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
                                <i class="fas fa-comment-dots text-xs"></i> Notas
                            </button>
                        </div>
                    </div>

                    <div id="timeline-${t.numero}" class="hidden animate-slide-up border-t border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 p-6 lg:p-10">
                         <div class="flex items-center justify-between gap-4 mb-10">
                            <h5 id="timeline-title-${t.numero}" class="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Cronología S-13</h5>
                            <div class="h-px flex-1 bg-slate-200 dark:bg-white/5 mx-4"></div>
                            <div class="flex gap-2">
                                <button onclick="window.viewTimeline('${t.numero}', 's13')" id="t-btn-s13-${t.numero}" class="px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest bg-slate-900 text-white">S-13</button>
                                <button onclick="window.viewTimeline('${t.numero}', 'obs')" id="t-btn-obs-${t.numero}" class="px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest bg-slate-200 dark:bg-white/5 text-slate-500">Notas</button>
                            </div>
                        </div>

                        <div id="timeline-content-${t.numero}" class="relative space-y-8 before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-white/5">
                            <!-- Injected by viewTimeline -->
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    // --- Live Pool per-territory timeline subscriptions ---
    const timelineLivePools = {}; // num -> unsub function

    const stopTimelineLivePool = (num) => {
        if (timelineLivePools[num]) {
            timelineLivePools[num]();
            delete timelineLivePools[num];
        }
    };

    const getStatusBadge = (status) => {
        const s = String(status || '').toLowerCase();
        if (s === 'asignado') return { text: 'Asignado', color: 'text-rose-500 bg-rose-500/10', dot: 'bg-rose-500' };
        if (s === 'completado' || s === 'predicado') return { text: 'Completado', color: 'text-emerald-500 bg-emerald-500/10', dot: 'bg-emerald-500' };
        if (s === 'disponible' || s === 'libre') return { text: 'Liberado', color: 'text-slate-500 bg-slate-100 dark:bg-white/10', dot: 'bg-slate-400' };
        if (s === 'devuelto') return { text: 'Devuelto', color: 'text-amber-500 bg-amber-500/10', dot: 'bg-amber-500' };
        if (s === 'sobrepuesto') return { text: 'Absorbido', color: 'text-indigo-400 bg-indigo-500/10', dot: 'bg-indigo-400' };
        if (s === 'extraviado') return { text: 'Extraviado', color: 'text-rose-600 bg-rose-600/10', dot: 'bg-rose-700' };
        return { text: status || 'Registro', color: 'text-slate-400 bg-slate-50 dark:bg-white/5', dot: 'bg-slate-300' };
    };

    const renderTimelineContent = (content, liveHistory, mode, num) => {
        const tHistory = (liveHistory || [])
            .filter(h => {
                if (mode === 's13') return true;
                return h.observaciones && h.observaciones.trim().length > 0;
            })
            .sort((a, b) => getSortableDate(b) - getSortableDate(a));

        if (tHistory.length === 0) {
            content.innerHTML = `
                <div class="py-12 text-center opacity-40 ml-10 flex flex-col items-center gap-4">
                    <div class="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-2xl">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <p class="text-[10px] font-bold uppercase tracking-widest italic">Sin registros para esta vista</p>
                </div>`;
            return;
        }

        content.innerHTML = tHistory.map((h, idx) => {
            const badge = getStatusBadge(h.estado);
            const isActive = h.estado === 'Asignado';
            const dateAsig = UIHelpers.fmtDate(h.fecha_asignacion || h.timestamp);
            const dateEntr = h.fecha_entrega ? UIHelpers.fmtDate(h.fecha_entrega) : null;

            // Duration badge
            let durationStr = '';
            if (h.fecha_asignacion) {
                const start = new Date(h.fecha_asignacion);
                const end = h.fecha_entrega ? new Date(h.fecha_entrega) : new Date();
                const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
                if (days >= 0) durationStr = `${days}d`;
            }

            return `
            <div class="relative pl-14 group/item animate-fade-in" data-hist-id="${h.id}">
                <!-- Timeline dot -->
                <div class="absolute left-3.5 top-3 w-4 h-4 ${badge.dot} rounded-full border-4 border-slate-50 dark:border-[#0d1117] z-10 shadow-md transition-all duration-300 group-hover/item:scale-150 ${isActive ? 'animate-pulse' : ''}"></div>
                ${idx === 0 && isActive ? `<div class="absolute left-[14px] top-[28px] bottom-0 w-0.5 bg-gradient-to-b from-rose-500/40 to-transparent"></div>` : ''}

                <div class="p-5 bg-white dark:bg-white/[0.03] rounded-3xl border ${isActive ? 'border-rose-200 dark:border-rose-500/20 shadow-rose-500/5' : 'border-slate-100 dark:border-white/5'} shadow-sm hover:shadow-lg transition-all duration-300 group-hover/item:-translate-y-0.5">
                    
                    <!-- Header row -->
                    <div class="flex items-start justify-between gap-4 mb-4">
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="text-[10px] font-black ${badge.color} px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 ${badge.dot} rounded-full"></span>
                                ${badge.text}
                            </span>
                            ${isActive ? `<span class="text-[8px] font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse">● En Progreso</span>` : ''}
                            ${durationStr ? `<span class="text-[8px] font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-full">${durationStr}</span>` : ''}
                        </div>
                        <!-- Action Buttons (always visible for all records) -->
                        <div class="flex items-center gap-1.5 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <button onclick="window.editHistoryRecord('${h.id}')" 
                                    title="Editar registro"
                                    class="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all text-[10px]">
                                <i class="fas fa-pen"></i>
                            </button>
                            ${isActive ? `
                            <button onclick="window.quickComplete('${h.territorio_id}', '${h.id}')" 
                                    title="Marcar como completado"
                                    class="w-8 h-8 flex items-center justify-center bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all text-[10px]">
                                <i class="fas fa-check"></i>
                            </button>` : ''}
                            <button onclick="window.deleteTimelineRecord('${h.id}', '${num}')" 
                                    title="Eliminar registro"
                                    class="w-8 h-8 flex items-center justify-center bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all text-[10px]">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Data grid -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div class="flex flex-col">
                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsable</span>
                            <span class="text-[11px] font-black text-slate-800 dark:text-white uppercase truncate">${h.conductor || 'Sin asignar'}</span>
                            ${h.auxiliar ? `<span class="text-[9px] text-slate-400 font-bold">${h.auxiliar}</span>` : ''}
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Turno</span>
                            <span class="text-[11px] font-black text-slate-600 dark:text-slate-300 capitalize">${h.turno || '—'}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Asignación</span>
                            <span class="text-[11px] font-bold text-slate-600 dark:text-slate-400">${dateAsig}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Entrega</span>
                            ${dateEntr 
                                ? `<span class="text-[11px] font-black text-emerald-500">${dateEntr}</span>` 
                                : `<span class="text-[9px] font-bold text-rose-400 uppercase">Pendiente</span>`}
                        </div>
                    </div>

                    ${h.observaciones ? `
                    <div class="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
                            <i class="fas fa-quote-left text-slate-300 dark:text-white/10 mr-2 text-xs"></i>${h.observaciones}<i class="fas fa-quote-right text-slate-300 dark:text-white/10 ml-2 text-xs"></i>
                        </p>
                    </div>` : ''}
                </div>
            </div>
            `;
        }).join('');
    };

    window.viewTimeline = (num, mode = 's13') => {
        const el = document.getElementById(`timeline-${num}`);
        const content = document.getElementById(`timeline-content-${num}`);
        const title = document.getElementById(`timeline-title-${num}`);
        const btnS13 = document.getElementById(`t-btn-s13-${num}`);
        const btnObs = document.getElementById(`t-btn-obs-${num}`);

        if (!el || !content) return;

        const isHidden = el.classList.contains('hidden');
        if (isHidden) {
            // Close any other open timelines and stop their live pools
            document.querySelectorAll('[id^="timeline-"]').forEach(d => {
                if (!d.classList.contains('hidden') && d.id !== `timeline-${num}`) {
                    const closedNum = d.id.replace('timeline-', '');
                    stopTimelineLivePool(closedNum);
                    d.classList.add('hidden');
                }
            });
            el.classList.remove('hidden');
        } else if (mode === el.dataset.mode) {
            // Same tab clicked again = close
            stopTimelineLivePool(num);
            el.classList.add('hidden');
            return;
        }

        el.dataset.mode = mode;
        const isObs = mode === 'obs';
        if (title) title.innerText = isObs ? 'Observaciones y Notas' : 'Cronología S-13 · Live';

        // Update sub-tab buttons
        if (btnS13) btnS13.className = `px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${!isObs ? 'bg-slate-900 dark:bg-white/10 text-white' : 'bg-slate-200 dark:bg-white/5 text-slate-500 hover:text-slate-700'}`;
        if (btnObs) btnObs.className = `px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${isObs ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-white/5 text-slate-500 hover:text-slate-700'}`;

        // Show loading state
        content.innerHTML = `
            <div class="ml-14 py-8 flex items-center gap-4">
                <div class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Conectando Live Pool...</span>
            </div>`;

        // Stop existing live pool for this territory
        stopTimelineLivePool(num);

        // Start Xolvy Live Pool: render initial static data, then subscribe for real-time updates
        // Use the already-loaded historyByNum as initial data, then update via live pool
        const initialLiveHistory = historyByNum[num] || [];
        renderTimelineContent(content, initialLiveHistory, mode, num);

        // Subscribe for real-time updates to banco_s13 (the authoritative S-13 collection)
        // territorio_id in banco_s13 stores the territory NUMBER (e.g. "4") as a String
        import('../../data/firestore-services.js').then(({ startLivePool }) => {
            import('firebase/firestore').then(({ where }) => {
                const cleanNum = String(num).trim();
                const unsub = startLivePool(
                    'banco_s13',
                    [where('territorio_id', '==', cleanNum)],
                    (liveData) => {
                        // Augment with `numero` field for renderTimelineContent compatibility
                        const normalized = liveData.map(h => ({
                            ...h,
                            numero: h.numero || h.territorio_id || cleanNum
                        })).sort((a, b) => {
                            const getMs = (h) => {
                                const d = h.timestamp || h.fecha_entrega || h.fecha_asignacion;
                                if (!d) return 0;
                                return (d.toDate ? d.toDate() : new Date(d)).getTime();
                            };
                            return getMs(b) - getMs(a);
                        });
                        // Update the local cache too
                        historyByNum[num] = normalized;
                        // Refresh content if timeline is still open for this num
                        const currentEl = document.getElementById(`timeline-${num}`);
                        const currentContent = document.getElementById(`timeline-content-${num}`);
                        if (currentEl && !currentEl.classList.contains('hidden') && currentContent) {
                            const currentMode = currentEl.dataset.mode || 's13';
                            renderTimelineContent(currentContent, normalized, currentMode, num);
                        }
                    }
                );
                timelineLivePools[num] = unsub;
            });
        });
    };

    window.deleteTimelineRecord = (hId, num) => {
        showCustomConfirm('¿Eliminar este registro del historial S-13? Esta acción no se puede deshacer.', async () => {
            try {
                await deleteHistoryRecord(hId);
                showNotification('Registro eliminado', 'success');
                // Live Pool will auto-refresh the timeline. Force refresh historyByNum
                const freshHistory = await getHistorialReport();
                freshHistory.forEach(h => {
                    let rawNum = String(h.numero || '');
                    const nums = rawNum.split(/[,/]/).map(s => String(s).trim()).filter(Boolean);
                    nums.forEach(n => {
                        if (!historyByNum[n]) historyByNum[n] = [];
                    });
                });
                // Re-render the visible timeline grid
                renderGrid();
            } catch (e) {
                console.error(e);
                showNotification('Error eliminando registro', 'error');
            }
        });
    };

    // Clean up all live pools when leaving this view
    window._stopAllTimelineLivePools = () => {
        Object.keys(timelineLivePools).forEach(num => stopTimelineLivePool(num));
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
                            <option value="">Seleccionar...</option>
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

    window.editHistoryRecord = async (id) => {
        const hist = history.find(h => h.id === id);
        if (!hist) return;

        const dateVal = (hist.fecha_asignacion || new Date().toISOString()).split('T')[0];

        showModal(`
            <div class="p-8 space-y-10">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center text-3xl text-blue-500 shadow-inner">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter">Corregir Registro S-13</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Territorio #${hist.numero}</p>
                    </div>
                </header>

                <div class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Conductor</label>
                            <select id="edit-h-conductor" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase appearance-none cursor-pointer">
                                ${allPublicadores.map(p => `<option value="${p.nombre}" ${p.nombre === hist.conductor ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha Asignación</label>
                            <input type="date" id="edit-h-date" value="${dateVal}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-blue-500 outline-none focus:border-primary transition-all shadow-inner">
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Turno</label>
                            <select id="edit-h-turno" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all">
                                <option value="manana" ${hist.turno === 'manana' ? 'selected' : ''}>MAÑANA</option>
                                <option value="tarde" ${hist.turno === 'tarde' ? 'selected' : ''}>TARDE</option>
                                <option value="noche" ${hist.turno === 'noche' ? 'selected' : ''}>NOCHE</option>
                                <option value="zoom" ${hist.turno === 'zoom' ? 'selected' : ''}>ZOOM</option>
                            </select>
                        </div>
                        <div class="pt-6">
                            <p class="text-[9px] text-slate-400 font-bold uppercase leading-tight italic">⚠️ Cambiar el turno o fecha actualizará automáticamente el Programa Semanal.</p>
                        </div>
                    </div>
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Notas / Observaciones</label>
                        <textarea id="edit-h-notes" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[12px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner h-32" placeholder="Escribe detalles importantes...">${hist.observaciones || ''}</textarea>
                    </div>
                </div>

                <div class="flex gap-4 pt-6 border-t border-slate-50 dark:border-white/5">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
                    <button id="confirm-edit-h" class="flex-[2] py-5 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95">Actualizar Historial</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#confirm-edit-h').onclick = async () => {
                const conductor = modal.querySelector('#edit-h-conductor').value;
                const fecha = modal.querySelector('#edit-h-date').value;
                const turno = modal.querySelector('#edit-h-turno').value;
                const notes = modal.querySelector('#edit-h-notes').value;

                if (!conductor || !fecha) return showNotification("Complete los campos obligatorios", "warning");

                await updateHistoryRecord(id, {
                    conductor: conductor,
                    fecha_asignacion: new Date(fecha + 'T12:00:00Z').toISOString(),
                    turno: turno,
                    observaciones: notes
                });
                showNotification("Registro actualizado exitosamente");
                modal.classList.add('hidden');
                renderHistorialView(container);
            };
        });
    };

    window.quickComplete = async (tId, hId) => {
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
                        <h3 class="text-2xl font-black uppercase tracking-tighter">Cargar Registro Manual</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Saturación Histórica S-13</p>
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
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cerrar</button>
                    <button id="confirm-manual-h" class="flex-[2] py-5 bg-teal-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-teal-500/20 transition-all active:scale-95">Guardar Registro</button>
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

