/**
 * @file modules/services/ai-vision-service.js
 * @description Nexo AI — Servicio de extracción de datos mediante Gemini Vision API
 */

import { getConfiguracion } from '../../data/firestore-services.js';

/**
 * Procesa una imagen del programa semanal usando la API de Gemini Vision
 * @param {File} file El archivo de imagen
 * @returns {Promise<Object>} El JSON extraído del programa
 */
export const extractProgramFromImage = async (file) => {
    try {
        const config = await getConfiguracion();
        const apiKey = config.gemini_api_key || config.gemini_key;

        if (!apiKey) {
            throw new Error("API Key de Gemini no encontrada en la configuración del sistema.");
        }

        // Convertir imagen a Base64
        const base64Image = await fileToBase64(file);
        const base64Data = base64Image.split(',')[1];
        const mimeType = file.type;

        // Migración a Gemini 2.5 Flash (Versión 1.5 deprecada)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const prompt = `Analiza esta imagen del programa de predicación semanal y extrae TODOS los datos.

REGLAS CRÍTICAS:
1. Devuelve ÚNICAMENTE un objeto JSON válido (sin texto extra, sin bloques \`\`\`).
2. Estructura: { "Lunes": [ {...}, {...} ], "Martes": [...], ... }
3. Cada elemento del array tiene: turno, lugar, hora, conductor, auxiliar, faceta, territorio.
4. Turnos válidos: "MAÑANA", "TARDE", "NOCHE", "ZOOM".
5. Si en un mismo día hay MÚLTIPLES GRUPOS para el mismo turno (ej. 3 grupos de MAÑANA el domingo), genera UN OBJETO SEPARADO por cada grupo en el array.
6. Eventos sin territorio (ej: "REUNIÓN ENTRE SEMANA", "MANTENIMIENTO SALÓN", "REUNIÓN FIN DE SEMANA"): inclúyelos con conductor="" y territorio="", y pon el nombre del evento en el campo "faceta" y en "lugar".
7. Si menciona "Zoom", "Telefónica" o "Carta", el turno DEBE ser "ZOOM".
8. Si una celda está vacía, usa "".`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || "Error en la petición a Gemini API");
        }

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Extraer el JSON del texto (a veces Gemini lo envuelve en bloques ```json)
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No se pudo detectar un formato de tabla válido en la respuesta.");
        }

        return JSON.parse(jsonMatch[0]);

    } catch (error) {
        console.error("🚀 [AI Vision] Error:", error);
        throw error;
    }
};

/**
 * Convierte un objeto File a Base64
 */
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};
