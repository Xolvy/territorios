import { XolvyAlert } from './alerts.js';

/**
 * @file modules/utils/kml-parser.js
 * @description Xolvy KML Parser — Visor Nativo Leaflet con Inversión de Coordenadas
 */

/**
 * Parsea un string KML crudo y retorna coordenadas invertidas [Lat, Lng] para Leaflet.
 * IGNORA la altitud.
 * @param {string} kmlString - Contenido XML del KML
 * @returns {Array<[number, number]>} - Array compatible con Leaflet
 */
export const parseKmlToLeaflet = (kmlString) => {
    if (!kmlString || typeof kmlString !== 'string') return [];

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlString, 'text/xml');
        const coordsEl = xmlDoc.querySelector('coordinates');

        if (!coordsEl) {
            console.warn('[KMLParser] Elemento <coordinates> no encontrado.');
            return [];
        }

        const rawText = coordsEl.textContent.trim();

        // El KML viene en Lng,Lat,Alt
        return rawText.split(/\s+/)
            .filter(pt => pt.includes(','))
            .map(pt => {
                const parts = pt.split(',');
                const lng = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                // Se descarta parts[2] (altitud)

                if (isNaN(lat) || isNaN(lng)) return null;

                // INVERSIÓN MATEMÁTICA para Leaflet -> [Lat, Lng]
                return [lat, lng];
            })
            .filter(Boolean);
    } catch (err) {
        console.error('[KMLParser] Falló el parseo:', err);
        return [];
    }
};

/**
 * Función unificada para extraer coordenadas [Lat, Lng] desde la entidad territorio,
 * manejando tanto KML antiguo como posible GeoJSON a futuro.
 */
export const extractLeafletCoordsFromTerritory = (territory) => {
    if (!territory) return [];
    
    // Si ya viene como KML string
    if (typeof territory.kml === 'string' && territory.kml.includes('<coordinates>')) {
        return parseKmlToLeaflet(territory.kml);
    }

    // Adaptador futuro GeoJSON (por si acaso Xolvy Hub evoluciona el modelo de datos)
    if (territory.geojson && territory.geojson.coordinates) {
        // En GeoJSON también es Lng,Lat, necesita inversión si devolvemos para Leaflet puro o no,
        // pero por ahora priorizamos KML.
        console.warn('[KMLParser] Extraer desde GeoJSON no implementado completamente aquí.');
    }

    return [];
};


/**
 * Muestra un XolvyAlert con el mapa interactivo nativo usando Leaflet y CartoDB Positron.
 * Aplica invalidateSize() para esquivar el bug visual de renderizado de Leaflet dentro de Modales.
 */
export const showKmlMapModal = async (territorio) => {
    if (typeof L === 'undefined') {
        XolvyAlert.fire({ icon: 'error', title: 'Leaflet (L) no detectado en ventana' });
        return;
    }

    const coords = extractLeafletCoordsFromTerritory(territorio);

    if (coords.length === 0) {
        XolvyAlert.fire({
            icon: 'warning',
            title: 'Sin datos espaciales',
            text: 'Este territorio no posee coordenadas KML válidas para renderizar el mapa interactivo.'
        });
        return;
    }

    const mapId = 'xolvy-leaflet-map';

    XolvyAlert.fire({
        title: `Territorio ${territorio.numero || ''} ${territorio.nombre ? '— ' + territorio.nombre : ''}`,
        html: `<div id="${mapId}" style="width: 100%; height: 65vh; border-radius: 12px; z-index: 10; border: 1px solid rgba(0,0,0,0.1);"></div>`,
        width: '92%',
        padding: '1.5rem',
        showCloseButton: true,
        showConfirmButton: false,
        didOpen: () => {
             // 1. Instanciar Leaflet
             const map = L.map(mapId, { zoomControl: true, scrollWheelZoom: true });

             // 2. TileLayer CartoDB Positron
             const isDark = document.documentElement.classList.contains('dark');
             const tileUrl = isDark ? 
                'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 
                'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

             L.tileLayer(tileUrl, {
                 attribution: '&copy; <a href="https://carto.com/">CARTO</a> Xolvy Maps',
                 subdomains: 'abcd',
                 maxZoom: 20
             }).addTo(map);

             // 3. Dibujar Polígono
             const polygon = L.polygon(coords, {
                 color: '#00D5FF',
                 weight: 3,
                 fillColor: '#00D5FF',
                 fillOpacity: 0.2
             }).addTo(map);

             // 4. Zoom Automático
             map.fitBounds(polygon.getBounds(), { padding: [30, 30] });

             // 5. CRÍTICO: Fix renderizado gris de Leaflet en Modales de SweetAlert/Animados
             setTimeout(() => {
                 map.invalidateSize();
             }, 150);
        }
    });
};
