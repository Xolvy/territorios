import {
    getTerritorios, getConductores, getHistorialReport, getConfiguracion,
    assignTerritorio, returnTerritorio, getCampanas
} from '../../data/firestore-services.js?v=2.4.0.4';
import { showNotification } from '../utils/helpers.js?v=2.4.0.4';
import { UIHelpers, showModal, showCustomConfirm, showTerritorySelectionModal } from '../services/ui-helpers.js?v=2.4.0.4';

const { fmtDate } = UIHelpers;

let _globalTerritorios = [];
let _globalConductores = [];
let _globalConfig = {};
let _selectedIds = new Set();

export const renderAsignacionesView = async (container) => {
    const loadData = async () => {
        const [t, c, h, conf] = await Promise.all([
            getTerritorios(), getConductores(), getHistorialReport(), getConfiguracion()
        ]);
        _globalTerritorios = t.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
        _globalConductores = c.filter(p => p.es_conductor).sort((a, b) => a.nombre.localeCompare(b.nombre));
        _globalConfig = conf;
        renderInternal();
    };

    const renderInternal = () => {
        container.innerHTML = `
            <div class="space-y-6 md:space-y-8 animate-fade-in px-1">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <button id="hub-btn-assign" class="group relative bg-white dark:bg-white/5 overflow-hidden p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl transition-all hover:-translate-y-1">
                        <div class="flex items-center gap-6">
                            <div class="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-3xl text-white shadow-lg shadow-primary/30"><i class="fas fa-plus"></i></div>
                            <div class="text-left">
                                <p class="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Operación</p>
                                <p class="text-2xl font-black text-slate-800 dark:text-white uppercase">Nueva Asignación</p>
                            </div>
                        </div>
                    </button>
                    <button id="hub-btn-return" class="group relative bg-white dark:bg-white/5 overflow-hidden p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl transition-all hover:-translate-y-1">
                        <div class="flex items-center gap-6">
                            <div class="w-16 h-16 rounded-2xl bg-rose-500 flex items-center justify-center text-3xl text-white shadow-lg shadow-rose-500/30"><i class="fas fa-file-import"></i></div>
                            <div class="text-left">
                                <p class="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Recepción</p>
                                <p class="text-2xl font-black text-slate-800 dark:text-white uppercase">Informar Completados</p>
                            </div>
                        </div>
                    </button>
                </div>

                <div id="assigns-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-20">
                    ${_globalTerritorios.map(t => {
            const isAssigned = t.estado === 'Asignado' || t.estado === 'Pendiente';
            return `
                        <div class="modern-card p-6 border-slate-100 dark:border-white/5 shadow-xl ${isAssigned ? 'bg-primary/5' : ''}">
                            <div class="flex justify-between items-start mb-4">
                                <span class="bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">#${t.numero}</span>
                                <span class="text-[9px] font-black uppercase tracking-widest ${isAssigned ? 'text-primary' : 'text-slate-400 opacity-40'}">${t.estado}</span>
                            </div>
                            <h4 class="font-black text-lg text-slate-800 dark:text-white uppercase truncate mb-6">${t.asignado_a || 'Disponible'}</h4>
                            <div class="flex gap-2">
                                <button onclick="window.handleNewAssignment('${t.id}')" class="flex-1 py-3 bg-slate-100 dark:bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Gestionar</button>
                            </div>
                        </div>`;
        }).join('')}
                </div>
            </div>
        `;

        container.querySelector('#hub-btn-assign').onclick = () => window.handleNewAssignment();
        container.querySelector('#hub-btn-return').onclick = () => window.handleBulkReturn();
    };

    window.handleNewAssignment = async (editId = null) => {
        const item = editId ? _globalTerritorios.find(x => x.id === editId) : null;
        showModal(`
            <div class="p-8 space-y-6">
                <h3 class="text-xl font-black uppercase">Asignar Territorio</h3>
                <div class="space-y-4">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black uppercase text-slate-400">Territorio(s)</label>
                        <input type="text" id="asig-terr-raw" value="${item ? item.numero : ''}" class="w-full p-4 bg-slate-100 dark:bg-white/5 rounded-xl font-bold" placeholder="Ejem: 10, 15, 20">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black uppercase text-slate-400">Conductor</label>
                        <select id="asig-cond" class="w-full p-4 bg-slate-100 dark:bg-white/5 rounded-xl font-bold">
                            <option value="">Seleccionar Conductor...</option>
                            ${_globalConductores.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <button id="btn-confirm-asig" class="w-full py-4 bg-primary text-white rounded-xl font-black uppercase tracking-widest">Confirmar</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-confirm-asig').onclick = async () => {
                const cond = modal.querySelector('#asig-cond').value;
                const raw = modal.querySelector('#asig-terr-raw').value;
                if (!cond || !raw) return showNotification("Faltan datos", "warning");

                const nums = raw.split(',').map(n => n.trim());
                for (const num of nums) {
                    const t = _globalTerritorios.find(x => String(x.numero) === num);
                    if (t) await assignTerritorio(t.id, cond, { estado: 'Asignado', fecha_asignacion: new Date().toISOString() });
                }
                showNotification("Territorios asignados");
                modal.remove();
                loadData();
            };
        });
    };

    window.handleBulkReturn = async () => {
        const assigned = _globalTerritorios.filter(t => t.estado === 'Asignado');
        if (assigned.length === 0) return showNotification("Nada que devolver", "info");

        showModal(`
            <div class="p-8 space-y-6">
                <h3 class="text-xl font-black uppercase">Informar Territorios Completados</h3>
                <div class="space-y-2 max-h-96 overflow-y-auto">
                    ${assigned.map(t => `
                        <label class="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-xl cursor-pointer">
                            <input type="checkbox" class="ret-check" value="${t.id}">
                            <span class="text-sm font-bold uppercase">#${t.numero} - ${t.asignado_a}</span>
                        </label>
                    `).join('')}
                </div>
                <button id="btn-confirm-ret" class="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest">Confirmar como Completados</button>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-confirm-ret').onclick = async () => {
                const ids = Array.from(modal.querySelectorAll('.ret-check:checked')).map(i => i.value);
                for (const id of ids) await returnTerritorio(id, "Completado masivo", new Date().toISOString(), "Completado");
                showNotification("Territorios marcados como completados");
                modal.remove();
                loadData();
            };
        });
    };

    await loadData();
};
