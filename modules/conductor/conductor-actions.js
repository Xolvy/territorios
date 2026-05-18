/**
 * @module conductor-actions
 * @description Acciones de UI Modals para el Conductor Dashboard.
 * @layer Frontend / Utils
 */

import { showModal, UIHelpers, showCustomPrompt } from '../services/ui-helpers.js';
import { getTerritorios, getTerritoryHistory, returnTerritorio, assignFreeTerritory, transferTerritory, takeTerritoryPartial, getTelefonos, getPublicadores, addPublicador, updateTelefonoStatus, solicitarNumeros } from '../../data/firestore-services.js';
import { formatPhoneNumber, showNotification } from '../utils/helpers.js';
import { MapViewer } from '../map-viewer.js';
import { ReceptionHub } from '../services/reception-hub.js';

export async function openProgressModal(initialId, filterIds = null) {
    const user = window.XolvyApp?.user;
    const authUser = (await import('../../firebase-config.js')).auth.currentUser;
    
    // Xolvy Data Shield: Normalización robusta del nombre para evitar desincronización de candado
    const resolvedName = normalizeRobust(user?.nombre || authUser?.displayName || authUser?.email || 'Usuario');

    await ReceptionHub.openModal({
        preSelectedId: initialId,
        viewMode: 'conductor',
        displayName: resolvedName,
        isAdmin: user?.role === 'Administrador' || user?.role === 'SuperAdmin'
    });
}
window.openProgressModal = openProgressModal;

/**
 * Legacy wrapper for backward compatibility or direct calls
 */
window.promptReturnTerritorio = async (id, numero) => {
    const user = window.XolvyApp?.user;
    const authUser = (await import('../../firebase-config.js')).auth.currentUser;
    const resolvedName = normalizeRobust(user?.nombre || authUser?.displayName || authUser?.email || 'Usuario');

    await ReceptionHub.openModal({
        preSelectedId: id,
        viewMode: 'conductor',
        displayName: resolvedName,
        isAdmin: user?.role === 'Administrador' || user?.role === 'SuperAdmin'
    });
};

export async function showUnifiedTerritoryHistory(territoryId, territoryNum) {
    try {
        const modalContainer = document.getElementById('modal-container');
        const previousHTML = modalContainer.innerHTML;

        const history = await getTerritoryHistory(territoryId);
        showModal(`
            <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden shadow-2xl">
                <header class="p-8 bg-amber-500 text-slate-800 dark:text-slate-100 flex items-center gap-6">
                    <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20"><i class="fas fa-history"></i></div>
                    <div><h3 class="text-xl font-black uppercase tracking-tight leading-none mb-1">Historial T-${territoryNum}</h3></div>
                </header>
                <div class="flex-1 min-w-0 p-8 overflow-y-auto custom-scrollbar space-y-4">
                    ${history.map(rec => `
                        <div class="modern-card p-6 border-slate-200 dark:border-white/5">
                            <p class="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase mb-2">${new Date(rec.fecha_entrega || rec.fecha).toLocaleDateString()}</p>
                            <p class="text-sm font-bold text-slate-800 dark:text-slate-200">"${rec.notas || rec.observaciones || 'Sin notas'}"</p>
                        </div>
                    `).join('')}
                </div>
                <footer class="p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                    <button id="btn-back-history" class="w-full py-5 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest hover:text-primary transition-all">Regresar</button>
                </footer>
            </div>
        `, (modal) => {
            const btn = modal.querySelector('#btn-back-history');
            if (btn) {
                btn.onclick = () => {
                    modalContainer.innerHTML = previousHTML;
                };
            }
        }, 'max-w-2xl');
    } catch (e) { showNotification("Error al cargar historial", "error"); }
}

window.showUnifiedTerritoryHistory = showUnifiedTerritoryHistory;

