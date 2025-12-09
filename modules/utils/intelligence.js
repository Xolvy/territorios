
import { updateTelefono, updateTerritorio } from '../../data/firestore-services.js';

export class TerritoryIntelligence {
    constructor(telefonos, publicadores, territorios) {
        this.telefonos = telefonos;
        this.publicadores = publicadores;
        this.territorios = territorios || [];
    }

    /**
     * "Self-Sustainability": Automatically cleans up inconsistencies
     * and ensures data health without manual intervention.
     */
    async runAutoMaintenence() {
        const report = {
            fixedIds: [],
            actions: []
        };

        // 1. Detect Orphan Assignments (Numbers assigned to deleted publishers)
        const validPublisherNames = new Set(this.publicadores.map(p => p.nombre));

        for (const t of this.telefonos) {
            const assignedTo = t.asignado_a || t.publicador_asignado;
            if (assignedTo && assignedTo !== 'Sin asignar' && !validPublisherNames.has(assignedTo)) {
                // Determine if it's really an orphan or just a legacy ID mapping
                // For safety in this 'auto-pilot', we unassign it.
                await updateTelefono(t.id, {
                    asignado_a: null,
                    publicador_asignado: null,
                    estado: 'Sin asignar',
                    fecha_asignacion: null
                });
                report.fixedIds.push(t.id);
                report.actions.push(`Desasignado número ${t.numero} de publicador inexistente (${assignedTo}).`);
            }
        }

        // 2. Identify "Stale" Assignments (Assigned > 4 months ago with no progress)
        // (This would require a 'last_updated' field which we might enforce now)

        return report;
    }

    /**
     * "AI Insights": Generates smart suggestions based on data patterns.
     * This simulates AI reasoning locally.
     */
    generateInsights() {
        const insights = [];
        const now = new Date();
        const FOUR_MONTHS_MS = 120 * 24 * 60 * 60 * 1000;

        // Analysis: Territory Health & Neglected Areas
        const totalNumbers = this.telefonos.length;
        const workedNumbers = this.telefonos.filter(t =>
            ['Contestaron', 'No llamar', 'Colgaron'].includes(t.estado)
        ).length;

        // Identify "Neglected" Territories (Assigned long ago or never touched)
        // Since we didn't always track dates, we use 'Sin asignar' or very old dates if available
        let neglectedCount = 0;

        // Logic: If 'ultima_fecha' exists check diff, else if assigned check assignment date
        this.telefonos.forEach(t => {
            if (t.estado === 'Sin asignar' || !t.estado) neglectedCount++;
            else if (t.fecha_asignacion) {
                const assignedDate = new Date(t.fecha_asignacion);
                if (now - assignedDate > FOUR_MONTHS_MS) neglectedCount++;
            }
        });

        const coverage = totalNumbers ? Math.round((workedNumbers / totalNumbers) * 100) : 0;
        const healthColor = coverage < 30 ? 'text-red-400' : 'text-green-400';

        insights.push({
            type: 'info',
            title: '📊 Cobertura Telefónica',
            message: `Cobertura actual: <b class="${healthColor}">${coverage}%</b>. Se han trabajado ${workedNumbers} de ${totalNumbers} números.`
        });

        if (neglectedCount > 0) {
            insights.push({
                type: 'warning',
                title: '⚠️ Territorios Desatendidos',
                message: `Se detectaron <b>${neglectedCount}</b> números que no han sido trabajados recientemente o están sin asignar. <br>Se recomienda priorizar su asignación inmediata para mejorar la cobertura.`
            });
        } else {
            insights.push({
                type: 'positive',
                title: '✅ Excelente Rotación',
                message: `Todos los territorios se están trabajando activamente.`
            });
        }

        return insights;
    }
}
