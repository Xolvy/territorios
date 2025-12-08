import { NextRequest, NextResponse } from "next/server";

// ⚡ Configuración para Azure Static Web Apps
export const dynamic = "force-static";
export const runtime = "nodejs";
export const revalidate = false;

/**
 * 🔥 Azure SWA Info API - Información específica para Azure Static Web Apps
 * @description Proporciona información optimizada para el deployment en Azure
 */
export async function GET(request: NextRequest) {
  try {
    const azureInfo = {
      // 🚀 Información de Azure SWA
      azure: {
        environment: "Azure Static Web Apps",
        region: process.env.AZURE_REGION || "East US 2",
        sku: "Free", // Free tier para desarrollo
        runtime: "Node.js 20.x",
        deployment: {
          method: "GitHub Actions",
          branch: "main",
          autoDeployment: true,
        },
      },

      // ⚡ Performance optimizations
      performance: {
        staticGeneration: true,
        edgeCaching: true,
        compressionEnabled: true,
        bundleOptimization: true,
      },

      // 🛡️ Security features
      security: {
        httpsOnly: true,
        securityHeaders: true,
        corsEnabled: true,
        csrfProtection: true,
      },

      // 📊 Monitoring
      monitoring: {
        healthcheck: "/api/health",
        metricsEndpoint: "/api/azure-info",
        loggingEnabled: true,
      },

      // 📱 PWA capabilities
      pwa: {
        serviceWorkerEnabled: true,
        offlineCapable: true,
        installable: true,
        manifestUrl: "/manifest.json",
      },

      // 🌐 URLs and endpoints
      urls: {
        production: "https://lively-hill-009fd0b0f.2.azurestaticapps.net",
        api: "https://lively-hill-009fd0b0f.2.azurestaticapps.net/api",
        healthcheck:
          "https://lively-hill-009fd0b0f.2.azurestaticapps.net/api/health",
      },

      // 📈 Build info
      build: {
        framework: "Next.js 15.5.2",
        outputMode: "static export",
        buildTime: new Date().toISOString(),
        optimizations: [
          "Static Generation",
          "Image Optimization",
          "Code Splitting",
          "Tree Shaking",
          "Minification",
        ],
      },

      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(azureInfo, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache por 1 hora
        "X-Azure-SWA": "optimized",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("❌ Error in Azure SWA Info API:", error);

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Error retrieving Azure SWA information",
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "X-Error": "azure-swa-info-failed",
        },
      }
    );
  }
}

/**
 * 📋 GET method para obtener información completa sobre el deployment Azure
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      message: "Use GET method to retrieve Azure SWA information",
      availableEndpoints: [
        "/api/azure-info (GET) - Azure SWA information",
        "/api/health (GET) - Health check",
        "/api/admin/firebase-status (GET/POST) - Firebase status",
      ],
    },
    { status: 405 }
  );
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
