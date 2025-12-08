/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  // 🚀 Configuración optimizada para Azure Static Web Apps
  output: "export",

  // 📝 Configuración de rutas optimizada para SWA
  trailingSlash: true,
  skipTrailingSlashRedirect: true,

  // 🖼️ Optimización de imágenes para Azure SWA
  images: {
    unoptimized: true,
    loader: "custom",
    loaderFile: "./src/utils/azure-image-loader.js",
    domains: [
      "firebasestorage.googleapis.com",
      "conductores-9oct.appspot.com",
      "lively-hill-009fd0b0f.2.azurestaticapps.net",
      "*.azurestaticapps.net",
    ],
    formats: ["image/webp", "image/avif"],
  },

  // 🔧 Configuración experimental para Azure SWA
  experimental: {
    // Mejora el rendimiento en Azure
    optimizeCss: true,
    // Optimizaciones específicas para SWA
    esmExternals: "loose",
  },

  // ⚡ Configuración de compilación para Azure
  compiler: {
    // Optimizaciones adicionales
    removeConsole: process.env.NODE_ENV === "production",
  },

  // 📦 Paquetes externos del servidor (movido desde experimental)
  serverExternalPackages: ["firebase-admin"],

  // 🌍 Variables de entorno públicas
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // 📦 Configuración de webpack optimizada para Azure SWA
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimizaciones para Azure Static Web Apps
    if (!dev && !isServer) {
      // Configuración avanzada de code splitting
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
          },
          common: {
            minChunks: 2,
            chunks: "all",
            enforce: true,
          },
        },
      };

      // Optimizaciones adicionales para Azure
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    // Resolver aliases para mejor compatibilidad
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
    };

    return config;
  },

  // 🔄 Redirects y rewrites para mejor SEO
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
  },

  // 🛡️ Headers de seguridad
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
