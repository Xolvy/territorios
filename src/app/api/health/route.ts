import { NextRequest, NextResponse } from "next/server";

// Configuración para exportación estática
export const dynamic = "force-static";

// Health check endpoint para monitoreo de Azure Static Web Apps
export async function GET(request: NextRequest) {
  try {
    // Verificar estado de la aplicación
    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "1.0.0",
      services: {
        firebase: checkFirebaseConnection(),
        database: true, // Implementar verificación real si es necesario
        authentication: true, // Implementar verificación real si es necesario
      },
      uptime: process.uptime(),
      memory: {
        used:
          Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
          100,
        total:
          Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
          100,
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
      },
    };

    // Verificar si todos los servicios están funcionando
    const allServicesHealthy = Object.values(healthStatus.services).every(
      (service) => service === true
    );

    return NextResponse.json(healthStatus, {
      status: allServicesHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Health check error:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}

// Función para verificar conexión con Firebase
function checkFirebaseConnection(): boolean {
  try {
    // Verificar si las variables de entorno de Firebase están configuradas
    const requiredVars = [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    ];

    const hasAllVars = requiredVars.every(
      (varName) => process.env[varName] && process.env[varName] !== ""
    );

    return hasAllVars;
  } catch (error) {
    console.error("Firebase connection check failed:", error);
    return false;
  }
}
