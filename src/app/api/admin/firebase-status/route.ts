import { NextResponse } from "next/server";
import AdminAuthService from "../../../../lib/admin-auth";
import { getProjectInfo } from "../../../../lib/firebase-admin";

// Configuración para exportación estática
export const dynamic = "force-static";

/**
 * API route para verificar el estado de Firebase Admin SDK
 */
export async function GET() {
  try {
    const projectInfo = getProjectInfo();
    const isConfigured = AdminAuthService.isConfigured();

    return NextResponse.json({
      status: "Firebase Admin SDK Status",
      configured: isConfigured,
      projectInfo: {
        projectId: projectInfo.projectId || null,
        appsInitialized: projectInfo.appsInitialized,
      },
      environment: {
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      },
      nextSteps: isConfigured
        ? "Admin SDK está configurado y listo para usar"
        : "Configura las variables de entorno: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      configured: false,
      error: error.message,
      nextSteps: "Revisa la configuración de Firebase Admin SDK",
    });
  }
}

// Endpoint POST para probar la conexión con Firebase Auth
export async function POST() {
  try {
    if (!AdminAuthService.isConfigured()) {
      return NextResponse.json({
        success: false,
        message: "Admin SDK no está configurado",
        configured: false,
      });
    }

    // Intentar listar algunos usuarios para probar la conexión
    const users = await AdminAuthService.listUsers(1);

    return NextResponse.json({
      success: true,
      message: "Conexión exitosa con Firebase Auth",
      configured: true,
      testResult: {
        usersFound: users.length,
        sampleUser:
          users.length > 0
            ? {
                uid: users[0].uid,
                email: users[0].email || null,
                phoneNumber: users[0].phoneNumber || null,
              }
            : null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: `Error probando conexión: ${error.message}`,
      configured: true,
      error: error.code || "unknown-error",
    });
  }
}
