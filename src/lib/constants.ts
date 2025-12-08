export const TOTAL_TERRITORIOS = 22;

export const MANZANAS_POR_TERRITORIO = {
  1: 4, 2: 3, 3: 7, 4: 3, 5: 4, 6: 4, 7: 3, 8: 4, 
  9: 2, 10: 2, 11: 2, 12: 1, 13: 2, 14: 4, 15: 4, 
  16: 2, 17: 2, 18: 2, 19: 4, 20: 1, 21: 2, 22: 3
} as const;

export const ESTADOS_TELEFONICOS = [
  '', 
  'Colgaron', 
  'No llamar', 
  'Contestaron', 
  'Revisita', 
  'Devuelto', 
  'No contestaron', 
  'Testigo'
] as const;

export const DIAS_SEMANA = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 
  'Viernes', 'Sábado', 'Domingo'
] as const;

export const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
] as const;

export const FACETAS_DEFAULT = [
  { id: 'primera-visita', nombre: 'Primera Visita' },
  { id: 'revisita', nombre: 'Revisita' },
  { id: 'estudio-biblico', nombre: 'Estudio Bíblico' },
  { id: 'testificar', nombre: 'Testificar' }
];

export const LUGARES_DEFAULT = [
  { id: 'salon-reino', nombre: 'Salón del Reino' },
  { id: 'parque-central', nombre: 'Parque Central' },
  { id: 'plaza-armas', nombre: 'Plaza de Armas' },
  { id: 'mercado-central', nombre: 'Mercado Central' }
];

export const CONDUCTORES_DEFAULT = [
  { id: '1', nombre: 'Hermano García' },
  { id: '2', nombre: 'Hermano López' },
  { id: '3', nombre: 'Hermano Martínez' },
  { id: '4', nombre: 'Hermano Rodríguez' }
];

export const TOAST_DURATION = 5000;

export const MODAL_ANIMATION_DURATION = 200;

export const VALIDATION_RULES = {
  territorio: {
    min: 1,
    max: TOTAL_TERRITORIOS
  },
  telefono: {
    pattern: /^[0-9]{9,15}$/,
    message: 'El teléfono debe tener entre 9 y 15 dígitos'
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'El email debe tener un formato válido'
  }
};
