import { getTerritorios, deleteTerritorio, updateTerritorio, updateTerritoryGeoJSON, startLivePool, uploadMapPNG } from '../../data/firestore-services.js';
import { showNotification, renderSkeleton } from '../utils/helpers.js';
import { showModal, showCustomConfirm } from '../services/ui-helpers.js';
import { MapViewer } from '../map-viewer.js';
import { setAdminLivePool } from '../admin-dashboard.js';

export const renderMapsView = async (container, config, appVersion) => {
    let terrs = [];

    const normalizeT = (val) => String(val || '').trim();

    // Xolvy Live Pool: Real-time synchronization for Territories
    const unsub = startLivePool("territorios", [], (data) => {
        terrs = data
            .filter(rec => rec.numero && String(rec.numero).trim().length > 0)
            .map(rec => ({
                ...rec,
                numero: normalizeT(rec.numero),
                manzanas: String(rec.manzanas || '').replace(/Salmo/gi, 'Mz.').trim(),
                localidad: String(rec.localidad || '').replace(/grupos?/gi, '').trim()
            }))
            .sort((a, b) => String(a.numero || '').localeCompare(String(b.numero || ''), undefined, { numeric: true }));

        const currentSearch = container.querySelector('#maps-search')?.value.trim().toLowerCase();
        renderGrid(currentSearch);
    });
    setAdminLivePool(unsub);

    const renderGrid = (query = '') => {
        const filtered = query ? terrs.filter(t =>
            String(t.numero || '').toLowerCase().includes(query) ||
            (t.localidad && t.localidad.toLowerCase().includes(query)) ||
            (t.nombre && t.nombre.toLowerCase().includes(query))
        ) : terrs;

        const grid = container.querySelector('#maps-grid');
        if (!grid) return;

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 text-[10px] font-black uppercase tracking-widest">Sin territorios encontrados</div>`;
            return;
        }

        const statusColors = {
            'Asignado':   { bg: 'bg-amber-500/10',   text: 'text-amber-500',   dot: 'bg-amber-400',   label: 'Asignado' },
            'Completado': { bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-400', label: 'Completado' },
            'Disponible': { bg: 'bg-slate-100 dark:bg-white/5', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-300', label: 'Disponible' },
        };

        grid.innerHTML = filtered.map(t => {
            const allMzs = t.manzanas ? String(t.manzanas).split(',').filter(Boolean).length : 0;
            const subtitle = t.localidad || t.nombre || '—';
            const estado = t.estado || 'Disponible';
            const sc = statusColors[estado] || statusColors['Disponible'];
            const hasMap = !!(t.geojson || t.imagen);

            return `
            <div class="group relative flex flex-col bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.07] rounded-2xl shadow-sm hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-black/30 hover:-translate-y-0.5 hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-300 overflow-hidden">
                
                <div class="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary/80 via-indigo-500/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                <div class="flex items-start justify-between p-5 pb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
                            <span class="text-slate-800 dark:text-slate-100 font-black text-sm leading-none">${t.numero}</span>
                        </div>
                        <div class="flex flex-col min-w-0">
                            <span class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none mb-1">Territorio</span>
                            <h4 class="text-[13px] font-black text-slate-800 dark:text-white leading-tight truncate max-w-[130px]">${subtitle}</h4>
                        </div>
                    </div>
                    ${estado !== 'Disponible' ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider shrink-0 ${sc.bg} ${sc.text}">
                        <span class="w-1.5 h-1.5 rounded-full ${sc.dot}"></span>
                        ${sc.label}
                    </span>` : ''}
                </div>

                <div class="flex flex-wrap items-center gap-2 px-5 pb-4 border-b border-slate-100 dark:border-white/[0.05]">
                    <div class="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/5">
                        <i class="fas fa-th-large text-[9px] text-primary opacity-70"></i>
                        <span class="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">${allMzs} Manzana${allMzs !== 1 ? 's' : ''}</span>
                    </div>
                    ${hasMap ? `<div class="inline-flex items-center gap-1.5 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10">
                        <i class="fas fa-map text-[9px] text-emerald-500"></i>
                        <span class="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Con Mapa</span>
                    </div>` : ''}
                </div>

                ${t.asignado_a ? `
                <div class="px-5 py-3 flex items-center gap-2 border-b border-slate-100 dark:border-white/[0.05]">
                    <div class="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                        <i class="fas fa-user text-[8px] text-amber-500"></i>
                    </div>
                    <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">${t.asignado_a}</span>
                </div>` : ''}

                <div class="flex items-center gap-2 p-4 mt-auto bg-slate-50/50 dark:bg-black/10">
                    <button onclick="window.viewMapFromBaseS12('${t.id}')"
                        class="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-[9px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95 group/btn">
                        <i class="fas fa-map-marked-alt text-[10px] group-hover/btn:scale-110 transition-transform"></i>
                        <span>Mapa</span>
                    </button>
                    <button onclick="window.editTerritorioS12('${t.id}')"
                        class="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-indigo-500 text-slate-600 dark:text-slate-400 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95 group/btn">
                        <i class="fas fa-pen text-[10px] group-hover/btn:scale-110 transition-transform"></i>
                        <span>Editar</span>
                    </button>
                    <button onclick="window.deleteTerritorioS12('${t.id}')"
                        class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-rose-500 text-slate-600 dark:text-slate-400 hover:text-white transition-all duration-200 active:scale-95 group/btn shrink-0">
                        <i class="fas fa-trash text-[10px] group-hover/btn:scale-110 transition-transform"></i>
                    </button>
                </div>
            </div>`;
        }).join('');
    };

    container.innerHTML = `
        <div class="animate-fade-in p-6 space-y-12 max-w-7xl mx-auto">
            <header class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div>
                    <h3 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-5">
                        <div class="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/20">
                            <i class="fas fa-map-location-dot text-xl"></i>
                        </div>
                        Gestión de Territorios
                    </h3>
                    <p class="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.4em] mt-3 ml-1">Visor y gestión de polígonos satelitales</p>
                </div>
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                    <button id="btn-open-kml-mgr" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-3 transition-all shrink-0">
                        <i class="fas fa-file-import"></i> <span>Importar KML</span>
                    </button>
                    <div class="search-wrapper-v3 flex-1 min-w-0 lg:w-72">
                        <i class="fas fa-search"></i>
                        <input type="text" id="maps-search" placeholder="Buscar número o localidad..." class="search-input-v3 py-4 text-sm font-bold outline-none">
                    </div>
                </div>
            </header>

            <div id="maps-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                <div id="maps-skeleton-container" class="col-span-full"></div>
            </div>
        </div>
    `;

    renderSkeleton(container.querySelector('#maps-skeleton-container'));



    // Search Logic
    container.querySelector('#maps-search').oninput = (e) => renderGrid(e.target.value.trim().toLowerCase());

    // KML Manager Logic
    container.querySelector('#btn-open-kml-mgr').onclick = () => {
        showModal(`
            <div class="flex flex-col h-full bg-white dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden">
                <header class="shrink-0 bg-indigo-600 p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl shadow-2xl border border-white/30">
                            <i class="fas fa-file-import"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Importador KML</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Sincronización de My Maps</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-10 space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="space-y-4">
                        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                            Pega el contenido del archivo KML exportado. El sistema buscará etiquetas como <span class="text-indigo-500">(T1), (T2)</span> para asignar los polígonos.
                        </p>
                        <textarea id="kml-text-input" rows="10" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-6 rounded-2xl text-[11px] font-mono text-slate-600 dark:text-indigo-300 outline-none focus:border-indigo-500 transition-all resize-none shadow-inner" placeholder="Copia y pega el código <kml> aquí..."></textarea>
                    </div>

                    <div id="kml-progress-box" class="hidden space-y-4">
                        <div class="flex justify-between items-center px-2">
                             <span id="kml-status" class="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Iniciando...</span>
                             <span id="kml-count" class="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase">0/0</span>
                        </div>
                        <div class="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                            <div id="kml-bar" class="h-full bg-indigo-500 w-0 transition-all duration-300"></div>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button onclick="this.closest('.fixed').classList.add('hidden')" class="flex-1 min-w-0 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all">
                        Cerrar
                    </button>
                    <button id="btn-start-import" class="flex-[1.5] py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-magic"></i> Procesar KML
                    </button>
                </footer>
            </div>
        `, (modal) => {
            const btnImport = modal.querySelector('#btn-start-import');
            const input = modal.querySelector('#kml-text-input');
            const progressBox = modal.querySelector('#kml-progress-box');
            const bar = modal.querySelector('#kml-bar');
            const status = modal.querySelector('#kml-status');
            const count = modal.querySelector('#kml-count');

            btnImport.onclick = async () => {
                const kml = input.value.trim();
                if (!kml) return;

                btnImport.disabled = true;
                progressBox.classList.remove('hidden');

                try {
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(kml, 'text/xml');
                    const placemarks = xml.querySelectorAll('Placemark');
                    const groups = {};

                    const poisData = [];
                    placemarks.forEach(pm => {
                        const name = pm.querySelector('name')?.textContent || '';
                        // Support both (T1) and T1 or Territorio 1 format strictly matching numbers
                        const match = name.match(/\(?T-?\s*(\d+)\)?/i) || name.match(/Territorio\s*(\d+)/i);
                        if (match) {
                            const tNum = match[1];
                            if (!groups[tNum]) groups[tNum] = [];

                            // Polygons
                            const poly = pm.querySelector('Polygon');
                            if (poly) {
                                const coordsText = poly.querySelector('coordinates')?.textContent || '';
                                const coords = coordsText.trim().split(/\s+/).map(row => {
                                    const [lng, lat] = row.split(',').map(Number);
                                    return [lng, lat];
                                });
                                groups[tNum].push({
                                    type: "Feature", properties: { name },
                                    geometry: { type: "Polygon", coordinates: [coords] }
                                });
                            }

                            // Lines (Traces)
                            const line = pm.querySelector('LineString');
                            if (line) {
                                const coordsText = line.querySelector('coordinates')?.textContent || '';
                                const coordsStr = coordsText.trim().split(/\s+/);
                                const coords = coordsStr.map(row => row.split(',').map(Number).slice(0, 2)).filter(pair => pair.length === 2 && !isNaN(pair[0]));
                                if (coords.length > 0) {
                                    if (!groups[tNum]) groups[tNum] = [];
                                    groups[tNum].push({
                                        type: "Feature", properties: { name, type: "Trace" },
                                        geometry: { type: "LineString", coordinates: coords }
                                    });
                                }
                            }

                            // Points (POIs) - Link to Special Zones
                            const point = pm.querySelector('Point');
                            if (point) {
                                const coordsText = point.querySelector('coordinates')?.textContent || '';
                                const [lng, lat] = coordsText.trim().split(',').map(Number);
                                poisData.push({
                                    nombre: name.replace(/\(T\d+\)/i, '').trim(),
                                    tipo: 'Otro',
                                    territorio_numero: tNum,
                                    descripcion: pm.querySelector('description')?.textContent || '',
                                    lat, lng
                                });
                            }
                        }
                    });

                    const tNums = Object.keys(groups);
                    if (tNums.length === 0) throw new Error("No se detectaron territorios (T1, T2...) en el KML.");

                    let done = 0;
                    for (const num of tNums) {
                        const geojson = { type: "FeatureCollection", features: groups[num] };
                        const tId = await updateTerritoryGeoJSON(num, geojson);

                        if (tId) {
                            // Sync POIs
                            const tPois = poisData.filter(p => p.territorio_numero === num);
                            for (const poi of tPois) {
                                const { addPuntoInteres } = await import('../../data/firestore-services.js');
                                await addPuntoInteres({ ...poi, territorio_id: tId });
                            }
                        }

                        done++;
                        const pct = (done / tNums.length) * 100;
                        bar.style.width = pct + '%';
                        count.innerText = `${done} / ${tNums.length}`;
                        status.innerText = `Sincronizando T-${num}...`;
                    }

                    status.innerText = "IMPORTACIÓN FINALIZADA";
                    showNotification("Polígonos actualizados correctamente", "success");
                    renderGrid();
                } catch (err) {
                    showNotification(err.message, "error");
                    status.innerText = "ERROR EN PROCESO";
                } finally {
                    btnImport.disabled = false;
                }
            };
        });
    };

    // Card Proxies (Matches window globals in s12-view.js for re-use if needed)
    window.viewMapFromBaseS12 = (id) => {
        const t = terrs.find(x => x.id === id);
        if (t) {
            if (window.openInteractiveMap) window.openInteractiveMap(t);
            else MapViewer.render(document.getElementById('modal-container'), t);
        }
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
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl border border-white/30">
                            <i class="fas fa-edit"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black uppercase tracking-tight leading-none mb-1">Editar Territorio</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">T-${t.numero}</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-10 space-y-8 bg-slate-50 dark:bg-black/20">
                    <div class="grid grid-cols-1 gap-8">
                         <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Localidad</label>
                            <input type="text" id="edit-t-localidad" value="${t.localidad || t.nombre || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase shadow-inner">
                        </div>
                        <div class="grid grid-cols-2 gap-6">
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Número</label>
                                <input type="text" id="edit-t-numero" value="${t.numero || ''}" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all uppercase shadow-inner">
                            </div>
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Tipo</label>
                                <select id="edit-t-tipo" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-black text-slate-700 dark:text-white outline-none focus:border-primary cursor-pointer appearance-none shadow-inner">
                                    ${tipos.map(ti => `<option value="${ti}" ${t.tipo === ti ? 'selected' : ''}>${ti}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">Manzanas (Separadas por coma)</label>
                            <textarea id="edit-t-mzs" rows="3" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[13px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary resize-none shadow-inner">${t.manzanas || ''}</textarea>
                        </div>
                        <div class="space-y-3 mt-2">
                            <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block flex justify-between items-center">
                                <span>Subir Mapa (PNG/JPG)</span>
                                ${t.imagen ? `<a href="${t.imagen}" target="_blank" class="text-[8px] text-indigo-500 hover:underline">Ver actual</a>` : `<span class="text-[8px] opacity-70">Opcional</span>`}
                            </label>
                            <div class="relative">
                                <i class="fas fa-upload absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 pointer-events-none"></i>
                                <input type="file" id="edit-t-imagen-file" accept="image/png, image/jpeg" class="pl-12 w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-2.5 rounded-2xl text-[11px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary transition-all shadow-inner file:mr-4 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:uppercase file:tracking-widest file:font-black file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 cursor-pointer">
                            </div>
                        </div>
                    </div>
                </div>

                <footer class="shrink-0 p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button onclick="this.closest('.fixed').classList.add('hidden')" class="flex-1 min-w-0 py-5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all">
                        Cancelar
                    </button>
                    <button id="btn-save-t-edit" class="flex-[1.5] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-save"></i> Guardar Cambios
                    </button>
                </footer>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-save-t-edit').onclick = async () => {
                const btn = modal.querySelector('#btn-save-t-edit');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Guardando...';

                try {
                    const fileInput = modal.querySelector('#edit-t-imagen-file');
                    let finalImageURL = t.imagen || ''; // Mantener la anterior por defecto
                    const tNum = modal.querySelector('#edit-t-numero').value.trim();

                    if (fileInput.files.length > 0) {
                        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Subiendo imagen...';
                        finalImageURL = await uploadMapPNG(fileInput.files[0], tNum);
                    }

                    await updateTerritorio(id, {
                        localidad: modal.querySelector('#edit-t-localidad').value.trim(),
                        nombre: modal.querySelector('#edit-t-localidad').value.trim(),
                        numero: tNum,
                        tipo: modal.querySelector('#edit-t-tipo').value,
                        manzanas: modal.querySelector('#edit-t-mzs').value.trim(),
                        imagen: finalImageURL
                    });
                    showNotification("Registro actualizado");
                    modal.classList.add('hidden');
                } catch (e) {
                    showNotification(e.message, "error");
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
                }
            };
        });
    };

    window.deleteTerritorioS12 = async (id) => {
        const t = terrs.find(x => x.id === id);
        if (!t) return;

        showCustomConfirm(`¿Estás seguro de eliminar el Territorio ${t.numero}?`, async () => {
            try {
                await deleteTerritorio(id);
                showNotification("Territorio eliminado correctamente", "success");
            } catch (e) {
                showNotification("Error al eliminar: " + e.message, "error");
            }
        });
    };
};
