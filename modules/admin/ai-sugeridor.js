import { saveProgramaSemanal } from "../../data/firestore-services.js";
import { UIHelpers } from "../services/ui-date-helpers.js";
import { formatGroups, showNotification } from "../utils/helpers.js";
import { extractMultiLeafletCoords, waitForLeaflet } from "../utils/kml-parser.js";

// ─── CONSTANTS ──────────────────────────────────────────────────────────────────
const TURNO_LABELS = { manana: "Mañana", tarde: "Tarde", noche: "Noche", zoom: "Zoom" };
const POLY_COLORS = {
    libre: { fill: "#10b981", stroke: "#059669", opacity: 0.3 },
    devuelto: { fill: "#f59e0b", stroke: "#d97706", opacity: 0.3 },
    ocupado: { fill: "#ef4444", stroke: "#dc2626", opacity: 0.22 },
};

// ─── MATH UTILS ─────────────────────────────────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getTerritoryCentroid(territory) {
    if (!territory) return null;
    const polys = extractMultiLeafletCoords(territory);
    if (!polys || polys.length === 0) return null;
    let totalLat = 0;
    let totalLng = 0;
    let count = 0;
    for (const p of polys) {
        if (p.coords && Array.isArray(p.coords)) {
            for (const pt of p.coords) {
                if (pt?.length >= 2) {
                    totalLat += pt[0];
                    totalLng += pt[1];
                    count++;
                }
            }
        }
    }
    if (count === 0) return null;
    return { lat: totalLat / count, lng: totalLng / count };
}

// ─── DATE UTILS ─────────────────────────────────────────────────────────────────
function getTodayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function _parseDateStr(dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).split("-");
    if (parts.length === 3) return new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return new Date(dateStr);
}

// ─── SLOT BUILDER ───────────────────────────────────────────────────────────────
function buildFutureSlots(programa) {
    const todayStr = getTodayISO();
    const slots = [];
    programa.dias.forEach((dia, dIdx) => {
        // Only include days from today onwards
        if (dia.fecha && dia.fecha < todayStr) return;
        const turnos = Object.keys(dia).filter((k) => k !== "nombre" && k !== "fecha");
        const sortOrder = { manana: 1, tarde: 2, noche: 3, zoom: 4 };
        const getOrder = (id) => sortOrder[id.split("_")[0]] || 99;
        turnos.sort((a, b) => getOrder(a) - getOrder(b) || a.localeCompare(b));

        for (const turnId of turnos) {
            const baseType = turnId.split("_")[0];
            const turnoLabel = TURNO_LABELS[baseType] || baseType.toUpperCase();
            const gruposRaw = dia[turnId]?.grupos || "";
            const gruposLabel = gruposRaw ? ` — Grupo ${formatGroups(gruposRaw)}` : "";
            slots.push({
                dIdx,
                turnId,
                label: `${dia.nombre} ${turnoLabel}${gruposLabel}`,
            });
        }
    });
    return slots;
}

// ─── LEARNING ENGINE ────────────────────────────────────────────────────────────
function loadLearningData() {
    try {
        const raw = localStorage.getItem("xolvy_suggestions_learning");
        return raw ? JSON.parse(raw) : {};
    } catch (_e) {
        return {};
    }
}

function saveLearningChoice(refKey, chosenNum) {
    try {
        const data = loadLearningData();
        if (!data[refKey]) data[refKey] = {};
        if (!data[refKey][chosenNum]) data[refKey][chosenNum] = 0;
        data[refKey][chosenNum] += 1;
        localStorage.setItem("xolvy_suggestions_learning", JSON.stringify(data));
    } catch (e) {
        console.warn("[Learning Engine] Failed to save:", e);
    }
}

