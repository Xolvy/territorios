/**
 * @file functions/index.js
 * @description Xolvy Territorial Intelligence — Firebase Cloud Functions v2
 *
 * ARQUITECTURA DE SEGURIDAD:
 * - Todas las funciones son `onCall`, lo que verifica automáticamente el
 *   token de autenticación de Firebase antes de ejecutar cualquier lógica.
 * - El Admin SDK opera con privilegios máximos, evitando las reglas de
 *   Firestore para escrituras del servidor (operaciones atómicas batch).
 * - El uid del conductor se extrae SIEMPRE de `context.auth.uid` (nunca
 *   del cliente) para prevenir suplantación de identidad.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ─── REGLAS DE RECICLAJE (Business Logic Constants) ──────────────────────────
const RECYCLE_RULES = {
    // Estados que entran al pool general con timestamp de congelamiento
    NO_CONTESTAN_FREEZE_MONTHS: 3,
    NO_LLAMAR_FREEZE_MONTHS: 6,
    // Estados que se excluyen del pool automático (requieren seguimiento personal)
    PERSONAL_FOLLOWUP: new Set(['Volver', 'Estudio', 'Revisita']),
    // Estados terminales que limpian el registro completamente
    POOL_READY: new Set(['Sin asignar', 'Contestaron', 'Colgaron']),
};

/**
 * Calcula la fecha de disponibilidad aplicando las reglas de negocio exactas.
 * @param {string} estado - Estado final del teléfono en la sesión
 * @returns {Timestamp|null} - Timestamp de disponibilidad, o null para seguimiento personal
 */
const calcularDisponibleDesde = (estado) => {
    const now = new Date();

    if (estado === 'No contestan') {
        const t = new Date(now);
        t.setMonth(t.getMonth() + RECYCLE_RULES.NO_CONTESTAN_FREEZE_MONTHS);
        return Timestamp.fromDate(t);
    }

    if (estado === 'No llamar') {
        const t = new Date(now);
        t.setMonth(t.getMonth() + RECYCLE_RULES.NO_LLAMAR_FREEZE_MONTHS);
        return Timestamp.fromDate(t);
    }

    // Estados de seguimiento personal: excluir del pool automático
    if (RECYCLE_RULES.PERSONAL_FOLLOWUP.has(estado)) {
        return null; // null = "no liberar al pool – requiere contacto directo"
    }

    // Pool ready: disponible inmediatamente después del cierre
    return Timestamp.fromDate(now);
};

// ─── CLOUD FUNCTION: finalizarSesionTelefonica ────────────────────────────────

/**
 * Finaliza la sesión telefónica de un conductor de forma atómica:
 *
 * PASO 1 — AGREGACIÓN:    Consulta todos los números bloqueados por este conductor.
 * PASO 2 — AUDITORÍA:     Crea un reporte permanente en `reportes_sesiones`.
 * PASO 3 — RECICLAJE:     Libera o congela números según reglas de negocio.
 *                          Todo en un único batch write atómico (all-or-nothing).
 *
 * @param {object} data - Datos enviados desde el frontend:
 *   - conductorNombre {string}: Nombre para mostrar del conductor
 *   - notasIA {Array}:          Array de notas generadas por el Asistente durante la sesión
 * @param {CallableContext} context - Contexto de autenticación (inyectado por Firebase)
 */
