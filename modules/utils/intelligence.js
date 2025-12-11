
import { updateTelefono, updateTerritorio } from '../../data/firestore-services.js';

export class TerritoryIntelligence {
    constructor(telefonos, publicadores, territorios, programa) {
        this.telefonos = telefonos;
        this.publicadores = publicadores;
        this.territorios = territorios || [];
        this.programa = programa || {};
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

            // 2. Fix Ghost Assignments (Has User but says 'Sin asignar')
            // Strategy: trust the STATUS. If status is 'Sin asignar', the user field should be empty.
            if (assignedTo && assignedTo !== 'Sin asignar' && t.estado === 'Sin asignar') {
                await updateTelefono(t.id, {
                    publicador_asignado: null,
                    asignado_a: null,
                    fecha_asignacion: null
                });
                report.fixedIds.push(t.id);
                report.actions.push(`Limpiado asignación fantasma del número ${t.numero} (Tenía a: ${assignedTo} pero estado 'Sin asignar').`);
            }
        }

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
        let neglectedCount = 0;

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

    /**
     * Connects to Google Gemini API for advanced analysis
     */
    async askGemini(apiKey, prompt) {
        // 1. Prepare Minified Context (Saved Tokens)
        // Helper to check if territory is available
        const isFree = (t) => (!t.asignado_a || t.asignado_a === 'Sin asignar' || t.asignado_a === null) && t.estado !== 'Asignado' && t.estado !== 'Predicado';

        const context = {
            resumen_telefonos: {
                total: this.telefonos.length,
                estados: this.telefonos.reduce((acc, t) => { acc[t.estado || 'Sin asignar'] = (acc[t.estado || 'Sin asignar'] || 0) + 1; return acc; }, {})
            },
            publicadores_nombres: this.publicadores.map(p => p.nombre),
            // Show only critical info for all territories to save tokens, mark available ones clearly
            territorios_disponibles: this.territorios
                .filter(t => isFree(t))
                .map(t => ({ id: t.id, numero: t.numero, manzanas: t.manzanas || 'Todas', estado: t.estado || 'Libre' })),
            territorios_asignados: this.territorios
                .filter(t => !isFree(t))
                .map(t => ({ numero: t.numero, asignado_a: t.asignado_a, estado: t.estado })),
            programa_semanal: this.programa.dias ? this.programa.dias.map(d => ({
                dia: d.nombre,
                asignaciones_manana: d.manana ? `Cond: ${d.manana.conductor}, Terr: ${d.manana.territorio}` : null,
                asignaciones_tarde: d.tarde ? `Cond: ${d.tarde.conductor}, Terr: ${d.tarde.territorio}` : null,
                asignaciones_noche: d.noche ? `Cond: ${d.noche.conductor}, Terr: ${d.noche.territorio}` : null
            })) : "Sin programa cargado"
        };

        const systemPrompt = `
            Actúa como el Asistente Inteligente de Territorios (IA de la Congregación).
            Datos JSON: ${JSON.stringify(context)}.
            
            REGLAS:
            1. 'territorios_asignados' son los ocupados actualmente. NO LOS SUGIERAS.
            2. 'territorios_disponibles' son libres. SI SUGIERE ESTOS.
            3. Si el usuario pide sugerencias de territorio o dice que le falta territorio:
               - Busca en 'territorios_disponibles'.
               - Prioriza aquellos que sean 'manzanas' sueltas (ej: "Manzanas: 1, 2") o que parezcan abandonados.
               - Si encuentras uno adecuado, dile al usuario que se lo asignas.
               - IMPORTANTE: Incluye al final de tu respuesta el comando: ||ASSIGN:{id}|| (Reemplaza {id} por el ID real del JSON).
               - Solo asigna UNO a la vez.
            4. Si pregunta quién tiene un territorio, mira 'territorios_asignados' y 'programa_semanal'.
            
            Responde conciso y usa negritas (**).
            Pregunta Usuario: ${prompt}
        `;

        // 2. Call API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: systemPrompt }]
                }]
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || "Error en Gemini API");
        }

        return data.candidates && data.candidates[0].content.parts[0].text ?
            data.candidates[0].content.parts[0].text :
            "No pude generar una respuesta. Intenta de nuevo.";
    }
}