// ─── SCORE ENGINE ───────────────────────────────────────────────────────────────
function computeCandidateInfo(t, coords, lastCompletedTime, refKey, learningData) {
    let distance = null;
    let distScore = 0;

    if (coords && t.centroid) {
        distance = haversineDistance(coords.lat, coords.lng, t.centroid.lat, t.centroid.lng);
        distScore = 1 / (1 + distance);
    }

    let timeScore = 0;
    let daysSince = 9999;
    if (lastCompletedTime > 0) {
        daysSince = (Date.now() - lastCompletedTime) / (1000 * 60 * 60 * 24);
        timeScore = Math.min(daysSince / 365, 1.0);
    } else {
        timeScore = 1.0;
    }

    let affinityScore = 0;
    if (refKey && learningData[refKey]?.[t.numero]) {
        affinityScore = Math.min(learningData[refKey][t.numero] * 0.15, 0.5);
    }

    const score = coords
        ? distScore * 0.4 + timeScore * 0.4 + affinityScore * 0.2
        : timeScore * 0.8 + affinityScore * 0.2;

    return { score: Math.round(score * 100), distance, daysSince };
}

// ─── PROCESS TERRITORIES ────────────────────────────────────────────────────────
function processAllTerritories(uniqueTs, historial, refCoords, selectedRefKey) {
    const learningData = loadLearningData();
    return uniqueTs.map((t) => {
        const tNum = String(t.numero).trim();
        const s13Records = historial.filter((h) => {
            const histNum = String(h.territorio_id || h.numero || "").trim();
            const hasFecha = h.fecha_entrega && String(h.fecha_entrega).trim() !== "";
            return histNum === tNum && (h.estado === "Completado" || hasFecha);
        });

        let timestamp = 0;
        let labelUltimaVez = "NUNCA PREDICADO";

        if (s13Records.length > 0) {
            s13Records.sort((a, b) => (Date.parse(b.fecha_entrega) || 0) - (Date.parse(a.fecha_entrega) || 0));
            const dateObj = UIHelpers.parseFirebaseDate(s13Records[0].fecha_entrega);
            if (dateObj) {
                timestamp = dateObj.getTime();
                const dd = String(dateObj.getDate()).padStart(2, "0");
                const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
                labelUltimaVez = `${dd}/${mm}/${dateObj.getFullYear()}`;
            }
        }

        const info = computeCandidateInfo(t, refCoords, timestamp, selectedRefKey, learningData);
        return { ...t, ...info, labelUltimaVez };
    });
}

