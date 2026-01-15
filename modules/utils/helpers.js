export const formatPhoneNumber = (numero) => {
    if (!numero) return '';
    const cleaned = numero.toString().replace(/\D/g, '');
    return cleaned.length === 7 ? `${cleaned.slice(0, 3)} ${cleaned.slice(3)}` : numero;
};

export const getStatusColor = (status) => {
    const s = status || 'Sin asignar'; // Default fallback
    if (s === 'Contestaron') return 'text-green-600 dark:text-green-400';
    if (s === 'No contestan') return 'text-orange-600 dark:text-orange-400';
    if (s === 'No llamar') return 'text-red-600 dark:text-red-400';
    if (s === 'Colgaron') return 'text-gray-600 dark:text-gray-400';
    if (s === 'Revisita') return 'text-yellow-600 dark:text-yellow-400';
    if (s === 'Suspendido') return 'text-orange-700 dark:text-orange-500';
    if (s === 'Testigo') return 'text-purple-600 dark:text-purple-400';
    if (s === 'Asignado') return 'text-teal-600 dark:text-teal-400';
    if (s === 'Pendiente' || s === 'Sin asignar') return 'text-gray-500 dark:text-gray-500';
    return 'text-gray-500';
};

export const showNotification = (message, type = 'success') => {
    let banner = document.getElementById('app-notification-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'app-notification-banner';
        banner.className = 'fixed top-6 left-0 right-0 mx-auto w-max max-w-[calc(100vw-2rem)] z-[10000] transition-all duration-700 transform -translate-y-32 opacity-0 pointer-events-none scale-90';
        banner.innerHTML = `
            <div class="glass-morphism bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl px-6 py-4 sm:px-8 sm:py-5 rounded-[2.5rem] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.3)] border border-white/40 dark:border-white/10 flex items-center gap-4 sm:gap-6 min-w-[280px] sm:min-w-[340px] pointer-events-auto">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl icon-container shadow-inner border border-white/20">🔔</div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-black text-[10px] uppercase tracking-[0.2em] title mb-1">Notificación</h4>
                    <p class="text-xs font-bold text-slate-600 dark:text-slate-300 message truncate"></p>
                </div>
                <button onclick="this.closest('#app-notification-banner').classList.add('-translate-y-32', 'opacity-0', 'scale-90')" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 transition-colors">✕</button>
            </div>
        `;
        document.body.appendChild(banner);
    }
    const content = banner.querySelector('.message');
    content.textContent = message;

    const icon = banner.querySelector('.icon-container');
    const title = banner.querySelector('.title');

    if (type === 'error') {
        icon.textContent = '❌';
        icon.className = 'w-12 h-12 bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center text-2xl icon-container shadow-inner border border-rose-500/20';
        title.className = 'font-black text-[10px] uppercase tracking-[0.2em] text-rose-500 title mb-1';
        title.textContent = 'Error de Sistema';
    } else if (type === 'warning') {
        icon.textContent = '⚠️';
        icon.className = 'w-12 h-12 bg-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center text-2xl icon-container shadow-inner border border-amber-500/20';
        title.className = 'font-black text-[10px] uppercase tracking-[0.2em] text-amber-600 title mb-1';
        title.textContent = 'Atención';
    } else if (type === 'info') {
        icon.textContent = 'ℹ️';
        icon.className = 'w-12 h-12 bg-blue-500/20 text-blue-500 rounded-2xl flex items-center justify-center text-2xl icon-container shadow-inner border border-blue-500/20';
        title.className = 'font-black text-[10px] uppercase tracking-[0.2em] text-blue-600 title mb-1';
        title.textContent = 'Información';
    } else {
        icon.textContent = '✨';
        icon.className = 'w-12 h-12 bg-teal-500/20 text-teal-500 rounded-2xl flex items-center justify-center text-2xl icon-container shadow-inner border border-teal-500/20';
        title.className = 'font-black text-[10px] uppercase tracking-[0.2em] text-teal-600 title mb-1';
        title.textContent = 'Éxito';
    }

    requestAnimationFrame(() => banner.classList.remove('-translate-y-32', 'opacity-0', 'scale-90'));

    // Clear previous timeout if exists
    if (banner.dataset.timeoutId) clearTimeout(parseInt(banner.dataset.timeoutId));

    const tid = setTimeout(() => banner.classList.add('-translate-y-32', 'opacity-0', 'scale-90'), 5000);
    banner.dataset.timeoutId = tid;
};

export const formatMapUrl = (url) => {
    if (!url) return '';
    // Handle Google Drive
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/uc?export=view&id=${match[1]}`;
        }
    }
    return url;
};

/**
 * Generates a simple Excel-compatible XLS (XML) file from an array of objects
 */
export const generatePlainXLS = (data, fileName) => {
    if (!data || data.length === 0) return;

    // Headers
    const headers = Object.keys(data[0]);

    // Create XML structure for Excel (SpreadsheetML)
    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="sHeader">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0D9488" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Reporte">
  <Table>`;

    // Header Row
    xml += '<Row ss:StyleID="sHeader">';
    headers.forEach(h => {
        xml += `<Cell><Data ss:Type="String">${h}</Data></Cell>`;
    });
    xml += '</Row>';

    // Data Rows
    data.forEach(item => {
        xml += '<Row>';
        headers.forEach(h => {
            const val = item[h] || '';
            xml += `<Cell><Data ss:Type="String">${val}</Data></Cell>`;
        });
        xml += '</Row>';
    });

    xml += `  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Checks if the browser is online and shows a notification if not.
 * @returns {boolean} True if online, false otherwise.
 */
export const ensureOnline = () => {
    if (!navigator.onLine) {
        showNotification("⚠️ Acción no disponible sin conexión a Internet.", "warning");
        return false;
    }
    return true;
};
