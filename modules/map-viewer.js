
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
                         <button id="btn-export-interactive-map" class="p-2.5 bg-slate-100 dark:bg-white/5 hover:bg-teal-500/10 hover:text-teal-600 rounded-xl transition-all border border-transparent hover:border-teal-500/20" title="Guardar como Imagen">
                            <i class="fas fa-camera text-sm"></i>
                        </button>
                         <button id="btn-share-map" class="p-2.5 bg-slate-100 dark:bg-white/5 hover:bg-teal-500/10 hover:text-teal-600 rounded-xl transition-all border border-transparent hover:border-teal-500/20" title="Compartir enlace/ubicación">
                            <i class="fas fa-share-nodes text-sm"></i>
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
            </div>
        `;

        // --- HANDLERS ---
        const hideModal = () => {
            const modal = document.getElementById('modal-container');
            if (modal) modal.classList.add('hidden');
            container.innerHTML = '';
        };

        document.getElementById('close-map').onclick = hideModal;


        // --- SHARE / DOWNLOAD ---
        const btnShare = document.getElementById('btn-share-map');
        const btnExport = document.getElementById('btn-export-interactive-map');

        if (btnExport) {
            btnExport.onclick = async () => {
                const mapEl = document.getElementById('leaflet-map');
                const imgEl = document.getElementById('map-img-element');

                if (imgEl && imagen) {
                    // Simple download for static image
                    const a = document.createElement('a');
                    a.href = imagen;
                    a.download = `Mapa_T${numero}.png`;
                    a.click();
                } else if (window.leafletImage && window._currentLeafletMap) {
                    // Export interactive map to PNG
                    if (window.showNotification) window.showNotification("Generando imagen del mapa...", "info");

                    window.leafletImage(window._currentLeafletMap, (err, canvas) => {
                        if (err) {
                            console.error(err);
                            if (window.showNotification) window.showNotification("Error al exportar mapa", "error");
                            return;
                        }
                        const link = document.createElement('a');
                        link.download = `Mapa_Interactivo_T${numero}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                        if (window.showNotification) window.showNotification("¡Mapa guardado!", "success");
                    });
                }
            };
        }

        if (btnShare) {
            btnShare.onclick = async () => {
                const text = `Territorio ${numero}: ${manzanas || ''}`;
                const url = window.location.href;

                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: `Mapa T-${numero}`,
                            text: text,
                            url: url
                        });
                    } catch (e) { console.error("Share error", e); }
                } else {
                    // Fallback to copy link
                    navigator.clipboard.writeText(`${text} \n ${url}`);
                    if (window.showNotification) window.showNotification("Enlace copiado al portapapeles", "success");
                }
            };
        }

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
                window._currentLeafletMap = leafletInstance;

                const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap',
                    maxZoom: 19,
                    crossOrigin: true // Critical for leaflet-image
                }).addTo(leafletInstance);

                // Offline Tile Detection
                tiles.on('tileerror', () => {
                    if (!navigator.onLine) {
                        const existing = document.getElementById('map-offline-alert');
                        if (!existing) {
                            const alert = document.createElement('div');
                            alert.id = 'map-offline-alert';
                            alert.className = 'absolute top-20 left-1/2 -translate-x-1/2 z-[2000] bg-rose-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl animate-bounce';
                            alert.innerText = '⚠️ Modo Offline: Algunos mapas pueden no cargar';
                            mapElement.appendChild(alert);
                        }
                    }
                });

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
