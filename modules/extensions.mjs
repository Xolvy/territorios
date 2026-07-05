// Extensions & Premium Libraries Shim V10
// PURGED: jsPDF y html2canvas (WSoD triggers - reemplazados por pdf-lib y ExcelJS)

import { animate } from "animejs";
import Chart from "chart.js/auto";

window.anime = animate;

import { format, formatDistance, subDays } from "date-fns";
import { es } from "date-fns/locale";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";

window.Chart = Chart;
window.XLSX = XLSX;

window.dateFns = {
    format: (date, fmt) => format(date, fmt, { locale: es }),
    formatDistance: (d1, d2) => formatDistance(d1, d2, { locale: es }),
    subDays,
};

window.Swal = Swal;

window.showPremiumAlert = (title, text, icon = "info") => {
    return Swal.fire({
        title,
        text,
        icon,
        confirmButtonColor: "#0d9488",
        background: document.documentElement.classList.contains("dark") ? "#1f2937" : "#ffffff",
        color: document.documentElement.classList.contains("dark") ? "#ffffff" : "#000000",
    });
};

console.log("✨ Premium Extensions Loaded V10 (pdf-lib + ExcelJS engine)");
