import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDocs, collection, writeBatch } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

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
const auth = getAuth(app);

async function run() {
    try {
        console.log("🔐 Autenticando para limpieza profunda de BD...");
        await signInAnonymously(auth);

        console.log("📥 Obteniendo registros de teléfonos...");
        const snap = await getDocs(collection(db, "telefonos"));

        console.log(`🔍 Escaneando ${snap.docs.length} registros...`);
        let batch = writeBatch(db);
        let count = 0;
        let ops = 0;

        snap.docs.forEach(d => {
            const data = d.data();
            let needsUpdate = false;
            let updateData = {};

            const eStr = String(data.estado || '').toLowerCase().trim();
            const isBlankState = (!eStr || eStr === 'sin asignar' || eStr === 'no asignado' || eStr === 'disponible' || eStr === 'null');

            // 1. Convert all weird blanks to true blanks "" (to ensure the UI and systems don't have dangling strings)
            if (isBlankState && data.estado !== '') {
                updateData.estado = '';
                needsUpdate = true;
            }

            // 2. Clear out completely empty or legacy blank states that have zombie assignees
            if (isBlankState || eStr === 'en sesión') {
                const reqDate = data.fecha_asignacion ? new Date(data.fecha_asignacion) : null;
                const staleThreshold = new Date(Date.now() - 1 * 60 * 60 * 1000); // For script, clean anything older than 1 HOUR or NO date

                // If blank state but it has fields
                if (isBlankState && (data.asignado_a || data.solicitado_por || data.publicador_asignado || data.fecha_asignacion)) {
                    updateData.asignado_a = null;
                    updateData.publicador_asignado = null;
                    updateData.solicitado_por = null;
                    updateData.fecha_asignacion = null;
                    needsUpdate = true;
                }

                // If En Sesión, check if it's dead
                if (eStr === 'en sesión') {
                    if (!reqDate || reqDate < staleThreshold || (!data.asignado_a && !data.solicitado_por)) {
                        updateData.estado = '';
                        updateData.asignado_a = null;
                        updateData.publicador_asignado = null;
                        updateData.solicitado_por = null;
                        updateData.fecha_asignacion = null;
                        needsUpdate = true;
                    }
                }
            }

            if (needsUpdate) {
                batch.update(d.ref, updateData);
                ops++;
                count++;
            }

            if (ops >= 400) {
                batch.commit().catch(e => console.warn(e)); // Fire and forget part of batch
                batch = writeBatch(db);
                ops = 0;
            }
        });

        if (ops > 0) {
            await batch.commit();
        }

        console.log(`✅ ¡Limpieza de Firebase finalizada! ${count} documentos reparados.`);
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed to run script:", e);
        process.exit(1);
    }
}

run();
