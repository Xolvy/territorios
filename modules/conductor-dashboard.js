
import { auth } from '../firebase-config.js';
import { where } from "firebase/firestore";
import {
    getTerritorios, getConductores, getPublicadores, getTelefonos, getTelefonosParaSesion,
    getConfiguracion,
    getProgramaSemanal, saveProgramaSemanal, syncSlotWithTerritories, getTerritoryHistory,
    addPublicador,
    releaseUnusedTelefonos, solicitarNumeros, updateTelefonoStatus, logSessionSummary, releaseTelefonosById,
    transferTerritory, takeTerritoryPartial, assignFreeTerritory,
    getPuntosInteres,
    startLivePool
} from '../data/firestore-services.js';
import { showNotification, formatPhoneNumber, formatManzanas, normalizeRobust } from './utils/helpers.js';
import { TerritoryIntelligence } from './utils/intelligence.js';
import { MapViewer } from './map-viewer.js';
import { AppConfig } from './utils/config.js';

import { UIHelpers, showModal, showCustomPrompt } from './services/ui-helpers.js';
import { VisualEngine } from './utils/visual-engine.js';
window.AppConfig = AppConfig;

import { moduleRegistry } from './utils/module-registry.js';

// --- MICRO-MODULE LOADER ---
const dynamicSubModules = import.meta.glob('./**/*.js');

async function loadSubModule(name, path) {
    return moduleRegistry.loadModule(name, path, dynamicSubModules);
}


// --- UTILS ---
window.viewMapFromReport = async (id) => {
    showNotification("Cargando mapa interactivo...", "info");
    const territories = await getTerritorios();
    const t = territories.find(x => x.id === id);
    if (t) {
        window.openInteractiveMap(t);
    } else {
        showNotification("No se encontró la data del territorio para el mapa.", "error");
    }
};



