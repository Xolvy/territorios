import { phoneService, PhoneCallStatus } from "./phoneServiceAdvanced";

/**
 * GESTOR UNIFICADO DE NÚMEROS TELEFÓNICOS
 * Consolida todas las funciones de población, limpieza y verificación
 */

// =============================================================================
// UTILIDADES COMUNES
// =============================================================================

/**
 * Formatear número telefónico con separación estándar
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return "";

  const cleanNumber = phoneNumber.replace(/\D/g, "");

  if (cleanNumber.length === 7) {
    return `${cleanNumber.slice(0, 3)} ${cleanNumber.slice(3)}`;
  }
  if (cleanNumber.length === 8) {
    return `${cleanNumber.slice(0, 4)} ${cleanNumber.slice(4)}`;
  }
  if (cleanNumber.length === 10) {
    return `${cleanNumber.slice(0, 3)} ${cleanNumber.slice(
      3,
      6
    )} ${cleanNumber.slice(6)}`;
  }
  if (cleanNumber.length >= 6) {
    const firstPart = cleanNumber.slice(0, 3);
    const restPart = cleanNumber.slice(3);
    return `${firstPart} ${restPart}`;
  }

  return cleanNumber;
};

/**
 * Mapear estado de texto a tipo PhoneCallStatus
 */
const mapEstado = (estado: string): PhoneCallStatus => {
  const estadoLower = estado.toLowerCase().trim();

  if (
    estadoLower.includes("no contest") ||
    estadoLower.includes("no contesta")
  ) {
    return "No contestaron";
  } else if (estadoLower.includes("colg")) {
    return "Colgaron";
  } else if (estadoLower.includes("ocupado")) {
    return "Colgaron";
  } else if (estadoLower.includes("fuera de servicio")) {
    return "No llamar";
  } else if (
    estadoLower.includes("contest") &&
    !estadoLower.includes("no contest")
  ) {
    return "Contestaron";
  }

  return "No contestaron";
};

// =============================================================================
// DATOS DE PRUEBA
// =============================================================================

const SAMPLE_PHONE_DATA = [
  {
    propietario: "PALACIOS JORDAN ZOILA",
    direccion: "AV. ARÍZAGA 724",
    numero: "293 0748",
  },
  {
    propietario: "HUANGA NIEVES ELSA",
    direccion: "AV. ARÍZAGA 810",
    numero: "500 1695",
  },
  {
    propietario: "MONTOYA APONTE EXAR",
    direccion: "AV. ARÍZAGA 822",
    numero: "500 1996",
  },
  {
    propietario: "ARELLANO DELGADO MÓNICA",
    direccion: "AV. BOLÍVAR",
    numero: "263 5541",
  },
  {
    propietario: "ASTUDILLO AGUILAR MARÍA",
    direccion: "AV. BOLÍVAR",
    numero: "296 4982",
  },
  // Más datos de prueba disponibles si se necesitan
];

// =============================================================================
// FUNCIONES PRINCIPALES
// =============================================================================

/**
 * Limpiar todos los números telefónicos existentes
 */
export const clearAllPhoneNumbers = async (
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  console.log("🧹 Iniciando limpieza de números telefónicos...");

  try {
    const allNumbers = await phoneService.getAllPhoneNumbers();
    let deleted = 0;
    const total = allNumbers.length;

    onProgress?.(0, total);

    for (const phoneNumber of allNumbers) {
      try {
        if (phoneNumber.id) {
          await phoneService.deletePhoneNumber(phoneNumber.id);
          deleted++;
          if (deleted % 10 === 0) {
            console.log(`🗑️  Eliminados: ${deleted}/${total}`);
            onProgress?.(deleted, total);
          }
        }
      } catch (error) {
        console.error(`❌ Error eliminando ${phoneNumber.propietario}:`, error);
      }
    }

    console.log(`🧹 Limpieza completada: ${deleted} números eliminados`);
    onProgress?.(deleted, total);
  } catch (error) {
    console.error("❌ Error durante la limpieza:", error);
    throw error;
  }
};

/**
 * Poblar con datos de prueba (para desarrollo)
 */
export const populateTestPhoneNumbers = async (
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  console.log("🚀 Iniciando población con datos de prueba...");
  console.log(`📊 Total de números a procesar: ${SAMPLE_PHONE_DATA.length}`);

  try {
    let success = 0;
    let errors = 0;
    const total = SAMPLE_PHONE_DATA.length;

    onProgress?.(0, total);

    for (const phoneData of SAMPLE_PHONE_DATA) {
      try {
        await phoneService.createPhoneNumber(phoneData);
        success++;
        console.log(`✅ Creado: ${phoneData.propietario}`);
        onProgress?.(success + errors, total);
      } catch (error) {
        errors++;
        console.error(`❌ Error creando ${phoneData.propietario}:`, error);
        onProgress?.(success + errors, total);
      }
    }

    console.log("🎉 Población de datos de prueba completada!");
    console.log(`📈 Estadísticas: ${success} éxitos, ${errors} errores`);
  } catch (error) {
    console.error("💥 Error durante la población:", error);
    throw error;
  }
};