exports.finalizarSesionTelefonica = onCall(
    { region: "us-central1", timeoutSeconds: 120 },
    async (request) => {
        // ── Auth Guard ────────────────────────────────────────────────────────
        if (!request.auth) {
            throw new HttpsError(
                "unauthenticated",
                "Debes estar autenticado para cerrar una sesión telefónica."
            );
        }

        const conductorUid = request.auth.uid;
        const { conductorNombre = "Conductor", notasIA = [] } = request.data;

        console.log(`[finalizarSesion] Iniciando cierre para UID: ${conductorUid} (${conductorNombre})`);

        // ── PASO 1: AGREGACIÓN ────────────────────────────────────────────────
        // Consulta todos los teléfonos que este conductor tiene bloqueados
        const telefonosRef = db.collection("telefonos");
        const sessionQuery = telefonosRef.where("solicitado_por_id", "==", conductorUid);
        const sessionSnap = await sessionQuery.get();

        if (sessionSnap.empty) {
            console.log(`[finalizarSesion] No se encontraron números activos para UID: ${conductorUid}`);
            return {
                success: true,
                message: "No había números activos en sesión.",
                stats: { total: 0 }
            };
        }

        // Calcular estadísticas agregadas
        const telefonesDocs = sessionSnap.docs;
        const stats = {
            total: telefonesDocs.length,
            por_estado: {},
            con_nota_ia: 0,
            con_alerta_admin: 0,
        };

        telefonesDocs.forEach(doc => {
            const data = doc.data();
            const estado = data.estado || "Sin asignar";
            stats.por_estado[estado] = (stats.por_estado[estado] || 0) + 1;
            if (data.nota_historial) stats.con_nota_ia++;
            if (data.alerta_superintendente) stats.con_alerta_admin++;
        });

        console.log(`[finalizarSesion] Estadísticas calculadas:`, stats);

        // ── PASO 2: AUDITORÍA ─────────────────────────────────────────────────
        // Creamos el reporte ANTES del batch para garantizar el registro incluso
        // si el reciclaje falla (el admin siempre podrá ver qué pasó).
        const reporteRef = db.collection("reportes_sesiones").doc();
        const reporte = {
            conductor_uid: conductorUid,
            conductor_nombre: conductorNombre,
            fecha_cierre: Timestamp.now(),
            estadisticas: stats,
            notas_ia: notasIA.slice(0, 50), // Máximo 50 notas por sesión
            numeros_procesados: telefonesDocs.map(doc => ({
                id: doc.id,
                telefono: doc.data().telefono,
                estado_final: doc.data().estado,
                alerta: doc.data().alerta_superintendente || false,
            })),
            version_schema: "2.0",
        };

        await reporteRef.set(reporte);
        console.log(`[finalizarSesion] Reporte de auditoría creado: ${reporteRef.id}`);

        // ── PASO 3: RECICLAJE INTELIGENTE (Atomic Batch Write) ────────────────
        // Firestore batch: máximo 500 operaciones. Dividir si se necesita.
        const BATCH_LIMIT = 490;
        const batches = [];
        let currentBatch = db.batch();
        let operationCount = 0;

        for (const doc of telefonesDocs) {
            const data = doc.data();
            const estado = data.estado || "Sin asignar";
            const disponibleDesde = calcularDisponibleDesde(estado);

            const isPersonalFollowup = RECYCLE_RULES.PERSONAL_FOLLOWUP.has(estado);
            const isPrivacyLock = (estado === 'No llamar');

            const updatePayload = {
                // ── Siempre: liberar el bloqueo de concurrencia ───────────────
                solicitado_por_id: null,
                solicitado_por: null,
                solicitado_en: null,

                // ── Restaurar estado del pool ─────────────────────────────────
                estado: isPersonalFollowup ? estado : "Sin asignar",

                // ── Timestamp de reciclaje según reglas ───────────────────────
                disponible_desde: disponibleDesde,

                // ── Flags de comportamiento ───────────────────────────────────
                requiere_seguimiento_personal: isPersonalFollowup,
                bloqueo_privacidad: isPrivacyLock,

                // ── Metadata de trazabilidad ──────────────────────────────────
                ultima_sesion_uid: conductorUid,
                ultima_sesion_nombre: conductorNombre,
                fecha_fin_sesion: FieldValue.serverTimestamp(),
                reporte_sesion_id: reporteRef.id,
            };

            currentBatch.update(doc.ref, updatePayload);
            operationCount++;

            if (operationCount >= BATCH_LIMIT) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                operationCount = 0;
            }
        }

        // Agregar el último batch si tiene operaciones pendientes
        if (operationCount > 0) {
            batches.push(currentBatch);
        }

        // Ejecutar todos los batches de forma secuencial
        // (Promise.all no es seguro aquí ya que el orden importa)
        for (const batch of batches) {
            await batch.commit();
        }

        console.log(`[finalizarSesion] ✅ Reciclaje completado. ${telefonesDocs.length} números liberados.`);

        // ── RESPUESTA AL FRONTEND ─────────────────────────────────────────────
        return {
            success: true,
            reporte_id: reporteRef.id,
            stats,
            message: `Sesión cerrada correctamente. ${telefonesDocs.length} números reciclados.`,
        };
    }
);


