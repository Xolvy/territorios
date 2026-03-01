import html2canvas from 'html2canvas';
import { showNotification } from '../utils/helpers.js';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * Generates an image (PNG) of the weekly program.
 */
export const generateProgramPNG = async (programa, isConductores = true) => {
    try {
        showNotification(`Generando vista previa...`, 'info', 1000);

        // 1. Create a hidden rendering container
        const renderDiv = document.createElement('div');
        renderDiv.style.position = 'fixed';
        renderDiv.style.left = '-9999px';
        renderDiv.style.top = '0';
        renderDiv.style.width = '1200px';
        renderDiv.style.background = '#fff';
        renderDiv.style.padding = '40px';
        renderDiv.style.fontFamily = "'Outfit', sans-serif";
        document.body.appendChild(renderDiv);

        const startDay = programa.dias[0]?.fecha || '—';
        const endDay = programa.dias[6]?.fecha || '—';
        const dateStr = `${startDay.split('-').reverse().join('/')} AL ${endDay.split('-').reverse().join('/')}`;

        // Build HTML
        renderDiv.innerHTML = `
            <div style="border: 4px solid #000; padding: 20px; background: #fff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 900; text-transform: uppercase; color: #1e293b;">Programa de Predicación Semanal</h1>
                    <p style="margin: 5px 0 0; font-size: 14px; font-weight: 700; color: #64748b; letter-spacing: 2px;">SEMANA DEL ${dateStr}</p>
                    <p style="margin: 2px 0 0; font-size: 10px; font-weight: 900; color: #0d9488; text-transform: uppercase; letter-spacing: 1px;">MODO ${isConductores ? 'CONDUCTORES' : 'PUBLICADORES'}</p>
                </div>

                <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; border-top: 2px solid #e2e8f0; pt: 20px;">
                    ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(dayName => {
            const diaData = (programa.dias || []).find(d => d.nombre === dayName);
            const dOnly = diaData?.fecha ? diaData.fecha.split('-')[2] : '—';
            return `
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <div style="background: #1e293b; color: #fff; padding: 8px; text-align: center; border-radius: 8px;">
                                    <div style="font-size: 10px; font-weight: 400; text-transform: uppercase; opacity: 0.8;">${dayName}</div>
                                    <div style="font-size: 18px; font-weight: 900;">${dOnly}</div>
                                </div>

                                ${['manana', 'tarde', 'noche'].map(turno => {
                const tData = diaData ? diaData[turno] || {} : {};
                if (!tData.lugar && !tData.hora && !tData.conductor) return '<div style="height: 120px; border: 1px dashed #e2e8f0; border-radius: 8px;"></div>';
                return `
                                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; height: 140px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;">
                                            <div>
                                                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">${turno === 'manana' ? 'Mañana' : turno === 'tarde' ? 'Tarde' : 'Noche'}</div>
                                                <div style="font-size: 9px; font-weight: 900; color: #0d9488; margin-top: 2px; line-height: 1;">${String(tData.lugar || '—').toUpperCase()}</div>
                                                <div style="font-size: 11px; font-weight: 900; color: #000; margin-top: 2px;">${tData.hora || '—'}</div>
                                            </div>
                                            <div style="margin-top: 5px;">
                                                <div style="font-size: 10px; font-weight: 900; color: #1e293b; border-top: 1px solid #cbd5e1; pt: 4px; line-height: 1.1;">${String(tData.conductor || '—').toUpperCase()}</div>
                                                ${isConductores && tData.auxiliar ? `<div style="font-size: 8px; font-weight: 700; color: #64748b;">${String(tData.auxiliar).toUpperCase()}</div>` : ''}
                                                <div style="font-size: 8px; font-weight: 700; color: #334155; margin-top: 2px; font-style: italic;">${tData.faceta || '—'}</div>
                                            </div>
                                            <div style="font-size: 9px; font-weight: 900; color: #2563eb; margin-top: auto; border-top: 1px solid #e2e8f0; pt: 2px; text-align: right;">
                                                ${tData.territorio || tData.grupos || '—'}
                                            </div>
                                        </div>
                                    `;
            }).join('')}
                            </div>
                        `;
        }).join('')}
                </div>
                
                <div style="margin-top: 20px; border-top: 2px solid #1e293b; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">Generado por Xolvy Conductores</div>
                    <div style="font-size: 9px; font-weight: 800; color: #0d9488; text-transform: uppercase;">${new Date().toLocaleString('es-ES')}</div>
                </div>
            </div>
        `;

        const canvas = await html2canvas(renderDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        document.body.removeChild(renderDiv);

        const dataUrl = canvas.toDataURL('image/png');
        return dataUrl;

    } catch (err) {
        console.error(err);
        showNotification("Error al generar imagen", "error");
        return null;
    }
};

export const downloadImage = (dataUrl, isConductores, startDay) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `Programa_${isConductores ? 'Conductores' : 'Publicadores'}_${startDay}.png`;
    link.click();
    showNotification("Imagen descargada", "success");
};

export const shareProgram = async (programa) => {
    await generateProgramPNG(programa, true, true);
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