export async function handleRescueTerritory(id, num, newConductor, manzanasStr, isFree = false) {
    const manzanas = manzanasStr ? manzanasStr.split(',').map(m => m.trim()).filter(Boolean) : [];
    let selectedManzanas = [...manzanas];

    if (manzanas.length > 1) {
        const result = await new Promise(resolve => {
            const modal = document.getElementById('modal-container');
            modal.innerHTML = `
                <div class="modal-body max-w-md w-full glass-morphism p-10 rounded-[3rem] border border-white/20 shadow-2xl">
                    <h3 class="text-2xl font-black mb-2 uppercase text-center">Seleccionar Alcance</h3>
                    <p class="text-[10px] text-slate-500 text-center mb-8 font-black uppercase italic">T-${num}: ${manzanas.length} Manzanas</p>
                    <div class="space-y-3 mb-8 px-2">
                        ${manzanas.map(m => `
                            <label class="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                                <span class="text-sm font-bold">Manzana ${m}</span>
                                <input type="checkbox" checked value="${m}" class="rescue-mz-check w-5 h-5 rounded-lg text-primary">
                            </label>
                        `).join('')}
                    </div>
                    <div class="flex flex-col gap-3">
                        <button id="rescue-confirm-partial" class="btn-pro bg-primary text-white py-5 rounded-[2rem]">Tomar Selección</button>
                        <button id="rescue-cancel-partial" class="w-full py-4 text-[9px] font-black uppercase text-slate-600 dark:text-slate-400">Regresar</button>
                    </div>
                </div>
            `;
            modal.classList.remove('hidden');
            document.getElementById('rescue-cancel-partial').onclick = () => { modal.classList.add('hidden'); resolve(null); };
            document.getElementById('rescue-confirm-partial').onclick = () => {
                const checks = modal.querySelectorAll('.rescue-mz-check:checked');
                const picked = Array.from(checks).map(c => c.value);
                modal.classList.add('hidden');
                resolve(picked.length > 0 ? picked : null);
            };
        });
        if (!result) return;
        selectedManzanas = result;
    }

    try {
        showNotification("Procesando...", "info");
        if (selectedManzanas.length === manzanas.length) {
            if (isFree) await assignFreeTerritory(id, newConductor, num, selectedManzanas.join(', '));
            else await transferTerritory(id, newConductor, selectedManzanas.join(', '));
        } else {
            const remaining = manzanas.filter(m => !selectedManzanas.includes(m));
            await takeTerritoryPartial(id, newConductor, selectedManzanas, remaining);
        }
        showNotification('¡Éxito! Territorio #' + num + ' actualizado.', "success");
        if (window.refreshConductorView) window.refreshConductorView(true);
    } catch (err) {
        console.error(err);
        showNotification("Error: " + err.message, "error");
    }
}

window.handleRescueTerritory = handleRescueTerritory;

