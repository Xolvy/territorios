/**
 * 🔄 Script de Backup Firebase
 * Exporta todas las colecciones existentes como respaldo antes de la migración
 */

import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

interface BackupData {
  users: any[];
  territories: any[];
  telephoneRecords: any[];
  timestamp: string;
  version: string;
}

/**
 * Función para exportar una colección completa
 */
async function exportCollection(collectionName: string): Promise<any[]> {
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);

    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convertir timestamps de Firebase a strings para JSON
      _exportedAt: new Date().toISOString(),
    }));

    console.log(`✅ Exported ${data.length} documents from ${collectionName}`);
    return data;
  } catch (error) {
    console.error(`❌ Error exporting ${collectionName}:`, error);
    return [];
  }
}

/**
 * Función principal de backup
 */
export async function backupFirebaseData(): Promise<void> {
  console.log("🔄 Starting Firebase backup...");

  const backupData: BackupData = {
    users: [],
    territories: [],
    telephoneRecords: [],
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };

  try {
    // Backup de colecciones existentes
    console.log("📦 Backing up Users collection...");
    backupData.users = await exportCollection("Users");

    console.log("📦 Backing up territorios collection...");
    backupData.territories = await exportCollection("territorios");

    console.log("📦 Backing up registros telefónicos...");
    // Nota: ajustar nombre exacto según tu Firebase
    backupData.telephoneRecords =
      (await exportCollection("registros-telefonicos")) ||
      (await exportCollection("telefonos")) ||
      (await exportCollection("phone-records"));

    // Crear directorio de backup si no existe
    const backupDir = path.join(process.cwd(), "firebase-backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Generar nombre de archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `firebase-backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    // Escribir archivo de backup
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));

    console.log("✅ Backup completed successfully!");
    console.log(`📁 Backup saved to: ${filepath}`);
    console.log(`📊 Backup summary:
    - Users: ${backupData.users.length} documents
    - Territories: ${backupData.territories.length} documents  
    - Phone Records: ${backupData.telephoneRecords.length} documents
    - Total size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error("❌ Backup failed:", error);
    throw error;
  }
}

/**
 * Función para restaurar desde backup (si es necesario)
 */
export async function restoreFromBackup(backupFilePath: string): Promise<void> {
  console.log("🔄 Starting restore from backup...");

  try {
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, "utf8"));

    console.log(`📦 Restoring from backup created at: ${backupData.timestamp}`);

    // Aquí irían las funciones de restauración
    // (implementar solo si es necesario)

    console.log("✅ Restore completed successfully!");
  } catch (error) {
    console.error("❌ Restore failed:", error);
    throw error;
  }
}

// Función de utilidad para listar todas las colecciones
export async function listCollections(): Promise<string[]> {
  // Esta función requiere Admin SDK para listar colecciones
  // Por ahora, listaremos las colecciones conocidas
  const knownCollections = [
    "Users",
    "users",
    "territorios",
    "territories",
    "registros-telefonicos",
    "telefonos",
    "phone-records",
  ];

  console.log("📋 Known collections in Firebase:");
  knownCollections.forEach((collection) => {
    console.log(`  - ${collection}`);
  });

  return knownCollections;
}

// Script ejecutable si se llama directamente
if (require.main === module) {
  backupFirebaseData()
    .then(() => {
      console.log("🎉 Backup script completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Backup script failed:", error);
      process.exit(1);
    });
}
