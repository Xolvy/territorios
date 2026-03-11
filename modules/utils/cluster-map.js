/**
 * @file cluster-map.js
 * @description Xolvy ClusterMap — Supercluster + Google Maps integration.
 *
 * HIGH-PERFORMANCE marker clustering using Supercluster's spatial indexing (KD-tree).
 * Renders clusters via OverlayView + Canvas to avoid DOM node overhead.
 * Can handle 1000+ markers without FPS degradation on mobile.
 *
 * Architecture:
 * - Supercluster builds a geospatial index of all points in O(n log n)
 * - On every map bounds/zoom change, only visible clusters are queried (O(log n + k))
 * - Clusters are rendered as single Canvas overlay (not individual DOM markers)
 *   keeping the DOM clean regardless of point count.
 */
import Supercluster from 'supercluster';

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const CLUSTER_RADIUS = 80; // px — merge radius
const MAX_ZOOM = 17;       // Do not cluster beyond this zoom level

// ─── CANVAS OVERLAY RENDERER ──────────────────────────────────────────────────
class ClusterOverlay extends google.maps.OverlayView {
    constructor(map, clusters, onClusterClick) {
        super();
        this._clusters = clusters;
        this._onClusterClick = onClusterClick;
        this.setMap(map);
        this._canvas = null;
    }

    onAdd() {
        this._canvas = document.createElement('canvas');
        this._canvas.style.position = 'absolute';
        this._canvas.style.top = '0';
        this._canvas.style.left = '0';
        this._canvas.style.pointerEvents = 'none';
        this.getPanes().overlayLayer.appendChild(this._canvas);

        // Separate click pane canvas for interactivity
        this._hitCanvas = document.createElement('canvas');
        this._hitCanvas.style.cssText = 'position:absolute;top:0;left:0;opacity:0;';
        this.getPanes().overlayMouseTarget.appendChild(this._hitCanvas);
        this._hitCanvas.addEventListener('click', this._handleClick.bind(this));
    }

    _handleClick(e) {
        const rect = this._hitCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (!this._hitRegions) return;
        for (const region of this._hitRegions) {
            const dx = x - region.x;
            const dy = y - region.y;
            if (Math.sqrt(dx * dx + dy * dy) < region.r) {
                this._onClusterClick?.(region.cluster);
                return;
            }
        }
    }

    draw() {
        if (!this._canvas || !this._clusters?.length) return;
        const projection = this.getProjection();
        const map = this.getMap();
        const bounds = map.getBounds();
        const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
        const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());

        const w = Math.abs(ne.x - sw.x) + 200;
        const h = Math.abs(ne.y - sw.y) + 200;
        const offsetX = Math.min(ne.x, sw.x) - 100;
        const offsetY = Math.min(ne.y, sw.y) - 100;

        // Size both canvases
        for (const c of [this._canvas, this._hitCanvas]) {
            c.width = w * window.devicePixelRatio;
            c.height = h * window.devicePixelRatio;
            c.style.width = w + 'px';
            c.style.height = h + 'px';
            c.style.left = offsetX + 'px';
            c.style.top = offsetY + 'px';
        }

        const ctx = this._canvas.getContext('2d');
        const dr = window.devicePixelRatio;
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        ctx.scale(dr, dr);

        this._hitRegions = [];
        const isDark = document.documentElement.classList.contains('dark');

