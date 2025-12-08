import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import {
  db,
  conductoresRef,
  territoriosRef,
  programaRef,
  lugaresRef,
  facetasRef,
  publicadoresRef,
  telefonosRef,
} from "./firebase";
import {
  Conductor,
  Territory,
  Publicador,
  Lugar,
  Faceta,
  ProgramaReunion,
  TelephoneRecord,
} from "@/types";

// Configuración de territorios (del código original)
export const MANZANAS_POR_TERRITORIO = {
  1: 4,
  2: 3,
  3: 7,
  4: 3,
  5: 4,
  6: 4,
  7: 3,
  8: 4,
  9: 2,
  10: 2,
  11: 2,
  12: 1,
  13: 2,
  14: 4,
  15: 4,
  16: 2,
  17: 2,
  18: 2,
  19: 4,
  20: 1,
  21: 2,
  22: 3,
};

export const TOTAL_TERRITORIOS = 22;
export const ESTADOS_TELEFONICOS = [
  "",
  "Colgaron",
  "No llamar",
  "Contestaron",
  "Revisita",
  "Devuelto",
  "No contestaron",
  "Testigo",
];

// Tipos para el manejo de territorios
export interface AsignacionManzana {
  numero: number;
  conductorId: string;
  conductorNombre: string;
  fechaAsignacion: Date;
  fechaPredicacion?: Date;
  estado: "asignada" | "predicada";
}

// Funciones para gestión de territorios (Administrador)
export const adminTerritoryService = {
  // Asignar territorio con manzanas específicas
  async asignarTerritorio(
    territorioId: number,
    conductor: string,
    manzanas: number[],
    fechaAsignacion: string,
    turno = "programa"
  ): Promise<void> {
    const nuevaAsignacion = {
      conductor,
      manzanas,
      fechaAsignacion,
      turno,
      estado: "activo",
      timestamp: serverTimestamp(),
    };

    const docRef = doc(territoriosRef(), String(territorioId));
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      await updateDoc(docRef, {
        asignaciones: arrayUnion(nuevaAsignacion),
        ultimaModificacion: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        numero: territorioId,
        totalManzanas:
          MANZANAS_POR_TERRITORIO[
            territorioId as keyof typeof MANZANAS_POR_TERRITORIO
          ] || 20,
        asignaciones: [nuevaAsignacion],
        historialAsignaciones: [],
        ultimaModificacion: serverTimestamp(),
      });
    }
  },

  // Devolver territorio
  async devolverTerritorio(
    territorioId: number,
    asignacionIndex: number,
    fechaDevolucion: string,
    publicador?: string
  ): Promise<void> {
    const docRef = doc(territoriosRef(), String(territorioId));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Territorio no encontrado");
    }

    const terrData = docSnap.data();
    const asignaciones = [...(terrData.asignaciones || [])];
    const asignacionADevolver = asignaciones[asignacionIndex];

    if (!asignacionADevolver) {
      throw new Error("Asignación no encontrada");
    }

    // Mover a historial
    const historialItem = {
      ...asignacionADevolver,
      fechaDevolucion,
      publicador: publicador || asignacionADevolver.conductor,
      conductorOriginal: asignacionADevolver.conductor,
      estado: "completado",
    };

    // Remover de asignaciones activas
    asignaciones.splice(asignacionIndex, 1);

    await updateDoc(docRef, {
      asignaciones,
      historialAsignaciones: arrayUnion(historialItem),
      ultimaModificacion: serverTimestamp(),
    });
  },

  // Eliminar asignación completamente
  async eliminarAsignacion(
    territorioId: number,
    asignacionId: string,
    tipo: "activa" | "historial"
  ): Promise<void> {
    const docRef = doc(territoriosRef(), String(territorioId));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Territorio no encontrado");
    }

    const terrData = docSnap.data();

    if (tipo === "activa") {
      const index = parseInt(asignacionId.split("-")[1]);
      const asignacionAEliminar = terrData.asignaciones[index];

      if (asignacionAEliminar) {
        await updateDoc(docRef, {
          asignaciones: arrayRemove(asignacionAEliminar),
        });
      }
    } else {
      const [fecha, conductor] = asignacionId.split("-");
      const asignacionAEliminar = terrData.historialAsignaciones?.find(
        (h: any) =>
          h.fechaDevolucion === fecha && h.conductorOriginal === conductor
      );

      if (asignacionAEliminar) {
        await updateDoc(docRef, {
          historialAsignaciones: arrayRemove(asignacionAEliminar),
        });
      }
    }
  },

  // Obtener estadísticas de territorios
  async getEstadisticasTerritorios(): Promise<{
    asignados: number;
    completados: number;
    disponibles: number;
    progresoPromedio: number;
  }> {
    const snapshot = await getDocs(territoriosRef());
    let asignados = 0,
      completados = 0,
      disponibles = 0;
    let totalProgreso = 0,
      territoriosConProgreso = 0;

    for (let i = 1; i <= TOTAL_TERRITORIOS; i++) {
      const terrDoc = snapshot.docs.find((doc) => doc.id === String(i));
      let estado = "disponible";

      if (terrDoc) {
        const terrData = terrDoc.data();
        const asignacionesActivas =
          terrData.asignaciones?.filter((a: any) => a.estado === "activo") ||
          [];

        if (asignacionesActivas.length > 0) {
          estado = "asignado";
          const manzanasAsignadas = asignacionesActivas.reduce(
            (acc: number, a: any) => acc + (a.manzanas?.length || 0),
            0
          );
          const totalManzanas =
            MANZANAS_POR_TERRITORIO[
              i as keyof typeof MANZANAS_POR_TERRITORIO
            ] || 20;
          totalProgreso += manzanasAsignadas / totalManzanas;
          territoriosConProgreso++;
        } else if (terrData.historialAsignaciones?.length > 0) {
          estado = "completado";
        }
      }

      if (estado === "asignado") asignados++;
      else if (estado === "completado") completados++;
      else disponibles++;
    }

    const progresoPromedio =
      territoriosConProgreso > 0
        ? Math.round((totalProgreso / territoriosConProgreso) * 100)
        : 0;

    return { asignados, completados, disponibles, progresoPromedio };
  },
};

