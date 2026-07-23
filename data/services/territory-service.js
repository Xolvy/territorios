import {
    addDoc,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../firebase-config.js";
import { normalizeName } from "../../modules/utils/helpers.js";
import { saveAuditLog } from "./audit-service.js";
import { fetchCached, ServiceCache } from "./base-service.js";
import { logAssignment, logReturn } from "./history-service.js";
import { syncAssignmentToWeeklyProgram } from "./program-service.js";

const COL_TERRITORIOS = "territorios";
const COL_BANCO_S13 = "banco_s13";

// --- XOLVY SHIELD: GLOBAL AGGREGATIONS (Moved to internal transaction logic) ---
// updateGlobalStats removed to prevent Firestore transaction violations (Reads before Writes)

export const getGlobalStats = async () => {
    return fetchCached("stats_globales", async () => {
        const snap = await getDoc(doc(db, "configuracion", "stats_globales"));
        return snap.exists() ? snap.data() : { territorios_asignados: 0, territorios_disponibles: 0 };
    });
};

const normalizeTerritorioData = (id, data, latestAssignment = null) => {
    let geojson = data.geojson;
    if (typeof geojson === "string") {
        try {
            geojson = JSON.parse(geojson);
        } catch (_e) {
            geojson = null;
        }
    }
    const numeroStr = String(data.numero || "");

    // Aislamiento de Scope: Priorizamos los campos del Live Pool (S-13)
    // pero permitimos lectura del Maestro con los nuevos nombres
    const estado = latestAssignment ? latestAssignment.estado : data.status || data.estado || "Disponible";
    const asignado_a = latestAssignment ? latestAssignment.conductor : data.currentAssignee || data.asignado_a || null;
    const fecha_asignacion = latestAssignment
        ? latestAssignment.fecha_asignacion
        : data.assignmentDate || data.fecha_asignacion || null;
    const fecha_salida = latestAssignment ? latestAssignment.fecha_salida || null : data.fecha_salida || null;
    const auxiliar = latestAssignment ? latestAssignment.auxiliar || null : data.auxiliar || null;
    const asignado_a_normalized = asignado_a ? normalizeName(asignado_a) : null;
    const auxiliar_normalized = auxiliar ? normalizeName(auxiliar) : null;

    return {
        id,
        numero: numeroStr,
        manzanas: data.manzanas || "",
        manzanas_trabajadas: data.manzanas_trabajadas || [],
        localidad: data.localidad || "",
        geojson: geojson,
        imagen: (() => {
            const rawImg = data.imagen || data.mapa_url || data.imagen_url || null;
            return typeof rawImg === "string" && (rawImg === "null" || rawImg === "undefined" || !rawImg.trim()) ? null : rawImg;
        })(),
        estado: estado,
        asignado_a: asignado_a,
        asignado_a_normalized: asignado_a_normalized,
        auxiliar: auxiliar,
        auxiliar_normalized: auxiliar_normalized,
        fecha_asignacion: fecha_asignacion,
        fecha_salida: fecha_salida,
        last_assignment: latestAssignment,
        // Alisos para nuevos nombres
        status: estado,
        currentAssignee: asignado_a,
        assignmentDate: fecha_asignacion,
        // Datos puros del Maestro (para Recepción estricta)
        master_status: data.status || data.estado || "Disponible",
        master_assignee: data.currentAssignee || data.asignado_a || null,
        master_date: data.assignmentDate || data.fecha_asignacion || null,
    };
};

export const getTerritorios = async () => {
    return fetchCached("territorios_combined", async () => {
        try {
            const [terrSnap, bancoSnap] = await Promise.all([
                getDocs(collection(db, COL_TERRITORIOS)),
                getDocs(query(collection(db, COL_BANCO_S13), where("estado", "==", "Asignado"))),
            ]);
            const activeAssignments = {};
            bancoSnap.docs.forEach((d) => {
                const data = d.data();
                const key = data.territorio_doc_id || data.territorio_id;
                activeAssignments[String(key)] = { ...data, id: d.id };
            });

            const allNormalized = terrSnap.docs
                .map((doc) => normalizeTerritorioData(doc.id, doc.data(), activeAssignments[String(doc.id)] || activeAssignments[String(doc.data().numero)]))
                .filter((t) => t.numero && String(t.numero).trim().length > 0);

            // Merge Multi-Doc Records & Deduplicate by Territory Number
            const uniqueMap = new Map();
            allNormalized.forEach((t) => {
                const cleanNum = String(t.numero).trim();
                if (!uniqueMap.has(cleanNum)) {
                    uniqueMap.set(cleanNum, t);
                } else {
                    const existing = uniqueMap.get(cleanNum);
                    // Merge GeoJSON features from split documents
                    let geo1 = existing.geojson;
                    if (typeof geo1 === "string" && geo1.trim().startsWith("{")) {
                        try { geo1 = JSON.parse(geo1); } catch (_e) { geo1 = null; }
                    }
                    let geo2 = t.geojson;
                    if (typeof geo2 === "string" && geo2.trim().startsWith("{")) {
                        try { geo2 = JSON.parse(geo2); } catch (_e) { geo2 = null; }
                    }

                    let mergedFeatures = [];
                    if (geo1 && Array.isArray(geo1.features)) mergedFeatures.push(...geo1.features);
                    if (geo2 && Array.isArray(geo2.features)) mergedFeatures.push(...geo2.features);

                    const featMap = new Map();
                    mergedFeatures.forEach((f, idx) => {
                        const featKey = f.geometry?.coordinates ? JSON.stringify(f.geometry.coordinates) : `idx_${idx}`;
                        if (!featMap.has(featKey)) featMap.set(featKey, f);
                    });

                    const finalFeatures = Array.from(featMap.values());
                    const mergedGeoJSON = finalFeatures.length > 0 ? {
                        type: "FeatureCollection",
                        features: finalFeatures
                    } : (geo1 || geo2);

                    const m1 = String(existing.manzanas || "").trim();
                    const m2 = String(t.manzanas || "").trim();
                    const mergedManzanas = Array.from(new Set([...m1.split(","), ...m2.split(",")].map(s => s.trim()).filter(Boolean))).join(", ");

                    uniqueMap.set(cleanNum, {
                        ...existing,
                        geojson: mergedGeoJSON,
                        manzanas: mergedManzanas || existing.manzanas || t.manzanas,
                        imagen: existing.imagen || t.imagen,
                        localidad: existing.localidad || t.localidad,
                    });
                }
            });

            const resultList = Array.from(uniqueMap.values());

            // Specific Rule for Territorio 22: Enforce max 3 manzanas (remove Mz. 4 if present)
            resultList.forEach((t) => {
                if (String(t.numero).trim() === "22") {
                    if (t.geojson && Array.isArray(t.geojson.features)) {
                        t.geojson.features = t.geojson.features.filter((f) => {
                            const name = String(f.properties?.name || f.properties?.id || "").toLowerCase();
                            return !name.includes("mz. 4") && !name.includes("mz 4") && !name.includes("manzana 4");
                        });
                    }
                    if (t.manzanas) {
                        const mzList = String(t.manzanas)
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s && s !== "4" && s !== "Mz. 4" && s !== "Mz 4" && s !== "Manzana 4");
                        t.manzanas = mzList.join(", ");
                    }
                }
            });

            return resultList.sort(
                (a, b) => parseInt(a.numero, 10) - parseInt(b.numero, 10)
            );
        } catch (e) {
            console.error("Critical error fetching territories:", e);
            return [];
        }
    });
};

