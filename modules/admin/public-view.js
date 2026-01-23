import {
    getPredicacionPublica, getPublicadores, getConfiguracion, savePredicacionPublica
} from '../../data/firestore-services.js?v=2.2.5';
import { showNotification } from '../utils/helpers.js?v=2.2.5';
import { showCustomConfirm } from '../services/ui-helpers.js?v=2.2.5';
import html2canvas from 'html2canvas';

export const renderPredicacionTab = async (container) => {
    const data = await getPredicacionPublica();
    const publicadores = await getPublicadores();
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const config = await getConfiguracion();

    container.innerHTML = `
        <div class="space-y-8 animate-fade-in">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h3 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3 uppercase tracking-tighter">
                        <i class="fas fa-street-view text-primary"></i> Predicación Pública
                    </h3>
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1 ml-1">Gestión centralizada de turnos y puestos</p>
                </div>
                <div class="flex items-center gap-4 w-full md:w-auto">
                    <div id="public-save-status" class="hidden sm:flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-0 transition-opacity">
                        <span class="w-2 h-2 bg-primary rounded-full animate-pulse"></span> Sincronizando...
                    </div>
                    <div class="flex flex-wrap gap-2 w-full md:w-auto">
                        <button id="toggle-view-btn" class="flex-1 md:flex-none bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3">
                            <i class="fas fa-th-large"></i> Vista Matriz
                        </button>
                        <button id="add-row-btn" class="flex-1 md:flex-none bg-primary hover:bg-primary-light text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3">
                            <i class="fas fa-plus-circle"></i> Nuevo Turno
                        </button>
                        <button id="export-pdf" class="flex-1 md:flex-none bg-white dark:bg-white/5 text-slate-400 hover:text-primary px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-white/10 transition-all flex items-center justify-center gap-3">
                            <i class="fas fa-file-pdf"></i> PDF
                        </button>
                    </div>
                </div>
            </header>

            <div class="modern-card !p-0 overflow-hidden border border-slate-100 dark:border-white/5 min-h-[400px] shadow-2xl relative" id="pdf-content">
                 <!-- Gradient background for matrix view -->
                <div id="matrix-bg" class="absolute inset-0 bg-slate-50 dark:bg-[#0f141a] opacity-0 transition-opacity pointer-events-none"></div>
                
                <div class="table-container custom-scrollbar overflow-x-auto relative z-10">
                    <table class="w-full text-left border-collapse min-w-[900px]">
                        <thead class="bg-slate-50/80 dark:bg-black/40 backdrop-blur-md text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] sticky top-0 z-20 border-b border-slate-100 dark:border-white/5">
                            <tr>
                                <th class="p-5 w-40">Día de Servicio</th>
                                <th class="p-5 w-52 text-center">Rango Horario</th>
                                <th class="p-5">Punto / Lugar</th>
                                <th class="p-5 w-1/4">Publicador 1</th>
                                <th class="p-5 w-1/4">Publicador 2</th>
                                <th class="p-5 text-right no-print">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="public-table-body" class="divide-y divide-slate-100 dark:divide-white/5">
                            <!-- Rows generated here -->
                        </tbody>
                    </table>
                </div>
                ${!data.asignaciones || data.asignaciones.length === 0 ? `
                <div class="flex flex-col items-center justify-center py-32 text-slate-300 dark:text-white/10 relative z-10">
                    <div class="w-20 h-20 mb-6 bg-slate-50 dark:bg-white/5 rounded-[2rem] flex items-center justify-center text-3xl shadow-inner">
                        <i class="fas fa-calendar-plus opacity-20"></i>
                    </div>
                    <p class="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Sin turnos configurados</p>
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
            <tr class="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                <td class="p-4">
                    <select class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all cursor-pointer appearance-none shadow-sm"
                        onchange="window.updatePublicRow(${index}, 'dia', this.value)">
                        <option value="" disabled ${!row.dia ? 'selected' : ''}>Día...</option>
                        ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d =>
            `<option value="${d}" ${row.dia === d ? 'selected' : ''}>${d}</option>`
        ).join('')}
                    </select>
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-2 justify-center">
                        <input type="time" class="w-24 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-3 text-xs font-black text-primary outline-none focus:border-primary transition-all text-center shadow-sm"
                            value="${row.hora || ''}"
                            onchange="window.updatePublicRow(${index}, 'hora', this.value)">
                        <span class="text-slate-300 dark:text-white/10 font-bold">-</span>
                        <input type="time" class="w-24 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-3 text-xs font-black text-primary outline-none focus:border-primary transition-all text-center shadow-sm"
                            value="${row.hora_fin || ''}"
                            onchange="window.updatePublicRow(${index}, 'hora_fin', this.value)">
                    </div>
                </td>
                <td class="p-4">
                    <select class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all cursor-pointer appearance-none shadow-sm"
                        onchange="window.updatePublicRow(${index}, 'lugar', this.value)">
                        <option value="" disabled ${!row.lugar ? 'selected' : ''}>Puesto...</option>
                        ${(config.lugares || []).map(lugar =>
            `<option value="${lugar}" ${row.lugar === lugar ? 'selected' : ''}>${lugar}</option>`
        ).join('')}
                    </select>
                </td>
                <td class="p-4">
                    <input list="list-publicadores" type="text"
                        class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-white/10 shadow-sm"
                        value="${row.publicador || ''}"
                        placeholder="Quien inicia..."
                        onchange="window.updatePublicRow(${index}, 'publicador', this.value)">
                </td>
                <td class="p-4">
                    <input list="list-publicadores" type="text"
                        class="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-white/10 shadow-sm"
                        value="${row.companero || ''}"
                        placeholder="Acompañante..."
                        onchange="window.updatePublicRow(${index}, 'companero', this.value)">
                </td>
                <td class="p-4 text-right no-print opacity-20 group-hover:opacity-100 transition-opacity">
                    <button class="w-10 h-10 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        onclick="window.deletePublicRow(${index})" title="Eliminar Turno">
                        <i class="fas fa-trash-alt text-[11px]"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    };

    window.deletePublicRow = async (index) => {
        showCustomConfirm("¿Eliminar este turno de predicación?", async () => {
            data.asignaciones.splice(index, 1);
            await savePredicacionPublica(data);
            renderRows();
            showNotification("Turno eliminado");
        });
    };

    window.updatePublicRow = async (index, field, value) => {
        const status = container.querySelector('#public-save-status');
        if (status) status.classList.replace('opacity-0', 'opacity-100');

        data.asignaciones[index][field] = value;
        try {
            await savePredicacionPublica(data);
        } catch (e) {
            showNotification("Error al sincronizar", "error");
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
        showNotification("Generando reporte...", "info");

        html2canvas(target, {
            scale: 2,
            backgroundColor: (document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff'),
            ignoreElements: (el) => el.classList.contains('no-print')
        }).then(canvas => {
            const doc = new jsPDF('l', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            doc.save(`Predicacion_Publica_${new Date().toISOString().split('T')[0]}.pdf`);
            showNotification("Exportación completa", "success");
        });
    };

    const renderMatrix = () => {
        const matrixContainer = container.querySelector('#pdf-content');
        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const byDay = {};
        dias.forEach(d => byDay[d] = (data.asignaciones || []).filter(a => a.dia === d).sort((a, b) => (a.hora || '').localeCompare(b.hora || '')));

        container.querySelector('#matrix-bg').classList.add('opacity-100');

        matrixContainer.querySelector('.table-container').innerHTML = `
            <div class="p-8 grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 gap-6 min-h-[600px] relative z-10">
                ${dias.map(dia => `
                    <div class="flex flex-col gap-5 min-w-[200px] sm:min-w-0">
                        <div class="p-4 bg-slate-900 dark:bg-black/50 text-white text-center font-black rounded-2xl shadow-xl text-[10px] uppercase tracking-[0.3em] border border-white/10">${dia}</div>
                        <div class="flex flex-col gap-4">
                            ${byDay[dia].length > 0 ? byDay[dia].map(row => {
            const originalIdx = (data.asignaciones || []).indexOf(row);
            return `
                                    <div class="p-5 bg-white dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 rounded-3xl shadow-lg group relative hover:border-primary/50 transition-all duration-500">
                                        <div class="text-[10px] font-black text-primary mb-3 flex items-center gap-2">
                                            <i class="far fa-clock"></i>
                                            ${(row.hora || '??:??').length === 4 ? row.hora.split(':')[0].padStart(2, '0') + ':' + row.hora.split(':')[1].padStart(2, '0') : (row.hora || '??:??')} - ${(row.hora_fin || '??:??').length === 4 ? row.hora_fin.split(':')[0].padStart(2, '0') + ':' + row.hora_fin.split(':')[1].padStart(2, '0') : (row.hora_fin || '??:??')}
                                        </div>
                                        <div class="text-[13px] font-black text-slate-800 dark:text-white truncate mb-4 uppercase tracking-tighter leading-tight">${row.lugar || 'Llamado especial'}</div>
                                        <div class="space-y-2 border-t border-slate-50 dark:border-white/5 pt-4">
                                             <div class="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-3 font-bold">
                                                <div class="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-[8px] text-primary"><i class="fas fa-user"></i></div>
                                                <span class="truncate">${row.publicador || '-'}</span>
                                             </div>
                                             <div class="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-3">
                                                <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[8px] text-slate-400"><i class="fas fa-user-plus"></i></div>
                                                <span class="truncate">${row.companero || '-'}</span>
                                             </div>
                                        </div>
                                        <button class="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-all bg-red-600 text-white rounded-2xl w-10 h-10 flex items-center justify-center text-xs shadow-xl shadow-red-600/20 hover:scale-110 active:scale-90 no-print" 
                                            onclick="window.deletePublicRow(${originalIdx})">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                `;
        }).join('') : `
                                <div class="text-[10px] text-slate-400 text-center py-16 italic border-4 border-dashed border-slate-100 dark:border-white/5 rounded-[2.5rem] flex flex-col items-center gap-4 group hover:border-primary/20 transition-colors">
                                    <div class="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-xl opacity-20 group-hover:opacity-40 transition-opacity">
                                        <i class="fas fa-mug-hot"></i>
                                    </div>
                                    <span class="font-black uppercase tracking-widest opacity-30">Libre</span>
                                </div>`}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    let currentView = 'table';
    const originalTableContent = container.querySelector('.table-container').innerHTML;

    if (window.innerWidth < 1024) {
        currentView = 'matrix';
        const btn = container.querySelector('#toggle-view-btn');
        if (btn) btn.innerHTML = '<i class="fas fa-list"></i> Vista Lista';
        renderMatrix();
    }

    container.querySelector('#toggle-view-btn').onclick = (e) => {
        const btn = e.currentTarget;
        if (currentView === 'table') {
            currentView = 'matrix';
            btn.innerHTML = '<i class="fas fa-list"></i> Vista Lista';
            renderMatrix();
        } else {
            currentView = 'table';
            btn.innerHTML = '<i class="fas fa-th-large"></i> Vista Matriz';
            container.querySelector('#matrix-bg').classList.remove('opacity-100');
            container.querySelector('.table-container').innerHTML = originalTableContent;
            tbody.innerHTML = ''; // Force refresh
            renderRows();
        }
    };
};
