export const parseKMLToGeoJSON = (kmlText) => {
    if (!kmlText || typeof kmlText !== "string") return null;

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlText, "text/xml");
        const placemarks = xmlDoc.querySelectorAll("Placemark");

        if (!placemarks || placemarks.length === 0) return null;

        const features = [];

        placemarks.forEach((pm, index) => {
            const nameEl = pm.querySelector("name");
            const name = nameEl ? nameEl.textContent.trim() : `Manzana ${index + 1}`;

            const coordsEl = pm.querySelector("coordinates");
            if (coordsEl) {
                const rawCoords = coordsEl.textContent.trim().split(/\s+/);
                const ring = [];

                rawCoords.forEach((ptStr) => {
                    const parts = ptStr.split(",");
                    if (parts.length >= 2) {
                        const lng = parseFloat(parts[0]);
                        const lat = parseFloat(parts[1]);
                        if (!isNaN(lng) && !isNaN(lat)) {
                            ring.push([lng, lat]);
                        }
                    }
                });

                if (ring.length >= 3) {
                    // Cerrar polígono si no está cerrado
                    if (
                        ring[0][0] !== ring[ring.length - 1][0] ||
                        ring[0][1] !== ring[ring.length - 1][1]
                    ) {
                        ring.push([...ring[0]]);
                    }

                    features.push({
                        type: "Feature",
                        properties: {
                            id: `mz_${index + 1}`,
                            name: name,
                        },
                        geometry: {
                            type: "Polygon",
                            coordinates: [ring],
                        },
                    });
                }
            }
        });

        if (features.length === 0) return null;

        return {
            type: "FeatureCollection",
            features: features,
        };
    } catch (e) {
        console.error("Error al parsear KML:", e);
        return null;
    }
};

export const extractMultiLeafletCoords = (territory) => {
    if (!territory) return [];

    const results = [];

    let geo = territory.geojson;
    if (typeof geo === "string" && geo.trim().startsWith("{")) {
        try {
            geo = JSON.parse(geo);
        } catch (_e) {
            geo = null;
        }
    }

    if (geo && geo.type === "FeatureCollection" && Array.isArray(geo.features)) {
        geo.features.forEach((f, idx) => {
            if (!f.geometry) return;
            const name = f.properties?.name || f.properties?.id || `Mz. ${idx + 1}`;

            if (f.geometry.type === "Polygon" && Array.isArray(f.geometry.coordinates)) {
                const ring = f.geometry.coordinates[0];
                if (Array.isArray(ring) && ring.length >= 3) {
                    results.push({
                        nombre: name,
                        coords: ring.map((pt) => [pt[1], pt[0]]),
                    });
                }
            } else if (f.geometry.type === "MultiPolygon" && Array.isArray(f.geometry.coordinates)) {
                f.geometry.coordinates.forEach((polyCoords, subIdx) => {
                    const ring = polyCoords[0];
                    if (Array.isArray(ring) && ring.length >= 3) {
                        results.push({
                            nombre: f.geometry.coordinates.length > 1 ? `${name} (${subIdx + 1})` : name,
                            coords: ring.map((pt) => [pt[1], pt[0]]),
                        });
                    }
                });
            }
        });
    }

    // Fallback retrocompatible para KML legacy en texto plano
    if (results.length === 0 && typeof territory.kml === "string" && territory.kml.includes("<coordinates>")) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(territory.kml, "text/xml");
        const placemarks = xml.querySelectorAll("Placemark");
        if (placemarks && placemarks.length > 0) {
            placemarks.forEach((pm, idx) => {
                const nameEl = pm.querySelector("name");
                const name = nameEl ? nameEl.textContent.trim() : `Mz. ${idx + 1}`;
                const coordsEl = pm.querySelector("coordinates");
                if (coordsEl) {
                    const pts = coordsEl.textContent
                        .trim()
                        .split(/\s+/)
                        .filter((c) => c.includes(","))
                        .map((c) => {
                            const p = c.split(",");
                            return [parseFloat(p[1]), parseFloat(p[0])];
                        });
                    if (pts.length >= 3) results.push({ nombre: name, coords: pts });
                }
            });
        }
    }

    return results;
};

export const waitForLeaflet = () => {
    return new Promise((resolve) => {
        if (typeof L !== "undefined") return resolve(L);
        const interval = setInterval(() => {
            if (typeof L !== "undefined") {
                clearInterval(interval);
                resolve(L);
            }
        }, 100);
        setTimeout(() => {
            clearInterval(interval);
            resolve(null);
        }, 5000);
    });
};

export const showKmlMapModal = async (territorio, options = {}) => {
    const L = await waitForLeaflet();
    if (!L) {
        if (window.XolvyAlert) {
            XolvyAlert.fire({ icon: "error", title: "Error de Red", text: "Leaflet no detectado." });
        }
        return;
    }

    const modalDiv = document.getElementById("modal-container");
    if (!modalDiv) return;

    modalDiv.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
            <div class="relative w-full max-w-4xl h-[85vh] bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col">
                <div class="p-4 px-6 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black">
                            <i class="fas fa-map-marked-alt"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Territorio #${territorio.numero}</h3>
                            <p class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">${territorio.localidad || "Vista Interactiva"}</p>
                        </div>
                    </div>
                    <button id="close-kml-modal" class="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="modal-map-viewport" class="flex-1 w-full h-full relative bg-[#0f172a]"></div>
            </div>
        </div>
    `;
    modalDiv.classList.remove("hidden");

    const closeBtn = modalDiv.querySelector("#close-kml-modal");
    if (closeBtn) {
        closeBtn.onclick = () => {
            modalDiv.classList.add("hidden");
            modalDiv.innerHTML = "";
        };
    }

    const mapContainer = modalDiv.querySelector("#modal-map-viewport");
    if (!mapContainer) return;

    const map = L.map(mapContainer, { zoomControl: false });
    L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", { maxZoom: 20 }).addTo(map);

    const POLY_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
    const allItems = extractMultiLeafletCoords(territorio);
    const group = L.featureGroup();

    allItems.forEach((item, idx) => {
        const coords = item.coords || item;
        const labelText = (item.nombre || `Mz. ${idx + 1}`).split("(")[0].trim();
        const accentColor = POLY_COLORS[idx % POLY_COLORS.length];

        const poly = L.polygon(coords, {
            color: accentColor,
            weight: 3,
            fillColor: accentColor,
            fillOpacity: 0.35,
        }).addTo(group);

        poly.bindTooltip(labelText, { permanent: true, direction: "center", className: "xolvy-mz-label" });
    });

    group.addTo(map);

    if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds(), { padding: [40, 40] });
    } else {
        map.setView([-2.1894, -79.8891], 15);
    }

    setTimeout(() => map.invalidateSize(), 200);
};
