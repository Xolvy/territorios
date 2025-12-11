import {
    getProgramaSemanal, getMisTerritorios, returnTerritorio,
    returnTerritorioParcial, solicitarNumeros, updateTelefonoStatus,
    addPublicador, getPublicadores, getTelefonos, updateTelefono, addTelefono,
    getPermisosUsuario // Just in case
} from '../data/firestore-services.js?v=3.1';
import { formatPhoneNumber, getStatusColor } from './utils/helpers.js';

export const renderConductorDashboard = async (container, nameOrEmail) => {
    // Determine display name (if email is passed, we might want to show name, but for now use what's passed)
    const displayName = nameOrEmail;

    container.innerHTML = `
        <div class="animate-fade-in pb-20 w-fit md:w-full">
            <header class="flex justify-between items-center mb-6 p-4 morphinglass-card sticky top-0 z-20 backdrop-blur-md">
                <div>
                    <h1 class="text-2xl font-bold text-teal-400">Hola, ${displayName.split('@')[0]}</h1>
                    <p class="text-sm text-gray-400">Panel de Conductor</p>
                </div>
                <button id="logout-btn" class="bg-red-500/20 hover:bg-red-500/40 text-red-200 px-3 py-1 rounded-lg border border-red-500/30 text-sm transition-colors">
                    Salir
                </button>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Agenda Semanal -->
                <div class="lg:col-span-3">
                    <h3 class="text-lg font-bold text-teal-100 mb-3 px-2 flex items-center gap-2">
                        📅 Tu Agenda Semanal
                    </h3>
                    <div id="calendar-container" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="animate-pulse bg-white/5 h-24 rounded-xl"></div>
                        <div class="animate-pulse bg-white/5 h-24 rounded-xl"></div>
                    </div>
                </div>

                <!-- Mis Territorios -->
                <div class="lg:col-span-2">
                    <h3 class="text-lg font-bold text-teal-100 mb-3 px-2 flex items-center gap-2">
                        🗺️ Mis Territorios
                    </h3>
                    <div id="territorios-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div class="animate-pulse bg-white/5 h-48 rounded-xl"></div>
                    </div>
                    <p id="no-territories-msg" class="hidden text-center text-gray-400 py-8 bg-black/20 rounded-xl border border-white/5 mt-2">
                        No tienes territorios asignados actualmente.
                    </p>
                </div>

                <!-- Predicacion Telefonica -->
                <div class="lg:col-span-1 morphinglass-card h-fit">
                    <h3 class="text-lg font-bold text-teal-100 mb-4 flex justify-between items-center">
                        📞 Telefónica
                        <button id="btn-solicitar" class="text-xs bg-teal-600 px-2 py-1 rounded text-white hover:bg-teal-500 transition-colors">+ Solicitar</button>
                    </h3>
                    
                    <div class="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                        <table class="w-full text-left text-xs mb-4">
                            <tbody id="phone-tbody" class="divide-y divide-white/5">
                                 <!-- Phone rows -->
                            </tbody>
                        </table>
                    </div>
                    <div id="phone-actions" class="border-t border-white/10 pt-4 mt-2">
                         <button id="btn-add-pub-temp" class="text-xs text-gray-500 hover:text-gray-300 w-full text-center">
                            + Agregar Contacto (Manual)
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Modal Container (Reused) -->
        <div id="modal-container" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center z-50 p-4"></div>
    `;

    document.getElementById('logout-btn').addEventListener('click', () => {
        // Simple logout for demo
        localStorage.removeItem('demo_role');
        window.location.reload();
    });

    // Initialize Sub-Modules
    loadUnifiedDashboard(displayName, document.getElementById('calendar-container'), document.getElementById('territorios-container'));

    // Initialize Phone Module
    // Fetch data specifically for this user or all (filtered client side)
    try {
        const allPhones = await getTelefonos();
        // Filter phones: Assigned to me, OR assigned to 'Usuario' (legacy) if I am a generic user, 
        // OR simply pass all and let the component filter? 
        // initializePhoneModule expects ALL phones usually if it handles filtering, or just mine.
        // Let's pass filtering for "My Phones".
        // Logic: assigned_to == displayName OR publicador_asignado == displayName
        const myPhones = allPhones.filter(t =>
            t.publicador_asignado === displayName ||
            t.asignado_a === displayName
        );

        const publicadores = await getPublicadores();

        // Ensure we pass a valid userId/Name
        initializePhoneModule(myPhones, publicadores, displayName, document.getElementById('phone-tbody'));

    } catch (e) {
        console.error("Error loading phones:", e);
    }
};

