import { PDFDocument, TextAlignment } from "pdf-lib";
import { UIHelpers } from "../services/ui-helpers.js";
import { showNotification } from "../utils/helpers.js";

const fetchPdf = async (path) => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Could not load ${path}`);
    return await res.arrayBuffer();
};

const loadImageBytes = async (url) => {
    try {
        if (url.startsWith("data:image")) {
            const base64 = url.split(",")[1];
            return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        }
        // Ensure anonymous cross-origin
        const res = await fetch(url, { credentials: "omit" });
        return await res.arrayBuffer();
    } catch (_e) {
        console.warn("Failed to load image bytes for PDF:", url);
        return null;
    }
};

export const generateS12Report = async (territories, layout = 1) => {
    showNotification("Generando Tarjetas S-12...", "info");

    try {
        const outDoc = await PDFDocument.create();

        // Use multi card template for layout 2 and 4, single for layout 1
        const isMulti = layout > 1;
        const templateUrl = isMulti ? "/S-12_s-Mlt_S.pdf" : "/S-12_S.pdf";
        const templateBytes = await fetchPdf(templateUrl);

        const cardsPerPage = isMulti ? 4 : 1;
        const fieldMap = {
            1: [{ loc: "Text1", num: "Text2", map: "Text3" }],
            4: [
                { loc: "Text1", num: "Text2", map: "Text3" },
                { loc: "Text4", num: "Text5", map: "Text6" },
                { loc: "Text7", num: "Text8", map: "Text9" },
                { loc: "Text10", num: "Tex11", map: "Text12" },
            ],
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
                if (locField) locField.setText(t.localidad || t.nombre || "");
                const numField = form.getTextField(mapping.num);
                if (numField) numField.setText(String(t.numero || ""));

                // Embed map image
                const mapUrl = t.imagen || t.imagen_url || t.mapa_url;
                if (mapUrl && typeof mapUrl === "string" && mapUrl !== "null" && mapUrl !== "undefined" && mapUrl.trim() !== "") {
                    const mapField = form.getTextField(mapping.map);
                    if (mapField) {
                        const widgets = mapField.acroField.getWidgets();
                        if (widgets.length > 0) {
                            const rect = widgets[0].getRectangle();
                            const imgBytes = await loadImageBytes(mapUrl);
                            if (imgBytes) {
                                try {
                                    // Try loading as JPEG first, then PNG as fallback
                                    let pdfImage;
                                    try {
                                        pdfImage = await pageDoc.embedJpg(imgBytes);
                                    } catch (_e) {
                                        pdfImage = await pageDoc.embedPng(imgBytes);
                                    }

                                    if (pdfImage) {
                                        page.drawImage(pdfImage, {
                                            x: rect.x,
                                            y: rect.y,
                                            width: rect.width,
                                            height: rect.height,
                                        });
                                    }
                                } catch (_e) {
                                    console.warn(`Could not embed image for territory ${t.numero}`);
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
        const blob = new Blob([finalPdf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `S12_Tarjetas_${Date.now()}.pdf`;
        a.click();

        showNotification("PDF de Tarjetas S-12 generado", "success");
    } catch (e) {
        console.error("Error generating S-12:", e);
        showNotification(`Hubo un error al generar el PDF S-12: ${e.message}`, "error");
    }
};

export const generateS13Report = async (history, from, to, options = { download: true }) => {
    showNotification("Generando Registro S-13...", "info");

    try {
        const outDoc = await PDFDocument.create();
        const templateBytes = await fetchPdf("/S-13_S.pdf");

        // Filter history by date and SUCCESS status
        const filtered = history.filter((h) => {
            const rawDate = h.fecha_entrega || h.fecha || h.fecha_asignacion || h.timestamp;
            if (!rawDate) return false;

            const recordDate = UIHelpers.parseFirebaseDate(rawDate);
            if (!recordDate) return false;

            const dateStr = UIHelpers.formatDateId(recordDate);
            const isSuccess = h.estado === "Completado" || h.estado === "Predicado" || h.estado === "Terminado";

            return isSuccess && dateStr >= from && dateStr <= to;
        });

        // 1. DATA PREPARATION: Group by territory and sort
        const grouped = filtered.reduce((acc, h) => {
            const num = String(h.numero);
            if (!acc[num]) acc[num] = [];
            acc[num].push(h);
            return acc;
        }, {});

        const sortedNums = Object.keys(grouped).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        // 2. CHUNK CALCULATION: How many series of 4 assignments do we need?
        const maxChunks = sortedNums.reduce((max, num) => {
            const count = grouped[num].length;
            const chunks = Math.ceil(count / 4);
            return Math.max(max, chunks);
        }, 1);

        if (sortedNums.length === 0) {
            // Empty template if no data
            const pageDoc = await PDFDocument.load(templateBytes);
            const asigYearField = pageDoc.getForm().getTextField("Año de servicio");
            if (asigYearField) asigYearField.setText(new Date().getFullYear().toString());
            pageDoc.getForm().flatten();
            const [copiedPage] = await outDoc.copyPages(pageDoc, [0]);
            outDoc.addPage(copiedPage);
        } else {
            // 3. MATRIX PAGINATION: Outer Loop = Chunks (Series of 4 assignments)
            for (let chunkIdx = 0; chunkIdx < maxChunks; chunkIdx++) {
                // 4. RANGE PAGINATION: Middle Loop = Ranges of 20 territories
                for (let rangeStart = 0; rangeStart < sortedNums.length; rangeStart += 20) {
                    const pageDoc = await PDFDocument.load(templateBytes);
                    const form = pageDoc.getForm();

                    // Set service year
                    const asigYearField = form.getTextField("Año de servicio");
                    if (asigYearField) {
                        asigYearField.setText(new Date().getFullYear().toString());
                        try {
                            asigYearField.setAlignment(TextAlignment.Center);
                        } catch (_e) {}
                    }

                    // 5. ROW PAGINATION: Inner Loop = Fill 20 rows per page
                    for (let r = 0; r < 20; r++) {
                        const terrIdx = rangeStart + r;
                        if (terrIdx >= sortedNums.length) break;

                        const num = sortedNums[terrIdx];
                        const rowPos = r + 1;
                        const allRecords = grouped[num].sort(
                            (a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion),
                        );

                        // Get records for THIS specific chunk series
                        const chunkRecords = allRecords.slice(chunkIdx * 4, chunkIdx * 4 + 4);
                        if (chunkRecords.length === 0 && chunkIdx > 0) {
                            // Optionally skip territory if it has nothing in this series (except the first series)
                            // But usually we print the number anyway for consistency in the sheet
                        }

                        // Territory Number (Centered)
                        const numField = form.getTextField(`Núm de terrRow${rowPos}`);
                        if (numField) {
                            numField.setText(num);
                            numField.setFontSize(9);
                            try {
                                numField.setAlignment(TextAlignment.Center);
                            } catch (_e) {}
                        }

                        // Last Completed: Specifically the last delivery in THIS chunk series
                        const lastCompletedField = form.getTextField(`Última fecha en que se completóRow${rowPos}`);
                        if (lastCompletedField && chunkRecords.length > 0) {
                            const lastDelInChunk = chunkRecords[chunkRecords.length - 1].fecha_entrega;
                            if (lastDelInChunk) {
                                lastCompletedField.setText(new Date(lastDelInChunk).toLocaleDateString());
                                lastCompletedField.setFontSize(9);
                                try {
                                    lastCompletedField.setAlignment(TextAlignment.Center);
                                } catch (_e) {}
                            }
                        }

                        const colMap = [
                            { name: 1, out: 5, in: 6 },
                            { name: 2, out: 7, in: 8 },
                            { name: 3, out: 9, in: 10 },
                            { name: 4, out: 11, in: 12 },
                        ];

                        chunkRecords.forEach((rec, i) => {
                            const m = colMap[i];

                            const fName = form.getTextField(`Texto${m.name}.${r}`);
                            if (fName) {
                                fName.setText(rec.conductor || "");
                                fName.setFontSize(9);
                                try {
                                    fName.setAlignment(TextAlignment.Center);
                                } catch (_e) {}
                            }

                            const fOut = form.getTextField(`Texto${m.out}.${r}`);
                            if (fOut && rec.fecha_asignacion) {
                                fOut.setText(new Date(rec.fecha_asignacion).toLocaleDateString());
                                fOut.setFontSize(9);
                                try {
                                    fOut.setAlignment(TextAlignment.Center);
                                } catch (_e) {}
                            }

                            const fIn = form.getTextField(`Texto${m.in}.${r}`);
                            if (fIn && rec.fecha_entrega) {
                                fIn.setText(new Date(rec.fecha_entrega).toLocaleDateString());
                                fIn.setFontSize(9);
                                try {
                                    fIn.setAlignment(TextAlignment.Center);
                                } catch (_e) {}
                            }
                        });
                    }

                    form.flatten();
                    const [copiedPage] = await outDoc.copyPages(pageDoc, [0]);
                    outDoc.addPage(copiedPage);
                }
            }
        }

        const finalPdfBytes = await outDoc.save();
        const blob = new Blob([finalPdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        if (options.download) {
            const a = document.createElement("a");
            a.href = url;
            a.download = `S13_Registro_${Date.now()}.pdf`;
            a.click();
            showNotification("Registro S-13 generado", "success");
        }

        return { blob, url };
    } catch (e) {
        console.error("Error generating S-13:", e);
        showNotification(`Hubo un error al generar el S-13: ${e.message}`, "error");
        return null;
    }
};
