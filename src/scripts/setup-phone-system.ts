/**
 * 📞 Preparación de Sistema de Números Telefónicos
 * Crea la estructura optimizada para gestionar números telefónicos por territorio
 */

import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { APP_ID, TOTAL_TERRITORIES } from "../lib/firebaseService";

interface PhoneNumberRecord {
  id: string;
  numero: string;
  territorio: number;
  manzana?: string;
  estado:
    | "disponible"
    | "llamado"
    | "no-contestaron"
    | "colgaron"
    | "no-llamar"
    | "contestaron"
    | "revisita"
    | "suspendido"
    | "testigo";
  ultimaLlamada?: Date;
  notas?: string;
  conductorAsignado?: string;
  historialLlamadas: CallHistory[];
  createdAt: Date;
  updatedAt: Date;
}

interface CallHistory {
  fecha: Date;
  conductor: string;
  resultado: string;
  notas?: string;
  duracion?: number; // en segundos
}

interface TerritoryPhoneStats {
  territorio: number;
  totalNumeros: number;
  disponibles: number;
  llamados: number;
  noLlamar: number;
  revisitas: number;
  ultimaActualizacion: Date;
}

/**
 * Helper para obtener referencia de colección
 */
const getCollectionRef = (collectionName: string) =>
  collection(db, "artifacts", APP_ID, "public", "data", collectionName);

/**
 * Crear estructura base para números telefónicos
 */
