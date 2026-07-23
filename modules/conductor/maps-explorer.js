import { LiveLocationService } from "../services/live-location-service.js";
import { extractMultiLeafletCoords } from "../utils/kml-parser.js";
import { showNotification } from "../utils/helpers.js";

export const renderMapsExplorer = (container, allTerritorios, openMapFn) => {
    if (!container) return;

    // Element references
    const mapsSection = container.querySelector("#interactive-maps-module");
    if (!mapsSection) return;

    const targetContainer = mapsSection.querySelector("#maps-explorer-content-container") || mapsSection;

    // Clean up previous instance state
    if (window._fullExplorerMap) {
        try { window._fullExplorerMap.remove(); } catch (_e) {}
        window._fullExplorerMap = null;
    }
    if (window._liveGpsUnsub) {
        window._liveGpsUnsub();
        window._liveGpsUnsub = null;
    }

    // Prepare territory list sorted 1 to 22 (strictly merged & deduplicated by territory number)
    const uniqueMap = new Map();
    allTerritorios.forEach((t) => {
        const cleanNum = String(t.numero || "").trim();
        if (!cleanNum) return;
        if (!uniqueMap.has(cleanNum)) {
            uniqueMap.set(cleanNum, t);
        } else {
            const existing = uniqueMap.get(cleanNum);
            let geo1 = existing.geojson;
            if (typeof geo1 === "string" && geo1.trim().startsWith("{")) {
                try { geo1 = JSON.parse(geo1); } catch (_e) { geo1 = null; }
            }
            let geo2 = t.geojson;
            if (typeof geo2 === "string" && geo2.trim().startsWith("{")) {
                try { geo2 = JSON.parse(geo2); } catch (_e) { geo2 = null; }
            }

            let mergedFeatures = [];
            if (geo1 && Array.isArray(geo1.features)) mergedFeatures.push(...geo1.features);
            if (geo2 && Array.isArray(geo2.features)) mergedFeatures.push(...geo2.features);

            const featMap = new Map();
            mergedFeatures.forEach((f, idx) => {
                const featKey = f.geometry?.coordinates ? JSON.stringify(f.geometry.coordinates) : `idx_${idx}`;
                if (!featMap.has(featKey)) featMap.set(featKey, f);
            });

            const finalFeatures = Array.from(featMap.values());
            const mergedGeoJSON = finalFeatures.length > 0 ? {
                type: "FeatureCollection",
                features: finalFeatures
            } : (geo1 || geo2);

            uniqueMap.set(cleanNum, {
                ...existing,
                geojson: mergedGeoJSON,
                imagen: existing.imagen || t.imagen,
                localidad: existing.localidad || t.localidad,
            });
        }
    });

    const sortedTerritorios = Array.from(uniqueMap.values()).sort(
        (a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0)
    );

    // Build Territory Options HTML
    const optionsHtml = sortedTerritorios
        .map((t) => `<option value="${t.numero}">Territorio ${t.numero} ${t.localidad ? `(${t.localidad})` : ""}</option>`)
        .join("");

    targetContainer.innerHTML = `
        <div class="flex flex-col h-[720px] w-full bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-2xl relative">
            <!-- TOP CONTROLS BAR -->
            <div class="z-30 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                    <div class="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-base font-black shrink-0 shadow-lg shadow-indigo-600/20">
                        <i class="fas fa-map"></i>
                    </div>
                    <div class="flex flex-col min-w-[140px]">
                        <span class="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Navegación Territorial</span>
                        <select id="map-territory-select" class="bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-800 dark:text-white px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 outline-none focus:border-indigo-500 cursor-pointer">
                            <option value="all" selected>🗺️ Todos los Territorios (1 al 22)</option>
                            ${optionsHtml}
                        </select>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-wrap shrink-0">
                    <!-- SATELLITE VS IMAGE TOGGLE -->
                    <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-white/10">
                        <button id="btn-mode-sat" class="px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all bg-indigo-600 text-white shadow-md">
                            <i class="fas fa-satellite mr-1"></i> Satélite
                        </button>
                        <button id="btn-mode-img" class="px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all text-slate-500 hover:text-slate-800 dark:hover:text-white">
                            <i class="fas fa-image mr-1"></i> Croquis Imagen
                        </button>
                    </div>

                    <!-- IN-PLACE TOGGLE: TERRITORIOS LIBRES VS VISTA NORMAL -->
                    <button id="btn-open-sugerencias-dispo" class="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm" title="Alternar Vista entre Modo Normal y Territorios Libres (Disponibilidad)">
                        <i class="fas fa-check-circle text-emerald-500 text-xs"></i>
                        <span>Territorios Libres</span>
                    </button>

                    <!-- LIVE GPS BUTTON -->
                    <button id="btn-toggle-live-gps" class="px-3.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95">
                        <span class="relative flex h-2 w-2">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        <span>GPS en Vivo</span>
                    </button>
                </div>
            </div>

            <!-- MAIN DISPLAY AREA -->
            <div class="flex-1 relative w-full h-full overflow-hidden bg-[#0f172a]">
                <!-- SATELLITE MAP VISOR -->
                <div id="full-map-leaflet-viewer" class="absolute inset-0 w-full h-full z-10">
                    <!-- HEADER OVERLAY BANNER FOR SELECTED TERRITORY (Admin Style) -->
                    <div id="explorer-territory-banner" class="hidden absolute top-4 left-4 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-3 px-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex items-center gap-3 animate-fade-in pointer-events-auto">
                        <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-black shrink-0 shadow-md">
                            <i class="fas fa-map-marked-alt"></i>
                        </div>
                        <div class="flex flex-col min-w-0">
                            <div id="banner-t-title" class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">Territorio #1</div>
                            <div id="banner-t-sub" class="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">MANZANAS: 4</div>
                        </div>
                        <button id="banner-btn-croquis" class="ml-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md active:scale-95">
                            <i class="fas fa-image text-xs"></i> <span>Ver Croquis</span>
                        </button>
                    </div>

                    <!-- FLOATING LEGEND FOR TERRITORIOS LIBRES MODE -->
                    <div id="explorer-dispo-legend" class="hidden absolute bottom-6 left-4 z-[1000] flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl px-3.5 py-2 shadow-2xl border border-slate-200/60 dark:border-white/10 pointer-events-auto select-none">
                        <span class="flex items-center gap-1.5 text-[8.5px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span>Libre</span>
                        <span class="flex items-center gap-1.5 text-[8.5px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest"><span class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></span>Ocupado</span>
                    </div>

                    <!-- FLOATING MAP CONTROLS -->
                    <div class="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
                        <button id="explorer-zoom-in" class="w-10 h-10 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-white flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all active:scale-90" title="Acercar"><i class="fas fa-plus text-xs"></i></button>
                        <button id="explorer-zoom-out" class="w-10 h-10 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-white flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all active:scale-90" title="Alejar"><i class="fas fa-minus text-xs"></i></button>
                        <button id="explorer-recenter" class="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-90" title="Recentar"><i class="fas fa-compress-arrows-alt text-xs"></i></button>
                    </div>
                </div>

                <!-- STATIC IMAGE VISOR (Solid White Canvas for maximum croquis clarity) -->
                <div id="full-map-image-viewer" class="absolute inset-0 w-full h-full z-20 hidden flex items-center justify-center bg-white p-4 md:p-8" style="background-color: #ffffff !important;">
                    <div id="img-holder" class="relative max-w-full max-h-full flex flex-col items-center justify-center bg-white p-3 rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden" style="background-color: #ffffff !important;">
                        <img id="territory-static-img" src="/assets/mapa-general.png" alt="Croquis de la congregación" class="max-w-full max-h-[620px] object-contain rounded-xl shadow-md bg-white" style="background-color: #ffffff !important;">
                        <div id="img-empty-msg" class="hidden text-center py-20 px-6 text-slate-500 font-bold space-y-3 bg-white" style="background-color: #ffffff !important;">
                            <i class="fas fa-image text-4xl opacity-40 text-slate-400"></i>
                            <p class="text-xs uppercase tracking-wider text-slate-600 font-black">Selecciona un territorio para ver su croquis en imagen</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // State Variables
    let currentMode = "satelital"; // "satelital" | "imagen"
    let mapStyleMode = "normal"; // "normal" | "disponibilidad"
    let selectedNumber = "all";
    let isGpsActive = false;
    let gpsMarkers = {};
    let leafletMap = null;
    let geoJsonLayers = {};
    let territoryCenterMarkers = {};
    let boundsGroup = null;

    const mapContainer = mapsSection.querySelector("#full-map-leaflet-viewer");
    const imgViewer = mapsSection.querySelector("#full-map-image-viewer");
    const staticImg = mapsSection.querySelector("#territory-static-img");
    const emptyMsg = mapsSection.querySelector("#img-empty-msg");
    const selectEl = mapsSection.querySelector("#map-territory-select");
    const btnSat = mapsSection.querySelector("#btn-mode-sat");
    const btnImg = mapsSection.querySelector("#btn-mode-img");
    const btnFreeTerritories = mapsSection.querySelector("#btn-open-sugerencias-dispo");
    const btnGps = mapsSection.querySelector("#btn-toggle-live-gps");
    const territoryBanner = mapsSection.querySelector("#explorer-territory-banner");
    const bannerTitle = mapsSection.querySelector("#banner-t-title");
    const bannerSub = mapsSection.querySelector("#banner-t-sub");
    const bannerBtnCroquis = mapsSection.querySelector("#banner-btn-croquis");
    const dispoLegend = mapsSection.querySelector("#explorer-dispo-legend");

    // Helper: Compute assigned territory numbers for active week program
    const getWeeklyAssignedNumbers = () => {
        const assigned = new Set();
        const prog = window._progCache?.programa;
        if (prog && Array.isArray(prog.dias)) {
            prog.dias.forEach((dia) => {
                Object.keys(dia).forEach((key) => {
                    if (key !== "nombre" && key !== "fecha" && dia[key]?.territorio) {
                        String(dia[key].territorio)
                            .split(/[,;/]/)
                            .map((t) => t.trim())
                            .filter(Boolean)
                            .forEach((num) => {
                                const cleanNum = num.replace(/^T-?/i, "").trim();
                                assigned.add(cleanNum);
                                assigned.add(num);
                            });
                    }
                });
            });
        }
        return assigned;
    };

    // In-place Toggle: Update polygon styles (Normal vs Disponibilidad)
    const updatePolygonStyles = () => {
        const POLY_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
        const assigned = getWeeklyAssignedNumbers();

        sortedTerritorios.forEach((t) => {
            const numStr = String(t.numero);
            const group = geoJsonLayers[numStr];
            if (!group || !group.eachLayer) return;

            const isSelected = selectedNumber !== "all" && numStr === selectedNumber;
            const isAssignedInWeek = assigned.has(numStr) || assigned.has(numStr.replace(/^T-?/i, "").trim());

            group.eachLayer((poly, idx) => {
                if (!poly.setStyle) return;

                if (mapStyleMode === "disponibilidad") {
                    const color = isAssignedInWeek ? "#dc2626" : "#059669";
                    const fillColor = isAssignedInWeek ? "#ef4444" : "#10b981";
                    poly.setStyle({
                        color: color,
                        weight: isSelected ? 4.5 : 2.5,
                        opacity: 0.95,
                        fillColor: fillColor,
                        fillOpacity: isSelected ? 0.6 : 0.35,
                    });
                } else {
                    const accentColor = POLY_COLORS[idx % POLY_COLORS.length];
                    poly.setStyle({
                        color: accentColor,
                        weight: isSelected ? 4.5 : 2.5,
                        opacity: 0.9,
                        fillColor: accentColor,
                        fillOpacity: isSelected ? 0.5 : 0.25,
                    });
                }
            });
        });
    };

    // Dynamic Label Visibility:
    // General Map View (`selectedNumber === "all"`): Show ONLY Terr. 1, Terr. 2... badges at centroids. Hide Mz tooltips.
    // Specific Territory View (`selectedNumber !== "all"`): Hide Terr. X centroid badges. Show Mz. 1, Mz. 2... tooltips on polygons.
    const updateLabelVisibility = () => {
        if (!leafletMap) return;
        const isSingleSelected = selectedNumber !== "all";

        // 1. Territory Centroid Markers (Terr. 1, Terr. 2, ...)
        Object.keys(territoryCenterMarkers).forEach((numStr) => {
            const marker = territoryCenterMarkers[numStr];
            if (marker) {
                if (!isSingleSelected) {
                    if (!leafletMap.hasLayer(marker)) marker.addTo(leafletMap);
                } else {
                    if (leafletMap.hasLayer(marker)) leafletMap.removeLayer(marker);
                }
            }
        });

        // 2. Individual Manzana Block Tooltips (Mz. 1, Mz. 2, ...)
        Object.keys(geoJsonLayers).forEach((numStr) => {
            const group = geoJsonLayers[numStr];
            const isThisSelected = isSingleSelected && numStr === selectedNumber;

            if (group && group.eachLayer) {
                group.eachLayer((poly) => {
                    const tooltip = poly.getTooltip();
                    if (tooltip) {
                        if (isThisSelected) poly.openTooltip();
                        else poly.closeTooltip();
                    }
                });
            }
        });
    };

    // Initialize Leaflet Map
    const initLeafletMap = () => {
        if (!mapContainer || !window.L) return;

        leafletMap = L.map(mapContainer, {
            center: [-2.1894, -79.8891],
            zoom: 14,
            zoomControl: false,
        });
        window._fullExplorerMap = leafletMap;

        // Tile layer (Google Satellite Hybrid for maximum crispness)
        L.tileLayer(
            "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
            { maxZoom: 20, attribution: "&copy; Google Maps" }
        ).addTo(leafletMap);

        const POLY_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
        boundsGroup = L.featureGroup();

        sortedTerritorios.forEach((t) => {
            const allItems = extractMultiLeafletCoords(t);
            if (allItems && allItems.length > 0) {
                try {
                    const subGroup = L.featureGroup();
                    allItems.forEach((item, idx) => {
                        const coords = item.coords || item;
                        const labelText = (item.nombre || `Mz. ${idx + 1}`).split("(")[0].trim();
                        const accentColor = POLY_COLORS[idx % POLY_COLORS.length];

                        const poly = L.polygon(coords, {
                            color: accentColor,
                            weight: 2.5,
                            opacity: 0.9,
                            fillColor: accentColor,
                            fillOpacity: 0.25,
                            lineCap: "round",
                            lineJoin: "round",
                        }).addTo(subGroup);

                        poly.bindTooltip(labelText, {
                            permanent: false,
                            direction: "center",
                            className: "xolvy-mz-label",
                        });

                        poly.on("click", (e) => {
                            if (e.originalEvent) e.originalEvent.stopPropagation();
                            selectEl.value = String(t.numero);
                            focusTerritory(String(t.numero));
                        });
                    });

                    subGroup.addTo(leafletMap);
                    geoJsonLayers[String(t.numero)] = subGroup;
                    boundsGroup.addLayer(subGroup);

                    // Clean up any existing centroid marker for this territory number to prevent duplicates
                    const numKey = String(t.numero).trim();
                    if (territoryCenterMarkers[numKey]) {
                        try { leafletMap.removeLayer(territoryCenterMarkers[numKey]); } catch (_e) {}
                        delete territoryCenterMarkers[numKey];
                    }

                    // Create prominent Centroid Badge Marker for General View (Terr. 1, Terr. 2, ...)
                    const center = subGroup.getBounds().getCenter();
                    const territoryBadgeIcon = L.divIcon({
                        className: "xolvy-territory-centroid-icon",
                        html: `
                            <div class="px-2.5 py-1 bg-slate-900/90 text-white border border-indigo-500/40 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-1.5 cursor-pointer hover:scale-110 transition-transform select-none">
                                <span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                                <span class="text-[10px] font-black uppercase tracking-wider">Terr. ${t.numero}</span>
                            </div>
                        `,
                        iconSize: [84, 26],
                        iconAnchor: [42, 13],
                    });
                    const cMarker = L.marker(center, { icon: territoryBadgeIcon, zIndexOffset: 1000 }).addTo(leafletMap);
                    cMarker.on("click", (e) => {
                        if (e.originalEvent) e.originalEvent.stopPropagation();
                        selectEl.value = String(t.numero);
                        focusTerritory(String(t.numero));
                    });
                    territoryCenterMarkers[numKey] = cMarker;

                } catch (e) {
                    console.error(`Error loading polygon T-${t.numero}:`, e);
                }
            }
        });

        if (boundsGroup.getLayers().length > 0) {
            leafletMap.fitBounds(boundsGroup.getBounds(), { padding: [30, 30] });
        }

        // Listen for map zoom & view events to keep labels synced
        leafletMap.on("zoomend", updateLabelVisibility);
        setTimeout(() => {
            if (leafletMap) {
                leafletMap.invalidateSize();
                if (boundsGroup.getLayers().length > 0) {
                    leafletMap.fitBounds(boundsGroup.getBounds(), { padding: [30, 30] });
                }
            }
            updateLabelVisibility();
        }, 300);

        // Map Control bindings
        mapsSection.querySelector("#explorer-zoom-in")?.addEventListener("click", () => leafletMap.zoomIn());
        mapsSection.querySelector("#explorer-zoom-out")?.addEventListener("click", () => leafletMap.zoomOut());
        mapsSection.querySelector("#explorer-recenter")?.addEventListener("click", () => {
            if (selectedNumber !== "all" && geoJsonLayers[selectedNumber]) {
                const b = geoJsonLayers[selectedNumber].getBounds();
                if (b && b.isValid()) leafletMap.fitBounds(b, { padding: [40, 40], maxZoom: 18 });
            } else if (boundsGroup.getLayers().length > 0) {
                leafletMap.fitBounds(boundsGroup.getBounds(), { padding: [30, 30] });
            }
        });
    };

    // Focus / Zoom on Territory
    const focusTerritory = (num) => {
        selectedNumber = num;
        updatePolygonStyles();

        if (num === "all") {
            territoryBanner?.classList.add("hidden");
            const allLayers = Object.values(geoJsonLayers).filter(Boolean);
            if (allLayers.length > 0) {
                const allBounds = L.featureGroup(allLayers).getBounds();
                if (allBounds.isValid()) leafletMap.fitBounds(allBounds, { padding: [30, 30] });
            }
            updateImageViewer(null);
            updateLabelVisibility();
            return;
        }

        const targetTerritory = sortedTerritorios.find((t) => String(t.numero) === String(num));
        const layerGroup = geoJsonLayers[String(num)];

        if (layerGroup) {
            const b = layerGroup.getBounds ? layerGroup.getBounds() : null;
            if (b && b.isValid()) {
                leafletMap.fitBounds(b, { padding: [40, 40], maxZoom: 18 });
            }
        }

        // Update Header Banner Overlay (Admin style)
        if (targetTerritory) {
            const allItems = extractMultiLeafletCoords(targetTerritory);
            if (bannerTitle) bannerTitle.textContent = `Territorio #${targetTerritory.numero} ${targetTerritory.localidad ? `(${targetTerritory.localidad})` : ""}`;
            if (bannerSub) bannerSub.textContent = `MANZANAS: ${allItems.length || 1}`;
            territoryBanner?.classList.remove("hidden");
        }

        updateImageViewer(targetTerritory);
        updateLabelVisibility();
    };

    // Update Image Viewer for selected territory or master croquis image (Image 2)
    const updateImageViewer = (territory) => {
        if (!territory) {
            // General Map Croquis: Display master congregation croquis image
            staticImg.src = "/assets/mapa-general.png";
            staticImg.classList.remove("hidden");
            emptyMsg.classList.add("hidden");
        } else {
            const targetSrc = territory.imagen || `/assets/maps/T-${territory.numero}.png`;
            staticImg.src = targetSrc;
            staticImg.classList.remove("hidden");
            emptyMsg.classList.add("hidden");

            staticImg.onerror = () => {
                staticImg.classList.add("hidden");
                emptyMsg.classList.remove("hidden");
                emptyMsg.querySelector("p").textContent = `Sin imagen almacenada para el Territorio ${territory.numero}`;
            };
        }
    };

    // Toggle Satélite vs Imagen
    const setViewMode = (mode) => {
        currentMode = mode;
        if (mode === "satelital") {
            btnSat.className = "px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all bg-indigo-600 text-white shadow-md";
            btnImg.className = "px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all text-slate-500 hover:text-slate-800 dark:hover:text-white";
            imgViewer.classList.add("hidden");
            mapContainer.classList.remove("hidden");
            if (leafletMap) setTimeout(() => leafletMap.invalidateSize(), 100);
        } else {
            btnImg.className = "px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all bg-indigo-600 text-white shadow-md";
            btnSat.className = "px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all text-slate-500 hover:text-slate-800 dark:hover:text-white";
            mapContainer.classList.add("hidden");
            imgViewer.classList.remove("hidden");

            const target = sortedTerritorios.find((t) => String(t.numero) === String(selectedNumber));
            updateImageViewer(target);
        }
    };

    // Live GPS tracking toggle
    const toggleLiveGps = () => {
        isGpsActive = !isGpsActive;
        const currentName = window.XolvyApp?.user?.nombre || localStorage.getItem("selected_conductor_name") || "Usuario";
        const currentRole = window.XolvyApp?.user?.role || "Publicador";

        if (isGpsActive) {
            btnGps.className = "px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-indigo-600/25";
            LiveLocationService.startSharingLocation(currentName, currentRole);

            window._liveGpsUnsub = LiveLocationService.subscribeToLiveLocations((users) => {
                if (!leafletMap) return;
                users.forEach((u) => {
                    if (u.lat && u.lng) {
                        if (!gpsMarkers[u.id]) {
                            const gpsIcon = L.divIcon({
                                className: "",
                                html: `
                                    <div class="relative flex items-center justify-center">
                                        <div class="absolute w-8 h-8 rounded-full bg-emerald-500/30 animate-ping"></div>
                                        <div class="px-2 py-0.5 bg-emerald-600 text-white text-[8px] font-black rounded-lg shadow-md border border-white uppercase tracking-wider flex items-center gap-1">
                                            <i class="fas fa-user text-[7px]"></i> ${u.nombre.split(" ")[0]}
                                        </div>
                                    </div>
                                `,
                                iconSize: [80, 24],
                                iconAnchor: [40, 12],
                            });
                            gpsMarkers[u.id] = L.marker([u.lat, u.lng], { icon: gpsIcon }).addTo(leafletMap);
                        } else {
                            gpsMarkers[u.id].setLatLng([u.lat, u.lng]);
                        }
                    }
                });
            });
        } else {
            btnGps.className = "px-3.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95";
            LiveLocationService.stopSharingLocation();
            if (window._liveGpsUnsub) {
                window._liveGpsUnsub();
                window._liveGpsUnsub = null;
            }
            Object.keys(gpsMarkers).forEach((k) => {
                leafletMap.removeLayer(gpsMarkers[k]);
            });
            gpsMarkers = {};
        }
    };

    // Event Listeners
    selectEl.onchange = (e) => focusTerritory(e.target.value);
    btnSat.onclick = () => setViewMode("satelital");
    btnImg.onclick = () => setViewMode("imagen");
    btnGps.onclick = () => toggleLiveGps();

    if (bannerBtnCroquis) {
        bannerBtnCroquis.onclick = () => {
            const target = sortedTerritorios.find((t) => String(t.numero) === String(selectedNumber));
            if (target) {
                if (window.openInteractiveMap) window.openInteractiveMap(target);
                else setViewMode("imagen");
            }
        };
    }

    // IN-PLACE TOGGLE: "Territorios Libres" button switches map polygon colors (Libre vs Ocupado)
    if (btnFreeTerritories) {
        btnFreeTerritories.onclick = () => {
            mapStyleMode = mapStyleMode === "normal" ? "disponibilidad" : "normal";
            if (mapStyleMode === "disponibilidad") {
                btnFreeTerritories.className = "px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/30 active:scale-95";
                dispoLegend?.classList.remove("hidden");
                showNotification("Modo Disponibilidad: Verde (Libre) / Rojo (Ocupado)", "info");
            } else {
                btnFreeTerritories.className = "px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm";
                dispoLegend?.classList.add("hidden");
            }
            updatePolygonStyles();
        };
    }

    // Listen to accordion open event on #details-maps to re-center & invalidate Leaflet map size
    const detailsMaps = container.querySelector("#details-maps") || mapsSection.querySelector("#details-maps");
    if (detailsMaps) {
        detailsMaps.addEventListener("toggle", () => {
            if (detailsMaps.open && leafletMap) {
                setTimeout(() => {
                    leafletMap.invalidateSize();
                    if (selectedNumber !== "all" && geoJsonLayers[selectedNumber]) {
                        const b = geoJsonLayers[selectedNumber].getBounds();
                        if (b && b.isValid()) leafletMap.fitBounds(b, { padding: [40, 40], maxZoom: 18 });
                    } else if (boundsGroup && boundsGroup.getLayers().length > 0) {
                        leafletMap.fitBounds(boundsGroup.getBounds(), { padding: [30, 30] });
                    }
                }, 200);
            }
        });
    }

    // Auto-invalidate map size on window resize / orientation change
    window.addEventListener("resize", () => {
        if (leafletMap) {
            leafletMap.invalidateSize();
            if (selectedNumber === "all" && boundsGroup && boundsGroup.getLayers().length > 0) {
                leafletMap.fitBounds(boundsGroup.getBounds(), { padding: [30, 30] });
            }
        }
    });
    window.addEventListener("orientationchange", () => {
        setTimeout(() => {
            if (leafletMap) {
                leafletMap.invalidateSize();
                if (selectedNumber === "all" && boundsGroup && boundsGroup.getLayers().length > 0) {
                    leafletMap.fitBounds(boundsGroup.getBounds(), { padding: [30, 30] });
                }
            }
        }, 200);
    });

    // Initialize Map
    initLeafletMap();
};
