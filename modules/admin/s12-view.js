import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
    getTerritorios, deleteTerritorio, updateTerritorio
} from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';
import { showModal, showCustomConfirm } from '../services/ui-helpers.js';

export const renderS12View = async (container, config, appVersion) => {
    let terrs = [];
    try {
        console.log("🔍 S12 View: Requesting fresh territories...");
        // Emergency: Clear memory cache for territories before loading this specific view
        const { clearServiceCache } = await import('../../data/firestore-services.js');
        // We only clear the specific key if possible, or just force fetch
        terrs = await getTerritorios();

        console.log(`📊 S12 View: Received ${terrs.length} territories from Shield.`);

        terrs.sort((a, b) => (tString(a.numero)).localeCompare(tString(b.numero), undefined, { numeric: true }));
    } catch (e) {
        console.error("Error sorting S12:", e);
    }

    function tString(val) {
        return String(val || '').trim();
    }

    const renderGrid = (query = '') => {
        console.log(`🎨 S12 Grid: Rendering with query='${query}', total available=${terrs.length}`);
        const filtered = query ? terrs.filter(t =>
            String(t.numero || '').toLowerCase().includes(query) ||
            (t.localidad && t.localidad.toLowerCase().includes(query)) ||
            (t.nombre && t.nombre.toLowerCase().includes(query))
        ) : terrs;

        const grid = container.querySelector('#s12-grid');
        if (!grid) return;

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">Sin territorios encontrados</div>`;
            return;
        }

        grid.innerHTML = filtered.map(t => {
            try {
                const isAssigned = t.estado === 'Asignado' || t.estado === 'Pendiente';
                const allMzs = t.manzanas ? String(t.manzanas).split(',').filter(Boolean).length : 0;

                return `
                <div class="modern-card p-6 border-slate-100 dark:border-white/5 shadow-sm group hover:border-primary/50 transition-all bg-white dark:bg-slate-900/40">
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center text-lg font-black text-slate-800 dark:text-white shadow-inner shrink-0">
                                ${t.numero}
                            </div>
                            <div class="flex gap-1.5 p-1 bg-slate-50/50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                <button onclick="window.viewMapFromBaseS12('${t.id}')" class="w-8 h-8 flex items-center justify-center bg-white dark:bg-white/5 text-indigo-500 rounded-lg shadow-sm border border-black/5 dark:border-white/10 hover:bg-indigo-500 hover:text-white transition-all" title="Ver Mapa"><i class="fas fa-map-marked-alt text-[10px]"></i></button>
                                <button onclick="window.showHistoryFromBaseS12('${t.id}', '${t.numero}')" class="w-8 h-8 flex items-center justify-center bg-white dark:bg-white/5 text-amber-500 rounded-lg shadow-sm border border-black/5 dark:border-white/10 hover:bg-amber-500 hover:text-white transition-all" title="Historial"><i class="fas fa-history text-[10px]"></i></button>
                            </div>
                        </div>
                        
                        <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button onclick="window.editTerritorioS12('${t.id}')" class="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-primary rounded-lg border border-slate-200 dark:border-white/10 transition-all"><i class="fas fa-edit text-[10px]"></i></button>
                            <button onclick="window.deleteTerritorioS12('${t.id}')" class="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-rose-500 rounded-lg border border-slate-200 dark:border-white/10 transition-all"><i class="fas fa-trash-alt text-[10px]"></i></button>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <p class="text-sm font-black text-slate-800 dark:text-white uppercase truncate flex items-center gap-2">
                            <i class="fas fa-location-dot text-[10px] text-primary/40"></i>
                            ${t.localidad || t.nombre || '—'}
                        </p>
                        
                        <div class="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-[8px] font-black px-2 py-1 rounded-md ${isAssigned ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600'} uppercase tracking-widest">${t.estado || 'Disponible'}</span>
                                ${t.asignado_a ? `<span class="text-[7px] font-black text-slate-400 uppercase truncate max-w-[70px] ml-1">${t.asignado_a}</span>` : ''}
                            </div>
                            <div class="text-[8px] font-black text-slate-400 uppercase bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-md border border-slate-100 dark:border-white/5">${allMzs} MZ</div>
                        </div>
                    </div>
                </div>`;
            } catch (cardErr) {
                console.error("Critical rendering error on territory card:", cardErr, t);
                return `<div class="p-4 border border-rose-500/30 rounded-2xl text-[8px] font-black text-rose-500 uppercase">Error en registro ${t.numero || t.id}</div>`;
            }
        }).join('');
    };

    container.innerHTML = `
        <div class="animate-fade-in p-6 space-y-8 max-w-6xl mx-auto">
            <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-4">
                        <div class="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 shadow-inner">
                            <i class="fas fa-map-location-dot"></i>
                        </div>
                        Base de Datos (S-12)
                    </h3>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-2 ml-1">Catálogo maestro de territorios</p>
                </div>
                <div class="flex items-center gap-3 w-full sm:w-auto">
                    <button id="btn-export-s12" class="bg-primary hover:bg-primary-light text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 flex items-center gap-3 transition-all">
                        <i class="fas fa-print"></i> Imprimir Catálogo
                    </button>
                    <input type="text" id="s12-search" placeholder="Buscar número o localidad..." class="w-full sm:w-64 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all">
                </div>
            </header>

            <div id="s12-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- Grid items -->
            </div>
        </div>
    `;

    const searchInput = container.querySelector('#s12-search');
    if (searchInput) {
        searchInput.oninput = (e) => renderGrid(e.target.value.trim().toLowerCase());
    }

    const exportBtn = container.querySelector('#btn-export-s12');
    if (exportBtn) {
        exportBtn.onclick = () => {
            const grid = container.querySelector('#s12-grid');

            showNotification("Generando catálogo S-12...", "info");

            html2canvas(grid, {
                scale: 2,
                backgroundColor: (document.documentElement.classList.contains('dark') ? '#0d1117' : '#ffffff'),
                logging: false,
                useCORS: true
            }).then(canvas => {
                const doc = new jsPDF('p', 'mm', 'a4');
                const imgData = canvas.toDataURL('image/png');
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                // If larger than one page, we might need to split or just rescale
                // For a directory, usually people prefer as list, but let's keep it as is for now
                doc.addImage(imgData, 'PNG', 5, 5, pdfWidth - 10, Math.min(pdfHeight, 280));
                doc.save(`S12_Catalogo_Territorios_${new Date().toISOString().split('T')[0]}.pdf`);
                showNotification("Catálogo generado", "success");
            });
        };
    }

    window.deleteTerritorioS12 = (id) => {
        showCustomConfirm("¿Eliminar este territorio del catálogo maestro?", async () => {
            await deleteTerritorio(id);
            showNotification("Territorio eliminado");
            renderS12View(container, config, appVersion);
        });
    };

    window.editTerritorioS12 = async (id) => {
        const t = terrs.find(x => x.id === id);
        if (!t) return;

        const tipos = config.tipos_territorio || ['Casa en Casa', 'Negocios', 'Pública'];

        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-primary p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-edit"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Editar S-12</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Territorio #${t.numero}</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="grid grid-cols-1 gap-8">
                         <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Localidad</label>
                            <input type="text" id="edit-t-localidad" value="${t.localidad || t.nombre || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase shadow-inner">
                        </div>
                        <div class="grid grid-cols-2 gap-6">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Número</label>
                                <input type="text" id="edit-t-numero" value="${t.numero || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase shadow-inner">
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Tipo</label>
                                <select id="edit-t-tipo" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary cursor-pointer appearance-none shadow-inner">
                                    ${tipos.map(ti => `<option value="${ti}" ${t.tipo === ti ? 'selected' : ''}>${ti}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Manzanas (Separadas por coma)</label>
                            <textarea id="edit-t-mzs" rows="3" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary resize-none shadow-inner">${t.manzanas || ''}</textarea>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-t-edit" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10 transition-all active:scale-95">
                        Cancelar
                    </button>
                    <button id="btn-save-t-edit" class="flex-[1.5] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> Actualizar Registro
                    </button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-cancel-t-edit').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#btn-save-t-edit').onclick = async () => {
                const btn = modal.querySelector('#btn-save-t-edit');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Actualizando...';

                try {
                    await updateTerritorio(id, {
                        localidad: modal.querySelector('#edit-t-localidad').value.trim(),
                        nombre: modal.querySelector('#edit-t-localidad').value.trim(), // Keep sync for backward compat
                        numero: modal.querySelector('#edit-t-numero').value.trim(),
                        tipo: modal.querySelector('#edit-t-tipo').value,
                        manzanas: modal.querySelector('#edit-t-mzs').value.trim()
                    });
                    showNotification("S-12 actualizado correctamente");
                    modal.classList.add('hidden');
                    renderS12View(container, config, appVersion);
                } catch (e) {
                    showNotification("Error: " + e.message, "error");
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Actualizar Registro';
                }
            };
        });
    };

    // Button Logic Proxy
    window.viewMapFromBaseS12 = async (id) => {
        showNotification("Cargando mapa...", "info");
        try {
            const { MapViewer } = await import('../map-viewer.js?v=' + (appVersion || 'latest'));
            const t = terrs.find(x => x.id === id);

            if (!t) {
                showNotification("Error: Territorio no encontrado en memoria. Intente recargar.", "error");
                return;
            }

            console.log("🗺️ Opening map for T-" + t.numero, { hasImage: !!t.imagen, coords: t.coordenadas });

            // Force modal container cleanup if needed
            const modal = document.getElementById('modal-container');
            if (modal) {
                // Ensure it has the right classes for visibility if MapViewer blindly toggles hidden
                if (!modal.classList.contains('flex')) modal.classList.add('flex', 'items-center', 'justify-center');
            }

            if (window.openInteractiveMap) window.openInteractiveMap(t);
            else MapViewer.openInteractiveMap(t);
        } catch (e) {
            console.error("Map Load Error:", e);
            showNotification("Error al cargar el visor de mapas", "error");
        }
    };

    window.showHistoryFromBaseS12 = async (id, num) => {
        const { showUnifiedTerritoryHistory } = await import('../conductor-dashboard.js?v=' + appVersion);
        if (window.showUnifiedTerritoryHistory) window.showUnifiedTerritoryHistory(id, num);
    };

    renderGrid();
};
