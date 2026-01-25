import {
    getPredicacionPublica, getPublicadores, getConfiguracion, savePredicacionPublica
} from '../../data/firestore-services.js?v=2.3.0';
import { showNotification } from '../utils/helpers.js?v=2.3.0';
import { showCustomConfirm } from '../services/ui-helpers.js?v=2.3.0';
import html2canvas from 'html2canvas';

export const renderPredicacionTab = async (container) => {
    const data = await getPredicacionPublica();
    const publicadores = await getPublicadores();
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const config = await getConfiguracion();

    const formatTime = (time) => {
        if (!time) return '—';
        let [h, m] = time.split(':');
        if (!m) m = '00';
        return `${h.padStart(2, '0')}:${m.padEnd(2, '0')}`;
    };

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
                    <div id="public-save-status" class="hidden sm:flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-0 transition-opacity mr-4">
                        <span class="w-2 h-2 bg-primary rounded-full animate-pulse"></span> Sincronizado
                    </div>
                    <div class="grid grid-cols-3 gap-3 w-full lg:w-auto">
                        <button id="toggle-view-btn" class="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95">
                            <i class="fas fa-th-large"></i> Matriz
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

            <!-- Main Display Area -->
            <div class="modern-card !p-0 overflow-visible border border-slate-100 dark:border-white/5 min-h-[500px] shadow-2xl relative bg-white dark:bg-[#0d1117] rounded-[2.5rem]" id="pdf-content">
                <div id="matrix-bg" class="absolute inset-0 bg-slate-50 dark:bg-black/40 opacity-0 transition-opacity pointer-events-none rounded-[2.5rem]"></div>
                
                <!-- Table View -->
                <div id="table-view-container" class="table-container custom-scrollbar overflow-x-auto relative z-10">
                    <table class="w-full text-left border-collapse min-w-[1000px]">
                        <thead class="bg-slate-50/50 dark:bg-white/[0.02] text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] border-b border-slate-100 dark:border-white/5">
                            <tr>
                                <th class="px-8 py-6 w-48">Día</th>
                                <th class="px-8 py-6 text-center w-64">Horario Estipulado</th>
                                <th class="px-8 py-6">Punto de Predicación</th>
                                <th class="px-8 py-6 w-1/4">Publicador Principal</th>
                                <th class="px-8 py-6 w-1/4">Acompañante</th>
                                <th class="px-8 py-6 text-right no-print">Opciones</th>
                            </tr>
                        </thead>
                        <tbody id="public-table-body" class="divide-y divide-slate-100 dark:divide-white/5">
                            <!-- Rows generated here -->
                        </tbody>
                    </table>
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

    const tbody = container.querySelector('#public-table-body');

    const renderRows = () => {
        if (!tbody) return;
        tbody.innerHTML = (data.asignaciones || []).map((row, index) => `
            <tr class="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all group">
                <td class="px-8 py-5">
                    <select class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all cursor-pointer appearance-none shadow-sm uppercase tracking-tight"
                        onchange="window.updatePublicRow(${index}, 'dia', this.value)">
                        <option value="" disabled ${!row.dia ? 'selected' : ''}>— Seleccionar —</option>
                        ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d =>
            `<option value="${d}" ${row.dia === d ? 'selected' : ''}>${d}</option>`
        ).join('')}
                    </select>
                </td>
                <td class="px-8 py-5">
                    <div class="flex items-center gap-3 justify-center bg-slate-50 dark:bg-white/5 p-2 rounded-2xl border border-slate-200/50 dark:border-white/10">
                        <input type="time" class="w-24 bg-transparent border-none p-2 text-xs font-black text-primary outline-none text-center"
                            value="${row.hora || ''}"
                            onchange="window.updatePublicRow(${index}, 'hora', this.value)">
                        <span class="text-slate-300 dark:text-white/10 font-bold">—</span>
                        <input type="time" class="w-24 bg-transparent border-none p-2 text-xs font-black text-primary outline-none text-center"
                            value="${row.hora_fin || ''}"
                            onchange="window.updatePublicRow(${index}, 'hora_fin', this.value)">
                    </div>
                </td>
                <td class="px-8 py-5">
                    <select class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all cursor-pointer appearance-none shadow-sm"
                        onchange="window.updatePublicRow(${index}, 'lugar', this.value)">
                        <option value="" disabled ${!row.lugar ? 'selected' : ''}>— Punto —</option>
                        ${(config.lugares || []).map(lugar =>
            `<option value="${lugar}" ${row.lugar === lugar ? 'selected' : ''}>${lugar}</option>`
        ).join('')}
                    </select>
                </td>
                <td class="px-8 py-5">
                    <input list="list-publicadores" type="text"
                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-white/10 shadow-sm uppercase"
                        value="${row.publicador || ''}"
                        placeholder="Publicador..."
                        onchange="window.updatePublicRow(${index}, 'publicador', this.value)">
                </td>
                <td class="px-8 py-5">
                    <input list="list-publicadores" type="text"
                        class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-white/10 shadow-sm uppercase"
                        value="${row.companero || ''}"
                        placeholder="Socio..."
                        onchange="window.updatePublicRow(${index}, 'companero', this.value)">
                </td>
                <td class="px-8 py-5 text-right no-print opacity-20 group-hover:opacity-100 transition-opacity">
                    <button class="w-10 h-10 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                        onclick="window.deletePublicRow(${index})" title="Eliminar">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    };

    window.deletePublicRow = async (index) => {
        showCustomConfirm("¿Eliminar este turno de predicación del registro maestro?", async () => {
            data.asignaciones.splice(index, 1);
            await savePredicacionPublica(data);
            renderRows();
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
        } catch (e) {
            showNotification("Error de sincronización", "error");
        } finally {
            if (status) setTimeout(() => status.classList.replace('opacity-100', 'opacity-0'), 1000);
        }
    };

    container.querySelector('#add-row-btn').onclick = async () => {
        data.asignaciones = data.asignaciones || [];
        data.asignaciones.push({ dia: '', hora: '', hora_fin: '', lugar: '', publicador: '', companero: '' });
        await savePredicacionPublica(data);
        renderRows();
        tbody.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // PDF Export Logic
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

    const renderMatrix = () => {
        const matrixContainer = container.querySelector('#pdf-content');
        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const byDay = {};
        dias.forEach(d => byDay[d] = (data.asignaciones || []).filter(a => a.dia === d).sort((a, b) => (a.hora || '').localeCompare(b.hora || '')));

        container.querySelector('#matrix-bg').classList.add('opacity-100');
        const emptyState = container.querySelector('#empty-state');
        if (emptyState) emptyState.classList.add('hidden');

        matrixContainer.querySelector('.table-container').innerHTML = `
            <div class="p-8 lg:p-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6 min-h-[600px] relative z-10 transition-all duration-700">
                ${dias.map(dia => `
                    <div class="flex flex-col gap-6">
                        <div class="p-5 bg-slate-900 dark:bg-white/5 text-white lg:text-slate-200 text-center font-black rounded-3xl shadow-2xl text-[10px] uppercase tracking-[0.4em] border border-white/5">${dia}</div>
                        <div class="flex flex-col gap-5">
                            ${byDay[dia].length > 0 ? byDay[dia].map(row => {
            const originalIdx = (data.asignaciones || []).indexOf(row);
            const timeStr = `${formatTime(row.hora)} - ${formatTime(row.hora_fin)}`;
            return `
                                    <div class="p-6 bg-white dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 rounded-[2rem] shadow-lg group relative hover:border-primary/50 transition-all duration-500 hover:-translate-y-1">
                                        <div class="text-[10px] font-black text-primary mb-3.5 flex items-center gap-2">
                                            <i class="far fa-clock"></i>
                                            ${timeStr}
                                        </div>
                                        <div class="text-[14px] font-black text-slate-800 dark:text-white truncate mb-5 uppercase tracking-tighter leading-tight">${row.lugar || 'Ubicación General'}</div>
                                        <div class="space-y-3 border-t border-slate-50 dark:border-white/5 pt-5">
                                             <div class="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-3 uppercase">
                                                <div class="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] text-primary shrink-0"><i class="fas fa-user-tie"></i></div>
                                                <span class="truncate">${row.publicador || '—'}</span>
                                             </div>
                                             <div class="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-3 uppercase">
                                                <div class="w-7 h-7 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] text-slate-400 shrink-0"><i class="fas fa-id-card-clip"></i></div>
                                                <span class="truncate">${row.companero || '—'}</span>
                                             </div>
                                        </div>
                                        <button class="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-all bg-rose-500 text-white rounded-2xl w-10 h-10 flex items-center justify-center text-xs shadow-xl shadow-rose-500/20 hover:scale-110 active:scale-95 no-print" 
                                            onclick="window.deletePublicRow(${originalIdx})">
                                            <i class="fas fa-times"></i>
                                        </button>
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

    let currentView = 'table';

    if (window.innerWidth < 1100) {
        currentView = 'matrix';
        const btn = container.querySelector('#toggle-view-btn');
        if (btn) btn.innerHTML = '<i class="fas fa-list"></i> Lista';
        renderMatrix();
    } else {
        renderRows();
    }

    container.querySelector('#toggle-view-btn').onclick = (e) => {
        const btn = e.currentTarget;
        const emptyState = container.querySelector('#empty-state');
        if (currentView === 'table') {
            currentView = 'matrix';
            btn.innerHTML = '<i class="fas fa-list"></i> Lista';
            renderMatrix();
        } else {
            currentView = 'table';
            btn.innerHTML = '<i class="fas fa-th-large"></i> Matriz';
            container.querySelector('#matrix-bg').classList.remove('opacity-100');
            if (emptyState) emptyState.classList.remove('hidden');
            container.querySelector('#table-view-container').innerHTML = `
                <table class="w-full text-left border-collapse min-w-[1000px]">
                    <thead class="bg-slate-50/50 dark:bg-white/[0.02] text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] border-b border-slate-100 dark:border-white/5">
                        <tr>
                            <th class="px-8 py-6 w-48">Día</th>
                            <th class="px-8 py-6 text-center w-64">Horario Estipulado</th>
                            <th class="px-8 py-6">Punto de Predicación</th>
                            <th class="px-8 py-6 w-1/4">Publicador Principal</th>
                            <th class="px-8 py-6 w-1/4">Acompañante</th>
                            <th class="px-8 py-6 text-right no-print">Opciones</th>
                        </tr>
                    </thead>
                    <tbody id="public-table-body" class="divide-y divide-slate-100 dark:divide-white/5">
                    </tbody>
                </table>
            `;
            setTimeout(() => {
                const refreshedTbody = container.querySelector('#public-table-body');
                refreshedTbody.innerHTML = (data.asignaciones || []).map((row, index) => `
                    <tr class="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-all group">
                        <td class="px-8 py-5">
                            <select class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all cursor-pointer appearance-none shadow-sm uppercase tracking-tight"
                                onchange="window.updatePublicRow(${index}, 'dia', this.value)">
                                <option value="" disabled ${!row.dia ? 'selected' : ''}>— Seleccionar —</option>
                                ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d =>
                    `<option value="${d}" ${row.dia === d ? 'selected' : ''}>${d}</option>`
                ).join('')}
                            </select>
                        </td>
                        <td class="px-8 py-5">
                            <div class="flex items-center gap-3 justify-center bg-slate-50 dark:bg-white/5 p-2 rounded-2xl border border-slate-200/50 dark:border-white/10">
                                <input type="time" class="w-24 bg-transparent border-none p-2 text-xs font-black text-primary outline-none text-center"
                                    value="${row.hora || ''}"
                                    onchange="window.updatePublicRow(${index}, 'hora', this.value)">
                                <span class="text-slate-300 dark:text-white/10 font-bold">—</span>
                                <input type="time" class="w-24 bg-transparent border-none p-2 text-xs font-black text-primary outline-none text-center"
                                    value="${row.hora_fin || ''}"
                                    onchange="window.updatePublicRow(${index}, 'hora_fin', this.value)">
                            </div>
                        </td>
                        <td class="px-8 py-5">
                            <select class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all cursor-pointer appearance-none shadow-sm"
                                onchange="window.updatePublicRow(${index}, 'lugar', this.value)">
                                <option value="" disabled ${!row.lugar ? 'selected' : ''}>— Punto —</option>
                                ${(config.lugares || []).map(lugar =>
                    `<option value="${lugar}" ${row.lugar === lugar ? 'selected' : ''}>${lugar}</option>`
                ).join('')}
                            </select>
                        </td>
                        <td class="px-8 py-5">
                            <input list="list-publicadores" type="text"
                                class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-white/10 shadow-sm uppercase"
                                value="${row.publicador || ''}"
                                placeholder="Publicador..."
                                onchange="window.updatePublicRow(${index}, 'publicador', this.value)">
                        </td>
                        <td class="px-8 py-5">
                            <input list="list-publicadores" type="text"
                                class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 dark:text-white outline-none focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-white/10 shadow-sm uppercase"
                                value="${row.companero || ''}"
                                placeholder="Socio..."
                                onchange="window.updatePublicRow(${index}, 'companero', this.value)">
                        </td>
                        <td class="px-8 py-5 text-right no-print opacity-20 group-hover:opacity-100 transition-opacity">
                            <button class="w-10 h-10 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                                onclick="window.deletePublicRow(${index})" title="Eliminar">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }, 0);
        }
    };
};