// ─── CLOUD FUNCTION: alertaPrivacidadFCM ─────────────────────────────────────

/**
 * Trigger de Firestore: se dispara cuando se actualiza cualquier documento
 * en la colección `telefonos`. Si el estado cambia a "No llamar",
 * envía una notificación Push FCM al topic `admins`.
 *
 * PREREQUISITO: Los admins deben suscribirse al topic `admins` al iniciar sesión.
 * Esto se hace desde el frontend con messaging.subscribeToTopic(token, 'admins').
 * Para producción, los tokens se suscribens desde el Admin SDK en backend también.
 */
exports.alertaPrivacidadFCM = onDocumentUpdated(
    { document: "telefonos/{phoneId}", region: "us-central1" },
    async (event) => {
        const before = event.data.before.data();
        const after = event.data.after.data();

        // Solo disparar cuando el estado CAMBIA a "No llamar" por primera vez
        const estadoCambioANoLlamar =
            after.estado === "No llamar" &&
            before.estado !== "No llamar";

        if (!estadoCambioANoLlamar) return null;

        const telefono = after.telefono || event.params.phoneId;
        const conductor = after.ultima_sesion_nombre || after.solicitado_por || "un conductor";

        console.log(`[alertaPrivacidad] ⚠️ Número ${telefono} marcado como NO LLAMAR por ${conductor}`);

        const messaging = getMessaging();

        // ── Mensaje FCM al topic 'admins' ─────────────────────────────────────
        // Todos los administradores que hayan suscrito su token a este topic
        // recibirán la notificación push, sin importar si la app está abierta.
        const message = {
            topic: "admins",
            notification: {
                title: "🔒 Alerta de Privacidad",
                body: `Un número ha solicitado no ser contactado y ha sido bloqueado por 6 meses.`,
            },
            data: {
                tipo: "alerta_privacidad",
                telefono: String(telefono),
                conductor,
                timestamp: new Date().toISOString(),
                phoneDocId: event.params.phoneId,
            },
            android: {
                priority: "high",
                notification: {
                    channelId: "alertas_criticas",
                    priority: "max",
                    defaultSound: true,
                    color: "#ef4444",
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1,
                        "content-available": 1,
                    }
                }
            },
            webpush: {
                notification: {
                    icon: "/icon-192.svg",
                    badge: "/icon-192.svg",
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    actions: [
                        { action: "ver_reporte", title: "Ver en Dashboard" }
                    ]
                },
                fcmOptions: {
                    link: "/admin?alerta=privacidad"
                }
            }
        };

        try {
            const response = await messaging.send(message);
            console.log(`[alertaPrivacidad] ✅ FCM enviado: ${response}`);

            // También guardar la alerta en Firestore para el panel del Admin
            await db.collection("alertas_admin").add({
                tipo: "privacidad_no_llamar",
                telefono,
                conductor,
                phone_doc_id: event.params.phoneId,
                fecha: Timestamp.now(),
                leida: false,
            });
        } catch (err) {
            console.error("[alertaPrivacidad] Error enviando FCM:", err);
        }

        return null;
    }
);

// ─── CLOUD FUNCTION: limpiarSesionesHuerfanas (Cron Job) ─────────────────────

/**
 * Limpieza automática diaria de sesiones abandonadas.
 * Si un conductor tomó números pero no cerró sesión en 48h,
 * los libera silenciosamente para evitar bloqueos del pool.
 *
 * Se ejecuta diariamente a las 04:00 AM UTC (hora de bajo tráfico).
 */
