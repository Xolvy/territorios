import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
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

async function run() {
    console.log("=== INICIANDO MEZCLA DE TERRITORIO 19 ===");
    const q1 = query(collection(db, "territorios"), where("numero", "==", "19"));
    const snap1 = await getDocs(q1);

    if (snap1.size <= 1) {
        console.log(`Se encontraron ${snap1.size} documentos. No se requiere mezcla.`);
        return;
    }

    console.log(`Se encontraron ${snap1.size} documentos para el territorio 19.`);

    // Agrupar manzanas y ordenar documentos (dejar el que tiene origen_id nulo o el ID original como master)
    const docs = [];
    snap1.forEach(d => {
        docs.push({ id: d.id, data: d.data() });
    });

    // Ordenar de forma que el master sea el que NO tiene origen_id, o el que tiene ID más corto o más antiguo
    docs.sort((a, b) => {
        const aHasOrigen = !!a.data.origen_id;
        const bHasOrigen = !!b.data.origen_id;
        if (aHasOrigen && !bHasOrigen) return 1;
        if (!aHasOrigen && bHasOrigen) return -1;
        return a.id.localeCompare(b.id);
    });

    const masterDoc = docs[0];
    const duplicates = docs.slice(1);

    console.log(`Master Documento seleccionado: ${masterDoc.id}`);
    console.log(`Documentos duplicados a eliminar:`, duplicates.map(d => d.id));

    // Recolectar todas las manzanas
    const allManzanas = new Set();
    docs.forEach(d => {
        const mzs = d.data.manzanas ? d.data.manzanas.split(',').map(m => m.trim()).filter(Boolean) : [];
        mzs.forEach(m => allManzanas.add(m));
    });

    // Ordenar numéricamente si son números, de lo contrario alfabéticamente
    const sortedManzanas = Array.from(allManzanas).sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return a.localeCompare(b);
    });

    const mergedManzanasStr = sortedManzanas.join(', ');
    console.log(`Manzanas unificadas resultantes: "${mergedManzanasStr}"`);

    // Ejecutar lote atómico de escritura
    const batch = writeBatch(db);

    // Actualizar master
    const masterRef = doc(db, "territorios", masterDoc.id);
    batch.update(masterRef, {
        manzanas: mergedManzanasStr,
        estado: 'Disponible',
        asignado_a: null,
        asignado_a_normalized: null,
        currentAssignee: null,
        auxiliar: null,
        auxiliar_normalized: null,
        fecha_asignacion: null,
        assignmentDate: null,
        is_incomplete: false,
        origen_id: null
    });

    // Eliminar duplicados
    duplicates.forEach(d => {
        const dupRef = doc(db, "territorios", d.id);
        batch.delete(dupRef);
    });

    await batch.commit();
    console.log("=== MEZCLA DE TERRITORIO 19 COMPLETADA CON ÉXITO ===");
}

run().catch(console.error);
