/**
 * @file modules/services/export-service.js
 * @description Xolvy Export Service — Arquitectura de Doble Plantilla
 *
 * 1. `exportarProgramaExcel(datosSemana, tipoExportacion)`
 *    — Lazy-loads ExcelJS (no penaliza el bundle inicial)
 *    — Intenta cargar plantilla .xlsx desde /public/templates/
 *    — Si falla, construye workbook ARGB desde cero (fallback institucional)
 *    — La columna "Territorio" SOLO se inyecta para 'conductor'
 *
 * 2. `exportarProgramaPNG(datosSemana, tipo)` — DEPRECADO
 *    — Captura con DOM Phantom/html2canvas ELIMINADA (WSoD trigger)
 *    — Redirige al usuario a usar Excel
 */

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const SHIFTS = ['manana', 'tarde', 'noche', 'zoom'];
const SHIFT_LABELS = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche', zoom: 'Zoom' };

// Paleta de colores institucional por turno (formato ARGB para ExcelJS)
const SHIFT_COLORS = {
    manana: { bg: 'FFFFF8E1', text: 'FF92400E', border: 'FFFBBF24' }, // Amber
    tarde:  { bg: 'FFFFF3E0', text: 'FFC2410C', border: 'FFFB923C' }, // Orange
    noche:  { bg: 'FFEEF2FF', text: 'FF3730A3', border: 'FF818CF8' }, // Indigo
    zoom:   { bg: 'FFF0FDF4', text: 'FF065F46', border: 'FF34D399' }, // Emerald
};

// ─── HELPER: Disparar descarga de Blob ────────────────────────────────────────
const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
};

// ─── HELPER: Etiqueta de semana ────────────────────────────────────────────────
const getWeekLabel = (datosSemana) => {
    const start = datosSemana?.dias?.[0]?.fecha || '';
    const end   = datosSemana?.dias?.[6]?.fecha || '';
    const fmt = (s) => s ? s.split('-').reverse().join('/') : '?';
    return `${fmt(start)}_al_${fmt(end)}`;
};

// ─── HELPER: Nombre de congregación ───────────────────────────────────────────
const getCongName = () =>
    localStorage.getItem('cached_congregation_name') || 'CONGREGACIÓN LOCAL';

