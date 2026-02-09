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
                <!-- Col 1: Telefono (Desktop) / Header (Mobile) -->
                <td class="p-0 sm:p-4 block sm:table-cell align-middle">
                    <div class="flex flex-col">
                        <div class="flex items-center justify-between sm:justify-start gap-4">
                            <span class="text-[14px] sm:text-[13px] font-black text-slate-800 dark:text-white tabular-nums tracking-tight">${p.telefono}</span>
                            <!-- Mobile Status Badge (Only Mobile) -->
                            <div class="sm:hidden px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-indigo-500/10">
                                ${p.estado || 'SIN ASIGNAR'}
                            </div>
                        </div>
                        <!-- Owner only visible in first col if on Mobile -->
                        <p class="sm:hidden font-black text-[11px] text-slate-600 dark:text-slate-300 uppercase mt-1">${p.propietario || '---'}</p>
                    </div>
                </td>
                
                <!-- Col 2: Propietario (Desktop Only) -->
                <td class="p-4 hidden sm:table-cell align-middle">
                    <p class="font-black text-[10px] text-slate-600 dark:text-slate-300 uppercase">${p.propietario || '---'}</p>
                </td>

                <!-- Col 3: Direccion (Desktop Only or merged below on Mobile) -->
                <td class="p-0 sm:p-4 block sm:table-cell align-middle">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-map-marker-alt text-primary/30 text-[9px] sm:hidden"></i>
                        <p class="text-[10px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate max-w-full sm:max-w-[150px]">${p.direccion || '---'}</p>
                    </div>
                </td>

                <!-- Col 4: Publicador (Both) -->
                <td class="p-0 sm:p-4 block sm:table-cell align-middle">
                    <div class="flex flex-row items-center gap-2 sm:gap-4">
                        <div class="flex-1">
                            <p class="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:hidden ml-1">Asignar Publicador</p>
                            <select onchange="window.updatePhoneStaff('${p.id}', this.value)" class="w-full sm:w-auto bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-lg px-3 py-2.5 sm:py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-primary transition-all">
                                <option value="">SIN ASIGNAR</option>
                                ${publicadores.map(pub => `<option value="${pub.nombre}" ${p.publicador_asignado === pub.nombre ? 'selected' : ''}>${pub.nombre}</option>`).join('')}
                            </select>
                        </div>
                        
                        <!-- Side Actions: Notes (Desktop) / Notes (Mobile) -->
                        <div class="flex items-center gap-2 sm:hidden">
                             <button onclick="window.openPhoneStatusSelector('${p.id}', '${p.telefono}')" class="px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-black/5 whitespace-nowrap">
                                ESTADO
                            </button>
                            <button onclick="window.openPhoneNotes('${p.id}', '${p.telefono}', '${(p.notas || '').replace(/'/g, "\\\'")}')" class="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-primary transition-colors bg-slate-100 dark:bg-white/5 rounded-xl border border-black/5">
                                <i class="fas fa-sticky-note"></i>
                            </button>
                        </div>
                    </div>
                </td>

                <!-- Col 5: Estado (Desktop Only Button) -->
                <td class="p-4 hidden sm:table-cell text-center align-middle">
                    <button onclick="window.openPhoneStatusSelector('${p.id}', '${p.telefono}')" class="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-all">
                        ${p.estado || 'SIN ASIGNAR'}
                    </button>
                </td>

                <!-- Col 6: Notas (Desktop Only Icon) -->
                <td class="p-4 hidden sm:table-cell align-middle">
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
