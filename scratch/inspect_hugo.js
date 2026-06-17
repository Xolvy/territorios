import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, query, where, getDoc } from "firebase/firestore";
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

async function inspectHugo() {
    console.log("=== INSPECTING HUGO MÁRQUEZ DATA IN FIRESTORE ===");
    
    // 1. Check presence_conductores
    console.log("\nChecking presence_conductores:");
    const presenceSnap = await getDocs(collection(db, "presencia_conductores"));
    presenceSnap.forEach(d => {
        const data = d.data();
        if (data.nombre && (data.nombre.toLowerCase().includes("hugo") || data.nombre.toLowerCase().includes("marquez"))) {
            console.log(`Presence Doc ID: "${d.id}":`, JSON.stringify(data, null, 2));
        }
    });

    // 2. Check telefonos collection for solicited_por matching Hugo
    console.log("\nChecking telefonos with solicitado_por containing 'Hugo':");
    const phoneSnap = await getDocs(collection(db, "telefonos"));
    let count = 0;
    phoneSnap.forEach(d => {
        const data = d.data();
        const solicited = data.solicitado_por || '';
        const assigned = data.asignado_a || '';
        const publisher = data.publicador_asignado || '';
        
        const matchesHugo = solicited.toLowerCase().includes("hugo") || 
                            solicited.toLowerCase().includes("marquez") ||
                            assigned.toLowerCase().includes("hugo") ||
                            assigned.toLowerCase().includes("marquez");
                            
        if (matchesHugo) {
            count++;
            console.log(`Phone: ${data.telefono} (ID: ${d.id}) | estado: "${data.estado}" | solicitado_por: "${data.solicitado_por}" | asignado_a: "${data.asignado_a}"`);
        }
    });
    console.log(`Total matching phones: ${count}`);
}

inspectHugo().catch(console.error);
