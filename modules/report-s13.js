import { getHistorialReport, rebuildHistoryFromSchedule, getConfiguracion, getTerritorios, runSystemDiagnosticsAndRepair } from '../data/firestore-services.js?v=2.4.0.6';
import { showNotification, generatePlainXLS } from './utils/helpers.js?v=2.4.0.6';
import { S13Exporter } from './services/s13-exporter.js?v=2.4.0.6';

export const renderS13CommandCenter = async (container) => {
    const [history, config, territories] = await Promise.all([
        getHistorialReport(),
        getConfiguracion(),
        getTerritorios()
    ]);

    container.innerHTML = `
        <div class="space-y-8 animate-fade-in">
            <!--Unified Control Bar-->
            <div class="modern-card !p-6 flex flex-col lg:flex-row items-center gap-6 border-slate-200 dark:border-white/5 shadow-2xl bg-white dark:bg-white/[0.02]">
                <!-- Left: Date Filters -->
                <div class="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Año</label>
                        <select id="report-year-select" class="bg-white dark:bg-slate-800 border-none rounded-xl px-4 p-2 text-xs font-bold outline-none text-slate-700 dark:text-white shadow-sm cursor-pointer">
                             <!-- Year options -->
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Desde</label>
                        <input type="date" id="report-start" class="bg-white dark:bg-slate-800 border-none rounded-xl px-4 p-2 text-xs font-bold outline-none text-slate-700 dark:text-white shadow-sm">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Hasta</label>
                        <input type="date" id="report-end" class="bg-white dark:bg-slate-800 border-none rounded-xl px-4 p-2 text-xs font-bold outline-none text-slate-700 dark:text-white shadow-sm">
                    </div>
                </div>

                <!-- Center: Universal Search -->
                <div class="relative flex-1 group min-w-[200px] w-full lg:w-auto">
                    <span class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">
                        <i class="fas fa-search"></i>
                    </span>
                    <input type="text" id="cc-universal-search" placeholder="Búsqueda global (Conductor, Territorio...)" class="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl pl-14 pr-6 py-4 text-xs font-bold shadow-sm outline-none focus:border-primary transition-all text-slate-700 dark:text-white placeholder:text-slate-400">
                </div>

                <!-- Right: Actions -->
                <div class="flex items-center gap-3">
                    <button id="cc-btn-power-sync" class="bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-3 whitespace-nowrap">
                        <i class="fas fa-bolt"></i> POWER SYNC GLOBAL
                    </button>
                    <button id="cc-btn-tools" class="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-primary rounded-xl border border-slate-200 dark:border-white/10 transition-all" title="Herramientas de Reconstrucción">
                        <i class="fas fa-wrench text-sm"></i>
                    </button>
                </div>
            </div>

            <!-- Stats Bar (As requested in image) -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="modern-card !p-5 bg-gradient-to-br from-primary to-indigo-600 text-white border-none shadow-xl relative overflow-hidden group">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
                    <p class="text-[9px] font-black uppercase tracking-[0.2em] opacity-70 mb-2">Cobertura Global</p>
                    <div class="flex items-baseline gap-2">
                        <span id="cc-stat-coverage" class="text-4xl font-black tracking-tighter">0%</span>
                    </div>
                    <p id="cc-stat-coverage-sub" class="text-[8px] font-bold uppercase tracking-widest mt-2 opacity-60">Calculando...</p>
                </div>

                <div class="modern-card !p-5 bg-white dark:bg-white/[0.02] border-slate-100 dark:border-white/5 shadow-lg group">
                    <p class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Faltantes</p>
                    <div class="flex items-center gap-4">
                        <span id="cc-stat-missing" class="text-4xl font-black text-rose-500 tracking-tighter">0</span>
                        <div class="h-1.5 flex-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                             <div id="cc-stat-missing-bar" class="h-full bg-rose-500 transition-all duration-1000" style="width: 0%"></div>
                        </div>
                    </div>
                    <p class="text-[8px] font-bold uppercase tracking-widest mt-2 text-rose-400">En espera</p>
                </div>

                <div class="modern-card !p-5 bg-white dark:bg-white/[0.02] border-slate-100 dark:border-white/5 shadow-lg">
                    <p class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Uso Frecuente</p>
                    <h4 id="cc-stat-frequent" class="text-2xl font-black text-slate-800 dark:text-white uppercase truncate">---</h4>
                    <p id="cc-stat-frequent-sub" class="text-[8px] font-bold uppercase tracking-widest mt-2 text-primary">0 Veces</p>
                </div>

                <div class="modern-card !p-5 bg-white dark:bg-white/[0.02] border-slate-100 dark:border-white/5 shadow-lg">
                    <p class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Mayor Rezago</p>
                    <h4 id="cc-stat-oldest" class="text-2xl font-black text-orange-500 uppercase truncate">---</h4>
                    <p id="cc-stat-oldest-sub" class="text-[8px] font-bold uppercase tracking-widest mt-2 text-slate-400">Hace 0 días</p>
                </div>
            </div>

            <!-- Tab Container (Only one tab now: Reporte S-13) -->
            <div class="flex items-center gap-2">
                 <div class="px-6 py-3 bg-white dark:bg-white/10 rounded-t-2xl border-t border-l border-r border-slate-200 dark:border-white/10 flex items-center gap-3">
                     <i class="fas fa-file-invoice text-primary text-xs"></i>
                     <span class="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Reporte S-13</span>
                 </div>
            </div>

            <!--Main Report Container-->
            <div id="cc-main-container" class="min-h-[600px] modern-card !p-0 overflow-hidden border-slate-100 dark:border-white/5 -mt-[1px]">
                <!-- S13 Content -->
            </div>
        </div>
    `;

    // Calculate Stats
    const updateStats = () => {
        const total = territories.length;
        const touchedNums = new Set(history.map(h => String(h.numero)));
        const coverage = total > 0 ? Math.round((touchedNums.size / total) * 100) : 0;
        const missing = territories.filter(t => !touchedNums.has(String(t.numero))).length;

        container.querySelector('#cc-stat-coverage').innerText = `${coverage}%`;
        container.querySelector('#cc-stat-coverage-sub').innerText = `${touchedNums.size} de ${total} abarcados`;
        container.querySelector('#cc-stat-missing').innerText = missing;
        container.querySelector('#cc-stat-missing-bar').style.width = `${(missing / total) * 100}%`;

        const territoryFreq = {};
        history.forEach(h => {
            const nums = String(h.numero).split(/[,/]/).map(n => n.trim());
            nums.forEach(n => { if (n) territoryFreq[n] = (territoryFreq[n] || 0) + 1; });
        });
        const sortedFreq = Object.entries(territoryFreq).sort((a, b) => b[1] - a[1]);
        if (sortedFreq[0]) {
            container.querySelector('#cc-stat-frequent').innerText = `Territorio ${sortedFreq[0][0]}`;
            container.querySelector('#cc-stat-frequent-sub').innerText = `Asignado ${sortedFreq[0][1]} veces`;
        }

        const latestTouch = {};
        history.forEach(h => {
            const d = h.fecha_entrega || h.fecha_asignacion;
            if (!d) return;
            const nums = String(h.numero).split(/[,/]/).map(n => n.trim());
            nums.forEach(n => {
                if (!latestTouch[n] || new Date(d) > new Date(latestTouch[n])) latestTouch[n] = d;
            });
        });
        const rezagoSorted = territories.filter(t => latestTouch[t.numero]).sort((a, b) => new Date(latestTouch[a.numero]) - new Date(latestTouch[b.numero]));
        if (rezagoSorted[0]) {
            const days = Math.floor((new Date() - new Date(latestTouch[rezagoSorted[0].numero])) / (1000 * 60 * 60 * 24));
            container.querySelector('#cc-stat-oldest').innerText = `#${rezagoSorted[0].numero}`;
            container.querySelector('#cc-stat-oldest-sub').innerText = `Hace ${days} días`;
        }
    };
    updateStats();

    // Initialize Year Selector
    const yearSelect = container.querySelector('#report-year-select');
    const startInput = container.querySelector('#report-start');
    const endInput = container.querySelector('#report-end');

    const now = new Date();
    const serviceYear = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
    for (let y = serviceYear - 5; y <= serviceYear + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === serviceYear) opt.selected = true;
        opt.className = "dark:bg-slate-800 text-slate-800 dark:text-white";
        yearSelect.appendChild(opt);
    }

    const setDatesFromSY = (sy) => {
        const y = parseInt(sy);
        const start = `${y - 1}-09-01`;
        const end = `${y}-08-31`;
        if (startInput) startInput.value = start;
        if (endInput) endInput.value = end;
    };
    setDatesFromSY(serviceYear);
    if (yearSelect) yearSelect.onchange = (e) => setDatesFromSY(e.target.value);

    // Default to S13 Report
    const mainCont = container.querySelector('#cc-main-container');
    await renderHistoryTab(mainCont, {
        showHeader: false,
        startInput: startInput,
        endInput: endInput
    });

    // Actions
    container.querySelector('#cc-btn-power-sync').onclick = async () => {
        try {
            showNotification("Iniciando Power Sync Global...", "info");
            await runSystemDiagnosticsAndRepair((msg, pc) => {
                console.log(`[PowerSync] ${msg} (${pc}%)`);
            });
            showNotification("Sincronización Maestra Exitosa", "success");
            // Auto-generate report after sync
            container.querySelector('#btn-generate-report-hidden')?.click();
        } catch (e) {
            showNotification("Error en Power Sync: " + e.message, "error");
        }
    };

    container.querySelector('#cc-btn-tools').onclick = () => {
        const rebuildBtn = mainCont.querySelector('#btn-rebuild-history');
        if (rebuildBtn) rebuildBtn.click();
    };

    const searchInp = container.querySelector('#cc-universal-search');
    if (searchInp) {
        searchInp.oninput = (e) => {
            const q = e.target.value.toLowerCase().trim();
            // Implement simple filter for the visible list if it exists
            const listItems = mainCont.querySelectorAll('.s13-row');
            // Note: S13 report rows are usually generated in renderReport. 
            // This search will actually be handled by the generate button usually, 
            // but we can add real-time filtering if the report is already visible.
        };
    }

    // Generate Trigger
    const internalBtn = mainCont.querySelector('#btn-generate-report-hidden');
    if (internalBtn) setTimeout(() => internalBtn.click(), 500); // Auto-load
};


