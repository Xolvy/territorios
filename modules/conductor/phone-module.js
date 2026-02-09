import { showNotification } from '../utils/helpers.js';
import { getTelefonos, updateTelefonoStatus, releaseUnusedTelefonos, solicitarNumeros, logSessionSummary, updateTelefono } from '../../data/firestore-services.js';
import { showModal, showCustomConfirm, showCustomPrompt } from '../services/ui-helpers.js';
import { AppConfig } from '../utils/config.js';

export const initializePhoneModule = (initialPhones, publicadores, displayName, tbody, onRefresh) => {
    // Xolvy Data Shield: Clean and filter phone records
    const normalize = (val) => String(val || '').replace(/[\s\-\(\)]/g, '').trim();
    const myPhones = (initialPhones || [])
        .filter(p => (p.telefono || p.phone || p.numero) && String(p.telefono || p.phone || p.numero).trim().length > 0)
        .map(p => ({
            ...p,
            telefono: normalize(p.telefono || p.phone || p.numero)
        }));

    const render = () => {
        if (!tbody) return;

        tbody.innerHTML = myPhones.map(p => `
            <tr class="flex flex-col sm:table-row hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group border-b border-black/5 dark:border-white/5 p-4 sm:p-0 gap-4 sm:gap-0">
                <!-- Mobile: Header with Phone & Status -->
                <td class="p-0 sm:p-4 block sm:table-cell">
                    <div class="flex flex-col">
                        <div class="flex items-center justify-between sm:justify-start gap-4">
                            <span class="text-[14px] sm:text-[13px] font-black text-slate-800 dark:text-white tabular-nums tracking-tight">${p.telefono}</span>
                            <div class="sm:hidden px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-indigo-500/10">
                                ${p.estado || 'SIN ASIGNAR'}
                            </div>
                        </div>
                        <p class="font-black text-[11px] sm:text-[10px] text-slate-600 dark:text-slate-300 uppercase mt-1 sm:mt-0">${p.propietario || '---'}</p>
                        ${p.ultimo_resultado ? `<span class="text-[8px] font-black uppercase text-slate-400 mt-1 tracking-widest hidden sm:block">${p.ultimo_resultado}</span>` : ''}
                    </div>
                </td>
                
                <!-- Desktop Propietario (Hidden on Mobile) -->
                <td class="p-4 hidden sm:table-cell">
                    <p class="font-black text-[10px] text-slate-600 dark:text-slate-300 uppercase">${p.propietario || '---'}</p>
                </td>

                <!-- Address (Visible in both, slightly adjusted for mobile) -->
                <td class="p-0 sm:p-4 block sm:table-cell">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-map-marker-alt text-primary/30 text-[9px] sm:hidden"></i>
                        <p class="text-[10px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate max-w-full sm:max-w-[150px]">${p.direccion || '---'}</p>
                    </div>
                </td>

                <!-- Actions: Publisher, Status, Notes -->
                <td class="p-0 sm:p-4 block sm:table-cell">
                    <div class="flex flex-row items-center gap-2 sm:gap-4">
                        <div class="flex-1">
                            <p class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:hidden ml-1">Publicador</p>
                            <select onchange="window.updatePhoneStaff('${p.id}', this.value)" class="w-full sm:w-auto bg-slate-100 dark:bg-white/5 border-none rounded-xl px-3 py-2.5 sm:py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-primary transition-all">
                                <option value="">SIN ASIGNAR</option>
                                ${publicadores.map(pub => `<option value="${pub.nombre}" ${p.publicador_asignado === pub.nombre ? 'selected' : ''}>${pub.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="window.openPhoneStatusSelector('${p.id}', '${p.telefono}')" class="hidden sm:block px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all">
                                ${p.estado || 'SIN ASIGNAR'}
                            </button>
                            <button onclick="window.openPhoneNotes('${p.id}', '${p.telefono}', '${(p.notas || '').replace(/'/g, "\\\'")}')" class="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 hover:text-primary transition-colors bg-slate-100 dark:bg-white/5 sm:bg-transparent rounded-xl border border-black/5 sm:border-none">
                                <i class="fas fa-sticky-note sm:text-lg"></i>
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');
    };

    window.updatePhoneStaff = async (id, staff) => {
        try {
            // Corrected: passing staff as third param, null as status (keep current)
            await updateTelefonoStatus(id, null, staff);
            showNotification(`Asignado a ${staff}`, 'success');
        } catch (e) {
            showNotification('Error al asignar publicador', 'error');
        }
    };

    window.openPhoneStatusSelector = (id, phone) => {
        const statuses = ['Sin asignar', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];
        showModal(`
            <div class="p-8 space-y-6">
                <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Estado: ${phone}</h3>
                <div class="grid grid-cols-2 gap-3">
                    ${statuses.map(s => `
                        <button onclick="window.setPhoneStatus('${id}', '${s}')" class="p-4 bg-slate-50 dark:bg-white/5 hover:bg-primary hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-white/10 transition-all">
                            ${s}
                        </button>
                    `).join('')}
                </div>
            </div>
        `, null, 'max-w-md');
    };

    window.setPhoneStatus = async (id, status) => {
        try {
            // Corrected signature usage for firestore-services.js
            await updateTelefonoStatus(id, status, displayName);
            window.closeModal();
            onRefresh(id);
            showNotification(`Estado actualizado: ${status}`, 'success');
        } catch (e) {
            showNotification('Error al actualizar estado', 'error');
        }
    };

    window.openPhoneNotes = (id, phone, currentNotes) => {
        showCustomPrompt(`Notas para ${phone}`, async (newNotes) => {
            // Use updateTelefono for simple object updates like notes
            await updateTelefono(id, { notas: newNotes });
            onRefresh();
        }, currentNotes);
    };

    render();
};
