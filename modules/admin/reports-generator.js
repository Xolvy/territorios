import { PDFDocument } from 'pdf-lib';
import { showNotification } from '../utils/helpers.js';
import { UIHelpers } from '../services/ui-helpers.js';

const fetchPdf = async (path) => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Could not load ${path}`);
    return await res.arrayBuffer();
};

const loadImageBytes = async (url) => {
    try {
        if (url.startsWith('data:image')) {
            const base64 = url.split(',')[1];
            return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        }
        // Ensure anonymous cross-origin
        const res = await fetch(url, { credentials: 'omit' });
        return await res.arrayBuffer();
    } catch (e) {
        console.warn('Failed to load image bytes for PDF:', url);
        return null;
    }
};

export const generateS12Report = async (territories, layout = 1) => {
    showNotification("Generando Tarjetas S-12...", "info");

    try {
        const outDoc = await PDFDocument.create();

        // Use multi card template for layout 2 and 4, single for layout 1
        const isMulti = layout > 1;
        const templateUrl = isMulti ? '/S-12_s-Mlt_S.pdf' : '/S-12_S.pdf';
        const templateBytes = await fetchPdf(templateUrl);

        const cardsPerPage = isMulti ? 4 : 1;
        const fieldMap = {
            1: [{ loc: 'Text1', num: 'Text2', map: 'Text3' }],
            4: [
                { loc: 'Text1', num: 'Text2', map: 'Text3' },
                { loc: 'Text4', num: 'Text5', map: 'Text6' },
                { loc: 'Text7', num: 'Text8', map: 'Text9' },
                { loc: 'Text10', num: 'Tex11', map: 'Text12' }
            ]
        };
        const activeFields = fieldMap[cardsPerPage];

        let terrIndex = 0;

        while (terrIndex < territories.length) {
            const pageDoc = await PDFDocument.load(templateBytes);
            const form = pageDoc.getForm();
            const page = pageDoc.getPages()[0];

            for (let i = 0; i < cardsPerPage && terrIndex < territories.length; i++) {
                const t = territories[terrIndex++];
                const mapping = activeFields[i];

                // Set text fields
                const locField = form.getTextField(mapping.loc);
                if (locField) locField.setText(t.localidad || t.nombre || '');
                const numField = form.getTextField(mapping.num);
                if (numField) numField.setText(String(t.numero || ''));

                // Embed map image
                if (t.mapa_url) {
                    const mapField = form.getTextField(mapping.map);
                    if (mapField) {
                        const widgets = mapField.acroField.getWidgets();
                        if (widgets.length > 0) {
                            const rect = widgets[0].getRectangle();
                            const imgBytes = await loadImageBytes(t.mapa_url);
                            if (imgBytes) {
                                try {
                                    // Try loading as JPEG first, then PNG as fallback
                                    let pdfImage;
                                    try {
                                        pdfImage = await pageDoc.embedJpg(imgBytes);
                                    } catch (e) {
                                        pdfImage = await pageDoc.embedPng(imgBytes);
                                    }

                                    if (pdfImage) {
                                        page.drawImage(pdfImage, {
                                            x: rect.x,
                                            y: rect.y,
                                            width: rect.width,
                                            height: rect.height
                                        });
                                    }
                                } catch (e) {
                                    console.warn("Could not embed image for territory " + t.numero);
                                }
                            }
                        }
                    }
                }
            }

            form.flatten();
            const [copiedPage] = await outDoc.copyPages(pageDoc, [0]);
            outDoc.addPage(copiedPage);
        }

        const finalPdf = await outDoc.save();
        const blob = new Blob([finalPdf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `S12_Tarjetas_${new Date().getTime()}.pdf`;
        a.click();

        showNotification("PDF de Tarjetas S-12 generado", "success");
    } catch (e) {
        console.error("Error generating S-12:", e);
        showNotification("Hubo un error al generar el PDF S-12: " + e.message, "error");
    }
};

export const generateS13Report = async (history, from, to) => {
    showNotification("Generando Registro S-13...", "info");

    try {
        const outDoc = await PDFDocument.create();
        const templateBytes = await fetchPdf('/S-13_S.pdf');

        // Filter history by date and SUCCESS status
        const filtered = history.filter(h => {
            const rawDate = h.fecha_entrega || h.timestamp;
            if (!rawDate) return false;
            const date = UIHelpers.formatDateId(rawDate);
            const isSuccess = h.estado === 'Completado' || h.estado === 'Predicado';
            return isSuccess && date >= from && date <= to;
        });

        // Group by territory
        const grouped = filtered.reduce((acc, h) => {
            const num = String(h.numero);
            if (!acc[num]) acc[num] = [];
            acc[num].push(h);
            return acc;
        }, {});

        const sortedNums = Object.keys(grouped).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        let terrIndex = 0;

        while (terrIndex < sortedNums.length) {
            const pageDoc = await PDFDocument.load(templateBytes);
            const form = pageDoc.getForm();

            // Set service year
            const asigYearField = form.getTextField('Año de servicio');
            if (asigYearField) asigYearField.setText(new Date().getFullYear().toString());

            // 20 rows per page
            for (let row = 0; row < 20 && terrIndex < sortedNums.length; row++) {
                const num = sortedNums[terrIndex++];

                // Get Last Completed specifically from the array mapping if possible (or the first record's ultima_fecha)
                const records = grouped[num].sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion));
                const lastCompleted = records[0].ultima_fecha_completado || '';

                // Fill Territory Number and Last Completed
                const numField = form.getTextField(`Núm de terrRow${row + 1}`);
                if (numField) numField.setText(num);

                const lastCompletedField = form.getTextField(`Última fecha en que se completóRow${row + 1}`);
                if (lastCompletedField) lastCompletedField.setText(lastCompleted);

                // There are up to 4 iterations columns
                // i = 0 => Texto1.row, Texto5.row, Texto6.row
                // i = 1 => Texto2.row, Texto7.row, Texto8.row
                // i = 2 => Texto3.row, Texto9.row, Texto10.row
                // i = 3 => Texto4.row, Texto11.row, Texto12.row
                const colMap = [
                    { name: 1, out: 5, in: 6 },
                    { name: 2, out: 7, in: 8 },
                    { name: 3, out: 9, in: 10 },
                    { name: 4, out: 11, in: 12 }
                ];

                // Take the most recent 4 records
                const recentRecords = records.slice(-4);

                for (let i = 0; i < recentRecords.length; i++) {
                    const rec = recentRecords[i];
                    const mapping = colMap[i];

                    const fName = form.getTextField(`Texto${mapping.name}.${row}`);
                    if (fName) fName.setText(rec.conductor || '');

                    const fOut = form.getTextField(`Texto${mapping.out}.${row}`);
                    if (fOut && rec.fecha_asignacion) fOut.setText(new Date(rec.fecha_asignacion).toLocaleDateString());

                    const fIn = form.getTextField(`Texto${mapping.in}.${row}`);
                    if (fIn && rec.fecha_entrega) fIn.setText(new Date(rec.fecha_entrega).toLocaleDateString());
                }
            }

            form.flatten();
            const [copiedPage] = await outDoc.copyPages(pageDoc, [0]);
            outDoc.addPage(copiedPage);
        }

        // Handle empty scenario
        if (sortedNums.length === 0) {
            const pageDoc = await PDFDocument.load(templateBytes);
            const asigYearField = pageDoc.getForm().getTextField('Año de servicio');
            if (asigYearField) asigYearField.setText(new Date().getFullYear().toString());
            pageDoc.getForm().flatten();
            const [copiedPage] = await outDoc.copyPages(pageDoc, [0]);
            outDoc.addPage(copiedPage);
        }

        const finalPdf = await outDoc.save();
        const blob = new Blob([finalPdf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `S13_Registro_${new Date().getTime()}.pdf`;
        a.click();

        showNotification("Registro S-13 generado", "success");
    } catch (e) {
        console.error("Error generating S-13:", e);
        showNotification("Hubo un error al generar el S-13: " + e.message, "error");
    }
};