// ─── HELPER: Notificación simple ──────────────────────────────────────────────
const notify = (msg, type = 'info', duration = 3000) => {
    try {
        const { showNotification } = window._xolvyHelpers || {};
        if (showNotification) { showNotification(msg, type, duration); return; }
    } catch (_) { /* fallback */ }
    if (window.Swal) {
        window.Swal.fire({ toast: true, position: 'top-end', icon: type === 'error' ? 'error' : type === 'success' ? 'success' : 'info',
            title: msg, showConfirmButton: false, timer: duration });
    } else {
        console.log(`[ExportService] ${type.toUpperCase()}: ${msg}`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXPORTADOR EXCEL (ExcelJS + Template Injection)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exporta el programa semanal a Excel.
 * @param {object} datosSemana
 * @param {'conductor'|'publicador'} tipoExportacion
 */
export const exportarProgramaExcel = async (datosSemana, tipoExportacion = 'conductor') => {
    const esConductor = tipoExportacion === 'conductor';
    const templatePath = esConductor
        ? '/templates/prog_conductores.xlsx'
        : '/templates/prog_publicadores.xlsx';

    notify(`⏳ Generando Excel ${esConductor ? 'Conductores' : 'Publicadores'}...`, 'info', 2500);

    try {
        // ── Lazy Loading: no penaliza el bundle inicial ───────────────────────
        const ExcelJS = (await import('exceljs')).default;

        // ── Intento de plantilla institucional ────────────────────────────────
        let workbook;
        let usingTemplate = false;

        try {
            const res = await fetch(templatePath);
            if (res.ok) {
                const ab = await res.arrayBuffer();
                workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(ab);
                usingTemplate = true;
                console.log(`[ExportService] ✅ Plantilla cargada: ${templatePath}`);
            }
        } catch (templateErr) {
            console.warn(`[ExportService] ⚠️ Plantilla no disponible, usando fallback:`, templateErr);
        }

        // ── Fallback: Workbook ARGB desde cero ───────────────────────────────
        if (!usingTemplate) {
            workbook = _buildFallbackWorkbook(ExcelJS, datosSemana, esConductor);
        } else {
            _injectDataIntoTemplate(workbook.worksheets[0], datosSemana, tipoExportacion);
        }

        // ── Serializar y descargar ────────────────────────────────────────────
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const weekLabel = getWeekLabel(datosSemana);
        const version = esConductor ? 'Conductores' : 'Publicadores';
        triggerDownload(blob, `Programa_${version}_${weekLabel}.xlsx`);
        notify(`✅ Excel ${version} descargado`, 'success');

    } catch (err) {
        console.error('[ExportService] Error generando Excel:', err);
        notify('❌ Error al generar el Excel. Revisa la consola.', 'error');
    }
};

/**
 * Inyecta datos en la primera hoja de la plantilla Excel.
 *
 * MAPA DE CELDAS:
 *   Columnas:  B=Lunes | C=Martes | D=Miércoles | E=Jueves | F=Viernes | G=Sábado | H=Domingo
 *   Fila 3:  Fecha del día
 *   Fila 4:  Lugar
 *   Fila 5:  Hora
 *   Fila 6:  Conductor
 *   Fila 7:  Auxiliar
 *   Fila 8:  Faceta
 *   Fila 9:  Territorio → SOLO si tipoExportacion === 'conductor'
 */
const _injectDataIntoTemplate = (sheet, datosSemana, tipoExportacion) => {
    if (!sheet) return;

    const esConductor = tipoExportacion === 'conductor';

    // Encabezado global
    const congName  = getCongName();
    const weekLabel = getWeekLabel(datosSemana).replace(/_al_/g, ' AL ');
    _safeSetCell(sheet, 'A1', congName.toUpperCase());
    _safeSetCell(sheet, 'A2', `SEMANA DEL ${weekLabel}`);

    const columnas = {
        'Lunes': 'B', 'Martes': 'C', 'Miércoles': 'D',
        'Jueves': 'E', 'Viernes': 'F', 'Sábado': 'G', 'Domingo': 'H',
    };

    const diaKeyAliases = {
        'Lunes': 'lunes', 'Martes': 'martes', 'Miércoles': 'miercoles',
        'Jueves': 'jueves', 'Viernes': 'viernes', 'Sábado': 'sabado', 'Domingo': 'domingo',
    };

    // Bloque 1 — Turno Mañana (fila base configurable)
    const filasBloque = { fecha: 3, lugar: 4, hora: 5, conductor: 6, auxiliar: 7, faceta: 8, territorio: 9 };

    DAYS.forEach(dayName => {
        const col = columnas[dayName];
        if (!col) return;

        let datosDia = null;

        if (datosSemana?.dias?.length > 0) {
            const diaDoc = datosSemana.dias.find(d => d.nombre === dayName);
            if (diaDoc) {
                datosDia = diaDoc.manana || {};
                const dayDate = diaDoc.fecha ? diaDoc.fecha.split('-')[2] : '';
                if (dayDate) _safeSetCell(sheet, `${col}${filasBloque.fecha}`, dayDate);
            }
        } else {
            const flatKey = diaKeyAliases[dayName];
            datosDia = datosSemana?.[flatKey] || null;
        }

        if (!datosDia) return;

        _safeSetCell(sheet, `${col}${filasBloque.lugar}`,     datosDia.lugar     || '');
        _safeSetCell(sheet, `${col}${filasBloque.hora}`,      datosDia.hora      || '');
        _safeSetCell(sheet, `${col}${filasBloque.conductor}`, datosDia.conductor || '');
        _safeSetCell(sheet, `${col}${filasBloque.auxiliar}`,  datosDia.auxiliar  || '');
        _safeSetCell(sheet, `${col}${filasBloque.faceta}`,    datosDia.faceta    || '');

        // CRÍTICO: Territorio solo para conductores
        if (esConductor) {
            _safeSetCell(sheet, `${col}${filasBloque.territorio}`, datosDia.territorio || '');
        } else {
            _safeSetCell(sheet, `${col}${filasBloque.territorio}`, ''); // limpiar celda
        }
    });
};

/**
 * Genera workbook ARGB institucional desde cero si no hay plantilla disponible.
 */
const _buildFallbackWorkbook = (ExcelJS, datosSemana, esConductor) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Xolvy Territorial Intelligence';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(
        esConductor ? 'Conductores' : 'Publicadores',
        { pageSetup: { paperSize: 9, orientation: 'landscape' } }
    );

    sheet.columns = [
        { header: 'Turno / Campo', key: 'campo', width: 18 },
        ...DAYS.map(d => ({ header: d, key: d.toLowerCase(), width: 22 }))
    ];

    const congName  = getCongName();
    const weekLabel = getWeekLabel(datosSemana).replace(/_al_/g, ' al ');

    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${congName.toUpperCase()} — Programa de Predicación`;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    sheet.getRow(1).height = 36;

    sheet.mergeCells('A2:H2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Semana del ${weekLabel}${esConductor ? '' : ' · Vista Publicadores'}`;
    subtitleCell.font = { bold: true, size: 11, color: { argb: 'FF64748B' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 24;

    const headerRow = sheet.getRow(3);
    headerRow.values = ['', ...DAYS];
    headerRow.eachCell((cell, colNum) => {
        if (colNum === 1) return;
        const dayDate = (datosSemana.dias || []).find(d => d.nombre === cell.value)?.fecha;
        cell.value = `${cell.value}${dayDate ? '\n' + dayDate.split('-').reverse().join('/') : ''}`;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    headerRow.height = 40;

    const fields = esConductor
        ? ['Lugar', 'Hora', 'Conductor', 'Auxiliar', 'Faceta', 'Territorio']
        : ['Lugar', 'Hora', 'Conductor', 'Faceta'];

    let currentRow = 4;

    SHIFTS.forEach(shift => {
        const shiftHeaderRow = sheet.getRow(currentRow);
        const colors = SHIFT_COLORS[shift];
        shiftHeaderRow.values = [SHIFT_LABELS[shift].toUpperCase(), ...DAYS.map(() => '')];
        shiftHeaderRow.eachCell(cell => {
            cell.font = { bold: true, size: 9, color: { argb: colors.text } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
            cell.border = { bottom: { style: 'thin', color: { argb: colors.border } } };
        });
        shiftHeaderRow.height = 20;
        currentRow++;

        fields.forEach(field => {
            const fieldRow = sheet.getRow(currentRow);
            const fKey = field.toLowerCase();
            const rowValues = [field];

            DAYS.forEach(dayName => {
                const diaData = (datosSemana.dias || []).find(d => d.nombre === dayName);
                const sData = diaData ? diaData[shift] || {} : {};

                if (!esConductor && (fKey === 'territorio' || fKey === 'auxiliar')) {
                    rowValues.push('');
                    return;
                }
                rowValues.push(sData[fKey] || '');
            });

            fieldRow.values = rowValues;
            fieldRow.eachCell((cell, colNum) => {
                cell.font = colNum === 1
                    ? { bold: true, size: 8, color: { argb: 'FF64748B' } }
                    : { size: 9, color: { argb: 'FF1E293B' } };
                cell.alignment = { vertical: 'middle', wrapText: true };
                cell.border = {
                    bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'hair', color: { argb: 'FFE2E8F0' } }
                };
                if (colNum === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
            });
            fieldRow.height = 18;
            currentRow++;
        });

        currentRow++; // Espacio entre turnos
    });

    const footerRow = sheet.getRow(currentRow);
    sheet.mergeCells(`A${currentRow}:H${currentRow}`);
    footerRow.getCell(1).value = `Generado por Xolvy Intelligence · ${new Date().toLocaleString('es-ES')}`;
    footerRow.getCell(1).font = { italic: true, size: 8, color: { argb: 'FF94A3B8' } };
    footerRow.getCell(1).alignment = { horizontal: 'right' };

    return workbook;
};

// ── Escritura segura en celda ──────────────────────────────────────────────────
const _safeSetCell = (sheet, address, value) => {
    try {
        sheet.getCell(address).value = (value !== undefined && value !== null) ? String(value) : '';
    } catch (e) {
        console.warn(`[ExportService] No se pudo escribir celda ${address}:`, e);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// 2. EXPORTADOR PNG — DEPRECADO
// DOM Phantom + html2canvas ELIMINADO (causaba WSoD y dependencia circular)
// El usuario debe usar exportarProgramaExcel() para mantener la calidad.
// ─────────────────────────────────────────────────────────────────────────────
export const exportarProgramaPNG = async (_datosSemana, _tipo = 'conductor') => {
    notify(
        '📊 La exportación PNG ha sido reemplazada. Usa el botón "Exportar Excel" para obtener el reporte de alta calidad.',
        'info',
        5000
    );
};