export const addTerritorio = async (territorio) => {
    ServiceCache.clear("territorios");
    await addDoc(collection(db, COL_TERRITORIOS), territorio);
};

export const updateTerritorio = async (id, data) => {
    ServiceCache.clear("territorios");
    await updateDoc(doc(db, COL_TERRITORIOS, id), data);
};

export const updateTerritoryGeoJSON = async (numero, geojson) => {
    try {
        ServiceCache.clear("territorios");
        const q = query(collection(db, COL_TERRITORIOS), where("numero", "==", String(numero)));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const id = snap.docs[0].id;
            const serializedGeoJSON = JSON.stringify(geojson);
            await updateDoc(doc(db, COL_TERRITORIOS, id), { geojson: serializedGeoJSON });
            return id;
        }
        return null;
    } catch (e) {
        console.error("Error updating territory GeoJSON:", e);
        throw e;
    }
};

export const uploadMapPNG = async (file, territoryNum) => {
    try {
        const ext = file.name.split(".").pop();
        const fileRef = ref(storage, `mapas/T-${territoryNum}-${Date.now()}.${ext}`);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
    } catch (e) {
        console.error("Error uploading map PNG:", e);
        throw e;
    }
};

export const addTerritoryReference = async (territoryId, reference) => {
    try {
        await updateDoc(doc(db, COL_TERRITORIOS, territoryId), {
            referencias: arrayUnion(reference),
        });
        return true;
    } catch (e) {
        console.error("Error adding territory reference:", e);
        throw e;
    }
};

