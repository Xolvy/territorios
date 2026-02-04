import Chart from 'chart.js/auto';
import {
    getHistorialReport, getConductores, getTerritorios, getPublicadores, getConfiguracion,
    assignTerritorio, returnTerritorio, transferTerritory, addHistoryRecord, updateHistoryRecord, deleteHistoryRecord, updateTerritorio
} from '../../data/firestore-services.js';
import { UIHelpers, showModal, showCustomConfirm, showCustomPrompt, showTerritorySelectionModal } from '../services/ui-helpers.js';
import { formatPhoneNumber, getStatusColor, showNotification } from '../utils/helpers.js';

const { formatDisplayDateRange } = UIHelpers;

export const renderHistorialView = async (container) => {
    const [history, tRaw, allPublicadores] = await Promise.all([
        getHistorialReport(),
        getTerritorios(),
        getPublicadores()
    ]);

    // Xolvy Data Shield: Robust normalization & ghost filtering
    const normalizeT = (val) => String(val || '').trim();
    const allTerritorios = tRaw
        .filter(rec => {
            const hasNum = rec.numero && String(rec.numero).trim().length > 0;
            if (!hasNum) console.warn(`🛡️ [Data Shield] Filtered ghost record: ${rec.id}`);
            return hasNum;
        })
        .map(rec => ({
            ...rec,
            numero: normalizeT(rec.numero),
            manzanas: String(rec.manzanas || '').replace(/Salmo/gi, 'Mz.').trim()
        }));

    // Group history by territory number for easy access
    const historyByNum = history.reduce((acc, h) => {
        const num = normalizeT(h.numero);
        if (!num) return acc;
        if (!acc[num]) acc[num] = [];
        acc[num].push({ ...h, numero: num });
        return acc;
    }, {});

    // Stats
    const totalTerrs = allTerritorios.length;
    const assignedCount = allTerritorios.filter(t => t.estado === 'Asignado').length;
    const coverage = totalTerrs > 0 ? Math.round((assignedCount / totalTerrs) * 100) : 0;
    const missingCount = allTerritorios.filter(t => t.estado === 'Disponible' || t.estado === 'Sin asignar').length;

    container.innerHTML = `
        <div class="space-y-12 animate-fade-in p-2 md:p-6 max-w-7xl mx-auto w-full overflow-x-hidden pb-20">
            <!-- Header -->
            <header class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
                <div class="space-y-1">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-primary/20 border border-white/20">
                            <i class="fas fa-chart-pie"></i>
                        </div>
                        <div>
                             <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Control de Actividad</h3>
                             <p class="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.4em] ml-1 opacity-70">Monitor inteligente y S-13</p>
                        </div>
                    </div>
                </div>
                
                <div class="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    <button id="btn-global-obs" class="h-14 px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center gap-3">
                        <i class="fas fa-comment-alt"></i> Bitácora de Observaciones
                    </button>
                    <div class="flex-1 md:flex-none relative group min-w-[320px]">
                        <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors cursor-default"><i class="fas fa-search text-xs"></i></span>
                        <input type="text" id="hist-search" placeholder="Buscar por territorio, publicador o localidad..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl !pl-12 pr-6 py-4.5 text-[13px] font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white">
                    </div>
                </div>
            </header>

            <!-- Quick Stats -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="modern-card p-6 border-slate-100 dark:border-white/5 flex items-center gap-6 group hover:bg-primary/5 transition-colors">
                    <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary text-xl shadow-inner">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cobertura Global</p>
                        <p class="text-2xl font-black text-slate-800 dark:text-white">${coverage}%</p>
                    </div>
                </div>
                <div class="modern-card p-6 border-slate-100 dark:border-white/5 flex items-center gap-6 group hover:bg-rose-500/5 transition-colors">
                    <div class="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 text-xl shadow-inner">
                        <i class="fas fa-map-location-dot"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Territorios Libres</p>
                        <p class="text-2xl font-black text-slate-800 dark:text-white">${missingCount}</p>
                    </div>
                </div>
                <div class="modern-card p-6 border-slate-100 dark:border-white/5 flex items-center gap-6 group hover:bg-emerald-500/5 transition-colors">
                    <div class="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 text-xl shadow-inner">
                        <i class="fas fa-file-invoice"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Registros S-13</p>
                        <p class="text-2xl font-black text-slate-800 dark:text-white">${history.length}</p>
                    </div>
                </div>
            </div>

            <!-- List Section -->
            <div class="space-y-6">
                <div class="flex items-center justify-between px-4">
                    <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-4">
                        <span class="w-12 h-1 bg-primary/20 rounded-full"></span> 
                        Listado Maestro de Actividad
                    </h4>
                    <select id="hist-filter-status" class="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-slate-500 outline-none focus:border-primary transition-all cursor-pointer">
                        <option value="">TODOS</option>
                        <option value="Asignado">Asignados</option>
                        <option value="Disponible">Disponibles</option>
                    </select>
                </div>

                <div id="unified-control-grid" class="space-y-4">
                    <!-- Dynamic Grid -->
                </div>
            </div>
        </div>

        <div id="modal-container-nested" class="hidden"></div>
    `;

    const grid = container.querySelector('#unified-control-grid');
    const searchInp = container.querySelector('#hist-search');
    const statusFilter = container.querySelector('#hist-filter-status');

    const renderGrid = () => {
        const query = searchInp.value.toLowerCase().trim();
        const status = statusFilter.value;

        let displayList = allTerritorios
            .filter(t => {
                const n = (t.numero || '').toLowerCase();
                const matchesQuery = n.includes(query) ||
                    (t.asignado_a && t.asignado_a.toLowerCase().includes(query)) ||
                    (t.localidad && t.localidad.toLowerCase().includes(query));
                const matchesStatus = !status || t.estado === status;
                return matchesQuery && matchesStatus;
            })
            .sort((a, b) => (a.numero || '').localeCompare(b.numero || '', undefined, { numeric: true }));

        if (displayList.length === 0) {
            grid.innerHTML = `<div class="py-20 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">Sin registros encontrados</div>`;
            return;
        }

        grid.innerHTML = displayList.map(t => {
            const tHistory = (historyByNum[t.numero] || [])
                .filter(h => h.estado === 'Completado' || h.estado === 'Predicado')
                .sort((a, b) => new Date(b.fecha_entrega || b.timestamp) - new Date(a.fecha_entrega || a.timestamp));

            const stateColors = {
                'Asignado': 'bg-primary text-white shadow-primary/30',
                'Completado': 'bg-emerald-500 text-white shadow-emerald-500/20',
                'Disponible': 'bg-slate-100 dark:bg-white/5 text-slate-400'
            };

            const diffDays = t.fecha_asignacion ? Math.floor((new Date() - new Date(t.fecha_asignacion)) / (1000 * 60 * 60 * 24)) : 0;

            return `
                <div class="modern-card !p-0 border-slate-100 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all group overflow-hidden flex flex-col bg-white dark:bg-[#0d1117]">
                    <div class="flex flex-col lg:flex-row items-center p-5 lg:p-7 gap-6">
                        <div class="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white text-xl font-black shadow-2xl shrink-0 group-hover:scale-110 transition-transform duration-500">
                            ${t.numero}
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 flex-1 w-full lg:w-auto">
                            <div class="flex flex-col">
                                <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">Localidad</span>
                                <div class="flex items-center gap-2 text-slate-800 dark:text-white">
                                    <i class="fas fa-location-dot text-[10px] text-primary"></i>
                                    <span class="text-[14px] font-black uppercase truncate">${t.localidad || 'Mi Ciudad'}</span>
                                </div>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">Manzanas</span>
                                <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <i class="fas fa-th-large text-[10px]"></i>
                                    <span class="text-[11px] font-bold truncate">${t.manzanas || 'Sin manzanas'}</span>
                                </div>
                            </div>
                            <div class="flex flex-col lg:items-end justify-center">
                                <span class="${stateColors[t.estado] || 'bg-slate-100 text-slate-400'} text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest transition-all">
                                    ${t.estado}
                                </span>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 shrink-0 w-full lg:w-auto mt-4 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-50 dark:border-white/5">
                            <button onclick="window.viewTimeline('${t.numero}', 's13')" class="flex-1 lg:flex-none h-12 px-5 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                                <i class="fas fa-clock-rotate-left text-xs"></i> Cronología
                            </button>
                            <button onclick="window.viewTimeline('${t.numero}', 'obs')" class="flex-1 lg:flex-none h-12 px-5 flex items-center justify-center gap-2 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                                <i class="fas fa-comment-dots text-xs"></i> Notas
                            </button>
                            <button onclick="window.quickAssign('${t.id}', '${t.numero}')" class="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-primary rounded-2xl transition-all">
                                <i class="fas fa-plus"></i>
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

    window.viewTimeline = (num, mode = 's13') => {
        const el = document.getElementById(`timeline-${num}`);
        const content = document.getElementById(`timeline-content-${num}`);
        const title = document.getElementById(`timeline-title-${num}`);
        const btnS13 = document.getElementById(`t-btn-s13-${num}`);
        const btnObs = document.getElementById(`t-btn-obs-${num}`);

        if (!el || !content) return;

        const isHidden = el.classList.contains('hidden');
        if (isHidden) {
            document.querySelectorAll('[id^="timeline-"]').forEach(d => d.classList.add('hidden'));
            el.classList.remove('hidden');
        } else if (mode === el.dataset.mode) {
            el.classList.add('hidden');
            return;
        }

        el.dataset.mode = mode;
        title.innerText = mode === 's13' ? 'Cronología S-13' : 'Observaciones y Notas';

        // Update sub-tab buttons
        btnS13.className = `px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest ${mode === 's13' ? 'bg-slate-900 text-white' : 'bg-slate-200 dark:bg-white/5 text-slate-500'}`;
        btnObs.className = `px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest ${mode === 'obs' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-white/5 text-slate-500'}`;

        const tHistory = (historyByNum[num] || [])
            .filter(h => {
                if (mode === 's13') return h.estado === 'Completado' || h.estado === 'Predicado' || h.estado === 'Asignado';
                return h.observaciones && h.observaciones.trim().length > 0;
            })
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        if (tHistory.length === 0) {
            content.innerHTML = `<div class="py-10 text-center opacity-40 ml-10"><p class="text-[10px] font-bold uppercase tracking-widest italic">Sin registros para esta vista</p></div>`;
            return;
        }

        content.innerHTML = tHistory.map(h => `
            <div class="relative pl-12 group/item">
                <div class="absolute left-3.5 top-2 w-3.5 h-3.5 ${mode === 's13' ? 'bg-emerald-500' : 'bg-indigo-500'} rounded-full border-4 border-white dark:border-[#0d1117] z-10 shadow-sm transition-transform group-hover/item:scale-150"></div>
                <div class="p-6 bg-white dark:bg-white/[0.02] rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div class="flex flex-col">
                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Responsable</span>
                            <span class="text-xs font-black text-slate-800 dark:text-white uppercase">${h.conductor || 'Anónimo'}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Evento</span>
                            <span class="text-[10px] font-black ${h.estado === 'Completado' ? 'text-emerald-500' : 'text-slate-500'} uppercase">${h.estado}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fecha</span>
                            <span class="text-[11px] font-bold text-slate-600 dark:text-gray-400">${UIHelpers.fmtDateAt(h.fecha_entrega || h.fecha_asignacion || h.timestamp)}</span>
                        </div>
                        <div class="flex flex-col ${mode === 'obs' ? 'col-span-1 md:col-span-2 lg:col-span-1' : ''}">
                            <span class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Observación</span>
                            <span class="text-[10px] font-medium text-slate-500 dark:text-gray-400 italic">"${h.observaciones || 'Sin notas'}"</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    };

    window.showGlobalObservations = () => {
        const obs = history.filter(h => h.observaciones && h.observaciones.trim().length > 0)
            .sort((a, b) => new Date(b.timestamp || b.fecha_entrega || 0) - new Date(a.timestamp || a.fecha_entrega || 0));

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
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Observaciones de todos los territorios</p>
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
                                ${h.numero}
                            </div>
                            <div class="flex-1 space-y-1">
                                <div class="flex items-center gap-3">
                                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${h.conductor}</span>
                                    <span class="w-1 h-1 bg-slate-200 dark:bg-white/10 rounded-full"></span>
                                    <span class="text-[9px] font-bold text-slate-400">${UIHelpers.fmtDateAt(h.timestamp || h.fecha_entrega)}</span>
                                </div>
                                <p class="text-[13px] font-bold text-slate-700 dark:text-white leading-relaxed italic">"${h.observaciones}"</p>
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

        showModal(`
            <div class="p-8 space-y-10">
                <h3 class="text-xl font-black uppercase tracking-tighter">Editar Registro Histórico</h3>
                <div class="space-y-6">
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Notas / Observaciones</label>
                        <textarea id="edit-h-notes" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[12px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner h-32">${hist.observaciones || ''}</textarea>
                    </div>
                </div>
                <div class="flex gap-4 pt-6 border-t border-slate-50 dark:border-white/5">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
                    <button id="confirm-edit-h" class="flex-[2] py-5 bg-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95">Guardar Cambios</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#confirm-edit-h').onclick = async () => {
                const notes = modal.querySelector('#edit-h-notes').value;
                await updateHistoryRecord(id, { observaciones: notes });
                showNotification("Registro actualizado");
                modal.classList.add('hidden');
                renderHistorialView(container);
            };
        });
    };

    searchInp.oninput = renderGrid;
    statusFilter.onchange = renderGrid;
    container.querySelector('#btn-global-obs').onclick = window.showGlobalObservations;
    renderGrid();
};

