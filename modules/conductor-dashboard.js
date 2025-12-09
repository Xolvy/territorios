import {
    getConfiguracion, getProgramaSemanal, saveProgramaSemanal,
    getMisTelefonos, solicitarNumeros, updateTelefonoStatus, devolverTelefono,
    getPublicadores, getConductores, addPublicador,
    getMisTerritorios, returnTerritorio
} from '../data/firestore-services.js';
import { auth } from '../firebase-config.js';
import { formatPhoneNumber, getStatusColor } from './utils/helpers.js';

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
                    <p class="text-gray-400 mt-1 flex items-center gap-2">
                        <span class="inline-block w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                        Bienvenido, <span id="conductor-name-display" class="text-teal-200 font-medium">${currentConductorName}</span>
                    </p>
                </div>
                <button id="logout-btn" class="bg-red-500/10 hover:bg-red-500/30 text-red-300 px-5 py-2.5 rounded-xl border border-red-500/20 transition-all duration-300 text-sm font-medium backdrop-blur-md">
                    Cerrar Sesión
                </button>
            </header>

            <div id="dashboard-content" class="space-y-8">
                
                <!-- MODULE: DASHBOARD SUMMARY -->
                <div id="module-dashboard" class="hidden">
                   <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       <!-- Welcome Card -->
                       <div class="col-span-1 lg:col-span-2 morphinglass-card p-6 relative overflow-hidden">
                           <div class="absolute top-0 right-0 p-4 opacity-10 text-9xl">👋</div>
                           <h2 class="text-xl font-bold text-white mb-2">Resumen Semanal</h2>
                           <p class="text-gray-400 text-sm mb-6">Aquí tienes un vistazo de tus actividades programadas.</p>
                           
                           <div id="dashboard-assignments" class="animate-pulse min-h-[100px] flex items-center justify-center bg-black/20 rounded-xl border border-teal-500/10">
                               <div class="h-4 w-32 bg-teal-500/20 rounded"></div>
                           </div>
                       </div>
                   </div>
                </div>

                <!-- MODULE: PROGRAMA -->
                <div id="module-programa" class="hidden morphinglass-card p-6">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h2 class="text-xl font-bold text-teal-100 flex items-center gap-2">
                                <span>📅</span> Programa de Predicación
                            </h2>
                            <p class="text-xs text-gray-400 mt-1">Horarios y salidas para la semana en curso</p>
                        </div>
                        <button id="export-prog-png" class="text-xs bg-black/40 hover:bg-black/60 text-teal-300 border border-teal-500/30 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                            📷 Guardar como Imagen
                        </button>
                    </div>
                    
                    <div id="program-table-container" class="overflow-x-auto rounded-xl border border-white/5 bg-black/20 min-h-[150px] animate-pulse">
                        <!-- Table Rendered Here -->
                    </div>
                </div>

                <!-- MODULE: TERRITORIOS (New) -->
                <div id="module-territorios-mapas" class="hidden morphinglass-card p-6">
                     <div class="flex justify-between items-center mb-6">
                        <div>
                            <h2 class="text-xl font-bold text-teal-100 flex items-center gap-2">
                                <span>🗺️</span> Mis Territorios Asignados
                            </h2>
                            <p class="text-xs text-gray-400 mt-1">Mapas asignados para predicar</p>
                        </div>
                    </div>
                    <div id="mis-territorios-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div class="text-gray-500 text-sm italic col-span-full text-center py-8">Cargando territorios...</div>
                    </div>
                </div>

                <!-- MODULE: TELEFONOS -->
                <div id="module-telefonos" class="hidden morphinglass-card p-6">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                         <div>
                            <h2 class="text-xl font-bold text-teal-100 flex items-center gap-2">
                                <span>📞</span> Predicación Telefónica
                            </h2>
                            <p class="text-xs text-gray-400 mt-1">Gestiona los números y asigna publicadores</p>
                        </div>
                        <div class="flex gap-2">
                             <button id="btn-add-pub-temp" class="text-xs bg-teal-900/40 hover:bg-teal-800/60 text-teal-300 border border-teal-500/30 px-3 py-2 rounded-lg transition-colors">
                                + Publicador
                            </button>
                            <button id="btn-solicitar" class="text-xs bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-lg shadow-lg shadow-teal-500/20 transition-all">
                                + Solicitar Números
                            </button>
                        </div>
                    </div>

                    <div class="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                        <table class="w-full text-left text-sm text-gray-300">
                            <thead class="text-xs uppercase bg-black/40 text-teal-400 font-semibold tracking-wider">
                                <tr>
                                    <th class="p-4">Número</th>
                                    <th class="p-4">Datos</th>
                                    <th class="p-4">Publicador</th>
                                    <th class="p-4">Estado</th>
                                    <th class="p-4">Acción</th>
                                </tr>
                            </thead>
                            <tbody id="lista-telefonos" class="divide-y divide-white/5 font-mono text-sm">
                                <!-- Filas -->
                                <tr><td colspan="5" class="p-4 text-center text-gray-500 animate-pulse">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
        
        <!-- Modal Global Container -->
        <div id="modal-container" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center z-50 p-4"></div>
    `;

    // 2. LOGICA DE DATOS OPTIMIZADA
    let finalEmail = userEmail;
    if (!finalEmail || finalEmail === 'Usuario') {
        const storedName = localStorage.getItem('selected_conductor_name');
        if (storedName) finalEmail = storedName;
    }
    const finalName = localStorage.getItem('selected_conductor_name') || finalEmail || "Conductor";

    // Actualizamos nombre en UI si cambia
    const nameDisplay = document.getElementById('conductor-name-display');
    if (nameDisplay) nameDisplay.innerText = finalName;

    document.getElementById('logout-btn').addEventListener('click', async () => {
        localStorage.removeItem('demo_role');
        localStorage.removeItem('selected_conductor_name');
        await auth.signOut();
        window.location.reload();
    });

    // 3. FETCH CONFIG & START MODULES
    getConfiguracion()
        .then(config => {
            const activeModules = config.modulos_activos || { dashboard: true, programa_predicacion: true, predicacion_telefonica: true };

            // --- MODULE: DASHBOARD ---
            const modDash = document.getElementById('module-dashboard');
            if (activeModules.dashboard) {
                modDash.classList.remove('hidden');
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

            // --- MODULE: TERRITORIOS (MAPAS) ---
            const modMapas = document.getElementById('module-territorios-mapas');
            if (activeModules.dashboard) { // Shown alongside dashboard
                modMapas.classList.remove('hidden');
                getMisTerritorios(finalName).then(territorios => {
                    const grid = document.getElementById('mis-territorios-grid');
                    if (territorios.length === 0) {
                        grid.innerHTML = '<div class="text-gray-500 text-sm italic col-span-full text-center py-8">No tienes territorios asignados actualmente.</div>';
                    } else {
                        grid.innerHTML = territorios.map(t => `
                            <div class="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                                <div class="bg-gray-800 h-32 rounded-lg overflow-hidden">
                                    <img src="${t.imagen || 'https://via.placeholder.com/300x200?text=Territorio'}" class="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity">
                                </div>
                                <div class="flex justify-between items-start">
                                    <div>
                                        <h4 class="text-lg font-bold text-teal-200">Territorio ${t.numero}</h4>
                                        <p class="text-xs text-gray-400">${t.manzanas || 'Sin manzanas definidas'}</p>
                                    </div>
                                    <span class="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-1 rounded border border-teal-500/30">Asignado</span>
                                </div>
                                <button onclick="window.returnTerritorioUI('${t.id}', '${t.numero}')" class="mt-2 w-full bg-white/5 hover:bg-green-500/20 text-gray-300 hover:text-green-300 border border-white/10 hover:border-green-500/30 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2">
                                    <span>✅</span> Marcar Predicado
                                </button>
                            </div>
                        `).join('');
                    }
                });

                window.returnTerritorioUI = async (id, num) => {
                    if (confirm(`¿Confirmas que el Territorio ${num} ha sido predicado completamente? Se devolverá al sistema.`)) {
                        await returnTerritorio(id);
                        window.location.reload();
                    }
                };
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

const initializePhoneModule = (telefonos, publicadores, userId, tbody) => {
    // Sort publishers
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

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
        // Optimistic update locally first for speed
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].estado = status;
            telefonos[telIndex].publicador_asignado = pubId;
            render(); // Re-render with local data (colors update, item stays)
        }

        // Send to DB in background (awaiting to ensure consistency if needed, but UI is already updated)
        try {
            await updateTelefonoStatus(id, status, pubId);
        } catch (error) {
            console.error("Error updating status:", error);
            // Revert on error? For now just alert
            alert("Error al guardar cambios: " + error.message);
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
};