export const renderConductorDashboard = async (container, nameOrEmail, appVersion, userRole = null) => {
    const APP_VERSION = appVersion;
    // Xolvy Modular: Clean up previous instance before rendering new one
    if (window.stopActiveLivePools) window.stopActiveLivePools();
    const existingAI = document.getElementById('ai-assistant-overlay');
    if (existingAI) existingAI.remove();

    // Xolvy Modular: Pre-fetch Micro-Modules for this view
    let [mAvail, mRec, mMaps, mRescue, mPhone, mProg] = await Promise.all([
        loadSubModule('availability', './conductor/availability.js'),
        loadSubModule('recursos', './conductor/recursos.js'),
        loadSubModule('maps_explorer', './conductor/maps-explorer.js'),
        loadSubModule('rescue', './conductor/rescue.js'),
        loadSubModule('phone_module', './conductor/phone-module.js'),
        loadSubModule('weekly_program', './conductor/weekly-program.js')
    ]);

    // Xolvy Data Shield: Aggressive normalization for Conductor resolution

    let displayName = nameOrEmail;

    const sessionHandledIds = new Set();
    const getSafeDateId = UIHelpers.formatDateId;
    const getMonday = UIHelpers.getMonday;

    // Xolvy Modular: Pool Data and Unsubscribe references (Initialized early for HMS/LivePool access)
    let currentLivePoolUnsubscribe = null;
    let programLivePoolUnsubscribe = null;
    let territoriesLivePoolUnsubscribe = null;
    let s13LivePoolUnsubscribe = null;
    let configLivePoolUnsubscribe = null;
    let currentSystemConfig = null;
    let poolData = {
        territorios: [],
        programa: null,
        s13: []
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
        console.log("🛑 [Live Pool] All conductor pools stopped.");
    };

    // --- CORE LOGIC HELPERS (Hoisted via 'function' for reliability) ---
    async function refreshPhones() {
        const allPhones = await getTelefonosParaSesion(displayName);
        const userEmail = auth.currentUser?.email?.toLowerCase() || '';
        const userName = normalizeRobust(displayName);
        return allPhones.filter(t => {
            const pub = normalizeRobust(t.publicador_asignado);
            const asg = normalizeRobust(t.asignado_a);
            return (t.estado === 'En Sesión') || (pub === userName || pub === userEmail) || (asg === userName || asg === userEmail);
        });
    }

    async function refreshConductorView(usePool = false) {
        try {
            const configData = await getConfiguracion();
            const allC = await getPublicadores();
            const normalized = displayName.trim().toLowerCase();
            const normalizedPhone = normalized.replace(/\D/g, '');
            const conductorDataRef = allC.find(c => {
                const name = String(c.nombre || '').trim().toLowerCase();
                const email = String(c.email || '').trim().toLowerCase();
                const phone = String(c.telefono || '').replace(/\D/g, '');
                return name === normalized || email === normalized || (normalizedPhone && phone === normalizedPhone);
            });

            // Update displayName with the real name if found
            if (conductorDataRef && conductorDataRef.nombre) {
                displayName = conductorDataRef.nombre;
            }

            const userMods = conductorDataRef?.modulos || { agenda: true, programa: true, disponibilidad: true, telefonos: true, mapas: true, ayudas: true, rescue: false };

            // Re-render the main dashboard shell and components
            await loadUnifiedDashboard(container, displayName, userMods, configData, conductorDataRef, userRole, usePool ? poolData : null);

            const myPhones = await refreshPhones(true);
            const publicadores = await getPublicadores();

            if (mPhone?.initializePhoneModule) {
                mPhone.initializePhoneModule(myPhones, publicadores, displayName, container.querySelector('#phone-tbody'), () => refreshConductorView(true));
            }

            // --- Dynamic Banner Initialization ---
            if (window._bannerInterval) clearInterval(window._bannerInterval);
            const bannerContent = container.querySelector('#dynamic-banner-content');
            if (bannerContent) {
                const messages = [];
                if (configData.tema_mes) messages.push(`TEMA DE LA SEMANA: ${configData.tema_mes}`);
                if (configData.diffusion_messages && configData.diffusion_messages.length > 0) {
                    configData.diffusion_messages.forEach(m => messages.push(`ANUNCIO: ${m}`));
                }

                if (messages.length > 0) {
                    container.querySelector('#dynamic-banner-container')?.classList.remove('hidden');
                    let idx = 0;
                    const rotate = () => {
                        bannerContent.style.opacity = '0';
                        bannerContent.style.transform = 'translateY(5px)';
                        setTimeout(() => {
                            bannerContent.textContent = messages[idx];
                            bannerContent.style.opacity = '1';
                            bannerContent.style.transform = 'translateY(0)';
                            idx = (idx + 1) % messages.length;
                        }, 500);
                    };
                    rotate();
                    window._bannerInterval = setInterval(rotate, 3000);
                } else {
                    container.querySelector('#dynamic-banner-container')?.classList.add('hidden');
                }
            }

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
                        if (window.openProgressModal) window.openProgressModal(card.dataset.id, card.dataset.num, card.dataset.manzanas);
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

    async function renderAISection(name) {
        const config = await getConfiguracion();
        if (!config.gemini_key) return;

        const weekId = UIHelpers.formatDateId(UIHelpers.getMonday(new Date()));
        const [telefonos, publicadores, territorios, programa, pois, conductors] = await Promise.all([
            getTelefonos(), getPublicadores(), getTerritorios(), getProgramaSemanal(weekId), getPuntosInteres(), getConductores()
        ]);

        const brain = new TerritoryIntelligence(telefonos, publicadores, territorios, programa, conductors, pois);

        if (!document.getElementById('ai-pulse-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-pulse-styles';
            style.innerHTML = `
                @keyframes ai-pulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7); }
                    70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(139, 92, 246, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
                }
                @keyframes ai-glow {
                    from { filter: drop-shadow(0 0 5px #8b5cf6); }
                    to { filter: drop-shadow(0 0 20px #c084fc); }
                }
                .ai-thinking { animation: ai-pulse 2s infinite !important; background: linear-gradient(135deg, #8b5cf6, #3b82f6) !important; }
                .ai-badge { position: absolute; top: -5px; right: -5px; width: 18px; height: 18px; background: #ef4444; border-radius: 50%; border: 2px solid white; font-size: 10px; font-weight: 900; color: white; display: flex; align-items: center; justify-content: center; animation: bounce 1s infinite; }
            `;
            document.head.appendChild(style);
        }

        const aiUI = document.createElement('div');
        aiUI.id = 'ai-assistant-overlay';
        aiUI.className = 'fixed inset-0 pointer-events-none z-[60]';
        aiUI.innerHTML = `
            <div id="ai-speech-bubble" class="fixed bottom-28 right-6 md:right-10 left-auto z-[100000] max-w-[220px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl text-slate-800 dark:text-white p-5 rounded-[2rem] rounded-br-none shadow-2xl border border-primary/20 opacity-0 pointer-events-none translate-y-4 transition-all duration-500">
                <p class="text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-50">Sugerencia IA</p>
                <p class="text-[13px] font-black leading-tight" id="ai-bubble-text">¿Te digo por donde empezar?</p>
                <div class="absolute bottom-[-10px] right-2 w-0 h-0 border-l-[12px] border-l-transparent border-t-[12px] border-t-white/95 dark:border-t-slate-900/95 transition-all"></div>
            </div>
            <button id="ai-fab" title="Asistente Inteligente" class="fixed bottom-8 right-6 md:right-10 z-[100000] bg-slate-900 dark:bg-primary text-white rounded-full p-4 md:p-5 shadow-2xl border-2 border-white/20 transition-all hover:scale-110 active:scale-95 group overflow-hidden pointer-events-auto">
                <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent transition-opacity group-hover:opacity-0"></div>
                <i class="fas fa-brain text-3xl md:text-4xl relative z-10 group-hover:rotate-12 transition-transform" style="animation: ai-glow 2s ease-in-out infinite alternate"></i>
                <div id="ai-suggestion-badge" class="hidden ai-badge">1</div>
            </button>
            <div id="ai-panel" class="fixed bottom-[110px] right-6 md:right-10 left-auto w-[min(90vw,400px)] modern-card border-primary/20 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] z-[100001] transform translate-y-12 opacity-0 pointer-events-none transition-all duration-500 ease-out flex flex-col max-h-[75vh] overflow-hidden !p-0 !bg-white/80 dark:!bg-slate-900/80 backdrop-blur-3xl ring-1 ring-white/20 origin-bottom-right">
                <div class="flex justify-between items-center p-8 bg-gradient-to-r from-primary/20 to-blue-500/20 border-b border-primary/10 backdrop-blur-xl">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl text-primary shadow-inner">
                            <i class="fas fa-brain"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-slate-800 dark:text-white text-base uppercase tracking-tighter">Cerebro Territorial</h3>
                            <p class="text-[9px] text-primary font-black uppercase tracking-[0.3em] animate-pulse">Red Neuronal Activa</p>
                        </div>
                    </div>
                    <button id="ai-close" class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-primary transition-all text-xl">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="conductor-chat-log" class="flex-1 overflow-y-auto p-8 space-y-6 text-xs custom-scrollbar min-h-[350px] bg-slate-50/50 dark:bg-black/20">
                    <div class="bg-white dark:bg-slate-800 p-6 rounded-[2rem] rounded-tl-none border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 leading-relaxed shadow-sm font-bold text-[13px]">
                        <p class="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-2 opacity-50">Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        Hola <b>${name.split(' ')[0]}</b>. He analizado el estado del territorio. ✨<br><br>
                        ¿Necesitas que te recomiende un territorio estratégico o tienes alguna consulta sobre la App?
                    </div>
                </div>
                <div class="p-6 bg-white dark:bg-black/40 flex gap-3 border-t border-slate-100 dark:border-white/10">
                    <input type="text" id="conductor-chat-input" placeholder="Escribe tu consulta aquí..." class="flex-1 bg-slate-100 dark:bg-white/5 border border-transparent focus:border-primary/40 rounded-2xl px-6 py-4 text-sm font-bold shadow-inner outline-none transition-all focus:bg-white">
                    <button id="conductor-chat-send" class="bg-primary hover:bg-primary-dark text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 active:scale-90 transition-all"><i class="fas fa-paper-plane text-xl"></i></button>
                </div>
            </div>
        `;

        if (document.getElementById('ai-assistant-overlay')) document.getElementById('ai-assistant-overlay').remove();
        document.body.appendChild(aiUI);

        const observer = new MutationObserver(() => {
            if (!document.body.contains(container)) {
                aiUI.remove();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        const fab = document.getElementById('ai-fab');
        const panel = document.getElementById('ai-panel');
        const closeBtn = document.getElementById('ai-close');
        const input = document.getElementById('conductor-chat-input');
        const sendBtn = document.getElementById('conductor-chat-send');
        const log = document.getElementById('conductor-chat-log');


        const togglePanel = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            panel.classList.toggle('opacity-0');
            panel.classList.toggle('pointer-events-none');
            panel.classList.toggle('translate-y-12');

            if (!panel.classList.contains('opacity-0')) {
                panel.classList.add('pointer-events-auto');
                setTimeout(() => input.focus(), 300);
            } else {
                panel.classList.remove('pointer-events-auto');
            }
        };

        window.toggleAIPanel = togglePanel;

        fab.onclick = togglePanel;
        closeBtn.onclick = togglePanel;

        const handleSend = async () => {
            const prompt = input.value.trim();
            if (!prompt) return;
            log.innerHTML += `<div class="flex justify-end"><div class="bg-primary text-white px-5 py-3 rounded-2xl rounded-tr-none text-xs max-w-[85%] shadow-lg">${prompt}</div></div>`;
            log.scrollTop = log.scrollHeight;
            input.value = '';
            input.disabled = true;

            try {
                const response = await brain.askGemini(config.gemini_key, `Soy el conductor ${name}. Consulta: ${prompt}`);
                const htmlResponse = response.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
                log.innerHTML += `<div class="flex justify-start"><div class="bg-white dark:bg-slate-800 text-slate-700 dark:text-gray-200 px-5 py-4 rounded-2xl rounded-tl-none text-[13px] border border-slate-100 dark:border-white/10 max-w-[90%] leading-relaxed shadow-md">${htmlResponse}</div></div>`;
            } catch (err) {
                log.innerHTML += `<div class="bg-red-500/10 text-red-400 text-[10px] p-4 rounded-xl border border-red-500/20">Error: ${err.message}</div>`;
            } finally {
                input.disabled = false;
                input.focus();
                log.scrollTop = log.scrollHeight;
            }
        };

        sendBtn.onclick = handleSend;
        input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
    }

    async function openProgressModal(initialId, filterIds = null) {
        let myTerritories = [];
        try {
            const allT = await getTerritorios();
            if (filterIds) {
                myTerritories = allT.filter(t => filterIds.includes(t.id));
            } else {
                const initialT = allT.find(t => t.id === initialId);
                if (initialT && initialT.asignado_a) {
                    myTerritories = allT.filter(t => t.asignado_a === initialT.asignado_a || t.auxiliar === initialT.asignado_a);
                } else {
                    myTerritories = initialT ? [initialT] : [];
                }
            }
        } catch (e) { console.error(e); myTerritories = [{ id: initialId, numero: '?' }]; }

        myTerritories.sort((a) => a.id === initialId ? -1 : 1);

        showModal(`
            <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0b0e14] sm:rounded-[2rem] overflow-hidden">
                <header class="p-8 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5 flex items-center gap-6">
                    <div class="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl text-primary shadow-inner"><i class="fas fa-chart-line"></i></div>
                    <div>
                        <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-1">Informe de Actividad</h3>
                        <p class="text-[9px] text-slate-500 uppercase tracking-[0.4em] font-black">Registro de Territorios</p>
                    </div>
                </header>
                <div class="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar">
                    ${myTerritories.map(t => `
                        <div class="modern-card p-6 border-slate-200 dark:border-white/10 group cursor-pointer hover:bg-slate-50 transition-all flex items-center justify-between">
                            <div class="flex items-center gap-5">
                                <div class="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center font-black text-primary text-xs">T-${t.numero}</div>
                                <span class="text-xs font-black text-slate-500 uppercase tracking-widest">Informar este territorio</span>
                            </div>
                            <i class="fas fa-chevron-right text-slate-300"></i>
                        </div>
                    `).join('')}
                </div>
                <footer class="p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                    <button onclick="window.closeModal()" class="w-full py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-white/5 rounded-2xl hover:bg-slate-100 transition-all">Cancelar</button>
                </footer>
            </div>
        `, null, 'max-w-2xl');
    }

    async function showUnifiedTerritoryHistory(territoryId, territoryNum) {
        try {
            const history = await getTerritoryHistory(territoryId);
            showModal(`
                <div class="flex flex-col h-full bg-slate-50 dark:bg-[#0a0f18] rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <header class="p-8 bg-amber-500 text-white flex items-center gap-6">
                        <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20"><i class="fas fa-history"></i></div>
                        <div><h3 class="text-xl font-black uppercase tracking-tight leading-none mb-1">Historial T-${territoryNum}</h3></div>
                    </header>
                    <div class="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-4">
                        ${history.map(rec => `
                            <div class="modern-card p-6 border-slate-200 dark:border-white/5">
                                <p class="text-[10px] text-slate-400 font-bold uppercase mb-2">${new Date(rec.fecha_entrega || rec.fecha).toLocaleDateString()}</p>
                                <p class="text-sm font-bold text-slate-800 dark:text-slate-200">"${rec.notas || rec.observaciones || 'Sin notas'}"</p>
                            </div>
                        `).join('')}
                    </div>
                    <footer class="p-8 bg-white dark:bg-black/40 border-t border-slate-100 dark:border-white/5">
                        <button onclick="window.closeModal()" class="w-full py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-all">Cerrar</button>
                    </footer>
                </div>
            `, null, 'max-w-2xl');
        } catch (e) { showNotification("Error al cargar historial", "error"); }
    }

    async function handleRescueTerritory(id, num, newConductor, manzanasStr, isFree = false) {
        const manzanas = manzanasStr ? manzanasStr.split(',').map(m => m.trim()).filter(Boolean) : [];
        let selectedManzanas = [...manzanas];

        if (manzanas.length > 1) {
            const result = await new Promise(resolve => {
                const modal = document.getElementById('modal-container');
                modal.innerHTML = `
                    <div class="modal-body max-w-md w-full glass-morphism p-10 rounded-[3rem] border border-white/20 shadow-2xl">
                        <h3 class="text-2xl font-black mb-2 uppercase text-center">Seleccionar Alcance</h3>
                        <p class="text-[10px] text-slate-500 text-center mb-8 font-black uppercase italic">T-${num}: ${manzanas.length} Manzanas</p>
                        <div class="space-y-3 mb-8 px-2">
                            ${manzanas.map(m => `
                                <label class="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 cursor-pointer">
                                    <span class="text-sm font-bold">Manzana ${m}</span>
                                    <input type="checkbox" checked value="${m}" class="rescue-mz-check w-5 h-5 rounded-lg text-primary">
                                </label>
                            `).join('')}
                        </div>
                        <div class="flex flex-col gap-3">
                            <button id="rescue-confirm-partial" class="btn-pro bg-primary text-white py-5 rounded-[2rem]">Tomar Selección</button>
                            <button id="rescue-cancel-partial" class="w-full py-4 text-[9px] font-black uppercase text-slate-400">Regresar</button>
                        </div>
                    </div>
                `;
                modal.classList.remove('hidden');
                document.getElementById('rescue-cancel-partial').onclick = () => { modal.classList.add('hidden'); resolve(null); };
                document.getElementById('rescue-confirm-partial').onclick = () => {
                    const checks = modal.querySelectorAll('.rescue-mz-check:checked');
                    const picked = Array.from(checks).map(c => c.value);
                    modal.classList.add('hidden');
                    resolve(picked.length > 0 ? picked : null);
                };
            });
            if (!result) return;
            selectedManzanas = result;
        }

        try {
            showNotification("Procesando...", "info");
            if (selectedManzanas.length === manzanas.length) {
                if (isFree) await assignFreeTerritory(id, newConductor, num, selectedManzanas.join(', '));
                else await transferTerritory(id, newConductor, selectedManzanas.join(', '));
            } else {
                const remaining = manzanas.filter(m => !selectedManzanas.includes(m));
                await takeTerritoryPartial(id, newConductor, selectedManzanas, remaining);
            }
            showNotification(`¡Éxito! Territorio #${num} actualizado.`, "success");
            refreshConductorView();
        } catch (err) {
            console.error(err);
            showNotification("Error: " + err.message, "error");
        }
    }

    window.openProgressModal = openProgressModal;
    window.showUnifiedTerritoryHistory = showUnifiedTerritoryHistory;
    window.handleRescueTerritory = handleRescueTerritory;

    async function loadUnifiedDashboard(container, name, userMods, config, conductorData, userRole, usePoolData = null) {
        if (window._phoneSessionActive === undefined) window._phoneSessionActive = false;
        // We no longer hide the territories container as requested ("fusionar") 
        // to allow seeing all assigned territories independently of the weekly program.

        const currentWeekId = getSafeDateId(getMonday(new Date()));
        let currentWeekStart = getMonday(new Date());
        let activeDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=Lunes
        let activeTurns = new Set(['manana', 'tarde', 'noche', 'zoom']);

        let programa, allTerritorios;
        try {
            if (usePoolData) {
                programa = usePoolData.programa || await getProgramaSemanal(currentWeekId);
                allTerritorios = usePoolData.territorios?.length > 0 ? usePoolData.territorios : await getTerritorios();
            } else {
                [programa, allTerritorios] = await Promise.all([
                    getProgramaSemanal(currentWeekId),
                    getTerritorios()
                ]);
            }
            if (window.precacheTerritoryResources && allTerritorios) {
                window.precacheTerritoryResources(allTerritorios);
            }
        } catch (err) {
            console.error("Critical error loading dashboard data:", err);
            const fallbackContainer = container.querySelector('#calendar-container');
            if (fallbackContainer) fallbackContainer.innerHTML = '<div class="col-span-full py-10 text-center text-red-500 font-bold">Error de conexión.</div>';
            return;
        }

        const territoryMap = {};
        if (allTerritorios) allTerritorios.forEach(t => territoryMap[t.numero] = t);
        const normalizedName = name?.trim().toLowerCase();
        const turnosArr = ['manana', 'tarde', 'noche', 'zoom'];
        const assignments = [];
        const shownTerritoryIds = new Set();
        // Initialize state variables for outer resolution
        try {

            const mods = conductorData?.modulos || {
                agenda: true,
                programa: true,
                disponibilidad: true,
                telefonos: true,
                mapas: true,
                ayudas: true,
                rescue: false
            };

            const wasProgOpen = container.querySelector('#details-programa')?.open ?? false;
            const wasAvailOpen = container.querySelector('#details-availability')?.open ?? false;
            const wasMapsOpen = container.querySelector('#details-maps')?.open ?? false;

            container.innerHTML = `
        <div class="${VisualEngine.get('shell.container')}" data-adaptive-container="true">
          <div class="${VisualEngine.get('shell.mainOrder')}">
            <header class="${VisualEngine.get('header.wrapper')} sticky top-0 z-50 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5" data-mobile-order="1">
                <div class="${VisualEngine.get('header.glow')} !opacity-20"></div>
                <div class="flex items-center gap-4 md:gap-6 relative z-10">
                    <div class="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-indigo-600 to-teal-500 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-500/20 transform hover:rotate-3 transition-transform duration-500">
                        <i class="fas fa-id-card text-xl md:text-2xl"></i>
                    </div>
                    <div>
                        <h2 class="text-xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">
                            Hola, ${displayName.split(' ')[0]}
                        </h2>
                        <div class="flex items-center gap-2 mt-1 md:mt-2">
                             <div class="${VisualEngine.get('status.badge')} ${VisualEngine.get('status.online')} hidden">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Sincronizado
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
                        <p id="dynamic-banner-content" class="text-[10px] md:text-[11px] font-black text-indigo-600/80 dark:text-indigo-300/90 uppercase tracking-[0.25em] animate-fade-in transition-all duration-700 truncate"></p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center justify-end gap-2 md:gap-3 w-full lg:w-auto relative">
                    <!-- Version Badge (Visible & Professional) -->
                    <div class="hidden md:flex flex-col items-center bg-slate-50 dark:bg-white/5 px-4 lg:px-6 py-2 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm shrink-0 pointer-events-none cursor-default">
                        <span class="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Versión</span>
                        <span class="text-[9px] font-black text-slate-800 dark:text-white tracking-widest uppercase tabular-nums">${APP_VERSION}</span>
                    </div>

                    <!-- Unified Pill Container (High Contrast & Z-Target) -->
                    <div class="flex-none flex items-center justify-center gap-4 bg-slate-100 dark:bg-white/5 px-4 md:px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner relative z-[60]">
                        <!-- Theme Toggle Button -->
                        <button onclick="window.toggleTheme(); window.refreshConductorView();" class="text-slate-500 hover:text-primary transition-all active:scale-75 group/theme outline-none relative z-[70] pointer-events-auto">
                            <i class="fas fa-moon dark:hidden"></i>
                            <i class="fas fa-sun hidden dark:block text-yellow-500 animate-pulse"></i>
                        </button>

                        <div class="w-px h-3 bg-slate-200 dark:bg-white/10 mx-0.5 pointer-events-none"></div>

                        <!-- Current View Status -->
                        <div class="flex items-center gap-2 pointer-events-none">
                            <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">Conductor</span>
                        </div>

                        <div class="w-px h-3 bg-slate-200 dark:bg-white/10 mx-0.5 pointer-events-none"></div>

                        <!-- Action Button (Admin or Repair) -->
                        ${(userRole === 'Administrador' || userRole === 'SuperAdmin' || conductorData?.privilegios?.includes('Administrador')) ? `
                            <button id="btn-goto-admin" class="text-[8px] font-black text-primary hover:text-primary-dark uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap outline-none px-1 relative z-[70] pointer-events-auto">
                                <i class="fas fa-random text-[10px]"></i> Admin
                            </button>
                        ` : ''}
                    </div>

                    <button id="logout-btn" class="${VisualEngine.get('button.base')} ${VisualEngine.get('button.danger')} !px-6 !py-2.5 lg:flex-none tabular-nums shrink-0">
                        <i class="fas fa-power-off"></i> Salir
                    </button>
                </div>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-y-6 gap-x-8 px-2 md:px-4">
                <!-- Agenda Section (Always Expanded, No container) -->
                <div class="lg:col-span-2 ${mods.agenda !== false ? '' : 'hidden'} mb-10" id="agenda-section">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 px-6">
                        <div class="flex items-start gap-8">
                            <div class="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 flex items-center justify-center text-3xl text-indigo-500 shadow-inner border border-indigo-500/10">
                                <i class="fas fa-bolt"></i>
                            </div>
                            <div>
                                <h3 class="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Agenda Inteligente</h3>
                                <p class="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-80">Próximas asignaciones y sugerencias</p>
                            </div>
                        </div>
                        <div id="agenda-intelligence-badge" class="mt-4 md:mt-0"></div>
                    </div>
                    <div id="calendar-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 px-2">
                        <div class="skeleton-pro h-48 rounded-[2.5rem]"></div>
                    </div>
                </div>

                <!-- Separation Divider -->
                <div class="lg:col-span-2 py-4 flex items-center gap-4 px-4 opacity-60">
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
                    <div class="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/20"></div>
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
                </div>

                <!-- Weekly Program Module -->
                <div id="programa-semanal-section" class="lg:col-span-2 ${mods.programa !== false ? '' : 'hidden'} mb-4">
                    <div class="${VisualEngine.get('card.premium')} !p-0 overflow-hidden group/prog">
                        <details id="details-programa" class="group/prog-details" ${wasProgOpen ? 'open' : ''}>
                             <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-8 md:p-10 cursor-pointer list-none select-none hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-transparent group-open/prog-details:border-slate-100 dark:group-open/prog-details:border-white/5 relative">
                                <div class="flex items-start gap-8 relative z-10">
                                    <div class="w-16 h-16 rounded-[1.5rem] bg-secondary/10 flex items-center justify-center text-3xl text-secondary shadow-inner border border-secondary/10 group-open/prog-details:rotate-6 transition-transform">
                                        <i class="fas fa-calendar-alt"></i>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-4">
                                            <h3 class="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Cronograma de Salidas</h3>
                                            <i class="fas fa-chevron-down text-sm text-slate-400 group-open/prog-details:rotate-180 transition-transform"></i>
                                        </div>
                                        <p class="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-80">Roles y puntos de reunión generales</p>
                                    </div>
                                </div>
                            </summary>
                            <div class="p-4 md:p-8 space-y-8 animate-fade-in group-open/prog-details:block hidden">
                                <div id="program-header-controls" class="flex flex-col xl:flex-row items-center justify-between gap-6">
                                     <div class="flex items-center bg-slate-100 dark:bg-white/5 rounded-2xl p-1 border border-slate-200 dark:border-white/5 shadow-inner">
                                         <button id="prog-prev-week" class="p-3 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-primary"><i class="fas fa-chevron-left"></i></button>
                                         <div class="px-6 py-2 min-w-[180px] text-center">
                                             <span id="prog-week-range" class="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Cargando...</span>
                                         </div>
                                         <button id="prog-next-week" class="p-3 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-primary"><i class="fas fa-chevron-right"></i></button>
                                     </div>
                                     <div id="prog-actions" class="flex gap-2">
                                         <button id="prog-btn-today" class="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-6 py-3 rounded-xl font-black hover:bg-slate-50 transition-all text-[9px] uppercase tracking-widest shadow-sm">Hoy</button>
                                         <button id="prog-btn-share" class="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-600 hover:bg-blue-500 hover:text-white rounded-xl transition-all shadow-sm"><i class="fas fa-share-alt"></i></button>
                                     </div>
                                </div>
                                <div id="weekly-program-cards"></div>
                            </div>
                        </details>
                    </div>
                </div>

                <!-- Separation Divider -->
                <div class="lg:col-span-2 py-6 flex items-center gap-4 px-4 opacity-60">
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
                    <div class="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/20"></div>
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
                </div>

                <!-- Maps Module -->
                <div class="lg:col-span-2 modern-card border-slate-200 dark:border-white/10 shadow-xl transition-all overflow-hidden !p-0 ${mods.mapas !== false ? '' : 'hidden'} bg-white dark:bg-slate-900/40 mb-4 rounded-3xl" id="interactive-maps-module">
                    <details id="details-maps" class="group/maps" ${wasMapsOpen ? 'open' : ''}>
                        <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 cursor-pointer list-none select-none hover:bg-slate-50 transition-colors">
                            <div class="flex items-start gap-6">
                                <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-2xl text-indigo-600">
                                    <i class="fas fa-map-marked-alt"></i>
                                </div>
                                <div>
                                    <div class="flex items-center gap-3">
                                        <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Explorador de Mapas</h3>
                                        <i class="fas fa-chevron-down text-xs text-slate-400 group-open/maps:rotate-180 transition-transform"></i>
                                    </div>
                                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1 opacity-70">Explorador visual de Mz. y sectores</p>
                                </div>
                            </div>
                        </summary>
                        <div class="p-8 pt-0 animate-fade-in">
                            <div id="conductor-maps-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"></div>
                        </div>
                    </details>
                </div>

                <!-- Separation Divider -->
                <div class="lg:col-span-2 py-4 flex items-center gap-4 px-4 opacity-60">
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
                    <div class="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/20"></div>
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
                </div>

                <!-- Phone Module -->
                <div class="lg:col-span-2 relative modern-card p-6 md:p-8 ${mods.telefonos !== false ? '' : 'hidden'} border-slate-200 dark:border-white/10 shadow-xl bg-white dark:bg-slate-900/40 mb-4 rounded-3xl" id="phone-module-card">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 px-2">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                <i class="fas fa-phone-alt"></i>
                            </div>
                            <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Predicación Telefónica</h3>
                        </div>

                        <!-- Host Key Pill -->
                        <div class="flex flex-col items-center gap-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-5 py-2.5 rounded-[1.5rem] shadow-sm transform hover:scale-105 transition-transform cursor-default">
                            <div class="flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                <span class="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Clave de anfitrión</span>
                            </div>
                            <span class="text-lg font-black text-primary dark:text-indigo-400 tracking-tighter tabular-nums leading-none">014282</span>
                        </div>
                    </div>

                    <div id="phone-compact-view" class="animate-fade-in p-2 md:p-8">
                        <div class="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-slate-900 p-8 md:p-12 text-center rounded-3xl border border-indigo-100 dark:border-indigo-500/10 shadow-inner">
                           <div class="w-20 h-20 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-4xl text-indigo-600 mx-auto mb-8">
                               <i class="fas fa-phone-alt"></i>
                           </div>
                           <h3 class="text-2xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tighter">¿Listo para Predicar?</h3>
                           <p class="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-10 font-medium">Inicia tu sesión de hoy para ver tus números asignados.</p>
                           <div class="flex flex-wrap justify-center gap-4" id="phone-actions-container">
                               <button id="btn-solicitar" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest text-[9px]">
                                   <i class="fas fa-rocket text-base"></i> Solicitar Números
                               </button>
                               <button id="btn-zoom-compact" onclick="window.open(AppConfig.zoom_url, '_blank')" class="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest text-[9px]">
                                   <i class="fas fa-video text-base"></i> Conectar Zoom
                               </button>
                           </div>
                        </div>
                    </div>

                    <div id="phone-expanded-view" class="hidden animate-fade-in space-y-8">
                        <div class="flex flex-col lg:flex-row justify-between items-center gap-4 border-b border-slate-100 dark:border-white/5 pb-8">
                            <div class="flex gap-2">
                                <button id="btn-revisitas" class="px-5 py-3 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all">Revisitas</button>
                                <button id="btn-refresh" class="px-5 py-3 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"><i class="fas fa-sync-alt"></i></button>
                            </div>
                            <div class="flex gap-2">
                                <button id="btn-zoom" onclick="window.open(AppConfig.zoom_url, '_blank')" class="px-6 py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">Zoom</button>
                                <button id="btn-finalizar" class="px-6 py-3 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20">Finalizar</button>
                            </div>
                        </div>

                        <div class="overflow-x-auto overflow-y-visible">
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

                <!-- Separation Divider -->
                <div class="lg:col-span-2 py-4 flex items-center gap-4 px-4 opacity-60">
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
                    <div class="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/20"></div>
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
                </div>

                <!-- Availability Module -->
                <div class="lg:col-span-2 ${mods.disponibilidad !== false ? '' : 'hidden'} mb-4" id="availability-section">
                    <div class="modern-card !p-0 border-slate-200 dark:border-white/10 shadow-xl transition-all bg-white dark:bg-slate-900/40 rounded-3xl overflow-hidden">
                         <details id="details-availability" class="group/avail-details" ${wasAvailOpen ? 'open' : ''}>
                             <summary class="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 cursor-pointer list-none select-none hover:bg-slate-50 transition-colors">
                                <div class="flex items-start gap-6">
                                    <div class="w-14 h-14 rounded-2xl bg-teal-500/10 flex items-center justify-center text-2xl text-teal-600">
                                        <i class="fas fa-user-clock"></i>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-3">
                                            <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Mi Disponibilidad</h3>
                                            <i class="fas fa-chevron-down text-xs text-slate-400 group-open/avail-details:rotate-180 transition-transform"></i>
                                        </div>
                                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1 opacity-70">Gestiona tus horarios para el programa</p>
                                    </div>
                                </div>
                            </summary>
                            <div id="availability-container" class="p-4 md:p-8 animate-fade-in group-open/avail-details:block hidden"></div>
                         </details>
                    </div>
                </div>

                <!-- Separation Divider -->
                <div class="lg:col-span-2 py-6 flex items-center gap-4 px-4 opacity-60 ${mods.ayudas !== false ? '' : 'hidden'}">
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
                    <div class="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/20"></div>
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-white/10 to-transparent"></div>
                </div>

                <!-- Help Module (Expanded, No container) -->
                <div class="lg:col-span-2 ${mods.ayudas !== false ? '' : 'hidden'} mb-6" id="recursos-section">
                    <div class="flex items-start gap-6 mb-8 px-4">
                        <div class="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl text-amber-600">
                            <i class="fas fa-lightbulb"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Ayudas para el Ministerio</h3>
                            <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1 opacity-70">Recursos, guías y materiales útiles</p>
                        </div>
                    </div>
                    <div id="recursos-container" class="animate-fade-in px-2"></div>
                </div>
            </div>
        </div>
        <div id="phone-floating-actions" class="fixed bottom-32 md:bottom-36 right-6 md:right-10 hidden flex-col gap-3 z-[99999] animate-slide-up pointer-events-none">
            <button id="btn-solicitar-more-float" class="w-12 h-12 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl shadow-[0_10px_20px_-5px_rgba(16,185,129,0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all outline-none border-2 border-white dark:border-slate-900 pointer-events-auto text-sm" title="Solicitar más"><i class="fas fa-plus"></i></button>
            <button id="btn-finalizar-float" class="w-12 h-12 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl shadow-[0_10px_20px_-5px_rgba(244,63,94,0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all outline-none border-2 border-white dark:border-slate-900 pointer-events-auto text-sm" title="Finalizar Sesión"><i class="fas fa-power-off"></i></button>
        </div>
        <div id="modal-container" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden overflow-y-auto z-[9999] p-4 md:p-10 flex justify-center items-start"></div>
`;

            // Robust element discovery: Try container first, then global document
            const getEl = (id) => container.querySelector(`#${id} `) || document.getElementById(id);

            const intelligenceBadge = getEl('agenda-intelligence-badge');
            const agendaContainer = getEl('calendar-container');


            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.onclick = null;
                logoutBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    localStorage.removeItem('demo_role');
                    await auth.signOut();
                    location.href = '/login';
                });
                // Location.reload(); // Not strictly necessary if auth state change handles it, but good for clean slate
            }


            const btnAdmin = container.querySelector('#btn-goto-admin');
            if (btnAdmin) {
                btnAdmin.onclick = () => {
                    window.history.pushState({}, '', '/administrador/dashboard');
                    location.reload();
                };
            }

            // Helper for Phones (Moved Up)

            // Auto-release on Window Close
            window.addEventListener('beforeunload', () => {
                if (window.stopActiveLivePools) window.stopActiveLivePools();
                if (window._phoneSessionActive && window._currentSessionPhoneIds?.length > 0) {
                    try { releaseTelefonosById(window._currentSessionPhoneIds); } catch (e) { console.warn('Fast release failed', e); }
                }
            });

            // Robust Refresh for Table specifically
            window.refreshPhoneTableOnly = async (idToMark = null) => {
                if (idToMark) sessionHandledIds.add(idToMark);

                const searchPhone = container.querySelector('#search-phone');
                const filterStatus = container.querySelector('#filter-phone-status');
                const term = searchPhone?.value.toLowerCase() || '';
                const status = filterStatus?.value || '';
                await refreshAndRenderPhoneTable(term, status);
            };

            // Expose refresh function/trigger

            // Connection Hub Logic
            const statusDot = container.querySelector('#status-dot');
            const statusText = container.querySelector('#status-text');
            const btnSyncAll = container.querySelector('#btn-sync-all');

            const updateConnectionStatus = () => {
                if (navigator.onLine) {
                    statusDot?.classList.replace('bg-rose-500', 'bg-emerald-500');
                    statusText && (statusText.innerText = 'En Línea');
                } else {
                    statusDot?.classList.replace('bg-emerald-500', 'bg-rose-500');
                    statusText && (statusText.innerText = 'Modo Offline');
                }
            };
            window.addEventListener('online', updateConnectionStatus);
            window.addEventListener('offline', updateConnectionStatus);
            updateConnectionStatus();

            if (btnSyncAll) {
                btnSyncAll.onclick = async () => {
                    const allT = await getTerritorios();
                    showNotification(`Sincronizando ${allT.length} territorios...`, 'info');
                    btnSyncAll.querySelector('i').classList.add('animate-spin');
                    if (window.precacheTerritoryResources) {
                        await window.precacheTerritoryResources(allT);
                        showNotification("¡Todo el sistema está listo para uso offline!", "success");
                    }
                    btnSyncAll.querySelector('i').classList.remove('animate-spin');
                };
            }

            // --- DASHBOARD LISTENERS SETUP ---
            const setupDashboardListeners = () => {
                // Phone Search & Filter
                const searchPhone = container.querySelector('#search-phone');
                const filterStatus = container.querySelector('#filter-phone-status');
                if (searchPhone) {
                    searchPhone.oninput = () => {
                        window.refreshPhoneTableOnly();
                    };
                }
                if (filterStatus) {
                    filterStatus.onchange = () => {
                        window.refreshPhoneTableOnly();
                    };
                }

                // Revisitas Modal
                const btnRevisitas = container.querySelector('#btn-revisitas');
                if (btnRevisitas) {
                    btnRevisitas.onclick = async () => {
                        showNotification("Cargando revisitas...", "info");
                        const [allPhones, allPubs] = await Promise.all([
                            getTelefonos(true),
                            getPublicadores()
                        ]);
                        const revisitas = allPhones.filter(p => p.estado === 'Revisita');

                        const resolveName = (raw) => {
                            const clean = String(raw || '').trim();
                            if (!clean) return 'Sin asignar';
                            const found = allPubs.find(p => p.id === clean || p.email?.toLowerCase() === clean.toLowerCase() || p.nombre === clean);
                            return found ? found.nombre : clean;
                        };

                        showModal(`
                        <div class="p-8 space-y-8 bg-slate-50 dark:bg-[#0b0e14]">
                        <div class="flex items-center gap-6">
                            <div class="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-3xl text-amber-500 shadow-inner border border-amber-500/10">
                                <i class="fas fa-sync-alt rotate-180"></i>
                            </div>
                            <div>
                                <h3 class="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-1">Centro de Revisitas</h3>
                                <p class="text-[10px] text-amber-500 font-black uppercase tracking-[0.3em]">Gestión de contactos interesados</p>
                            </div>
                        </div>

                        <div class="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                            ${revisitas.length === 0 ? `
                                <div class="py-12 text-center opacity-40">
                                    <p class="text-[10px] font-black uppercase tracking-[0.4em]">No hay revisitas registradas</p>
                                </div>
                            ` : revisitas.map(r => `
                                <div class="modern-card bg-white dark:bg-white/[0.03] !p-6 border-slate-200 dark:border-white/5 group hover:border-amber-500/30 transition-all shadow-sm">
                                    <div class="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 class="text-lg font-black text-slate-800 dark:text-white tabular-nums">${formatPhoneNumber(r.telefono)}</h4>
                                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">${r.nombre || ''}</p>
                                        </div>
                                        <div class="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[8px] font-black uppercase tracking-widest">Revisita</div>
                                    </div>
                                    
                                    <div class="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-black/5">
                                        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs">
                                            <i class="fas fa-user-edit"></i>
                                        </div>
                                        <div class="flex-1">
                                            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Responsable</p>
                                            <p class="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">${resolveName(r.asignado_a || r.publicador_asignado)}</p>
                                        </div>
                                    </div>

                                    ${r.notas ? `
                                        <div class="mb-6 p-4 bg-amber-50/30 dark:bg-amber-500/5 rounded-xl border border-amber-500/10 italic text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                            "${r.notas}"
                                        </div>
                                    ` : ''}

                                    <div class="flex justify-center">
                                        <button onclick="window.returnPhoneToPool('${r.id}')" class="w-full py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-500/5 flex items-center justify-center gap-2">
                                            <i class="fas fa-undo-alt"></i> Devolver
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <button onclick="window.closeModal()" class="w-full py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-primary transition-colors">Cerrar Ventana</button>
                    </div>
    `, null, 'max-w-2xl');

                        window.returnPhoneToPool = async (id) => {
                            showCustomPrompt("Indica la razón de la devolución (esto se guardará en el historial):", "", async (reason) => {
                                if (!reason || reason.trim().length === 0) {
                                    showNotification("Debes indicar una razón", "warning");
                                    return;
                                }
                                await updateTelefonoStatus(id, 'Sin asignar', null, reason);
                                window.closeModal();

                                showNotification("Número devuelto correctamente.", "success", 5000, [], async () => {
                                    try {
                                        await updateTelefonoStatus(id, 'Revisita', null, 'Devolución deshecha por el usuario');
                                        showNotification("Acción deshecha.");
                                        window.refreshConductorView();
                                    } catch (err) {
                                        console.error("Undo error:", err);
                                        showNotification("No se pudo deshacer la acción", "error");
                                    }
                                });

                                window.refreshConductorView();
                            });
                        };

                        window.reAssignAndCall = async (id, phone) => {
                            // Re-request properly if not currently requested by me
                            await solicitarNumeros(1, displayName);
                            // Open notes
                            window.openPhoneNotes(id, phone, '');
                            window.closeModal();
                        };
                    };
                }

                // Add Publisher
                const btnAddPub = container.querySelector('#btn-add-publicador');
                if (btnAddPub) {
                    btnAddPub.onclick = async () => {
                        const modal = document.getElementById('modal-container');
                        modal.innerHTML = `
    < div class="modern-card p-10 max-w-sm w-full shadow-2xl relative animate-bounce-in border-primary/20 bg-white dark:bg-[#0b0e14]" >
                        <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl text-primary mx-auto mb-6 shadow-inner border border-primary/10">
                            <i class="fas fa-user-plus"></i>
                        </div>
                        <h3 class="text-2xl font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tighter text-center">Nuevo Publicador</h3>
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-8 text-center">Registrar nuevo integrante</p>
                        
                        <div class="space-y-6">
                            <div class="space-y-2">
                                 <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Completo</label>
                                 <input type="text" id="new-pub-name-input" placeholder="Ej: Juan Pérez" class="w-full bg-slate-50 dark:bg-white/5 border border-transparent focus:border-primary/30 rounded-2xl px-6 py-4 text-slate-800 dark:text-white focus:bg-white dark:focus:bg-white/10 outline-none transition-all placeholder:text-slate-400 font-bold shadow-inner">
                            </div>
                        </div>

                        <div class="flex gap-4 mt-10">
                            <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-white/5 rounded-2xl hover:bg-slate-200 transition-colors">Cancelar</button>
                            <button id="confirm-add-pub" class="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-white bg-primary rounded-2xl shadow-xl shadow-primary/30 hover:bg-primary-dark transition-all hover:scale-105 active:scale-95">Agregar</button>
                        </div>
                    </div>
    `;
                        modal.classList.remove('hidden');
                        const inputName = document.getElementById('new-pub-name-input');
                        inputName.focus();

                        const submit = async () => {
                            const name = inputName.value.trim();
                            if (name.length > 0) {
                                try {
                                    modal.classList.add('hidden');
                                    await addPublicador({ nombre: name });
                                    showNotification("Publicador agregado correctamente.", "success");
                                    window.refreshConductorView();
                                } catch (e) {
                                    console.error(e);
                                    showNotification("Error al agregar publicador: " + e.message, "error");
                                }
                            }
                        };

                        document.getElementById('confirm-add-pub').onclick = submit;
                        inputName.onkeypress = (e) => { if (e.key === 'Enter') submit(); };
                    };
                }

                // Finalize Session
                const bindFinalizar = (id) => {
                    const btn = container.querySelector(`#${id} `);
                    if (btn) {
                        btn.onclick = async () => {
                            const allPhones = await getTelefonos();
                            // Xolvy Shield: Use robust normalization for comparison to avoid 'No phones found' error
                            const myPhones = allPhones.filter(t => (t.solicitado_por || '').trim() === (displayName || '').trim());

                            if (myPhones.length === 0) {
                                showNotification("No tienes números solicitados activos.", "info");
                                return;
                            }

                            const summary = {
                                total: myPhones.length,
                                stats: {
                                    'Contestaron': 0,
                                    'No contestan': 0,
                                    'Colgaron': 0,
                                    'Revisita': 0,
                                    'Predicado': 0,
                                    'No llamar': 0,
                                    'Sin asignar': 0
                                }
                            };

                            myPhones.forEach(t => {
                                const st = t.estado || 'Sin asignar';
                                if (Object.prototype.hasOwnProperty.call(summary.stats, st)) summary.stats[st]++;
                                else summary.stats['Sin asignar']++;
                            });

                            showModal(`
                        <div class="p-6 text-center space-y-6 animate-fade-in bg-slate-50 dark:bg-[#0b0e14]">
                            <div class="flex flex-col items-center">
                                <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl text-primary mb-4">
                                    <i class="fas fa-flag-checkered"></i>
                                </div>
                                <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Sesión Finalizada</h3>
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Resumen de Actividad</p>
                            </div>

                            <div class="bg-white dark:bg-white/5 rounded-2xl p-6 border border-slate-100 dark:border-white/10 shadow-sm space-y-4">
                                <div class="flex justify-between items-center py-2 border-b border-slate-50 dark:border-white/5">
                                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Registros</span>
                                    <span class="text-2xl font-black text-primary tracking-tighter tabular-nums">${summary.total}</span>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    ${Object.entries(summary.stats)
                                    .filter(([, count]) => count > 0)
                                    .map(([name, count]) => `
                                        <div class="flex flex-col items-start p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                            <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">${name}</span>
                                            <span class="text-sm font-black text-slate-800 dark:text-white tabular-nums">${count}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <textarea id="session-notes" placeholder="Notas adicionales sobre esta sesión (opcional)..." 
                                class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-[11px] font-medium outline-none focus:ring-1 focus:ring-primary min-h-[80px] transition-all resize-none"></textarea>

                            <div class="flex flex-col gap-3">
                                <button id="btn-share-results" class="w-full py-4 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
                                     <i class="fas fa-paper-plane text-xl"></i> Enviar reporte
                                </button>
                                <button onclick="window.closeModal()" class="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors">Volver</button>
                            </div>
                        </div>
    `, async (modal) => {
                                const shareBtn = modal.querySelector('#btn-share-results');
                                if (shareBtn) {
                                    shareBtn.onclick = async () => {
                                        const notes = modal.querySelector('#session-notes')?.value || '';
                                        // Xolvy Adapt: Pre-action countdown for Finalize with RED bar ('bg-rose-500')
                                        showNotification("Finalizando sesión...", "info", 5000, ["Preparando reporte", "Cerrando registros"], null, async () => {
                                            try {
                                                await logSessionSummary({
                                                    conductor_id: displayName,
                                                    stats: summary.stats,
                                                    total: summary.total,
                                                    notas: notes
                                                });
                                                // XOLVY FIX: Use force=true to ensure all session numbers are released
                                                await releaseUnusedTelefonos(displayName, false, true);
                                                window._phoneSessionActive = false;
                                                showNotification("Sesión finalizada con éxito.", "success");
                                                window.closeModal();
                                                await window.refreshConductorView();
                                            } catch (e) {
                                                console.error("Error finalizing session:", e);
                                                showNotification("Error al finalizar sesión", "error");
                                            }
                                        }, "bg-rose-500");
                                    };
                                }
                            });
                        };
                    }
                };

                bindFinalizar('btn-finalizar-sesion');
                bindFinalizar('btn-finalizar');
                bindFinalizar('btn-finalizar-float');

                // Solicitar Numbers
                const bindSolicitar = (id, count = 30) => {
                    const btn = container.querySelector(`#${id} `);
                    if (btn) {
                        btn.onclick = async () => {
                            try {
                                showNotification(`Liberando sesión previa...`, 'info');
                                // Force release previous unassigned numbers for a fresh 30
                                await releaseUnusedTelefonos(displayName, false, true);

                                showNotification(`Solicitando ${count} números...`, 'info');
                                const result = await solicitarNumeros(count, displayName);
                                if (result > 0) {
                                    window._phoneSessionActive = true;
                                    showNotification(`¡Recibiste ${result} números nuevos!`, 'success');
                                } else {
                                    showNotification("No hay números disponibles en este momento.", "warning");
                                }
                            } catch (err) {
                                console.error("Error requesting phones:", err);
                                showNotification("Error al solicitar números", "error");
                            }
                        };
                    }
                };

                bindSolicitar('btn-solicitar', 30);
                bindSolicitar('btn-solicitar-more-float', 30);

                // Refrescar button
                const btnRefresh = container.querySelector('#btn-refresh');
                if (btnRefresh) {
                    btnRefresh.onclick = () => window.refreshConductorView();
                }
            };

            const refreshAndRenderPhoneTable = async (term = '', status = '') => {
                // Start Xolvy Live Pool for Phones
                if (!currentLivePoolUnsubscribe) {
                    console.log("🚀 [Live Pool] Starting Phone Synchronization...");
                    // Optimized query: Only listen for session-relevant statuses
                    currentLivePoolUnsubscribe = startLivePool("telefonos", [where("estado", "in", ["En Sesión", "Revisita", "Contestaron", "No contestan", "Colgaron", "No llamar", "Suspendido", "Testigo"])], async (allPhones) => {

                        const userEmail = auth.currentUser?.email?.toLowerCase() || '';
                        const userName = normalizeRobust(displayName);

                        const filtered = allPhones.filter(t => {
                            const pub = normalizeRobust(t.publicador_asignado);
                            const asg = normalizeRobust(t.asignado_a);
                            const sol = normalizeRobust(t.solicitado_por);

                            // XOLVY CRITICAL FIX: Match numbers belonging to user or requested by user
                            const isMine = (pub === userName || pub === userEmail) ||
                                (asg === userName || asg === userEmail) ||
                                (sol === userName || sol === userEmail);

                            const cleanTerm = term.replace(/[\s-()]/g, '');
                            const matchesTerm = !term ||
                                (t.numero && t.numero.includes(cleanTerm)) ||
                                (t.nombre && t.nombre.toLowerCase().includes(term)) ||
                                t.direccion?.toLowerCase().includes(term);

                            let matchesStatus = false;
                            if (status) {
                                matchesStatus = t.estado === status;
                            } else {
                                // Keep record visible if it belongs to session (requested by me) 
                                // and has any active status (not just 'En Sesión')
                                matchesStatus = isMine && (t.estado !== 'Sin asignar' || t.solicitado_por);
                            }

                            return matchesTerm && matchesStatus;
                        });

                        // XOLVY FIX: Update the view mode dynamically based on live pool counts AND session state
                        const compactView = container.querySelector('#phone-compact-view');
                        const expandedView = container.querySelector('#phone-expanded-view');
                        const floatingActions = container.querySelector('#phone-floating-actions');


                        if (filtered.length > 0) {
                            window._phoneSessionActive = true;
                            // Track explicitly requested phones for fast release on tab close
                            window._currentSessionPhoneIds = filtered
                                .filter(t => normalizeRobust(t.solicitado_por) === userName || normalizeRobust(t.solicitado_por) === userEmail)
                                .map(t => t.id);

                            compactView?.classList.add('hidden');
                            expandedView?.classList.remove('hidden');
                            floatingActions?.classList.replace('hidden', 'flex');
                        } else {
                            // If no numbers, ensure we show the prompt to request numbers
                            window._phoneSessionActive = false;
                            window._currentSessionPhoneIds = [];
                            compactView?.classList.remove('hidden');
                            expandedView?.classList.add('hidden');
                            floatingActions?.classList.replace('flex', 'hidden');
                        }

                        const publicadores = await getPublicadores();
                        if (mPhone?.initializePhoneModule) {
                            mPhone.initializePhoneModule(filtered, publicadores, displayName, container.querySelector('#phone-tbody'), window.refreshPhoneTableOnly);
                        }
                    });
                }
            };


            // --- XOLVY LIVE POOL: MODULE-WIDE SYNCHRONIZATION ---
            try {
                // 1. System Config Pool
                if (!configLivePoolUnsubscribe) {
                    configLivePoolUnsubscribe = startLivePool("configuracion", [where("__name__", "==", "global_settings")], (data) => {
                        if (data.length > 0) {
                            currentSystemConfig = data[0];
                            console.log("⚙️ [Live Pool] System Config Updated.");
                        }
                    });
                }

                // 2. Territories Pool
                if (!territoriesLivePoolUnsubscribe) {
                    territoriesLivePoolUnsubscribe = startLivePool("territorios", [], (data) => {
                        poolData.territorios = data;
                        console.log("🗺️ [Live Pool] Territory Data Synced.");
                        if (container.querySelector('#agenda-intelligence-badge')) refreshConductorView(true);
                    });
                }

                // 3. Weekly Program Pool (Cronograma)
                const poolWeekId = getSafeDateId(getMonday(new Date()));
                if (!programLivePoolUnsubscribe) {
                    programLivePoolUnsubscribe = startLivePool("programa_semanal", [where("__name__", "==", poolWeekId)], (data) => {
                        if (data.length > 0) {
                            poolData.programa = data[0];
                            console.log("📅 [Live Pool] Weekly Program Updated.");
                            if (container.querySelector('#weekly-program-cards')) {
                                window.refreshConductorView(true);
                            }
                        }
                    });
                }

                const btnShowScript = container.querySelector('#btn-show-script-global');
                if (btnShowScript) {
                    btnShowScript.onclick = () => {
                        const tema = currentSystemConfig?.tema_mes;
                        const content = tema ? `
    <div class="prose dark:prose-invert max-w-none">
        <div class="bg-primary/5 p-6 rounded-3xl border border-primary/20 mb-6">
            <h4 class="text-xs font-black uppercase text-primary tracking-widest mb-3 flex items-center gap-2">
                <i class="fas fa-scroll"></i> Tema de Conversación de la Semana
            </h4>
            <p class="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">${tema}</p>
        </div>
                            </div>
    ` : `
    <div class="text-center py-10">
                                <div class="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-600 text-2xl mx-auto mb-4">
                                    <i class="fas fa-hand-sparkles"></i>
                                </div>
                                <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase mb-2">¡Prepárate para tu ministerio!</h4>
                                <p class="text-xs font-bold text-slate-500 leading-relaxed">No hay un tema específico configurado todavía. Te animamos a prepararte utilizando las ayudas para el ministerio disponibles en JW.org o la Guía de Actividades.</p>
                            </div >
    `;
                        showModal(content, "Tema Sugerido / Guía", "fas fa-scroll", "indigo");
                    };
                }

                // Clean up unassigned/unused numbers from previous sessions for a fresh "Solicitar" experience
                await releaseUnusedTelefonos(displayName);

                // Initial render
                // Removed redundant await refreshConductorView(true) to prevent recursion
                // refreshConductorView is called once at the start and then via LivePool triggers.

                // Initialize AI Assistant
                renderAISection(displayName);

                console.log("🚀 [Conductor] Dashboard sequence continuing...");

                // Initialize Listeners and Data Pools
                setupDashboardListeners();
                refreshAndRenderPhoneTable();

                // Xolvy Adapt: Clean session and release numbers on tab close
                window.addEventListener('beforeunload', () => {
                    if (window._phoneSessionActive && window._currentSessionPhoneIds?.length > 0) {
                        try {
                            releaseTelefonosById(window._currentSessionPhoneIds);
                        } catch (e) { /* background fail safe */ }
                    }
                });

            } catch (livePoolErr) {
                console.error("Error initializing Live Pools:", livePoolErr);
            }
            if (programa && programa.dias) {
                const mondayDate = new Date(currentWeekId + 'T12:00:00Z');
                programa.dias.forEach((d, idx) => {
                    if (!d.fecha) {
                        const dayDate = new Date(mondayDate);
                        dayDate.setDate(dayDate.getDate() + idx);
                        d.fecha = getSafeDateId(dayDate);
                    }
                });

                programa.dias.forEach(d => {
                    turnosArr.forEach(turno => {
                        const tData = d[turno];
                        if (tData && (tData.conductor || tData.auxiliar || tData.lugar)) {
                            const isConductor = tData.conductor?.trim().toLowerCase() === normalizedName;
                            const isAuxiliar = tData.auxiliar?.trim().toLowerCase() === normalizedName;

                            // IMPORTANT: Filter Agenda Semanal to ONLY user's assignments
                            if (!isConductor && !isAuxiliar) return;

                            let assignedTerritoryIds = [];
                            if (tData.territorio) {
                                assignedTerritoryIds = tData.territorio.split(/[,/]+/).map(s => s.trim()).filter(Boolean);
                            }

                            const attachedTerritories = assignedTerritoryIds.map(num => {
                                const t = territoryMap[num] || { numero: num, isMissingData: true };
                                if (t.id) shownTerritoryIds.add(t.id);
                                return t;
                            }).filter(t => {
                                if (t.isMissingData) return false;
                                // Strict check: Territory must still be assigned to the user
                                const matchesConductor = t.asignado_a?.trim().toLowerCase() === normalizedName;
                                const matchesAuxiliar = t.auxiliar?.trim().toLowerCase() === normalizedName;
                                return matchesConductor || matchesAuxiliar;
                            });

                            assignments.push({
                                dia: d.nombre,
                                turno: turno === 'manana' ? '🌅 Mañana' : (turno === 'tarde' ? '☀️ Tarde' : (turno === 'zoom' ? '📹 Zoom' : '🌙 Noche')),
                                role: isConductor ? 'Conductor' : (isAuxiliar ? 'Auxiliar' : 'Otro'),
                                isMember: true,
                                rawDate: d.fecha || 'Fecha no definida',
                                attachedTerritories,
                                ...tData
                            });
                        }
                    });
                });
            }

            // myExtraTerritories will be handled in the Rescue Missions modal as requested by the user
            // to avoid the "EXTRAS" card in the main agenda.


            // Group by Day
            const groupedByDay = {};
            assignments.forEach(a => {
                if (!groupedByDay[a.dia]) {
                    groupedByDay[a.dia] = {
                        dia: a.dia,
                        rawDate: a.rawDate,
                        isMember: a.isMember,
                        shifts: []
                    };
                }
                groupedByDay[a.dia].shifts.push(a);
            });

            const dayCards = Object.values(groupedByDay);
            const dayOrder = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6, 'Extras': 7 };
            dayCards.sort((a, b) => dayOrder[a.dia] - dayOrder[b.dia]);

            const totalActiveTerritories = assignments.reduce((acc, a) => acc + a.attachedTerritories.length, 0);
            const hasShifts = assignments.length > 0;
            const allCompleted = hasShifts && totalActiveTerritories === 0;

            // --- INTELLIGENCE LOGIC ---
            if (intelligenceBadge) {

                // --- FUSION POWER UP: RESCUE MISSIONS LOGIC (48h Atraso) ---
                const now = new Date();
                now.setHours(0, 0, 0, 0);

                const plannedDates = {};
                if (programa && programa.dias && programa.id) {
                    const monday = new Date(programa.id + "T00:00:00");
                    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
                    const shifts = ['manana', 'tarde', 'noche', 'zoom'];
                    programa.dias.forEach(d => {
                        const dayIdx = dayNames.indexOf(d.nombre);
                        if (dayIdx === -1) return;
                        const plD = new Date(monday);
                        plD.setDate(monday.getDate() + dayIdx);
                        plD.setHours(0, 0, 0, 0);
                        shifts.forEach(s => {
                            if (d[s] && d[s].territorio) {
                                const nums = Array.from(new Set(String(d[s].territorio).split(/[,/]+/).map(n => n.trim()).filter(Boolean)));
                                nums.forEach(num => {
                                    if (!plannedDates[num]) plannedDates[num] = new Set();
                                    plannedDates[num].add(plD.getTime());
                                });
                            }
                        });
                    });
                }

                const myExtraMissions = allTerritorios.filter(t => {
                    const matchesUser = t.asignado_a?.trim().toLowerCase() === normalizedName || t.auxiliar?.trim().toLowerCase() === normalizedName;
                    const isOrphan = !shownTerritoryIds.has(t.id);
                    const isActive = t.estado === 'Asignado' || t.estado === 'Pendiente';
                    return matchesUser && isOrphan && isActive;
                });

                const rescueCandidates = allTerritorios.filter(t => {
                    // Priority 1: High delay (Original Rescue logic)
                    const timestamps = plannedDates[t.numero];
                    const isDelayed = timestamps && Array.from(timestamps).some(ts => {
                        const diff = Math.floor((now - new Date(ts)) / (1000 * 60 * 60 * 24));
                        return diff >= 1;
                    });


                    // Priority 2: Free territories (Bolsa de Trabajo)
                    const isFree = t.estado === 'Libre' || t.estado === 'Disponible';

                    // Priority 3: Incomplete markers
                    const isIncomplete = t.is_incomplete === true;

                    return isDelayed || isFree || isIncomplete;
                });

                // Sort: Incomplete territories at the top
                rescueCandidates.sort((a, b) => {
                    if (a.is_incomplete && !b.is_incomplete) return -1;
                    if (!a.is_incomplete && b.is_incomplete) return 1;
                    // Then by number
                    return (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0);
                });

                const rescueCount = rescueCandidates.length;
                const totalMissionCount = rescueCount + myExtraMissions.length;


                if (mRescue?.renderRescueMissions) {
                    mRescue.renderRescueMissions(allTerritorios, normalizedName, myExtraMissions, rescueCandidates, totalMissionCount);
                }

                if (intelligenceBadge) intelligenceBadge.innerHTML = `
                    <div class="flex flex-wrap items-center gap-3">
                        ${hasShifts ? `
                         <button onclick="document.getElementById('details-programa')?.scrollIntoView({ behavior: 'smooth' }); document.getElementById('details-programa') && (document.getElementById('details-programa').open = true);" 
                            class="flex items-center gap-3 bg-indigo-50 dark:bg-white/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/10 py-3.5 px-6 rounded-2xl border text-[10px] font-black uppercase tracking-[0.15em] shadow-sm backdrop-blur-md hover:scale-105 active:scale-95 transition-all">
                            <i class="fas fa-calendar-alt"></i>
                            Programa de Predicación
                        </button>
                        ` : ''}
                        
                        <button onclick="window.showRescueMissionsModal()"
                            class="flex items-center gap-3 ${totalMissionCount > 0 ? 'bg-indigo-600 border-indigo-500/20 shadow-indigo-600/20 text-white' : 'bg-white dark:bg-white/5 text-indigo-500 border-indigo-500/30'} py-3.5 px-6 rounded-2xl border text-[10px] font-black uppercase tracking-[0.15em] shadow-sm backdrop-blur-md hover:scale-105 active:scale-95 transition-all">
                            <i class="fas fa-map-marked-alt ${totalMissionCount > 0 ? 'animate-pulse' : ''}"></i>
                            POR COMPLETAR ${totalMissionCount > 0 ? `<span class="bg-white text-indigo-600 px-2 py-0.5 rounded-lg ml-1 font-black">${totalMissionCount}</span>` : ''}
                        </button>
                    </div>
    `;

            }

            // --- RENDER MAPS GRID ---
            const mapsGrid = document.getElementById('conductor-maps-grid');
            const mapsSearch = document.getElementById('search-explorer-maps');

            const renderMapsExplorer = (filter = '') => {
                if (!mapsGrid) return;

                let territoriesToShow = allTerritorios || [];

                // Filter by search
                if (filter) {
                    const f = filter.toLowerCase();
                    territoriesToShow = territoriesToShow.filter(t =>
                        t.numero?.toString().includes(f) ||
                        t.manzanas?.toLowerCase().includes(f)
                    );
                }

                // Sort by number
                territoriesToShow.sort((a, b) => {
                    const numA = parseInt(a.numero) || 0;
                    const numB = parseInt(b.numero) || 0;
                    return numA - numB;
                });

                if (territoriesToShow.length === 0) {
                    mapsGrid.innerHTML = `
    <div class="col-span-full py-20 text-center space-y-4 opacity-30 group">
                    <div class="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center text-3xl mx-auto group-hover:scale-110 transition-transform">
                        <i class="fas fa-search-location"></i>
                    </div>
                    <p class="font-black text-[10px] uppercase tracking-[0.4em]">Sin resultados</p>
                </div>
    `;
                } else {
                    mapsGrid.innerHTML = territoriesToShow.map(t => `
    <div class="modern-card !p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-primary/40 hover:shadow-xl transition-all group/card cursor-pointer shadow-sm relative overflow-hidden" onclick="window.openInteractiveMapFromDashboard('${t.id}')">
                    <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none"></div>
                    <div class="flex justify-between items-start mb-4 relative z-10">
                        <span class="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-lg uppercase tracking-widest">T-${t.numero}</span>
                        <div class="flex items-center gap-2">
                             <div class="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/10 flex items-center justify-center group-hover/card:bg-primary group-hover/card:text-white transition-all text-slate-400 border border-slate-100 dark:border-white/5">
                                 <i class="fas fa-location-arrow text-[10px]"></i>
                             </div>
                        </div>
                    </div>
                    <h5 class="text-[11px] font-bold text-slate-800 dark:text-gray-200 uppercase tracking-tight leading-relaxed line-clamp-2 relative z-10">${formatManzanas(t.manzanas) || 'Sin sector definido'}</h5>
                </div>
    `).join('');
                }
            };

            if (mapsSearch) {
                mapsSearch.oninput = (e) => renderMapsExplorer(e.target.value);
            }
            renderMapsExplorer();

            window.openInteractiveMapFromDashboard = (tid) => {
                const t = allTerritorios.find(x => x.id === tid);
                if (t && window.openInteractiveMap) window.openInteractiveMap(t, { readOnly: true });
            };

            window.openGlobalMap = (type) => {
                const modal = document.getElementById('modal-container');
                if (!modal) return;
                modal.classList.remove('hidden');

                if (type === 'png') {
                    modal.innerHTML = `
    <div class="w-full h-full max-w-5xl mx-auto flex flex-col p-4 animate-fade-in">
        <div class="flex justify-between items-center mb-4 bg-white/80 dark:bg-[#0f1420]/90 backdrop-blur-2xl p-6 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl">
            <div class="flex items-center gap-5">
                <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-xl text-primary shadow-inner border border-primary/10">
                    <i class="fas fa-image"></i>
                </div>
                <div>
                    <h4 class="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[11px]">Cartografía General</h4>
                    <p class="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Mapa Estático de la Congregación</p>
                </div>
            </div>
            <button onclick="document.getElementById('modal-container').classList.add('hidden'); document.getElementById('modal-container').classList.remove('flex');" class="w-12 h-12 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all flex items-center justify-center text-lg active:scale-95">
                <i class="fas fa-times"></i>
            </button>
        </div>
                    </div>

    <div class="flex-1 overflow-hidden rounded-[2.5rem] bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 flex items-center justify-center relative touch-none shadow-inner" id="png-zoom-container">
        <img id="global-png-map" src="assets/mapa-general.jpg" class="max-w-full max-h-full object-contain transition-all duration-200 ease-out shadow-2xl origin-center" style="transform: scale(1) translate(0px, 0px);">

            <!-- Dynamic Controls -->
            <div class="absolute bottom-10 right-10 flex flex-col gap-3 z-50">
                <button id="btn-global-zoom-in" class="w-12 h-12 rounded-2xl bg-white/95 dark:bg-[#1a1c2a]/95 backdrop-blur shadow-2xl text-primary font-black border border-slate-200 dark:border-white/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
                    <i class="fas fa-plus"></i>
                </button>
                <button id="btn-global-zoom-out" class="w-12 h-12 rounded-2xl bg-white/95 dark:bg-[#1a1c2a]/95 backdrop-blur shadow-2xl text-primary font-black border border-slate-200 dark:border-white/10 flex items-center justify-center hover:scale-110 active:scale-90 transition-all">
                    <i class="fas fa-minus"></i>
                </button>
                <button id="btn-global-zoom-reset" class="w-12 h-12 rounded-2xl bg-primary text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all group">
                    <i class="fas fa-undo-alt group-hover:rotate-[-45deg] transition-transform"></i>
                </button>
            </div>
    </div>
                </div >
    `;
                    // Initialize Pan and Zoom logic
                    modal.classList.add('flex');
                    setTimeout(() => {
                        panZoomController = UIHelpers.initImagePanZoom('global-png-map', 'png-zoom-container');
                        if (panZoomController) {
                            modal.querySelector('#btn-global-zoom-in').onclick = () => panZoomController.zoom(0.3);
                            modal.querySelector('#btn-global-zoom-out').onclick = () => panZoomController.zoom(-0.3);
                            modal.querySelector('#btn-global-zoom-reset').onclick = () => panZoomController.reset();
                        }
                    }, 100);
                } else if (type === 'satellite') {
                    modal.innerHTML = '<div id="global-map-root" class="w-full h-full max-w-6xl mx-auto p-4 md:p-10"></div>';
                    MapViewer.renderGlobal(document.getElementById('global-map-root'), allTerritorios);
                }
            };

            let panZoomController = null;




            if (!hasShifts) {
                if (agendaContainer) agendaContainer.innerHTML = `
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
                    <button onclick="document.getElementById('details-programa')?.scrollIntoView({ behavior: 'smooth' }); document.getElementById('details-programa') && (document.getElementById('details-programa').open = true);" class="mt-8 px-10 py-5 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/30 hover:bg-primary-dark hover:scale-105 active:scale-95 transition-all flex items-center gap-3 mx-auto">
                        <i class="fas fa-calendar-alt text-base"></i> 
                        Consultar programa de predicación
                    </button>
            </div>
        </div>
    </div>
    `;
            } else if (allCompleted) {
                if (agendaContainer) agendaContainer.innerHTML = `
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
                if (agendaContainer) agendaContainer.innerHTML = dayCards.map(dayData => `
    <div class="group relative modern-card !p-5 sm:!p-7 transition-all duration-500 hover:shadow-2xl flex flex-col gap-6 shadow-sm border-slate-100 dark:border-white/[0.05] bg-white dark:bg-[#0f1420]/70 backdrop-blur-xl">
                <div class="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none"></div>
                <!-- Header Card -->
                <div class="flex justify-between items-center border-b border-slate-100 dark:border-white/10 pb-5 relative z-10">
                    <div>
                        <h3 class="font-black text-2xl text-slate-800 dark:text-white tracking-tighter uppercase leading-none mb-1.5 group-hover:text-primary transition-colors">${dayData.dia}</h3> 
                        <span class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] block opacity-80">${dayData.rawDate}</span>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-white/20 shadow-inner group-hover:rotate-6 transition-transform">
                        <i class="fas fa-calendar-check text-xl"></i>
                    </div>
                </div>

                <div class="flex flex-col flex-1 gap-6">
                    ${dayData.shifts.map((a, shiftIdx) => `
                        <div class="shift-block space-y-4 animate-fade-in" style="animation-delay: ${shiftIdx * 100}ms">
                            <!-- Badge de Turno -->
                            <div class="flex items-center gap-2">
                                 <span class="w-1.5 h-1.5 rounded-full ${a.turno.includes('Mañana') ? 'bg-orange-400' : 'bg-indigo-500'}"></span>
                                 <h4 class="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em]">${a.turno}</h4>
                            </div>

                            <!-- Staff & Location Minimal -->
                            <div class="space-y-4 relative z-10">
                                <div class="grid grid-cols-2 gap-4 px-1">
                                    <div class="space-y-0.5 text-left border-l-2 border-primary/20 pl-3">
                                        <p class="text-[7px] font-black text-slate-400 uppercase tracking-widest opacity-60">Conductor</p>
                                        <p class="text-[10px] font-black ${a.conductor?.trim().toLowerCase() === normalizedName ? 'text-primary' : 'text-slate-700 dark:text-slate-100'} leading-none">${a.conductor || '---'}</p>
                                    </div>
                                    <div class="space-y-0.5 text-left border-l-2 border-white/10 pl-3">
                                        <p class="text-[7px] font-black text-slate-400 uppercase tracking-widest opacity-60">Auxiliar</p>
                                        <p class="text-[10px] font-black ${a.auxiliar?.trim().toLowerCase() === normalizedName ? 'text-primary' : 'text-slate-700 dark:text-slate-100'} leading-none">${a.auxiliar || '---'}</p>
                                    </div>
                                </div>

                                <div class="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 shadow-inner transition-colors group-hover:bg-primary/5">
                                    <i class="fas fa-map-marker-alt text-primary text-[10px] animate-bounce-subtle"></i>
                                    <div class="min-w-0">
                                        <p class="text-[10px] font-black text-slate-600 dark:text-slate-100 uppercase tracking-tight truncate">${a.lugar || 'Por definir'}</p>
                                    </div>
                                </div>
                            </div>

                            ${a.attachedTerritories.length > 0 ? `
                            <div class="space-y-4">
                                 <!-- Listado de Territorios Ultra-Slim -->
                                 <div class="px-1 space-y-3">
                                    ${a.attachedTerritories.map(t => `
                                        <div class="flex items-start gap-3 group/titem">
                                            <div class="mt-0.5 flex flex-col items-center">
                                                <span class="text-[12px] font-black text-slate-800 dark:text-white tracking-widest">T${t.numero}</span>
                                                <div class="w-3 h-0.5 bg-primary/20 rounded-full mt-0.5"></div>
                                            </div>
                                            <div class="flex-1 pt-0.5">
                                                <p class="text-[9px] font-bold text-slate-400 dark:text-slate-500 leading-snug uppercase tracking-tight line-clamp-2">${formatManzanas(t.manzanas) || '-'}</p>
                                            </div>
                                        </div>
                                    `).join('')}
                                 </div>
                                
                                 ${conductorData?.privilegios?.includes('Superintendente de Circuito') ? '' : `
                                 <div class="mt-auto pt-4 relative z-10">
                                    <button class="territory-report-btn w-full bg-slate-900 dark:bg-emerald-600 hover:bg-black dark:hover:bg-emerald-500 py-4 rounded-2xl text-white font-black text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.3em] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 group/btn"
                                        data-ids="${a.attachedTerritories.map(t => t.id).join(',')}" 
                                        data-nums="${a.attachedTerritories.map(t => t.numero).join(',')}">
                                        <i class="fas fa-file-signature text-[12px] opacity-70 group-hover/btn:rotate-12 transition-transform"></i>
                                        Informar Actividad
                                    </button>
                                 </div>
                                 `}
                            </div>` : `
                            <div class="px-5 py-6 bg-slate-50 dark:bg-white/[0.03] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 animate-fade-in group/empty-shift shadow-inner relative overflow-hidden text-center">
                                <div class="absolute inset-0 bg-primary/5 opacity-0 group-hover/empty-shift:opacity-100 transition-opacity pointer-events-none"></div>
                                <div class="flex flex-col items-center gap-3 relative z-10">
                                    <div class="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary text-lg shadow-sm group-hover/empty-shift:scale-110 transition-transform duration-500">
                                        <i class="fas fa-bullhorn"></i>
                                    </div>
                                    <div>
                                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 opacity-60">Actividad Planeada</p>
                                        <p class="text-[14px] font-black text-primary uppercase tracking-tight">${a.faceta || 'Predicación General'}</p>
                                    </div>
                                </div>
                            </div>
                            `}
                            
                            ${shiftIdx < dayData.shifts.length - 1 ? '<div class="h-px bg-slate-50 dark:bg-white/5 my-2"></div>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
    `).join('');
            }


            // Final UI Setup
            setTimeout(() => {
                const btnsReport = agendaContainer.querySelectorAll('.territory-report-btn');
                btnsReport.forEach(btn => {
                    btn.onclick = () => {
                        const ids = btn.dataset.ids.split(',');
                        window.openProgressModal(ids[0], ids);
                    };
                });

                const btnsHistory = agendaContainer.querySelectorAll('.territory-history-btn');
                btnsHistory.forEach(btn => {
                    btn.onclick = () => {
                        const tid = btn.dataset.tid;
                        const tnum = btn.dataset.tnum;
                        window.showUnifiedTerritoryHistory(tid, tnum);
                    };
                });
                // Setup Swipe Actions
                initSwipeActions();
            }, 0);

            if (userMods.disponibilidad !== false) {
                mAvail.renderAvailabilitySection(document.getElementById('availability-container'), name);
            }
            if (userMods.cerebro !== false) {
                renderAISection(name);
            }
            if (userMods.ayudas !== false) {
                mRec.renderRecursosSection(document.getElementById('recursos-container'));
            }

            if (userMods.mapas !== false) {
                mMaps.renderMapsExplorer(container, allTerritorios, (t) => window.openInteractiveMap(t));
            }

            // Module: Programa Semanal (Global)
            if (userMods.programa !== false && mProg.initializeWeeklyProgram) {
                mProg.initializeWeeklyProgram(container, userMods, allTerritorios, territoryMap, name, currentWeekStart, activeDayIndex, activeTurns);
            }

            window.openTerritorySelector = (dayIndex, turnId, btnElement) => {
                if (!btnElement || !window._globalPrograma) return;

                // Extract all territories already in this week's program to highlight them
                const weekAssignments = [];
                if (window._globalPrograma.dias) {
                    window._globalPrograma.dias.forEach(d => {
                        ['manana', 'tarde', 'noche', 'zoom'].forEach(turn => {
                            const tStr = d[turn]?.territorio;
                            if (tStr) {
                                const parts = tStr.split(/[,;/]+/).map(p => p.trim()).filter(Boolean);
                                parts.forEach(p => {
                                    const num = p.replace(/\(.*\)/, '').trim();
                                    if (num) weekAssignments.push(num);
                                });
                            }
                        });
                    });
                }

                const currentVal = btnElement.dataset.current;
                window.showTerritorySelectionModal(currentVal, window._globalTerritorios, (newValue) => {
                    if (!window._globalPrograma.dias[dayIndex][turnId]) window._globalPrograma.dias[dayIndex][turnId] = {};
                    window._globalPrograma.dias[dayIndex][turnId].territorio = newValue;
                    btnElement.dataset.current = newValue;

                    // Update display inside the button
                    const span = btnElement.querySelector('span.truncate');
                    if (span) {
                        span.textContent = newValue || '—';
                        span.className = `text - [10px] font - black truncate ${newValue ? 'text-primary' : 'text-slate-400 opacity-40'} `;
                    }

                    // Trigger save and sync
                    window.updateWeekData(dayIndex, turnId, 'territorio', newValue);
                }, 'modal-container', null, weekAssignments); // Pass weekAssignments as 6th param
            };

            window.updateWeekData = async (dayIndex, turnoId, field, value) => {
                if (!window._globalPrograma) return;
                if (!window._globalPrograma.dias[dayIndex][turnoId]) window._globalPrograma.dias[dayIndex][turnoId] = {};
                window._globalPrograma.dias[dayIndex][turnoId][field] = value;

                try {
                    const weekId = window._globalPrograma.id;
                    await saveProgramaSemanal(weekId, window._globalPrograma);
                    const tData = window._globalPrograma.dias[dayIndex][turnoId];
                    const diaObj = window._globalPrograma.dias[dayIndex];
                    const dateISO = new Date(diaObj.fecha + 'T12:00:00Z').toISOString();
                    await syncSlotWithTerritories(weekId, dayIndex, turnoId, tData, dateISO);

                    // Refresh local territory memory to ensure labels update correctly
                    const freshTerritories = await getTerritorios();
                    window._globalTerritorios = freshTerritories;

                    // Re-render the program table to show synced states immediately
                    const programCardsContainer = container.querySelector('#weekly-program-cards');
                    if (programCardsContainer && mProg.renderFullProgramaCards) {
                        mProg.renderFullProgramaCards(window._globalPrograma, programCardsContainer, territoryMap, name, activeDayIndex, activeTurns);
                    }

                    showNotification("Asignación sincronizada exitosamente", "success");
                } catch (e) {
                    console.error("Update error:", e);
                    showNotification("Error al guardar revisión", "error");
                }
            };
        } catch (err) {
            console.error("Critical error in loadUnifiedDashboard:", err);
        }
    }











    // Final Startup
    refreshConductorView();

    // XOLVY CRITICAL: Auto-cleanup session on window closure
    window.addEventListener('beforeunload', () => {
        if (displayName) {
            releaseUnusedTelefonos(displayName, false, true);
        }
    });
};
