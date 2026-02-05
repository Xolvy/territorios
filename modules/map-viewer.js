import { addTerritoryReference } from '../data/firestore-services.js';
import { showNotification } from './utils/helpers.js';
import { showCustomPrompt } from './services/ui-helpers.js';

export const MapViewer = {
    render: (container, territory, options = {}) => {
        const { numero, manzanas, coordenadas, imagen, id, geojson, referencias = [] } = territory;
        const { readOnly = false } = options;

        container.innerHTML = `
            <div class="flex flex-col h-full w-full animate-fade-in bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-white/10 relative">
                
                <!-- GLASS HEADER -->
                <div class="absolute top-6 left-6 right-6 z-[1001] flex justify-between items-center p-4 bg-white/70 dark:bg-gray-900/60 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-white/5 shadow-2xl">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] border border-white/20">
                            <i class="fas fa-satellite text-white text-xl"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-slate-800 dark:text-white tracking-tighter leading-none mb-1 text-lg">Territorio ${numero}</h3>
                            <p class="text-[9px] text-indigo-500 dark:text-indigo-400 uppercase font-black tracking-[0.2em] leading-none">Satélite ArcGIS High-Res</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${imagen ? `
                        <button id="btn-toggle-view" class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/20 shadow-lg">
                            <i class="fas fa-sync-alt"></i> <span>Ver Mapa Interactivo</span>
                        </button>
                        ` : ''}
                        <button id="close-map" class="w-10 h-10 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center justify-center">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <!-- FLOATING SIDE CONTROLS -->
                <div id="map-controls" class="absolute right-6 top-32 z-[1001] flex flex-col gap-3 ${imagen ? 'hidden' : ''}">
                    <button id="btn-my-location" class="w-12 h-12 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl text-slate-700 dark:text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-white/20 group" title="Mi Ubicación">
                        <i class="fas fa-location-arrow text-sm group-hover:text-indigo-500"></i>
                    </button>
                    <button id="btn-zoom-in" class="w-12 h-12 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl text-slate-700 dark:text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-white/20">
                        <i class="fas fa-plus text-xs"></i>
                    </button>
                    <button id="btn-zoom-out" class="w-12 h-12 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl text-slate-700 dark:text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-white/20">
                        <i class="fas fa-minus text-xs"></i>
                    </button>
                    ${!readOnly ? `
                    <button id="btn-add-point" class="w-12 h-12 bg-indigo-500 text-white rounded-2xl shadow-[0_10px_20px_rgba(79,70,229,0.3)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-white/20" title="Añadir Referencia">
                        <i class="fas fa-plus"></i>
                    </button>` : ''}
                </div>

                <div class="flex-1 w-full relative overflow-hidden bg-[#0f172a]">
                    <!-- LEAFLET MAP CONTAINER -->
                    <div id="leaflet-map" class="absolute inset-0 w-full h-full transition-opacity duration-700 ${imagen ? 'opacity-0 pointer-events-none' : 'opacity-100'}" style="z-index: 10;">
                        <div id="map-loader" class="absolute inset-0 z-[1002] bg-gray-950 flex items-center justify-center">
                            <div class="flex flex-col items-center gap-6">
                                <div class="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                <div class="text-center">
                                    <p class="text-[10px] font-black uppercase text-indigo-500 tracking-[0.4em] animate-pulse">Iniciando Motor Satelital</p>
                                    <p class="text-[8px] text-slate-500 uppercase tracking-widest mt-2 ml-1">Calibrando Sensores ArcGIS</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${imagen ? `
                    <div id="static-image-viewer" class="absolute inset-0 w-full h-full flex items-center justify-center p-4 transition-opacity duration-500 opacity-100 overflow-auto bg-black/40 backdrop-blur-sm z-30">
                        <div class="bg-white p-2 rounded-3xl shadow-[0_40px_80px_rgba(0,0,0,0.8)] border border-white/20 transform hover:scale-[1.02] transition-transform">
                            <img id="map-img-element" src="${imagen}" class="max-w-full max-h-full object-contain cursor-zoom-in rounded-2xl" onclick="window.toggleImageZoom(this)">
                        </div>
                    </div>
                    ` : ''}

                    <div id="edit-hint" class="absolute bottom-10 left-1/2 -translate-x-1/2 bg-indigo-500/90 backdrop-blur-xl text-white px-8 py-4 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl z-[1001] hidden animate-bounce border border-white/20">
                        <i class="fas fa-crosshairs mr-2"></i> Toca el mapa para situar punto
                    </div>
                </div>
            </div>

            <style>
                .leaflet-control-attribution { font-size: 7px !important; background: transparent !important; color: rgba(255,255,255,0.3) !important; }
                .leaflet-marker-icon { filter: drop-shadow(0 10px 10px rgba(0,0,0,0.4)); }
            </style>
        `;

        const btnToggle = container.querySelector('#btn-toggle-view');
        const staticView = container.querySelector('#static-image-viewer');
        const interactiveView = container.querySelector('#leaflet-map');
        const controls = container.querySelector('#map-controls');

        if (btnToggle && staticView) {
            btnToggle.onclick = () => {
                const isShowingImage = !staticView.classList.contains('hidden');
                if (isShowingImage) {
                    staticView.classList.add('hidden');
                    interactiveView.classList.remove('opacity-0', 'pointer-events-none');
                    controls.classList.remove('hidden');
                    btnToggle.querySelector('span').innerText = "Ver Imagen PNG";
                    btnToggle.classList.replace('bg-indigo-500', 'bg-emerald-600');
                } else {
                    staticView.classList.remove('hidden');
                    interactiveView.classList.add('opacity-0', 'pointer-events-none');
                    controls.classList.add('hidden');
                    btnToggle.querySelector('span').innerText = "Ver Mapa Interactivo";
                    btnToggle.classList.replace('bg-emerald-600', 'bg-indigo-500');
                }
            };
        }

        document.getElementById('close-map').onclick = () => {
            const modal = document.getElementById('modal-container');
            if (modal) modal.classList.add('hidden');
            container.innerHTML = '';
        };

        const initLeafletMap = () => {
            if (typeof L === 'undefined') return;

            // Normalize starting position
            let center = [-2.1894, -79.8891];
            if (coordenadas) {
                if (typeof coordenadas === 'string' && coordenadas.includes(',')) {
                    center = coordenadas.split(',').map(s => parseFloat(s.trim()));
                } else if (coordenadas.lat && coordenadas.lng) {
                    center = [coordenadas.lat, coordenadas.lng];
                }
            }

            const map = L.map('leaflet-map', {
                center,
                zoom: 18,
                zoomControl: false,
                attributionControl: true
            });

            // ESRI WORLD IMAGERY (The high-res satellite choice)
            const esriSatelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                attribution: 'Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics'
            }).addTo(map);

            // 1. Zoom Controls
            document.getElementById('btn-zoom-in').onclick = () => map.zoomIn();
            document.getElementById('btn-zoom-out').onclick = () => map.zoomOut();

            // 2. My Location
            let userCircle = null;
            document.getElementById('btn-my-location').onclick = () => {
                if (!navigator.geolocation) return showNotification("GPS no disponible", "error");
                showNotification("Sincronizando ubicación...", "info");
                navigator.geolocation.getCurrentPosition((pos) => {
                    const coords = [pos.coords.latitude, pos.coords.longitude];
                    if (userCircle) map.removeLayer(userCircle);
                    userCircle = L.circleMarker(coords, {
                        radius: 8,
                        fillColor: "#4f46e5",
                        color: "#fff",
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(map);
                    map.setView(coords, 19);
                }, () => showNotification("Acceso GPS denegado", "error"));
            };

            // 3. Render GeoJSON (Territory Bounds)
            if (geojson) {
                const layer = L.geoJSON(geojson, {
                    style: {
                        color: "#fff",
                        weight: 3,
                        fillColor: "#6366f1",
                        fillOpacity: 0.2
                    }
                }).addTo(map);
                map.fitBounds(layer.getBounds(), { padding: [50, 50] });
            }

            // 4. Reference Markers
            const customIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color:#4f46e5; width:12px; height:12px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });

            referencias.forEach(ref => {
                const refCoords = ref.coords.lat ? [ref.coords.lat, ref.coords.lng] : ref.coords;
                L.marker(refCoords, { icon: customIcon })
                    .addTo(map)
                    .bindTooltip(ref.nombre, {
                        permanent: true,
                        direction: 'top',
                        className: 'font-black text-[9px] uppercase bg-indigo-600 text-white border-0 rounded-full px-2 py-1 shadow-lg'
                    });
            });

            // 5. Add Point Mode (Admin)
            if (!readOnly) {
                let isPinning = false;
                const hint = document.getElementById('edit-hint');
                const btnPin = document.getElementById('btn-add-point');

                btnPin.onclick = () => {
                    isPinning = !isPinning;
                    btnPin.classList.toggle('bg-indigo-600');
                    btnPin.classList.toggle('bg-rose-500');
                    hint.classList.toggle('hidden');
                    document.getElementById('leaflet-map').style.cursor = isPinning ? 'crosshair' : '';
                };

                map.on('click', (e) => {
                    if (!isPinning) return;
                    const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
                    showCustomPrompt("Nombre del Punto", "Escribe una referencia rápida...", async (nombre) => {
                        if (!nombre) return;
                        try {
                            await addTerritoryReference(id, { nombre, coords });
                            L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(map)
                                .bindTooltip(nombre, { permanent: true, direction: 'top', className: 'font-black text-[9px] uppercase bg-indigo-600 text-white border-0 rounded-full px-2 py-1' });
                            showNotification("Referencia guardada", "success");
                        } catch (err) {
                            showNotification("Error de guardado", "error");
                        } finally {
                            btnPin.click();
                        }
                    });
                });
            }

            // Remove loader
            setTimeout(() => {
                const loader = document.getElementById('map-loader');
                if (loader) {
                    loader.classList.add('opacity-0');
                    setTimeout(() => loader.remove(), 700);
                }
            }, 1000);
        };

        // Wait for Leaflet to be ready
        if (typeof L !== 'undefined') {
            initLeafletMap();
        } else {
            const checkL = setInterval(() => {
                if (typeof L !== 'undefined') {
                    initLeafletMap();
                    clearInterval(checkL);
                }
            }, 100);
            setTimeout(() => clearInterval(checkL), 5000);
        }
    }
};

window.openInteractiveMap = (territory, options = {}) => {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.innerHTML = '<div id="map-viewer-root" class="w-full h-full max-w-6xl mx-auto p-2 md:p-8"></div>';
    modal.classList.remove('hidden');
    MapViewer.render(document.getElementById('map-viewer-root'), territory, options);
};

window.toggleImageZoom = (img) => {
    if (img.classList.contains('cursor-zoom-in')) {
        img.classList.replace('cursor-zoom-in', 'cursor-zoom-out');
        img.classList.replace('max-h-full', 'max-w-none');
        img.style.width = '200%';
    } else {
        img.classList.replace('cursor-zoom-out', 'cursor-zoom-in');
        img.classList.replace('max-w-none', 'max-h-full');
        img.style.width = '';
    }
};
