import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

// Interfaces para números telefónicos
export interface PhoneRecord {
  id: string;
  propietario: string;
  direccion: string;
  numero: string;
  publicador?: string;
  estado?: PhoneCallStatus;
  comentarios?: string;
  fechaAsignacion?: any; // Timestamp cuando se exportó en PDF
  fechaEstado?: any; // Timestamp cuando se cambió el estado
  isAsignado?: boolean; // Estado oculto para cooldown de 15 días
  createdAt: any;
  updatedAt: any;
}

export interface PhoneRequestResult {
  numbers: PhoneRecord[];
  total: number;
  availableCount: number;
  needsReset: boolean;
}

export interface PhoneStats {
  total: number;
  contestaron: number;
  colgaron: number;
  revisita: number;
  noLlamar: number;
  suspendido: number;
  devuelto: number;
  noContestaron: number;
  testigo: number;
  asignados: number; // Números en cooldown
}

export type PhoneCallStatus =
  | "Contestaron"
  | "Colgaron"
  | "Revisita"
  | "No llamar"
  | "Suspendido"
  | "Devuelto"
  | "No contestaron"
  | "Testigo";

export const PHONE_CALL_STATUSES: {
  value: PhoneCallStatus;
  label: string;
  color: string;
}[] = [
  {
    value: "Contestaron",
    label: "Contestaron",
    color: "bg-green-100 text-green-800",
  },
  { value: "Colgaron", label: "Colgaron", color: "bg-red-100 text-red-800" },
  { value: "Revisita", label: "Revisita", color: "bg-blue-100 text-blue-800" },
  {
    value: "No llamar",
    label: "No llamar",
    color: "bg-gray-100 text-gray-800",
  },
  {
    value: "Suspendido",
    label: "Suspendido",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    value: "Devuelto",
    label: "Devuelto",
    color: "bg-purple-100 text-purple-800",
  },
  {
    value: "No contestaron",
    label: "No contestaron",
    color: "bg-orange-100 text-orange-800",
  },
  {
    value: "Testigo",
    label: "Testigo",
    color: "bg-indigo-100 text-indigo-800",
  },
];

class PhoneServiceAdvanced {
  private static instance: PhoneServiceAdvanced;
  private readonly COLLECTION_NAME = "phoneNumbers";
  private readonly COOLDOWN_DAYS = 15;

  static getInstance(): PhoneServiceAdvanced {
    if (!PhoneServiceAdvanced.instance) {
      PhoneServiceAdvanced.instance = new PhoneServiceAdvanced();
    }
    return PhoneServiceAdvanced.instance;
  }

  // Función principal: Solicitar 50 números aleatorios
  async requestPhoneNumbers(): Promise<PhoneRequestResult> {
    try {
      console.log("🔍 Solicitando números telefónicos...");

      // 1. Obtener números disponibles (sin estado y no asignados)
      const availableNumbers = await this.getAvailableNumbers();
      console.log(`📞 Números disponibles: ${availableNumbers.length}`);

      // 2. Si no hay suficientes números disponibles, resetear estados
      if (availableNumbers.length < 50) {
        console.log(
          "🔄 No hay suficientes números disponibles, verificando si necesita reset..."
        );
        const needsReset = await this.checkIfNeedsReset();

        if (needsReset) {
          console.log("♻️ Reseteando todos los estados de números...");
          await this.resetAllPhoneStates();
          // Volver a obtener números después del reset
          const resetNumbers = await this.getAvailableNumbers();
          return {
            numbers: this.shuffleArray(resetNumbers).slice(0, 50),
            total: resetNumbers.length,
            availableCount: resetNumbers.length,
            needsReset: true,
          };
        }

        // Si no necesita reset, devolver los que hay
        return {
          numbers: this.shuffleArray(availableNumbers),
          total: availableNumbers.length,
          availableCount: availableNumbers.length,
          needsReset: false,
        };
      }

      // 3. Mezclar y tomar 50 números aleatorios
      const selectedNumbers = this.shuffleArray(availableNumbers).slice(0, 50);

      return {
        numbers: selectedNumbers,
        total: availableNumbers.length,
        availableCount: availableNumbers.length,
        needsReset: false,
      };
    } catch (error) {
      console.error("❌ Error solicitando números telefónicos:", error);
      throw new Error("Error al solicitar números telefónicos");
    }
  }