export async function openRevisitasModal(displayName) {
    showNotification("Cargando revisitas...", "info");
    const [allPhones, allPubs] = await Promise.all([
        getTelefonos(true),
        getPublicadores()
    ]);
    const revisitas = allPhones.filter(p => p.estado === 'Revisita');

    const resolveName = (raw) => {
        const clean = String(raw || '').trim();
        if (!clean) return 'Sin asignar';
        const found = allPubs.find(p => p.id === clean || p.email?.toLowerCase() === clean.toLowerCase() || p.nombre === clean);
        return found ? found.nombre : clean;
    };

    showModal(`
    <div class="p-8 space-y-8 bg-slate-50 dark:bg-[#0b0e14]">
    <div class="flex items-center gap-6">
        <div class="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-3xl text-amber-500 shadow-inner border border-amber-500/10">
            <i class="fas fa-sync-alt rotate-180"></i>
        </div>
        <div>
            <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-1">Centro de Revisitas</h3>
            <p class="text-[10px] text-amber-500 font-black uppercase tracking-[0.3em]">Gestión de contactos interesados</p>
        </div>
    </div>

    <div class="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
        ${revisitas.length === 0 ? `
            <div class="py-12 text-center opacity-40">
                <p class="text-[10px] font-black uppercase tracking-[0.4em]">No hay revisitas registradas</p>
            </div>
        ` : revisitas.map(r => `
            <div class="modern-card bg-white dark:bg-white/[0.03] !p-6 border-slate-200 dark:border-white/5 group hover:border-amber-500/30 transition-all shadow-sm">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-lg font-black text-slate-800 dark:text-white tabular-nums">${formatPhoneNumber(r.telefono)}</h4>
                        <p class="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mt-1">${r.nombre || ''}</p>
                    </div>
                    <div class="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[8px] font-black uppercase tracking-widest">Revisita</div>
                </div>
                
                <div class="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-black/5">
                    <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs">
                        <i class="fas fa-user-edit"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-0.5">Responsable</p>
                        <p class="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">${resolveName(r.asignado_a || r.publicador_asignado)}</p>
                    </div>
                </div>

                ${r.notas ? `
                    <div class="mb-6 p-4 bg-amber-50/30 dark:bg-amber-500/5 rounded-xl border border-amber-500/10 italic text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                        "${r.notas}"
                    </div>
                ` : ''}

                <div class="flex justify-center">
                    <button onclick="window.returnPhoneToPool('${r.id}')" class="w-full py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-500/5 flex items-center justify-center gap-2">
                        <i class="fas fa-undo-alt"></i> Devolver
                    </button>
                </div>
            </div>
        `).join('')}
    </div>
    
    <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full py-4 text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.3em] hover:text-primary transition-colors">Cerrar Ventana</button>
</div>
`, null, 'max-w-2xl');

    window.returnPhoneToPool = async (id) => {
        showCustomPrompt("Indica la razón de la devolución (esto se guardará en el historial):", "", async (reason) => {
            if (!reason || reason.trim().length === 0) {
                showNotification("Debes indicar una razón", "warning");
                return;
            }
            await updateTelefonoStatus(id, 'Sin asignar', null, reason);
            document.getElementById('modal-container').classList.add('hidden');

            showNotification("Número devuelto correctamente.", "success", 5000, [], async () => {
                try {
                    await updateTelefonoStatus(id, 'Revisita', null, 'Devolución deshecha por el usuario');
                    showNotification("Acción deshecha.");
                    if(window.refreshConductorView) window.refreshConductorView(true);
                } catch (err) {
                    console.error("Undo error:", err);
                    showNotification("No se pudo deshacer la acción", "error");
                }
            });

            if(window.refreshConductorView) window.refreshConductorView(true);
        });
    };

    window.reAssignAndCall = async (id, phone) => {
        await solicitarNumeros(1, displayName);
        window.openPhoneNotes(id, phone, '');
        document.getElementById('modal-container').classList.add('hidden');
    };
}
window.openRevisitasModal = openRevisitasModal;

