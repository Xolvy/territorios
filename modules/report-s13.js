import { getHistorialReport, rebuildHistoryFromSchedule, getConfiguracion } from '../data/firestore-services.js?v=1.9.9.0';
import { showNotification, generatePlainXLS } from './utils/helpers.js?v=1.9.9.0';
import { S13Exporter } from './services/s13-exporter.js?v=1.9.9.0';

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
    const yearSelect = showHeader ? document.getElementById('report-year-select') : null;
    const startInput = showHeader ? document.getElementById('report-start') : (options.startInput || null);
    const endInput = showHeader ? document.getElementById('report-end') : (options.endInput || null);

    // Calculate current Service Year
    // Service Year 2026 starts Sept 1, 2025.
    // If Month is>= 8 (Sept, 0-indexed), Service Year is Next Year.
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11. Sept is 8.
    const serviceYear = currentMonth >= 8 ? currentYear + 1 : currentYear;

    // Populate Selector (Range: Current - 5 to Current + 5)
    if (yearSelect) {
        for (let y = serviceYear - 5; y <= serviceYear + 5; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === serviceYear) opt.selected = true;
            // Style for light mode
            opt.className = "bg-white text-gray-900 dark:bg-black dark:text-white";
            yearSelect.appendChild(opt);
        }
    }

    // Function to set dates based on Service Year
    const setDatesFromServiceYear = (sy) => {
        if (!startInput || !endInput) return;
        // SY 2025 = Sept 1, 2024 to Aug 31, 2025
        const y = parseInt(sy);
        const start = new Date(y - 1, 8, 1); // Sept 1, Prev Year
        const end = new Date(y, 7, 31); // Aug 31, Current SY Year

        const fmt = (d) => {
            const yy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd}`;
        };
        startInput.value = fmt(start);
        endInput.value = fmt(end);
    };

    // Initial Set
    if (showHeader) setDatesFromServiceYear(serviceYear);

    // Listener
    if (yearSelect) {
        yearSelect.addEventListener('change', (e) => {
            setDatesFromServiceYear(e.target.value);
        });
    }

    document.getElementById('btn-generate-report').addEventListener('click', async () => {
        const start = document.getElementById('report-start').value;
        const end = document.getElementById('report-end').value;

        if (!start || !end) {
            showNotification("Selecciona un rango de fechas válido.", "warning");
            return;
        }

        const loader = document.getElementById('report-loading');
        loader.classList.remove('hidden');

        try {
            const [allHistory, allTerritorios] = await Promise.all([
                getHistorialReport(),
                // Use a local import or global if available. It's usually imported in this file? 
                // Wait, it is NOT imported. Let's add it to imports.
                import('../data/firestore-services.js?v=1.9.9.0').then(m => m.getTerritorios())
            ]);

            // Filter data for the preview range
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
            const yearLabel = document.getElementById('report-year-select').value;

            renderReport(historyInRange, allHistory, allTerritorios, start, end, yearLabel, congregationName);
            document.getElementById('btn-export-s13-pdf').classList.remove('hidden');
            document.getElementById('btn-export-s13-excel').classList.remove('hidden');

            // Save current data for excel export
            window._currentS13Data = historyInRange;
        } catch (e) {
            console.error(e);
            showNotification("Error generando reporte: " + e.message, "error");
        } finally {
            loader.classList.add('hidden');
        }
    });

    document.getElementById('btn-export-s13-pdf').addEventListener('click', async () => {
        const pages = document.querySelectorAll('.s13-page');
        if (pages.length === 0) return;

        const btn = document.getElementById('btn-export-s13-pdf');
        const oldText = btn.innerHTML;
        btn.innerHTML = '⏳ Generando PDF...';
        btn.disabled = true;

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4'); // A4 Portrait

            // A4 Size: 210 x 297 mm
            const pdfWidth = 210;
            const pdfHeight = 297;

            for (let i = 0; i < pages.length; i++) {
                if (i > 0) doc.addPage();

                // Use html2canvas
                const canvas = await html2canvas(pages[i], {
                    scale: 2, // High res
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const imgProps = doc.getImageProperties(imgData);

                // Fit width
                const printHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, printHeight);
            }

            doc.save(`S13_Historial_${document.getElementById('report-start').value}.pdf`);

        } catch (e) {
            console.error(e);
            showNotification("Error exportando PDF", "error");
        } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    });

    document.getElementById('btn-export-s13-excel').addEventListener('click', () => {
        const data = window._currentS13Data;
        if (!data || data.length === 0) return;

        // Create a flat list: if multiple numbers were assigned together, split them
        const flatList = [];
        data.forEach(item => {
            const nums = item.numero.toString().split(',').map(n => n.trim());
            nums.forEach(num => {
                flatList.push({
                    'Territorio': num,
                    'Conductor': item.conductor || '-',
                    'Fecha Asignación': formatDateShort(item.fecha_asignacion),
                    'Fecha Devolución': formatDateShort(item.fecha_entrega),
                    'Estado': item.estado || '-',
                    'Observaciones': item.observaciones || '-'
                });
            });
        });

        // Numerical Sort by Territory
        flatList.sort((a, b) => a.Territorio.localeCompare(b.Territorio, undefined, { numeric: true }));

        generatePlainXLS(flatList, `Listado_Asignaciones_S13_${document.getElementById('report-start').value}`);
        showNotification("Excel generado con éxito", "success");
    });

    // Rebuild Listener
    document.getElementById('btn-rebuild-history').addEventListener('click', async () => {
        const runRebuild = async () => {
            const loader = document.getElementById('report-loading');
            loader.classList.remove('hidden');
            try {
                const count = await rebuildHistoryFromSchedule();
                showNotification(`Historial reconstruido. Se recuperaron ${count} asignaciones.`, "success");
            } catch (e) {
                console.error(e);
                showNotification("Error en reconstrucción: " + e.message, "error");
            } finally {
                loader.classList.add('hidden');
            }
        };

        window.showCustomConfirm("¿Deseas analizar todos los Programas Semanales antiguos para reconstruir el historial de asignaciones?\n\nEsto es útil si no ves datos de semanas anteriores.", runRebuild);
    });
};

// --- LOGIC ENGINE ---

const renderReport = (dataInRange, allHistory, allTerritorios, startDate, endDate, yearLabel, congregationName) => {
    const container = document.getElementById('report-preview');
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
    const TERR_PER_PAGE = 20;
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





