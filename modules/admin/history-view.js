import {
    getHistorialReport, getConductores, getTerritorios, getPublicadores, getConfiguracion,
    assignTerritorio, returnTerritorio, transferTerritory, addHistoryRecord, updateHistoryRecord, deleteHistoryRecord, updateTerritorio
} from '../../data/firestore-services.js?v=2.2.5';
import { UIHelpers, showModal, showCustomConfirm, showCustomPrompt, showTerritorySelectionModal } from '../services/ui-helpers.js?v=2.2.5';
import { formatDisplayDateRange, formatPhoneNumber, getStatusColor, showNotification } from '../utils/helpers.js?v=2.2.5';

export const renderHistorialView = async (container) => {
    const [history, allConductores, allTerritorios, allPublicadores, config] = await Promise.all([
        getHistorialReport(),
        getConductores(),
        getTerritorios(),
        getPublicadores(),
        getConfiguracion()
    ]);

    const activeAsignments = allTerritorios.filter(t => t.estado === 'Asignado' || t.estado === 'Pendiente');

    // Stats calculation for the "Power Up"
    const totalTerrs = allTerritorios.length;
    const assignedCount = allTerritorios.filter(t => t.estado === 'Asignado').length;
    const coverage = totalTerrs > 0 ? Math.round((assignedCount / totalTerrs) * 100) : 0;
    const missingCount = allTerritorios.filter(t => t.estado === 'Disponible' || t.estado === 'Sin asignar').length;

    // Find the most delayed territory (oldest assignment date)
    const delayedTerritory = [...allTerritorios]
        .filter(t => t.estado === 'Asignado' && t.fecha_asignacion)
        .sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion))[0];

    const stats = {
        coverage,
        missing: missingCount,
        delayed: delayedTerritory ? delayedTerritory.numero : '—',
        historyCount: history.length
    };

    container.innerHTML = `
        <div class="space-y-12 animate-fade-in p-2 md:p-6 max-w-7xl mx-auto w-full overflow-x-hidden pb-20">
            <!-- Header with integrated actions -->
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
                    <div class="flex-1 md:flex-none relative group min-w-[240px]">
                        <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors cursor-default"><i class="fas fa-search text-xs"></i></span>
                        <input type="text" id="hist-search" placeholder="Territorio o Conductor..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-6 py-4.5 text-[13px] font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white">
                    </div>
                    
                    <div class="flex items-center gap-3 w-full md:w-auto">
                        <button id="btn-bulk-return" class="flex-1 md:flex-none px-6 py-4.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-gray-300 hover:border-emerald-500/50 transition-all flex items-center justify-center gap-3 shadow-md active:scale-95 group">
                            <div class="w-2 h-2 rounded-full bg-emerald-500 group-hover:animate-ping"></div>
                            Informar Completados
                        </button>
                        <button id="btn-new-assignment" class="flex-1 md:flex-none px-8 py-4.5 bg-primary hover:bg-primary-light text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                            <i class="fas fa-plus"></i> Nueva Asignación
                        </button>
                    </div>
                </div>
            </header>

            <!-- Dashboard Stats circles (Visual power up) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- Cobertura -->
                <div class="modern-card p-6 border-slate-100 dark:border-white/5 flex flex-col items-center text-center space-y-4 group hover:bg-primary/5 transition-colors">
                    <div class="relative w-20 h-20">
                        <svg class="w-full h-full -rotate-90">
                           <circle cx="40" cy="40" r="36" stroke="currentColor" stroke-width="8" fill="transparent" class="text-slate-100 dark:text-white/5"/>
                           <circle cx="40" cy="40" r="36" stroke="currentColor" stroke-width="8" fill="transparent"
                                   stroke-dasharray="226.2" stroke-dashoffset="${226.2 - (226.2 * stats.coverage / 100)}"
                                   class="text-primary transition-all duration-1000 ease-out"/>
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-sm font-black text-slate-800 dark:text-white">${stats.coverage}%</span>
                        </div>
                    </div>
                    <div>
                        <p class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Cobertura Global</p>
                        <p class="text-[8px] text-primary font-black uppercase tracking-tighter opacity-70 mt-1">${assignedCount} EN CURSO</p>
                    </div>
                </div>

                <!-- Faltantes -->
                <div class="modern-card p-6 border-slate-100 dark:border-white/5 flex flex-col items-center text-center space-y-4 group hover:bg-rose-500/5 transition-colors">
                    <div class="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-xl">
                        <span class="text-2xl font-black text-rose-500">${stats.missing}</span>
                    </div>
                    <div>
                         <p class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Territorios Faltantes</p>
                         <div class="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full mt-3 overflow-hidden">
                            <div class="h-full bg-rose-500 transition-all duration-1000" style="width: ${(stats.missing / totalTerrs) * 100}%"></div>
                         </div>
                    </div>
                </div>

                <!-- Críticos / Demorado -->
                <div class="modern-card p-6 border-slate-100 dark:border-white/5 flex flex-col items-center text-center space-y-4 group hover:bg-amber-500/5 transition-colors">
                    <div class="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center text-3xl text-amber-500 group-hover:scale-110 transition-transform">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Más demorado</p>
                        <p class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight mt-1">Territorio ${stats.delayed}</p>
                        <p class="text-[8px] text-amber-600 font-black uppercase mt-1 opacity-70">Requiere Atención</p>
                    </div>
                </div>

                <!-- Datos S-13 -->
                <div class="modern-card p-6 border-slate-100 dark:border-white/5 flex flex-col items-center text-center space-y-4 group hover:bg-indigo-500/5 transition-colors">
                    <div class="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-2xl text-indigo-500">
                        <i class="fas fa-file-invoice"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Datos S-13 (Historial)</p>
                        <p class="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">#${stats.historyCount}</p>
                        <p class="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registros cargados</p>
                    </div>
                </div>
            </div>

            <!-- Unified List Tool -->
            <div class="space-y-6">
                <div class="flex items-center justify-between px-4">
                    <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-4">
                        <span class="w-12 h-1 bg-primary/20 rounded-full"></span> 
                        Listado Maestro de Actividad
                    </h4>
                    <select id="hist-filter-status" class="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-slate-500 outline-none focus:border-primary transition-all cursor-pointer">
                        <option value="">TODOS</option>
                        <option value="Asignado">Asignados</option>
                        <option value="Completado">Completados</option>
                        <option value="Disponible">Disponibles</option>
                    </select>
                </div>

                <div id="unified-control-grid" class="space-y-3">
                    <!-- Rendered by JavaScript -->
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

        // Merge logic: Show all territories, but enrich with history data if needed
        // For 'Completado' filter, we search the history log.
        // For other statuses, we use the territory master.

        let displayList = [];

        if (status === 'Completado') {
            displayList = history
                .filter(h => h.estado === 'Completado' || h.estado === 'Predicado')
                .filter(h => h.conductor.toLowerCase().includes(query) || h.numero.toLowerCase().includes(query))
                .slice(0, 50); // Limit historical view for performance
        } else {
            displayList = allTerritorios.filter(t => {
                const matchesQuery = t.numero.toLowerCase().includes(query) || (t.asignado_a && t.asignado_a.toLowerCase().includes(query));
                const matchesStatus = !status || t.estado === status;
                return matchesQuery && matchesStatus;
            });
        }

        if (displayList.length === 0) {
            grid.innerHTML = `
                <div class="py-20 text-center opacity-30">
                    <i class="fas fa-folder-open text-4xl mb-4"></i>
                    <p class="text-xs font-black uppercase tracking-widest">Sin registros encontrados</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = displayList.map(item => {
            const isHistorical = !!item.fecha_entrega;
            const tId = item.id;
            const num = item.numero;
            const cond = item.asignado_a || item.conductor || '—';
            const state = item.estado || 'Disponible';
            const dateAsig = item.fecha_asignacion;

            // Calculate Active Period
            let periodLabel = '—';
            let diffDays = 0;
            if (dateAsig) {
                const start = new Date(dateAsig);
                const end = isHistorical ? new Date(item.fecha_entrega) : new Date();
                diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
                periodLabel = `Desde ${UIHelpers.fmtDateAt(dateAsig)}`;
                if (isHistorical) periodLabel += ` hasta ${UIHelpers.fmtDateAt(item.fecha_entrega)}`;
            }

            const stateColors = {
                'Asignado': 'bg-primary text-white shadow-primary/20',
                'Completado': 'bg-emerald-500 text-white shadow-emerald-500/20',
                'Predicado': 'bg-emerald-500 text-white shadow-emerald-500/20',
                'Pendiente': 'bg-amber-500 text-white shadow-amber-500/20',
                'Disponible': 'bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10 shadow-none'
            };

            const statusClass = stateColors[state] || 'bg-slate-100 text-slate-400';

            return `
                <div class="modern-card !p-4 md:!p-5 flex flex-col md:flex-row items-center border-slate-100 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden">
                    <div class="absolute left-0 top-0 bottom-0 w-1 ${state === 'Asignado' ? 'bg-primary' : (state === 'Disponible' ? 'bg-slate-200 dark:bg-white/10' : 'bg-emerald-500')}"></div>
                    
                    <div class="flex flex-1 items-center gap-6 w-full">
                        <!-- Territory Info -->
                        <div class="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white text-base font-black shadow-lg shrink-0">
                            ${num}
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 flex-1">
                            <!-- Conductor / Asignado -->
                            <div class="flex flex-col">
                                <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Publicador / Asignado</span>
                                <span class="text-[13px] font-black text-slate-800 dark:text-white uppercase truncate">${cond}</span>
                            </div>
                            
                            <!-- Activo / Periodo -->
                            <div class="flex flex-col">
                                <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Periodo Activo</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-[11px] font-bold text-slate-600 dark:text-gray-300 font-mono">${periodLabel}</span>
                                    ${(state === 'Asignado' && diffDays > 0) ? `<span class="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 text-[9px] px-1.5 py-0.5 rounded-lg font-black uppercase">${diffDays}D</span>` : ''}
                                </div>
                            </div>
                            
                            <!-- Status -->
                            <div class="flex flex-col md:items-end xl:items-start justify-center hidden sm:flex">
                                <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado Actual</span>
                                <span class="${statusClass} text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest transition-all">
                                    ${state}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Unified Actions Power UP -->
                    <div class="w-full md:w-auto flex items-center gap-2 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-50 dark:border-white/5 ml-0 md:ml-6 shrink-0">
                        ${state === 'Asignado' ? `
                             <button onclick="window.quickReturn('${tId}', '${num}')" title="Marcar como Completado" class="flex-1 md:flex-none w-10 h-10 flex items-center justify-center bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl border border-emerald-500/20 transition-all shadow-sm">
                                <i class="fas fa-check-double text-xs"></i>
                             </button>
                             <button onclick="window.quickTransfer('${tId}', '${num}')" title="Transferir" class="flex-1 md:flex-none w-10 h-10 flex items-center justify-center bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-xl border border-indigo-500/20 transition-all shadow-sm">
                                <i class="fas fa-exchange-alt text-xs"></i>
                             </button>
                        ` : ''}
                        
                        ${state === 'Disponible' || state === 'Sin asignar' ? `
                             <button onclick="window.quickAssign('${tId}', '${num}')" title="Asignar" class="flex-1 md:flex-none px-4 h-10 flex items-center justify-center bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all text-[9px] font-black uppercase tracking-widest">
                                Asignar
                             </button>
                        ` : ''}

                         <button onclick="window.editActivityRecord('${isHistorical ? 'hist-' + item.id : 'terr-' + tId}')" title="Editar" class="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-primary rounded-xl transition-all">
                            <i class="fas fa-edit text-xs"></i>
                         </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    searchInp.oninput = renderGrid;
    statusFilter.onchange = renderGrid;

    // --- QUICK ACTIONS ---

    window.quickAssign = (id, num) => {
        showModal(`
            <div class="p-8 space-y-10">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-3xl text-primary shadow-inner">
                        <i class="fas fa-plus-circle"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Asignar #${num}</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Control de Campo S-13</p>
                    </div>
                </header>

                <div class="space-y-6">
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Conductor Destinatario</label>
                        <select id="asig-cond" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase appearance-none cursor-pointer">
                            <option value="">Seleccionar...</option>
                            ${allPublicadores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha de Inicio</label>
                        <input type="date" id="asig-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-primary outline-none focus:border-primary transition-all uppercase">
                    </div>
                </div>

                <div class="flex gap-4 pt-6 border-t border-slate-50 dark:border-white/5">
                    <button id="cancel-asig" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cerrar</button>
                    <button id="confirm-asig" class="flex-[2] py-5 bg-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">Confirmar Asignación</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#cancel-asig').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#confirm-asig').onclick = async () => {
                const cond = modal.querySelector('#asig-cond').value;
                const d = modal.querySelector('#asig-date').value;
                if (!cond || !d) return showNotification("Faltan datos", "warning");

                await assignTerritorio(id, cond, { fecha_asignacion: new Date(d + 'T12:00:00Z').toISOString() });
                showNotification("Territorio asignado correctamente");
                modal.classList.add('hidden');
                renderHistorialView(container);
            };
        });
    };

    window.quickReturn = (id, num) => {
        showCustomConfirm(`¿Marcar territorio #${num} como COMPLETADO hoy? Se registrará automáticamente en el historial S-13.`, async () => {
            await returnTerritorio(id, "Informado desde Panel de Control", new Date().toISOString(), "Completado");
            showNotification("Territorio completado");
            renderHistorialView(container);
        });
    };

    window.quickTransfer = (id, num) => {
        showModal(`
            <div class="p-8 space-y-8">
                 <h3 class="text-xl font-black uppercase text-center tracking-tighter">Transferir #${num}</h3>
                 <div class="space-y-4">
                    <select id="transfer-dest" class="w-full p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-black uppercase text-sm outline-none focus:border-indigo-500">
                        <option value="">Seleccionar Nuevo Conductor...</option>
                        ${allConductores.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                    </select>
                    <button id="do-transfer" class="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20">Realizar Transferencia</button>
                 </div>
            </div>
        `, (modal) => {
            modal.querySelector('#do-transfer').onclick = async () => {
                const dest = modal.querySelector('#transfer-dest').value;
                if (!dest) return;
                await transferTerritorio(id, dest);
                showNotification("Transferido correctamente");
                modal.classList.add('hidden');
                renderHistorialView(container);
            };
        });
    };

    window.editActivityRecord = async (fullId) => {
        const [type, id] = fullId.split('-');
        if (type === 'hist') {
            editHistoryRecord(id);
        } else {
            // It's a territory, maybe we want to edit territory properties?
            // Actually, in this view, "Edit" should probably mean "Edit Assignment Details"
            const t = allTerritorios.find(x => x.id === id);
            if (!t) return;

            showNotification("Editando asignación actual...");
            // ... logic to edit current territory row if needed ...
        }
    };

    // --- Bulk return ---
    container.querySelector('#btn-bulk-return').onclick = () => {
        const assigned = allTerritorios.filter(t => t.estado === 'Asignado');
        if (assigned.length === 0) return showNotification("No hay territorios activos", "info");

        showModal(`
            <div class="p-8 space-y-8 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-3xl text-emerald-500 shadow-inner">
                        <i class="fas fa-check-double"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Informar Completados</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Sincronización masiva de S-13</p>
                    </div>
                </header>

                <div class="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 pb-6">
                    <div id="bulk-list" class="space-y-3">
                        ${assigned.map(t => `
                            <label class="flex items-center gap-4 p-5 modern-card border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-all group active:scale-[0.98]">
                                <input type="checkbox" class="bulk-check w-6 h-6 rounded-lg accent-primary" value="${t.id}">
                                <div class="flex-1">
                                    <div class="flex justify-between items-center">
                                        <p class="text-sm font-black text-slate-700 dark:text-white uppercase tracking-tight">#${t.numero} • ${t.asignado_a}</p>
                                        <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">${UIHelpers.fmtDateAt(t.fecha_asignacion)}</span>
                                    </div>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="pt-6 border-t border-slate-50 dark:border-white/5 flex gap-4">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all hover:bg-slate-100">Cerrar</button>
                    <button id="confirm-bulk-info" class="flex-[2] py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition-transform active:scale-95">
                        <i class="fas fa-check-circle"></i> Confirmar Lote
                    </button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#confirm-bulk-info').onclick = async (e) => {
                const checked = Array.from(modal.querySelectorAll('.bulk-check:checked')).map(cb => cb.value);
                if (checked.length === 0) return;

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

                const { returnTerritorioMultiple } = await import('../../data/firestore-services.js?v=2.2.5');
                await returnTerritorioMultiple(checked, "Lote administrador", new Date().toISOString(), "Completado");

                showNotification(`Se completaron ${checked.length} territorios`);
                modal.classList.add('hidden');
                renderHistorialView(container);
            };
        });
    };

    container.querySelector('#btn-new-assignment').onclick = () => {
        showModal(`
            <div class="p-8 space-y-10">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-3xl text-emerald-500 shadow-inner">
                        <i class="fas fa-plus-circle"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Registrar Asignación</h3>
                        <p class="text-[10px] text-emerald-600 font-bold uppercase tracking-[0.3em] mt-1">Ingreso Manual S-13</p>
                    </div>
                </header>

                <div class="space-y-8">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Conductor / Publicador</label>
                            <select id="asig-conductor" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-emerald-500 transition-all uppercase shadow-inner appearance-none cursor-pointer">
                                <option value="">Seleccionar...</option>
                                ${allPublicadores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha de Registro</label>
                            <input type="date" id="asig-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-emerald-600 outline-none focus:border-emerald-500 transition-all uppercase shadow-inner">
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Territorio a asignar</label>
                        <input type="text" id="asig-territorio" readonly placeholder="Clic para seleccionar..." class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[14px] font-black text-slate-700 dark:text-white outline-none cursor-pointer shadow-inner hover:border-emerald-500 transition-all">
                    </div>
                </div>

                <div class="pt-8 border-t border-slate-50 dark:border-white/5 flex gap-4">
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
                    <button id="confirm-asig-man" class="flex-[2] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-save"></i> Procesar Registro
                    </button>
                </div>
            </div>
        `, (modal) => {
            const terrInput = modal.querySelector('#asig-territorio');
            let selectedTId = null;

            terrInput.onclick = () => {
                const available = allTerritorios.filter(t => t.estado === 'Disponible' || t.estado === 'Sin asignar');
                showTerritorySelectionModal('', available, (display, id) => {
                    terrInput.value = display;
                    selectedTId = id;
                }, 'modal-container-nested');
            };

            modal.querySelector('#confirm-asig-man').onclick = async () => {
                const cond = modal.querySelector('#asig-conductor').value;
                const date = modal.querySelector('#asig-date').value;
                if (!cond || !date || !selectedTId) return showNotification("Complete los campos", "warning");

                await assignTerritorio(selectedTId, cond, { fecha_asignacion: new Date(date + 'T12:00:00Z').toISOString() });
                showNotification("Asignación registrada exitosamente");
                modal.classList.add('hidden');
                renderHistorialView(container);
            };
        });
    };

    renderGrid();
};

