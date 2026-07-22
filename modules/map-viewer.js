import { showNotification } from "./utils/helpers.js";

export const MapViewer = {
    render: (container, territory, options = {}) => {
        const { numero, manzanas, imagen } = territory;

        const modal = document.getElementById("modal-container");
        if (modal) {
            modal.classList.remove("hidden");
            modal.classList.add("flex");
            modal.style.zIndex = "10001"; // Superior al ReceptionHub (9999)
        }

        let isInteractive = options.mode === "satelital";
        let leafletMap = null;
        let userMarker = null;

        const CATEGORIES = {
            info: {
                name: "General 📌",
                color: "#4f46e5", // Indigo
                icon: "fa-comment-dots",
                bgLight: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
            },
            danger: {
                name: "Peligro ⚠️ (perros, riesgos)",
                color: "#f43f5e", // Rose
                icon: "fa-exclamation-triangle",
                bgLight: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
            },
            ban: {
                name: "No visitar 🚫",
                color: "#ef4444", // Red
                icon: "fa-ban",
                bgLight: "bg-red-500/10 text-red-600 dark:text-red-455 border-red-500/20",
            },
            key: {
                name: "P. Pública ⭐",
                color: "#fbbf24", // Amber
                icon: "fa-star",
                bgLight: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
            },
            revisit: {
                name: "Testigo 🙋‍♂️",
                color: "#10b981", // Emerald
                icon: "fa-user-check",
                bgLight: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
            },
            revisit_item: {
                name: "Revisita 🏠",
                color: "#8b5cf6", // Purple
                icon: "fa-home",
                bgLight: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
            },
            bible_study: {
                name: "Estudio bíblico 📖",
                color: "#3b82f6", // Blue
                icon: "fa-book-open",
                bgLight: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
            },
        };

        container.innerHTML = `
            <div class="absolute inset-0 z-[9999] flex flex-col h-full w-full animate-fade-in bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-white/10">
                
                <!-- GLASS HEADER -->
                <div class="z-40 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 p-4 m-4 sm:m-6 bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] absolute top-0 left-0 right-0 sm:right-auto sm:max-w-xl transition-colors duration-300">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-indigo-600 dark:bg-indigo-500 rounded-2xl flex items-center justify-center text-xl shadow-[0_4px_20px_rgba(79,70,229,0.3)] border border-white/20 shrink-0">
                            <i class="fas fa-map-marked-alt text-white text-sm animate-float"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1 text-sm sm:text-base">
                                Territorio #${numero}${territory.localidad ? ` ${territory.localidad}` : ""}
                            </h3>
                            <p class="text-[9px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-[0.2em] leading-none">
                                Manzanas: ${
                                    String(manzanas || "")
                                        .split(/[,;/]/)
                                        .map((m) => m.trim())
                                        .filter(Boolean).length
                                }
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <!-- VIEW TOGGLE BUTTON -->
                        <button id="btn-toggle-view" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white rounded-xl text-[8.5px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 border border-white/10 shadow-lg shadow-indigo-600/10 dark:shadow-indigo-500/10 group active:scale-95">
                            <i class="fas fa-layer-group group-hover:rotate-12 transition-transform duration-500"></i> <span id="toggle-view-text">${isInteractive ? "Ver Croquis" : "Ver Satélite"}</span>
                        </button>
                        <button id="close-map" class="w-10 h-10 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center justify-center group border border-rose-500/10 hover:border-transparent shrink-0">
                            <i class="fas fa-times group-hover:rotate-90 transition-transform"></i>
                        </button>
                    </div>
                </div>

                <div class="flex-1 min-w-0 w-full relative overflow-hidden bg-[#0f172a]">
                    
                    <!-- STATIC IMAGE VIEW (PNG VISOR) -->
                    <div id="static-image-viewer" class="absolute inset-0 w-full h-full flex items-center justify-center p-6 transition-all duration-500 ${isInteractive ? "opacity-0 invisible z-20" : "opacity-100 visible z-30"} overflow-hidden bg-slate-200 dark:bg-slate-700/40 z-30 touch-none">
                        <div id="map-img-container" class="relative w-full h-full max-w-full max-h-full flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden" style="max-height:100%;">
                            <!-- Spinner/Skeleton state -->
                            <div id="map-loader-ui" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 z-10 transition-opacity duration-300">
                                <div class="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4 shadow-sm"></div>
                                <p class="font-black tracking-[0.2em] uppercase text-[10px] text-slate-500 animate-pulse">Descargando mapa estático...</p>
                            </div>
                        </div>
                    </div>

                    <!-- INTERACTIVE MAP VIEW (LEAFLET VISOR) -->
                    <div id="interactive-map-viewer" class="absolute inset-0 w-full h-full flex transition-all duration-500 ${isInteractive ? "opacity-100 visible z-30" : "opacity-0 invisible z-20"}">
                        <div id="xolvy-leaflet-map-viewer" class="w-full h-full"></div>
                        
                        <!-- FLOATING BANNER FOR ADD NOTE MODE -->
                        <div id="xolvy-add-note-banner" class="hidden absolute top-28 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-4 py-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg border border-indigo-400/20 text-[10px] font-black uppercase tracking-wider pointer-events-auto">
                            <i class="fas fa-map-marker-alt animate-pulse"></i>
                            <span>Toca en el mapa para colocar la nota</span>
                            <button id="btn-cancel-add-note" class="ml-2 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all text-[8px] font-bold uppercase tracking-widest active:scale-95">
                                Cancelar
                            </button>
                        </div>
                        
                        <!-- SLIDING NOTES PANEL -->
                        <div id="xolvy-notes-panel" class="absolute top-28 right-4 bottom-28 w-80 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl z-[1001] transition-transform duration-300 translate-x-[340px] flex flex-col overflow-hidden pointer-events-auto">
                            <header class="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-black/20 shrink-0">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-list-ul text-indigo-500 animate-pulse"></i>
                                    <h4 class="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-white">Notas de Campo</h4>
                                </div>
                                <button id="xolvy-notes-panel-close" class="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors">
                                    <i class="fas fa-times text-xs"></i>
                                </button>
                            </header>
                            <div id="xolvy-notes-list" class="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
                                <!-- Dynamic notes list items go here -->
                            </div>
                        </div>

                        <!-- FLOATING CONTROLS (bottom-right inside viewer) -->
                        <div class="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
                            <!-- Toggle Notes list -->
                            <button id="xolvy-notes-list-toggle"
                                class="w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all hover:bg-white/10 active:scale-90 shadow-2xl border border-white/15"
                                style="background: rgba(10,15,30,0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
                                title="Lista de Notas">
                                <i class="fas fa-list-ul text-sm"></i>
                            </button>
                            <!-- Add note pin placement trigger -->
                            <button id="xolvy-add-note-btn"
                                class="w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all hover:bg-white/10 active:scale-90 shadow-2xl border border-white/15 relative"
                                style="background: rgba(10,15,30,0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
                                title="Agregar Nota 📌 (Haz clic en el mapa)">
                                <i class="fas fa-map-marker-alt text-sm"></i>
                                <span class="absolute top-1 right-1 w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center text-[7px] font-black text-white shadow-md border border-white/20">+</span>
                            </button>
                            <div class="flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/15"
                                 style="background: rgba(10,15,30,0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
                                <button id="xolvy-zoom-in-viewer"
                                    class="w-11 h-11 flex items-center justify-center text-white hover:text-indigo-300 transition-all hover:bg-white/10 active:scale-90 border-b border-white/10"
                                    title="Acercar">
                                    <i class="fas fa-plus text-sm font-black"></i>
                                </button>
                                <button id="xolvy-zoom-out-viewer"
                                    class="w-11 h-11 flex items-center justify-center text-white hover:text-indigo-300 transition-all hover:bg-white/10 active:scale-90"
                                    title="Alejar">
                                    <i class="fas fa-minus text-sm font-black"></i>
                                </button>
                            </div>
                            <!-- Recentrar -->
                            <button id="xolvy-recenter-viewer"
                                class="w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all hover:bg-white/10 active:scale-90 shadow-2xl border border-white/15"
                                style="background: rgba(10,15,30,0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
                                title="Recentrar mapa">
                                <i class="fas fa-compress-arrows-alt text-sm"></i>
                            </button>
                            <!-- Mi ubicación -->
                            <button id="xolvy-locate-viewer"
                                class="w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all active:scale-90 shadow-2xl border border-indigo-400/30 hover:scale-110"
                                style="background: linear-gradient(135deg,#4f46e5,#6366f1); box-shadow: 0 4px 20px rgba(79,70,229,0.45);"
                                title="Mi Ubicación">
                                <i class="fas fa-location-arrow text-sm"></i>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        `;

        const btnToggle = container.querySelector("#btn-toggle-view");
        const mapContainer = container.querySelector("#map-img-container");
        const loaderUi = container.querySelector("#map-loader-ui");
        const mapUrl = imagen || `./assets/maps/T-${numero}.png`;
        const img = new Image();
        img.onload = () => {
            img.id = "map-img-element";
            img.className =
                "block max-w-full max-h-full object-contain transition-all duration-200 ease-out origin-center animate-fade-in";
            img.style.transform = "scale(1) translate(0px, 0px)";
            img.style.background = "#fff";
            mapContainer.appendChild(img);
            if (loaderUi) {
                loaderUi.style.opacity = "0";
                setTimeout(() => loaderUi.remove(), 300);
            }
        };
        img.onerror = () => {
            mapContainer.innerHTML =
                '<div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800"><i class="fas fa-image text-6xl shadow-inner text-slate-600 dark:text-slate-400 mb-4"></i><p class="font-black tracking-[0.2em] uppercase text-xs text-slate-500">Sin Imagen Disponible</p></div>';
        };
        img.src = mapUrl;

        const initLeafletMap = async () => {
            const L = await import("./utils/kml-parser.js").then((m) => m.waitForLeaflet());
            const extractMultiLeafletCoords = await import("./utils/kml-parser.js").then(
                (m) => m.extractMultiLeafletCoords,
            );
            if (!L) return;

            let isAddingNoteMode = false;
            let openAddNoteDialog = null;
            let addNoteBtn = null;

            const allItems = extractMultiLeafletCoords(territory);
            if (allItems.length === 0) {
                showNotification("Este territorio no posee coordenadas válidas", "warning");
                return;
            }

            const mapEl = container.querySelector("#xolvy-leaflet-map-viewer");
            if (!mapEl) return;

            leafletMap = L.map(mapEl, { zoomControl: false, scrollWheelZoom: true });

            L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
                maxZoom: 20,
                attribution: "&copy; Google Maps",
            }).addTo(leafletMap);

            const POLY_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
            const layerGroup = L.featureGroup().addTo(leafletMap);

            allItems.forEach((item, index) => {
                const coords = item.coords || item;
                const labelText = (item.nombre || `Mz. ${index + 1}`).split("(")[0].trim();
                const accentColor = POLY_COLORS[index % POLY_COLORS.length];

                const poly = L.polygon(coords, {
                    color: accentColor,
                    weight: 2.5,
                    fillColor: accentColor,
                    fillOpacity: 0.22,
                    lineCap: "round",
                    lineJoin: "round",
                }).addTo(layerGroup);

                poly.on("mouseover", function () {
                    this.setStyle({ fillOpacity: 0.42, weight: 3.5 });
                });
                poly.on("mouseout", function () {
                    this.setStyle({ fillOpacity: 0.22, weight: 2.5 });
                });

                poly.on("click", (e) => {
                    if (isAddingNoteMode && openAddNoteDialog) {
                        e.originalEvent?.stopPropagation();
                        openAddNoteDialog(e.latlng);
                    }
                });

                poly.bindTooltip(labelText, {
                    permanent: true,
                    direction: "center",
                    className: "xolvy-mz-label",
                }).openTooltip();
            });

            if (layerGroup.getLayers().length > 0) {
                leafletMap.fitBounds(layerGroup.getBounds(), { padding: [80, 80] });
            }
            setTimeout(() => {
                leafletMap.invalidateSize();
            }, 200);

            // Bind controls
            container.querySelector("#xolvy-zoom-in-viewer").onclick = () => leafletMap.zoomIn();
            container.querySelector("#xolvy-zoom-out-viewer").onclick = () => leafletMap.zoomOut();
            container.querySelector("#xolvy-recenter-viewer").onclick = () => {
                if (layerGroup.getLayers().length > 0)
                    leafletMap.fitBounds(layerGroup.getBounds(), { padding: [80, 80] });
            };

            const doLocate = () => {
                leafletMap.locate({ setView: true, maxZoom: 19 });
            };
            container.querySelector("#xolvy-locate-viewer").onclick = doLocate;

            leafletMap.on("locationfound", (e) => {
                if (userMarker) {
                    userMarker.setLatLng(e.latlng);
                } else {
                    userMarker = L.marker(e.latlng, {
                        icon: L.divIcon({
                            className: "",
                            html: '<div class="xolvy-gps-dot"></div>',
                            iconSize: [18, 18],
                            iconAnchor: [9, 9],
                        }),
                    }).addTo(leafletMap);
                }
                leafletMap.flyTo(e.latlng, 19, { animate: true, duration: 1.5 });
            });

            leafletMap.on("locationerror", () => {
                showNotification("No se pudo obtener tu ubicación actual", "error");
            });

            // Stop click and scroll propagation on controls and sidebar panel to prevent map-click triggers
            const floatingControls = container.querySelector(".absolute.bottom-6.right-4");
            const panel = container.querySelector("#xolvy-notes-panel");
            if (floatingControls) {
                L.DomEvent.disableClickPropagation(floatingControls);
                L.DomEvent.disableScrollPropagation(floatingControls);
            }
            if (panel) {
                L.DomEvent.disableClickPropagation(panel);
                L.DomEvent.disableScrollPropagation(panel);
            }

            // Sliding panel toggling
            const listToggleBtn = container.querySelector("#xolvy-notes-list-toggle");
            const panelCloseBtn = container.querySelector("#xolvy-notes-panel-close");
            if (listToggleBtn && panel) {
                listToggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    panel.classList.toggle("translate-x-[340px]");
                };
            }
            if (panelCloseBtn && panel) {
                panelCloseBtn.onclick = (e) => {
                    e.stopPropagation();
                    panel.classList.add("translate-x-[340px]");
                };
            }

            // --- Map Observations POI System (God-level interactive map notes) ---
            if (!document.getElementById("leaflet-custom-styles")) {
                const styleNode = document.createElement("style");
                styleNode.id = "leaflet-custom-styles";
                styleNode.innerHTML = `
                    .swal2-container {
                        z-index: 100020 !important;
                    }
                    .xolvy-map-popup .leaflet-popup-content-wrapper {
                        background: rgba(255, 255, 255, 0.95) !important;
                        backdrop-filter: blur(16px);
                        -webkit-backdrop-filter: blur(16px);
                        border: 1px solid rgba(0, 0, 0, 0.08);
                        border-radius: 1.5rem;
                        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
                    }
                    .dark .xolvy-map-popup .leaflet-popup-content-wrapper {
                        background: rgba(15, 23, 42, 0.95) !important;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        color: #fff !important;
                    }
                    .xolvy-map-popup .leaflet-popup-tip {
                        background: rgba(255, 255, 255, 0.95) !important;
                    }
                    .dark .xolvy-map-popup .leaflet-popup-tip {
                        background: rgba(15, 23, 42, 0.95) !important;
                    }
                    .xolvy-gps-dot {
                        width: 14px;
                        height: 14px;
                        background: #3b82f6;
                        border: 2px solid #ffffff;
                        border-radius: 50%;
                        box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
                    }
                `;
                document.head.appendChild(styleNode);
            }

            // Global delete function
            window.deleteMapObservation = async (docId, _territoryNum) => {
                const result = await window.XolvyAlert.fire({
                    title: "¿Eliminar Nota?",
                    text: "Esta nota geolocalizada se eliminará permanentemente del mapa.",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Sí, eliminar",
                    cancelButtonText: "Cancelar",
                    confirmButtonColor: "#ef4444",
                    cancelButtonColor: "#6b7280",
                    customClass: {
                        popup: "rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 text-slate-800 dark:text-white font-sans",
                        title: "text-base font-black uppercase tracking-tight",
                        confirmButton: "rounded-xl px-4 py-2 font-bold uppercase tracking-widest text-[9px]",
                        cancelButton: "rounded-xl px-4 py-2 font-bold uppercase tracking-widest text-[9px]",
                    },
                });
                if (result.isConfirmed) {
                    try {
                        const { doc, deleteDoc } = await import("firebase/firestore");
                        const { db } = await import("../firebase-config.js");
                        await deleteDoc(doc(db, "bitacora_observaciones", docId));
                        showNotification("Nota eliminada con éxito", "success");
                        await fetchAndRenderMapObservations();
                    } catch (e) {
                        console.error("Error deleting map observation:", e);
                        showNotification("Error al eliminar la nota", "error");
                    }
                }
            };

            // Global zoom/pan to node function
            window.flyToMapObservation = (lat, lng) => {
                if (leafletMap) {
                    leafletMap.flyTo([lat, lng], 19, { animate: true, duration: 1.5 });
                }
            };

            // Global speech listener dictation trigger
            window.startXolvyVoiceDictation = (textareaId, micBtnId) => {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    showNotification("Reconocimiento de voz no soportado en este navegador.", "warning");
                    return;
                }
                const rec = new SpeechRecognition();
                rec.lang = "es-ES";
                rec.interimResults = false;
                rec.maxAlternatives = 1;

                const mic = document.getElementById(micBtnId);
                const originalContent = mic.innerHTML;
                if (mic) {
                    mic.innerHTML =
                        '<i class="fas fa-circle-notch animate-spin text-red-500"></i> <span class="text-[8px] text-red-500 font-extrabold animate-pulse">Escuchando...</span>';
                    mic.classList.add("border-red-500/30", "bg-red-500/10");
                }

                rec.onresult = (e) => {
                    const text = e.results[0][0].transcript;
                    const textarea = document.getElementById(textareaId);
                    if (textarea) {
                        textarea.value = `${textarea.value} ${text}`.trim();
                    }
                    showNotification("Voz dictada correctamente", "success");
                };

                rec.onend = () => {
                    if (mic) {
                        mic.innerHTML = originalContent;
                        mic.classList.remove("border-red-500/30", "bg-red-500/10");
                    }
                };

                rec.onerror = (e) => {
                    console.error("Speech recognition error:", e);
                    showNotification("Error en reconocimiento de voz", "error");
                    if (mic) {
                        mic.innerHTML = originalContent;
                        mic.classList.remove("border-red-500/30", "bg-red-500/10");
                    }
                };

                rec.start();
            };

            const fetchAndRenderMapObservations = async () => {
                try {
                    const { collection, query, where, getDocs } = await import("firebase/firestore");
                    const { db } = await import("../firebase-config.js");

                    const q = query(
                        collection(db, "bitacora_observaciones"),
                        where("territorio_id", "==", String(numero)),
                    );
                    const snap = await getDocs(q);

                    if (window._mapObservationMarkers) {
                        window._mapObservationMarkers.forEach((m) => m.remove());
                    }
                    window._mapObservationMarkers = [];

                    const notes = [];

                    snap.docs.forEach((docSnap) => {
                        const data = docSnap.data();
                        if (data.lat && data.lng) {
                            const latlng = [data.lat, data.lng];
                            const dateStr = data.fecha
                                ? new Date(data.fecha).toLocaleDateString("es-ES", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                  })
                                : "—";
                            const conductor = data.conductor || "Conductor";
                            const note = data.nota || "Sin observaciones";
                            const category = data.category || "info";
                            const pubCargo = data.publicador_cargo || "";
                            const estudiante = data.estudiante || "";

                            notes.push({
                                id: docSnap.id,
                                lat: data.lat,
                                lng: data.lng,
                                conductor,
                                dateStr,
                                category,
                                nota: note,
                                pubCargo,
                                estudiante,
                            });

                            const catCfg = CATEGORIES[category] || CATEGORIES.info;

                            const extraInfoHtml = (pubCargo || estudiante) ? `
                                <div class="bg-indigo-50/50 dark:bg-white/5 p-2 rounded-lg border border-indigo-100 dark:border-white/5 text-[8px] space-y-0.5 mt-1">
                                    ${pubCargo ? `<div><span class="font-black uppercase text-indigo-600 dark:text-indigo-400">Publicador:</span> <span class="font-bold">${pubCargo}</span></div>` : ""}
                                    ${estudiante ? `<div><span class="font-black uppercase text-indigo-600 dark:text-indigo-400">Estudiante:</span> <span class="font-bold">${estudiante}</span></div>` : ""}
                                </div>
                            ` : "";

                            const marker = L.marker(latlng, {
                                icon: L.divIcon({
                                    className: "",
                                    html: `
                                        <div class="relative flex items-center justify-center group/pin">
                                            <div class="absolute w-8 h-8 rounded-full animate-ping" style="background-color: ${catCfg.color}22;"></div>
                                            <div class="w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[9px] text-white hover:scale-115 transition-transform cursor-pointer" style="background-color: ${catCfg.color};">
                                                <i class="fas ${catCfg.icon}"></i>
                                            </div>
                                        </div>
                                    `,
                                    iconSize: [28, 28],
                                    iconAnchor: [14, 14],
                                }),
                            }).addTo(leafletMap);

                            marker.bindPopup(
                                `
                                <div class="p-3 space-y-2.5 max-w-[220px] font-sans text-slate-800 dark:text-slate-200">
                                    <div class="flex items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-1.5">
                                        <span class="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">${conductor}</span>
                                        <span class="text-[8px] text-slate-500 dark:text-slate-400 font-bold">${dateStr}</span>
                                    </div>
                                    <div class="flex items-center">
                                        <span class="px-2 py-0.5 rounded text-[7px] font-black uppercase border ${catCfg.bgLight}">
                                            ${catCfg.name}
                                        </span>
                                    </div>
                                    ${extraInfoHtml}
                                    <p class="text-[10px] font-bold leading-normal text-slate-700 dark:text-slate-355">"${note}"</p>
                                    <button onclick="window.deleteMapObservation('${docSnap.id}', '${conductor}')" class="w-full mt-2 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 text-[8px] font-black uppercase tracking-wider rounded-lg border border-rose-500/10 transition-all flex items-center justify-center gap-1">
                                        <i class="fas fa-trash-alt"></i> Eliminar Nota
                                    </button>
                                </div>
                            `,
                                {
                                    className: "xolvy-map-popup",
                                },
                            );

                            window._mapObservationMarkers.push(marker);
                        }
                    });

                    // Update sidebar notes list
                    const listEl = container.querySelector("#xolvy-notes-list");
                    if (listEl) {
                        if (notes.length === 0) {
                            listEl.innerHTML = `
                                <div class="text-center py-12 opacity-40">
                                    <i class="fas fa-comment-slash text-xl mb-2"></i>
                                    <p class="text-[9px] font-black uppercase tracking-wider">Sin notas en este mapa</p>
                                </div>
                            `;
                        } else {
                            listEl.innerHTML = notes
                                .map((n) => {
                                    const catCfg = CATEGORIES[n.category] || CATEGORIES.info;
                                    const extraSide = (n.pubCargo || n.estudiante) ? `
                                        <div class="text-[8px] text-slate-500 font-medium">
                                            ${n.pubCargo ? `Pub: <b>${n.pubCargo}</b> ` : ""}${n.estudiante ? `Est: <b>${n.estudiante}</b>` : ""}
                                        </div>
                                    ` : "";
                                    return `
                                    <div class="p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl hover:border-indigo-500/30 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-all cursor-pointer space-y-1.5"
                                         onclick="window.flyToMapObservation(${n.lat}, ${n.lng})">
                                        <div class="flex justify-between items-center gap-2">
                                            <span class="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">${n.conductor}</span>
                                            <span class="text-[8px] text-slate-400 font-bold">${n.dateStr}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${catCfg.bgLight}">
                                                ${catCfg.name}
                                            </span>
                                        </div>
                                        ${extraSide}
                                        <p class="text-[10px] font-bold text-slate-700 dark:text-slate-350 leading-snug line-clamp-3">"${n.nota}"</p>
                                    </div>
                                `;
                                })
                                .join("");
                        }
                    }
                } catch (err) {
                    console.error("Error loading map observations:", err);
                }
            };

            const addNoteBanner = container.querySelector("#xolvy-add-note-banner");
            const cancelBannerBtn = container.querySelector("#btn-cancel-add-note");

            const resetAddNoteMode = () => {
                isAddingNoteMode = false;
                if (addNoteBtn) {
                    addNoteBtn.style.background = "rgba(10,15,30,0.65)";
                    addNoteBtn.style.borderColor = "rgba(255,255,255,0.15)";
                    addNoteBtn.innerHTML = `
                        <i class="fas fa-map-marker-alt text-sm"></i>
                        <span class="absolute top-1 right-1 w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center text-[7px] font-black text-white shadow-md border border-white/20">+</span>
                    `;
                }
                if (mapEl) {
                    mapEl.style.cursor = "";
                    mapEl.classList.remove("adding-note-mode");
                }
                if (addNoteBanner) {
                    addNoteBanner.classList.add("hidden");
                }
            };

            if (cancelBannerBtn) {
                cancelBannerBtn.onclick = (e) => {
                    e.stopPropagation();
                    resetAddNoteMode();
                };
            }

            openAddNoteDialog = async (latlng) => {
                resetAddNoteMode();

                const userRole = window.XolvyApp?.user?.role || "Conductor";
                const isAdmin = userRole === "Administrador" || userRole === "SuperAdmin";
                const isConductor = userRole === "Conductor";
                const isPublicador = userRole === "Publicador";

                let catOptions = `<option value="info" selected>📌 General</option>
                    <option value="danger">⚠️ Peligro (perros, riesgos)</option>`;

                if (isAdmin || isConductor) {
                    catOptions += `<option value="ban">🚫 No visitar</option>`;
                }
                if (isAdmin) {
                    catOptions += `<option value="key">⭐ P. Pública</option>`;
                }

                catOptions += `
                    <option value="revisit">🙋‍♂️ Testigo</option>
                    <option value="revisit_item">🏠 Revisita</option>
                    <option value="bible_study">📖 Estudio bíblico</option>`;

                const alertResult = await window.XolvyAlert.fire({
                    title: "Añadir Nota Geolocalizada",
                    html: `
                        <div class="space-y-4 text-left font-sans">
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Categoría de la Nota</label>
                                <select id="xolvy-note-category" onchange="window.toggleExtraNoteFields(this.value)" class="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white px-3 py-2.5 outline-none focus:border-indigo-500">
                                    ${catOptions}
                                </select>
                            </div>

                            <div id="xolvy-extra-fields" class="hidden space-y-3 p-3 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                                <div class="space-y-1">
                                    <label class="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Publicador a Cargo</label>
                                    <input type="text" id="xolvy-pub-cargo" placeholder="Nombre del publicador" class="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-semibold px-3 py-2 outline-none">
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Nombre del Estudiante / Persona</label>
                                    <input type="text" id="xolvy-estudiante" placeholder="Nombre del estudiante" class="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-semibold px-3 py-2 outline-none">
                                </div>
                            </div>

                            <div class="space-y-1.5 relative">
                                <div class="flex justify-between items-center mb-1">
                                    <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Contenido de la Nota</label>
                                    <button id="xolvy-dictate-btn" onclick="window.startXolvyVoiceDictation('xolvy-note-textarea', 'xolvy-dictate-btn')" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-extrabold flex items-center gap-1 transition-colors px-2 py-1 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" type="button" title="Dictar por voz">
                                        <i class="fas fa-microphone text-[10px]"></i> <span class="text-[8px]">Dictar</span>
                                    </button>
                                </div>
                                <textarea id="xolvy-note-textarea" placeholder="Ej: Portón de madera, horario de visita, etc..." class="w-full min-h-[80px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white px-3 py-2.5 outline-none focus:border-indigo-500" style="resize: none;"></textarea>
                            </div>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: "Guardar",
                    cancelButtonText: "Cancelar",
                    confirmButtonColor: "#4f46e5",
                    cancelButtonColor: "#ef4444",
                    customClass: {
                        popup: "rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 text-slate-800 dark:text-white font-sans",
                        title: "text-base font-black uppercase tracking-tight",
                        confirmButton: "rounded-xl px-4 py-2 font-bold uppercase tracking-widest text-[9px]",
                        cancelButton: "rounded-xl px-4 py-2 font-bold uppercase tracking-widest text-[9px]",
                    },
                    didOpen: () => {
                        window.toggleExtraNoteFields = (val) => {
                            const container = document.getElementById("xolvy-extra-fields");
                            if (container) {
                                if (val === "revisit_item" || val === "bible_study") {
                                    container.classList.remove("hidden");
                                } else {
                                    container.classList.add("hidden");
                                }
                            }
                        };
                    },
                    preConfirm: () => {
                        const category = document.getElementById("xolvy-note-category").value;
                        const note = document.getElementById("xolvy-note-textarea").value;
                        const pubCargo = document.getElementById("xolvy-pub-cargo")?.value?.trim() || "";
                        const estudiante = document.getElementById("xolvy-estudiante")?.value?.trim() || "";

                        if (!note || note.trim().length === 0) {
                            window.XolvyAlert.showValidationMessage("Por favor escribe el contenido de la nota");
                            return false;
                        }
                        return { category, note: note.trim(), publicador_cargo: pubCargo, estudiante };
                    },
                });

                const formValues = alertResult.value;

                if (formValues) {
                    try {
                        const { collection, addDoc, Timestamp } = await import("firebase/firestore");
                        const { db } = await import("../firebase-config.js");

                        const user = window.XolvyApp?.user;
                        const authUser = (await import("../firebase-config.js")).auth.currentUser;
                        const conductorName = user?.nombre || authUser?.displayName || authUser?.email || "Conductor";

                        await addDoc(collection(db, "bitacora_observaciones"), {
                            territorio_id: String(numero),
                            conductor: conductorName,
                            category: formValues.category,
                            nota: formValues.note,
                            publicador_cargo: formValues.publicador_cargo || "",
                            estudiante: formValues.estudiante || "",
                            fecha: new Date().toISOString(),
                            timestamp: Timestamp.now(),
                            lat: latlng.lat,
                            lng: latlng.lng,
                        });

                        showNotification("Observación guardada en el mapa", "success");
                        await fetchAndRenderMapObservations();
                    } catch (err) {
                        console.error("Error saving map observation:", err);
                        showNotification("Error al guardar la observación", "error");
                    }
                }
            };

            await fetchAndRenderMapObservations();

            addNoteBtn = container.querySelector("#xolvy-add-note-btn");

            if (addNoteBtn) {
                addNoteBtn.onclick = (e) => {
                    e.stopPropagation();
                    isAddingNoteMode = !isAddingNoteMode;
                    if (isAddingNoteMode) {
                        addNoteBtn.style.background = "rgba(79, 70, 229, 0.45)";
                        addNoteBtn.style.borderColor = "rgba(129, 140, 248, 0.6)";
                        addNoteBtn.innerHTML =
                            '<i class="fas fa-map-marker-alt text-sm text-indigo-400 animate-pulse"></i>';
                        if (mapEl) {
                            mapEl.style.cursor = "crosshair";
                            mapEl.classList.add("adding-note-mode");
                        }
                        if (addNoteBanner) {
                            addNoteBanner.classList.remove("hidden");
                        }
                        showNotification(
                            "Modo agregar nota activo. Haz clic en el mapa o manzana para colocar el pin.",
                            "info",
                        );
                    } else {
                        resetAddNoteMode();
                    }
                };
            }

            leafletMap.on("click", async (e) => {
                if (!isAddingNoteMode) return;
                // Ignore clicks on popups, markers, custom controls, or side panels
                if (
                    e.originalEvent.target.closest(".leaflet-popup") ||
                    e.originalEvent.target.closest(".leaflet-marker-icon") ||
                    e.originalEvent.target.closest(".pointer-events-auto") ||
                    e.originalEvent.target.closest("#xolvy-notes-panel")
                )
                    return;

                openAddNoteDialog(e.latlng);
            });
        };

        if (isInteractive) {
            initLeafletMap();
        }

        window.addEventListener("resize", () => {
            if (leafletMap) leafletMap.invalidateSize();
        });
        window.addEventListener("orientationchange", () => {
            setTimeout(() => {
                if (leafletMap) leafletMap.invalidateSize();
            }, 200);
        });

        if (btnToggle) {
            btnToggle.onclick = async () => {
                const staticVis = container.querySelector("#static-image-viewer");
                const interVis = container.querySelector("#interactive-map-viewer");
                const btnText = container.querySelector("#toggle-view-text");

                if (!staticVis || !interVis) return;

                if (isInteractive) {
                    // Switch to Static Map
                    isInteractive = false;

                    interVis.classList.remove("opacity-100", "visible", "z-30");
                    interVis.classList.add("opacity-0", "invisible", "z-20");

                    staticVis.classList.remove("opacity-0", "invisible", "z-20");
                    staticVis.classList.add("opacity-100", "visible", "z-30");

                    if (btnText) btnText.textContent = "Ver Mapa Satelital";
                } else {
                    // Switch to Interactive Map
                    isInteractive = true;

                    staticVis.classList.remove("opacity-100", "visible", "z-30");
                    staticVis.classList.add("opacity-0", "invisible", "z-20");

                    interVis.classList.remove("opacity-0", "invisible", "z-20");
                    interVis.classList.add("opacity-100", "visible", "z-30");

                    if (btnText) btnText.textContent = "Ver Croquis";

                    if (!leafletMap) {
                        await initLeafletMap();
                    } else {
                        setTimeout(() => {
                            leafletMap.invalidateSize();
                        }, 50);
                    }
                }
            };
        }

        document.getElementById("close-map").onclick = () => {
            if (leafletMap) {
                try {
                    leafletMap.remove();
                } catch (_e) {}
            }
            const modal = document.getElementById("modal-container");
            if (modal) {
                modal.style.zIndex = "";
                modal.classList.add("hidden");
                modal.classList.remove("flex");
            }
            container.innerHTML = "";
        };
    },
    renderGlobal: (container, allTerritorios) => {
        const modal = document.getElementById("modal-container");
        if (modal) {
            modal.classList.remove("hidden");
            modal.classList.add("flex");
            modal.style.zIndex = "10001";
        }
        container.innerHTML = `
            <div class="absolute inset-0 z-[9999] flex flex-col h-full w-full animate-fade-in bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10">
                <div class="absolute top-6 left-6 right-6 z-40 flex justify-between items-center p-4 bg-white/70 dark:bg-gray-900/60 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-white/5 shadow-2xl">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg border border-white/20">
                            <i class="fas fa-satellite text-slate-800 dark:text-slate-100 text-xl"></i>
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

                <div id="global-map-container" class="flex-1 min-w-0 w-full bg-[#0f172a] relative">
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

        document.getElementById("close-global-map").onclick = () => {
            const modal = document.getElementById("modal-container");
            if (modal) {
                modal.style.zIndex = "";
                modal.classList.add("hidden");
            }
            container.innerHTML = "";
        };

        const initMap = () => {
            const mapEl = document.getElementById("global-map-container");
            if (!mapEl || !window.google) return;

            const map = new google.maps.Map(mapEl, {
                center: { lat: -2.1894, lng: -79.8891 },
                zoom: 15,
                mapTypeId: "satellite",
                tilt: 45,
                disableDefaultUI: true,
                gestureHandling: "greedy",
            });

            const bounds = new google.maps.LatLngBounds();

            // Add all territories
            allTerritorios.forEach((t) => {
                if (t.geojson) {
                    try {
                        const features = map.data.addGeoJson(t.geojson);
                        features.forEach((f) => {
                            f.setProperty("numero", t.numero);
                            f.setProperty("id", t.id);
                            f.setProperty("manzanas", t.manzanas);

                            // Extract specific manzana from GeoJSON if available
                            const explicitMz =
                                f.getProperty("name") || f.getProperty("manzana") || f.getProperty("label");
                            if (explicitMz) f.setProperty("mz_label", explicitMz);

                            const geo = f.getGeometry();
                            if (geo.getType() === "Polygon") {
                                geo.getArray().forEach((path) => {
                                    path.getArray().forEach((latlng) => bounds.extend(latlng));
                                });
                            }
                        });
                    } catch (e) {
                        console.error(`Error loading GeoJSON for T-${t.numero}:`, e);
                    }
                }

                if (t.referencias) {
                    t.referencias.forEach((ref) => {
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
                                strokeColor: "#ffffff",
                            },
                        });
                    });
                }
            });

            // GPS Real-time Tracking
            let userMarker = null;
            if (navigator.geolocation) {
                navigator.geolocation.watchPosition(
                    (pos) => {
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
                                    strokeColor: "#ffffff",
                                },
                            });
                        } else {
                            userMarker.setPosition(userCoords);
                        }
                    },
                    (err) => console.warn("GPS Access Revoked or Error:", err),
                    {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 0,
                    },
                );
            }

            map.data.setStyle((feature) => {
                if (feature.getGeometry().getType() === "LineString") {
                    return {
                        strokeWeight: 4,
                        strokeColor: "#f43f5e",
                        cursor: "pointer",
                    };
                }
                return {
                    fillColor: "#6366f1",
                    strokeWeight: 2,
                    strokeColor: "#ffffff",
                    fillOpacity: 0.1,
                    cursor: "pointer",
                };
            });

            map.data.addListener("click", (event) => {
                const id = event.feature.getProperty("id");
                const t = allTerritorios.find((x) => x.id === id);
                if (t) {
                    const explicitMz = event.feature.getProperty("mz_label");
                    const generalMz = event.feature.getProperty("manzanas");
                    const mzDisplay = explicitMz ? ` (Mz. ${explicitMz})` : generalMz ? ` (Mz. ${generalMz})` : "";
                    showNotification(`Territorio ${t.numero}${mzDisplay} seleccionado`, "info");
                }
            });

            if (!bounds.isEmpty()) map.fitBounds(bounds);

            google.maps.event.addListenerOnce(map, "idle", () => {
                document.getElementById("global-map-loader")?.remove();
            });
        };

        if (window.google?.maps) initMap();
        else {
            const itv = setInterval(() => {
                if (window.google) {
                    clearInterval(itv);
                    initMap();
                }
            }, 100);
        }
    },
};

