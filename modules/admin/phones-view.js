import {
    getTelefonos, getPublicadores, updateTelefono, addTelefono, deleteTelefono, getConfiguracion
} from '../../data/firestore-services.js?v=2.3.8';
import { formatPhoneNumber, getStatusColor, showNotification } from '../utils/helpers.js?v=2.3.8';
import { showModal, showCustomConfirm, UIHelpers } from '../services/ui-helpers.js?v=2.3.8';

export const renderTelefonosTab = async (container) => {
    const [telefonos, publicadores, config] = await Promise.all([
        getTelefonos(),
        getPublicadores(),
        getConfiguracion()
    ]);

    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

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
                        <input type="text" id="phone-search" placeholder="Número o nombre..." class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-14 pr-4 py-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white">
                    </div>
                    <button id="add-phone-btn" class="flex-1 md:flex-none px-8 py-4 bg-primary hover:bg-primary-light text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-plus-circle"></i> Agregar Registro
                    </button>
                </div>
            </header>

            <div class="hidden lg:block modern-card !p-0 overflow-hidden border-slate-100 dark:border-white/5 shadow-2xl relative">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-50 dark:bg-black/40 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100 dark:border-white/5">
                            <tr>
                                <th class="p-4 md:p-6">Información de Contacto</th>
                                <th class="p-4 md:p-6 text-center">Estado</th>
                                <th class="p-4 md:p-6">Asignación Actual</th>
                                <th class="p-4 md:p-6 text-right">Acciones</th>
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

    const renderData = (query = '') => {
        const lowerCaseQuery = query.toLowerCase();
        const filtered = query ? telefonos.filter(t =>
            t.numero.includes(query) ||
            (t.nombre && t.nombre.toLowerCase().includes(lowerCaseQuery)) ||
            (t.propietario && t.propietario.toLowerCase().includes(lowerCaseQuery))
        ) : telefonos;

        const rows = filtered.map(t => `
            <tr class="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <td class="p-6">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-slate-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                            <i class="fas fa-address-book"></i>
                        </div>
                        <div>
                            <p class="text-sm font-black text-slate-800 dark:text-gray-100 uppercase tracking-tight">${t.nombre || t.propietario || 'Desconocido'}</p>
                            <p class="text-xs font-mono text-slate-400 font-bold">${formatPhoneNumber(t.numero)}</p>
                        </div>
                    </div>
                </td>
                <td class="p-6 text-center">
                    <span class="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${t.solicitado_por ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.1)]' : (t.estado && t.estado !== 'Sin asignar' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10')}">
                        ${t.estado || 'Sin asignar'}
                    </span>
                </td>
                <td class="p-6">
                    ${t.solicitado_por ? `
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-700 dark:text-gray-300 uppercase">${t.solicitado_por}</span>
                            <span class="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">${t.fecha_asignacion ? UIHelpers.fmtDate(t.fecha_asignacion) : ''}</span>
                        </div>
                    ` : '<span class="text-[10px] text-slate-300 uppercase italic font-bold">Disponible</span>'}
                </td>
                <td class="p-6">
                    <div class="flex items-center justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                        <button onclick="window.editPhoneManual('${t.id}')" class="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl border border-slate-200 dark:border-white/10 shadow-sm transition-all"><i class="fas fa-edit text-xs"></i></button>
                        <button onclick="window.deletePhoneManual('${t.id}')" class="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-500 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm transition-all"><i class="fas fa-trash-alt text-xs"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        if (tbody) tbody.innerHTML = rows;

        if (mobileList) {
            mobileList.innerHTML = filtered.map(t => `
                <div class="modern-card p-5 border-slate-200 dark:border-white/5 shadow-xl space-y-5 relative overflow-hidden active:scale-[0.98] transition-all group">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-primary/5 rounded-[1.2rem] flex items-center justify-center text-primary text-lg border border-primary/10">
                                <i class="fas fa-mobile-screen-button"></i>
                            </div>
                            <div>
                                <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase truncate max-w-[150px]">${t.nombre || 'Desconocido'}</h4>
                                <p class="text-xs font-mono font-bold text-slate-400 mt-1">${formatPhoneNumber(t.numero)}</p>
                            </div>
                        </div>
                        <span class="px-2.5 py-1.5 rounded-xl text-[8px] font-black uppercase border ${t.solicitado_por ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' : (t.estado && t.estado !== 'Sin asignar' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-50 dark:bg-white/5 text-slate-300 border-slate-100 dark:border-white/5')}">
                            ${t.estado || 'Libre'}
                        </span>
                    </div>
                    
                    <div class="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-white/5">
                        <div class="flex flex-col">
                            <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Asignado a:</span>
                            <span class="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">${t.solicitado_por || 'Disponible'}</span>
                        </div>
                        <div class="flex gap-2">
                             <button onclick="window.editPhoneManual('${t.id}')" class="w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-white/5 text-slate-400 rounded-xl border border-slate-100 dark:border-white/5"><i class="fas fa-edit text-xs"></i></button>
                             <button onclick="window.deletePhoneManual('${t.id}')" class="w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-white/5 text-rose-500/40 rounded-xl border border-slate-100 dark:border-white/5"><i class="fas fa-trash-alt text-xs"></i></button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    };

    renderData();
    if (searchInput) searchInput.oninput = (e) => renderData(e.target.value.trim());

    // --- Modal CRUD ---
    const openPhoneModal = (phone = null) => {
        const isEdit = !!phone;
        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-6 md:p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-phone-flip"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">${isEdit ? 'Editar Registro' : 'Nuevo Teléfono'}</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Telefonía Ministerial</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-6 md:space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="space-y-4 md:space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Número Telefónico</label>
                            <input type="text" id="p-num" value="${phone?.numero || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-base font-black text-primary outline-none focus:ring-4 focus:ring-primary/10 shadow-inner" placeholder="P. ej: 0991234567">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Nombre del Dueño</label>
                            <input type="text" id="p-name" value="${phone?.nombre || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary uppercase shadow-inner" placeholder="Escriba el nombre si se conoce...">
                        </div>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Estado</label>
                                <select id="p-status" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[10px] font-black text-slate-600 dark:text-gray-300 outline-none focus:border-primary cursor-pointer appearance-none shadow-sm">
                                    <option value="Sin asignar" ${phone?.estado === 'Sin asignar' ? 'selected' : ''}>Disponible / Sin asignar</option>
                                    <option value="Contestaron" ${phone?.estado === 'Contestaron' ? 'selected' : ''}>Contestaron</option>
                                    <option value="No contestan" ${phone?.estado === 'No contestan' ? 'selected' : ''}>No contestan</option>
                                    <option value="Colgaron" ${phone?.estado === 'Colgaron' ? 'selected' : ''}>Colgaron</option>
                                    <option value="Revisita" ${phone?.estado === 'Revisita' ? 'selected' : ''}>Revisita</option>
                                    <option value="Predicado" ${phone?.estado === 'Predicado' ? 'selected' : ''}>Predicado</option>
                                    <option value="No llamar" ${phone?.estado === 'No llamar' ? 'selected' : ''}>No llamar</option>
                                    <option value="Suspendido" ${phone?.estado === 'Suspendido' ? 'selected' : ''}>Suspendido / Equivocado</option>
                                    <option value="Testigo" ${phone?.estado === 'Testigo' ? 'selected' : ''}>Testigo</option>
                                </select>
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Responsable Actual</label>
                                <select id="p-solicitado" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[10px] font-black text-slate-600 dark:text-gray-300 outline-none focus:border-primary cursor-pointer appearance-none shadow-sm">
                                    <option value="">Nadie / Disponible</option>
                                    ${publicadores.map(p => `<option value="${p.nombre}" ${phone?.solicitado_por === p.nombre ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-6 md:p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-p" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10 transition-all active:scale-95">
                        Cancelar
                    </button>
                    <button id="btn-save-p" class="flex-[1.5] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> ${isEdit ? 'Actualizar Registro' : 'Crear Registro'}
                    </button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-cancel-p').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#btn-save-p').onclick = async () => {
                const btn = modal.querySelector('#btn-save-p');
                const num = modal.querySelector('#p-num').value.trim();
                const name = modal.querySelector('#p-name').value.trim();
                const status = modal.querySelector('#p-status').value;
                const applicant = modal.querySelector('#p-solicitado').value;

                if (!num) return showNotification("El número es obligatorio", "warning");

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Procesando...';

                const data = {
                    numero: num,
                    nombre: name,
                    estado: status,
                    solicitado_por: applicant || null,
                    fecha_asignacion: applicant ? (phone?.fecha_asignacion || new Date().toISOString()) : null
                };

                try {
                    if (isEdit) await updateTelefono(phone.id, data);
                    else await addTelefono(data);
                    showNotification(isEdit ? "Registro actualizado" : "Número agregado");
                    modal.classList.add('hidden');
                    renderTelefonosTab(container);
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
                }
            };
        });
    };

    container.querySelector('#add-phone-btn').onclick = () => openPhoneModal();
    window.editPhoneManual = (id) => openPhoneModal(telefonos.find(x => x.id === id));
    window.deletePhoneManual = (id) => showCustomConfirm("¿Eliminar este registro telefónico permanentemente?", async () => {
        await deleteTelefono(id);
        renderTelefonosTab(container);
    });
};
