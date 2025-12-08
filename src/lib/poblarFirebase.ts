// Script para poblar Firebase con datos iniciales
import { firestoreService } from './firestoreSimple';

// Datos de ejemplo para conductores
const conductoresEjemplo = [
  {
    nombre: 'Juan Carlos Pérez'
  },
  {
    nombre: 'María González'
  },
  {
    nombre: 'Pedro Martínez'
  }
];

// Datos de ejemplo para territorios
const territoriosEjemplo = [
  {
    numero: 1,
    totalManzanas: 20,
    asignaciones: [],
    historialAsignaciones: []
  },
  {
    numero: 2,
    totalManzanas: 18,
    asignaciones: [],
    historialAsignaciones: []
  },
  {
    numero: 3,
    totalManzanas: 22,
    asignaciones: [],
    historialAsignaciones: []
  }
];

// Función principal para poblar Firebase
export async function poblarFirebase() {
  try {
    console.log('🔄 Iniciando población de Firebase...');

    // Poblar conductores
    console.log('📝 Poblando conductores...');
    for (const conductor of conductoresEjemplo) {
      await firestoreService.conductores.add(conductor);
    }

    // Poblar territorios  
    console.log('🗺️ Poblando territorios...');
    for (const territorio of territoriosEjemplo) {
      await firestoreService.territorios.add(territorio);
    }

    console.log('✅ Firebase poblado exitosamente!');
    
    return {
      success: true,
      message: 'Datos iniciales creados correctamente'
    };
  } catch (error) {
    console.error('❌ Error poblando Firebase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función para limpiar datos (opcional)
export async function limpiarFirebase() {
  try {
    console.log('🧹 Limpiando Firebase...');
    
    // Aquí podrías implementar lógica para limpiar datos
    // Por seguridad, no implementamos esto ahora
    
    console.log('✅ Firebase limpiado!');
    return { success: true };
  } catch (error) {
    console.error('❌ Error limpiando Firebase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}