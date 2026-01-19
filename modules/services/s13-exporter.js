
export class S13Exporter {
    static formatDateShort(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    static generatePageHtml(keys, map, allHistory, reportStartDate, assignOffset, limit, year, congregation) {
        const reportStartMs = new Date(reportStartDate).getTime();
        let rowsHtml = '';
        const ROWS_PER_PAGE = 20;

        for (let r = 0; r < ROWS_PER_PAGE; r++) {
            const key = keys[r];
            const assignments = key ? map.get(key) : [];

            // Sort: Date Ascending
            assignments.sort((a, b) => new Date(a.fecha_asignacion) - new Date(b.fecha_asignacion));

            let lastCompletionDate = '';
            let foundPrevious = false;

            if (assignOffset > 0 && assignments[assignOffset - 1]) {
                const prevAssign = assignments[assignOffset - 1];
                if (prevAssign.fecha_entrega) {
                    lastCompletionDate = this.formatDateShort(prevAssign.fecha_entrega);
                }
                foundPrevious = true;
            }

            if (!foundPrevious && key) {
                const previousCompletions = allHistory
                    .filter(h => {
                        if (!h.numero || !h.fecha_entrega) return false;
                        const hNums = h.numero.toString().split(/[,/]/).map(n => n.trim().padStart(2, '0'));
                        return hNums.includes(key) && new Date(h.fecha_entrega).getTime() < reportStartMs;
                    })
                    .sort((a, b) => new Date(b.fecha_entrega).getTime() - new Date(a.fecha_entrega).getTime());

                if (previousCompletions.length > 0) {
                    lastCompletionDate = this.formatDateShort(previousCompletions[0].fecha_entrega);
                }
            }

            const slice = assignments.slice(assignOffset, assignOffset + limit);
            let colsHtml = '';
            for (let c = 0; c < 4; c++) {
                const assign = slice[c];
                if (assign) {
                    const assignedDate = this.formatDateShort(assign.fecha_asignacion);
                    const returnedDate = this.formatDateShort(assign.fecha_entrega);

                    colsHtml += `
                        <td class="border border-black p-0 align-top w-[38mm]">
                            <div class="flex flex-col h-[10mm]">
                                <div class="h-[50%] w-full flex items-end justify-center border-b border-black">
                                    <span class="text-[8.5px] font-bold text-gray-900 truncate px-1 leading-tight pb-0.5 w-full text-center font-roboto">
                                        ${assign.conductor || '-'}
                                    </span>
                                </div>
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
                    colsHtml += `<td class="border border-black p-0 w-[38mm]"><div class="h-[10mm]"></div></td>`;
                }
            }

            rowsHtml += `
                <tr class="h-[10mm]">
                    <td class="border border-black text-center font-bold text-sm bg-white w-[12mm]">${key || ''}</td>
                    <td class="border border-black bg-white w-[25mm] text-center text-[8.5px] font-bold">${lastCompletionDate}</td>
                    ${colsHtml}
                </tr>
            `;
        }

        return `
            <div class="s13-page bg-white text-black w-[210mm] h-[297mm] p-[10mm] mx-auto flex flex-col mb-10 shrink-0 font-sans box-border relative overflow-hidden">
                <div class="text-center mb-1">
                    <h1 class="text-2xl font-bold uppercase tracking-wider" style="font-family: 'Arial', sans-serif;">Registro de Asignación de Territorio</h1>
                </div>
                <div class="flex items-end gap-1 mb-2 px-1">
                    <span class="font-bold text-sm uppercase tracking-tight mb-1">Año de servicio:</span>
                    <div class="border-b border-black px-4 text-xl font-bold leading-none pb-0.5 min-w-[30mm] text-center">
                        &nbsp;&nbsp;&nbsp;${year}&nbsp;&nbsp;&nbsp;
                    </div>
                </div>
                <div class="w-full flex-1 border-t-2 border-l-2 border-r-2 border-b-2 border-black">
                    <table class="w-full border-collapse border-hidden table-fixed">
                        <colgroup>
                            <col style="width: 12mm;">
                            <col style="width: 25mm;">
                            <col style="width: 38mm;">
                            <col style="width: 38mm;">
                            <col style="width: 38mm;">
                            <col style="width: 38mm;">
                        </colgroup>
                        <thead>
                            <tr class="bg-gray-100/50 text-[6.5px] font-black text-center uppercase tracking-tighter h-[11mm] leading-[1.1]">
                                <td class="border border-black p-0.5 align-middle w-[10mm]">Núm.<br> de terr.</td>
                                <td class="border border-black p-0.5 align-middle leading-tight w-[20mm]">Última fecha<br> en que se<br> completó*</td>
                                ${Array(4).fill(0).map(() => `
                                    <td class="border border-black p-0 align-top">
                                        <div class="flex flex-col h-full">
                                            <div class="border-b border-black py-1 bg-gray-200">Asignado a</div>
                                            <div class="flex flex-1 h-full">
                                                <div class="w-1/2 border-r border-black flex items-center justify-center bg-gray-50/30 px-0.5 leading-[1] py-1 h-full text-[6px]">
                                                    Fecha en que<br> se asignó
                                                </div>
                                                <div class="w-1/2 flex items-center justify-center bg-gray-50/30 px-0.5 leading-[1] py-1 h-full text-[6px]">
                                                    Fecha en que<br> se completó
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
                </div>
                <div class="mt-1 text-[8.5px] font-medium pl-1 text-black">
                    *Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.
                </div>
                <div class="mt-6 flex justify-between items-end px-1">
                     <div class="text-[9px] font-bold text-gray-900">S-13-S 1/22</div>
                     <div class="text-[8px] font-bold text-gray-400 uppercase tracking-widest">${congregation}</div>
                </div>
            </div>
        `;
    }
}
