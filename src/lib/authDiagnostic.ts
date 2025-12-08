/**
 * Utilidad para diagnosticar problemas de autenticación
 * Verifica si el usuario existe en Firebase Auth
 */

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export const authDiagnostic = {
  /**
   * Verificar si un email existe en Firebase Auth
   */
  async checkUserExists(
    email: string
  ): Promise<{ exists: boolean; message: string }> {
    try {
      // Intentar login con contraseña incorrecta para verificar si el usuario existe
      await signInWithEmailAndPassword(auth, email, "password-incorrecta-test");
      return {
        exists: true,
        message: "Usuario existe (contraseña incorrecta esperada)",
      };
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        return { exists: false, message: "Usuario no existe en Firebase Auth" };
      } else if (error.code === "auth/wrong-password") {
        return { exists: true, message: "Usuario existe en Firebase Auth" };
      } else {
        return {
          exists: false,
          message: `Error verificando usuario: ${error.code}`,
        };
      }
    }
  },

  /**
   * Verificar configuración de Firebase
   */
  checkFirebaseConfig(): { valid: boolean; message: string; config?: any } {
    try {
      const config = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      };

      const isValid = Object.values(config).every(
        (value) => value && value !== "undefined"
      );

      return {
        valid: isValid,
        message: isValid
          ? "Configuración Firebase válida"
          : "Configuración Firebase incompleta",
        config: isValid ? config : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        message: `Error en configuración: ${error}`,
      };
    }
  },

  /**
   * Diagnóstico completo del sistema de auth
   */
  async fullDiagnostic(email: string) {
    const isDevelopment = process.env.NODE_ENV === "development";

    if (isDevelopment) {
      console.log("🔍 === DIAGNÓSTICO DE AUTENTICACIÓN ===");
    }

    // 1. Verificar configuración
    const configCheck = this.checkFirebaseConfig();
    if (isDevelopment) {
      console.log("📋 Configuración Firebase:", configCheck);
    }

    // 2. Verificar si el usuario existe
    const userCheck = await this.checkUserExists(email);
    if (isDevelopment) {
      console.log("👤 Verificación de usuario:", userCheck);
    }

    // 3. Verificar conexión a Firebase
    if (isDevelopment) {
      console.log("🔥 Firebase Auth disponible:", !!auth);
      console.log("📍 Auth Domain:", auth?.config?.authDomain);
    }

    return {
      config: configCheck,
      user: userCheck,
      authAvailable: !!auth,
    };
  },
};
