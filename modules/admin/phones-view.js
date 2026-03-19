import {
    getPublicadores, startLivePool,
    updateTelefono, addTelefono, deleteTelefono, autoCleanTelefonosData
} from '../../data/firestore-services.js';
import { formatPhoneNumber, getStatusColor, showNotification } from '../utils/helpers.js';
import { showModal, showCustomConfirm } from '../services/ui-helpers.js';
import { setAdminLivePool } from '../admin-dashboard.js';

export const renderTelefonosTab = async (container) => {
    let telefonos = [];
    const publicadores = await getPublicadores();

    publicadores.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

    // Ejecuta limpieza automática en segundo plano cuando el Admin entra a la vista
    autoCleanTelefonosData();

    // Xolvy Live Pool: Start real-time monitoring
    const unsub = startLivePool("telefonos", [], (data) => {
        telefonos = data;
        console.log("📱 [Live Pool] Phone Directory Updated.");
        renderData(searchInput?.value || '', container.querySelector('#show-hidden-phones')?.checked);
    });
    setAdminLivePool(unsub);

    container.innerHTML = `
        <div class="space-y-8 animate-fade-in">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3 uppercase tracking-tighter">
                        <i class="fas fa-phone-alt text-primary"></i> Directorio Telefónico
                    </h3>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1 ml-1">Gestión de registros y asignaciones para predicación</p>
                </div>
                
                <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div class="relative flex-1 md:flex-none md:w-64 group">
                        <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"><i class="fas fa-search"></i></span>
                        <input type="text" id="phone-search" placeholder="Número o nombre..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl !pl-14 pr-4 py-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white">
                    </div>
                    <button id="add-phone-btn" class="flex-1 md:flex-none px-8 py-4 bg-primary hover:bg-primary-light text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-plus-circle"></i> Agregar Registro
                    </button>
                    <label class="flex items-center gap-2 px-4 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl cursor-pointer whitespace-nowrap group/toggle">
                        <input type="checkbox" id="show-hidden-phones" class="w-4 h-4 rounded text-primary transition-transform group-active/toggle:scale-90">
                        <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ver Ocultos</span>
                    </label>
                </div>
            </header>

            <div class="hidden lg:block modern-card !p-0 overflow-hidden border-slate-100 dark:border-white/5 shadow-2xl relative">
                    <table class="w-full text-left border-collapse table-fixed">
                        <thead class="bg-slate-50 dark:bg-black/40 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100 dark:border-white/5">
                            <tr>
                                <th class="p-4 md:p-6 w-[40%] cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group/th text-primary" data-sort="propietario">
                                    Información de Contacto <i class="fas fa-sort-up ml-2 transition-all"></i>
                                </th>
                                <th class="p-4 md:p-6 text-center w-[20%] cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group/th" data-sort="estado">
                                    Estado <i class="fas fa-sort ml-2 opacity-30 transition-all"></i>
                                </th>
                                <th class="p-4 md:p-6 w-[30%] cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group/th" data-sort="asignacion">
                                    Asignación Actual <i class="fas fa-sort ml-2 opacity-30 transition-all"></i>
                                </th>
                                <th class="p-4 md:p-6 text-right w-[10%]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="phone-table-body" class="divide-y divide-slate-100 dark:divide-white/5">
                            <!-- Injected -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Mobile List -->
            <div id="phone-mobile-list" class="lg:hidden space-y-4">
                <!-- Injected -->
            </div>
        </div>
    `;

    const tbody = container.querySelector('#phone-table-body');
    const mobileList = container.querySelector('#phone-mobile-list');
    const searchInput = container.querySelector('#phone-search');

    const publicadoresMap = {};
    publicadores.forEach(p => {
        publicadoresMap[p.id] = p.nombre;
        publicadoresMap[p.nombre] = p.nombre; // Keep names as is
    });

    const getDisplayName = (val) => {
        if (!val) return null;
        return publicadoresMap[val] || val;
    };

    let sortConfig = { key: 'propietario', direction: 'asc' };

    const renderData = (query = '', showHidden = false) => {
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);

        const lowerCaseQuery = query.toLowerCase();
        let filtered = [...telefonos];

        if (!showHidden) {
            filtered = filtered.filter(t => {
                // Hide Revisita
                if (t.estado === 'Revisita') return false;

                // Hide 'No llamar' if within 6 months
                if (t.ultimo_estado === 'No llamar') {
                    const lastDate = t.fecha_ultimo_estado ? new Date(t.fecha_ultimo_estado) : new Date(0);
                    if (lastDate > sixMonthsAgo) return false;
                }

                return true;
            });
        }

        if (query) {
            filtered = filtered.filter(t =>
                t.numero.toLowerCase().includes(lowerCaseQuery) ||
                (t.nombre && t.nombre.toLowerCase().includes(lowerCaseQuery)) ||
                (t.propietario && t.propietario.toLowerCase().includes(lowerCaseQuery)) ||
                (t.direccion && t.direccion.toLowerCase().includes(lowerCaseQuery))
            );
        }

        // Apply Sorting
        filtered.sort((a, b) => {
            let valA = '', valB = '';

            if (sortConfig.key === 'propietario') {
                valA = a.propietario || a.nombre || '';
                valB = b.propietario || b.nombre || '';
            } else if (sortConfig.key === 'estado') {
                valA = a.estado || '';
                valB = b.estado || '';
            } else if (sortConfig.key === 'asignacion') {
                valA = getDisplayName(a.asignado_a) || '';
                valB = getDisplayName(b.asignado_a) || '';
            }

            const cmp = valA.localeCompare(valB, undefined, { numeric: true });
            return sortConfig.direction === 'asc' ? cmp : -cmp;
        });

        tbody.innerHTML = filtered.map(t => {
            const eStr = String(t.estado || '').toLowerCase().trim();
            const estado = (eStr === 'sin asignar' || eStr === 'no asignado' || eStr === 'disponible' || eStr === 'null' || !eStr) ? '' : t.estado;
            const asignadoA = getDisplayName(t.asignado_a);

            return `
            <tr class="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <td class="p-4 md:p-6 w-[40%]">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition-colors">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="min-w-0">
                            <p class="text-xs md:text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">${t.propietario || t.nombre || 'Desconocido'}</p>
                            <p class="text-[10px] md:text-[11px] text-slate-400 font-mono font-bold">${formatPhoneNumber(t.numero)}</p>
                        </div>
                    </div>
                </td>
                <td class="p-4 md:p-6 text-center w-[20%]">
                    ${estado ? `<span class="${getStatusColor(estado)} text-[9px] md:text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-current/20 shadow-sm whitespace-nowrap">${estado}</span>` : ''}
                </td>
                <td class="p-4 md:p-6 w-[30%]">
                    ${asignadoA ? `
                        <div class="flex items-center gap-2">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(asignadoA)}&background=random&color=fff" class="w-6 h-6 rounded-lg shrink-0">
                            <div class="flex flex-col min-w-0">
                                <span class="text-[10px] md:text-[11px] font-black text-slate-500 uppercase truncate">${asignadoA}</span>
                                <span class="text-[8px] font-bold text-slate-400/70 uppercase tracking-tighter">${t.fecha_asignacion ? new Date(t.fecha_asignacion).toLocaleDateString() : ''}</span>
                            </div>
                        </div>
                    ` : '<span class="text-[10px] text-slate-300 uppercase font-bold italic">No asignado</span>'}
                </td>
                <td class="p-4 md:p-6 w-[10%] text-right">
                    <div class="flex items-center justify-end gap-2 opacity-10 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="window.editPhone('${t.id}')" class="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl border border-slate-200 dark:border-white/10 transition-all shadow-sm">
                            <i class="fas fa-edit text-xs"></i>
                        </button>
                        <button onclick="window.deletePhone('${t.id}')" class="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-500 rounded-xl border border-slate-200 dark:border-white/10 transition-all shadow-sm">
                            <i class="fas fa-trash-alt text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `}).join('');

        mobileList.innerHTML = filtered.map(t => {
            const eStr = String(t.estado || '').toLowerCase().trim();
            const estado = (eStr === 'sin asignar' || eStr === 'no asignado' || eStr === 'disponible' || eStr === 'null' || !eStr) ? '' : t.estado;
            const asignadoA = getDisplayName(t.solicitado_por || t.asignado_a);

            return `
            <div class="modern-card p-5 border-slate-100 dark:border-white/5 shadow-xl space-y-4 relative overflow-hidden group">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <i class="fas fa-user text-sm"></i>
                        </div>
                        <div>
                            <p class="text-xs font-black text-slate-800 dark:text-white uppercase">${t.propietario || t.nombre || 'Desconocido'}</p>
                            <p class="text-[10px] text-slate-400 font-mono">${formatPhoneNumber(t.numero)}</p>
                        </div>
                    </div>
                    ${estado ? `<span class="${getStatusColor(estado)} text-[8px] font-black uppercase px-2 py-1 rounded-md border border-current/20">${estado}</span>` : ''}
                </div>
                <div class="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-white/5">
                    <div class="text-[9px] font-black text-slate-400 uppercase">
                        ${asignadoA ? `Asig: <span class="text-slate-600 dark:text-slate-300 ml-1">${asignadoA}</span>` : 'Sin asignar'}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.editPhone('${t.id}')" class="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-white/5 rounded-lg text-slate-400"><i class="fas fa-edit text-[10px]"></i></button>
                        <button onclick="window.deletePhone('${t.id}')" class="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-white/5 rounded-lg text-rose-400"><i class="fas fa-trash-alt text-[10px]"></i></button>
                    </div>
                </div>
            </div>
        `}).join('');
    };

    const toggleSort = (key) => {
        if (sortConfig.key === key) {
            sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortConfig.key = key;
            sortConfig.direction = 'asc';
        }

        // Update header UI
        container.querySelectorAll('th[data-sort]').forEach(th => {
            const icon = th.querySelector('i');
            if (th.dataset.sort === key) {
                th.classList.add('text-primary');
                icon.className = `fas fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'} ml-2`;
                icon.style.opacity = '1';
            } else {
                th.classList.remove('text-primary');
                icon.className = 'fas fa-sort ml-2';
                icon.style.opacity = '0.3';
            }
        });

        renderData(searchInput.value, container.querySelector('#show-hidden-phones').checked);
    };

    const openModalPhone = (phone = null) => {
        const isEdit = !!phone;
        const estados = ['Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Testigo', 'Suspendido'];

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-phone"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight mb-1">${isEdit ? 'Editar Registro' : 'Nuevo Registro'}</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Directorio Telefónico</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Número de Teléfono</label>
                            <input type="text" id="m-phone-num" value="${phone?.numero || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner" placeholder="0987654321">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Nombre / Propietario</label>
                            <input type="text" id="m-phone-name" value="${phone?.propietario || phone?.nombre || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner uppercase" placeholder="EJ: JUAN PEREZ">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Dirección / Referencia</label>
                            <input type="text" id="m-phone-address" value="${phone?.direccion || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner uppercase" placeholder="EJ: CALLE 1 Y CALLE 2">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Estado</label>
                            <select id="m-phone-state" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all appearance-none cursor-pointer shadow-inner">
                                <option value="" ${(!phone?.estado || phone?.estado === 'Sin asignar' || phone?.estado === 'Disponible') ? 'selected' : ''}></option>
                                ${estados.map(s => `<option value="${s}" ${phone?.estado === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Responsable Actual</label>
                            <select id="m-phone-asig" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all appearance-none cursor-pointer shadow-inner">
                                <option value=""></option>
                                ${publicadores.map(p => `<option value="${p.nombre}" ${(phone?.solicitado_por === p.nombre || phone?.asignado_a === p.nombre) ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
                    <button id="m-save-phone" class="flex-[2] py-5 bg-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> ${isEdit ? 'Guardar Cambios' : 'Crear Registro'}
                    </button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector('#m-save-phone').onclick = async () => {
                const btn = modal.querySelector('#m-save-phone');
                const original = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...';

                const asigVal = modal.querySelector('#m-phone-asig').value || null;
                const data = {
                    numero: modal.querySelector('#m-phone-num').value.trim(),
                    propietario: modal.querySelector('#m-phone-name').value.trim(),
                    direccion: modal.querySelector('#m-phone-address').value.trim(),
                    estado: modal.querySelector('#m-phone-state').value,
                    solicitado_por: asigVal,
                    asignado_a: asigVal
                };

                if (asigVal && (!phone || (!phone.solicitado_por && !phone.asignado_a))) {
                    data.fecha_asignacion = new Date().toISOString();
                }

                if (!data.numero) {
                    showNotification("El número es obligatorio", "error");
                    btn.disabled = false; btn.innerHTML = original;
                    return;
                }

                try {
                    if (isEdit) await updateTelefono(phone.id, data);
                    else await addTelefono(data);
                    showNotification("Directorio actualizado");
                    document.getElementById('modal-container').classList.add('hidden');
                } catch (e) {
                    showNotification(e.message, "error");
                    btn.disabled = false; btn.innerHTML = original;
                }
            };
        });
    };

    window.editPhone = (id) => openModalPhone(telefonos.find(t => t.id === id));
    window.deletePhone = (id) => showCustomConfirm("¿Eliminar este registro permanentemente?", async () => {
        await deleteTelefono(id);
        showNotification("Registro eliminado");
    });

    container.querySelectorAll('th[data-sort]').forEach(th => {
        th.onclick = () => toggleSort(th.dataset.sort);
    });

    searchInput.oninput = (e) => renderData(e.target.value.toLowerCase(), container.querySelector('#show-hidden-phones').checked);
    container.querySelector('#show-hidden-phones').onchange = (e) => renderData(searchInput.value, e.target.checked);
    container.querySelector('#add-phone-btn').onclick = () => openModalPhone();

    // Initial load
    renderData();
};
