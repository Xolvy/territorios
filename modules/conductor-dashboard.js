import { auth } from '../firebase-config.js?v=3.2.0';
import {
    getTerritorios, getConductores, getPublicadores, getTelefonos, updateTelefono,
    getRecursos, getConfiguracion,
    getPredicacionPublica, savePredicacionPublica,
    getProgramaSemanal, getTerritoryHistory,
    addPublicador, updatePublicador, deletePublicador // Added for management within dashboard
} from '../data/firestore-services.js?v=3.2.0';
import { formatPhoneNumber, getStatusColor, showNotification, formatMapUrl } from './utils/helpers.js?v=3.2.0';
import { TerritoryIntelligence } from './utils/intelligence.js?v=3.2.0';
import { MapViewer } from './map-viewer.js?v=3.2.0';



// --- UI HELPERS ---

// --- REUSE INTERACTIVE MAP ---
window.viewMapFromReport = async (id) => {
    // Show spinner in button if we could, but let's just fetch
    showNotification("Cargando mapa interactivo...", "info");
    const territories = await getTerritorios();
    const t = territories.find(x => x.id === id);
    if (t) {
        window.openInteractiveMap(t);
    } else {
        showNotification("No se encontró la data del territorio para el mapa.", "error");
    }
};

const showModal = (content, onOpen, maxWidth = 'max-w-md') => {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const handleEsc = (e) => {
        if (e.key === 'Escape') closeModal();
    };

    const closeModal = () => {
        modalContainer.classList.add('hidden');
        modalContainer.innerHTML = '';
        window.removeEventListener('keydown', handleEsc);
    };

    modalContainer.innerHTML = `
        <div class="w-full ${maxWidth} relative animate-slide-up bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl flex flex-col rounded-[3rem] shadow-[0_40px_100px_-20px_hsla(var(--glass-shadow))] max-h-[92vh] border border-white/20 dark:border-white/5 overflow-hidden m-4">
            <button class="absolute top-6 right-6 text-slate-400 hover:text-teal-500 z-[60] p-2 bg-slate-100 dark:bg-slate-800 rounded-full transition-all border border-transparent hover:border-teal-500/30 group shadow-md" 
                    id="modal-close-btn">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col px-8 py-10">
                ${content}
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');

    const closeBtn = modalContainer.querySelector('#modal-close-btn');
    if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closeModal(); };

    modalContainer.onclick = (e) => { if (e.target === modalContainer) closeModal(); };

    window.addEventListener('keydown', handleEsc);

    if (onOpen) onOpen(modalContainer);
};

const showCustomAlert = (message) => {
    if (!message) return;
    const type = message.toLowerCase().includes('error') ? 'error' : 'success';
    showNotification(message, type);
};
window.showCustomAlert = showCustomAlert;

const showCustomConfirm = (message, onConfirm) => {
    showModal(`
        <div class="space-y-8 py-4">
            <div class="flex flex-col items-center text-center space-y-5">
                <div class="w-20 h-20 bg-amber-500/10 dark:bg-amber-500/20 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner border border-amber-500/20 animate-bounce">❓</div>
                <div class="space-y-2">
                    <h3 class="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight px-4">${message}</h3>
                    <p class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest">Confirmación Requerida</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <button id="confirm-cancel" class="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all active:scale-95">Regresar</button>
                <button id="confirm-ok" class="p-4 rounded-2xl bg-teal-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-teal-500 shadow-xl shadow-teal-500/30 transition-all active:scale-95">SÍ, PROCEDER</button>
            </div>
        </div>
    `, (modal) => {
        modal.querySelector('#confirm-cancel').onclick = () => modal.classList.add('hidden');
        modal.querySelector('#confirm-ok').onclick = () => {
            modal.classList.add('hidden');
            onConfirm();
        };
    });
};
window.showCustomConfirm = showCustomConfirm;

const showCustomPrompt = (message, defaultValue, onConfirm) => {
    showModal(`
        <div class="space-y-8 py-4">
            <div class="space-y-5">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 bg-teal-500/10 dark:bg-teal-500/20 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-teal-500/20">🖊️</div>
                    <div class="space-y-1">
                        <h3 class="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">${message}</h3>
                        <p class="text-[10px] text-teal-600 text-teal-400 uppercase font-black tracking-widest">Ingresa la información</p>
                    </div>
                </div>
                <div class="space-y-2">
                    <label class="label-premium">Respuesta Requerida</label>
                    <input type="text" id="prompt-input" value="${defaultValue || ''}" class="input-premium" placeholder="Escribe aquí...">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <button id="prompt-cancel" class="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all active:scale-95">Cancelar</button>
                <button id="prompt-ok" class="p-4 rounded-2xl bg-teal-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-teal-500 shadow-xl shadow-teal-500/30 transition-all active:scale-95">CONFIRMAR</button>
            </div>
        </div>
    `, (modal) => {
        const input = modal.querySelector('#prompt-input');
        input.focus();
        input.select();
        modal.querySelector('#prompt-cancel').onclick = () => modal.classList.add('hidden');
        modal.querySelector('#prompt-ok').onclick = () => {
            const val = input.value.trim();
            if (val) {
                modal.classList.add('hidden');
                onConfirm(val);
            }
        };
    });
};
window.showCustomPrompt = showCustomPrompt;

export const renderConductorDashboard = async (container, nameOrEmail) => {
    let displayName = nameOrEmail;
    let conductorData = null;
    try {
        const allC = await getConductores();
        conductorData = allC.find(c => c.email === nameOrEmail || c.nombre === nameOrEmail || (c.telefono && c.telefono.replace(/\s+/g, '') === nameOrEmail.replace(/\s+/g, '')));
        if (conductorData) displayName = conductorData.nombre;
    } catch (err) {
        console.error("Error resolving name:", err);
    }

    // Default modules if not set (legacy or unconfigured)
    const mods = conductorData?.modulos || { agenda: true, dashboard: true, programa: true, telefonos: true, rescue: false };
    const hasAgenda = mods.agenda !== false && mods.dashboard !== false; // support legacy key


    container.innerHTML = `
        <div class="animate-fade-in pb-24 w-full max-w-7xl mx-auto p-4 md:p-8">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 px-8 py-6 glass-morphism border border-white/20 dark:border-white/10 rounded-[2.5rem] shadow-2xl gap-6">
                <div class="flex items-center gap-5">
                    <div class="w-16 h-16 bg-gradient-to-br from-teal-500 to-indigo-600 rounded-3xl flex items-center justify-center text-3xl shadow-2xl shadow-teal-500/30 rotate-3 hover:rotate-0 transition-transform duration-500 animate-float">👤</div>
                    <div class="space-y-1">
                        <h1 class="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Hola, ${displayName.split(' ')[0]}</h1>
                        <p class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-[0.2em] flex items-center gap-2">
                           <span class="relative flex h-2 w-2">
                              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                              <span class="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                           </span> Panel Conductor PRO
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-3 w-full md:w-auto">
                    <button onclick="window.startOnboarding()" class="flex-1 md:flex-none bg-slate-100/50 hover:bg-white text-slate-600 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:text-slate-400 px-6 py-3 rounded-2xl border border-white/10 transition-all font-bold text-xs flex items-center justify-center gap-2">
                        <span>❔</span> Ayuda
                    </button>
                    <button id="logout-btn" class="flex-1 md:flex-none bg-slate-100/50 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-800/50 dark:hover:bg-red-500/10 dark:text-slate-400 dark:hover:text-red-400 px-6 py-3 rounded-2xl border border-white/10 transition-all font-bold text-xs flex items-center justify-center gap-2">
                        Cerrar Sesión
                    </button>
                </div>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Module: Agenda Semanal (Personal) -->
                <div class="lg:col-span-2 ${hasAgenda ? '' : 'hidden'}">
                    <div class="flex items-center justify-between mb-5 px-4">
                        <h3 class="text-xs font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
                           <span class="w-8 h-[1px] bg-gray-300 dark:bg-white/10"></span>
                           Agenda Semanal (Mis Asignaciones)
                        </h3>
                    </div>
                    <div id="calendar-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div class="skeleton-pro h-32"></div>
                    </div>
                </div>

                <!-- Module: Programa Semanal (Global Cards) -->
                <div class="lg:col-span-2 ${mods.programa !== false ? '' : 'hidden'}">
                    <div class="flex items-center justify-between mb-5 px-4">
                        <h3 class="text-xs font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
                           <span class="w-8 h-[1px] bg-gray-300 dark:bg-white/10"></span>
                           Programa Semanal
                        </h3>
                    </div>
                    <div id="weekly-program-cards" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-2">
                         <div class="skeleton-pro h-24"></div>
                    </div>
                </div>

                <!-- Module: Dashboard (Territorios) -->
                <div class="lg:col-span-2 ${mods.dashboard !== false ? '' : 'hidden'}">
                    <h3 class="text-lg font-bold text-teal-800 dark:text-teal-100 mb-3 px-2 flex items-center gap-2">
                        🗺️ Mis Territorios
                    </h3>
                    <div id="territorios-container" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                         <div class="animate-pulse bg-black/5 dark:bg-white/5 h-48 rounded-xl"></div>
                    </div>
                    <p id="no-territories-msg" class="hidden text-center text-gray-500 dark:text-gray-400 py-8 bg-black/20 rounded-xl border border-white/5 mt-2">
                        No tienes territorios asignados actualmente.
                    </p>
                </div>

                <div class="lg:col-span-2" id="availability-container">
                </div>

                <!-- Module: Telefonos -->
                <div class="lg:col-span-2 morphinglass-card p-6 md:p-8 ${mods.telefonos !== false ? '' : 'hidden'} border-teal-500/10 dark:border-teal-500/5">
                    <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                        <div>
                            <h3 class="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                                <span class="text-teal-500">📞</span> Predicación Telefónica
                            </h3>
                            <div id="phone-progress-info" class="mt-2"></div>
                        </div>
                        <div class="flex flex-wrap gap-2.5 w-full xl:w-auto">
                            <button id="btn-revisitas" class="flex-1 md:flex-none btn-pro text-[10px] uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-4 py-3 rounded-xl hover:bg-amber-500/20">
                                ↺ Revisitas
                            </button>
                            <button id="btn-add-publicador" class="flex-1 md:flex-none btn-pro text-[10px] uppercase tracking-widest bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 px-4 py-3 rounded-xl hover:bg-teal-500/20">
                                + Publicador
                            </button>
                            <button id="btn-zoom" onclick="window.open('https://us02web.zoom.us/j/88366543094?pwd=Z2x4Qjdnck4rSjh2Q2llbXZFaTNiUT09', '_blank')" class="flex-1 md:flex-none btn-pro text-[10px] uppercase tracking-widest bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-500 shadow-xl shadow-blue-500/20">
                                🎥 ZOOM
                            </button>
                            <button id="btn-solicitar" class="flex-1 md:flex-none btn-pro text-[10px] uppercase tracking-widest bg-teal-600 text-white px-5 py-3 rounded-xl hover:bg-teal-500 shadow-xl shadow-teal-500/20">
                                + SOLICITAR
                            </button>
                        </div>
                    </div>

                    <!-- Search & Filters -->
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 p-2">
                        <div class="md:col-span-8 relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input type="text" id="search-phone" placeholder="Buscar por número o propietario..." 
                                class="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800 dark:text-white focus:border-teal-500 outline-none transition-all">
                        </div>
                        <div class="md:col-span-4">
                            <select id="filter-phone-status" class="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:border-teal-500 outline-none">
                                <option value="">Todos los estados</option>
                                <option value="Contestaron">Contestaron</option>
                                <option value="No contestan">No contestan</option>
                                <option value="Colgaron">Colgaron</option>
                                <option value="Revisita">Revisita</option>
                                <option value="No llamar">No llamar</option>
                                <option value="Sin asignar">Sin asignar</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="responsive-table-container rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-md">
                        <table class="w-full text-left text-xs">
                            <thead class="bg-gray-100/50 dark:bg-white/5 border-b border-black/5 dark:border-white/5 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                                <tr>
                                    <th class="p-4">Teléfono</th>
                                    <th class="p-4">Propietario</th>
                                    <th class="p-4">Dirección</th>
                                    <th class="p-4">Publicador</th>
                                    <th class="p-4 text-center">Estado de Llamada</th>
                                    <th class="p-4">Observaciones</th>
                                </tr>
                            </thead>
                            <tbody id="phone-tbody" class="divide-y divide-black/5 dark:divide-white/5">
                                <!-- Registros dinámicos -->
                            </tbody>
                        </table>
                    </div>

                    <div id="phone-actions" class="mt-6 flex flex-col md:flex-row justify-center items-center gap-4 p-4">
                         <button id="btn-finalizar-sesion" class="hidden bg-red-600 hover:bg-red-500 text-white px-10 py-4 rounded-2xl font-black shadow-2xl shadow-red-500/30 transform hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                            🏁 FINALIZAR PREDICACIÓN
                         </button>
                         <button id="btn-solicitar-more" class="hidden bg-teal-600 hover:bg-teal-500 text-white px-10 py-4 rounded-2xl font-black shadow-2xl shadow-teal-500/30 transform hover:scale-105 active:scale-95 transition-all flex items-center gap-3 border-2 border-white/10">
                            ➕ SOLICITAR MÁS
                         </button>
                    </div>
                </div>

                <div class="lg:col-span-2 ${mods.rescue ? '' : 'hidden'}" id="ayudas-container"></div>
            </div>
        </div>
        
    <div id="modal-container" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden overflow-y-auto z-50 p-4 md:p-10 flex justify-center items-start"></div>
`;

    document.getElementById('logout-btn').addEventListener('click', async () => {
        localStorage.removeItem('demo_role');
        localStorage.removeItem('user_email');
        await auth.signOut();
        // window.location.reload(); // Not strictly necessary if auth state change handles it, but good for clean slate
    });

    // Helper for Phones
    const refreshPhones = async () => {
        const allPhones = await getTelefonos();
        return allPhones.filter(t =>
            t.solicitado_por === displayName ||
            t.publicador_asignado === displayName ||
            t.asignado_a === displayName
        );
    };

    // Expose refresh function/trigger
    window.refreshConductorView = async () => {
        try {
            const config = await getConfiguracion();
            const allC = await getConductores();
            const conductorData = allC.find(c => c.nombre === displayName);
            const userMods = conductorData?.modulos || { agenda: true, dashboard: true, programa: true, telefonos: true, rescue: false };

            await loadUnifiedDashboard(displayName, document.getElementById('calendar-container'), document.getElementById('territorios-container'), userMods, config);
            const myPhones = await refreshPhones();
            const publicadores = await getPublicadores();
            initializePhoneModule(myPhones, publicadores, displayName, document.getElementById('phone-tbody'), refreshPhones);
        } catch (e) { console.error("Refresh error", e); }
    };

    try {
        // Clean up unassigned/unused numbers from previous sessions for a fresh "Solicitar" experience
        await releaseUnusedTelefonos(displayName);
        await window.refreshConductorView();
    } catch (e) {
        console.error("Error loading phones:", e);
    }
};

const loadUnifiedDashboard = async (name, agendaContainer, territoriosContainer, userMods, config) => {
    // Hide separate territories container as requested ("fusionar")
    if (territoriosContainer) {
        const parent = territoriosContainer.parentElement;
        if (parent) parent.style.display = 'none';
    }

    /* --- Onboarding Logic --- */
    window.startOnboarding = () => {
        const steps = [
            { title: '📅 Agenda Semanal', msg: 'Aquí verás tus turnos de predicación y las tarjetas de territorio asignadas para cada día.' },
            { title: '📞 Predicación Telefónica', msg: 'Solicita números y gestiona las llamadas de tu grupo desde aquí.' },
            { title: '🧰 Recursos', msg: 'Accede a enlaces útiles, mapas y material de referencia rápido.' }
        ];

        let stepIndex = 0;
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-6';

        const showStep = () => {
            const s = steps[stepIndex];
            overlay.innerHTML = `
                <div class="glass-morphism p-10 rounded-[3rem] border border-white/20 max-w-sm w-full animate-slide-up text-center shadow-2xl">
                    <div class="text-5xl mb-6">🚀</div>
                    <h3 class="text-2xl font-black text-white mb-3 tracking-tight">${s.title}</h3>
                    <p class="text-slate-300 mb-8 font-medium leading-relaxed">${s.msg}</p>
                    <div class="flex gap-4">
                        <button id="skip-guide" class="flex-1 py-3 text-slate-400 font-bold text-sm uppercase">Saltar</button>
                        <button id="next-guide" class="flex-[2] py-4 bg-teal-500 text-white rounded-2xl font-black shadow-lg shadow-teal-500/30 hover:scale-105 transition-transform">
                            ${stepIndex === steps.length - 1 ? '¡Entendido!' : 'Siguiente'}
                        </button>
                    </div>
                </div>
            `;
            overlay.querySelector('#next-guide').onclick = () => {
                stepIndex++;
                if (stepIndex >= steps.length) overlay.remove();
                else showStep();
            };
            overlay.querySelector('#skip-guide').onclick = () => overlay.remove();
        };

        document.body.appendChild(overlay);
        showStep();
    };

    const getMonday = (d) => {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    };

    const getSafeDateId = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const currentWeekId = getSafeDateId(getMonday(new Date()));

    const [programa, allTerritorios] = await Promise.all([
        getProgramaSemanal(currentWeekId),
        getTerritorios()
    ]);

    const territoryMap = {};
    if (allTerritorios) allTerritorios.forEach(t => territoryMap[t.numero] = t);

    const turnosArr = ['manana', 'tarde', 'noche'];
    const assignments = [];

    if (programa && programa.dias) {
        programa.dias.forEach(d => {
            turnosArr.forEach(turno => {
                const tData = d[turno];
                if (tData && (tData.conductor || tData.auxiliar || tData.lugar)) {
                    const isConductor = tData.conductor === name;
                    const isAuxiliar = tData.auxiliar === name;

                    // IMPORTANT: Filter Agenda Semanal to ONLY user's assignments
                    if (!isConductor && !isAuxiliar) return;

                    let assignedTerritoryIds = [];
                    if (tData.territorio) {
                        assignedTerritoryIds = tData.territorio.split(',').map(s => s.trim());
                    }

                    const attachedTerritories = assignedTerritoryIds.map(num => {
                        return territoryMap[num] || { numero: num, isMissingData: true };
                    }).filter(t => t.isMissingData || t.asignado_a === name || t.auxiliar === name);

                    assignments.push({
                        dia: d.nombre,
                        turno: turno === 'manana' ? '🌅 Mañana' : (turno === 'tarde' ? '☀️ Tarde' : '🌙 Noche'),
                        role: isConductor ? 'Conductor' : (isAuxiliar ? 'Auxiliar' : 'Otro'),
                        isMember: true,
                        rawDate: d.fecha,
                        attachedTerritories,
                        ...tData
                    });
                }
            });
        });
    }

    const dayOrder = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6 };
    assignments.sort((a, b) => {
        if (a.isMember && !b.isMember) return -1;
        if (!a.isMember && b.isMember) return 1;
        return dayOrder[a.dia] - dayOrder[b.dia];
    });

    agendaContainer.innerHTML = assignments.length > 0 ? assignments.map(a => `
        <div class="group relative overflow-hidden glass-morphism p-8 rounded-[3rem] border border-white/20 dark:border-white/5 transition-all duration-500 hover:scale-[1.02] flex flex-col gap-6 shadow-xl ${a.isMember ? 'shadow-teal-500/5' : 'opacity-60 grayscale scale-95'}">
            <div class="flex justify-between items-start gap-4">
                <div class="space-y-1">
                    <h3 class="font-black text-2xl text-slate-900 dark:text-white group-hover:text-teal-500 transition-colors tracking-tight">${a.dia}</h3> 
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                        <span class="text-teal-600 dark:text-teal-400 font-bold text-[10px] uppercase tracking-widest">${a.turno}</span>
                    </div>
                </div>
                ${a.isMember ? `
                <div class="flex flex-col items-end gap-2">
                    <span class="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-teal-500 text-white shadow-lg shadow-teal-500/20">
                        ${a.role}
                    </span>
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter shrink-0">${a.rawDate}</span>
                </div>` : `
                <span class="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-400">Grupo Externo</span>
                `}
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                <div class="p-4 rounded-[2rem] bg-slate-50 dark:bg-slate-900/50 space-y-1 border border-transparent hover:border-teal-500/20 transition-colors">
                    <p class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Conductor</p>
                    <p class="text-xs font-bold ${a.conductor === name ? 'text-teal-600' : 'text-slate-700 dark:text-slate-200'} truncate">${a.conductor || '---'}</p>
                </div>
                <div class="p-4 rounded-[2rem] bg-slate-50 dark:bg-slate-900/50 space-y-1 border border-transparent hover:border-teal-500/20 transition-colors">
                    <p class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Auxiliar</p>
                    <p class="text-xs font-bold ${a.auxiliar === name ? 'text-teal-600' : 'text-slate-700 dark:text-slate-200'} truncate">${a.auxiliar || '---'}</p>
                </div>
            </div>

            <div class="p-5 rounded-[2rem] bg-teal-500/5 border border-teal-500/10 flex items-center gap-4">
                <div class="w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-xl shadow-sm">📍</div>
                <div class="min-w-0">
                    <p class="text-[9px] font-black text-teal-600 uppercase tracking-widest">Punto de Reunión</p>
                    <p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">${a.lugar || 'Por definir'}</p>
                </div>
            </div>

            ${a.attachedTerritories.length > 0 ? `
            <div class="space-y-3 mt-2">
                ${a.attachedTerritories.map(t => {
        const insightId = `ai-look-${a.rawDate}-${a.turno}-${t.numero}`.replace(/\s+/g, '-');
        return `
                    <div class="bg-slate-950 p-4 rounded-[2rem] border border-white/5 shadow-inner">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                            <span class="text-[9px] font-black text-teal-400 uppercase tracking-widest">Quick Look IA / T-${t.numero}</span>
                        </div>
                        <p id="${insightId}" class="text-[10px] text-slate-400 italic">Analizando historial... 🤖</p>
                    </div>
                    
                    <button class="w-full p-5 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-white/5 flex items-center justify-between shadow-sm hover:border-teal-500/50 transition-all active:scale-95 territory-card-swipe"
                        data-id="${t.id}" data-num="${t.numero}" data-manzanas="${t.manzanas || ''}" data-coords='${JSON.stringify(t.coordenadas || null)}'>
                        <div class="flex items-center gap-5">
                            <div class="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center text-teal-600 font-black text-lg">${t.numero}</div>
                            <div class="text-left">
                                <p class="text-xs font-black text-slate-800 dark:text-white">Reportar Avance</p>
                                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">${t.manzanas || 'Mz. Generales'}</p>
                            </div>
                        </div>
                        <div class="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400 transition-transform group-hover:translate-x-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"/></svg>
                        </div>
                    </button>
                    `;
    }).join('')}
            </div>` : ''}

            ${a.isMember ? '<div class="absolute inset-x-0 -bottom-px h-1 bg-gradient-to-r from-transparent via-teal-500 to-transparent blur-sm"></div>' : ''}
        </div>
    `).join('') : '<div class="col-span-full py-20 glass-morphism rounded-[3rem] text-center"><p class="text-slate-400 font-bold">No hay asignaciones registradas para esta semana.</p></div>';

    // AI Analysis Trigger
    const brain = new TerritoryIntelligence(null, null, allTerritorios, programa);
    assignments.forEach(async a => {
        if (!a.isMember) return;
        for (const t of a.attachedTerritories) {
            if (t.isMissingData) continue;
            const insightId = `ai-look-${a.rawDate}-${a.turno}-${t.numero}`.replace(/\s+/g, '-');
            const el = document.getElementById(insightId);
            if (!el) continue;

            try {
                const history = await getTerritoryHistory(t.id);
                const insight = await brain.getTerritoryQuickLook(t, history, (await getConfiguracion()).gemini_key);
                el.innerText = insight;
            } catch (e) {
                el.innerText = "Revisar notas de la última salida.";
            }
        }
    });

    // Final UI Setup
    setTimeout(() => {
        const btns = agendaContainer.querySelectorAll('.territory-card-swipe');
        btns.forEach(btn => {
            btn.onclick = () => window.openProgressModal(btn.dataset.id, btn.dataset.num, btn.dataset.manzanas);
        });
    }, 0);

    renderAvailabilitySection(document.getElementById('availability-container'), name);
    renderAISection(name);

    // Check if user has Rescue module enabled OR if global config had it enabled (legacy)
    const showRescue = userMods?.rescue || config?.rescue_mode;
    if (showRescue) {
        renderRescueSection(document.getElementById('ayudas-container'), name, allTerritorios, { rescue_mode: true });
    } else {
        const ayudas = document.getElementById('ayudas-container');
        if (ayudas) ayudas.classList.add('hidden');
    }

    // Render Weekly Program Cards (Global Weekly View)
    if (programa && userMods.programa !== false) {
        const programCardsContainer = document.getElementById('weekly-program-cards');
        if (programCardsContainer) {
            renderFullProgramaCards(programa, programCardsContainer);
        }
    }
};

const renderFullProgramaCards = (programa, container) => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const shifts = ['manana', 'tarde', 'noche'];
    const shiftLabels = { 'manana': 'Mañana', 'tarde': 'Tarde', 'noche': 'Noche' };

    container.innerHTML = days.map(dayName => {
        const d = (programa?.dias || []).find(x => x.nombre === dayName);
        if (!d) return '';

        return shifts.map(s => {
            const sData = d[s];
            if (!sData || (!sData.conductor && !sData.lugar)) return '';

            return `
                <div class="bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-2">
                    <div class="flex justify-between items-start">
                        <span class="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-tighter">${dayName}: ${shiftLabels[s]}</span>
                    </div>
                    <div class="space-y-1">
                        <p class="text-[11px] font-bold text-slate-800 dark:text-white line-clamp-1">📍 ${sData.lugar || '---'}</p>
                        <div class="grid grid-cols-1 gap-0.5">
                            <p class="text-[10px] text-slate-500 dark:text-slate-400"><b>C:</b> ${sData.conductor || '---'}</p>
                            ${sData.auxiliar ? `<p class="text-[10px] text-slate-500 dark:text-slate-400"><b>A:</b> ${sData.auxiliar}</p>` : ''}
                        </div>
                        ${sData.territorio ? `
                            <p class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 mt-1">Terr: ${sData.territorio}</p>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }).join('');

    if (container.innerHTML === '') {
        container.innerHTML = '<p class="col-span-full text-center text-xs text-gray-400 italic py-4">No hay programa asignado esta semana.</p>';
    }
};

const initSwipeActions = () => {
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
            content.style.transition = 'none';
        });

        card.addEventListener('touchmove', (e) => {
            if (!isMoving) return;
            currentX = e.touches[0].clientX - startX;

            // Limit swipe
            if (Math.abs(currentX) > 100) return;

            content.style.transform = `translateX(${currentX}px)`;

            if (currentX > 30) {
                leftAction.style.opacity = Math.min(1, (currentX - 30) / 40);
                card.style.backgroundColor = 'rgba(37, 99, 235, 0.8)'; // Blue for map
            } else if (currentX < -30) {
                rightAction.style.opacity = Math.min(1, (Math.abs(currentX) - 30) / 40);
                card.style.backgroundColor = 'rgba(13, 148, 136, 0.8)'; // Teal for report
            } else {
                leftAction.style.opacity = 0;
                rightAction.style.opacity = 0;
                card.style.backgroundColor = 'transparent';
            }
        });

        card.addEventListener('touchend', () => {
            isMoving = false;
            content.style.transition = 'transform 0.3s ease';

            if (Math.abs(currentX) > 70) {
                if (currentX > 0) {
                    // Right -> Map
                    const t = {
                        id: card.dataset.id,
                        numero: card.dataset.num,
                        manzanas: card.dataset.manzanas,
                        coordenadas: card.dataset.coords ? JSON.parse(card.dataset.coords) : null
                    };
                    window.openInteractiveMap(t);
                } else {
                    // Left -> Report
                    window.openProgressModal(card.dataset.id, card.dataset.num, card.dataset.manzanas);
                }
            }

            // Reset
            content.style.transform = 'translateX(0px)';
            const leftAction = card.querySelector('.swipe-action-left');
            const rightAction = card.querySelector('.swipe-action-right');
            if (leftAction) leftAction.style.opacity = 0;
            if (rightAction) rightAction.style.opacity = 0;
            setTimeout(() => card.style.backgroundColor = 'transparent', 300);
            currentX = 0;
        });
    });
};

// Helper: Render Weekly Program Table (ReadOnly)
const renderProgramaTableHelpers = (programa) => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const shifts = ['manana', 'tarde', 'noche'];
    const shiftLabels = { 'manana': 'Mañana', 'tarde': 'Tarde', 'noche': 'Noche' };
    const shiftIcons = { 'manana': '🌅', 'tarde': '☀️', 'noche': '🌙' };

    let html = `
    <div class="mt-12 mb-6 animate-fade-in">
        <h3 class="text-2xl font-black text-slate-800 dark:text-white mb-6 pl-4 border-l-4 border-teal-500">Programa Semanal</h3>
        <div class="overflow-x-auto pb-4 custom-scrollbar">
            <div class="min-w-[800px] bg-white dark:bg-[#151515] rounded-[2rem] shadow-xl border border-black/5 dark:border-white/5 overflow-hidden">
                <div class="grid grid-cols-[100px_1fr_1fr_1fr] bg-slate-50 dark:bg-white/5 border-b border-black/5 dark:border-white/5">
                    <div class="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center">Día</div>
                    ${shifts.map(s => `<div class="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">${shiftIcons[s]} ${shiftLabels[s]}</div>`).join('')}
                </div>
                <div class="divide-y divide-black/5 dark:divide-white/5">
                    ${days.map(dayName => {
        const dayData = (programa?.dias || []).find(d => d.nombre === dayName) || {};
        return `
                        <div class="grid grid-cols-[100px_1fr_1fr_1fr] hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                            <div class="p-4 flex items-center justify-center border-r border-black/5 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.02]">
                                <span class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase -rotate-90 md:rotate-0">${dayName.substring(0, 3)}</span>
                            </div>
                            ${shifts.map(shift => {
            const sData = dayData[shift] || {};
            if (!sData.conductor && !sData.lugar) return `<div class="p-2"></div>`;
            return `
                                <div class="p-3 border-r border-black/5 dark:border-white/5 last:border-0 relative group/cell">
                                    ${sData.lugar ? `<div class="text-[9px] font-bold text-teal-600 dark:text-teal-400 mb-1 truncate">📍 ${sData.lugar}</div>` : ''}
                                    ${sData.conductor ? `<div class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight">${sData.conductor}</div>` : ''}
                                    ${sData.auxiliar ? `<div class="text-[9px] text-slate-500 leading-tight mt-0.5">+ ${sData.auxiliar}</div>` : ''}
                                    ${sData.territorio ? `
                                        <div class="mt-2 flex flex-wrap gap-1">
                                            ${sData.territorio.split(',').map(t => `<span class="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded text-[9px] font-black border border-indigo-100 dark:border-indigo-500/20">${t.trim()}</span>`).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                                `;
        }).join('')}
                        </div>
                        `;
    }).join('')}
                </div>
            </div>
        </div>
    </div>
    `;
    return html;
};


// Progress / Return Modal
// Progress / Return Modal
// Progress / Return Modal - REFACTORED for Multi-Territory Logic
window.openProgressModal = async (initialId, initialNum, initialManzanasStr) => {
    // 1. Fetch ALL assigned territories for the current user to support multi-select
    let myTerritories = [];
    try {
        const currentUserEl = document.querySelector('#user-display-name');
        // We might not have the name directly stored globally easily, but openProgressModal is called from UI.
        // Let's rely on the passed ID to find the owner, OR fetch all terrs and filter by current user logic?
        // Better: Use `getTerritorios` and filter by the 'assigned_to' of the initial territory context if possible, 
        // or just fetch all and filter client side.
        // For safety, let's fetch fresh data.
        const allT = await getTerritorios();
        // Find the "owner" of the clicked territory
        const initialT = allT.find(t => t.id === initialId);
        if (initialT && initialT.asignado_a) {
            myTerritories = allT.filter(t => t.asignado_a === initialT.asignado_a || t.auxiliar === initialT.asignado_a);
        } else {
            // Fallback if something is weird, just use the initial one.
            myTerritories = initialT ? [initialT] : [];
        }
    } catch (e) { console.error(e); myTerritories = []; }

    // If fetch failed or logic issue, stick to the passed params as single
    if (myTerritories.length === 0 && initialId) {
        myTerritories = [{ id: initialId, numero: initialNum, manzanas: initialManzanasStr, isFallback: true }];
    }

    // Sort: Initial one first, then others
    myTerritories.sort((a, b) => a.id === initialId ? -1 : 1);

    // Get today's date
    const localDate = new Date();
    const offset = localDate.getTimezoneOffset();
    const todayStr = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    // Modal HTML
    showModal(`
            <div class="flex flex-col h-full">
                <header class="shrink-0 flex items-center justify-between bg-gradient-to-r from-teal-600 to-emerald-700 p-8 text-white relative overflow-hidden">
                    <div class="absolute inset-0 bg-white/5 backdrop-blur-3xl"></div>
                    <div class="relative z-10 flex items-center gap-5">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center text-3xl shadow-2xl border border-white/30 animate-float">📈</div>
                        <div>
                            <h3 class="text-2xl font-black tracking-tight leading-none mb-1">Reporte de Servicio</h3>
                            <p class="text-[10px] opacity-60 uppercase tracking-[0.4em] font-black">Territorio ${myTerritories.map(t => t.numero).join(', ')}</p>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-10 space-y-8 overflow-y-auto custom-scrollbar">
                    
                    <!-- STEP 1: INITIAL VIEW (No Apples) -->
                    <div id="view-initial" class="space-y-8 animate-fade-in">
                        <button onclick="window.viewMapFromReport('${initialId}')" class="w-full bg-blue-600/5 hover:bg-blue-600/10 text-blue-600 dark:text-blue-400 p-5 rounded-3xl text-xs font-black transition-all flex items-center justify-center gap-3 border border-blue-600/10 group">
                            <span class="text-xl group-hover:rotate-12 transition-transform">🗺️</span> VER MAPA INTERACTIVO
                        </button>

                        <!-- General Info Inputs -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="space-y-3">
                                <label class="label-premium">Fecha de Entrega</label>
                                <input type="date" id="completion-date" value="${todayStr}" class="input-premium">
                            </div>
                            <div class="space-y-3">
                                <div class="flex justify-between items-center px-2">
                                    <label class="label-premium !mb-0">Observaciones Generales</label>
                                    <button onclick="window.startVoiceDictation('progress-notes')" class="text-teal-600 hover:text-teal-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                        <span id="mic-icon">🎤</span> Dictar
                                    </button>
                                </div>
                                <textarea id="progress-notes" rows="3" placeholder="Opcional..." class="input-premium min-h-[100px] resize-none"></textarea>
                            </div>
                        </div>

                        <div class="pt-4 space-y-4">
                            <button id="btn-goto-select" class="w-full bg-teal-600 py-5 rounded-3xl text-white font-black shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.01] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3">
                                 ✨ Marcar como Terminado
                            </button>
                            <button id="btn-no-predico" class="w-full py-2 text-rose-500 hover:text-rose-600 font-black text-[10px] uppercase tracking-widest transition-colors">
                                No se pudo predicar nada hoy
                            </button>
                        </div>
                    </div>

                    <!-- STEP 2: APPLE SELECTION (Multi-Territory) -->
                    <div id="view-apple-selection" class="hidden space-y-6 animate-fade-in">
                        <div class="text-center mb-4">
                            <h4 class="text-xl font-black text-slate-800 dark:text-white">¿Qué se completó?</h4>
                            <p class="text-xs text-slate-400 font-bold mt-1">Selecciona las manzanas trabajadas por territorio</p>
                        </div>

                        <div id="territories-apple-list" class="space-y-6">
                            <!-- Injected via JS -->
                        </div>

                         <div class="pt-4 space-y-4">
                             <div id="keep-assigned-container" class="hidden p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-sm">🔄</div>
                                    <p class="text-[10px] font-bold text-slate-600 dark:text-slate-300">Mantener resto asignado</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="keep-assigned" class="sr-only peer" checked>
                                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                                </label>
                            </div>

                            <button id="btn-confirm-selection" class="w-full bg-teal-600 py-5 rounded-3xl text-white font-black shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.01] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3">
                                 Continuar
                            </button>
                             <button id="btn-back-initial" class="w-full py-2 text-slate-400 hover:text-slate-600 font-black text-[10px] uppercase tracking-widest transition-colors">
                                Volver
                            </button>
                        </div>
                    </div>

                    <!-- STEP 3: CONFIRMATION -->
                    <div id="view-confirmation" class="hidden text-center py-10 space-y-8 animate-fade-in">
                        <div class="relative inline-block">
                            <div class="w-24 h-24 bg-amber-500/10 dark:bg-amber-500/20 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-inner border border-amber-500/20 animate-bounce">⚠️</div>
                        </div>
                        <div class="space-y-2">
                            <h4 class="text-2xl font-black text-slate-800 dark:text-white tracking-tight">¿Confirmar Acción?</h4>
                            <p id="confirm-msg" class="text-sm font-bold text-slate-500 dark:text-slate-400 px-8 leading-relaxed">...</p>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4 px-10">
                            <button id="btn-confirm-cancel" class="p-5 rounded-3xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-white/10 transition-all">Regresar</button>
                            <button id="btn-confirm-final" class="p-5 rounded-3xl bg-teal-600 text-white font-black text-[11px] uppercase tracking-[0.2em] hover:bg-teal-500 shadow-xl shadow-teal-500/30 transition-all">Sí, confirmar</button>
                        </div>
                    </div>

                </div>
            </div>
    `, async (modal) => {
        // Elements
        const viewInitial = modal.querySelector('#view-initial');
        const viewAppleSelection = modal.querySelector('#view-apple-selection');
        const viewConfirmation = modal.querySelector('#view-confirmation');

        const btnGotoSelect = modal.querySelector('#btn-goto-select');
        const btnNoPredico = modal.querySelector('#btn-no-predico');

        const appleListContainer = modal.querySelector('#territories-apple-list');
        const btnConfirmSelection = modal.querySelector('#btn-confirm-selection');
        const btnBackInitial = modal.querySelector('#btn-back-initial');
        const keepContainer = modal.querySelector('#keep-assigned-container');

        const btnConfirmFinal = modal.querySelector('#btn-confirm-final');
        const btnConfirmCancel = modal.querySelector('#btn-confirm-cancel');
        const confirmMsg = modal.querySelector('#confirm-msg');

        let pendingPayload = null;

        // Render Apples Logic
        const renderApples = () => {
            appleListContainer.innerHTML = myTerritories.map(t => {
                const manzanas = t.manzanas ? t.manzanas.split(',').map(s => s.trim()).filter(s => s) : [];
                const safeNum = t.numero.replace(/\s+/g, '-');

                return `
                    <div class="bg-slate-50 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5 overflow-hidden">
                        <div class="p-4 bg-slate-100 dark:bg-black/20 flex justify-between items-center cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-colors" onclick="document.getElementById('body-${safeNum}').classList.toggle('hidden')">
                            <span class="font-black text-slate-700 dark:text-white">Territorio ${t.numero}</span>
                            <span class="text-[10px] text-slate-400 font-bold uppercase">▼</span>
                        </div>
                        <div id="body-${safeNum}" class="p-4 space-y-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[10px] text-gray-400 font-black uppercase tracking-widest">Manzanas</span>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" class="check-all-t w-4 h-4 accent-teal-500 rounded" data-id="${t.id}">
                                    <span class="text-[10px] font-bold text-teal-600">Todas</span>
                                </label>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-2">
                                ${manzanas.length > 0 ? manzanas.map(m => `
                                    <label class="flex items-center gap-2 p-3 bg-white dark:bg-black/20 rounded-xl border border-transparent hover:border-teal-500/30 cursor-pointer transition-all">
                                        <input type="checkbox" value="${m}" data-id="${t.id}" class="check-apple w-4 h-4 accent-teal-500 rounded">
                                        <span class="font-bold text-xs text-slate-600 dark:text-slate-300">${m}</span>
                                    </label>
                                `).join('') : `
                                    <div class="col-span-2">
                                        <input type="text" data-id="${t.id}" class="manual-input w-full bg-transparent border-b border-gray-300 text-center text-sm py-2 outline-none font-bold" placeholder="Escribir (ej: 1, 2)">
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Bind checklist logic
            modal.querySelectorAll('.check-all-t').forEach(ca => {
                ca.addEventListener('change', (e) => {
                    const tid = e.target.dataset.id;
                    const apples = modal.querySelectorAll(`.check-apple[data-id="${tid}"]`);
                    apples.forEach(a => a.checked = e.target.checked);
                    updateAppleState();
                });
            });

            modal.querySelectorAll('.check-apple').forEach(c => c.addEventListener('change', updateAppleState));
            modal.querySelectorAll('.manual-input').forEach(i => i.addEventListener('input', updateAppleState));
        };

        const updateAppleState = () => {
            // Check if any apples are selected or manual text entered
            let hasSelection = false;
            let partialMode = false;

            myTerritories.forEach(t => {
                const checks = modal.querySelectorAll(`.check-apple[data-id="${t.id}"]:checked`);
                const allChecks = modal.querySelectorAll(`.check-apple[data-id="${t.id}"]`);
                const manual = modal.querySelector(`.manual-input[data-id="${t.id}"]`);

                if (checks.length > 0 || (manual && manual.value.trim())) hasSelection = true;
                if (checks.length > 0 && checks.length < allChecks.length) partialMode = true;
                if (manual && manual.value.trim()) partialMode = true; // Manual entry is implicitly expansive/partial
            });

            if (partialMode) keepContainer.classList.remove('hidden');
            else keepContainer.classList.add('hidden');

            btnConfirmSelection.innerHTML = hasSelection ? 'Continuar' : 'Marcar Todo Como Completado';
        };


        // --- Navigation Logic ---

        btnGotoSelect.onclick = () => {
            renderApples();
            viewInitial.classList.add('hidden');
            viewAppleSelection.classList.remove('hidden');
            updateAppleState();
        };

        btnBackInitial.onclick = () => {
            viewAppleSelection.classList.add('hidden');
            viewInitial.classList.remove('hidden');
        };

        btnNoPredico.onclick = () => {
            pendingPayload = { type: 'none' };
            confirmMsg.innerText = "Vas a reportar que NO se predicó en estos territorios. Se mantendrán asignados.";
            viewInitial.classList.add('hidden');
            viewConfirmation.classList.remove('hidden');
        };

        btnConfirmSelection.onclick = () => {
            // Build Payload
            const reports = [];
            const keepAssigned = modal.querySelector('#keep-assigned').checked;

            myTerritories.forEach(t => {
                const checks = Array.from(modal.querySelectorAll(`.check-apple[data-id="${t.id}"]:checked`)).map(c => c.value);
                const manual = modal.querySelector(`.manual-input[data-id="${t.id}"]`);
                const manualVal = manual ? manual.value.split(',').map(s => s.trim()).filter(Boolean) : [];

                const allSelected = checks.concat(manualVal);

                if (allSelected.length > 0 || myTerritories.length === 1) { // If explicit selection OR just one territory implicit all
                    // Identify status
                    let isPartial = false;
                    let remaining = [];

                    if (t.manzanas) {
                        const original = t.manzanas.split(',').map(s => s.trim()).filter(Boolean);
                        if (checks.length > 0 && checks.length < original.length) {
                            isPartial = true;
                            remaining = original.filter(x => !checks.includes(x));
                        }
                    }
                    if (manualVal.length > 0) isPartial = true; // Assume manual entry is implicitly expansive/partial

                    // If button said "Marcar Todo", and no specific selection made, assume ALL
                    const isImplicitAll = allSelected.length === 0;

                    reports.push({
                        id: t.id,
                        numero: t.numero,
                        completed: isImplicitAll ? (t.manzanas ? t.manzanas.split(',') : []) : allSelected,
                        remaining: remaining,
                        isPartial: isPartial && !isImplicitAll,
                        originalManzanas: t.manzanas
                    });
                }
            });

            pendingPayload = { type: 'report', data: reports, keep: keepAssigned };

            const count = reports.length;
            const partials = reports.filter(r => r.isPartial).length;

            confirmMsg.innerText = `Vas a reportar ${count} territorio(s). ${partials > 0 ? `${partials} de ellos marcados como parcialmente completados` : 'Todos marcados como completados'}. ${keepAssigned && partials > 0 ? 'El resto se mantendrá asignado.' : ''}`;

            viewAppleSelection.classList.add('hidden');
            viewConfirmation.classList.remove('hidden');
        };

        btnConfirmCancel.onclick = () => {
            viewConfirmation.classList.add('hidden');
            if (pendingPayload.type === 'none') viewInitial.classList.remove('hidden');
            else viewAppleSelection.classList.remove('hidden');
        };

        btnConfirmFinal.onclick = async (e) => {
            e.target.innerHTML = 'Procesando...';
            e.target.disabled = true;

            const date = modal.querySelector('#completion-date').value;
            const notes = modal.querySelector('#progress-notes').value;

            try {
                if (pendingPayload.type === 'none') {
                    // Logic for "No Predicó" - maybe log interaction but keep assigned
                    // For now, assume it effectively does nothing but log "Intento fallido" or re-assign date?
                    // User request implies just "Return" or "Keep"? 
                    // Let's assume keep but log note.
                    // Or actually, user usually means "Return incomplete".
                    // Let's safe default: Just add history note.
                    for (const t of myTerritories) {
                        await logReturn(t.id, new Date().toISOString(), 'No predicado', notes || 'Sin actividad');
                    }
                    showNotification("Reporte registrado.");
                } else {
                    // Process Reports
                    for (const r of pendingPayload.data) {
                        if (r.isPartial) {
                            // Partial Logic
                            // If keep is true: Split. 
                            // If keep is false: Return all but mark completed part in history? 
                            // Complex. Let's use returnTerritorioParcial
                            // If "Implicit All", r.isPartial is false.

                            // Calculate remaining for manual input if not derived?
                            // If manual input was used, we don't know "remaining" easily without valid original list.
                            // Fallback: If original list exists, calculate.
                            let rem = r.remaining;
                            if (rem.length === 0 && r.originalManzanas) {
                                // If manual entry, we can't subtract easily if strings don't match. 
                                // Assume manual entry replaces logic: User types what they did. 
                                // We might need to ask what is left?
                                // For MVP: If manual, we don't unassign remainder unless implicit?
                            }

                            await returnTerritorioParcial(r.id, r.completed, rem, !pendingPayload.keep, notes, date);
                        } else {
                            // Full Completion
                            await returnTerritorio(r.id, "Terminado", date, "Completado");
                            if (notes) await logReturn(r.id, date, 'Nota', notes);
                        }
                    }
                    showNotification("¡Excelente! Informe procesado.");
                }

                modal.remove();
                if (window.refreshConductorView) window.refreshConductorView();

            } catch (err) {
                console.error(err);
                showCustomAlert("Error al procesar: " + err.message);
                e.target.innerHTML = 'Intentar de nuevo';
                e.target.disabled = false;
            }
        };

    }); // End ShowModal
};

const initializePhoneModule = (initialPhones, publicadores, userId, tbody, refreshCallback) => {
    let telefonos = initialPhones; // Mutable state for AJAX updates
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const estados = ['Sin asignar', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];

    // Local State for session tracking
    let sessionActive = telefonos.some(t => t.solicitado_por === userId && (t.estado === 'Sin asignar' || !t.estado));

    window.updatePhoneAssignment = async (id, newPubName) => {
        const pub = publicadores.find(p => p.nombre === newPubName);
        const resolvedId = pub ? pub.id : newPubName;
        const resolvedName = pub ? pub.nombre : newPubName;

        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].publicador_asignado = resolvedId;
            telefonos[telIndex].asignado_a = resolvedName;
        }

        try {
            await updateTelefono(id, {
                publicador_asignado: resolvedId,
                asignado_a: resolvedName,
                fecha_asignacion: new Date().toISOString()
            });
        } catch (e) {
            console.error(e);
            showNotification("Error al guardar asignación", "error");
        }
    };

    window.updatePhoneStatus = async (id, status) => {
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].estado = status;
            if (status === 'Sin asignar') {
                telefonos[telIndex].publicador_asignado = null;
                telefonos[telIndex].asignado_a = null;
                telefonos[telIndex].fecha_asignacion = null;
                telefonos[telIndex].solicitado_por = null;
            }
            render();
        }
        await updateTelefonoStatus(id, status, (telIndex !== -1 ? telefonos[telIndex].asignado_a : null));
    };

    window.updatePhoneComment = async (id, comment, inputElement, publicadorName) => {
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].comentario = comment;
        }

        inputElement.classList.add('border-teal-500', 'bg-teal-900/20');

        try {
            // Use updateTelefonoStatus so it logs to history
            await updateTelefonoStatus(id, (telIndex !== -1 ? telefonos[telIndex].estado : 'Contestaron'), publicadorName, comment);

            setTimeout(() => {
                inputElement.classList.remove('bg-teal-900/20', 'border-teal-500');
            }, 1000);
        } catch (e) {
            console.error("Error saving comment:", e);
            inputElement.classList.add('border-red-500');
            showNotification("Error al guardar comentario", "error");
        }
    };

    window.showPhoneHistory = (historial, numero) => {
        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
    < div class="flex flex-col h-full" >
                <header class="shrink-0 flex justify-between items-center bg-amber-600 p-6 text-white shadow-lg">
                    <div>
                        <h3 class="font-black uppercase tracking-[0.2em] text-sm">Historial de Notas</h3>
                        <p class="text-[9px] opacity-70 font-bold uppercase mt-1">Número: ${formatPhoneNumber(numero)}</p>
                    </div>
                    <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🕒</div>
                </header>

                <div class="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    ${historial.length === 0 ? `
                        <div class="text-center py-12 opacity-30">
                            <span class="text-4xl">📝</span>
                            <p class="text-xs font-bold uppercase mt-2 font-black tracking-widest">Sin notas previas</p>
                        </div>
                    ` : historial.map(h => `
                        <div class="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5 relative group hover:border-amber-500/30 transition-all">
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-[9px] font-black text-amber-500 uppercase tracking-widest">${h.publicador}</span>
                                <span class="text-[8px] text-gray-400 font-mono">${new Date(h.fecha).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p class="text-sm text-gray-700 dark:text-gray-200 font-medium leading-relaxed">${h.nota}</p>
                        </div>
                    `).reverse().join('')}
                </div>

                <div class="shrink-0 p-4 bg-gray-50 dark:bg-black/40 border-t border-black/5 dark:border-white/5">
                    <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full bg-white dark:bg-white/5 py-4 rounded-xl text-[10px] font-black text-gray-400 hover:text-amber-600 transition-colors uppercase tracking-[0.2em] border border-black/5 dark:border-white/5 shadow-sm">
                        Cerrar Historial
                    </button>
                </div>
            </div >
    `;
        modal.classList.remove('hidden');
    };

    window.copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            showNotification("Número copiado al portapapeles", "success", 1500);
        });
    };

    const render = () => {
        const searchInput = document.getElementById('search-phone');
        const statusFilter = document.getElementById('filter-phone-status');
        const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
        const statusVal = statusFilter ? statusFilter.value : '';

        // Filter and Sort
        let filtered = telefonos.filter(t => {
            const matchSearch = !searchVal || t.numero.includes(searchVal) || (t.propietario && t.propietario.toLowerCase().includes(searchVal));
            const matchStatus = !statusVal || t.estado === statusVal;
            return matchSearch && matchStatus;
        });

        filtered.sort((a, b) => {
            const dateA = a.fecha_asignacion ? new Date(a.fecha_asignacion) : new Date(0);
            const dateB = b.fecha_asignacion ? new Date(b.fecha_asignacion) : new Date(0);
            return dateB - dateA;
        });

        // Banner Case: If no phones requested by current user
        const activeRequests = telefonos.filter(t => t.solicitado_por === userId);

        if (activeRequests.length === 0) {
            tbody.innerHTML = `
                <tr>
                <td colspan="6" class="p-0">
                    <div class="bg-gradient-to-br from-teal-50 to-white dark:from-teal-900/10 dark:to-[#0f1115] p-12 text-center rounded-2xl border-2 border-dashed border-teal-200 dark:border-teal-800/30 m-4 animate-fade-in">
                        <div class="text-6xl mb-6">📞</div>
                        <h3 class="text-2xl font-bold text-teal-800 dark:text-teal-100 mb-4">¿Listo para la Predicación Telefónica?</h3>
                        <p class="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
                            Haz clic en el botón de abajo para solicitar tus primeros 30 números y empezar la sesión con tu grupo.
                        </p>
                        <button id="btn-solicitar-banner" class="bg-teal-600 hover:bg-teal-500 text-white px-8 py-3 rounded-full font-bold shadow-xl shadow-teal-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto">
                            🚀 Solicitar Números
                        </button>
                    </div>
                </td>
                </tr>
            `;
            setTimeout(() => {
                const b = document.getElementById('btn-solicitar-banner');
                if (b) b.onclick = () => document.getElementById('btn-solicitar').click();
            }, 0);
            return;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-500 italic">No se encontraron números que coincidan con la búsqueda.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            const rawAssigned = t.asignado_a || t.publicador_asignado;
            let currentPubDisplay = rawAssigned || '';
            if (rawAssigned) {
                const p = publicadores.find(pub => pub.id === rawAssigned || pub.email === rawAssigned || pub.nombre === rawAssigned);
                if (p) currentPubDisplay = p.nombre;
            }

            const currentStatus = t.estado || 'Sin asignar';
            return `
                < tr class="hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-white/5 group" >
                <td class="p-3">
                    <div class="flex items-center gap-2 font-mono text-teal-700 dark:text-teal-300 font-bold text-sm tracking-wide">
                        ${formatPhoneNumber(t.numero)}
                        <button onclick="copyToClipboard('${t.numero}')" class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-teal-500/20 rounded-md" title="Copiar número para Zoom">📋</button>
                    </div>
                </td>
                <td class="p-3 text-gray-700 dark:text-gray-300 text-xs font-bold truncate-text max-w-[150px] uppercase">
                    ${t.propietario || '-'}
                </td>
                <td class="p-3 text-gray-400 dark:text-gray-500 text-[10px] uppercase tracking-wide truncate-text max-w-[150px]">
                    ${t.direccion || '-'}
                </td>
                <td class="p-2">
                    <input type="text" list="pubs-list" value="${currentPubDisplay}" 
                        onchange="window.updatePhoneAssignment('${t.id}', this.value)"
                        placeholder="Nombre..."
                        class="w-full bg-black/30 border border-black/10 dark:border-white/10 rounded px-2 py-1 text-xs font-medium focus:border-teal-500 outline-none hover:bg-black/50 transition-colors text-teal-800 dark:text-teal-200">
                    <datalist id="pubs-list">
                        ${publicadores.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}
                    </datalist>
                </td>
                <td class="p-2 text-center">
                    <select onchange="window.updatePhoneStatus('${t.id}', this.value)" 
                        class="w-full bg-black/30 border border-black/10 dark:border-white/10 rounded px-2 py-1 text-xs font-medium focus:border-teal-500 outline-none cursor-pointer hover:bg-black/50 transition-colors ${getStatusColor(currentStatus)}">
                         ${estados.map(st => `<option value="${st}" ${st === currentStatus ? 'selected' : ''} class="bg-gray-900 text-gray-200">${st}</option>`).join('')}
                    </select>
                </td>
                <td class="p-2">
                    <div class="flex items-center gap-2">
                        <input type="text" 
                            value="${t.comentario || ''}" 
                            onblur="window.updatePhoneComment('${t.id}', this.value, this, '${currentPubDisplay}')"
                            placeholder="Observaciones..." 
                            class="flex-1 bg-transparent border-b border-black/10 dark:border-white/10 focus:border-teal-500 text-gray-700 dark:text-gray-300 text-xs py-1 px-2 focus:bg-black/20 outline-none transition-all placeholder-gray-600">
                        <button onclick='window.showPhoneHistory(${JSON.stringify(t.comentarios_historial || []).replace(/'/g, "&apos;")}, "${t.numero}")' 
                                class="p-1.5 hover:bg-amber-500/10 rounded-lg transition-colors text-amber-500" 
                                title="Ver historial de notas">
                            🕒
                        </button>
                    </div>
                </td>
            </tr >
    `;
        }).join('');

        // Progress Stats
        const totalProcessed = telefonos.filter(t => t.estado && t.estado !== 'Sin asignar').length;
        const total = telefonos.length;
        const progressContainer = document.getElementById('phone-progress-info');
        if (progressContainer) {
            progressContainer.innerHTML = `
    < div class="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400" >
                    <span>Progreso: <b>${totalProcessed}</b> de <b>${total}</b></span>
                    <div class="w-24 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div class="h-full bg-teal-500 transition-all duration-500" style="width: ${(totalProcessed / total) * 100}%"></div>
                    </div>
                </div >
    `;
        }

        // Finalizar Session Button visibility
        const btnFinalizar = document.getElementById('btn-finalizar-sesion');
        const btnSolicitarMore = document.getElementById('btn-solicitar-more');
        if (btnFinalizar) {
            const hasActive = activeRequests.length > 0;
            btnFinalizar.classList.toggle('hidden', !hasActive);
            if (btnSolicitarMore) btnSolicitarMore.classList.toggle('hidden', !hasActive);
        }
    };
    render();

    // Listeners (Cloned to remove old ones)
    const btnSolicitarMore = document.getElementById('btn-solicitar-more');
    if (btnSolicitarMore) {
        btnSolicitarMore.onclick = () => btnSolicitar.click();
    }

    if (btnSolicitar) {
        const newBtn = btnSolicitar.cloneNode(true);
        btnSolicitar.parentNode.replaceChild(newBtn, btnSolicitar);
        newBtn.addEventListener('click', async () => {
            const btn = newBtn;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "...";
            try {
                const count = await solicitarNumeros(30, userId); // Updated to 30 as requested
                if (count > 0) {
                    showNotification(`¡Se te han asignado ${count} números nuevos!`);
                    // AJAX Refresh
                    if (refreshCallback) {
                        telefonos = await refreshCallback();
                        render();
                    } else {
                        window.location.reload();
                    }
                } else {
                    showNotification("No hay números disponibles para asignar por ahora.", "warning");
                    document.getElementById('modal-container').classList.add('hidden');
                    reloadData();
                }
            } catch (err) {
                console.error(err);
                showNotification('Error: ' + err.message, "error");
            }
            finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    /* --- REVISITAS LOGIC --- */
    const btnRevisitas = document.getElementById('btn-revisitas');
    if (btnRevisitas) {
        const newBtn = btnRevisitas.cloneNode(true);
        btnRevisitas.parentNode.replaceChild(newBtn, btnRevisitas);
        newBtn.addEventListener('click', async () => {
            const modal = document.getElementById('modal-container');
            modal.innerHTML = `
    < div class="flex flex-col h-full" >
                    <header class="shrink-0 flex justify-between items-center bg-amber-500 p-6 text-white shadow-lg">
                        <div>
                             <h3 class="text-xl font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                ↺ Revisitas Pendientes
                             </h3>
                             <p class="text-[9px] opacity-70 font-bold uppercase mt-1">Gestión de llamadas pendientes</p>
                        </div>
                        <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">📞</div>
                    </header>
                    
                    <div class="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-black/20">
                         <div class="rounded-xl border border-gray-200 dark:border-white/5 relative overflow-hidden bg-white dark:bg-[#0a0a0a]">
                             <div id="revisitas-loader" class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm z-10 p-8">
                                 <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                             </div>
                             <div class="overflow-x-auto">
                                 <table class="w-full text-left text-sm">
                                    <thead class="bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-black uppercase text-[10px] tracking-widest border-b border-black/5 dark:border-white/5">
                                        <tr>
                                            <th class="p-4">Teléfono</th>
                                            <th class="p-4">Propietario</th>
                                            <th class="p-4 hidden sm:table-cell">Dirección</th>
                                            <th class="p-4 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody id="revisitas-tbody" class="divide-y divide-gray-200 dark:divide-white/5"></tbody>
                                 </table>
                             </div>
                             <p id="no-revisitas-msg" class="hidden text-center py-12 text-gray-500 dark:text-gray-400 italic font-black uppercase text-[10px] tracking-widest">No hay revisitas registradas.</p>
                         </div>
                    </div>

                    <div class="shrink-0 p-4 bg-gray-50 dark:bg-black/40 border-t border-black/5 dark:border-white/5">
                        <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full bg-white dark:bg-white/5 py-4 rounded-xl text-[10px] font-black text-gray-400 hover:text-amber-600 transition-colors uppercase tracking-[0.2em] border border-black/5 dark:border-white/5 shadow-sm">
                            Cerrar Revisitas
                        </button>
                    </div>
                </div >
    `;
            modal.classList.remove('hidden');

            try {
                const allPhones = await getTelefonos();
                const revisitas = allPhones.filter(t => t.estado === 'Revisita');
                const tbody = document.getElementById('revisitas-tbody');
                const loader = document.getElementById('revisitas-loader');
                const noMsg = document.getElementById('no-revisitas-msg');

                loader.classList.add('hidden');

                if (revisitas.length === 0) {
                    noMsg.classList.remove('hidden');
                } else {
                    tbody.innerHTML = revisitas.map(r => `
    < tr id = "rev-row-${r.id}" class="hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors" >
                            <td class="p-3 font-mono text-teal-600 dark:text-teal-400">${formatPhoneNumber(r.numero)}</td>
                            <td class="p-3 font-bold text-gray-800 dark:text-gray-200">${r.propietario || '-'}</td>
                            <td class="p-3 text-xs text-gray-500 dark:text-gray-400">${r.direccion || '-'}</td>
                            <td class="p-3 text-sm text-blue-600 dark:text-blue-400 font-medium">
                                ${r.publicador_asignado || r.asignado_a || '<span class="text-gray-400 italic">Sin asignar</span>'}
                            </td>
                            <td class="p-3 text-right">
                                <button onclick="window.returnRevisita('${r.id}')" 
                                        class="bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-200 px-3 py-1 rounded-lg text-xs font-bold transition-colors shadow-sm">
                                    Devolver
                                </button>
                            </td>
                        </tr >
    `).join('');
                }

            } catch (e) {
                console.error(e);
                showNotification("Error cargando revisitas", "error");
                document.getElementById('revisitas-loader').classList.add('hidden');
            }
        });
    }

    window.startVoiceDictation = (targetId) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            return showNotification("Tu navegador no soporta transcripción por voz.", "warning");
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        const micIcon = document.getElementById('mic-icon');
        const originalIcon = micIcon ? micIcon.innerText : '🎤';
        if (micIcon) micIcon.innerText = '🔴';

        recognition.start();

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const target = document.getElementById(targetId);
            if (target) {
                target.value = target.value ? target.value + ' ' + transcript : transcript;
                target.focus();
            }
        };

        recognition.onerror = () => {
            showNotification("Error en el dictado.", "error");
            if (micIcon) micIcon.innerText = originalIcon;
        };

        recognition.onend = () => {
            if (micIcon) micIcon.innerText = originalIcon;
        };
    };

    window.returnRevisita = async (id) => {
        const row = document.getElementById(`rev - row - ${id} `);
        // Demand comment for return
        const reason = prompt("Por favor, ingresa el motivo de la devolución (¿Por qué se devuelve este número?):");
        if (reason === null) return; // Cancelled
        if (!reason.trim()) {
            showNotification("Debes ingresar un motivo para devolver el número.", "warning");
            return;
        }

        try {
            await updateTelefono(id, {
                estado: 'Sin asignar',
                publicador_asignado: null,
                asignado_a: null,
                fecha_asignacion: null,
                solicitado_por: null,
                comentario_devolucion: reason,
                fecha_devolucion: new Date().toISOString()
            });

            showNotification("Número devuelto exitosamente.", "success");
            if (row) row.remove();

            const tbodyRev = document.getElementById('revisitas-tbody');
            if (tbodyRev && tbodyRev.children.length === 0) {
                document.getElementById('no-revisitas-msg').classList.remove('hidden');
            }

            if (refreshCallback) {
                telefonos = await refreshCallback();
                render();
            }
        } catch (e) {
            console.error(e);
            showNotification("Error al devolver número", "error");
        }
    };

    // End Session Logic
    const btnFinalizar = document.getElementById('btn-finalizar-sesion');
    if (btnFinalizar) {
        btnFinalizar.addEventListener('click', async () => {
            const activeRequests = telefonos.filter(t => t.solicitado_por === userId);
            if (activeRequests.length === 0) return;

            const summary = {
                total: activeRequests.length,
                stats: {
                    'Contestaron': 0,
                    'No contestan': 0,
                    'Colgaron': 0,
                    'Revisita': 0,
                    'No llamar': 0,
                    'Sin asignar': 0
                }
            };

            activeRequests.forEach(t => {
                const st = t.estado || 'Sin asignar';
                if (summary.stats.hasOwnProperty(st)) summary.stats[st]++;
                else summary.stats['Sin asignar']++;
            });

            const statsText = Object.entries(summary.stats)
                .filter(([_, count]) => count > 0)
                .map(([name, count]) => `• ${name}: ${count} `)
                .join('\n');

            const modal = document.getElementById('modal-container');
            showModal(`
    < div class="p-12 text-center space-y-10 animate-fade-in" >
                    <div class="relative inline-block">
                        <div class="w-28 h-28 bg-teal-500/10 dark:bg-teal-500/20 rounded-[3rem] flex items-center justify-center text-6xl shadow-inner border border-teal-500/20 animate-float">🏁</div>
                        <div class="absolute -top-3 -right-3 w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center text-lg font-black shadow-xl animate-bounce border-4 border-white dark:border-slate-900">✓</div>
                    </div>
                    
                    <div class="space-y-3">
                        <h3 class="text-4xl font-black text-slate-800 dark:text-white tracking-tight">Sesión Finalizada</h3>
                        <p class="text-[11px] text-teal-600 dark:text-teal-400 uppercase font-black tracking-[0.4em]">Resumen de Actividad</p>
                    </div>
                    
                    <div class="glass-morphism bg-teal-500/[0.03] dark:bg-white/[0.03] rounded-[3rem] p-10 border border-teal-500/10 dark:border-white/5 space-y-8">
                        <div class="flex justify-between items-center bg-teal-600/10 dark:bg-teal-600/20 p-6 rounded-3xl border border-teal-500/10">
                             <span class="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em]">Total Registros</span>
                             <span class="text-4xl font-black text-teal-700 dark:text-teal-300 tracking-tighter">${summary.total}</span>
                        </div>
                        <div class="space-y-4 text-left">
                             ${Object.entries(summary.stats)
                    .filter(([_, count]) => count > 0)
                    .map(([name, count]) => `
                                     <div class="flex justify-between items-center px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors">
                                         <span class="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">${name}</span>
                                         <span class="text-sm font-black text-slate-800 dark:text-white">${count}</span>
                                     </div>
                                 `).join('')}
                        </div>
                    </div>

                    <button id="btn-share-results" class="w-full bg-teal-600 py-6 rounded-3xl text-white font-black shadow-[0_20px_50px_-10px_rgba(13,148,136,0.5)] hover:shadow-[0_25px_60px_-10px_rgba(13,148,136,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-4 group">
                         <span class="text-xl group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">📤</span> Compartir Reporte
                    </button>
                </div >
    `);
            modal.classList.remove('hidden');

            // Log summary to backend
            await logSessionSummary({
                conductor_id: userId,
                stats: summary.stats,
                total: summary.total
            });

            // showModal handles closing via its own X button, backdrop click, or ESC key.

            document.getElementById('btn-share-results').onclick = () => {
                const message = `📋 * Resumen de Predicación Telefónica *\n` +
                    `👤 * Conductor:* ${userId} \n` +
                    `📊 * Total procesado:* ${summary.total} \n\n` +
                    `${statsText} \n\n` +
                    `_Enviado desde App Territorios_`;

                if (navigator.share) {
                    navigator.share({
                        title: 'Resumen de Predicación',
                        text: message
                    }).catch(console.error);
                } else {
                    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                }
            };
        });
    }

    // Search and Filter Listeners
    const searchPhone = document.getElementById('search-phone');
    const filterStatus = document.getElementById('filter-phone-status');
    if (searchPhone) searchPhone.addEventListener('input', render);
    if (filterStatus) filterStatus.addEventListener('change', render);



    const btnAddPub = document.getElementById('btn-add-publicador');
    if (btnAddPub) {
        const newBtn = btnAddPub.cloneNode(true);
        btnAddPub.parentNode.replaceChild(newBtn, btnAddPub);
        newBtn.addEventListener('click', async () => {
            const modal = document.getElementById('modal-container');
            modal.innerHTML = `
                <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative animate-fade-in-up">
                    <h3 class="text-lg font-bold text-teal-800 dark:text-teal-100 mb-4">Nuevo Publicador</h3>
                    <input type="text" id="new-pub-name-input" placeholder="Nombre del publicador" class="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:border-teal-500 outline-none mb-4">
                    <div class="flex gap-2 justify-end">
                        <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">Cancelar</button>
                        <button id="confirm-add-pub" class="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-teal-500/20">Agregar</button>
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
                        // Update local state and re-render dropdowns
                        publicadores.push({ nombre: name });
                        publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
                        render();
                    } catch (e) {
                        console.error(e);
                        showNotification("Error al agregar publicador: " + e.message, "error");
                    }
                }
            };

            document.getElementById('confirm-add-pub').addEventListener('click', submit);
            inputName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submit();
            });
        });
    }



};

/* --- AI / INTELLIGENCE --- */
async function renderAISection(name) {
    // 1. Fetch Context Data
    const telefonos = await getTelefonos();
    const publicadores = await getPublicadores();
    const territorios = await getTerritorios();
    const programa = await getProgramaSemanal();
    const config = await getConfiguracion();

    // 2. Init Brain
    const brain = new TerritoryIntelligence(telefonos, publicadores, territorios, programa);

    // 3. Inject Floating UI
    const aiUI = document.createElement('div');
    aiUI.id = 'ai-assistant-overlay';
    aiUI.innerHTML = `
        <!-- Floating Action Button -->
        <button id="ai-fab" class="fixed bottom-6 right-6 z-40 bg-purple-600 hover:bg-purple-500 text-white rounded-full p-4 shadow-2xl shadow-purple-900/50 transition-all hover:scale-110 active:scale-95 animate-bounce-in group">
            <span class="text-2xl group-hover:rotate-12 transition-transform block">🤖</span>
            <span class="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Asistente IA
            </span>
        </button>

        <!-- Chat Panel (Hidden) -->
        <div id="ai-panel" class="fixed bottom-24 right-6 w-80 md:w-96 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-40 transform translate-y-10 opacity-0 pointer-events-none transition-all duration-300 flex flex-col max-h-[60vh]">
            <!-- Header -->
            <div class="flex justify-between items-center p-4 border-b border-white/10 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-t-2xl">
                <h3 class="font-bold text-white flex items-center gap-2">
                    <span>🤖</span> Asistente
                </h3>
                <button id="ai-close" class="text-white/50 hover:text-white transition-colors">✕</button>
            </div>
            
            <!-- Chat Log -->
            <div id="conductor-chat-log" class="flex-1 overflow-y-auto p-4 space-y-3 text-xs custom-scrollbar min-h-[200px]">
                <div class="bg-white/5 p-3 rounded-lg rounded-tl-none border border-white/5 text-gray-300">
                    Hola <b>${name.split(' ')[0]}</b>, soy tu asistente. ¿Buscas un territorio específico o necesitas sugerencias?
                </div>
            </div>

            <!-- Input Area -->
            <div class="p-3 border-t border-white/10 bg-black/20 rounded-b-2xl flex gap-2">
                <input type="text" id="conductor-chat-input" 
                    placeholder="Escribe tu consulta..." 
                    class="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none placeholder-gray-500">
                <button id="conductor-chat-send" class="bg-purple-600 hover:bg-purple-500 text-white px-3 rounded-lg transition-colors flex items-center justify-center">
                    ➤
                </button>
            </div>
        </div>
    `;

    // Remove existing if any (re-render safety)
    const existing = document.getElementById('ai-assistant-overlay');
    if (existing) existing.remove();

    document.body.appendChild(aiUI);

    const fab = document.getElementById('ai-fab');
    const panel = document.getElementById('ai-panel');
    const closeBtn = document.getElementById('ai-close');
    const input = document.getElementById('conductor-chat-input');
    const sendBtn = document.getElementById('conductor-chat-send');
    const log = document.getElementById('conductor-chat-log');

    // Toggle Logic
    let isOpen = false;
    const togglePanel = () => {
        isOpen = !isOpen;
        if (isOpen) {
            panel.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
            input.focus();

            // PWA Install Suggestion
            if (window.deferredPrompt && !localStorage.getItem('pwa_prompt_dismissed')) {
                const installToast = document.createElement('div');
                installToast.className = "fixed bottom-40 right-6 z-50 bg-purple-900 border border-purple-500 text-white p-4 rounded-xl shadow-2xl animate-bounce-in max-w-xs";
                installToast.innerHTML = `
                    <p class="text-sm font-bold mb-2">📲 Instalar App</p>
                    <p class="text-xs text-purple-200 mb-3">Instala la aplicación para un acceso más rápido y mejor experiencia.</p>
                    <div class="flex gap-2">
                        <button id="btn-install-yes" class="bg-white text-purple-900 px-3 py-1 rounded text-xs font-bold flex-1">Instalar</button>
                        <button id="btn-install-no" class="border border-purple-400 text-purple-200 px-3 py-1 rounded text-xs">Ahora no</button>
                    </div>
                `;
                document.body.appendChild(installToast);

                document.getElementById('btn-install-yes').onclick = async () => {
                    window.deferredPrompt.prompt();
                    const { outcome } = await window.deferredPrompt.userChoice;
                    console.log(`User response to install prompt: ${outcome}`);
                    window.deferredPrompt = null;
                    installToast.remove();
                };

                document.getElementById('btn-install-no').onclick = () => {
                    localStorage.setItem('pwa_prompt_dismissed', 'true');
                    installToast.remove();
                };
            }
        } else {
            panel.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
        }
    };

    fab.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', togglePanel);

    // Chat Logic (Same as before)
    const handleSend = async () => {
        const prompt = input.value.trim();
        if (!prompt) return;

        // Add User Msg
        log.innerHTML += `<div class="flex justify-end"><div class="bg-purple-600/80 text-white px-3 py-2 rounded-lg rounded-tr-none text-xs max-w-[85%]">${prompt}</div></div>`;
        log.scrollTop = log.scrollHeight;
        input.value = '';
        input.disabled = true;

        // Custom Context
        const conductorPrompt = `
        Soy un Conductor llamado ${name}. 
        No puedo asignar territorios directamente.
        Responde a mi pregunta: "${prompt}"
        `;

        try {
            const loadingId = 'loading-' + Date.now();
            log.innerHTML += `<div id="${loadingId}" class="text-gray-500 text-[10px] animate-pulse">Escribiendo...</div>`;
            log.scrollTop = log.scrollHeight;

            const response = await brain.askGemini(config.gemini_key, conductorPrompt);
            const safeResponse = response.replace(/\|\|.*?\|\|/g, '');
            const htmlResponse = safeResponse.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

            document.getElementById(loadingId).remove();

            log.innerHTML += `<div class="flex justify-start"><div class="bg-white/10 text-gray-200 px-3 py-2 rounded-lg rounded-tl-none text-xs border border-white/5 max-w-[90%]">
                ${htmlResponse}
             </div></div>`;

        } catch (err) {
            console.error(err);
            const l = log.querySelector('.animate-pulse');
            if (l) l.remove();
            log.innerHTML += `<div class="text-red-400 text-[10px] p-2">Error: ${err.message}</div>`;
        } finally {
            input.disabled = false;
            input.focus();
            log.scrollTop = log.scrollHeight;
        }
    };

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
};

/** --- RESCUE MODE (Ayudas) --- **/

function renderRescueSection(container, currentConductorName, allTerritories, config) {
    if (!container) return;

    if (!config || !config.rescue_mode) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }
    container.classList.remove('hidden');

    const now = new Date();
    const rescueCandidates = allTerritories.filter(t => {
        if (t.estado !== 'Asignado' && t.estado !== 'Pendiente') return false;
        if (t.asignado_a === currentConductorName) return false;

        const dateToCheck = t.fecha_salida ? new Date(t.fecha_salida) : (t.fecha_asignacion ? new Date(t.fecha_asignacion) : null);
        if (!dateToCheck) return false;

        const diffHrs = (now - dateToCheck) / (1000 * 60 * 60);
        return diffHrs > 24; // Overdue by more than 24 hours
    });

    if (rescueCandidates.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                <p class="text-xs text-gray-400 italic">No hay territorios que necesiten rescate en este momento. ✨</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="text-xl">🚑</span>
                <h3 class="font-bold text-gray-800 dark:text-gray-100 uppercase text-xs tracking-widest">Misiones de Rescate</h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${rescueCandidates.map(t => `
                    <div class="bg-red-50/50 dark:bg-red-950/10 border border-red-200/50 dark:border-red-900/30 rounded-2xl p-4 flex flex-col gap-3 group hover:border-red-500/30 transition-all">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-black text-gray-900 dark:text-gray-100">#${t.numero}</h4>
                                <p class="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">${t.asignado_a}</p>
                            </div>
                            <span class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[9px] font-bold">24h+ ATRASO</span>
                        </div>
                        <p class="text-[10px] text-gray-500 line-clamp-1 italic">"${t.manzanas || 'Sin manzanas específicas'}"</p>
                        <button onclick="window.handleRescueTerritory('${t.id}', '${t.numero}', '${currentConductorName}', '${t.manzanas || ''}')" 
                                class="w-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-black py-2.5 rounded-xl shadow-lg shadow-red-500/20 transition-all uppercase tracking-widest">
                            Ayudar con este territorio
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

window.handleRescueTerritory = async (id, num, newConductor, manzanas) => {
    const ok = await new Promise(resolve => {
        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-2xl border border-red-500/20 max-w-sm w-full text-center animate-bounce-in">
                <div class="text-5xl mb-4">🚑</div>
                <h3 class="text-xl font-black text-gray-900 dark:text-white mb-4">¿Confirmar Rescate?</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                    Vas a tomar el territorio <b>#${num}</b> para ayudar a terminarlo. Se notificará al conductor original.
                </p>
                <div class="flex gap-3">
                    <button id="rescue-cancel" class="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 dark:bg-white/5 rounded-2xl">Cancelar</button>
                    <button id="rescue-confirm" class="flex-1 py-3 text-sm font-black text-white bg-red-600 rounded-2xl shadow-xl shadow-red-500/30 hover:bg-red-500 transition-colors">SÍ, AYUDAR</button>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
        document.getElementById('rescue-cancel').onclick = () => { modal.classList.add('hidden'); resolve(false); };
        document.getElementById('rescue-confirm').onclick = () => { modal.classList.add('hidden'); resolve(true); };
    });

    if (!ok) return;

    try {
        showNotification("Procesando transferencia...", "info");
        await transferTerritory(id, newConductor, manzanas);
        showNotification(`¡Misión aceptada! El territorio #${num} ahora está en tu agenda.`, "success");
        // Force reload
        window.loadUnifiedDashboard();
    } catch (err) {
        console.error(err);
        showNotification("Error en el rescate: " + err.message, "error");
    }
};





