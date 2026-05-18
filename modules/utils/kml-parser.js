import { XolvyAlert } from './alerts.js';
import { updateTerritoryGeoJSON } from '../../data/firestore-services.js';

/**
 * @file modules/utils/kml-parser.js
 * @description Xolvy KML Intelligence — MultiPolygon Parser & Firestore Sync
 */

/**
 * Algoritmo de Alto Nivel: Parseo de Múltiples Manzanas (Polígonos) agrupados por ID de Territorio.
 */
export const parseKmlToGroupedData = (kmlString) => {
    if (!kmlString) return {};
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlString, 'text/xml');
    const placemarks = xml.querySelectorAll('Placemark');
    const groups = {};

    placemarks.forEach(pm => {
        const name = pm.querySelector('name')?.textContent || '';
        const tMatch = name.match(/\(T(\d+)\)/i);
        if (tMatch) {
            const tId = tMatch[1];
            const coordinatesNode = pm.querySelector('coordinates');
            
            if (coordinatesNode) {
                if (!groups[tId]) groups[tId] = [];
                
                const coordString = coordinatesNode.textContent.trim();
                const coordsArray = coordString.split(/\s+/); 
                
                const latLngs = coordsArray
                    .filter(c => c.includes(','))
                    .map(coord => {
                        const parts = coord.split(',');
                        const lat = parseFloat(parts[1]);
                        const lng = parseFloat(parts[0]);
                        return (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : null;
                    })
                    .filter(Boolean);
                
                if (latLngs.length > 0) {
                    // SE GUARDA EL NOMBRE PARA ETIQUETADO DINÁMICO
                    groups[tId].push({ 
                        nombre: name.replace(/\(T\d+\)/i, '').trim(), 
                        coords: latLngs 
                    });
                }
            }
        }
    });

    return groups;
};

/**
 * Sincroniza el contenido KML con Firestore agrupando por territorios detectados.
 */
export const syncKmlToFirestore = async (kmlString) => {
    const groups = parseKmlToGroupedData(kmlString);
    const tNums = Object.keys(groups);
    let updatedCount = 0;

    for (const tNum of tNums) {
        const geojson = {
            type: "FeatureCollection",
            features: groups[tNum].map((item, idx) => ({
                type: "Feature",
                properties: { 
                    id: `mz_${idx + 1}`,
                    name: item.nombre || `Manzana ${idx + 1}`
                },
                geometry: {
                    type: "Polygon",
                    coordinates: [item.coords.map(c => [c[1], c[0]])]
                }
            }))
        };
        
        const success = await updateTerritoryGeoJSON(tNum, geojson);
        if (success) updatedCount++;
    }
    return updatedCount;
};

/**
 * Extrae todos los polígonos disponibles de un territorio (Multi-manzana).
 */
export const extractMultiLeafletCoords = (territory) => {
    if (!territory) return [];
    
    const results = [];

    let geo = territory.geojson;
    if (typeof geo === 'string' && geo.trim().startsWith('{')) {
        try { geo = JSON.parse(geo); } catch (e) { geo = null; }
    }

    if (geo && geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
        geo.features.forEach(f => {
            if (f.geometry && f.geometry.type === 'Polygon') {
                const ring = f.geometry.coordinates[0];
                if (Array.isArray(ring)) {
                    results.push({
                        nombre: f.properties?.name || f.properties?.id || 'Mz',
                        coords: ring.map(pt => [pt[1], pt[0]])
                    });
                }
            }
        });
    }

    // Fallback retrocompatible
    if (results.length === 0 && typeof territory.kml === 'string' && territory.kml.includes('<coordinates>')) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(territory.kml, 'text/xml');
        const coordsEl = xml.querySelector('coordinates');
        if (coordsEl) {
            const pts = coordsEl.textContent.trim().split(/\s+/)
                .filter(c => c.includes(','))
                .map(c => {
                    const p = c.split(',');
                    return [parseFloat(p[1]), parseFloat(p[0])];
                });
            if (pts.length > 0) results.push({ nombre: 'Zona', coords: pts });
        }
    }

    return results;
};


const waitForLeaflet = () => {
    return new Promise((resolve) => {
        if (typeof L !== 'undefined') return resolve(L);
        const interval = setInterval(() => {
            if (typeof L !== 'undefined') {
                clearInterval(interval);
                resolve(L);
            }
        }, 100);
        setTimeout(() => { clearInterval(interval); resolve(null); }, 5000);
    });
};

