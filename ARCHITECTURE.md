# Arquitectura Técnica - App Territorios JW

## 🏗️ Estructura del Sistema

La aplicación sigue una arquitectura de **Single Page Application (SPA)** basada en módulos de JavaScript puro (Vanilla JS), sin frameworks pesados para garantizar máxima velocidad y compatibilidad en dispositivos antiguos.

### 📁 Organización de Archivos

- `/app.js`: Punto de entrada, manejador de rutas (Routing) y listeners globales (Offline, PWA, Difusión).
- `/modules/`: Lógica de negocio dividida por componentes.
  - `admin-dashboard.js`: Panel de control completo para administradores.
  - `conductor-dashboard.js`: Interfaz optimizada para el ministerio en el campo.
  - `utils/intelligence.js`: Integración con Google Gemini para auditorías y predicciones.
- `/data/firestore-services.js`: Único punto de contacto con Firebase. Implementa el patrón Service Object.
- `/src/input.css`: Fuente de estilos Tailwind CSS con tokens de diseño personalizados (Glassmorphism 2.0).

## 🔋 Tecnologías Core

1. **Firebase Suite**:
    - **Firestore**: Base de datos NoSQL con persistencia offline activada (IndexedDB).
    - **Auth**: Autenticación híbrida (Email/Password para Admins, Anónima para Conductores).
    - **Hosting**: Despliegue global acelerado por CDN.
2. **Google Gemini API**: Utilizada para auditoría de integridad de datos y generación de informes estratégicos.
3. **PWA (Progressive Web App)**:
    - Service Worker personalizado con estrategia *Stale-While-Revalidate*.
    - Manifest para instalación en el home screen.

## 🧠 Lógica de Inteligencia Artificial

La clase `TerritoryIntelligence` encapsula la interacción con Gemini. Se encarga de:

- **Snapshot Minificado**: Filtra y limpia los datos de Firestore antes de enviarlos a la IA para reducir latencia y costos de tokens.
- **Auto-detección de Modelos**: Escanea dinámicamente el API Key para encontrar el modelo más capaz disponible (Gemini 1.5 Pro/Flash).

## 🛡️ Seguridad

- **Reglas de Firestore**: Restringen el acceso por roles (`Administrador` vs `Conductor`).
- **Validación de Email**: Solo emails autorizados pueden acceder al panel administrativo.

## 🚀 Optimización

- **Cache-Busting**: Sistema de versiones por Query String (`?v=2.6.1`) para forzar actualizaciones críticas.
- **Batching**: Uso de `writeBatch` para operaciones masivas en territorios y teléfonos.
