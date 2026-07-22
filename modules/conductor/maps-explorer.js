import { LiveLocationService } from "../services/live-location-service.js";
import { extractMultiLeafletCoords } from "../utils/kml-parser.js";
import { showNotification } from "../utils/helpers.js";

export const renderMapsExplorer = (container, allTerritorios, openMapFn) => {
    if (!container) return;

    // Element references
    const mapsSection = container.querySelector("#interactive-maps-module");
    if (!mapsSection) return;

    // Clean up previous instance state
    if (window._fullExplorerMap) {
        try { window._fullExplorerMap.remove(); } catch (_e) {}
        window._fullExplorerMap = null;
    }
    if (window._liveGpsUnsub) {
        window._liveGpsUnsub();
        window._liveGpsUnsub = null;
    }

    // Prepare territory list sorted 1 to 22
    const sortedTerritorios = [...allTerritorios].sort(
        (a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0)
    );

    // Build Territory Options HTML
    const optionsHtml = sortedTerritorios
        .map((t) => `<option value="${t.numero}">Territorio ${t.numero} ${t.localidad ? `(${t.localidad})` : ""}</option>`)
        .join("");

    mapsSection.innerHTML = `
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

                    <!-- TERRITORIOS LIBRES BUTTON (Launches AI Sugerencias & Free Territories Modal) -->
                    <button id="btn-open-sugerencias-dispo" class="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm" title="Ver Territorios Libres y Sugerencias de la Semana">
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

                    <!-- FLOATING MAP CONTROLS -->
                    <div class="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
                        <button id="explorer-zoom-in" class="w-10 h-10 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-white flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all active:scale-90" title="Acercar"><i class="fas fa-plus text-xs"></i></button>
                        <button id="explorer-zoom-out" class="w-10 h-10 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-white flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all active:scale-90" title="Alejar"><i class="fas fa-minus text-xs"></i></button>
                        <button id="explorer-recenter" class="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-90" title="Recentar"><i class="fas fa-compress-arrows-alt text-xs"></i></button>
                    </div>
                </div>

                <!-- STATIC IMAGE VISOR (Solid White Canvas for maximum croquis clarity) -->
                <div id="full-map-image-viewer" class="absolute inset-0 w-full h-full z-20 hidden flex items-center justify-center bg-white p-4 md:p-8" style="background-color: #ffffff !important;">
                    <div id="img-holder" class="relative max-w-full max-h-full flex flex-col items-center justify-center bg-white p-3 rounded-[2rem] shadow-2xl border border-slate-200" style="background-color: #ffffff !important;">
                        <img id="territory-static-img" src="" alt="Croquis del territorio" class="max-w-full max-h-[580px] object-contain rounded-xl shadow-md hidden bg-white" style="background-color: #ffffff !important;">
                        <div id="img-empty-msg" class="text-center py-20 px-6 text-slate-500 font-bold space-y-3 bg-white" style="background-color: #ffffff !important;">
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
    let selectedNumber = "all";
    let isGpsActive = false;
    let gpsMarkers = {};
    let leafletMap = null;
    let geoJsonLayers = {};

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

    // Dynamic Tooltip Visibility: Show manzana block labels ONLY when zoomed in close (zoom >= 16) or selecting a specific territory
    const updateTooltipVisibility = () => {
        if (!leafletMap) return;
        const currentZoom = leafletMap.getZoom();
        const isZoomedIn = currentZoom >= 16;
        const isSingleSelected = selectedNumber !== "all";

        Object.keys(geoJsonLayers).forEach((numStr) => {
            const group = geoJsonLayers[numStr];
            const isThisSelected = isSingleSelected && numStr === selectedNumber;
            const showMz = isThisSelected || isZoomedIn;

            if (group && group.eachLayer) {
                group.eachLayer((poly) => {
                    const tooltip = poly.getTooltip();
                    if (tooltip) {
                        if (showMz) poly.openTooltip();
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
        const boundsGroup = L.featureGroup();

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
                } catch (e) {
                    console.error(`Error loading polygon T-${t.numero}:`, e);
                }
            }
        });

        if (boundsGroup.getLayers().length > 0) {
            leafletMap.fitBounds(boundsGroup.getBounds(), { padding: [30, 30] });
        }

        // Listen for map zoom events to toggle manzana tooltips cleanly
        leafletMap.on("zoomend", updateTooltipVisibility);
        setTimeout(() => updateTooltipVisibility(), 150);

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

        // Reset polygon stroke weights
        Object.keys(geoJsonLayers).forEach((k) => {
            const group = geoJsonLayers[k];
            if (group && group.eachLayer) {
                group.eachLayer((l) => {
                    if (l.setStyle) l.setStyle({ weight: 2.5, fillOpacity: 0.25 });
                });
            }
        });

        if (num === "all") {
            territoryBanner?.classList.add("hidden");
            const allLayers = Object.values(geoJsonLayers).filter(Boolean);
            if (allLayers.length > 0) {
                const allBounds = L.featureGroup(allLayers).getBounds();
                if (allBounds.isValid()) leafletMap.fitBounds(allBounds, { padding: [30, 30] });
            }
            updateImageViewer(null);
            updateTooltipVisibility();
            return;
        }

        const targetTerritory = sortedTerritorios.find((t) => String(t.numero) === String(num));
        const layerGroup = geoJsonLayers[String(num)];

        if (layerGroup) {
            if (layerGroup.eachLayer) {
                layerGroup.eachLayer((l) => {
                    if (l.setStyle) l.setStyle({ weight: 4.5, fillOpacity: 0.5 });
                });
            }
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
        updateTooltipVisibility();
    };

    // Update Image Viewer for selected territory
    const updateImageViewer = (territory) => {
        if (!territory || !territory.imagen) {
            staticImg.classList.add("hidden");
            emptyMsg.classList.remove("hidden");
            emptyMsg.querySelector("p").textContent = territory 
                ? `Sin imagen almacenada para el Territorio ${territory.numero}`
                : `Selecciona un territorio para ver su croquis en imagen`;
        } else {
            staticImg.src = territory.imagen;
            staticImg.classList.remove("hidden");
            emptyMsg.classList.add("hidden");
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

    // "Territorios Libres" button opens AI Sugerencias & Free Territories Modal directly
    if (btnFreeTerritories) {
        btnFreeTerritories.onclick = async () => {
            try {
                const { openSugeridorModal } = await import("../admin/ai-sugeridor.js");
                openSugeridorModal(window._progCache?.programa || { dias: [] });
            } catch (err) {
                console.error("Error al abrir Territorios Libres:", err);
                showNotification("Error cargando Territorios Libres", "error");
            }
        };
    }

    // Auto-invalidate map size on window resize / orientation change
    window.addEventListener("resize", () => {
        if (leafletMap) leafletMap.invalidateSize();
    });
    window.addEventListener("orientationchange", () => {
        setTimeout(() => {
            if (leafletMap) leafletMap.invalidateSize();
        }, 200);
    });

    // Initialize Map
    initLeafletMap();
};
