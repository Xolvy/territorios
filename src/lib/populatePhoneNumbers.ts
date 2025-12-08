import { phoneService } from "./phoneServiceAdvanced";

// Datos de ejemplo para números telefónicos de prueba
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
  {
    propietario: "CASTRO ALEJANDRO VICKY",
    direccion: "AV. BOLÍVAR",
    numero: "500 1967",
  },
  {
    propietario: "CUEVA JIMÉNEZ FRANKLIN",
    direccion: "AV. BOLÍVAR",
    numero: "500 4029",
  },
  {
    propietario: "TORRES MENDEZ CARMEN",
    direccion: "AV. CONSTITUCIÓN 123",
    numero: "267 3849",
  },
  {
    propietario: "RIVERA SANTOS PEDRO",
    direccion: "CALLE SUCRE 456",
    numero: "298 5647",
  },
  {
    propietario: "MORALES LOPEZ ANA",
    direccion: "AV. 6 DE DICIEMBRE 789",
    numero: "234 7890",
  },
  {
    propietario: "GONZALEZ PEREZ LUIS",
    direccion: "CALLE PICHINCHA 321",
    numero: "456 1234",
  },
  {
    propietario: "VARGAS CASTRO MARIA",
    direccion: "AV. AMAZONAS 654",
    numero: "567 8901",
  },
  {
    propietario: "HERNANDEZ RUIZ JOSE",
    direccion: "CALLE MEJIA 987",
    numero: "678 9012",
  },
  {
    propietario: "JIMENEZ TORRES ROSA",
    direccion: "AV. PATRIA 147",
    numero: "789 0123",
  },
  {
    propietario: "CASTRO MORALES DIEGO",
    direccion: "CALLE VENEZUELA 258",
    numero: "890 1234",
  },
];

// Función para poblar Firebase con datos de prueba
export async function populatePhoneNumbers(): Promise<void> {
  console.log("🚀 Iniciando población de números telefónicos de prueba...");
  console.log(`📊 Total de números a procesar: ${SAMPLE_PHONE_DATA.length}`);

  try {
    let success = 0;
    let errors = 0;

    for (const phoneData of SAMPLE_PHONE_DATA) {
      try {
        await phoneService.createPhoneNumber(phoneData);
        success++;
        console.log(`✅ Creado: ${phoneData.propietario}`);
      } catch (error) {
        errors++;
        console.error(`❌ Error creando ${phoneData.propietario}:`, error);
      }
    }

    console.log("🎉 Población de números telefónicos de prueba completada!");
    console.log(`📈 Estadísticas: ${success} éxitos, ${errors} errores`);

    if (errors > 0) {
      console.warn(`⚠️  Se encontraron ${errors} errores durante la población`);
    }

    // Verificar estado de la base de datos después de la población
    const stats = await phoneService.getPhoneStats();
    console.log(`📱 Total de números en base de datos: ${stats.total}`);
  } catch (error) {
    console.error("💥 Error durante la población:", error);
    throw error;
  }
}

// Función para limpiar todos los números existentes
export async function clearAllPhoneNumbers(): Promise<void> {
  console.log("🧹 Iniciando limpieza de números telefónicos...");

  try {
    const allNumbers = await phoneService.getAllPhoneNumbers();
    let deleted = 0;

    for (const phoneNumber of allNumbers) {
      try {
        await phoneService.deletePhoneNumber(phoneNumber.id);
        deleted++;
        if (deleted % 10 === 0) {
          console.log(`🗑️  Eliminados: ${deleted}/${allNumbers.length}`);
        }
      } catch (error) {
        console.error(`❌ Error eliminando ${phoneNumber.propietario}:`, error);
      }
    }

    console.log(`🧹 Limpieza completada: ${deleted} números eliminados`);
  } catch (error) {
    console.error("❌ Error durante la limpieza:", error);
    throw error;
  }
}

// Función para verificar el estado de la base de datos
export async function checkPhoneNumbersStatus(): Promise<void> {
  try {
    console.log("🔍 Verificando estado de números telefónicos...");

    const allNumbers = await phoneService.getAllPhoneNumbers();
    const stats = await phoneService.getPhoneStats();

    console.log("📊 Estadísticas de la base de datos:");
    console.log(`  Total de números: ${stats.total}`);
    console.log(
      `  Sin estado: ${
        stats.total -
        (stats.contestaron +
          stats.colgaron +
          stats.revisita +
          stats.noLlamar +
          stats.suspendido +
          stats.devuelto +
          stats.noContestaron +
          stats.testigo)
      }`
    );
    console.log(`  Contestaron: ${stats.contestaron}`);
    console.log(`  No contestaron: ${stats.noContestaron}`);
    console.log(`  Asignados (cooldown): ${stats.asignados}`);
    console.log(
      `  Otros estados: ${
        stats.colgaron +
        stats.revisita +
        stats.noLlamar +
        stats.suspendido +
        stats.devuelto +
        stats.testigo
      }`
    );

    // Verificar números disponibles
    const availableResult = await phoneService.requestPhoneNumbers();
    console.log(
      `📞 Números disponibles para solicitud: ${availableResult.availableCount}`
    );
  } catch (error) {
    console.error("❌ Error verificando estado:", error);
    throw error;
  }
}
