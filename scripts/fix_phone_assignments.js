import { db } from '../firebase-config.js';
import { collection, getDocs, writeBatch, doc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function fixPhoneAssignments() {
    console.log("🔍 Iniciando corrección de registros telefónicos...");
    const q = query(collection(db, "telefonos"), where("estado", "==", "Sin asignar"));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach((d) => {
        const data = d.data();
        // If status is Sin asignar but has someone assigned, clear it
        if (data.asignado_a || data.publicador_asignado || data.solicitado_por) {
            batch.update(doc(db, "telefonos", d.id), {
                asignado_a: null,
                publicador_asignado: null,
                solicitado_por: null,
                fecha_asignacion: null
            });
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`✅ Se corrigieron ${count} registros.`);
    } else {
        console.log("✨ No se encontraron registros para corregir.");
    }
}

// Para ejecutar este script, puedes copiar y pegar el contenido de la función fixPhoneAssignments
// en la consola del navegador mientras la aplicación está abierta.
export { fixPhoneAssignments };
