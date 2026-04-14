
import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "firebase/auth";
import { where, documentId, arrayUnion, onSnapshot, doc } from "firebase/firestore";
import {
    getTerritorios, getPublicadores, getTelefonos, getTelefonosParaSesion,
    getConfiguracion,
    getProgramaSemanal, saveProgramaSemanal, syncSlotWithTerritories, getTerritoryHistory,
    addPublicador,
    releaseUnusedTelefonos, solicitarNumeros, updateTelefonoStatus, logSessionSummary, releaseTelefonosById,
    transferTerritory, takeTerritoryPartial, assignFreeTerritory,
    startLivePool, returnTerritorio, updateTerritorio, logReturn
} from '../data/firestore-services.js';
import { 
    renderSkeleton, 
    showNotification, 
    normalizeRobust, 
    formatManzanas, 
    getSafeDateId, 
    getMonday 
} from './utils/helpers.js';
import { NexoAgent } from './nexo-ai/nexo-core.js';
import { NexoManifest } from './nexo-ai/territorios-manifest.js';
import { MapViewer } from './map-viewer.js';
import { AppConfig } from './utils/config.js';

import { UIHelpers, showModal, showCustomPrompt } from './services/ui-helpers.js';
import { VisualEngine } from './utils/visual-engine.js';
window.AppConfig = AppConfig;

import { moduleRegistry } from './utils/module-registry.js';
import './conductor/conductor-actions.js';
import { ReceptionHub } from './services/reception-hub.js';

// --- MICRO-MODULE LOADER ---
const dynamicSubModules = import.meta.glob('./**/*.js');

async function loadSubModule(name, path) {
    return moduleRegistry.loadModule(name, path, dynamicSubModules);
}


// --- UTILS ---
window.viewMapFromReport = async (id) => {
    if (!id) return;
    showNotification("Cargando mapa interactivo...", "info");
    const territories = await getTerritorios();
    const t = territories.find(x => x.id === id);
    if (t) {
        window.openInteractiveMap(t);
    } else {
        showNotification("No se encontró la data del territorio para el mapa.", "error");
    }
};

