/**
 * @file modules/utils/kml-parser.js
 * @description Xolvy KML Parser — Visor Nativo Leaflet
 *
 * CRÍTICO: El KML almacena coordenadas en formato [Lng, Lat, Alt].
 * Leaflet requiere [Lat, Lng]. Este parser invierte el orden y descarta la altitud.
 *
 * Flujo:
 *   parseKmlToLeaflet(kmlString) → Array<[lat, lng]>
 *   showKmlMapModal(territorio)  → Lanza SweetAlert2 con mapa Leaflet incrustado
 */

/**
 * Parsea un string KML y retorna coordenadas en formato Leaflet [Lat, Lng].
 * @param {string} kmlString - Contenido XML del KML
 * @returns {Array<[number, number]>} - Array de [Lat, Lng] para Leaflet
 */
export const parseKmlToLeaflet = (kmlString) => {
    if (!kmlString || typeof kmlString !== 'string') return [];

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlString, 'text/xml');

        // Buscar el primer elemento <coordinates> en el KML
        const coordsEl = xmlDoc.querySelector('coordinates');
        if (!coordsEl) {
            console.warn('[KMLParser] No se encontró elemento <coordinates> en el KML.');
            return [];
        }

        const rawText = coordsEl.textContent.trim();

        // Cada punto viene como "Lng,Lat,Alt" separado por espacios o saltos de línea
        const leafletCoords = rawText
            .split(/\s+/)
            .filter(point => point.includes(','))
            .map(point => {
                const parts = point.split(',');
                const lng = parseFloat(parts[0]); // KML: primer valor es Longitud
                const lat = parseFloat(parts[1]); // KML: segundo valor es Latitud
                // parts[2] = Altitud → IGNORADA

                if (isNaN(lat) || isNaN(lng)) return null;

                // INVERTIR para Leaflet: [Lat, Lng]
                return [lat, lng];
            })
            .filter(Boolean);

        console.log(`[KMLParser] ✅ Parseadas ${leafletCoords.length} coordenadas.`);
        return leafletCoords;

    } catch (err) {
        console.error('[KMLParser] Error parseando KML:', err);
        return [];
    }
};

/**
 * Muestra un modal SweetAlert2 de ancho 92% con el mapa Leaflet del territorio.
 * @param {object} territorio - Objeto con { nombre, numero, kml }
 */
export const showKmlMapModal = async (territorio) => {
    if (!window.Swal) {
        console.error('[KMLParser] SweetAlert2 (Swal) no disponible en window.');
        return;
    }

    const coords = parseKmlToLeaflet(territorio?.kml || '');

    if (coords.length === 0) {
        window.Swal.fire({
            icon: 'warning',
            title: 'Sin datos de mapa',
            text: 'Este territorio no tiene un KML válido asignado.',
            confirmButtonColor: '#0d9488',
        });
        return;
    }

    const mapContainerId = `kml-map-${Date.now()}`;

    await window.Swal.fire({
        title: `🗺️ Territorio ${territorio.numero || ''} — ${territorio.nombre || ''}`,
        html: `
            <div id="${mapContainerId}"
                 style="width:100%; height:65vh; border-radius:12px; overflow:hidden; background:#f0f4f8;">
            </div>
        `,
        width: '92%',
        showConfirmButton: false,
        showCloseButton: true,
        padding: '1rem',
        background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
        color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#1e293b',
        didOpen: () => {
            _initLeafletInModal(mapContainerId, coords, territorio);
        }
    });
};

/**
 * Instancia Leaflet dentro del contenedor del modal.
 * @private
 */
const _initLeafletInModal = (containerId, coords, territorio) => {
    if (typeof L === 'undefined') {
        console.error('[KMLParser] Leaflet (L) no está disponible globalmente.');
        document.getElementById(containerId).innerHTML =
            '<p style="text-align:center;padding:2rem;color:#ef4444;">Error: Leaflet no cargado</p>';
        return;
    }

    try {
        // Instanciar mapa en el contenedor del modal
        const map = L.map(containerId, {
            zoomControl: true,
            scrollWheelZoom: true,
        });

        // Capa base: CartoDB Positron (limpia, sin distracción)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20,
        }).addTo(map);

        // Polígono KML con color institucional
        const polygon = L.polygon(coords, {
            color: '#00D5FF',
            weight: 2.5,
            opacity: 0.9,
            fillColor: '#00D5FF',
            fillOpacity: 0.15,
        }).addTo(map);

        // Popup con nombre del territorio
        if (territorio.nombre) {
            polygon.bindPopup(
                `<strong>Territorio ${territorio.numero || ''}</strong><br>${territorio.nombre}`,
                { closeOnClick: false }
            ).openPopup();
        }

        // Centrar y ajustar bounds para ver todo el polígono
        map.fitBounds(polygon.getBounds(), { padding: [20, 20] });

        // Corregir bug del mapa gris por renderizado en modal oculto
        setTimeout(() => {
            map.invalidateSize();
        }, 150);

    } catch (err) {
        console.error('[KMLParser] Error iniciando mapa Leaflet:', err);
        document.getElementById(containerId).innerHTML =
            `<p style="text-align:center;padding:2rem;color:#ef4444;">Error al renderizar el mapa: ${err.message}</p>`;
    }
};
