/**
 * 🖼️ Azure Static Web Apps Image Loader
 * @description Custom image loader optimizado para Azure SWA
 */

export default function azureImageLoader({ src, width, quality }) {
  // Si la imagen ya es una URL completa, devolverla tal como está
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  // Para imágenes locales, construir la URL optimizada
  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://lively-hill-009fd0b0f.2.azurestaticapps.net"
      : "";

  // Parámetros de optimización
  const params = new URLSearchParams();

  if (width) {
    params.set("w", width.toString());
  }

  if (quality) {
    params.set("q", quality.toString());
  }

  // Construir la URL final
  const imageUrl = `${baseUrl}${src}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  return imageUrl;
}