// Funciones para gestión de hermanos (Administrador)
export const adminHermanosService = {
  // Agregar conductor
  async agregarConductor(nombre: string): Promise<string> {
    const docRef = await addDoc(conductoresRef(), {
      nombre: nombre.trim(),
      activo: true,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  // Agregar publicador
  async agregarPublicador(nombre: string): Promise<string> {
    const docRef = await addDoc(publicadoresRef(), {
      nombre: nombre.trim(),
      activo: true,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  // Editar hermano
  async editarHermano(
    id: string,
    tipo: "conductor" | "publicador",
    updates: any
  ): Promise<void> {
    const collectionRef =
      tipo === "conductor" ? conductoresRef() : publicadoresRef();
    const docRef = doc(collectionRef, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  // Eliminar hermano
  async eliminarHermano(
    id: string,
    tipo: "conductor" | "publicador"
  ): Promise<void> {
    const collectionRef =
      tipo === "conductor" ? conductoresRef() : publicadoresRef();
    const docRef = doc(collectionRef, id);
    await deleteDoc(docRef);
  },

  // Verificar si existe hermano
  async existeHermano(
    nombre: string,
    tipo: "conductor" | "publicador"
  ): Promise<boolean> {
    const collectionRef =
      tipo === "conductor" ? conductoresRef() : publicadoresRef();
    const q = query(collectionRef, where("nombre", "==", nombre.trim()));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  },
};

// Funciones para el programa (Administrador)
export const adminProgramaService = {
  // Crear programa con asignación de territorio
  async crearPrograma(programaData: {
    fecha: string;
    hora: string;
    lugar: string;
    conductor: string;
    auxiliar?: string;
    faceta: string;
    territorios: Array<{
      numero: number;
      manzanas: number[];
    }>;
  }): Promise<void> {
    // Crear el programa
    const programaDoc = {
      ...programaData,
      territorio: programaData.territorios
        .map((t) => `T${t.numero} (Mzs: ${t.manzanas.join(", ")})`)
        .join("; "),
      timestamp: serverTimestamp(),
    };

    await addDoc(programaRef(), programaDoc);

    // Asignar territorios
    const promises = programaData.territorios.map((territorio) =>
      adminTerritoryService.asignarTerritorio(
        territorio.numero,
        programaData.conductor,
        territorio.manzanas,
        programaData.fecha,
        "programa"
      )
    );

    await Promise.all(promises);
  },

  // Agregar lugar
  async agregarLugar(nombre: string): Promise<string> {
    const docRef = await addDoc(lugaresRef(), {
      nombre: nombre.trim(),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  // Agregar faceta
  async agregarFaceta(nombre: string): Promise<string> {
    const docRef = await addDoc(facetasRef(), {
      nombre: nombre.trim(),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },
};

// Funciones simplificadas para compatibilidad
export const adminServices = {
  // ========== PUBLICADORES ==========
  agregarPublicador: async (
    nombre: string,
    telefono?: string,
    email?: string
  ) => {
    try {
      const docRef = await addDoc(publicadoresRef(), {
        nombre: nombre.trim(),
        telefono: telefono?.trim() || "",
        email: email?.trim() || "",
        activo: true,
        fechaCreacion: serverTimestamp(),
      });
      return { success: true, message: "Publicador agregado exitosamente" };
    } catch (error) {
      console.error("Error al agregar publicador:", error);
      return { success: false, message: "Error al agregar publicador" };
    }
  },

  editarPublicador: async (publicadorId: string, datos: any) => {
    try {
      const docRef = doc(publicadoresRef(), publicadorId);
      await updateDoc(docRef, {
        ...datos,
        fechaModificacion: serverTimestamp(),
      });
      return { success: true, message: "Publicador actualizado exitosamente" };
    } catch (error) {
      console.error("Error al editar publicador:", error);
      return { success: false, message: "Error al editar publicador" };
    }
  },

  eliminarPublicador: async (publicadorId: string) => {
    try {
      const docRef = doc(publicadoresRef(), publicadorId);
      await deleteDoc(docRef);
      return { success: true, message: "Publicador eliminado exitosamente" };
    } catch (error) {
      console.error("Error al eliminar publicador:", error);
      return { success: false, message: "Error al eliminar publicador" };
    }
  },

  obtenerPublicadores: async () => {
    try {
      const snapshot = await getDocs(publicadoresRef());
      const publicadores = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      return { success: true, data: publicadores };
    } catch (error) {
      console.error("Error al obtener publicadores:", error);
      return {
        success: false,
        message: "Error al obtener publicadores",
        data: [],
      };
    }
  },

  // ========== CONDUCTORES ==========
  agregarConductor: async (
    nombre: string,
    telefono: string,
    email: string = ""
  ) => {
    try {
      const docRef = await addDoc(conductoresRef(), {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        activo: true,
        fechaCreacion: serverTimestamp(),
        territoriosAsignados: [],
      });
      return { success: true, message: "Conductor agregado exitosamente" };
    } catch (error) {
      console.error("Error al agregar conductor:", error);
      return { success: false, message: "Error al agregar conductor" };
    }
  },

  editarConductor: async (conductorId: string, datos: any) => {
    try {
      const docRef = doc(conductoresRef(), conductorId);
      await updateDoc(docRef, {
        ...datos,
        fechaModificacion: serverTimestamp(),
      });
      return { success: true, message: "Conductor actualizado exitosamente" };
    } catch (error) {
      console.error("Error al editar conductor:", error);
      return { success: false, message: "Error al editar conductor" };
    }
  },

  eliminarConductor: async (conductorId: string) => {
    try {
      const docRef = doc(conductoresRef(), conductorId);
      await deleteDoc(docRef);
      return { success: true, message: "Conductor eliminado exitosamente" };
    } catch (error) {
      console.error("Error al eliminar conductor:", error);
      return { success: false, message: "Error al eliminar conductor" };
    }
  },

  // ========== TERRITORIOS CON MANZANAS ==========
  asignarManzanas: async (
    territorioNum: number,
    manzanas: number[],
    conductorId: string,
    conductorNombre: string,
    fechaAsignacion: Date
  ) => {
    try {
      const territorioRef = doc(territoriosRef(), String(territorioNum));
      const territorioDoc = await getDoc(territorioRef);

      let asignacionesActuales: AsignacionManzana[] = [];
      if (territorioDoc.exists()) {
        asignacionesActuales = territorioDoc.data().asignaciones || [];
      }

      // Verificar que las manzanas estén disponibles
      const manzanasOcupadas = manzanas.filter((manzana) =>
        asignacionesActuales.some(
          (asig) => asig.numero === manzana && asig.estado === "asignada"
        )
      );

      if (manzanasOcupadas.length > 0) {
        return {
          success: false,
          message: `Las manzanas ${manzanasOcupadas.join(
            ", "
          )} ya están asignadas`,
        };
      }

      // Crear nuevas asignaciones
      const nuevasAsignaciones: AsignacionManzana[] = manzanas.map(
        (manzana) => ({
          numero: manzana,
          conductorId,
          conductorNombre,
          fechaAsignacion,
          estado: "asignada" as const,
        })
      );

      // Actualizar o crear el documento del territorio
      if (territorioDoc.exists()) {
        await updateDoc(territorioRef, {
          asignaciones: [...asignacionesActuales, ...nuevasAsignaciones],
          ultimaModificacion: serverTimestamp(),
        });
      } else {
        await setDoc(territorioRef, {
          numero: territorioNum,
          totalManzanas:
            MANZANAS_POR_TERRITORIO[
              territorioNum as keyof typeof MANZANAS_POR_TERRITORIO
            ],
          asignaciones: nuevasAsignaciones,
          fechaCreacion: serverTimestamp(),
        });
      }

      return {
        success: true,
        message: `Manzanas ${manzanas.join(
          ", "
        )} del territorio ${territorioNum} asignadas exitosamente`,
      };
    } catch (error) {
      console.error("Error al asignar manzanas:", error);
      return { success: false, message: "Error al asignar manzanas" };
    }
  },

  reasignarManzana: async (
    territorioNum: number,
    manzana: number,
    nuevoConductorId: string,
    nuevoConductorNombre: string
  ) => {
    try {
      const territorioRef = doc(territoriosRef(), String(territorioNum));
      const territorioDoc = await getDoc(territorioRef);

      if (!territorioDoc.exists()) {
        return { success: false, message: "Territorio no encontrado" };
      }

      let asignaciones: AsignacionManzana[] =
        territorioDoc.data().asignaciones || [];

      // Encontrar la asignación actual
      const indiceAsignacion = asignaciones.findIndex(
        (asig) => asig.numero === manzana && asig.estado === "asignada"
      );

      if (indiceAsignacion === -1) {
        return {
          success: false,
          message: "Manzana no encontrada o ya predicada",
        };
      }

      // Actualizar la asignación
      asignaciones[indiceAsignacion] = {
        ...asignaciones[indiceAsignacion],
        conductorId: nuevoConductorId,
        conductorNombre: nuevoConductorNombre,
        fechaAsignacion: new Date(),
      };

      await updateDoc(territorioRef, {
        asignaciones,
        ultimaModificacion: serverTimestamp(),
      });

      return {
        success: true,
        message: `Manzana ${manzana} del territorio ${territorioNum} reasignada exitosamente`,
      };
    } catch (error) {
      console.error("Error al reasignar manzana:", error);
      return { success: false, message: "Error al reasignar manzana" };
    }
  },

  marcarManzanaPredicada: async (
    territorioNum: number,
    manzana: number,
    conductorId: string
  ) => {
    try {
      const territorioRef = doc(territoriosRef(), String(territorioNum));
      const territorioDoc = await getDoc(territorioRef);

      if (!territorioDoc.exists()) {
        return { success: false, message: "Territorio no encontrado" };
      }

      let asignaciones: AsignacionManzana[] =
        territorioDoc.data().asignaciones || [];

      // Encontrar la asignación
      const indiceAsignacion = asignaciones.findIndex(
        (asig) =>
          asig.numero === manzana &&
          asig.conductorId === conductorId &&
          asig.estado === "asignada"
      );

      if (indiceAsignacion === -1) {
        return { success: false, message: "Asignación no encontrada" };
      }

      // Marcar como predicada
      asignaciones[indiceAsignacion] = {
        ...asignaciones[indiceAsignacion],
        estado: "predicada",
        fechaPredicacion: new Date(),
      };

      await updateDoc(territorioRef, {
        asignaciones,
        ultimaModificacion: serverTimestamp(),
      });

      return {
        success: true,
        message: `Manzana ${manzana} del territorio ${territorioNum} marcada como predicada`,
      };
    } catch (error) {
      console.error("Error al marcar manzana como predicada:", error);
      return {
        success: false,
        message: "Error al marcar manzana como predicada",
      };
    }
  },

  obtenerEstadoTerritorios: async () => {
    try {
      const territoriosSnapshot = await getDocs(territoriosRef());
      const estadoTerritorios: any = {};

      for (let i = 1; i <= TOTAL_TERRITORIOS; i++) {
        const totalManzanas =
          MANZANAS_POR_TERRITORIO[i as keyof typeof MANZANAS_POR_TERRITORIO];
        estadoTerritorios[i] = {
          numero: i,
          totalManzanas,
          manzanasDisponibles: [],
          manzanasAsignadas: [],
          manzanasPredicadas: [],
        };

        // Inicializar todas las manzanas como disponibles
        for (let j = 1; j <= totalManzanas; j++) {
          estadoTerritorios[i].manzanasDisponibles.push(j);
        }
      }

      // Procesar asignaciones existentes
      territoriosSnapshot.docs.forEach((doc) => {
        const territorioNum = parseInt(doc.id);
        const data = doc.data();
        const asignaciones: AsignacionManzana[] = data.asignaciones || [];

        asignaciones.forEach((asignacion) => {
          const { numero, estado } = asignacion;

          // Remover de disponibles
          estadoTerritorios[territorioNum].manzanasDisponibles =
            estadoTerritorios[territorioNum].manzanasDisponibles.filter(
              (m: number) => m !== numero
            );

          // Agregar al estado correspondiente
          if (estado === "asignada") {
            estadoTerritorios[territorioNum].manzanasAsignadas.push(asignacion);
          } else if (estado === "predicada") {
            estadoTerritorios[territorioNum].manzanasPredicadas.push(
              asignacion
            );
          }
        });
      });

      return { success: true, data: estadoTerritorios };
    } catch (error) {
      console.error("Error al obtener estado de territorios:", error);
      return {
        success: false,
        message: "Error al obtener estado de territorios",
      };
    }
  },

  // Mantener funciones anteriores para compatibilidad
  asignarTerritorio: async (
    territorioId: string,
    conductorId: string,
    conductorNombre: string
  ) => {
    const territorioNum = parseInt(territorioId);
    const totalManzanas =
      MANZANAS_POR_TERRITORIO[
        territorioNum as keyof typeof MANZANAS_POR_TERRITORIO
      ];
    const todasLasManzanas = Array.from(
      { length: totalManzanas },
      (_, i) => i + 1
    );

    return adminServices.asignarManzanas(
      territorioNum,
      todasLasManzanas,
      conductorId,
      conductorNombre,
      new Date()
    );
  },

  liberarTerritorio: async (territorioId: string) => {
    try {
      const docRef = doc(territoriosRef(), territorioId);
      await updateDoc(docRef, {
        conductorId: null,
        conductorNombre: null,
        fechaAsignacion: null,
        fechaLiberacion: serverTimestamp(),
        estado: "disponible",
      });
      return {
        success: true,
        message: `Territorio ${territorioId} liberado exitosamente`,
      };
    } catch (error) {
      console.error("Error al liberar territorio:", error);
      return { success: false, message: "Error al liberar territorio" };
    }
  },

  // Teléfonos
  agregarTelefono: async (datos: any) => {
    try {
      await addDoc(telefonosRef(), {
        ...datos,
        fechaCreacion: serverTimestamp(),
        estado: datos.estado || "",
        comentarios: datos.comentarios || "",
      });
      return { success: true, message: "Teléfono agregado exitosamente" };
    } catch (error) {
      console.error("Error al agregar teléfono:", error);
      return { success: false, message: "Error al agregar teléfono" };
    }
  },

  editarTelefono: async (telefonoId: string, datos: any) => {
    try {
      const docRef = doc(telefonosRef(), telefonoId);
      await updateDoc(docRef, {
        ...datos,
        fechaModificacion: serverTimestamp(),
      });
      return { success: true, message: "Teléfono actualizado exitosamente" };
    } catch (error) {
      console.error("Error al editar teléfono:", error);
      return { success: false, message: "Error al editar teléfono" };
    }
  },

  // Anuncios
  agregarAnuncio: async (titulo: string, mensaje: string) => {
    try {
      await addDoc(collection(db, "anuncios"), {
        titulo: titulo.trim(),
        mensaje: mensaje.trim(),
        timestamp: serverTimestamp(),
        fechaCreacion: serverTimestamp(),
        activo: true,
      });
      return { success: true, message: "Anuncio agregado exitosamente" };
    } catch (error) {
      console.error("Error al agregar anuncio:", error);
      return { success: false, message: "Error al agregar anuncio" };
    }
  },

  eliminarAnuncio: async (anuncioId: string) => {
    try {
      const docRef = doc(collection(db, "anuncios"), anuncioId);
      await deleteDoc(docRef);
      return { success: true, message: "Anuncio eliminado exitosamente" };
    } catch (error) {
      console.error("Error al eliminar anuncio:", error);
      return { success: false, message: "Error al eliminar anuncio" };
    }
  },

  // Inicializar territorios
  inicializarTerritorios: async () => {
    try {
      for (let i = 1; i <= TOTAL_TERRITORIOS; i++) {
        const docRef = doc(territoriosRef(), String(i));
        await setDoc(docRef, {
          numero: i,
          manzanas:
            MANZANAS_POR_TERRITORIO[
              i as keyof typeof MANZANAS_POR_TERRITORIO
            ] || 1,
          conductorId: null,
          conductorNombre: null,
          fechaAsignacion: null,
          estado: "disponible",
          fechaCreacion: serverTimestamp(),
        });
      }
      return {
        success: true,
        message: "Territorios inicializados exitosamente",
      };
    } catch (error) {
      console.error("Error al inicializar territorios:", error);
      return { success: false, message: "Error al inicializar territorios" };
    }
  },
};

// ==========================================
// SERVICIOS DE GESTIÓN TELEFÓNICA
// ==========================================

export const adminTelephoneService = {
  // Crear nuevo registro telefónico
  async crearTelefono(
    telefono: Omit<TelephoneRecord, "id" | "creadoEn" | "modificadoEn">
  ): Promise<{ success: boolean; message: string; id?: string }> {
    try {
      const docRef = await addDoc(telefonosRef(), {
        ...telefono,
        creadoEn: serverTimestamp(),
        modificadoEn: serverTimestamp(),
      });
      return {
        success: true,
        message: "Teléfono agregado exitosamente",
        id: docRef.id,
      };
    } catch (error) {
      console.error("Error al crear teléfono:", error);
      return {
        success: false,
        message: "Error al crear el registro telefónico",
      };
    }
  },

  // Obtener todos los teléfonos (admin)
  async obtenerTelefonos(): Promise<TelephoneRecord[]> {
    try {
      const snapshot = await getDocs(telefonosRef());
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TelephoneRecord[];
    } catch (error) {
      console.error("Error al obtener teléfonos:", error);
      return [];
    }
  },

  // Obtener teléfonos disponibles para generación (modo conductor)
  async obtenerTelefonosDisponibles(): Promise<TelephoneRecord[]> {
    try {
      const snapshot = await getDocs(telefonosRef());
      const todos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TelephoneRecord[];

      const ahora = new Date();
      const seiseMesesAtras = new Date();
      seiseMesesAtras.setMonth(seiseMesesAtras.getMonth() - 6);

      return todos.filter((telefono) => {
        // Excluir números marcados como "Testigo" (eliminados)
        if (telefono.estado === "Testigo") return false;

        // Excluir números suspendidos (solo para admin)
        if (telefono.estado === "Suspendido") return false;

        // Excluir números "No llamar" dentro de 6 meses
        if (telefono.estado === "No llamar" && telefono.fechaBloqueo) {
          const fechaBloqueo =
            telefono.fechaBloqueo instanceof Date
              ? telefono.fechaBloqueo
              : new Date(telefono.fechaBloqueo);
          if (fechaBloqueo > seiseMesesAtras) return false;
        }

        // Excluir números "Revisita" (hasta ser devueltos)
        if (telefono.estado === "Revisita") return false;

        return true;
      });
    } catch (error) {
      console.error("Error al obtener teléfonos disponibles:", error);
      return [];
    }
  },

  // Generar números aleatorios para predicación
  async generarNumerosAleatorios(
    cantidad: number = 50
  ): Promise<TelephoneRecord[]> {
    try {
      const disponibles = await this.obtenerTelefonosDisponibles();

      if (disponibles.length === 0) {
        return [];
      }

      // Mezclar array y tomar la cantidad solicitada
      const mezclados = [...disponibles].sort(() => Math.random() - 0.5);
      return mezclados.slice(0, Math.min(cantidad, mezclados.length));
    } catch (error) {
      console.error("Error al generar números aleatorios:", error);
      return [];
    }
  },

  // Actualizar estado de teléfono
  async actualizarEstadoTelefono(
    id: string,
    estado: TelephoneRecord["estado"],
    publicador?: string,
    comentarios?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const docRef = doc(telefonosRef(), id);
      const updates: any = {
        estado,
        modificadoEn: serverTimestamp(),
      };

      if (publicador) updates.publicador = publicador;
      if (comentarios !== undefined) updates.comentarios = comentarios;

      // Manejar lógica específica por estado
      switch (estado) {
        case "No llamar":
          updates.fechaBloqueo = serverTimestamp();
          break;
        case "Revisita":
          updates.fechaRevisita = serverTimestamp();
          break;
        case "Testigo":
          // Eliminar físicamente el registro
          await deleteDoc(docRef);
          return {
            success: true,
            message: "Registro eliminado (marcado como Testigo)",
          };
        case "Suspendido":
          updates.suspendido = true;
          break;
        default:
          // Limpiar fechas especiales si se cambia a otro estado
          updates.fechaBloqueo = null;
          updates.fechaRevisita = null;
          updates.suspendido = false;
      }

      updates.fechaUltimaLlamada = serverTimestamp();

      await updateDoc(docRef, updates);
      return { success: true, message: "Estado actualizado exitosamente" };
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      return { success: false, message: "Error al actualizar el estado" };
    }
  },

  // Editar teléfono (admin)
  async editarTelefono(
    id: string,
    telefono: Partial<TelephoneRecord>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const docRef = doc(telefonosRef(), id);
      await updateDoc(docRef, {
        ...telefono,
        modificadoEn: serverTimestamp(),
      });
      return { success: true, message: "Teléfono actualizado exitosamente" };
    } catch (error) {
      console.error("Error al editar teléfono:", error);
      return { success: false, message: "Error al actualizar el teléfono" };
    }
  },

  // Eliminar teléfono (admin)
  async eliminarTelefono(
    id: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const docRef = doc(telefonosRef(), id);
      await deleteDoc(docRef);
      return { success: true, message: "Teléfono eliminado exitosamente" };
    } catch (error) {
      console.error("Error al eliminar teléfono:", error);
      return { success: false, message: "Error al eliminar el teléfono" };
    }
  },

  // Importar teléfonos en masa
  async importarTelefonosMasa(
    telefonos: Array<{
      nombre: string;
      direccion: string;
      telefono: string;
      estado?: TelephoneRecord["estado"];
    }>
  ): Promise<{ success: boolean; message: string; importados: number }> {
    try {
      let importados = 0;
      let actualizados = 0;
      const errores: string[] = [];

      for (const telefono of telefonos) {
        try {
          // Validar datos básicos
          if (!telefono.nombre || !telefono.direccion || !telefono.telefono) {
            errores.push(
              `Registro incompleto: ${telefono.nombre || "Sin nombre"}`
            );
            continue;
          }

          // Verificar si el número ya existe
          const existingQuery = query(
            telefonosRef(),
            where("telefono", "==", telefono.telefono.trim())
          );
          const existingDocs = await getDocs(existingQuery);

          const telefonoData = {
            nombre: telefono.nombre.trim(),
            direccion: telefono.direccion.trim(),
            telefono: telefono.telefono.trim(),
            estado: telefono.estado || "",
            modificadoEn: serverTimestamp(),
          };

          if (!existingDocs.empty) {
            // Actualizar el registro existente (sobrescribir)
            const existingDoc = existingDocs.docs[0];
            await updateDoc(doc(telefonosRef(), existingDoc.id), telefonoData);
            actualizados++;
          } else {
            // Crear nuevo registro
            await addDoc(telefonosRef(), {
              ...telefonoData,
              creadoEn: serverTimestamp(),
            });
            importados++;
          }
        } catch (error) {
          errores.push(`Error con ${telefono.nombre}: ${error}`);
        }
      }

      const total = importados + actualizados;
      const mensaje =
        `✅ Procesados: ${total}/${telefonos.length}` +
        (importados > 0 ? ` | Nuevos: ${importados}` : "") +
        (actualizados > 0 ? ` | Actualizados: ${actualizados}` : "") +
        (errores.length > 0
          ? ` | ⚠️ Errores: ${errores.slice(0, 3).join(", ")}${
              errores.length > 3 ? "..." : ""
            }`
          : "");

      return { success: total > 0, message: mensaje, importados: total };
    } catch (error) {
      console.error("Error en importación masiva:", error);
      return {
        success: false,
        message: "Error en la importación masiva",
        importados: 0,
      };
    }
  },

  // Obtener números marcados como "Revisita"
  async obtenerNumerosRevisita(): Promise<TelephoneRecord[]> {
    try {
      const snapshot = await getDocs(
        query(telefonosRef(), where("estado", "==", "Revisita"))
      );
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TelephoneRecord[];
    } catch (error) {
      console.error("Error al obtener números revisita:", error);
      return [];
    }
  },

  // Devolver números de revisita al pool disponible
  async devolverNumerosRevisita(
    ids: string[]
  ): Promise<{ success: boolean; message: string; devueltos: number }> {
    try {
      let devueltos = 0;

      for (const id of ids) {
        try {
          const docRef = doc(telefonosRef(), id);
          await updateDoc(docRef, {
            estado: "",
            fechaRevisita: null,
            modificadoEn: serverTimestamp(),
          });
          devueltos++;
        } catch (error) {
          console.error(`Error devolviendo número ${id}:`, error);
        }
      }

      const mensaje =
        devueltos > 0
          ? `${devueltos} números devueltos al pool disponible`
          : "No se pudieron devolver números";

      return { success: devueltos > 0, message: mensaje, devueltos };
    } catch (error) {
      console.error("Error devolviendo números:", error);
      return {
        success: false,
        message: "Error al devolver los números",
        devueltos: 0,
      };
    }
  },

  // Obtener estadísticas telefónicas
  async obtenerEstadisticas(): Promise<{
    total: number;
    disponibles: number;
    revisitas: number;
    bloqueados: number;
    suspendidos: number;
  }> {
    try {
      const todos = await this.obtenerTelefonos();
      const disponibles = await this.obtenerTelefonosDisponibles();

      return {
        total: todos.length,
        disponibles: disponibles.length,
        revisitas: todos.filter((t) => t.estado === "Revisita").length,
        bloqueados: todos.filter((t) => t.estado === "No llamar").length,
        suspendidos: todos.filter((t) => t.estado === "Suspendido").length,
      };
    } catch (error) {
      console.error("Error obteniendo estadísticas:", error);
      return {
        total: 0,
        disponibles: 0,
        revisitas: 0,
        bloqueados: 0,
        suspendidos: 0,
      };
    }
  },
};

const defaultExport = {
  adminTerritoryService,
  adminTelephoneService,
  adminHermanosService,
  adminProgramaService,
  MANZANAS_POR_TERRITORIO,
  TOTAL_TERRITORIOS,
  ESTADOS_TELEFONICOS,
};

export default defaultExport;