/**
 * Subir números desde datos CSV dinámicos
 */
export const uploadPhoneNumbersFromCSV = async (
  csvData: string,
  onProgress?: (current: number, total: number, percentage: number) => void
): Promise<void> => {
  if (!csvData.trim()) {
    console.log("⏳ No hay datos CSV para procesar...");
    return;
  }

  console.log("📝 Iniciando carga de números telefónicos desde CSV...");

  const lines = csvData.split("\n").filter((line) => line.trim());
  let processedCount = 0;
  const totalLines = lines.length;

  onProgress?.(0, totalLines, 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      const parts = line.split(",").map((part) => part.trim());

      if (parts.length >= 3) {
        const nombre = parts[0];
        const direccion = parts[1];
        const telefonoRaw = parts[2];
        const asignadoA = parts[3] || "";
        const estadoTexto = parts[4] || "No llamado";

        const estado = mapEstado(estadoTexto);
        const telefonoLimpio = telefonoRaw.replace(/\D/g, "");

        if (telefonoLimpio && telefonoLimpio.length >= 7) {
          await phoneService.createPhoneNumber({
            numero: telefonoLimpio,
            propietario: nombre,
            direccion: direccion,
            publicador: asignadoA,
            estado: estado,
            comentarios: `Territorio: CSV Upload`,
          });

          processedCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error procesando línea: ${line}`, error);
    }

    const percentage = Math.round(((i + 1) / totalLines) * 100);
    onProgress?.(i + 1, totalLines, percentage);
  }

  console.log(`✅ Procesados ${processedCount} números telefónicos desde CSV`);
};

/**
 * Verificar estado actual de la base de datos (FUNCIÓN UNIFICADA)
 */
export const checkPhoneNumbersStatus = async (): Promise<{
  totalNumbers: number;
  assignedNumbers: number;
  availableNumbers: number;
  stats: any;
  hasData: boolean;
}> => {
  try {
    console.log("🔍 Verificando estado de números telefónicos...");

    const allNumbers = await phoneService.getAllPhoneNumbers();
    const stats = await phoneService.getPhoneStats();

    // Calcular fecha de cooldown (15 días atrás)
    const now = new Date();
    const cooldownDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

    // Contar números asignados
    const assignedNumbers = allNumbers.filter((n) => {
      // Números con estado "Revisita"
      if (n.estado === "Revisita") return true;

      // Números que están en cooldown
      if (n.isAsignado && n.fechaAsignacion) {
        const assignmentDate = n.fechaAsignacion.toDate
          ? n.fechaAsignacion.toDate()
          : new Date(n.fechaAsignacion);
        if (assignmentDate >= cooldownDate) return true;
      }

      return false;
    });

    // Verificar números disponibles
    const availableResult = await phoneService.requestPhoneNumbers();

    console.log("📊 Estadísticas de la base de datos:");
    console.log(`  Total de números: ${stats.total}`);
    console.log(`  Contestaron: ${stats.contestaron}`);
    console.log(`  No contestaron: ${stats.noContestaron}`);
    console.log(`  Asignados (cooldown): ${stats.asignados}`);
    console.log(
      `  Disponibles para solicitud: ${availableResult.availableCount}`
    );

    return {
      totalNumbers: allNumbers.length,
      assignedNumbers: assignedNumbers.length,
      availableNumbers: availableResult.availableCount,
      stats,
      hasData: allNumbers.length > 0,
    };
  } catch (error) {
    console.error("❌ Error verificando estado:", error);
    return {
      totalNumbers: 0,
      assignedNumbers: 0,
      availableNumbers: 0,
      stats: null,
      hasData: false,
    };
  }
};

// =============================================================================
// EXPORTACIONES DE COMPATIBILIDAD (para mantener código existente)
// =============================================================================

// Alias para mantener compatibilidad con código existente
export const populatePhoneNumbers = populateTestPhoneNumbers;
export const uploadPhoneNumbersToFirebase = uploadPhoneNumbersFromCSV;
export const clearPhoneNumbers = clearAllPhoneNumbers;
export const checkDataStatus = checkPhoneNumbersStatus;

// Funciones específicas mantenidas por compatibilidad
export const checkSpecificDataStatus = checkPhoneNumbersStatus;
export const checkRealDataStatus = checkPhoneNumbersStatus;