export const renderHistoryTab = (container, options = {}) => {
    const showHeader = options.showHeader !== false;

    container.innerHTML = `
        <div class="h-full flex flex-col gap-6 animate-fade-in relative">
            ${showHeader ? `
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-slate-100 dark:border-white/5 pb-8">
                <div class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-3xl text-primary shadow-inner border border-primary/10 animate-float">
                        <i class="fas fa-file-invoice"></i>
                    </div>
                    <div>
                        <h2 class="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                            Gestión y Reportes
                        </h2>
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1 opacity-70">
                            Registro Oficial de Asignaciones
                        </p>
                    </div>
                </div>
                <div class="flex flex-wrap items-end gap-3 bg-slate-50 dark:bg-white/[0.02] p-5 rounded-3xl border border-slate-100 dark:border-white/5 shadow-inner">
                    <div class="space-y-2">
                         <label class="block text-[10px] uppercase text-slate-400 font-black tracking-widest ml-1">Año Servicio</label>
                         <select id="report-year-select" class="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:border-primary outline-none font-black uppercase tracking-widest cursor-pointer shadow-sm">
                         </select>
                    </div>
                    <div class="space-y-2">
                        <label class="block text-[10px] uppercase text-slate-400 font-black tracking-widest ml-1">Desde</label>
                        <input type="date" id="report-start" class="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:border-primary outline-none font-black shadow-sm uppercase">
                    </div>
                     <div class="space-y-2">
                        <label class="block text-[10px] uppercase text-slate-400 font-black tracking-widest ml-1">Hasta</label>
                        <input type="date" id="report-end" class="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:border-primary outline-none font-black shadow-sm uppercase">
                    </div>
                    <button id="btn-generate-report" class="bg-primary hover:bg-primary-light text-white px-8 py-3 rounded-xl shadow-xl shadow-primary/20 text-[10px] font-black uppercase tracking-widest transition-all h-fit self-end active:scale-95 flex items-center gap-2">
                        <i class="fas fa-magic"></i> Generar
                    </button>
                    <button id="btn-export-s13-pdf" class="hidden bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl shadow-xl shadow-rose-500/20 text-[10px] font-black uppercase tracking-widest transition-all h-fit self-end flex items-center gap-3 active:scale-95">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                    <button id="btn-export-s13-excel" class="hidden bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-xl shadow-emerald-500/20 text-[10px] font-black uppercase tracking-widest transition-all h-fit self-end flex items-center gap-3 active:scale-95">
                        <i class="fas fa-file-excel"></i> EXCEL
                    </button>
                    <!-- Tools -->
                    <button id="btn-rebuild-history" class="w-12 h-12 bg-slate-200/50 dark:bg-white/5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all h-fit self-end flex items-center justify-center border border-transparent hover:border-primary/20" title="Recuperar historial desde Programa Semanal">
                        <i class="fas fa-wrench"></i>
                    </button>
                </div>
            </header>
            ` : ''}

            <div id="report-preview" class="flex-1 overflow-auto bg-slate-50 dark:bg-black/20 rounded-[2.5rem] border border-slate-100 dark:border-white/5 p-4 sm:p-12 flex flex-col items-center gap-10 relative min-h-[600px] shadow-inner">
                 <div class="text-center mt-20 space-y-6 opacity-30 group">
                    <div class="w-24 h-24 bg-slate-200 dark:bg-white/5 rounded-[2rem] flex items-center justify-center text-4xl mx-auto group-hover:scale-110 transition-transform">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <p class="text-xs font-black uppercase tracking-[0.4em] max-w-xs leading-relaxed">Selecciona un rango de fechas para generar el reporte oficial</p>
                 </div>
            </div>

            <button id="btn-generate-report-hidden" class="hidden"></button>
            
             <!-- Loading Overlay -->
            <div id="report-loading" class="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center hidden rounded-xl">
                <div class="flex flex-col items-center gap-3">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                    <span class="text-blue-300 font-medium animate-pulse">Procesando datos...</span>
                </div>
            </div>
        </div>
    `;

    // Initialize Dates (Current Month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Initialize Service Year Selector and Dates
    const yearSelect = showHeader ? container.querySelector('#report-year-select') : null;
    const startInput = showHeader ? container.querySelector('#report-start') : (options.startInput || null);
    const endInput = showHeader ? container.querySelector('#report-end') : (options.endInput || null);

    // Calculate current Service Year
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const serviceYear = currentMonth >= 8 ? currentYear + 1 : currentYear;

    if (yearSelect) {
        for (let y = serviceYear - 5; y <= serviceYear + 5; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === serviceYear) opt.selected = true;
            opt.className = "bg-white text-gray-900 dark:bg-black dark:text-white";
            yearSelect.appendChild(opt);
        }
    }

    const setDatesFromServiceYear = (sy) => {
        if (!startInput || !endInput) return;
        const y = parseInt(sy);
        const start = new Date(y - 1, 8, 1);
        const end = new Date(y, 7, 31);

        const fmt = (d) => {
            const yy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd}`;
        };
        startInput.value = fmt(start);
        endInput.value = fmt(end);
    };

    if (showHeader) setDatesFromServiceYear(serviceYear);

    if (yearSelect) {
        yearSelect.addEventListener('change', (e) => {
            setDatesFromServiceYear(e.target.value);
        });
    }

    const handleGenerate = async () => {
        const start = startInput ? startInput.value : null;
        const end = endInput ? endInput.value : null;

        if (!start || !end) {
            showNotification("Selecciona un rango de fechas válido.", "warning");
            return;
        }

        const loader = container.querySelector('#report-loading');
        if (loader) loader.classList.remove('hidden');

        try {
            const [allHistory, allTerritorios] = await Promise.all([
                getHistorialReport(),
                getTerritorios()
            ]);

            const startMs = new Date(start).getTime();
            const endObj = new Date(end);
            endObj.setHours(23, 59, 59, 999);
            const endMs = endObj.getTime();

            const historyInRange = allHistory.filter(item => {
                const fAsig = new Date(item.fecha_asignacion).getTime();
                const fEntr = item.fecha_entrega ? new Date(item.fecha_entrega).getTime() : null;
                return (fAsig >= startMs && fAsig <= endMs) || (fEntr && fEntr >= startMs && fEntr <= endMs);
            });

            const config = await getConfiguracion();
            const congregationName = config?.congregacion?.nombre || 'Mi Congregación';
            const yearLabel = (yearSelect && yearSelect.value) || serviceYear;

            renderReport(container, historyInRange, allHistory, allTerritorios, start, end, yearLabel, congregationName);

            if (showHeader) {
                container.querySelector('#btn-export-s13-pdf')?.classList.remove('hidden');
                container.querySelector('#btn-export-s13-excel')?.classList.remove('hidden');
            }

            window._currentS13Data = historyInRange;
        } catch (e) {
            console.error(e);
            showNotification("Error generando reporte: " + e.message, "error");
        } finally {
            if (loader) loader.classList.add('hidden');
        }
    };

    if (showHeader && container.querySelector('#btn-generate-report')) {
        container.querySelector('#btn-generate-report').addEventListener('click', handleGenerate);
    }
    container.querySelector('#btn-generate-report-hidden')?.addEventListener('click', handleGenerate);

    const pdfBtn = document.getElementById('btn-export-s13-pdf');
    if (pdfBtn) {
        pdfBtn.onclick = async () => {
            const pages = document.querySelectorAll('.s13-page');
            if (pages.length === 0) return;

            const btn = pdfBtn;
            const isOffline = !navigator.onLine;

            if (isOffline) {
                showNotification("📡 Generando PDF en modo offline. Los estilos tipográficos podrían variar.", "warning");
            }

            const oldText = btn.innerHTML;
            btn.innerHTML = '⏳ Generando PDF...';
            btn.disabled = true;

            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');

                const pdfWidth = 210;
                const pdfHeight = 297;

                for (let i = 0; i < pages.length; i++) {
                    if (i > 0) doc.addPage();
                    const canvas = await html2canvas(pages[i], {
                        scale: 2.5,
                        backgroundColor: '#ffffff',
                        logging: false,
                        useCORS: true,
                        allowTaint: true
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.98);
                    const imgProps = doc.getImageProperties(imgData);
                    const printHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(printHeight, pdfHeight));
                }

                const config = await getConfiguracion();
                const congName = config?.congregacion?.nombre || 'Mi_Congregacion';
                const fileName = `S13_Reporte_${congName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
                doc.save(fileName);
                showNotification("✅ PDF generado correctamente.", "success");
            } catch (e) {
                console.error(e);
                showNotification("Error exportando PDF: " + e.message, "error");
            } finally {
                btn.innerHTML = oldText;
                btn.disabled = false;
            }
        };
    }

    const excelBtn = document.getElementById('btn-export-s13-excel');
    if (excelBtn) {
        excelBtn.onclick = () => {
            const data = window._currentS13Data;
            if (!data || data.length === 0) return;

            const flatList = [];
            data.forEach(item => {
                const nums = item.numero.toString().split(',').map(n => n.trim());
                nums.forEach(num => {
                    flatList.push({
                        'Territorio': num,
                        'Conductor': item.conductor || '-',
                        'Fecha Asignación': formatDateShort(item.fecha_asignacion),
                        'Fecha en que se completó': formatDateShort(item.fecha_entrega),
                        'Estado': item.estado || '-',
                        'Observaciones': item.observaciones || '-'
                    });
                });
            });

            flatList.sort((a, b) => a.Territorio.localeCompare(b.Territorio, undefined, { numeric: true }));
            generatePlainXLS(flatList, `Listado_Asignaciones_S13_${document.getElementById('report-start').value}`);
            showNotification("Excel generado con éxito", "success");
        };
    }

    // Rebuild Listener
    const rebuildBtn = document.getElementById('btn-rebuild-history');
    if (rebuildBtn) {
        rebuildBtn.onclick = async () => {
            const runRebuild = async () => {
                const loader = document.getElementById('report-loading');
                if (loader) loader.classList.remove('hidden');
                try {
                    const count = await rebuildHistoryFromSchedule();
                    showNotification(`Historial reconstruido. Se recuperaron ${count} asignaciones.`, "success");
                } catch (e) {
                    console.error(e);
                    showNotification("Error en reconstrucción: " + e.message, "error");
                } finally {
                    if (loader) loader.classList.add('hidden');
                }
            };
            window.showCustomConfirm("¿Deseas analizar todos los Programas Semanales antiguos para reconstruir el historial de asignaciones?", runRebuild);
        };
    }
};

