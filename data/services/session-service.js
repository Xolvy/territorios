/**
 * @file data/services/session-service.js
 * @description Xolvy Session Service — Frontend caller for Cloud Functions.
 *
 * Invoca las Cloud Functions de forma segura usando el SDK de Firebase,
 * que inyecta automáticamente el token de autenticación en cada llamada.
 * El frontend NUNCA toca directamente las reglas de reciclaje — esa lógica
 * vive exclusivamente en el servidor.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebase-config.js";

// ─── INSTANCIA DE FUNCTIONS ───────────────────────────────────────────────────
// Se inicializa con la región donde desplegamos las functions
const functions = getFunctions(app, "us-central1");

// ─── CALLABLE REFERENCES ──────────────────────────────────────────────────────
const _finalizarSesion = httpsCallable(functions, "finalizarSesionTelefonica");

/**
 * Llama a la Cloud Function `finalizarSesionTelefonica`.
 *
 * @param {object} params
 * @param {string} params.conductorNombre - Nombre del conductor (para el reporte)
 * @param {Array}  params.notasIA         - Historial de notas generadas por IA durante la sesión
 * @returns {Promise<{success: boolean, reporte_id: string, stats: object, message: string}>}
 * @throws {Error} Si la Cloud Function retorna un error (incluye código y mensaje del servidor)
 */
export const finalizarSesionTelefonica = async ({ conductorNombre, notasIA = [] }) => {
    const result = await _finalizarSesion({ conductorNombre, notasIA });
    return result.data;
};
