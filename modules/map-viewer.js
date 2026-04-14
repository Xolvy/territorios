import { showNotification } from './utils/helpers.js';
import { showKmlMapModal } from './utils/kml-parser.js';

export const MapViewer = {
    render: (container, territory) => {
        const { numero, manzanas, imagen } = territory;

        const modal = document.getElementById('modal-container');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            modal.style.zIndex = '10001'; // Superior al ReceptionHub (9999)
        }

        container.innerHTML = `
            <div class="flex flex-col h-full w-full animate-fade-in bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-white/10 relative">
                
                <!-- GLASS HEADER -->
                <div class="z-40 flex justify-between items-center p-4 m-6 bg-white/70 dark:bg-gray-900/60 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-white/5 shadow-2xl absolute top-0 left-0 right-0">
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
                        <!-- VIEW TOGGLE BUTTON -->
                        <button id="btn-toggle-view" class="px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/20 shadow-lg group active:scale-95">
                            <i class="fas fa-layer-group group-hover:rotate-12 transition-transform duration-500"></i> <span>Ver Mapa Interactivo</span>
                        </button>
                        <button id="close-map" class="w-12 h-12 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center justify-center group">
                            <i class="fas fa-times group-hover:rotate-90 transition-transform"></i>
                        </button>
                    </div>
                </div>

                <div class="flex-1 w-full relative overflow-hidden bg-[#0f172a]">
                    
                    <!-- STATIC IMAGE VIEW (PNG VISOR) -->
                    <div id="static-image-viewer" class="absolute inset-0 w-full h-full flex items-center justify-center p-6 transition-opacity duration-500 opacity-100 overflow-hidden bg-slate-200 dark:bg-slate-700/40 z-30 touch-none">
                        <div id="map-img-container" class="relative w-full h-full max-w-full max-h-full flex items-center justify-center bg-white rounded-2xl shadow-2xl overflow-hidden" style="max-height:100%;">
                            <!-- Spinner/Skeleton state -->
                            <div id="map-loader-ui" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 z-10 transition-opacity duration-300">
                                <div class="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4 shadow-sm"></div>
                                <p class="font-black tracking-[0.2em] uppercase text-[10px] text-slate-500 animate-pulse">Descargando mapa estático...</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        const btnToggle = container.querySelector('#btn-toggle-view');

        const mapContainer = container.querySelector('#map-img-container');
        const loaderUi = container.querySelector('#map-loader-ui');
        const mapUrl = imagen || `./assets/maps/T-${numero}.png`;
        const img = new Image();
        img.onload = () => {
            img.id = 'map-img-element';
            img.className = "block max-w-full max-h-full object-contain transition-all duration-200 ease-out origin-center animate-fade-in";
            img.style.transform = "scale(1) translate(0px, 0px)";
            img.style.background = "#fff";
            mapContainer.appendChild(img);
            if (loaderUi) {
                loaderUi.style.opacity = '0';
                setTimeout(() => loaderUi.remove(), 300);
            }
        };
        img.onerror = () => {
            mapContainer.innerHTML = '<div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800"><i class="fas fa-image text-6xl shadow-inner text-slate-400 mb-4"></i><p class="font-black tracking-[0.2em] uppercase text-xs text-slate-500">Sin Imagen Disponible</p></div>';
        };
        img.src = mapUrl;

        if (btnToggle) {
            btnToggle.onclick = () => {
                showKmlMapModal(territory);
            };
        }

        document.getElementById('close-map').onclick = () => {
            const modal = document.getElementById('modal-container');
            if (modal) {
                modal.style.zIndex = '';
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            container.innerHTML = '';
        };
    },
    renderGlobal: (container, allTerritorios) => {
        const modal = document.getElementById('modal-container');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            modal.style.zIndex = '10001';
        }
        container.innerHTML = `
            <div class="flex flex-col h-full w-full animate-fade-in bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 relative">
                <div class="absolute top-6 left-6 right-6 z-40 flex justify-between items-center p-4 bg-white/70 dark:bg-gray-900/60 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-white/5 shadow-2xl">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg border border-white/20">
                            <i class="fas fa-satellite text-white text-xl"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-slate-800 dark:text-white tracking-tighter leading-none mb-1 text-lg">Explorador Global</h3>
                            <p class="text-[9px] text-emerald-500 uppercase font-black tracking-[0.2em] leading-none">Vista Satelital Dinámica</p>
                        </div>
                    </div>
                    <button id="close-global-map" class="w-10 h-10 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center justify-center">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div id="global-map-container" class="flex-1 w-full bg-[#0f172a] relative">
                     <div id="global-map-loader" class="absolute inset-0 z-[1000] bg-gray-950 flex items-center justify-center">
                        <div class="flex flex-col items-center gap-6">
                            <div class="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                            <p class="text-[10px] font-black uppercase text-emerald-500 tracking-[0.4em] animate-pulse">Cargando Mapa Satelital...</p>
                        </div>
                    </div>
                </div>

                <div class="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-[#0f1420]/95 backdrop-blur-md px-6 py-3 rounded-full border border-slate-200 dark:border-white/10 shadow-2xl flex items-center gap-3 pointer-events-none z-40">
                    <span class="relative flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span class="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Sincronizando con GPS del Dispositivo</span>
                </div>
            </div>
        `;

        document.getElementById('close-global-map').onclick = () => {
            const modal = document.getElementById('modal-container');
            if (modal) {
                modal.style.zIndex = '';
                modal.classList.add('hidden');
            }
            container.innerHTML = '';
        };

        const initMap = () => {
            const mapEl = document.getElementById('global-map-container');
            if (!mapEl || !window.google) return;

            const map = new google.maps.Map(mapEl, {
                center: { lat: -2.1894, lng: -79.8891 },
                zoom: 15,
                mapTypeId: 'satellite',
                tilt: 45,
                disableDefaultUI: true,
                gestureHandling: 'greedy'
            });

            const bounds = new google.maps.LatLngBounds();

            // Add all territories
            allTerritorios.forEach(t => {
                if (t.geojson) {
                    try {
                        const features = map.data.addGeoJson(t.geojson);
                        features.forEach(f => {
                            f.setProperty('numero', t.numero);
                            f.setProperty('id', t.id);
                            f.setProperty('manzanas', t.manzanas);

                            // Extract specific manzana from GeoJSON if available
                            const explicitMz = f.getProperty('name') || f.getProperty('manzana') || f.getProperty('label');
                            if (explicitMz) f.setProperty('mz_label', explicitMz);

                            const geo = f.getGeometry();
                            if (geo.getType() === 'Polygon') {
                                geo.getArray().forEach(path => {
                                    path.getArray().forEach(latlng => bounds.extend(latlng));
                                });
                            }
                        });
                    } catch (e) {
                        console.error(`Error loading GeoJSON for T-${t.numero}:`, e);
                    }
                }

                if (t.referencias) {
                    t.referencias.forEach(ref => {
                        new google.maps.Marker({
                            position: ref.coords,
                            map,
                            title: `T-${t.numero}: ${ref.nombre}`,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 4,
                                fillColor: "#fbbf24",
                                fillOpacity: 1,
                                strokeWeight: 2,
                                strokeColor: "#ffffff"
                            }
                        });
                    });
                }
            });

            // GPS Real-time Tracking
            let userMarker = null;
            if (navigator.geolocation) {
                navigator.geolocation.watchPosition((pos) => {
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
                }, (err) => console.warn("GPS Access Revoked or Error:", err), {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
            }

            map.data.setStyle((feature) => {
                if (feature.getGeometry().getType() === 'LineString') {
                    return {
                        strokeWeight: 4,
                        strokeColor: '#f43f5e',
                        cursor: 'pointer'
                    };
                }
                return {
                    fillColor: '#6366f1',
                    strokeWeight: 2,
                    strokeColor: '#ffffff',
                    fillOpacity: 0.1,
                    cursor: 'pointer'
                };
            });

            map.data.addListener('click', (event) => {
                const id = event.feature.getProperty('id');
                const t = allTerritorios.find(x => x.id === id);
                if (t) {
                    const explicitMz = event.feature.getProperty('mz_label');
                    const generalMz = event.feature.getProperty('manzanas');
                    const mzDisplay = explicitMz ? ` (Mz. ${explicitMz})` : (generalMz ? ` (Mz. ${generalMz})` : '');
                    showNotification(`Territorio ${t.numero}${mzDisplay} seleccionado`, "info");
                }
            });

            if (!bounds.isEmpty()) map.fitBounds(bounds);

            google.maps.event.addListenerOnce(map, 'idle', () => {
                document.getElementById('global-map-loader')?.remove();
            });
        };

        if (window.google && window.google.maps) initMap();
        else {
            const itv = setInterval(() => {
                if (window.google) { clearInterval(itv); initMap(); }
            }, 100);
        }
    }
};

window.openInteractiveMap = (territory, options = {}) => {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.innerHTML = '<div id="map-viewer-root" class="w-full h-full max-w-6xl mx-auto p-2 md:p-8"></div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    MapViewer.render(document.getElementById('map-viewer-root'), territory, options);
};
