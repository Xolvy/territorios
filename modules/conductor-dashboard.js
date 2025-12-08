import {
    getConfiguracion, getProgramaSemanal, saveProgramaSemanal,
    getMisTelefonos, solicitarNumeros, updateTelefonoStatus,
    getPublicadores, getConductores, addPublicador
} from '../data/firestore-services.js';
import { auth } from '../firebase-config.js';

export const renderConductorDashboard = async (container, userEmail) => {
    const config = await getConfiguracion();
    const activeModules = config.modulos_activos;
    const conductores = await getConductores();

    // Identificar usuario actual (simulado o real)
    // En producción usaríamos user.uid, aquí usamos email para mapear o un selector
    let currentConductorName = "Conductor";
    const conductorMatch = conductores.find(c => c.email === userEmail);
    if (conductorMatch) currentConductorName = conductorMatch.nombre;

    container.innerHTML = `
        <div class="w-full max-w-7xl animate-fade-in pb-10">
            <header class="flex justify-between items-center mb-8 p-4 morphinglass-card">
                <div>
                    <h1 class="text-2xl font-bold text-teal-400">Panel de Conductor</h1>
                    <p class="text-sm text-gray-400">Bienvenido, ${currentConductorName}</p>
                </div>
                <div class="flex items-center gap-4">
                    <select id="conductor-selector" class="bg-black/30 border border-teal-500/30 rounded px-3 py-1 text-sm">
                        <option value="">-- Soy... --</option>
                        ${conductores.map(c => `<option value="${c.nombre}" ${c.email === userEmail ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                    </select>
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
                            <div class="flex gap-2">
                                <button id="export-prog-png" class="text-xs bg-teal-600/50 px-3 py-1 rounded hover:bg-teal-600 border border-teal-500/30">Exportar PNG</button>
                                <button id="save-prog" class="text-xs bg-blue-600/50 px-3 py-1 rounded hover:bg-blue-600 border border-blue-500/30">Guardar Cambios</button>
                            </div>
                        </div>
                        <div class="overflow-x-auto bg-white text-black rounded-lg p-2" id="program-table-container">
                            <!-- Tabla dinámica estilo Excel -->
                        </div>
                    </section>
                ` : ''}

                ${activeModules.predicacion_telefonica ? `
                    <section class="morphinglass-card">
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-xl font-bold text-teal-200">📞 Predicación Telefónica</h2>
                            <div class="flex gap-2">
                                <button id="btn-solicitar" class="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm transition-colors shadow-lg shadow-teal-500/20">
                                    Solicitar 50 Números
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
        await auth.signOut();
        window.location.reload();
    });

    // --- LOGIC: PROGRAMA PREDICACIÓN ---
    if (activeModules.programa_predicacion) {
        const programa = await getProgramaSemanal();
        const containerTable = document.getElementById('program-table-container');

        const renderProgramTable = () => {
            // Header
            let html = `
                <div class="text-center font-bold text-xl mb-2 uppercase border-b-2 border-black pb-2">
                    Congregación "${config.congregacion?.nombre || '...'}" ${config.congregacion?.numero || ''} <br>
                    Programa de Predicación
                </div>
                <table class="w-full border-collapse text-xs md:text-sm border border-gray-400">
                    <thead>
                        <tr class="bg-teal-100">
                            <th class="border border-gray-400 p-1 w-20">Detalle</th>
                            ${programa.dias.map(d => `<th class="border border-gray-400 p-1 uppercase">${d.nombre}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Rows: Lugar, Hora, Conductor, Auxiliar, Faceta, Territorio
            const fields = ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Territorio'];

            fields.forEach(field => {
                html += `<tr><td class="bg-orange-100 font-bold border border-gray-400 p-1">${field}</td>`;
                programa.dias.forEach((dia, dayIndex) => {
                    // Turno Mañana (simplificado: solo mostramos 1 turno por día para demo, o concatenamos)
                    // Para hacerlo editable como la imagen, necesitamos inputs
                    const val = dia[field.toLowerCase()] || '';
                    html += `<td class="border border-gray-400 p-0">
                        <input type="text" class="w-full h-full p-1 bg-transparent border-none focus:bg-yellow-50 text-center" 
                            value="${val}" 
                            data-day="${dayIndex}" 
                            data-field="${field.toLowerCase()}">
                    </td>`;
                });
                html += `</tr>`;
            });

            html += `</tbody></table>`;
            containerTable.innerHTML = html;

            // Bind inputs
            containerTable.querySelectorAll('input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const dayIdx = e.target.dataset.day;
                    const field = e.target.dataset.field;
                    programa.dias[dayIdx][field] = e.target.value;
                });
            });
        };

        renderProgramTable();

        document.getElementById('save-prog').addEventListener('click', async () => {
            await saveProgramaSemanal(programa);
            alert("Programa guardado");
        });

        document.getElementById('export-prog-png').addEventListener('click', () => {
            html2canvas(containerTable, { scale: 2 }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'programa_semanal.png';
                link.href = canvas.toDataURL();
                link.click();
            });
        });
    }

    // --- LOGIC: PREDICACIÓN TELEFÓNICA ---
    if (activeModules.predicacion_telefonica) {
        const tbody = document.getElementById('lista-telefonos');
        const publicadores = await getPublicadores();

        // Mock user ID for assignment (using email or selector)
        const userId = userEmail;

        const renderTelefonos = async () => {
            const telefonos = await getMisTelefonos(userId);

            tbody.innerHTML = telefonos.map(t => `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-3 font-mono text-teal-300">${t.numero}</td>
                    <td class="p-3 text-gray-400 text-xs">${t.direccion}</td>
                    <td class="p-3 text-gray-300">${t.propietario}</td>
                    <td class="p-3">
                        <select class="bg-black/30 border border-white/10 rounded text-xs p-1 w-full" onchange="window.updatePhonePub('${t.id}', this.value)">
                            <option value="">Seleccione uno</option>
                            ${publicadores.map(p => `<option value="${p.id}" ${t.publicador_asignado === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('')}
                        </select>
                    </td>
                    <td class="p-3">
                        <select class="bg-black/30 border border-white/10 rounded text-xs p-1 w-full ${getStatusColor(t.estado)}" onchange="window.updatePhoneStatus('${t.id}', this.value)">
                            <option value="Pendiente" ${t.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="Colgaron" ${t.estado === 'Colgaron' ? 'selected' : ''}>Colgaron</option>
                            <option value="Contestaron" ${t.estado === 'Contestaron' ? 'selected' : ''}>Contestaron</option>
                            <option value="No llamar" ${t.estado === 'No llamar' ? 'selected' : ''}>No llamar</option>
                            <option value="Revisita" ${t.estado === 'Revisita' ? 'selected' : ''}>Revisita</option>
                        </select>
                    </td>
                </tr>
            `).join('');
        };

        await renderTelefonos();

        document.getElementById('btn-solicitar').addEventListener('click', async () => {
            const count = await solicitarNumeros(50, userId);
            alert(`Se asignaron ${count} números nuevos.`);
            await renderTelefonos();
        });

        document.getElementById('btn-add-pub-temp').addEventListener('click', () => {
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

        window.updatePhoneStatus = async (id, status) => {
            await updateTelefonoStatus(id, status, undefined); // Keep current pub
        };

        window.updatePhonePub = async (id, pubId) => {
            // Update local UI or fetch?
            // For simplicity, we just update the doc. Ideally we re-fetch or update local state.
            await updateTelefonoStatus(id, undefined, pubId);
        };
    }

    // --- LOGIC: DASHBOARD FILTER ---
    if (activeModules.dashboard) {
        const selector = document.getElementById('conductor-selector');
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
            programa.dias.forEach(d => {
                if (d.conductor === name) assignments.push({ dia: d.nombre, role: 'Conductor', ...d });
                if (d.auxiliar === name) assignments.push({ dia: d.nombre, role: 'Auxiliar', ...d });
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
                                    <span class="font-bold text-white">${a.dia}</span>
                                    <span class="text-xs bg-teal-600 px-2 rounded">${a.role}</span>
                                </div>
                                <div class="text-sm text-gray-300 mt-1">
                                    🕒 ${a.hora} | 📍 ${a.lugar} <br>
                                    🗺️ Territorio: ${a.territorio}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        };

        selector.addEventListener('change', (e) => {
            renderAssignments(e.target.value);
        });

        // Auto-load for current user if identified
        if (currentConductorName && currentConductorName !== "Conductor") {
            renderAssignments(currentConductorName);
        }
    }
};

const getStatusColor = (status) => {
    switch (status) {
        case 'Contestaron': return 'text-green-400';
        case 'No llamar': return 'text-red-400';
        case 'Revisita': return 'text-yellow-400';
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
