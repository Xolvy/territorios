import { userService } from "../lib/userService";
import { db } from "../lib/firebase";
import { doc, updateDoc, deleteField } from "firebase/firestore";

/**
 * Script de migración para eliminar el campo 'congregation' de todos los usuarios existentes
 * en la base de datos Firebase.
 */
export async function migrateCongregationField() {
  console.log(
    '🔄 Iniciando migración: Eliminando campo "congregation" de usuarios...'
  );

  try {
    // Obtener todos los usuarios existentes
    const users = await userService.getAllUsers();
    console.log(`📊 Encontrados ${users.length} usuarios para migrar`);

    let migratedCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    // Procesar cada usuario
    for (const user of users) {
      try {
        // Verificar si el usuario tiene el campo congregation
        if ("congregation" in user && user.congregation !== undefined) {
          console.log(
            `🔄 Migrando usuario: ${user.fullName} (${user.phoneNumber})`
          );

          // Eliminar el campo congregation directamente de Firestore
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            congregation: deleteField(),
          });

          migratedCount++;
          console.log(
            `✅ Campo "congregation" eliminado del usuario: ${user.fullName}`
          );
        } else {
          console.log(`⏭️  Usuario ya migrado: ${user.fullName}`);
          skipCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrando usuario ${user.fullName}:`, error);
        errorCount++;
      }
    }

    console.log("🎉 Migración completada!");
    console.log(`✅ Usuarios migrados exitosamente: ${migratedCount}`);
    console.log(`⏭️  Usuarios ya migrados: ${skipCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📊 Total procesados: ${users.length}`);

    return {
      success: true,
      totalUsers: users.length,
      migratedUsers: migratedCount,
      skippedUsers: skipCount,
      errors: errorCount,
    };
  } catch (error) {
    console.error("❌ Error en la migración:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Función para ejecutar la migración desde el panel de administrador
 */
export async function runCongregationMigration() {
  const confirmation = confirm(
    '¿Estás seguro de que quieres eliminar el campo "Congregación" de todos los usuarios?\n\n' +
      "Esta acción:\n" +
      '• Eliminará permanentemente el campo "congregation" de todos los usuarios\n' +
      "• No se puede deshacer\n" +
      "• Puede tomar varios minutos\n\n" +
      "¿Continuar?"
  );

  if (!confirmation) {
    console.log("❌ Migración cancelada por el usuario");
    return { success: false, message: "Migración cancelada" };
  }

  console.log("🚀 Iniciando migración...");
  return await migrateCongregationField();
}