exports.limpiarSesionesHuerfanas = onSchedule(
    { schedule: "0 4 * * *", region: "us-central1", timeoutSeconds: 300 },
    async () => {
        const ORPHAN_THRESHOLD_HOURS = 48;
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - ORPHAN_THRESHOLD_HOURS);
        const cutoffTimestamp = Timestamp.fromDate(cutoff);

        console.log(`[limpiarHuerfanas] Buscando sesiones anteriores a: ${cutoff.toISOString()}`);

        const orphanQuery = db.collection("telefonos")
            .where("estado", "==", "En Sesión")
            .where("solicitado_en", "<", cutoffTimestamp);

        const orphanSnap = await orphanQuery.get();

        if (orphanSnap.empty) {
            console.log("[limpiarHuerfanas] No se encontraron sesiones huérfanas.");
            return;
        }

        const batch = db.batch();
        orphanSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                estado: "Sin asignar",
                solicitado_por_id: null,
                solicitado_por: null,
                solicitado_en: null,
                disponible_desde: Timestamp.now(),
                requiere_seguimiento_personal: false,
                liberado_por_cron: true,
                fecha_liberacion_cron: FieldValue.serverTimestamp(),
            });
        });

        await batch.commit();
        console.log(`[limpiarHuerfanas] ✅ ${orphanSnap.size} sesiones huérfanas liberadas.`);

        // Registrar en auditoría
        await db.collection("reportes_sesiones").add({
            tipo: "limpieza_automatica_cron",
            fecha: Timestamp.now(),
            numeros_liberados: orphanSnap.size,
            umbral_horas: ORPHAN_THRESHOLD_HOURS,
        });
    }
);

// ─── CLOUD FUNCTION: askNexoAI (AI Proxy) ───────────────────────────────────

/**
 * Nexo AI Assistant — Proxy seguro para Google Gemini API.
 * Protege la API Key ocultándola en el servidor.
 */
exports.askNexoAI = onCall(
    { 
        region: "us-central1", 
        timeoutSeconds: 60,
        // En producción se recomienda usar: secrets: ["GEMINI_KEY"]
    },
    async (request) => {
        // 1. Auth Guard: Solo usuarios logueados pueden usar la IA
        if (!request.auth) {
            throw new HttpsError(
                "unauthenticated",
                "Debes estar autenticado para usar el asistente Nexo."
            );
        }

        const { prompt, systemInstruction, history = [], generationConfig = {} } = request.data;
        
        // Priorizar variable de entorno (Configurable vía Firebase CLI)
        const apiKey = process.env.GEMINI_KEY;

        if (!apiKey) {
            console.error("[askNexoAI] CRÍTICO: API Key no configurada en process.env.GEMINI_KEY");
            throw new HttpsError("failed-precondition", "El servicio de IA no está configurado en el servidor.");
        }

        console.log(`[askNexoAI] Procesando solicitud para UID: ${request.auth.uid}`);

        try {
            // Usamos Gemini 1.5 Flash (o 2.5 si está disponible en v1beta)
            const model = "gemini-1.5-flash"; 
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            
            // Construir el payload compatible con Gemini API
            const body = {
                contents: history.length > 0 ? history : [],
                generationConfig: {
                    temperature: generationConfig.temperature || 0.1,
                    topP: generationConfig.topP || 0.8,
                    responseMimeType: generationConfig.responseMimeType || "application/json"
                }
            };

            // Inyectar el system instruction si existe
            if (systemInstruction) {
                body.system_instruction = systemInstruction;
            }

            // Agregar el prompt actual del usuario (con soporte multimodal)
            const userParts = [{ text: prompt }];
            if (request.data.image) {
                const img = request.data.image;
                const base64Data = img.inline_data?.data || img.inlineData?.data;
                const mimeType = img.inline_data?.mime_type || img.inlineData?.mimeType;
                if (base64Data && mimeType) {
                    userParts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    });
                }
            }

            body.contents.push({
                role: "user",
                parts: userParts
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("[askNexoAI] Gemini API Error:", JSON.stringify(errorData));
                throw new HttpsError("internal", "Error en el cerebro de la IA.");
            }

            const result = await response.json();
            
            // Devolver la respuesta cruda para que el cliente la procese
            return {
                candidates: result.candidates,
                usageMetadata: result.usageMetadata
            };

        } catch (error) {
            console.error("[askNexoAI] Fallo en la comunicación:", error);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError("internal", "Error de red al conectar con Nexo.");
        }
    }
);
