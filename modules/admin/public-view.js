import {
    getPredicacionPublica, getPublicadores, getConfiguracion, savePredicacionPublica
} from '../../data/firestore-services.js?v=2.3.9.2';
import { showNotification } from '../utils/helpers.js?v=2.3.9.2';
import { showCustomConfirm, showModal } from '../services/ui-helpers.js?v=2.3.9.2';
import html2canvas from 'html2canvas';

export const renderPredicacionTab = async (container) => {
    let data = await getPredicacionPublica();
    const publicadores = await getPublicadores();
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const config = await getConfiguracion();

    let currentSearchQuery = '';
    let currentView = window.innerWidth < 1024 ? 'matrix' : 'table';

    const formatTimeDisplay = (time) => {
        if (!time) return '—';
        let parts = time.split(':');
        let h = parts[0] || '00';
        let m = parts[1] || '00';
        return `${h.padStart(2, '0')}:${m.padEnd(2, '0')}`;
    };

    const renderMainLayout = () => {
        container.innerHTML = `
            <div class="space-y-10 animate-fade-in pb-10">
                <!-- Executive Header -->
                <header class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white dark:bg-white/[0.02] p-6 lg:p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-xl">
                    <div class="flex items-center gap-6">
                        <div class="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-3xl text-primary shadow-inner">
                            <i class="fas fa-street-view"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl lg:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-2">Predicación Pública</h3>
                            <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] ml-1 opacity-70">Logística de Turnos S-13</p>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                        <div class="relative flex-1 lg:min-w-[400px] group no-print">
                            <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"><i class="fas fa-search text-xs"></i></span>
                            <input type="text" id="public-search" placeholder="Filtrar día o publicador..." value="${currentSearchQuery}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-4 py-4 text-xs font-black shadow-inner outline-none focus:border-primary transition-all uppercase">
                        </div>
                        
                        <div class="grid grid-cols-3 gap-3 w-full lg:w-auto no-print">
                            <button id="toggle-view-btn" class="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95">
                                <i class="fas ${currentView === 'table' ? 'fa-th-large' : 'fa-list'}"></i> ${currentView === 'table' ? 'Matriz' : 'Lista'}
                            </button>
                            <button id="add-row-btn" class="bg-primary hover:bg-primary-light text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                                <i class="fas fa-plus"></i> Nuevo
                            </button>
                            <button id="export-pdf" class="bg-white dark:bg-white/5 text-slate-500 hover:text-primary px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-white/10 transition-all flex items-center justify-center gap-3 active:scale-95">
                                <i class="fas fa-download"></i> PDF
                            </button>
                        </div>
                    </div>
                </header>

                <div id="public-save-status" class="hidden flex items-center justify-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-0 transition-opacity">
                    <span class="w-2 h-2 bg-primary rounded-full animate-pulse"></span> Sincronizado con éxito
                </div>

                <!-- Main Display Area -->
                <div class="modern-card !p-0 overflow-visible border border-slate-100 dark:border-white/5 min-h-[500px] shadow-2xl relative bg-white dark:bg-[#0d1117] rounded-[2.5rem]" id="pdf-content">
                    <div id="matrix-bg" class="absolute inset-0 bg-slate-50 dark:bg-black/40 opacity-0 transition-opacity pointer-events-none rounded-[2.5rem]"></div>
                    
                    <div id="view-container" class="relative z-10 w-full">
                        <!-- Content depends on currentView -->
                    </div>

                    ${!data.asignaciones || data.asignaciones.length === 0 ? `
                    <div class="flex flex-col items-center justify-center py-40 text-slate-300 dark:text-white/10 relative z-10" id="empty-state">
                        <div class="w-24 h-24 mb-6 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center text-4xl shadow-inner border border-slate-100 dark:border-white/5">
                            <i class="fas fa-calendar-alt opacity-20"></i>
                        </div>
                        <p class="text-[11px] font-black uppercase tracking-[0.5em] opacity-40">Agenda vacía</p>
                    </div>` : ''}
                </div>

                <datalist id="list-publicadores">
                    ${publicadores.map(p => `<option value="${p.nombre}">`).join('')}
                </datalist>
            </div>
        `;

        // Bind Search
        const searchInput = container.querySelector('#public-search');
        if (searchInput) {
            searchInput.oninput = (e) => {
                currentSearchQuery = e.target.value.trim().toLowerCase();
                renderCurrentView();
            };
        }

        // Bind Toggle
        container.querySelector('#toggle-view-btn').onclick = () => {
            currentView = currentView === 'table' ? 'matrix' : 'table';
            renderMainLayout();
            renderCurrentView();
        };

        // Bind Add
        container.querySelector('#add-row-btn').onclick = async () => {
            data.asignaciones = data.asignaciones || [];
            data.asignaciones.push({ dia: '', hora: '', hora_fin: '', lugar: '', publicador: '', companero: '' });
            await savePredicacionPublica(data);
            renderCurrentView();
        };

        // Bind PDF
        container.querySelector('#export-pdf').onclick = () => {
            const { jsPDF } = window.jspdf;
            const target = container.querySelector('#pdf-content');
            showNotification("Generando reporte ejecutivo...", "info");

            html2canvas(target, {
                scale: 2,
                backgroundColor: (document.documentElement.classList.contains('dark') ? '#0d1117' : '#ffffff'),
                logging: false,
                ignoreElements: (el) => el.classList.contains('no-print')
            }).then(canvas => {
                const doc = new jsPDF('l', 'mm', 'a4');
                const imgData = canvas.toDataURL('image/png');
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                doc.save(`S13_Public_Witnessing_${new Date().toISOString().split('T')[0]}.pdf`);
                showNotification("Reporte generado", "success");
            });
        };
    };

    const filterData = () => {
        if (!currentSearchQuery) return data.asignaciones || [];
        return (data.asignaciones || []).filter(row => {
            const d = (row.dia || '').toLowerCase();
            const p = (row.publicador || '').toLowerCase();
            const c = (row.companero || '').toLowerCase();
            const l = (row.lugar || '').toLowerCase();
            return d.includes(currentSearchQuery) || p.includes(currentSearchQuery) || c.includes(currentSearchQuery) || l.includes(currentSearchQuery);
        });
    };

    const renderCurrentView = () => {
        if (currentView === 'table') renderTable();
        else renderMatrix();

        const exportBtn = container.querySelector('#export-pdf');
        if (exportBtn) {
            exportBtn.onclick = () => {
                const element = container.querySelector('#pdf-content');
                const { jsPDF } = window.jspdf;
                showNotification("Generando PDF S-13...", "info");

                html2canvas(element, {
                    scale: 2,
                    backgroundColor: (document.documentElement.classList.contains('dark') ? '#0d1117' : '#ffffff'),
                    logging: false,
                    useCORS: true
                }).then(canvas => {
                    const doc = new jsPDF('l', 'mm', 'a4');
                    const imgData = canvas.toDataURL('image/png');
                    const pdfWidth = doc.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    doc.addImage(imgData, 'PNG', 5, 5, pdfWidth - 10, Math.min(pdfHeight, 190));
                    doc.save(`S13_Publica_${new Date().toISOString().split('T')[0]}.pdf`);
                    showNotification("PDF generado con éxito", "success");
                });
            };
        }
    };

    const renderTable = () => {
        const viewCont = container.querySelector('#view-container');
        if (!viewCont) return;

        const filtered = filterData();

        viewCont.innerHTML = `
            <div class="table-container custom-scrollbar overflow-x-auto lg:overflow-x-visible">
                <table class="w-full text-left border-collapse table-auto md:table-fixed">
                    <thead class="bg-slate-50/50 dark:bg-white/[0.02] text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] border-b border-slate-100 dark:border-white/5">
                        <tr>
                            <th class="px-4 py-6">Día</th>
                            <th class="px-4 py-6 text-center">Horario Estipulado</th>
                            <th class="px-4 py-6">Punto de Predicación</th>
                            <th class="px-4 py-6 text-center">Publicador Principal</th>
                            <th class="px-4 py-6 text-center">Acompañante</th>
                            <th class="px-4 py-6 text-right no-print">Opciones</th>
                        </tr>
                    </thead>
                    <tbody id="public-table-body" class="divide-y divide-slate-100 dark:divide-white/5">
                        ${filtered.map((row, idx) => {
            const originalIndex = data.asignaciones.indexOf(row);
            return `
                            <tr class="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all group">
                                <td class="px-4 py-5">
                                    <div class="relative min-w-[100px]">
                                        <select class="w-full bg-slate-100/50 dark:bg-white/5 border border-transparent rounded-2xl px-3 py-3.5 text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all cursor-pointer shadow-sm uppercase tracking-tight appearance-none"
                                            onchange="window.updatePublicRow(${originalIndex}, 'dia', this.value)">
                                            <option value="" disabled ${!row.dia ? 'selected' : ''}>— Día —</option>
                                            ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d =>
                `<option value="${d}" ${row.dia === d ? 'selected' : ''}>${d}</option>`
            ).join('')}
                                        </select>
                                        <i class="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[9px] opacity-20 pointer-events-none"></i>
                                    </div>
                                </td>
                                <td class="px-4 py-5">
                                    <div class="flex items-center gap-1 justify-center bg-slate-50 dark:bg-white/5 p-2 rounded-2xl border border-slate-200/50 dark:border-white/10 shadow-inner min-w-[250px]">
                                        <div class="relative group/time">
                                            <i class="far fa-clock absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 opacity-50"></i>
                                            <input type="time" class="w-24 bg-transparent border-none pl-8 pr-2 py-2 text-[11px] font-black text-primary outline-none text-center"
                                                value="${formatTimeDisplay(row.hora)}"
                                                onchange="window.updatePublicRow(${originalIndex}, 'hora', this.value)">
                                        </div>
                                        <span class="text-slate-300 dark:text-white/10 font-bold">—</span>
                                        <div class="relative group/time">
                                            <i class="far fa-clock absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 opacity-50"></i>
                                            <input type="time" class="w-24 bg-transparent border-none pl-8 pr-2 py-2 text-[11px] font-black text-primary outline-none text-center"
                                                value="${formatTimeDisplay(row.hora_fin)}"
                                                onchange="window.updatePublicRow(${originalIndex}, 'hora_fin', this.value)">
                                        </div>
                                    </div>
                                </td>
                                <td class="px-4 py-5">
                                    <div class="relative min-w-[180px]">
                                        <select class="w-full bg-slate-100/50 dark:bg-white/5 border border-transparent rounded-2xl px-4 py-3.5 text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all cursor-pointer shadow-sm appearance-none uppercase"
                                            onchange="window.updatePublicRow(${originalIndex}, 'lugar', this.value)">
                                            <option value="" disabled ${!row.lugar ? 'selected' : ''}>— Seleccionar Punto —</option>
                                            ${(config.lugares || []).map(lugar =>
                `<option value="${lugar}" ${row.lugar === lugar ? 'selected' : ''}>${lugar}</option>`
            ).join('')}
                                        </select>
                                        <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[9px] opacity-20 pointer-events-none"></i>
                                    </div>
                                </td>
                                <td class="px-4 py-5">
                                    <input list="list-publicadores" type="text"
                                        class="w-full bg-slate-100/50 dark:bg-white/5 border border-transparent rounded-2xl px-4 py-3.5 text-[11px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-white/10 shadow-sm uppercase min-w-[200px]"
                                        value="${row.publicador || ''}"
                                        placeholder="Publicador..."
                                        onchange="window.updatePublicRow(${originalIndex}, 'publicador', this.value)">
                                </td>
                                <td class="px-4 py-5">
                                    <input list="list-publicadores" type="text"
                                        class="w-full bg-slate-100/50 dark:bg-white/5 border border-transparent rounded-2xl px-4 py-3.5 text-[11px] font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-white/10 shadow-sm uppercase min-w-[200px]"
                                        value="${row.companero || ''}"
                                        placeholder="Acompañante..."
                                        onchange="window.updatePublicRow(${originalIndex}, 'companero', this.value)">
                                </td>
                                <td class="px-4 py-5 text-right no-print opacity-20 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    <button class="w-10 h-10 inline-flex items-center justify-center text-primary-light hover:bg-primary/10 rounded-xl transition-all mr-1"
                                        onclick="window.editPublicRowModal(${originalIndex})" title="Editar Detalle">
                                        <i class="fas fa-edit text-xs"></i>
                                    </button>
                                    <button class="w-10 h-10 inline-flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                                        onclick="window.deletePublicRow(${originalIndex})" title="Eliminar">
                                        <i class="fas fa-trash-alt text-xs"></i>
                                    </button>
                                </td>
                            </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    const renderMatrix = () => {
        const viewCont = container.querySelector('#view-container');
        if (!viewCont) return;

        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const filteredAsignaciones = filterData();
        const byDay = {};
        dias.forEach(d => byDay[d] = filteredAsignaciones.filter(a => a.dia === d).sort((a, b) => (a.hora || '').localeCompare(b.hora || '')));

        container.querySelector('#matrix-bg').classList.add('opacity-100');
        const emptyState = container.querySelector('#empty-state');
        if (emptyState) emptyState.classList.add('hidden');

        viewCont.innerHTML = `
            <div class="p-8 lg:p-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6 min-h-[600px] relative z-10 transition-all duration-700">
                ${dias.map(dia => `
                    <div class="flex flex-col gap-6">
                        <div class="p-5 bg-slate-900 dark:bg-white/5 text-white lg:text-slate-200 text-center font-black rounded-3xl shadow-2xl text-[10px] uppercase tracking-[0.4em] border border-white/5">${dia}</div>
                        <div class="flex flex-col gap-5">
                            ${byDay[dia].length > 0 ? byDay[dia].map(row => {
            const originalIdx = data.asignaciones.indexOf(row);
            const timeStr = `${formatTimeDisplay(row.hora)} - ${formatTimeDisplay(row.hora_fin)}`;
            return `
                                    <div class="p-6 bg-white dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 rounded-[2.5rem] shadow-lg group relative hover:border-primary/50 transition-all duration-500 hover:-translate-y-1">
                                        <div class="text-[10px] font-black text-primary mb-3.5 flex items-center gap-2">
                                            <i class="far fa-clock"></i>
                                            ${timeStr}
                                        </div>
                                        <div class="text-[13px] font-black text-slate-800 dark:text-white mb-5 uppercase tracking-tighter leading-tight break-words">${row.lugar || 'Ubicación General'}</div>
                                        <div class="space-y-4 border-t border-slate-50 dark:border-white/5 pt-5">
                                             <div class="text-[11px] font-black text-slate-700 dark:text-slate-200 flex items-center gap-3 uppercase">
                                                <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] text-primary shrink-0"><i class="fas fa-user-tie"></i></div>
                                                <span class="break-words">${row.publicador || '—'}</span>
                                             </div>
                                             <div class="text-[10px] font-bold text-slate-400 dark:text-slate-400 flex items-center gap-3 uppercase">
                                                <div class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] text-slate-400 shrink-0"><i class="fas fa-id-card-clip"></i></div>
                                                <span class="break-words">${row.companero || '—'}</span>
                                             </div>
                                        </div>
                                        <div class="absolute -top-3 -right-3 flex gap-2 no-print opacity-0 group-hover:opacity-100 transition-all">
                                            <button onclick="window.editPublicRowModal(${originalIdx})" class="bg-indigo-600 text-white rounded-2xl w-10 h-10 flex items-center justify-center text-xs shadow-xl shadow-indigo-500/20 hover:scale-110 active:scale-95">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="window.deletePublicRow(${originalIdx})" class="bg-rose-500 text-white rounded-2xl w-10 h-10 flex items-center justify-center text-xs shadow-xl shadow-rose-500/20 hover:scale-110 active:scale-95"> 
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                `;
        }).join('') : `
                                <div class="text-[9px] text-slate-400 text-center py-20 italic border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[2.5rem] flex flex-col items-center gap-4 group hover:border-primary/20 transition-all opacity-40">
                                    <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-xl">
                                        <i class="fas fa-couch"></i>
                                    </div>
                                    <span class="font-black uppercase tracking-widest">Disponible</span>
                                </div>`}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    window.editPublicRowModal = (idx) => {
        const row = data.asignaciones[idx];
        showModal(`
            <div class="p-8 space-y-8 bg-white dark:bg-[#0a0f18] rounded-[2.5rem]">
                <header class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-3xl text-primary shadow-inner">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Editar Turno</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1">Modificar registro S-13</p>
                    </div>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Día</label>
                        <select id="edit-p-dia" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold uppercase text-slate-700 dark:text-white outline-none">
                            ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => `<option value="${d}" ${row.dia === d ? 'selected' : ''}>${d}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Horario</label>
                        <div class="flex items-center gap-2">
                            <input type="time" id="edit-p-hora" value="${row.hora || ''}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold text-primary outline-none text-center">
                            <span class="text-slate-300">—</span>
                            <input type="time" id="edit-p-hora-fin" value="${row.hora_fin || ''}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold text-primary outline-none text-center">
                        </div>
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lugar de Predicación</label>
                        <select id="edit-p-lugar" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold uppercase text-slate-700 dark:text-white outline-none">
                            ${(config.lugares || []).map(l => `<option value="${l}" ${row.lugar === l ? 'selected' : ''}>${l}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Publicador Principal</label>
                        <input type="text" id="edit-p-pub" value="${row.publicador || ''}" list="list-publicadores" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold uppercase text-slate-700 dark:text-white outline-none">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Acompañante</label>
                        <input type="text" id="edit-p-soc" value="${row.companero || ''}" list="list-publicadores" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl text-xs font-bold uppercase text-slate-700 dark:text-white outline-none">
                    </div>
                </div>

                <div class="pt-6 border-t border-slate-50 dark:border-white/5 flex gap-4">
                    <button id="btn-cancel-edit-p" class="flex-1 py-5 bg-slate-50 dark:bg-white/5 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
                    <button id="save-edit-public" class="flex-[2] py-5 bg-primary hover:bg-primary-light text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all">GUARDAR CAMBIOS</button>
                </div>
            </div>
        `, (modal) => {
            modal.querySelector('#btn-cancel-edit-p').onclick = () => modal.classList.add('hidden');
            modal.querySelector('#save-edit-public').onclick = async () => {
                const updated = {
                    dia: modal.querySelector('#edit-p-dia').value,
                    hora: modal.querySelector('#edit-p-hora').value,
                    hora_fin: modal.querySelector('#edit-p-hora-fin').value,
                    lugar: modal.querySelector('#edit-p-lugar').value,
                    publicador: modal.querySelector('#edit-p-pub').value.trim(),
                    companero: modal.querySelector('#edit-p-soc').value.trim()
                };
                data.asignaciones[idx] = updated;
                await savePredicacionPublica(data);
                showNotification("Turno actualizado correctamente");
                renderCurrentView();
                modal.classList.add('hidden');
            };
        });
    };

    window.deletePublicRow = async (index) => {
        showCustomConfirm("¿Eliminar este turno de predicación del registro maestro?", async () => {
            data.asignaciones.splice(index, 1);
            await savePredicacionPublica(data);
            renderCurrentView();
            showNotification("Registro eliminado");
        });
    };

    window.updatePublicRow = async (index, field, value) => {
        const status = container.querySelector('#public-save-status');
        if (status) {
            status.classList.remove('hidden');
            status.classList.replace('opacity-0', 'opacity-100');
        }

        data.asignaciones[index][field] = value;
        try {
            await savePredicacionPublica(data);
            // No full render here to avoid focus loss during typing if we had lots of inputs, 
            // but for selects/times it's fine.
        } catch (e) {
            showNotification("Error de sincronización", "error");
        } finally {
            if (status) setTimeout(() => status.classList.replace('opacity-100', 'opacity-0'), 1000);
        }
    };

    renderMainLayout();
    renderCurrentView();
};
