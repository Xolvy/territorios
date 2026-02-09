
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
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

async function backup() {
    console.log("📦 Respaldando territorios 1-22...");
    try {
        const terrSnap = await getDocs(collection(db, "territorios"));
        const backupData = [];

        terrSnap.forEach(d => {
            const data = d.data();
            const numStr = String(data.numero || '');
            const num = parseInt(numStr);

            if (num >= 1 && num <= 22) {
                backupData.push({
                    id: d.id,
                    numero: numStr,
                    manzanas: data.manzanas || '',
                    localidad: data.localidad || '',
                    geojson: data.geojson || null,
                    mapa_url: data.mapa_url || null,
                    puntos_interes: data.puntos_interes || []
                });
            }
        });

        fs.writeFileSync("territorios_backup.json", JSON.stringify(backupData, null, 2));
        console.log(`✅ Backup guardado en territorios_backup.json (${backupData.length} territorios).`);
        process.exit(0);
    } catch (e) {
        console.error("❌ Error en backup:", e);
        process.exit(1);
    }
}

backup();