// ─── SLOT DROPDOWN HTML ─────────────────────────────────────────────────────────
function buildSlotDropdownHTML(tNum, futureSlots) {
    if (futureSlots.length === 0) {
        return `<div class="px-3 py-3 text-[9px] font-bold text-slate-400 text-center uppercase tracking-wider">No hay slots disponibles</div>`;
    }
    return futureSlots
        .map(
            (s) => `
        <button onclick="window.confirmQuickAssign('${tNum}', ${s.dIdx}, '${s.turnId}')" class="w-full text-left px-3 py-2.5 text-[9px] font-black text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors border-b border-slate-100 dark:border-white/5 last:border-0 uppercase tracking-wide">
            <i class="fas fa-calendar-day text-[8px] mr-1.5 opacity-50"></i>${s.label}
        </button>
    `,
        )
        .join("");
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const openSugeridorModal = (programa, renderTableCallback) => {
    const modalDiv = document.getElementById("modal-container");
    if (!modalDiv) return;

    modalDiv.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");

    // ── Data sources ────────────────────────────────────────────────────────
    const territorios = window._progCache?.territorios || [];
    const historial = window._progCache?.historial || [];

    // ── Analyze current weekly assignments ──────────────────────────────────
    const assignedTerritoryNumbers = new Set();
    const assignedToDays = {};

    programa.dias.forEach((dia) => {
        Object.keys(dia).forEach((key) => {
            if (key !== "nombre" && key !== "fecha" && dia[key]?.territorio) {
                String(dia[key].territorio)
                    .split(/[,;/]/)
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .forEach((num) => {
                        assignedTerritoryNumbers.add(num);
                        if (!assignedToDays[num]) assignedToDays[num] = [];
                        if (!assignedToDays[num].includes(dia.nombre)) {
                            assignedToDays[num].push(dia.nombre);
                        }
                    });
            }
        });
    });

    // ── Deduplicate territories and compute centroids ───────────────────────
    const uniqueTsMap = {};
    for (const t of territorios) {
        const num = String(t.numero || "").trim();
        if (!uniqueTsMap[num]) {
            uniqueTsMap[num] = { ...t, numero: num, centroid: getTerritoryCentroid(t) };
        }
    }
    const uniqueTs = Object.values(uniqueTsMap);

    // ── Future slots only from today ────────────────────────────────────────
    const futureSlots = buildFutureSlots(programa);

    // ── State ───────────────────────────────────────────────────────────────
    let selectedRefKey = "none";
    let refCoords = null;
    let searchFilter = "";
    let activeMode = "list"; // 'list' | 'map'
    let leafletMap = null;
    let gpsMarker = null;

    // ── Classify territory status ───────────────────────────────────────────
    const getTerritoryStatus = (num, estado) => {
        const isAssigned = assignedTerritoryNumbers.has(num);
        if (!isAssigned) return "libre";
        if (estado === "Disponible" || estado === "Libre") return "devuelto";
        return "ocupado";
    };

    // ════════════════════════════════════════════════════════════════════════
    // RENDER LIST VIEW
    // ════════════════════════════════════════════════════════════════════════
    const renderList = () => {
        const listDiv = document.getElementById("ai-sugeridor-list");
        if (!listDiv) return;

        const processed = processAllTerritories(uniqueTs, historial, refCoords, selectedRefKey);

        const freeTs = [];
        const returnedTs = [];

        for (const t of processed) {
            const num = t.numero;
            if (
                searchFilter &&
                !num.includes(searchFilter) &&
                !String(t.localidad || "")
                    .toLowerCase()
                    .includes(searchFilter.toLowerCase())
            ) {
                continue;
            }
            const status = getTerritoryStatus(num, t.estado);
            if (status === "libre") freeTs.push(t);
            else if (status === "devuelto") returnedTs.push(t);
        }

        const sortByScore = (a, b) => b.score - a.score;
        freeTs.sort(sortByScore);
        returnedTs.sort(sortByScore);

        const buildItemHTML = (t) => {
            const distanceLabel = t.distance !== null ? `📍 A ${t.distance.toFixed(2)} km` : "📍 Sin coordenadas";
            const lastLabel = t.daysSince >= 9999 ? "🕒 Nunca" : `🕒 Hace ${Math.round(t.daysSince)} días`;
            const status = getTerritoryStatus(t.numero, t.estado);

            const badgeColor =
                status === "devuelto"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
            const badgeText =
                status === "devuelto" ? `Devuelto (${assignedToDays[t.numero]?.join(", ")})` : "Libre esta semana";

            return `
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl hover:border-indigo-500/30 dark:hover:border-indigo-500/20 transition-all hover:bg-slate-50/50 dark:hover:bg-white/[0.04] group/item gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-black text-sm shadow-inner group-hover/item:scale-105 transition-transform">
                            T-${t.numero}
                        </div>
                        <div>
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="text-xs font-black uppercase text-slate-800 dark:text-slate-200">${t.localidad || "Sin localidad"}</span>
                                <span class="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${badgeColor}">${badgeText}</span>
                            </div>
                            <div class="flex items-center gap-3 text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">
                                <span>${distanceLabel}</span>
                                <span class="opacity-30">•</span>
                                <span>${lastLabel}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div class="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl flex flex-col items-center justify-center shrink-0">
                            <span class="text-[10px] font-black text-indigo-600 dark:text-indigo-400">${t.score}%</span>
                            <span class="text-[6.5px] font-black text-indigo-500 uppercase tracking-widest leading-none mt-0.5">Relevancia</span>
                        </div>
                        <div class="relative inline-block text-left">
                            <button onclick="window.toggleAssignQuickMenu(event, 'assign-menu-${t.numero}')" class="px-4 py-2.5 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center gap-1.5">
                                Asignar <i class="fas fa-plus opacity-70"></i>
                            </button>
                            <div id="assign-menu-${t.numero}" class="hidden absolute right-0 mt-1 w-56 bg-white dark:bg-[#151a26] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-[100] overflow-hidden animate-scale-in origin-top-right">
                                <div class="px-3 py-2 bg-slate-50 dark:bg-[#0e1320] border-b border-slate-100 dark:border-white/5">
                                    <span class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Asignar a turno:</span>
                                </div>
                                <div class="max-h-56 overflow-y-auto custom-scrollbar">
                                    ${buildSlotDropdownHTML(t.numero, futureSlots)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };

        const listHTML = `
            <div class="space-y-3">
                <div class="flex items-center gap-3 py-1">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <h4 class="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Territorios Libres (${freeTs.length})</h4>
                </div>
                ${
                    freeTs.length > 0
                        ? freeTs.map(buildItemHTML).join("")
                        : '<div class="p-6 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl"><p class="text-[10px] font-black uppercase text-slate-400 tracking-wider">No hay territorios libres disponibles</p></div>'
                }
            </div>
            <div class="space-y-3 pt-6 border-t border-slate-100 dark:border-white/5">
                <div class="flex items-center gap-3 py-1">
                    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                    <h4 class="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Territorios Devueltos y Reciclables (${returnedTs.length})</h4>
                </div>
                ${
                    returnedTs.length > 0
                        ? returnedTs.map(buildItemHTML).join("")
                        : '<div class="p-6 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl"><p class="text-[10px] font-black uppercase text-slate-400 tracking-wider">No hay territorios devueltos listos para reciclar</p></div>'
                }
            </div>
        `;

        listDiv.innerHTML = listHTML;
    };

    // ════════════════════════════════════════════════════════════════════════
    // RENDER MAP VIEW
    // ════════════════════════════════════════════════════════════════════════
    const renderMap = async () => {
        const mapContainer = document.getElementById("ai-sugeridor-map");
        if (!mapContainer) return;

        // Show loading state
        mapContainer.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#0a0f18]">
                <i class="fas fa-spinner fa-spin text-indigo-500 text-2xl"></i>
                <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cargando mapa satelital...</span>
            </div>
        `;

        const L = await waitForLeaflet();
        if (!L) {
            mapContainer.innerHTML = `
                <div class="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-[#0a0f18]">
                    <span class="text-[10px] font-black text-red-500 uppercase tracking-widest">Error: Leaflet no disponible</span>
                </div>
            `;
            return;
        }

        // Inject custom styles for map labels
        const STYLE_ID = "xolvy-sugeridor-map-styles";
        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement("style");
            style.id = STYLE_ID;
            style.textContent = `
                .xolvy-t-label { background: rgba(15,23,42,0.85) !important; color: #fff !important; border: 1px solid rgba(255,255,255,0.15) !important; border-radius: 8px !important; padding: 3px 8px !important; font-weight: 900 !important; font-size: 10px !important; text-transform: uppercase !important; letter-spacing: 0.08em !important; box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important; backdrop-filter: blur(4px); }
                .xolvy-t-label-libre { background: rgba(16,185,129,0.9) !important; border-color: rgba(5,150,105,0.5) !important; }
                .xolvy-t-label-devuelto { background: rgba(245,158,11,0.9) !important; border-color: rgba(217,119,6,0.5) !important; }
                .xolvy-t-label-ocupado { background: rgba(239,68,68,0.85) !important; border-color: rgba(220,38,38,0.5) !important; }
                .xolvy-t-label::before { display: none !important; }
                .xolvy-gps-pulse { animation: xolvyGpsPulse 2s ease-in-out infinite; }
                @keyframes xolvyGpsPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }
            `;
            document.head.appendChild(style);
        }

        // Clear container and create map element
        mapContainer.innerHTML = `
            <div id="ai-map-leaflet" style="width: 100%; height: 100%;"></div>
            <div class="absolute top-3 right-3 flex flex-col gap-2 z-[1000]">
                <button id="ai-map-zoom-in" class="w-9 h-9 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 dark:border-white/10 text-slate-700 dark:text-white flex items-center justify-center hover:bg-white transition-all active:scale-90"><i class="fas fa-plus text-xs"></i></button>
                <button id="ai-map-zoom-out" class="w-9 h-9 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 dark:border-white/10 text-slate-700 dark:text-white flex items-center justify-center hover:bg-white transition-all active:scale-90"><i class="fas fa-minus text-xs"></i></button>
                <button id="ai-map-recenter" class="w-9 h-9 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 dark:border-white/10 text-slate-700 dark:text-white flex items-center justify-center hover:bg-white transition-all active:scale-90"><i class="fas fa-crosshairs text-xs"></i></button>
            </div>
            <div class="absolute bottom-3 left-3 flex items-center gap-2 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg border border-slate-200/50 dark:border-white/10">
                <span class="flex items-center gap-1.5 text-[8px] font-black text-emerald-600 uppercase tracking-widest"><span class="w-2.5 h-2.5 rounded bg-emerald-500"></span>Libre</span>
                <span class="flex items-center gap-1.5 text-[8px] font-black text-amber-600 uppercase tracking-widest"><span class="w-2.5 h-2.5 rounded bg-amber-500"></span>Devuelto</span>
                <span class="flex items-center gap-1.5 text-[8px] font-black text-red-600 uppercase tracking-widest"><span class="w-2.5 h-2.5 rounded bg-red-500"></span>Ocupado</span>
            </div>
        `;

        const mapEl = document.getElementById("ai-map-leaflet");
        if (!mapEl) return;

        // Destroy old map if exists
        if (leafletMap) {
            leafletMap.remove();
            leafletMap = null;
        }

        leafletMap = L.map(mapEl, { zoomControl: false, scrollWheelZoom: true });
        L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
            maxZoom: 20,
            attribution: "&copy; Google Maps",
        }).addTo(leafletMap);

        const layerGroup = L.featureGroup().addTo(leafletMap);
        const processed = processAllTerritories(uniqueTs, historial, refCoords, selectedRefKey);

        for (const t of processed) {
            const status = getTerritoryStatus(t.numero, t.estado);
            const colors = POLY_COLORS[status];
            const allItems = extractMultiLeafletCoords(t);

            if (allItems.length === 0) continue;

            // Merge all manzana coords into one territory group
            const allCoords = [];
            for (const item of allItems) {
                const coords = item.coords || item;
                if (Array.isArray(coords) && coords.length > 0) {
                    allCoords.push(coords);
                }
            }

            if (allCoords.length === 0) continue;

            // Render polygon(s) for this territory
            for (const ring of allCoords) {
                const poly = L.polygon(ring, {
                    color: colors.stroke,
                    weight: 2,
                    fillColor: colors.fill,
                    fillOpacity: colors.opacity,
                    lineCap: "round",
                    lineJoin: "round",
                }).addTo(layerGroup);

                poly.on("mouseover", function () {
                    this.setStyle({ fillOpacity: colors.opacity + 0.2, weight: 3 });
                });
                poly.on("mouseout", function () {
                    this.setStyle({ fillOpacity: colors.opacity, weight: 2 });
                });

                // Click handler for libre/devuelto territories
                if (status === "libre" || status === "devuelto") {
                    poly.on("click", () => {
                        const distLabel = t.distance !== null ? `${t.distance.toFixed(2)} km` : "Sin GPS";
                        const statusBadge =
                            status === "libre"
                                ? '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest">Libre</span>'
                                : '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-widest">Devuelto</span>';

                        const popupContent = `
                            <div style="min-width: 200px; font-family: system-ui, sans-serif;">
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                                    <span style="font-size:14px; font-weight:900; color:#4f46e5;">T-${t.numero}</span>
                                    ${statusBadge}
                                </div>
                                <div style="font-size:11px; font-weight:700; color:#334155; margin-bottom:4px;">${t.localidad || "Sin localidad"}</div>
                                <div style="font-size:9px; color:#64748b; margin-bottom:8px;">
                                    📍 ${distLabel} • 🕒 ${t.labelUltimaVez} • ⭐ ${t.score}% relevancia
                                </div>
                                <div style="border-top:1px solid #e2e8f0; padding-top:8px; max-height:150px; overflow-y:auto;">
                                    ${futureSlots
                                        .map(
                                            (s) => `
                                        <button onclick="window.confirmQuickAssign('${t.numero}', ${s.dIdx}, '${s.turnId}')" style="display:block; width:100%; text-align:left; padding:6px 8px; margin-bottom:2px; font-size:9px; font-weight:800; color:#334155; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; text-transform:uppercase; letter-spacing:0.05em;">
                                            📅 ${s.label}
                                        </button>
                                    `,
                                        )
                                        .join("")}
                                </div>
                            </div>
                        `;

                        poly.bindPopup(popupContent, {
                            maxWidth: 280,
                            className: "xolvy-popup",
                        }).openPopup();
                    });
                }
            }

            // Territory label at centroid
            if (t.centroid) {
                const statusLabel = status === "libre" ? "LIBRE" : status === "devuelto" ? "DEVUELTO" : "OCUPADO";
                const cssClass = `xolvy-t-label xolvy-t-label-${status}`;
                L.marker([t.centroid.lat, t.centroid.lng], {
                    icon: L.divIcon({
                        className: "",
                        html: `<div class="${cssClass}">T-${t.numero} · ${statusLabel}</div>`,
                        iconSize: [0, 0],
                        iconAnchor: [0, 0],
                    }),
                    interactive: false,
                }).addTo(layerGroup);
            }
        }

        // Fit map to all territories
        if (layerGroup.getLayers().length > 0) {
            leafletMap.fitBounds(layerGroup.getBounds(), { padding: [40, 40] });
        }

        // GPS marker
        if (refCoords) {
            gpsMarker = L.marker([refCoords.lat, refCoords.lng], {
                icon: L.divIcon({
                    className: "",
                    html: `<div class="xolvy-gps-pulse" style="width:18px;height:18px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(59,130,246,0.6);"></div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9],
                }),
            }).addTo(leafletMap);
            gpsMarker.bindTooltip("📍 Mi ubicación", {
                permanent: false,
                direction: "top",
                className: "xolvy-t-label",
            });
        }

        // Zoom controls
        setTimeout(() => {
            leafletMap.invalidateSize();
            document.getElementById("ai-map-zoom-in")?.addEventListener("click", () => leafletMap.zoomIn());
            document.getElementById("ai-map-zoom-out")?.addEventListener("click", () => leafletMap.zoomOut());
            document.getElementById("ai-map-recenter")?.addEventListener("click", () => {
                if (layerGroup.getLayers().length > 0) {
                    leafletMap.fitBounds(layerGroup.getBounds(), { padding: [40, 40] });
                }
            });
        }, 200);
    };

    // ════════════════════════════════════════════════════════════════════════
    // MODE TOGGLE
    // ════════════════════════════════════════════════════════════════════════
    window.switchSugeridorMode = (mode) => {
        activeMode = mode;
        const listView = document.getElementById("ai-sugeridor-list-container");
        const mapView = document.getElementById("ai-sugeridor-map-container");
        const btnList = document.getElementById("ai-mode-list");
        const btnMap = document.getElementById("ai-mode-map");
        const modalSheet = document.getElementById("modal-sheet");

        const activeClass = "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20";
        const inactiveClass = "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400";

        if (mode === "list") {
            listView?.classList.remove("hidden");
            mapView?.classList.add("hidden");
            btnList?.setAttribute(
                "class",
                `flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeClass}`,
            );
            btnMap?.setAttribute(
                "class",
                `flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${inactiveClass}`,
            );
            modalSheet?.style.setProperty("max-width", "600px");
            renderList();
        } else {
            listView?.classList.add("hidden");
            mapView?.classList.remove("hidden");
            btnList?.setAttribute(
                "class",
                `flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${inactiveClass}`,
            );
            btnMap?.setAttribute(
                "class",
                `flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeClass}`,
            );
            modalSheet?.style.setProperty("max-width", "850px");
            renderMap();
        }
    };

    // ════════════════════════════════════════════════════════════════════════
    // REFERENCE CHANGE
    // ════════════════════════════════════════════════════════════════════════
    window.handleRefChange = (refSelect) => {
        selectedRefKey = refSelect.value;
        const loader = document.getElementById("ai-sugeridor-loader");
        if (loader) loader.classList.remove("hidden");

        if (selectedRefKey === "none") {
            refCoords = null;
            if (loader) loader.classList.add("hidden");
            activeMode === "list" ? renderList() : renderMap();
        } else if (selectedRefKey === "gps") {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        refCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        if (loader) loader.classList.add("hidden");
                        activeMode === "list" ? renderList() : renderMap();
                        showNotification("Ubicación GPS sincronizada", "success");
                    },
                    (err) => {
                        console.warn("[GPS] Denied or timeout:", err);
                        showNotification("Error de acceso GPS. Fallback sin ubicación.", "warning");
                        refSelect.value = "none";
                        selectedRefKey = "none";
                        refCoords = null;
                        if (loader) loader.classList.add("hidden");
                        activeMode === "list" ? renderList() : renderMap();
                    },
                    { enableHighAccuracy: true, timeout: 8000 },
                );
            } else {
                showNotification("Navegador no soporta Geolocalización", "warning");
                refSelect.value = "none";
                selectedRefKey = "none";
                refCoords = null;
                if (loader) loader.classList.add("hidden");
                activeMode === "list" ? renderList() : renderMap();
            }
        } else {
            const t = uniqueTs.find((x) => x.numero === selectedRefKey);
            if (t?.centroid) {
                refCoords = t.centroid;
                showNotification(`Centrado en el Territorio ${selectedRefKey}`, "info");
            } else {
                refCoords = null;
                showNotification(`El Territorio ${selectedRefKey} no posee polígono válido`, "warning");
            }
            if (loader) loader.classList.add("hidden");
            activeMode === "list" ? renderList() : renderMap();
        }
    };

    // ════════════════════════════════════════════════════════════════════════
    // QUICK ASSIGN MENU
    // ════════════════════════════════════════════════════════════════════════
    window.toggleAssignQuickMenu = (e, menuId) => {
        if (e) e.stopPropagation();
        const menu = document.getElementById(menuId);
        const isHidden = menu.classList.contains("hidden");
        document.querySelectorAll("[id^='assign-menu-']").forEach((m) => m.classList.add("hidden"));
        if (isHidden) {
            menu.classList.remove("hidden");
            const closeGlobal = (evt) => {
                if (!menu.contains(evt.target)) {
                    menu.classList.add("hidden");
                    document.removeEventListener("click", closeGlobal);
                }
            };
            setTimeout(() => document.addEventListener("click", closeGlobal), 10);
        }
    };

    // ════════════════════════════════════════════════════════════════════════
    // CONFIRM QUICK ASSIGN
    // ════════════════════════════════════════════════════════════════════════
    window.confirmQuickAssign = async (tNum, dayIdx, turnoId) => {
        const dia = programa.dias[dayIdx];
        const oldData = dia[turnoId] || {};
        const oldTerrs = String(oldData.territorio || "")
            .split(/[,;/]/)
            .map((x) => x.trim())
            .filter(Boolean);

        if (oldTerrs.includes(tNum)) {
            showNotification(`El Territorio ${tNum} ya está asignado a este slot`, "warning");
            return;
        }

        oldTerrs.push(tNum);
        dia[turnoId] = { ...oldData, territorio: oldTerrs.join(", ") };

        try {
            showNotification("Asignando territorio...", "info");
            saveLearningChoice(selectedRefKey, tNum);

            programa.isFormalized = false;
            await saveProgramaSemanal(programa.id, programa);

            const { sincronizarAsignacionesSalida } = await import("../../data/firestore-services.js");
            const resolvedDateISO = new Date(`${dia.fecha}T12:00:00Z`).toISOString();
            await sincronizarAsignacionesSalida({ ...dia[turnoId], turnoId }, programa.id, resolvedDateISO);

            showNotification(`Territorio ${tNum} asignado con éxito`, "success");
            if (typeof renderTableCallback === "function") await renderTableCallback();
            document.getElementById("modal-sugerencias-close")?.click();
        } catch (e) {
            console.error("[Quick Assign Error]:", e);
            showNotification("Error al realizar asignación", "error");
        }
    };

    window.handleAiSearchTyped = (val) => {
        searchFilter = String(val || "").trim();
        renderList();
    };

    // ════════════════════════════════════════════════════════════════════════
    // RENDER MODAL
    // ════════════════════════════════════════════════════════════════════════
    modalDiv.innerHTML = `
        <div onclick="document.getElementById('modal-sugerencias-close').click()" class="absolute inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm z-0"></div>
        
        <div id="modal-sheet" onclick="event.stopPropagation()" style="max-width: 600px;" class="relative w-[95vw] h-[92vh] max-h-[92vh] bg-white dark:bg-[#0a0f18] rounded-2xl md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden z-50 transition-all duration-300 mx-auto my-auto border border-slate-200/50 dark:border-white/10">
            
            <!-- Header -->
            <header class="px-5 md:px-7 py-4 shrink-0 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center shadow-inner">
                        <i class="fas fa-lightbulb text-base"></i>
                    </div>
                    <div>
                        <h3 class="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-wider leading-none">Asistente Inteligente</h3>
                        <p class="text-[7.5px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">Sugerencias y Optimización de Asignación</p>
                    </div>
                </div>
                <button id="modal-sugerencias-close" class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all">
                    <i class="fas fa-times text-[13px]"></i>
                </button>
            </header>

            <!-- Mode Toggle -->
            <div class="px-5 md:px-7 pt-4 pb-2 shrink-0">
                <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 rounded-xl p-1 border border-slate-200/60 dark:border-white/5">
                    <button id="ai-mode-list" onclick="window.switchSugeridorMode('list')" class="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                        <i class="fas fa-list text-[9px]"></i> Listado
                    </button>
                    <button id="ai-mode-map" onclick="window.switchSugeridorMode('map')" class="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400">
                        <i class="fas fa-map text-[9px]"></i> Mapa Satelital
                    </button>
                </div>
            </div>

            <!-- Location Context (shared between modes) -->
            <div class="px-5 md:px-7 pb-2 shrink-0">
                <div class="p-3 bg-slate-50 dark:bg-[#0e1320] border border-slate-200/60 dark:border-white/5 rounded-xl space-y-2 relative">
                    <div id="ai-sugeridor-loader" class="hidden absolute inset-0 bg-white/60 dark:bg-[#0e1320]/60 backdrop-blur-xs flex items-center justify-center rounded-xl z-30">
                        <i class="fas fa-spinner fa-spin text-indigo-500 text-lg"></i>
                    </div>
                    <label class="text-[8px] font-black text-slate-600 dark:text-slate-400 tracking-widest uppercase block">📍 Ubicación de Referencia</label>
                    <select onchange="window.handleRefChange(this)" class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-2.5 rounded-xl text-[10px] font-bold text-slate-700 dark:text-white outline-none cursor-pointer">
                        <option value="none">📍 SIN UBICACIÓN (ORDEN CRONOLÓGICO)</option>
                        <option value="gps">📍 MI UBICACIÓN ACTUAL (GPS EN VIVO)</option>
                        ${uniqueTs
                            .map(
                                (t) =>
                                    `<option value="${t.numero}">📍 DESDE EL TERRITORIO ${t.numero} (${t.localidad || "Sin localidad"})</option>`,
                            )
                            .join("")}
                    </select>
                </div>
            </div>

            <!-- LIST VIEW -->
            <div id="ai-sugeridor-list-container" class="px-5 md:px-7 py-3 space-y-4 flex-1 min-w-0 overflow-y-auto custom-scrollbar">
                <!-- Live Search -->
                <div class="relative w-full">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input type="text" 
                           oninput="window.handleAiSearchTyped(this.value)" 
                           placeholder="Filtrar por número o localidad..." 
                           class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#0e1320] border border-slate-200/60 dark:border-white/10 rounded-xl text-[10px] font-bold text-slate-700 dark:text-white placeholder-slate-400 outline-none uppercase tracking-wider">
                </div>
                <div id="ai-sugeridor-list" class="space-y-6"></div>
            </div>

            <!-- MAP VIEW -->
            <div id="ai-sugeridor-map-container" class="hidden flex-1 min-w-0 relative overflow-hidden">
                <div id="ai-sugeridor-map" class="w-full h-full"></div>
            </div>
            
            <!-- Footer -->
            <footer class="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
                <span class="text-[7.5px] font-black text-slate-500 uppercase tracking-widest">
                    Asistente IA v2.0 • Xolvy Engine
                </span>
                <span class="text-[7.5px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> Sincronizado
                </span>
            </footer>
        </div>
    `;

    // ── Close button handler ────────────────────────────────────────────────
    const closeBtn = document.getElementById("modal-sugerencias-close");
    if (closeBtn) {
        closeBtn.onclick = () => {
            const sheet = document.getElementById("modal-sheet");
            if (sheet) {
                sheet.style.transform = "scale(0.95)";
                sheet.style.opacity = "0";
            }
            setTimeout(() => {
                if (leafletMap) {
                    leafletMap.remove();
                    leafletMap = null;
                }
                modalDiv.classList.add("hidden");
                document.body.classList.remove("overflow-hidden");
            }, 200);
        };
    }

    // ── Initial render ──────────────────────────────────────────────────────
    renderList();
};
