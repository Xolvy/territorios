import { jsPDF } from 'jspdf';
import { showNotification } from '../utils/helpers.js';

export const generateS12Report = (territories, layout = 1) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    showNotification("Generando Tarjetas S-12...", "info");

    const drawCard = (x, y, w, h, t) => {
        // Draw Border
        doc.setDrawColor(200);
        doc.setLineWidth(0.1);
        doc.rect(x, y, w, h);

        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Tarjeta del mapa del territorio", x + w / 2, y + 10, { align: "center" });

        // Fields
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Localidad:", x + 5, y + 20);
        doc.line(x + 20, y + 20.5, x + w - 30, y + 20.5); // underscores
        doc.text("Terr. núm.", x + w - 28, y + 20);
        doc.line(x + w - 12, y + 20.5, x + w - 5, y + 20.5);

        // Data
        doc.setFont("helvetica", "bold");
        doc.text(t.localidad || t.nombre || '', x + 22, y + 20);
        doc.text(t.numero || '', x + w - 11, y + 20);

        // Map Area placeholder text
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text("(Pegue el mapa arriba o dibuje el territorio)", x + w / 2, y + h - 15, { align: "center" });

        // Footer block
        doc.setTextColor(0);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        const footerText = "Sírvase mantener esta tarjeta en el sobre. No la manche, marque, ni doble. Cada vez que se haya trabajado completamente el territorio, infórmelo al hermano que atiende los archivos del territorio.";
        const lines = doc.splitTextToSize(footerText, w - 10);
        doc.text(lines, x + 5, y + h - 10);

        doc.text("S-12-S", x + 5, y + h - 2);
    };

    let count = 0;
    const padding = 10;

    territories.forEach((t, i) => {
        if (layout === 1) {
            if (i > 0) doc.addPage();
            drawCard(padding, padding, pageWidth - padding * 2, pageHeight - padding * 2, t);
        } else if (layout === 2) {
            const cardH = (pageHeight - padding * 3) / 2;
            const y = padding + (count % 2) * (cardH + padding);
            drawCard(padding, y, pageWidth - padding * 2, cardH, t);
            count++;
            if (count % 2 === 0 && i < territories.length - 1) doc.addPage();
        } else if (layout === 4) {
            const cardW = (pageWidth - padding * 3) / 2;
            const cardH = (pageHeight - padding * 3) / 2;
            const x = padding + (count % 2) * (cardW + padding);
            const y = padding + Math.floor((count % 4) / 2) * (cardH + padding);
            drawCard(x, y, cardW, cardH, t);
            count++;
            if (count % 4 === 0 && i < territories.length - 1) {
                doc.addPage();
                count = 0;
            }
        }
    });

    doc.save(`S12_Tarjetas_${new Date().getTime()}.pdf`);
    showNotification("PDF de Tarjetas S-12 generado", "success");
};

export const generateS13Report = (history, from, to) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    showNotification("Generando Registro S-13...", "info");

    // Filter history by date
    const filtered = history.filter(h => {
        const date = h.fecha_entrega || h.timestamp;
        if (!date) return false;
        return date >= from && date <= to;
    });

    // Group by territory so we don't repeat the same territory number on multiple rows if unnecessary
    // Wait, the official S-13 has one row per territory and 4 columns for assignments.
    // Let's group by territory number.
    const grouped = filtered.reduce((acc, h) => {
        const num = h.numero;
        if (!acc[num]) acc[num] = [];
        acc[num].push(h);
        return acc;
    }, {});

    const sortedNums = Object.keys(grouped).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    let y = 30;
    const drawHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("REGISTRO DE ASIGNACIÓN DE TERRITORIO", pageWidth / 2, 15, { align: "center" });

        doc.setFontSize(10);
        doc.text("Año de servicio: ________", 15, 25);

        // Table Header
        doc.setFontSize(7);
        doc.rect(10, y, 10, 10); doc.text("Núm.\nde terr.", 11, y + 4);
        doc.rect(20, y, 20, 10); doc.text("Última fecha\nen que se\ncompletó*", 21, y + 3);

        // 4 Columns for assignments
        for (let i = 0; i < 4; i++) {
            const x = 40 + i * 40;
            doc.rect(x, y, 40, 5); doc.text("Asignado a", x + 15, y + 3.5);
            doc.rect(x, y + 5, 20, 5); doc.text("Fecha en que\nse asignó", x + 1, y + 8.5);
            doc.rect(x + 20, y + 5, 20, 5); doc.text("Fecha en que\nse completó", x + 21, y + 8.5);
        }
        y += 10;
    };

    drawHeader();

    sortedNums.forEach(num => {
        const records = grouped[num].sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion));

        // Split into chunks of 4 for S-13 format
        for (let i = 0; i < records.length; i += 4) {
            if (y > 270) {
                doc.addPage();
                y = 30;
                drawHeader();
            }

            const chunk = records.slice(i, i + 4);
            const lastCompleted = chunk[0].ultima_fecha_completado || '—';

            doc.setFont("helvetica", "normal");
            doc.rect(10, y, 10, 8); doc.text(num, 15, y + 5, { align: "center" });
            doc.rect(20, y, 20, 8); doc.text(lastCompleted, 30, y + 5, { align: "center" });

            for (let j = 0; j < 4; j++) {
                const x = 40 + j * 40;
                const rec = chunk[j];
                doc.rect(x, y, 40, 4); // Name row
                if (rec) {
                    doc.setFontSize(6);
                    doc.text(rec.conductor || '', x + 2, y + 3);
                    doc.setFontSize(7);
                }
                doc.rect(x, y + 4, 20, 4); // Date Asig
                if (rec) doc.text(new Date(rec.fecha_asignacion).toLocaleDateString(), x + 2, y + 7);
                doc.rect(x + 20, y + 4, 20, 4); // Date Comp
                if (rec && rec.fecha_entrega) doc.text(new Date(rec.fecha_entrega).toLocaleDateString(), x + 22, y + 7);
            }
            y += 8;
        }
    });

    // Footer note
    doc.setFontSize(7);
    doc.text("*Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.", 10, 285);
    doc.text("S-13-S  1/22", 10, 292);

    doc.save(`S13_Registro_${new Date().getTime()}.pdf`);
    showNotification("Registro S-13 generado", "success");
};
