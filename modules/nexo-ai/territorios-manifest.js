export const NexoManifest = {
    app_name: "Territorios JW",
    contexto_global:
        "App para gestionar territorios de predicación, agenda, mapas interactivos, disponibilidad semanal y Live Pool telefónico.",
    tools: [
        {
            function_declarations: [
                {
                    name: "registrar_predicacion_territorio",
                    description:
                        "Registra el avance o la entrega final de un territorio de predicación (S-13). Úsala cuando el usuario informe haber terminado o trabajado sectores específicos.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            territorio_id: {
                                type: "STRING",
                                description: "El ID o número del territorio (ej: '15').",
                            },
                            tipo_entrega: {
                                type: "STRING",
                                enum: ["completo", "parcial"],
                                description:
                                    "Si el territorio se terminó totalmente ('completo') o solo se avanzaron algunas partes ('parcial').",
                            },
                            manzanas_trabajadas: {
                                type: "ARRAY",
                                items: { type: "STRING" },
                                description:
                                    "Lista de manzanas o sectores que el usuario indica haber terminado (requerido solo para 'parcial').",
                            },
                            notas_novedades: {
                                type: "STRING",
                                description:
                                    "Información para el registro S-13 (casas vacías, personas interesadas, advertencias, etc.).",
                            },
                        },
                        required: ["territorio_id", "tipo_entrega"],
                    },
                },
                {
                    name: "agregar_nota_s13",
                    description: "Agrega una nota o novedad adicional a un territorio ya informado anteriormente.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            territorio_id: { type: "STRING" },
                            nota: {
                                type: "STRING",
                                description: "La novedad encontrada (timbre dañado, persona sorda, etc.)",
                            },
                        },
                        required: ["territorio_id", "nota"],
                    },
                },
                {
                    name: "actualizar_estado_telefono",
                    description: "Actualiza el resultado de una llamada en el Live Pool telefónico.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            ultimos_digitos: { type: "STRING" },
                            nuevo_estado: { type: "STRING", enum: ["no_llamar", "exitoso", "ocupado", "no_contesta"] },
                        },
                        required: ["ultimos_digitos", "nuevo_estado"],
                    },
                },
                {
                    name: "mostrar_mapa_territorio",
                    description: "Abre el mapa interactivo y muestra el territorio indicado.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            numero_territorio: { type: "STRING" },
                        },
                        required: ["numero_territorio"],
                    },
                },
                {
                    name: "informar_territorios_vencidos",
                    description:
                        "Consulta el banco S-13 para identificar territorios que ya superaron su fecha de vencimiento y no han sido entregados.",
                    parameters: {
                        type: "OBJECT",
                        properties: {},
                    },
                },
            ],
        },
    ],
};
