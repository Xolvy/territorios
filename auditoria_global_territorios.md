# Auditoría Global, Profunda y Sin Censura: Ecosistema "Territorios"

**Fecha:** 2026-05-12
**Estado:** CRÍTICO / REVISIÓN REQUERIDA
**Versión de Aplicación:** 3.1.0

---

## 1. MAPA DE ARQUITECTURA Y FRONTEND (Vanilla JS)

### Gestión de Estado y Ciclo de Vida
- **Arquitectura:** Se detectó un patrón de **SPA Vanilla JS** basado en un motor de micro-módulos dinámicos (`import.meta.glob`). La orquestación central reside en `app.js`.
- **Estado Global:** La aplicación depende de un objeto global `window.XolvyApp` y de la persistencia en `localStorage` (`xolvy_session`, `demo_role`). 
    - **Riesgo:** Alta dependencia de `window`, lo que facilita la contaminación del scope global y dificulta el debugging en entornos complejos.
- **Render Locks y Debounce:**
    - El bloqueo de renderizado (`_conductorLoading`) en `app.js` es funcional y previene colisiones durante el arranque.
    - El `debounce` de 300ms en `refreshConductorView` (dentro de `conductor-dashboard.js`) es vital para la estabilidad ante ráfagas de cambios en Firestore.
- **Responsive Design y Tailwind:**
    - **Salud:** El diseño es mobile-first y altamente responsivo (PWA).
    - **Problema:** Existe una **"Sopa de Clases"** extrema en componentes como `login.js` y `conductor-dashboard.js`. El uso masivo de utilidades de Tailwind directamente en strings de HTML (`innerHTML`) hace que el código sea difícil de mantener y propenso a errores de tipado en clases.
    - **Reflows:** El uso extensivo de `innerHTML` para re-renderizar secciones completas provoca reflows innecesarios. Se recomienda transicionar a manipulación fina del DOM o fragmentos.

## 2. ESTADO DEL BACKEND Y FIREBASE

### Transacciones Atómicas (`runTransaction`)
- **Cumplimiento:** Las funciones críticas como `solicitarNumeros` (en `phone-service.js`) y `returnTerritorio` (en `territory-service.js`) cumplen **estrictamente** con la regla de "Lecturas antes que Escrituras".
- **Hardenización:** Se observa un manejo robusto de errores dentro de las transacciones, con limpiezas de caché programadas (`ServiceCache.clear`).

### Memoria y Listeners
- **Fugas de Memoria:** Los listeners de `onSnapshot` están bien gestionados a través de `stopActiveLivePools` en el dashboard del conductor. Sin embargo, no se detectó una función similar de limpieza global en el Dashboard de Administrador, lo que podría generar fugas al cambiar frecuentemente de vistas administrativas.

### Colecciones Obsoletas
- **Banco_S13:** No es obsoleta, pero su coexistencia con la colección `territorios` crea un **Estado Dual Peligroso**. 
    - `banco_s13` actúa como el pool de asignaciones activas (S-13), mientras que `territorios` es el maestro.
    - **Riesgo de Desincronización:** Aunque existe `resyncGlobalStats` para sanar estados huérfanos, la arquitectura es intrínsecamente compleja. Se detectaron funciones que aún usan nombres de campos antiguos (`status` vs `estado`).

## 3. DEUDA TÉCNICA Y CÓDIGO MUERTO (CRÍTICO)

### Código Muerto Detectado
- **Archivos Legacy:** 
    - `modules/conductor/ai-voice-assistant.js`: **COMPLETAMENTE MUERTO**. No se referencia en ningún lugar del proyecto.
    - `modules/conductor/voice-helper.js`: Obsoleto, reemplazado por la lógica interna de `nexo-core.js`.
    - `old_dashboard.txt`, `old_dashboard_utf8.txt`: Basura en la raíz del proyecto.
- **Funciones:** Se detectaron múltiples funciones en `window` (ej. `window.viewMapFromReport`, `window.abrirMapaTerritorio`) que deberían estar encapsuladas en sus respectivos módulos de servicio.

### Variables Globales Peligrosas
- `window.XolvyApp`: Expone toda la metadata del usuario y la versión.
- `window._nexoInstance`: Expone el agente de IA y su API Key en tiempo de ejecución.
- `window._authSuspended`: Flag de control de flujo que podría quedar bloqueado si una promesa falla silenciosamente.

## 4. ESTADO DEL ECOSISTEMA AI (NEXO)

### nexo-core.js
- **Estado:** Es el núcleo más avanzado de la app. Utiliza `gemini-2.5-flash-lite` para procesamiento transaccional.
- **Inyección de API Key:** 
    - > [!CAUTION]
    - > **RIESGO EXTREMO DE EXPOSICIÓN:** La API Key de Gemini se extrae de Firestore y se inyecta directamente en el cliente. Se envía como un parámetro `?key=` en la URL de fetch, lo que la hace visible en:
    - > 1. El código fuente (Network Tab).
    - > 2. Logs de servidores proxy/navegador.
    - > 3. Cualquier script malicioso que acceda a `window._nexoInstance.apiKey`.

## 5. ROADMAP Y PLAN DE ACCIÓN RECOMENDADO

Para alcanzar el grado **Enterprise**, se recomiendan estos 5 pasos inmediatos:

1.  **Seguridad AI (Proxy Cloud Functions):** Migrar las llamadas a Gemini a una Firebase Cloud Function. El frontend enviará el prompt, y la función (que posee la API Key en variables de entorno seguras) hará la petición y devolverá solo la respuesta de la IA.
2.  **Encapsulamiento de Estado:** Implementar un patrón de Store (tipo Redux/Zustand simplificado o un Event Bus robusto) para eliminar la dependencia de `window` y centralizar la lógica de negocio.
3.  **Purga de Código Muerto:** Eliminar físicamente `ai-voice-assistant.js`, `voice-helper.js` y los archivos `.txt` de la raíz para reducir el peso del bundle y el ruido en el desarrollo.
4.  **Hardenización de la Identidad (Identity Shield):** Unificar todas las comparaciones de nombres de usuarios bajo el `IdentityShield` para evitar errores de normalización (tildes, mayúsculas) que causan que los territorios "desaparezcan" de la vista del conductor.
5.  **Refactor de Estilos:** Extraer los bloques de HTML masivos con clases de Tailwind a componentes funcionales o usar `@apply` en CSS para reducir la verbosidad en los archivos `.js`.

---
**Reporte generado por Antigravity AI.**
*Confirmación: Auditoría completada. No se omitieron hallazgos críticos.*
