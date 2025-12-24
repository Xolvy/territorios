import { getHistorialReport, rebuildHistoryFromSchedule } from '../data/firestore-services.js?v=5.0.3';
import { showNotification } from './utils/helpers.js?v=5.0.3';

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
                <!-- Controls -->
                <div class="flex flex-wrap items-end gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/10 dark:border-white/10">
                    <div>
                         <label class="block text-xs uppercase text-gray-500 mb-1 font-bold">Año Servicio</label>
                         <select id="report-year-select" class="bg-black/10 dark:bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-gray-800 dark:text-gray-200 focus:border-blue-500 outline-none font-bold">
                            <!-- Populated via JS -->
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
                        <span>📄</span> Exportar PDF
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
            const historyData = await getHistorialReport(start, end);
            const yearLabel = document.getElementById('report-year-select').value;
            renderReport(historyData, start, end, yearLabel);
            document.getElementById('btn-export-s13-pdf').classList.remove('hidden');
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

        if (window.showCustomConfirm) {
            window.showCustomConfirm("¿Deseas analizar todos los Programas Semanales antiguos para reconstruir el historial de asignaciones?\n\nEsto es útil si no ves datos de semanas anteriores.", runRebuild);
        } else {
            if (confirm("¿Deseas analizar todos los Programas Semanales antiguos para reconstruir el historial de asignaciones?")) {
                runRebuild();
            }
        }
    });
};

// --- LOGIC ENGINE ---

const renderReport = (data, startDate, endDate, yearLabel) => {
    const container = document.getElementById('report-preview');
    container.innerHTML = '';

    // 1. Group by Territory Number
    // Use a Map for sorting numerically
    const territoriesMap = new Map();

    data.forEach(item => {
        const num = item.numero.toString().split(' ')[0].replace(',', ''); // Basic number extraction and comma removal
        if (!territoriesMap.has(num)) {
            territoriesMap.set(num, []);
        }
        territoriesMap.get(num).push(item);
    });

    // Sort Keys (Territory Numbers)
    const sortedKeys = Array.from(territoriesMap.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    // 2. Pagination State
    // We need to fit territories into pages.
    // Each page has 20 Rows.
    // Each Row corresponds to ONE Territory, strictly?
    // User says: "si hubiera una quinta asignación... se deberá desbordar el texto a una siguiente hoja".
    // This implies S-13 format is: Row X = Territory X always.
    // If Territory 1 has 5 assignments, and the sheet holds 4 per row.
    // We need a "Sheet 2" where Row 1 (Territory 1) has assignment 5.

    // So, we don't just flow territories. We flow "Columns of Assignments".
    // We need to determine the Maximum Depth of assignments for ANY territory.
    // e.g. Max assignments found is 7.
    // Sheet 1 holds Assigns 1-4.
    // Sheet 2 holds Assigns 5-8.

    // BUT we also have vertical limit (20 territories per sheet).
    // So if we have 50 territories.
    // Sheet A1: Terr 1-20, Assigns 1-4
    // Sheet A2: Terr 1-20, Assigns 5-8 (Only if needed)
    // Sheet B1: Terr 21-40, Assigns 1-4
    // Sheet B2: Terr 21-40, Assigns 5-8 (Only if needed)

    // Algorithm:
    // Chunk territories into groups of 20.
    // For each chunk (Group of Territories):
    //    Calculate Max Assignments in this group.
    //    Determine how many "Assignment Sheets" needed (ceil(max / 4)).
    //    Generate Sheets.

    let pageHtmls = [];
    const TERR_PER_PAGE = 22;
    const ASSIGNS_PER_PAGE = 4;

    for (let i = 0; i < sortedKeys.length; i += TERR_PER_PAGE) {
        const terrChunkKeys = sortedKeys.slice(i, i + TERR_PER_PAGE);

        // Find max assignments in this chunk
        let maxAssigns = 0;
        terrChunkKeys.forEach(k => {
            if (territoriesMap.get(k).length > maxAssigns) maxAssigns = territoriesMap.get(k).length;
        });

        if (maxAssigns === 0) maxAssigns = 1; // At least one sheet

        const sheetsNeeded = Math.ceil(maxAssigns / ASSIGNS_PER_PAGE);

        for (let s = 0; s < sheetsNeeded; s++) {
            // Generate Sheet
            // s=0 -> indices 0-3
            // s=1 -> indices 4-7
            const assignStartIndex = s * ASSIGNS_PER_PAGE;

            pageHtmls.push(generateS13PageHtmlTable(
                terrChunkKeys,
                territoriesMap,
                assignStartIndex,
                ASSIGNS_PER_PAGE,
                yearLabel // Explicit Year passed
            ));
        }
    }

    if (pageHtmls.length === 0) {
        container.innerHTML = '<div class="text-gray-500 mt-20">No hay datos en este rango.</div>';
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

const generateS13PageHtmlTable = (keys, map, assignOffset, limit, year) => {
    // New Table-Based Implementation for Pixel-Perfect PDF
    const formatDateShort = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    let rowsHtml = '';
    const ROWS_PER_PAGE = 22;

    for (let r = 0; r < ROWS_PER_PAGE; r++) {
        const key = keys[r];
        const assignments = key ? map.get(key) : [];

        // Sort: Date Ascending
        assignments.sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion));

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
                                <span class="text-[9px] font-bold text-gray-900 truncate px-1 leading-tight pb-0.5 w-full text-center font-roboto">
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
                <td class="border border-black bg-gray-100/30 w-[25mm]"></td>
                ${colsHtml}
            </tr>
        `;
    }

    return `
        <div class="s13-page bg-white text-black w-[210mm] h-[297mm] p-[10mm] mx-auto flex flex-col mb-10 shrink-0 font-sans box-border relative overflow-hidden">
            
            <!-- Header -->
            <div class="text-center mb-1">
                <h1 class="text-2xl font-bold uppercase tracking-wide" style="font-family: 'Arial', sans-serif;">Registro de Asignación de Territorio</h1>
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
                        <tr class="bg-gray-200 text-[8px] font-bold text-center uppercase tracking-tight h-[12mm]">
                            <td class="border border-black p-1 align-middle">Terr.<br>n.º</td>
                            <td class="border border-black p-1 align-middle leading-tight">Última fecha<br>en que se<br>completó*</td>
                            
                            <!-- Assignment Headers Grouped -->
                            ${Array(4).fill(0).map(() => `
                                <td class="border border-black p-0 align-top">
                                    <div class="flex flex-col h-full">
                                        <div class="border-b border-black py-1 bg-gray-300">Asignado a</div>
                                        <div class="flex flex-1 h-full">
                                            <div class="w-1/2 border-r border-black flex items-center justify-center bg-gray-200 px-0.5 leading-none py-1 h-full">
                                                Fecha de<br>entrega
                                            </div>
                                            <div class="w-1/2 flex items-center justify-center bg-gray-200 px-0.5 leading-none py-1 h-full">
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
                 <!-- Footer Filler -->
                 <div class="flex-1 bg-white"></div>
            </div>

            <!-- Footnote -->
            <div class="mt-2 text-[9px] font-medium pl-1 text-gray-700">
                ** Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.
            </div>
            <div class="flex justify-between items-end mt-1 px-1">
                 <div class="text-[9px] font-bold text-gray-900">S-13 1/22</div>
                 <div class="text-[8px] text-gray-400">App Territorios JW</div>
            </div>
        </div>
    `;
};
