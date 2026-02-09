
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, writeBatch } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
    apiKey: "AIzaSyDrgpMp04uuFRz61vNIOzD9CCPl8p_wDL0",
    authDomain: "territorios-jw.firebaseapp.com",
    projectId: "territorios-jw",
    storageBucket: "territorios-jw.firebasestorage.app",
    messagingSenderId: "350092132257",
    appId: "1:350092132257:web:7795cb426dfe4b496b55e0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function restore() {
    console.log("🏗️ Restaurando inventario base (1-22)...");
    try {
        const backupData = JSON.parse(fs.readFileSync("territorios_backup.json", "utf8"));
        const batch = writeBatch(db);

        backupData.forEach(t => {
            const { id, ...cleanData } = t;
            // Limpieza doble por seguridad
            delete cleanData.asignado_a;
            delete cleanData.auxiliar;
            delete cleanData.fecha_asignacion;
            delete cleanData.turno;
            delete cleanData.estado;

            const ref = doc(db, "territorios", id);
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
