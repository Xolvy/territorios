import { getAdminAuth, isAdminSDKAvailable } from "./firebase-admin";

/**
 * Servicio para manejar operaciones de Firebase Auth usando Admin SDK
 */
export class AdminAuthService {
  /**
   * Verificar si el Admin SDK está configurado
   */
  static isConfigured(): boolean {
    return isAdminSDKAvailable();
  }

  /**
   * Actualizar email de un usuario en Firebase Auth
   * Usado para cambiar el "pseudo-email" cuando se cambia el número de teléfono
   */
  static async updateUserEmail(uid: string, newEmail: string): Promise<void> {
    if (!isAdminSDKAvailable()) {
      throw new Error("Firebase Admin SDK no está configurado");
    }

    try {
      const auth = getAdminAuth();
      await auth.updateUser(uid, {
        email: newEmail,
      });

      console.log(`✅ Email actualizado para usuario ${uid}: ${newEmail}`);
    } catch (error: any) {
      console.error(`❌ Error actualizando email para ${uid}:`, error);
      throw new Error(`No se pudo actualizar el email: ${error.message}`);
    }
  }

  /**
   * Actualizar número de teléfono de un usuario en Firebase Auth
   */
  static async updateUserPhoneNumber(
    uid: string,
    phoneNumber: string
  ): Promise<void> {
    if (!isAdminSDKAvailable()) {
      throw new Error("Firebase Admin SDK no está configurado");
    }

    try {
      const auth = getAdminAuth();
      await auth.updateUser(uid, {
        phoneNumber: phoneNumber,
      });

      console.log(
        `✅ Número de teléfono actualizado para usuario ${uid}: ${phoneNumber}`
      );
    } catch (error: any) {
      console.error(`❌ Error actualizando teléfono para ${uid}:`, error);
      throw new Error(`No se pudo actualizar el teléfono: ${error.message}`);
    }
  }

  /**
   * Buscar usuario por email
   */
  static async getUserByEmail(email: string): Promise<any> {
    if (!isAdminSDKAvailable()) {
      throw new Error("Firebase Admin SDK no está configurado");
    }

    try {
      const auth = getAdminAuth();
      const userRecord = await auth.getUserByEmail(email);
      return userRecord;
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        return null;
      }
      console.error(`❌ Error buscando usuario por email ${email}:`, error);
      throw error;
    }
  }

  /**
   * Buscar usuario por número de teléfono
   */
  static async getUserByPhoneNumber(phoneNumber: string): Promise<any> {
    if (!isAdminSDKAvailable()) {
      throw new Error("Firebase Admin SDK no está configurado");
    }

    try {
      const auth = getAdminAuth();
      const userRecord = await auth.getUserByPhoneNumber(phoneNumber);
      return userRecord;
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        return null;
      }
      console.error(
        `❌ Error buscando usuario por teléfono ${phoneNumber}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Actualizar tanto email como teléfono cuando se cambia el número
   * Esta es la función principal para el cambio de números de teléfono
   */
  static async updateUserPhoneAndEmail(
    oldPhoneNumber: string,
    newPhoneNumber: string
  ): Promise<{ success: boolean; message: string; userRecord?: any }> {
    if (!isAdminSDKAvailable()) {
      return {
        success: false,
        message:
          "Firebase Admin SDK no está configurado. Configura las variables de entorno.",
      };
    }

    try {
      const auth = getAdminAuth();

      // Buscar usuario por el email pseudo anterior
      const oldEmail = `${oldPhoneNumber.replace(/[^0-9]/g, "")}@phone.local`;
      const newEmail = `${newPhoneNumber.replace(/[^0-9]/g, "")}@phone.local`;

      let userRecord = null;

      // Intentar encontrar el usuario por email
      try {
        userRecord = await auth.getUserByEmail(oldEmail);
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          // Intentar por número de teléfono
          try {
            userRecord = await auth.getUserByPhoneNumber(oldPhoneNumber);
          } catch (phoneError: any) {
            if (phoneError.code === "auth/user-not-found") {
              return {
                success: true,
                message:
                  "Usuario no encontrado en Firebase Auth - probablemente solo existe en Firestore",
              };
            }
            throw phoneError;
          }
        } else {
          throw error;
        }
      }

      // Si encontramos el usuario, actualizarlo
      if (userRecord) {
        await auth.updateUser(userRecord.uid, {
          email: newEmail,
          phoneNumber: newPhoneNumber,
        });

        return {
          success: true,
          message: `Usuario actualizado en Firebase Auth - UID: ${userRecord.uid}`,
          userRecord: userRecord,
        };
      }

      return {
        success: true,
        message: "Usuario no encontrado en Firebase Auth",
      };
    } catch (error: any) {
      console.error("❌ Error en updateUserPhoneAndEmail:", error);
      return {
        success: false,
        message: `Error actualizando Firebase Auth: ${error.message}`,
      };
    }
  }

  /**
   * Listar todos los usuarios (para debugging)
   */
  static async listUsers(maxResults: number = 10): Promise<any[]> {
    if (!isAdminSDKAvailable()) {
      throw new Error("Firebase Admin SDK no está configurado");
    }

    try {
      const auth = getAdminAuth();
      const listUsersResult = await auth.listUsers(maxResults);
      return listUsersResult.users;
    } catch (error: any) {
      console.error("❌ Error listando usuarios:", error);
      throw error;
    }
  }
}

export default AdminAuthService;
