import { showNotification } from '../utils/helpers.js';
import { getTelefonos, updateTelefonoStatus, releaseUnusedTelefonos, solicitarNumeros, logSessionSummary, updateTelefono } from '../../data/firestore-services.js';
import { showModal, showCustomConfirm, showCustomPrompt } from '../services/ui-helpers.js';
import { AppConfig } from '../utils/config.js';

export const initializePhoneModule = (initialPhones, publicadores, displayName, tbody, onRefresh) => {
    // Xolvy Data Shield: Clean and filter phone records
    const normalize = (val) => String(val || '').replace(/[\s\-\(\)]/g, '').trim();
    const myPhones = (initialPhones || [])
        .filter(p => p.telefono && String(p.telefono).trim().length > 0)
        .map(p => ({
            ...p,
            telefono: normalize(p.telefono)
        }));

    const render = () => {
        if (!tbody) return;

        tbody.innerHTML = myPhones.map(p => `
            <tr class="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="text-[13px] font-black text-slate-800 dark:text-white tabular-nums">${p.telefono}</span>
                        ${p.ultimo_resultado ? `<span class="text-[8px] font-black uppercase text-slate-400 mt-0.5 tracking-widest">${p.ultimo_resultado}</span>` : ''}
                    </div>
                </td>
                <td class="p-4">
                    <p class="font-black text-[10px] text-slate-600 dark:text-slate-300 uppercase">${p.propietario || '---'}</p>
                </td>
                <td class="p-4 hidden sm:table-cell">
                    <p class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate max-w-[150px]">${p.direccion || '---'}</p>
                </td>
                <td class="p-4">
                    <select onchange="window.updatePhoneStaff('${p.id}', this.value)" class="bg-slate-100 dark:bg-white/5 border-none rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-primary transition-all">
                        <option value="">SIN ASIGNAR</option>
                        ${publicadores.map(pub => `<option value="${pub.nombre}" ${p.publicador_asignado === pub.nombre ? 'selected' : ''}>${pub.nombre}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4 text-center">
                    <button onclick="window.openPhoneStatusSelector('${p.id}', '${p.telefono}')" class="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all">
                        ${p.estado || 'SIN ASIGNAR'}
                    </button>
                </td>
                <td class="p-4">
                     <button onclick="window.openPhoneNotes('${p.id}', '${p.telefono}', '${(p.notas || '').replace(/'/g, "\\\'")}')" class="text-slate-400 hover:text-indigo-500 transition-colors">
                        <i class="fas fa-sticky-note"></i>
                     </button>
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
            onRefresh();
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
