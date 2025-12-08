// Build Script - Sistema de Territorios v2.0
const fs = require("fs").promises;
const path = require("path");

async function copyRecursive(src, dest) {
  try {
    const stats = await fs.stat(src);
    if (stats.isDirectory()) {
      await fs.mkdir(dest, { recursive: true });
      const items = await fs.readdir(src);
      for (const item of items) {
        await copyRecursive(path.join(src, item), path.join(dest, item));
      }
    } else {
      await fs.copyFile(src, dest);
    }
  } catch (error) {
    console.error(`Error copying ${src} to ${dest}:`, error.message);
  }
}

async function build() {
  console.log("🏗️ Iniciando build del Sistema de Territorios...");

  try {
    // Limpiar directorio dist
    console.log("🧹 Limpiando directorio dist/...");
    try {
      await fs.rmdir("dist", { recursive: true });
    } catch (e) {
      // Directory doesn't exist, that's fine
    }

    // Crear directorio dist
    await fs.mkdir("dist", { recursive: true });

    // Copiar archivos desde src/
    console.log("📋 Copiando archivos desde src/...");
    await copyRecursive("src", "dist");

    // Copiar assets adicionales si existen
    const additionalAssets = [
      "public/favicon.ico",
      "public/icon-192.png",
      "public/icon-512.png",
    ];

    for (const asset of additionalAssets) {
      try {
        const destPath = path.join("dist", path.basename(asset));
        await fs.copyFile(asset, destPath);
        console.log(`✅ Copiado: ${asset} → ${destPath}`);
      } catch (error) {
        console.log(`⚠️ Asset opcional no encontrado: ${asset}`);
      }
    }

    // Verificar archivos críticos
    const criticalFiles = ["dist/index.html", "dist/manifest.json"];
    for (const file of criticalFiles) {
      try {
        await fs.access(file);
        console.log(`✅ Archivo crítico verificado: ${file}`);
      } catch (error) {
        console.error(`❌ Archivo crítico faltante: ${file}`);
        process.exit(1);
      }
    }

    // Mostrar resumen
    const distFiles = await fs.readdir("dist");
    console.log(`\n📦 Build completado exitosamente:`);
    console.log(`   📁 Archivos generados: ${distFiles.length}`);
    console.log(`   📂 Directorio: dist/`);
    console.log(`\n🚀 Listo para despliegue con: npm run deploy`);
  } catch (error) {
    console.error("❌ Error durante el build:", error.message);
    process.exit(1);
  }
}

build();
