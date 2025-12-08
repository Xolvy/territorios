import {
    getConfiguracion, getProgramaSemanal, saveProgramaSemanal,
    getMisTelefonos, solicitarNumeros, updateTelefonoStatus, devolverTelefono,
    getPublicadores, getConductores, addPublicador
} from '../data/firestore-services.js';
import { auth } from '../firebase-config.js';

export const renderConductorDashboard = async (container, userEmail) => {
    const config = await getConfiguracion();
    const activeModules = config.modulos_activos;
    const conductores = await getConductores();

    // Identificar usuario actual desde localStorage o email
    let currentConductorName = localStorage.getItem('selected_conductor_name') || "Conductor";
    let currentConductorEmail = userEmail;

    // Buscar conductor por email O por nombre (para el caso de demo-login)
    const conductorMatch = conductores.find(c =>
        c.email === userEmail ||
        c.nombre === userEmail ||
        c.nombre === currentConductorName
    );

    if (conductorMatch) {
        currentConductorName = conductorMatch.nombre;
        currentConductorEmail = conductorMatch.email || userEmail;
        localStorage.setItem('selected_conductor_name', currentConductorName);
    }

    container.innerHTML = `
        <div class="w-full max-w-7xl animate-fade-in pb-10">
            <header class="flex justify-between items-center mb-8 p-4 morphinglass-card">
                <div>
                    <h1 class="text-2xl font-bold text-teal-400">Panel de Conductor</h1>
                    <p class="text-sm text-gray-400">Bienvenido, ${currentConductorName}</p>
                </div>
                <div class="flex items-center gap-4">
                    <div class="bg-teal-500/10 border border-teal-500/30 rounded px-4 py-2 text-sm">
                        <span class="text-teal-400 font-semibold">Soy:</span>
                        <span class="text-white ml-2">${currentConductorName}</span>
                    </div>
                    <button id="logout-btn" class="bg-red-500/20 hover:bg-red-500/40 text-red-200 px-4 py-2 rounded-lg border border-red-500/30 transition-colors">
                        Salir
                    </button>
                </div>
            </header>

            <div class="grid grid-cols-1 gap-8">
                ${activeModules.dashboard ? `
                    <section class="morphinglass-card">
                        <h2 class="text-xl font-bold text-teal-200 mb-4">📊 Mi Dashboard</h2>
                        <div id="dashboard-assignments" class="p-4 bg-white/5 rounded-lg border border-white/10">
                            <p class="text-gray-400">Selecciona tu nombre arriba para ver asignaciones.</p>
                        </div>
                    </section>
                ` : ''}

                ${activeModules.programa_predicacion ? `
                    <section class="morphinglass-card">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold text-teal-200">📅 Programa de Predicación</h2>
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-xl font-bold text-teal-200">📞 Predicación Telefónica</h2>
                            <div class="flex gap-2">
                                <button id="btn-solicitar" class="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm transition-colors shadow-lg shadow-teal-500/20">
                                    Solicitar números
                                </button>
                                <button id="btn-add-pub-temp" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-white/20">
                                    + Publicador
                                </button>
                            </div>
                        </div>
                        
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm text-gray-300">
                                <thead class="text-teal-400 uppercase bg-black/40">
                                    <tr>
                                        <th class="p-3">Número</th>
                                        <th class="p-3">Dirección</th>
                                        <th class="p-3">Propietario</th>
                                        <th class="p-3">Publicador</th>
                                        <th class="p-3">Estado</th>
                                        <th class="p-3 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody id="lista-telefonos" class="divide-y divide-white/10">
                                    <!-- Rows -->
                                </tbody>
                            </table>
                        </div>
                    </section>
                ` : ''}
            </div>
        </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', async () => {
        localStorage.removeItem('demo_role');
        localStorage.removeItem('selected_conductor_name');
        await auth.signOut();
        window.location.reload();
    });

    // --- LOGIC: PROGRAMA PREDICACIÓN ---
    if (activeModules.programa_predicacion) {
        const programa = await getProgramaSemanal();
        const containerTable = document.getElementById('program-table-container');

        const renderProgramTable = () => {
            // Check if programa has data
            if (!programa || !programa.dias || programa.dias.length === 0) {
                containerTable.innerHTML = '<p class="text-gray-400 text-center p-4">No hay programa cargado aún.</p>';
                return;
            }

            // Build table with turnos structure
            const turnos = [
                { id: 'manana', label: '🌅 MAÑANA', headerColor: 'bg-cyan-100' },
                { id: 'tarde', label: '☀️ TARDE', headerColor: 'bg-orange-100' },
                { id: 'noche', label: '🌙 NOCHE', headerColor: 'bg-indigo-100' }
            ];

            const fields = ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Grupos', 'Territorio'];

            let html = `
                <div class="text-center font-bold text-xl mb-2 uppercase border-b-2 border-black pb-2">
                    Congregación "${config.congregacion?.nombre || '...'}" ${config.congregacion?.numero || ''} <br>
                    Programa de Predicación
                </div>
                <table class="w-full border-collapse text-xs md:text-sm border border-gray-400">
                    <thead>
                        <tr class="bg-teal-100">
                            <th class="border border-gray-400 p-1 w-16">Turno</th>
                            <th class="border border-gray-400 p-1 w-20">Detalle</th>
                            ${programa.dias.map(d => `<th class="border border-gray-400 p-1 uppercase">${d.nombre}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Render each turno
            turnos.forEach(turno => {
                fields.forEach((field, fieldIdx) => {
                    if (fieldIdx === 0) {
                        // First row of turno: show turno label with rowspan
                        html += `<tr>
                            <td class="${turno.headerColor} font-bold border border-gray-400 p-2 text-center" rowspan="${fields.length}">${turno.label}</td>
                            <td class="${turno.headerColor} font-bold border border-gray-400 p-1">${field}</td>`;
                    } else {
                        html += `<tr>
                            <td class="${turno.headerColor} font-bold border border-gray-400 p-1">${field}</td>`;
                    }

                    // Add data cells for each day
                    programa.dias.forEach(dia => {
                        const turnoData = dia[turno.id] || {};
                        const val = turnoData[field.toLowerCase()] || '';
                        html += `<td class="border border-gray-400 p-1 text-center">${val || '<span class="text-gray-400">-</span>'}</td>`;
                    });

                    html += `</tr>`;
                });
            });

            html += `</tbody></table>`;
            containerTable.innerHTML = html;
        };

        renderProgramTable();

        // Keep save and export buttons for reference (though conductor shouldn't edit)
        document.getElementById('save-prog')?.addEventListener('click', async () => {
            alert("El programa solo puede editarse desde el Panel de Administrador");
        });

        document.getElementById('export-prog-png')?.addEventListener('click', () => {
            if (typeof html2canvas !== 'undefined') {
                html2canvas(containerTable, { scale: 2 }).then(canvas => {
                    const link = document.createElement('a');
                    link.download = 'programa_semanal.png';
                    link.href = canvas.toDataURL();
                    link.click();
                });
            } else {
                alert("Función de exportar PNG no disponible");
            }
        });
    }

    // --- LOGIC: PREDICACIÓN TELEFÓNICA ---
    if (activeModules.predicacion_telefonica) {
        const tbody = document.getElementById('lista-telefonos');
        const publicadores = await getPublicadores();

        // Use conductor email as userId for phone assignment
        const userId = currentConductorEmail || currentConductorName;

        // Helper function to format phone numbers
        const formatPhoneNumber = (numero) => {
            if (!numero) return '';
            const cleaned = numero.toString().replace(/\D/g, '');
            if (cleaned.length === 7) {
                return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
            }
            return numero; // Return original if not 7 digits
        };

        const renderTelefonos = async () => {
            const telefonos = await getMisTelefonos(userId);

            // Ordenar por fecha de asignación descendente (más recientes primero)
            telefonos.sort((a, b) => {
                const dateA = a.fecha_asignacion ? new Date(a.fecha_asignacion) : new Date(0);
                const dateB = b.fecha_asignacion ? new Date(b.fecha_asignacion) : new Date(0);
                return dateB - dateA; // Descendente: más reciente primero
            });

            tbody.innerHTML = telefonos.map(t => {
                const pubName = publicadores.find(p => p.id === t.publicador_asignado)?.nombre || '-';
                const statusColor = getStatusColor(t.estado);

                return `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5">
                    <td class="p-3 font-mono text-teal-300 font-bold">${formatPhoneNumber(t.numero)}</td>
                    <td class="p-3 text-gray-400 text-xs">${t.direccion}</td>
                    <td class="p-3 text-gray-300 text-sm">${t.propietario}</td>
                    <td class="p-3 text-sm">${pubName}</td>
                    <td class="p-3">
                        <div class="flex items-center gap-2">
                            <span class="${statusColor} font-medium">${t.estado}</span>
                            ${t.estado === 'Revisita' ? `
                                <button onclick="window.handleDevolver('${t.id}')" title="Devolver" class="text-teal-400 hover:text-teal-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                                    </svg>
                                </button>` : ''}
                        </div>
                    </td>
                    <td class="p-3 text-right">
                        <button onclick="window.openEditPhone('${t.id}', '${t.estado}', '${t.publicador_asignado || ''}')" 
                            class="bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 px-3 py-1 rounded text-xs border border-blue-500/30 transition-colors">
                            Editar
                        </button>
                    </td>
                </tr>
            `}).join('');
        };

        await renderTelefonos();

        const btnSolicitar = document.getElementById('btn-solicitar');
        if (btnSolicitar) {
            btnSolicitar.addEventListener('click', async () => {
                try {
                    console.log('Solicitando números para:', userId);
                    const count = await solicitarNumeros(50, userId);
                    alert(`Se asignaron ${count} números nuevos.`);
                    await renderTelefonos();
                } catch (error) {
                    console.error('Error solicitando números:', error);
                    alert('Error al solicitar números: ' + error.message);
                }
            });
        }

        const btnAddPub = document.getElementById('btn-add-pub-temp');
        if (btnAddPub) {
            btnAddPub.addEventListener('click', () => {
                showModal(`
                    <h3 class="text-xl font-bold mb-4 text-teal-400">Nuevo Publicador</h3>
                    <input type="text" id="new-temp-pub" placeholder="Nombre Completo" class="w-full mb-4">
                    <button id="save-temp-pub" class="w-full bg-teal-600 py-2 rounded-lg text-white">Guardar</button>
                `, async (modal) => {
                    document.getElementById('save-temp-pub').addEventListener('click', async () => {
                        const name = document.getElementById('new-temp-pub').value;
                        if (name) {
                            await addPublicador({ nombre: name });
                            modal.classList.add('hidden');
                            alert("Publicador agregado");
                            window.location.reload();
                        }
                    });
                });
            });
        }

        window.updatePhonePub = async (id, pubId) => {
            // Este método ya no se usa directamente desde la tabla, pero lo mantengo por compatibilidad
            await window.updatePhoneStatus(id, undefined, pubId);
        };
    }

    // --- LOGIC: DASHBOARD FILTER ---
    if (activeModules.dashboard) {
        const dashDiv = document.getElementById('dashboard-assignments');

        const renderAssignments = async (name) => {
            if (!name) {
                dashDiv.innerHTML = '<p class="text-gray-400">Selecciona tu nombre.</p>';
                return;
            }

            dashDiv.innerHTML = '<p class="text-gray-400 animate-pulse">Cargando asignaciones...</p>';

            // Filter program for this conductor
            const programa = await getProgramaSemanal();
            let assignments = [];

            const turnos = ['manana', 'tarde', 'noche'];
            const turnoLabels = { manana: '🌅 Mañana', tarde: '☀️ Tarde', noche: '🌙 Noche' };

            programa.dias.forEach(d => {
                turnos.forEach(turno => {
                    const turnoData = d[turno];
                    if (turnoData) {
                        if (turnoData.conductor === name) {
                            assignments.push({
                                dia: d.nombre,
                                turno: turnoLabels[turno],
                                role: 'Conductor',
                                ...turnoData
                            });
                        }
                        if (turnoData.auxiliar === name) {
                            assignments.push({
                                dia: d.nombre,
                                turno: turnoLabels[turno],
                                role: 'Auxiliar',
                                ...turnoData
                            });
                        }
                    }
                });
            });

            if (assignments.length === 0) {
                dashDiv.innerHTML = `<p class="text-gray-300">Hola ${name}, no tienes asignaciones esta semana.</p>`;
            } else {
                dashDiv.innerHTML = `
                    <h3 class="font-bold text-teal-300 mb-3">Asignaciones para ${name}</h3>
                    <div class="grid gap-3">
                        ${assignments.map(a => `
                            <div class="bg-teal-900/30 p-3 rounded border border-teal-500/30">
                                <div class="flex justify-between">
                                    <span class="font-bold text-white">${a.dia} - ${a.turno}</span>
                                    <span class="text-xs bg-teal-600 px-2 rounded">${a.role}</span>
                                </div>
                                <div class="text-sm text-gray-300 mt-1">
                                    🕒 ${a.hora || '-'} | 📍 ${a.lugar || '-'} <br>
                                    🗺️ Territorio: ${a.territorio || '-'}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        };


        // Auto-load assignments for current conductor
        console.log('Auto-loading assignments for:', currentConductorName);
        if (currentConductorName && currentConductorName !== "Conductor") {
            setTimeout(() => {
                renderAssignments(currentConductorName);
            }, 500); // Small delay to ensure programa is loaded
        }
    }
};

const getStatusColor = (status) => {
    switch (status) {
        case 'Contestaron': return 'text-green-400';
        case 'Testigo': return 'text-purple-400';
        case 'Revisita': return 'text-yellow-400';
        case 'No llamar': return 'text-red-400';
        case 'Suspendido': return 'text-orange-400';
        case 'Colgaron': return 'text-gray-400';
        case 'No contestaron': return 'text-blue-400';
        case 'Sin asignar': return 'text-gray-300';
        case 'Pendiente': return 'text-gray-300'; // Backward compatibility
        default: return 'text-gray-300';
    }
};

const showModal = (content, onOpen) => {
    let modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-container';
        modalContainer.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm hidden flex items-center justify-center z-50';
        document.body.appendChild(modalContainer);
    }

    modalContainer.innerHTML = `
        <div class="morphinglass-card w-full max-w-md m-4 relative animate-fade-in bg-black">
            <button class="absolute top-4 right-4 text-gray-400 hover:text-white" onclick="document.getElementById('modal-container').classList.add('hidden')">✕</button>
            ${content}
        </div>
    `;
    modalContainer.classList.remove('hidden');
    if (onOpen) onOpen(modalContainer);
};
