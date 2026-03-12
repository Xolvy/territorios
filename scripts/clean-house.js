import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, "..");

console.log("🧹 Iniciando Operación de Limpieza y Seguridad (Clean House)...");

let filesSanitized = [];
let filesMoved = [];
let filesDeleted = [];
let securityStatus = "✅ Seguro";

// 1. Seguridad de API Keys en inject-seed.js
try {
    const injectScriptPath = path.join(__dirname, "inject-seed.js");
    if (fs.existsSync(injectScriptPath)) {
        let content = fs.readFileSync(injectScriptPath, "utf8");
        // Busca la asignación de NEW_GEMINI_KEY y la reemplaza sin importar las comillas (simples o dobles)
        const keyPattern = /const\s+NEW_GEMINI_KEY\s*=\s*(["']).*?\1;/;
        if (keyPattern.test(content)) {
            content = content.replace(keyPattern, `const NEW_GEMINI_KEY = "REMOVED_FOR_SECURITY";`);
            fs.writeFileSync(injectScriptPath, content, "utf8");
            filesSanitized.push("scripts/inject-seed.js (API Key eliminada)");
        } else {
             filesSanitized.push("scripts/inject-seed.js (Ya estaba seguro o patrón no encontrado)");
        }
    }
} catch (e) {
    console.error("Error saneando inject-seed.js:", e.message);
    securityStatus = "⚠️ Advertencia (Error saneando script)";
}

// 2. Eliminación de Residuos (db_seed.json)
try {
    const seedPath = path.join(rootPath, "db_seed.json");
    if (fs.existsSync(seedPath)) {
        const backupDir = path.join(rootPath, ".backups");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupSeedPath = path.join(backupDir, `db_seed_${timestamp}.json`);
        
        fs.renameSync(seedPath, backupSeedPath);
        filesMoved.push(`db_seed.json -> .backups/db_seed_${timestamp}.json`);
    }
} catch (e) {
    console.error("Error moviendo db_seed.json:", e.message);
}

// Limpieza de archivos .log
try {
    // Buscar y borrar en la raíz
    const filesInRoot = fs.readdirSync(rootPath);
    filesInRoot.forEach(file => {
        if (file.endsWith(".log")) {
            fs.unlinkSync(path.join(rootPath, file));
            filesDeleted.push(`RAÍZ: ${file}`);
        }
    });

    // Buscar y borrar en scripts/
    const scriptsPath = path.join(rootPath, "scripts");
    if (fs.existsSync(scriptsPath)) {
        const filesInScripts = fs.readdirSync(scriptsPath);
        filesInScripts.forEach(file => {
            if (file.endsWith(".log")) {
                fs.unlinkSync(path.join(scriptsPath, file));
                filesDeleted.push(`SCRIPTS: ${file}`);
            }
        });
    }
} catch (e) {
   console.error("Error limpiando archivos .log:", e.message);
}

// 3. Organización de Módulos (Housekeeping) - Borrando intelligence.js
try {
    const intelligencePath = path.join(rootPath, "modules", "utils", "intelligence.js");
    if (fs.existsSync(intelligencePath)) {
        fs.unlinkSync(intelligencePath);
        filesDeleted.push("modules/utils/intelligence.js (Módulo antiguo extraído)");
    }
} catch (e) {
    console.error("Error intentando eliminar intelligence.js:", e.message);
}

// 4. Informe Final
console.log("\n-----------------------------------------");
console.log("📋 INFORME FINAL DE SEGURIDAD Y LIMPIEZA");
console.log("-----------------------------------------");
console.log(`Estado de Seguridad: ${securityStatus}`);

console.log("\n🔒 Archivos Saneados:");
if (filesSanitized.length === 0) console.log("   - Ninguno");
filesSanitized.forEach(f => console.log(`   - ${f}`));

console.log("\n📦 Archivos Respaldados/Movidos:");
if (filesMoved.length === 0) console.log("   - Ninguno");
filesMoved.forEach(f => console.log(`   - ${f}`));

console.log("\n🗑️ Archivos Eliminados (Basura/Logs/Antigüedades):");
if (filesDeleted.length === 0) console.log("   - Ninguno");
filesDeleted.forEach(f => console.log(`   - ${f}`));

console.log("-----------------------------------------");
console.log("✨ Entorno limpio, asegurado y listo para producción.");
