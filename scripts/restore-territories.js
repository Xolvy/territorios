
import admin from "firebase-admin";
import fs from "fs";

// Intento de inicialización sin archivo de llave (usando credenciales de entorno si existen)
admin.initializeApp({
    projectId: "territorios-jw"
});

const db = admin.firestore();

async function restore() {
    console.log("🏗️ Restaurando inventario base (1-22)...");
    try {
        const backupData = JSON.parse(fs.readFileSync("territorios_backup.json", "utf8"));
        const batch = db.batch();

        backupData.forEach(t => {
            const { id, ...cleanData } = t;
            // Asegurarse de que NO tenga campos de asignación
            delete cleanData.asignado_a;
            delete cleanData.auxiliar;
            delete cleanData.fecha_asignacion;
            delete cleanData.turno;
            delete cleanData.estado;

            const ref = db.collection("territorios").doc(id);
            batch.set(ref, cleanData);
        });

        await batch.commit();
        console.log("✅ Inventario 1-22 restaurado con éxito.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Error en restauración:", e);
        process.exit(1);
    }
}

restore();
