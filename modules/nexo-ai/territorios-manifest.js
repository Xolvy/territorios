export const NexoManifest = {
  app_name: "Territorios JW",
  contexto_global: "App para gestionar territorios de predicación y publicadores.",
  funciones_disponibles: [
    {
      nombre: "marcar_territorio_completado",
      descripcion: "Marca un mapa físico como terminado. Parámetros: numero_territorio (string)."
    },
    {
      nombre: "actualizar_estado_telefono",
      descripcion: "Cambia el estado de una llamada en el Live Pool. Parámetros: ultimos_digitos (string), nuevo_estado (string: no_llamar, exitoso, ocupado, no_contesta)."
    }
  ]
};