const loadUnifiedDashboard = async (name, agendaContainer, territoriosContainer) => {
    // 1. Load Agenda (Parallel)
    getProgramaSemanal().then(programa => {
        const turnos = ['manana', 'tarde', 'noche'];
        const turnoLabels = { manana: '🌅 Mañana', tarde: '☀️ Tarde', noche: '🌙 Noche' };
        let assignments = [];

        if (programa && programa.dias) {
            programa.dias.forEach(d => {
                turnos.forEach(turno => {
                    const turnoData = d[turno];
                    if (turnoData) {
                        if (turnoData.conductor === name) assignments.push({ dia: d.nombre, turno: turnoLabels[turno], role: 'Conductor', ...turnoData });
                        if (turnoData.auxiliar === name) assignments.push({ dia: d.nombre, turno: turnoLabels[turno], role: 'Auxiliar', ...turnoData });
                    }
                });
            });
        }

        agendaContainer.innerHTML = assignments.length > 0 ? assignments.map(a => `
             <div class="bg-gradient-to-br from-teal-900/40 to-black/40 p-4 rounded-xl border border-teal-500/20 hover:border-teal-400/50 transition-colors">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="font-bold text-teal-100 block text-lg">${a.dia}</span> 
                        <span class="text-teal-400 font-medium text-sm flex items-center gap-1">${a.turno}</span>
                    </div>
                    <span class="text-[10px] uppercase font-bold tracking-wider bg-teal-500/20 text-teal-300 px-2 py-1 rounded border border-teal-500/20">${a.role}</span>
                </div>
                <div class="mt-3 text-sm text-gray-300 flex flex-col gap-1.5 border-t border-white/5 pt-2">
                    <span class="flex items-center gap-2"><span class="opacity-50">📍</span> ${a.lugar || 'Sin lugar'}</span>
                    <span class="flex items-center gap-2"><span class="opacity-50">🗺️</span> Territorio ${a.territorio || '?'}</span>
                </div>
            </div>
        `).join('') : '<div class="col-span-full p-6 text-center text-gray-500 bg-white/5 rounded-xl border border-white/5 italic">No tienes asignaciones esta semana.</div>';
    });

    // 2. Load Territories (Parallel)
    getMisTerritorios(name).then(territorios => {
        if (!territorios || territorios.length === 0) {
            territoriosContainer.innerHTML = '';
            document.getElementById('no-territories-msg').classList.remove('hidden');
        } else {
            document.getElementById('no-territories-msg').classList.add('hidden');
            territoriosContainer.innerHTML = territorios.map(t => `
                <div class="bg-gradient-to-b from-black/40 to-black/60 border border-white/10 rounded-xl p-4 flex flex-col gap-3 group hover:border-teal-500/30 transition-all">
                    <!-- Image Thumbnail with Click-to-Zoom -->
                    <div class="bg-gray-800 h-40 rounded-lg overflow-hidden relative cursor-pointer shadow-lg" onclick="window.viewMap('${t.imagen}')">
                        <img src="${t.imagen || 'https://via.placeholder.com/300x200?text=Sin+Mapa'}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all transform group-hover:scale-105 duration-500">
                        <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                            <span class="text-white text-xs font-bold uppercase tracking-widest bg-black/60 px-4 py-2 rounded-full border border-white/20">🔍 Ver Mapa</span>
                        </div>
                    </div>
                    
                    <div class="flex justify-between items-start mt-1">
                        <div>
                            <h4 class="text-lg font-bold text-teal-200">Territorio ${t.numero}</h4>
                            <p class="text-xs text-gray-400 mt-0.5">Manzanas: <span class="text-gray-300">${t.manzanas || 'Todas'}</span></p>
                        </div>
                        <span class="text-[10px] uppercase font-bold tracking-wider bg-teal-500/10 text-teal-400 px-2 py-1 rounded border border-teal-500/20">Asignado</span>
                    </div>

                    <div class="flex gap-2 mt-2 pt-3 border-t border-white/5">
                         <button onclick="window.openProgressModal('${t.id}', '${t.numero}', '${t.manzanas || ''}')" 
                            class="flex-1 bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/50 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]">
                            <span>✅</span> Reportar Avance
                        </button>
                    </div>
                </div>
            `).join('');
        }
    });
};

