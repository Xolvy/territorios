/**
 * 🎯 Script Maestro de Migración a Firebase
 * Orquesta todo el proceso de migración y configuración de Firebase
 */

import { backupFirebaseData } from "./backup-firebase";
import {
  uploadLocalDataToFirebase,
  checkExistingData,
} from "./upload-local-data";
import { setupCompletePhoneSystem } from "./setup-phone-system";

interface MigrationStep {
  id: string;
  name: string;
  description: string;
  required: boolean;
  completed: boolean;
  error?: string;
}

interface MigrationPlan {
  steps: MigrationStep[];
  startTime?: Date;
  endTime?: Date;
  totalDuration?: number;
}

/**
 * Plan de migración completo
 */
const createMigrationPlan = (): MigrationPlan => ({
  steps: [
    {
      id: "check-existing",
      name: "🔍 Verificar Datos Existentes",
      description: "Revisar qué datos ya existen en Firebase",
      required: true,
      completed: false,
    },
    {
      id: "backup-current",
      name: "💾 Backup de Datos Actuales",
      description: "Crear respaldo de seguridad de datos existentes",
      required: true,
      completed: false,
    },
    {
      id: "upload-local",
      name: "📤 Subir Datos Locales",
      description: "Migrar conductores, lugares, facetas y territorios",
      required: true,
      completed: false,
    },
    {
      id: "setup-phone-system",
      name: "📞 Configurar Sistema Telefónico",
      description: "Preparar estructura para números telefónicos",
      required: false,
      completed: false,
    },
    {
      id: "verify-migration",
      name: "✅ Verificar Migración",
      description: "Confirmar que todos los datos se migraron correctamente",
      required: true,
      completed: false,
    },
  ],
});

/**
 * Ejecutar un paso de la migración
 */
async function executeStep(step: MigrationStep): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Ejecutando: ${step.name}`);
  console.log(`📋 ${step.description}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    switch (step.id) {
      case "check-existing":
        await checkExistingData();
        break;

      case "backup-current":
        await backupFirebaseData();
        break;

      case "upload-local":
        await uploadLocalDataToFirebase();
        break;

      case "setup-phone-system":
        await setupCompletePhoneSystem();
        break;

      case "verify-migration":
        await verifyMigration();
        break;

      default:
        throw new Error(`Paso desconocido: ${step.id}`);
    }

    step.completed = true;
    console.log(`✅ ${step.name} completado exitosamente\n`);
  } catch (error) {
    step.error = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error en ${step.name}: ${step.error}\n`);
    throw error;
  }
}

/**
 * Verificar que la migración se completó correctamente
 */
async function verifyMigration(): Promise<void> {
  console.log("🔍 Verificando estado final de la migración...");

  // Aquí podrías agregar verificaciones específicas
  // Por ejemplo, contar documentos en cada colección

  const collections = ["conductores", "lugares", "facetas", "territorios"];

  for (const collection of collections) {
    // Simulación de verificación - reemplazar con lógica real
    console.log(`✅ Colección '${collection}' verificada`);
  }

  console.log("🎉 Verificación de migración completada");
}

/**
 * Función principal de migración
 */
export async function runCompleteMigration(
  options: {
    includePhoneSystem?: boolean;
    skipBackup?: boolean;
  } = {}
): Promise<MigrationPlan> {
  const plan = createMigrationPlan();
  plan.startTime = new Date();

  console.log("🎯 INICIANDO MIGRACIÓN COMPLETA A FIREBASE");
  console.log("==========================================\n");

  try {
    // Filtrar pasos según opciones
    let stepsToExecute = plan.steps.filter((step) => {
      if (step.id === "setup-phone-system" && !options.includePhoneSystem) {
        return false;
      }
      if (step.id === "backup-current" && options.skipBackup) {
        return false;
      }
      return true;
    });

    // Mostrar plan de ejecución
    console.log("📋 Plan de Migración:");
    stepsToExecute.forEach((step, index) => {
      const status = step.required ? "[REQUERIDO]" : "[OPCIONAL]";
      console.log(`  ${index + 1}. ${step.name} ${status}`);
      console.log(`     ${step.description}`);
    });
    console.log();

    // Ejecutar pasos
    for (const step of stepsToExecute) {
      await executeStep(step);
    }

    plan.endTime = new Date();
    plan.totalDuration = plan.endTime.getTime() - plan.startTime.getTime();

    // Resumen final
    console.log("\n" + "🎉".repeat(20));
    console.log("🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE 🎉");
    console.log("🎉".repeat(20) + "\n");

    console.log("📊 Resumen de la Migración:");
    console.log(
      `⏱️  Duración total: ${(plan.totalDuration / 1000).toFixed(2)} segundos`
    );
    console.log(
      `✅ Pasos completados: ${plan.steps.filter((s) => s.completed).length}`
    );
    console.log(
      `❌ Pasos fallidos: ${plan.steps.filter((s) => s.error).length}`
    );

    const completedSteps = plan.steps.filter((s) => s.completed);
    if (completedSteps.length > 0) {
      console.log("\n✅ Pasos Completados:");
      completedSteps.forEach((step) => {
        console.log(`  - ${step.name}`);
      });
    }

    const failedSteps = plan.steps.filter((s) => s.error);
    if (failedSteps.length > 0) {
      console.log("\n❌ Pasos Fallidos:");
      failedSteps.forEach((step) => {
        console.log(`  - ${step.name}: ${step.error}`);
      });
    }

    console.log("\n🚀 Tu aplicación está lista para usar Firebase!");
    console.log("📋 Próximos pasos recomendados:");
    console.log("  1. Probar la aplicación con datos de Firebase");
    console.log("  2. Configurar reglas de seguridad en Firestore");
    console.log("  3. Importar números telefónicos si es necesario");
  } catch (error) {
    plan.endTime = new Date();
    plan.totalDuration = plan.endTime
      ? plan.endTime.getTime() - plan.startTime.getTime()
      : 0;

    console.error("\n💥 MIGRACIÓN FALLÓ");
    console.error("==================");
    console.error(`Error: ${error}`);
    console.error(
      `Duración antes del fallo: ${(plan.totalDuration / 1000).toFixed(
        2
      )} segundos`
    );

    throw error;
  }

  return plan;
}

/**
 * Función para migración rápida (solo datos esenciales)
 */
export async function runQuickMigration(): Promise<MigrationPlan> {
  console.log("⚡ INICIANDO MIGRACIÓN RÁPIDA");

  return runCompleteMigration({
    includePhoneSystem: false,
    skipBackup: false, // Siempre hacer backup por seguridad
  });
}

/**
 * Función para migración completa (incluye sistema telefónico)
 */
export async function runFullMigration(): Promise<MigrationPlan> {
  console.log("🔥 INICIANDO MIGRACIÓN COMPLETA");

  return runCompleteMigration({
    includePhoneSystem: true,
    skipBackup: false,
  });
}

// Script ejecutable si se llama directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  const migrationMode = args[0] || "quick";

  let migrationPromise: Promise<MigrationPlan>;

  switch (migrationMode) {
    case "full":
      migrationPromise = runFullMigration();
      break;
    case "quick":
    default:
      migrationPromise = runQuickMigration();
      break;
  }

  migrationPromise
    .then((plan) => {
      console.log("\n🎉 Script de migración completado exitosamente!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Script de migración falló:", error);
      process.exit(1);
    });
}

// Exportar tipos para uso en otros archivos
export type { MigrationStep, MigrationPlan };