  // Exportar 30 números para PDF y marcarlos como asignados por 15 días
  async exportPhoneNumbersPDF(): Promise<PhoneRecord[]> {
    try {
      console.log("📑 Exportando 30 números para PDF...");

      // Obtener números disponibles
      const availableNumbers = await this.getAvailableNumbers();

      if (availableNumbers.length < 30) {
        throw new Error(
          `Solo hay ${availableNumbers.length} números disponibles. Se necesitan al menos 30.`
        );
      }

      // Seleccionar 30 números aleatorios
      const selectedNumbers = this.shuffleArray(availableNumbers).slice(0, 30);

      // Marcar como asignados con fecha de asignación
      const batch = writeBatch(db);
      const now = serverTimestamp();

      selectedNumbers.forEach((number) => {
        const docRef = doc(db, this.COLLECTION_NAME, number.id);
        batch.update(docRef, {
          isAsignado: true,
          fechaAsignacion: now,
          updatedAt: now,
        });
      });

      await batch.commit();
      console.log(
        `✅ ${selectedNumbers.length} números marcados como asignados`
      );

      return selectedNumbers;
    } catch (error) {
      console.error("❌ Error exportando números para PDF:", error);
      throw new Error("Error al exportar números para PDF");
    }
  }

  // Obtener números disponibles (sin estado y no asignados o con cooldown vencido)
  private async getAvailableNumbers(): Promise<PhoneRecord[]> {
    const now = new Date();
    const cooldownDate = new Date(
      now.getTime() - this.COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );

    // Obtener todos los números
    const q = query(collection(db, this.COLLECTION_NAME));
    const snapshot = await getDocs(q);

    const availableNumbers: PhoneRecord[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as PhoneRecord;
      const phoneRecord = { ...data, id: doc.id };

      // Verificar si está disponible
      const isAvailable = this.isNumberAvailable(phoneRecord, cooldownDate);

      if (isAvailable) {
        availableNumbers.push(phoneRecord);
      }
    });

