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
                <div class="absolute top-6 left-6 right-6 z-40 flex justify-between items-center p-4 bg-white/70 dark:bg-gray-900/60 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-white/5 shadow-2xl">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] border border-white/20">
                            <i class="fas fa-map-marked-alt text-white text-xl"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-slate-800 dark:text-white tracking-tighter leading-none mb-1 text-lg">Territorio ${numero}</h3>
                            <p class="text-[9px] text-indigo-500 dark:text-indigo-400 uppercase font-black tracking-[0.2em] leading-none">${manzanas || 'Zona Premium'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <!-- VIEW TOGGLE BUTTON (Only if image exists) -->
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
                <div id="map-controls" class="absolute right-6 top-32 z-20 flex flex-col gap-3 ${imagen ? 'hidden' : ''}">
                    <button id="btn-my-location" class="w-12 h-12 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl text-slate-700 dark:text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-white/20 group" title="Mi Ubicación">
                        <i class="fas fa-location-arrow text-sm group-hover:text-indigo-500"></i>
                    </button>
                    <button id="btn-3d-toggle" class="w-12 h-12 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl text-slate-700 dark:text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-white/20 group" title="Vista 3D/2D">
                        <span class="font-black text-[10px] group-hover:text-indigo-500 uppercase">3D</span>
                    </button>
                    <button id="btn-map-type" class="w-12 h-12 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl text-slate-700 dark:text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-white/20 group" title="Cambiar Capas">
                        <i class="fas fa-layer-group text-sm group-hover:text-indigo-500"></i>
                    </button>
                    ${!readOnly ? `
                    <button id="btn-add-point" class="w-12 h-12 bg-indigo-500 text-white rounded-2xl shadow-[0_10px_20px_rgba(79,70,229,0.3)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-white/20" title="Añadir Referencia">
                        <i class="fas fa-plus"></i>
                    </button>` : ''}
                </div>

                <div class="flex-1 w-full relative overflow-hidden bg-[#0f172a]">
                    <!-- INTERACTIVE MAP CONTAINER -->
                    <div id="google-map" class="absolute inset-0 w-full h-full transition-opacity duration-700 ${imagen ? 'opacity-0 pointer-events-none' : 'opacity-100'}">
                        <div id="map-loader" class="absolute inset-0 z-[1000] bg-gray-950 flex items-center justify-center">
                            <div class="flex flex-col items-center gap-6">
                                <div class="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                <div class="text-center">
                                    <p class="text-[10px] font-black uppercase text-indigo-500 tracking-[0.4em] animate-pulse">Iniciando Motor Radar</p>
                                    <p class="text-[8px] text-slate-500 uppercase tracking-widest mt-2 ml-1">Renderizando Experiencia Premium</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- STATIC IMAGE VIEW (PNG) -->
                    ${imagen ? `
                    <div id="static-image-viewer" class="absolute inset-0 w-full h-full flex items-center justify-center p-4 transition-opacity duration-500 opacity-100 overflow-auto bg-black/40 backdrop-blur-sm z-30">
                        <div class="bg-white p-2 rounded-3xl shadow-[0_40px_80px_rgba(0,0,0,0.8)] border border-white/20 transform hover:scale-[1.02] transition-transform">
                            <img id="map-img-element" src="${imagen}" class="max-w-full max-h-full object-contain cursor-zoom-in rounded-2xl" onclick="window.toggleImageZoom(this)">
                        </div>
                    </div>
                    ` : ''}

                    <div id="edit-hint" class="absolute bottom-10 left-1/2 -translate-x-1/2 bg-indigo-500/90 backdrop-blur-xl text-white px-8 py-4 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl z-30 hidden animate-bounce border border-white/20">
                        <i class="fas fa-crosshairs mr-2"></i> Toca el mapa para situar punto
                    </div>
                </div>
            </div>
        `;

        const btnToggle = container.querySelector('#btn-toggle-view');
        const staticView = container.querySelector('#static-image-viewer');
        const interactiveView = container.querySelector('#google-map');
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

        const initGoogleMap = () => {
            const mapElement = document.getElementById('google-map');
            if (!mapElement || typeof google === 'undefined') return;

            let center = { lat: -2.1894, lng: -79.8891 };
            if (coordenadas) {
                if (typeof coordenadas === 'string' && coordenadas.includes(',')) {
                    const [lat, lng] = coordenadas.split(',').map(s => parseFloat(s.trim()));
                    if (!isNaN(lat) && !isNaN(lng)) center = { lat, lng };
                } else if (coordenadas.lat && coordenadas.lng) {
                    center = { lat: coordenadas.lat, lng: coordenadas.lng };
                }
            }

            const mapStyle = document.documentElement.classList.contains('dark') ? [
                { "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
                { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1e293b" }] },
                { "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
                { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#f1f5f9" }] },
                { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#818cf8" }] },
                { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
                { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#334155" }] },
                { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#1e293b" }] },
                { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#64748b" }] },
                { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#475569" }] },
                { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#020617" }] }
            ] : [];

            const map = new google.maps.Map(mapElement, {
                center,
                zoom: 18,
                styles: mapStyle,
                mapTypeId: 'satellite',
                tilt: 45,
                heading: 0,
                disableDefaultUI: true,
                zoomControl: false,
                gestureHandling: 'greedy',
                backgroundColor: '#0f172a'
            });

            // 1. Radar Animation (My Location)
            let userMarker = null;
            const btnLoc = document.getElementById('btn-my-location');

            btnLoc.onclick = () => {
                if (!navigator.geolocation) return showNotification("GPS no disponible", "error");

                showNotification("Sincronizando ubicación...", "info");
                navigator.geolocation.getCurrentPosition((pos) => {
                    const userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

                    if (!userMarker) {
                        userMarker = new google.maps.Marker({
                            position: userCoords,
                            map,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillColor: "#4f46e5",
                                fillOpacity: 1,
                                strokeWeight: 4,
                                strokeColor: "#ffffff"
                            },
                        });
                    } else {
                        userMarker.setPosition(userCoords);
                    }

                    map.panTo(userCoords);
                    map.setZoom(19);
                }, () => showNotification("Acceso GPS denegado", "error"));
            };

            // 2. 3D Tilt Multiplier
            let is3D = true;
            document.getElementById('btn-3d-toggle').onclick = () => {
                is3D = !is3D;
                map.setTilt(is3D ? 45 : 0);
                document.getElementById('btn-3d-toggle').querySelector('span').innerText = is3D ? '3D' : '2D';
            };

            // 3. Polygon Interactive Hover
            if (geojson) {
                map.data.addGeoJson(geojson);

                const normalStyle = {
                    fillColor: '#6366f1',
                    strokeWeight: 3,
                    strokeColor: '#ffffff',
                    fillOpacity: 0.15,
                    cursor: 'pointer'
                };

                const hoverStyle = {
                    fillColor: '#818cf8',
                    strokeWeight: 5,
                    strokeColor: '#ffffff',
                    fillOpacity: 0.4
                };

                map.data.setStyle(normalStyle);

                map.data.addListener('mouseout', (event) => {
                    map.data.revertStyle();
                });

                // PERMITIR CLIC EN POLÍGONOS PARA AÑADIR PUNTOS
                map.data.addListener('click', (event) => {
                    // Manually trigger the map click logic if we are pinning
                    if (window.setPinningModeActive) {
                        google.maps.event.trigger(map, 'click', {
                            latLng: event.latLng
                        });
                    }
                });

                // Auto-center bounds
                const bounds = new google.maps.LatLngBounds();
                map.data.forEach((feature) => {
                    const geometry = feature.getGeometry();
                    if (geometry.getType() === 'Polygon') {
                        geometry.getArray().forEach(path => {
                            path.getArray().forEach(latlng => bounds.extend(latlng));
                        });
                    }
                });
                if (!bounds.isEmpty()) map.fitBounds(bounds);
            }

            // Reference Markers
            referencias.forEach(ref => {
                new google.maps.Marker({
                    position: ref.coords,
                    map,
                    title: ref.nombre,
                    label: {
                        text: ref.nombre,
                        color: "white",
                        fontSize: "9px",
                        fontWeight: "900",
                        className: "bg-indigo-600/90 px-3 py-1 rounded-full backdrop-blur-md shadow-lg border border-white/20 mt-8"
                    }
                });
            });

            // Map Type Toggle
            document.getElementById('btn-map-type').onclick = () => {
                const current = map.getMapTypeId();
                map.setMapTypeId(current === 'satellite' ? 'roadmap' : 'satellite');
            };

            // Admin: Add Point Logic
            if (!readOnly) {
                let isPinning = false;
                const hint = document.getElementById('edit-hint');
                const btnPin = document.getElementById('btn-add-point');

                btnPin.onclick = () => {
                    isPinning = !isPinning;
                    window.setPinningModeActive = isPinning; // Global flag for data layer click
                    btnPin.classList.toggle('bg-indigo-600');
                    btnPin.classList.toggle('bg-rose-500'); // Warning color
                    hint.classList.toggle('hidden');
                    map.setOptions({ draggableCursor: isPinning ? 'crosshair' : null });
                };

                map.addListener('click', async (e) => {
                    if (!isPinning) return;
                    const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                    showCustomPrompt("Nombre del Punto", "Escribe una referencia rápida...", async (nombre) => {
                        if (!nombre) return;
                        try {
                            await addTerritoryReference(id, { nombre, coords });
                            new google.maps.Marker({
                                position: coords,
                                map,
                                title: nombre,
                                animation: google.maps.Animation.DROP
                            });
                            showNotification("Referencia guardada", "success");
                        } catch (err) {
                            showNotification("Error de guardado", "error");
                        } finally {
                            btnPin.click();
                        }
                    });
                });
            }

            google.maps.event.addListenerOnce(map, 'idle', () => {
                document.getElementById('map-loader')?.classList.add('transition-opacity', 'duration-1000', 'opacity-0');
                setTimeout(() => document.getElementById('map-loader')?.remove(), 1000);
            });
        };

        if (window.google && window.google.maps) {
            initGoogleMap();
        } else {
            const checkGoogle = setInterval(() => {
                if (window.google && window.google.maps) {
                    initGoogleMap();
                    clearInterval(checkGoogle);
                }
            }, 100);
            setTimeout(() => clearInterval(checkGoogle), 5000);
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
