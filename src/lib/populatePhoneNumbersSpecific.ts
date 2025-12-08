import { phoneService, PhoneCallStatus } from "./phoneServiceAdvanced";

/**
 * Formatear número telefónico con separación
 * Ejemplo: "2962677" -> "296 2677", "296 2677" -> "296 2677"
 * Acepta números con o sin espacios y los normaliza al formato correcto
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return "";

  // Limpiar el número (solo dígitos) - esto maneja tanto "297 9777" como "2979777"
  const cleanNumber = phoneNumber.replace(/\D/g, "");

  // Si tiene 7 dígitos, formatear como XXX XXXX
  if (cleanNumber.length === 7) {
    return `${cleanNumber.slice(0, 3)} ${cleanNumber.slice(3)}`;
  }

  // Si tiene 8 dígitos, formatear como XXXX XXXX
  if (cleanNumber.length === 8) {
    return `${cleanNumber.slice(0, 4)} ${cleanNumber.slice(4)}`;
  }

  // Si tiene 10 dígitos (con código de área), formatear como XXX XXX XXXX
  if (cleanNumber.length === 10) {
    return `${cleanNumber.slice(0, 3)} ${cleanNumber.slice(
      3,
      6
    )} ${cleanNumber.slice(6)}`;
  }

  // Para otros casos, intentar formato básico
  if (cleanNumber.length >= 6) {
    const firstPart = cleanNumber.slice(0, 3);
    const restPart = cleanNumber.slice(3);
    return `${firstPart} ${restPart}`;
  }

  return cleanNumber; // Devolver sin formato si es muy corto
};

/**
 * Función para subir números telefónicos directamente a Firebase desde datos CSV
 * Los números se almacenan únicamente en Firestore, no en el código
 * Incluye callback de progreso para mostrar estado de carga
 */
export const uploadPhoneNumbersToFirebase = async (
  csvData: string,
  onProgress?: (current: number, total: number, percentage: number) => void
): Promise<void> => {
  // Si no hay datos, salir
  if (!csvData.trim()) {
    console.log("⏳ No hay datos CSV para procesar...");
    return;
  }

  const fullData = csvData;
  console.log(
    "📝 Iniciando carga de números telefónicos directamente a Firebase..."
  );

  const lines = fullData.split("\n").filter((line) => line.trim());
  let processedCount = 0;
  const totalLines = lines.length;

  // Reportar progreso inicial
  onProgress?.(0, totalLines, 0);

  // Función para mapear estado a tipo correcto
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
      return "Colgaron"; // Mapeamos ocupado a colgaron
    } else if (estadoLower.includes("fuera de servicio")) {
      return "No llamar";
    } else if (
      estadoLower.includes("contest") &&
      !estadoLower.includes("no contest")
    ) {
      return "Contestaron";
    }

    return "No contestaron"; // Estado por defecto
  };

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

        // Limpiar el número telefónico (solo dígitos)
        const telefonoLimpio = telefonoRaw.replace(/\D/g, "");

        if (telefonoLimpio && telefonoLimpio.length >= 7) {
          await phoneService.createPhoneNumber({
            numero: telefonoLimpio,
            propietario: nombre,
            direccion: direccion,
            publicador: asignadoA,
            estado: estado,
            comentarios: `Territorio: Específicos`,
          });

          processedCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error procesando línea: ${line}`, error);
    }

    // Reportar progreso después de cada línea procesada
    const percentage = Math.round(((i + 1) / totalLines) * 100);
    onProgress?.(i + 1, totalLines, percentage);
  }

  console.log(
    `✅ Procesados ${processedCount} números telefónicos y subidos a Firebase`
  );
};

/**
 * Función para eliminar todos los números telefónicos existentes
 */
export const clearAllPhoneNumbers = async (): Promise<void> => {
  try {
    console.log("🧹 Eliminando todos los números telefónicos existentes...");
    const allNumbers = await phoneService.getAllPhoneNumbers();

    for (const phoneData of allNumbers) {
      if (phoneData.id) {
        await phoneService.deletePhoneNumber(phoneData.id);
      }
    }

    console.log(`✅ Eliminados ${allNumbers.length} números telefónicos`);
  } catch (error) {
    console.error("❌ Error eliminando números:", error);
    throw error;
  }
};

/**
 * Función para verificar el estado de los datos asignados
 */
export const checkSpecificDataStatus = async (): Promise<{
  totalNumbers: number;
  assignedNumbers: number;
  hasData: boolean;
}> => {
  try {
    const allNumbers = await phoneService.getAllPhoneNumbers();

    // Calcular fecha de cooldown (15 días atrás)
    const now = new Date();
    const cooldownDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

    // Contar números asignados: incluye Revisitas, números en cooldown, y específicos del usuario
    const assignedNumbers = allNumbers.filter((n) => {
      // 1. Números con estado "Revisita"
      if (n.estado === "Revisita") {
        return true;
      }

      // 2. Números que están en cooldown (generados en PDF, isAsignado=true)
      if (n.isAsignado && n.fechaAsignacion) {
        const assignmentDate = n.fechaAsignacion.toDate
          ? n.fechaAsignacion.toDate()
          : new Date(n.fechaAsignacion);
        // Si la fecha de asignación es posterior al cooldown, está en período de cooldown
        if (assignmentDate >= cooldownDate) {
          return true;
        }
      }

      // 3. Números específicos subidos por el usuario (mantener compatibilidad)
      if (n.comentarios && n.comentarios.includes("Territorio: Específicos")) {
        return true;
      }

      return false;
    });

    return {
      totalNumbers: allNumbers.length,
      assignedNumbers: assignedNumbers.length,
      hasData: assignedNumbers.length > 0,
    };
  } catch (error) {
    console.error("❌ Error verificando estado:", error);
    return {
      totalNumbers: 0,
      assignedNumbers: 0,
      hasData: false,
    };
  }
};

export const checkPhoneNumbersStatus = checkSpecificDataStatus;