    return availableNumbers;
  }

  // Verificar si un número está disponible
  private isNumberAvailable(
    phoneRecord: PhoneRecord,
    cooldownDate: Date
  ): boolean {
    // 1. No debe tener estado
    if (phoneRecord.estado) {
      return false;
    }

    // 2. Si no está asignado, está disponible
    if (!phoneRecord.isAsignado) {
      return true;
    }

    // 3. Si está asignado, verificar si ya pasó el cooldown
    if (phoneRecord.fechaAsignacion) {
      const assignmentDate = phoneRecord.fechaAsignacion.toDate();
      return assignmentDate < cooldownDate;
    }

    // Por defecto, si está asignado pero sin fecha, considerar no disponible
    return false;
  }

  // Verificar si necesita reset (todos los números disponibles tienen estado)
  private async checkIfNeedsReset(): Promise<boolean> {
    const q = query(collection(db, this.COLLECTION_NAME));
    const snapshot = await getDocs(q);

    let numbersWithoutState = 0;
    let totalNumbers = 0;

    const now = new Date();
    const cooldownDate = new Date(
      now.getTime() - this.COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as PhoneRecord;
      const phoneRecord = { ...data, id: doc.id };

      totalNumbers++;

      // Contar números que podrían estar disponibles después del reset
      const wouldBeAvailableAfterReset =
        !phoneRecord.isAsignado ||
        (phoneRecord.fechaAsignacion &&
          phoneRecord.fechaAsignacion.toDate() < cooldownDate);

      if (wouldBeAvailableAfterReset) {
        numbersWithoutState++;
      }
    });

    // Necesita reset si no hay números disponibles después del cooldown
    return numbersWithoutState > 0 && numbersWithoutState === totalNumbers;
  }

  // Resetear todos los estados de números (excepto los que están en cooldown)
  private async resetAllPhoneStates(): Promise<void> {
    const now = new Date();
    const cooldownDate = new Date(
      now.getTime() - this.COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );

    const q = query(collection(db, this.COLLECTION_NAME));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    let resetCount = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as PhoneRecord;
      const phoneRecord = { ...data, id: doc.id };

      // Solo resetear si no está en cooldown
      let shouldReset = false;

      if (!phoneRecord.isAsignado) {
        shouldReset = true;
      } else if (phoneRecord.fechaAsignacion) {
        const assignmentDate = phoneRecord.fechaAsignacion.toDate();
        if (assignmentDate < cooldownDate) {
          shouldReset = true;
        }
      }

      if (shouldReset) {
        batch.update(doc.ref, {
          estado: null,
          publicador: "",
          comentarios: "",
          isAsignado: false,
          fechaAsignacion: null,
          fechaEstado: null,
          updatedAt: serverTimestamp(),
        });
        resetCount++;
      }
    });

    if (resetCount > 0) {
      await batch.commit();
      console.log(`♻️ ${resetCount} números reseteados`);
    }
  }

  // Actualizar estado de un número
  async updatePhoneStatus(
    phoneId: string,
    updates: {
      publicador?: string;
      estado?: PhoneCallStatus;
      comentarios?: string;
    }
  ): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, phoneId);
      await updateDoc(docRef, {
        ...updates,
        fechaEstado: updates.estado ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("❌ Error actualizando estado del teléfono:", error);
      throw new Error("Error al actualizar estado del teléfono");
    }
  }

  // Actualizar número telefónico completo
  async updatePhoneNumber(
    phoneId: string,
    updates: {
      propietario?: string;
      direccion?: string;
      numero?: string;
      publicador?: string;
      estado?: PhoneCallStatus;
      comentarios?: string;
    }
  ): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, phoneId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("❌ Error actualizando número telefónico:", error);
      throw new Error("Error al actualizar número telefónico");
    }
  }

  // Obtener estadísticas de números telefónicos
  async getPhoneStats(numbers?: PhoneRecord[]): Promise<PhoneStats> {
    let phoneNumbers = numbers;

    if (!phoneNumbers) {
      const q = query(collection(db, this.COLLECTION_NAME));
      const snapshot = await getDocs(q);
      phoneNumbers = snapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as PhoneRecord)
      );
    }

    const stats: PhoneStats = {
      total: phoneNumbers.length,
      contestaron: 0,
      colgaron: 0,
      revisita: 0,
      noLlamar: 0,
      suspendido: 0,
      devuelto: 0,
      noContestaron: 0,
      testigo: 0,
      asignados: 0,
    };

    phoneNumbers.forEach((phone) => {
      if (phone.isAsignado) {
        stats.asignados++;
      }

      switch (phone.estado) {
        case "Contestaron":
          stats.contestaron++;
          break;
        case "Colgaron":
          stats.colgaron++;
          break;
        case "Revisita":
          stats.revisita++;
          break;
        case "No llamar":
          stats.noLlamar++;
          break;
        case "Suspendido":
          stats.suspendido++;
          break;
        case "Devuelto":
          stats.devuelto++;
          break;
        case "No contestaron":
          stats.noContestaron++;
          break;
        case "Testigo":
          stats.testigo++;
          break;
      }
    });

    return stats;
  }

  // Obtener todos los números telefónicos (para administradores)
  async getAllPhoneNumbers(): Promise<PhoneRecord[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(
        (doc) =>
          ({
            ...doc.data(),
            id: doc.id,
          } as PhoneRecord)
      );
    } catch (error) {
      console.error("❌ Error obteniendo números telefónicos:", error);
      throw new Error("Error al obtener números telefónicos");
    }
  }

  // Función para mezclar array (algoritmo Fisher-Yates)
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Crear nuevo número telefónico (para administradores)
  async createPhoneNumber(
    phoneData: Omit<PhoneRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<string> {
    try {
      console.log(
        "📞 Creando número telefónico:",
        phoneData.propietario,
        phoneData.numero
      );

      // Verificar si el número ya existe
      const existingQuery = query(
        collection(db, this.COLLECTION_NAME),
        where("numero", "==", phoneData.numero)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        console.warn(
          `⚠️ Número ${phoneData.numero} ya existe, omitiendo duplicado`
        );
        return existingSnapshot.docs[0].id;
      }

      const docRef = doc(collection(db, this.COLLECTION_NAME));
      const newPhone: Omit<PhoneRecord, "id"> = {
        ...phoneData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Asegurar valores por defecto
        isAsignado: phoneData.isAsignado || false,
        comentarios: phoneData.comentarios || "",
      };

      await setDoc(docRef, newPhone);
      console.log(
        `✅ Número creado exitosamente: ${phoneData.propietario} - ${phoneData.numero}`
      );
      return docRef.id;
    } catch (error) {
      console.error("❌ Error creando número telefónico:", error);
      throw new Error("Error al crear número telefónico");
    }
  }

  // Carga masiva de números telefónicos
  async bulkCreatePhoneNumbers(
    numbers: Omit<PhoneRecord, "id" | "createdAt" | "updatedAt">[]
  ): Promise<{
    created: number;
    skipped: number;
    errors: string[];
  }> {
    const batch = writeBatch(db);
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    try {
      console.log(`📦 Iniciando carga masiva de ${numbers.length} números...`);

      for (const phoneData of numbers) {
        try {
          // Verificar duplicados
          const existingQuery = query(
            collection(db, this.COLLECTION_NAME),
            where("numero", "==", phoneData.numero)
          );
          const existingSnapshot = await getDocs(existingQuery);

          if (!existingSnapshot.empty) {
            results.skipped++;
            continue;
          }

          // Preparar datos para batch
          const docRef = doc(collection(db, this.COLLECTION_NAME));
          const docData = {
            ...phoneData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isAsignado: phoneData.isAsignado || false,
            comentarios: phoneData.comentarios || "",
          };

          batch.set(docRef, docData);
          results.created++;
        } catch (error) {
          results.errors.push(`Error con ${phoneData.numero}: ${error}`);
        }
      }

      // Ejecutar batch
      await batch.commit();

      console.log(`✅ Carga masiva completada:`, results);
      return results;
    } catch (error) {
      console.error("❌ Error en carga masiva:", error);
      throw error;
    }
  }

  // Eliminar número telefónico (para administradores)
  async deletePhoneNumber(phoneId: string): Promise<void> {
    try {
      await updateDoc(doc(db, this.COLLECTION_NAME, phoneId), {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("❌ Error eliminando número telefónico:", error);
      throw new Error("Error al eliminar número telefónico");
    }
  }

  // Limpiar números en cooldown vencido (función de mantenimiento)
  async cleanupExpiredCooldowns(): Promise<number> {
    try {
      const now = new Date();
      const cooldownDate = new Date(
        now.getTime() - this.COOLDOWN_DAYS * 24 * 60 * 60 * 1000
      );

      const q = query(
        collection(db, this.COLLECTION_NAME),
        where("isAsignado", "==", true)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      let cleanupCount = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as PhoneRecord;

        if (
          data.fechaAsignacion &&
          data.fechaAsignacion.toDate() < cooldownDate
        ) {
          batch.update(doc.ref, {
            isAsignado: false,
            fechaAsignacion: null,
            updatedAt: serverTimestamp(),
          });
          cleanupCount++;
        }
      });

      if (cleanupCount > 0) {
        await batch.commit();
        console.log(`🧹 ${cleanupCount} números limpiados del cooldown`);
      }

      return cleanupCount;
    } catch (error) {
      console.error("❌ Error limpiando cooldowns vencidos:", error);
      return 0;
    }
  }
}

// Exportar instancia singleton
export const phoneService = PhoneServiceAdvanced.getInstance();