export const deleteTerritorio = async (id) => {
    try {
        ServiceCache.clear("territorios");
        ServiceCache.clear("puntos_interes");
        ServiceCache.clear("historial");
        ServiceCache.clear("programa");

        const tSnap = await getDoc(doc(db, COL_TERRITORIOS, id));
        if (!tSnap.exists()) return;
        const tNum = String(tSnap.data().numero || "").trim();

        const batch = writeBatch(db);
        batch.delete(doc(db, COL_TERRITORIOS, id));

        const histQuery = query(collection(db, COL_BANCO_S13), where("territorio_id", "==", tNum));
        const histSnap = await getDocs(histQuery);
        histSnap.forEach((d) => batch.delete(d.ref));

        const poiQuery = query(collection(db, "puntos_interes"), where("territorio_id", "==", id));
        const poiSnap = await getDocs(poiQuery);
        poiSnap.forEach((d) => batch.delete(d.ref));

        // Scrub from Weekly Program
        const turnos = ["manana", "tarde", "noche", "zoom"];
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));

        for (let i = -8; i <= 4; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i * 7);
            const weekId = d.toISOString().split("T")[0];
            const progRef = doc(db, "programa_semanal", weekId);
            const pSnap = await getDoc(progRef);

            if (pSnap.exists()) {
                const prog = pSnap.data();
                let wasModified = false;
                if (Array.isArray(prog.dias)) {
                    prog.dias.forEach((dia) => {
                        turnos.forEach((turno) => {
                            const slot = dia[turno];
                            if (slot?.territorio) {
                                const terrs = String(slot.territorio)
                                    .split(/ \/ | \/|,/)
                                    .map((s) => s.trim());
                                if (terrs.includes(tNum)) {
                                    const newTerrs = terrs.filter((s) => s !== tNum);
                                    slot.territorio = newTerrs.join(" / ");
                                    if (newTerrs.length === 0) {
                                        slot.conductor = "";
                                        slot.auxiliar = "";
                                        slot.lugar = "";
                                        slot.hora = "";
                                        slot.faceta = "";
                                    }
                                    wasModified = true;
                                }
                            }
                        });
                    });
                }
                if (wasModified) batch.set(progRef, prog);
            }
        }
        await batch.commit();
        return true;
    } catch (e) {
        console.error("Critical error in master territory deletion:", e);
        throw e;
    }
};

export const getPuntosInteres = async () => {
    return fetchCached("puntos_interes", async () => {
        const querySnapshot = await getDocs(collection(db, "puntos_interes"));
        return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    });
};

export const addPuntoInteres = async (punto) => {
    ServiceCache.clear("puntos_interes");
    await addDoc(collection(db, "puntos_interes"), punto);
};

export const updatePuntoInteres = async (id, data) => {
    ServiceCache.clear("puntos_interes");
    await updateDoc(doc(db, "puntos_interes", id), data);
};

export const deletePuntoInteres = async (id) => {
    ServiceCache.clear("puntos_interes");
    await deleteDoc(doc(db, "puntos_interes", id));
};

export const assignTerritorio = async (id, conductorName, details = {}) => {
    try {
        const tRef = doc(db, COL_TERRITORIOS, id);
        const tSnap = await getDoc(tRef);
        if (!tSnap.exists()) throw new Error("Territorio no encontrado");
        const tData = tSnap.data();

        const assignmentData = {
            territorio_id: String(tData.numero),
            territorio_doc_id: id,
            conductor: conductorName,
            conductor_normalized: normalizeName(conductorName),
            fecha_asignacion: details.fecha_asignacion || new Date().toISOString(),
            fecha_salida: details.fecha_salida || null,
            fecha_entrega: null,
            estado: "Asignado",
            turno: details.turno || "Sin turno",
            observaciones: details.observaciones || "",
            faceta: details.faceta || "Casa en casa",
            weekId: details.weekId || null,
            timestamp: Timestamp.now(),
        };
        if (details.auxiliar) {
            assignmentData.auxiliar = details.auxiliar;
            assignmentData.auxiliar_normalized = normalizeName(details.auxiliar);
        }

        const docRef = await addDoc(collection(db, COL_BANCO_S13), assignmentData);
        await saveAuditLog("ASIGNACION_MANUAL", { territorio: tData.numero, conductor: conductorName });

        // Update Maestro
        await updateDoc(tRef, {
            estado: "Asignado",
            status: "Asignado",
            asignado_a: conductorName,
            asignado_a_normalized: normalizeName(conductorName),
            currentAssignee: conductorName,
            fecha_asignacion: assignmentData.fecha_asignacion,
            assignmentDate: assignmentData.fecha_asignacion,
            fecha_salida: details.fecha_salida || null,
            auxiliar: details.auxiliar || null,
            auxiliar_normalized: details.auxiliar ? normalizeName(details.auxiliar) : null,
            turno: details.turno || "Sin turno",
            lastUpdated: serverTimestamp(),
        });

        ServiceCache.clear("territorios_combined");
        return docRef.id;
    } catch (e) {
        console.error("Error al asignar:", e);
        throw e;
    }
};

