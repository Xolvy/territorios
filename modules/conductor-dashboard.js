import { auth } from "../firebase-config.js";
import { onAuthStateChanged } from "firebase/auth";
import { arrayUnion, doc, documentId, setDoc, where } from "firebase/firestore";
import {
    addPublicador,
    finalizarSesionConCrm,
    getConfiguracion,
    getProgramaSemanal,
    getPublicadores,
    getTelefonos,
    getTelefonosParaSesion,
    getTerritorios,
    logReturn,
    PoolManager,
    releaseUnusedTelefonos,
    returnTerritorio,
    solicitarNumeros,
    startLivePool,
    updateTelefonoStatus,
    updateTerritorio,
} from "../data/firestore-services.js";
import { showModal } from "./services/ui-helpers.js";
import { AppConfig } from "./utils/config.js";
import { checkAdminPrivileges, getMonday, getSafeDateId, normalizeRobust, renderSkeleton, showNotification } from "./utils/helpers.js";

window.AppConfig = AppConfig;

import { moduleRegistry } from "./utils/module-registry.js";
import { ReceptionHub } from "./services/reception-hub.js";
import { renderMiInformeModule } from "./conductor/mi-informe.js";

// --- MICRO-MODULE LOADER ---
const dynamicSubModules = import.meta.glob("./**/*.js");

async function loadSubModule(name, path) {
    return moduleRegistry.loadModule(name, path, dynamicSubModules);
}

// --- UTILS ---
window.finalizarPredicacionTelefonia = async () => {
    try {
        showNotification("Procesando Ciclo de Vida CRM...", "info");

        const name = localStorage.getItem("selected_conductor_name");
        const sessionOwner = localStorage.getItem("phone_session_owner") || name;

        // Fetch all phones for the session to see what was modified
        const allPhones = await getTelefonosParaSesion(sessionOwner);

        // FIX HUGO: Extraer el solicitado_por REAL de los documentos de Firestore.
        // No confiar en el localStorage ya que puede tener acentos/capitalización distinta
        // a la que se guardó en Firestore cuando se solicitaron los números.
        const realOwnerFromFirestore =
            allPhones.length > 0
                ? allPhones.find((p) => p.solicitado_por)?.solicitado_por || sessionOwner
                : sessionOwner;

        const changes = {};
        allPhones.forEach((p) => {
            // If the state is not "En Sesión" and not empty/null, or has notes, it was processed!
            if ((p.estado && p.estado !== "En Sesión") || p.notas) {
                changes[p.id] = {
                    estado: p.estado === "En Sesión" ? "" : p.estado,
                    notas: p.notas || "",
                };
            }
        });

        try {
            // Phase 1: Batch CRM Finalization
            // This handles: Purgas, Enfriamiento, 3 Strikes, Masive Recycling and Session Reports
            await finalizarSesionConCrm(realOwnerFromFirestore, changes);
        } catch (crmErr) {
            console.error("Error en CRM Finalization (non-blocking):", crmErr);
        }

        try {
            // Phase 2: Cleanup session owners for unused numbers
            // Usamos el nombre real de Firestore, y además pasamos los IDs explícitos
            // para garantizar que todos los números de la sesión se liberen
            await releaseUnusedTelefonos(
                realOwnerFromFirestore,
                false,
                true,
                allPhones.map((p) => p.id),
            );
        } catch (releaseErr) {
            console.error("Error en releaseUnusedTelefonos (non-blocking):", releaseErr);
        }

        showNotification("Predicación finalizada y procesada por CRM", "success");
    } catch (e) {
        console.error("Error al finalizar predicación CRM:", e);
        showNotification("Error al finalizar predicación, cerrando sesión local...", "error");
    } finally {
        // 3. Clear memory local always to prevent UI lockups
        window.pendingPhoneChanges = {};
        window._phoneSessionActive = false;
        localStorage.removeItem("phone_session_active");
        localStorage.removeItem("phone_session_owner");
        sessionStorage.removeItem("phone_session_active_this_tab");

        // 4. Refrescar vista
        if (typeof window.refreshConductorView === "function") {
            await window.refreshConductorView(true);
        }
    }
};

window.viewMapFromReport = async (id, mode = "satelital") => {
    if (!id) return;
    showNotification("Cargando visor de mapa...", "info");
    const territories = await getTerritorios();
    const t = territories.find((x) => x.id === id);
    if (t) {
        window.openInteractiveMap(t, { mode });
    } else {
        showNotification("No se encontró la data del territorio para el mapa.", "error");
    }
};

window.abrirMapaTerritorio = async (numeroTerritorio, mode = "satelital") => {
    if (!numeroTerritorio) return;
    console.log("Abriendo mapa para territorio:", numeroTerritorio, "modo:", mode);
    try {
        const territories = await getTerritorios();
        const target = territories.find((t) => String(t.numero) === String(numeroTerritorio));
        if (target) {
            window.viewMapFromReport(target.id, mode);
        } else {
            showNotification(`No se encontró el mapa para el territorio ${numeroTerritorio}`, "error");
        }
    } catch (err) {
        console.error("Error al abrir mapa:", err);
    }
};

let s13LivePoolUnsubscribe = null;

// --- UTILS: OVERLAY CONTROL ---
const ocultarOverlay = () => {
    if (typeof window.hideUniversalLoader === "function") {
        window.hideUniversalLoader();
    }
    const overlay = document.getElementById("login-sync-overlay");
    if (overlay) {
        overlay.classList.add("opacity-0");
        setTimeout(() => overlay.remove(), 400);
    }
};

