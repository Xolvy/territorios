# 🔥 Configuración Completa de Firebase

## 📋 Estado Actual
- ✅ **Firebase SDK instalado y configurado**
- ✅ **Credenciales del proyecto:** `conductores-9oct`
- ⚠️ **Autenticación anónima:** Deshabilitada por seguridad
- ⚠️ **Reglas de Firestore:** Requieren configuración

## 🔧 Configuraciones Pendientes en Firebase Console

### 1. Habilitar Autenticación Anónima (Opcional)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona el proyecto `conductores-9oct`
3. Ve a **Authentication** > **Sign-in method**
4. Habilita **Anonymous**
5. Guarda los cambios

### 2. Configurar Reglas de Firestore

#### Opción A: Reglas de desarrollo (MENOS SEGURO)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

#### Opción B: Reglas con autenticación (MÁS SEGURO)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir acceso a usuarios autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Colección pública para pruebas
    match /test/{document} {
      allow read, write: if true;
    }
    
    // Colección de conductores
    match /conductores/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 3. Configurar Reglas de Storage (Si usas Storage)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🚀 Pasos para Configurar

### Paso 1: Firebase Console
1. Ve a https://console.firebase.google.com/
2. Selecciona proyecto `conductores-9oct`
3. Configura Authentication y Firestore según las opciones arriba

### Paso 2: Verificar Configuración
1. Ve a `http://localhost:3000/test-firebase`
2. Revisa los logs de prueba
3. Confirma que no hay errores de permisos

### Paso 3: Configuración Recomendada para Producción

#### Authentication Methods:
- ✅ **Email/Password** (para administradores)
- ✅ **Phone** (para conductores)
- ⚠️ **Anonymous** (opcional, para pruebas)

#### Firestore Collections Structure:
```
/conductores/{conductorId}
  - nombre: string
  - telefono: string
  - email: string
  - activo: boolean
  - territorio: string
  - createdAt: timestamp

/territorios/{territorioId}
  - nombre: string
  - conductores: array
  - activo: boolean

/asignaciones/{asignacionId}
  - conductorId: string
  - territorioId: string
  - fecha: timestamp
  - completado: boolean
```

## 📱 Códigos de Error Comunes

### `auth/admin-restricted-operation`
**Solución:** Habilitar autenticación anónima en Firebase Console

### `permission-denied` (Firestore)
**Solución:** Actualizar reglas de Firestore para permitir acceso

### `Firebase: Error (auth/configuration-not-found)`
**Solución:** Verificar que las credenciales en `.env.local` sean correctas

## ✅ Checklist de Configuración

- [ ] Autenticación anónima habilitada
- [ ] Reglas de Firestore configuradas
- [ ] Reglas de Storage configuradas (si aplica)
- [ ] Collections structure definida
- [ ] Permisos de producción configurados
- [ ] Testing funcionando sin errores

## 🔗 Enlaces Útiles

- [Firebase Console](https://console.firebase.google.com/)
- [Documentación Firestore Rules](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Authentication Methods](https://firebase.google.com/docs/auth)
- [Página de prueba local](http://localhost:3000/test-firebase)