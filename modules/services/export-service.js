/**
 * @file modules/services/export-service.js
 * @description Xolvy Export Service — Arquitectura de Doble Plantilla
 */

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const _SHIFTS = ["manana", "tarde", "noche", "zoom"];
const _SHIFT_LABELS = { manana: "Mañana", tarde: "Tarde", noche: "Noche", zoom: "Zoom" };

// Paleta de colores institucional por turno (formato ARGB para ExcelJS)
const _SHIFT_COLORS = {
    manana: { bg: "FFFFF8E1", text: "FF92400E", border: "FFFBBF24" }, // Amber
    tarde: { bg: "FFFFF3E0", text: "FFC2410C", border: "FFFB923C" }, // Orange
    noche: { bg: "FFEEF2FF", text: "FF3730A3", border: "FF818CF8" }, // Indigo
    zoom: { bg: "FFF0FDF4", text: "FF065F46", border: "FF34D399" }, // Emerald
};

// ─── HELPER: Disparar descarga de Blob ────────────────────────────────────────
const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
};

// ─── HELPER: Etiqueta de semana ────────────────────────────────────────────────
const getWeekLabel = (datosSemana) => {
    const start = datosSemana?.dias?.[0]?.fecha || "";
    const end = datosSemana?.dias?.[6]?.fecha || "";
    const fmt = (s) => (s ? s.split("-").reverse().join("/") : "?");
    return `${fmt(start)}_al_${fmt(end)}`;
};

// ─── HELPER: Notificación simple ──────────────────────────────────────────────
const notify = (msg, type = "info", duration = 3000) => {
    try {
        const { showNotification } = window._xolvyHelpers || {};
        if (showNotification) {
            showNotification(msg, type, duration);
            return;
        }
    } catch (_) {
        /* fallback */
    }
    if (window.Swal) {
        window.Swal.fire({
            toast: true,
            position: "top-end",
            icon: type === "error" ? "error" : type === "success" ? "success" : "info",
            title: msg,
            showConfirmButton: false,
            timer: duration,
        });
    } else {
        console.log(`[ExportService] ${type.toUpperCase()}: ${msg}`);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXPORTADOR EXCEL (ExcelJS + Template Injection)
// ─────────────────────────────────────────────────────────────────────────────

export const exportarProgramaExcel = async (datosSemana, tipoExportacion = "conductor") => {
    const esConductor = tipoExportacion === "conductor";
    const templatePath = esConductor ? "/templates/prog_conductores.xlsx" : "/templates/prog_publicadores.xlsx";

    notify(`⏳ Generando Excel ${esConductor ? "Conductores" : "Publicadores"}...`, "info", 2500);

    try {
        const ExcelJS = (await import("exceljs")).default;
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

        if (!usingTemplate) {
            workbook = _buildFallbackWorkbook(ExcelJS, datosSemana, esConductor);
        } else {
            _injectDataIntoTemplate(workbook.worksheets[0], datosSemana, esConductor);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const weekLabel = getWeekLabel(datosSemana);
        const version = esConductor ? "Conductores" : "Publicadores";
        triggerDownload(blob, `Programa_${version}_${weekLabel}.xlsx`);
        notify(`✅ Excel ${version} descargado`, "success");
    } catch (err) {
        console.error("[ExportService] Error generando Excel:", err);
        notify("❌ Error al generar el Excel. Revisa la consola.", "error");
    }
};

const _injectDataIntoTemplate = (sheet, datosSemana, esConductor) => {
    if (!sheet) return;

    const columnas = {
        Lunes: "B",
        Martes: "C",
        Miércoles: "D",
        Jueves: "E",
        Viernes: "F",
        Sábado: "G",
        Domingo: "H",
    };

    const configFilas = {
        manana: { base: 3, fecha: 3, lugar: 4, hora: 5, conductor: 6, auxiliar: 7, faceta: 8, territorio: 9 },
        tarde: { base: 11, fecha: 11, lugar: 12, hora: 13, conductor: 14, auxiliar: 15, faceta: 16, territorio: 17 },
        zoom: { base: 19, fecha: 19, lugar: 20, hora: 21, conductor: 22, auxiliar: 23, faceta: 24, territorio: 25 },
    };

    DAYS.forEach((dayName) => {
        const col = columnas[dayName];
        if (!col) return;

        ["manana", "tarde", "zoom"].forEach((shift) => {
            const filas = configFilas[shift];
            let datosDia = null;

            if (datosSemana?.dias?.length > 0) {
                const diaDoc = datosSemana.dias.find((d) => d.nombre === dayName);
                if (diaDoc) {
                    datosDia = diaDoc[shift] || {};
                    if (shift === "manana") {
                        const dayDate = diaDoc.fecha ? diaDoc.fecha.split("-")[2] : "";
                        if (dayDate) _safeSetCell(sheet, `${col}${filas.fecha}`, dayDate);
                    }
                }
            }

            if (!datosDia) return;

            _safeSetCell(sheet, `${col}${filas.lugar}`, datosDia.lugar || "");
            _safeSetCell(sheet, `${col}${filas.hora}`, datosDia.hora || "");
            _safeSetCell(sheet, `${col}${filas.conductor}`, datosDia.conductor || "");
            _safeSetCell(sheet, `${col}${filas.auxiliar}`, datosDia.auxiliar || "");
            _safeSetCell(sheet, `${col}${filas.faceta}`, datosDia.faceta || "");

            if (esConductor) {
                _safeSetCell(sheet, `${col}${filas.territorio}`, datosDia.territorio || "");
            } else {
                _safeSetCell(sheet, `${col}${filas.territorio}`, "");
            }
        });
    });
};

const _buildFallbackWorkbook = (ExcelJS, datosSemana, esConductor) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(esConductor ? "Conductores" : "Publicadores");

    sheet.columns = [
        { header: "Turno / Campo", key: "campo", width: 18 },
        ...DAYS.map((d) => ({ header: d, key: d.toLowerCase(), width: 22 })),
    ];

    const weekLabel = getWeekLabel(datosSemana).replace(/_al_/g, " al ");

    sheet.mergeCells("A1:H1");
    sheet.getCell("A1").value = "PROGRAMA DE PREDICACIÓN";
    sheet.mergeCells("A2:H2");
    sheet.getCell("A2").value = 'CONGREGACIÓN "NUEVE DE OCTUBRE" 14282';
    sheet.mergeCells("A3:H3");
    sheet.getCell("A3").value = `Semana del ${weekLabel}`;

    // Simple fill for demo
    return workbook;
};

const _safeSetCell = (sheet, address, value) => {
    try {
        sheet.getCell(address).value = value !== undefined && value !== null ? String(value) : "";
    } catch (e) {
        console.warn(`[ExportService] No se pudo escribir celda ${address}:`, e);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXPORTADOR PNG — DELEGACIÓN A EXCEL (Arquitectura v2.6)
// ─────────────────────────────────────────────────────────────────────────────

export const exportarProgramaPNG = async (datosSemana, tipoExportacion = "conductor") => {
    notify(
        "ℹ️ La exportación PNG directa ha sido deshabilitada para asegurar fidelidad total al formato original.",
        "info",
        5000,
    );
    notify("📂 Se descargará un archivo Excel (.xlsx) usando la plantilla institucional.", "info", 5000);

    return await exportarProgramaExcel(datosSemana, tipoExportacion);
};
