import { db } from '../../firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, getDoc, setDoc, orderBy, limit, Timestamp, writeBatch, runTransaction, arrayUnion } from "firebase/firestore";
import { ServiceCache } from './base-service.js';

const COL_TELEFONOS = "telefonos";

export const getMisTelefonos = async () => {
    // Return all for client-side filtering as dataset is small or implement query if needed
    const querySnapshot = await getDocs(collection(db, COL_TELEFONOS));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getTelefonosParaSesion = async (conductorName) => {
    try {
        if (!conductorName) return [];
        const phoneCol = collection(db, COL_TELEFONOS);

        // Let's only fetch phones explicitly requested by THIS conductor.
        const qSession = query(phoneCol,
            where("solicitado_por", "==", conductorName)
        );
        const snap = await getDocs(qSession);
        const dataSession = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let finalData = [...dataSession];

        const qAssigned = query(phoneCol, where("asignado_a", "==", conductorName));
        const snapAssigned = await getDocs(qAssigned);
        snapAssigned.forEach(d => {
            const docData = { id: d.id, ...d.data() };
            if (!finalData.find(existing => existing.id === d.id)) {
                finalData.push(docData);
            }
        });

        // Remove Revisita as requested by user
        return finalData.filter(d => d.estado !== 'Revisita');
    } catch (e) {
        console.error("Error fetching session phones:", e);
        return [];
    }
};

export const getTelefonos = async () => {
    const querySnapshot = await getDocs(collection(db, COL_TELEFONOS));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addTelefono = async (telefono) => {
    await addDoc(collection(db, COL_TELEFONOS), telefono);
};

export const solicitarNumeros = async (cantidad = 30, conductorName = null) => {
    try {
        const result = await runTransaction(db, async (transaction) => {
            const now = new Date();
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(now.getMonth() - 6);

            const q = query(collection(db, COL_TELEFONOS),
                where("estado", "==", "Sin asignar"),
                limit(cantidad * 10)
            );

            const snapshot = await getDocs(q);
            const selectedDocs = [];
            let count = 0;

            for (const d of snapshot.docs) {
                if (count >= cantidad) break;
                const data = d.data();
                if (data.publicador_asignado || data.asignado_a || data.estado === 'En Sesión') continue;
                if (data.ultimo_estado === 'No llamar') {
                    const lastDate = data.fecha_ultimo_estado ? new Date(data.fecha_ultimo_estado) : new Date(0);
                    if (lastDate > sixMonthsAgo) continue;
                }
                selectedDocs.push(d);
                count++;
            }

            if (selectedDocs.length === 0) return 0;

            selectedDocs.forEach(d => {
                transaction.update(d.ref, {
                    estado: 'En Sesión',
                    publicador_asignado: null,
                    asignado_a: null,
                    fecha_asignacion: now.toISOString(),
                    solicitado_por: conductorName
                });
            });

            return selectedDocs.length;
        });

        if (result === 0) {
            const resetDone = await checkAndResetTelephoneCycle(true);
            if (resetDone) return await solicitarNumeros(cantidad, conductorName);
        }

        ServiceCache.clear("telefonos");
        return result;
    } catch (error) {
        console.error("Error in solicitarNumeros transaction:", error);
        throw error;
    }
};

export const checkAndResetTelephoneCycle = async (forceRequested = false) => {
    try {
        const snapshot = await getDocs(collection(db, COL_TELEFONOS));
        const total = snapshot.docs.length;
        if (total === 0) return false;

        const processedRecords = snapshot.docs.filter(d => {
            const data = d.data();
            const hasStatus = data.estado && !['Sin asignar', 'En Sesión'].includes(data.estado);
            const isRequested = !!data.solicitado_por;
            return hasStatus || isRequested;
        });

        if (processedRecords.length >= total || forceRequested) {
            if (forceRequested) {
                const anyAvailable = snapshot.docs.some(d => {
                    const data = d.data();
                    return data.estado === 'Sin asignar' && (data.solicitado_por === null || data.solicitado_por === undefined);
                });
                if (anyAvailable) return false;
            }

            let batch = writeBatch(db);
            let operationCount = 0;
            const now = new Date().toISOString();

            for (const d of snapshot.docs) {
                const data = d.data();
                const currentStatus = data.estado;
                let updateData = null;

                if (!currentStatus || ['Contestaron', 'No contestan', 'Colgaron', 'Sin asignar'].includes(currentStatus)) {
                    updateData = {
                        estado: 'Sin asignar',
                        publicador_asignado: null,
                        asignado_a: null,
                        solicitado_por: null,
                        fecha_asignacion: null,
                        comentario: '',
                        ultima_observacion_ciclo: data.comentario || '',
                        fecha_ultimo_ciclo: now
                    };
                } else if (currentStatus === 'No llamar') {
                    updateData = {
                        ultimo_estado: 'No llamar',
                        estado: 'Sin asignar',
                        fecha_ultimo_estado: now,
                        publicador_asignado: null,
                        asignado_a: null,
                        solicitado_por: null
                    };
                }

                if (updateData) {
                    batch.update(doc(db, COL_TELEFONOS, d.id), updateData);
                    operationCount++;
                    if (operationCount >= 450) {
                        await batch.commit();
                        batch = writeBatch(db);
                        operationCount = 0;
                    }
                }
            }

            if (operationCount > 0) await batch.commit();
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error in cycle reset:", e);
        return false;
    }
};

export const logSessionSummary = async (summary) => {
    try {
        await addDoc(collection(db, "resumenes_sesion_telefonia"), {
            ...summary,
            timestamp: Timestamp.now(),
            fecha: new Date().toISOString()
        });
    } catch (e) {
        console.error("Error logging session summary:", e);
    }
};

export const getSessionSummaries = async () => {
    try {
        const q = query(collection(db, "resumenes_sesion_telefonia"), orderBy("timestamp", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("Error getting session summaries:", e);
        return [];
    }
};

export const releaseUnusedTelefonos = async (userId, globalCleanup = false, force = false) => {
    try {
        const phoneCol = collection(db, COL_TELEFONOS);
        const now = new Date();
        const staleThreshold = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)); // 2 days for En Sesion

        if (globalCleanup) {
            // General cleanup of old "Sin asignar" but requested numbers
            const twoDaysAgo = new Date();
            twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
            const q = query(phoneCol, where("estado", "in", ["Sin asignar", "En Sesión"]));
            const snap = await getDocs(q);
            const batchPromises = [];
            snap.docs.forEach(d => {
                const data = d.data();
                if (data.solicitado_por) {
                    const reqDate = data.fecha_asignacion ? new Date(data.fecha_asignacion) : null;
                    if (!reqDate || reqDate < twoDaysAgo) {
                        batchPromises.push(updateDoc(d.ref, {
                            solicitado_por: null,
                            fecha_asignacion: null,
                            asignado_a: null,
                            publicador_asignado: null,
                            estado: ''
                        }));
                    }
                }
            });
            if (batchPromises.length > 0) await Promise.all(batchPromises);
        }

        // Cleanup the specific user's session if it's stale or called explicitly
        if (userId) {
            const sessionQ = query(phoneCol,
                where("solicitado_por", "==", userId)
            );
            const sessionSnap = await getDocs(sessionQ);

            const releasePromises = [];
            sessionSnap.docs.forEach(d => {
                const data = d.data();
                const reqDate = data.fecha_asignacion ? new Date(data.fecha_asignacion) : null;

                // Release if stale OR if force flag is true (Finalizar context)
                if (!reqDate || reqDate < staleThreshold || force) {
                    if (data.estado === 'En Sesión') {
                        releasePromises.push(updateDoc(d.ref, {
                            estado: '',
                            solicitado_por: null,
                            fecha_asignacion: null,
                            publicador_asignado: null,
                            asignado_a: null
                        }));
                    } else {
                        // Release from session ownership but preserve existing interaction status
                        releasePromises.push(updateDoc(d.ref, {
                            solicitado_por: null,
                            fecha_asignacion: null
                        }));
                    }
                }
            });
            if (releasePromises.length > 0) await Promise.all(releasePromises);
        }
    } catch (e) {
        console.error("Error releasing telefonos:", e);
    }
};

export const autoCleanTelefonosData = async () => {
    try {
        const maintRef = doc(db, 'configuracion', 'mantenimiento_telefonia');
        const maintSnap = await getDoc(maintRef);
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        let shouldClean = false;
        if (!maintSnap.exists()) {
            shouldClean = true;
        } else {
            const data = maintSnap.data();
            const lastClean = data.last_clean_ms || 0;
            if (now - lastClean > TWENTY_FOUR_HOURS) {
                shouldClean = true;
            }
        }

        if (shouldClean) {
            console.log("🧹 [Phone Service] Iniciando auto-limpieza periódica 24h...");
            const corregidos = await repararTelefonosData();
            await setDoc(maintRef, { last_clean_ms: now }, { merge: true });
            console.log(`✨ [Phone Service] Auto-limpieza finalizada. ${corregidos} reparados.`);
        }
    } catch (e) {
        console.warn('Error en autoCleanTelefonosData:', e);
    }
};

export const repararTelefonosData = async () => {
    try {
        const snap = await getDocs(collection(db, COL_TELEFONOS));
        let batch = writeBatch(db);
        let count = 0;
        let operations = 0;

        snap.docs.forEach(d => {
            const data = d.data();
            let needsUpdate = false;
            let updateData = {};

            const eStr = String(data.estado || '').toLowerCase().trim();
            const isBlankState = (!eStr || eStr === 'sin asignar' || eStr === 'no asignado' || eStr === 'disponible' || eStr === 'null');

            // 1. Stuck "En Sesión" records (2 days)
            if (eStr === 'en sesión') {
                const reqDate = data.fecha_asignacion ? new Date(data.fecha_asignacion) : null;
                const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

                // Orphaned if: no date, older than 2 days, or entirely missing assignees
                if (!reqDate || reqDate < twoDaysAgo || (!data.asignado_a && !data.solicitado_por)) {
                    updateData.estado = '';
                    updateData.asignado_a = null;
                    updateData.publicador_asignado = null;
                    updateData.solicitado_por = null;
                    updateData.fecha_asignacion = null;
                    needsUpdate = true;
                }
            }
            // 2. Clear out completely empty or legacy blank states
            else if (isBlankState) {
                if (data.estado !== '') {
                    updateData.estado = '';
                    needsUpdate = true;
                }

                // Si está en blanco pero tiene un asignado/solicitado, verificar si es rehén (5 días)
                if (data.asignado_a || data.solicitado_por || data.publicador_asignado || data.fecha_asignacion) {
                    const reqDate = data.fecha_asignacion ? new Date(data.fecha_asignacion) : null;
                    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

                    if (!reqDate || reqDate < fiveDaysAgo) {
                        updateData.asignado_a = null;
                        updateData.publicador_asignado = null;
                        updateData.solicitado_por = null;
                        updateData.fecha_asignacion = null;
                        needsUpdate = true;
                    }
                }
            }
            // 3. Smart Recycling (No Llamar / Revisita > 6 months, No Contestan > 3 months)
            else {
                const now = new Date();
                const lastStatusDateStr = data.fecha_ultimo_estado || data.fecha_asignacion;
                if (lastStatusDateStr) {
                    const lastStatusDate = new Date(lastStatusDateStr);
                    const diffDays = (now - lastStatusDate) / (1000 * 60 * 60 * 24);

                    if ((data.estado === 'No llamar' || data.estado === 'Revisita') && diffDays >= 180) {
                        updateData.estado = '';
                        updateData.asignado_a = null;
                        updateData.publicador_asignado = null;
                        updateData.solicitado_por = null;
                        updateData.fecha_asignacion = null;
                        needsUpdate = true;
                    }
                    else if (data.estado === 'No contestan' && diffDays >= 90) {
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
                operations++;
                count++;
            }

            if (operations >= 450) {
                batch.commit().catch(e => console.warn(e)); // Fire and forget part of batch
                batch = writeBatch(db);
                operations = 0;
            }
        });

        if (operations > 0) {
            await batch.commit();
        }
        return count;
    } catch (e) {
        console.error("Error repairing telefonos:", e);
        throw e;
    }
};

export const releaseTelefonosById = (ids) => {
    try {
        if (!ids || ids.length === 0) return;
        const batch = writeBatch(db);
        ids.forEach(id => {
            batch.update(doc(db, COL_TELEFONOS, id), {
                estado: '',
                solicitado_por: null,
                fecha_asignacion: null,
                publicador_asignado: null,
                asignado_a: null
            });
        });
        // Fire and forget, useful for unload events where awaits get cancelled
        batch.commit().catch(e => console.warn(e));
    } catch (e) {
        console.warn("Error rapid release", e);
    }
};

export const updateTelefonoStatus = async (id, estado, publicadorName, comentario = null) => {
    const data = {};
    if (estado !== undefined && estado !== null) {
        data.estado = String(estado).toLowerCase() === 'null' ? '' : estado;
        data.fecha_ultimo_estado = new Date().toISOString();
        if (data.estado === 'No llamar') {
            data.ultimo_estado = 'No llamar';
        }
    }

    if (publicadorName !== undefined && publicadorName !== null) {
        let finalName = publicadorName;
        if (publicadorName.length > 20) {
            try {
                const pubDoc = await getDoc(doc(db, "publicadores", publicadorName));
                if (pubDoc.exists()) finalName = pubDoc.data().nombre;
            } catch (e) {
                console.warn(`Could not resolve pub ID ${publicadorName} `);
            }
        }
        data.asignado_a = finalName;
        data.publicador_asignado = finalName;
    }

    if (comentario !== null && comentario.trim().length > 0) {
        data.comentario = comentario;
        data.comentarios_historial = arrayUnion({
            nota: comentario,
            fecha: new Date().toISOString(),
            publicador: data.asignado_a || 'Anónimo'
        });
    }

    if (estado === 'Suspendido' || estado === 'Testigo') {
        await deleteDoc(doc(db, COL_TELEFONOS, id));
        return;
    }

    if (estado === 'Sin asignar' || data.estado === 'Sin asignar') {
        data.publicador_asignado = null;
        data.asignado_a = null;
        data.fecha_asignacion = null;
        data.solicitado_por = null;
    }

    await updateDoc(doc(db, COL_TELEFONOS, id), data);
    await checkAndResetTelephoneCycle();
};

export const deleteTelefono = async (id) => {
    await deleteDoc(doc(db, COL_TELEFONOS, id));
};

export const updateTelefono = async (id, data) => {
    await updateDoc(doc(db, COL_TELEFONOS, id), data);
};

export const devolverTelefono = async (id) => {
    await updateDoc(doc(db, COL_TELEFONOS, id), {
        asignado_a: null,
        publicador_asignado: null,
        estado: 'Sin asignar',
        fecha_asignacion: null
    });
};
