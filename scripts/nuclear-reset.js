
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, writeBatch } from "firebase/firestore";

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

async function nuclearReset() {
    console.log("🚀 Iniciando Reset Nuclear...");

    try {
        // 1. Respaldar territorios 1-22
        console.log("📦 Respaldando territorios 1-22...");
        const terrSnap = await getDocs(collection(db, "territorios"));
        const backup = [];

        terrSnap.forEach(d => {
            const data = d.data();
            const numStr = String(data.numero || '');
            const num = parseInt(numStr);

            if (num >= 1 && num <= 22) {
                // Conservar solo lo esencial (Geografía y Metadatos)
                backup.push({
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
        console.log(`✅ Respaldo completado: ${backup.length} territorios encontrados.`);

        // 2. Función para borrar una colección completa
        const deleteCollection = async (colName) => {
            console.log(`🗑️ Borrando colección: ${colName}...`);
            const snap = await getDocs(collection(db, colName));
            let count = 0;
            const batch = writeBatch(db);
            snap.forEach(d => {
                batch.delete(d.ref);
                count++;
            });
            if (count > 0) await batch.commit();
            console.log(`✅ Colección ${colName} borrada (${count} documentos).`);
        };

        // 3. Ejecutar borrados
        await deleteCollection("historial_territorios");
        await deleteCollection("programa_semanal");
        await deleteCollection("territorios");

        // 4. Restaurar territorios 1-22 (Limpios)
        console.log("🏗️ Restaurando inventario base (1-22)...");
        const restoreBatch = writeBatch(db);
        backup.forEach(t => {
            const { id, ...cleanData } = t;
            const ref = doc(db, "territorios", id);
            restoreBatch.set(ref, cleanData);
        });
        await restoreBatch.commit();
        console.log("✅ Inventario 1-22 restaurado con éxito.");

        // 5. Inicializar colecciones nuevas (opcional, Firebase las crea al primer write)
        console.log("✨ Sistema listo para la nueva era unificada.");
        process.exit(0);

    } catch (e) {
        console.error("❌ ERROR CRÍTICO DURANTE EL RESET:", e);
        process.exit(1);
    }
}

nuclearReset();
