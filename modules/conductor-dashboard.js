
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
             <div class="bg-gradient-to-br from-teal-900/40 to-black/40 p-4 rounded-xl border border-teal-500/20">
                <div class="flex justify-between">
                    <span class="font-bold text-teal-100">${a.dia} <span class="text-teal-400 font-normal text-sm">${a.turno}</span></span>
                    <span class="text-xs bg-teal-500/20 text-teal-300 px-2 py-1 rounded">${a.role}</span>
                </div>
                <div class="mt-2 text-sm text-gray-400 flex flex-col gap-1">
                    <span>📍 ${a.lugar || 'Sin lugar'}</span>
                    <span>🗺️ Territorio ${a.territorio || '?'}</span>
                </div>
            </div>
        `).join('') : '<p class="text-gray-500 text-sm italic col-span-full">No tienes asignaciones en el programa esta semana.</p>';
    });

    // 2. Load Territories (Parallel)
    getMisTerritorios(name).then(territorios => {
        if (territorios.length === 0) {
            territoriosContainer.innerHTML = ''; // Clear skeleton
            document.getElementById('no-territories-msg').classList.remove('hidden');
        } else {
            document.getElementById('no-territories-msg').classList.add('hidden');
            territoriosContainer.innerHTML = territorios.map(t => `
                <div class="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col gap-3 group hover:border-teal-500/30 transition-all">
                    <!-- Image Thumbnail with Click-to-Zoom -->
                    <div class="bg-gray-800 h-40 rounded-lg overflow-hidden relative cursor-pointer" onclick="window.viewMap('${t.imagen}')">
                        <img src="${t.imagen || 'https://via.placeholder.com/300x200?text=Sin+Mapa'}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all transform group-hover:scale-105">
                        <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span class="text-white text-sm font-bold bg-black/60 px-3 py-1 rounded-full backdrop-blur">🔍 Ver Mapa</span>
                        </div>
                    </div>
                    
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="text-lg font-bold text-teal-200">Territorio ${t.numero}</h4>
                            <p class="text-xs text-gray-400">Manzanas: ${t.manzanas || 'Todas'}</p>
                        </div>
                        <span class="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-1 rounded border border-teal-500/30">Asignado</span>
                    </div>

                    <div class="flex gap-2 mt-2">
                         <button onclick="window.openProgressModal('${t.id}', '${t.numero}', '${t.manzanas || ''}')" 
                            class="flex-1 bg-teal-600/20 hover:bg-teal-600/40 text-teal-300 border border-teal-500/30 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2">
                            <span>✅</span> Reportar/Liberar
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
        <div class="relative max-w-4xl w-full p-4">
             <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="absolute top-0 right-0 m-6 text-white text-3xl z-10 hover:text-red-400">&times;</button>
             <img src="${url}" class="w-full h-auto rounded-xl shadow-2xl border border-white/20">
        </div>
    `;
    modal.classList.remove('hidden');
};

// Progress / Return Modal
window.openProgressModal = (id, numero, manzanasStr) => {
    const manzanas = manzanasStr ? manzanasStr.split(',').map(s => s.trim()).filter(s => s) : [];

    // Checkbox generation
    const checkboxHtml = manzanas.length > 0 ? `
        <div class="grid grid-cols-2 gap-2 mb-4 max-h-40 overflow-y-auto bg-black/20 p-2 rounded border border-white/5">
            ${manzanas.map((m, idx) => `
                <label class="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer hover:bg-white/5 p-1 rounded">
                    <input type="checkbox" value="${m}" class="manzana-check accent-teal-500 w-4 h-4">
                    <span>Manzana ${m}</span>
                </label>
            `).join('')}
        </div>
        <p class="text-xs text-yellow-500/80 mb-4">* Selecciona SOLAMENTE las manzanas que ya se terminaron.</p>
    ` : `<p class="text-sm text-gray-400 italic mb-4">Este territorio no tiene manzanas definidas. Se devolverá completo.</p>`;

    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 class="text-xl font-bold text-teal-100 mb-2">Reportar Territorio ${numero}</h3>
            <p class="text-sm text-gray-400 mb-4">Marca lo que has completado para liberarlo y dejarlo disponible para otros conductores.</p>
            
            ${checkboxHtml}

            <div class="flex flex-col gap-3">
                <button id="btn-return-partial" class="w-full bg-teal-600 hover:bg-teal-500 text-white py-2 rounded-lg font-medium transition-colors ${manzanas.length === 0 ? 'hidden' : ''}">
                    Liberar Manzanas Seleccionadas
                </button>
                <button id="btn-return-all" class="w-full bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/30 py-2 rounded-lg font-medium transition-colors">
                    Marcar TODO como Predicado
                </button>
                <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-full text-gray-400 hover:text-white py-2 text-sm">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');

    // Return ALL Logic
    document.getElementById('btn-return-all').addEventListener('click', async () => {
        if (confirm("¿Seguro que deseas marcar TODO el territorio como terminado?")) {
            await returnTerritorio(id);
            modal.classList.add('hidden');
            window.location.reload();
        }
    });

    // Return PARTIAL Logic
    const btnPartial = document.getElementById('btn-return-partial');
    if (btnPartial) {
        btnPartial.addEventListener('click', async () => {
            const selected = Array.from(document.querySelectorAll('.manzana-check:checked')).map(cb => cb.value);
            if (selected.length === 0) {
                alert("Selecciona al menos una manzana.");
                return;
            }
            if (selected.length === manzanas.length) {
                // All selected -> Same as Return All
                if (confirm("Has seleccionado todas las manzanas. ¿Marcar territorio completo como terminado?")) {
                    await returnTerritorio(id);
                    modal.classList.add('hidden');
                    window.location.reload();
                }
                return;
            }

            const remaining = manzanas.filter(m => !selected.includes(m));
            if (confirm(`Vas a liberar las manzanas: ${selected.join(', ')}. \nTe quedarás con: ${remaining.join(', ')}.`)) {
                await returnTerritorioParcial(id, selected.join(', '), remaining.join(', '));
                modal.classList.add('hidden');
                window.location.reload();
            }
        });
    }
};

/* --- (OTHER RENDER FUNCTIONS: renderProgramTable, initializePhoneModule KEPT AS IS) --- */
// Reuse existing functions from previous context if available, otherwise redefine them here briefly to ensure validity.
// Since we are rewriting the file, we must include them.

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
        <div class="bg-white p-4 min-w-[800px]">
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
            html += `<tr>`;
            if (fieldIdx === 0) {
                html += `<td class="${turno.headerColor} font-bold border border-gray-400 p-3 text-center align-middle text-gray-800" rowspan="${fields.length}">${turno.label}</td>`;
                html += `<td class="${turno.headerColor} font-bold border border-gray-400 p-2 text-gray-800">${field}</td>`;
            } else {
                html += `<td class="${turno.headerColor} font-bold border border-gray-400 p-2 text-gray-800">${field}</td>`;
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
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const estados = ['Sin asignar', 'Contestaron', 'No contestan', 'Colgaron', 'Revisita', 'No llamar', 'Suspendido', 'Testigo'];

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
                        ${publicadores.map(p => `<option value="${p.id}" ${p.id === currentPubId ? 'selected' : ''} class="bg-gray-900">${p.nombre}</option>`).join('')}
                    </select>
                </td>
                <td class="p-2">
                    <select onchange="window.updatePhoneStatus('${t.id}', this.value, '${currentPubId}')" 
                        class="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-sm font-medium focus:border-teal-500 outline-none cursor-pointer hover:bg-black/50 transition-colors ${getStatusColor(currentStatus)}">
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
            try {
                const count = await solicitarNumeros(50, userId);
                alert(`Se asignaron ${count} números nuevos.`);
                const newTels = await getMisTelefonos(userId);
                telefonos.length = 0; telefonos.push(...newTels);
                render();
            } catch (err) { alert('Error: ' + err.message); }
        });
    }

    const btnAddPub = document.getElementById('btn-add-pub-temp');
    if (btnAddPub) {
        const newBtn = btnAddPub.cloneNode(true);
        btnAddPub.parentNode.replaceChild(newBtn, btnAddPub);
        newBtn.addEventListener('click', () => {
            // Re-using showModal if available or simple prompt for now
            const name = prompt("Nombre del nuevo publicador:");
            if (name) {
                addPublicador({ nombre: name }).then(() => {
                    alert("Agregado");
                    location.reload();
                });
            }
        });
    }

    window.updatePhoneStatus = async (id, status, pubId) => {
        const telIndex = telefonos.findIndex(t => t.id === id);
        if (telIndex !== -1) {
            telefonos[telIndex].estado = status;
            telefonos[telIndex].publicador_asignado = pubId;
            render();
        }
        await updateTelefonoStatus(id, status, pubId);
    };
};