export const returnTerritorio = async (
    id,
    notes,
    customDate,
    status = "Completado",
    fotos = null,
    conductorOverride = null,
) => {
    try {
        const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();

        // PRE-TRANSACTION: Query banco_s13 active assignments (queries not allowed inside transactions)
        const tPreSnap = await getDoc(doc(db, COL_TERRITORIOS, id));
        if (!tPreSnap.exists()) {
            console.warn(`[returnTerritorio] Territorio ${id} no existe.`);
            return;
        }
        const tNumero = String(tPreSnap.data().numero || "");

        let bancoDocRefs = [];
        if (tNumero) {
            let bancoSnap = await getDocs(query(
                collection(db, COL_BANCO_S13),
                where("territorio_doc_id", "==", id),
                where("estado", "==", "Asignado"),
            ));
            if (bancoSnap.empty) {
                bancoSnap = await getDocs(query(
                    collection(db, COL_BANCO_S13),
                    where("territorio_id", "==", tNumero),
                    where("estado", "==", "Asignado"),
                ));
            }
            bancoDocRefs = bancoSnap.docs.map((d) => d.ref);
        }

        // ATOMIC TRANSACTION: All reads and writes in a single pass
        const conductorName = await runTransaction(db, async (transaction) => {
            const tRef = doc(db, COL_TERRITORIOS, id);
            const statsRef = doc(db, "configuracion", "stats_globales");

            // --- FASE 1: LECTURAS (Strictly first) ---
            const readPromises = [transaction.get(tRef), transaction.get(statsRef)];
            // Also read all banco_s13 docs inside the transaction for consistency
            bancoDocRefs.forEach((ref) => readPromises.push(transaction.get(ref)));

            const [tSnap, statsSnap, ...bancoSnaps] = await Promise.all(readPromises);

            if (!tSnap.exists()) return null;
            const tData = tSnap.data();
            const prevConductor = tData.asignado_a || null;

            // --- FASE 2: ESCRITURAS (Strictly last) ---
            // Update /territorios
            const updates = {
                asignado_a: null,
                asignado_a_normalized: null,
                fecha_asignacion: null,
                auxiliar: null,
                auxiliar_normalized: null,
                lugar: null,
                hora: null,
                faceta: null,
                turno: null,
                estado: status === "Perdido" ? "Extraviado" : "Disponible",
                prog_sync: null,
            };
            if (status !== "Disponible") {
                updates.ultima_fecha = dateToUse;
            }
            transaction.update(tRef, updates);

            // Update Global Stats atomically
            if (tData.estado === "Asignado") {
                if (statsSnap.exists()) {
                    const statsData = statsSnap.data();
                    transaction.update(statsRef, {
                        territorios_disponibles: (statsData.territorios_disponibles || 0) + 1,
                        territorios_asignados: Math.max(0, (statsData.territorios_asignados || 0) - 1),
                    });
                } else {
                    transaction.set(
                        statsRef,
                        {
                            territorios_disponibles: 1,
                            territorios_asignados: 0,
                            total_territorios: 0,
                        },
                        { merge: true },
                    );
                }
            }

            // Update /banco_s13 — ATOMICALLY inside the same transaction
            const bancoEstado =
                status === "Completado" ? "Completado" : status === "Perdido" ? "Extraviado" : "Disponible";
            bancoSnaps.forEach((bSnap, idx) => {
                if (bSnap.exists()) {
                    transaction.update(bancoDocRefs[idx], {
                        estado: bancoEstado,
                        fecha_entrega: dateToUse,
                        timestamp_entrega: serverTimestamp(),
                        observaciones: notes || bSnap.data().observaciones || null,
                        fotos: fotos || bSnap.data().fotos || null,
                    });
                }
            });

            // Write observation log atomically inside the transaction if notes are provided
            if (notes && notes.trim().length > 0) {
                const obsRef = doc(collection(db, "bitacora_observaciones"));
                transaction.set(obsRef, {
                    territorio_id: tNumero,
                    conductor: prevConductor || "Anónimo",
                    nota: notes,
                    fecha: dateToUse,
                    timestamp: serverTimestamp(),
                });
            }

            if (bancoSnaps.length > 0) {
                console.log(
                    `✅ [returnTerritorio] banco_s13 cerrado atómicamente para territorio ${tNumero} (${bancoSnaps.filter((s) => s.exists()).length} registro(s))`,
                );
            }

            return prevConductor;
        });

        // Post-transaction: Audit log (non-critical, best-effort)
        const finalConductor = conductorOverride || conductorName;
        try {
            await saveAuditLog("ENTREGA_TERRITORIO", { territorio: tNumero, conductor: finalConductor });
        } catch (logError) {
            console.error(`🟡 [returnTerritorio] saveAuditLog falló para territorio ${tNumero}:`, logError);
        }
        ServiceCache.clear("territorios");
        ServiceCache.clear("territorios_combined");
        ServiceCache.clear("historial");
        ServiceCache.clear("stats_globales");
    } catch (e) {
        console.error("Atomic transaction failed in returnTerritorio:", e);
        throw e;
    }
};

