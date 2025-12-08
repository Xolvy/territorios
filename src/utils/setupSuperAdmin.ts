import { auth } from "../lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { userService } from "../lib/userService";

/**
 * Script para crear el usuario super admin con email/contraseña
 * Ejecutar una sola vez para configurar el usuario inicial
 */
export const createSuperAdminUser = async () => {
  try {
    console.log("🔧 Creando usuario super admin...");

    // Crear usuario en Firebase Auth con email/contraseña
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      "59994749286@phone.local", // Email basado en el teléfono
      "Territorios" // Contraseña
    );

    console.log("✅ Usuario creado en Firebase Auth:", userCredential.user.uid);

    // Crear perfil de usuario en Firestore
    const appUser = await userService.createUser(
      {
        phoneNumber: "+593994749286",
        fullName: "Super Administrador",
        role: "super-admin",
        serviceGroup: "",
        notes: "Usuario super administrador - Acceso completo al sistema",
      },
      "system"
    );

    console.log("✅ Perfil de usuario creado:", appUser);

    // Crear usuario alternativo con email normal para testing
    const userCredentialEmail = await createUserWithEmailAndPassword(
      auth,
      "admin@territorios.com",
      "Territorios"
    );

    console.log("✅ Usuario con email creado:", userCredentialEmail.user.uid);

    const appUserEmail = await userService.createUser(
      {
        phoneNumber: "+593994749287", // Número diferente
        fullName: "Administrador Email",
        role: "admin",
        serviceGroup: "Grupo 1",
        notes: "Usuario administrador para testing con email",
      },
      "system"
    );

    console.log("✅ Perfil de usuario email creado:", appUserEmail);

    return {
      superAdmin: {
        email: "59994749286@phone.local",
        password: "Territorios",
        phone: "+593994749286",
        uid: userCredential.user.uid,
      },
      adminEmail: {
        email: "admin@territorios.com",
        password: "Territorios",
        phone: "+593994749287",
        uid: userCredentialEmail.user.uid,
      },
    };
  } catch (error) {
    console.error("❌ Error creando usuarios:", error);
    throw error;
  }
};

// Datos de acceso por defecto
export const DEFAULT_CREDENTIALS = {
  superAdminPrimary: {
    email: "italo.fm0@gmail.com",
    password: "Sonita.09",
    uid: "LvkcQrZS7yQobvnXoOoJthNduUT2",
  },
  superAdminBackup: {
    username: "+593994749286", // Se puede usar el teléfono
    email: "59994749286@phone.local", // O el email derivado
    password: "Territorios",
  },
};

console.log("📋 Credenciales por defecto configuradas:");
console.log(
  "Super Admin Principal - Email:",
  DEFAULT_CREDENTIALS.superAdminPrimary.email
);
console.log(
  "Super Admin Principal - Contraseña:",
  DEFAULT_CREDENTIALS.superAdminPrimary.password
);
console.log(
  "Super Admin Principal - UID:",
  DEFAULT_CREDENTIALS.superAdminPrimary.uid
);
console.log(
  "Super Admin Backup - Usuario:",
  DEFAULT_CREDENTIALS.superAdminBackup.username
);
console.log(
  "Super Admin Backup - Contraseña:",
  DEFAULT_CREDENTIALS.superAdminBackup.password
);
