// Extensions & Premium Libraries Shim V9
import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Anime.js v4 changed from 'anime' to 'animate'
import { animate } from 'animejs';

import { format, formatDistance, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

window.Chart = Chart;
window.jspdf = { jsPDF };
window.html2canvas = html2canvas;
window.XLSX = XLSX;
// Map 'animate' to 'window.anime' for legacy code compatibility
window.anime = animate;

window.dateFns = {
    format: (date, fmt) => format(date, fmt, { locale: es }),
    formatDistance: (d1, d2) => formatDistance(d1, d2, { locale: es }),
    subDays
};

window.Swal = Swal;

window.showPremiumAlert = (title, text, icon = 'info') => {
    return Swal.fire({
        title,
        text,
        icon,
        confirmButtonColor: '#0d9488',
        background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
        color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000'
    });
};

console.log('✨ Premium Extensions Loaded');