export const resyncGlobalStats = async () => {
    try {
        const [allTerrs, bancoSnap] = await Promise.all([
            getDocs(collection(db, COL_TERRITORIOS)),
            getDocs(query(collection(db, COL_BANCO_S13), where("estado", "==", "Asignado"))),
        ]);

        const activeIds = new Set(
            bancoSnap.docs.map((d) => {
                const data = d.data();
                return String(data.territorio_doc_id || data.territorio_id || "").trim();
            }),
        );

        const batch = writeBatch(db);
        let correctedCount = 0;
        let finalAssigned = 0;

        allTerrs.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const tNum = String(data.numero || "").trim();
            const isAssignedInMaster = data.estado === "Asignado" || data.status === "Asignado";
            const hasActiveAssignment = activeIds.has(docSnap.id) || activeIds.has(tNum);

            if (isAssignedInMaster && !hasActiveAssignment) {
                // Healer Logic: Si el maestro dice asignado pero no hay registro en el pool S-13, liberar.
                batch.update(docSnap.ref, {
                    estado: "Disponible",
                    status: "Disponible",
                    asignado_a: null,
                    currentAssignee: null,
                    fecha_asignacion: null,
                    assignmentDate: null,
                });
                correctedCount++;
            } else if (hasActiveAssignment) {
                finalAssigned++;
            }
        });

        if (correctedCount > 0) {
            await batch.commit();
            console.log(`🛡️ [S-13 Healer] Se corrigieron ${correctedCount} estados huérfanos.`);
        }

        const available = allTerrs.docs.length - finalAssigned;
        await setDoc(
            doc(db, "configuracion", "stats_globales"),
            {
                territorios_asignados: finalAssigned,
                territorios_disponibles: available,
                total_territorios: allTerrs.docs.length,
                last_sync: Timestamp.now(),
                healed_count: correctedCount,
            },
            { merge: true },
        );

        ServiceCache.clear("stats_globales");
        ServiceCache.clear("territorios_combined");
        return { assigned: finalAssigned, available, healed: correctedCount };
    } catch (e) {
        console.error("Error resyncing global stats:", e);
        throw e;
    }
};

