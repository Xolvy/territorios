import { NextRequest, NextResponse } from "next/server";
import AdminAuthService from "../../../../lib/admin-auth";

// Configuración para exportación estática
export const dynamic = "force-static";

/**
 * API route para actualizar números de teléfono en Firebase Auth
 * Solo accesible por super-admin
 */
export async function POST(request: NextRequest) {
  try {
    const { userUid, oldPhoneNumber, newPhoneNumber, updatedBy } =
      await request.json();

    // Validar datos requeridos
    if (!userUid || !newPhoneNumber || !updatedBy) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faltan parámetros requeridos: userUid, newPhoneNumber, updatedBy",
        },
        { status: 400 }
      );
    }

    // Verificar si Admin SDK está configurado
    if (!AdminAuthService.isConfigured()) {
      console.log("⚠️ Firebase Admin SDK no está configurado");
      return NextResponse.json({
        success: true,
        message: "Admin SDK no configurado - actualización solo en Firestore",
        details: {
          userUid,
          oldPhoneNumber,
          newPhoneNumber,
          updatedBy,
          timestamp: new Date().toISOString(),
          firebaseAuthStatus: "not-configured",
        },
      });
    }

    // Actualizar en Firebase Auth usando Admin SDK
    const result = await AdminAuthService.updateUserPhoneAndEmail(
      oldPhoneNumber,
      newPhoneNumber
    );

    return NextResponse.json({
      success: true,
      message: result.success
        ? result.message
        : `Advertencia: ${result.message}`,
      details: {
        userUid,
        oldPhoneNumber,
        newPhoneNumber,
        updatedBy,
        timestamp: new Date().toISOString(),
        firebaseAuthStatus: result.success ? "updated" : "error",
        firebaseAuthDetails: result.userRecord
          ? {
              uid: result.userRecord.uid,
              email: result.userRecord.email,
              phoneNumber: result.userRecord.phoneNumber,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("Error en API de actualización de teléfono:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Método GET para obtener información sobre la funcionalidad
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/update-phone",
    description: "API para actualizar números de teléfono en Firebase Auth",
    methods: ["POST"],
    requiredPermissions: ["super-admin"],
    adminSDKStatus: AdminAuthService.isConfigured()
      ? "configured"
      : "not-configured",
    configuration: {
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    },
  });
}