export const renderConductorDashboard = async (container, nameOrEmail, _appVersion, userRole = null) => {
    if (!container) {
        console.warn("[Dashboard] container es null — abortando render");
        return;
    }

    if (typeof window.showUniversalLoader === "function") {
        window.showUniversalLoader("Iniciando Dashboard...");
    }

    let initSwipeActions = null;
    let initNexoSystem = null;

    console.log("🚀 [Conductor] Starting Parallel Initialization...");

    const safetyTimeout = setTimeout(ocultarOverlay, 4000);

    // --- AUTH GUARD (FASTBOOT SYNC) ---
    const esperarAuth = () =>
        new Promise((resolve) => {
            if (auth.currentUser) {
                resolve();
                return;
            }
            console.log("⏳ [Dashboard] Esperando Firebase Auth para carga de datos...");
            const t = setTimeout(() => {
                console.warn("⚠️ [Dashboard] Timeout esperando Auth — procediendo...");
                resolve();
            }, 4000);
            const unsub = onAuthStateChanged(auth, (u) => {
                if (u) {
                    console.log("💎 [Dashboard] Auth detectado:", u.email);
                    clearTimeout(t);
                    unsub();
                    resolve();
                }
            });
        });

    try {
        // Garantizar que Firestore tenga credenciales antes de pedir getPublicadores()
        await esperarAuth();

        // 2. Parallel Data & Module Fetching (Combined for maximum throughput)
        const currentWeekId = getSafeDateId(getMonday(new Date()));

        const [baseData, modules] = await Promise.all([
            Promise.all([getTerritorios(), getTelefonos(), getPublicadores(), getProgramaSemanal(currentWeekId)]),
            Promise.all([
                loadSubModule("availability", "./conductor/availability.js"),
                loadSubModule("recursos", "./conductor/recursos.js"),
                loadSubModule("maps_explorer", "./conductor/maps-explorer.js"),
                loadSubModule("rescue", "./conductor/rescue.js"),
                loadSubModule("phone_module", "./conductor/phone-module.js"),
                loadSubModule("weekly_program", "./conductor/weekly-program.js"),
            ]),
        ]);

        const [allT, allTel, allPublicadores, initialProg] = baseData;
        const [mAvail, mRec, mMaps, mRescue, mPhone, mProg] = modules;

        // Global Data Cache: Provide single source of truth for weekly program and territories
        window._progCache = window._progCache || {};
        if (initialProg) window._progCache.programa = initialProg;
        window._progCache.territorios = allT;

        // Xolvy Identity Shield: Use canonical identity as the Single Source of Truth
        const identity = window.XolvyApp?.identity;
        let displayName = identity ? identity.nombreCanonico : nameOrEmail;

        // Tab close detection: if session is active in localStorage but not in sessionStorage,
        // it means the user closed the tab and opened a new one.
        const isTabSessionActive = sessionStorage.getItem("phone_session_active_this_tab") === "true";
        const isLocalSessionActive = localStorage.getItem("phone_session_active") === "true";

        // Siempre iniciar con el módulo de telefonía cerrado en la carga inicial de la aplicación (debe aparecer cerrado).
        // Si hay una sesión sin finalizar, se le propondrá continuarla o iniciar una nueva.
        window._phoneSessionActive = false;

        if (isLocalSessionActive && !isTabSessionActive) {
            // Ya no liberamos automáticamente en segundo plano en la carga inicial,
            // ya que el flujo de SweetAlert2 le permitirá al usuario elegir "Continuar sesión anterior".
            localStorage.removeItem("phone_session_active");
            localStorage.removeItem("phone_session_owner");
        } else if (isLocalSessionActive && isTabSessionActive) {
            // Si es un refresco explícito en la misma pestaña con sesión activa, la mantenemos abierta.
            window._phoneSessionActive = true;
        }

        // Búsqueda hiper-robusta ignorando mayúsculas y tildes
        const normalizar = (txt) =>
            String(txt || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim()
                .toLowerCase();
        const targetName = normalizar(displayName);

        const allC = allPublicadores; // getPublicadores ya viene resuelto en baseData
        const conductorData = allC.find((c) => normalizar(c.nombre) === targetName) || null;

        // Restaurar el nombre con sus mayúsculas originales para que la UI se vea bien
        if (conductorData?.nombre) {
            displayName = conductorData.nombre;
        } else {
            console.error(`[Data Shield] CRÍTICO: No se encontró publicador para: ${targetName}`);
        }

        console.log("[IdentityShield] Conductor Dashboard cargado con nombre canónico:", displayName);

        // Xolvy Modular: Pool Data and Unsubscribe references (Initialized early for HMS/LivePool access)
        let currentLivePoolUnsubscribe = null;
        let programLivePoolUnsubscribe = null;
        let territoriesLivePoolUnsubscribe = null;
        let configLivePoolUnsubscribe = null;
        let telefonosLivePoolUnsubscribe = null;
        let presenceLivePoolUnsubscribe = null;
        let currentSubscribedOwner = null;
        let currentSubscribedActive = false;
        const poolData = {
            territorios: allT,
            programa: initialProg,
            configuracion: null,
            s13: [],
            banco_s13: [],
        };

        // Debounce Mechanism to prevent Re-render Storms (LP-02, LP-03)
        let renderDebounceTimer;
        function safeRenderDashboard() {
            clearTimeout(renderDebounceTimer);
            renderDebounceTimer = setTimeout(() => {
                refreshConductorView(true);
            }, 300);
        }

        // Al final de renderConductorDashboard, levantar la cortina (dentro del try antes de salir)
        const levantarCortina = () => {
            const loginOverlay =
                document.getElementById("login-stage-container") ||
                document.querySelector(".login-wrapper") ||
                document.getElementById("login-root") ||
                document.getElementById("conductor-modal"); // Agregado como fallback seguro
            if (loginOverlay) {
                loginOverlay.style.opacity = "0";
                loginOverlay.style.pointerEvents = "none";
                setTimeout(() => loginOverlay.remove(), 600);
            }
        };

        // Xolvy Modular: Cleanup function for all active Firestore listeners
        window.stopActiveLivePools = () => {
            if (window._presenceInterval) {
                clearInterval(window._presenceInterval);
                window._presenceInterval = null;
            }

            [
                currentLivePoolUnsubscribe,
                programLivePoolUnsubscribe,
                territoriesLivePoolUnsubscribe,
                s13LivePoolUnsubscribe,
                configLivePoolUnsubscribe,
                telefonosLivePoolUnsubscribe,
                presenceLivePoolUnsubscribe,
            ].forEach((unsub) => {
                if (typeof unsub === "function") {
                    try {
                        unsub();
                    } catch (err) {
                        console.error("Error stopping unsub:", err);
                    }
                }
            });
            currentLivePoolUnsubscribe = null;
            programLivePoolUnsubscribe = null;
            territoriesLivePoolUnsubscribe = null;
            s13LivePoolUnsubscribe = null;
            configLivePoolUnsubscribe = null;
            telefonosLivePoolUnsubscribe = null;
            presenceLivePoolUnsubscribe = null;
            currentSubscribedOwner = null;
            currentSubscribedActive = false;

            // Deep purge via PoolManager (LP-01)
            if (PoolManager?.stopAll) {
                PoolManager.stopAll();
            }

            // Cleanup window._bannerInterval (LP-04)
            if (window._bannerInterval) {
                clearInterval(window._bannerInterval);
                window._bannerInterval = null;
            }

            // FIX-D: Cleanup global event listener to avoid duplicates on HMS remount
            if (window.__territoryReleasedHandler) {
                window.removeEventListener("territorio-liberado", window.__territoryReleasedHandler);
                window.__territoryReleasedHandler = null;
            }
            if (window._beforeUnloadHandler) {
                window.removeEventListener("beforeunload", window._beforeUnloadHandler);
                window._beforeUnloadHandler = null;
            }
            console.log("🛑 [Live Pool] All conductor pools stopped.");
        };

        if (window._beforeUnloadHandler) {
            window.removeEventListener("beforeunload", window._beforeUnloadHandler);
        }
        window._beforeUnloadHandler = (e) => {
            if (window._phoneSessionActive) {
                e.preventDefault();
                e.returnValue =
                    "Tienes una sesión de predicación telefónica activa. Por favor, finalízala formalmente antes de salir.";
                return e.returnValue;
            }
        };
        window.addEventListener("beforeunload", window._beforeUnloadHandler);

        // FIX-D + PASO 3: Handler mejorado del evento 'territorio-liberado'.
        const _onTerritorioLiberado = async (e) => {
            if (!container?.isConnected) return;
            console.log("[Live Pool] 🔔 territorio-liberado recibido:", e.detail);
            if (window.__forcePoolRefresh) {
                await window.__forcePoolRefresh();
            } else {
                safeRenderDashboard();
            }
        };
        if (window.__territoryReleasedHandler) {
            window.removeEventListener("territorio-liberado", window.__territoryReleasedHandler);
        }
        window.__territoryReleasedHandler = _onTerritorioLiberado;
        window.addEventListener("territorio-liberado", _onTerritorioLiberado);

        // XOLVY LIVE POOL: Real-time synchronization engine
        // This ensures Admin changes are visible to conductors instantly without refresh
        territoriesLivePoolUnsubscribe = startLivePool("territorios", [], (data) => {
            poolData.territorios = data;
            if (container?.isConnected) safeRenderDashboard();
        });

        programLivePoolUnsubscribe = startLivePool(
            "programa_semanal",
            [where(documentId(), "==", currentWeekId)],
            (data) => {
                poolData.programa = data[0] || null;
                if (container?.isConnected) safeRenderDashboard();
            },
        );

        s13LivePoolUnsubscribe = startLivePool("banco_s13", [where("fecha_entrega", "==", null)], (data) => {
            poolData.banco_s13 = data;
            if (container?.isConnected) safeRenderDashboard();
        });

        configLivePoolUnsubscribe = startLivePool("configuracion", [where(documentId(), "==", "general")], (data) => {
            poolData.configuracion = data[0] || null;
            if (container?.isConnected) safeRenderDashboard();
        });

        // ══════════════ REGISTRO DE PRESENCIA EN VIVO ══════════════
        const toTitleCase = (str) => {
            if (!str) return "";
            return str
                .trim()
                .toLowerCase()
                .split(" ")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
        };

        const registrarPresencia = async () => {
            const identity = window.XolvyApp?.identity;
            const myName = identity?.nombreCanonico || displayName;
            if (!myName || !db) return;

            try {
                const pRef = doc(db, "presencia_conductores", myName);
                await setDoc(
                    pRef,
                    {
                        nombre: myName,
                        uid: auth.currentUser?.uid || identity?.uid || "",
                        email: auth.currentUser?.email || identity?.email || "",
                        lastActive: Date.now(),
                        sessionActive: !!(window._phoneSessionActive && window._myActivePhonesCount > 0),
                        solicitado_por: myName,
                    },
                    { merge: true },
                );
            } catch (err) {
                console.warn("[Presencia] Error al actualizar presencia:", err);
            }
        };

        registrarPresencia();
        if (window._presenceInterval) clearInterval(window._presenceInterval);
        window._presenceInterval = setInterval(registrarPresencia, 15000);

        // Helper function to update the presence and session indicators in real-time
        const updatePresenceAndSessionsUI = () => {
            const now = Date.now();
            const identity = window.XolvyApp?.identity;
            const myUid = auth.currentUser?.uid || identity?.uid;
            const myEmail = auth.currentUser?.email || identity?.email;
            const myName = identity?.nombreCanonico || displayName;

            const activeOthers = (window._activeOthers || []).filter((c) => {
                const isMe =
                    (myUid && c.uid === myUid) ||
                    (myEmail && c.email && normalizeRobust(c.email) === normalizeRobust(myEmail)) ||
                    normalizeRobust(c.nombre) === normalizeRobust(myName);
                return !isMe && c.lastActive > now - 40000;
            });
            const conductorsInSession = activeOthers.filter((c) => c.sessionActive);

            // Connected conductors indicator is removed as requested by user

            const sessionsBadge = document.getElementById("active-sessions-badge-container");
            const sessionsCount = document.getElementById("active-sessions-count");
            if (sessionsBadge && sessionsCount) {
                const sessionCountVal = conductorsInSession.length;
                sessionsCount.innerText = `${sessionCountVal} ${sessionCountVal === 1 ? "sesión abierta" : "sesiones abiertas"}`;

                const myActive = !!(
                    window._phoneSessionActive || localStorage.getItem("phone_session_active") === "true"
                );
                if (!myActive && sessionCountVal > 0) {
                    sessionsBadge.classList.remove("hidden");
                    sessionsBadge.classList.add("flex");
                } else {
                    sessionsBadge.classList.remove("flex");
                    sessionsBadge.classList.add("hidden");
                }
            }

            // Inline Collaboration View Logic
            const collabState = document.getElementById("phone-start-collaboration-state");
            const initialState = document.getElementById("phone-start-initial-state");

            if (collabState && initialState) {
                if (conductorsInSession.length > 0) {
                    const sessionItemsHtml = conductorsInSession
                        .map((c) => {
                            const initials = c.nombre
                                .trim()
                                .split(/\s+/)
                                .map((w) => w[0])
                                .join("")
                                .substring(0, 2)
                                .toUpperCase();
                            return `
                            <div class="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all border border-slate-100 dark:border-white/5">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-black tracking-wider uppercase shadow-sm">
                                        ${initials}
                                    </div>
                                    <div class="text-left">
                                        <p class="text-xs font-black text-slate-800 dark:text-white uppercase leading-none">${c.nombre}</p>
                                        <span class="text-[8px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1 mt-1">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Activo
                                        </span>
                                    </div>
                                </div>
                                <button onclick="event.stopPropagation(); window._joinSession('${c.nombre.replace(/'/g, "\\'")}')" class="btn-pro px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all">
                                    Unirse
                                </button>
                            </div>
                        `;
                        })
                        .join("");

                    collabState.innerHTML = `
                        <div class="space-y-4">
                            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-lg">
                                        <i class="fas fa-project-diagram"></i>
                                    </div>
                                    <div>
                                        <h4 class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest leading-none">Colaboración</h4>
                                        <span class="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1 block">Sesiones activas</span>
                                    </div>
                                </div>
                                <button id="btn-collab-back" class="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                    <i class="fas fa-arrow-left"></i> Volver
                                </button>
                            </div>
                            <div class="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                ${sessionItemsHtml}
                            </div>
                            <div class="border-t border-slate-100 dark:border-white/5 pt-4">
                                <button id="btn-start-new-session" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md active:scale-95 transition-all text-center">
                                    <i class="fas fa-plus mr-1"></i> Iniciar Sesión Nueva
                                </button>
                            </div>
                        </div>
                    `;

                    const btnBack = collabState.querySelector("#btn-collab-back");
                    if (btnBack) {
                        btnBack.onclick = (e) => {
                            e.stopPropagation();
                            collabState.classList.add("hidden");
                            initialState.classList.remove("hidden");
                            window._collabStateDismissed = true;
                        };
                    }

                    const btnStartNew = collabState.querySelector("#btn-start-new-session");
                    if (btnStartNew) {
                        btnStartNew.onclick = async (e) => {
                            e.stopPropagation();
                            await window._startNewSessionDirect();
                        };
                    }

                    if (!window._collabStateDismissed) {
                        initialState.classList.add("hidden");
                        collabState.classList.remove("hidden");
                    }
                } else {
                    collabState.innerHTML = "";
                    collabState.classList.add("hidden");
                    initialState.classList.remove("hidden");
                    window._collabStateDismissed = false;
                }
            }
        };

        presenceLivePoolUnsubscribe = startLivePool("presencia_conductores", [], (data) => {
            const now = Date.now();
            const identity = window.XolvyApp?.identity;
            const myUid = auth.currentUser?.uid || identity?.uid;
            const myEmail = auth.currentUser?.email || identity?.email;
            const myName = identity?.nombreCanonico || displayName;

            const activeOthers = (data || []).filter((c) => {
                const isMe =
                    (myUid && c.uid === myUid) ||
                    (myEmail && c.email && normalizeRobust(c.email) === normalizeRobust(myEmail)) ||
                    normalizeRobust(c.nombre) === normalizeRobust(myName);
                return !isMe && c.lastActive > now - 40000;
            });
            window._activeOthers = activeOthers;
            updatePresenceAndSessionsUI();
        });

        // ══════════════ TELEFONÍA LIVE POOL ══════════════
        // (Managed dynamically inside refreshConductorView to support live presence & joining)

        // FIX-D: Exponer forcePoolRefresh como red de seguridad para módulos externos
        window.__forcePoolRefresh = async () => {
            try {
                const { getDocs, collection: col, query: q, where: wh } = await import("firebase/firestore");
                const { db: _db } = await import("../firebase-config.js");
                const tSnap = await getDocs(col(_db, "territorios"));
                poolData.territorios = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                const s13Snap = await getDocs(q(col(_db, "banco_s13"), wh("fecha_entrega", "==", null)));
                poolData.banco_s13 = s13Snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                if (container?.isConnected) safeRenderDashboard();
                console.log("[Pool] 🔄 Refresh forzado completado");
            } catch (err) {
                console.warn("[Pool] forcePoolRefresh error:", err);
            }
        };

        // --- CORE LOGIC HELPERS (Hoisted via 'function' for reliability) ---
        async function obtenerConductorData(nombreConductor, intentos = 3) {
            // Identity Shield: Confía ciegamente en el mapeo ya realizado
            const identity = window.XolvyApp?.identity;
            const canonicalName = identity?.nombreCanonico || nombreConductor;

            if (identity?.docId) {
                const allC = await getPublicadores();
                const found = allC.find(
                    (c) => c.id === identity.docId || normalizeRobust(c.nombre) === normalizeRobust(canonicalName),
                );
                if (found) return { ...found, es_conductor: true };
            }

            const _normalized = String(nombreConductor || "")
                .trim()
                .toLowerCase();

            for (let i = 0; i < intentos; i++) {
                const allC = await getPublicadores();
                const conductor = allC.find((c) => {
                    const name = String(c.nombre || "")
                        .trim()
                        .toLowerCase();
                    const email = String(c.email || "")
                        .trim()
                        .toLowerCase();
                    const phone = String(c.telefono || "").replace(/\D/g, "");
                    const normalizedSearch = String(nombreConductor || "")
                        .trim()
                        .toLowerCase();
                    const normalizedPhoneSearch = normalizedSearch.replace(/\D/g, "");

                    return (
                        name === normalizedSearch ||
                        email === normalizedSearch ||
                        (normalizedPhoneSearch && phone === normalizedPhoneSearch)
                    );
                });

                if (conductor) return conductor;
                await new Promise((r) => setTimeout(r, 800));
            }

            return {
                nombre: canonicalName,
                modulos: {
                    agenda: true,
                    programa: true,
                    disponibilidad: true,
                    telefonos: true,
                    mapas: true,
                    ayudas: true,
                    rescue: false,
                },
                disponibilidad: {},
                es_conductor: true,
            };
        }

        async function refreshPhones() {
            const identity = window.XolvyApp?.identity;
            const userName = identity?.nombreCanonico || displayName;
            const userEmail = identity?.email || auth.currentUser?.email;

            const joinedOwner = localStorage.getItem("phone_session_owner");
            const sessionQueryOwner = joinedOwner || userName;

            // PASO 3: Normalización estricta para el filtrado del Live Pool
            const allPhones = await getTelefonosParaSesion(sessionQueryOwner);
            const cleanSessionQueryOwner = normalizeRobust(sessionQueryOwner);
            const cleanUserEmail = normalizeRobust(userEmail);

            const isActive = !!(window._phoneSessionActive || localStorage.getItem("phone_session_active") === "true");
            const filtered = allPhones.filter((t) => {
                const pub = normalizeRobust(t.publicador_asignado);
                const asg = normalizeRobust(t.asignado_a);
                const sol = normalizeRobust(t.solicitado_por);

                if (isActive) {
                    return sol === cleanSessionQueryOwner;
                } else {
                    return (
                        pub === cleanSessionQueryOwner ||
                        pub === cleanUserEmail ||
                        asg === cleanSessionQueryOwner ||
                        asg === cleanUserEmail
                    );
                }
            });

            // Ordenar por fecha_asignacion ascendente para que los nuevos números se añadan al final
            filtered.sort((a, b) => {
                const timeA = a.fecha_asignacion ? new Date(a.fecha_asignacion).getTime() : 0;
                const timeB = b.fecha_asignacion ? new Date(b.fecha_asignacion).getTime() : 0;
                return timeA - timeB;
            });

            return filtered;
        }

        let _renderTimeout = null;

        async function refreshConductorView(usePool = false) {
            if (_renderTimeout) clearTimeout(_renderTimeout);

            return new Promise((resolve) => {
                _renderTimeout = setTimeout(async () => {
                    try {
                        const configData = await getConfiguracion();
                        const conductorDataRef = await obtenerConductorData(displayName);

                        if (conductorDataRef?.nombre) {
                            displayName = conductorDataRef.nombre;
                        }

                        const userMods = conductorDataRef?.modulos || {
                            agenda: true,
                            programa: true,
                            disponibilidad: true,
                            telefonos: true,
                            mapas: true,
                            ayudas: true,
                            rescue: false,
                        };

                        await loadUnifiedDashboard(
                            container,
                            displayName,
                            userMods,
                            configData,
                            conductorDataRef,
                            userRole,
                            usePool ? poolData : { ...poolData, programa: initialProg },
                            { mAvail, mRec, mMaps, mRescue, mPhone, mProg }
                        );

                        const myPhones = await refreshPhones(true);
                        window._myActivePhonesCount = myPhones.length;

                        // Auto-recovery of active session if there are assigned phones currently "En Sesión"
                        // Only recover if we are in the same tab session (sessionStorage is active)
                        const hasActiveSessionPhones = myPhones.some((p) => p.estado === "En Sesión");
                        const isTabSessionActive = sessionStorage.getItem("phone_session_active_this_tab") === "true";

                        if (hasActiveSessionPhones && !window._phoneSessionActive && isTabSessionActive) {
                            console.log(`[Telefonía] ♻️ Auto-recuperando sesión activa detectada para ${displayName}`);
                            window._phoneSessionActive = true;
                            localStorage.setItem("phone_session_active", "true");

                            const identity = window.XolvyApp?.identity;
                            const userName = identity?.nombreCanonico || displayName;
                            if (!localStorage.getItem("phone_session_owner")) {
                                localStorage.setItem("phone_session_owner", userName);
                            }
                        } else if (hasActiveSessionPhones && !window._phoneSessionActive && !isTabSessionActive) {
                            console.log(
                                `[Telefonía] 📋 Hay ${myPhones.length} teléfonos "En Sesión" en Firestore, pero la sesión está cerrada. Esperando acción del usuario.`,
                            );
                        } else if (!hasActiveSessionPhones && window._phoneSessionActive) {
                            console.log(
                                `[Telefonía] 🧹 Limpiando bandera de sesión activa local ya que no hay teléfonos en sesión.`,
                            );
                            window._phoneSessionActive = false;
                            localStorage.removeItem("phone_session_active");
                            localStorage.removeItem("phone_session_owner");
                            sessionStorage.removeItem("phone_session_active_this_tab");
                        }

                        const publicadores = await getPublicadores();

                        if (mPhone?.initializePhoneModule) {
                            mPhone.initializePhoneModule(
                                myPhones,
                                publicadores,
                                displayName,
                                container.querySelector("#phone-tbody"),
                                () => refreshConductorView(true),
                            );
                        }

                        // ══════════════ VISIBILIDAD TELEFÓNICA ══════════════
                        const compactView = container.querySelector("#phone-compact-view");
                        const expandedView = container.querySelector("#phone-expanded-view");
                        const floatingActions = container.querySelector("#phone-floating-actions");

                        if (myPhones.length > 0 && window._phoneSessionActive) {
                            compactView?.classList.add("hidden");
                            expandedView?.classList.remove("hidden");
                            floatingActions?.classList.replace("hidden", "flex");
                        } else {
                            compactView?.classList.remove("hidden");
                            expandedView?.classList.add("hidden");
                            floatingActions?.classList.replace("flex", "hidden");
                        }

                        // Bindings for phone buttons
                        // Function to handle the collaborative solicitar/join flow
                        async function iniciarSolicitudNumerosFlow(btnToDisable, oldHtml) {
                            const identity = window.XolvyApp?.identity;
                            let solicitante = identity?.nombreCanonico || displayName;

                            // Look up in publicadores to get canonical database spelling (with correct accents)
                            if (publicadores && publicadores.length > 0) {
                                const matched = publicadores.find(
                                    (p) => normalizeRobust(p.nombre) === normalizeRobust(solicitante),
                                );
                                if (matched?.nombre) {
                                    solicitante = matched.nombre;
                                }
                            }

                            try {
                                // 1. Check if there is an unfinalized session in Firestore
                                const existingPhones = await getTelefonosParaSesion(solicitante);
                                const unfinalized = existingPhones.filter(
                                    (p) =>
                                        p.solicitado_por &&
                                        normalizeRobust(p.solicitado_por) === normalizeRobust(solicitante),
                                );

                                // Clean up stale unfinalized phones automatically (older than 24 hours)
                                const nowTime = Date.now();
                                const staleThresholdMs = 24 * 60 * 60 * 1000; // 24 hours
                                const recentUnfinalized = [];
                                const staleUnfinalized = [];

                                unfinalized.forEach((p) => {
                                    const assignDate = p.fecha_asignacion ? new Date(p.fecha_asignacion) : null;
                                    if (!assignDate || nowTime - assignDate.getTime() > staleThresholdMs) {
                                        staleUnfinalized.push(p);
                                    } else {
                                        recentUnfinalized.push(p);
                                    }
                                });

                                if (staleUnfinalized.length > 0) {
                                    console.log(
                                        `[Telefonía] 🧹 Limpiando automáticamente ${staleUnfinalized.length} números expirados de la sesión previa de ${solicitante}`,
                                    );
                                    await releaseUnusedTelefonos(
                                        solicitante,
                                        false,
                                        true,
                                        staleUnfinalized.map((p) => p.id),
                                    );
                                }

                                const isActiveSession = !!(
                                    window._phoneSessionActive ||
                                    localStorage.getItem("phone_session_active") === "true"
                                );

                                if (recentUnfinalized.length > 0 && !isActiveSession) {
                                    // Temporarily restore the button so the user can interact
                                    if (btnToDisable) {
                                        btnToDisable.disabled = false;
                                        if (oldHtml) btnToDisable.innerHTML = oldHtml;
                                    }

                                    const result = await window.Swal.fire({
                                        title: "Sesión anterior detectada",
                                        text: "Tienes una sesión de predicación telefónica activa sin finalizar. ¿Deseas continuarla o iniciar una nueva?",
                                        icon: "question",
                                        showCancelButton: true,
                                        confirmButtonText: "Continuar sesión anterior",
                                        denyButtonText: "Iniciar una nueva",
                                        showDenyButton: true,
                                        cancelButtonText: "Cancelar",
                                        customClass: {
                                            popup: "rounded-[2rem] bg-white dark:bg-[#0a0f18]/95 border border-slate-200/60 dark:border-white/10 text-slate-800 dark:text-white",
                                            confirmButton:
                                                "btn-pro bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all mr-2",
                                            denyButton:
                                                "btn-pro bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all mr-2",
                                            cancelButton:
                                                "btn-pro bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 px-5 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all",
                                        },
                                    });

                                    if (result.isConfirmed) {
                                        // Continuar sesión anterior
                                        window._phoneSessionActive = true;
                                        localStorage.setItem("phone_session_active", "true");
                                        localStorage.setItem("phone_session_owner", solicitante);
                                        sessionStorage.setItem("phone_session_active_this_tab", "true");
                                        showNotification("Sesión anterior restaurada", "success");
                                        await refreshConductorView(true);
                                        return;
                                    } else if (result.isDenied) {
                                        // Iniciar una nueva: liberar la anterior primero en la BD
                                        showNotification("Liberando números de sesión anterior...", "info");
                                        if (btnToDisable) {
                                            btnToDisable.disabled = true;
                                            btnToDisable.innerHTML =
                                                '<i class="fas fa-circle-notch fa-spin"></i> Solicitando...';
                                        }
                                        await releaseUnusedTelefonos(
                                            solicitante,
                                            false,
                                            true,
                                            recentUnfinalized.map((p) => p.id),
                                        );
                                    } else {
                                        // Cancelar
                                        return;
                                    }
                                } else {
                                    if (btnToDisable && !btnToDisable.disabled) {
                                        btnToDisable.disabled = true;
                                        btnToDisable.innerHTML =
                                            '<i class="fas fa-circle-notch fa-spin"></i> Solicitando...';
                                    }
                                }

                                // Release any unfinalized numbers from previous sessions before starting a new one (safety net)
                                const isActive = !!(
                                    window._phoneSessionActive ||
                                    localStorage.getItem("phone_session_active") === "true"
                                );
                                if (!isActive) {
                                    console.log(
                                        `[Telefonía] 🧹 Limpiando números de sesión previa para: ${solicitante}`,
                                    );
                                    await releaseUnusedTelefonos(solicitante, false, true);
                                }

                                console.log(`[Telefonía] 🚀 Solicitando números para: ${solicitante}`);
                                const count = await solicitarNumeros(30, solicitante);
                                console.log(`[Telefonía] ✅ Respuesta de solicitarNumeros: ${count} asignados`);

                                if (count > 0) {
                                    window._phoneSessionActive = true;
                                    localStorage.setItem("phone_session_active", "true");
                                    localStorage.setItem("phone_session_owner", solicitante);
                                    sessionStorage.setItem("phone_session_active_this_tab", "true");
                                    showNotification(`Se han asignado ${count} números nuevos.`, "success");
                                    await refreshConductorView(true);
                                } else {
                                    // U8: Restaurar botón si no hay números disponibles
                                    showNotification("No hay más números disponibles en este momento.", "warning");
                                    if (btnToDisable) {
                                        btnToDisable.disabled = false;
                                        if (oldHtml) btnToDisable.innerHTML = oldHtml;
                                    }
                                }
                            } catch (err) {
                                console.error("[Telefonía] ❌ Error al solicitar números:", err);
                                showNotification("Error al solicitar números", "error");
                                if (btnToDisable) {
                                    btnToDisable.disabled = false;
                                    if (oldHtml) btnToDisable.innerHTML = oldHtml;
                                }
                            }
                        }

                        // PASO 2: Fix del botón "Iniciar" (Solicitar Números)
                        const btnSolicitar = container.querySelector("#btn-solicitar");
                        if (btnSolicitar) {
                            btnSolicitar.onclick = async (e) => {
                                e.stopPropagation();
                                const now = Date.now();
                                const conductorsInSession = (window._activeOthers || []).filter(
                                    (c) => c.sessionActive && c.lastActive > now - 40000,
                                );

                                if (conductorsInSession.length > 0) {
                                    const collabState = container.querySelector("#phone-start-collaboration-state");
                                    const initialState = container.querySelector("#phone-start-initial-state");
                                    if (collabState && initialState) {
                                        initialState.classList.add("hidden");
                                        collabState.classList.remove("hidden");
                                        window._collabStateDismissed = false;
                                        updatePresenceAndSessionsUI();
                                    }
                                } else {
                                    const oldHtml = btnSolicitar.innerHTML;
                                    await iniciarSolicitudNumerosFlow(btnSolicitar, oldHtml);
                                }
                            };
                        }

                        window._joinSession = async (ownerName) => {
                            localStorage.setItem("phone_session_owner", ownerName);
                            localStorage.setItem("phone_session_active", "true");
                            sessionStorage.setItem("phone_session_active_this_tab", "true");
                            window._phoneSessionActive = true;
                            showNotification(`Te has unido a la sesión de ${ownerName}`, "success");
                            await refreshConductorView(true);
                        };

                        window._startNewSessionDirect = async () => {
                            const btnSolicitar = container.querySelector("#btn-solicitar");
                            const oldHtml = btnSolicitar ? btnSolicitar.innerHTML : "";
                            await iniciarSolicitudNumerosFlow(btnSolicitar, oldHtml);
                        };

                        const btnFinalizarFloat = container.querySelector("#btn-finalizar-float");
                        if (btnFinalizarFloat) {
                            btnFinalizarFloat.onclick = async () => {
                                const joinedOwner = localStorage.getItem("phone_session_owner");
                                const currentConductorName =
                                    localStorage.getItem("selected_conductor_name") || displayName;
                                const isOwner =
                                    !joinedOwner ||
                                    normalizeRobust(joinedOwner) === normalizeRobust(currentConductorName);

                                if (isOwner) {
                                    // U3: Mostrar spinner durante la finalización CRM
                                    const prevHtml = btnFinalizarFloat.innerHTML;
                                    btnFinalizarFloat.disabled = true;
                                    btnFinalizarFloat.innerHTML = '<i class="fas fa-circle-notch fa-spin text-sm"></i>';
                                    try {
                                        await window.finalizarPredicacionTelefonia();
                                    } finally {
                                        btnFinalizarFloat.disabled = false;
                                        btnFinalizarFloat.innerHTML = prevHtml;
                                    }
                                } else {
                                    // Non-owner: desconectarse de la sesión compartida
                                    window._phoneSessionActive = false;
                                    localStorage.removeItem("phone_session_active");
                                    localStorage.removeItem("phone_session_owner");
                                    sessionStorage.removeItem("phone_session_active_this_tab");
                                    showNotification("Te has desconectado de la sesión", "info");
                                    refreshConductorView(true);
                                }
                            };
                        }

                        // ══════════════ AMALGAMA VISCOSA GOOEY MENU ══════════════
                        const menuWrapper = container.querySelector("#gooey-menu-wrapper");
                        const labelsContainer = container.querySelector("#gooey-labels-container");
                        const btnSolicitarFloat = container.querySelector("#btn-solicitar-more-float");
                        const btnSolicitarNumbersGoo = container.querySelector("#btn-solicitar-more-numbers-goo");
                        const btnAgregarPublicadorGoo = container.querySelector("#btn-agregar-publicador-goo");

                        if (btnSolicitarFloat && menuWrapper && labelsContainer) {
                            const closeGooeyMenu = () => {
                                menuWrapper.classList.remove("open");
                                labelsContainer.classList.remove("open");
                            };

                            btnSolicitarFloat.onclick = (e) => {
                                e.stopPropagation();
                                const isOpen = menuWrapper.classList.toggle("open");
                                labelsContainer.classList.toggle("open", isOpen);
                            };

                            // Cierra el menú al hacer clic en cualquier otra parte de la pantalla
                            if (window._closeGooeyMenuHandler) {
                                document.removeEventListener("click", window._closeGooeyMenuHandler);
                            }
                            window._closeGooeyMenuHandler = closeGooeyMenu;
                            document.addEventListener("click", window._closeGooeyMenuHandler);

                            // Evitar que hacer clic dentro del contenedor del menú lo cierre inmediatamente
                            menuWrapper.addEventListener("click", (e) => {
                                e.stopPropagation();
                            });

                            if (btnSolicitarNumbersGoo) {
                                btnSolicitarNumbersGoo.onclick = async (e) => {
                                    e.stopPropagation();
                                    closeGooeyMenu();
                                    const oldHtml = btnSolicitarNumbersGoo.innerHTML;
                                    await iniciarSolicitudNumerosFlow(btnSolicitarNumbersGoo, oldHtml);
                                };
                            }

                            if (btnAgregarPublicadorGoo) {
                                btnAgregarPublicadorGoo.onclick = async (e) => {
                                    e.stopPropagation();
                                    closeGooeyMenu();

                                    const { value: formValues } = await window.Swal.fire({
                                        title: "NUEVO PUBLICADOR",
                                        html: `
                                            <div class="space-y-4 text-left p-2">
                                                <div>
                                                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nombre y Apellido</label>
                                                    <input id="swal-pub-nombre" class="input-premium w-full text-xs font-bold" placeholder="EJ. JUAN PÉREZ" style="border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; padding: 12px; font-size: 13px; width: 100%; box-sizing: border-box;">
                                                </div>
                                                <div>
                                                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Teléfono</label>
                                                    <input id="swal-pub-telefono" class="input-premium w-full text-xs font-bold" placeholder="EJ. 0998877665" style="border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; padding: 12px; font-size: 13px; width: 100%; box-sizing: border-box;">
                                                </div>
                                                <div class="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Género</label>
                                                        <select id="swal-pub-genero" class="input-premium w-full text-xs font-bold" style="border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; padding: 12px; font-size: 13px; width: 100%; box-sizing: border-box; background: white;">
                                                            <option value="H">MASCULINO</option>
                                                            <option value="M">FEMENINO</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Grupo</label>
                                                        <select id="swal-pub-grupo" class="input-premium w-full text-xs font-bold" style="border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; padding: 12px; font-size: 13px; width: 100%; box-sizing: border-box; background: white;">
                                                            <option value="1">GRUPO 1</option>
                                                            <option value="2">GRUPO 2</option>
                                                            <option value="3">GRUPO 3</option>
                                                            <option value="4">GRUPO 4</option>
                                                            <option value="5">GRUPO 5</option>
                                                            <option value="6">GRUPO 6</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        `,
                                        focusConfirm: false,
                                        confirmButtonText: "GUARDAR",
                                        showCancelButton: true,
                                        cancelButtonText: "CANCELAR",
                                        customClass: {
                                            popup: "rounded-[2rem] bg-white dark:bg-[#0a0f18]/95 border border-slate-200/60 dark:border-white/10",
                                            confirmButton:
                                                "btn-pro bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                                            cancelButton:
                                                "btn-pro bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                                        },
                                        preConfirm: () => {
                                            const nombreInput = document.getElementById("swal-pub-nombre");
                                            const telefonoInput = document.getElementById("swal-pub-telefono");
                                            const generoInput = document.getElementById("swal-pub-genero");
                                            const grupoInput = document.getElementById("swal-pub-grupo");

                                            const nombre = nombreInput ? nombreInput.value.trim() : "";
                                            const telefono = telefonoInput ? telefonoInput.value.trim() : "";
                                            const genero = generoInput ? generoInput.value : "H";
                                            const grupo = grupoInput ? parseInt(grupoInput.value, 10) : 1;

                                            if (!nombre) {
                                                window.Swal.showValidationMessage("El nombre es obligatorio");
                                                return false;
                                            }
                                            return { nombre, telefono, genero, grupo };
                                        },
                                    });

                                    if (formValues) {
                                        const newPublisher = {
                                            ...formValues,
                                            es_conductor: false,
                                            email: "",
                                            privilegios: ["Publicador"],
                                            disponibilidad: [],
                                            modulos: {
                                                habilitado: true,
                                                agenda: false,
                                                programa: false,
                                                disponibilidad: false,
                                                telefonos: true,
                                                mapas: false,
                                                ayudas: false,
                                                cerebro: false,
                                                rescue: false,
                                            },
                                        };
                                        try {
                                            await addPublicador(newPublisher);
                                            showNotification("Publicador agregado exitosamente", "success");
                                            await refreshConductorView(true);
                                        } catch (error) {
                                            console.error("Error al agregar publicador:", error);
                                            showNotification("Error al guardar el publicador", "error");
                                        }
                                    }
                                };
                            }
                        }

                        // B8 fix: evaluación de visibilidad ya fue hecha en las líneas 630-642;
                        // esta segunda evaluación era redundante y podía deshacer la primera.
                        // Eliminada para evitar condiciones de carrera.

                        // Re-subscribe or update Telefonos Live Pool based on current session owner
                        const joinedOwner = localStorage.getItem("phone_session_owner");
                        const sessionQueryOwner =
                            joinedOwner || window.XolvyApp?.identity?.nombreCanonico || displayName;
                        const isActive = !!(
                            window._phoneSessionActive || localStorage.getItem("phone_session_active") === "true"
                        );
                        const cleanQueryOwner = toTitleCase(sessionQueryOwner);

                        if (cleanQueryOwner !== currentSubscribedOwner || isActive !== currentSubscribedActive) {
                            if (telefonosLivePoolUnsubscribe) {
                                telefonosLivePoolUnsubscribe();
                                telefonosLivePoolUnsubscribe = null;
                            }

                            currentSubscribedOwner = cleanQueryOwner;
                            currentSubscribedActive = isActive;

                            if (isActive) {
                                console.log(`📡 [Live Pool] Subscribing to telefonos for owner: ${cleanQueryOwner}`);
                                telefonosLivePoolUnsubscribe = startLivePool(
                                    "telefonos",
                                    [where("solicitado_por", "==", cleanQueryOwner)],
                                    async (data) => {
                                        console.log("☎️ [Live Pool] Telephones updated in real-time:", data.length);
                                        if (!container?.isConnected) return;
                                        // FIX: Actualizar solo el módulo de teléfonos en lugar de re-renderizar todo el dashboard.
                                        // Esto evita la tormenta de re-renders y las notificaciones duplicadas
                                        // cuando se asigna un publicador o estado.
                                        try {
                                            const updatedPhones = await refreshPhones();
                                            const publicadoresLive = await getPublicadores();
                                            if (mPhone?.initializePhoneModule) {
                                                mPhone.initializePhoneModule(
                                                    updatedPhones,
                                                    publicadoresLive,
                                                    displayName,
                                                    container.querySelector("#phone-tbody"),
                                                    () => refreshConductorView(true),
                                                );
                                            }
                                            // Actualizar visibilidad según resultado
                                            const compactViewLive = container.querySelector("#phone-compact-view");
                                            const expandedViewLive = container.querySelector("#phone-expanded-view");
                                            const floatingActionsLive =
                                                container.querySelector("#phone-floating-actions");
                                            if (updatedPhones.length > 0 && window._phoneSessionActive) {
                                                compactViewLive?.classList.add("hidden");
                                                expandedViewLive?.classList.remove("hidden");
                                                floatingActionsLive?.classList.replace("hidden", "flex");
                                            } else {
                                                compactViewLive?.classList.remove("hidden");
                                                expandedViewLive?.classList.add("hidden");
                                                floatingActionsLive?.classList.replace("flex", "hidden");
                                            }
                                        } catch (liveErr) {
                                            console.error("[Live Pool] Error actualizando teléfonos en vivo:", liveErr);
                                        }
                                    },
                                );
                            }
                        }

                        updatePresenceAndSessionsUI();
                        resolve();
                    } catch (e) {
                        console.error("Refresh error", e);
                        resolve();
                    }
                }, 300);
            });
        }
        window.refreshConductorView = refreshConductorView;

        initSwipeActions = () => {
            const cards = document.querySelectorAll(".territory-card-swipe");
            cards.forEach((card) => {
                const content = card.querySelector(".swipe-content");
                const leftAction = card.querySelector(".swipe-action-left");
                const rightAction = card.querySelector(".swipe-action-right");

                let startX = 0;
                let currentX = 0;
                let isMoving = false;

                card.addEventListener("touchstart", (e) => {
                    startX = e.touches[0].clientX;
                    isMoving = true;
                    if (content) content.style.transition = "none";
                });

                card.addEventListener("touchmove", (e) => {
                    if (!isMoving || !content) return;
                    currentX = e.touches[0].clientX - startX;
                    if (Math.abs(currentX) > 100) return;

                    content.style.transform = `translateX(${currentX}px)`;

                    if (currentX > 30) {
                        if (leftAction) leftAction.style.opacity = Math.min(1, (currentX - 30) / 40);
                        card.style.backgroundColor = "rgba(37, 99, 235, 0.8)";
                    } else if (currentX < -30) {
                        if (rightAction) rightAction.style.opacity = Math.min(1, (Math.abs(currentX) - 30) / 40);
                        card.style.backgroundColor = "rgba(13, 148, 136, 0.8)";
                    } else {
                        if (leftAction) leftAction.style.opacity = 0;
                        if (rightAction) rightAction.style.opacity = 0;
                        card.style.backgroundColor = "transparent";
                    }
                });

                card.addEventListener("touchend", () => {
                    isMoving = false;
                    if (!content) return;
                    content.style.transition = "transform 0.3s ease";

                    if (Math.abs(currentX) > 70) {
                        if (currentX > 0) {
                            const t = {
                                id: card.dataset.id,
                                numero: card.dataset.num,
                                manzanas: card.dataset.manzanas,
                                coordenadas: card.dataset.coords ? JSON.parse(card.dataset.coords) : null,
                            };
                            if (window.openInteractiveMap) window.openInteractiveMap(t);
                        } else {
                            if (window.ReceptionHub) {
                                const currentFullName =
                                    displayName || window.XolvyApp?.user?.nombre || "Usuario_Desconocido";
                                console.log("Enviando al modal de swipe el nombre:", currentFullName);
                                window.renderTableCallback = () => refreshConductorView(true);
                                ReceptionHub.openModal({
                                    preSelectedId: card.dataset.id,
                                });
                            }
                        }
                    }
                    content.style.transform = "translateX(0px)";
                    currentX = 0;
                });
            });
        };

        initNexoSystem = async () => {
            if (document.getElementById("nexo-widget")) document.getElementById("nexo-widget").remove();
            if (document.getElementById("nexo-fab")) document.getElementById("nexo-fab").remove();
        };

        // UI Shell Injection (RESTAURACIÓN PREMIUM V2.5 - ORDEN ESTRICTO)
        container.innerHTML = `
        <div id="conductor-shell-root" class="flex flex-col w-full overflow-hidden bg-slate-50 dark:bg-[#05070a] animate-fade-in" style="height:100vh;height:100dvh;" data-adaptive-container="true">
            <header class="flex items-center justify-between bg-white dark:bg-[#030712] border-b border-slate-200/10 dark:border-white/5 sticky top-0 z-40 shadow-sm p-4 lg:hidden flex-none transition-colors duration-300">
                <div class="flex items-center gap-3">
                    <button id="menu-toggle-btn" class="p-2 text-emerald-600 dark:text-emerald-400 focus:outline-none active:scale-95 transition-transform">
                        <svg class="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                    <div class="flex items-center gap-2">
                        <span class="text-amber-400 text-sm">❖</span>
                        <span class="text-emerald-750 dark:text-emerald-400 font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase">CONGREGACIÓN "NUEVE DE OCTUBRE"</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 relative z-10 shrink-0">
                     <div id="connection-status-badge-mobile" class="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 select-none">
                        <span id="connection-status-ping-mobile" class="relative flex h-1.5 w-1.5">
                            <span class="saas-spinner-ring-mobile animate-ping bg-emerald-500/30 rounded-full w-1.5 h-1.5 absolute"></span>
                            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 animate-pulse"></span>
                        </span>
                        <span id="connection-status-text-mobile">Conductor</span>
                     </div>
                </div>
            </header>
            <div class="flex flex-col lg:flex-row flex-1 min-w-0 min-h-0 overflow-hidden relative">
                <div id="mobile-overlay" class="fixed inset-0 bg-slate-900/50 z-40 hidden lg:hidden backdrop-blur-sm transition-opacity cursor-pointer"></div>
                <aside id="main-sidebar" class="fixed inset-y-0 left-0 z-50 w-48 bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl border-r border-slate-200/50 dark:border-emerald-900/30 transform -translate-x-full transition-transform duration-300 lg:static lg:translate-x-0 lg:flex lg:w-52 flex-col h-full shadow-2xl lg:shadow-none p-4 justify-between">
                    
                    <!-- Floating close button for mobile drawer -->
                    <button id="btn-close-sidebar" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 lg:hidden focus:outline-none transition-all rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer z-50">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>

                    <nav class="flex-1 flex flex-col h-full min-h-0 overflow-y-auto hide-scrollbar space-y-1.5 pt-4">
                        <div class="space-y-1.5 flex-1">
                            <button class="nav-item active w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest transition-all focus:outline-none">
                                <i class="fas fa-home stroke-1.5" stroke-width="1.5"></i> <span class="sidebar-text">Inicio</span>
                            </button>
                        </div>
                        
                        <div class="pt-4 border-t border-slate-200/50 dark:border-emerald-900/30 space-y-1.5 mt-auto">
                            <button onclick="import('./services/user-profile-modal.js').then(m => m.openUserProfileModal());" class="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-500 text-[9px] font-black uppercase tracking-widest transition-all focus:outline-none">
                                <i class="fas fa-id-card stroke-1.5" stroke-width="1.5"></i> <span class="sidebar-text">Mi Perfil</span>
                            </button>
                            <button onclick="window.toggleTheme();" class="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-[9px] font-medium uppercase tracking-widest transition-all focus:outline-none">
                                <i class="fas fa-adjust stroke-1.5" stroke-width="1.5"></i> <span class="sidebar-text">Cambiar Tema</span>
                            </button>
                            ${
                                ["Administrador", "SuperAdmin"].includes(window.XolvyApp?.user?.role)
                                    ? `
                                <button id="btn-modo-admin" class="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-[9px] font-medium uppercase tracking-widest transition-all focus:outline-none">
                                    <i class="fas fa-shield-alt stroke-1.5" stroke-width="1.5"></i> <span class="sidebar-text">Modo Admin</span>
                                </button>
                            `
                                    : ""
                            }
                            <button id="logout-btn" class="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 text-[9px] font-medium uppercase tracking-widest transition-all focus:outline-none">
                                <i class="fas fa-sign-out-alt stroke-1.5" stroke-width="1.5"></i> <span class="sidebar-text">Salir</span>
                            </button>
                        </div>
                    </nav>
                </aside>
                <main class="flex-1 min-w-0 flex flex-col min-w-0 h-auto lg:h-full overflow-hidden bg-slate-50 dark:bg-[#0a0f18] relative">

                <!-- Desktop / Main Header (Ultra compact God level) -->
                <header class="shrink-0 z-20 bg-white dark:bg-[#0a0f18] border-b border-slate-200/50 dark:border-white/5 px-6 md:px-12 py-4 flex items-center justify-between gap-6 relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent pointer-events-none"></div>
                    <div class="flex items-center gap-3 relative z-10">
                        <div class="w-10 h-10 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl flex items-center justify-center text-white text-base font-black shadow-lg shadow-emerald-500/30 shrink-0 border border-white/20 animate-float">
                            ${displayName.charAt(0)}
                        </div>
                        <h2 class="text-xl md:text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none font-sans">
                            Hola, ${displayName.split(" ")[0]}
                        </h2>
                    </div>
                    
                    <!-- Double Pill Role Switcher Bar (Far Right Position) -->
                    <div class="flex items-center gap-3 relative z-10 shrink-0">
                         <div id="main-header-role-switcher" class="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-inner">
                            ${userRole === "Publicador" ? `
                            <button onclick="window.switchAppRole('Publicador')" class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-emerald-600 text-white shadow-md">
                                <i class="fas fa-user text-[10px]"></i>
                                <span>Publicador</span>
                            </button>` : `
                            <button onclick="window.switchAppRole('Conductor')" class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-indigo-600 text-white shadow-md">
                                <i class="fas fa-id-badge text-[10px]"></i>
                                <span>Conductor</span>
                            </button>`}
                            
                            ${checkAdminPrivileges() ? `
                            <button onclick="window.switchAppRole('Administrador')" class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-200/50 dark:hover:bg-white/5 cursor-pointer">
                                <i class="fas fa-user-shield text-[10px]"></i>
                                <span>Admin</span>
                            </button>` : `
                            <div class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-slate-300 dark:text-slate-600/40 bg-slate-200/30 dark:bg-white/[0.02] cursor-not-allowed select-none flex items-center gap-1.5 opacity-60">
                                <i class="fas fa-lock text-[9px] opacity-40"></i>
                                <span>Admin</span>
                            </div>`}
                         </div>
                    </div>
                </header>

                <!-- Phase 4: Main Content Container -->
                <div class="flex-1 min-w-0 overflow-y-auto custom-scrollbar relative z-10 bg-slate-50/50 dark:bg-black/10">
                    
                    <!-- Dynamic Banner -->
                    <div id="dynamic-banner-container" class="w-full flex items-center px-4 md:px-12 py-3 bg-white/20 dark:bg-black/10 border-b border-slate-200/50 dark:border-white/5 relative z-40 overflow-hidden box-border">
                        <div class="flex items-center gap-3.5 w-full max-w-full">
                            <i class="fas fa-bullhorn text-indigo-500 text-sm animate-pulse shrink-0 drop-shadow-md"></i>
                            <div class="bg-indigo-50/50 dark:bg-indigo-500/5 px-4 md:px-6 py-2.5 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10 shadow-inner flex items-center flex-1 min-w-0 overflow-hidden">
                                <div id="dynamic-banner-content" class="text-[9px] sm:text-[10px] font-black text-indigo-600/80 dark:text-indigo-300/90 uppercase tracking-[0.25em] w-full overflow-hidden">Sincronizando últimas actualizaciones...</div>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col gap-3 md:gap-4 px-4 md:px-12 py-2 md:py-3 pb-20">
                        <!-- Content Sections (Agenda, Programa, etc.) -->
                        <div id="agenda-section" class="space-y-2 pb-3 border-b border-slate-200 dark:border-white/5">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/10 text-sm">
                                    <i class="fas fa-bolt animate-pulse"></i>
                                </div>
                                <div>
                                    <h3 class="text-base font-black text-slate-800 dark:text-white uppercase tracking-wider">Agenda Inteligente</h3>
                                </div>
                            </div>
                            <div id="active-agenda-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4"></div>
                        </div>

                        <div id="programa-semanal-section" class="modern-card !p-0 overflow-hidden">
                            <details id="details-programa" class="group/prog-details">
                                <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-10 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-transparent group-open/prog-details:border-slate-100 dark:group-open/prog-details:border-white/5 relative">
                                    <div class="flex items-start gap-4 md:gap-8 relative z-10 w-full md:w-auto">
                                        <div class="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl md:text-3xl text-amber-500 border border-amber-500/10">
                                            <i class="fas fa-calendar-alt"></i>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-4">
                                                <h3 class="text-xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Cronograma</h3>
                                                <i class="fas fa-chevron-down text-sm text-slate-600 dark:text-slate-400 group-open/prog-details:rotate-180 transition-transform"></i>
                                            </div>
                                            <p class="text-[9px] md:text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 opacity-80">Programa semanal</p>
                                        </div>
                                    </div>
                                </summary>
                                <div class="p-4 md:p-8 space-y-6 md:space-y-10 animate-fade-in group-open/prog-details:block hidden">
                                    <div class="flex items-center justify-center bg-slate-50 dark:bg-white/[0.02] p-4 rounded-3xl border border-slate-100 dark:border-white/5">
                                        <div id="prog-week-range" class="px-6 py-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-500/10 text-center shadow-inner">Cargando...</div>
                                        <div id="prog-turn-filters" class="hidden"></div>
                                    </div>
                                    <div id="prog-day-selector" class="flex gap-2 items-center justify-center overflow-x-auto no-scrollbar w-full"></div>
                                    <div id="weekly-program-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"></div>
                                </div>
                            </details>
                        </div>

                        <!-- 1. MAPA (Debajo de Cronograma) -->
                        <div id="interactive-maps-module" class="modern-card !p-0 overflow-hidden">
                             <details id="details-maps" class="group/maps-details">
                                 <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-10 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-transparent group-open/maps-details:border-slate-100 dark:group-open/maps-details:border-white/5 relative">
                                    <div class="flex items-start gap-4 md:gap-8 relative z-10 w-full md:w-auto">
                                        <div class="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-2xl md:text-3xl text-emerald-500 border border-emerald-500/10">
                                            <i class="fas fa-map-marked-alt"></i>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-4">
                                                <h3 class="text-xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Mapa</h3>
                                                <i class="fas fa-chevron-down text-sm text-slate-600 dark:text-slate-400 group-open/maps-details:rotate-180 transition-transform"></i>
                                            </div>
                                            <p class="text-[9px] md:text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 opacity-80">Mapa del territorio</p>
                                        </div>
                                    </div>
                                 </summary>
                                 <div class="p-4 md:p-8 animate-fade-in group-open/maps-details:block hidden">
                                      <div id="maps-explorer-content-container"></div>
                                 </div>
                             </details>
                        </div>

                        <!-- 2. TELEFONÍA -->
                        <div id="phone-module-card" class="modern-card !p-0" style="overflow: visible !important;">
                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-10 border-b border-slate-100 dark:border-white/5 relative">
                                <div class="flex items-start gap-4 md:gap-8 relative z-10 w-full md:w-auto">
                                    <div class="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-2xl md:text-3xl text-indigo-500 border border-indigo-500/10">
                                        <i class="fas fa-phone-alt"></i>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <h3 class="text-xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Telefonía</h3>
                                        <p class="text-[9px] md:text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 opacity-80">Predicación en vivo y colaboración</p>
                                    </div>
                                </div>
                                <div id="active-sessions-badge-container" class="hidden items-center gap-1.5 bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-500/20 animate-pulse mt-4 md:mt-0">
                                    <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
                                    <span id="active-sessions-count" class="text-[9px] font-black uppercase tracking-widest">0 sesiones abiertas</span>
                                </div>
                            </div>
                            <div class="p-4 md:p-8 space-y-6">
                                <div id="phone-compact-view" class="animate-fade-in py-10">
                                    <div class="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-slate-900 p-8 md:p-12 text-center rounded-[2.5rem] border border-indigo-100 dark:border-indigo-500/10 shadow-inner max-w-xl mx-auto animate-fade-in">
                                        <!-- STATE A: Initial View -->
                                        <div id="phone-start-initial-state" class="space-y-6">
                                            <div class="w-16 h-16 md:w-20 md:h-20 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-3xl md:text-4xl text-indigo-600 mx-auto mb-6">
                                                <i class="fas fa-phone-alt"></i>
                                            </div>
                                            <h3 class="text-xl md:text-2xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tighter">¿Listo para Predicar?</h3>
                                            <button id="btn-solicitar" class="btn-pro bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest text-[10px] mx-auto">
                                                <i class="fas fa-play text-base"></i> Iniciar
                                            </button>
                                        </div>
                                        <!-- STATE B: Collaboration View -->
                                        <div id="phone-start-collaboration-state" class="hidden space-y-6 text-left">
                                            <!-- Dynamic sessions content -->
                                        </div>
                                    </div>
                                </div>
                                <div id="phone-expanded-view" class="hidden animate-fade-in space-y-6">
                                    <div id="phone-stats-bar"></div>
                                    <div class="w-full sm:overflow-visible overflow-x-auto">
                                        <table class="w-full text-left border-collapse">
                                            <thead class="hidden sm:table-header-group sticky top-0 bg-white dark:bg-[#0b0f19] backdrop-blur-xl z-30 border-b border-slate-200 dark:border-white/10">
                                                <tr class="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                                                    <th class="p-4">Teléfono</th>
                                                    <th class="p-4">Nombre</th>
                                                    <th class="p-4">Dirección</th>
                                                    <th class="p-4">Asignado a</th>
                                                    <th class="p-4 text-center">Estado</th>
                                                    <th class="p-4">Notas</th>
                                                </tr>
                                            </thead>
                                            <tbody id="phone-tbody" class="divide-y divide-slate-50 dark:divide-white/5"></tbody>
                                        </table>
                                    </div>

                                </div>
                            </div>
                        </div>

                        <!-- 3. DISPONIBILIDAD (Abajo de Telefonía) -->
                        <div id="availability-section" class="modern-card !p-0 overflow-hidden">
                             <details id="details-availability" class="group/avail-details">
                                 <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-10 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-transparent group-open/avail-details:border-slate-100 dark:group-open/avail-details:border-white/5 relative">
                                    <div class="flex items-start gap-4 md:gap-8 relative z-10 w-full md:w-auto">
                                        <div class="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center text-2xl md:text-3xl text-teal-500 border border-teal-500/10">
                                            <i class="fas fa-user-clock"></i>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-4">
                                                <h3 class="text-xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Disponibilidad</h3>
                                                <i class="fas fa-chevron-down text-sm text-slate-600 dark:text-slate-400 group-open/avail-details:rotate-180 transition-transform"></i>
                                            </div>
                                            <p class="text-[9px] md:text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 opacity-80">Gestión de horarios</p>
                                        </div>
                                    </div>
                                </summary>
                                <div id="availability-container" class="p-4 md:p-8 animate-fade-in group-open/avail-details:block hidden"></div>
                             </details>
                        </div>

                        <div id="recursos-container-section" class="modern-card !p-0 overflow-hidden">
                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-10 border-b border-slate-100 dark:border-white/5 relative">
                                <div class="flex items-start gap-4 md:gap-8 relative z-10 w-full md:w-auto">
                                    <div class="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl md:text-3xl text-amber-500 border border-amber-500/10">
                                        <i class="fas fa-hands-helping"></i>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <h3 class="text-xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Recursos</h3>
                                        <p class="text-[9px] md:text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 opacity-80">Materiales y enlaces de apoyo</p>
                                    </div>
                                </div>
                            </div>
                            <div class="p-4 md:p-8">
                                <div id="recursos-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"></div>
                            </div>
                        </div>

                        <!-- 4. MI INFORME (Registro de Horas) -->
                        <div id="mi-informe-section"></div>
                    </div>
                </div>
                </main>

                <!-- SVG Gooey Filter definition -->
                <svg xmlns="http://www.w3.org/2000/svg" version="1.1" class="hidden" style="display:none; position: absolute; width: 0; height: 0;">
                  <defs>
                    <filter id="gooey-amalgam">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
                      <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                  </defs>
                </svg>

                <div id="phone-floating-actions" class="fixed bottom-6 right-6 hidden flex-col items-center gap-3 z-[99999] animate-slide-up pointer-events-none">
                    <div id="gooey-menu-wrapper" class="gooey-menu-container pointer-events-auto relative flex flex-col items-center justify-center w-14 h-14">
                        <!-- Sub-button: Agregar publicador -->
                        <button id="btn-agregar-publicador-goo" class="gooey-item btn-pro absolute bg-indigo-600 hover:bg-indigo-700 text-white w-11 h-11 rounded-full shadow-lg flex items-center justify-center border border-white/20 dark:border-slate-800 text-[10px]" title="Agregar publicador">
                            <i class="fas fa-user-plus text-xs"></i>
                        </button>
                        <!-- Sub-button: Solicitar números -->
                        <button id="btn-solicitar-more-numbers-goo" class="gooey-item btn-pro absolute bg-teal-600 hover:bg-teal-700 text-white w-11 h-11 rounded-full shadow-lg flex items-center justify-center border border-white/20 dark:border-slate-800 text-[10px]" title="Solicitar 30 números más">
                            <i class="fas fa-phone-alt text-xs"></i>
                        </button>
                        <!-- Main green "+" trigger button -->
                        <button id="btn-solicitar-more-float" class="btn-pro w-12 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center justify-center border-2 border-white dark:border-slate-900 relative z-10 text-sm">
                            <i class="fas fa-plus transition-transform duration-350"></i>
                        </button>
                    </div>
                    
                    <!-- Sharp floating labels (independent of gooey filter to remain completely clear) -->
                    <div id="gooey-labels-container" class="absolute pointer-events-none inset-0">
                        <div id="lbl-solicitar-more" class="absolute right-16 bottom-[138px] bg-slate-950/80 backdrop-blur text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest opacity-0 scale-90 transition-all duration-300">Solicitar Números</div>
                        <div id="lbl-agregar-publicador" class="absolute right-16 bottom-[192px] bg-slate-950/80 backdrop-blur text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest opacity-0 scale-90 transition-all duration-300">Agregar Publicador</div>
                    </div>
                    
                    <!-- Finalizar button -->
                    <button id="btn-finalizar-float" class="btn-pro w-12 h-12 bg-rose-500 text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-2 border-white dark:border-slate-900 pointer-events-auto text-sm" title="Finalizar Sesión">
                        <i class="fas fa-power-off"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Global Modal Containers -->
        <div id="modal-container" class="fixed inset-0 bg-slate-950/40 backdrop-blur-sm hidden overflow-y-auto z-[100] p-4 flex justify-center items-center transition-all duration-300"></div>
        <div id="modal-container-nested" class="fixed inset-0 bg-slate-950/60 backdrop-blur-md hidden overflow-y-auto z-[500] p-4 flex justify-center items-center transition-all duration-300"></div>

        `;

        // UI Initialization (Synchronous DOM guarantee)
        requestAnimationFrame(async () => {
            console.log("🎨 [Dashboard] Lifecycle: Shell injected, starting Unified Load...");
            await loadUnifiedDashboard(
                container,
                displayName,
                null,
                null,
                null,
                userRole,
                {
                    territorios: allT,
                    telefonos: allTel,
                    publicadores: allPublicadores,
                    programa: initialProg,
                },
                { mAvail, mRec, mMaps, mRescue, mPhone, mProg },
            );

            // ══════════════ BOTÓN SALIR (DEEP PURGE) ══════════════
            const logoutBtn = container.querySelector("#logout-btn");
            if (logoutBtn) {
                logoutBtn.onclick = async (e) => {
                    e.preventDefault();
                    console.log("🛑 [ConductorDash] Iniciando purga de sesión...");

                    // 1. Detener todos los Live Pools activos
                    if (typeof window.stopActiveLivePools === "function") {
                        window.stopActiveLivePools();
                    }

                    // 2. Liberar sesión telefónica si está activa
                    if (window._phoneSessionActive) {
                        try {
                            await window.finalizarPredicacionTelefonia();
                        } catch (err) {
                            console.error("Error finalizando telefonía en logout:", err);
                        }
                    }

                    // 3. Limpieza completa de LocalStorage y SessionStorage
                    localStorage.removeItem("selected_conductor_name");
                    localStorage.removeItem("xolvy_session");
                    localStorage.removeItem("phone_session_active");
                    localStorage.clear();
                    sessionStorage.removeItem("phone_session_active_this_tab");

                    // 4. Firebase SignOut
                    await auth.signOut();

                    // 5. Redirección
                    location.href = "/login";
                };
            }

            // BOTON MODO ADMIN
            const modoAdminBtn = container.querySelector("#btn-modo-admin");
            if (modoAdminBtn) {
                modoAdminBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (typeof window.switchToAdminView === "function") {
                        window.switchToAdminView();
                    } else {
                        window.location.href = "/administrador";
                    }
                });
            }

            // FIX: Ensure telephony and dynamic features sync on first load
            await refreshConductorView(true);
            window.initMobileMenu();

            // Sincronizar tema en la barra lateral recién montada
            if (typeof window.updateDOMThemeToggles === "function") {
                window.updateDOMThemeToggles(localStorage.getItem("theme") || "auto");
            }

            // ══════════════ ESTADO DE CONEXIÓN DINÁMICO ══════════════
            const updateConnectionStatusBadge = (isOnline) => {
                const badge = container.querySelector("#connection-status-badge");
                const dotRing = container.querySelector("#connection-status-ping .saas-spinner-ring");
                const dotDot = container.querySelector("#connection-status-ping .relative.inline-flex");
                const text = container.querySelector("#connection-status-text");

                const badgeMobile = container.querySelector("#connection-status-badge-mobile");
                const dotRingMobile = container.querySelector(
                    "#connection-status-ping-mobile .saas-spinner-ring-mobile",
                );
                const dotDotMobile = container.querySelector("#connection-status-ping-mobile .relative.inline-flex");
                const textMobile = container.querySelector("#connection-status-text-mobile");

                if (isOnline) {
                    if (badge) {
                        badge.className =
                            "px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 select-none";
                    }
                    if (dotRing)
                        dotRing.className = "saas-spinner-ring animate-ping bg-emerald-500/30 rounded-full w-2 h-2";
                    if (dotDot)
                        dotDot.className = "relative inline-flex rounded-full h-2 w-2 bg-emerald-500 animate-pulse";
                    const activeRole = window.XolvyApp?.user?.role || window.XolvyApp?.user?.rol || "Conductor";
                    const roleLabel = activeRole === "Administrador" ? "Terminal Admin" : activeRole === "Publicador" ? "Terminal Publicador" : "Terminal Conductor";
                    if (text) text.textContent = roleLabel.toUpperCase();

                    if (badgeMobile) {
                        badgeMobile.className =
                            "px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 select-none";
                    }
                    if (dotRingMobile)
                        dotRingMobile.className =
                            "saas-spinner-ring-mobile animate-ping bg-emerald-500/30 rounded-full w-1.5 h-1.5 absolute";
                    if (dotDotMobile)
                        dotDotMobile.className =
                            "relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 animate-pulse";
                    if (textMobile) textMobile.textContent = activeRole.toUpperCase();
                } else {
                    if (badge) {
                        badge.className =
                            "px-3 py-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 select-none animate-pulse";
                    }
                    if (dotRing)
                        dotRing.className = "saas-spinner-ring animate-ping bg-rose-500/30 rounded-full w-2 h-2";
                    if (dotDot) dotDot.className = "relative inline-flex rounded-full h-2 w-2 bg-rose-500";
                    if (text) text.textContent = "Sin Conexión • PWA Offline";

                    if (badgeMobile) {
                        badgeMobile.className =
                            "px-2.5 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 select-none animate-pulse";
                    }
                    if (dotRingMobile)
                        dotRingMobile.className =
                            "saas-spinner-ring-mobile animate-ping bg-rose-500/30 rounded-full w-1.5 h-1.5 absolute";
                    if (dotDotMobile)
                        dotDotMobile.className = "relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500";
                    if (textMobile) textMobile.textContent = "Sin Conexión";
                }
            };

            if (window._updateConnectionStatusBadge) {
                window.removeEventListener("online", window._onlineListener);
                window.removeEventListener("offline", window._offlineListener);
            }
            window._onlineListener = () => updateConnectionStatusBadge(true);
            window._offlineListener = () => updateConnectionStatusBadge(false);
            window._updateConnectionStatusBadge = updateConnectionStatusBadge;
            window.addEventListener("online", window._onlineListener);
            window.addEventListener("offline", window._offlineListener);
            updateConnectionStatusBadge(navigator.onLine);

            // LEVANTAR EL TELÓN (Destruir el Loading Stage)
            levantarCortina();
        });
    } catch (error) {
        console.error("Dashboard initialization failed:", error);
        ocultarOverlay();
        showNotification("Error al cargar dashboard", "error");
    }

    // --- INNER FUNCTIONS (RETAINING SCOPE) ---

    async function loadUnifiedDashboard(
        container,
        name,
        userMods,
        _configData,
        conductorData,
        _userRole,
        poolData = null,
        subModules = {},
    ) {
        // FASE 2: Render Lock — prevent concurrent render storms
        if (window.__isRenderingDashboard) {
            console.warn("[Dashboard] loadUnifiedDashboard: render lock active, skipping");
            return;
        }
        window.__isRenderingDashboard = true;

        const { mAvail, mRec, mMaps, mProg } = subModules;
        if (!container) {
            console.warn("[Dashboard] loadUnifiedDashboard: container es null");
            window.__isRenderingDashboard = false;
            return;
        }

        if (!conductorData) {
            conductorData = {
                nombre: name,
                modulos: {
                    agenda: true,
                    programa: true,
                    disponibilidad: true,
                    telefonos: true,
                    mapas: true,
                    ayudas: true,
                },
                disponibilidad: {
                    lunes: [],
                    martes: [],
                    miercoles: [],
                    jueves: [],
                    viernes: [],
                    sabado: [],
                    domingo: [],
                },
            };
        }

        // OPTIMIZACIÓN: Si el esqueleto ya está inyectado, no lo borres todo.
        const isShellInjected = !!container.querySelector("#conductor-shell-root");

        console.log(
            `🎨 [Dashboard] Lifecycle: loadUnifiedDashboard ${isShellInjected ? "updating data only" : "rendering full shell"}...`,
        );

        try {
            // S-13 Sincronización: Combinar territorios con las asignaciones activas de banco_s13 (Fuente única de la verdad)
            const activeAssignments = {};
            (poolData?.banco_s13 || []).forEach((data) => {
                const key = data.territorio_doc_id || data.territorio_id;
                if (key) {
                    activeAssignments[String(key)] = data;
                }
                if (data.numero) {
                    activeAssignments[String(data.numero)] = data;
                }
            });

            const allTerritorios = (poolData?.territorios || []).map((t) => {
                const assignment = activeAssignments[String(t.id)] || activeAssignments[String(t.numero)];
                if (assignment) {
                    return {
                        ...t,
                        estado: assignment.estado || "Asignado",
                        status: assignment.estado || "Asignado",
                        asignado_a: assignment.conductor || null,
                        currentAssignee: assignment.conductor || null,
                        fecha_asignacion: assignment.fecha_asignacion || null,
                        assignmentDate: assignment.fecha_asignacion || null,
                        auxiliar: assignment.auxiliar || null,
                        turno: assignment.turno || null,
                        last_assignment: assignment
                    };
                } else {
                    return {
                        ...t,
                        estado: "Disponible",
                        status: "Disponible",
                        asignado_a: null,
                        currentAssignee: null,
                        fecha_asignacion: null,
                        assignmentDate: null,
                        auxiliar: null,
                        turno: null,
                        last_assignment: null
                    };
                }
            });
            const userModsEffectivos = conductorData?.modulos ||
                userMods || {
                    agenda: true,
                    programa: true,
                    disponibilidad: true,
                    telefonos: true,
                    mapas: true,
                    ayudas: true,
                    cerebro: true,
                };
            const programa = poolData?.programa;
            const normalizedName = normalizeRobust(name);

            // 1. Data Processing
            const territoryMap = {};
            allTerritorios.forEach((t) => {
                if (t.numero) territoryMap[t.numero] = t;
            });

            // Dynamically get all active keys matching our shifts
            const currentWeekId = getSafeDateId(getMonday(new Date()));
            const assignments = [];
            const shownTerritoryIds = new Set();

            if (programa?.dias) {
                programa.dias.forEach((d, idx) => {
                    const mondayDate = new Date(`${programa.id}T12:00:00`);
                    if (!d.fecha) {
                        const dayDate = new Date(mondayDate);
                        dayDate.setDate(dayDate.getDate() + idx);
                        d.fecha = getSafeDateId(dayDate);
                    }

                    const activeDayKeys = Object.keys(d).filter((key) => {
                        const base = key.split("_")[0];
                        return ["manana", "tarde", "noche", "zoom"].includes(base);
                    });

                    activeDayKeys.forEach((turno) => {
                        const tData = d[turno];
                        if (tData && (tData.conductor || tData.auxiliar || tData.lugar)) {
                            const isConductor = normalizeRobust(tData.conductor) === normalizedName;
                            const isAuxiliar = normalizeRobust(tData.auxiliar) === normalizedName;

                            if (!isConductor && !isAuxiliar) return;

                            let assignedTerritoryNums = [];
                            if (tData.territorio) {
                                assignedTerritoryNums = tData.territorio
                                    .split(/[,/]+/)
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                            }

                            const attachedTerritories = assignedTerritoryNums.map((num) => {
                                return territoryMap[num] || { numero: num, estado: "Disponible", status: "Disponible" };
                            });

                            attachedTerritories.forEach((t) => {
                                if (t.id) shownTerritoryIds.add(t.id);
                            });

                            assignments.push({
                                dia: d.nombre,
                                turno:
                                    turno.startsWith("manana")
                                        ? "🌅 Mañana"
                                        : turno.startsWith("tarde")
                                          ? "☀️ Tarde"
                                          : turno.startsWith("zoom")
                                            ? "📹 Zoom"
                                            : "🌙 Noche",
                                role: isConductor ? "Conductor" : "Auxiliar",
                                isMember: true,
                                rawDate: d.fecha,
                                attachedTerritories,
                                faceta: tData.faceta || "Predicación",
                                ...tData,
                            });
                        }
                    });
                });
            }

            // Grouping for rendering
            const groupedByDay = {};
            assignments.forEach((a) => {
                if (!groupedByDay[a.dia]) groupedByDay[a.dia] = { dia: a.dia, shifts: [] };
                groupedByDay[a.dia].shifts.push(a);
            });

            const totalActiveTerritories = assignments.reduce(
                (acc, a) => acc + (a.attachedTerritories?.length || 0),
                0,
            );
            const hasShifts = assignments.length > 0;
            const allCompleted = hasShifts && totalActiveTerritories === 0;

            // 2. Template Strings
            const agendaContainer = container.querySelector("#active-agenda-container");
            if (agendaContainer) {
                if (!hasShifts) {
                    agendaContainer.innerHTML = `
<div class="col-span-full py-4 px-6 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/50 dark:border-white/10 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in relative overflow-hidden group rounded-3xl shadow-lg">
    <!-- Ambient Spotlights -->
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none transition-all duration-1000 group-hover:scale-125"></div>
    <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
    
    <div class="flex flex-col sm:flex-row items-center gap-4 relative z-10 text-center sm:text-left">
        <div class="w-10 h-10 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center text-xl text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-400/30 shadow-inner shrink-0 animate-float">
            <i class="fas fa-calendar-day"></i>
        </div>
        <div class="space-y-0.5">
            <h4 class="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Sin asignaciones activas</h4>
            <p class="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
                Revisa el cronograma de salidas o contacta con el Departamento de Territorios.
            </p>
        </div>
    </div>
    
    <!-- Premium Interactive Button -->
    <button onclick="window.scrollToCronograma()" class="relative z-20 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-indigo-600/15 flex items-center gap-2 group shrink-0 select-none border border-white/10 hover:shadow-lg">
        <i class="fas fa-calendar-alt opacity-70 group-hover:opacity-100 transition-opacity"></i> Ver programa de predicación
    </button>
</div>
                    `;
                } else if (allCompleted) {
                    agendaContainer.innerHTML = `
<div class="col-span-full py-10 px-6 bg-emerald-500/5 dark:bg-[#0f231e]/30 !rounded-3xl border border-emerald-500/20 text-center animate-bounce-in shadow-xl shadow-emerald-500/5 relative overflow-hidden group">
    <div class="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
    <div class="text-5xl mb-4 flex justify-center text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)] relative z-10 transition-transform group-hover:scale-110 duration-700">
        <i class="fas fa-trophy animate-float"></i>
    </div>
    <div class="relative z-10">
        <h4 class="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-1">¡Misión Cumplida!</h4>
        <p class="text-emerald-600 dark:text-emerald-400 font-black text-[11px] uppercase tracking-[0.2em]">Territorio al 100%</p>
        <div class="mt-4 flex justify-center">
            <div class="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-[0_12px_24px_rgba(16,185,129,0.25)] hover:scale-105 transition-transform cursor-default">
                <i class="fas fa-star mr-2"></i> Excelente trabajo, ${name.split(" ")[0]}
            </div>
        </div>
    </div>
</div>
                    `;
                } else {
                    agendaContainer.innerHTML = Object.values(groupedByDay)
                        .map(
                            (day) => `
                        <div class="day-group flex flex-col h-full space-y-2.5 animate-fade-in w-full">
                            <div class="flex items-center justify-between px-1.5 mb-1.5">
                                <h3 class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">${day.dia}</h3>
                                <div class="h-px flex-1 min-w-0 bg-slate-100 dark:bg-white/5 mx-3"></div>
                            </div>
                            
                            ${day.shifts
                                .map(
                                    (a) => `
                                <div class="assignment-card flex-1 w-full max-w-md flex flex-col bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-3xl p-4 border border-slate-200/50 dark:border-white/10 shadow-lg hover:shadow-xl dark:shadow-black/20 hover:border-indigo-500/30 transition-all duration-300 group">
                                    <div class="flex items-center justify-between gap-3 mb-2.5 shrink-0">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-xl ${a.turno.includes("Mañana") ? "bg-orange-500/10 text-orange-500" : "bg-indigo-500/10 text-indigo-500"} flex items-center justify-center text-xs shadow-inner group-hover:rotate-12 transition-transform">
                                                <i class="fas ${a.turno.includes("Mañana") ? "fa-sun" : "fa-moon"}"></i>
                                            </div>
                                            <div>
                                                <h4 class="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-widest leading-none mb-0.5">${a.turno}</h4>
                                                <div class="flex items-center gap-1">
                                                    <i class="fas fa-map-pin text-[7px] text-indigo-500/60"></i>
                                                    <p class="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight truncate max-w-[200px]" title="${a.lugar || "Ubicación pendiente"}">${a.lugar || "Ubicación pendiente"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
 
                                    <!-- Content Area -->
                                    <div class="flex-1 flex flex-col justify-start gap-3">
                                        <!-- Roles Grid Side-by-Side (Ultra space-saving God level) -->
                                        <div class="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-black/10 p-2.5 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <div class="space-y-0.5 pl-2 border-l-2 ${a.role === "Conductor" ? "border-indigo-500 dark:border-indigo-400" : "border-slate-200 dark:border-white/5"}">
                                                <p class="text-[8px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider leading-none">Conductor</p>
                                                <p class="text-xs font-black ${a.role === "Conductor" ? "text-indigo-600 dark:text-indigo-400 font-extrabold" : "text-slate-750 dark:text-slate-300"} whitespace-normal break-words leading-tight mt-0.5 min-w-[50px]">${a.conductor || "---"}</p>
                                            </div>
                                            <div class="space-y-0.5 pl-2 border-l-2 ${a.role === "Auxiliar" ? "border-indigo-500 dark:border-indigo-400" : "border-slate-200 dark:border-white/5"}">
                                                <p class="text-[8px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider leading-none">Auxiliar</p>
                                                <p class="text-xs font-black ${a.role === "Auxiliar" ? "text-indigo-600 dark:text-indigo-400 font-extrabold" : "text-slate-750 dark:text-slate-300"} whitespace-normal break-words leading-tight mt-0.5 min-w-[50px]">${a.auxiliar || "---"}</p>
                                            </div>
                                        </div>
 
                                        <!-- Territories -->
                                        ${
                                            a.attachedTerritories.length > 0
                                                ? `
                                            <div class="flex flex-wrap items-center gap-1.5">
                                                <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400" title="Territorios Asignados">
                                                    <i class="fas fa-map-location-dot text-[9px]"></i>
                                                </div>
                                                ${a.attachedTerritories
                                                    .map((t) => {
                                                        const safeNum = String(t.numero).trim();
                                                        const dropId =
                                                            `dropdown-${a.dia}-${a.turno}-${safeNum}`.replace(
                                                                /\s+/g,
                                                                "-",
                                                            );
                                                        return `
                                                    <div class="relative inline-block text-left">
                                                        <button onclick="window.toggleTerritoryDropdown(event, '${dropId}')" 
                                                                class="flex items-center gap-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all group/tbtn shadow-sm select-none">
                                                                <span class="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">${safeNum}</span>
                                                                <i class="fas fa-map-marked-alt text-[9px] text-indigo-500 group-hover/tbtn:scale-110 transition-transform"></i>
                                                        </button>
                                                        <!-- Dropdown Menu -->
                                                        <div id="${dropId}" class="hidden absolute left-0 mt-1 w-28 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                                                            <button onclick="window.abrirMapaTerritorio('${safeNum}', 'satelital')" class="w-full text-left px-2.5 py-1.5 text-[9px] font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 border-b border-slate-100 dark:border-white/5">
                                                                <i class="fas fa-satellite text-indigo-500 text-[9px]"></i> Mapa
                                                            </button>
                                                            <button onclick="window.abrirMapaTerritorio('${safeNum}', 'croquis')" class="w-full text-left px-2.5 py-1.5 text-[9px] font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5">
                                                                <i class="fas fa-map text-indigo-500 text-[9px]"></i> Croquis
                                                            </button>
                                                        </div>
                                                    </div>
                                                    `;
                                                    })
                                                    .join("")}
                                            </div>
                                        `
                                                : ""
                                        }
                                    </div>
 
                                    <!-- Footer (Pushed to bottom) -->
                                    <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 shrink-0">
                                        ${
                                            a.attachedTerritories.length > 0
                                                ? `
                                            <button class="territory-report-btn w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white font-extrabold text-[9px] uppercase tracking-wider shadow-md active:scale-95 transition-all group/btn whitespace-normal text-center h-9"
                                                data-ids="${a.attachedTerritories.map((t) => t.id).join(",")}" 
                                                data-nums="${a.attachedTerritories.map((t) => t.numero).join(",")}"
                                                data-conductor="${a.conductor || window.XolvyApp?.identity?.nombreCanonico || ""}"
                                                data-auxiliar="${a.auxiliar || ""}">
                                                <i class="fas fa-file-signature opacity-75 group-hover/btn:rotate-12 transition-transform"></i> Informar Actividad
                                            </button>
                                        `
                                                : `
                                            <div class="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-center space-y-1">
                                                <div class="w-7 h-7 rounded-lg bg-white dark:bg-[#0a0f18] mx-auto flex items-center justify-center text-primary text-xs shadow-sm border border-transparent dark:border-white/5">
                                                    <i class="fas ${a.faceta === "Telefónica" ? "fa-phone-alt" : a.faceta === "Cartas" ? "fa-envelope-open-text" : "fa-bullhorn"}"></i>
                                                </div>
                                                <div>
                                                    <p class="text-[8px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-widest mb-0.5 opacity-60">Actividad Especial</p>
                                                    <p class="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">${a.faceta}</p>
                                                </div>
                                            </div>
                                        `
                                        }
                                    </div>
                                </div>
                            `,
                                )
                                .join("")}
                        </div>
                    `,
                        )
                        .join("");
                }
            }

            // --- GOD-LEVEL INFINITE SEAMLESS MARQUEE (PRECISE OFFSET & SPEED) ---
            const bannerContainer = container.querySelector("#dynamic-banner-container");
            const bannerContent = container.querySelector("#dynamic-banner-content");

            // Clean up any legacy intervals
            if (window._bannerInterval) {
                clearInterval(window._bannerInterval);
                window._bannerInterval = null;
            }
            // Clean up any legacy resize observers
            if (window._marqueeObserver) {
                window._marqueeObserver.disconnect();
                window._marqueeObserver = null;
            }

            if (bannerContainer && bannerContent) {
                const configData = poolData?.configuracion || {};
                const messages = [];

                if (configData.tema_mes?.trim()) {
                    messages.push(`TEMA DE LA SEMANA: ${configData.tema_mes.trim().toUpperCase()}`);
                }
                if (Array.isArray(configData.diffusion_messages)) {
                    configData.diffusion_messages.forEach((msg) => {
                        if (msg?.trim()) messages.push(`ANUNCIO: ${msg.trim().toUpperCase()}`);
                    });
                }

                if (messages.length > 0) {
                    bannerContainer.style.setProperty("display", "flex", "important");
                    bannerContainer.classList.remove("hidden");

                    const colors = ["#3b82f6", "#06b6d4", "#f59e0b"];
                    const bullet = '<span style="color:rgba(148,163,184,0.3); margin: 0 1.5rem;">|</span>';

                    let htmlContent = "";
                    if (configData.tema_mes?.trim()) {
                        htmlContent += `<span class="font-extrabold text-blue-500 mr-2">TEMA DE LA SEMANA:</span><span class="text-slate-700 dark:text-slate-200 font-bold">${configData.tema_mes.trim().toUpperCase()}</span>`;
                    }

                    if (Array.isArray(configData.diffusion_messages)) {
                        configData.diffusion_messages.forEach((msg, idx) => {
                            if (!msg?.trim()) return;
                            if (htmlContent) htmlContent += bullet;
                            const color = colors[idx % colors.length];
                            htmlContent += `<span class="font-extrabold mr-2" style="color:${color}">ANUNCIO:</span><span class="text-slate-700 dark:text-slate-200 font-bold">${msg.trim().toUpperCase()}</span>`;
                        });
                    }

                    // Create single track for accurate off-screen scrolling without duplicate clutter
                    bannerContent.innerHTML = `
                        <div class="marquee-track-god flex items-center whitespace-nowrap" style="display: inline-flex; white-space: nowrap; width: max-content; will-change: transform; position: relative;">
                            ${htmlContent}
                        </div>
                    `;

                    // Ensure CSS keyframes and class overrides are injected
                    if (!document.getElementById("marquee-keyframes-god")) {
                        const styleNode = document.createElement("style");
                        styleNode.id = "marquee-keyframes-god";
                        styleNode.innerHTML = `
                            @keyframes marquee-scroll-god {
                                0% { transform: translate3d(var(--scroll-start), 0, 0); }
                                100% { transform: translate3d(var(--scroll-end), 0, 0); }
                            }
                            .marquee-track-god {
                                display: inline-flex !important;
                                width: max-content !important;
                                white-space: nowrap !important;
                                will-change: transform !important;
                            }
                            .marquee-track-god span {
                                padding: 0 !important;
                            }
                        `;
                        document.head.appendChild(styleNode);
                    }

                    const track = bannerContent.querySelector(".marquee-track-god");

                    // Setup ResizeObserver to dynamically update start, end, and duration to ensure perfect alignment & speed
                    const updateMarqueeBounds = () => {
                        if (!bannerContent.isConnected || !track.isConnected) return;
                        const W = bannerContent.offsetWidth || 1000;
                        const T = track.offsetWidth || 500;

                        track.style.setProperty("--scroll-start", `${W}px`);
                        track.style.setProperty("--scroll-end", `-${T}px`);

                        // Calculated duration keeps a uniform speed of 75px per second
                        const scrollDistance = W + T;
                        const calculatedDuration = Math.max(8, scrollDistance / 75);
                        track.style.animation = `marquee-scroll-god ${calculatedDuration}s linear infinite`;
                    };

                    const resizeObserver = new ResizeObserver(() => {
                        updateMarqueeBounds();
                    });

                    resizeObserver.observe(bannerContent);
                    window._marqueeObserver = resizeObserver;

                    // Initial call
                    setTimeout(updateMarqueeBounds, 50);

                    // Set wrapper styling
                    Object.assign(bannerContent.style, {
                        display: "block",
                        width: "100%",
                        overflow: "hidden",
                        opacity: "1",
                    });

                    const wrapper = bannerContent.parentElement;
                    if (wrapper) {
                        wrapper.style.overflow = "hidden";
                        wrapper.style.flex = "1";
                    }
                } else {
                    bannerContainer.style.setProperty("display", "none", "important");
                    bannerContainer.classList.add("hidden");
                }
            }

            // Cleanup & Bindings
            setTimeout(() => {
                const refreshedAgendaContainer = container.querySelector("#active-agenda-container");
                if (!refreshedAgendaContainer) {
                    console.warn("[Dashboard] agendaContainer aún no disponible tras 800ms");
                    return;
                }
                const btnsReport = refreshedAgendaContainer.querySelectorAll(".territory-report-btn");
                btnsReport.forEach((btn) => {
                    btn.onclick = () => {
                        const ids = btn.dataset.ids.split(",");
                        const conductor = btn.dataset.conductor;
                        const auxiliar = btn.dataset.auxiliar;
                        if (window.ReceptionHub) {
                            window.renderTableCallback = () => window.refreshConductorView(true);
                            ReceptionHub.openModal({
                                preSelectedIds: ids,
                                viewMode: "conductor",
                                displayName: conductor || name,
                                scheduledConductor: conductor || "",
                                scheduledAuxiliar: auxiliar || "",
                                isAdmin: false,
                            });
                        }
                    };
                });

                // Window toggle dropdown handler
                window.toggleTerritoryDropdown = (event, id) => {
                    event.stopPropagation();
                    document.querySelectorAll('[id^="dropdown-"]').forEach((el) => {
                        if (el.id !== id) {
                            el.classList.add("hidden");
                        }
                    });
                    const target = document.getElementById(id);
                    if (target) {
                        target.classList.toggle("hidden");
                    }
                };

                window.scrollToCronograma = () => {
                    const details = document.getElementById("details-programa");
                    if (details) {
                        details.open = true;
                    }
                    const section = document.getElementById("programa-semanal-section");
                    if (section) {
                        section.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                };

                if (!window.__dropdownListenerAdded) {
                    document.addEventListener("click", (e) => {
                        document.querySelectorAll('[id^="dropdown-"]').forEach((el) => {
                            if (!el.contains(e.target) && !e.target.closest("button")) {
                                el.classList.add("hidden");
                            }
                        });
                    });
                    window.__dropdownListenerAdded = true;
                }

                if (typeof initSwipeActions === "function") initSwipeActions();
            }, 800);

            // Sub-modules render
            if (userModsEffectivos.disponibilidad !== false && mAvail?.renderAvailabilitySection) {
                mAvail.renderAvailabilitySection(document.getElementById("availability-container"), name);
            }
            // 6. AYUDAS & RELEVOS (Removido por solicitud del usuario)

            // 8. RECURSOS DEL MINISTERIO
            if (userModsEffectivos.ayudas !== false && mRec?.renderRecursosSection) {
                mRec.renderRecursosSection(document.getElementById("recursos-container"));
            }
            if (userModsEffectivos.mapas !== false && mMaps?.renderMapsExplorer) {
                mMaps.renderMapsExplorer(container, allTerritorios, (t) => window.openInteractiveMap(t));
                const btnGlobalMap = container.querySelector("#btn-open-global-map-explorer");
                if (btnGlobalMap) {
                    btnGlobalMap.onclick = () => {
                        if (window.openGlobalMap) window.openGlobalMap(allTerritorios);
                        else showNotification("MapViewer global no cargado", "error");
                    };
                }
            }
            if (userModsEffectivos.programa !== false && mProg?.initializeWeeklyProgram) {
                // Persist state during refresh
                if (!window._activeProgDayIndex) window._activeProgDayIndex = -1;
                if (!window._activeProgTurns) window._activeProgTurns = new Set(["manana", "tarde", "zoom", "noche"]);

                mProg.initializeWeeklyProgram(
                    container,
                    userModsEffectivos,
                    allTerritorios,
                    territoryMap,
                    name,
                    currentWeekId,
                    window._activeProgDayIndex,
                    window._activeProgTurns,
                );
            }

            const miInformeSec = container.querySelector("#mi-informe-section");
            if (miInformeSec) {
                await renderMiInformeModule(miInformeSec, name || displayName);
            }

            const isPublicadorMode = (_userRole === "Publicador" || window.XolvyApp?.user?.role === "Publicador");
            if (isPublicadorMode) {
                const hideSectionIds = ["availability-section", "phone-module-card"];
                hideSectionIds.forEach((id) => {
                    const el = container.querySelector("#" + id);
                    if (el) el.classList.add("hidden");
                });
            }
            ocultarOverlay();
        } catch (err) {
            console.error("Critical error in renderConductorDashboard:", err);
            ocultarOverlay();
            if (container) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-fade-in bg-slate-50 dark:bg-[#02040f] text-slate-800 dark:text-slate-100" style="min-height: 100vh; min-height: 100dvh;">
                        <div class="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center text-3xl mb-6 shadow-xl border border-rose-500/20">
                            <i class="fas fa-triangle-exclamation"></i>
                        </div>
                        <h3 class="text-xl font-black uppercase tracking-tight">Error de Conexión</h3>
                        <p class="text-slate-500 dark:text-slate-400 max-w-md mt-2 font-bold text-xs">
                            No se pudieron cargar los datos del Dashboard (${err?.message || "Error de red o Firestore"}).
                        </p>
                        <div class="flex flex-wrap justify-center gap-3 mt-8">
                            <button onclick="if(window.refreshConductorView){ window.refreshConductorView(true); } else { location.reload(); }" class="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all">
                                <i class="fas fa-rotate-right mr-2"></i> Reintentar Carga
                            </button>
                            <button onclick="localStorage.clear(); sessionStorage.clear(); location.href='/'" class="bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">
                                <i class="fas fa-user-gear mr-2"></i> Cambiar Perfil
                            </button>
                        </div>
                    </div>
                `;
            }
        } finally {
            // FASE 2: Release render lock after brief cooldown
            setTimeout(() => {
                window.__isRenderingDashboard = false;
            }, 500);
        }
    }
};

window.abrirModalTerritorios = async (dia, turno, idsRaw) => {
    const ids = idsRaw.split("|");
    const allTerritorios = await getTerritorios();

    const territories = ids.map((id) => allTerritorios.find((t) => t.id === id)).filter(Boolean);

    const html = `
        <div class="flex flex-col h-full max-h-[85vh]">
            <header class="p-8 border-b border-slate-100 dark:border-white/5 shrink-0 bg-slate-50 dark:bg-slate-900/50">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 text-xl shadow-inner">
                        <i class="fas fa-map-location-dot"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">${dia} - ${turno}</h3>
                        <p class="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Territorios Asignados (${territories.length})</p>
                    </div>
                </div>
            </header>
            
            <div class="flex-1 min-w-0 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                ${territories
                    .map((t) => {
                        return `
                    <div class="p-6 bg-white dark:bg-white/[0.03] rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm space-y-4">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <div class="w-14 h-14 bg-primary dark:bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-primary/20">
                                    T${t.numero}
                                </div>
                                <div class="min-w-0 flex-1 min-w-0">
                                    <h5 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight break-words whitespace-normal leading-tight">${t.manzanas || "Sin manzanas"}</h5>
                                    <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">${t.localidad || "Territorio"}</p>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3 pt-2">
                            <button onclick="window.viewMapFromReport('${t.id}', 'satelital')" class="py-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2 whitespace-normal text-center h-auto">
                                <i class="fas fa-satellite text-indigo-500"></i> Mapa
                            </button>
                            <button onclick="window.viewMapFromReport('${t.id}', 'croquis')" class="py-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2 whitespace-normal text-center h-auto">
                                <i class="fas fa-map text-indigo-500"></i> Croquis
                            </button>
                            <button onclick="window.closeModal(); window.promptReturnTerritorio('${t.id}', '${t.numero}')" class="col-span-2 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 whitespace-normal text-center h-auto shadow-lg shadow-emerald-500/10">
                                <i class="fas fa-check-circle"></i> Entregar Territorio
                            </button>
                        </div>
                    </div>
                `;
                    })
                    .join("")}
            </div>

            <footer class="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                <button onclick="window.closeModal()" class="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-colors whitespace-normal text-center h-auto">Cerrar Ventana</button>
            </footer>
        </div>
    `;

    showModal(html, null, "max-w-md");
};

// End of conductor-dashboard.js
