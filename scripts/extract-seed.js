import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, "..");

/**
 * 💡 ATENCIÓN COLEGA: 
 * Este script requiere el archivo 'serviceAccountKey.json' en la raíz del proyecto.
 * Puedes generarlo en: Firebase Console > Project Settings > Service Accounts > Generate new private key.
 */
const SERVICE_ACCOUNT_PATH = path.join(rootPath, "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("❌ ERROR: No se encontró el archivo serviceAccountKey.json en la raíz.");
    console.log("👉 Por favor, descarga la llave desde Firebase Console y guárdala como 'serviceAccountKey.json' para tener permisos de lectura total.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function extractSeed() {
    console.log("🚀 Iniciando extracción de respaldo TOTAL (Admin Mode)...");

    try {
        const seedData = {
            publicadores: [],
            telefonos: [],
            recursos: [],
            historial_territorios: [],
            banco_s13: [],
            territorios: [],
            configuracion: {},
            programa_semanal: []
        };

        const collections = [
            { id: 'publicadores', target: 'publicadores' },
            { id: 'telefonos', target: 'telefonos' },
            { id: 'recursos', target: 'recursos' },
            { id: 'historial_territorios', target: 'historial_territorios' },
            { id: 'banco_s13', target: 'banco_s13' },
            { id: 'territorios', target: 'territorios' },
            { id: 'programa_semanal', target: 'programa_semanal' }
        ];

        for (const col of collections) {
            console.log(`📥 Extrayendo colección: ${col.id}...`);
            const snap = await db.collection(col.id).get();
            snap.forEach(d => {
                seedData[col.target].push({ id: d.id, ...d.data() });
            });
            console.log(`✅ ${col.id}: ${seedData[col.target].length} documentos.`);
        }

        // Configuración es especial porque son documentos específicos que queremos mapear
        console.log("⚙️ Extrayendo documentos de configuración...");
        const configSnap = await db.collection('configuracion').get();
        configSnap.forEach(d => {
            seedData.configuracion[d.id] = d.data();
        });
        console.log(`✅ configuracion: ${Object.keys(seedData.configuracion).length} documentos.`);

        // Guardar archivo
        fs.writeFileSync('./db_seed.json', JSON.stringify(seedData, null, 2));
        
        console.log("-----------------------------------------");
        console.log("¡EXTRACCIÓN EXITOSA! Archivo db_seed.json creado.");
        console.log("Este archivo contiene el ADN completo de la aplicación.");
        console.log("-----------------------------------------");
        
        process.exit(0);
    } catch (e) {
        console.error("❌ Error crítico durante la extracción Admin:", e);
        process.exit(1);
    }
}

extractSeed();