export const showKmlMapModal = async (territorio, options = {}) => {
    const L = await waitForLeaflet();
    if (!L) {
        XolvyAlert.fire({ icon: 'error', title: 'Error de Red', text: 'Leaflet no detectado.' });
        return;
    }

    const { autoLocate = false } = options;
    const allItems = extractMultiLeafletCoords(territorio);

    if (allItems.length === 0) {
        XolvyAlert.fire({ icon: 'warning', title: 'SIN DATOS ESPACIALES', text: 'Este territorio no posee coordenadas válidas.' });
        return;
    }

    // ── Inyectar estilos glassmorphism para etiquetas y controles ──────────
    const STYLE_ID = 'xolvy-map-premium-styles';
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            /* Etiquetas glassmorphism de manzanas */
            .xolvy-mz-label {
                background: rgba(255,255,255,0.18) !important;
                backdrop-filter: blur(12px) saturate(1.8) !important;
                -webkit-backdrop-filter: blur(12px) saturate(1.8) !important;
                border: 1px solid rgba(255,255,255,0.35) !important;
                border-radius: 10px !important;
                padding: 4px 10px !important;
                color: #fff !important;
                font-size: 11px !important;
                font-weight: 900 !important;
                font-family: inherit !important;
                letter-spacing: 0.12em !important;
                text-transform: uppercase !important;
                text-shadow: 0 1px 4px rgba(0,0,0,0.6) !important;
                box-shadow: 0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3) !important;
                white-space: nowrap !important;
                pointer-events: none !important;
            }
            .xolvy-mz-label::before { display: none !important; }
            /* Pulso del marcador GPS */
            .xolvy-gps-dot {
                width: 18px; height: 18px;
                background: #4f46e5;
                border-radius: 50%;
                border: 3px solid #fff;
                box-shadow: 0 0 0 0 rgba(79,70,229,0.6);
                animation: xolvy-gps-pulse 1.8s infinite;
            }
            @keyframes xolvy-gps-pulse {
                0%   { box-shadow: 0 0 0 0 rgba(79,70,229,0.6); }
                70%  { box-shadow: 0 0 0 14px rgba(79,70,229,0); }
                100% { box-shadow: 0 0 0 0 rgba(79,70,229,0); }
            }
            /* Ocultar controles default de Leaflet */
            #xolvy-kml-modal .leaflet-control-zoom { display: none !important; }
        `;
        document.head.appendChild(style);
    }

    // ── Crear modal propio ────────────────────────────────────────────────
    const MODAL_ID = 'xolvy-kml-modal';
    let existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    const modalEl = document.createElement('div');
    modalEl.id = MODAL_ID;
    modalEl.className = 'fixed inset-0 z-[9999] flex items-stretch justify-center bg-black/60 backdrop-blur-sm animate-fade-in';
    modalEl.innerHTML = `
        <div class="relative flex flex-col w-full h-full md:max-w-[96vw] md:max-h-[92vh] md:m-auto md:rounded-[2rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] border border-white/10">

            <!-- MAP CONTAINER -->
            <div id="xolvy-leaflet-map" class="flex-1 min-w-0 w-full" style="min-height: 0;"></div>

            <!-- GLASS HEADER (absolute, sobre el mapa) -->
            <div class="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-white/20 shadow-2xl"
                 style="background: rgba(10,15,30,0.55); backdrop-filter: blur(20px) saturate(1.6); -webkit-backdrop-filter: blur(20px) saturate(1.6);">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0"
                         style="background: linear-gradient(135deg,#4f46e5,#6366f1); box-shadow: 0 4px 20px rgba(79,70,229,0.5);">
                        <i class="fas fa-map-marked-alt text-slate-800 dark:text-slate-100 text-sm"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="text-[9px] font-black text-indigo-300 uppercase tracking-[0.25em] leading-none mb-0.5">Localizador Satelital</p>
                        <h3 class="text-sm font-black text-slate-800 dark:text-slate-100 leading-none truncate">Territorio ${territorio.numero || ''}</h3>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-emerald-300 border border-emerald-400/20"
                          style="background: rgba(16,185,129,0.12);">
                        <i class="fas fa-satellite-dish text-[8px] animate-pulse"></i> Satelital
                    </span>
                    <button id="kml-modal-close"
                        class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-white transition-all hover:scale-110 active:scale-95 border border-white/10"
                        style="background: rgba(239,68,68,0.15);">
                        <i class="fas fa-times text-sm"></i>
                    </button>
                </div>
            </div>

            <!-- FLOATING CONTROLS (bottom-right) -->
            <div class="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2">
                <!-- Zoom group pill -->
                <div class="flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/15"
                     style="background: rgba(10,15,30,0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
                    <button id="xolvy-zoom-in"
                        class="w-11 h-11 flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-indigo-300 transition-all hover:bg-white/10 active:scale-90 border-b border-white/10"
                        title="Acercar">
                        <i class="fas fa-plus text-sm font-black"></i>
                    </button>
                    <button id="xolvy-zoom-out"
                        class="w-11 h-11 flex items-center justify-center text-slate-800 dark:text-slate-100 hover:text-indigo-300 transition-all hover:bg-white/10 active:scale-90"
                        title="Alejar">
                        <i class="fas fa-minus text-sm font-black"></i>
                    </button>
                </div>

                <!-- Recentrar -->
                <button id="xolvy-recenter"
                    class="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-800 dark:text-slate-100 transition-all hover:bg-white/10 active:scale-90 shadow-2xl border border-white/15"
                    style="background: rgba(10,15,30,0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
                    title="Recentrar mapa">
                    <i class="fas fa-compress-arrows-alt text-sm"></i>
                </button>

                <!-- Mi ubicación -->
                <button id="xolvy-locate"
                    class="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-800 dark:text-slate-100 transition-all active:scale-90 shadow-2xl border border-indigo-400/30 hover:scale-110"
                    style="background: linear-gradient(135deg,#4f46e5,#6366f1); box-shadow: 0 4px 20px rgba(79,70,229,0.45);"
                    title="Mi Ubicación">
                    <i class="fas fa-location-arrow text-sm"></i>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);

    // ── Inicializar Leaflet ───────────────────────────────────────────────
    const mapEl = document.getElementById('xolvy-leaflet-map');
    const map = L.map(mapEl, { zoomControl: false, scrollWheelZoom: true });

    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps'
    }).addTo(map);

    // ── Renderizar polígonos premium ──────────────────────────────────────
    const POLY_COLORS = ['#4f46e5','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6'];
    const layerGroup = L.featureGroup().addTo(map);

    allItems.forEach((item, index) => {
        const coords = item.coords || item;
        let labelText = (item.nombre || `Mz. ${index + 1}`).split('(')[0].trim();
        const accentColor = POLY_COLORS[index % POLY_COLORS.length];

        const poly = L.polygon(coords, {
            color: accentColor,
            weight: 2.5,
            fillColor: accentColor,
            fillOpacity: 0.22,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: null,
        }).addTo(layerGroup);

        // Hover: resaltar
        poly.on('mouseover', function() {
            this.setStyle({ fillOpacity: 0.42, weight: 3.5 });
        });
        poly.on('mouseout', function() {
            this.setStyle({ fillOpacity: 0.22, weight: 2.5 });
        });

        // Etiqueta glassmorphism permanente
        poly.bindTooltip(labelText, {
            permanent: true,
            direction: 'center',
            className: 'xolvy-mz-label'
        }).openTooltip();
    });

    if (layerGroup.getLayers().length > 0) {
        map.fitBounds(layerGroup.getBounds(), { padding: [80, 80] });
    }
    setTimeout(() => { map.invalidateSize(); }, 200);

    // ── Auto-localizar ────────────────────────────────────────────────────
    let userMarker = null;
    const doLocate = () => {
        map.locate({ setView: true, maxZoom: 17 });
    };
    if (autoLocate) setTimeout(doLocate, 500);

    map.on('locationfound', (e) => {
        if (userMarker) {
            userMarker.setLatLng(e.latlng);
        } else {
            userMarker = L.marker(e.latlng, {
                icon: L.divIcon({
                    className: '',
                    html: '<div class="xolvy-gps-dot"></div>',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                })
            }).addTo(map);
        }
        map.flyTo(e.latlng, 17, { animate: true, duration: 1.5 });
    });

    map.on('locationerror', () => {
        XolvyAlert.fire({ icon: 'error', title: 'GPS Desactivado', text: 'No se pudo obtener tu ubicación actual.' });
    });

    // ── Controles del panel ───────────────────────────────────────────────
    document.getElementById('xolvy-zoom-in').onclick  = () => map.zoomIn();
    document.getElementById('xolvy-zoom-out').onclick = () => map.zoomOut();
    document.getElementById('xolvy-recenter').onclick = () => {
        if (layerGroup.getLayers().length > 0) map.fitBounds(layerGroup.getBounds(), { padding: [80, 80] });
    };
    document.getElementById('xolvy-locate').onclick   = doLocate;

    // ── Cerrar modal ─────────────────────────────────────────────────────
    const closeModal = () => {
        map.remove();
        modalEl.remove();
    };
    document.getElementById('kml-modal-close').onclick = closeModal;
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeModal();
    });
};

