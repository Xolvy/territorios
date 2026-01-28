import { updateTelefono, updateTerritorio } from '../../data/firestore-services.js?v=2.4.0.5';

export class TerritoryIntelligence {
    constructor(telefonos, publicadores, territorios, programa, conductores, puntosInteres) {
        this.telefonos = telefonos;
        this.publicadores = publicadores;
        this.territorios = territorios || [];
        this.programa = programa || {};
        this.conductores = conductores || [];
        this.puntosInteres = puntosInteres || [];
    }

    // ... (maintenance and generatesInsights unchanged)

    async askGemini(apiKey, prompt) {
        if (!navigator.onLine) {
            console.log("📡 [IA Offline] Guardando consulta en cola local...");
            this.addToOfflineQueue(prompt);
            return "📴 **Modo Desconectado:** He guardado tu consulta en la cola local. Te responderé automáticamente en cuanto recuperes la conexión a internet. 📡";
        }

        const isFree = (t) => (!t.asignado_a || t.asignado_a === 'Sin asignar' || t.asignado_a === null) && t.estado !== 'Asignado' && t.estado !== 'Predicado';
        const context = {
            fecha_actual: new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            dia_semana_indice: new Date().getDay(),
            resumen_telefonos: {
                total: this.telefonos?.length || 0,
                estados: (this.telefonos || []).reduce((acc, t) => { acc[t.estado || 'Sin asignar'] = (acc[t.estado || 'Sin asignar'] || 0) + 1; return acc; }, {})
            },
            publicadores_nombres: (this.publicadores || []).map(p => p.nombre),
            conductores_nombres: (this.conductores || []).map(c => c.nombre),
            territorios_disponibles: (this.territorios || [])
                .filter(t => isFree(t))
                .slice(0, 30)
                .map(t => ({ id: t.id, numero: t.numero, manzanas: t.manzanas || 'Todas', ultima_visita: t.ultima_fecha || 'Nunca' })),
            puntos_interes_cercanos: (this.puntosInteres || []).map(p => ({
                nombre: p.nombre, tipo: p.tipo, territorio_numero: p.territorio_numero, info: p.descripcion
            })),
            programa_semanal: this.programa?.dias ? this.programa.dias : "No disponible"
        };

        const systemPrompt = `
            Eres el Cerebro Territorial (IA). Actúa como un experto en logística y predicación.
            Contexto: ${JSON.stringify(context)}.
            
            REGLA IMPORTANTE: Solo si el usuario explícitamente dice que necesita un nuevo territorio, que ya agotó el actual, o pregunta "¿dónde predicamos ahora?", sugiérele ir a uno de los 'Puntos de Interés' cercanos (paradas de taxi, bus, parques) registrados para su territorio actual o alrededores.
            Si piden asignar: ||ASSIGN_TERR:{id}:{conductor}||
            Si detectas que un conductor necesita territorio, sugierelo activamente.
            Usa un tono profesional, amable y motivador. Responde con Markdown.
            Pregunta: ${prompt}
        `;

        try {
            const modelConfig = await this.detectBestModel(apiKey);
            const response = await fetch(`https://generativelanguage.googleapis.com/${modelConfig.version}/models/${modelConfig.name}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });

            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error?.message || "Error en IA");
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude procesar la respuesta.";
        } catch (err) {
            console.error("Gemini Error:", err);
            return "Error: " + err.message;
        }
    }

    addToOfflineQueue(prompt) {
        const queue = JSON.parse(localStorage.getItem('ai_offline_queue') || '[]');
        queue.push({ prompt, timestamp: Date.now() });
        localStorage.setItem('ai_offline_queue', JSON.stringify(queue));
    }

    getOfflineQueueCount() {
        return JSON.parse(localStorage.getItem('ai_offline_queue') || '[]').length;
    }

    async processOfflineQueue(apiKey, onResponse) {
        const queue = JSON.parse(localStorage.getItem('ai_offline_queue') || '[]');
        if (queue.length === 0) return;

        console.log(`📡 Sincronizando ${queue.length} consultas IA de la cola offline...`);

        for (const item of queue) {
            const response = await this.askGemini(apiKey, item.prompt);
            onResponse(item.prompt, response);
        }

        localStorage.removeItem('ai_offline_queue');
    }

    /**
     * Proactive engine: Analyzes if the current conductor needs something
     */
    async getProactiveInsight(conductorName, apiKey) {
        if (!apiKey) return null;

        // Check if conductor already has territories
        const myTerrs = this.territorios.filter(t => t.asignado_a === conductorName && t.estado === 'Asignado');
        const available = this.territorios.filter(t => !t.asignado_a || t.asignado_a === 'Sin asignar');

        // Simple logic first: if has no territory, suggest one
        if (myTerrs.length === 0 && available.length > 0) {
            const best = available.sort((a, b) => new Date(a.ultima_fecha || 0) - new Date(b.ultima_fecha || 0))[0];
            const dateFormatted = best.ultima_fecha ? new Date(best.ultima_fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'hace mucho';
            return {
                type: 'SUGGESTION',
                title: '💡 Sugerencia Proactiva',
                message: `Hola ${conductorName.split(' ')[0]}, noto que no tienes territorios asignados. El territorio **#${best.numero}** no se ha visitado desde ${dateFormatted}. ¿Te gustaría tomarlo?`,
                action: `Solicitar territorio #${best.numero}`,
                territoryId: best.id
            };
        }

        // Logic 2: Overdue territory
        const overdue = myTerrs.find(t => {
            const days = Math.floor((new Date() - new Date(t.fecha_asignacion)) / (1000 * 60 * 60 * 24));
            return days > 120; // 4 months
        });

        if (overdue) {
            return {
                type: 'WARNING',
                title: '⚠️ Territorio Expirando',
                message: `El territorio **#${overdue.numero}** lleva más de 4 meses en tus manos. ¿Necesitas ayuda para terminarlo o prefieres devolverlo?`,
                action: 'Ver detalles de territorio'
            };
        }

        return null;
    }

