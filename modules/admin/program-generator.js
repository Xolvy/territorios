import { showNotification } from '../utils/helpers.js';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * DEPRECADO: La exportación PNG por captura de DOM fue eliminada
 * porque causaba WSoD y dependía de html2canvas.
 * El usuario debe usar exportarProgramaExcel() para mantener la calidad institucional.
 */
export const generateProgramPNG = async (_programa, _isConductores = true) => {
    showNotification(
        '📊 La exportación PNG ha sido reemplazada. Usa el botón "Exportar Excel" para obtener el reporte de alta calidad.',
        'info',
        5000
    );
    return null;
};

export const downloadImage = (_dataUrl, _isConductores, _startDay) => {
    showNotification(
        '📊 Usa la exportación Excel para descargar el programa.',
        'info',
        4000
    );
};

export const shareProgram = async (programa) => {
    await generateProgramPNG(programa, true);
};


export const generateProgramPDF = async (programa, isConductores = true) => {
    showNotification("Generando PDF oficial...", "info");
    try {
        const templateUrl = isConductores ? '/p_conductores_clean.pdf' : '/p_publicadores_clean.pdf';
        const coordsUrl = isConductores ? '/cond_coords.json' : '/pub_coords.json';

        const [templateBytes] = await Promise.all([
            fetch(templateUrl).then(res => res.arrayBuffer()),
            fetch(coordsUrl).then(res => res.json())
        ]);

        const pdfDoc = await PDFDocument.load(templateBytes);
        const page = pdfDoc.getPages()[0];
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const { width, height } = page.getSize();

        // Transform coordinates (assuming 0-50 logic from JSON)
        // From observation: X=50 is roughly the right margin, Y=25 is bottom.
        // We'll map X to 0-50 range of width, Y to 0-25 range of height (flipped)
        const mapX = (x) => (x / 50) * width;
        const mapY = (y) => height - (y / 26) * height; // Adjusted 26 to fit top margin

        // Draw header info if possible
        const startDayStr = programa.dias[0]?.fecha || '';
        const endDayStr = programa.dias[6]?.fecha || '';
        const rangeText = `${new Date(startDayStr).toLocaleDateString()} AL ${new Date(endDayStr).toLocaleDateString()}`;

        // Draw week range near top (estimate pos)
        page.drawText(rangeText, { x: mapX(20), y: mapY(1), size: 10, font });

        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const xOffsets = [5.9, 12.1, 18.1, 25.0, 31.3, 37.7, 44.2];
        const shiftY = {
            manana: [3.6, 4.4, 5.3, 6.1, 7.3, 8.4],
            tarde: [15.6, 16.4, 17.3, 18.1, 19.3, 20.4],
            zoom: [21.6, 22.4, 23.3, 24.1]
        };

        days.forEach((dayName, idx) => {
            const dia = programa.dias.find(d => d.nombre === dayName);
            if (!dia) return;

            const x = xOffsets[idx];

            // Draw day date
            const dStr = dia.fecha ? dia.fecha.split('-')[2] : '';
            page.drawText(`${dayName.toUpperCase()} ${dStr}`, { x: mapX(x - 1), y: mapY(2.6), size: 8, font });

            ['manana', 'tarde', 'zoom'].forEach(shift => {
                const sData = dia[shift];
                if (!sData || (!sData.lugar && !sData.conductor)) return;

                const ys = shiftY[shift];
                if (!ys) return;

                const draw = (txt, yIdx, size = 7) => {
                    if (!txt || txt === '—') return;
                    page.drawText(String(txt).toUpperCase(), { x: mapX(x - 2), y: mapY(ys[yIdx]), size, font, maxWidth: mapX(5) });
                };

                draw(sData.lugar, 0, 6);
                draw(sData.hora, 1, 7);
                draw(sData.conductor, 2, 7);
                if (isConductores) draw(sData.auxiliar, 3, 6);
                draw(sData.faceta, 4, 6);
                draw(sData.territorio || sData.grupos, 5, 7);
            });
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Programa_${isConductores ? 'Conductores' : 'Publicadores'}.pdf`;
        a.click();
        showNotification("PDF generado exitosamente", "success");

    } catch (err) {
        console.error(err);
        showNotification("Error al generar PDF", "error");
    }
};


