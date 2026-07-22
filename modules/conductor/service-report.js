/**
 * Módulo de Informe de Servicio Teocrático Mensual
 * (Código preparado internamente para seguimiento teocrático de horas y metas)
 */

export const GOALS = {
    PUBLICADOR: { horas: 10, label: "Publicador" },
    PRECURSOR_AUXILIAR: { horas: 30, label: "Precursor Auxiliar" },
    PRECURSOR_REGULAR: { horas: 50, label: "Precursor Regular" },
};

export class ServiceReportService {
    static getStorageKey(userName, year, month) {
        const safeName = String(userName || "usuario").toLowerCase().replace(/\s+/g, "_");
        return `xolvy_service_report_${safeName}_${year}_${month}`;
    }

    static getMonthlyReport(userName, year, month) {
        const key = this.getStorageKey(userName, year, month);
        const data = localStorage.getItem(key);
        if (data) {
            try { return JSON.parse(data); } catch (_e) {}
        }
        return {
            year,
            month,
            horas: 0,
            minutos: 0,
            revisitas: 0,
            estudios: 0,
            notas: "",
            enviado: false,
        };
    }

    static saveMonthlyReport(userName, year, month, reportData) {
        const key = this.getStorageKey(userName, year, month);
        localStorage.setItem(key, JSON.stringify({
            ...reportData,
            updatedAt: new Date().toISOString()
        }));
    }

    static calculateTheocraticYearSummary(userName, startYear) {
        // Año teocrático: Septiembre (mes 9) de startYear a Agosto (mes 8) de startYear + 1
        let totalHoras = 0;
        let totalRevisitas = 0;
        let totalEstudios = 0;

        for (let m = 9; m <= 12; m++) {
            const rep = this.getMonthlyReport(userName, startYear, m);
            totalHoras += Number(rep.horas || 0) + (Number(rep.minutos || 0) / 60);
            totalRevisitas += Number(rep.revisitas || 0);
            totalEstudios = Math.max(totalEstudios, Number(rep.estudios || 0));
        }
        for (let m = 1; m <= 8; m++) {
            const rep = this.getMonthlyReport(userName, startYear + 1, m);
            totalHoras += Number(rep.horas || 0) + (Number(rep.minutos || 0) / 60);
            totalRevisitas += Number(rep.revisitas || 0);
            totalEstudios = Math.max(totalEstudios, Number(rep.estudios || 0));
        }

        return {
            yearLabel: `Año Teocrático ${startYear}-${startYear + 1}`,
            totalHoras: Math.round(totalHoras * 10) / 10,
            totalRevisitas,
            maxEstudios: totalEstudios,
        };
    }
}

window.ServiceReportService = ServiceReportService;
