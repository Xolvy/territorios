import { getHistorialReport, rebuildHistoryFromSchedule, getConfiguracion } from '../data/firestore-services.js?v=2.6.1';
import { showNotification, generatePlainXLS } from './utils/helpers.js?v=2.6.1';

export const renderHistoryTab = (container) => {
    container.innerHTML = `
        <div class="h-full flex flex-col gap-6 animate-fade-in relative">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-black/10 dark:border-white/10 pb-6">
                <div>
                    <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                        📋 Historial de Asignaciones (S-13)
                    </h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        Genera reportes detallados para el formulario S-13.
                    </p>
                </div>
                <div class="flex flex-wrap items-end gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/10 dark:border-white/10">
                    <div>
                         <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">Año Servicio</label>
                         <select id="report-year-select" class="bg-black/10 dark:bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-gray-800 dark:text-gray-200 focus:border-blue-500 outline-none font-bold">
                         </select>
                    </div>
                    <div>
                        <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">Desde</label>
                        <input type="date" id="report-start" class="bg-black/10 dark:bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-gray-800 dark:text-gray-200 focus:border-blue-500 outline-none">
                    </div>
                     <div>
                        <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">Hasta</label>
                        <input type="date" id="report-end" class="bg-black/10 dark:bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-gray-200 focus:border-blue-500 outline-none">
                    </div>
                    <button id="btn-generate-report" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg shadow-lg shadow-blue-500/20 text-sm font-bold transition-all h-fit self-end">
                        Generar Vista Previa
                    </button>
                    <button id="btn-export-s13-pdf" class="hidden bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-lg shadow-lg shadow-red-500/20 text-sm font-bold transition-all h-fit self-end flex items-center gap-2">
                        <span>📄</span> PDF
                    </button>
                    <button id="btn-export-s13-excel" class="hidden bg-green-700 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg shadow-lg shadow-green-500/20 text-sm font-bold transition-all h-fit self-end flex items-center gap-2">
                        <span>📊</span> EXCEL
                    </button>
                    <!-- Tools -->
                    <button id="btn-rebuild-history" class="text-gray-400 hover:text-white p-2 rounded-lg transition-colors h-fit self-end" title="Recuperar historial desde Programa Semanal">
                        <span class="text-lg">🛠️</span>
                    </button>
                </div>
            </header>

            <div id="report-preview" class="flex-1 overflow-auto bg-gray-100/5 dark:bg-[#0a0a0a] rounded-xl border border-white/5 p-8 flex flex-col items-center gap-8 relative min-h-[500px]">
                 <div class="text-center text-gray-500 mt-20">
                    <div class="text-4xl mb-4">📅</div>
                    <p>Selecciona un rango de fechas para generar el reporte.</p>
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
    const yearSelect = document.getElementById('report-year-select');
    const startInput = document.getElementById('report-start');
    const endInput = document.getElementById('report-end');

    // Calculate current Service Year
    // Service Year 2026 starts Sept 1, 2025.
    // If Month is >= 8 (Sept, 0-indexed), Service Year is Next Year.
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11. Sept is 8.
    const serviceYear = currentMonth >= 8 ? currentYear + 1 : currentYear;

    // Populate Selector (Range: Current - 5 to Current + 5)
    for (let y = serviceYear - 5; y <= serviceYear + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === serviceYear) opt.selected = true;
        // Style for light mode
        opt.className = "bg-white text-gray-900 dark:bg-black dark:text-white";
        yearSelect.appendChild(opt);
    }

    // Function to set dates based on Service Year
    const setDatesFromServiceYear = (sy) => {
        // SY 2025 = Sept 1, 2024 to Aug 31, 2025
        const y = parseInt(sy);
        const start = new Date(y - 1, 8, 1); // Sept 1, Prev Year
        const end = new Date(y, 7, 31); // Aug 31, Current SY Year which is actually 8th month index (Aug is 7? No jan=0, aug=7. Aug 31 ok.)
        // Correction: Month 8 is Sept. Month 7 is Aug.

        startInput.valueAsDate = start; // Local time issue? valueAsDate expects UTC usually or acts locally. easier to use strings.
        // Let's use string YYYY-MM-DD
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
    setDatesFromServiceYear(serviceYear);

    // Listener
    yearSelect.addEventListener('change', (e) => {
        setDatesFromServiceYear(e.target.value);
    });

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
            const allHistory = await getHistorialReport();

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

            renderReport(historyInRange, allHistory, start, end, yearLabel, congregationName);
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
        showNotification("Excel generado con éxito. 📊");
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

const renderReport = (dataInRange, allHistory, startDate, endDate, yearLabel, congregationName) => {
    const container = document.getElementById('report-preview');
    container.innerHTML = '';

    // 1. Group by Territory Number (Numerical Sort)
    const territoriesMap = new Map();

    dataInRange.forEach(item => {
        if (!item.numero) return;
        // Split territory numbers if they are comma-separated (e.g. "1, 2")
        const nums = item.numero.toString().split(',').map(n => n.trim().padStart(2, '0'));
        nums.forEach(num => {
            if (!territoriesMap.has(num)) territoriesMap.set(num, []);
            territoriesMap.get(num).push({ ...item, numero: num });
        });
    });

    const sortedKeys = Array.from(territoriesMap.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    // 2. Pagination State (Image shows 22 rows per page)
    let pageHtmls = [];
    const TERR_PER_PAGE = 22;
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
            pageHtmls.push(generateS13PageHtmlTable(
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
        container.innerHTML = '<div class="text-gray-500 mt-20 text-center flex flex-col items-center"><span class="text-4xl mb-4">📭</span>No hay asignaciones registradas en este rango.</div>';
        return;
    }

    container.innerHTML = pageHtmls.join('');
};

const formatDateShort = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const generateS13PageHtmlLegacy = (keys, map, assignOffset, limit, year) => {
    // Exact S-13 Styling mimics
    const BORDER_THICK = '2px solid black';
    const BORDER_THIN = '1px solid black';

    // Rows
    let rowsHtml = '';
    const ROWS_PER_PAGE = 20;

    for (let r = 0; r < ROWS_PER_PAGE; r++) {
        const key = keys[r];
        const assignments = key ? map.get(key) : [];

        // Sort: Date Ascending
        assignments.sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion));

        // Slice for this sheet
        const slice = assignments.slice(assignOffset, assignOffset + limit);

        // Cells for Assignments
        let colsHtml = '';
        for (let c = 0; c < 4; c++) {
            const assign = slice[c];
            // Border logic: Last col doesn't need right border if container handles it, 
            // but in grid we usually border the cell elements.
            const borderClass = c === 3 ? '' : 'border-r border-black';

            if (assign) {
                const assignedDate = formatDateShort(assign.fecha_asignacion);
                const returnedDate = formatDateShort(assign.fecha_entrega); // fecha_entrega in DB = Finished/Returned

                colsHtml += `
                    <div class="col-span-1 ${borderClass} flex flex-col h-full text-[9px] relative font-roboto">
                         <!-- Name -->
                         <div class="w-full text-center font-bold text-gray-900 border-b border-gray-400 pt-1 leading-tight px-1 truncate h-[50%] flex items-end justify-center pb-0.5">
                            ${assign.conductor || '-'}
                         </div>
                         <!-- Dates -->
                         <div class="flex h-[50%] w-full">
                            <div class="w-1/2 text-center border-r border-gray-400 pt-0.5 leading-none flex items-start justify-center text-gray-800">
                                ${assignedDate}
                            </div>
                            <div class="w-1/2 text-center pt-0.5 leading-none flex items-start justify-center text-gray-800">
                                ${returnedDate}
                            </div>
                         </div>
                    </div>
                `;
            } else {
                colsHtml += `<div class="col-span-1 ${borderClass} h-full"></div>`;
            }
        }

        // Row background: Alternating? Image shows all white.
        rowsHtml += `
            <div class="grid grid-cols-[35px_80px_repeat(4,1fr)] h-[11mm] border-b border-black text-xs">
                <!-- Num -->
                <div class="flex items-center justify-center font-bold text-sm border-r border-black">
                    ${key || ''}
                </div>
                <!-- Last Completed -->
                <div class="border-r border-black bg-gray-50/50"></div>
                
                <!-- 4 Blocks -->
                <div class="col-span-4 grid grid-cols-4 h-full">
                    ${colsHtml}
                </div>
            </div>
        `;
    }

    return `
        <div class="s13-page bg-white text-black w-[210mm] h-[297mm] p-[10mm] mx-auto flex flex-col mb-10 shrink-0 font-sans box-border relative overflow-hidden">
            
            <!-- Header -->
            <div class="text-center mb-1">
                <h1 class="text-xl font-bold uppercase tracking-wide" style="font-family: 'Arial', sans-serif;">Registro de Asignación de Territorio</h1>
            </div>
            
            <div class="flex items-end gap-2 mb-1 pl-1">
                <span class="font-bold text-sm uppercase">Año de servicio </span>
                <span class="border-b-2 border-black px-2 text-lg font-bold leading-none">${year}</span>
            </div>

            <!-- Table Container -->
            <div class="w-full border-t-2 border-l-2 border-r-2 border-b-2 border-black mt-1 flex flex-col flex-1">
                 
                 <!-- Table Headers -->
                 <div class="grid grid-cols-[35px_80px_repeat(4,1fr)] border-b-2 border-black bg-gray-200 text-[8px] font-bold text-center leading-tight">
                     <!-- Col 1 -->
                     <div class="flex items-center justify-center border-r border-black p-1">
                        Terr.<br>n.º
                     </div>
                     <!-- Col 2 -->
                     <div class="flex items-center justify-center border-r border-black p-1">
                        Última fecha<br>en que se<br>completó*
                     </div>
                     <!-- Col 3 (Assignments) -->
                     <div class="col-span-4 flex">
                        ${Array(4).fill(0).map((_, idx) => `
                            <div class="flex-1 ${idx < 3 ? 'border-r border-black' : ''} flex flex-col">
                                <div class="border-b border-black py-1 bg-gray-300">Asignado a</div>
                                <div class="flex flex-1">
                                    <div class="w-1/2 border-r border-gray-400 py-1 px-0.5 flex items-center justify-center">Fecha de<br>entrega</div>
                                    <div class="w-1/2 py-1 px-0.5 flex items-center justify-center">Fecha de<br>devolución</div>
                                </div>
                            </div>
                        `).join('')}
                     </div>
                 </div>

                 <!-- Rows Container -->
                 <div class="flex-1 flex flex-col">
                    ${rowsHtml}
                 </div>
                 
                 <!-- Footer Filler (if rows don't fill height) -->
                 <div class="flex-1 border-black bg-white"></div>
            </div>

            <!-- Footnote -->
            <div class="mt-1 text-[9px] font-medium pl-1">
                ** Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.
            </div>
            <div class="text-[9px] font-bold pl-1 mt-0.5">
                S-13 1/22
            </div>
        </div>
    `;
};

const generateS13PageHtmlTable = (keys, map, allHistory, reportStartDate, assignOffset, limit, year, congregation) => {
    const formatDateShort = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        // Correct for UTC if needed, but local is usually what user expects for "DD/MM/YYYY"
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const reportStartMs = new Date(reportStartDate).getTime();

    let rowsHtml = '';
    const ROWS_PER_PAGE = 22;

    for (let r = 0; r < ROWS_PER_PAGE; r++) {
        const key = keys[r];
        const assignments = key ? map.get(key) : [];

        // Sort: Date Ascending
        assignments.sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion));

        // Calculate "Last Completion Date" (Última fecha en que se completó)
        // Find latest fecha_entrega in allHistory for this territory number that is BEFORE reportStartMs
        let lastCompletionDate = '';
        if (key) {
            const previousCompletions = allHistory
                .filter(h => {
                    if (!h.numero || !h.fecha_entrega) return false;
                    const hNum = h.numero.toString().trim().padStart(2, '0');
                    return hNum === key && new Date(h.fecha_entrega).getTime() < reportStartMs;
                })
                .sort((a, b) => new Date(b.fecha_entrega).getTime() - new Date(a.fecha_entrega).getTime());

            if (previousCompletions.length > 0) {
                lastCompletionDate = formatDateShort(previousCompletions[0].fecha_entrega);
            }
        }

        // Slice for this sheet
        const slice = assignments.slice(assignOffset, assignOffset + limit);

        // Cells for Assignments (4 columns)
        let colsHtml = '';
        for (let c = 0; c < 4; c++) {
            const assign = slice[c];
            if (assign) {
                const assignedDate = formatDateShort(assign.fecha_asignacion);
                const returnedDate = formatDateShort(assign.fecha_entrega);

                colsHtml += `
                    <td class="border border-black p-0 align-top w-[38mm]">
                        <div class="flex flex-col h-[10mm]">
                            <!-- Name -->
                            <div class="h-[50%] w-full flex items-end justify-center border-b border-black">
                                <span class="text-[9px] font-bold text-gray-900 truncate px-1 leading-tight pb-0.5 w-full text-center font-roboto uppercase">
                                    ${assign.conductor || '-'}
                                </span>
                            </div>
                            <!-- Dates -->
                            <div class="h-[50%] w-full flex">
                                <div class="w-1/2 border-r border-black flex items-center justify-center pt-0.5 text-[8.5px] text-gray-800 font-bold h-full font-roboto leading-none">
                                    ${assignedDate}
                                </div>
                                <div class="w-1/2 flex items-center justify-center pt-0.5 text-[8.5px] text-gray-800 font-bold h-full font-roboto leading-none">
                                    ${returnedDate}
                                </div>
                            </div>
                        </div>
                    </td>
                `;
            } else {
                colsHtml += `
                    <td class="border border-black p-0 w-[38mm]">
                        <div class="h-[10mm]"></div>
                    </td>
                `;
            }
        }

        rowsHtml += `
            <tr class="h-[10mm]">
                <td class="border border-black text-center font-bold text-sm bg-gray-50/10 w-[12mm]">${key || ''}</td>
                <td class="border border-black bg-gray-100/10 w-[25mm] text-center text-[9px] font-bold">${lastCompletionDate}</td>
                ${colsHtml}
            </tr>
        `;
    }

    return `
        <div class="s13-page bg-white text-black w-[210mm] h-[297mm] p-[10mm] mx-auto flex flex-col mb-10 shrink-0 font-sans box-border relative overflow-hidden">
            
            <!-- Header -->
            <div class="text-center mb-1">
                <h1 class="text-2xl font-bold uppercase tracking-wider" style="font-family: 'Arial', sans-serif;">Registro de Asignación de Territorio</h1>
            </div>
            
            <div class="flex items-end gap-3 mb-2 px-1">
                <span class="font-bold text-sm uppercase tracking-wider mb-1">Año de servicio</span>
                <div class="border-b-2 border-black px-4 text-xl font-bold leading-none pb-1 min-w-[30mm] text-center">
                    ${year}
                </div>
            </div>

            <!-- Table Container -->
            <div class="w-full flex-1 border-t-2 border-l-2 border-r-2 border-b-2 border-black">
                <table class="w-full border-collapse border-hidden table-fixed">
                    <colgroup>
                        <col style="width: 12mm;"> <!-- Terr No -->
                        <col style="width: 25mm;"> <!-- Last Completed -->
                        <col style="width: 38mm;"> <!-- Assign 1 -->
                        <col style="width: 38mm;"> <!-- Assign 2 -->
                        <col style="width: 38mm;"> <!-- Assign 3 -->
                        <col style="width: 38mm;"> <!-- Assign 4 -->
                    </colgroup>
                    <thead>
                        <tr class="bg-gray-100 dark:bg-gray-100 text-[8px] font-black text-center uppercase tracking-tight h-[12mm]">
                            <td class="border border-black p-1 align-middle">Terr.<br>n.º</td>
                            <td class="border border-black p-1 align-middle leading-tight bg-gray-50/50">Última fecha<br>en que se<br>completó*</td>
                            
                            <!-- Assignment Headers Grouped -->
                            ${Array(4).fill(0).map(() => `
                                <td class="border border-black p-0 align-top">
                                    <div class="flex flex-col h-full">
                                        <div class="border-b border-black py-1 bg-gray-200">Asignado a</div>
                                        <div class="flex flex-1 h-full">
                                            <div class="w-1/2 border-r border-black flex items-center justify-center bg-gray-50 px-0.5 leading-none py-1 h-full">
                                                Fecha de<br>entrega
                                            </div>
                                            <div class="w-1/2 flex items-center justify-center bg-gray-50 px-0.5 leading-none py-1 h-full">
                                                Fecha de<br>devolución
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>

            <!-- Footnote -->
            <div class="mt-2 text-[9px] font-medium pl-1 text-gray-700 italic">
                * Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.
            </div>
            <div class="flex justify-between items-end mt-1 px-1">
                 <div class="flex flex-col">
                    <div class="text-[9px] font-bold text-gray-900">S-13 1/22</div>
                 </div>
                 <div class="text-[10px] font-bold text-gray-800 uppercase">${congregation}</div>
            </div>
        </div>
    `;
};