export async function setupPhoneNumberStructure(): Promise<void> {
  console.log("📞 Setting up phone number structure...");

  try {
    const batch = writeBatch(db);

    // 1. Crear colección de configuración para teléfonos
    const configRef = doc(getCollectionRef("config"), "phone-system");
    batch.set(configRef, {
      version: "1.0.0",
      estadosDisponibles: [
        "disponible",
        "llamado",
        "no-contestaron",
        "colgaron",
        "no-llamar",
        "contestaron",
        "revisita",
        "suspendido",
        "testigo",
      ],
      configuracion: {
        maxIntentosPorNumero: 3,
        diasEntreLlamadas: 7,
        horasPermitidas: {
          inicio: "09:00",
          fin: "21:00",
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Crear estructura de estadísticas por territorio
    for (let territorio = 1; territorio <= TOTAL_TERRITORIES; territorio++) {
      const statsRef = doc(
        getCollectionRef("territory-phone-stats"),
        territorio.toString()
      );
      batch.set(statsRef, {
        territorio,
        totalNumeros: 0,
        disponibles: 0,
        llamados: 0,
        noLlamar: 0,
        revisitas: 0,
        ultimaActualizacion: new Date(),
        createdAt: new Date(),
      });
    }

    await batch.commit();
    console.log("✅ Phone number structure created successfully");
  } catch (error) {
    console.error("❌ Error setting up phone structure:", error);
    throw error;
  }
}

/**
 * Función para importar números telefónicos desde CSV
 */
export async function importPhoneNumbersFromCSV(
  csvData: string
): Promise<void> {
  console.log("📥 Importing phone numbers from CSV...");

  const lines = csvData.split("\n");
  const headers = lines[0].split(",");

  // Validar headers esperados
  const expectedHeaders = ["numero", "territorio", "manzana"];
  const hasValidHeaders = expectedHeaders.every((header) =>
    headers.some((h) => h.toLowerCase().includes(header))
  );

  if (!hasValidHeaders) {
    throw new Error("CSV debe contener columnas: numero, territorio, manzana");
  }

  const batch = writeBatch(db);
  const telefonosRef = getCollectionRef("telefonos");
  let processedCount = 0;
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");

    if (values.length < 3) continue;

    try {
      const numero = values[0].trim();
      const territorio = parseInt(values[1].trim());
      const manzana = values[2]?.trim() || "";

      // Validaciones
      if (
        !numero ||
        isNaN(territorio) ||
        territorio < 1 ||
        territorio > TOTAL_TERRITORIES
      ) {
        errorCount++;
        continue;
      }

      const phoneRecord: Partial<PhoneNumberRecord> = {
        numero,
        territorio,
        manzana,
        estado: "disponible",
        historialLlamadas: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = doc(telefonosRef, `${territorio}-${numero}`);
      batch.set(docRef, phoneRecord);
      processedCount++;

      // Commit en lotes de 500 para evitar límites de Firestore
      if (processedCount % 500 === 0) {
        await batch.commit();
        console.log(`📞 Processed ${processedCount} phone numbers...`);
      }
    } catch (error) {
      console.error(`Error processing line ${i}:`, error);
      errorCount++;
    }
  }

  // Commit final
  if (processedCount % 500 !== 0) {
    await batch.commit();
  }

  console.log(
    `✅ Import completed: ${processedCount} imported, ${errorCount} errors`
  );

  // Actualizar estadísticas
  await updateTerritoryPhoneStats();
}

/**
 * Actualizar estadísticas de teléfonos por territorio
 */
export async function updateTerritoryPhoneStats(): Promise<void> {
  console.log("📊 Updating territory phone statistics...");

  const telefonosRef = getCollectionRef("telefonos");
  const snapshot = await getDocs(telefonosRef);

  // Agrupar por territorio
  const territoryStats: Record<number, TerritoryPhoneStats> = {};

  snapshot.docs.forEach((doc) => {
    const data = doc.data() as PhoneNumberRecord;
    const territorio = data.territorio;

    if (!territoryStats[territorio]) {
      territoryStats[territorio] = {
        territorio,
        totalNumeros: 0,
        disponibles: 0,
        llamados: 0,
        noLlamar: 0,
        revisitas: 0,
        ultimaActualizacion: new Date(),
      };
    }

    const stats = territoryStats[territorio];
    stats.totalNumeros++;

    switch (data.estado) {
      case "disponible":
        stats.disponibles++;
        break;
      case "llamado":
      case "no-contestaron":
      case "contestaron":
        stats.llamados++;
        break;
      case "no-llamar":
      case "colgaron":
        stats.noLlamar++;
        break;
      case "revisita":
        stats.revisitas++;
        break;
    }
  });

  // Guardar estadísticas actualizadas
  const batch = writeBatch(db);
  const statsRef = getCollectionRef("territory-phone-stats");

  Object.values(territoryStats).forEach((stats) => {
    const docRef = doc(statsRef, stats.territorio.toString());
    batch.set(docRef, stats);
  });

  await batch.commit();
  console.log("✅ Territory phone statistics updated");
}

/**
 * Función para crear números telefónicos de ejemplo (para testing)
 */
export async function createSamplePhoneNumbers(): Promise<void> {
  console.log("📞 Creating sample phone numbers for testing...");

  const batch = writeBatch(db);
  const telefonosRef = getCollectionRef("telefonos");

  // Crear números de ejemplo para los primeros 3 territorios
  for (let territorio = 1; territorio <= 3; territorio++) {
    for (let i = 1; i <= 10; i++) {
      const numero = `9${territorio.toString().padStart(2, "0")}${i
        .toString()
        .padStart(6, "0")}`;

      const phoneRecord: Partial<PhoneNumberRecord> = {
        numero,
        territorio,
        manzana: `M${Math.ceil(i / 3)}`,
        estado: i % 4 === 0 ? "no-contestaron" : "disponible",
        historialLlamadas: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = doc(telefonosRef, `${territorio}-${numero}`);
      batch.set(docRef, phoneRecord);
    }
  }

  await batch.commit();
  console.log("✅ Sample phone numbers created");

  await updateTerritoryPhoneStats();
}

/**
 * Función principal para preparar todo el sistema telefónico
 */
export async function setupCompletePhoneSystem(): Promise<void> {
  console.log("🚀 Setting up complete phone system...");

  try {
    await setupPhoneNumberStructure();
    await createSamplePhoneNumbers();

    console.log("🎉 Phone system setup completed successfully!");
    console.log("📋 What was created:");
    console.log("  ✅ Phone system configuration");
    console.log("  ✅ Territory statistics structure");
    console.log("  ✅ Sample phone numbers for testing");
    console.log("  ✅ Phone call history tracking");
  } catch (error) {
    console.error("💥 Phone system setup failed:", error);
    throw error;
  }
}

// Exportar tipos para uso en otros archivos
export type { PhoneNumberRecord, CallHistory, TerritoryPhoneStats };

// Script ejecutable si se llama directamente
if (require.main === module) {
  setupCompletePhoneSystem()
    .then(() => {
      console.log("🎉 Phone system setup script completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Phone system setup script failed:", error);
      process.exit(1);
    });
}
