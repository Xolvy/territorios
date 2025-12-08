import admin from "firebase-admin";

// Interfaz para las credenciales de Firebase Admin
interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

// Función para inicializar Firebase Admin SDK
function initializeFirebaseAdmin(): admin.app.App {
  // Si ya está inicializado, devolver la instancia existente
  if (admin.apps.length > 0) {
    return admin.app();
  }

  try {
    // Obtener credenciales de variables de entorno
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    // Validar que las variables de entorno existan
    if (!projectId || !clientEmail || !privateKey) {
      console.error("❌ Faltan variables de entorno de Firebase Admin SDK:");
      console.error("- FIREBASE_PROJECT_ID:", !!projectId);
      console.error("- FIREBASE_CLIENT_EMAIL:", !!clientEmail);
      console.error("- FIREBASE_PRIVATE_KEY:", !!privateKey);

      throw new Error("Firebase Admin SDK: Variables de entorno faltantes");
    }

    // Configuración del Admin SDK
    const config: admin.ServiceAccount = {
      projectId,
      clientEmail,
      // Reemplazar \\n con saltos de línea reales en la private key
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };

    // Inicializar Firebase Admin
    const app = admin.initializeApp({
      credential: admin.credential.cert(config),
      projectId: projectId,
    });

    console.log("✅ Firebase Admin SDK inicializado correctamente");
    return app;
  } catch (error) {
    console.error("❌ Error inicializando Firebase Admin SDK:", error);
    throw error;
  }
}

// Función para obtener la instancia de Auth de Admin SDK
export function getAdminAuth(): admin.auth.Auth {
  const app = initializeFirebaseAdmin();
  return app.auth();
}

// Función para obtener la instancia de Firestore de Admin SDK
export function getAdminFirestore(): admin.firestore.Firestore {
  const app = initializeFirebaseAdmin();
  return app.firestore();
}

// Función para verificar si Admin SDK está disponible
export function isAdminSDKAvailable(): boolean {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    return !!(projectId && clientEmail && privateKey);
  } catch (error) {
    return false;
  }
}

// Función para obtener información del proyecto
export function getProjectInfo() {
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    hasCredentials: isAdminSDKAvailable(),
    appsInitialized: admin.apps.length,
  };
}

export default admin;
