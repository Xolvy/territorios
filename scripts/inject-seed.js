
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, "..");

// Configuración de rutas
const SERVICE_ACCOUNT_PATH = path.join(rootPath, "serviceAccountKey.json");
const SEED_DATA_PATH = path.join(rootPath, "db_seed.json");

// --- 🔑 CONFIGURACIÓN DE SEGURIDAD (TOKEN DE NEXO) ---
// Colega: Pega aquí tu nueva API KEY de Gemini para activarla en la BD corregida.
const NEW_GEMINI_KEY = "REMOVED_FOR_SECURITY";

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("❌ ERROR: No se encontró serviceAccountKey.json.");
    process.exit(1);
}

if (!fs.existsSync(SEED_DATA_PATH)) {
    console.error("❌ ERROR: No se encontró db_seed.json. Ejecuta primero extract-seed.js");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
const seedData = JSON.parse(fs.readFileSync(SEED_DATA_PATH, "utf8"));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Procesa subidas por lotes (Batch Writes) para evitar límites de Firestore
 */
async function uploadCollectionInBatches(collectionName, dataArray) {
    if (!dataArray || dataArray.length === 0) return 0;

    let count = 0;
    const BATCH_SIZE = 450;

    for (let i = 0; i < dataArray.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = dataArray.slice(i, i + BATCH_SIZE);

        chunk.forEach(item => {
            const { id, ...data } = item;
            const docRef = id ? db.collection(collectionName).doc(id) : db.collection(collectionName).doc();
            batch.set(docRef, data);
            count++;
        });

        await batch.commit();
        console.log(`📦 [Batch] ${collectionName}: Subidos ${count}/${dataArray.length}...`);
    }
    return count;
}

async function injectSeed() {
    console.log("🏗️ Iniciando reconstrucción y saneamiento de Firestore...");

    try {
        const results = {};

        // 1. Restaurar Publicadores
        console.log("👥 Restaurando publicadores...");
        results.publicadores = await uploadCollectionInBatches("publicadores", seedData.publicadores);

        // 2. Restaurar Territorios
        console.log("🗺️ Restaurando territorios...");
        results.territorios = await uploadCollectionInBatches("territorios", seedData.territorios);

        // 3. Restaurar Teléfonos
        console.log("📞 Restaurando teléfonos (Live Pool)...");
        results.telefonos = await uploadCollectionInBatches("telefonos", seedData.telefonos);

        // 4. Restaurar Recursos
        console.log("📚 Restaurando recursos...");
        results.recursos = await uploadCollectionInBatches("recursos", seedData.recursos);

        // 5. Restaurar Programa Semanal
        console.log("📅 Restaurando programa semanal...");
        results.programa_semanal = await uploadCollectionInBatches("programa_semanal", seedData.programa_semanal);

        // 6. Saneamiento de Configuración de Nexo (configuracion/general)
        console.log("⚙️ Ejecutando saneamiento de Nexo y Configuración...");

        // Recuperamos datos útiles de la configuración anterior (temas, horarios)
        const oldGeneral = seedData.configuracion?.general || {};

        const cleanGeneral = {
            gemini_key: NEW_GEMINI_KEY,
            nexo_model: "gemini-3-flash",
            version_app: "2.6",
            // Preservamos logística vital del seed si existía
            temas_semanales: oldGeneral.temas_semanales || [],
            horarios_predicacion: oldGeneral.horarios_predicacion || {},
            last_rebuild: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("configuracion").doc("general").set(cleanGeneral);

        // Restaurar otros documentos de configuración que no sean 'general'
        const configDocsIds = Object.keys(seedData.configuracion || {}).filter(id => id !== 'general');
        for (const id of configDocsIds) {
            await db.collection("configuracion").doc(id).set(seedData.configuracion[id]);
        }
        results.configuracion = configDocsIds.length + 1;

        console.log("\n-----------------------------------------");
        console.log("✨ RECONSTRUCCIÓN FINALIZADA CON ÉXITO");
        console.log(`- Publicadores: ${results.publicadores}`);
        console.log(`- Territorios: ${results.territorios}`);
        console.log(`- Teléfonos: ${results.telefonos}`);
        console.log(`- Recursos: ${results.recursos}`);
        console.log(`- Programas: ${results.programa_semanal}`);
        console.log(`- Documentos Config: ${results.configuracion}`);
        console.log("-----------------------------------------");
        console.log("👉 Nexo ha sido reconfigurado con Gemini 3 Flash.");

        process.exit(0);
    } catch (e) {
        console.error("❌ ERROR CRÍTICO durante la inyección:", e);
        process.exit(1);
    }
}

injectSeed();
