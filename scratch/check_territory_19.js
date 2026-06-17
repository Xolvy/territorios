import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
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
    console.log("=== MASTER TERRITORIOS (T19) ===");
    const q1 = query(collection(db, "territorios"), where("numero", "==", "19"));
    const snap1 = await getDocs(q1);
    snap1.forEach(d => {
        console.log(`[Territorios] Doc ID: ${d.id}`, JSON.stringify(d.data(), null, 2));
    });

    console.log("\n=== BANCO S13 (T19) ===");
    const q2 = query(collection(db, "banco_s13"), where("territorio_id", "==", "19"));
    const snap2 = await getDocs(q2);
    snap2.forEach(d => {
        console.log(`[Banco S13] Doc ID: ${d.id}`, JSON.stringify(d.data(), null, 2));
    });
}

run().catch(console.error);
