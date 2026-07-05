import { documentId, where } from "firebase/firestore";
import {
    getConfiguracion,
    getGroupsConfig,
    getHistorialReport,
    getProgramaSemanal,
    getPublicadores,
    getTerritorios,
    importProgramFromJSON,
    liberarAsignacionesDeSalida,
    returnTerritorio,
    saveProgramaSemanal,
    sincronizarAsignacionesSalida,
    startLivePool,
    syncSlotWithTerritories,
} from "../../data/firestore-services.js";
import { setAdminLivePool } from "../admin-dashboard.js";
import { extractProgramFromImage } from "../services/ai-vision-service.js";
import { showCustomConfirm, showModal, showTerritorySelectionModal, UIHelpers } from "../services/ui-helpers.js";
import {
    formatGroups,
    getBaseTerritoryNumber,
    normalize,
    normalizeName,
    showNotification,
    splitTerritories,
    toTitleCase,
} from "../utils/helpers.js";
import { openFormalizeModal, openReceptionModal } from "./program-actions.js";
import {
    checkIncongruences,
    formatTerritorioSelection,
    getEffectiveManzanas,
    getEffectiveShiftId,
    getFieldIcon,
    getTurnoStyling,
    getWeekOccupancy,
    parseTerritorioSelection,
} from "./program-helpers.js";

const { getMonday, formatDateId } = UIHelpers;

// Helpers extraídos a program-helpers.js

