---
description: Cómo implementar y gestionar el sistema Xolvy Live Pool para sincronización en tiempo real.
---

# Xolvy Live Pool Workflow

Este workflow define el estándar para implementar actualizaciones en vivo (Real-Time) en módulos de la aplicación, evitando la necesidad de refrescar manualmente la página. Se basa en el patrón de suscripción de Firestore.

## 1. Patrón de Implementación (Frontend)

Para cada módulo que requiera sincronización en vivo (ej: Programas, Telefonía, Asignaciones):

### A. Definición del Listener

Utilizar `onSnapshot` de Firestore pasando la consulta deseada. Es CRÍTICO guardar la función de retorno para cancelar la suscripción.

```javascript
import { onSnapshot, query, collection, where } from "firebase/firestore";
import { db } from "../firebase-config.js";

let livePoolUnsubscribe = null;

export const startLivePool = (collectionName, filters, onUpdate) => {
    if (livePoolUnsubscribe) livePoolUnsubscribe(); // Limpiar previo

    const q = query(collection(db, collectionName), ...filters);
    
    livePoolUnsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        onUpdate(data);
    }, (error) => {
        console.error(`[Live Pool] Error en ${collectionName}:`, error);
    });
};
```

### B. Gestión del Ciclo de Vida

Se debe asegurar que el listener se cierre cuando el usuario sale del módulo o cierra la ventana.

```javascript
export const stopLivePool = () => {
    if (livePoolUnsubscribe) {
        livePoolUnsubscribe();
        livePoolUnsubscribe = null;
    }
};

window.addEventListener('beforeunload', stopLivePool);
```

## 2. Casos de Uso Estándar

### 📋 Programas de Predicación

Sincronizar el documento de `programa_semanal` para que si el Admin cambia un conductor, todos los usuarios lo vean al instante.

### 🗺️ Asignaciones de Territorio

Escuchar cambios en la colección `territorios` con estado `Asignado` para actualizar el mapa y las listas globales sin intervención del usuario.

### 📞 Sesiones Telefónicas

Escuchar registros con estado `En Sesión` para gestionar el pool compartido de números de forma dinámica entre múltiples conductores.

## 3. Reglas Críticas

1. **Filtros Optimizados**: Nunca suscribirse a una colección completa sin filtros si esta supera los 100 registros.
2. **Debouncing**: Si la UI es pesada, implementar un pequeño debounce antes de renderizar los cambios del snapshot.
3. **HMS Integration**: Al usar el sistema HMS (Hot Module Swapping), el Live Pool debe reiniciarse en el hook de montaje del nuevo módulo.