    async performFullAudit(apiKey) {
        const dataSnapshot = {
            telefonos: this.telefonos.length,
            territorios: this.territorios.map(t => ({ num: t.numero, est: t.estado, cond: t.asignado_a })),
            programa: this.programa
        };
        const prompt = `Analiza este snapshot y busca inconsistencias críticas: ${JSON.stringify(dataSnapshot)}. Responde ### Informe con sugerencias.`;
        return await this.askGemini(apiKey, prompt);
    }

    async predictAssignments(apiKey) {
        const prompt = `Analiza los territorios disponibles y recomienda los 3 mejores para asignar en la próxima salida grupal, explicando por qué (ej: tiempo sin trabajar, zona geográfica).`;
        return await this.askGemini(apiKey, prompt);
    }

    async getTerritoryQuickLook(territory, history, apiKey) {
        if (!apiKey) return "IA Desactivada.";

        // Tomar hasta 15 entradas para un análisis profundo de "Novedades"
        const historyContext = history && history.length > 0
            ? history.slice(0, 20).map(h => {
                const d = h.fecha || h.fecha_entrega || h.fecha_asignacion || '';
                const o = h.notas || h.observaciones || 'Sin notas';
                return `[${d}] ${h.estado}: ${o}`;
            }).join('\n')
            : "Sin historial reciente.";

        const prompt = `Analiza el historial de predicación del territorio y responde: ¿Qué novedades hay sobre este territorio?
        Historial Completo:
        ${historyContext}
        
        Sugerencia técnica: Enfócate en tendencias (ej: "Hay mucho interés en las tardes", "Cuidado con los perros en Mz 4", "Zona difícil, mejor ir en grupo").
        REGLAS:
        - Responde en máximo 30 palabras.
        - Sé amigable y directo.
        - NO menciones el número del territorio (se sobreentiende).
        - Si no hay notas relevantes, sugiere algo basado en el tiempo transcurrido.`;

        try {
            const response = await this.askGemini(apiKey, prompt);
            return response.trim();
        } catch (e) {
            console.error("Quick Look Error:", e);
            return "Sugerencia: Revisar notas de la última salida.";
        }
    }

    async summarizeNotes(apiKey, notes) {
        if (!notes || notes.length === 0) return "Sin notas para resumir.";
        const prompt = `Resume estas observaciones de predicación de forma muy breve y amigable: ${JSON.stringify(notes)}`;
        return await this.askGemini(apiKey, prompt);
    }
}