export const renderProgramaTab = async (container, configData = null) => {
    const today = new Date();
    let currentWeekStart = getMonday(today);
    let programa = { dias: [] };
    let activeDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const activeTurns = new Set(["manana", "tarde", "noche", "zoom"]);
    let programUnsub = null;
    let bancoUnsub = null;
    let bancoS13Activos = new Set();

    const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    const [rawTerritorios, config, , historial] = await Promise.all([
        getTerritorios(),
        configData || getConfiguracion(),
        getPublicadores(),
        getHistorialReport(),
    ]);

    // Xolvy Data Shield: Aggressive normalization & Ghost filtering
    const territorios = rawTerritorios
        .filter((t) => {
            const hasNum = t.numero && normalize(t.numero).length > 0;
            if (!hasNum) console.warn(`🛡️ [Data Shield] Territory Ghost Record Filtered in Program: ${t.id}`);
            return hasNum;
        })
        .map((t) => ({
            ...t,
            numero: normalize(t.numero),
            manzanas: String(t.manzanas || "")
                .replace(/Salmo/gi, "Mz.")
                .trim(),
        }))
        .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: "base" }));

    // Shared Robust Helpers
    const normalizeT = (val) => String(val || "").trim();
    const normalizeLower = (val) => normalizeT(val).toLowerCase();

    const getTStatus = (tNum, conductor, fechaISO, turno) => {
        const baseT = getBaseTerritoryNumber(tNum);
        const t = territorios.find((x) => normalizeLower(x.numero) === normalizeLower(baseT));
        if (!t) return { isSync: false, isConflict: false, numero: tNum };
        if (t.estado !== "Asignado") return { isSync: false, isConflict: false, numero: tNum };

        const dbDateKey = t.fecha_asignacion ? String(t.fecha_asignacion).split("T")[0] : null;
        const targetDateKey = fechaISO ? fechaISO.split("T")[0] : null;

        const nameMatch = normalizeLower(t.asignado_a) === normalizeLower(conductor);
        const dateMatch = dbDateKey === targetDateKey;
        const turnMatch = String(t.turno || "").toLowerCase() === String(turno || "").toLowerCase();

        const isSync = nameMatch && dateMatch && turnMatch;
        const isConflict = !isSync;

        return {
            isSync,
            isConflict,
            numero: tNum,
            details: {
                id: t.id,
                conductor: t.asignado_a,
                fecha: dbDateKey,
                turno: t.turno,
                estado: t.estado || "Asignado",
            },
        };
    };

    window._pickerStateDate = new Date(currentWeekStart);

    window.openWeekSelector = () => {
        window._pickerStateDate = new Date(currentWeekStart);
        renderWeekSelectorModal();
    };

    const renderWeekSelectorModal = () => {
        const modalDiv = document.getElementById("modal-container");
        modalDiv.classList.remove("hidden");

        const year = window._pickerStateDate.getFullYear();
        const month = window._pickerStateDate.getMonth();
        const monthName = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })
            .format(window._pickerStateDate)
            .toUpperCase();

        const weeksHTML = [];
        const d = new Date(year, month, 1);
        const firstDay = d.getDay() || 7;
        d.setDate(d.getDate() - (firstDay - 1));

        for (let i = 0; i < 6; i++) {
            if (d.getMonth() > month && d.getFullYear() >= year) break;
            if (d.getFullYear() > year) break;

            const monday = new Date(d);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);

            const labelStr =
                `${monday.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} — ${sunday.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}`.toUpperCase();

            // Re-normalize hours for pure date comparison
            const mTime = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()).getTime();
            const currTime = new Date(
                currentWeekStart.getFullYear(),
                currentWeekStart.getMonth(),
                currentWeekStart.getDate(),
            ).getTime();
            const isCurrent = mTime === currTime;

            weeksHTML.push(`
                <button onclick="window.selectWeekFromPicker(${monday.getTime()})" class="w-full p-4 rounded-2xl border ${isCurrent ? "border-blue-600 bg-blue-600/5 text-blue-600" : "border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:border-blue-600/50 hover:bg-slate-50 dark:hover:bg-white/5"} transition-all flex items-center justify-between group">
                    <span class="text-[11px] font-black uppercase tracking-widest">${labelStr}</span>
                    <i class="fas fa-check text-primary ${isCurrent ? "opacity-100" : "opacity-0"}"></i>
                </button>
            `);
            d.setDate(d.getDate() + 7);
        }

        modalDiv.innerHTML = `
            <div class="p-8 space-y-6 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] max-w-sm w-full shadow-2xl animate-scale-in flex flex-col mx-auto my-auto relative">
                <header class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                    <button onclick="window.navPickerMonth(-1)" class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors flex items-center justify-center">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <div class="text-center">
                        <h3 class="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">${monthName}</h3>
                    </div>
                    <button onclick="window.navPickerMonth(1)" class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors flex items-center justify-center">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </header>
                <div class="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    ${weeksHTML.join("")}
                </div>
                <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full py-4 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all mt-2">Cerrar</button>
            </div>
        `;
    };

    window.navPickerMonth = (dir) => {
        window._pickerStateDate.setMonth(window._pickerStateDate.getMonth() + dir);
        renderWeekSelectorModal();
    };

    window.selectWeekFromPicker = (timeMs) => {
        document.getElementById("modal-container").classList.add("hidden");
        currentWeekStart = new Date(timeMs);
        loadWeekData();
    };

    container.innerHTML = `
        <div class="max-w-[1700px] mx-auto space-y-8 md:space-y-12 animate-fade-in pb-10 p-4">
            <!-- Header Clean Aesthetic -->
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                <div class="flex flex-col">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-widest rounded border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-400/20">Operational Planning</span>
                        <div class="h-px w-8 bg-slate-200 dark:bg-white/10"></div>
                    </div>
                    <h2 class="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Programa Semanal</h2>
                    <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Sincronización de territorios y salidas de campo</p>
                </div>

                <div class="inline-flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm h-14 overflow-hidden">
                    
                    <button id="btn-prev-week" class="px-5 h-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95">
                        <i class="fas fa-arrow-left text-xs"></i>
                    </button>

                    <button onclick="window.openWeekSelector()" class="flex flex-col items-center justify-center px-6 min-w-[190px] h-full cursor-pointer group hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:bg-slate-100/50">
                        <span id="week-range-label" class="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Cargando Semana...</span>
                        <span class="text-[8px] text-slate-600 dark:text-slate-400 font-medium uppercase tracking-tighter">Calendario Maestro <i class="fas fa-chevron-down ml-1 text-[7px] opacity-50"></i></span>
                    </button>

                    <button id="btn-next-week" class="px-5 h-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95">
                        <i class="fas fa-arrow-right text-xs"></i>
                    </button>

                    <div class="w-px h-8 bg-slate-100 dark:bg-white/10 mx-1 shrink-0"></div>

                    <button onclick="window.resetToCurrentWeek()" class="px-6 h-full text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all active:scale-95">
                        Hoy
                    </button>
                </div>
            </header>

                    <!-- Premium Toolbar -->
                    <nav class="flex flex-wrap items-center gap-2 md:gap-3 w-full">
                        <button id="action-recepcion-prog" class="flex-1 min-w-0 sm:flex-none min-w-[90px] px-3.5 py-2.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 hover:border-rose-500 hover:text-rose-600 transition-all font-bold text-[10px] xs:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 group">
                            <i class="fas fa-inbox opacity-40 group-hover:opacity-100 text-[10px]"></i> Recepción
                        </button>
                        <button id="action-escanear-prog" class="flex-1 min-w-0 sm:flex-none min-w-[90px] px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] xs:text-[11px] uppercase tracking-widest transition-all shadow-sm shadow-indigo-200 active:scale-95 group flex items-center justify-center gap-2">
                            <i class="fas fa-wand-magic-sparkles text-indigo-200 group-hover:scale-110 transition-transform text-[10px]"></i> Nexo Vision
                        </button>
                        <button id="action-replicar-prog" class="flex-1 min-w-0 sm:flex-none min-w-[90px] px-3.5 py-2.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-500 hover:text-indigo-600 transition-all font-bold text-[10px] xs:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm active:scale-95 group">
                            <i class="fas fa-clone opacity-40 group-hover:opacity-100 text-[10px]"></i> Replicar
                        </button>

                        <div style="flex-grow: 1" class="hidden xl:block"></div>

                        <!-- Export Action -->
                        <div class="relative inline-block text-left flex-1 min-w-0 sm:flex-none min-w-[110px]" id="share-dropdown-container">
                          <button onclick="toggleShareMenu(event)" class="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-900 dark:bg-white/10 text-white dark:text-slate-200 text-[10px] xs:text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 border border-transparent dark:border-white/5 transition-all active:scale-95">
                            <i class="fas fa-share-alt"></i> COMPARTIR <i class="fas fa-chevron-down text-[8px] ml-1 opacity-70"></i>
                          </button>
                          
                          <div id="share-menu" class="hidden absolute right-0 origin-top-right mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-white/5 z-[60] overflow-hidden">
                            <button onclick="generarImagenPrograma('conductor')" class="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold transition-colors border-b border-slate-50 flex items-center">
                              <i class="fas fa-car mr-3 text-slate-600 dark:text-slate-400"></i> Programa Conductor
                            </button>
                            <button onclick="generarImagenPrograma('publicador')" class="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold transition-colors flex items-center">
                              <i class="fas fa-users mr-3 text-slate-600 dark:text-slate-400"></i> Programa Publicador
                            </button>
                          </div>
                        </div>
                    </nav>

            <!-- Turn Filters & Day Selector Wrapper to override parent space-y spacing -->
            <div class="flex flex-col gap-1 items-center justify-center w-full mt-6">
                <!-- Turn Filters (Mañana, Tarde, Noche, Zoom) -->
                <div id="turn-filters" class="w-full animate-fade-in"></div>

                <!-- Day Selector -->
                <div id="day-selector-container" class="flex flex-wrap items-center justify-center gap-2 w-full animate-fade-in" data-adaptive-scroll="true"></div>
            </div>

            <div class="relative group">
                <div class="modern-card !p-0 border-0 bg-transparent shadow-none" id="admin-prog-table">
                    <div class="h-[250px] bg-slate-200/50 dark:bg-white/5 rounded-[3rem] animate-pulse"></div>
                </div>

                <div class="flex flex-col sm:flex-row justify-between items-center px-8 mt-6 gap-4">
                    <div class="flex items-center gap-6">
                        <p class="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                            <i class="fas fa-cloud-upload-alt text-emerald-500"></i> Autoguardado inteligente
                        </p>
                    </div>
                    <button id="action-formalizar-prog" class="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-2 active:scale-95">
                        <i class="fas fa-sync-alt text-[8px]"></i> Sincronización manual
                    </button>
                </div>
            </div>
        </div>
    `;

    const checkFormalizationStatus = () => {
        const btn = container.querySelector("#action-formalizar-prog");
        if (!btn) return;

        if (programa.isFormalized) {
            btn.innerHTML = '<i class="fas fa-check-double text-[8px]"></i> Sincronizado';
            btn.className =
                "text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2 cursor-default";
        } else {
            btn.innerHTML = '<i class="fas fa-sync-alt text-[8px]"></i> Sincronización manual';
            btn.className =
                "text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-2 active:scale-95";
        }
    };

    const loadWeekData = async () => {
        try {
            const weekId = formatDateId(currentWeekStart);

            // Xolvy Live Pool: Dynamic week synchronization
            if (programUnsub) {
                programUnsub();
                programUnsub = null;
            }
            if (bancoUnsub) {
                bancoUnsub();
                bancoUnsub = null;
            }

            // Listener para S-13 (Badges de integridad)
            bancoUnsub = startLivePool("banco_s13", [where("fecha_entrega", "==", null)], (data) => {
                bancoS13Activos = new Set(data.map((d) => String(d.numero || d.territorio_id).trim()));
                renderTable();
            });

            programUnsub = startLivePool("programa_semanal", [where(documentId(), "==", weekId)], (data) => {
                if (data.length > 0 && data[0].dias) {
                    programa = data[0];
                    // Sync dates
                    programa.dias.forEach((dia, idx) => {
                        const expectedDate = new Date(currentWeekStart);
                        expectedDate.setDate(expectedDate.getDate() + idx);
                        dia.fecha = formatDateId(expectedDate);

                        // Xolvy Robust: Ensure all mandatory turns exist in each day even if empty
                        ["manana", "tarde", "noche"].forEach((tId) => {
                            if (!dia[tId]) dia[tId] = {};
                        });
                        if (dia.nombre === "Martes" && !dia.zoom) dia.zoom = {};
                    });

                    console.log(`📅 [Live Pool] Week ${weekId} Updated.`);
                } else {
                    // Create dummy if doesn't exist to allow editing
                    programa = {
                        id: weekId,
                        dias: dayNames.map((name, idx) => {
                            const dayDate = new Date(currentWeekStart);
                            dayDate.setDate(dayDate.getDate() + idx);
                            const turns = { manana: {}, tarde: {}, noche: {} };
                            if (name === "Martes") turns.zoom = {};
                            return { nombre: name, fecha: formatDateId(dayDate), ...turns };
                        }),
                    };
                }

                // Evaluar y pintar el botón principal
                checkFormalizationStatus();

                const lblRange = container.querySelector("#week-range-label");
                if (lblRange) {
                    const monday = currentWeekStart;
                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    lblRange.innerText =
                        `${monday.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} — ${sunday.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}`.toUpperCase();
                }

                renderDaySelector();
                renderFilters();
                renderTable();
            });
            setAdminLivePool([programUnsub, bancoUnsub]);
        } catch (error) {
            console.error(error);
            showNotification("Error cargando programa", "error");
        }
    };

    // --- NEXO VISION MULTIMODAL SCANNER ---
    window.nexoVisionScanner = async () => {
        let scannerInput = document.getElementById("nexo-vision-input");
        if (!scannerInput) {
            scannerInput = document.createElement("input");
            scannerInput.id = "nexo-vision-input";
            scannerInput.type = "file";
            scannerInput.accept = "image/*";
            scannerInput.setAttribute("capture", "environment");
            scannerInput.className = "hidden";
            document.body.appendChild(scannerInput);
        }

        scannerInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (window.XolvyAlert) {
                window.XolvyAlert.fire({
                    title: "Nexo Vision AI",
                    text: "Iniciando análisis multimodal de tarjeta...",
                    allowOutsideClick: false,
                    didOpen: () => {
                        window.XolvyAlert.showLoading();
                    },
                });
            }

            try {
                const reader = new FileReader();
                reader.onload = async () => {
                    const base64 = reader.result.split(",")[1];
                    const nexo = window._nexoInstance || (await import("../nexo-ai/nexo-core.js")).nexo;
                    const result = await nexo.analyzeImage(base64, file.type);

                    if (result?.territorio_id) {
                        const allT = await getTerritorios();
                        const t = allT.find((x) => String(x.numero) === String(result.territorio_id));

                        if (!t)
                            throw new Error(
                                `El territorio número ${result.territorio_id} no existe en la base de datos.`,
                            );

                        const { updateTerritorio } = await import("../../data/services/territory-service.js");
                        await updateTerritorio(t.id, { manzanas_trabajadas: result.manzanas_trabajadas });

                        if (window.XolvyAlert) {
                            window.XolvyAlert.fire({
                                icon: "success",
                                title: "Visión Completada",
                                text: `Territorio ${result.territorio_id}: Avance registrado en manzanas [${result.manzanas_trabajadas.join(", ")}]`,
                            });
                        }
                        if (window.refreshConductorView) window.refreshConductorView(true);
                        loadWeekData();
                    } else {
                        throw new Error("No se detectó un ID de territorio válido en la imagen.");
                    }
                };
                reader.readAsDataURL(file);
            } catch (err) {
                console.error("Nexo Vision Error:", err);
                if (window.XolvyAlert) {
                    window.XolvyAlert.fire({ icon: "error", title: "Fallo de Análisis", text: err.message });
                }
            } finally {
                scannerInput.value = "";
            }
        };

        scannerInput.click();
    };

    // --- AI SCAN MEMORY INPUT (ATTACHED FOR IOS) ---
    let memoryScannerInput = document.getElementById("ai-scanner-input-global");
    if (!memoryScannerInput) {
        memoryScannerInput = document.createElement("input");
        memoryScannerInput.id = "ai-scanner-input-global";
        memoryScannerInput.type = "file";
        memoryScannerInput.accept = "image/png, image/jpeg, image/webp";
        memoryScannerInput.style.position = "absolute";
        memoryScannerInput.style.opacity = "0";
        memoryScannerInput.style.pointerEvents = "none";
        document.body.appendChild(memoryScannerInput);
    }

    // Always clear old listeners to prevent duplicates on remount
    const clone = memoryScannerInput.cloneNode(true);
    memoryScannerInput.parentNode.replaceChild(clone, memoryScannerInput);
    memoryScannerInput = clone;

    // --- NEXO VISION AI ENGINE (FULL INTERFACE OVERLAY) ---
    let aiOverlay = document.getElementById("ai-scanning-overlay");
    if (!aiOverlay) {
        aiOverlay = document.createElement("div");
        aiOverlay.id = "ai-scanning-overlay";
        aiOverlay.className =
            "fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center w-screen h-screen hidden animate-fade-in nexo-loading-overlay";
        aiOverlay.style.background = "radial-gradient(ellipse at center,rgba(15,15,35,0.78)0%,rgba(5,5,20,0.90)100%)";
        aiOverlay.innerHTML = `
            <div style="position:absolute;top:-10%;left:-8%;width:420px;height:420px;background:radial-gradient(circle,rgba(99,102,241,0.20)0%,transparent 70%);border-radius:50%;filter:blur(40px);pointer-events:none;"></div>
            <div style="position:absolute;bottom:-15%;right:-5%;width:500px;height:500px;background:radial-gradient(circle,rgba(139,92,246,0.18)0%,transparent 70%);border-radius:50%;filter:blur(50px);pointer-events:none;"></div>
            <div style="position:absolute;top:15%;right:6%;width:280px;height:280px;background:radial-gradient(circle,rgba(34,211,238,0.09)0%,transparent 70%);border-radius:50%;filter:blur(35px);pointer-events:none;"></div>
            <div style="position:absolute;bottom:20%;left:4%;width:220px;height:220px;background:radial-gradient(circle,rgba(244,114,182,0.07)0%,transparent 70%);border-radius:50%;filter:blur(30px);pointer-events:none;"></div>
            <div class="relative mx-4 w-full max-w-sm p-10 text-center animate-scale-in nexo-modal-box" style="background:rgba(255,255,255,0.05);backdrop-filter:blur(24px);border-radius:2.5rem;border:1px solid rgba(255,255,255,0.10);box-shadow:0 0 0 1px rgba(99,102,241,0.18),0 40px 80px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.07);">
                <div style="position:absolute;inset:0;border-radius:2.5rem;background:radial-gradient(ellipse at top,rgba(99,102,241,0.09)0%,transparent 60%);pointer-events:none;"></div>
                <div class="relative w-24 h-24 mx-auto mb-8">
                    <div class="absolute inset-0 rounded-full" style="border:4px solid rgba(99,102,241,0.12);"></div>
                    <div class="absolute inset-2 rounded-full animate-spin" style="border:4px solid transparent;border-top-color:#6366f1;"></div>
                    <div class="absolute inset-5 rounded-full animate-spin" style="border:2px solid transparent;border-bottom-color:#a78bfa;animation-direction:reverse;animation-duration:1.4s;"></div>
                    <div class="absolute inset-0 flex items-center justify-center text-2xl" style="color:#818cf8;">
                        <i class="fas fa-wand-magic-sparkles animate-pulse"></i>
                    </div>
                </div>
                <h3 class="text-xl font-black uppercase tracking-wider mb-2" style="color:#fff;text-shadow:0 0 24px rgba(99,102,241,0.55);">Nexo Vision AI</h3>
                <p class="font-bold text-xs uppercase tracking-widest animate-pulse" style="color:rgba(148,163,184,0.75);">Analizando imagen de programación...</p>
                <div class="mt-6 h-0.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.06);">
                    <div class="h-full rounded-full animate-pulse" style="width:65%;background:linear-gradient(90deg,#6366f1,#a78bfa);box-shadow:0 0 10px rgba(99,102,241,0.8);"></div>
                </div>
            </div>
        `;
        document.body.appendChild(aiOverlay);
    }

    const aiOverlayRef = aiOverlay;

    memoryScannerInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        aiOverlayRef?.classList.remove("hidden");
        document.body.classList.add("modal-open");

        try {
            // Fase 1: Extracción con Vision API
            const extractedData = await extractProgramFromImage(file);
            aiOverlayRef?.classList.add("hidden");
            document.body.classList.remove("modal-open");

            // Fase 2: Confirmación de Sobrescritura
            showCustomConfirm(
                "Se han extraído los datos exitosamente. Al aplicar, se sobrescribirá TODA la semana actual. ¿Deseas continuar?",
                async () => {
                    const weekId = formatDateId(currentWeekStart);
                    showNotification("Importando datos...", "info");

                    await importProgramFromJSON(weekId, extractedData);

                    showNotification("Programa importado con éxito por Nexo AI", "success");
                    loadWeekData(); // Refrescar vista
                },
            );
        } catch (err) {
            console.error("❌ AI Scan Error:", err);
            aiOverlayRef?.classList.add("hidden");
            document.body.classList.remove("modal-open");
            showModal(`
                <div class="p-8 text-center space-y-6">
                    <div class="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-xl">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Fallo en Visión IA</h2>
                    <p class="text-slate-500 dark:text-slate-400 font-bold text-sm max-w-sm mx-auto">No se pudo leer la tabla con claridad. Por favor, sube una imagen con mejor resolución o mayor contraste.</p>
                    <button onclick="document.querySelector('#modal-container').classList.add('hidden')" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all">Entendido</button>
                </div>
            `);
        } finally {
            memoryScannerInput.value = ""; // Reset input
        }
    });

    const renderDaySelector = () => {
        const dayBar = container.querySelector("#day-selector-container");
        if (dayBar)
            dayBar.innerHTML = `
            <div class="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 p-1.5 bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-md max-w-4xl mx-auto">
                ${dayNames
                    .map(
                        (n, i) => `
                    <button onclick="window.setActiveDay(${i})" 
                            class="relative px-2.5 sm:px-4.5 py-1.5 sm:py-2 rounded-[1.5rem] text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-widest transition-all duration-300 transform active:scale-95 ${activeDayIndex === i ? "bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-500 dark:to-teal-400 text-white shadow-lg shadow-emerald-500/20 scale-105" : "text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/50 dark:hover:bg-white/5"}">
                        ${n}
                    </button>
                `,
                    )
                    .join("")}
                <div class="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1 sm:mx-1.5"></div>
                <button onclick="window.setActiveDay(-1)" 
                        class="px-2.5 sm:px-4.5 py-1.5 sm:py-2 rounded-[1.5rem] text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-widest transition-all duration-300 transform active:scale-95 ${activeDayIndex === -1 ? "bg-slate-900 dark:bg-white/10 text-white border border-transparent dark:border-white/5 shadow-md scale-105" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-white/5"}">
                    Toda la Semana
                </button>
            </div>
        `;
    };

    const renderFilters = () => {
        const turnFilters = container.querySelector("#turn-filters");
        if (!turnFilters) return;
        const turnosArr = [
            {
                id: "manana",
                icon: "fa-sun",
                label: "Mañana",
                activeClass:
                    "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 dark:border-amber-500/40 shadow-[0_4px_16px_rgba(245,158,11,0.15)] scale-105 font-extrabold",
                inactiveClass:
                    "text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100/70 dark:hover:bg-white/5 hover:text-amber-500 dark:hover:text-amber-400",
            },
            {
                id: "tarde",
                icon: "fa-cloud-sun",
                label: "Tarde",
                activeClass:
                    "bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 dark:border-orange-500/40 shadow-[0_4px_16px_rgba(249,115,22,0.15)] scale-105 font-extrabold",
                inactiveClass:
                    "text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100/70 dark:hover:bg-white/5 hover:text-orange-500 dark:hover:text-orange-400",
            },
            {
                id: "noche",
                icon: "fa-moon",
                label: "Noche",
                activeClass:
                    "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 dark:border-indigo-500/40 shadow-[0_4px_16px_rgba(99,102,241,0.15)] scale-105 font-extrabold",
                inactiveClass:
                    "text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100/70 dark:hover:bg-white/5 hover:text-indigo-500 dark:hover:text-indigo-400",
            },
            {
                id: "zoom",
                icon: "fa-video",
                label: "Zoom",
                activeClass:
                    "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 dark:border-emerald-500/40 shadow-[0_4px_16px_rgba(16,185,129,0.15)] scale-105 font-extrabold",
                inactiveClass:
                    "text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100/70 dark:hover:bg-white/5 hover:text-emerald-500 dark:hover:text-emerald-400",
            },
        ];

        turnFilters.innerHTML = `
            <div class="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] max-w-md mx-auto">
                ${turnosArr
                    .map((t) => {
                        const isActive = activeTurns.has(t.id);
                        return `
                        <button onclick="window.toggleTurnFilter('${t.id}')" 
                                class="flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all duration-300 transform active:scale-95 text-[10px] uppercase tracking-widest font-black border ${isActive ? t.activeClass : t.inactiveClass}">
                            <i class="fas ${t.icon} text-xs"></i>
                            <span>${t.label}</span>
                        </button>
                    `;
                    })
                    .join("")}
            </div>
        `;
    };

    const renderTable = async () => {
        const [freshTerritorios, freshPersonnel, freshGroupsCfg, freshHistorial] = await Promise.all([
            getTerritorios(),
            getPublicadores(),
            getGroupsConfig(),
            getHistorialReport(),
        ]);
        const tableContainer = container.querySelector("#admin-prog-table");
        if (!tableContainer) return;

        if (!programa?.dias || programa.dias.length === 0) {
            programa = {
                id: formatDateId(currentWeekStart),
                dias: dayNames.map((name, idx) => {
                    const dayDate = new Date(currentWeekStart);
                    dayDate.setDate(dayDate.getDate() + idx);
                    return { nombre: name, fecha: formatDateId(dayDate) };
                }),
            };
        }

        territorios.length = 0;
        territorios.push(...freshTerritorios);

        const activeConductorsFresh = freshPersonnel
            .filter((p) => p.es_conductor && p.nombre)
            .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

        // Cache for modal
        window._progCache = {
            activeConductors: activeConductorsFresh,
            territorios,
            config,
            dayNames,
            grupos: freshGroupsCfg,
            historial: freshHistorial,
        };

        let html = `<div class="flex flex-col gap-8 md:gap-12 pb-4 max-w-4xl mx-auto">`;

        programa.dias.forEach((dia, dayIndex) => {
            if (activeDayIndex !== -1 && activeDayIndex !== dayIndex) return;

            // Remove empty initializations that forced hardcoded views
            // Build dynamic turno list solely from DB properties
            const allTurnoIds = Object.keys(dia).filter((k) => k !== "nombre" && k !== "fecha");

            // Filter out slots that have no actual data (e.g. empty strings)
            const activeTurnos = allTurnoIds.filter((id) => {
                const data = dia[id];
                if (!data) return false;
                return Object.values(data).some(
                    (val) => val !== "" && val !== null && val !== undefined && val !== false,
                );
            });

            const sortOrder = { manana: 1, tarde: 2, noche: 3, zoom: 4 };
            const getOrder = (id) => sortOrder[id.split("_")[0]] || 99;
            activeTurnos.sort((a, b) => getOrder(a) - getOrder(b) || a.localeCompare(b));

            const turnos = activeTurnos.map((id) => ({ id }));

            html += `
                <div class="day-group animate-fade-in relative">
                    <!-- Header Día Normal -->
                    <div class="py-4 mb-4 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                        <div>
                            <h4 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">${dia.nombre}</h4>
                            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">${dia.fecha}</p>
                        </div>
                        <div class="h-px flex-1 min-w-0 bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent ml-6"></div>
                    </div>
                    
                    <div class="flex flex-col rounded-2xl md:rounded-3xl border border-slate-200/60 dark:border-white/5 bg-white dark:bg-white/[0.02] shadow-sm overflow-hidden">
            `;

            turnos.forEach((t) => {
                const turnoId = t.id;
                const baseId = turnoId.split("_")[0]; // 'manana_2' → 'manana'

                // CRITICAL FIX: Removed hardcoded Tuesday filter for Zoom.
                // Allow Zoom slots on any day if they exist in the DB.

                if (!activeTurns.has(baseId)) return;

                const data = dia[turnoId] || {};
                const styling = getTurnoStyling(baseId, data?.hora);
                const hasData = data?.conductor || data?.territorio || data?.grupos || data?.faceta || data?.lugar;

                html += `
                    <div onclick="window.openEditTurnoSheet(${dayIndex}, '${turnoId}')" 
                         class="flex flex-col sm:flex-row sm:items-center gap-4 p-4 md:p-6 border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer relative z-10 transition-all active:bg-slate-100 w-full min-h-[56px] group/row">
                        
                        ${(() => {
                            const warnings = checkIncongruences(turnoId, data.hora, data.faceta);
                            return warnings.length > 0
                                ? `
                                <div class="absolute top-2 right-12 text-amber-500 animate-pulse drop-shadow-sm" title="${warnings.join(", ")}">
                                    <i class="fas fa-exclamation-triangle text-[10px]"></i>
                                </div>
                            `
                                : "";
                        })()}

                        <div class="flex items-center gap-4 min-w-[140px] shrink-0">
                            <div class="w-10 h-10 ${styling.bg} ${styling.color} rounded-xl flex items-center justify-center text-sm shadow-inner shrink-0 transition-transform group-hover/row:scale-110">
                                <i class="fas ${styling.icon}"></i>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-[11px] font-black tracking-widest uppercase text-slate-800 dark:text-gray-200">${styling.label}</span>
                                <span class="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">${data.hora || "Sin hora"}</span>
                            </div>
                        </div>

                        <div class="flex-1 min-w-0 flex flex-col gap-2 md:gap-1 pl-[56px] sm:pl-0">
                            ${
                                hasData
                                    ? `
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="text-sm font-black text-slate-900 dark:text-white capitalize">${toTitleCase(data.conductor || "Sin Asignar")}</span>
                                    ${data.auxiliar ? `<span class="text-[10px] text-slate-500 font-bold capitalize tracking-wider">+ ${toTitleCase(data.auxiliar)}</span>` : ""}
                                </div>
                                <div class="flex flex-wrap items-center gap-1.5 mt-1">
                                    ${data.lugar ? `<span class="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[9px] font-black text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-200 dark:ring-white/5 uppercase tracking-widest"><i class="fas fa-map-marker-alt mr-1 text-[7px] opacity-50"></i>${data.lugar}</span>` : ""}
                                    ${data.faceta ? `<span class="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-[9px] font-black text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/20 uppercase tracking-widest">${data.faceta}</span>` : ""}
                                    ${
                                        data?.territorio
                                            ? `
                                        <div class="flex items-center gap-2">
                                            <span class="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/10 dark:ring-emerald-400/20 uppercase tracking-widest">
                                                Terr: ${(() => {
                                                    try {
                                                        if (!data?.territorio) return "—";
                                                        const res = splitTerritories
                                                            ? splitTerritories(data.territorio)
                                                            : null;
                                                        return Array.isArray(res)
                                                            ? res.join(", ")
                                                            : data.territorio || "—";
                                                    } catch (_err) {
                                                        return data?.territorio || "—";
                                                    }
                                                })()}
                                            </span>
                                            ${(() => {
                                                const terrs = String(data.territorio || "")
                                                    .split(/[,;/]/)
                                                    .map((t) => t.trim())
                                                    .filter(Boolean);
                                                if (terrs.length === 0) return "";
                                                const allSync = terrs.every((t) => bancoS13Activos.has(t));

                                                if (allSync) {
                                                    return '<span class="text-[9px] font-black text-emerald-500 uppercase tracking-tighter bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20"><i class="fas fa-check-circle mr-1"></i> ✓ S-13</span>';
                                                } else {
                                                    return '<span class="text-[9px] font-black text-amber-500 uppercase tracking-tighter bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20"><i class="fas fa-exclamation-triangle mr-1"></i> ⚠ Pendiente</span>';
                                                }
                                            })()}
                                        </div>
                                    `
                                            : ""
                                    }
                                    ${
                                        data?.grupos
                                            ? `<span class="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[9px] font-black text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-700/10 dark:ring-indigo-400/20 uppercase tracking-widest">${(() => {
                                                  try {
                                                      return formatGroups(data.grupos);
                                                  } catch (_e) {
                                                      return data.grupos;
                                                  }
                                              })()}</span>`
                                            : ""
                                    }
                                </div>
                            `
                                    : `
                                <span class="text-[11px] font-bold italic text-slate-600 dark:text-slate-400 opacity-60">Turno vacío. Toque para asignar.</span>
                            `
                            }
                        </div>
                        
                        <div class="hidden sm:flex items-center justify-end text-slate-300 dark:text-slate-600 opacity-50 group-hover/row:opacity-100 transition-all gap-4">
                            <button onclick="event.stopPropagation(); window.clearTurnData(${dayIndex}, '${turnoId}')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-500 hover:text-white transition-all text-slate-600 dark:text-slate-400 md:text-rose-400" title="Eliminar Horario">
                                <i class="fas fa-trash-alt text-[11px]"></i>
                            </button>
                            <i class="fas fa-chevron-right text-[10px] group-hover/row:translate-x-1 transition-transform"></i>
                        </div>
                        
                        <!-- Mobile Delete Button (Visible only on small screens) -->
                        <div class="sm:hidden absolute top-4 right-4">
                            <button onclick="event.stopPropagation(); window.clearTurnData(${dayIndex}, '${turnoId}')" class="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                                <i class="fas fa-trash-alt text-[11px]"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            html += `
                <div onclick="window.addNewSlot(${dayIndex})" class="flex items-center justify-center p-4 min-h-[56px] cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-slate-400 hover:text-indigo-500 border-t border-slate-100 dark:border-white/5 border-dashed m-1.5 rounded-[1.5rem]">
                    <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 group">
                        <i class="fas fa-plus group-hover:scale-125 transition-transform"></i>
                        <span>Agregar Horario</span>
                    </div>
                </div>
            `;
            html += `</div></div>`;
        });
        html += `</div>`;
        tableContainer.innerHTML = html;
    };

    window.openEditTurnoSheet = (dayIdx, turnoId) => {
        console.log("Abriendo edición para:", turnoId);
        const dia = programa.dias[dayIdx];
        const data = dia[turnoId] || {};
        const styling = getTurnoStyling(turnoId, data.hora);
        const isWeekend = dia.nombre === "Sábado" || dia.nombre === "Domingo";
        const fields = [
            "Lugar",
            "Hora",
            "Conductor",
            "Auxiliar",
            "Faceta",
            ...(isWeekend && turnoId !== "zoom" ? ["Grupos"] : []),
            ...(turnoId !== "zoom" ? ["Territorio"] : []),
        ];
        const localOptions = {
            Lugar: window._progCache.config.lugares || ["Salón del Reino"],
            Hora: window._progCache.config.horarios_programa || ["09:00", "15:00", "19:00"],
            Conductor: window._progCache.activeConductors.map((c) => c.nombre),
            Auxiliar: window._progCache.activeConductors.map((p) => p.nombre),
            Faceta: window._progCache.config.facetas || ["Casa en casa", "Carritos"],
            Territorio: window._progCache.territorios.map((t) => t.numero),
        };

        const fieldsHTML = fields
            .map((field) => {
                const fieldId = field.toLowerCase();
                const val = data[fieldId] || "";
                const icon = getFieldIcon(field);

                if (field === "Territorio") {
                    const displayText = val || "-";
                    // Trigger rendering and sorting of the list container once modal is placed in DOM
                    setTimeout(() => {
                        window.changeTerritorySort(
                            null,
                            dayIdx,
                            turnoId,
                            window._progCache.territorySortOrder || "numero",
                        );
                    }, 10);

                    return `
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center justify-between">
                            <span><i class="fas fa-map-marked-alt opacity-30 mr-1"></i> ${field}</span>
                        </label>
                        <div class="custom-multiselect relative" id="sheet-territorio-container">
                            <div onclick="window.toggleSheetDropdown(event, 'sheet-territorio-dropdown', 'territorio-dropdown-icon')" class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-4 rounded-xl hover:border-primary transition-all flex items-center justify-between shadow-sm cursor-pointer block-scale-click min-h-[52px]">
                                <span id="selected-territorio-text" class="text-[12px] font-black truncate pr-4 ${val ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400 opacity-40"}">${displayText}</span>
                                <i class="fas fa-chevron-down text-[10px] text-slate-600 dark:text-slate-400 opacity-50 transition-transform duration-300 pointer-events-none dropdown-chevron-icon" id="territorio-dropdown-icon"></i>
                            </div>
                            <div id="sheet-territorio-dropdown" class="custom-dropdown-content hidden absolute left-0 right-0 bottom-full mb-1 bg-white dark:bg-[#151a26] border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_-15px_35px_-10px_rgba(0,0,0,0.3)] z-50 max-h-80 overflow-y-auto custom-scrollbar p-0 animate-scale-in origin-bottom">
                                <!-- Cabecera de Ordenamiento -->
                                <div class="px-4 py-3 bg-slate-50 dark:bg-[#0e1320] border-b border-slate-100 dark:border-white/5 flex items-center justify-between sticky top-0 z-10">
                                    <span class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Ordenar por:</span>
                                    <div class="flex items-center gap-1.5 p-0.5 bg-slate-200/60 dark:bg-white/5 rounded-lg border border-slate-300/40 dark:border-white/5">
                                        <button type="button" onclick="window.changeTerritorySort(event, ${dayIdx}, '${turnoId}', 'numero')" 
                                                id="sort-btn-numero"
                                                class="px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all duration-200 bg-white dark:bg-[#1a202c] text-slate-800 dark:text-white shadow-sm">
                                            Número
                                        </button>
                                        <button type="button" onclick="window.changeTerritorySort(event, ${dayIdx}, '${turnoId}', 'antiguos')" 
                                                id="sort-btn-antiguos"
                                                class="px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all duration-200 text-slate-500 hover:text-slate-800 dark:hover:text-white">
                                            Antiguos
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Contenedor de la Lista -->
                                <div id="territorios-list-container" class="p-2 space-y-1"></div>

                                <div class="border-t border-slate-100 dark:border-white/5 p-2 bg-slate-50 dark:bg-[#0a0f18] rounded-b-xl flex justify-center sticky bottom-0 z-10">
                                    <button onclick="window.limpiarTerritorio()" class="text-[10px] font-black text-slate-500 hover:text-rose-600 transition-colors py-1 px-4 tracking-widest uppercase">
                                        LIMPIAR
                                    </button>
                                    <button onclick="window.cerrarMenuDesplegable(event, 'sheet-territorio-dropdown')" class="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors py-1 px-4 uppercase tracking-widest">
                                        CERRAR
                                    </button>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="select-territorio" value="${val || ""}">
                    </div>`;
                } else if (field === "Grupos") {
                    const currentGroups = val
                        .split(",")
                        .map((g) => g.trim())
                        .filter(Boolean);
                    const baseGrupos = window._progCache.grupos || [];
                    const gList = [{ nombre: "Todos" }].concat(baseGrupos);
                    const displayText = currentGroups.length > 0 ? currentGroups.join(", ") : "-";

                    // PARCHE 4: Collision Detection — collect groups already assigned in this day/shift (other slots)
                    const occupiedGroups = new Set();
                    const currentDia = programa.dias[dayIdx];
                    if (currentDia) {
                        Object.keys(currentDia)
                            .filter((k) => k !== "nombre" && k !== "fecha" && k !== turnoId)
                            .forEach((otherTurnoId) => {
                                const otherData = currentDia[otherTurnoId];
                                if (otherData?.grupos) {
                                    otherData.grupos
                                        .split(",")
                                        .map((g) => g.trim())
                                        .filter(Boolean)
                                        .forEach((g) => occupiedGroups.add(g.toLowerCase()));
                                }
                            });
                    }

                    const dropHtml = gList
                        .map((g) => {
                            const groupStr = g?.nombre || g?.numero_nombre || (g?.id ? `Grupo ${g.id}` : "");
                            if (!groupStr || groupStr === "Grupo ") return "";
                            const isChecked = currentGroups.some(
                                (c) => (c || "").toLowerCase() === (groupStr || "").toLowerCase() || c === groupStr,
                            );
                            // A group is occupied if another slot on the same day already uses it (and it's not currently selected here)
                            const isOccupied = !isChecked && occupiedGroups.has(groupStr.toLowerCase());

                            return `
                        <label class="flex items-center p-3 ${isOccupied ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"} rounded-xl transition-colors group/chk">
                            <div class="relative w-5 h-5 flex items-center justify-center shrink-0">
                                <input type="checkbox" value="${groupStr}" ${isChecked ? "checked" : ""} ${isOccupied ? "disabled" : ""}
                                    onchange="window.handleSheetGroupToggle(this, 'select-grupos', 'selected-groups-text', 'sheet-groups-dropdown')"
                                    class="group-checkbox absolute opacity-0 inset-0 z-10 ${isOccupied ? "cursor-not-allowed" : "cursor-pointer"} w-full h-full">
                                <div class="w-4 h-4 rounded border-2 border-slate-300 dark:border-white/20 ${isChecked ? "bg-blue-600 border-blue-600" : ""} flex items-center justify-center transition-all peer-ui">
                                    <i class="fas fa-check text-[8px] text-slate-800 dark:text-slate-100 transition-opacity" style="opacity: ${isChecked ? "1" : "0"};"></i>
                                </div>
                            </div>
                            <div class="flex flex-col ml-3">
                                <span class="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 ${isOccupied ? "" : "group-hover/chk:text-primary"} transition-colors">${groupStr}</span>
                                ${isOccupied ? '<span class="text-[8px] font-bold text-rose-500 uppercase tracking-widest">Ya asignado</span>' : ""}
                            </div>
                        </label>`;
                        })
                        .join("");

                    return `
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center justify-between">
                            <span><i class="fas fa-users-cog opacity-30 mr-1"></i> ${field}</span>
                        </label>
                        <div class="custom-multiselect relative" id="sheet-groups-container">
                            <div onclick="window.toggleSheetDropdown(event, 'sheet-groups-dropdown', 'groups-dropdown-icon')" class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-4 rounded-xl hover:border-primary transition-all flex items-center justify-between shadow-sm cursor-pointer block-scale-click min-h-[52px]">
                                <span id="selected-groups-text" class="text-[12px] font-black truncate pr-4 ${currentGroups.length ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400 opacity-40"}">${displayText}</span>
                                <i class="fas fa-chevron-down text-[10px] text-slate-600 dark:text-slate-400 opacity-50 transition-transform duration-300 pointer-events-none dropdown-chevron-icon" id="groups-dropdown-icon"></i>
                            </div>
                            <div id="sheet-groups-dropdown" class="custom-dropdown-content hidden absolute left-0 right-0 bottom-full mb-1 bg-white dark:bg-[#151a26] border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_-15px_35px_-10px_rgba(0,0,0,0.3)] dark:shadow-none z-50 max-h-56 overflow-y-auto custom-scrollbar p-2 animate-scale-in origin-bottom">
                                ${dropHtml}
                                <div class="border-t border-slate-100 dark:border-white/5 p-2 bg-slate-50 dark:bg-slate-800 rounded-b-xl flex justify-center mt-2 sticky bottom-0">
                                    <button onclick="window.cerrarMenuDesplegable(event, 'sheet-groups-dropdown')" class="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors py-1 px-4">
                                        CERRAR
                                    </button>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="select-grupos" value="${val}">
                    </div>`;
                } else if (field === "Conductor" || field === "Auxiliar") {
                    const effectiveShiftId = getEffectiveShiftId(turnoId, data.hora);
                    const availKey = `${dia.nombre}_${effectiveShiftId}`;
                    const safeCheck = (disp) => (Array.isArray(disp) ? disp : []).includes(availKey);
                    const available = window._progCache.activeConductors.filter((e) => safeCheck(e.disponibilidad));
                    const nonAvailable = window._progCache.activeConductors.filter((e) => !safeCheck(e.disponibilidad));

                    // PARCHE 5: Collision Detection — find conductors/auxiliares already busy in other slots this same day
                    const busyPersonnel = new Set();
                    const currentDia = programa.dias[dayIdx];
                    if (currentDia) {
                        Object.keys(currentDia)
                            .filter((k) => k !== "nombre" && k !== "fecha" && k !== turnoId)
                            .forEach((otherTurnoId) => {
                                const otherData = currentDia[otherTurnoId];
                                if (otherData) {
                                    if (otherData.conductor) busyPersonnel.add(normalizeName(otherData.conductor));
                                    if (otherData.auxiliar) busyPersonnel.add(normalizeName(otherData.auxiliar));
                                }
                            });
                    }

                    const finalOpts = [
                        ...available.map((c) => ({
                            name: c.nombre,
                            isAvail: true,
                            isBusy: busyPersonnel.has(normalizeName(c.nombre)),
                        })),
                        ...nonAvailable.map((c) => ({
                            name: c.nombre,
                            isAvail: false,
                            isBusy: busyPersonnel.has(normalizeName(c.nombre)),
                        })),
                    ];

                    const currentPels = (val || "")
                        .split(",")
                        .map((p) => p.trim())
                        .filter(Boolean);
                    const displayText = currentPels.length > 0 ? currentPels.join(", ") : "-";

                    const isSingle = field === "Conductor";
                    const dropHtml = finalOpts
                        .map((o) => {
                            const isChecked = currentPels.includes(o.name);
                            const handler = isSingle
                                ? `window.handleSheetSingleSelectToggle(this, '${o.name}', 'select-${fieldId}', 'selected-${fieldId}-text', 'sheet-${fieldId}-dropdown')`
                                : `window.handleSheetMultiSelectToggle(this, 'select-${fieldId}', 'selected-${fieldId}-text', 'sheet-${fieldId}-dropdown')`;

                            return `
                        <label class="flex items-center p-3 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer rounded-xl transition-colors group/chk relative">
                            <div class="relative w-5 h-5 flex items-center justify-center shrink-0">
                                <input type="${isSingle ? "radio" : "checkbox"}" 
                                       name="group-${fieldId}" 
                                       value="${o.name}" 
                                       ${isChecked ? "checked" : ""} 
                                       onchange="${handler}"
                                       class="group-checkbox absolute opacity-0 inset-0 z-10 cursor-pointer w-full h-full">
                                <div class="w-4 h-4 rounded border-2 border-slate-300 dark:border-white/20 ${isChecked ? "bg-blue-600 border-blue-600" : ""} flex items-center justify-center transition-all peer-ui">
                                    <i class="fas fa-check text-[8px] text-slate-800 dark:text-slate-100 transition-opacity" style="opacity: ${isChecked ? "1" : "0"};"></i>
                                </div>
                            </div>
                            <div class="ml-3 flex flex-col pointer-events-none">
                                <span class="text-[11px] font-black tracking-tight text-slate-700 dark:text-slate-300 group-hover/chk:text-primary transition-colors capitalize">${o.name}</span>
                                ${o.isBusy ? '<span class="text-[8px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">Ya asignado hoy</span>' : o.isAvail ? '<span class="text-[8px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">Disponible</span>' : ""}
                            </div>
                        </label>`;
                        })
                        .join("");

                    return `
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                            <i class="fas ${icon} opacity-30"></i> ${field}
                        </label>
                        <div class="custom-multiselect relative" id="sheet-${fieldId}-container">
                            <div onclick="window.toggleSheetDropdown(event, 'sheet-${fieldId}-dropdown', '${fieldId}-dropdown-icon')" class="w-full text-left bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-4 rounded-xl hover:border-primary transition-all flex items-center justify-between shadow-sm cursor-pointer block-scale-click min-h-[52px]">
                                <span id="selected-${fieldId}-text" class="text-[12px] font-black truncate pr-4 capitalize ${currentPels.length ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400 opacity-40"}">${toTitleCase(displayText)}</span>
                                <i class="fas fa-chevron-down text-[10px] text-slate-600 dark:text-slate-400 opacity-50 transition-transform duration-300 pointer-events-none dropdown-chevron-icon" id="${fieldId}-dropdown-icon"></i>
                            </div>
                            <div id="sheet-${fieldId}-dropdown" class="custom-dropdown-content hidden absolute left-0 right-0 bottom-full mb-1 bg-white dark:bg-[#151a26] border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_-15px_35px_-10px_rgba(0,0,0,0.3)] z-50 max-h-56 overflow-y-auto custom-scrollbar p-2 animate-scale-in origin-bottom">
                                ${dropHtml}
                                <div class="border-t border-slate-100 dark:border-white/5 p-2 bg-slate-50 dark:bg-slate-800 rounded-b-xl flex justify-center mt-2 sticky bottom-0">
                                    <button onclick="window.cerrarMenuDesplegable(event, 'sheet-${fieldId}-dropdown')" class="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors py-1 px-4">
                                        CERRAR
                                    </button>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="select-${fieldId}" value="${val}">
                    </div>`;
                } else {
                    return `
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-[0.2em] uppercase ml-1 flex items-center gap-2">
                            <i class="fas ${icon} opacity-30"></i> ${field}
                        </label>
                        <div class="relative">
                            <select id="${fieldId === "lugar" || fieldId === "hora" ? `input-${fieldId}` : `select-${fieldId}`}" 
                                    onchange="window.updateWeekDataSheet(${dayIdx}, '${turnoId}', '${fieldId}', this.value)" 
                                    class="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 py-5 px-4 rounded-xl text-[12px] font-black text-slate-700 dark:text-white outline-none focus:border-primary appearance-none cursor-pointer shadow-sm transition-all focus:ring-1 focus:ring-primary/20 min-h-[52px]">
                                <option value="">—</option>
                                ${localOptions[field].map((o) => `<option value="${o}" ${val === o ? "selected" : ""}>${o}</option>`).join("")}
                            </select>
                            <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] opacity-20 pointer-events-none"></i>
                        </div>
                    </div>`;
                }
            })
            .join("");

        const modalDiv = document.getElementById("modal-container");
        modalDiv.classList.remove("hidden");
        document.body.classList.add("overflow-hidden"); // Lock scroll

        const incongruences = checkIncongruences(turnoId, data.hora, data.faceta);

        modalDiv.innerHTML = `
            <div onclick="window.hideModal('modal-container')" class="absolute inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm z-0"></div>
            <div id="modal-sheet" onclick="event.stopPropagation()" class="relative w-[95vw] h-[90vh] max-h-[90vh] md:w-[540px] md:h-auto bg-white dark:bg-[#0a0f18] rounded-2xl md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden z-50 transition-all duration-300 mx-auto my-auto">
                <div class="w-12 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mx-auto mt-4 mb-2 md:hidden shrink-0"></div>
                
                <header class="px-6 md:px-8 py-4 flex flex-col shrink-0 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#0a0f18]">
                    <div class="flex items-center justify-between w-full mb-1">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 ${styling.bg} ${styling.color} rounded-xl flex items-center justify-center shadow-inner">
                                <i class="fas ${styling.icon}"></i>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h3 class="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-widest">${dia.nombre}</h3>
                                    <span class="text-xs opacity-20">•</span>
                                    
                                    <!-- Custom Premium Dropdown -->
                                    <div class="relative inline-block">
                                        <button onclick="window.toggleJornadaDropdown(event)" 
                                                class="group flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-white/[0.05] rounded-full hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200/50 dark:border-white/5 transition-all active:scale-95 shadow-sm">
                                            <span id="modal-shift-label" class="text-[12px] font-black uppercase text-slate-800 dark:text-white tracking-tight">${styling.label}</span>
                                            <i class="fas fa-chevron-down text-[8px] opacity-30 group-hover:opacity-100 transition-opacity"></i>
                                        </button>
                                        
                                        <div id="jornada-dropdown" class="absolute top-full left-0 mt-3 w-40 bg-white dark:bg-[#151a26] rounded-[1.2rem] shadow-[0_15px_50px_-10px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-white/10 hidden z-[110] overflow-hidden backdrop-blur-xl animate-scale-in origin-top-left">
                                            ${[
                                                {
                                                    id: "manana",
                                                    label: "Mañana",
                                                    icon: "fa-sun",
                                                    color: "text-amber-500",
                                                    bg: "bg-amber-500/10",
                                                },
                                                {
                                                    id: "tarde",
                                                    label: "Tarde",
                                                    icon: "fa-cloud-sun",
                                                    color: "text-orange-500",
                                                    bg: "bg-orange-500/10",
                                                },
                                                {
                                                    id: "noche",
                                                    label: "Noche",
                                                    icon: "fa-moon",
                                                    color: "text-indigo-500",
                                                    bg: "bg-indigo-500/10",
                                                },
                                                {
                                                    id: "zoom",
                                                    label: "Zoom",
                                                    icon: "fa-video",
                                                    color: "text-emerald-500",
                                                    bg: "bg-emerald-500/10",
                                                },
                                            ]
                                                .map(
                                                    (opt) => `
                                                <button onclick="window.selectJornada(${dayIdx}, '${turnoId}', '${opt.id}')" 
                                                        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-50 dark:border-white/5 last:border-0 group/opt">
                                                    <div class="w-7 h-7 ${opt.bg} ${opt.color} rounded-lg flex items-center justify-center text-[10px] group-hover/opt:scale-110 transition-transform">
                                                        <i class="fas ${opt.icon}"></i>
                                                    </div>
                                                    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">${opt.label}</span>
                                                </button>
                                            `,
                                                )
                                                .join("")}
                                        </div>
                                        <input type="hidden" id="select-turno-id" value="${turnoId.includes("zoom") ? "zoom" : turnoId.includes("noche") ? "noche" : turnoId.includes("tarde") ? "tarde" : "manana"}">
                                    </div>
                                </div>
                                <p class="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">${dia.fecha}</p>
                            </div>
                        </div>
                        
                        <div class="flex gap-2">
                            <button onclick="window.clearTurnData(${dayIdx}, '${turnoId}'); document.getElementById('modal-sheet-close').click();" class="w-10 h-10 min-h-[44px] rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                                <i class="fas fa-trash-alt text-[12px]"></i>
                            </button>
                            <button id="modal-sheet-close" class="w-10 h-10 min-h-[44px] rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-all">
                                <i class="fas fa-times text-[14px]"></i>
                            </button>
                        </div>
                    </div>

                    ${
                        incongruences.length > 0
                            ? `
                        <div class="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 animate-pulse">
                            <i class="fas fa-exclamation-triangle text-amber-500 text-xs"></i>
                            <div class="flex flex-col">
                                <p class="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Incongruencia detectada</p>
                                <p class="text-[8px] text-amber-500 font-bold leading-tight mt-0.5">${incongruences.join(". ")}.</p>
                            </div>
                        </div>
                    `
                            : ""
                    }
                </header>

                <div class="px-6 md:px-8 py-6 space-y-6 form-scroller flex-1 min-w-0 overflow-y-auto custom-scrollbar pr-3 pb-10">
                    ${fieldsHTML}
                </div>
                
                <div class="px-6 pb-6 md:px-8 md:pb-8 mt-auto shrink-0 z-20">
                    <button onclick="window.saveTurnDataFromSheet(${dayIdx}, '${turnoId}')" class="w-full py-4 min-h-[48px] rounded-2xl bg-slate-900 dark:bg-blue-600 text-white font-black text-[13px] uppercase tracking-widest shadow-xl shadow-slate-900/40 dark:shadow-blue-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        ACEPTAR Y GUARDAR
                    </button>
                </div>
            </div>
        `;

        // Animation logic
        setTimeout(() => {
            const sheet = document.getElementById("modal-sheet");
            if (sheet) {
                sheet.classList.add("animate-modal-pop");
            }
        }, 10);

        document.getElementById("modal-sheet-close").onclick = () => {
            const sheet = document.getElementById("modal-sheet");
            if (sheet) {
                sheet.style.transform = "translate(-50%, -50%) scale(0.9)";
                sheet.style.opacity = "0";
            }
            setTimeout(() => {
                window.hideModal("modal-container");
            }, 200);
        };
    };

    window.cerrarMenuDesplegable = (e, menuId) => {
        if (e) e.stopPropagation();
        const menu = document.getElementById(menuId);
        if (menu) menu.classList.add("hidden");
        const iconId = menuId.replace("sheet-", "").replace("-dropdown", "-dropdown-icon");
        const icon = document.getElementById(iconId === "groups-dropdown-icon" ? "groups-dropdown-icon" : iconId);
        if (icon) icon.classList.remove("rotate-180");
    };

    window.toggleSheetDropdown = (e, dropId, iconId) => {
        if (e) e.stopPropagation();
        const drop = document.getElementById(dropId);
        const icon = document.getElementById(iconId);
        if (!drop) return;

        const isHidden = drop.classList.contains("hidden");

        // Cerrar otros dropdowns personalizados para evitar colisiones visuales
        document.querySelectorAll(".custom-dropdown-content").forEach((d) => d.classList.add("hidden"));
        document.querySelectorAll(".dropdown-chevron-icon").forEach((i) => i.classList.remove("rotate-180"));

        if (isHidden) {
            drop.classList.remove("hidden");
            if (icon) icon.classList.add("rotate-180");

            const closeGlobal = (evt) => {
                const dropMenu = document.getElementById(dropId);
                const trigger = e.currentTarget || e.target;
                if (dropMenu && !dropMenu.contains(evt.target) && trigger && !trigger.contains(evt.target)) {
                    dropMenu.classList.add("hidden");
                    if (icon) icon.classList.remove("rotate-180");
                    document.removeEventListener("click", closeGlobal);
                }
            };
            setTimeout(() => document.addEventListener("click", closeGlobal), 10);
        }
    };

    window.handleSheetMultiSelectToggle = (_checkbox, hiddenId, textId, dropdownId) => {
        const container = document.getElementById(dropdownId);
        if (!container) return;

        // Reactive Checkboxes: Update ALL states in the list for visual feedback
        const allLabels = container.querySelectorAll("label.group\\/chk");
        allLabels.forEach((label) => {
            const cb = label.querySelector("input");
            const peerUi = label.querySelector(".peer-ui");
            const icon = peerUi?.querySelector("i");

            if (cb && peerUi && icon) {
                if (cb.checked) {
                    peerUi.classList.add("bg-blue-600", "border-blue-600");
                    icon.style.opacity = "1";
                } else {
                    peerUi.classList.remove("bg-blue-600", "border-blue-600");
                    icon.style.opacity = "0";
                }
            }
        });

        const checkedBoxes = Array.from(container.querySelectorAll(".group-checkbox:checked"));
        const checkedVals = checkedBoxes.map((cb) => cb.value);

        let finalStr = "";
        if (hiddenId.includes("grupos") && checkedVals.includes("Todos")) {
            finalStr = "Todos";
        } else {
            finalStr = checkedVals.join(", ");
        }

        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = finalStr;

        const textSpan = document.getElementById(textId);
        if (textSpan) {
            textSpan.innerText = finalStr || "—";
            textSpan.className = `text-[12px] font-black truncate pr-4 ${finalStr ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400 opacity-40"}`;
        }
    };

    // PARCHE 3: Mutual Exclusion handler for Groups (Todos ↔ specific groups)
    window.handleSheetGroupToggle = (checkbox, hiddenId, textId, dropdownId) => {
        const container = document.getElementById(dropdownId);
        if (!container) return;

        const isTodos = checkbox.value === "Todos";

        if (isTodos && checkbox.checked) {
            // Uncheck all specific group checkboxes
            container.querySelectorAll(".group-checkbox").forEach((cb) => {
                if (cb.value !== "Todos" && !cb.disabled) {
                    cb.checked = false;
                }
            });
        } else if (!isTodos && checkbox.checked) {
            // Uncheck "Todos" if a specific group is selected
            const todosCb = container.querySelector('.group-checkbox[value="Todos"]');
            if (todosCb) todosCb.checked = false;
        }

        // Update all visual peer-ui tokens
        container.querySelectorAll("label.group\\/chk").forEach((label) => {
            const cb = label.querySelector("input");
            const peerUi = label.querySelector(".peer-ui");
            const icon = peerUi?.querySelector("i");
            if (cb && peerUi && icon) {
                if (cb.checked) {
                    peerUi.classList.add("bg-blue-600", "border-blue-600");
                    icon.style.opacity = "1";
                } else {
                    peerUi.classList.remove("bg-blue-600", "border-blue-600");
                    icon.style.opacity = "0";
                }
            }
        });

        const checkedBoxes = Array.from(container.querySelectorAll(".group-checkbox:checked"));
        const checkedVals = checkedBoxes.map((cb) => cb.value);
        const finalStr = checkedVals.includes("Todos") ? "Todos" : checkedVals.join(", ");

        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = finalStr;

        const textSpan = document.getElementById(textId);
        if (textSpan) {
            textSpan.innerText = finalStr || "—";
            textSpan.className = `text-[12px] font-black truncate pr-4 ${finalStr ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400 opacity-40"}`;
        }
    };

    window.handleSheetSingleSelectToggle = (_el, val, hiddenId, textId, dropdownId) => {
        const container = document.getElementById(dropdownId);
        if (!container) return;

        // Visual feedback: Update radio state
        container.querySelectorAll("input.group-checkbox").forEach((cb) => {
            cb.checked = cb.value === val;
        });

        // Forced reactivity for UI tokens
        const allLabels = container.querySelectorAll("label.group\\/chk");
        allLabels.forEach((label) => {
            const cb = label.querySelector("input");
            const peerUi = label.querySelector(".peer-ui");
            const icon = peerUi?.querySelector("i");
            if (cb && peerUi && icon) {
                if (cb.checked) {
                    peerUi.classList.add("bg-blue-600", "border-blue-600");
                    icon.style.opacity = "1";
                } else {
                    peerUi.classList.remove("bg-blue-600", "border-blue-600");
                    icon.style.opacity = "0";
                }
            }
        });

        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = val;

        const textSpan = document.getElementById(textId);
        if (textSpan) {
            textSpan.innerText = val || "—";
            textSpan.className = `text-[12px] font-black truncate pr-4 ${val ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400 opacity-40"}`;
        }

        // Auto-close for single select UX
        setTimeout(() => window.cerrarMenuDesplegable(null, dropdownId), 180);
    };

    window.changeTerritorySort = (e, dayIdx, turnoId, criteria) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        window._progCache.territorySortOrder = criteria;

        const btnNumero = document.getElementById("sort-btn-numero");
        const btnAntiguos = document.getElementById("sort-btn-antiguos");

        if (btnNumero && btnAntiguos) {
            if (criteria === "numero") {
                btnNumero.className =
                    "px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all duration-200 bg-white dark:bg-[#1a202c] text-slate-800 dark:text-white shadow-sm";
                btnAntiguos.className =
                    "px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all duration-200 text-slate-500 hover:text-slate-800 dark:hover:text-white";
            } else {
                btnNumero.className =
                    "px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all duration-200 text-slate-500 hover:text-slate-800 dark:hover:text-white";
                btnAntiguos.className =
                    "px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all duration-200 bg-white dark:bg-[#1a202c] text-slate-800 dark:text-white shadow-sm";
            }
        }

        window.renderTerritoriosDropdownList(dayIdx, turnoId);
    };

    window.renderTerritoriosDropdownList = (dayIdx, turnoId) => {
        const listContainer = document.getElementById("territorios-list-container");
        if (!listContainer) return;

        const hiddenInput = document.getElementById("select-territorio");
        const currentVal = hiddenInput ? hiddenInput.value : "";
        const currentSelection = parseTerritorioSelection(currentVal);

        const sortCriteria = window._progCache.territorySortOrder || "numero";

        // 1. Group and deduplicate territories by number to consolidate their manzanas
        const groupedTs = {};
        (window._progCache.territorios || []).forEach((t) => {
            const num = String(t.numero || "").trim();
            if (!groupedTs[num]) {
                groupedTs[num] = { ...t, numero: num };
            } else {
                const currentMzs = (groupedTs[num].manzanas || "")
                    .split(/[,;/]/)
                    .map((m) => m.trim())
                    .filter(Boolean);
                const newMzs = (t.manzanas || "")
                    .split(/[,;/]/)
                    .map((m) => m.trim())
                    .filter(Boolean);
                const merged = Array.from(new Set([...currentMzs, ...newMzs])).sort((a, b) =>
                    a.localeCompare(b, undefined, { numeric: true }),
                );
                groupedTs[num].manzanas = merged.join(", ");
                if (t.is_incomplete) groupedTs[num].is_incomplete = true;
            }
        });
        const uniqueTs = Object.values(groupedTs);

        const processedTs = uniqueTs.map((t) => {
            const tNum = String(t.numero).trim();
            const s13Records = (window._progCache.historial || []).filter((h) => {
                const histNum = String(h.territorio_id || h.numero || "").trim();
                const hasFecha = h.fecha_entrega && String(h.fecha_entrega).trim() !== "";
                const isCompleted = h.estado === "Completado" || hasFecha;
                return histNum === tNum && isCompleted;
            });

            let latestFechaFormatted = "NUNCA";
            let timestamp_ultima_fecha = 0;

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
                    latestFechaFormatted = `${day}/${month}/${year}`;
                }
            }

            const labelUltimaVez =
                latestFechaFormatted === "NUNCA" ? "ÚLTIMA VEZ: NUNCA" : `Última vez: ${latestFechaFormatted}`;

            return {
                ...t,
                timestamp_ultima_fecha,
                labelUltimaVez,
            };
        });

        if (sortCriteria === "antiguos") {
            processedTs.sort((a, b) => a.timestamp_ultima_fecha - b.timestamp_ultima_fecha);
        } else {
            processedTs.sort((a, b) => {
                const na = parseInt(String(a.numero).match(/\d+/), 10) || 0;
                const nb = parseInt(String(b.numero).match(/\d+/), 10) || 0;
                return na - nb;
            });
        }

        const occupancy = getWeekOccupancy(programa, dayIdx, turnoId);

        const dropsHtml = processedTs
            .map((t) => {
                const tNum = String(t.numero);
                const manzanas = getEffectiveManzanas(t);
                const sel = currentSelection[tNum] || { blocks: new Set(), isFull: false };
                const occ = occupancy[tNum] || { blocks: new Set(), isFull: false };

                // Combined occupancy: other days + current slot selection
                const combinedBlocks = new Set([...occ.blocks, ...sel.blocks]);
                const isCombinedFull =
                    occ.isFull || sel.isFull || (manzanas.length > 0 && manzanas.every((m) => combinedBlocks.has(m)));

                let badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
                let badgeText = "Libre";

                if (isCombinedFull) {
                    badgeClass = "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400";
                    badgeText = "Ocupado";
                } else if (combinedBlocks.size > 0) {
                    badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
                    badgeText = "Parcial";
                }

                const isChecked = sel.isFull || (manzanas.length > 0 && manzanas.every((m) => sel.blocks.has(m)));

                return `
                <div class="territorio-group p-3 border-b border-slate-50 dark:border-white/5 last:border-0">
                    <div class="flex items-center justify-between mb-2">
                        <label class="flex items-center gap-3 cursor-pointer group/selector relative">
                            <input type="checkbox" 
                                   onchange="window.handleHierarchicalToggle(this, '${tNum}', true, null, '${turnoId}')"
                                   ${isChecked ? "checked" : ""} 
                                   class="absolute opacity-0 w-6 h-6 z-10 cursor-pointer">
                            <div class="w-5 h-5 rounded border-2 border-slate-300 dark:border-white/20 ${isChecked ? "bg-blue-600 border-blue-600" : ""} flex items-center justify-center transition-all peer-ui">
                                <i class="fas fa-check text-[10px] text-slate-800 dark:text-slate-100 transition-opacity" style="opacity: ${isChecked ? "1" : "0"};"></i>
                            </div>
                            <div class="flex flex-col">
                                <div class="flex items-center gap-2">
                                    <span class="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">Territorio ${tNum}</span>
                                    ${
                                        t.is_incomplete
                                            ? `
                                        <span class="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20 text-[7px] font-black uppercase tracking-wider rounded-md flex items-center gap-1">
                                            <i class="fas fa-puzzle-piece text-[8px] animate-pulse"></i> Incompleto
                                        </span>
                                    `
                                            : ""
                                    }
                                </div>
                                <span class="text-[7.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                                    ${t.labelUltimaVez}
                                </span>
                            </div>
                        </label>
                        <span class="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${badgeClass}">${badgeText}</span>
                    </div>
                    
                    <div class="grid grid-cols-3 sm:grid-cols-4 gap-1.5 ml-8">
                        ${manzanas
                            .map((m) => {
                                const isMSelected = sel.isFull || sel.blocks.has(m);
                                const isMOccupied = occ.isFull || occ.blocks.has(m);

                                // Style occupied apples with line-through and rose border, but keep them clickable and selectable!
                                const occupiedStyle = isMOccupied
                                    ? "line-through decoration-rose-500 decoration-2"
                                    : "";
                                const occupiedBg =
                                    isMOccupied && !isMSelected
                                        ? "border-rose-350 dark:border-rose-900/50 bg-rose-500/5"
                                        : "";

                                return `
                                <div onclick="window.handleHierarchicalToggle(this, '${tNum}', false, '${m}', '${turnoId}')" 
                                     class="block-chip px-3 py-1 ${isMSelected ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-blue-50 hover:border-blue-300"} ${occupiedBg} border rounded-lg text-[9px] font-semibold cursor-pointer transition-all text-center select-none ${occupiedStyle}"
                                     data-selected="${isMSelected}">
                                    ${m}
                                </div>`;
                            })
                            .join("")}
                    </div>
                </div>`;
            })
            .join("");

        listContainer.innerHTML = dropsHtml;
    };

    window.handleHierarchicalToggle = (el, tNum, isHeader, blockName, currentTurnId) => {
        const hiddenInput = document.getElementById("select-territorio");
        const textDisplay = document.getElementById("selected-territorio-text");
        if (!hiddenInput) return;

        const selection = parseTerritorioSelection(hiddenInput.value);
        const t = window._progCache.territorios.find((x) => String(x.numero) === String(tNum));
        if (!t) return;
        const manzanas = getEffectiveManzanas(t);
        const occupancy = getWeekOccupancy(programa, activeDayIndex, currentTurnId);

        if (!selection[tNum]) selection[tNum] = { blocks: new Set(), isFull: false };

        if (isHeader) {
            const isChecked = el.checked;
            if (isChecked) {
                // Select all blocks including busy ones to allow full override
                if (manzanas.length === 0) {
                    selection[tNum].isFull = true;
                } else {
                    manzanas.forEach((m) => selection[tNum].blocks.add(m));
                    selection[tNum].isFull = true;
                }
            } else {
                delete selection[tNum];
            }
        } else {
            // Pure toggle
            const isCurrentlySelected =
                selection[tNum] && (selection[tNum].isFull || selection[tNum].blocks.has(blockName));
            if (isCurrentlySelected) {
                selection[tNum].blocks.delete(blockName);
                selection[tNum].isFull = false;
                if (selection[tNum].blocks.size === 0) delete selection[tNum];
            } else {
                if (!selection[tNum]) selection[tNum] = { blocks: new Set(), isFull: false };
                selection[tNum].blocks.add(blockName);
                if (manzanas.length > 0 && manzanas.every((m) => selection[tNum].blocks.has(m))) {
                    selection[tNum].isFull = true;
                }
            }
        }

        const finalVal = formatTerritorioSelection(selection);
        hiddenInput.value = finalVal;
        if (textDisplay) {
            textDisplay.innerText = finalVal || "—";
            textDisplay.className = `text-[12px] font-black truncate pr-4 ${finalVal ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400 opacity-40"}`;
        }

        // Re-render the dropdown content to reflect changes immediately
        const dropdown = document.getElementById("sheet-territorio-dropdown");
        if (dropdown) {
            // Find the specific territory group and update its UI
            const groups = dropdown.querySelectorAll(".territorio-group");
            groups.forEach((group) => {
                const title = group.querySelector("span.font-black")?.innerText || "";
                const numMatch = title.match(/\d+/);
                if (numMatch && numMatch[0] === tNum) {
                    const selData = selection[tNum] || { blocks: new Set(), isFull: false };
                    const occData = occupancy[tNum] || { blocks: new Set(), isFull: false };

                    // Update Header Checkbox
                    const cb = group.querySelector('input[type="checkbox"]');
                    const peerUi = group.querySelector(".peer-ui");
                    const checkIcon = peerUi.querySelector("i");
                    const isNowChecked =
                        selData.isFull || (manzanas.length > 0 && manzanas.every((m) => selData.blocks.has(m)));

                    if (cb) cb.checked = !!isNowChecked;
                    if (peerUi) {
                        peerUi.classList.toggle("bg-blue-600", !!isNowChecked);
                        peerUi.classList.toggle("border-blue-600", !!isNowChecked);
                        checkIcon.style.opacity = isNowChecked ? "1" : "0";
                    }

                    // Update Chips
                    const chips = group.querySelectorAll(".block-chip");
                    chips.forEach((chip) => {
                        const mName = chip.innerText.trim();
                        const isSelected = selData.isFull || selData.blocks.has(mName);
                        const isMOccupied = occData.isFull || occData.blocks.has(mName);

                        chip.dataset.selected = !!isSelected;

                        const occupiedStyle = isMOccupied ? "line-through decoration-rose-500 decoration-2" : "";
                        const occupiedBg =
                            isMOccupied && !isSelected ? "border-rose-350 dark:border-rose-900/50 bg-rose-500/5" : "";

                        chip.className = `block-chip px-3 py-1 ${isSelected ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-blue-50 hover:border-blue-300"} ${occupiedBg} border rounded-lg text-[9px] font-semibold cursor-pointer transition-all text-center select-none ${occupiedStyle}`;
                    });

                    // Update Badge (Reactively update Libre/Parcial/Ocupado combining week + selection)
                    const badge = group.querySelector("span.rounded-full");
                    if (badge) {
                        const combinedBlocks = new Set([...occData.blocks, ...selData.blocks]);
                        const isCombinedFull =
                            occData.isFull ||
                            selData.isFull ||
                            (manzanas.length > 0 && manzanas.every((m) => combinedBlocks.has(m)));

                        let badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
                        let badgeText = "Libre";

                        if (isCombinedFull) {
                            badgeClass = "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400";
                            badgeText = "Ocupado";
                        } else if (combinedBlocks.size > 0) {
                            badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
                            badgeText = "Parcial";
                        }

                        badge.className = `px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${badgeClass}`;
                        badge.innerText = badgeText;
                    }
                }
            });
        }
    };

    window.limpiarTerritorio = () => {
        const hiddenInput = document.getElementById("select-territorio");
        const textDisplay = document.getElementById("selected-territorio-text");
        if (hiddenInput) hiddenInput.value = "";
        if (textDisplay) {
            textDisplay.innerText = "—";
            textDisplay.className =
                "text-[12px] font-black truncate pr-4 text-slate-600 dark:text-slate-400 opacity-40";
        }

        const dropdown = document.getElementById("sheet-territorio-dropdown");
        if (dropdown) {
            // Uncheck all master checkboxes and chips
            dropdown.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                cb.checked = false;
                const peer = cb.closest("label").querySelector(".peer-ui");
                if (peer) {
                    peer.classList.remove("bg-blue-600", "border-blue-600");
                    const icon = peer.querySelector("i");
                    if (icon) icon.style.opacity = "0";
                }
            });
            dropdown.querySelectorAll(".block-chip").forEach((chip) => {
                chip.dataset.selected = "false";
                chip.className =
                    "block-chip px-3 py-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-blue-50 hover:border-blue-300 border rounded-lg text-[9px] font-semibold cursor-pointer transition-all text-center select-none";
            });
        }
        showNotification("Selección de territorio limpia.");
    };

    window.updateWeekDataSheet = async (dayIdx, turnoId, fieldId, val) => {
        programa.dias[dayIdx][turnoId][fieldId] = val || "";
        if (programa.isFormalized) programa.isFormalized = false;
        try {
            await saveProgramaSemanal(programa.id, programa);
            // Si cambia la hora, afecta visualmente la etiqueta del turno, forzamos re-render
            if (fieldId === "hora") renderTable();
            // Also re-render list behind the sheet gently
            else renderTable();
        } catch (e) {
            console.error(e);
            showNotification("Error guardando dato", "error");
        }
    };

    window.toggleJornadaDropdown = (e) => {
        if (e) e.stopPropagation();
        const drop = document.getElementById("jornada-dropdown");
        if (drop) {
            const isHidden = drop.classList.contains("hidden");
            drop.classList.toggle("hidden");

            if (!isHidden) {
                const closeJornada = (evt) => {
                    const btn = e.currentTarget || e.target;
                    if (drop && !drop.contains(evt.target) && !btn.contains(evt.target)) {
                        drop.classList.add("hidden");
                        document.removeEventListener("click", closeJornada);
                    }
                };
                setTimeout(() => document.addEventListener("click", closeJornada), 10);
            }
        }
    };

    window.selectJornada = (dayIdx, turnoId, newBaseType) => {
        const input = document.getElementById("select-turno-id");
        if (input) input.value = newBaseType;

        const label = document.getElementById("modal-shift-label");
        if (label) {
            const optLabel = { manana: "Mañana", tarde: "Tarde", noche: "Noche", zoom: "Zoom" }[newBaseType];
            label.innerText = optLabel;
        }

        window.updateModalTurnoStyle(dayIdx, turnoId, newBaseType);
        document.getElementById("jornada-dropdown")?.classList.add("hidden");
    };

    window.updateModalTurnoStyle = (_dayIdx, _turnoId, newBaseType) => {
        // Obtenemos el styling basado en el nuevo tipo de turno
        // Solo para feedback visual inmediato en el modal
        const styling = getTurnoStyling(newBaseType, document.getElementById("input-hora")?.value);
        const iconContainer = document.querySelector("#modal-sheet header .shadow-inner");
        const icon = iconContainer.querySelector("i");

        iconContainer.className = `w-10 h-10 ${styling.bg} ${styling.color} rounded-xl flex items-center justify-center shadow-inner transition-colors duration-300`;
        icon.className = `fas ${styling.icon}`;

        // Re-validar incongruencias en tiempo real si es posible (opcional)
    };

    window.saveTurnDataFromSheet = async (dayIdx, turnoId) => {
        const newTurnoBase = document.getElementById("select-turno-id")?.value || turnoId;
        const horaVal = document.getElementById("input-hora")?.value || "";
        const facetaVal = document.getElementById("select-faceta")?.value || "";

        // Si el usuario cambió la base de la jornada (ej de Zoom a Mañana)
        // debemos ver si ya existe ese ID o generar uno nuevo si es necesario.
        // Por ahora, si es el ID original (ej: manana), lo sobreescribimos.
        // Si cambió la base, re-mapeamos el ID si es posible.

        const payload = {
            lugar: document.getElementById("input-lugar")?.value || "",
            hora: horaVal,
            conductor: document.getElementById("select-conductor")?.value || "",
            auxiliar: document.getElementById("select-auxiliar")?.value || "",
            faceta: facetaVal,
            territorio: document.getElementById("select-territorio")?.value || "",
            grupos: document.getElementById("select-grupos")?.value || "",
        };

        console.log("💾 [Save Payload]:", payload);
        const safePayload = JSON.parse(JSON.stringify(payload));

        const dia = programa.dias[dayIdx];
        const oldData = dia[turnoId] || {};

        // --- CAMBIO 2: Detección de cambios de territorio para liberación ---
        const oldTerrs = String(oldData.territorio || "")
            .split(/[,;/]/)
            .map((t) => t.trim())
            .filter(Boolean);
        const newTerrs = String(safePayload.territorio || "")
            .split(/[,;/]/)
            .map((t) => t.trim())
            .filter(Boolean);
        const removedTerrs = oldTerrs.filter((t) => !newTerrs.includes(t));

        // REGLA DE TRASPASO DE JORNADA:
        // Si el ID de turno cambió (ej de manana_2 a noche_2), debemos mover el objeto.
        let targetId = turnoId;
        if (!turnoId.includes(newTurnoBase)) {
            // Buscamos un nuevo ID único para la nueva base
            let suffix = 1;
            targetId = suffix === 1 ? newTurnoBase : `${newTurnoBase}_${suffix}`;
            while (dia[targetId] && targetId !== turnoId) {
                suffix++;
                targetId = `${newTurnoBase}_${suffix}`;
            }
            // Borrar el anterior
            delete dia[turnoId];
        }

        dia[targetId] = {
            ...oldData,
            ...safePayload,
        };

        try {
            showNotification("Sincronizando...", "info");

            // Invalidate formalization state strictly before saving
            programa.isFormalized = false;
            await saveProgramaSemanal(programa.id, programa);

            // --- CAMBIO 1: Sincronización Automática S-13 ---
            // A) Liberar territorios eliminados
            if (removedTerrs.length > 0) {
                console.log("🧹 Liberando territorios eliminados:", removedTerrs);
                await liberarAsignacionesDeSalida(removedTerrs, programa.id);
            }

            // B) Sincronizar territorios actuales (Nuevos o actualizados)
            const resolvedDateISO = new Date(`${dia.fecha}T12:00:00Z`).toISOString();
            await sincronizarAsignacionesSalida(
                {
                    ...dia[targetId],
                    turnoId: targetId,
                },
                programa.id,
                resolvedDateISO,
            );

            // Critical Refresh: Re-render button and table
            checkFormalizationStatus();
            await renderTable();

            const closeBtn = document.getElementById("modal-sheet-close");
            if (closeBtn) closeBtn.click();
            showNotification("Turno actualizado", "success");
        } catch (e) {
            console.error("❌ [Save error]:", e);
            showNotification("Error al guardar cambios", "error");
        }
    };

    window.setActiveDay = (idx) => {
        activeDayIndex = idx;
        renderDaySelector();
        renderTable();
    };

    window.toggleTurnFilter = (id) => {
        if (activeTurns.has(id)) activeTurns.delete(id);
        else activeTurns.add(id);
        renderFilters();
        renderTable();
    };

    window.updateWeekData = async (dayIdx, turnoId, fieldId, val) => {
        // Optimistic update with fallback
        programa.dias[dayIdx][turnoId][fieldId] = val || "";
        if (programa.isFormalized) programa.isFormalized = false;

        // Update visual value if it was a custom selector (territorio)
        const valEl = container.querySelector(`#val-${fieldId}-${dayIdx}-${turnoId}`);
        if (valEl) {
            valEl.innerText = val || "—";
            valEl.className = `text-[11px] font-black truncate ${val ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400 opacity-40"}`;
            if (fieldId === "territorio") {
                valEl.parentElement.dataset.current = val || "";
            }
        }

        // Silent background save
        saveProgramaSemanal(programa.id, programa)
            .then(() => {
                checkFormalizationStatus();
            })
            .catch((e) => {
                console.error("Error background saving:", e);
                showNotification("Error al sincronizar cambio", "error");
            });

        // Update status badge if territory or conductor changed
        if (fieldId === "territorio" || fieldId === "conductor") {
            const badgeContainer = container.querySelector(`#status-badge-${dayIdx}-${turnoId}`);
            if (badgeContainer) {
                const dia = programa.dias[dayIdx];
                const turnData = dia[turnoId] || {};
                const v = turnData?.territorio;
                let tNums = [];
                try {
                    const res = splitTerritories ? splitTerritories(v || "") : null;
                    tNums = Array.from(
                        new Set(
                            Array.isArray(res)
                                ? res
                                : String(v || "")
                                      .split(/[,;/]/)
                                      .map((n) => n.trim())
                                      .filter(Boolean),
                        ),
                    );
                } catch (e) {
                    console.warn("Error parsing territory for badge update", e);
                    tNums = String(v || "")
                        .split(/[,;/]/)
                        .map((n) => n.trim())
                        .filter(Boolean);
                }
                const conductor = turnData?.conductor;

                const results = tNums.map((n) => getTStatus(n, conductor, dia?.fecha, turnoId));
                const allSync = results.every((r) => r?.isSync);
                const conflict = results.find((r) => r?.isConflict);

                if (!v) {
                    badgeContainer.innerHTML = "";
                    return;
                }

                if (allSync) {
                    badgeContainer.innerHTML = `<button class="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all">
                                                    <i class="fas fa-check-circle"></i> LISTO
                                                </button>`;
                } else if (conflict?.details) {
                    const statusText = String(conflict.details.estado || "OCUPADO").toUpperCase();
                    badgeContainer.innerHTML = `<button onclick="window.showConflictDetails(${dayIdx}, '${turnoId}')" 
                                                        class="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-500 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-all animate-pulse shadow-lg shadow-rose-500/10">
                                                    <i class="fas fa-exclamation-triangle"></i> ${statusText}
                                                </button>`;
                } else {
                    badgeContainer.innerHTML = `<button onclick="window.syncAssignmentFromProg(${dayIdx}, '${turnoId}')" 
                                                        class="flex items-center gap-1.5 px-3 py-1 bg-blue-600/10 text-blue-600 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all shadow-lg shadow-blue-500/10 group">
                                                    <i class="fas fa-link group-hover:rotate-12 transition-transform"></i> ASIGNAR
                                                </button>`;
                }
            }
        }

        // Full re-render if time changed to update icon/label in header
        if (fieldId === "hora") {
            renderTable();
        }
    };

    window.toggleTurnEnabled = async (dayIdx, turnoId) => {
        const dia = programa.dias[dayIdx];
        if (!dia[turnoId]) dia[turnoId] = {};

        dia[turnoId].enabled = !(dia[turnoId].enabled !== false);

        renderTable();
        saveProgramaSemanal(programa.id, programa).catch((e) => console.error("Error toggling turn:", e));

        const action = dia[turnoId].enabled ? "activada" : "desactivada";
        showNotification(`Jornada ${action} con éxito`, "info");
    };

    window.clearTurnData = async (dayIdx, turnoId) => {
        showCustomConfirm("¿Eliminar por completo este horario de la jornada?", async () => {
            delete programa.dias[dayIdx][turnoId];
            if (programa.isFormalized) programa.isFormalized = false;

            try {
                showNotification("Eliminando horario...", "info");
                await saveProgramaSemanal(programa.id, programa);
                checkFormalizationStatus();
                renderTable();
                showNotification("Horario eliminado", "success");
            } catch (e) {
                console.error(e);
                showNotification("Error al eliminar", "error");
            }
        });
    };

    window.addNewSlot = (dayIdx) => {
        const modalDiv = document.getElementById("modal-container");
        modalDiv.classList.remove("hidden");
        modalDiv.innerHTML = `
            <div class="p-8 space-y-6 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] max-w-sm w-full shadow-2xl animate-scale-in flex flex-col mx-auto my-auto relative pointer-events-auto">
                <header class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 text-xl">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Nuevo Horario</h3>
                        <p class="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Selecciona el tipo de salida</p>
                    </div>
                </header>
                <div class="grid grid-cols-2 gap-3">
                    ${[
                        {
                            id: "manana",
                            label: "Mañana",
                            icon: "fa-sun",
                            color: "text-amber-500",
                            bg: "bg-amber-500/10",
                            border: "hover:border-amber-500",
                        },
                        {
                            id: "tarde",
                            label: "Tarde",
                            icon: "fa-cloud-sun",
                            color: "text-orange-500",
                            bg: "bg-orange-500/10",
                            border: "hover:border-orange-500",
                        },
                        {
                            id: "noche",
                            label: "Noche",
                            icon: "fa-moon",
                            color: "text-indigo-500",
                            bg: "bg-indigo-500/10",
                            border: "hover:border-indigo-500",
                        },
                        {
                            id: "zoom",
                            label: "Zoom",
                            icon: "fa-video",
                            color: "text-emerald-500",
                            bg: "bg-emerald-500/10",
                            border: "hover:border-emerald-500",
                        },
                    ]
                        .map(
                            (t) => `
                        <button onclick="window.createSlot(${dayIdx}, '${t.id}')" class="flex flex-col items-center gap-3 p-5 rounded-3xl border border-slate-100 dark:border-white/5 ${t.border} transition-all group bg-slate-50 dark:bg-white/[0.02]">
                            <div class="w-10 h-10 rounded-xl ${t.bg} ${t.color} flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                                <i class="fas ${t.icon}"></i>
                            </div>
                            <span class="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">${t.label}</span>
                        </button>
                    `,
                        )
                        .join("")}
                </div>
                <button onclick="window.hideModal('modal-container')" class="w-full py-4 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all mt-4">Cancelar</button>
            </div>
        `;
    };

    window.createSlot = async (dayIdx, baseType) => {
        window.hideModal("modal-container");
        const dia = programa.dias[dayIdx];

        let newTurnoId = baseType;
        let suffix = 2;
        while (dia[newTurnoId]) {
            newTurnoId = `${baseType}_${suffix}`;
            suffix++;
        }

        dia[newTurnoId] = {};
        if (programa.isFormalized) programa.isFormalized = false;

        try {
            showNotification("Agregando horario...", "info");
            await saveProgramaSemanal(programa.id, programa);
            renderTable();
            window.openEditTurnoSheet(dayIdx, newTurnoId);
        } catch (e) {
            console.error(e);
            showNotification("Error creando horario", "error");
        }
    };

    window.showConflictDetails = (dayIdx, turnoId) => {
        const dia = programa.dias[dayIdx];
        const data = dia[turnoId];
        let tNums = [];
        try {
            tNums = Array.from(
                new Set(
                    splitTerritories
                        ? splitTerritories(data.territorio || "")
                        : String(data.territorio || "")
                              .split(/[,;/]/)
                              .map((n) => n.trim())
                              .filter(Boolean),
                ),
            );
        } catch (_e) {
            tNums = String(data.territorio || "")
                .split(/[,;/]/)
                .map((n) => n.trim())
                .filter(Boolean);
        }
        const conductor = data.conductor;
        const results = tNums.map((n) => getTStatus(n, conductor, dia.fecha, turnoId));
        const conflicts = results.filter((r) => r.isConflict);

        if (conflicts.length === 0) return;

        showModal(
            `
            <div class="p-8 space-y-8 bg-white dark:bg-[#0a0f18] rounded-[2.5rem] max-w-lg border border-rose-500/20 animate-scale-in">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-rose-500/10 rounded-3xl flex items-center justify-center text-3xl text-rose-500 shadow-inner">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Conflicto detectado</h3>
                        <p class="text-[10px] text-rose-500 font-bold uppercase tracking-[0.3em] mt-1">S-13 ya tiene otras asignaciones</p>
                    </div>
                </header>

                <div class="space-y-4">
                    <p class="text-[11px] font-bold text-slate-500 uppercase px-1">Se han detectado los siguientes conflictos en el inventario:</p>
                    <div class="space-y-2">
                        ${conflicts
                            .map(
                                (c) => `
                            <div class="flex items-center justify-between p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10 transition-all hover:bg-rose-500/10">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 bg-rose-500 text-white flex items-center justify-center rounded-xl font-black text-xs shadow-lg shadow-rose-500/20">#${c.numero}</div>
                                    <div class="flex flex-col">
                                        <span class="text-xs font-black text-slate-800 dark:text-white uppercase leading-tight">${c.details.conductor}</span>
                                        <span class="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mt-0.5">${UIHelpers.fmtDateAt(c.details.fecha)} • ${c.details.turno || "Sin Turno"}</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 bg-rose-500/10 text-rose-500 text-[8px] font-black rounded-lg uppercase">Ocupado</span>
                                </div>
                            </div>
                        `,
                            )
                            .join("")}
                    </div>
                </div>

                <div class="p-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-slate-200 dark:border-white/10 relative overflow-hidden group">
                    <div class="absolute -right-4 -top-4 w-20 h-20 bg-rose-500/5 rotate-12 rounded-3xl group-hover:scale-110 transition-transform"></div>
                    <p class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i class="fas fa-shield-alt text-rose-500"></i> ¿Deseas corregir el S-13?
                    </p>
                    <p class="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                        Al <b>Forzar Asignación</b>, se liberarán inmediatamente estos territorios de sus poseedores actuales para asignarlos a <b>${conductor}</b> según este programa.
                    </p>
                </div>

                <div class="flex gap-4 pt-4 shrink-0">
                    <button onclick="window.hideModal('modal-container')" class="flex-1 min-w-0 py-5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Ignorar</button>
                    <button id="confirm-force-sync" class="flex-[2.5] py-5 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all group">
                        <i class="fas fa-bolt mr-2 group-hover:animate-bounce"></i> FORZAR ASIGNACIÓN
                    </button>
                </div>
            </div>
        `,
            (modal) => {
                modal.querySelector("#confirm-force-sync").onclick = async () => {
                    window.hideModal("modal-container");
                    await window.syncAssignmentFromProg(dayIdx, turnoId, true);
                };
            },
        );
    };

    window.syncAssignmentFromProg = async (dayIdx, turnoId, force = false) => {
        const dia = programa.dias[dayIdx];
        const data = dia[turnoId];
        const rawNum = data.territorio;
        const cond = data.conductor;

        if (!rawNum || !cond) return showNotification("Faltan datos en el programa para asignar", "warning");

        const tNums = Array.from(
            new Set(
                String(rawNum)
                    .split(/[,;/]/)
                    .map((n) => n.trim())
                    .filter(Boolean),
            ),
        );
        const freshT = await getTerritorios();
        const foundTs = tNums.map((num) => freshT.find((t) => t.numero === num)).filter(Boolean);

        if (foundTs.length === 0) return showNotification("Territorios no encontrados", "error");

        if (force) {
            // Logic for force: Return conflicting territories first
            showNotification("Corrigiendo conflictos...", "info");
            const conflictTs = foundTs.filter((t) => t.estado === "Asignado");
            for (const t of conflictTs) {
                await returnTerritorio(
                    t.id,
                    "Liberación forzada por conflicto en programa semanal",
                    new Date().toISOString(),
                    "Disponible",
                );
            }
        }

        showModal(
            `
            <div class="p-8 space-y-10">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-3xl text-primary shadow-inner">
                        <i class="fas fa-link"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Formalizar Asignación</h3>
                        <p class="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Sincronización Inteligente de S-13</p>
                    </div>
                </header>

                <div class="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] border border-slate-200 dark:border-white/10 space-y-4">
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest">Publicador</span>
                        <span class="font-black text-slate-800 dark:text-white uppercase">${cond}</span>
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest">Territorios</span>
                        <div class="flex gap-2">
                            ${foundTs.map((t) => `<span class="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg">#${t.numero}</span>`).join("")}
                        </div>
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest">Salida Programada</span>
                        <span class="font-black text-slate-600 dark:text-gray-300 uppercase">${dia.nombre} (${dia.fecha})</span>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <label class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 block">¿Cuándo se asignó físicamente?</label>
                        <span class="text-[9px] font-bold text-primary uppercase bg-primary/5 px-2 py-0.5 rounded">Sugerencia S-13: Domingo anterior</span>
                    </div>
                    <input type="date" id="sync-asig-date" value="${(() => {
                        const d = new Date(currentWeekStart);
                        d.setDate(d.getDate() - 1);
                        return d.toISOString().split("T")[0];
                    })()}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 rounded-2xl text-[14px] font-black text-primary outline-none focus:border-primary transition-all uppercase shadow-inner">
                </div>

                <div class="flex gap-4 pt-6 border-t border-slate-50 dark:border-white/5">
                    <button onclick="window.hideModal('modal-container')" class="flex-1 min-w-0 py-5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
                    <button id="confirm-sync-asig" class="flex-[2] py-5 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all">ASIGNAR FORMALMENTE</button>
                </div>
            </div>
        `,
            (modal) => {
                modal.querySelector("#confirm-sync-asig").onclick = async (e) => {
                    const date = modal.querySelector("#sync-asig-date").value;
                    if (!date) return;

                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

                    const assignmentDateISO = new Date(`${date}T12:00:00Z`).toISOString();
                    const preachingDateISO = new Date(`${dia.fecha}T12:00:00Z`).toISOString();

                    await syncSlotWithTerritories(
                        programa.id,
                        dayIdx,
                        turnoId,
                        {
                            ...data,
                            prog_sync: true,
                        },
                        preachingDateISO,
                        assignmentDateISO,
                    );

                    showNotification(`¡Asignación formalizada! (${foundTs.length} territorios)`, "success");
                    window.hideModal("modal-container");

                    // Refresh data and table
                    const updatedT = await getTerritorios();
                    territorios.length = 0;
                    territorios.push(...updatedT);
                    renderTable();
                };
            },
        );
    };

    window.openTerritorySelector = (dayIdx, turnoId, btn) => {
        // Extract all territories already in this week's program to highlight them
        const weekAssignments = [];
        if (programa?.dias) {
            programa.dias.forEach((d) => {
                ["manana", "tarde", "noche", "zoom"].forEach((turn) => {
                    const tStr = d[turn]?.territorio;
                    if (tStr) {
                        // Handle multiple territories like "1, 2(Mz 1), 3"
                        const matches = (tStr || "").matchAll(/(\d+)(?:\s*\(|$|[\s,;/])/g);
                        for (const match of matches) {
                            weekAssignments.push(match[1]);
                        }
                    }
                });
            });
        }

        showTerritorySelectionModal(
            btn.dataset.current || "",
            territorios,
            (res) => {
                const hidden = document.getElementById("select-territorio");
                if (hidden) hidden.value = res || "";

                // Actualizar visualmente el campo en el modal sheet
                const displaySpan = document.getElementById("val-territorio-modal");
                if (displaySpan) {
                    displaySpan.innerText = res || "—";
                    displaySpan.className = `text-[12px] font-black truncate ${res ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400 opacity-40"}`;
                }
                // Actualizar data-current del div clickeable para próximas aperturas
                if (btn) btn.dataset.current = res || "";

                window.updateWeekData(dayIdx, turnoId, "territorio", res);
            },
            "modal-container-nested",
            historial,
            weekAssignments,
        );
    };

    window.toggleShareMenu = (e) => {
        if (e) e.stopPropagation();
        const menu = document.getElementById("share-menu");
        if (menu) menu.classList.toggle("hidden");
    };

    // Close dropdown on outside click
    document.addEventListener("click", (event) => {
        const shareMenu = document.getElementById("share-menu");
        const shareContainer = document.getElementById("share-dropdown-container");
        if (shareMenu && !shareMenu.classList.contains("hidden")) {
            if (shareContainer && !shareContainer.contains(event.target)) {
                shareMenu.classList.add("hidden");
            }
        }
    });

    window.generarImagenPrograma = async (tipo, forceDownload = false) => {
        try {
            // 1. Ocultar menú y crear contenedor temporal
            const shareMenu = document.getElementById("share-menu");
            if (shareMenu) shareMenu.classList.add("hidden");

            const tempDiv = document.createElement("div");
            // TÉCNICA OFF-SCREEN FIXED:
            tempDiv.style.position = "fixed";
            tempDiv.style.top = "0";
            tempDiv.style.left = "200vw"; // Fuera de la vista horizontal
            tempDiv.style.width = "1200px";
            tempDiv.style.zIndex = "-9999";
            document.body.appendChild(tempDiv);

            // 2. Cargar HTML (Manejo de caché para asegurar que traiga las filas Zoom y color Domingo nuevas)
            const tipoPlural = tipo.endsWith("s") ? tipo : `${tipo}es`;
            const cacheBust = Date.now();
            const response = await fetch(`/templates/prog_${tipoPlural}.html?v=${cacheBust}`);
            if (!response.ok) throw new Error("No se encontró la plantilla HTML");
            tempDiv.innerHTML = await response.text();

            // Transformar la estructura nativa 'programa.dias' en el flat array esperado por el Smart Mapper
            const turnos = [];
            if (programa?.dias) {
                programa.dias.forEach((diaData) => {
                    const turnIds = Object.keys(diaData).filter((k) => k !== "nombre" && k !== "fecha");
                    // Sort keys to ensure correct sequential processing
                    const sortOrder = { manana: 1, tarde: 2, noche: 3, zoom: 4 };
                    const getOrder = (id) => sortOrder[id.split("_")[0]] || 99;
                    turnIds.sort((a, b) => getOrder(a) - getOrder(b) || a.localeCompare(b));

                    turnIds.forEach((id) => {
                        const t = diaData[id];
                        // CRITICAL FIX: Skip empty slots (e.g. Domingo has tarde/noche/zoom
                        // as empty objects that overwrite valid manana_2 data)
                        const hasData =
                            t && Object.values(t).some((v) => v !== "" && v !== null && v !== undefined && v !== false);
                        if (hasData) {
                            turnos.push({
                                dia: diaData.nombre,
                                jornada: id,
                                ...t,
                            });
                        }
                    });
                });
            }

            const gruposPorBloque = { m: new Set(), t: new Set(), n: new Set(), z: new Set() };
            let domingoNonZoomCount = 0;

            // 3. SMART MAPPER: Enrutar datos a las celdas exactas
            turnos.forEach((turno) => {
                if (!turno) return;

                // A. Detectar el Día (1 = Lunes, 7 = Domingo)
                let diaIndex = 1;
                const diaStr = String(turno.dia || turno.diaText || turno.diaSemana || "").toLowerCase();
                if (diaStr.includes("mar")) diaIndex = 2;
                else if (diaStr.includes("mie") || diaStr.includes("mié")) diaIndex = 3;
                else if (diaStr.includes("jue")) diaIndex = 4;
                else if (diaStr.includes("vie")) diaIndex = 5;
                else if (diaStr.includes("sab") || diaStr.includes("sáb")) diaIndex = 6;
                else if (diaStr.includes("dom")) diaIndex = 7;
                else if (diaStr.includes("lun")) diaIndex = 1;

                // B. Detectar el Bloque (m=mañana, t=tarde, n=noche, z=zoom)
                let bloque = "m";
                const jornadaStr = String(turno.jornada || turno.turno || turno.franja || "").toLowerCase();
                const lugarStr = String(turno.lugar || "").toLowerCase();
                const isDomingo = diaIndex === 7;

                if (lugarStr.includes("zoom") || jornadaStr.includes("zoom")) {
                    bloque = "z";
                } else if (isDomingo) {
                    // Especial DOMINGO: Asignar bloques secuencialmente para empaquetar hacia arriba
                    // en lugar de depender rígidamente de la clave de la jornada (ej: manana_2 en el centro)
                    domingoNonZoomCount++;
                    if (domingoNonZoomCount === 1) bloque = "m";
                    else if (domingoNonZoomCount === 2) bloque = "t";
                    else if (domingoNonZoomCount === 3) bloque = "n";
                    else bloque = "m"; // Fallback
                } else {
                    // Normal rest of days
                    if (jornadaStr.includes("tarde")) bloque = "t";
                    else if (jornadaStr.includes("noche")) bloque = "n";
                    else if (jornadaStr.includes("mañana") || jornadaStr.includes("manana")) bloque = "m";
                }

                // C. Inyectar datos en las celdas asegurando el centrado vertical
                const setCell = (idSuffix, valor) => {
                    if (!valor) return; // No sobrescribir celdas con valor vacío
                    const el = tempDiv.querySelector(`#${bloque}-${diaIndex}-${idSuffix}`);
                    if (el) {
                        el.innerHTML = valor;
                        el.style.verticalAlign = "middle";
                    }
                };

                setCell("lugar", turno.lugar);
                setCell("hora", turno.horario || turno.horarioText || turno.hora);
                setCell("conductor", turno.conductor);
                setCell("faceta", turno.faceta);
                setCell("territorio", turno.territorio);

                const auxiliarStr = Array.isArray(turno.auxiliares)
                    ? turno.auxiliares.join(", ")
                    : turno.auxiliares || turno.auxiliar || "";
                setCell("auxiliar", auxiliarStr);

                // D. Recopilar grupos del bloque para la celda combinada (rowspan)
                if (turno.grupo || turno.grupos) {
                    const gStr = String(turno.grupo || turno.grupos);
                    gStr.split(",").forEach((g) => {
                        const tag = g.trim();
                        if (tag.toLowerCase() === "todos") {
                            gruposPorBloque[bloque].add("Todos");
                        } else {
                            const num = tag.replace(/\D/g, ""); // Extract only digits
                            if (num) gruposPorBloque[bloque].add(num);
                        }
                    });
                }
            });

            // Inyectar específicamente los "Días + Fechas" en los encabezados si existen '#th-dia-X'
            if (programa?.dias) {
                programa.dias.forEach((dia, idx) => {
                    const dIdx = idx + 1;
                    const thEl = tempDiv.querySelector(`#th-dia-${dIdx}`);
                    if (thEl) {
                        let numDia = dia.fecha ? dia.fecha.split("-")[2] : "";
                        if (numDia) numDia = parseInt(numDia, 10).toString();
                        thEl.textContent = dia.nombre + (numDia ? ` ${numDia}` : "");
                    }
                });
            }

            // Obtener el total de grupos del sistema para la lógica de "Todos" (fallback 6)
            let finalGroupsCount = 6;
            try {
                if (typeof getGroupsConfig === "function") {
                    const cfg = await getGroupsConfig();
                    if (cfg && cfg.length > 0) finalGroupsCount = cfg.length;
                }
            } catch (e) {
                console.warn("No se pudo obtener grupos", e);
            }

            // 4. Inyectar los grupos unidos y ordenados
            Object.keys(gruposPorBloque).forEach((b) => {
                const gruposEl = tempDiv.querySelector(`#${b}-grupos`);
                if (gruposEl) {
                    const setGroups = gruposPorBloque[b];

                    if (setGroups.has("Todos") || setGroups.size >= finalGroupsCount) {
                        gruposEl.innerHTML = "Todos";
                    } else {
                        const arr = Array.from(setGroups)
                            .filter((x) => x !== "Todos")
                            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                        gruposEl.innerHTML = arr.length > 0 ? arr.join(", ") : "&nbsp;";
                    }
                    gruposEl.style.verticalAlign = "top"; // FIX: Datos de grupos alineados hacia arriba
                }
            });

            // Inyectar el rango de fechas en el título
            const rangoFechasEl = tempDiv.querySelector("#rango-fechas");
            if (rangoFechasEl) {
                const lblRange = document.querySelector("#week-range-label");
                rangoFechasEl.textContent =
                    window.programaData?.rangoFechas ||
                    window.currentWeekDataGlobal?.rangoFechas ||
                    (lblRange ? lblRange.innerText : "");
            }

            // 5. Tomar la foto de alta calidad
            const exportContainer = tempDiv.querySelector("#export-container");
            await new Promise((r) => setTimeout(r, 600)); // Delay para permitir el render del DOM

            // Usamos scale: 2 para calidad Retina/Impresión y windowWidth para evitar cortes
            const canvas = await html2canvas(exportContainer, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                windowWidth: 1200,
                width: 1200,
                windowHeight: exportContainer.scrollHeight + 100, // FIX CORTE VERTICAL
            });

            // IMPORTANTE: Limpiar el DOM y restaurar overflow
            tempDiv.remove();

            // 6. Compartir la imagen
            canvas.toBlob(async (blob) => {
                const file = new File([blob], `programa_${tipoPlural}.png`, { type: "image/png" });
                if (!forceDownload && navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ title: "Programa de Predicación", files: [file] });
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `programa_${tipoPlural}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showNotification("Programa descargado localmente", "success");
                }
            }, "image/png");
        } catch (error) {
            console.error("Error exportando imagen:", error);
            showNotification("Fallo al exportar", "error");
        }
    };

    window.openGroupSelector = async (dayIdx, turnoId) => {
        console.log("🛡️ [v2.4.1.9] Opening Multi-Group Selector...");
        const groups = await getGroupsConfig();
        const currentVal = programa.dias[dayIdx][turnoId].grupos || "";

        // Normalize: remove word "Grupo" if present to match keys
        const selected = new Set(
            (currentVal || "")
                .replace(/grupos?/gi, "")
                .split(/[,;y&]+/)
                .map((s) => s.trim())
                .filter(Boolean),
        );

        window.showModal(
            `
            <div class="flex flex-col max-h-[75vh] overflow-hidden animate-scale-in">
                <header class="p-5 pb-2 flex items-center gap-3 shrink-0">
                    <div class="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center text-lg text-indigo-500 shadow-inner">
                        <i class="fas fa-check-double"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none">Grupos</h3>
                        <p class="text-[7px] text-indigo-500 font-bold uppercase tracking-wider mt-0.5 opacity-60">Selección Múltiple</p>
                    </div>
                </header>

                <div class="flex-1 min-w-0 overflow-y-auto custom-scrollbar px-5 py-2">
                    <div class="grid grid-cols-1 gap-1.5" id="group-selection-grid">
                        <label class="group-item p-2.5 modern-card border-slate-100 dark:border-white/5 hover:border-indigo-500 transition-all cursor-pointer flex items-center gap-3 ${selected.has("Todos") ? "bg-indigo-500/5 border-indigo-500/50" : ""}">
                            <div class="relative w-4 h-4 shrink-0">
                                <input type="checkbox" class="group-checkbox absolute inset-0 opacity-0 cursor-pointer z-10" value="Todos" ${selected.has("Todos") ? "checked" : ""}>
                                <div class="check-box-ui w-4 h-4 border-2 border-slate-200 dark:border-white/10 rounded flex items-center justify-center transition-all ${selected.has("Todos") ? "bg-indigo-500 border-indigo-500" : ""}">
                                    <i class="fas fa-check text-[7px] text-slate-800 dark:text-slate-100 ${selected.has("Todos") ? "opacity-100" : "opacity-0"} transition-opacity"></i>
                                </div>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-none mb-0.5">Todos</p>
                                <p class="text-[7px] text-slate-600 dark:text-slate-400 font-medium uppercase tracking-widest leading-none">Salida General</p>
                            </div>
                        </label>

                        ${groups
                            .map((g) => {
                                const groupStr = g?.nombre || g?.numero_nombre || (g?.id ? `Grupo ${g.id}` : "");
                                const isSel =
                                    selected.has(groupStr) ||
                                    selected.has(g?.nombre || "") ||
                                    selected.has(String(g?.id || ""));
                                return `
                            <label class="group-item p-2.5 modern-card border-slate-100 dark:border-white/5 hover:border-indigo-500 transition-all cursor-pointer flex items-center gap-3 ${isSel ? "bg-indigo-500/5 border-indigo-500/50" : ""}">
                                <div class="relative w-4 h-4 shrink-0">
                                    <input type="checkbox" class="group-checkbox absolute inset-0 opacity-0 cursor-pointer z-10" value="${groupStr}" ${isSel ? "checked" : ""}>
                                    <div class="check-box-ui w-4 h-4 border-2 border-slate-200 dark:border-white/10 rounded flex items-center justify-center transition-all ${isSel ? "bg-indigo-500 border-indigo-500" : ""}">
                                        <i class="fas fa-check text-[7px] text-slate-800 dark:text-slate-100 ${isSel ? "opacity-100" : "opacity-0"} transition-opacity"></i>
                                    </div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-none mb-0.5">${groupStr}</p>
                                    <p class="text-[7px] text-slate-600 dark:text-slate-400 font-medium uppercase tracking-widest leading-none truncate max-w-[150px]">${g.casa_salida || "—"}</p>
                                </div>
                            </label>
                        `;
                            })
                            .join("")}
                    </div>
                </div>

                <div class="p-5 pt-3 border-t border-slate-50 dark:border-white/5 flex gap-2 shrink-0">
                    <button onclick="window.hideModal('modal-container-nested')" class="flex-1 min-w-0 py-3 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black rounded-lg text-[8px] uppercase tracking-widest hover:bg-slate-100 transition-all">Cancelar</button>
                    <button id="confirm-groups" class="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg text-[8px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Asignar Grupos</button>
                </div>
            </div>
        `,
            (modal) => {
                modal.querySelectorAll(".group-checkbox").forEach((cb) => {
                    cb.onchange = (e) => {
                        const label = e.target.closest(".group-item");
                        const ui = label.querySelector(".check-box-ui");
                        const icon = ui.querySelector("i");

                        if (e.target.checked) {
                            label.classList.add("bg-indigo-500/5", "border-indigo-500/50");
                            ui.classList.add("bg-indigo-600", "border-indigo-600");
                            icon.classList.remove("opacity-0");
                        } else {
                            label.classList.remove("bg-indigo-500/5", "border-indigo-500/50");
                            ui.classList.remove("bg-indigo-600", "border-indigo-600");
                            icon.classList.add("opacity-0");
                        }
                    };
                });

                modal.querySelector("#confirm-groups").onclick = () => {
                    const checked = Array.from(modal.querySelectorAll(".group-checkbox:checked")).map((cb) => cb.value);
                    const rawVal = checked.includes("Todos") ? "Todos" : checked.join(", ");
                    const finalVal = formatGroups(rawVal);
                    window.setProgramGroup(dayIdx, turnoId, finalVal);
                    window.hideModal("modal-container-nested");
                };
            },
            "max-w-[340px]",
            "modal-container-nested",
        );
    };

    window.setProgramGroup = (dayIdx, turnoId, val) => {
        console.log(`🛡️ [v2.9.5] Setting Groups for Day ${dayIdx}, Turn ${turnoId}:`, val);
        const hidden = document.getElementById("select-grupos");
        if (hidden) {
            hidden.value = val || "";
            const spanVisual = document.getElementById("val-grupos-modal");
            if (spanVisual) {
                spanVisual.innerText = val || "—";
                spanVisual.className = `text-[12px] font-black truncate ${val ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400 opacity-40"}`;
            }
            console.log("✅ Hidden input 'select-grupos' updated");
        } else {
            console.warn("⚠️ Element 'select-grupos' not found in DOM");
        }

        // Sincronizar con el objeto principal inmediatamente para evitar pérdida por refresco
        if (programa.dias[dayIdx]?.[turnoId]) {
            programa.dias[dayIdx][turnoId].grupos = val || "";
        }

        window.updateWeekData(dayIdx, turnoId, "grupos", val);
    };

    const execActionRecepcion = async () => {
        showNotification("Cargando vista de recepción...", "info");
        await openReceptionModal(programa, territorios, splitTerritories, renderTable);
    };

    const execActionFormalizar = async () => {
        await openFormalizeModal(programa, territorios, loadWeekData);
    };

    container.querySelector("#btn-prev-week").onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        loadWeekData();
    };
    container.querySelector("#btn-next-week").onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        loadWeekData();
    };
    const execActionHoy = () => {
        currentWeekStart = getMonday(new Date());
        loadWeekData();
    };
    window.resetToCurrentWeek = execActionHoy;

    const execActionReplicar = async () => {
        showCustomConfirm(
            "¿Seguro que deseas sobrescribir esta semana con los datos de la semana pasada? Se conservarán los turnos y conductores, pero se limpiarán los territorios.",
            async () => {
                try {
                    const prev = new Date(currentWeekStart);
                    prev.setDate(prev.getDate() - 7);
                    const prevProgName = formatDateId(prev);
                    const oldProg = await getProgramaSemanal(prevProgName);

                    if (!oldProg.id || oldProg.id === "default")
                        return showNotification("No hay datos en la semana anterior para copiar", "warning");

                    // PARCHE 2: Dynamic REPLICAR — copies ALL turno keys from previous week (manana_2, noche_2, zoom, etc.)
                    const cloneTurn = (turn) => {
                        if (!turn) return null;
                        return {
                            hora: turn.hora || "",
                            lugar: turn.lugar || "",
                            conductor: turn.conductor || "",
                            auxiliar: turn.auxiliar || "",
                            faceta: turn.faceta || "",
                            grupos: turn.grupos || "",
                            enabled: turn.enabled,
                        };
                    };

                    const newDias = oldProg.dias.map((d, i) => {
                        const nd = new Date(currentWeekStart);
                        nd.setDate(nd.getDate() + i);

                        const cloned = { nombre: d.nombre, fecha: formatDateId(nd) };

                        // Dynamically copy every turno key found in the old day (manana, tarde, noche, zoom, manana_2, etc.)
                        const turnoKeys = Object.keys(d).filter((k) => k !== "nombre" && k !== "fecha");
                        turnoKeys.forEach((key) => {
                            const ct = cloneTurn(d[key]);
                            // Only copy if the turn has actual data
                            if (
                                ct &&
                                Object.values(ct).some((v) => v !== "" && v !== null && v !== undefined && v !== false)
                            ) {
                                cloned[key] = ct;
                            }
                        });

                        return cloned;
                    });

                    programa.dias = newDias;
                    await saveProgramaSemanal(programa.id, programa);
                    renderTable();
                    showNotification("Plantilla de semana pasada replicada con éxito", "success");
                } catch (e) {
                    console.error(e);
                    showNotification("Error al copiar semana", "error");
                }
            },
        );
    };

    const execActionExportXls = async () => {
        const { exportarProgramaExcel } = await import("../services/export-service.js");
        await exportarProgramaExcel(programa);
    };

    // --- ACTION BAR EVENT DELEGATION (GHOST CLICK ERADICATOR) ---
    const navBar = container.querySelector("nav");
    navBar?.addEventListener("click", (e) => {
        const btn = e.target.closest("button, #action-exportar-prog");
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const id = btn.id;

        if (id === "action-formalizar-prog") {
            execActionFormalizar();
        } else if (id === "action-hoy-prog") {
            execActionHoy();
        } else if (id === "action-recepcion-prog") {
            execActionRecepcion();
        } else if (id === "action-escanear-prog") {
            memoryScannerInput.click();
        } else if (id === "action-replicar-prog") {
            execActionReplicar();
        } else if (id === "action-exportar-prog") {
            const menuEl = container.querySelector("#export-menu-options");
            const isVisible = menuEl.getAttribute("data-visible") === "true";
            menuEl.setAttribute("data-visible", !isVisible);
        } else if (id === "btn-export-xls-prog") {
            execActionExportXls();
        } else if (id === "btn-export-png-cond-new") {
            import("../services/export-service.js").then((m) => m.exportarProgramaPNG(programa, "conductor"));
        } else if (id === "btn-export-png-pub-new") {
            import("../services/export-service.js").then((m) => m.exportarProgramaPNG(programa, "publicador"));
        }
    });

    const menuEl = container.querySelector("#export-menu-options");
    if (menuEl) {
        document.addEventListener("click", () => {
            menuEl.setAttribute("data-visible", "false");
        });

        // Sub-buttons export logic moved to delegation
    }

    await loadWeekData();
};
