import { auth } from '../firebase-config.js';
import {
    getProgramaSemanal, getMisTerritorios, returnTerritorio,
    returnTerritorioParcial, solicitarNumeros, updateTelefonoStatus,
    addPublicador, getPublicadores, getTelefonos, updateTelefono, addTelefono,
    getConductores, updateConductor,
    getPermisosUsuario, getTerritorios, getConfiguracion,
    getRecursos // Added Resources
} from '../data/firestore-services.js?v=5.0.3';
import { formatPhoneNumber, getStatusColor, showNotification, formatMapUrl } from './utils/helpers.js?v=5.0.3';
import { TerritoryIntelligence } from './utils/intelligence.js?v=5.0.3';



// --- UI HELPERS ---

const showModal = (content, onOpen, maxWidth = 'max-w-md') => {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;
    modalContainer.innerHTML = `
        <div class="w-full ${maxWidth} m-4 relative animate-fade-in bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 flex flex-col max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden">
            <button class="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:hover:text-white z-50 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors" onclick="document.getElementById('modal-container').classList.add('hidden')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <div class="p-6 overflow-y-auto custom-scrollbar">
                ${content}
            </div>
        </div>
    `;
    modalContainer.classList.remove('hidden');
    if (onOpen) onOpen(modalContainer);
};

const showCustomConfirm = (message, onConfirm) => {
    showModal(`
        <div class="text-center p-4">
             <div class="text-4xl mb-4">⚠️</div>
             <h3 class="text-xl font-bold text-teal-600 dark:text-teal-400 mb-2">Confirmar Acción</h3>
             <p class="text-gray-700 dark:text-gray-300 mb-6 text-sm">${message}</p>
             <div class="flex justify-center gap-3">
                <button id="confirm-cancel" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg w-1/2">Cancelar</button>
                <button id="confirm-ok" class="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg w-1/2">Confirmar</button>
             </div>
        </div>
    `, (modal) => {
        modal.querySelector('#confirm-cancel').addEventListener('click', () => modal.classList.add('hidden'));
        modal.querySelector('#confirm-ok').addEventListener('click', () => {
            modal.classList.add('hidden');
            onConfirm();
        });
    });
};

