
import {
    getPublicadores, getConfiguracion, savePredicacionPublica, startLivePool
} from '../../data/firestore-services.js';
import { showNotification } from '../utils/helpers.js';
import { showCustomConfirm, showModal } from '../services/ui-helpers.js';
import { setAdminLivePool } from '../admin-dashboard.js';

export const renderPredicacionTab = async (container) => {
    let data = { asignaciones: [] };
    const [publicadores, config] = await Promise.all([
        getPublicadores(),
        getConfiguracion()
    ]);
    publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Xolvy Live Pool: Real-time synchronization
    const unsub = startLivePool("predicacion_publica", [], (allData) => {
        if (allData.length > 0) {
            data = allData[0];
            // Legacy migration check
            if (data.dias && !data.asignaciones) data.asignaciones = data.dias;
            console.log("🏙️ [Live Pool] Public Preaching Updated.");
            renderCurrentView();
        }
    });
    setAdminLivePool(unsub);

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
                            <input type="text" id="public-search" placeholder="Filtrar día o publicador..." value="${currentSearchQuery}" class="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl !pl-12 pr-4 py-4 text-xs font-black shadow-inner outline-none focus:border-primary transition-all uppercase">
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
             showNotification("Para exportar, ve abajo el botón generador o usa el Centro Operativo S-13.", "info", 5000);
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
                 showNotification("Para exportar, ve abajo el botón generador o usa el Centro Operativo S-13.", "info", 5000);
            };
        }
    };

    const renderTable = () => {
        const viewCont = container.querySelector('#view-container');
        if (!viewCont) return;

        const filtered = filterData();

        viewCont.innerHTML = `
            <div class="table-container p-4 lg:p-0">
                <table class="w-full text-left border-collapse block lg:table">
                    <thead class="hidden lg:table-header-group bg-slate-50/50 dark:bg-white/[0.02] text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] border-b border-slate-100 dark:border-white/5">
                        <tr>
                            <th class="px-6 py-8 w-[140px] rounded-tl-[2.5rem]">Día</th>
                            <th class="px-4 py-8 text-center w-[250px]">Horario Estipulado</th>
                            <th class="px-4 py-8 w-[220px]">Punto de Predicación</th>
                            <th class="px-4 py-8 text-center w-[200px]">Publicador Principal</th>
                            <th class="px-4 py-8 text-center w-[200px]">Acompañante</th>
                            <th class="px-6 py-8 text-right no-print w-[120px] rounded-tr-[2.5rem]">Opciones</th>
                        </tr>
                    </thead>
                    <tbody id="public-table-body" class="block lg:table-row-group space-y-4 lg:space-y-0 lg:divide-y divide-slate-100 dark:divide-white/5">
                        ${filtered.map((row) => {
            const originalIndex = data.asignaciones.indexOf(row);
            return `
                            <tr class="block lg:table-row bg-white dark:bg-white/[0.02] lg:bg-transparent lg:dark:bg-transparent border lg:border-none border-slate-100 dark:border-white/5 rounded-[2rem] lg:rounded-none p-5 lg:p-0 shadow-xl lg:shadow-none hover:bg-slate-50/50 lg:hover:bg-slate-50/50 dark:hover:bg-white/[0.03] transition-all group relative">
                                <td class="block lg:table-cell px-2 py-3 lg:px-6 lg:py-5 border-b lg:border-none border-slate-50 dark:border-white/5 last:border-none">
                                    <div class="flex flex-col lg:block gap-2">
                                        <span class="lg:hidden text-[9px] font-black uppercase tracking-widest text-slate-400">Día</span>
                                        <div class="relative w-full">
                                            <select class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-4 lg:px-3 py-3 lg:py-3.5 text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer uppercase tracking-tight appearance-none"
                                                onchange="window.updatePublicRow(${originalIndex}, 'dia', this.value)">
                                                <option value="" disabled ${!row.dia ? 'selected' : ''}>— Día —</option>
                                                ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d =>
                `<option value="${d}" ${row.dia === d ? 'selected' : ''}>${d}</option>`
            ).join('')}
                                            </select>
                                            <i class="fas fa-chevron-down absolute right-4 lg:right-3 top-1/2 -translate-y-1/2 text-[10px] lg:text-[9px] opacity-40 lg:opacity-30 pointer-events-none"></i>
                                        </div>
                                    </div>
                                </td>
                                <td class="block lg:table-cell px-2 py-3 lg:px-4 lg:py-5 border-b lg:border-none border-slate-50 dark:border-white/5 last:border-none">
                                    <div class="flex flex-col lg:block gap-2">
                                        <span class="lg:hidden text-[9px] font-black uppercase tracking-widest text-slate-400">Horario Estipulado</span>
                                        <div class="flex items-center gap-1 justify-center w-full lg:w-auto">
                                            <div class="relative group/time flex-1">
                                                <input type="time" class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-2 py-3 lg:py-3.5 text-[11px] font-black text-center text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer appearance-none"
                                                    value="${formatTimeDisplay(row.hora)}"
                                                    onchange="window.updatePublicRow(${originalIndex}, 'hora', this.value)">
                                            </div>
                                            <span class="text-slate-300 dark:text-white/10 font-bold px-1">—</span>
                                            <div class="relative group/time flex-1">
                                                <input type="time" class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-2 py-3 lg:py-3.5 text-[11px] font-black text-center text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer appearance-none"
                                                    value="${formatTimeDisplay(row.hora_fin)}"
                                                    onchange="window.updatePublicRow(${originalIndex}, 'hora_fin', this.value)">
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td class="block lg:table-cell px-2 py-3 lg:px-4 lg:py-5 border-b lg:border-none border-slate-50 dark:border-white/5 last:border-none">
                                    <div class="flex flex-col lg:block gap-2">
                                        <span class="lg:hidden text-[9px] font-black uppercase tracking-widest text-slate-400">Punto de Predicación</span>
                                        <div class="relative w-full">
                                            <select class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-4 py-3.5 text-[11px] font-black text-slate-700 dark:text-slate-200 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none uppercase"
                                                onchange="window.updatePublicRow(${originalIndex}, 'lugar', this.value)">
                                                <option value="" disabled ${!row.lugar ? 'selected' : ''}>— Seleccionar Punto —</option>
                                                ${(config.lugares || []).map(lugar =>
                `<option value="${lugar}" ${row.lugar === lugar ? 'selected' : ''}>${lugar}</option>`
            ).join('')}
                                            </select>
                                            <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] lg:text-[9px] opacity-40 lg:opacity-30 pointer-events-none"></i>
                                        </div>
                                    </div>
                                </td>
                                <td class="block lg:table-cell px-2 py-3 lg:px-4 lg:py-5 border-b lg:border-none border-slate-50 dark:border-white/5 last:border-none">
                                    <div class="flex flex-col lg:block gap-2">
                                        <span class="lg:hidden text-[9px] font-black uppercase tracking-widest text-slate-400">Publicador Principal</span>
                                        <div class="relative group/input flex justify-center w-full">
                                            <input list="list-publicadores" type="text"
                                                class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-4 py-3.5 text-[11px] font-black text-center text-slate-700 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400/70 dark:placeholder:text-white/20 uppercase"
                                                value="${row.publicador || ''}"
                                                placeholder="Nombre..."
                                                onchange="window.updatePublicRow(${originalIndex}, 'publicador', this.value)">
                                        </div>
                                    </div>
                                </td>
                                <td class="block lg:table-cell px-2 py-3 lg:px-4 lg:py-5 border-b lg:border-none border-slate-50 dark:border-white/5 last:border-none">
                                    <div class="flex flex-col lg:block gap-2">
                                        <span class="lg:hidden text-[9px] font-black uppercase tracking-widest text-slate-400">Acompañante</span>
                                        <div class="relative group/input flex justify-center w-full">
                                            <input list="list-publicadores" type="text"
                                                class="w-full bg-slate-50 lg:bg-slate-100/50 dark:bg-black/20 lg:dark:bg-white/5 border border-slate-200/50 lg:border-transparent rounded-2xl px-4 py-3.5 text-[11px] font-black text-center text-slate-700 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400/70 dark:placeholder:text-white/20 uppercase"
                                                value="${row.companero || ''}"
                                                placeholder="Nombre..."
                                                onchange="window.updatePublicRow(${originalIndex}, 'companero', this.value)">
                                        </div>
                                    </div>
                                </td>
                                <td class="block lg:table-cell px-2 py-3 lg:px-6 lg:py-5 no-print relative">
                                    <div class="flex items-center justify-end gap-2 lg:opacity-30 group-hover:opacity-100 transition-opacity">
                                        <button class="w-12 h-12 lg:w-10 lg:h-10 inline-flex items-center justify-center text-primary-light bg-primary/5 hover:bg-primary/20 lg:bg-transparent lg:hover:bg-primary/10 rounded-2xl lg:rounded-xl transition-all"
                                            onclick="window.editPublicRowModal(${originalIndex})" title="Editar Detalle">
                                            <i class="fas fa-edit text-sm lg:text-xs"></i>
                                        </button>
                                        <button class="w-12 h-12 lg:w-10 lg:h-10 inline-flex items-center justify-center text-rose-500 bg-rose-500/5 hover:bg-rose-500/20 lg:bg-transparent lg:hover:bg-rose-500/10 rounded-2xl lg:rounded-xl transition-all"
                                            onclick="window.deletePublicRow(${originalIndex})" title="Eliminar">
                                            <i class="fas fa-trash-alt text-sm lg:text-xs"></i>
                                        </button>
                                    </div>
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
        const formatTimeDisplay = (time) => {
            if (!time) return '—';
            let parts = time.split(':');
            let h = parts[0] || '00';
            let m = parts[1] || '00';
            return `${h.padStart(2, '0')}:${m.padEnd(2, '0')}`;
        };
        const filteredAsignaciones = filterData();

        const rowKeysMap = new Map();
        filteredAsignaciones.forEach(row => {
            const timeStr = `${formatTimeDisplay(row.hora)} - ${formatTimeDisplay(row.hora_fin)}`;
            const lugarStr = row.lugar || 'Ubicación General';
            const key = `${lugarStr}|${timeStr}`;
            if (!rowKeysMap.has(key)) rowKeysMap.set(key, { lugar: lugarStr, time: timeStr, hora: row.hora, hora_fin: row.hora_fin });
        });
        
        // Add predefined row slots from options or configuration if requested, but for now we follow data strictly plus standard slots if none
        if (rowKeysMap.size === 0) {
            viewCont.innerHTML = `<div class="text-center p-20 text-slate-500 font-bold uppercase tracking-widest text-xs flex flex-col items-center justify-center gap-4 border border-dashed border-white/10 rounded-2xl mx-8 min-h-[50vh]"><i class="fas fa-boxes text-4xl opacity-50 mb-4"></i> No hay turnos planificados. Agregue eventos desde la lista.</div>`;
            return;
        }

        let rowKeysList = Array.from(rowKeysMap.values());
        rowKeysList.sort((a, b) => {
            const tCmp = a.time.localeCompare(b.time);
            return tCmp !== 0 ? tCmp : a.lugar.localeCompare(b.lugar);
        });

        container.querySelector('#matrix-bg')?.classList.add('opacity-100');
        const emptyState = container.querySelector('#empty-state');
        if (emptyState) emptyState.classList.add('hidden');

        viewCont.innerHTML = `
            <div class="px-2 md:px-8 py-6 max-w-full">
                <div class="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-2xl border border-white/10 shadow-2xl custom-scrollbar-thin w-full bg-[#0d1522]">
                    <table class="w-full min-w-max border-collapse">
                        <thead class="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-white/10 shadow-lg">
                            <tr>
                                <th class="sticky left-0 z-40 bg-[linear-gradient(to_right,rgba(15,23,42,1)_95%,transparent)] md:bg-slate-900/90 backdrop-blur-md border-r border-b border-white/10 p-5 text-left min-w-[220px]">
                                    <span class="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]"><i class="fas fa-map-marker-alt"></i> Lugar y Horario</span>
                                </th>
                                ${dias.map(d => `<th class="p-5 text-center min-w-[200px] border-b border-white/10 bg-slate-900/90 backdrop-blur-md">
                                    <span class="text-[11px] font-black uppercase text-cyan-400 tracking-[0.2em] shadow-cyan-500/50 drop-shadow-md">${d}</span>
                                </th>`).join('')}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5 relative z-10">
                            ${rowKeysList.map(rk => {
                                return `
                                    <tr class="even:bg-white/[0.02] hover:bg-white/[0.04] transition-colors group/row">
                                        <td class="sticky left-0 z-20 bg-slate-900/95 group-hover/row:bg-slate-800/95 backdrop-blur-md border-r border-white/10 p-5 align-top transition-colors">
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[13px] font-black text-white uppercase tracking-tighter leading-tight drop-shadow-md">${rk.lugar}</span>
                                                <span class="text-[11px] text-cyan-500 font-black tracking-widest flex items-center gap-2 drop-shadow-sm"><i class="far fa-clock"></i> ${rk.time}</span>
                                            </div>
                                        </td>
                                        ${dias.map(d => {
                                            const foundMatches = filteredAsignaciones.filter(a => 
                                                a.dia === d && 
                                                (a.lugar || 'Ubicación General') === rk.lugar && 
                                                `${formatTimeDisplay(a.hora)} - ${formatTimeDisplay(a.hora_fin)}` === rk.time
                                            );
                                            
                                            if (foundMatches.length > 0) {
                                                return `
                                                    <td class="p-3 align-top border-x border-dashed border-white/5 relative group-hover/row:bg-white/[0.02]">
                                                        <div class="flex flex-col gap-2 w-full h-full justify-start items-center">
                                                            ${foundMatches.map(a => {
                                                                const originalIdx = data.asignaciones.indexOf(a);
                                                                return `
                                                                    <div class="relative group/chip w-full animate-fade-in shadow-xl hover:z-30">
                                                                        <div class="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 text-cyan-50 border border-cyan-500/30 w-full justify-center transition-all shadow-md group-hover/chip:shadow-cyan-500/20 group-hover/chip:border-cyan-400/60 uppercase tracking-wider relative overflow-hidden backdrop-blur-md">
                                                                            <div class="absolute inset-0 bg-white/5 opacity-0 group-hover/chip:opacity-100 transition-opacity"></div>
                                                                            <div class="flex flex-col w-full text-center relative z-10">
                                                                                <span class="block w-full truncate font-black tracking-tight" title="${a.publicador}">${a.publicador || '—'}</span>
                                                                                ${a.companero ? `<span class="text-[9px] text-cyan-200 uppercase truncate block w-full mt-1 font-bold opacity-80" title="Apoyo: ${a.companero}">+ ${a.companero}</span>` : ''}
                                                                            </div>
                                                                        </div>
                                                                        <div class="absolute -top-3 -right-2 flex gap-1 z-50 opacity-0 group-hover/chip:opacity-100 transition-all group-hover/chip:translate-y-1">
                                                                           <button onclick="window.editPublicRowModal(${originalIdx})" class="w-7 h-7 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-2xl transform active:scale-95 border border-white/10"><i class="fas fa-pen text-[10px]"></i></button>
                                                                           <button onclick="window.deletePublicRow(${originalIdx})" class="w-7 h-7 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl transform active:scale-95 border border-white/10"><i class="fas fa-trash text-[10px]"></i></button>
                                                                        </div>
                                                                    </div>
                                                                `;
                                                            }).join('')}
                                                        </div>
                                                    </td>
                                                `;
                                            } else {
                                                return `
                                                    <td class="p-2 align-middle border-x border-dashed border-white/5 h-full">
                                                        <div onclick="window.quickAddPublicRow('${d}', '${rk.lugar}', '${rk.hora}', '${rk.hora_fin}')" class="border border-dashed border-slate-600/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all duration-300 cursor-pointer rounded-xl m-1 min-h-[50px] h-full flex items-center justify-center group/add shadow-inner backdrop-blur-sm">
                                                            <i class="fas fa-plus text-slate-500/30 group-hover/add:text-cyan-400/80 group-hover/add:scale-[1.3] group-hover/add:rotate-90 transition-all duration-300 text-sm drop-shadow-xl"></i>
                                                        </div>
                                                    </td>
                                                `;
                                            }
                                        }).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <style>
            .custom-scrollbar-thin::-webkit-scrollbar { width: 5px; height: 5px; }
            .custom-scrollbar-thin::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
            .custom-scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.4); border-radius: 10px; }
            .custom-scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(6, 182, 212, 0.8); }
            </style>
        `;
    };

    window.quickAddPublicRow = async (dia, lugar, hora, hora_fin) => {
        data.asignaciones = data.asignaciones || [];
        data.asignaciones.push({ dia, hora: hora || '', hora_fin: hora_fin || '', lugar: lugar || '', publicador: '', companero: '' });
        await savePredicacionPublica(data);
        renderCurrentView();
        
        // Open edit modal directly for the newly created slot!
        const newIdx = data.asignaciones.length - 1;
        setTimeout(() => window.editPublicRowModal(newIdx), 100);
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

    // S-13 Export Logic (Moved inside to have access to container)
    const exportBtn = container.querySelector('#export-pdf');
    if (exportBtn) {
        exportBtn.onclick = async () => {
            const { renderS13CommandCenter } = await import('../report-s13.js');
            const modal = document.getElementById('modal-container');
            modal.classList.remove('hidden');
            modal.innerHTML = `
                <div class="w-full h-full flex items-center justify-center p-4">
                    <div class="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                        <header class="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                            <div class="flex items-center gap-4">
                                 <div class="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center text-2xl">
                                    <i class="fas fa-file-invoice"></i>
                                 </div>
                                 <div>
                                     <h3 class="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Centro de Exportación S-13</h3>
                                     <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Generación de Reportes Oficiales</p>
                                 </div>
                            </div>
                            <button onclick="document.getElementById('modal-container').classList.add('hidden')" class="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 transition-all">
                                <i class="fas fa-times"></i>
                            </button>
                        </header>
                        <div id="s13-modal-content" class="flex-1 overflow-y-auto p-10 custom-scrollbar"></div>
                    </div>
                </div>
            `;
            await renderS13CommandCenter(document.getElementById('s13-modal-content'));
        };
    }
};

