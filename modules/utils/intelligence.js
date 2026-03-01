import { updateTelefono, updateTerritorio } from '../../data/firestore-services.js';

export class TerritoryIntelligence {
    constructor(telefonos, publicadores, territorios, programa, conductores, puntosInteres) {
        this.telefonos = telefonos || [];
        this.publicadores = publicadores || [];
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
            Eres el Cerebro Territorial (Asistente Avanzado de Xolvy). Actúa como un experto en logística, predicación y soporte técnico de esta aplicación.
            
            ### CONOCIMIENTO DEL MÓDULO CONDUCTOR:
            1. **Agenda Inteligente**: Muestra los territorios asignados al usuario para la semana actual.
            2. **Misiones de Rescate (POR COMPLETAR)**: Botón índigo que abre una "Bolsa de Trabajo" con tres categorías:
                - **INCOMPLETO**: Territorios iniciados pero no terminados. Sugiere "Continuar Predicación".
                - **DISPONIBLE**: Territorios libres/sin asignar. Sugiere "Tomar Territorio".
                - **RESISTENTE**: Territorios con más de 1 día de retraso respecto a lo programado. Requieren atención urgente.
            3. **Explorador Global de Mapas**: Accesible desde el botón "Satélite". Muestra polígonos KML, puntos de interés (paradas, parques) y radar GPS.
            4. **Predicación Telefónica**: Sistema simplificado para solicitar bloques de 5, 10 o 15 números. Permite asignar números a publicadores específicos y enviar reportes por WhatsApp.
            5. **Mi Disponibilidad**: Panel compacto de rejilla para gestionar los turnos de la semana (Mañana, Tarde, Noche).
            6. **Centro de Ayuda**: Sección con FAQs y "Guía del Mapa" que explica el uso del radar GPS y el modo 3D.
            7. **Ayudas para el Ministerio**: Galería de recursos (PDFs) con miniaturas visuales.

            ### REGLAS DE RESPUESTA:
            - Si el usuario pregunta por territorios libres o misiones, menciona el botón "POR COMPLETAR".
            - Si pregunta por límites o cómo ver el mapa de otros, menciona el "Explorador Global Satelital".
            - Si pide un nuevo territorio porque terminó el suyo, sugiere uno de la lista 'Puntos de Interés' o territorios libres.
            - Usa un tono amigable, motivador y profesional.
            - Responde siempre en Markdown.
            
            ### CONTEXTO DE DATOS:
            ${JSON.stringify(context)}.

            Pregunta del Usuario: ${prompt}
        `;

        try {
            const modelConfig = await this.detectBestModel(apiKey);
            const response = await fetch(`https://generativelanguage.googleapis.com/${modelConfig.version}/models/${modelConfig.name}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                const msg = data.error?.message || "";
                if (msg.includes("blocked") || msg.includes("API key")) {
                    console.error("🚫 Gemini API Error:", msg);
                    return `⚠️ **Error de Conexión IA:** Google ha bloqueado la solicitud. \n\n**Causa probable:** La API Key no tiene permisos para el servicio 'Generative Language API'. \n\n**Solución:** Contacta al administrador para habilitar el servicio en Google AI Studio o revisar las restricciones de la API Key.`;
                }
                throw new Error(msg || "Error en IA");
            }
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude procesar la respuesta.";
        } catch (err) {
            console.error("Gemini Error:", err);
            if (err.message.includes("blocked")) {
                return "⚠️ **Cerebro Territorial bloqueado:** Los servicios de IA de Google están restringidos para este sitio o esta API Key. Verifica la configuración en el Panel de Administrador.";
            }
            return "Error: " + err.message;
        }
    }

    async detectBestModel(apiKey) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await response.json();
            if (data.models && data.models.length > 0) {
                // Prefer 1.5 Pro, then 1.5 Flash, then 1.0 Pro
                const models = data.models.map(m => m.name.replace('models/', ''));
                if (models.includes('gemini-1.5-pro')) return { name: 'gemini-1.5-pro', version: 'v1beta' };
                if (models.includes('gemini-1.5-flash')) return { name: 'gemini-1.5-flash', version: 'v1beta' };
                return { name: 'gemini-pro', version: 'v1beta' };
            }
        } catch (e) {
            console.error("Error detecting models:", e);
        }
        return { name: 'gemini-1.5-flash', version: 'v1beta' }; // Default fallback
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

    /**
     * XOLVY UPDATES: Intelligence integration
     */
    async getUpdateInsight(moduleName, version, apiKey) {
        if (!apiKey) return `Detecté una actualización para ${moduleName} (v${version}).`;

        const moduleDescriptions = {
            'core': 'el motor principal del sistema, optimizando el rendimiento y la seguridad',
            'territories_view': 'el visor de territorios con mejores mapas y datos',
            'phones_view': 'el sistema de gestión de llamadas',
            'conductor': 'tu panel de control personal',
            'admin': 'las herramientas de administración central',
            'maps_explorer': 'la exploración geográfica avanzada',
            'phone_module': 'la vinculación telefónica directa',
            'public_view': 'la gestión de predicación pública',
            'rules_view': 'la configuración de reglas del sistema',
            'availability': 'el panel de disponibilidad de conductores',
            'recursos': 'el centro de recursos y ayudas',
            'rescue': 'el sistema de misiones de rescate para territorios atrasados',
            'onboarding': 'la guía de inicio para nuevos conductores',
            'analytics_view': 'el análisis avanzado de datos y estadísticas',
            'weekly_program': 'el sistema de programación semanal avanzado',
            'program_views': 'la visualización detallada del programa de predicación',
            'login': 'la seguridad y acceso al sistema'
        };

        const desc = moduleDescriptions[moduleName] || 'mejoras generales del sistema';
        const prompt = `Un módulo llamado "${moduleName}" se está actualizando a la versión ${version}. 
        Su función es: ${desc}. 
        Saluda al conductor (que puede ser hombre o mujer) y dile brevemente y con entusiasmo que estás instalando esta mejora en segundo plano. 
        Manténlo cortés, profesional y bajo un tono de "asistente avanzado de Xolvy". Máximo 25 palabras.`;

        try {
            return await this.askGemini(apiKey, prompt);
        } catch (e) {
            return `Estoy aplicando una actualización en **${moduleName}** para mejorar tu experiencia.`;
        }
    }
}