// --- LOGIC ENGINE ---

const renderReport = (parent, dataInRange, allHistory, allTerritorios, startDate, endDate, yearLabel, congregationName) => {
    const container = parent.querySelector('#report-preview');
    if (!container) return;
    container.innerHTML = '';

    // 1. Map all territories
    const territoriesMap = new Map();

    // Sort all territories numerically by number
    const sortedTerrs = [...allTerritorios].sort((a, b) =>
        String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true })
    );

    sortedTerrs.forEach(t => {
        const numStr = String(t.numero).padStart(2, '0');
        if (!territoriesMap.has(numStr)) territoriesMap.set(numStr, []);
    });

    // Populate with assignments in range
    dataInRange.forEach(item => {
        if (!item.numero) return;
        const nums = item.numero.toString().split(/[,/]/).map(n => n.trim().padStart(2, '0'));
        nums.forEach(num => {
            if (territoriesMap.has(num)) {
                territoriesMap.get(num).push({ ...item, numero: num });
            }
        });
    });

    const sortedKeys = Array.from(territoriesMap.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    // 2. Pagination State (Image shows 22 rows per page)
    let pageHtmls = [];
    const TERR_PER_PAGE = 25;
    const ASSIGNS_PER_PAGE = 4;

    for (let i = 0; i < sortedKeys.length; i += TERR_PER_PAGE) {
        const terrChunkKeys = sortedKeys.slice(i, i + TERR_PER_PAGE);

        // Calculate Max Assignments across this chunk to see if we need multiple HORIZONTAL pages
        let maxAssigns = 0;
        terrChunkKeys.forEach(k => {
            const count = territoriesMap.get(k).length;
            if (count > maxAssigns) maxAssigns = count;
        });
        if (maxAssigns === 0) maxAssigns = 1;

        const sheetsNeeded = Math.ceil(maxAssigns / ASSIGNS_PER_PAGE);

        for (let s = 0; s < sheetsNeeded; s++) {
            const assignStartIndex = s * ASSIGNS_PER_PAGE;
            pageHtmls.push(S13Exporter.generatePageHtml(
                terrChunkKeys,
                territoriesMap,
                allHistory, // Pass all history to find "Last Completion"
                startDate,
                assignStartIndex,
                ASSIGNS_PER_PAGE,
                yearLabel,
                congregationName
            ));
        }
    }

    if (pageHtmls.length === 0) {
        container.innerHTML = `
            <div class="text-center mt-32 space-y-6 opacity-30">
                <div class="w-24 h-24 bg-slate-200 dark:bg-white/5 rounded-[2rem] flex items-center justify-center text-4xl mx-auto">
                    <i class="fas fa-folder-open"></i>
                </div>
                <p class="text-xs font-black uppercase tracking-[0.4em]">No hay asignaciones en este rango</p>
            </div>
        `;
        return;
    }

    container.innerHTML = pageHtmls.join('');
};

const formatDateShort = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};