        for (const cluster of this._clusters) {
            const [lng, lat] = cluster.geometry.coordinates;
            const pt = projection.fromLatLngToDivPixel(new google.maps.LatLng(lat, lng));
            const x = pt.x - offsetX;
            const y = pt.y - offsetY;
            const isCluster = cluster.properties.cluster;
            const count = cluster.properties.point_count;

            if (isCluster) {
                // ── Cluster bubble ──
                const r = Math.min(22 + Math.sqrt(count) * 1.8, 48);
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
                gradient.addColorStop(0, '#6366f1');
                gradient.addColorStop(1, '#4f46e5');

                // Outer ring
                ctx.beginPath();
                ctx.arc(x, y, r + 6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(99,102,241,0.2)';
                ctx.fill();

                // Main bubble
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.shadowColor = 'rgba(99,102,241,0.6)';
                ctx.shadowBlur = 14;
                ctx.fill();
                ctx.shadowBlur = 0;

                // Border
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 2.5;
                ctx.stroke();

                // Label
                ctx.fillStyle = '#ffffff';
                ctx.font = `900 ${count > 99 ? 11 : 13}px system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(count > 999 ? '999+' : String(count), x, y);

                this._hitRegions.push({ x, y, r: r + 6, cluster });
            } else {
                // ── Single marker pin ──
                const status = cluster.properties.status || '';
                const pinColor = status === 'Asignado' ? '#10b981' : status === 'Libre' ? '#6366f1' : '#64748b';

                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fillStyle = pinColor;
                ctx.shadowColor = pinColor;
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.8)' : '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                this._hitRegions.push({ x, y, r: 12, cluster });
            }
        }
    }

    setClusters(clusters) {
        this._clusters = clusters;
        this.draw();
    }

    onRemove() {
        this._canvas?.remove();
        this._hitCanvas?.remove();
    }
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

/**
 * Initialize a clustered map overlay on an existing Google Maps instance.
 *
 * @param {google.maps.Map} map - The Google Maps instance to attach to
 * @param {Array} points - Array of data objects with { id, lat, lng, ...meta }
 * @param {Object} [options]
 * @param {Function} [options.onPointClick] - Called when a single marker is clicked
 * @param {Function} [options.onClusterClick] - Called when a cluster is clicked (zooms in by default)
 * @returns {{ update: Function, destroy: Function }} - Controller object
 */
export const initClusterMap = (map, points, options = {}) => {
    const { onPointClick, onClusterClick } = options;

    // 1. Build GeoJSON features from raw data
    const features = points.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id, status: p.status, numero: p.numero, label: p.label || p.numero, ...p },
    }));

    // 2. Build spatial index
    const index = new Supercluster({
        radius: CLUSTER_RADIUS,
        maxZoom: MAX_ZOOM,
        minPoints: 2,
    });
    index.load(features);

    // 3. Query helper
    const getClusters = () => {
        const bounds = map.getBounds();
        if (!bounds) return [];
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const zoom = Math.round(map.getZoom());
        return index.getClusters(
            [sw.lng(), sw.lat(), ne.lng(), ne.lat()],
            zoom
        );
    };

    // 4. Create overlay
    const handleClusterClick = (cluster) => {
        const isCluster = cluster.properties.cluster;
        if (isCluster) {
            const expansionZoom = Math.min(
                index.getClusterExpansionZoom(cluster.id),
                MAX_ZOOM + 2
            );
            const [lng, lat] = cluster.geometry.coordinates;
            map.setCenter({ lat, lng });
            map.setZoom(expansionZoom);
            if (onClusterClick) onClusterClick(cluster);
        } else {
            if (onPointClick) onPointClick(cluster.properties);
        }
    };

    const overlay = new ClusterOverlay(map, getClusters(), handleClusterClick);

    // 5. Refresh on map change (debounced for performance)
    let rafId = null;
    const refresh = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            overlay.setClusters(getClusters());
        });
    };

    const listeners = [
        map.addListener('bounds_changed', refresh),
        map.addListener('zoom_changed', refresh),
    ];

    // Initial draw
    google.maps.event.addListenerOnce(map, 'idle', refresh);

    return {
        /** Re-index with new data points */
        update(newPoints) {
            const newFeatures = newPoints.map(p => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                properties: { id: p.id, status: p.status, numero: p.numero, ...p },
            }));
            index.load(newFeatures);
            refresh();
        },
        /** Cleanup listeners and overlay */
        destroy() {
            listeners.forEach(l => google.maps.event.removeListener(l));
            overlay.setMap(null);
        }
    };
};
