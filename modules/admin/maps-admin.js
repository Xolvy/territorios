import { getTerritorios, updateTerritoryGeoJSON } from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';

export const renderMapsAdmin = async (container, config) => {
    container.innerHTML = `
        <div class="animate-fade-in p-6 space-y-8 max-w-5xl mx-auto">
            <header class="flex items-center gap-6 mb-10">
                <div class="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-3xl text-indigo-600 shadow-inner">
                    <i class="fas fa-map-marked-alt"></i>
                </div>
                <div>
                    <h3 class="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Administrador de Mapas</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Sincronización Premium de Polígonos KML</p>
                </div>
            </header>

            <div class="modern-card p-10 space-y-8 border-slate-100 dark:border-white/5 shadow-2xl">
                <div class="space-y-4">
                    <h4 class="text-sm font-black text-slate-700 dark:text-white uppercase tracking-widest flex items-center gap-3">
                        <i class="fas fa-file-import text-indigo-500"></i>
                        Importar desde Google My Maps
                    </h4>
                    <p class="text-xs text-slate-500 leading-relaxed">
                        Pega aquí el contenido del archivo <b>KML</b> exportado de My Maps. El sistema detectará automáticamente los polígonos etiquetados como <b>(T1), (T2)...</b> y los asignará a los 22 territorios correspondientes.
                    </p>
                </div>

                <div class="relative group">
                    <div class="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                    <textarea id="kml-input" rows="12" class="relative w-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 p-8 rounded-[2rem] text-[11px] font-mono text-slate-600 dark:text-indigo-300 outline-none focus:border-indigo-500 transition-all resize-none shadow-inner custom-scrollbar" placeholder="Copia y pega el contenido <kml> aquí..."></textarea>
                </div>

                <div class="flex flex-col sm:flex-row gap-4">
                    <button id="btn-process-kml" class="flex-[2] py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                        <i class="fas fa-magic"></i> Procesar e Importar Todo
                    </button>
                    <button id="btn-clear-kml" class="flex-1 py-5 bg-slate-100 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-slate-200 dark:border-white/10 hover:bg-rose-500/10 hover:text-rose-500 transition-all">
                        Limpiar
                    </button>
                </div>

                <div id="import-progress" class="hidden space-y-4 pt-4 border-t border-slate-100 dark:border-white/5 animate-fade-in">
                    <div class="flex justify-between items-center px-2">
                        <span id="progress-status" class="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Sincronizando polígonos...</span>
                        <span id="progress-count" class="text-[9px] font-black text-slate-400 uppercase">0 / 0</span>
                    </div>
                    <div class="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden shadow-inner font-black">
                        <div id="progress-bar" class="h-full bg-indigo-500 w-0 transition-all duration-300"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const processKML = async () => {
        const kmlText = document.getElementById('kml-input').value.trim();
        if (!kmlText) return showNotification("Por favor pega el código KML", "warning");

        const btn = document.getElementById('btn-process-kml');
        const progressDiv = document.getElementById('import-progress');
        const progressBar = document.getElementById('progress-bar');
        const progressCount = document.getElementById('progress-count');
        const progressStatus = document.getElementById('progress-status');

        btn.disabled = true;
        progressDiv.classList.remove('hidden');

        try {
            const { parseKmlToGroupedData } = await import('../utils/kml-parser.js');
            const groups = parseKmlToGroupedData(kmlText);
            const tNums = Object.keys(groups);

            if (tNums.length === 0) throw new Error("No se detectaron etiquetas como (T1), (T2) en el KML.");

            let completed = 0;
            const total = tNums.length;
            progressCount.innerText = `0 / ${total}`;

            for (const tNum of tNums) {
                // Estructura GeoJSON MultiPolygon (Conversión para Firestore)
                const geojson = {
                    type: "FeatureCollection",
                    features: groups[tNum].map((latLngs, idx) => ({
                        type: "Feature",
                        properties: { name: `Manzana ${idx + 1}` },
                        geometry: {
                            type: "Polygon",
                            coordinates: [latLngs.map(c => [c[1], c[0]])] // Volver a [Lng, Lat] para GeoJSON
                        }
                    }))
                };

                const success = await updateTerritoryGeoJSON(tNum, geojson);
                if (success) {
                    completed++;
                    const percent = (completed / total) * 100;
                    progressBar.style.width = `${percent}%`;
                    progressCount.innerText = `${completed} / ${total}`;
                }
            }

            showNotification(`¡Importación exitosa! ${completed} territorios actualizados con polígonos.`, "success");
            progressStatus.innerText = "IMPORTACIÓN FINALIZADA";
            progressStatus.classList.replace('text-indigo-500', 'text-emerald-500');

        } catch (e) {
            console.error(e);
            showNotification("Error: " + e.message, "error");
            progressStatus.innerText = "ERROR EN IMPORTACIÓN";
            progressStatus.classList.replace('text-indigo-500', 'text-rose-500');
        } finally {
            btn.disabled = false;
        }
    };

    document.getElementById('btn-process-kml').onclick = processKML;
    document.getElementById('btn-clear-kml').onclick = () => {
        document.getElementById('kml-input').value = '';
        document.getElementById('import-progress').classList.add('hidden');
    };
};