export async function openAddPublicadorModal() {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
<div class="modern-card p-10 max-w-sm w-full shadow-2xl relative animate-bounce-in border-primary/20 bg-white dark:bg-[#0b0e14]">
        <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl text-primary mx-auto mb-6 shadow-inner border border-primary/10">
            <i class="fas fa-user-plus"></i>
        </div>
        <h3 class="text-2xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tighter text-center">Nuevo Publicador</h3>
        <p class="text-[10px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-8 text-center">Registrar nuevo integrante</p>
        
        <div class="space-y-6">
            <div class="space-y-2">
                 <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-4">Nombre Completo</label>
                 <input type="text" id="new-pub-name-input" placeholder="Ej: Juan Pérez" class="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-primary/30 rounded-2xl px-6 py-4 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-white/10 outline-none transition-all placeholder:text-slate-400 font-bold shadow-inner">
            </div>
        </div>

        <div class="flex gap-4 mt-10">
            <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="flex-1 min-w-0 py-5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 rounded-2xl hover:bg-slate-200 transition-colors">Cancelar</button>
            <button id="confirm-add-pub" class="flex-1 min-w-0 py-5 text-[10px] font-black uppercase tracking-widest text-white bg-primary rounded-2xl shadow-xl shadow-primary/30 hover:bg-primary-dark transition-all hover:scale-105 active:scale-95">Agregar</button>
        </div>
    </div>
`;
    modal.classList.remove('hidden');
    const inputName = document.getElementById('new-pub-name-input');
    inputName.focus();

    const submit = async () => {
        const name = inputName.value.trim();
        if (name.length > 0) {
            try {
                modal.classList.add('hidden');
                await addPublicador({ nombre: name });
                showNotification("Publicador agregado correctamente.", "success");
                if (window.refreshConductorView) window.refreshConductorView(true);
            } catch (e) {
                console.error(e);
                showNotification("Error al agregar publicador: " + e.message, "error");
            }
        }
    };

    document.getElementById('confirm-add-pub').onclick = submit;
    inputName.onkeypress = (e) => { if (e.key === 'Enter') submit(); };
}
window.openAddPublicadorModal = openAddPublicadorModal;

export function openGlobalMapModal(type, allTerritorios) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.classList.remove('hidden');

    if (type === 'png') {
        modal.innerHTML = `
<div class="w-full h-full max-w-5xl mx-auto flex flex-col p-4 animate-fade-in">
<div class="flex justify-between items-center mb-4 bg-white/80 dark:bg-[#0f1420]/90 backdrop-blur-2xl p-6 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl">
<div class="flex items-center gap-5">
    <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-xl text-primary shadow-inner border border-primary/10">
        <i class="fas fa-image"></i>
    </div>
    <div>
        <h4 class="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[11px]">Cartografía General</h4>
        <p class="text-[9px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Mapa Estático de la Congregación</p>
    </div>
</div>
<button onclick="document.getElementById('modal-container').classList.add('hidden'); document.getElementById('modal-container').classList.remove('flex');" class="w-12 h-12 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all flex items-center justify-center text-lg active:scale-95">
    <i class="fas fa-times"></i>
</button>
</div>
        </div>

<div class="flex-1 min-w-0 overflow-hidden rounded-[2.5rem] bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 flex items-center justify-center relative touch-none shadow-inner" id="png-zoom-container">
<img id="global-png-map" src="assets/mapa-general.jpg" class="max-w-full max-h-full object-contain transition-all duration-200 ease-out shadow-2xl origin-center" style="transform: scale(1) translate(0px, 0px);">

<!-- Dynamic Controls -->
<div class="absolute bottom-10 right-10 flex flex-col gap-3 z-50">
    <button id="btn-global-zoom-in" class="w-12 h-12 rounded-2xl bg-white/95 dark:bg-[#1a1c2a]/95 backdrop-blur shadow-2xl text-primary font-black border border-slate-200 dark:border-white/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
        <i class="fas fa-plus"></i>
    </button>
    <button id="btn-global-zoom-out" class="w-12 h-12 rounded-2xl bg-white/95 dark:bg-[#1a1c2a]/95 backdrop-blur shadow-2xl text-primary font-black border border-slate-200 dark:border-white/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
        <i class="fas fa-minus"></i>
    </button>
    <button id="btn-global-zoom-reset" class="w-12 h-12 rounded-2xl bg-primary text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all group">
        <i class="fas fa-undo-alt group-hover:rotate-[-45deg] transition-transform"></i>
    </button>
</div>
</div>
    </div >
`;
        modal.classList.add('flex');
        setTimeout(() => {
            let panZoomController = UIHelpers.initImagePanZoom('global-png-map', 'png-zoom-container');
            if (panZoomController) {
                modal.querySelector('#btn-global-zoom-in').onclick = () => panZoomController.zoom(0.3);
                modal.querySelector('#btn-global-zoom-out').onclick = () => panZoomController.zoom(-0.3);
                modal.querySelector('#btn-global-zoom-reset').onclick = () => panZoomController.reset();
            }
        }, 100);
    } else if (type === 'satellite') {
        modal.innerHTML = '<div id="global-map-root" class="w-full h-full max-w-6xl mx-auto p-4 md:p-10"></div>';
        MapViewer.renderGlobal(document.getElementById('global-map-root'), allTerritorios);
    }
}
window.openGlobalMapModal = openGlobalMapModal;
