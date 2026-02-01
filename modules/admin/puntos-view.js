import {
    getPuntosInteres, addPuntoInteres, deletePuntoInteres, updatePuntoInteres,
    getTerritorios
} from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';
import { showModal, showCustomConfirm } from '../services/ui-helpers.js';

export const renderPuntosInteresTab = async (container) => {
    const [puntosInteres, territorios] = await Promise.all([
        getPuntosInteres(), getTerritorios()
    ]);

    container.innerHTML = `
        <div class="animate-fade-in p-2 md:p-6 space-y-16 max-w-7xl mx-auto pb-20">
            <!-- PUNTOS DE INTERÉS / ZONAS ESPECIALES SECTION -->
            <section class="space-y-10">
                <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div>
                        <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-4">
                            <div class="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner">
                                <i class="fas fa-map-marker-alt"></i>
                            </div>
                            Zonas de Predicación Especial
                        </h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2 ml-1">Paradas, parques y puntos estratégicos</p>
                    </div>
                    <button id="add-poi-btn" class="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-600/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-plus-circle"></i> Nueva Zona
                    </button>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${puntosInteres.length === 0 ? `
                        <div class="col-span-full py-20 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2.5rem] opacity-30">
                            <p class="font-black text-[10px] uppercase tracking-[0.4em]">No hay zonas especiales registradas</p>
                        </div>
                    ` : puntosInteres.map(p => `
                        <div class="modern-card group flex flex-col space-y-4 border-slate-100 dark:border-white/5 hover:border-amber-500/30 transition-all shadow-md hover:shadow-xl relative">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600">
                                    <i class="fas ${p.tipo === 'Taxi' ? 'fa-taxi' : p.tipo === 'Bus' ? 'fa-bus' : 'fa-street-view'}"></i>
                                </div>
                                <div class="flex-1">
                                    <h4 class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">${p.nombre}</h4>
                                    <p class="text-[8px] font-black text-amber-500 uppercase tracking-widest mt-0.5">${p.tipo}</p>
                                </div>
                                <div class="flex gap-1">
                                    <button onclick="window.editPOI('${p.id}')" class="p-2 text-slate-400 hover:text-primary transition-colors"><i class="fas fa-edit text-xs"></i></button>
                                    <button onclick="window.deletePOI('${p.id}')" class="p-2 text-slate-400 hover:text-rose-500 transition-colors"><i class="fas fa-trash-alt text-xs"></i></button>
                                </div>
                            </div>
                            <div class="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed mb-3 line-clamp-2">${p.descripcion || 'Sin descripción'}</p>
                                <div class="flex items-center gap-2">
                                    <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Cerca de:</span>
                                    <span class="bg-primary/10 text-primary text-[9px] font-black px-2 py-0.5 rounded-lg uppercase">T-${p.territorio_numero || 'Desconocido'}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        </div>
    `;

    const openPOIModal = (poi = null) => {
        const isEdit = !!poi;
        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-amber-600 p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas ${isEdit ? 'fa-edit' : 'fa-map-marker-alt'}"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">${isEdit ? 'Editar Zona' : 'Nueva Zona Especial'}</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Zonas de Predicación</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Nombre de la Zona</label>
                            <input type="text" id="poi-name" value="${poi?.nombre || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-amber-500 transition-all uppercase shadow-inner" placeholder="P. ej: Parada de Taxis Central">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Tipo de Zona</label>
                            <select id="poi-type" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-amber-500 transition-all uppercase shadow-inner">
                                <option value="Taxi" ${poi?.tipo === 'Taxi' ? 'selected' : ''}>🚕 Parada de Taxis</option>
                                <option value="Bus" ${poi?.tipo === 'Bus' ? 'selected' : ''}>🚌 Parada de Bus</option>
                                <option value="Parque" ${poi?.tipo === 'Parque' ? 'selected' : ''}>🌳 Parque / Plaza</option>
                                <option value="Comercial" ${poi?.tipo === 'Comercial' ? 'selected' : ''}>🏪 Zona Comercial</option>
                                <option value="Otro" ${poi?.tipo === 'Otro' ? 'selected' : ''}>📍 Otro Punto</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Vincular a Territorio cercano</label>
                        <select id="poi-terr" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-amber-500 transition-all uppercase shadow-inner">
                            <option value="">Seleccionar territorio...</option>
                            ${territorios.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true })).map(t => `
                                <option value="${t.id}" data-num="${t.numero}" ${poi?.territorio_id === t.id ? 'selected' : ''}>T-${t.numero}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="space-y-3">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Descripción / Instrucciones</label>
                        <textarea id="poi-desc" rows="3" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-bold text-slate-700 dark:text-white outline-none focus:border-amber-500 transition-all resize-none shadow-inner" placeholder="Indicaciones para predicar en este punto...">${poi?.descripcion || ''}</textarea>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-poi" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10 transition-all active:scale-95">
                        Cancelar
                    </button>
                    <button id="save-poi-btn" class="flex-[1.5] py-5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-amber-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> ${isEdit ? 'Actualizar' : 'Guardar Zona'}
                    </button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-cancel-poi').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#save-poi-btn').onclick = async () => {
                const btn = modal.querySelector('#save-poi-btn');
                const name = modal.querySelector('#poi-name').value.trim();
                const type = modal.querySelector('#poi-type').value;
                const terrId = modal.querySelector('#poi-terr').value;
                const terrNum = modal.querySelector('#poi-terr').options[modal.querySelector('#poi-terr').selectedIndex].dataset.num;
                const desc = modal.querySelector('#poi-desc').value.trim();

                if (!name || !terrId) return showNotification("Nombre y Territorio obligatorios", "warning");

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Procesando...';

                try {
                    const data = { nombre: name, tipo: type, territorio_id: terrId, territorio_numero: terrNum, descripcion: desc };
                    if (isEdit) await updatePuntoInteres(poi.id, data);
                    else await addPuntoInteres(data);
                    showNotification(isEdit ? "Zona actualizada" : "Zona añadida");
                    modal.classList.add('hidden');
                    renderPuntosInteresTab(container);
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Reintentar';
                }
            };
        });
    };

    container.querySelector('#add-poi-btn').onclick = () => openPOIModal();
    window.editPOI = (id) => openPOIModal(puntosInteres.find(p => p.id === id));
    window.deletePOI = (id) => showCustomConfirm("¿Eliminar esta zona de predicación?", async () => {
        await deletePuntoInteres(id);
        showNotification("Zona eliminada");
        renderPuntosInteresTab(container);
    });
};