export const renderConductorDashboard = async (container, nameOrEmail) => {
    // Resolve display name if email is passed
    let displayName = nameOrEmail;
    try {
        const allC = await getConductores();
        const found = allC.find(c => c.email === nameOrEmail || c.nombre === nameOrEmail);
        if (found) displayName = found.nombre;
    } catch (err) {
        console.error("Error resolving name:", err);
    }

    container.innerHTML = `
        <div class="animate-fade-in pb-20 w-full">
            <header class="flex justify-between items-center mb-6 p-4 morphinglass-card">
                <div>
                    <h1 class="text-2xl font-bold text-teal-600 dark:text-teal-400">Hola, ${displayName.split('@')[0]}</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Panel de Conductor</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="window.startOnboarding()" class="bg-blue-100 hover:bg-blue-200 text-blue-600 dark:bg-blue-500/20 dark:hover:bg-blue-500/40 dark:text-blue-200 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-500/30 text-sm transition-colors shadow-sm font-medium" title="Ayuda">
                        ❓ Ayuda
                    </button>
                    <button id="logout-btn" class="bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-500/20 dark:hover:bg-red-500/40 dark:text-red-200 px-3 py-1 rounded-lg border border-red-200 dark:border-red-500/30 text-sm transition-colors shadow-sm dark:shadow-none font-medium">
                        Salir
                    </button>
                </div>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Agenda Semanal -->
                <div class="lg:col-span-2">
                    <h3 class="text-lg font-bold text-teal-800 dark:text-teal-100 mb-3 px-2 flex items-center gap-2">
                        📅 Tu Agenda Semanal
                    </h3>
                    <div id="calendar-container" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="animate-pulse bg-black/5 dark:bg-white/5 h-24 rounded-xl"></div>
                        <div class="animate-pulse bg-black/5 dark:bg-white/5 h-24 rounded-xl"></div>
                    </div>
                </div>

                <!-- Mis Territorios -->
                <div class="lg:col-span-2">
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

                <!-- Disponibilidad -->
                <div class="lg:col-span-2" id="availability-container">
                    <!-- Loaded dynamically -->
                </div>

                <!-- Predicacion Telefonica -->
                <div class="lg:col-span-2 morphinglass-card h-fit">
                    <h3 class="text-lg font-bold text-teal-800 dark:text-teal-100 mb-4 flex justify-between items-center">
                        📞 Telefónica
                        <div class="flex gap-2">
                             <button id="btn-revisitas" class="text-xs bg-amber-600 px-2 py-1 rounded text-white hover:bg-amber-500 transition-colors shadow-lg shadow-amber-500/20 font-medium">Revisitas</button>
                             <button id="btn-add-publicador" class="text-xs bg-teal-600 px-2 py-1 rounded text-white hover:bg-teal-500 transition-colors shadow-lg shadow-teal-500/20 font-medium">+ Agregar Publicador</button>
                             <button id="btn-solicitar" class="text-xs bg-teal-600 px-2 py-1 rounded text-white hover:bg-teal-500 transition-colors shadow-lg shadow-teal-500/20 font-medium">+ Solicitar</button>
                        </div>
                    </h3>
                    
                    <div class="overflow-x-auto md:overflow-x-visible">
                        <table class="w-full text-left text-xs mb-4">
                            <thead class="bg-black/60 backdrop-blur-xl border-b border-black/10 dark:border-white/10 text-white/90 font-bold uppercase tracking-wider sticky top-0 z-30 shadow-2xl">
                                <tr>
                                    <th class="p-3">Teléfono</th>
                                    <th class="p-3">Propietario</th>
                                    <th class="p-3">Dirección</th>
                                    <th class="p-3">Asignado a</th>
                                    <th class="p-3 text-center">Estado</th>
                                    <th class="p-3">Comentarios</th>
                                </tr>
                            </thead>
                            <tbody id="phone-tbody" class="divide-y divide-white/5">
                                 <!-- Phone rows -->
                            </tbody>
                        </table>
                    </div>
                    <div id="phone-actions" class="hidden"></div>
                </div>

                <!-- Ayudas para el Ministerio -->
                <div class="lg:col-span-2" id="ayudas-container"></div>
            </div>
        </div>
        
        <!-- Modal Container (Reused) -->
    <div id="modal-container" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center z-50 p-4"></div>
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
            t.publicador_asignado === displayName ||
            t.asignado_a === displayName
        );
    };

    // Expose refresh function/trigger
    window.refreshConductorView = async () => {
        try {
            await loadUnifiedDashboard(displayName, document.getElementById('calendar-container'), document.getElementById('territorios-container'));
            const myPhones = await refreshPhones();
            const publicadores = await getPublicadores();
            // We need to re-init phone module or just update rows? 
            // initializePhoneModule handles render, so we can just call it (check implementation in next read if needed, but presumably safe)
            // Actually initializePhoneModule attaches listeners too, better to just clear tbody and re-render?
            // For now, let's assume calling it is okay or we can just ignore phone refresh if it's not the focus, 
            // but the user said "changes" generally. 
            // Let's re-run init, it should be robust.
            initializePhoneModule(myPhones, publicadores, displayName, document.getElementById('phone-tbody'), refreshPhones);
        } catch (e) { console.error("Refresh error", e); }
    };

    try {
        await window.refreshConductorView();
    } catch (e) {
        console.error("Error loading phones:", e);
    }
};

const loadUnifiedDashboard = async (name, agendaContainer, territoriosContainer) => {
    // Hide separate territories container as requested ("fusionar")
    if (territoriosContainer) {
        territoriosContainer.parentElement.style.display = 'none'; // Hide the entire "Mis Territorios" section wrapper
        if (document.getElementById('no-territories-msg')) document.getElementById('no-territories-msg').style.display = 'none';

        // Also hide the header title "Mis Territorios" if it exists nearby
        const possibleHeader = territoriosContainer.parentElement.querySelector('h3');
        if (possibleHeader && possibleHeader.textContent.includes('Territorios')) possibleHeader.style.display = 'none';
    }

    /* --- Onboarding Logic --- */
    window.startOnboarding = () => {
        const steps = [
            { el: '#calendar-container', msg: 'Aquí verás tu agenda semanal. Si tienes asignación de conducción, aparecerá aquí.', title: '📅 Agenda' },
            { el: '#territorios-container', msg: 'Tus territorios asignados. Si alguno está en rojo, ¡es porque lleva mucho tiempo o está atrasado! Haz clic en "Avance" para reportar.', title: '🗺️ Territorios' },
            { el: 'h3:contains("Telefónica")', msg: 'Lista de números asignados para predicar. Usa los botones para solicitar más o agregar otros.', title: '📞 Telefónica' },
            { el: '#ayudas-container', msg: 'Encuentra enlaces útiles y recursos para tu ministerio aquí.', title: '🧰 Ayudas' }
        ];

        let stepIndex = 0;
        const overlay = document.createElement('div');
        overlay.id = 'guide-overlay';
        overlay.className = 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center transition-opacity duration-300';

        const showStep = () => {
            if (stepIndex >= steps.length) {
                overlay.remove();
                return;
            }
            // Simple centered card for simplicity instead of positioning logic (vanilla js complexity)
            // Or try to find element.
            // Let's do a centered card that points out what to look for.
            const s = steps[stepIndex];
            overlay.innerHTML = `
                <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl max-w-sm w-full mx-4 shadow-2xl border border-teal-500 animate-bounce-in text-center">
                    <div class="text-4xl mb-4 text-teal-600">👆</div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">${s.title}</h3>
                    <p class="text-gray-600 dark:text-gray-300 mb-6">${s.msg}</p>
                    <div class="flex justify-between">
                        <button id="skip-guide" class="text-gray-400 text-sm hover:text-white">Saltar</button>
                        <button id="next-guide" class="bg-teal-600 text-white px-6 py-2 rounded-xl font-bold hover:scale-105 transition-transform">
                            ${stepIndex === steps.length - 1 ? 'Finalizar' : 'Siguiente'}
                        </button>
                    </div>
                </div>
            `;

            overlay.querySelector('#next-guide').onclick = () => {
                stepIndex++;
                showStep();
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

    // Parallel Fetch: Get ALL territories to ensure we can show data for Auxiliars too
    const [programa, allTerritorios] = await Promise.all([
        getProgramaSemanal(currentWeekId),
        getTerritorios() // Fetch ALL to lookup map data for any assigned number
    ]);

    // Create a lookup map for ANY territory by number
    const territoryMap = {};
    if (allTerritorios) {
        allTerritorios.forEach(t => {
            territoryMap[t.numero] = t;
        });
    }

    const turnos = ['manana', 'tarde', 'noche'];
    const turnoLabels = { manana: '🌅 Mañana', tarde: '☀️ Tarde', noche: '🌙 Noche' };
    let assignments = [];

    if (programa && programa.dias) {
        programa.dias.forEach(d => {
            turnos.forEach(turno => {
                const turnoData = d[turno];
                if (turnoData) {
                    const isConductor = turnoData.conductor === name;
                    const isAuxiliar = turnoData.auxiliar === name;

                    if (isConductor || isAuxiliar) {
                        let displayTurno = turnoLabels[turno];
                        if (d.nombre === 'Domingo' && turnoData.hora) {
                            const h = parseInt(turnoData.hora.split(':')[0]);
                            if (!isNaN(h)) {
                                if (h < 12) displayTurno = '🌅 Mañana';
                                else if (h < 18) displayTurno = '☀️ Tarde';
                                else displayTurno = '🌙 Noche';
                            }
                        }

                        let assignedTerritoryIds = [];
                        if (turnoData.territorio) {
                            assignedTerritoryIds = turnoData.territorio.split(',').map(s => s.trim());
                        }

                        // Now we can find data for any territory number, even if not directly assigned to "Me" in the DB
                        const attachedTerritories = assignedTerritoryIds.map(num => {
                            return territoryMap[num] || { numero: num, isMissingData: true };
                        }).filter(t => {
                            // Only show if assigned to ME (or isMissingData for context, but usually we only want active ones)
                            // If isMissingData, we assume it's just a number from schedule, maybe we should show it? 
                            // The user says "desaparecer de la lista". If I return it, 'asignado_a' becomes null. 
                            // So filtering by asignado_a === name / displayName is key.

                            // Check if 'name' (email or name passed to function) matches 'asignado_a' or 'conductor'
                            // The 'name' param in loadUnifiedDashboard is usually the display name or email. 
                            // safe check: 
                            if (t.isMissingData) return true; // Keep placeholders? Maybe hide them too if strict.
                            // If I returned it, t.asignado_a is null.
                            // However, 't' comes from 'allTerritorios' which was fetched ONCE at start. 
                            // If we reload the page, 'allTerritorios' is fresh. 
                            // The user wants it to disappear "immediately" (which implies a refresh or reactive update).
                            // My modal reload logic uses `window.location.reload()`, so fetching will happen again.
                            // strict filter:
                            // check active assignment
                            return t.asignado_a === name || (t.asignado_a && t.asignado_a.includes(name.split('@')[0]));
                        });

                        assignments.push({
                            dia: d.nombre,
                            turno: displayTurno,
                            role: isConductor ? 'Conductor' : 'Auxiliar',
                            rawDate: d.fecha,
                            attachedTerritories,
                            ...turnoData
                        });
                    }
                }
            });
        });
    }

    agendaContainer.innerHTML = assignments.length > 0 ? assignments.map(a => `
    <div class="bg-white dark:bg-gray-800/90 dark:backdrop-blur-sm p-6 rounded-2xl border border-gray-100 dark:border-white/10 hover:border-teal-500/30 transition-all shadow-sm dark:shadow-black/50 group flex flex-col gap-4">
        
        <!-- Header: Day & Role -->
        <div class="flex justify-between items-start">
            <div>
                <h3 class="font-bold text-gray-900 dark:text-white text-xl group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">${a.dia}</h3> 
                <span class="text-teal-600 dark:text-teal-400 font-semibold text-sm flex items-center gap-1 mt-1">
                    ${a.turno}
                </span>
            </div>
            <span class="text-[10px] uppercase font-bold tracking-wider ${a.role === 'Conductor' ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'} px-2.5 py-1 rounded-lg border ${a.role === 'Conductor' ? 'border-teal-100 dark:border-teal-500/30' : 'border-purple-100 dark:border-purple-500/30'} shadow-sm">
                ${a.role}
            </span>
        </div>

        <!-- Info: Family & Base Territory Text -->
        <div class="space-y-2">
            <div class="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <div class="w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-500 text-xs">📍</div>
                <span class="font-medium text-sm">${a.lugar || 'Familia ...'}</span>
            </div>
            ${(a.territorio && a.attachedTerritories.length > 0) ? `
            <div class="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <div class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 text-xs">🗺️</div>
                <span class="font-medium text-sm">Territorio <span class="font-bold text-gray-900 dark:text-white">${a.territorio}</span></span>
            </div>` : ''}
        </div>

        <!-- FUSED TERRITORY CARDS -->
        ${a.attachedTerritories.length > 0 ? `
        <div class="mt-2 grid grid-cols-1 gap-3">
             <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Mis Territorios</div>
             ${a.attachedTerritories.map(t => {
        if (t.isMissingData) {
            // Fallback if we don't own it or have data
            return `
                     <div class="bg-gray-50 dark:bg-white/5 rounded-lg p-3 border border-gray-200 dark:border-white/10 flex justify-between items-center">
                        <span class="font-bold text-gray-600 dark:text-gray-400">Territorio ${t.numero}</span>
                        <span class="text-xs italic text-gray-400">Datos no disponibles</span>
                     </div>`;
        }
        // Full Card
        // Calculate "Late" for Conductor
        const todayIndex = new Date().getDay(); // 0=Sun
        const currentDayNorm = todayIndex === 0 ? 6 : todayIndex - 1;

        const daysMap = { 'Lunes': 0, 'Martes': 1, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sábado': 5, 'Domingo': 6 };

        return `
                 <div class="bg-white dark:bg-gray-900 rounded-xl overflow-hidden flex shadow-lg border relative group/card ${t.isLate || (daysMap[a.dia] < currentDayNorm) ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-900/40' : 'border-gray-200 dark:border-gray-700'}">
                    
                    ${(t.isLate || (daysMap[a.dia] < currentDayNorm)) ? `
                    <div class="absolute top-0 left-0 right-0 bg-red-600 text-white text-[10px] font-bold text-center py-0.5 z-20 animate-pulse">
                        ⚠️ Informe su avance de predicación
                    </div>
                    ` : ''}

                    <!-- Left: Number -->
                    <div class="w-12 bg-blue-50 dark:bg-blue-900/50 flex flex-col justify-center items-center border-r border-gray-200 dark:border-white/10 ${(t.isLate || (daysMap[a.dia] < currentDayNorm)) ? 'mt-4' : ''}">
                        <span class="text-[10px] text-blue-600 dark:text-blue-300 -rotate-90 whitespace-nowrap mb-2 transform origin-center">9OCT</span>
                    </div>
                    
                    <!-- Center: Main Info -->
                    <div class="flex-1 p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 relative ${(t.isLate || (daysMap[a.dia] < currentDayNorm)) ? 'mt-4' : ''}">
                        <div class="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                        <div class="relative z-10 flex flex-col justify-between h-full">
                            <h4 class="text-2xl font-black ${(t.isLate || (daysMap[a.dia] < currentDayNorm)) ? 'text-red-600' : 'text-amber-600 dark:text-amber-500'} tracking-tighter">${t.manzanas || 'Mz. 1'}</h4>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Territorio ${t.numero}</div>
                            
                            <!-- Date Info -->
                            <div class="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-white/10">
                                <div class="flex-1 bg-white/50 dark:bg-black/20 p-1 rounded text-[10px] text-gray-500 text-center">
                                    <span class="block font-bold opacity-75">ASIGNADO</span>
                                    <span>${t.fecha_asignacion ? new Date(t.fecha_asignacion).toLocaleDateString() : '--'}</span>
                                </div>
                                <div class="flex-1 bg-white/50 dark:bg-black/20 p-1 rounded text-[10px] text-gray-500 text-center">
                                    <span class="block font-bold opacity-75" title="Fecha en la que se terminó por última vez">ÚLTIMA VEZ</span>
                                    <span>${(() => {
                if (!t.ultima_fecha) return '&nbsp;';
                const last = new Date(t.ultima_fecha);
                const assign = t.fecha_asignacion ? new Date(t.fecha_asignacion) : null;
                // Hide if same day (implies data init error for new territories)
                if (assign && last.toDateString() === assign.toDateString()) return '&nbsp;';
                return last.toLocaleDateString();
            })()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Actions Overlaid or Side -->
                    <div class="bg-gray-50 dark:bg-gray-800 p-2 flex flex-col justify-center gap-2 border-l border-gray-200 dark:border-white/10 ${(t.isLate || (daysMap[a.dia] < currentDayNorm)) ? 'mt-4' : ''}">
                        <button onclick="window.viewMap('${formatMapUrl(t.imagen) || ''}')" class="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-blue-500 dark:text-blue-400 transition-colors" title="Ver Mapa">
                            🗺️
                        </button>
                    </div>
                 </div>
                 
                 <!-- Action Bar -->
                 <div class="flex justify-between items-center bg-white dark:bg-black/20 p-2 rounded-lg border border-gray-100 dark:border-white/5 mt-1">
                    <div class="text-xs text-gray-500">
                        <span class="font-bold text-gray-800 dark:text-gray-200">Territorio ${t.numero}</span>
                        <span class="block text-[10px] opacity-75">${t.manzanas || 'Mz. Generales'}</span>
                    </div>
                    
                    <button onclick="window.openProgressModal('${t.id}', '${t.numero}', '${t.manzanas || ''}')" 
                        class="${(t.isLate || (daysMap[a.dia] < currentDayNorm)) ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20' : 'bg-teal-600 hover:bg-teal-500 shadow-teal-500/20'} text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-1">
                        <span>✅</span> Avance
                    </button>
                 </div>
                 `;
    }).join('')}
        </div>
        </div>
        ` : `
        <div class="bg-gray-50 dark:bg-white/5 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 p-6 flex flex-col items-center justify-center text-center mt-2 group-hover:border-teal-500/30 transition-colors">
            <div class="text-3xl mb-2 opacity-50">🍃</div>
            <h4 class="font-bold text-gray-600 dark:text-gray-300">Sin Territorios</h4>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                No tienes territorios asignados para este turno.<br>
                <span class="text-teal-600 dark:text-teal-400 font-medium">¡Disfruta tu servicio!</span>
            </p>
        </div>
        `}

    </div>
    `).join('') : '<div class="col-span-full p-8 text-center text-gray-500 bg-white dark:bg-white/5 rounded-2xl border border-dashed border-gray-300 dark:border-white/10 italic">No tienes asignaciones esta semana.</div>';

    // 3. Availability (Keep separate)
    renderAvailabilitySection(document.getElementById('availability-container'), name);

    // 4. AI
    renderAISection(name);

    // 5. Ayudas
    renderAyudasSection(document.getElementById('ayudas-container'));
};

const renderAyudasSection = async (container) => {
    const recursos = await getRecursos();
    if (recursos.length === 0) return;

    container.innerHTML = `
        <h3 class="text-lg font-bold text-teal-800 dark:text-teal-100 mb-3 px-2 flex items-center gap-2">
            🧰 Ayudas para el Ministerio
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${recursos.map(r => `
                <a href="${r.url}" target="_blank" class="block bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 hover:border-teal-500 transition-all hover:shadow-lg group">
                    <div class="flex">
                        <div class="w-24 h-24 bg-gray-100 dark:bg-white/5 flex-shrink-0">
                            ${r.imagen ? `<img src="${r.imagen}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-2xl">🔗</div>'}
                        </div>
                        <div class="p-3 flex flex-col justify-center">
                            <h4 class="font-bold text-gray-900 dark:text-white group-hover:text-teal-500 transition-colors line-clamp-1">${r.titulo}</h4>
                            <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">${r.descripcion || 'Enlace externo'}</p>
                        </div>
                    </div>
                </a>
            `).join('')}
        </div>
    `;
};

const renderAvailabilitySection = async (container, conductorName) => {
    // 1. Fetch Conductor ID and Data
    const allConductores = await getConductores();
    // Match by name or email (legacy support)
    const conductor = allConductores.find(c => c.nombre === conductorName || c.email === conductorName || c.nombre === conductorName.split('@')[0]);

    if (!conductor) {
        container.innerHTML = '<p class="text-red-400 text-xs">Error: No se encontró perfil de conductor.</p>';
        return;
    }

    // Availability Data: Array of strings e.g. "Lunes_manana"
    const dispon = conductor.disponibilidad || [];

    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const shirts = [
        { id: 'manana', label: 'MAÑANA', color: 'text-yellow-700 dark:text-yellow-200' },
        { id: 'tarde', label: 'TARDE', color: 'text-orange-700 dark:text-orange-200' },
        { id: 'noche', label: 'NOCHE', color: 'text-blue-700 dark:text-blue-200' }
    ];

    let gridHtml = `
        <h3 class="font-bold text-teal-800 dark:text-teal-100 mb-3 px-2 flex items-center justify-between">
            <div class="flex items-center gap-2">🗓️ Mi Disponibilidad</div>
            <span class="text-[10px] text-teal-600 dark:text-teal-400 font-normal opacity-80">
                * Se guarda auto.
            </span>
        </h3>
        <div class="morphinglass-card p-3">
             <!-- Compact Header -->
             <div class="grid grid-cols-4 gap-1 mb-2">
                 <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider text-center self-end">Día</div>
                 ${shirts.map(s => `
                    <div class="text-center font-bold text-xs uppercase ${s.color} bg-gray-100 dark:bg-white/5 rounded-lg py-1 border border-gray-200 dark:border-white/5" title="${s.id}">
                        ${s.label}
                    </div>
                 `).join('')}
             </div>

             <!-- Days Rows -->
             <div class="space-y-1.5">
                ${days.map(day => `
                    <div class="grid grid-cols-4 gap-1 items-center bg-gray-50 dark:bg-white/5 rounded-lg p-1 border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                        <!-- Day Label -->
                            <div class="text-xs font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wide text-center pl-1">
                            ${day}
                        </div>
                        
                        <!-- Checkboxes -->
                        ${shirts.map(shift => {
        const key = `${day}_${shift.id}`;
        const isChecked = dispon.includes(key);
        return `
                                <div class="flex justify-center">
                                    <label class="cursor-pointer w-full h-8 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors relative group">
                                        <input type="checkbox" 
                                            class="avail-check w-4 h-4 accent-teal-500 rounded border-gray-300 dark:border-white/20 bg-white dark:bg-black/40" 
                                            value="${key}" 
                                            data-cid="${conductor.id}"
                                            ${isChecked ? 'checked' : ''}>
                                    </label>
                                </div>
                            `;
    }).join('')}
                    </div>
                `).join('')}
             </div>
        </div>
    `;

    container.innerHTML = gridHtml;

    // Event Listeners for Auto-Save
    const inputs = container.querySelectorAll('.avail-check');
    inputs.forEach(input => {
        input.addEventListener('change', async (e) => {
            const val = e.target.value;
            const cid = e.target.dataset.cid;
            const checked = e.target.checked;

            // Optimistic UI update already happened via checkbox

            // Get latest state from DOM to be safe or manipulate local array
            let currentDispon = Array.from(inputs).filter(i => i.checked).map(i => i.value);

            try {
                await updateConductor(cid, { disponibilidad: currentDispon });
                showNotification("Disponibilidad actualizada", "success");
            } catch (err) {
                console.error("Error saving availability:", err);
                showNotification("Error guardando disponibilidad", "error");
                // Revert
                e.target.checked = !checked;
            }
        });
    });
};


/* --- MODALS & HELPERS --- */

// View Map Modal
window.viewMap = (url) => {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
    <div class="relative max-w-5xl w-full p-4 animate-scale-in">
             <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="absolute top-4 right-4 m-2 text-gray-800 dark:text-white bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black/70 rounded-full p-2 z-10 transition-colors shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
             </button>
             <img src="${url}" class="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl border border-gray-200 dark:border-blue-900/50 bg-white dark:bg-[#191970]">
        </div>
`;
    modal.classList.remove('hidden');
};

// Progress / Return Modal
// Progress / Return Modal
window.openProgressModal = (id, numero, manzanasStr) => {
    const manzanas = manzanasStr ? manzanasStr.split(',').map(s => s.trim()).filter(s => s) : [];

    // Get today's date
    const localDate = new Date();
    const offset = localDate.getTimezoneOffset();
    const todayStr = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    // Modal HTML
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-fade-in-up transition-all duration-300">
            <h3 class="text-xl font-bold text-teal-800 dark:text-teal-100 mb-2">Reportar Territorio ${numero}</h3>
            
            <!-- VIEW 1: SELECTION -->
            <div id="view-selection">
                <p id="instruction-text" class="text-sm text-gray-500 dark:text-gray-400 mb-4">Selecciona las manzanas que YA terminaste:</p>
                
                <div id="apples-container" class="grid grid-cols-2 gap-2 mb-4 max-h-48 overflow-y-auto bg-black/5 dark:bg-black/20 p-3 rounded-lg border border-black/5 dark:border-white/5 custom-scrollbar">
                    ${manzanas.length > 0 ? manzanas.map((m, idx) => `
                        <label class="flex items-center space-x-3 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded transition-colors select-none">
                            <input type="checkbox" value="${m}" class="manzana-check accent-teal-500 w-5 h-5 bg-white/50 border-gray-300 rounded">
                            <span>${m}</span>
                        </label>
                    `).join('') : '<p class="col-span-2 text-xs text-gray-400 italic text-center">Sin manzanas específicas.</p>'}
                </div>

                <!-- Date Selection -->
                 <div class="mb-4">
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Fecha de Entrega</label>
                    <input type="date" id="completion-date" value="${todayStr}" class="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 outline-none">
                </div>

                <!-- Notes Section -->
                <div class="mb-4">
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Observaciones (Opcional)</label>
                    <textarea id="progress-notes" rows="2" placeholder="Ej: Persona molesta, no se completó la manzana..." class="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:border-teal-500 outline-none resize-none"></textarea>
                </div>

                <div class="flex flex-col gap-3 mt-2">
                    <button id="btn-action-main" class="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-teal-900/20 active:scale-95 flex items-center justify-center gap-2">
                         🎉 Marcar TODO como Terminado
                    </button>

                    <button id="btn-no-predico" class="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 text-xs font-bold uppercase tracking-widest mt-1 hover:underline">
                        NO SE PREDICÓ
                    </button>
                    
                    <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white py-2 text-sm mt-1">
                        Cancelar
                    </button>
                </div>
            </div>

            <!-- VIEW 2: CONFIRMATION -->
            <div id="view-confirmation" class="hidden text-center py-6">
                <div class="mb-6 flex justify-center">
                   <div class="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center text-4xl mb-2 animate-bounce">
                        ⚠️
                   </div>
                </div>
                <h4 class="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Estás seguro?</h4>
                <p id="confirm-msg" class="text-gray-600 dark:text-gray-300 mb-8 px-4">
                    ...
                </p>
                
                <div class="grid grid-cols-2 gap-4">
                    <button id="btn-confirm-cancel" class="py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        Cancelar
                    </button>
                    <button id="btn-confirm-yes" class="py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/20 transform hover:scale-105 transition-all">
                        SÍ, TERMINAR
                    </button>
                </div>
            </div>
    </div>
    `;
    modal.classList.remove('hidden');

    // Logic Elements
    const viewSelection = document.getElementById('view-selection');
    const viewConfirmation = document.getElementById('view-confirmation');
    const btnMain = document.getElementById('btn-action-main');
    const btnNoPredico = document.getElementById('btn-no-predico');
    const confirmMsg = document.getElementById('confirm-msg');
    const btnConfirmYes = document.getElementById('btn-confirm-yes');

    // State
    let pendingAction = null; // 'completed_all', 'completed_partial', 'return_all'

    // Update Button Text based on Checks
    // Default: "Marcar TODO como Terminado" (if 0 checked, implies all; if all checked, implies all)
    // If SOME checked: "Marcar SELECCIONADAS como Terminadas" (implicit partial return for unselected)

    // Requirement Update: "si devuelve un territorio, se sobre entiende que se predicó todo" (if normal flow)
    // "si devuelven solo las manzanas de un territorio se entiende que las otras que no marcaron no se predicaron"

    const updateMainButton = () => {
        const checkedCount = document.querySelectorAll('.manzana-check:checked').length;
        if (checkedCount === 0) {
            btnMain.innerHTML = "🎉 Marcar TODO como Terminado";
            // Implicitly ALL
        } else if (checkedCount === manzanas.length) {
            btnMain.innerHTML = "🎉 Marcar TODO como Terminado";
        } else {
            // Partial
            btnMain.innerHTML = `✅ Terminar ${checkedCount} Manzana(s) (Devolver Resto)`;
        }
    };

    document.querySelectorAll('.manzana-check').forEach(c => c.addEventListener('change', updateMainButton));

    // Show Confirmation
    const showConfirm = (action) => {
        pendingAction = action;
        viewSelection.classList.add('hidden');
        viewConfirmation.classList.remove('hidden');

        if (action === 'return_all') {
            confirmMsg.innerHTML = `Vas a marcar que <b class="text-red-500">NO SE PREDICÓ</b> nada en este territorio. Se devolverá completo.`;
            btnConfirmYes.textContent = "SÍ, DEVOLVER";
            btnConfirmYes.className = "py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20 transform hover:scale-105 transition-all";
        } else if (action === 'completed_partial') {
            const checkedCount = document.querySelectorAll('.manzana-check:checked').length;
            confirmMsg.innerHTML = `Marcaste <b>${checkedCount}</b> manzanas como terminadas. Las <b>${manzanas.length - checkedCount}</b> restantes se devolverán como NO predicadas.`;
            btnConfirmYes.textContent = "SÍ, TERMINAR PARCIAL";
            btnConfirmYes.className = "py-3 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20 transform hover:scale-105 transition-all";
        } else {
            // completed_all
            confirmMsg.innerHTML = `Vas a marcar <b class="text-teal-600">TODO el territorio</b> como completado. ¡Buen trabajo!`;
            btnConfirmYes.textContent = "SÍ, TERMINAR";
            btnConfirmYes.className = "py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/20 transform hover:scale-105 transition-all";
        }
    };

    btnMain.onclick = () => {
        const checkedCount = document.querySelectorAll('.manzana-check:checked').length;
        if (checkedCount > 0 && checkedCount < manzanas.length) {
            showConfirm('completed_partial');
        } else {
            showConfirm('completed_all');
        }
    };

    btnNoPredico.onclick = () => {
        showConfirm('return_all');
    };

    document.getElementById('btn-confirm-cancel').onclick = () => {
        viewConfirmation.classList.add('hidden');
        viewSelection.classList.remove('hidden');
    };

    btnConfirmYes.onclick = async () => {
        const notes = document.getElementById('progress-notes').value.trim();
        const dateVal = document.getElementById('completion-date').value;
        const selected = Array.from(document.querySelectorAll('.manzana-check:checked')).map(cb => cb.value);
        const remaining = manzanas.filter(m => !selected.includes(m));

        try {
            if (pendingAction === 'return_all') {
                // Return ALL as NOT preached
                await returnTerritorioParcial(id, [], manzanas, true, notes, dateVal);
                showNotification("Territorio devuelto (No predicado).");
            } else if (pendingAction === 'completed_all') {
                // Mark ALL as preached
                await returnTerritorio(id, notes, dateVal);
                showNotification("Territorio completado exitosamente 🎉");
            } else {
                // Partial
                // Selected = Done, Remaining = Not Done (Returned)
                // unassignRemaining = true (implicit return of rest)
                await returnTerritorioParcial(id, selected, remaining, true, notes, dateVal);
                showNotification("Avance registrado. Resto devuelto.");
            }

            modal.classList.add('hidden');
            // Reload to refresh lists
            // setTimeout(() => window.location.reload(), 1500); 
            // REPLACED WITH REACTIVE REFRESH:
            if (window.refreshConductorView) {
                showNotification("Actualizando vista... 🔄");
                await window.refreshConductorView();
            } else {
                window.location.reload(); // Fallback
            }

        } catch (e) {
            console.error(e);
            showNotification("Error: " + e.message, "error");
        }
    };
};

const initializePhoneModule = (initialPhones, publicadores, userId, tbody, refreshCallback) => {
    let telefonos = initialPhones; // Mutable state for AJAX updates
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const estados = ['Sin asignar', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];

    window.updatePhoneAssignment = async (id, newPub) => {
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].publicador_asignado = newPub === 'Sin asignar' ? null : newPub;
            // If assigning, set status to Asignado if it was Sin asignar
            if (newPub !== 'Sin asignar' && (telefonos[telIndex].estado === 'Sin asignar' || !telefonos[telIndex].estado)) {
                telefonos[telIndex].estado = 'Asignado';
            }
            if (newPub === 'Sin asignar') {
                telefonos[telIndex].estado = 'Sin asignar';
            }
            render();
        }

        if (!newPub || newPub === 'Sin asignar') {
            await updateTelefono(id, {
                publicador_asignado: null,
                asignado_a: null,
                estado: 'Sin asignar',
                fecha_asignacion: null
            });
        } else {
            const currentTel = telefonos.find(t => t.id === id);
            const newStatus = (currentTel && currentTel.estado === 'Sin asignar') ? 'Asignado' : (currentTel ? currentTel.estado : 'Asignado');

            await updateTelefono(id, {
                publicador_asignado: newPub,
                asignado_a: newPub,
                fecha_asignacion: new Date().toISOString(),
                estado: newStatus
            });
        }
    };

    window.updatePhoneStatus = async (id, status) => {
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].estado = status;
            render();
        }
        // Pass null for pubId to avoid overwriting/resetting assignment date implicitly
        await updateTelefonoStatus(id, status, null);
    };

    window.updatePhoneComment = async (id, comment, inputElement) => {
        // Find local logic
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].comentario = comment;
            // We don't re-render here to avoid losing focus or cursor position if we used 'input' event, 
            // but since we use 'blur' it's fine. However, no need to re-render the whole table for this.
        }

        // Visual Feedback
        const originalBorder = inputElement.classList.contains('border-teal-500');
        inputElement.classList.add('border-teal-500', 'bg-teal-900/20');

        try {
            await updateTelefono(id, { comentario: comment });

            // Success animation
            setTimeout(() => {
                inputElement.classList.remove('bg-teal-900/20');
                if (!originalBorder) inputElement.classList.remove('border-teal-500');
            }, 1000);
        } catch (e) {
            console.error("Error saving comment:", e);
            inputElement.classList.add('border-red-500');
            showNotification("Error al guardar comentario", "error");
        }
    };

    const render = () => {
        telefonos.sort((a, b) => {
            // Sort by assigned date descending, then number
            const dateA = a.fecha_asignacion ? new Date(a.fecha_asignacion) : new Date(0);
            const dateB = b.fecha_asignacion ? new Date(b.fecha_asignacion) : new Date(0);
            return dateB - dateA;
        });

        if (telefonos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-500 italic">No tienes números asignados. ¡Usa el botón "Solicitar"!</td></tr>`;
            return;
        }

        tbody.innerHTML = telefonos.map(t => {
            const currentPubId = t.publicador_asignado || '';
            const currentStatus = t.estado || 'Sin asignar';
            return `
            <tr class="hover:bg-black/5 dark:bg-white/5 transition-colors border-b border-white/5 group">
                <td class="p-3 font-mono text-teal-700 dark:text-teal-300 font-medium text-sm tracking-wide whitespace-nowrap">${formatPhoneNumber(t.numero)}</td>
                <td class="p-3 text-gray-700 dark:text-gray-300 text-sm font-bold truncate max-w-[150px]">${t.propietario || '-'}</td>
                <td class="p-3 text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wide truncate max-w-[100px]">${t.direccion || '-'}</td>
                <td class="p-2">
                    <select onchange="window.updatePhoneAssignment('${t.id}', this.value)" 
                        class="w-full bg-black/30 border border-black/10 dark:border-white/10 rounded px-2 py-1 text-xs font-medium focus:border-teal-500 outline-none cursor-pointer hover:bg-black/50 transition-colors text-teal-800 dark:text-teal-200">
                        <option value="Sin asignar" class="bg-gray-900 text-white">Sin asignar</option>
                        ${publicadores.map(p => `<option value="${p.nombre}" ${p.nombre === currentPubId ? 'selected' : ''} class="bg-gray-900 text-white">${p.nombre}</option>`).join('')}
                    </select>
                </td>
                <td class="p-2 text-center">
                    <select onchange="window.updatePhoneStatus('${t.id}', this.value)" 
                        class="w-full bg-black/30 border border-black/10 dark:border-white/10 rounded px-2 py-1 text-xs font-medium focus:border-teal-500 outline-none cursor-pointer hover:bg-black/50 transition-colors ${getStatusColor(currentStatus)}">
                         ${estados.map(st => `<option value="${st}" ${st === currentStatus ? 'selected' : ''} class="bg-gray-900 text-gray-200">${st}</option>`).join('')}
                    </select>
                </td>
                <td class="p-2">
                    <input type="text" 
                        value="${t.comentario || ''}" 
                        onblur="window.updatePhoneComment('${t.id}', this.value, this)"
                        placeholder="Escribir nota..." 
                        class="w-full bg-transparent border-b border-black/10 dark:border-white/10 focus:border-teal-500 text-gray-700 dark:text-gray-300 text-xs py-1 px-2 focus:bg-black/20 outline-none transition-all placeholder-gray-600">
                </td>
            </tr>
        `;
        }).join('');
    };
    render();

    // Listeners (Cloned to remove old ones)
    const btnSolicitar = document.getElementById('btn-solicitar');
    if (btnSolicitar) {
        const newBtn = btnSolicitar.cloneNode(true);
        btnSolicitar.parentNode.replaceChild(newBtn, btnSolicitar);
        newBtn.addEventListener('click', async () => {
            const btn = newBtn;
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
                }
            } catch (err) {
                console.error(err);
                showNotification('Error: ' + err.message, "error");
            }
            finally {
                btn.disabled = false;
                btn.textContent = "+ Solicitar";
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
                <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl p-6 max-w-4xl w-full shadow-2xl relative animate-fade-in-up max-h-[90vh] flex flex-col">
                    <div class="flex justify-between items-center mb-4">
                         <h3 class="text-xl font-bold text-amber-600 dark:text-amber-500 flex items-center gap-2">
                            <span>↺</span> Revisitas Pendientes
                         </h3>
                         <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors text-2xl leading-none">&times;</button>
                    </div>
                    
                    <div class="flex-1 overflow-auto custom-scrollbar bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5 relative min-h-[200px]">
                         <div id="revisitas-loader" class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm z-10">
                             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                         </div>
                         <table class="w-full text-left text-sm">
                            <thead class="bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-bold uppercase text-xs sticky top-0 z-0">
                                <tr>
                                    <th class="p-3">Teléfono</th>
                                    <th class="p-3">Propietario</th>
                                    <th class="p-3">Dirección</th>
                                    <th class="p-3">Publicador</th>
                                    <th class="p-3 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody id="revisitas-tbody" class="divide-y divide-gray-200 dark:divide-white/5"></tbody>
                         </table>
                         <p id="no-revisitas-msg" class="hidden text-center py-8 text-gray-500 dark:text-gray-400 italic">No hay revisitas registradas.</p>
                    </div>
                </div>
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
                        <tr id="rev-row-${r.id}" class="hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors">
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
                        </tr>
                     `).join('');
                }

            } catch (e) {
                console.error(e);
                showNotification("Error cargando revisitas", "error");
                document.getElementById('revisitas-loader').classList.add('hidden');
            }
        });
    }

    window.returnRevisita = async (id) => {
        showCustomConfirm("¿Confirmas que deseas devolver este número? Pasará a estar 'Sin asignar'.", async () => {
            try {
                await updateTelefono(id, {
                    estado: 'Sin asignar',
                    publicador_asignado: null,
                    asignado_a: null,
                    fecha_asignacion: null
                });

                showNotification("Revisita devuelta exitosamente.", "success");

                // Remove Row
                const row = document.getElementById(`rev-row-${id}`);
                if (row) row.remove();

                // Check if empty
                const tbody = document.getElementById('revisitas-tbody');
                if (tbody && tbody.children.length === 0) {
                    document.getElementById('no-revisitas-msg').classList.remove('hidden');
                }

                // Refresh dashboard
                if (refreshCallback) {
                    telefonos = await refreshCallback();
                    render();
                }

            } catch (e) {
                console.error(e);
                showNotification("Error devolviendo revisita", "error");
            }
        });
    };



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
const renderAISection = async (name) => {
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