window.openInteractiveMap = (territory, options = {}) => {
    const modal = document.getElementById("modal-container");
    if (!modal) return;
    modal.innerHTML = '<div id="map-viewer-root" class="w-full h-full max-w-6xl mx-auto p-2 md:p-8"></div>';
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    MapViewer.render(document.getElementById("map-viewer-root"), territory, options);
};

window.openGlobalMap = (allTerritorios) => {
    const modal = document.getElementById("modal-container");
    if (!modal) return;
    modal.innerHTML = '<div id="map-viewer-root" class="w-full h-full max-w-6xl mx-auto p-2 md:p-8"></div>';
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    MapViewer.renderGlobal(document.getElementById("map-viewer-root"), allTerritorios);
};

window.deleteMapObservation = async (noteId, noteConductor) => {
    const user = window.XolvyApp?.user;
    const currentName = user?.nombre || localStorage.getItem("selected_conductor_name") || "";
    const userRole = user?.role || "";

    const isCreator = currentName && noteConductor && currentName.toLowerCase().trim() === String(noteConductor).toLowerCase().trim();
    const isAdmin = userRole === "Administrador" || userRole === "SuperAdmin";

    if (!isCreator && !isAdmin) {
        showNotification("Solo el autor de la nota o un Administrador pueden eliminarla", "warning");
        return;
    }

    try {
        const { doc, deleteDoc } = await import("firebase/firestore");
        const { db } = await import("../firebase-config.js");
        await deleteDoc(doc(db, "bitacora_observaciones", noteId));
        showNotification("Nota eliminada correctamente", "success");
        const closeBtn = document.querySelector(".xolvy-map-popup .leaflet-popup-close-button");
        if (closeBtn) closeBtn.click();
    } catch (err) {
        console.error("Error eliminando nota:", err);
        showNotification("Error al eliminar la nota", "error");
    }
};
