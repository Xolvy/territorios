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

        // Analysis 1: Top Performers
        const pubStats = {};
        this.telefonos.forEach(t => {
            const pub = t.asignado_a || t.publicador_asignado;
            if (pub && pub !== 'Sin asignar') {
                if (!pubStats[pub]) pubStats[pub] = { total: 0, completed: 0 };
                pubStats[pub].total++;
                if (['Contestaron', 'No llamar', 'Suspendido', 'Testigo'].includes(t.estado)) {
                    pubStats[pub].completed++;
                }
            }
        });

        // Find most active
        const activePubs = Object.entries(pubStats)
            .sort(([, a], [, b]) => b.completed - a.completed)
            .slice(0, 3);

        if (activePubs.length > 0) {
            const names = activePubs.map(([name]) => name).join(', ');
            insights.push({
                type: 'positive',
                title: '⚡ Top Rendimiento',
                message: `Los publicadores más efectivos esta semana son: ${names}. Considere asignarles territorios más desafiantes.`
            });
        }

        // Analysis 2: Territory Health (Coverage)
        const totalNumbers = this.telefonos.length;
        const workedNumbers = this.telefonos.filter(t =>
            ['Contestaron', 'No llamar', 'Colgaron'].includes(t.estado)
        ).length;
        const coverage = totalNumbers ? Math.round((workedNumbers / totalNumbers) * 100) : 0;

        insights.push({
            type: coverage < 30 ? 'warning' : 'info',
            title: '📊 Cobertura Telefónica',
            message: `El territorio telefónico está cubierto al ${coverage}%. ${coverage < 30 ? 'Se recomienda priorizar la asignación de números nuevos.' : 'Buen ritmo de trabajo.'}`
        });

        return insights;
    }
}
