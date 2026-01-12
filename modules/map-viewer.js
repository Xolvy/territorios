
export const MapViewer = {
    render: (container, territory, options = {}) => {
        const { numero, manzanas, coordenadas, imagen, id } = territory;
        const { readOnly = false } = options;

        container.innerHTML = `
            <div class="flex flex-col h-full w-full animate-fade-in bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl border border-black/5 dark:border-white/10">
                <div class="flex justify-between items-center p-6 bg-white dark:bg-gray-900 border-b dark:border-white/10 z-10">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-teal-500/20">🗺️</div>
                        <div>
                            <h3 class="font-black text-slate-800 dark:text-white tracking-tight leading-none mb-1">Territorio ${numero}</h3>
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest leading-none">${manzanas || 'Cualquier zona'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                         <button id="btn-share-map" class="p-2.5 bg-slate-100 dark:bg-white/5 hover:bg-teal-500/10 hover:text-teal-600 rounded-xl transition-all border border-transparent hover:border-teal-500/20" title="Compartir/Descargar">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 100-2.684 3 3 0 000 2.684zm0 12.684a3 3 0 100-2.684 3 3 0 000 2.684z" />
                            </svg>
                        </button>
                        <button id="close-map" class="p-2.5 bg-slate-100 dark:bg-white/5 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Map / Image Container -->
                <div class="flex-1 w-full relative overflow-hidden bg-[#0f172a]">
                    <!-- Interactive Leaflet Map -->
                    <div id="leaflet-map" class="absolute inset-0 w-full h-full transition-opacity duration-500 ${imagen ? 'opacity-0 pointer-events-none' : 'opacity-100'}">
                        <div id="map-loader" class="absolute inset-0 z-[1000] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                        </div>
                    </div>
                    
                    <!-- Static Image View with Dark Background and white backing for image only -->
                    ${imagen ? `
                    <div id="static-image-viewer" class="absolute inset-0 w-full h-full flex items-center justify-center p-4 transition-opacity duration-500 opacity-100 overflow-auto">
                        <div class="bg-white p-2 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20">
                            <img id="map-img-element" src="${imagen}" class="max-w-full max-h-full object-contain cursor-zoom-in" onclick="window.toggleImageZoom(this)">
                        </div>
                    </div>
                    ` : `
                    <div class="absolute inset-0 flex items-center justify-center p-12 text-center">
                        <div class="space-y-4">
                            <div class="text-6xl opacity-20 text-slate-400">🗺️</div>
                            <p class="text-sm font-bold text-slate-500">Sin imagen de mapa disponible.<br><span class="text-[10px] font-black uppercase tracking-widest">Usando vista satelital interactiva</span></p>
                        </div>
                    </div>
                    `}
                </div>

                <!-- Footer Controls (Conditional) -->
                ${!readOnly ? `
                <div class="p-6 bg-white dark:bg-gray-900 border-t dark:border-white/10 z-10">
                    <button id="btn-done-map" class="w-full bg-teal-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-teal-500/30 hover:shadow-teal-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group">
                        Confirmar y Reportar Activity 
                        <span class="group-hover:translate-x-1 transition-transform">➡️</span>
                    </button>
                </div>
                ` : ''}
            </div>
        `;

        // --- HANDLERS ---
        const hideModal = () => {
            const modal = document.getElementById('modal-container');
            if (modal) modal.classList.add('hidden');
            container.innerHTML = '';
        };

        document.getElementById('close-map').onclick = hideModal;

        const doneBtn = document.getElementById('btn-done-map');
        if (doneBtn) {
            doneBtn.onclick = () => {
                hideModal();
                if (window.openProgressModal) {
                    window.openProgressModal(id);
                }
            };
        }

        // --- SHARE / DOWNLOAD ---
        document.getElementById('btn-share-map').onclick = async () => {
            if (imagen) {
                try {
                    const blob = await (await fetch(imagen)).blob();
                    const file = new File([blob], `Territorio_${numero}.png`, { type: blob.type });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: `Mapa Territorio ${numero}`,
                            text: `Mapa del territorio ${numero} - ${manzanas || ''}`
                        });
                    } else {
                        const a = document.createElement('a');
                        a.href = imagen;
                        a.download = `Mapa_T${numero}.png`;
                        a.click();
                    }
                } catch (e) {
                    const a = document.createElement('a');
                    a.href = imagen;
                    a.download = `Mapa_T${numero}.png`;
                    a.click();
                }
            } else {
                window.showNotification ? window.showNotification("Solo se pueden compartir mapas con imagen.", "warning") : alert("No hay imagen para compartir.");
            }
        };

        // --- MAP LOGIC (Only if no image or forced) ---
        let leafletInstance = null;
        if (!imagen) {
            const initLeaflet = () => {
                const mapElement = document.getElementById('leaflet-map');
                if (!mapElement || leafletInstance) return;

                let center = [0, 0];
                let zoom = 2;

                if (coordenadas) {
                    if (typeof coordenadas === 'string') {
                        center = coordenadas.split(',').map(s => parseFloat(s.trim()));
                    } else if (coordenadas.lat && coordenadas.lng) {
                        center = [coordenadas.lat, coordenadas.lng];
                    }
                    zoom = 16;
                }

                leafletInstance = L.map('leaflet-map').setView(center, zoom);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap',
                    maxZoom: 19
                }).addTo(leafletInstance);

                if (coordenadas) {
                    L.marker(center).addTo(leafletInstance)
                        .bindPopup(`Territorio ${numero}`)
                        .openPopup();
                }

                leafletInstance.whenReady(() => {
                    document.getElementById('map-loader')?.classList.add('hidden');
                });
            };
            initLeaflet();
        }
    }
};

// --- GLOBAL ATTACH ---
window.openInteractiveMap = (territory, options = {}) => {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = '<div id="map-viewer-root" class="w-full h-full max-w-4xl mx-auto"></div>';
    modal.classList.remove('hidden');

    MapViewer.render(document.getElementById('map-viewer-root'), territory, options);
};

window.toggleImageZoom = (img) => {
    if (img.classList.contains('cursor-zoom-in')) {
        img.classList.remove('cursor-zoom-in', 'max-h-full');
        img.classList.add('cursor-zoom-out', 'w-[200%]', 'max-w-none');
    } else {
        img.classList.add('cursor-zoom-in', 'max-h-full');
        img.classList.remove('cursor-zoom-out', 'w-[200%]', 'max-w-none');
    }
};
