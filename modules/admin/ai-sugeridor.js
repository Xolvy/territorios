import { saveProgramaSemanal } from "../../data/firestore-services.js";
import { UIHelpers } from "../services/ui-date-helpers.js";
import { showNotification } from "../utils/helpers.js";
import { extractMultiLeafletCoords } from "../utils/kml-parser.js";

// Haversine formula to compute distance in km
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Calculate centroid of territory polygon
function getTerritoryCentroid(territory) {
    if (!territory) return null;
    const polys = extractMultiLeafletCoords(territory);
    if (!polys || polys.length === 0) return null;
    let totalLat = 0;
    let totalLng = 0;
    let count = 0;
    polys.forEach((p) => {
        if (p.coords && Array.isArray(p.coords)) {
            p.coords.forEach((pt) => {
                if (pt && pt.length >= 2) {
                    totalLat += pt[0];
                    totalLng += pt[1];
                    count++;
                }
            });
        }
    });
    if (count === 0) return null;
    return { lat: totalLat / count, lng: totalLng / count };
}

export const openSugeridorModal = (programa, renderTableCallback) => {
    const modalDiv = document.getElementById("modal-container");
    if (!modalDiv) return;

    modalDiv.classList.remove("hidden");
    document.body.classList.add("overflow-hidden"); // Lock scroll

    // Load active config and program data
    const territorios = window._progCache?.territorios || [];
    const historial = window._progCache?.historial || [];

    // Analyze current assignments in the weekly program
    const assignedTerritoryNumbers = new Set();
    const assignedToDays = {}; // Map number to days assigned

    programa.dias.forEach((dia) => {
        Object.keys(dia).forEach((key) => {
            if (key !== "nombre" && key !== "fecha" && dia[key]?.territorio) {
                const parts = String(dia[key].territorio)
                    .split(/[,;/]/)
                    .map((t) => t.trim())
                    .filter(Boolean);
                parts.forEach((num) => {
                    assignedTerritoryNumbers.add(num);
                    if (!assignedToDays[num]) assignedToDays[num] = [];
                    if (!assignedToDays[num].includes(dia.nombre)) {
                        assignedToDays[num].push(dia.nombre);
                    }
                });
            }
        });
    });

    // Deduplicate and resolve centroids for unique territories
    const uniqueTsMap = {};
    territorios.forEach((t) => {
        const num = String(t.numero || "").trim();
        if (!uniqueTsMap[num]) {
            uniqueTsMap[num] = {
                ...t,
                numero: num,
                centroid: getTerritoryCentroid(t),
            };
        }
    });
    const uniqueTs = Object.values(uniqueTsMap);

    // Initial state values
    let selectedRefKey = "none"; // 'none' | 'gps' | 'T1' ...
    let refCoords = null;
    let searchFilter = "";

    const loadLearningData = () => {
        try {
            const raw = localStorage.getItem("xolvy_suggestions_learning");
            return raw ? JSON.parse(raw) : {};
        } catch (_e) {
            return {};
        }
    };

    const saveLearningChoice = (refKey, chosenNum) => {
        try {
            const data = loadLearningData();
            if (!data[refKey]) data[refKey] = {};
            if (!data[refKey][chosenNum]) data[refKey][chosenNum] = 0;
            data[refKey][chosenNum] += 1;
            localStorage.setItem("xolvy_suggestions_learning", JSON.stringify(data));
        } catch (e) {
            console.warn("[Learning Engine] Failed to save learning choice:", e);
        }
    };

    // Calculate suggestion score based on distance, recency, and learned affinity
    const computeCandidateInfo = (t, coords, lastCompletedTime, refKey, learningData) => {
        let score = 0;
        let distance = null;
        let distScore = 0;

        if (coords && t.centroid) {
            distance = haversineDistance(coords.lat, coords.lng, t.centroid.lat, t.centroid.lng);
            distScore = 1 / (1 + distance); // closer yields higher score
        }

        let timeScore = 0;
        const now = Date.now();
        let daysSince = 9999;
        if (lastCompletedTime > 0) {
            daysSince = (now - lastCompletedTime) / (1000 * 60 * 60 * 24);
            timeScore = Math.min(daysSince / 365, 1.0); // capped at 1 year
        } else {
            timeScore = 1.0; // Never completed gets maximum prioritization
        }

        let affinityScore = 0;
        if (refKey && learningData[refKey]?.[t.numero]) {
            affinityScore = Math.min(learningData[refKey][t.numero] * 0.15, 0.5); // Max 50% affinity weight boost
        }

        if (coords) {
            score = distScore * 0.4 + timeScore * 0.4 + affinityScore * 0.2;
        } else {
            score = timeScore * 0.8 + affinityScore * 0.2;
        }

        return {
            score: Math.round(score * 100),
            distance,
            daysSince,
        };
    };

    const renderList = () => {
        const listDiv = document.getElementById("ai-sugeridor-list");
        if (!listDiv) return;

        const learningData = loadLearningData();

        // 1. Process candidate info and last completion times
        const processed = uniqueTs.map((t) => {
            const tNum = String(t.numero).trim();
            const s13Records = historial.filter((h) => {
                const histNum = String(h.territorio_id || h.numero || "").trim();
                const hasFecha = h.fecha_entrega && String(h.fecha_entrega).trim() !== "";
                return histNum === tNum && (h.estado === "Completado" || hasFecha);
            });

            let timestamp_ultima_fecha = 0;
            let labelUltimaVez = "NUNCA PREDICADO";

            if (s13Records.length > 0) {
                s13Records.sort((a, b) => {
                    const dateA = Date.parse(a.fecha_entrega) || 0;
                    const dateB = Date.parse(b.fecha_entrega) || 0;
                    return dateB - dateA;
                });
                const latestRecord = s13Records[0];
                const dateObj = UIHelpers.parseFirebaseDate(latestRecord.fecha_entrega);
                if (dateObj) {
                    timestamp_ultima_fecha = dateObj.getTime();
                    const day = String(dateObj.getDate()).padStart(2, "0");
                    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                    const year = dateObj.getFullYear();
                    labelUltimaVez = `${day}/${month}/${year}`;
                }
            }

            const info = computeCandidateInfo(t, refCoords, timestamp_ultima_fecha, selectedRefKey, learningData);

            return {
                ...t,
                ...info,
                labelUltimaVez,
            };
        });

        // 2. Separate candidates by category:
        // Group A: Completely Free (never assigned in this week's program)
        // Group B: Returned / Recyclable (assigned earlier but currently "Disponible" or "Libre")
        const freeTs = [];
        const returnedTs = [];

        processed.forEach((t) => {
            const num = t.numero;
            const isAssigned = assignedTerritoryNumbers.has(num);

            // Filter by search string if typed
            if (
                searchFilter &&
                !num.includes(searchFilter) &&
                !String(t.localidad || "")
                    .toLowerCase()
                    .includes(searchFilter.toLowerCase())
            ) {
                return;
            }

            if (!isAssigned) {
                freeTs.push(t);
            } else if (t.estado === "Disponible" || t.estado === "Libre") {
                returnedTs.push(t);
            }
        });

        // Sort both groups by score (descending)
        const sortByScore = (a, b) => b.score - a.score;
        freeTs.sort(sortByScore);
        returnedTs.sort(sortByScore);

        const buildItemHTML = (t) => {
            const distanceLabel = t.distance !== null ? `📍 A ${t.distance.toFixed(2)} km` : "📍 Sin coordenadas";
            const lastCompletedLabel =
                t.daysSince === Infinity ? "🕒 Nunca" : `🕒 Hace ${Math.round(t.daysSince)} días`;
            const isReturned = assignedTerritoryNumbers.has(t.numero);

            const badgeColor = isReturned
                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
            const badgeText = isReturned ? `Devuelto (${assignedToDays[t.numero].join(", ")})` : "Libre esta semana";

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
                                <span>${lastCompletedLabel}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div class="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl flex flex-col items-center justify-center shrink-0">
                            <span class="text-[10px] font-black text-indigo-600 dark:text-indigo-400">${t.score}%</span>
                            <span class="text-[6.5px] font-black text-indigo-500 uppercase tracking-widest leading-none mt-0.5">Relevancia</span>
                        </div>
                        
                        <!-- Quick Assign Dropdown -->
                        <div class="relative inline-block text-left">
                            <button onclick="window.toggleAssignQuickMenu(event, 'assign-menu-${t.numero}')" class="px-4 py-2.5 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center gap-1.5">
                                Asignar <i class="fas fa-plus opacity-70"></i>
                            </button>
                            <div id="assign-menu-${t.numero}" class="hidden absolute right-0 mt-1 w-44 bg-white dark:bg-[#151a26] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-[100] overflow-hidden animate-scale-in origin-top-right">
                                <div class="px-3 py-2 bg-slate-50 dark:bg-[#0e1320] border-b border-slate-100 dark:border-white/5">
                                    <span class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Selecciona slot:</span>
                                </div>
                                <div class="max-h-56 overflow-y-auto custom-scrollbar">
                                    ${programa.dias
                                        .map((dia, dIdx) => {
                                            const turnos = Object.keys(dia).filter(
                                                (k) => k !== "nombre" && k !== "fecha",
                                            );
                                            return turnos
                                                .map((turnId) => {
                                                    const niceTurn = turnId.split("_")[0];
                                                    const labelText = `${dia.nombre} - ${niceTurn.toUpperCase()}`;
                                                    return `
                                                    <button onclick="window.confirmQuickAssign('${t.numero}', ${dIdx}, '${turnId}')" class="w-full text-left px-3 py-2 text-[9px] font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-white/5 last:border-0 uppercase">
                                                        ${labelText}
                                                    </button>
                                                `;
                                                })
                                                .join("");
                                        })
                                        .join("")}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };

        let listHTML = "";

        // Render completely free ones
        listHTML += `
            <div class="space-y-3">
                <div class="flex items-center gap-3 py-1">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <h4 class="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Territorios Libres (${freeTs.length})</h4>
                </div>
                ${
                    freeTs.length > 0
                        ? freeTs.map(buildItemHTML).join("")
                        : `
                    <div class="p-6 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                        <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider">No hay territorios libres disponibles</p>
                    </div>
                `
                }
            </div>
        `;

        // Render returned ones
        listHTML += `
            <div class="space-y-3 pt-6 border-t border-slate-100 dark:border-white/5">
                <div class="flex items-center gap-3 py-1">
                    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                    <h4 class="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Territorios Devueltos y Reciclables (${returnedTs.length})</h4>
                </div>
                ${
                    returnedTs.length > 0
                        ? returnedTs.map(buildItemHTML).join("")
                        : `
                    <div class="p-6 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                        <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider">No hay territorios devueltos listos para reciclar</p>
                    </div>
                `
                }
            </div>
        `;

        listDiv.innerHTML = listHTML;
    };

    // Reference Change logic
    window.handleRefChange = (refSelect) => {
        selectedRefKey = refSelect.value;
        const loader = document.getElementById("ai-sugeridor-loader");
        if (loader) loader.classList.remove("hidden");

        if (selectedRefKey === "none") {
            refCoords = null;
            if (loader) loader.classList.add("hidden");
            renderList();
        } else if (selectedRefKey === "gps") {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        refCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        if (loader) loader.classList.add("hidden");
                        renderList();
                        showNotification("Ubicación GPS sincronizada", "success");
                    },
                    (err) => {
                        console.warn("[GPS] Denied or timeout:", err);
                        showNotification("Error de acceso GPS. Fallback sin ubicación.", "warning");
                        refSelect.value = "none";
                        selectedRefKey = "none";
                        refCoords = null;
                        if (loader) loader.classList.add("hidden");
                        renderList();
                    },
                    { enableHighAccuracy: true, timeout: 8000 },
                );
            } else {
                showNotification("Navegador no soporta Geolocalización", "warning");
                refSelect.value = "none";
                selectedRefKey = "none";
                refCoords = null;
                if (loader) loader.classList.add("hidden");
                renderList();
            }
        } else {
            // Selected territory reference
            const t = uniqueTs.find((x) => x.numero === selectedRefKey);
            if (t?.centroid) {
                refCoords = t.centroid;
                showNotification(`Centrado en el Territorio ${selectedRefKey}`, "info");
            } else {
                refCoords = null;
                showNotification(`El Territorio ${selectedRefKey} no posee polígono válido`, "warning");
            }
            if (loader) loader.classList.add("hidden");
            renderList();
        }
    };

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
        const newTerritorioStr = oldTerrs.join(", ");

        dia[turnoId] = {
            ...oldData,
            territorio: newTerritorioStr,
        };

        try {
            showNotification("Asignando territorio...", "info");

            // Learn choice affinity
            saveLearningChoice(selectedRefKey, tNum);

            // Invalidate formalization and save weekly program
            programa.isFormalized = false;
            await saveProgramaSemanal(programa.id, programa);

            // Sync assignments into firestore active pool
            const { sincronizarAsignacionesSalida } = await import("../../data/firestore-services.js");
            const resolvedDateISO = new Date(`${dia.fecha}T12:00:00Z`).toISOString();
            await sincronizarAsignacionesSalida(
                {
                    ...dia[turnoId],
                    turnoId: turnoId,
                },
                programa.id,
                resolvedDateISO,
            );

            showNotification(`Territorio ${tNum} asignado con éxito`, "success");

            // Refresh parent view
            if (typeof renderTableCallback === "function") {
                await renderTableCallback();
            }

            // Close suggestions modal
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

    // Render Modal UI Layout
    modalDiv.innerHTML = `
        <div onclick="document.getElementById('modal-sugerencias-close').click()" class="absolute inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm z-0"></div>
        
        <div id="modal-sheet" onclick="event.stopPropagation()" class="relative w-[95vw] h-[90vh] max-h-[90vh] md:w-[600px] md:h-[85vh] bg-white dark:bg-[#0a0f18] rounded-2xl md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden z-50 transition-all duration-300 mx-auto my-auto border border-slate-200/50 dark:border-white/10">
            <header class="px-6 md:px-8 py-5 shrink-0 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center shadow-inner">
                        <i class="fas fa-lightbulb text-lg"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider leading-none">Asistente Inteligente</h3>
                        <p class="text-[8px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Sugerencias y Optimización de Asignación</p>
                    </div>
                </div>
                <button id="modal-sugerencias-close" class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all">
                    <i class="fas fa-times text-[14px]"></i>
                </button>
            </header>

            <div class="px-6 md:px-8 py-5 space-y-5 flex-1 min-w-0 overflow-y-auto custom-scrollbar">
                <!-- Location Context Controls -->
                <div class="p-4 bg-slate-50 dark:bg-[#0e1320] border border-slate-200/60 dark:border-white/5 rounded-2xl space-y-3 relative">
                    <div id="ai-sugeridor-loader" class="hidden absolute inset-0 bg-white/60 dark:bg-[#0e1320]/60 backdrop-blur-xs flex items-center justify-center rounded-2xl z-30">
                        <i class="fas fa-spinner fa-spin text-indigo-500 text-lg"></i>
                    </div>
                    <label class="text-[8.5px] font-black text-slate-600 dark:text-slate-400 tracking-widest uppercase block">📍 Ubicación de Referencia (Aprendizaje Activo)</label>
                    <div class="flex flex-col sm:flex-row items-center gap-3">
                        <select onchange="window.handleRefChange(this)" class="flex-1 w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white outline-none cursor-pointer">
                            <option value="none">📍 SIN UBICACIÓN (ORDEN CRONOLÓGICO)</option>
                            <option value="gps">📍 MI UBICACIÓN ACTUAL (GPS EN VIVO)</option>
                            ${uniqueTs
                                .map(
                                    (t) => `
                                <option value="${t.numero}">📍 DESDE EL TERRITORIO ${t.numero} (${t.localidad || "Sin localidad"})</option>
                            `,
                                )
                                .join("")}
                        </select>
                    </div>
                </div>

                <!-- Live Search -->
                <div class="relative w-full">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input type="text" 
                           oninput="window.handleAiSearchTyped(this.value)" 
                           placeholder="Filtrar por número o localidad..." 
                           class="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#0e1320] border border-slate-200/60 dark:border-white/10 rounded-xl text-[11px] font-bold text-slate-700 dark:text-white placeholder-slate-400 outline-none uppercase tracking-wider">
                </div>

                <!-- Suggestions container -->
                <div id="ai-sugeridor-list" class="space-y-6"></div>
            </div>
            
            <footer class="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
                <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                    Asistente IA v1.1 • Xolvy Engine
                </span>
                <span class="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> Estado Sincronizado
                </span>
            </footer>
        </div>
    `;

    // Hook up close button action
    const closeBtn = document.getElementById("modal-sugerencias-close");
    if (closeBtn) {
        closeBtn.onclick = () => {
            const sheet = document.getElementById("modal-sheet");
            if (sheet) {
                sheet.style.transform = "scale(0.9)";
                sheet.style.opacity = "0";
            }
            setTimeout(() => {
                modalDiv.classList.add("hidden");
                document.body.classList.remove("overflow-hidden");
            }, 200);
        };
    }

    // Load initial list rendering
    renderList();
};
