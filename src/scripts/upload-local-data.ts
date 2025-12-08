/**
 * 📤 Script de Subida de Datos Locales a Firebase
 * Sube conductores, lugares, facetas y territorios desde constants.ts a Firestore
 */

import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import {
  CONDUCTORES_DEFAULT,
  LUGARES_DEFAULT,
  FACETAS_DEFAULT,
  TOTAL_TERRITORIOS,
  MANZANAS_POR_TERRITORIO,
} from "../lib/constants";
import { APP_ID } from "../lib/firebaseService";

interface UploadResult {
  collection: string;
  uploaded: number;
  errors: number;
  details: string[];
}

/**
 * Helper para obtener referencia de colección
 */
const getCollectionRef = (collectionName: string) =>
  collection(db, "artifacts", APP_ID, "public", "data", collectionName);

/**
 * Subir conductores a Firebase
 */
async function uploadConductores(): Promise<UploadResult> {
  console.log("👥 Uploading conductores...");
  const result: UploadResult = {
    collection: "conductores",
    uploaded: 0,
    errors: 0,
    details: [],
  };

  try {
    const batch = writeBatch(db);
    const conductoresRef = getCollectionRef("conductores");

    for (const conductor of CONDUCTORES_DEFAULT) {
      const docRef = doc(conductoresRef, conductor.id);
      batch.set(docRef, {
        ...conductor,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: "local-constants",
        active: true,
      });
      result.uploaded++;
      result.details.push(`Added conductor: ${conductor.nombre}`);
    }

    await batch.commit();
    console.log(`✅ Successfully uploaded ${result.uploaded} conductores`);
  } catch (error) {
    console.error("❌ Error uploading conductores:", error);
    result.errors++;
    result.details.push(`Error: ${error}`);
  }

  return result;
}

/**
 * Subir lugares a Firebase
 */
async function uploadLugares(): Promise<UploadResult> {
  console.log("📍 Uploading lugares...");
  const result: UploadResult = {
    collection: "lugares",
    uploaded: 0,
    errors: 0,
    details: [],
  };

  try {
    const batch = writeBatch(db);
    const lugaresRef = getCollectionRef("lugares");

    for (const lugar of LUGARES_DEFAULT) {
      const docRef = doc(lugaresRef, lugar.id);
      batch.set(docRef, {
        ...lugar,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: "local-constants",
        active: true,
      });
      result.uploaded++;
      result.details.push(`Added lugar: ${lugar.nombre}`);
    }

    await batch.commit();
    console.log(`✅ Successfully uploaded ${result.uploaded} lugares`);
  } catch (error) {
    console.error("❌ Error uploading lugares:", error);
    result.errors++;
    result.details.push(`Error: ${error}`);
  }

  return result;
}

/**
 * Subir facetas a Firebase
 */
async function uploadFacetas(): Promise<UploadResult> {
  console.log("🎭 Uploading facetas...");
  const result: UploadResult = {
    collection: "facetas",
    uploaded: 0,
    errors: 0,
    details: [],
  };

  try {
    const batch = writeBatch(db);
    const facetasRef = getCollectionRef("facetas");

    for (const faceta of FACETAS_DEFAULT) {
      const docRef = doc(facetasRef, faceta.id);
      batch.set(docRef, {
        ...faceta,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: "local-constants",
        active: true,
      });
      result.uploaded++;
      result.details.push(`Added faceta: ${faceta.nombre}`);
    }

    await batch.commit();
    console.log(`✅ Successfully uploaded ${result.uploaded} facetas`);
  } catch (error) {
    console.error("❌ Error uploading facetas:", error);
    result.errors++;
    result.details.push(`Error: ${error}`);
  }

  return result;
}

/**
 * Crear estructura base de territorios
 */