export const getMisTerritorios = async (conductorName) => {
    const q = query(collection(db, COL_TERRITORIOS), where("asignado_a", "==", conductorName));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const takeTerritoryPartial = async (originalId, userId, takenManzanas, remainingManzanas) => {
    const territoryRef = doc(db, COL_TERRITORIOS, originalId);
    const territorySnap = await getDoc(territoryRef);
    if (!territorySnap.exists()) throw new Error("Territorio no encontrado");
    const tData = territorySnap.data();

    const newDocParams = {
        ...tData,
        manzanas: takenManzanas.join(", "),
        estado: "Asignado",
        asignado_a: userId,
        asignado_a_normalized: normalizeName(userId),
        fecha_asignacion: new Date().toISOString(),
        origen_id: originalId,
    };
    delete newDocParams.id;
    delete newDocParams.is_incomplete;

    const newDocRef = await addDoc(collection(db, COL_TERRITORIOS), newDocParams);

    if (remainingManzanas.length > 0) {
        await updateDoc(territoryRef, {
            manzanas: remainingManzanas.join(", "),
            estado: "Libre",
            is_incomplete: true,
        });
    } else {
        await updateDoc(territoryRef, {
            estado: "Asignado",
            asignado_a: userId,
            asignado_a_normalized: normalizeName(userId),
            fecha_asignacion: new Date().toISOString(),
            is_incomplete: false,
        });
    }

    await logAssignment({ id: newDocRef.id, ...newDocParams }, userId);
};

export const assignFreeTerritory = async (id, userId, num, manzanasStr) => {
    await updateDoc(doc(db, COL_TERRITORIOS, id), {
        asignado_a: userId,
        asignado_a_normalized: normalizeName(userId),
        fecha_asignacion: new Date().toISOString(),
        estado: "Asignado",
        is_incomplete: false,
    });
    await logAssignment({ id, numero: num, manzanas: manzanasStr }, userId);
};

export const cancelarAsignacion = async (id) => {
    // Obtener el número del territorio ANTES de limpiarlo para buscar en banco_s13
    const tSnap = await getDoc(doc(db, COL_TERRITORIOS, id));
    const tNum = tSnap.exists() ? String(tSnap.data().numero || "") : "";

    await updateDoc(doc(db, COL_TERRITORIOS, id), {
        asignado_a: null,
        asignado_a_normalized: null,
        auxiliar: null,
        auxiliar_normalized: null,
        fecha_asignacion: null,
        estado: "Disponible",
    });

    // CAMBIO C: Apuntar a banco_s13 (colección autoritativa) en lugar de historial_territorios
    try {
        let snapshot = await getDocs(query(
            collection(db, COL_BANCO_S13),
            where("territorio_doc_id", "==", id),
            where("estado", "==", "Asignado"),
            orderBy("timestamp", "desc"),
            limit(1),
        ));
        if (snapshot.empty) {
            snapshot = await getDocs(query(
                collection(db, COL_BANCO_S13),
                where("territorio_id", "==", tNum),
                where("estado", "==", "Asignado"),
                orderBy("timestamp", "desc"),
                limit(1),
            ));
        }
        if (!snapshot.empty) {
            await updateDoc(doc(db, COL_BANCO_S13, snapshot.docs[0].id), {
                estado: "Cancelado",
                fecha_entrega: new Date().toISOString(),
                timestamp_entrega: serverTimestamp(),
            });
            console.log(`✅ [cancelarAsignacion] banco_s13 cerrado para territorio ${tNum}`);
        }
    } catch (e) {
        console.error("Error cancelling assignment in banco_s13:", e);
    }

    ServiceCache.clear("territorios");
    ServiceCache.clear("territorios_combined");
    ServiceCache.clear("historial");
};

export const updateAssignmentData = async (id, updates = {}) => {
    const territoryUpdate = {};
    const fields = [
        "fecha_asignacion",
        "fecha_salida",
        "asignado_a",
        "estado",
        "auxiliar",
        "faceta",
        "hora",
        "turno",
        "lugar",
        "campana",
        "grupos",
    ];
    fields.forEach((f) => {
        if (updates[f] !== undefined) territoryUpdate[f] = updates[f];
    });

    if (updates.asignado_a !== undefined) {
        territoryUpdate.asignado_a_normalized = updates.asignado_a ? normalizeName(updates.asignado_a) : null;
    }
    if (updates.auxiliar !== undefined) {
        territoryUpdate.auxiliar_normalized = updates.auxiliar ? normalizeName(updates.auxiliar) : null;
    }

    await updateDoc(doc(db, COL_TERRITORIOS, id), territoryUpdate);

    try {
        const tSnapForNum = await getDoc(doc(db, COL_TERRITORIOS, id));
        if (tSnapForNum.exists()) {
            const tNum = String(tSnapForNum.data().numero || "").trim();
            let snapshot = await getDocs(query(
                collection(db, COL_BANCO_S13),
                where("territorio_doc_id", "==", id),
                where("estado", "==", "Asignado"),
                orderBy("timestamp", "desc"),
                limit(1),
            ));
            if (snapshot.empty) {
                snapshot = await getDocs(query(
                    collection(db, COL_BANCO_S13),
                    where("territorio_id", "==", tNum),
                    where("estado", "==", "Asignado"),
                    orderBy("timestamp", "desc"),
                    limit(1),
                ));
            }
            if (!snapshot.empty) {
                const histUpdate = {};
                fields.forEach((f) => {
                    const target = f === "asignado_a" ? "conductor" : f;
                    if (updates[f] !== undefined) histUpdate[target] = updates[f];
                });
                if (updates.asignado_a !== undefined) {
                    histUpdate.conductor_normalized = updates.asignado_a ? normalizeName(updates.asignado_a) : null;
                }
                if (updates.auxiliar !== undefined) {
                    histUpdate.auxiliar_normalized = updates.auxiliar ? normalizeName(updates.auxiliar) : null;
                }
                histUpdate.updatedAt = serverTimestamp();
                await updateDoc(doc(db, COL_BANCO_S13, snapshot.docs[0].id), histUpdate);
            }
        }
    } catch (e) {
        console.error("Error updating history in banco_s13:", e);
    }

    const tSnap = await getDoc(doc(db, COL_TERRITORIOS, id));
    if (tSnap.exists() && tSnap.data().fecha_asignacion) {
        await syncAssignmentToWeeklyProgram({ id, ...tSnap.data() }, tSnap.data().asignado_a, tSnap.data());
    }
    ServiceCache.clear("territorios");
    ServiceCache.clear("historial");
};

export const returnTerritorioMultiple = async (ids, notes, customDate, status = "Completado") => {
    try {
        const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();
        const batch = writeBatch(db);

        // 1. Fetch relevant data for all territories and their active assignments
        const [tSnaps, bancoSnap] = await Promise.all([
            Promise.all(ids.map((id) => getDoc(doc(db, COL_TERRITORIOS, id)))),
            getDocs(query(collection(db, COL_BANCO_S13), where("estado", "==", "Asignado"))),
        ]);

        const activeAssignmentsForThese = {};
        bancoSnap.docs.forEach((d) => {
            const bData = d.data();
            activeAssignmentsForThese[String(bData.territorio_id)] = d.ref;
        });

        const logPromises = [];

        for (const snap of tSnaps) {
            if (!snap.exists()) continue;
            const tId = snap.id;
            const tData = snap.data();
            const tNum = String(tData.numero || "").trim();
            if (!tNum) continue;

            const prevConductor = tData.currentAssignee || tData.asignado_a || null;

            // a) SOBRESCRITURA ABSOLUTA EN MAESTRO (Goma de borrar activa)
            const updates = {
                status: "Disponible",
                currentAssignee: null,
                assignmentDate: null,
                // Mantener compatibilidad total
                estado: "Disponible",
                asignado_a: null,
                fecha_asignacion: null,
                auxiliar: null,
                lugar: null,
                hora: null,
                faceta: null,
                turno: null,
                prog_sync: null,
                lastUpdated: serverTimestamp(),
            };
            if (status !== "Disponible") {
                updates.ultima_fecha = dateToUse;
            }
            batch.update(doc(db, COL_TERRITORIOS, tId), updates);

            // b) SOBRESCRITURA EN LIVE POOL (banco_s13)
            // Buscamos el registro activo para este número de territorio
            const activeRef = activeAssignmentsForThese[tNum];
            if (activeRef) {
                console.log(`✅ [Reception] Cerrando ciclo en banco_s13 para ${tNum}`);
                batch.update(activeRef, {
                    estado: status === "Completado" ? "Completado" : "Disponible",
                    fecha_entrega: dateToUse,
                    returnDate: dateToUse, // Campo espejo solicitado
                    timestamp_entrega: serverTimestamp(),
                    observaciones: notes || null,
                });
            } else {
                console.warn(
                    `⚠️ [Reception] No se encontró asignación 'Asignado' en banco_s13 para el territorio ${tNum}`,
                );
            }

            // Write observation log atomically inside the batch if notes are provided
            if (notes && notes.trim().length > 0) {
                const obsRef = doc(collection(db, "bitacora_observaciones"));
                batch.set(obsRef, {
                    territorio_id: tNum,
                    conductor: prevConductor || "Anónimo",
                    nota: notes,
                    fecha: dateToUse,
                    timestamp: serverTimestamp(),
                });
            }

            logPromises.push(saveAuditLog("ENTREGA_TERRITORIO", { territorio: tNum, conductor: prevConductor }));
        }

        await batch.commit();
        await Promise.all(logPromises);

        ServiceCache.clear("territorios");
        ServiceCache.clear("territorios_combined");
        ServiceCache.clear("historial");
        ServiceCache.clear("stats_globales");
    } catch (e) {
        console.error("Critical error in atomic returnTerritorioMultiple:", e);
        throw e;
    }
};

export const returnTerritorioParcial = async (
    originalId,
    completedManzanas,
    remainingManzanas,
    unassignRemaining = false,
    notes = null,
    customDate = null,
    fotos = null,
    conductorName = null,
) => {
    const dateToUse = customDate ? new Date(customDate).toISOString() : new Date().toISOString();

    const territoryRef = doc(db, COL_TERRITORIOS, originalId);
    const territorySnap = await getDoc(territoryRef);
    if (!territorySnap.exists()) throw new Error("Territorio no encontrado");
    const tData = territorySnap.data();
    const tNum = String(tData.numero || "");

    const batch = writeBatch(db);

    // A) Si hay manzanas completadas, crear el sub-territorio completado disponible
    if (completedManzanas && completedManzanas.length > 0) {
        const newTerrRef = doc(collection(db, COL_TERRITORIOS));
        batch.set(newTerrRef, {
            ...tData,
            manzanas: completedManzanas.join(", "),
            estado: "Disponible",
            asignado_a: null,
            asignado_a_normalized: null,
            currentAssignee: null,
            auxiliar: null,
            auxiliar_normalized: null,
            fecha_asignacion: null,
            assignmentDate: null,
            ultima_fecha: dateToUse,
            origen_id: originalId,
        });
    }

    // B) Actualizar el territorio original con las manzanas restantes
    const updateData = { manzanas: remainingManzanas.join(", ") };
    if (unassignRemaining) {
        updateData.asignado_a = null;
        updateData.asignado_a_normalized = null;
        updateData.currentAssignee = null;
        updateData.auxiliar = null;
        updateData.auxiliar_normalized = null;
        updateData.fecha_asignacion = null;
        updateData.assignmentDate = null;
        updateData.estado = "Disponible";
    }
    updateData.is_incomplete = remainingManzanas.length > 0;

    batch.update(territoryRef, updateData);

    // C) Cerrar registro activo en banco_s13
    if (tNum) {
        let bancoSnap = await getDocs(query(
            collection(db, COL_BANCO_S13),
            where("territorio_doc_id", "==", originalId),
            where("estado", "==", "Asignado"),
        ));
        if (bancoSnap.empty) {
            bancoSnap = await getDocs(query(
                collection(db, COL_BANCO_S13),
                where("territorio_id", "==", tNum),
                where("estado", "==", "Asignado"),
            ));
        }
        if (!bancoSnap.empty) {
            bancoSnap.docs.forEach((d) => {
                const oldRecord = d.data();
                batch.update(d.ref, {
                    fecha_entrega: dateToUse,
                    estado: "Predicado Parcial",
                    observaciones: notes || oldRecord.observaciones || null,
                    timestamp: Timestamp.now(),
                    fotos: fotos || null,
                });

                if (!unassignRemaining) {
                    const newS13Ref = doc(collection(db, COL_BANCO_S13));
                    batch.set(newS13Ref, {
                        ...oldRecord,
                        territorio_doc_id: originalId,
                        estado: "Asignado",
                        fecha_entrega: null,
                        timestamp: Timestamp.now(),
                        observaciones: `Porción restante de división de manzanas. (Original: ${oldRecord.observaciones || ""})`.trim()
                    });
                }
            });
        }
    }

    // D) Registro en bitácora de observaciones si hay notas
    if (notes && notes.trim().length > 0) {
        const obsRef = doc(collection(db, "bitacora_observaciones"));
        batch.set(obsRef, {
            territorio_id: tNum,
            conductor: conductorName || tData.asignado_a || "Anónimo",
            nota: notes,
            fecha: dateToUse,
            timestamp: Timestamp.now(),
        });
    }

    // 2. Commit atómico del lote completo
    await batch.commit();

    // 3. Notificación de auditoría
    try {
        await saveAuditLog("ENTREGA_TERRITORIO", { territorio: tNum, detalles: "Devolución Parcial" });
    } catch (e) {
        console.error("Error saving audit log in returnTerritorioParcial:", e);
    }

    ServiceCache.clear("territorios");
    ServiceCache.clear("territorios_combined");
    ServiceCache.clear("historial");
};

export const assignTerritorioParcial = async (originalId, manzanasToAssign, conductorName, details = {}) => {
    try {
        const docRef = doc(db, COL_TERRITORIOS, originalId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) throw new Error("Territorio no encontrado");

        const data = snap.data();
        const allManzanas = data.manzanas
            ? data.manzanas
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
            : [];
        const toAssign = manzanasToAssign.map((s) => s.trim());
        const remaining = allManzanas.filter((m) => !toAssign.includes(m));

        const assignmentData = {
            asignado_a: conductorName,
            asignado_a_normalized: normalizeName(conductorName),
            fecha_asignacion: details.fecha_asignacion || new Date().toISOString(),
            fecha_salida: details.fecha_salida || null,
            estado: "Asignado",
            auxiliar: details.auxiliar || null,
            auxiliar_normalized: details.auxiliar ? normalizeName(details.auxiliar) : null,
            lugar: details.lugar || null,
            hora: details.hora || null,
            faceta: details.faceta || null,
            turno: details.turno || null,
            campana: details.campana || null,
        };

        if (remaining.length === 0) {
            await updateDoc(docRef, assignmentData);
            await logAssignment({ id: originalId, ...data }, conductorName, details);
        } else {
            await updateDoc(docRef, { manzanas: remaining.join(", ") });
            const newDocRef = await addDoc(collection(db, COL_TERRITORIOS), {
                ...data,
                manzanas: toAssign.join(", "),
                ...assignmentData,
                origen_id: originalId,
            });
            await logAssignment({ id: newDocRef.id, ...data, numero: `${data.numero} (P)` }, conductorName, details);
        }
    } catch (e) {
        console.error("Error splitting territory:", e);
        throw e;
    }
};

export const transferTerritorio = async (id, newConductor, manzanasToTransfer, details = {}) => {
    try {
        await logReturn(id, new Date().toISOString(), "Devuelto (Transferido)", `Transferido a ${newConductor}`);
        const territoryRef = doc(db, COL_TERRITORIOS, id);
        const snap = await getDoc(territoryRef);
        if (!snap.exists()) throw new Error("Territorio no encontrado");
        const tData = snap.data();

        const updateData = {
            asignado_a: newConductor,
            asignado_a_normalized: normalizeName(newConductor),
            fecha_asignacion: new Date().toISOString(),
            estado: "Asignado",
            manzanas: manzanasToTransfer || tData.manzanas,
        };
        if (details.auxiliar) {
            updateData.auxiliar = details.auxiliar;
            updateData.auxiliar_normalized = normalizeName(details.auxiliar);
        }

        await updateDoc(territoryRef, updateData);

        await logAssignment({ id, ...tData, ...updateData }, newConductor, details);
    } catch (e) {
        console.error("Error transferring territory:", e);
        throw e;
    }
};

export const transferTerritory = transferTerritorio;