/* --- MODALS & HELPERS --- */

// View Map Modal
window.viewMap = (url) => {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="relative max-w-5xl w-full p-4 animate-scale-in">
             <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="absolute top-4 right-4 m-2 text-white/80 hover:text-white bg-black/50 rounded-full p-2 z-10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
             </button>
             <img src="${url}" class="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/20 bg-black">
        </div>
    `;
    modal.classList.remove('hidden');
};

// Progress / Return Modal
window.openProgressModal = (id, numero, manzanasStr) => {
    const manzanas = manzanasStr ? manzanasStr.split(',').map(s => s.trim()).filter(s => s) : [];

    // Checkbox generation
    const checkboxHtml = manzanas.length > 0 ? `
        <div class="mb-2 text-xs text-gray-400 uppercase tracking-wider font-bold">Selecciona las manzanas terminadas:</div>
        <div class="grid grid-cols-2 gap-2 mb-4 max-h-48 overflow-y-auto bg-black/20 p-3 rounded-lg border border-white/10 custom-scrollbar">
            ${manzanas.map((m, idx) => `
                <label class="flex items-center space-x-3 text-sm text-gray-200 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors select-none">
                    <input type="checkbox" value="${m}" class="manzana-check accent-teal-500 w-5 h-5 bg-white/10 border-white/20 rounded">
                    <span>${m}</span>
                </label>
            `).join('')}
        </div>
    ` : `<p class="text-sm text-gray-400 italic mb-4 bg-white/5 p-4 rounded border border-white/5">Este territorio no tiene manzanas definidas. Se devolverá completo si continúas.</p>`;

    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-fade-in-up">
            <h3 class="text-xl font-bold text-teal-100 mb-2">Reportar Territorio ${numero}</h3>
            <p class="text-sm text-gray-400 mb-6">Ayuda a mantener el mapa actualizado para todos.</p>
            
            ${checkboxHtml}

            <div class="flex flex-col gap-3 mt-2">
                <button id="btn-return-partial" class="hidden w-full bg-teal-600 hover:bg-teal-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-teal-900/20 active:scale-95">
                    Liberar Seleccionadas
                </button>
                <button id="btn-return-all" class="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-teal-900/20 active:scale-95">
                     🎉 Marcar TODO como Terminado
                </button>
                <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full text-gray-400 hover:text-white py-2 text-sm mt-2">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');

    const btnPartial = document.getElementById('btn-return-partial');
    const checks = document.querySelectorAll('.manzana-check');

    // Logic to toggle buttons based on selection
    if (manzanas.length > 0) {
        checks.forEach(c => {
            c.addEventListener('change', () => {
                const selectedCount = document.querySelectorAll('.manzana-check:checked').length;
                if (selectedCount > 0 && selectedCount < manzanas.length) {
                    btnPartial.classList.remove('hidden');
                    btnPartial.innerHTML = `Liberar ${selectedCount} Manzana(s)`;
                } else {
                    btnPartial.classList.add('hidden');
                }
            });
        });
    }

    // Return ALL Logic
    document.getElementById('btn-return-all').addEventListener('click', async () => {
        if (confirm("¿Confirmas que se ha predicado TODO el territorio?")) {
            await returnTerritorio(id);
            modal.classList.add('hidden');
            window.location.reload();
        }
    });

    // Return PARTIAL Logic
    if (btnPartial) {
        btnPartial.addEventListener('click', async () => {
            const selected = Array.from(document.querySelectorAll('.manzana-check:checked')).map(cb => cb.value);
            if (selected.length === 0) return;

            const remaining = manzanas.filter(m => !selected.includes(m));

            // Nice confirmation
            const msg = `Resumen:\n- Terminadas: ${selected.join(', ')}\n- Pendientes: ${remaining.join(', ')}\n\n¿Proceder?`;

            if (confirm(msg)) {
                await returnTerritorioParcial(id, selected.join(', '), remaining.join(', '));
                modal.classList.add('hidden');
                window.location.reload();
            }
        });
    }
};

const initializePhoneModule = (telefonos, publicadores, userId, tbody) => {
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const estados = ['Sin asignar', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];

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
            <tr class="hover:bg-white/5 transition-colors border-b border-white/5 group">
                <td class="p-3 font-mono text-teal-300 font-bold text-sm tracking-wide whitespace-nowrap">${formatPhoneNumber(t.numero)}</td>
                <td class="p-3 text-gray-400 text-[10px] uppercase tracking-wide truncate max-w-[100px]">${t.direccion || '-'}</td>
                <td class="p-3 text-gray-300 text-sm font-medium truncate max-w-[100px]">${t.propietario || '-'}</td>
                <td class="p-2">
                    <select onchange="window.updatePhoneStatus('${t.id}', this.value, '${currentPubId}')" 
                        class="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs font-medium focus:border-teal-500 outline-none cursor-pointer hover:bg-black/50 transition-colors ${getStatusColor(currentStatus)}">
                         ${estados.map(st => `<option value="${st}" ${st === currentStatus ? 'selected' : ''} class="bg-gray-900 text-gray-200">${st}</option>`).join('')}
                    </select>
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
                const count = await solicitarNumeros(10, userId); // Only 10 at a time for safety
                if (count > 0) {
                    alert(`¡Se te han asignado ${count} números nuevos!`);
                    // Refresh
                    // Ideally we would fetch just new ones, but reloading page is safer/easier to sync
                    window.location.reload();
                } else {
                    alert("No hay números disponibles para asignar por ahora.");
                }
            } catch (err) { alert('Error: ' + err.message); }
            finally {
                btn.disabled = false;
                btn.textContent = "+ Solicitar";
            }
        });
    }

    const btnAddPub = document.getElementById('btn-add-pub-temp');
    if (btnAddPub) {
        const newBtn = btnAddPub.cloneNode(true);
        btnAddPub.parentNode.replaceChild(newBtn, btnAddPub);
        newBtn.addEventListener('click', async () => {
            const num = prompt("Ingresa el número de teléfono:");
            if (num) {
                const name = prompt("Nombre del propietario (opcional):");
                try {
                    await addTelefono({
                        numero: num,
                        propietario: name || '',
                        direccion: '',
                        estado: 'Sin asignar', // Correct: Born free for anyone to take
                        publicador_asignado: null,
                        asignado_a: null,
                        fecha_asignacion: null
                    });
                    alert("Contacto agregado correctamente.");
                    window.location.reload();
                } catch (e) {
                    console.error(e);
                    alert("Error al guardar: " + e.message);
                }
            }
        });
    }

    window.updatePhoneStatus = async (id, status, pubId) => {
        // Optimistic UI update
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].estado = status;
            render();
        }
        await updateTelefonoStatus(id, status, pubId);
    };
};