window.abrirMapaTerritorio = async function(numeroTerritorio) {
    if (!numeroTerritorio) return;
    console.log("Abriendo mapa para territorio:", numeroTerritorio);
    try {
        const territories = await getTerritorios();
        const target = territories.find(t => String(t.numero) === String(numeroTerritorio));
        if (target) {
            window.viewMapFromReport(target.id);
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
    const overlay = document.getElementById('login-sync-overlay');
    if (overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 500);
    }
};


export const renderConductorDashboard = async (container, nameOrEmail, appVersion, userRole = null) => {
    if (!container) {
        console.warn('[Dashboard] container es null — abortando render');
        return;
    }

    
    console.log("🚀 [Conductor] Starting Parallel Initialization...");
    
    // 1. Render Skeleton + Immediate Overlay Dismissal (with safety timeout)
    const safetyTimeout = setTimeout(ocultarOverlay, 3000);
    renderSkeleton(container);
    ocultarOverlay();
    clearTimeout(safetyTimeout);

    // --- AUTH GUARD (FASTBOOT SYNC) ---
    const esperarAuth = () => new Promise(resolve => {
        if (auth.currentUser) { resolve(); return; }
        console.log("⏳ [Dashboard] Esperando Firebase Auth para carga de datos...");
        const t = setTimeout(() => {
            console.warn("⚠️ [Dashboard] Timeout esperando Auth — procediendo...");
            resolve();
        }, 4000);
        const unsub = onAuthStateChanged(auth, u => {
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
            Promise.all([
                getTerritorios(),
                getTelefonos(),
                getPublicadores(),
                getProgramaSemanal(currentWeekId)
            ]),
            Promise.all([
                loadSubModule('availability', './conductor/availability.js'),
                loadSubModule('recursos', './conductor/recursos.js'),
                loadSubModule('maps_explorer', './conductor/maps-explorer.js'),
                loadSubModule('rescue', './conductor/rescue.js'),
                loadSubModule('phone_module', './conductor/phone-module.js'),
                loadSubModule('weekly_program', './conductor/weekly-program.js')
            ])
        ]);

        const [allT, allTel, publicadores, initialProg] = baseData;
        const [mAvail, mRec, mMaps, mRescue, mPhone, mProg] = modules;

        // Xolvy Identity Shield: Use canonical identity as the Single Source of Truth
        const identity = window.XolvyApp?.identity;
        let displayName = identity ? identity.nombreCanonico : (normalizeRobust(nameOrEmail || 'Usuario'));
        
        console.log("[IdentityShield] Conductor Dashboard cargado con nombre canónico:", displayName);

        // PASO 1: Garantizar que conductorData sea el perfil oficial de la identidad blindada
        let conductorData = null;
        if (identity && identity.docId) {
            const allC = await getPublicadores();
            conductorData = allC.find(c => (c.id === identity.docId) || (c.nombre === displayName)) || null;
        }

        if (!conductorData) {
            console.warn(`[Identity Shield] Conductor no encontrado inicialmente para: ${displayName}. Reintentando resolution...`);
        }
        // Redundantes: ya vienen del import

        // Xolvy Modular: Pool Data and Unsubscribe references (Initialized early for HMS/LivePool access)
        let currentLivePoolUnsubscribe = null;
        let programLivePoolUnsubscribe = null;
        let territoriesLivePoolUnsubscribe = null;
        let s13LivePoolUnsubscribe = null;
        let configLivePoolUnsubscribe = null;
        let currentSystemConfig = null;
        let poolData = {
            territorios: allT,
            programa: null,
            s13: [],
            banco_s13: [] // FIX-A: Track active assignments from the S-13 live pool
        };

        // Xolvy Modular: Cleanup function for all active Firestore listeners
        window.stopActiveLivePools = () => {
            [currentLivePoolUnsubscribe, programLivePoolUnsubscribe,
                territoriesLivePoolUnsubscribe, s13LivePoolUnsubscribe,
                configLivePoolUnsubscribe].forEach(unsub => {
                    if (typeof unsub === 'function') unsub();
                });
            currentLivePoolUnsubscribe = null;
            programLivePoolUnsubscribe = null;
            territoriesLivePoolUnsubscribe = null;
            s13LivePoolUnsubscribe = null;
            configLivePoolUnsubscribe = null;
            // FIX-D: Cleanup global event listener to avoid duplicates on HMS remount
            if (window.__territoryReleasedHandler) {
                window.removeEventListener('territorio-liberado', window.__territoryReleasedHandler);
                window.__territoryReleasedHandler = null;
            }
            console.log("🛑 [Live Pool] All conductor pools stopped.");
        };

        // FIX-D + PASO 3: Handler mejorado del evento 'territorio-liberado'.
        const _onTerritorioLiberado = async (e) => {
            if (!(container && container.isConnected)) return;
            console.log('[Live Pool] 🔔 territorio-liberado recibido:', e.detail);
            if (window.__forcePoolRefresh) {
                await window.__forcePoolRefresh();
            } else {
                refreshConductorView(true);
            }
        };
        if (window.__territoryReleasedHandler) {
            window.removeEventListener('territorio-liberado', window.__territoryReleasedHandler);
        }
        window.__territoryReleasedHandler = _onTerritorioLiberado;
        window.addEventListener('territorio-liberado', _onTerritorioLiberado);

        // FIX-D: Exponer forcePoolRefresh como red de seguridad para módulos externos
        window.__forcePoolRefresh = async () => {
            try {
                const { getDocs, collection: col, query: q, where: wh } = await import('firebase/firestore');
                const { db: _db } = await import('../firebase-config.js');
                const tSnap = await getDocs(col(_db, 'territorios'));
                poolData.territorios = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const s13Snap = await getDocs(q(col(_db, 'banco_s13'), wh('fecha_entrega', '==', null)));
                poolData.banco_s13 = s13Snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (container && container.isConnected) refreshConductorView(true);
                console.log('[Pool] 🔄 Refresh forzado completado');
            } catch (err) {
                console.warn('[Pool] forcePoolRefresh error:', err);
            }
        };

        // --- CORE LOGIC HELPERS (Hoisted via 'function' for reliability) ---
        async function obtenerConductorData(nombreConductor, intentos = 3) {
            // Identity Shield: Confía ciegamente en el mapeo ya realizado
            const identity = window.XolvyApp?.identity;
            const canonicalName = identity?.nombreCanonico || nombreConductor;

            if (identity && identity.docId) {
                const allC = await getPublicadores();
                const found = allC.find(c => c.id === identity.docId || c.nombre === canonicalName);
                if (found) return { ...found, es_conductor: true };
            }

            const normalized = String(nombreConductor || '').trim().toLowerCase();
            const normalizedPhone = normalized.replace(/\D/g, '');

            for (let i = 0; i < intentos; i++) {
                const allC = await getPublicadores();
                const conductor = allC.find(c => {
                    const name = normalizeRobust(c.nombre || c.nombre_completo);
                    const email = normalizeRobust(c.email);
                    const phone = String(c.telefono || '').replace(/\D/g, '');
                    return name === normalized || email === normalized || (normalizedPhone && phone === normalizedPhone);
                });
                
                if (conductor) return conductor;
                await new Promise(r => setTimeout(r, 800));
            }
            
            return {
                nombre: canonicalName,
                modulos: { agenda: true, programa: true, disponibilidad: true, telefonos: true, mapas: true, ayudas: true, rescue: false },
                disponibilidad: {},
                es_conductor: true
            };
        }

        async function refreshPhones() {
            const identity = window.XolvyApp?.identity;
            const userName = identity?.nombreCanonico || displayName;
            const userEmail = identity?.email || auth.currentUser?.email;

            // PASO 3: Normalización estricta para el filtrado del Live Pool
            const allPhones = await getTelefonosParaSesion(userName);
            const cleanUserName = normalizeRobust(userName);
            const cleanUserEmail = normalizeRobust(userEmail);

            return allPhones.filter(t => {
                const pub = normalizeRobust(t.publicador_asignado);
                const asg = normalizeRobust(t.asignado_a);
                const sol = normalizeRobust(t.solicitado_por);
                
                const isMine = (t.estado === 'En Sesión' && sol === cleanUserName) || 
                               (pub === cleanUserName || pub === cleanUserEmail) || 
                               (asg === cleanUserName || asg === cleanUserEmail);
                return isMine;
            });
        }

        async function refreshConductorView(usePool = false) {
            try {
                const configData = await getConfiguracion();
                const conductorDataRef = await obtenerConductorData(displayName);

                if (conductorDataRef && conductorDataRef.nombre) {
                    displayName = normalizeRobust(conductorDataRef.nombre);
                }

                const userMods = conductorDataRef?.modulos || { agenda: true, programa: true, disponibilidad: true, telefonos: true, mapas: true, ayudas: true, rescue: false };

                await loadUnifiedDashboard(container, displayName, userMods, configData, conductorDataRef, userRole, usePool ? poolData : { ...poolData, programa: initialProg });

                const myPhones = await refreshPhones(true);
                const publicadores = await getPublicadores();

                if (mPhone?.initializePhoneModule) {
                    mPhone.initializePhoneModule(myPhones, publicadores, displayName, container.querySelector('#phone-tbody'), () => refreshConductorView(true));
                }

                // ══════════════ VISIBILIDAD TELEFÓNICA ══════════════
                const compactView = container.querySelector('#phone-compact-view');
                const expandedView = container.querySelector('#phone-expanded-view');
                const floatingActions = container.querySelector('#phone-floating-actions');

                if (myPhones.length > 0 && window._phoneSessionActive) {
                    compactView?.classList.add('hidden');
                    expandedView?.classList.remove('hidden');
                    floatingActions?.classList.replace('hidden', 'flex');
                } else {
                    compactView?.classList.remove('hidden');
                    expandedView?.classList.add('hidden');
                    floatingActions?.classList.replace('flex', 'hidden');
                }

                // Bindings for phone buttons
                // PASO 2: Fix del botón "Solicitar Números"
                const btnSolicitar = container.querySelector('#btn-solicitar');
                if (btnSolicitar) {
                    btnSolicitar.onclick = async () => {
                        try {
                            btnSolicitar.disabled = true;
                            const oldText = btnSolicitar.innerHTML;
                            btnSolicitar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Solicitando...';

                            // Asegurarse de usar el nombre oficial del Identity Shield
                            const solicitante = window.XolvyApp?.identity?.nombreCanonico || displayName;
                            console.log(`[Telefonía] 🚀 Solicitando números para: ${solicitante}`);
                            
                            const count = await solicitarNumeros(30, solicitante);
                            console.log(`[Telefonía] ✅ Respuesta de solicitarNumeros: ${count} asignados`);
                            
                            if (count > 0) {
                                window._phoneSessionActive = true;
                                localStorage.setItem('phone_session_active', 'true');
                                showNotification(`Se han asignado ${count} números nuevos.`, 'success');
                                await refreshConductorView(true);
                            } else {
                                showNotification("No hay más números disponibles en este momento.", "warning");
                                btnSolicitar.disabled = false;
                                btnSolicitar.innerHTML = oldText;
                            }
                        } catch (err) {
                            console.error("[Telefonía] ❌ Error en la transacción de solicitar números:", err);
                            showNotification("Error al solicitar números", "error");
                            btnSolicitar.disabled = false;
                        }
                    };
                }

                const btnFinalizarFloat = container.querySelector('#btn-finalizar-float');
                if (btnFinalizarFloat) {
                    btnFinalizarFloat.onclick = async () => {
                        // TODO: Implementar modal de finalizar sesión si se requiere
                        window._phoneSessionActive = false;
                        localStorage.removeItem('phone_session_active');
                        await releaseUnusedTelefonos(displayName, false, true);
                        showNotification("Sesión finalizada", "success");
                        refreshConductorView(true);
                    };
                }

                // ══════════════ MARQUESINA BANNER ══════════════
                const bannerContainer = container.querySelector('#dynamic-banner-container');
                const bannerContent   = container.querySelector('#dynamic-banner-content');

                if (bannerContainer && bannerContent) {
                    const messages = [];

                    if (configData?.tema_mes?.trim()) {
                        messages.push('TEMA DE LA SEMANA: ' + configData.tema_mes.trim().toUpperCase());
                    }
                    if (Array.isArray(configData?.diffusion_messages)) {
                        configData.diffusion_messages.forEach(msg => {
                            if (msg?.trim()) messages.push('ANUNCIO: ' + msg.trim().toUpperCase());
                        });
                    }

                    if (messages.length > 0) {
                        bannerContainer.style.setProperty('display', 'flex', 'important');
                        const colors = ['#06b6d4', '#f59e0b'];
                        const bullet = '<span style="color:rgba(148,163,184,0.3)">\u00a0\u00a0•\u00a0\u00a0</span>';
                        const loopBullet = '<span style="color:rgba(148,163,184,0.3)">\u00a0\u00a0\u2022\u00a0\u00a0\u2022\u00a0\u00a0•\u00a0\u00a0</span>';
                        
                        let htmlContent = '';

                        if (configData?.tema_mes?.trim()) {
                            htmlContent += `<span style="color:#3b82f6">TEMA DE LA SEMANA: </span><span class="text-slate-700 dark:text-slate-200">${configData.tema_mes.trim().toUpperCase()}</span>`;
                        }

                        if (Array.isArray(configData?.diffusion_messages)) {
                            configData.diffusion_messages.forEach((msg, idx) => {
                                if (!msg?.trim()) return;
                                if (htmlContent) htmlContent += bullet;
                                const color = colors[idx % colors.length];
                                htmlContent += `<span style="color:${color}">ANUNCIO: </span><span class="text-slate-700 dark:text-slate-200">${msg.trim().toUpperCase()}</span>`;
                            });
                        }

                        const blockStyle = 'display:inline-block;white-space:nowrap;font-size:0.72rem;font-weight:700;letter-spacing:0.05em;padding-right:80px;';

                        bannerContent.innerHTML = 
                            `<span style="${blockStyle}">${htmlContent}${loopBullet}</span>` +
                            `<span style="${blockStyle}">${htmlContent}${loopBullet}</span>`;

                        const rawTextLength = bannerContent.innerText.length;
                        const duracion = Math.max(18, Math.round(rawTextLength * 0.16));

                        if (!document.getElementById('marquee-keyframes')) {
                            const styleNode = document.createElement('style');
                            styleNode.id = 'marquee-keyframes';
                            styleNode.innerHTML = `
                                @keyframes marquee-scroll {
                                    0% { transform: translateX(0); }
                                    100% { transform: translateX(-50%); }
                                }
                            `;
                            document.head.appendChild(styleNode);
                        }

                        Object.assign(bannerContent.style, {
                            display:         'inline-flex',
                            width:           'max-content',
                            whiteSpace:      'nowrap',
                            willChange:      'transform',
                            animation:       `marquee-scroll ${duracion}s linear infinite`
                        });

                        const wrapper = bannerContent.parentElement;
                        if (wrapper) {
                            wrapper.style.overflow = 'hidden';
                            wrapper.style.flex = '1';
                        }

                    } else {
                        bannerContainer.style.setProperty('display', 'none', 'important');
                    }
                }
                // ══════════════ FIN MARQUESINA ══════════════

                if (myPhones.length > 0 && window._phoneSessionActive) {
                    container.querySelector('#phone-compact-view')?.classList.add('hidden');
                    container.querySelector('#phone-expanded-view')?.classList.remove('hidden');
                    container.querySelector('#phone-floating-actions')?.classList.replace('hidden', 'flex');
                } else {
                    container.querySelector('#phone-compact-view')?.classList.remove('hidden');
                    container.querySelector('#phone-expanded-view')?.classList.add('hidden');
                    container.querySelector('#phone-floating-actions')?.classList.replace('flex', 'hidden');
                }
            } catch (e) {
                console.error("Refresh error", e);
            }
        }
        window.refreshConductorView = refreshConductorView;

        function initSwipeActions() {
            const cards = document.querySelectorAll('.territory-card-swipe');
            cards.forEach(card => {
                const content = card.querySelector('.swipe-content');
                const leftAction = card.querySelector('.swipe-action-left');
                const rightAction = card.querySelector('.swipe-action-right');

                let startX = 0;
                let currentX = 0;
                let isMoving = false;

                card.addEventListener('touchstart', (e) => {
                    startX = e.touches[0].clientX;
                    isMoving = true;
                    if (content) content.style.transition = 'none';
                });

                card.addEventListener('touchmove', (e) => {
                    if (!isMoving || !content) return;
                    currentX = e.touches[0].clientX - startX;
                    if (Math.abs(currentX) > 100) return;

                    content.style.transform = `translateX(${currentX}px)`;

                    if (currentX > 30) {
                        if (leftAction) leftAction.style.opacity = Math.min(1, (currentX - 30) / 40);
                        card.style.backgroundColor = 'rgba(37, 99, 235, 0.8)';
                    } else if (currentX < -30) {
                        if (rightAction) rightAction.style.opacity = Math.min(1, (Math.abs(currentX) - 30) / 40);
                        card.style.backgroundColor = 'rgba(13, 148, 136, 0.8)';
                    } else {
                        if (leftAction) leftAction.style.opacity = 0;
                        if (rightAction) rightAction.style.opacity = 0;
                        card.style.backgroundColor = 'transparent';
                    }
                });

                card.addEventListener('touchend', () => {
                    isMoving = false;
                    if (!content) return;
                    content.style.transition = 'transform 0.3s ease';

                    if (Math.abs(currentX) > 70) {
                        if (currentX > 0) {
                            const t = {
                                id: card.dataset.id,
                                numero: card.dataset.num,
                                manzanas: card.dataset.manzanas,
                                coordenadas: card.dataset.coords ? JSON.parse(card.dataset.coords) : null
                            };
                            if (window.openInteractiveMap) window.openInteractiveMap(t);
                        } else {
                            if (window.ReceptionHub) {
                                let currentFullName = displayName || window.XolvyApp?.user?.nombre || 'Usuario_Desconocido';
                                console.log("Enviando al modal de swipe el nombre:", currentFullName);
                                window.renderTableCallback = () => refreshConductorView(true);
                                ReceptionHub.openModal({
                                    preSelectedId: card.dataset.id,
                                    viewMode: 'conductor',
                                    displayName: currentFullName,
                                    isAdmin: false
                                });
                            }
                        }
                    }
                content.style.transform = 'translateX(0px)';
                    if (leftAction) leftAction.style.opacity = 0;
                    if (rightAction) rightAction.style.opacity = 0;
                    setTimeout(() => card.style.backgroundColor = 'transparent', 300);
                    currentX = 0;
                });
            });
        }

        async function initNexoSystem() {
            const config = await getConfiguracion();
            if (!config.gemini_key) return;

            if (document.getElementById('nexo-fab')) document.getElementById('nexo-fab').remove();

            const nexo = new NexoAgent(config.gemini_key, NexoManifest);
            window._nexoInstance = nexo;

            nexo.getLatestContext = () => {
                return {
                    territorios_asignados: (poolData.territorios || []).filter(t => 
                        normalizeRobust(t.asignado_a) === normalizeRobust(displayName) || 
                        normalizeRobust(t.auxiliar) === normalizeRobust(displayName)
                    ).map(t => ({ id: t.id, numero: t.numero, manzanas: t.manzanas })),
                    conductor: displayName,
                    fecha_actual: new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                };
            };

            nexo.registerAction('registrar_predicacion_territorio', async (params) => {
                console.log("🛠️ Nexo Transaccional:", params);
                try {
                    const ALL_T = await getTerritorios();
                    const tId = String(params.territorio_id || '');
                    let target = ALL_T.find(t => String(t.numero) === tId || t.id === tId);
                    
                    if (!target) {
                        const assigned = (poolData.territorios || []).filter(t => 
                            normalizeRobust(t.asignado_a) === normalizeRobust(displayName) || 
                            normalizeRobust(t.auxiliar) === normalizeRobust(displayName)
                        );
                        if (assigned.length === 1) target = assigned[0];
                        else if (assigned.length > 1 && !params.territorio_id) {
                             return nexo.speak(`Tienes varios territorios asignados. ¿A cuál te refieres?`);
                        }
                    }

                    if (target) {
                        if (params.tipo_entrega === 'completo') {
                            await returnTerritorio(target.id, params.notas_novedades || "Entrega completa informada a Nexo AI", null, "Disponible");
                            
                            if (!params.es_flujo_interno) {
                                window.nexoIniciarFlujoAvance(target.id, target.numero);
                            }
                        } else {
                            const manzanas = Array.isArray(params.manzanas_trabajadas) ? params.manzanas_trabajadas : [];
                            const updateData = {};
                            if (manzanas.length > 0) {
                                updateData.manzanas_trabajadas = arrayUnion(...manzanas.map(m => String(m)));
                            }

                            if (Object.keys(updateData).length > 0) {
                                 await updateTerritorio(target.id, updateData);
                            }
                            
                            if (params.notas_novedades) {
                                 await logReturn(target.id, new Date().toISOString(), 'Avance Parcial', params.notas_novedades, null, displayName);
                            }

                            window.dispatchEvent(new CustomEvent('territorio-liberado', {
                                detail: { id: target.id, numero: target.numero, status: 'parcial' }
                            }));
                            
                            if (!params.es_flujo_interno) {
                                window.nexoIniciarFlujoAvance(target.id, target.numero);
                            }
                        }
                        if (window.refreshConductorView) window.refreshConductorView(true);
                    } else {
                        nexo.speak(`No logré identificar el territorio ${params.territorio_id || ''}. Por favor, confírmame el número.`);
                    }
                } catch (err) {
                    console.error("Nexo Transactional Error:", err);
                    nexo.speak("Lo siento, tuve un problema técnico al conectar con la base de datos.");
                }
            });

            nexo.registerAction('registrar_novedad_flujo', async (params) => {
                console.log("📝 Registrando novedad desde Nexo:", params);
                try {
                    await updateTerritorio(params.territorio_id, {
                        notas: params.novedad,
                        ultima_novedad_nexo: params.novedad
                    });
                    
                    await logReturn(params.territorio_id, new Date().toISOString(), 'Novedad Nexo', params.novedad, null, displayName);

                    window.dispatchEvent(new CustomEvent('territorio-liberado', {
                        detail: { id: params.territorio_id, status: 'novedad' }
                    }));
                } catch (err) {
                    console.error("Error al registrar novedad de flujo:", err);
                }
            });

            nexo.registerAction('agregar_nota_s13', async (params) => {
                try {
                    const territorios = await getTerritorios();
                    const target = territorios.find(t => String(t.numero) === String(params.territorio_id));
                    if (target) {
                        await logReturn(target.id, new Date().toISOString(), 'Nota S-13', params.nota, null, displayName);
                        if (window.XolvyAlert) {
                            window.XolvyAlert.fire({ 
                                icon: 'success', 
                                title: `Nota añadida al T-${params.territorio_id}`,
                                text: "Registro S-13 actualizado." 
                            });
                        }
                        if (window.refreshConductorView) window.refreshConductorView(true);
                    } else {
                        nexo.speak(`No encontré el territorio ${params.territorio_id} para añadir la nota.`);
                    }
                } catch (err) { console.error("Nexo Error nota:", err); }
            });

            nexo.registerAction('actualizar_estado_telefono', async (params) => {
                try {
                    const telefonos = await getTelefonosParaSesion(displayName); 
                    let target = telefonos.find(t => String(t.telefono || t.numero).endsWith(String(params.ultimos_digitos).padStart(4, '0')));
                    
                    if (!target) {
                        target = (await getTelefonos()).find(t => String(t.telefono || t.numero).endsWith(params.ultimos_digitos));
                    }
                    
                    if (target) {
                        await updateTelefonoStatus(target.id, params.nuevo_estado, displayName, "Nexo AI modificado.");
                        if (window.XolvyAlert) {
                            window.XolvyAlert.fire({ icon: 'success', title: `Teléfono terminado en ${params.ultimos_digitos} se actualizó a: ${params.nuevo_estado}` });
                        }
                    } else {
                        nexo.speak(`No he podido ubicar un teléfono terminando en ${params.ultimos_digitos} en tu libreta activa.`);
                    }
                } catch(e) {
                     console.error("Nexo Error en telefono:", e);
                }
            });

            nexo.registerAction('mostrar_mapa_territorio', async (params) => {
                try {
                    if (window.XolvyAlert) {
                        window.XolvyAlert.fire({ toast: true, position: 'bottom-end', title: `Buscando mapa del Territorio ${params.numero_territorio}...`, icon: 'info' });
                    }
                    const allT = await getTerritorios();
                    const target = allT.find(t => String(t.numero) === String(params.numero_territorio));
                    if (target && window.openInteractiveMap) {
                        window.openInteractiveMap(target);
                    } else {
                        nexo.speak(`No encontré el territorio ${params.numero_territorio} en la base de mapas.`);
                    }
                } catch (err) { console.error("Nexo map error:", err); }
            });

            nexo.registerAction('actualizar_dias_disponibles', async (params) => {
                try {
                    const { updatePublicador } = await import('../data/services/personnel-service.js');
                    const pubs = await getPublicadores();
                    const userNameNormalized = normalizeRobust(displayName);
                    const userEmail = auth.currentUser?.email?.toLowerCase() || '';
                    const target = pubs.find(c => {
                        const n = normalizeRobust(c.nombre);
                        const e = String(c.email || '').toLowerCase();
                        return n === userNameNormalized || e === userEmail;
                    });

                    if (target) {
                        await updatePublicador(target.id, { disponibilidad_dias: params.dias_detallados });
                        if (window.XolvyAlert) {
                            window.XolvyAlert.fire({ icon: 'success', title: `Días de predicación actualizados para ${displayName}` });
                        }
                        if (window.refreshConductorView) window.refreshConductorView(true);
                    } else {
                        nexo.speak("No encontré tu perfil activo para actualizar los días.");
                    }
                } catch (err) { console.error("Nexo Error días:", err); }
            });

            nexo.registerAction('actualizar_disponibilidad', async () => {
                try {
                    if (window.XolvyAlert) window.XolvyAlert.fire({ icon: 'success', title: `Disponibilidad de semana guardada.` });
                } catch (err) {
                     console.error("Nexo Error disponiblidad:", err);
                }
            });

            nexo.registerAction('leer_tema_semanal', async () => {
                try {
                    const temaEl = document.querySelector('#dynamic-banner-content');
                    let text = "No veo ningún tema especial configurado para esta semana. Sigue preparándote con la Guía de Actividades.";
                    
                    if (temaEl && temaEl.innerText.trim() !== '') {
                        text = `¡Hola! ${temaEl.innerText}`;
                    } else if (document.querySelector('.barra-notificaciones-dinamica')) {
                        const fallback = document.querySelector('.barra-notificaciones-dinamica').innerText;
                        if (fallback) text = `El tema actual es: ${fallback}`;
                    }
                    
                    if (window.XolvyAlert) {
                        window.XolvyAlert.fire({ icon: 'info', title: 'Tema Semanal', text: text });
                    }
                } catch (e) { console.error("Nexo Error tema:", e); }
            });
        }

        // UI Shell Injection (RESTAURACIÓN PREMIUM V2.5 - ORDEN ESTRICTO)
        container.innerHTML = `
        <div class="h-screen w-full overflow-hidden p-3 md:p-6 lg:p-8 bg-slate-100 dark:bg-[#05070a] flex flex-col animate-fade-in" data-adaptive-container="true">
            <!-- Xolvy Premium Shell 2027 -->
            <div id="main-conductor-shell" class="flex-1 w-full max-w-[1700px] mx-auto bg-white/80 dark:bg-[#0a0f18]/90 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden relative floating-panel-shell">
                
                <!-- Deep Ambient Glows -->
                <div class="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/15 blur-[120px] rounded-full pointer-events-none glow-ambient"></div>
                <div class="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-500/10 blur-[120px] rounded-full pointer-events-none glow-ambient"></div>

                <!-- Main Scroll Container -->
                <div class="flex-1 overflow-y-auto custom-scrollbar relative z-10">
                    
                    <!-- 1. HEADER (Inside Shell) -->
                    <header class="sticky top-0 z-50 bg-white/40 dark:bg-black/40 backdrop-blur-2xl border-b border-slate-200/50 dark:border-white/5 px-6 md:px-12 py-6 md:py-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div class="flex items-center gap-4 md:gap-6 relative z-10 w-full md:w-auto">
                            <div class="w-14 h-14 md:w-18 md:h-18 bg-gradient-to-br from-indigo-600 to-teal-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 transform hover:rotate-3 transition-transform duration-500">
                                <i class="fas fa-id-card text-2xl"></i>
                            </div>
                            <div>
                                <h2 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">
                                    Hola, ${displayName.split(' ')[0]}
                                </h2>
                                <div class="flex items-center gap-2 mt-2">
                                     <div class="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Conectado
                                     </div>
                                </div>
                            </div>
                        </div>

                        <!-- Dynamic Banner (Diffusion) -->
                        <div id="dynamic-banner-container" class="hidden lg:flex flex-1 justify-center items-center px-8 overflow-hidden pointer-events-none min-w-0">
                            <div class="bg-indigo-50/50 dark:bg-indigo-500/5 px-8 py-3 rounded-[1.5rem] border border-indigo-100/50 dark:border-indigo-500/10 flex items-center gap-4 max-w-xl w-full">
                                <div class="w-8 h-8 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 text-xs shrink-0 shadow-inner">
                                    <i class="fas fa-bullhorn animate-pulse"></i>
                                </div>
                                <p id="dynamic-banner-content" class="text-[10px] font-black text-indigo-600/80 dark:text-indigo-300/90 uppercase tracking-[0.25em] animate-fade-in transition-all duration-700 truncate">Sincronizando últimas actualizaciones...</p>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-3 w-full md:w-auto relative">
                            <div class="hidden sm:flex flex-col items-center bg-white/50 dark:bg-white/5 px-6 py-2 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm shrink-0">
                                <span class="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Versión</span>
                                <span class="text-[9px] font-black text-slate-800 dark:text-white tracking-widest uppercase tabular-nums">${appVersion}</span>
                            </div>

                            <div class="flex items-center gap-4 bg-white/50 dark:bg-white/5 px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner">
                                <button onclick="window.toggleTheme(); window.refreshConductorView();" class="text-slate-500 hover:text-indigo-500 transition-all active:scale-75 outline-none">
                                    <i class="fas fa-moon dark:hidden"></i>
                                    <i class="fas fa-sun hidden dark:block text-yellow-500 animate-pulse"></i>
                                </button>
                            </div>

                            <button id="logout-btn" class="flex-1 lg:flex-none bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-rose-500/20 shadow-xl shadow-rose-500/5 transition-all active:scale-95 flex items-center gap-3">
                                <i class="fas fa-power-off"></i> Salir
                            </button>
                        </div>
                    </header>

                    <!-- Page Content Wrapper -->
                    <div class="flex flex-col gap-24 px-6 md:px-12 py-12 pb-48">
                        
                        <!-- 2. AGENDA INTELIGENTE -->
                        <div id="agenda-section" class="space-y-10">
                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div class="flex items-start gap-8">
                                    <div class="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 flex items-center justify-center text-3xl text-indigo-500 shadow-inner border border-indigo-500/10">
                                        <i class="fas fa-bolt"></i>
                                    </div>
                                    <div>
                                        <h3 class="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Mi Agenda S-13</h3>
                                        <p class="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-80">Asignaciones prioritarias de la semana</p>
                                    </div>
                                </div>
                            </div>
                            <div id="active-agenda-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                <!-- Inyección de tarjetas o Empty States -->
                            </div>
                        </div>

                        <!-- 3. PROGRAMA SEMANAL -->
                        <div id="programa-semanal-section" class="premium-card !p-0 overflow-hidden">
                            <details id="details-programa" class="group/prog-details">
                                <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-10 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-transparent group-open/prog-details:border-slate-100 dark:group-open/prog-details:border-white/5 relative">
                                    <div class="flex items-start gap-8 relative z-10 w-full md:w-auto">
                                        <div class="w-16 h-16 rounded-[1.5rem] bg-amber-500/10 flex items-center justify-center text-3xl text-amber-500 shadow-inner border border-amber-500/10 group-open/prog-details:rotate-6 transition-transform">
                                            <i class="fas fa-calendar-alt"></i>
                                        </div>
                                        <div class="flex-1">
                                            <div class="flex items-center gap-4">
                                                <h3 class="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Cronograma de Salidas</h3>
                                                <i class="fas fa-chevron-down text-sm text-slate-400 group-open/prog-details:rotate-180 transition-transform"></i>
                                            </div>
                                            <p class="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-80">Puntos de reunión y roles generales</p>
                                        </div>
                                    </div>
                                    <div id="prog-week-range" class="mt-4 md:mt-0 px-6 py-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-500/10">
                                        Cargando...
                                    </div>
                                </summary>
                                <div class="p-8 space-y-10 animate-fade-in group-open/prog-details:block hidden">
                                    <div class="flex flex-col xl:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-white/5">
                                        <div id="prog-day-selector" class="flex gap-2 overflow-x-auto no-scrollbar w-full xl:w-auto"></div>
                                        <div id="prog-turn-filters" class="flex flex-wrap items-center gap-2"></div>
                                    </div>
                                    <div id="weekly-program-cards" class="flex flex-col gap-8"></div>
                                </div>
                            </details>
                        </div>

                        <!-- 4. MISIONES DE RESCATE -->
                        <div id="rescue-module-section" class="premium-card p-10">
                            <div class="flex items-center gap-6 mb-8 px-2">
                                 <div class="w-14 h-14 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-2xl text-indigo-600">
                                     <i class="fas fa-rocket"></i>
                                 </div>
                                 <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Misiones de Rescate</h3>
                            </div>
                            <div id="ayudas-container"></div>
                        </div>

                        <!-- 5. MI DISPONIBILIDAD -->
                        <div id="availability-section" class="premium-card !p-0 overflow-hidden">
                             <details id="details-availability" class="group/avail-details">
                                 <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-10 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-transparent group-open/avail-details:border-slate-100 dark:group-open/avail-details:border-white/5 relative">
                                    <div class="flex items-start gap-8 relative z-10 w-full md:w-auto">
                                        <div class="w-16 h-16 rounded-[1.5rem] bg-teal-500/10 flex items-center justify-center text-3xl text-teal-500 shadow-inner border border-teal-500/10 group-open/avail-details:rotate-6 transition-transform">
                                            <i class="fas fa-user-clock"></i>
                                        </div>
                                        <div class="flex-1">
                                            <div class="flex items-center gap-4">
                                                <h3 class="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Mi Disponibilidad</h3>
                                                <i class="fas fa-chevron-down text-sm text-slate-400 group-open/avail-details:rotate-180 transition-transform"></i>
                                            </div>
                                            <p class="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-80">Gestiona tus horarios para el ministerio</p>
                                        </div>
                                    </div>
                                </summary>
                                <div id="availability-container" class="p-8 animate-fade-in group-open/avail-details:block hidden"></div>
                             </details>
                        </div>

                        <!-- 6. PREDICACIÓN TELEFÓNICA -->
                        <div id="phone-module-card" class="premium-card p-10">
                            <div class="flex flex-col lg:flex-row justify-between items-center gap-6 mb-8">
                                <div class="flex items-center gap-4">
                                    <div class="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg text-2xl">
                                        <i class="fas fa-phone-alt"></i>
                                    </div>
                                    <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Campaña Telefónica</h3>
                                </div>
                            </div>

                            <div id="phone-compact-view" class="animate-fade-in py-10">
                                <div class="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-slate-900 p-8 md:p-12 text-center rounded-[2.5rem] border border-indigo-100 dark:border-indigo-500/10 shadow-inner">
                                   <div class="w-20 h-20 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-4xl text-indigo-600 mx-auto mb-8">
                                       <i class="fas fa-phone-alt"></i>
                                   </div>
                                   <h3 class="text-2xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tighter">¿Listo para Predicar?</h3>
                                   <p class="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-10 font-bold text-xs uppercase tracking-widest opacity-60">Inicia tu sesión de hoy para ver tus números asignados.</p>
                                   <div class="flex flex-wrap justify-center gap-4" id="phone-actions-container">
                                       <button id="btn-solicitar" class="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest text-[10px]">
                                           <i class="fas fa-rocket text-base"></i> Solicitar Números
                                       </button>
                                   </div>
                                </div>
                            </div>

                            <div id="phone-expanded-view" class="hidden animate-fade-in space-y-8">
                                <div class="overflow-x-auto">
                                    <table class="w-full text-left border-collapse">
                                        <thead class="hidden sm:table-header-group sticky top-[-1px] bg-slate-50 dark:bg-[#12161d] backdrop-blur-xl z-30 border-b border-slate-200 dark:border-white/10">
                                            <tr class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
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

                        <!-- 7. EXPLORADOR DE MAPAS -->
                        <div id="interactive-maps-module" class="premium-card p-10">
                            <div class="flex flex-col md:flex-row justify-between items-center gap-8 mb-10">
                                <div class="flex items-center gap-4">
                                    <div class="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg text-2xl">
                                        <i class="fas fa-map-marked-alt"></i>
                                    </div>
                                    <div>
                                        <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Explorador de Mapas</h3>
                                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Busca cualquier sector al instante</p>
                                    </div>
                                </div>
                                <div class="w-full md:w-auto relative">
                                    <i class="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                    <input type="text" id="search-explorer-maps" placeholder="BUSCAR TERRITORIO..." class="w-full md:w-80 bg-slate-100 dark:bg-white/5 border-none rounded-2xl py-4 pl-14 pr-6 text-[11px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500 transition-all">
                                </div>
                            </div>
                            <div id="conductor-maps-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"></div>
                        </div>

                        <!-- 8. AYUDAS MINISTERIO -->
                        <div id="recursos-container-section" class="premium-card p-10">
                            <div class="flex items-center gap-6 mb-8 px-2">
                                 <div class="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl text-amber-500">
                                     <i class="fas fa-hands-helping"></i>
                                 </div>
                                 <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Ayudas para el Ministerio</h3>
                            </div>
                            <div id="recursos-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
                        </div>
                    </div>
                </div>

                <div id="phone-floating-actions" class="absolute bottom-10 right-10 hidden flex-col gap-3 z-[99999] animate-slide-up pointer-events-none">
                    <button id="btn-solicitar-more-float" class="w-12 h-12 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all outline-none border-2 border-white dark:border-slate-900 pointer-events-auto text-sm" title="Solicitar más"><i class="fas fa-plus"></i></button>
                    <button id="btn-finalizar-float" class="w-12 h-12 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all outline-none border-2 border-white dark:border-slate-900 pointer-events-auto text-sm" title="Finalizar Sesión"><i class="fas fa-power-off"></i></button>
                </div>
            </div>
        </div>
        `;

        // UI Initialization (Synchronous DOM guarantee)
        requestAnimationFrame(async () => {
            console.log("🎨 [Dashboard] Lifecycle: Shell injected, starting Unified Load...");
            await loadUnifiedDashboard(container, displayName, null, null, null, userRole, {
                territorios: allT,
                telefonos: allTel,
                publicadores: publicadores,
                programa: initialProg
            }, { mAvail, mRec, mMaps, mRescue, mPhone, mProg });
            
            // ══════════════ BOTÓN SALIR (DEEP PURGE) ══════════════
            const logoutBtn = container.querySelector('#logout-btn');
            if (logoutBtn) {
                logoutBtn.onclick = async (e) => {
                    e.preventDefault();
                    console.log("🛑 [ConductorDash] Iniciando purga de sesión...");
                    
                    // 1. Detener todos los Live Pools activos
                    if (typeof window.stopActiveLivePools === 'function') {
                        window.stopActiveLivePools();
                    }

                    // 2. Limpieza completa de LocalStorage
                    localStorage.removeItem('selected_conductor_name');
                    localStorage.removeItem('xolvy_session');
                    localStorage.removeItem('demo_role');
                    localStorage.removeItem('phone_session_active');
                    localStorage.clear();

                    // 3. Firebase SignOut
                    await auth.signOut();
                    
                    // 4. Redirección
                    location.href = '/login';
                };
            }

            // FIX: Ensure telephony and dynamic features sync on first load
            await refreshConductorView(true);
        });
        
    } catch (error) {
        console.error("Dashboard initialization failed:", error);
        ocultarOverlay();
        showNotification("Error al cargar dashboard", "error");
    }

    // --- INNER FUNCTIONS (RETAINING SCOPE) ---

    async function loadUnifiedDashboard(container, name, userMods, configData, conductorData, userRole, poolData = null, subModules = {}) {
        const { mAvail, mRec, mMaps, mRescue, mPhone, mProg } = subModules;
        if (!container) {
            console.warn('[Dashboard] loadUnifiedDashboard: container es null');
            return;
        }

        if (!conductorData) {
            console.warn('[Dashboard] conductorData es null — usando fallback para render');
            conductorData = { 
                nombre: name, 
                modulos: { agenda: true, programa: true, disponibilidad: true, telefonos: true, mapas: true, ayudas: true }, 
                disponibilidad: { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] } 
            };
        }
        
        console.log("🎨 [Dashboard] Lifecycle: loadUnifiedDashboard rendering...");

        try {
            const allTerritorios = poolData?.territorios || [];
            const userModsEffectivos = conductorData?.modulos || userMods || { agenda: true, programa: true, disponibilidad: true, telefonos: true, mapas: true, ayudas: true };
            const programa = poolData?.programa;
            const bancoS13 = poolData?.banco_s13 || [];
            const normalizedName = normalizeRobust(name);

            // 1. Data Processing
            const territoryMap = {};
            allTerritorios.forEach(t => { if (t.numero) territoryMap[t.numero] = t; });

            const currentWeekId = getSafeDateId(getMonday(new Date()));
            const turnosArr = ['manana', 'tarde', 'noche', 'zoom'];
            const assignments = [];
            const shownTerritoryIds = new Set();

            if (programa && programa.dias) {
                programa.dias.forEach((d, idx) => {
                    const mondayDate = new Date(programa.id + 'T12:00:00Z');
                    if (!d.fecha) {
                        const dayDate = new Date(mondayDate);
                        dayDate.setDate(dayDate.getDate() + idx);
                        d.fecha = getSafeDateId(dayDate);
                    }

                    turnosArr.forEach(turno => {
                        const tData = d[turno];
                        if (tData && (tData.conductor || tData.auxiliar || tData.lugar)) {
                            const isConductor = normalizeRobust(tData.conductor) === normalizedName;
                            const isAuxiliar = normalizeRobust(tData.auxiliar) === normalizedName;

                            if (!isConductor && !isAuxiliar) return;

                            let assignedTerritoryNums = [];
                            if (tData.territorio) {
                                assignedTerritoryNums = tData.territorio.split(/[,/]+/).map(s => s.trim()).filter(Boolean);
                            }

                            const attachedTerritories = assignedTerritoryNums.map(num => {
                                const t = territoryMap[num] || { numero: num, isMissingData: true };
                                if (t.id) shownTerritoryIds.add(t.id);
                                return t;
                            }).filter(t => !t.isMissingData);

                            assignments.push({
                                dia: d.nombre,
                                turno: turno === 'manana' ? '🌅 Mañana' : (turno === 'tarde' ? '☀️ Tarde' : (turno === 'zoom' ? '📹 Zoom' : '🌙 Noche')),
                                role: isConductor ? 'Conductor' : 'Auxiliar',
                                isMember: true,
                                rawDate: d.fecha,
                                attachedTerritories,
                                faceta: tData.faceta || 'Predicación',
                                ...tData
                            });
                        }
                    });
                });
            }

            // Grouping for rendering
            const groupedByDay = {};
            assignments.forEach(a => {
                if (!groupedByDay[a.dia]) groupedByDay[a.dia] = { dia: a.dia, shifts: [] };
                groupedByDay[a.dia].shifts.push(a);
            });

            // Calculate Rescue Data
            const myExtraMissions = allTerritorios.filter(t => 
                (normalizeRobust(t.asignado_a) === normalizedName || normalizeRobust(t.auxiliar) === normalizedName) &&
                !shownTerritoryIds.has(t.id)
            );
            const rescueCandidates = allTerritorios.filter(t => {
                const isFree = t.estado === 'Libre' || t.estado === 'Disponible' || t.estado === 'Sin asignar';
                const isIncomplete = t.is_incomplete === true;
                return isFree || isIncomplete;
            });
            const totalMissionCount = rescueCandidates.length + myExtraMissions.length;

            const totalActiveTerritories = assignments.reduce((acc, a) => acc + (a.attachedTerritories?.length || 0), 0);
            const hasShifts = assignments.length > 0;
            const allCompleted = hasShifts && totalActiveTerritories === 0;

            // 2. Template Strings
            const agendaContainer = container.querySelector('#active-agenda-container');
            if (agendaContainer) {
                if (!hasShifts) {
                    agendaContainer.innerHTML = `
<div class="col-span-full py-16 sm:py-24 px-6 sm:px-8 modern-card text-center animate-fade-in shadow-2xl bg-white dark:bg-[#0f1420]/60 border-slate-200 dark:border-white/10 relative overflow-hidden group">
    <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
    <div class="flex flex-col items-center gap-8 relative z-10">
        <div class="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-4xl text-primary shadow-inner border border-primary/20 animate-float">
            <i class="fas fa-calendar-day"></i>
        </div>
        <div class="space-y-4">
            <h4 class="text-xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tighter uppercase transition-transform group-hover:scale-105 duration-500">Sin asignaciones activas</h4>
            <p class="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.4em] max-w-xs mx-auto leading-relaxed">
                Revisa el cronograma o contacta con el Departamento de territorios
            </p>
        </div>
    </div>
</div>
                    `;
                } else if (allCompleted) {
                    agendaContainer.innerHTML = `
<div class="col-span-full py-28 px-8 modern-card bg-emerald-500/5 dark:bg-[#0f231e]/40 !rounded-[4rem] border-2 border-emerald-500/20 text-center animate-bounce-in shadow-2xl shadow-emerald-500/10 relative overflow-hidden group">
    <div class="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
    <div class="text-9xl mb-10 flex justify-center text-emerald-500 drop-shadow-[0_0_30px_rgba(16,185,129,0.4)] relative z-10 transition-transform group-hover:scale-110 duration-700">
        <i class="fas fa-trophy animate-float"></i>
    </div>
    <div class="relative z-10">
        <h4 class="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-4">¡Misión Cumplida!</h4>
        <p class="text-emerald-600 dark:text-emerald-400 font-black text-xl uppercase tracking-[0.3em]">Territorio al 100%</p>
        <div class="mt-12 flex justify-center">
            <div class="px-12 py-5 bg-emerald-500 text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(16,185,129,0.3)] hover:scale-105 transition-transform cursor-default">
                <i class="fas fa-star mr-2"></i> Excelente trabajo, ${name.split(' ')[0]}
            </div>
        </div>
    </div>
</div>
                    `;
                } else {
                    agendaContainer.innerHTML = Object.values(groupedByDay).map(day => `
                        <div class="day-group space-y-4 animate-fade-in">
                            <div class="flex items-center justify-between px-2 mb-2">
                                <h3 class="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">${day.dia}</h3>
                                <div class="h-px flex-1 bg-slate-100 dark:bg-white/5 mx-4"></div>
                            </div>
                            
                            ${day.shifts.map((a, sIdx) => `
                                <div class="assignment-card bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/20 dark:shadow-black/40 hover:shadow-2xl transition-all duration-500 group">
                                    <div class="flex items-center gap-3 mb-6">
                                        <div class="w-10 h-10 rounded-2xl ${a.turno.includes('Mañana') ? 'bg-orange-500/10 text-orange-500' : 'bg-indigo-500/10 text-indigo-500'} flex items-center justify-center text-sm shadow-inner group-hover:rotate-12 transition-transform">
                                            <i class="fas ${a.turno.includes('Mañana') ? 'fa-sun' : 'fa-moon'}"></i>
                                        </div>
                                        <div>
                                            <h4 class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">${a.turno}</h4>
                                            <div class="flex items-center gap-2">
                                                <i class="fas fa-map-pin text-[9px] text-primary/50"></i>
                                                <p class="text-xs font-bold text-slate-700 dark:text-slate-300">${a.lugar || 'Ubicación pendiente'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-2 gap-4 mb-8">
                                        <div class="space-y-1 pl-4 border-l-2 ${a.role === 'Conductor' ? 'border-primary' : 'border-slate-100 dark:border-white/10'}">
                                            <p class="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Conductor</p>
                                            <p class="text-lg font-bold ${a.role === 'Conductor' ? 'text-primary' : 'text-slate-800 dark:text-slate-100'} truncate">${a.conductor || '---'}</p>
                                        </div>
                                        <div class="space-y-1 pl-4 border-l-2 ${a.role === 'Auxiliar' ? 'border-primary' : 'border-slate-100 dark:border-white/10'}">
                                            <p class="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Auxiliar</p>
                                            <p class="text-lg font-bold ${a.role === 'Auxiliar' ? 'text-primary' : 'text-slate-800 dark:text-slate-100'} truncate">${a.auxiliar || '---'}</p>
                                        </div>
                                    </div>

                                    ${a.attachedTerritories.length > 0 ? `
                                        <div class="space-y-5">
                                            ${a.attachedTerritories.map(t => {
                                                const s13Match = bancoS13.find(b => String(b.territorio_id) === String(t.id));
                                                let timeAgoStr = "";
                                                let timeColor = "text-slate-400";
                                                
                                                if (s13Match?.fecha_salida) {
                                                    const outDate = new Date(s13Match.fecha_salida);
                                                    const diff = Math.floor((new Date() - outDate) / (1000 * 60 * 60 * 24));
                                                    timeAgoStr = diff === 0 ? "Hoy" : `Hace ${diff} días`;
                                                    if (diff >= 30) timeColor = "text-rose-500";
                                                    else if (diff >= 20) timeColor = "text-amber-500 font-bold";
                                                }

                                                return `
                                                <div class="p-5 bg-slate-50 dark:bg-white/[0.03] rounded-3xl border border-slate-100 dark:border-white/5 group/titem shadow-sm">
                                                    <div class="flex items-center justify-between mb-4">
                                                        <div class="flex items-center gap-3">
                                                            <div class="w-12 h-12 bg-primary dark:bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-lg shadow-primary/20">
                                                                T${t.numero}
                                                            </div>
                                                            <div>
                                                                <h5 class="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">${t.manzanas || 'Sin manzanas'}</h5>
                                                                <p class="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">${a.faceta}</p>
                                                            </div>
                                                        </div>
                                                        ${timeAgoStr ? `
                                                            <div class="text-right">
                                                                <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Asignado</p>
                                                                <p class="text-[10px] font-black ${timeColor} uppercase">${timeAgoStr}</p>
                                                            </div>
                                                        ` : ''}
                                                    </div>

                                                    <div class="flex gap-2">
                                                        <button onclick="window.viewMapFromReport('${t.id}')" class="flex-1 py-3 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                                                            <i class="fas fa-map-marked-alt text-primary"></i> Mapa
                                                        </button>
                                                        <button onclick="window.showUnifiedTerritoryHistory('${t.id}', '${t.numero}')" class="w-12 py-3 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 hover:text-primary transition-colors flex items-center justify-center">
                                                            <i class="fas fa-history text-xs"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            `}).join('')}

                                            <button class="territory-report-btn w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 py-4 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 group/btn"
                                                data-ids="${a.attachedTerritories.map(t => t.id).join(',')}" 
                                                data-nums="${a.attachedTerritories.map(t => t.numero).join(',')}"
                                                data-conductor="${a.conductor || displayName || ''}">
                                                <i class="fas fa-file-signature opacity-70 group-hover/btn:rotate-12 transition-transform"></i> Informar Actividad
                                            </button>
                                        </div>
                                    ` : `
                                        <div class="px-5 py-8 bg-slate-50 dark:bg-white/[0.03] rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 text-center space-y-3">
                                            <div class="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 mx-auto flex items-center justify-center text-primary text-2xl shadow-sm">
                                                <i class="fas ${a.faceta === 'Telefónica' ? 'fa-phone-alt' : (a.faceta === 'Cartas' ? 'fa-envelope-open-text' : 'fa-bullhorn')}"></i>
                                            </div>
                                            <div>
                                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">Actividad Especial</p>
                                                <p class="text-xl font-black text-primary uppercase tracking-tighter">${a.faceta}</p>
                                            </div>
                                        </div>
                                    `}
                                </div>
                            `).join('')}
                        </div>
                    `).join('');
                }
            }

            // --- XOLVY DYNAMIC BANNER ---
            const bannerContent = container.querySelector('#dynamic-banner-content');
            if (bannerContent) {
                const configData = poolData?.configuracion || {};
                const messages = [];
                if (configData.tema_mes) messages.push(`TEMA: ${configData.tema_mes}`);
                if (configData.diffusion_messages?.length > 0) messages.push(...configData.diffusion_messages);
                
                if (messages.length > 0) {
                    container.querySelector('#dynamic-banner-container')?.classList.remove('hidden');
                    let idx = 0;
                    if (window._bannerInterval) clearInterval(window._bannerInterval);
                    window._bannerInterval = setInterval(() => {
                        bannerContent.style.opacity = '0';
                        setTimeout(() => {
                            bannerContent.innerText = messages[idx];
                            bannerContent.style.opacity = '1';
                            idx = (idx + 1) % messages.length;
                        }, 500);
                    }, 5000);
                    bannerContent.innerText = messages[0];
                }
            }

            // Cleanup & Bindings
            setTimeout(() => {
                const refreshedAgendaContainer = container.querySelector('#active-agenda-container');
                if (!refreshedAgendaContainer) {
                    console.warn('[Dashboard] agendaContainer aún no disponible tras 800ms');
                    return;
                }
                const btnsReport = refreshedAgendaContainer.querySelectorAll('.territory-report-btn');
                btnsReport.forEach(btn => {
                    btn.onclick = () => {
                        const ids = btn.dataset.ids.split(',');
                        const conductor = btn.dataset.conductor;
                        if (window.ReceptionHub) {
                            window.renderTableCallback = () => refreshConductorView(true);
                            ReceptionHub.openModal({
                                preSelectedId: ids[0],
                                viewMode: 'conductor',
                                displayName: conductor || name,
                                isAdmin: false
                            });
                        }
                    };
                });
                
                if (typeof initSwipeActions === 'function') initSwipeActions();
            }, 800);

            // Sub-modules render
            if (userModsEffectivos.disponibilidad !== false && mAvail?.renderAvailabilitySection) {
                mAvail.renderAvailabilitySection(document.getElementById('availability-container'), name);
            }
            if (userModsEffectivos.rescue !== false && mRescue?.renderRescueMissions) {
                mRescue.renderRescueMissions(allTerritorios, normalizedName, myExtraMissions, rescueCandidates, totalMissionCount); 
                const rescueContainer = document.getElementById('ayudas-container');
                if (rescueContainer) {
                    rescueContainer.innerHTML = `
                        <div class="flex flex-col md:flex-row items-center justify-between p-8 bg-slate-50 dark:bg-black/20 rounded-2xl gap-6 border border-slate-100 dark:border-white/5">
                            <div class="text-center md:text-left">
                                <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Territorios Pendientes</h4>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Colabora con otros grupos de predicación</p>
                            </div>
                            <button onclick="window.showRescueMissionsModal()" class="px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-3">
                                <i class="fas fa-rocket"></i> Ver Disponibles ${totalMissionCount > 0 ? `<span class="bg-white/20 px-2 py-0.5 rounded-lg ml-1 font-black">${totalMissionCount}</span>` : ''}
                            </button>
                        </div>
                    `;
                }
            }
            // Teléfono logic removed from here to fix ReferenceError: myPhones is not defined.
            // Initialization is now handled in refreshConductorView.
            if (userModsEffectivos.ayudas !== false && mRec?.renderRecursosSection) {
                mRec.renderRecursosSection(document.getElementById('recursos-container'));
            }
            if (userModsEffectivos.mapas !== false && mMaps?.renderMapsExplorer) {
                mMaps.renderMapsExplorer(container, allTerritorios, (t) => window.openInteractiveMap(t));
            }
            if (userModsEffectivos.programa !== false && mProg?.initializeWeeklyProgram) {
                // Persist state during refresh
                if (!window._activeProgDayIndex) window._activeProgDayIndex = -1;
                if (!window._activeProgTurns) window._activeProgTurns = new Set(['manana', 'tarde', 'zoom', 'noche']);
                
                mProg.initializeWeeklyProgram(container, userModsEffectivos, allTerritorios, territoryMap, name, currentWeekId, window._activeProgDayIndex, window._activeProgTurns);
            }

            // Nexo Agent Initialization
            if (userModsEffectivos.cerebro !== false && (window._nexoInstance || typeof NexoAgent === 'function')) {
                if (typeof initNexoSystem === 'function') initNexoSystem();
            }


        } catch (err) {
            console.error("Critical error in loadUnifiedDashboard:", err);
            showNotification("Error parcial al renderizar interfaz", "warning");
        }
    }
};








// End of conductor-dashboard.js

