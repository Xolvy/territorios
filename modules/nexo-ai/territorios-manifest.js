export const NexoManifest = {
  app_name: "Territorios JW",
  contexto_global: "App para gestionar territorios de predicación, agenda, mapas interactivos, disponibilidad semanal y Live Pool telefónico.",
  funciones_disponibles: [
    {
      nombre: "marcar_territorio_completado",
      descripcion: "Marca un mapa físico principal como terminado.",
      parametros: { numero_territorio: "string" }
    },
    {
      nombre: "actualizar_estado_telefono",
      descripcion: "Actualiza cómo resultó la llamada en una de las parcelas del usuario activo en el Live Pool.",
      parametros: { ultimos_digitos: "string", nuevo_estado: "string (no_llamar, exitoso, ocupado, no_contesta)" }
    },
    {
      nombre: "mostrar_mapa_territorio",
      descripcion: "Abre el Explorador de Mapas y hace zoom al territorio indicado para guiar al conductor.",
      parametros: { numero_territorio: "string" }
    },
    {
      nombre: "actualizar_disponibilidad",
      descripcion: "Actualiza la disponibilidad general del conductor para una semana específica.",
      parametros: { rango_fechas: "objeto { inicio: yyyy-mm-dd, fin: yyyy-mm-dd }", disponible: "boolean" }
    },
    {
      nombre: "actualizar_dias_disponibles",
      descripcion: "Configura exactamente qué días y en qué franjas (Mañana, Tarde, Noche) saldrá a predicar nuestro compañero.",
      parametros: { dias_detallados: "Array de objetos { dia: Lunes|Martes|Miércoles.., franjas: ['Mañana', 'Noche'] }" }
    },
    {
      nombre: "leer_tema_semanal",
      descripcion: "Lee el tema central de la predicación de esta semana y lo anuncia para que el usuario se prepare.",
      parametros: {}
    }
  ]
};
