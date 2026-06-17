import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc, query, where } from "firebase/firestore";
import fs from 'fs';

// Read config from firebase-config.js
const configContent = fs.readFileSync('firebase-config.js', 'utf8');
const configMatch = configContent.match(/const firebaseConfig = ({[\s\S]+?});/);
if (!configMatch) {
    console.error("Could not find firebaseConfig in firebase-config.js");
    process.exit(1);
}

const firebaseConfig = eval('(' + configMatch[1] + ')');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function normalizeName(name) {
    if (!name) return "";
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function runHealer() {
    console.log("🚀 Starting database healing process...");

    // 1. Fetch all territories (Maestro)
    const terrSnap = await getDocs(collection(db, "territorios"));
    const maestroMapByNumber = {};
    const maestroMapById = {};

    terrSnap.docs.forEach(d => {
        const data = d.data();
        const tNum = String(data.numero || '').trim();
        const tId = d.id;
        const info = {
            id: tId,
            numero: tNum,
            estado: data.estado || data.status || 'Disponible',
            asignado_a: data.asignado_a || data.currentAssignee || null,
            ultima_fecha: data.ultima_fecha || null,
            fecha_asignacion: data.fecha_asignacion || data.assignmentDate || null
        };
        if (tNum) maestroMapByNumber[tNum] = info;
        maestroMapById[tId] = info;
    });

    console.log(`Fetched ${terrSnap.size} territories.`);

    // 2. Fetch all banco_s13 records
    const s13Snap = await getDocs(collection(db, "banco_s13"));
    console.log(`Fetched ${s13Snap.size} S-13 records.`);

    const s13Batch = writeBatch(db);
    let count = 0;
    let healedIdCount = 0;
    let healedNamesCount = 0;
    let autoClosedCount = 0;

    for (const d of s13Snap.docs) {
        const r = d.data();
        let updates = {};
        let dirty = false;

        // 1. ID healing (Firestore ID -> Territory Number)
        let tNum = null;
        if (maestroMapById[r.territorio_id]) {
            tNum = maestroMapById[r.territorio_id].numero;
            if (r.territorio_id !== tNum || r.numero !== tNum) {
                updates.territorio_id = tNum;
                updates.numero = tNum;
                updates.territorio_numero = tNum;
                dirty = true;
                healedIdCount++;
            }
        } else if (maestroMapById[r.numero]) {
            tNum = maestroMapById[r.numero].numero;
            if (r.territorio_id !== tNum || r.numero !== tNum) {
                updates.territorio_id = tNum;
                updates.numero = tNum;
                updates.territorio_numero = tNum;
                dirty = true;
                healedIdCount++;
            }
        } else {
            tNum = String(r.territorio_id || r.numero || '').trim();
        }

        // 2. Normalization of names
        if (r.conductor) {
            const normalized = normalizeName(r.conductor);
            if (r.conductor_normalized !== normalized) {
                updates.conductor_normalized = normalized;
                dirty = true;
                healedNamesCount++;
            }
        }
        if (r.auxiliar) {
            const normalized = normalizeName(r.auxiliar);
            if (r.auxiliar_normalized !== normalized) {
                updates.auxiliar_normalized = normalized;
                dirty = true;
                healedNamesCount++;
            }
        }

        // 3. S-13 auto-healing (Close S-13 if marked as Disponible in Maestro or reassigned)
        if (r.estado === 'Asignado' && tNum) {
            const m = maestroMapByNumber[tNum];
            if (m) {
                let shouldClose = false;
                let closeDate = null;

                if (m.estado === 'Disponible') {
                    shouldClose = true;
                    closeDate = m.ultima_fecha || r.fecha_asignacion || new Date().toISOString();
                } else if (m.estado === 'Asignado' && m.asignado_a && normalizeName(m.asignado_a) !== normalizeName(r.conductor)) {
                    shouldClose = true;
                    closeDate = m.fecha_asignacion || new Date().toISOString();
                }

                if (shouldClose) {
                    updates.estado = 'Completado';
                    updates.fecha_entrega = closeDate;
                    dirty = true;
                    autoClosedCount++;
                }
            }
        }

        if (dirty) {
            s13Batch.update(d.ref, updates);
            count++;
            if (count % 400 === 0) {
                await s13Batch.commit();
                console.log(`Committed partial batch of ${count} updates.`);
            }
        }
    }

    if (count % 400 !== 0) {
        await s13Batch.commit();
    }

    console.log(`✅ Healing complete. Total records updated: ${count}`);
    console.log(` - ID updates: ${healedIdCount}`);
    console.log(` - Name updates: ${healedNamesCount}`);
    console.log(` - Auto-closed active assignments: ${autoClosedCount}`);
}

runHealer().catch(console.error);
