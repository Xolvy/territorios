# [WORKFLOW: XolvyPWA]

**Descripción:** Pipeline de Nativización PWA Premium para proyectos React + Vite + Tailwind CSS del ecosistema Xolvy.
**Objetivo:** Estandarizar la transformación de una Single Page App (SPA) en una PWA con experiencia nativa (iOS/Android), soportando muescas (Notches), bloqueando zoom molesto y gestionando identidad visual adaptativa.

---

## 🛠 REGLAS DE EJECUCIÓN (Directriz de Autonomía)
1. **NO** modifiques la lógica de negocio, ruteo o autenticación existente.
2. Ejecuta las 5 Fases de manera secuencial.
3. Verifica siempre la existencia de `/logo.svg` (marca clara) y `/logo2.svg` (marca blanca) en `public/`.

---

## 📁 FASE 1 — Viewport Estricto (Anti-Zoom Móvil)
**Ubicación:** `index.html`
**Acción:** Reemplazar el meta tag `viewport` para prevenir el zoom involuntario en inputs de iOS (que rompe el layout) y habilitar el ajuste a la pantalla completa (`viewport-fit=cover`).

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, viewport-fit=cover">
```

---

## 📱 FASE 2 — Safe Areas (Soporte Notch y Home Indicator)
**Ubicación:** Layout principal (ej. `src/App.jsx` o `Layout.jsx`).
**Acción:** Inyectar paddings dinámicos usando clases arbitrarias de Tailwind que respeten las variables de entorno del sistema operativo.

1.  **Contenedor Raíz:**
    `className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] ..."`
2.  **Sidebars o Bottom Navigation:**
    Si el elemento es `fixed` o `sticky` al fondo: `pb-[calc(1.5rem+env(safe-area-inset-bottom))]`.

---

## 🎨 FASE 3 — Identidad Visual Adaptativa (Modo Claro/Oscuro)
**Ubicación:** `src/components/AdaptiveLogo.jsx`
**Acción:** Implementar un componente que reaccione al tema global.

```jsx
import React from 'react';
import { useTheme } from '../context/ThemeContext'; // Ajustar según el proyecto

const AdaptiveLogo = ({ className = 'h-10 w-auto', alt = 'Xolvy' }) => {
  const { isDark } = useTheme();
  const src = isDark ? '/logo2.svg' : '/logo.svg'; 
  return <img src={src} alt={alt} className={className} />;
};

export default AdaptiveLogo;
```

**Regla de uso:**
- **Fondo Variable:** Usar `<AdaptiveLogo />`.
- **Fondo Siempre Oscuro (Sidebar/Login):** Hardcodear `/logo2.svg`.
- **Fondo Siempre Claro:** Hardcodear `/logo.svg`.

---

## 🔔 FASE 4 — Banner PWA (Notificación Offline Premium)
**Ubicación:** Componente `PwaBadge` o `ReloadPrompt`.
**Acción:** Refactorizar la UI para que sea una "píldora" flotante superior y auto-dismissible.

1.  **Posición:** `fixed top-4 left-1/2 -translate-x-1/2 z-[100]`.
2.  **Lógica Offline Ready:** Implementar `useEffect` con `setTimeout(..., 3000)` para ocultar automáticamente el aviso de "Listo para usar offline".
3.  **Lógica Need Refresh:** Mantener visible hasta la acción del usuario ("Actualizar").

---

## 📦 FASE 5 — Estandarización de Iconos y Manifest
**Ubicación:** `vite.config.js`.
**Acción:** Declarar explícitamente las resoluciones requeridas por iOS/Android.

1.  **Manifest Icons:**
```javascript
icons: [
  { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
  { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
]
```

2.  **Generación Automática:** Si faltan los archivos `.png`, crear un script `scripts/generate-pwa-icons.mjs` que use `sharp` para convertir `favicon.svg` en los tamaños 192 y 512.

---

## 🚀 Comandos de Cierre
```bash
# Limpiar y regenerar iconos
node scripts/generate-pwa-icons.mjs
# Compilación oficial
npm run build
```

---
**Firmado por:** Antigravity AI Engine
