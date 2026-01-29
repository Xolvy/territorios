import { getTerritorios, getHistorialReport } from '../data/firestore-services.js?v=2.4.0.7';
import { showNotification } from './utils/helpers.js?v=2.4.0.7';

export const renderS12CommandCenter = async (container) => {
    const territorios = await getTerritorios();
    const historial = await getHistorialReport();

    territorios.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

    container.innerHTML = `
        <div class="space-y-8">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="modern-card p-6 bg-emerald-500/5 border-emerald-500/20">
                    <h4 class="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-2">Total Territorios</h4>
                    <p class="text-3xl font-black text-slate-800 dark:text-white">${territorios.length}</p>
                </div>
                <div class="modern-card p-6 bg-blue-500/5 border-blue-500/20">
                    <h4 class="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-2">Asignados</h4>
                    <p class="text-3xl font-black text-slate-800 dark:text-white">${territorios.filter(t => t.estado === 'Asignado').length}</p>
                </div>
                <div class="modern-card p-6 bg-amber-500/5 border-amber-500/20">
                    <h4 class="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-2">Disponibles</h4>
                    <p class="text-3xl font-black text-slate-800 dark:text-white">${territorios.filter(t => t.estado === 'Disponible' || t.estado === 'Sin asignar').length}</p>
                </div>
            </div>

            <div class="flex justify-between items-center bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                <div>
                    <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase">Generar Reporte PDF S-12</h4>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Documento oficial para el tablero</p>
                </div>
                <button id="btn-generate-s12-pdf" class="bg-primary hover:bg-primary-light text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-3">
                    <i class="fas fa-file-pdf"></i> Descargar PDF
                </button>
            </div>

            <div class="modern-card !p-0 overflow-hidden border-slate-100 dark:border-white/5 shadow-2xl bg-white dark:bg-slate-900" id="s12-preview-container">
                <div class="p-10" id="s12-pdf-body">
                    <header class="text-center mb-10 pb-10 border-b-2 border-slate-100">
                        <h2 class="text-2xl font-black uppercase tracking-tighter text-slate-900">Registro de Territorios de la Congregación</h2>
                        <p class="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] mt-2">Formulario S-12</p>
                    </header>
                    
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
                                <th class="p-4">Nº</th>
                                <th class="p-4">Nombre / Ubicación</th>
                                <th class="p-4">Última Predicación</th>
                                <th class="p-4">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${territorios.map(t => {
        const lastDate = t.ultima_fecha ? new Date(t.ultima_fecha).toLocaleDateString() : '—';
        return `
                                    <tr class="border-b border-slate-100 text-xs font-bold text-slate-700">
                                        <td class="p-4 font-black text-primary">${t.numero}</td>
                                        <td class="p-4 uppercase">${t.nombre || '—'}</td>
                                        <td class="p-4">${lastDate}</td>
                                        <td class="p-4"><span class="px-2 py-0.5 rounded text-[9px] uppercase ${t.estado === 'Asignado' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}">${t.estado || 'Disponible'}</span></td>
                                    </tr>
                                `;
    }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    container.querySelector('#btn-generate-s12-pdf').onclick = () => {
        const element = document.getElementById('s12-pdf-body');
        const { jsPDF } = window.jspdf;
        showNotification("Generando PDF S-12...", "info");

        html2canvas(element, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
        }).then(canvas => {
            const doc = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            // Handle pagination if needed
            let heightLeft = pdfHeight;
            let position = 0;
            const pageHeight = 295;

            doc.addImage(imgData, 'PNG', 5, position + 5, pdfWidth - 10, pdfHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 5, position + 5, pdfWidth - 10, pdfHeight);
                heightLeft -= pageHeight;
            }

            doc.save(`S12_Registro_Territorios_${new Date().toISOString().split('T')[0]}.pdf`);
            showNotification("Reporte S-12 generado", "success");
        });
    };
};
