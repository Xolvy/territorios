export const MapViewer = {
    render: (container, territory) => {
        const { numero, manzanas, coordenadas, imagen } = territory;

        container.innerHTML = `
            <div class="flex flex-col h-full w-full animate-fade-in">
                <div class="flex justify-between items-center p-4 bg-white dark:bg-gray-900 border-b dark:border-white/10">
                    <div>
                        <h3 class="font-bold text-gray-900 dark:text-white">Territorio ${numero}</h3>
                        <p class="text-xs text-gray-500">${manzanas || 'Cualquier zona'}</p>
                    </div>
                    <button id="close-map" class="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div id="leaflet-map" class="flex-1 w-full relative">
                    <div id="map-loader" class="absolute inset-0 z-[1000] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                    </div>
                </div>
                <div class="p-4 bg-gray-50 dark:bg-black/40 border-t dark:border-white/10 flex justify-between gap-4">
                    <button id="btn-locate" class="flex-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold shadow-sm border border-black/5 dark:border-white/10 flex items-center justify-center gap-2">
                        📍 Mi Ubicación
                    </button>
                    <button id="btn-done-map" class="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2">
                        ✅ Reportar
                    </button>
                </div>
            </div>
        `;

        document.getElementById('close-map').onclick = () => {
            container.classList.add('hidden');
        };

        document.getElementById('btn-done-map').onclick = () => {
            container.classList.add('hidden');
            if (window.openProgressModal) {
                window.openProgressModal(territory.id, territory.numero, territory.manzanas || '');
            }
        };

        // Initialize Leaflet
        const mapElement = document.getElementById('leaflet-map');
        if (!mapElement) return;

        // Coordinates check
        let center = [0, 0];
        let zoom = 2;

        if (coordenadas) {
            // Assume "lat,lng" string or {lat, lng}
            if (typeof coordenadas === 'string') {
                center = coordenadas.split(',').map(s => parseFloat(s.trim()));
            } else if (coordenadas.lat && coordenadas.lng) {
                center = [coordenadas.lat, coordenadas.lng];
            }
            zoom = 16;
        }

        const map = L.map('leaflet-map').setView(center, zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        if (coordenadas) {
            L.marker(center).addTo(map)
                .bindPopup(`Territorio ${numero}`)
                .openPopup();
        }

        // Locate user
        document.getElementById('btn-locate').onclick = () => {
            map.locate({ setView: true, maxZoom: 16 });
        };

        map.on('locationfound', (e) => {
            const radius = e.accuracy / 2;
            L.marker(e.latlng).addTo(map)
                .bindPopup("Estás aquí").openPopup();
            L.circle(e.latlng, radius).addTo(map);
        });

        map.on('locationerror', (e) => {
            alert("No se pudo obtener tu ubicación: " + e.message);
        });

        // Remove loader when tiles load
        map.whenReady(() => {
            document.getElementById('map-loader').classList.add('hidden');
        });

        // Handle images as fallbacks or overlays?
        // If there's an image but no coords, maybe they want to see the image?
        // But the user specifically asked for Leaflet.
        // We could theoretically use an ImageOverlay if we had the bounds.
    }
};