window.editHistoryRecord = async (id) => {
    // Legacy support for historical record editing
    const history = await getHistorialReport();
    const rec = history.find(r => r.id === id);
    if (!rec) return;

    showModal(`
        <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
            <header class="shrink-0 bg-primary p-6 md:p-8 text-white relative overflow-hidden">
                <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                <div class="relative z-10 flex items-center gap-6">
                    <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                        <i class="fas fa-history"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Editar Registro</h3>
                        <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Historial ID: ${rec.numero || 'S13'}</p>
                    </div>
                </div>
            </header>

            <div class="flex-1 p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-black/20">
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
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Nuevo Estado</label>
                            <select id="edit-h-status" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[11px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase shadow-inner cursor-pointer appearance-none">
                                <option value="Asignado" ${rec.estado === "Asignado" ? "selected" : ""}>Asignado (Activo)</option>
                                <option value="Completado" ${rec.estado === "Completado" || rec.estado === "Predicado" ? "selected" : ""}>Completado</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <footer class="shrink-0 p-6 md:p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
                <button id="btn-save-hist" class="flex-[1.5] py-5 bg-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <i class="fas fa-save"></i> Guardar Cambios
                </button>
            </footer>
        </div>
    `, (modal) => {
        modal.querySelector("#btn-save-hist").onclick = async (e) => {
            const btn = e.currentTarget;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            const payload = {
                conductor: modal.querySelector("#edit-h-cond").value.trim(),
                estado: modal.querySelector("#edit-h-status").value,
                fecha_asignacion: new Date(modal.querySelector("#edit-h-date").value + 'T12:00:00Z').toISOString()
            };
            await updateHistoryRecord(id, payload);
            showNotification("Registro actualizado");
            modal.classList.add('hidden');
            location.reload(); // Simple refresh for historical consistency
        };
    });
};
