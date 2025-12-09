import {
    getConfiguracion, getProgramaSemanal, saveProgramaSemanal,
    getMisTelefonos, solicitarNumeros, updateTelefonoStatus, devolverTelefono,
    getPublicadores, getConductores, addPublicador
} from '../data/firestore-services.js';
import { auth } from '../firebase-config.js';

export const renderConductorDashboard = (container, userEmail) => {
    // 1. UI OPTIMISTA: Renderizar estructura base + Skeletons INMEDIATAMENTE
    // No esperamos a Firebase para mostrar algo al usuario.
    let currentConductorName = localStorage.getItem('selected_conductor_name') || "Cargando...";

    container.innerHTML = `
        <div class="w-full max-w-7xl animate-fade-in pb-10">
            <!-- Header Skeleton / Real -->
            <header class="flex justify-between items-center mb-8 p-6 morphinglass-card border-b border-teal-500/20 relative overflow-hidden group">
                <div class="absolute inset-0 bg-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                <div class="z-10">
                    <h1 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-400 tracking-wide">Panel de Conductor</h1>
                    <p id="welcome-msg" class="text-sm text-gray-400 mt-1 flex items-center gap-2">
                        Bienvenido, <span class="text-gray-200 font-medium">${currentConductorName}</span>
                    </p>
                </div>
                <div class="flex items-center gap-4 z-10">
                    <div class="bg-black/40 border border-teal-500/30 rounded-full px-5 py-2 text-sm backdrop-blur-md shadow-lg shadow-teal-500/10">
                        <span class="text-teal-400 font-semibold tracking-wider text-xs uppercase">Conductor</span>
                        <span id="badge-name" class="text-white ml-2 font-medium">${currentConductorName}</span>
                    </div>
                    <button id="logout-btn" class="bg-red-500/10 hover:bg-red-500/30 text-red-200 px-5 py-2 rounded-full border border-red-500/20 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                        Salir
                    </button>
                </div>
            </header>

            <div class="grid grid-cols-1 gap-8">
                <!-- Dashboard Module Skeleton -->
                <section id="module-dashboard" class="morphinglass-card p-6 hidden">
                    <h2 class="text-xl font-bold text-teal-200 mb-6 flex items-center gap-2">
                        <span>📊</span> Mi Dashboard
                    </h2>
                    <div id="dashboard-assignments" class="p-6 bg-black/20 rounded-xl border border-white/5 animate-pulse min-h-[100px] flex items-center justify-center">
                        <div class="h-2 w-32 bg-white/10 rounded"></div>
                    </div>
                </section>

                <!-- Programa Module Skeleton -->
                <section id="module-programa" class="morphinglass-card p-6 hidden">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-bold text-teal-200 flex items-center gap-2">
                            <span>📅</span> Programa de Predicación
                        </h2>
                        <div class="flex gap-2">
                            <button id="export-prog-png" class="text-xs bg-teal-600/20 px-3 py-1.5 rounded-lg hover:bg-teal-600 border border-teal-500/30 transition-all text-teal-100">Exportar PNG</button>
                            <!-- Save button hidden for conductors -->
                        </div>
                    </div>
                    <div id="program-table-container" class="bg-white/5 rounded-xl p-1 text-black overflow-x-auto min-h-[150px] animate-pulse">
                        <!-- Skeleton Table -->
                        <div class="h-8 bg-white/10 mb-2 w-full rounded"></div>
                        <div class="h-32 bg-white/5 w-full rounded"></div>
                    </div>
                </section>

                <!-- Telefonos Module Skeleton -->
                <section id="module-telefonos" class="morphinglass-card p-6 hidden">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-xl font-bold text-teal-200 flex items-center gap-2">
                            <span>📞</span> Predicación Telefónica
                        </h2>
                        <div class="flex gap-3">
                            <button id="btn-solicitar" class="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white px-5 py-2 rounded-lg text-sm transition-all shadow-lg shadow-teal-500/20 font-medium tracking-wide">
                                Solicitar números
                            </button>
                            <button id="btn-add-pub-temp" class="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-white/10 backdrop-blur-sm">
                                + Publicador
                            </button>
                        </div>
                    </div>
                    
                    <div class="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                        <table class="w-full text-left text-sm text-gray-300">
                            <thead class="text-teal-400 uppercase bg-black/40 text-xs tracking-wider">
                                <tr>
                                    <th class="p-4 font-semibold">Número</th>
                                    <th class="p-4 font-semibold">Dirección</th>
                                    <th class="p-4 font-semibold">Propietario</th>
                                    <th class="p-4 font-semibold">Publicador</th>
                                    <th class="p-4 font-semibold">Estado</th>
                                </tr>
                            </thead>
                            <tbody id="lista-telefonos" class="divide-y divide-white/5">
                                <!-- Skeleton Rows -->
                                ${[1, 2, 3].map(() => `
                                    <tr class="animate-pulse">
                                        <td class="p-4"><div class="h-4 w-24 bg-white/10 rounded"></div></td>
                                        <td class="p-4"><div class="h-3 w-32 bg-white/5 rounded"></div></td>
                                        <td class="p-4"><div class="h-3 w-20 bg-white/5 rounded"></div></td>
                                        <td class="p-4"><div class="h-3 w-24 bg-white/5 rounded"></div></td>
                                        <td class="p-4"><div class="h-6 w-20 bg-white/10 rounded-full"></div></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    `;

    // Logout listener (always active)
    document.getElementById('logout-btn').addEventListener('click', async () => {
        localStorage.removeItem('demo_role');
        localStorage.removeItem('selected_conductor_name');
        await auth.signOut();
        window.location.reload();
    });

    // 2. DATA FETCHING PARALELO (Promise.all)
    // Buscamos Config y Conductores primero para habilitar módulos y header
    Promise.all([getConfiguracion(), getConductores()])
        .then(async ([config, conductores]) => {
            const activeModules = config.modulos_activos;

            // --- HEADER LOGIC ---
            // Buscar conductor info real
            let finalName = currentConductorName;
            let finalEmail = userEmail;

            const conductorMatch = conductores.find(c =>
                c.email === userEmail || c.nombre === userEmail || c.nombre === currentConductorName
            );

            if (conductorMatch) {
                finalName = conductorMatch.nombre;
                finalEmail = conductorMatch.email || userEmail;
                localStorage.setItem('selected_conductor_name', finalName);
            }

            // Update DOM with real name
            const welcomeMsg = document.getElementById('welcome-msg');
            if (welcomeMsg) welcomeMsg.innerHTML = `Bienvenido, <span class="text-gray-200 font-medium">${finalName}</span>`;
            const badgeName = document.getElementById('badge-name');
            if (badgeName) badgeName.textContent = finalName;


            // --- MODULE: DASHBOARD ---
            const modDash = document.getElementById('module-dashboard');
            if (activeModules.dashboard) {
                modDash.classList.remove('hidden');
                // Logic extracted to separate flow to not block others
                loadDashboardAssignments(finalName, document.getElementById('dashboard-assignments'));
            }

            // --- MODULE: PROGRAMA ---
            const modProg = document.getElementById('module-programa');
            if (activeModules.programa_predicacion) {
                modProg.classList.remove('hidden');
                // Fetch Program independently
                getProgramaSemanal().then(programa => {
                    const containerTable = document.getElementById('program-table-container');
                    if (containerTable) {
                        containerTable.classList.remove('animate-pulse', 'min-h-[150px]'); // Remove skeleton classes
                        renderProgramTable(programa, containerTable, config);
                    }
                });

                // Export Listener
                const btnExport = document.getElementById('export-prog-png');
                if (btnExport) {
                    btnExport.addEventListener('click', () => {
                        const tableContainer = document.getElementById('program-table-container');
                        if (typeof html2canvas !== 'undefined') {
                            html2canvas(tableContainer, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
                                const link = document.createElement('a');
                                link.download = 'programa_semanal.png';
                                link.href = canvas.toDataURL();
                                link.click();
                            });
                        } else {
                            alert("Función no disponible");
                        }
                    });
                }
            }

            // --- MODULE: TELEFONOS ---
            const modTel = document.getElementById('module-telefonos');
            if (activeModules.predicacion_telefonica) {
                modTel.classList.remove('hidden');

                // Fetch Phones & Publishers in PARALLEL
                Promise.all([getMisTelefonos(finalEmail || finalName), getPublicadores()])
                    .then(([telefonos, publicadores]) => {
                        const tbody = document.getElementById('lista-telefonos');
                        if (tbody) {
                            initializePhoneModule(telefonos, publicadores, finalEmail || finalName, tbody);
                        }
                    });
            }

        })
        .catch(err => {
            console.error("Error loading dashboard data:", err);
            container.innerHTML += `<div class="p-4 bg-red-500/20 text-red-200 rounded border border-red-500/50 mt-4 mx-4">Error cargando datos: ${err.message}</div>`;
        });
};

/* --- SUB-FUNCIONES DE RENDERIZADO (Separadas para claridad) --- */

const loadDashboardAssignments = async (name, container) => {
    // Reutilizamos la lógica del programa para no volver a pedirlo?
    // Idealmente sí, pero por simplicidad de refactor pedimos getProgramaSemanal de nuevo (cacheado por firebase localmente)
    const programa = await getProgramaSemanal();
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

    if (assignments.length === 0) {
        container.classList.remove('animate-pulse');
        container.innerHTML = `<p class="text-gray-400 text-sm">No tienes asignaciones esta semana.</p>`;
    } else {
        container.classList.remove('animate-pulse', 'min-h-[100px]', 'flex', 'items-center', 'justify-center');
        container.innerHTML = `
            <div class="grid gap-4 w-full">
                ${assignments.map(a => `
                    <div class="bg-gradient-to-br from-teal-900/40 to-black/40 p-4 rounded-xl border border-teal-500/20 hover:border-teal-500/40 transition-colors group">
                        <div class="flex justify-between items-start">
                            <div>
                                <span class="font-bold text-teal-100 text-lg">${a.dia}</span>
                                <span class="text-teal-400/80 text-sm ml-2 font-medium">${a.turno}</span>
                            </div>
                            <span class="text-xs bg-teal-500/20 text-teal-300 px-3 py-1 rounded-full border border-teal-500/20 group-hover:bg-teal-500/30 transition-colors">${a.role}</span>
                        </div>
                        <div class="mt-3 space-y-1 text-sm text-gray-400">
                            <div class="flex items-center gap-2"><span class="text-gray-600">🕒</span> <span class="text-gray-300">${a.hora || '-'}</span></div>
                            <div class="flex items-center gap-2"><span class="text-gray-600">📍</span> <span class="text-gray-300">${a.lugar || '-'}</span></div>
                            <div class="flex items-center gap-2"><span class="text-gray-600">🗺️</span> <span class="text-gray-300">${a.territorio || '-'}</span></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

const renderProgramTable = (programa, container, config) => {
    if (!programa || !programa.dias || programa.dias.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center p-8">No hay programa cargado aún.</p>';
        return;
    }

    const turnos = [
        { id: 'manana', label: '🌅 MAÑANA', headerColor: 'bg-cyan-100/90' },
        { id: 'tarde', label: '☀️ TARDE', headerColor: 'bg-orange-100/90' },
        { id: 'noche', label: '🌙 NOCHE', headerColor: 'bg-indigo-100/90' }
    ];
    const fields = ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'];

    let html = `
        <div class="bg-white p-4 min-w-[800px]"> <!-- Force white background for png export -->
            <div class="text-center font-bold text-xl mb-4 uppercase border-b-2 border-black pb-4 text-black">
                Congregación "${config.congregacion?.nombre || '...'}" ${config.congregacion?.numero || ''} <br>
                <span class="text-lg text-gray-700 mt-1 block">Programa de Predicación</span>
            </div>
            <table class="w-full border-collapse text-xs md:text-sm border border-gray-400 text-black">
                <thead>
                    <tr class="bg-teal-100">
                        <th class="border border-gray-400 p-2 w-20 font-bold text-teal-900">Turno</th>
                        <th class="border border-gray-400 p-2 w-24 font-bold text-teal-900">Detalle</th>
                        ${programa.dias.map(d => `<th class="border border-gray-400 p-2 uppercase font-bold text-teal-900 tracking-wider">${d.nombre}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    turnos.forEach(turno => {
        fields.forEach((field, fieldIdx) => {
            if (fieldIdx === 0) {
                html += `<tr>
                    <td class="${turno.headerColor} font-bold border border-gray-400 p-3 text-center align-middle text-gray-800" rowspan="${fields.length}">${turno.label}</td>
                    <td class="${turno.headerColor} font-bold border border-gray-400 p-2 text-gray-800">${field}</td>`;
            } else {
                html += `<tr>
                    <td class="${turno.headerColor} font-bold border border-gray-400 p-2 text-gray-800">${field}</td>`;
            }
            programa.dias.forEach(dia => {
                const val = (dia[turno.id] || {})[field.toLowerCase()] || '';
                html += `<td class="border border-gray-400 p-2 text-center text-gray-700">${val || '<span class="text-gray-300">-</span>'}</td>`;
            });
            html += `</tr>`;
        });
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
};

/* Helper for consistent status colors */
/* Helper for consistent status colors */
const getStatusColor = (status) => {
    if (status === 'Contestaron') return 'text-green-400';
    if (status === 'No contestan') return 'text-orange-400';
    if (status === 'No llamar') return 'text-red-400';
    if (status === 'Colgaron') return 'text-gray-400';
    if (status === 'Revisita') return 'text-yellow-400';
    if (status === 'Suspendido') return 'text-orange-500';
    if (status === 'Testigo') return 'text-purple-400';
    return 'text-gray-500';
};

const initializePhoneModule = (telefonos, publicadores, userId, tbody) => {
    // Sort publishers
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Helper format
    const formatPhoneNumber = (numero) => {
        if (!numero) return '';
        const cleaned = numero.toString().replace(/\D/g, '');
        return cleaned.length === 7 ? `${cleaned.slice(0, 3)} ${cleaned.slice(3)}` : numero;
    };

    // List of statuses
    const estados = ['Sin asignar', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];

    // Render Logic
    const render = () => {
        telefonos.sort((a, b) => {
            const dateA = a.fecha_asignacion ? new Date(a.fecha_asignacion) : new Date(0);
            const dateB = b.fecha_asignacion ? new Date(b.fecha_asignacion) : new Date(0);
            return dateB - dateA;
        });

        if (telefonos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-500 italic">No tienes números asignados. ¡Solicita algunos!</td></tr>`;
            return;
        }

        tbody.innerHTML = telefonos.map(t => {
            const currentPubId = t.publicador_asignado || '';
            const currentStatus = t.estado || 'Sin asignar';

            return `
            <tr class="hover:bg-white/5 transition-colors border-b border-white/5 group">
                <td class="p-4 font-mono text-teal-300 font-bold text-base tracking-wide">${formatPhoneNumber(t.numero)}</td>
                <td class="p-4 text-gray-400 text-xs uppercase tracking-wide">${t.direccion}</td>
                <td class="p-4 text-gray-300 text-sm font-medium">${t.propietario}</td>
                <td class="p-2">
                     <select onchange="window.updatePhoneStatus('${t.id}', '${currentStatus}', this.value)" 
                        class="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-sm text-gray-200 focus:border-teal-500 outline-none cursor-pointer hover:bg-black/50 transition-colors">
                        <option value="" class="bg-gray-900 text-gray-500">Sin asignar</option>
                        ${publicadores.map(p =>
                `<option value="${p.id}" ${p.id === currentPubId ? 'selected' : ''} class="bg-gray-900">${p.nombre}</option>`
            ).join('')}
                    </select>
                </td>
                <td class="p-2">
                    <select onchange="window.updatePhoneStatus('${t.id}', this.value, '${currentPubId}')" 
                        class="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-sm font-medium focus:border-teal-500 outline-none cursor-pointer hover:bg-black/50 transition-colors ${getStatusColor(currentStatus)}">
                         ${estados.map(st =>
                `<option value="${st}" ${st === currentStatus ? 'selected' : ''} class="bg-gray-900 text-gray-200">${st}</option>`
            ).join('')}
                    </select>
                </td>
            </tr>
        `;
        }).join('');
    };

    render(); // Initial render

    // Listeners and Logic
    const btnSolicitar = document.getElementById('btn-solicitar');
    if (btnSolicitar) {
        // Clone to remove old listeners (brute force clear)
        const newBtn = btnSolicitar.cloneNode(true);
        btnSolicitar.parentNode.replaceChild(newBtn, btnSolicitar);

        newBtn.addEventListener('click', async () => {
            try {
                const count = await solicitarNumeros(50, userId);
                alert(`Se asignaron ${count} números nuevos.`);
                // Refresh list locally
                const newTels = await getMisTelefonos(userId);
                telefonos.length = 0; // Clear array
                telefonos.push(...newTels); // Update with new data
                render();
            } catch (err) { alert('Error: ' + err.message); }
        });
    }

    const btnAddPub = document.getElementById('btn-add-pub-temp');
    if (btnAddPub) {
        const newBtn = btnAddPub.cloneNode(true);
        btnAddPub.parentNode.replaceChild(newBtn, btnAddPub);

        newBtn.addEventListener('click', () => {
            showModal(`
                <h3 class="text-xl font-bold mb-4 text-teal-400">Nuevo Publicador</h3>
                <input type="text" id="new-temp-pub" placeholder="Nombre Completo" class="w-full bg-black/30 border border-white/20 rounded p-3 text-white focus:border-teal-500 outline-none mb-4">
                <button id="save-temp-pub" class="w-full bg-teal-600 hover:bg-teal-500 py-2 rounded-lg text-white font-medium shadow-lg shadow-teal-500/20 transition-all">Guardar</button>
            `, (modal) => {
                document.getElementById('save-temp-pub').addEventListener('click', async () => {
                    const name = document.getElementById('new-temp-pub').value;
                    if (name) {
                        await addPublicador({ nombre: name });
                        modal.classList.add('hidden');
                        alert("Publicador agregado");
                        window.location.reload(); // Simple reload for pub list update
                    }
                });
            });
        });
    }

    // Assign GLOBAL handlers for this module instance
    window.updatePhoneStatus = async (id, status, pubId) => {
        await updateTelefonoStatus(id, status, pubId);
        // Refresh local data
        const freshTels = await getMisTelefonos(userId);

        // Update local array reference
        telefonos.length = 0;
        telefonos.push(...freshTels);
        render();

        if (freshTels.length === 0) {
            console.log("Lote completado. Esperando reset.");
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-teal-300 font-medium animate-pulse">¡Excelente! Has completado todos tus números.</td></tr>`;
        }
    };

    window.handleDevolver = async (id) => {
        if (confirm('¿Desea devolver este número? Se quitará el publicador y el estado.')) {
            await devolverTelefono(id);
            // Refresh
            const freshTels = await getMisTelefonos(userId);
            telefonos.length = 0;
            telefonos.push(...freshTels);
            render();
        }
    };

    // Edit Modal Implementation re-attached to window for global access from HTML strings
    window.openEditPhone = (id, currentStatus, currentPubId) => {
        // Status options
        const estados = ['Pendiente', 'Contactado', 'No contestan', 'Ocupado', 'Buzón de voz', 'Número equivocado', 'No llamar'];

        showModal(`
            <h3 class="text-xl font-bold mb-6 text-teal-300 text-center">Gestionar Registro</h3>
            
            <div class="space-y-5">
                 <div class="group/input">
                    <label class="block text-teal-400 mb-1.5 text-xs font-bold uppercase tracking-wider">Publicador Asignado</label>
                    <select id="edit-pub-select" class="w-full bg-black/40 border border-teal-500/30 rounded-lg p-3 text-white focus:border-teal-500 focus:bg-black/60 focus:ring-1 focus:ring-teal-500/50 outline-none transition-all cursor-pointer">
                        <option value="" class="bg-gray-900 text-gray-400">Seleccionar publicador...</option>
                        ${publicadores.map(p =>
            `<option value="${p.id}" ${p.id === currentPubId ? 'selected' : ''} class="bg-gray-900 text-gray-200">${p.nombre}</option>`
        ).join('')}
                    </select>
                </div>

                <div class="group/input">
                    <label class="block text-teal-400 mb-1.5 text-xs font-bold uppercase tracking-wider">Estado de la llamada</label>
                    <select id="edit-status-select" class="w-full bg-black/40 border border-teal-500/30 rounded-lg p-3 text-white focus:border-teal-500 focus:bg-black/60 focus:ring-1 focus:ring-teal-500/50 outline-none transition-all cursor-pointer">
                        ${estados.map(st =>
            `<option value="${st}" ${st === (currentStatus || 'Pendiente') ? 'selected' : ''} class="bg-gray-900 text-gray-200">${st}</option>`
        ).join('')}
                    </select>
                </div>
            </div>

            <button id="save-phone-edit" class="w-full mt-8 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-500/20 transform active:scale-95 transition-all duration-200">
                Guardar Cambios
            </button>
        `, (modal) => {
            modal.querySelector('#save-phone-edit').addEventListener('click', async () => {
                const newStatus = modal.querySelector('#edit-status-select').value;
                const newPubId = modal.querySelector('#edit-pub-select').value;

                await updatePhoneStatus(id, newStatus, newPubId);
                modal.classList.add('hidden');
            });
        });
    };


};

const showModal = (content, onOpen) => {
    let modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-container';
        modalContainer.className = 'fixed inset-0 bg-black/90 backdrop-blur-md hidden flex items-center justify-center z-50 animate-fade-in';
        document.body.appendChild(modalContainer);
    }

    modalContainer.innerHTML = `
    < div class="morphinglass-card w-full max-w-md m-4 relative animate-scale-in bg-black/80 border border-white/10 shadow-2xl shadow-teal-900/20" >
            <button class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors" onclick="document.getElementById('modal-container').classList.add('hidden')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div class="p-2">
                ${content}
            </div>
        </div >
    `;
    modalContainer.classList.remove('hidden');
    if (onOpen) onOpen(modalContainer);
};
