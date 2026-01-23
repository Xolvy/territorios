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

    const stats = {
        total: history.length,
        activos: history.filter(h => h.estado === 'Asignado').length,
        vencidos: history.filter(h => {
            if (h.estado !== 'Asignado') return false;
            const diff = (new Date() - new Date(h.fecha_asignacion)) / (1000 * 60 * 60 * 24 * 30);
            return diff >= 4;
        }).length
    };

    container.innerHTML = `
        <div class="space-y-8 animate-fade-in p-2 md:p-6 max-w-7xl mx-auto w-full overflow-x-hidden">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div class="space-y-1">
                    <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-4">
                         <div class="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                            <i class="fas fa-history"></i>
                        </div>
                        Gestión y Reportes
                    </h3>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] ml-1">Control histórico y formularios S-13</p>
                </div>
                
                <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button id="btn-bulk-return" class="flex-1 md:flex-none px-6 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-gray-300 hover:border-emerald-500/50 transition-all flex items-center justify-center gap-3 shadow-sm">
                        <i class="fas fa-check-double text-emerald-500"></i> Informar Completados
                    </button>
                    <button id="btn-new-assignment" class="flex-1 md:flex-none px-8 py-4 bg-primary hover:bg-primary-light text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-plus-circle"></i> Nueva Asignación
                    </button>
                </div>
            </header>

            <!-- Stats Ribbon -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div class="modern-card group !p-5 border-slate-100 dark:border-white/5 flex items-center gap-5 transition-all hover:bg-primary/5">
                    <div class="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary text-xl">
                        <i class="fas fa-file-invoice"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Registros Totales</p>
                        <p class="text-xl font-black text-slate-800 dark:text-white">${stats.total}</p>
                    </div>
                </div>
                <div class="modern-card group !p-5 border-slate-100 dark:border-white/5 flex items-center gap-5 transition-all hover:bg-emerald-500/5">
                    <div class="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 text-xl">
                        <i class="fas fa-check-double"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">En curso (S-13)</p>
                        <p class="text-xl font-black text-emerald-500">${stats.activos}</p>
                    </div>
                </div>
                <div class="modern-card group !p-5 border-slate-100 dark:border-white/5 flex items-center gap-5 transition-all hover:bg-rose-500/5">
                    <div class="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 text-xl">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vencidos (>4 meses)</p>
                        <p class="text-xl font-black text-rose-500">${stats.vencidos}</p>
                    </div>
                </div>
            </div>

            <!-- Filters and Search -->
            <div class="flex flex-col md:flex-row gap-4 items-center bg-white/50 dark:bg-white/[0.03] p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 backdrop-blur-xl shadow-sm">
                 <div class="relative flex-1 group w-full">
                    <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"><i class="fas fa-search"></i></span>
                    <input type="text" id="hist-search" placeholder="Buscar por conductor o territorio..." class="w-full bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl pl-14 pr-4 py-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white">
                </div>
                <div class="flex gap-2 w-full md:w-auto">
                    <select id="hist-filter-status" class="flex-1 md:w-48 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white outline-none focus:border-primary cursor-pointer appearance-none shadow-sm">
                        <option value="">Todos los estados</option>
                        <option value="Asignado">Asignado</option>
                        <option value="Completado">Completado</option>
                        <option value="Predicado">Predicado</option>
                    </select>
                </div>
            </div>

            <!-- Main Log / Table UI -->
            <div id="hist-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                <!-- Data goes here -->
            </div>
        </div>
    `;

    const grid = container.querySelector('#hist-grid');
    const searchInp = container.querySelector('#hist-search');
    const statusFilter = container.querySelector('#hist-filter-status');

    const renderGrid = () => {
        const query = searchInp.value.toLowerCase();
        const status = statusFilter.value;

        const filtered = history.filter(h => {
            const matchesQuery = h.conductor.toLowerCase().includes(query) || h.numero.toLowerCase().includes(query);
            const matchesStatus = !status || h.estado === status;
            return matchesQuery && matchesStatus;
        }).sort((a, b) => new Date(b.fecha_asignacion) - new Date(a.fecha_asignacion));

        grid.innerHTML = filtered.map(h => {
            const dateObj = new Date(h.fecha_asignacion);
            const isOld = h.estado === 'Asignado' && (new Date() - dateObj) / (1000 * 60 * 60 * 24 * 30) >= 4;

            return `
                <div class="modern-card !p-0 overflow-hidden border-slate-100 dark:border-white/5 flex flex-col group hover:border-primary/30 transition-all shadow-xl hover:shadow-2xl">
                    <div class="p-6 space-y-5">
                        <div class="flex justify-between items-start">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-lg font-black text-primary shadow-inner">
                                    ${h.numero}
                                </div>
                                <div>
                                    <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight line-clamp-1">${h.conductor}</h4>
                                    <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">${UIHelpers.fmtDate(h.fecha_asignacion)}</p>
                                </div>
                            </div>
                            <span class="text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border ${h.estado === 'Asignado' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10'}">
                                ${h.estado}
                            </span>
                        </div>

                        ${isOld ? `
                            <div class="bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 flex items-center gap-3 animate-pulse">
                                <i class="fas fa-exclamation-triangle text-rose-500 text-xs"></i>
                                <span class="text-[9px] font-black text-rose-600 uppercase tracking-widest">Retraso crítico detectado</span>
                            </div>
                        ` : ''}

                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1">
                                <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fecha en que se completó</p>
                                <p class="text-[10px] font-bold text-slate-600 dark:text-gray-300">${h.fecha_entrega ? UIHelpers.fmtDate(h.fecha_entrega) : '-'}</p>
                            </div>
                             <div class="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1">
                                <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Publicador</p>
                                <p class="text-[10px] font-bold text-slate-600 dark:text-gray-300 truncate">${h.publicador_nombre || '-'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-auto p-4 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex gap-2">
                        <button onclick="window.editHistoryRecord('${h.id}')" class="flex-1 py-3 bg-white dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl border border-slate-200 dark:border-white/10 text-[9px] font-black uppercase tracking-widest transition-all">Editar</button>
                        <button onclick="window.deleteHistoryRecordUI('${h.id}', '${h.conductor}', '${h.numero}')" class="px-4 py-3 bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-xl border border-slate-200 dark:border-white/10 transition-all"><i class="fas fa-trash-alt text-[10px]"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    };

    searchInp.oninput = renderGrid;
    statusFilter.onchange = renderGrid;

    container.querySelector('#btn-bulk-return').onclick = () => {
        const assigned = history.filter(h => h.estado === 'Asignado');
        if (assigned.length === 0) return showNotification("No hay territorios para devolver", "info");

        showModal(`
            <div class="p-8 space-y-8 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-3xl text-emerald-500 shadow-inner">
                        <i class="fas fa-check-double"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Informar Completados</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Sincronización de lote (S-13)</p>
                    </div>
                </header>

                <div class="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    <div id="bulk-list" class="space-y-3">
                        ${assigned.map(h => `
                            <label class="flex items-center gap-4 p-5 modern-card border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-all group active:scale-[0.98]">
                                <input type="checkbox" class="bulk-check w-6 h-6 rounded-lg accent-primary" value="${h.id}" data-tid="${h.territorio_id}">
                                <div class="flex-1">
                                    <div class="flex justify-between items-center">
                                        <p class="text-sm font-black text-slate-700 dark:text-white uppercase tracking-tight">#${h.numero} • ${h.conductor}</p>
                                        <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">${UIHelpers.fmtDate(h.fecha_asignacion)}</span>
                                    </div>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="pt-6 border-t border-slate-50 dark:border-white/5 flex gap-4">
                    <button id="cancel-bulk" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cerrar</button>
                    <button id="confirm-bulk-return" class="flex-[2] py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3">
                        <i class="fas fa-check-circle"></i> Confirmar como Completados
                    </button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#cancel-bulk').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#confirm-bulk-return').onclick = async (e) => {
                const checked = Array.from(modal.querySelectorAll('.bulk-check:checked'));
                if (checked.length === 0) return showNotification("Selecciona al menos uno", "warning");

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

                try {
                    const data = checked.map(cb => ({ recordId: cb.value, territoryId: cb.dataset.tid }));
                    // Logic from firestore-services: returnTerritorioMultiple
                    const { returnTerritorioMultiple } = await import('../../data/firestore-services.js?v=2.2.5');
                    await returnTerritorioMultiple(data);
                    showNotification(`Se completaron ${checked.length} territorios`);
                    modal.classList.add('hidden');
                    renderHistorialView(container);
                } catch (e) {
                    showNotification(e.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = 'Error';
                }
            };
        });
    };

    container.querySelector('#btn-new-assignment').onclick = () => {
        showModal(`
            <div class="p-8 space-y-10 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-3xl text-emerald-500 shadow-inner">
                        <i class="fas fa-plus-circle"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Nueva Asignación</h3>
                        <p class="text-[10px] text-emerald-600 font-bold uppercase tracking-[0.3em] mt-1">Registro Manual de S-13</p>
                    </div>
                </header>

                <div class="space-y-8">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conductor / Persona</label>
                             <div class="relative">
                                <select id="asig-conductor" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-emerald-500 transition-all uppercase shadow-inner appearance-none cursor-pointer">
                                    <option value="">Seleccionar...</option>
                                    <optgroup label="Conductores">
                                        ${allConductores.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                                    </optgroup>
                                    <optgroup label="Otros Publicadores">
                                        ${allPublicadores.filter(p => !allConductores.some(c => c.nombre === p.nombre)).map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                                    </optgroup>
                                </select>
                                <i class="fas fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"></i>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Asignación</label>
                            <input type="date" id="asig-date" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-emerald-600 outline-none focus:border-emerald-500 transition-all uppercase shadow-inner">
                        </div>
                    </div>

                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Territorio(s)</label>
                        <div class="flex gap-3">
                            <input type="text" id="asig-territorio" readonly placeholder="Clic para seleccionar..." class="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none cursor-pointer shadow-inner hover:border-emerald-500 transition-all">
                            <div class="w-16 h-[62px] bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 shadow-inner border border-emerald-500/10">
                                <i class="fas fa-map-marked-alt"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="pt-8 border-t border-slate-50 dark:border-white/5 flex gap-4">
                    <button id="cancel-asig" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all hover:bg-slate-100">Cerrar</button>
                    <button id="confirm-asig" class="flex-[2] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-save"></i> Registrar Asignación
                    </button>
                </div>
            </div>
        `, (modal) => {
            const terrInput = modal.querySelector('#asig-territorio');
            let selectedTId = null;

            terrInput.onclick = () => {
                showTerritorySelectionModal(terrInput.value, allTerritorios, (display, ids) => {
                    terrInput.value = display;
                    selectedTId = ids; // Can be a map or single ID
                }, 'modal-container-nested');
            };

            modal.querySelector('#cancel-asig').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#confirm-confirm-asig')?.remove(); // Cleanup if needed

            modal.querySelector('#confirm-asig').onclick = async (e) => {
                const cond = modal.querySelector('#asig-conductor').value;
                const date = modal.querySelector('#asig-date').value;
                const terrNum = terrInput.value;

                if (!cond || !date || !terrNum) return showNotification("Complete todos los campos", "warning");

                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

                try {
                    // Logic for bulk/single assignment manually
                    const { assignTerritorioParcial } = await import('../../data/firestore-services.js?v=2.2.5');
                    await assignTerritorioParcial(terrNum, cond, new Date(date + 'T12:00:00Z').toISOString());

                    showNotification("Asignación registrada con éxito");
                    modal.classList.add('hidden');
                    renderHistorialView(container);
                } catch (e) {
                    showNotification(e.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = 'Error';
                }
            };
        });
    };

    renderGrid();
};

window.editHistoryRecord = async (id) => {
    const history = await getHistorialReport();
    const rec = history.find(r => r.id === id);
    if (!rec) return showNotification("Registro no encontrado", "error");

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
                                <option value="Predicado" ${rec.estado === "Predicado" ? "selected" : ""}>Predicado</option>
                            </select>
                        </div>
                    </div>

                    <div class="space-y-3 ${rec.estado === 'Asignado' ? 'hidden' : ''}" id="edit-h-delivery-container">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Fecha en que se completó (S-13)</label>
                        <input type="date" id="edit-h-delivery-date" value="${rec.fecha_entrega ? rec.fecha_entrega.split("T")[0] : ""}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[11px] font-black text-emerald-600 outline-none focus:border-emerald-500 transition-all shadow-inner uppercase">
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
        modal.querySelector("#edit-h-status").onchange = (e) => {
            const container = modal.querySelector("#edit-h-delivery-container");
            if (e.target.value === 'Asignado') container.classList.add('hidden');
            else container.classList.remove('hidden');
        };

        modal.querySelector("#btn-save-hist").onclick = async (e) => {
            const btn = e.currentTarget;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...'; btn.disabled = true;
            try {
                const newDate = modal.querySelector("#edit-h-date").value;
                const newC = modal.querySelector("#edit-h-cond").value.trim();
                const newS = modal.querySelector("#edit-h-status").value;
                const newDdate = modal.querySelector("#edit-h-delivery-date").value;
                const sync = modal.querySelector("#edit-h-sync").checked;
                const payload = { conductor: newC, estado: newS };
                if (newDate) payload.fecha_asignacion = new Date(newDate + 'T12:00:00Z').toISOString();
                if (newDdate && newS !== 'Asignado') payload.fecha_entrega = new Date(newDdate + 'T12:00:00Z').toISOString();
                else if (newS === 'Asignado') payload.fecha_entrega = null;
                await updateHistoryRecord(id, payload);
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

                // Trigger refresh if in a view that supports it
                if (window.dispatchModuleSync) window.dispatchModuleSync();
            } catch (e) { showNotification(e.message, "error"); btn.innerText = "Error"; btn.disabled = false; }
        };
    });
};

window.deleteHistoryRecordUI = (id, cond, num) => {
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
            const history = await getHistorialReport();
            const rec = history.find(r => r.id === id);
            await deleteHistoryRecord(id);
            if (resetTerr && rec && rec.territorio_id) {
                await updateTerritorio(rec.territorio_id, { estado: "Disponible", asignado_a: null, fecha_asignacion: null });
            }
            showNotification("Registro eliminado correctamente");
            if (window.dispatchModuleSync) window.dispatchModuleSync();
        } catch (e) { showNotification(e.message, "error"); }
    });
};
