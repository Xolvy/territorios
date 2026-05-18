import { showNotification, formatPhoneNumber, normalizeRobust } from '../utils/helpers.js';
import { updateTelefonoStatus, updateTelefono, deleteTelefono } from '../../data/firestore-services.js';
import { showModal, showCustomPrompt } from '../services/ui-helpers.js';

export const initializePhoneModule = (initialPhones, publicadores, displayName, tbody, onRefresh) => {
    // Xolvy Data Shield: Clean and filter phone records
    const normalize = (val) => String(val || '').replace(/[\s()-]/g, '').trim();
    
    // Xolvy Batch Engine: Memory storage for pending changes
    if (!window.pendingPhoneChanges) window.pendingPhoneChanges = {};

    const myPhones = (initialPhones || [])
        .filter(p => (p.telefono || p.phone || p.numero) && String(p.telefono || p.phone || p.numero).trim().length > 0)
        .map(p => ({
            ...p,
            telefono: normalize(p.telefono || p.phone || p.numero)
        }));

    const render = () => {
        if (!tbody) return;

        // Xolvy Merge Logic: Display pending changes before they hit Firestore
        const displayPhones = myPhones.map(p => {
            const pending = window.pendingPhoneChanges[p.id] || {};
            // If it was deleted (Suspendido/Testigo), we could hide it, but the request says 
            // "El registro NO debe desaparecer de la tabla al cambiar el select".
            return {
                ...p,
                estado: pending.estado || p.estado,
                publicador_asignado: pending.publicador_asignado || p.publicador_asignado,
                notas: pending.notas !== undefined ? pending.notas : p.notas
            };
        });

        tbody.innerHTML = displayPhones.map(p => `
            <tr class="flex flex-col sm:table-row hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group border-b border-black/5 dark:border-white/5 p-4 sm:p-0 gap-4 sm:gap-0">
                <!-- Col 1: Telefono (Desktop) / Header (Mobile) -->
                <td class="p-0 sm:p-4 block sm:table-cell align-middle">
                    <div class="flex flex-col">
                        <div class="flex items-center justify-between sm:justify-start gap-4">
                            <span class="text-[14px] sm:text-[13px] font-black text-slate-800 dark:text-white tabular-nums tracking-tight">
                                <a href="tel:07${p.telefono}" class="md:pointer-events-none md:text-inherit text-primary hover:underline decoration-2 underline-offset-4">
                                    ${formatPhoneNumber(p.telefono)}
                                </a>
                            </span>
                            <!-- Mobile Status Badge (Only Mobile) -->
                            <div class="sm:hidden px-2 py-0.5 ${p.estado && !['Sin asignar', 'En Sesión'].includes(p.estado) ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10' : 'hidden'} rounded-lg text-[8px] font-black uppercase tracking-widest border">
                                ${p.estado}
                            </div>
                        </div>
                        <!-- Owner only visible in first col if on Mobile -->
                        <p class="sm:hidden font-black text-[11px] text-slate-600 dark:text-slate-300 uppercase mt-1">${p.propietario || p.nombre || ''}</p>
                    </div>
                </td>
                
                <!-- Col 2: Nombre (Desktop Only) -->
                <td class="p-4 hidden sm:table-cell align-middle">
                    <p class="font-black text-[10px] text-slate-600 dark:text-slate-300 uppercase">${p.propietario || p.nombre || ''}</p>
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
                        <div class="flex-1 min-w-0">
                            <p class="text-[7px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1 sm:hidden ml-1">Asignar Publicador</p>
                            <select onchange="window.updatePhoneStaff('${p.id}', this.value)" class="w-full sm:w-auto bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-lg px-3 py-2.5 sm:py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-primary transition-all">
                                <option value=""></option>
                                ${publicadores.map(pub => {
            const isSelected = p.publicador_asignado === pub.nombre || p.publicador_asignado === pub.id || p.asignado_a === pub.id;
            return `<option value="${pub.nombre}" ${isSelected ? 'selected' : ''}>${pub.nombre}</option>`;
        }).join('')}
                            </select>
                        </div>
                        
                        <!-- Side Actions: Notes (Desktop) / Notes (Mobile) -->
                        <div class="flex items-center gap-2 sm:hidden">
                             <button onclick="window.openPhoneStatusSelector('${p.id}', '${p.telefono}')" class="px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5 whitespace-nowrap flex items-center gap-2 active:scale-95 transition-all">
                                <i class="fas fa-tag"></i> ESTADO
                            </button>
                            <button onclick="window.openPhoneNotes('${p.id}', '${p.telefono}', '${(p.notas || '').replace(/'/g, "\\'")}')" class="w-12 h-12 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-primary transition-colors bg-slate-100 dark:bg-white/5 rounded-xl border border-black/5">
                                <i class="fas fa-sticky-note"></i>
                            </button>
                        </div>
                    </div>
                </td>

                <!-- Col 5: Estado (Desktop Only Button) -->
                <td class="p-4 hidden sm:table-cell text-center align-middle">
                    <button onclick="window.openPhoneStatusSelector('${p.id}', '${p.telefono}')" 
                        class="min-w-[100px] px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 border-2 
                        ${p.estado && !['Sin asignar', 'En Sesión'].includes(p.estado)
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-xl shadow-emerald-500/20'
                : 'bg-indigo-50/50 dark:bg-indigo-500/5 text-indigo-500 border-indigo-500/20 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-500 shadow-lg shadow-indigo-500/5'}">
                        
                        ${p.estado && !['Sin asignar', 'En Sesión'].includes(p.estado)
                ? `<i class="fas fa-check-circle"></i> ${p.estado}`
                : `<i class="fas fa-plus-circle opacity-50"></i>`}
                    </button>
                    ${p.estado === 'Revisita' ? `
                        <button onclick="window.devolverRevisita('${p.id}')" class="mt-2 block w-full text-[8px] font-black text-rose-500 uppercase tracking-widest hover:underline whitespace-nowrap text-center">
                            <i class="fas fa-undo mr-1"></i> Devolver
                        </button>
                    ` : ''}
                </td>

                <!-- Col 6: Notas (Desktop Only Icon) -->
                <td class="p-4 hidden sm:table-cell align-middle">
                    <button onclick="window.openPhoneNotes('${p.id}', '${p.telefono}', '${(p.notas || '').replace(/'/g, "\\'")}')" class="text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-colors">
                        <i class="fas fa-sticky-note"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    };

    window.updatePhoneStaff = (id, staff) => {
        // Xolvy Batch: Store change in memory, don't hit Firestore yet
        if (!window.pendingPhoneChanges[id]) window.pendingPhoneChanges[id] = {};
        window.pendingPhoneChanges[id].publicador_asignado = staff;
        
        // Visual Feedback only, no notification yet as per request
        render(); 
    };

    window.openPhoneStatusSelector = (id, phone) => {
        const statuses = ['Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];
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

    window.setPhoneStatus = (id, status) => {
        const executeUpdate = () => {
             // Xolvy Batch: Store change in memory
            if (!window.pendingPhoneChanges[id]) window.pendingPhoneChanges[id] = {};
            window.pendingPhoneChanges[id].estado = status;
            
            window.closeModal();
            render(); // Refresh UI to show new status button
        };

        if (status === 'Suspendido' || status === 'Testigo') {
            showModal(`
                <div class="p-10 space-y-8 text-center">
                    <div class="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-[2.5rem] flex items-center justify-center text-3xl mx-auto shadow-xl shadow-rose-500/5">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="space-y-3">
                        <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">¿Confirmar ${status}?</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase leading-relaxed px-4 italic">Se recomienda volver a marcar para confirmar que está ${status === 'Suspendido' ? 'suspendido' : 'una dirección de testigo'}.</p>
                    </div>
                    <div class="flex gap-4 pt-4">
                        <button onclick="window.closeModal()" class="flex-1 min-w-0 px-8 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                        <button id="btn-confirm-purge" class="flex-1 min-w-0 px-8 py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all">Confirmar</button>
                    </div>
                </div>
            `, null, 'max-w-sm');
            
            document.getElementById('btn-confirm-purge').onclick = executeUpdate;
        } else {
            executeUpdate();
        }
    };

    window.devolverRevisita = (id) => {
        if (!window.pendingPhoneChanges[id]) window.pendingPhoneChanges[id] = {};
        window.pendingPhoneChanges[id].estado = ''; // Volver al estado inicial
        render();
        showNotification('Revisita devuelta al pool central', 'info');
    };

    window.openPhoneNotes = (id, phone, currentNotes) => {
        showCustomPrompt(`Notas para ${phone}`, "", (newNotes) => {
            if (!window.pendingPhoneChanges[id]) window.pendingPhoneChanges[id] = {};
            window.pendingPhoneChanges[id].notas = newNotes;
            render();
        });
    };

    render();
};
