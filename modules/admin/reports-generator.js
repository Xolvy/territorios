import { jsPDF } from 'jspdf';
import { showNotification } from '../utils/helpers.js';
import { UIHelpers } from '../services/ui-helpers.js';

export const generateS12Report = (territories, layout = 1) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    showNotification("Generando Tarjetas S-12...", "info");

    const drawCard = async (x, y, w, h, t) => {
        // Main Border (Professional card look)
        doc.setDrawColor(30);
        doc.setLineWidth(0.4);
        doc.rect(x, y, w, h);

        // Header Section
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, w, 15, 'F');
        doc.setDrawColor(200);
        doc.line(x, y + 15, x + w, y + 15);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(40);
        doc.text("TARJETA DEL MAPA DEL TERRITORIO", x + w / 2, y + 9, { align: "center" });

        // Fields (Compact info)
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("LOCALIDAD:", x + 8, y + 25);
        doc.setFont("helvetica", "normal");
        doc.text(t.localidad || t.nombre || '—', x + 30, y + 25);

        doc.setFont("helvetica", "bold");
        doc.text("TERR. NÚM.", x + w - 35, y + 25);
        doc.setFontSize(14);
        doc.text(t.numero || '—', x + w - 12, y + 25, { align: "right" });

        // Map Area (Enhanced placeholder)
        const mapY = y + 30;
        const mapH = h - 65;
        doc.setDrawColor(220);
        doc.setLineWidth(0.1);
        doc.rect(x + 5, mapY, w - 10, mapH);

        // Try to add image if exists
        if (t.mapa_url) {
            try {
                const imgData = await loadImage(t.mapa_url);
                doc.addImage(imgData, 'JPEG', x + 5, mapY, w - 10, mapH, undefined, 'FAST');
            } catch (e) {
                console.warn("Could not load map image for territory " + t.numero, e);
            }
        }

        // Subtle grid for the map area (only if no image)
        if (!t.mapa_url) {
            doc.setDrawColor(245);
            for (let gi = 10; gi < (w - 10); gi += 10) doc.line(x + 5 + gi, mapY, x + 5 + gi, mapY + mapH);
            for (let gj = 10; gj < mapH; gj += 10) doc.line(x + 5, mapY + gj, x + 5 + w - 10, mapY + gj);

            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(180);
            doc.text("(Pegue el mapa de Google Maps aquí o dibuje el croquis del territorio)", x + w / 2, mapY + mapH / 2, { align: "center" });
        }

        // Footer block (Official note)
        doc.setTextColor(60);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const footerText = "Nota: Por favor, mantenga esta tarjeta en buenas condiciones. Al completar el territorio en su totalidad, devuélvala al responsable de territorios.";
        const lines = doc.splitTextToSize(footerText, w - 15);
        doc.text(lines, x + 8, y + h - 15);

        doc.setFontSize(8);
        doc.text("S-12-S", x + 8, y + h - 5);
        doc.text(`Doc. Generado: ${new Date().toLocaleDateString()}`, x + w - 8, y + h - 5, { align: "right" });
    };

    const loadImage = (url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/jpeg", 0.8));
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = url;
        });
    };

    let count = 0;
    const padding = 10;

    (async () => {
        for (let i = 0; i < territories.length; i++) {
            const t = territories[i];
            if (layout === 1) {
                if (i > 0) doc.addPage();
                await drawCard(padding, padding, pageWidth - padding * 2, pageHeight - padding * 2, t);
            } else if (layout === 2) {
                const cardH = (pageHeight - padding * 3) / 2;
                const y = padding + (count % 2) * (cardH + padding);
                await drawCard(padding, y, pageWidth - padding * 2, cardH, t);
                count++;
                if (count % 2 === 0 && i < territories.length - 1) doc.addPage();
            } else if (layout === 4) {
                const cardW = (pageWidth - padding * 3) / 2;
                const cardH = (pageHeight - padding * 3) / 2;
                const x = padding + (count % 2) * (cardW + padding);
                const y = padding + Math.floor((count % 4) / 2) * (cardH + padding);
                await drawCard(x, y, cardW, cardH, t);
                count++;
                if (count % 4 === 0 && i < territories.length - 1) {
                    doc.addPage();
                    count = 0;
                }
            }
        }
        doc.save(`S12_Tarjetas_${new Date().getTime()}.pdf`);
        showNotification("PDF de Tarjetas S-12 generado", "success");
    })();
};

export const generateS13Report = (history, from, to) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    showNotification("Generando Registro S-13...", "info");

    // Filter history by date and SUCCESS status
    const filtered = history.filter(h => {
        const rawDate = h.fecha_entrega || h.timestamp;
        if (!rawDate) return false;

        // Xolvy Shield: Normalize Firestore Timestamp or ISO string to YYYY-MM-DD for safe comparison
        const date = UIHelpers.formatDateId(rawDate);

        // Only include completed records in official S-13 (exclude overlapped/absorbed)
        const isSuccess = h.estado === 'Completado' || h.estado === 'Predicado';
        return isSuccess && date >= from && date <= to;
    });

    // Group by territory so we don't repeat the same territory number on multiple rows if unnecessary
    // Wait, the official S-13 has one row per territory and 4 columns for assignments.
    // Let's group by territory number.
    const grouped = filtered.reduce((acc, h) => {
        const num = String(h.numero);
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
