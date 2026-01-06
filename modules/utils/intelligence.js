
import { updateTelefono, updateTerritorio } from '../../data/firestore-services.js?v=3.0.0';

export class TerritoryIntelligence {
    constructor(telefonos, publicadores, territorios, programa, conductores) {
        this.telefonos = telefonos;
        this.publicadores = publicadores;
        this.territorios = territorios || [];
        this.programa = programa || {};
        this.conductores = conductores || [];
    }

    // ... (keep runAutoMaintenence and generateInsights as is, I will only target range around askGemini)

    /**
     * Connects to Google Gemini API for advanced analysis
     */
    async detectBestModel(apiKey) {
        if (this.cachedModel) return this.cachedModel;

        const versions = ['v1beta', 'v1'];
        const priorities = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro'];

        console.log("🔍 Scanning for available AI models...");

        for (const version of versions) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`);
                if (!res.ok) continue;

                const data = await res.json();
                if (!data.models) continue;

                // 1. Try Priority Match
                for (const p of priorities) {
                    const match = data.models.find(m =>
                        m.name.includes(p) &&
                        m.supportedGenerationMethods?.includes('generateContent')
                    );
                    if (match) {
                        const cleanName = match.name.startsWith('models/') ? match.name.split('/')[1] : match.name;
                        this.cachedModel = { name: cleanName, version: version };
                        console.log(`✅ Model matched: ${cleanName} (${version})`);
                        return this.cachedModel;
                    }
                }

                // 2. Fallback: Any 'generateContent' model
                const anyGen = data.models.find(m => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini'));
                if (anyGen) {
                    const cleanName = anyGen.name.startsWith('models/') ? anyGen.name.split('/')[1] : anyGen.name;
                    this.cachedModel = { name: cleanName, version: version };
                    console.log(`⚠️ Fallback model found: ${cleanName} (${version})`);
                    return this.cachedModel;
                }

            } catch (e) {
                console.warn(`Version ${version} check failed:`, e);
            }
        }

        throw new Error("No compatible AI models found for this API Key. Ensure 'Google AI Studio' API is enabled.");
    }

    /**
     * Connects to Google Gemini API for advanced analysis
     */
    async askGemini(apiKey, prompt) {
        // 1. Prepare Minified Context
        const isFree = (t) => (!t.asignado_a || t.asignado_a === 'Sin asignar' || t.asignado_a === null) && t.estado !== 'Asignado' && t.estado !== 'Predicado';

        const context = {
            fecha_actual: new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            dia_semana_indice: new Date().getDay(), // 0=Dom, 1=Lun
            resumen_telefonos: {
                total: this.telefonos.length,
                estados: this.telefonos.reduce((acc, t) => { acc[t.estado || 'Sin asignar'] = (acc[t.estado || 'Sin asignar'] || 0) + 1; return acc; }, {})
            },
            publicadores_nombres: this.publicadores.map(p => p.nombre),
            conductores_nombres: this.conductores.map(c => c.nombre),
            territorios_disponibles: this.territorios
                .filter(t => isFree(t))
                .slice(0, 50)
                .map(t => ({
                    id: t.id,
                    numero: t.numero,
                    manzanas: t.manzanas || 'Todas',
                    ultima_visita: t.ultima_fecha || 'Nunca'
                })),
            asignaciones_activas: this.territorios
                .filter(t => t.estado === 'Asignado' && t.asignado_a)
                .map(t => ({
                    numero: t.numero,
                    conductor: t.asignado_a,
                    fecha_asignacion: t.fecha_asignacion,
                    dias_transcurridos: Math.floor((new Date() - new Date(t.fecha_asignacion)) / (1000 * 60 * 60 * 24))
                })),
            programa_semanal: this.programa.dias ? this.programa.dias : "No disponible"
        };

        const systemPrompt = `
            Eres el Asistente de Territorios.
            Contexto: ${JSON.stringify(context)}.
            
            Si piden asignar: ||ASSIGN_TERR:{id}:{conductor}||
            Prioriza territorios con fecha lejana.
            Si piden asignar con detalles: ||ASSIGN_TERR:{id}:{conductor}:{"lugar":"...","hora":"...","campana":"..."}||
            
            Reglas para 'Territorios Atrasados':
            1. Revisa 'programa_semanal'.
            2. Compara el día asignado con 'dia_semana_indice' (Lunes=1... Domingo=0).
            3. Si un territorio fue asignado un día ANTERIOR al actual y no ha sido entregado (sigue en 'asignaciones_activas'), es ATRASADO.
            4. Reporta lista de números y conductores atrasados.
            
            IMPORTANTE: Los números de territorio se normalizan con 0 a la izquierda si tienen 1 dígito (ej: 5 -> 05).

            Pregunta: ${prompt}
        `;

        try {
            // 2. Auto-detect best model
            const modelConfig = await this.detectBestModel(apiKey);

            // 3. Call API
            const response = await fetch(`https://generativelanguage.googleapis.com/${modelConfig.version}/models/${modelConfig.name}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: systemPrompt }]
                    }]
                })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                console.error("Gemini API Error:", data);
                // Invalidate cache if 404 to try scanning again next time
                if (response.status === 404) this.cachedModel = null;
                throw new Error(data.error?.message || response.statusText);
            }

            return data.candidates && data.candidates[0].content.parts[0].text ?
                data.candidates[0].content.parts[0].text :
                "No pude generar una respuesta.";

        } catch (err) {
            console.error("Critical Gemini Error:", err);
            if (err.message.includes("No compatible")) {
                return "Error: Tu API Key no tiene acceso a modelos de IA. Verifica en Google AI Studio.";
            }
            throw err;
        }
    }

    async performFullAudit(apiKey) {
        if (!apiKey) throw new Error("API Key requerida para auditoría IA");

        const dataSnapshot = {
            telefonos_totales: this.telefonos.length,
            publicadores_activos: this.publicadores.length,
            territorios_estado: this.territorios.map(t => ({ num: t.numero, est: t.estado, cond: t.asignado_a })),
            programa_actual: this.programa,
            posibles_duplicados_tel: this.telefonos.filter((t, i, self) => self.findIndex(x => x.numero === t.numero) !== i).slice(0, 5),
            telefonos_sin_estado: this.telefonos.filter(t => !t.estado || t.estado === 'Sin asignar' && t.publicador_asignado).length
        };

        const auditPrompt = `
            Actúa como un Auditor de Datos Senior. Analiza este snapshot: ${JSON.stringify(dataSnapshot)}.
            Busca inconsistencias, riesgos y sugerencias. Responde con un informe estructurado con ###.
        `;

        return await this.askGemini(apiKey, auditPrompt);
    }

    async predictAssignments(apiKey) {
        const prompt = `Analiza los territorios disponibles y recomienda los 3 mejores para asignar en la próxima salida grupal, explicando por qué (ej: tiempo sin trabajar, zona geográfica).`;
        return await this.askGemini(apiKey, prompt);
    }

    async getTerritoryQuickLook(territory, history, apiKey) {
        if (!apiKey) return "IA Desactivada.";

        const historyContext = history && history.length > 0
            ? history.slice(0, 3).map(h => `${h.fecha}: ${h.estado}. Notas: ${h.notas || 'Sin notas'}`).join(' | ')
            : "Sin historial reciente.";

        const prompt = `Como asistente de predicación, da una sugerencia MUY BREVE (máximo 15 palabras) para el territorio ${territory.numero} (${territory.manzanas || 'Todas'}). 
        Historial reciente: ${historyContext}. 
        Enfócate en interés, mejor hora o precauciones. Sé específico pero ultra-conciso.`;

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





