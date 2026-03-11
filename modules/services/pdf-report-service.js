/**
 * @file modules/services/pdf-report-service.js
 * @description Xolvy PDF Report Service — Motor de Reportes con pdf-lib
 *
 * FILOSOFÍA: NUNCA capturar el DOM. Todos los datos se inyectan directamente
 * en los PDFs plantilla desde /public/templates/ o desde URLs de Firestore/Storage.
 *
 * Funciones exportadas:
 *   generarS13(listaTerritorios)          → S-13_S.pdf  (Registro de territorios)
 *   generarS12(territorio)                → S-12_S.pdf  (Tarjeta de territorio individual)
 *   generarS12Multiple(lista4Territorios) → S-12_s-Mlt_S.pdf (4 en 1)
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ─── HELPERS PRIVADOS ─────────────────────────────────────────────────────────

/**
 * Descarga un recurso como ArrayBuffer.
 * Soporta rutas relativas (/templates/...) y URLs absolutas (Firestore Storage).
 * @param {string} url
 * @returns {Promise<ArrayBuffer>}
 */
const _fetchAssetAsArrayBuffer = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo descargar el asset: ${url} (${res.status})`);
    return res.arrayBuffer();
};

/**
 * Intenta escribir en un campo AcroForm nativo del PDF.
 * Si el campo no existe (PDF sin AcroForm), dibuja el texto con page.drawText()
 * usando las coordenadas de fallback.
 *
 * @param {object} form     - pdfDoc.getForm()
 * @param {import('pdf-lib').PDFPage} page
 * @param {string} fieldName        - Nombre del campo AcroForm
 * @param {string} value            - Valor a inyectar
 * @param {{ x: number, y: number, size?: number, maxWidth?: number }} fallbackCoords
 * @param {import('pdf-lib').PDFFont} font
 */
const _writeField = (form, page, fieldName, value, fallbackCoords, font) => {
    if (!value && value !== 0) return;
    const strValue = String(value);

    // Intento 1: Campo AcroForm nativo
    try {
        const field = form.getTextField(fieldName);
        field.setText(strValue);
        return;
    } catch (_) {
        // Campo no existe → usar fallback
    }

    // Fallback: drawText con coordenadas absolutas
    try {
        page.drawText(strValue, {
            x: fallbackCoords.x,
            y: fallbackCoords.y,
            size: fallbackCoords.size || 9,
            font,
            color: rgb(0.1, 0.1, 0.1),
            maxWidth: fallbackCoords.maxWidth || 200,
        });
    } catch (drawErr) {
        console.warn(`[PDFService] drawText fallback falló para "${fieldName}":`, drawErr);
    }
};

/**
 * Incrusta una imagen PNG en una página del PDF desde una URL.
 * @param {import('pdf-lib').PDFDocument} pdfDoc
 * @param {import('pdf-lib').PDFPage} page
 * @param {string} imageUrl - URL de la imagen (Firestore Storage o local)
 * @param {{ x, y, width, height }} coords - Posición y tamaño en la página
 */
const _embedImageFromUrl = async (pdfDoc, page, imageUrl, coords) => {
    if (!imageUrl) return;
    try {
        const imgBuffer = await _fetchAssetAsArrayBuffer(imageUrl);
        const pngImage = await pdfDoc.embedPng(imgBuffer);
        page.drawImage(pngImage, {
            x: coords.x,
            y: coords.y,
            width: coords.width,
            height: coords.height,
        });
    } catch (imgErr) {
        console.warn(`[PDFService] No se pudo incrustar imagen desde ${imageUrl}:`, imgErr);
        // Dibuja un recuadro de placeholder si falla
        page.drawRectangle({
            x: coords.x,
            y: coords.y,
            width: coords.width,
            height: coords.height,
            borderColor: rgb(0.75, 0.75, 0.75),
            borderWidth: 1,
        });
        page.drawText('Mapa no disponible', {
            x: coords.x + 8,
            y: coords.y + coords.height / 2 - 5,
            size: 8,
            color: rgb(0.5, 0.5, 0.5),
        });
    }
};

/** Dispara la descarga de un Blob PDF en el navegador */
const _downloadPdf = (uint8Array, filename) => {
    const blob = new Blob([uint8Array], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
};

/** Muestra el XolvyAlert de carga mientras se genera el PDF */
const _showLoadingAlert = (mensaje = 'Generando documento de alta calidad...') => {
    if (!window.Swal) return null;
    window.Swal.fire({
        title: '📄 Preparando PDF',
        html: `<p style="font-weight:600;font-size:13px;">${mensaje}</p>`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => window.Swal.showLoading(),
    });
};

const _closeLoadingAlert = () => {
    if (window.Swal) window.Swal.close();
};


// ─────────────────────────────────────────────────────────────────────────────
// S-13: Registro de Territorios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el S-13 (Registro de Territorios) con la lista de territorios.
 * @param {Array<object>} listaTerritorios
 */
export const generarS13 = async (listaTerritorios = []) => {
    _showLoadingAlert('Generando S-13 — Registro de Territorios...');

    try {
        const templateBuffer = await _fetchAssetAsArrayBuffer('/templates/S-13_S.pdf');
        const pdfDoc = await PDFDocument.load(templateBuffer, { ignoreEncryption: true });
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const form = pdfDoc.getForm();
        const pages = pdfDoc.getPages();

        // ── Inyectar filas de territorios ────────────────────────────────────
        // Cada "fila" ocupa un conjunto de campos con sufijo numérico (e.g., _1, _2...)
        // Si el PDF tiene AcroForm los campos se llenarán nativamente.
        // Si no, usamos coordenadas de fallback calculadas para el layout real del S-13.
        const PAGE_MARGIN_LEFT = 40;
        const ROW_HEIGHT = 18;
        const FIRST_ROW_Y = pages[0]?.getHeight() - 120 || 650;

        listaTerritorios.slice(0, 30).forEach((territorio, index) => {
            const page = pages[Math.floor(index / 15)] || pages[pages.length - 1];
            const rowIndex = index % 15;
            const y = FIRST_ROW_Y - rowIndex * ROW_HEIGHT;

            const suffix = `_${index + 1}`;

            _writeField(form, page, `numero${suffix}`,      territorio.numero || '',       { x: PAGE_MARGIN_LEFT,       y, size: 8, maxWidth: 40  }, font);
            _writeField(form, page, `nombre${suffix}`,      territorio.nombre || '',       { x: PAGE_MARGIN_LEFT + 50,  y, size: 8, maxWidth: 120 }, font);
            _writeField(form, page, `conductor${suffix}`,   territorio.conductor || '',    { x: PAGE_MARGIN_LEFT + 180, y, size: 8, maxWidth: 100 }, font);
            _writeField(form, page, `fechaSalida${suffix}`, territorio.fechaSalida || '',  { x: PAGE_MARGIN_LEFT + 290, y, size: 8, maxWidth: 60  }, font);
            _writeField(form, page, `fechaRetorno${suffix}`,territorio.fechaRetorno || '', { x: PAGE_MARGIN_LEFT + 360, y, size: 8, maxWidth: 60  }, font);
        });

        const pdfBytes = await pdfDoc.save();
        _downloadPdf(pdfBytes, `S-13_Territorios_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`);
        _closeLoadingAlert();

    } catch (err) {
        _closeLoadingAlert();
        console.error('[PDFService] Error generando S-13:', err);
        if (window.Swal) window.Swal.fire({ icon: 'error', title: 'Error al generar S-13', text: err.message, confirmButtonColor: '#0d9488' });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// S-12: Tarjeta de Territorio Individual
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el S-12 de un territorio individual.
 * Inyecta el número de territorio e incrusta la imagen PNG del mapa.
 * @param {object} territorio - { numero, nombre, mapaUrl, conductor, fechaSalida, ... }
 */
export const generarS12 = async (territorio) => {
    _showLoadingAlert(`Generando S-12 — Territorio ${territorio.numero || ''}...`);

    try {
        const templateBuffer = await _fetchAssetAsArrayBuffer('/templates/S-12_S.pdf');
        const pdfDoc = await PDFDocument.load(templateBuffer, { ignoreEncryption: true });
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const form = pdfDoc.getForm();
        const [page] = pdfDoc.getPages();
        const { height } = page.getSize();

        // ── Campos de texto ───────────────────────────────────────────────────
        _writeField(form, page, 'numero',      territorio.numero || '',      { x: 60,  y: height - 60,  size: 12 }, font);
        _writeField(form, page, 'nombre',      territorio.nombre || '',      { x: 110, y: height - 60,  size: 10 }, font);
        _writeField(form, page, 'conductor',   territorio.conductor || '',   { x: 60,  y: height - 80,  size: 9  }, font);
        _writeField(form, page, 'fechaSalida', territorio.fechaSalida || '', { x: 300, y: height - 80,  size: 9  }, font);

        // ── Imagen PNG del mapa (recuadro blanco principal del S-12) ──────────
        // Coordenadas calibradas para el recuadro blanco del S-12 institucional
        const mapaCoords = { x: 40, y: height - 420, width: 520, height: 310 };
        await _embedImageFromUrl(pdfDoc, page, territorio.mapaUrl || null, mapaCoords);

        const pdfBytes = await pdfDoc.save();
        _downloadPdf(pdfBytes, `S-12_Territorio_${territorio.numero || 'SN'}.pdf`);
        _closeLoadingAlert();

    } catch (err) {
        _closeLoadingAlert();
        console.error('[PDFService] Error generando S-12:', err);
        if (window.Swal) window.Swal.fire({ icon: 'error', title: 'Error al generar S-12', text: err.message, confirmButtonColor: '#0d9488' });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// S-12 Múltiple: 4 territorios en una sola hoja
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el S-12 Múltiple (4 territorios en 1 hoja, cuadrícula 2×2).
 * @param {Array<object>} lista4Territorios - Array de exactamente 4 territorios (se padea si hay menos)
 */
export const generarS12Multiple = async (lista4Territorios = []) => {
    _showLoadingAlert('Generando S-12 Múltiple — 4 territorios en 1 hoja...');

    // Asegurarse de tener exactamente 4 slots (rellenar con null si hay menos)
    const territorios = [...lista4Territorios];
    while (territorios.length < 4) territorios.push(null);

    try {
        const templateBuffer = await _fetchAssetAsArrayBuffer('/templates/S-12_s-Mlt_S.pdf');
        const pdfDoc = await PDFDocument.load(templateBuffer, { ignoreEncryption: true });
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const form = pdfDoc.getForm();
        const [page] = pdfDoc.getPages();
        const { width, height } = page.getSize();

        // ── Definición de los 4 cuadrantes ───────────────────────────────────
        // Cada cuadrante = { texto: {x,y}, mapa: {x,y,width,height} }
        const halfW = width / 2;
        const halfH = height / 2;
        const mapPadding = 30;
        const mapInnerW = halfW - mapPadding * 2 - 10;
        const mapInnerH = halfH - mapPadding * 2 - 25;

        const cuadrantes = [
            {
                label: 'Top-Left',
                texto: { x: mapPadding, y: height - 35 },
                mapa:  { x: mapPadding, y: height - mapPadding - mapInnerH - 20, width: mapInnerW, height: mapInnerH },
            },
            {
                label: 'Top-Right',
                texto: { x: halfW + mapPadding, y: height - 35 },
                mapa:  { x: halfW + mapPadding, y: height - mapPadding - mapInnerH - 20, width: mapInnerW, height: mapInnerH },
            },
            {
                label: 'Bottom-Left',
                texto: { x: mapPadding, y: halfH - 15 },
                mapa:  { x: mapPadding, y: mapPadding, width: mapInnerW, height: mapInnerH },
            },
            {
                label: 'Bottom-Right',
                texto: { x: halfW + mapPadding, y: halfH - 15 },
                mapa:  { x: halfW + mapPadding, y: mapPadding, width: mapInnerW, height: mapInnerH },
            },
        ];

        // ── Inyectar datos de cada cuadrante ──────────────────────────────────
        for (let i = 0; i < 4; i++) {
            const territorio = territorios[i];
            const cuadrante = cuadrantes[i];
            const suffix = `_${i + 1}`;

            if (!territorio) continue;

            // Texto: número + nombre en el encabezado del cuadrante
            _writeField(
                form, page,
                `numero${suffix}`,
                `${territorio.numero || ''} — ${territorio.nombre || ''}`,
                { x: cuadrante.texto.x, y: cuadrante.texto.y, size: 9, maxWidth: mapInnerW },
                font
            );

            // Mapa PNG
            await _embedImageFromUrl(pdfDoc, page, territorio.mapaUrl || null, cuadrante.mapa);
        }

        const pdfBytes = await pdfDoc.save();
        _downloadPdf(pdfBytes, `S-12-Multiple_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`);
        _closeLoadingAlert();

    } catch (err) {
        _closeLoadingAlert();
        console.error('[PDFService] Error generando S-12 Múltiple:', err);
        if (window.Swal) window.Swal.fire({ icon: 'error', title: 'Error al generar S-12 Múltiple', text: err.message, confirmButtonColor: '#0d9488' });
    }
};


// ─── Alias retrocompatible con el código anterior ─────────────────────────────
export const generarS12Auto = generarS12;