async function uploadTerritoriosStructure(): Promise<UploadResult> {
  console.log("🗺️ Uploading territorios structure...");
  const result: UploadResult = {
    collection: "territorios",
    uploaded: 0,
    errors: 0,
    details: [],
  };

  try {
    const territoriosRef = getCollectionRef("territorios");

    // Verificar si ya existen territorios
    const existingTerritories = await getDocs(territoriosRef);
    const existingIds = existingTerritories.docs.map((doc) => doc.id);

    const batch = writeBatch(db);

    for (let i = 1; i <= TOTAL_TERRITORIOS; i++) {
      const territoryId = i.toString();

      // Solo crear si no existe
      if (!existingIds.includes(territoryId)) {
        const docRef = doc(territoriosRef, territoryId);
        batch.set(docRef, {
          numero: i,
          manzanas: (MANZANAS_POR_TERRITORIO as any)[i] || 0,
          asignaciones: [],
          historialAsignaciones: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          source: "local-constants",
          active: true,
          estado: "disponible", // disponible, asignado, completado
        });
        result.uploaded++;
        result.details.push(
          `Created territory ${i} with ${
            (MANZANAS_POR_TERRITORIO as any)[i]
          } manzanas`
        );
      } else {
        result.details.push(`Territory ${i} already exists, skipped`);
      }
    }

    if (result.uploaded > 0) {
      await batch.commit();
      console.log(`✅ Successfully created ${result.uploaded} new territories`);
    } else {
      console.log(`ℹ️ All territories already exist, no changes made`);
    }
  } catch (error) {
    console.error("❌ Error uploading territories structure:", error);
    result.errors++;
    result.details.push(`Error: ${error}`);
  }

  return result;
}

/**
 * Función principal de upload
 */
export async function uploadLocalDataToFirebase(): Promise<void> {
  console.log("🚀 Starting upload of local data to Firebase...");
  console.log(`📦 Target Firebase project: ${APP_ID}`);

  const results: UploadResult[] = [];

  try {
    // Upload en secuencia para evitar sobrecarga
    results.push(await uploadConductores());
    results.push(await uploadLugares());
    results.push(await uploadFacetas());
    results.push(await uploadTerritoriosStructure());

    // Resumen final
    console.log("\n📊 Upload Summary:");
    console.log("==================");

    let totalUploaded = 0;
    let totalErrors = 0;

    results.forEach((result) => {
      console.log(`\n${result.collection.toUpperCase()}:`);
      console.log(`  ✅ Uploaded: ${result.uploaded}`);
      console.log(`  ❌ Errors: ${result.errors}`);

      totalUploaded += result.uploaded;
      totalErrors += result.errors;

      if (result.details.length > 0) {
        console.log(`  📋 Details:`);
        result.details.forEach((detail) => {
          console.log(`    - ${detail}`);
        });
      }
    });

    console.log(`\n🎯 TOTAL RESULTS:`);
    console.log(`  ✅ Total uploaded: ${totalUploaded} documents`);
    console.log(`  ❌ Total errors: ${totalErrors}`);

    if (totalErrors === 0) {
      console.log(`\n🎉 All data uploaded successfully!`);
    } else {
      console.log(
        `\n⚠️ Upload completed with ${totalErrors} errors. Check details above.`
      );
    }
  } catch (error) {
    console.error("💥 Upload process failed:", error);
    throw error;
  }
}

/**
 * Función para verificar datos existentes antes del upload
 */
export async function checkExistingData(): Promise<void> {
  console.log("🔍 Checking existing data in Firebase...");

  const collections = ["conductores", "lugares", "facetas", "territorios"];

  for (const collectionName of collections) {
    try {
      const collectionRef = getCollectionRef(collectionName);
      const snapshot = await getDocs(collectionRef);
      console.log(
        `📊 ${collectionName}: ${snapshot.docs.length} existing documents`
      );

      if (snapshot.docs.length > 0) {
        const sampleDoc = snapshot.docs[0];
        console.log(`  Sample document ID: ${sampleDoc.id}`);
      }
    } catch (error) {
      console.log(`❌ Error checking ${collectionName}: ${error}`);
    }
  }
}

// Script ejecutable si se llama directamente
if (require.main === module) {
  (async () => {
    try {
      await checkExistingData();
      console.log("\n" + "=".repeat(50));
      await uploadLocalDataToFirebase();
      console.log("\n🎉 Upload script completed successfully!");
      process.exit(0);
    } catch (error) {
      console.error("💥 Upload script failed:", error);
      process.exit(1);
    }
  })();
}
