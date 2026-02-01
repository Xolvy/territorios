import {
    getRecursos, addRecurso, deleteRecurso, updateRecurso
} from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';
import { showModal, showCustomConfirm } from '../services/ui-helpers.js';

export const renderRecursosTab = async (container) => {
    const recursos = await getRecursos();

    container.innerHTML = `
        <div class="animate-fade-in p-2 md:p-6 space-y-10 max-w-7xl mx-auto pb-20">
            <!-- MATERIAL DE APOYO SECTION -->
            <section class="space-y-10">
                <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div>
                        <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-4">
                            <div class="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                                <i class="fas fa-folder-open"></i>
                            </div>
                            Material de Apoyo
                        </h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2 ml-1">Recursos digitales para el ministerio</p>
                    </div>
                    <button id="add-recurso-btn" class="w-full sm:w-auto bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-plus-circle"></i> Nuevo Recurso
                    </button>
                </header>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    ${recursos.length === 0 ? `
                        <div class="col-span-full py-20 text-center opacity-30">
                            <p class="font-black text-[10px] uppercase tracking-[0.4em]">No hay recursos registrados</p>
                        </div>
                    ` : recursos.map(r => `
                        <div class="modern-card group !p-0 overflow-hidden border-slate-100 dark:border-white/5 flex flex-col shadow-xl hover:shadow-2xl transition-all hover:border-primary/30">
                            <div class="h-44 bg-slate-100 dark:bg-black/40 relative overflow-hidden">
                                ${r.imagen ? `<img src="${r.imagen}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">` :
            `<div class="w-full h-full flex items-center justify-center text-slate-300 dark:text-white/5 text-4xl">
                                    <i class="fas fa-image"></i>
                                </div>`}
                                <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                    <button onclick="window.editRecurso('${r.id}')" class="w-9 h-9 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-white rounded-xl shadow-xl flex items-center justify-center hover:bg-primary hover:text-white transition-colors backdrop-blur-md">
                                        <i class="fas fa-edit text-xs"></i>
                                    </button>
                                    <button onclick="window.deleteRecurso('${r.id}')" class="w-9 h-9 bg-white/90 dark:bg-slate-900/90 text-rose-500 rounded-xl shadow-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors backdrop-blur-md">
                                        <i class="fas fa-trash-alt text-xs"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="p-6 flex-1 flex flex-col space-y-4">
                                <h4 class="text-[13px] font-black text-slate-800 dark:text-white uppercase leading-tight line-clamp-2">${r.titulo}</h4>
                                <div class="pt-4 mt-auto">
                                    <a href="${r.url}" target="_blank" class="w-full bg-slate-50 dark:bg-white/5 hover:bg-primary group/btn text-slate-500 dark:text-gray-400 hover:text-white py-4 rounded-2xl border border-slate-100 dark:border-white/10 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                        Abrir
                                        <i class="fas fa-external-link-alt text-[8px]"></i>
                                    </a>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        </div>
    `;

    const openRecursoModal = (rec = null) => {
        const isEdit = !!rec;
        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas ${isEdit ? 'fa-edit' : 'fa-plus'}"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">${isEdit ? 'Editar Recurso' : 'Nuevo Material'}</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Material de Apoyo</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="space-y-6">
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Título del Material</label>
                            <input type="text" id="rec-title" value="${rec?.titulo || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase shadow-inner" placeholder="P. ej: Video para Primera Conversación">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Enlace (URL)</label>
                            <input type="url" id="rec-url" value="${rec?.url || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-xs font-bold text-primary outline-none focus:border-primary transition-all shadow-inner" placeholder="https://jw.org/...">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Miniatura (URL Opcional)</label>
                            <input type="url" id="rec-img" value="${rec?.imagen || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[11px] font-bold text-slate-500 outline-none focus:border-primary transition-all shadow-inner" placeholder="https://...">
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Descripción breve</label>
                            <textarea id="rec-desc" rows="3" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary transition-all resize-none shadow-inner" placeholder="¿Cómo ayuda este recurso al publicador?">${rec?.descripcion || ''}</textarea>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-rec" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10 transition-all active:scale-95">
                        Cancelar
                    </button>
                    <button id="save-rec-btn" class="flex-[1.5] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> ${isEdit ? 'Actualizar' : 'Guardar Material'}
                    </button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-cancel-rec').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#save-rec-btn').onclick = async () => {
                const btn = modal.querySelector('#save-rec-btn');
                const title = modal.querySelector('#rec-title').value.trim();
                const url = modal.querySelector('#rec-url').value.trim();
                const img = modal.querySelector('#rec-img').value.trim();
                const desc = modal.querySelector('#rec-desc').value.trim();

                if (!title || !url) return showNotification("Título y URL obligatorios", "warning");

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Procesando...';

                try {
                    const data = { titulo: title, url, imagen: img, descripcion: desc };
                    if (isEdit) await updateRecurso(rec.id, data);
                    else await addRecurso(data);
                    showNotification(isEdit ? "Recurso actualizado" : "Recurso añadido");
                    modal.classList.add('hidden');
                    renderRecursosTab(container);
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Reintentar';
                }
            };
        });
    };

    container.querySelector('#add-recurso-btn').onclick = () => openRecursoModal();
    window.editRecurso = (id) => openRecursoModal(recursos.find(r => r.id === id));
    window.deleteRecurso = (id) => showCustomConfirm("¿Eliminar este material de apoyo permanentemente?", async () => {
        await deleteRecurso(id);
        showNotification("Recurso eliminado");
        renderRecursosTab(container);
    });
};
