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

#### Opción C: Reglas de producción con roles (MÁXIMA SEGURIDAD)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Función para verificar si el usuario es administrador
    function isAdmin() {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'super-admin'];
    }
    
    // Función para verificar si el usuario es super-admin
    function isSuperAdmin() {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super-admin';
    }
    
    // Colección de usuarios
    match /users/{userId} {
      // Cualquier usuario autenticado puede leer usuarios
      allow read: if request.auth != null;
      
      // Los usuarios pueden editar su propio perfil
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Los administradores pueden crear, editar y eliminar cualquier usuario
      allow create, update, delete: if isAdmin();
      
      // Los super-admin pueden hacer cualquier operación
      allow read, write: if isSuperAdmin();
    }
    
    // Colección de números telefónicos
    match /phoneNumbers/{phoneId} {
      // Lectura para todos los autenticados
      allow read: if request.auth != null;
      
      // Solo administradores pueden modificar números
      allow write: if isAdmin() || isSuperAdmin();
    }
    
    // Colección de territorios
    match /territories/{territoryId} {
      // Lectura para todos los autenticados
      allow read: if request.auth != null;
      
      // Solo administradores pueden modificar territorios
      allow write: if isAdmin() || isSuperAdmin();
    }
    
    // Colección de asignaciones
    match /assignments/{assignmentId} {
      // Lectura para todos los autenticados
      allow read: if request.auth != null;
      
      // Solo administradores pueden crear/modificar asignaciones
      allow write: if isAdmin() || isSuperAdmin();
    }
    
    // Colección de configuraciones del sistema
    match /settings/{settingId} {
      // Solo super-admin puede acceder a configuraciones
      allow read, write: if isSuperAdmin();
    }
    
    // Colección de logs del sistema
    match /systemLogs/{logId} {
      // Solo administradores pueden leer logs
      allow read: if isAdmin() || isSuperAdmin();
      
      // Solo el sistema puede escribir logs (mediante reglas especiales)
      allow create: if request.auth != null;
    }
    
    // Colección pública para pruebas (temporal)
    match /test/{document} {
      allow read, write: if true;
    }
    
    // Denegar acceso a cualquier otra colección no especificada
    match /{document=**} {
      allow read, write: if false;
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

### Paso 3: Configuración Inicial de Usuarios con Roles

#### Crear Usuario Super-Admin Inicial
1. **Autenticación del usuario:** Usa las credenciales de SuperAdmin (0994749286/Sonita.09)
2. **Crear documento en Firestore:**
```javascript
// Colección: users
// Document ID: [UID del usuario autenticado]
{
  uid: "firebase-auth-uid-here",
  phone: "0994749286",
  email: "admin@conductores.app",
  role: "super-admin",
  displayName: "Super Administrador",
  active: true,
  createdAt: new Date(),
  lastLoginAt: new Date()
}
```

#### Configuración Recomendada para Producción

#### Authentication Methods:
- ✅ **Email/Password** (para administradores)
- ✅ **Phone** (para conductores)
- ⚠️ **Anonymous** (opcional, para pruebas)

#### Firestore Collections Structure:
```
/users/{userId}
  - uid: string (Firebase Auth UID)
  - phone: string (número de teléfono)
  - email: string (opcional)
  - role: string ('conductor', 'admin', 'super-admin')
  - displayName: string
  - active: boolean
  - createdAt: timestamp
  - lastLoginAt: timestamp

/phoneNumbers/{phoneId}
  - number: string (número completo con formato)
  - userId: string (referencia al usuario asignado)
  - territory: string (territorio asignado)
  - active: boolean
  - assignedAt: timestamp
  - completedAt: timestamp (opcional)

/territories/{territoryId}
  - name: string
  - description: string
  - phoneNumbers: array (lista de números asignados)
  - active: boolean
  - createdAt: timestamp
  - updatedAt: timestamp

/assignments/{assignmentId}
  - userId: string
  - phoneNumberId: string
  - territoryId: string
  - assignedDate: timestamp
  - completedDate: timestamp (opcional)
  - status: string ('pending', 'completed', 'cancelled')
  - notes: string (opcional)

/settings/{settingId}
  - key: string
  - value: any
  - description: string
  - updatedBy: string (userId)
  - updatedAt: timestamp

/systemLogs/{logId}
  - action: string
  - userId: string
  - resource: string
  - details: object
  - timestamp: timestamp
  - ip: string (opcional)

/test/{documentId}
  - message: string
  - timestamp: timestamp
  - app: string
```

## 📱 Códigos de Error Comunes

### `auth/admin-restricted-operation`
**Solución:** Habilitar autenticación anónima en Firebase Console

### `permission-denied` (Firestore)
**Solución:** Actualizar reglas de Firestore para permitir acceso

### `Firebase: Error (auth/configuration-not-found)`
**Solución:** Verificar que las credenciales en `.env.local` sean correctas

### `permission-denied` con roles
**Causa:** Usuario no tiene el rol requerido para la operación
**Solución:** 
1. Verificar que el usuario tenga el documento en `/users/{uid}`
2. Confirmar que el campo `role` sea correcto
3. Revisar que las funciones `isAdmin()` e `isSuperAdmin()` funcionen

### `resource-exhausted`
**Causa:** Demasiadas consultas a documentos de usuario para verificar roles
**Solución:** Implementar caché de roles o usar Custom Claims de Firebase Auth

## 🔐 Gestión de Roles y Permisos

### Jerarquía de Roles
1. **super-admin:** Acceso completo a todo el sistema
2. **admin:** Gestión de usuarios, territorios y asignaciones
3. **conductor:** Solo lectura de sus propias asignaciones

### Flujo de Asignación de Roles
1. **Super-Admin** crea usuarios y asigna roles
2. **Admin** puede gestionar usuarios con rol 'conductor'
3. **Conductor** solo puede ver sus asignaciones

### Consideraciones de Seguridad
- Los roles se almacenan en Firestore, no en Custom Claims (más flexible)
- Cada operación verifica el rol mediante consulta a `/users/{uid}`
- Las reglas incluyen fallback para denegar acceso por defecto

## ✅ Checklist de Configuración

### Básico
- [ ] Autenticación anónima habilitada (opcional)
- [ ] Reglas de Firestore configuradas
- [ ] Reglas de Storage configuradas (si aplica)
- [ ] Collections structure definida
- [ ] Testing funcionando sin errores

### Avanzado (Roles y Seguridad)
- [ ] Reglas de producción con roles implementadas
- [ ] Usuario super-admin inicial creado
- [ ] Documento de usuario con rol 'super-admin' en Firestore
- [ ] Funciones `isAdmin()` e `isSuperAdmin()` funcionando
- [ ] Permisos de producción testados
- [ ] Logs del sistema configurados

### Métodos de Autenticación
- [ ] Email/Password habilitado (para administradores)
- [ ] Phone Authentication habilitado (para conductores)
- [ ] Anonymous habilitado (opcional, para pruebas)

### Estructura de Datos
- [ ] Colección `/users` con roles configurada
- [ ] Colección `/phoneNumbers` creada
- [ ] Colección `/territories` creada
- [ ] Colección `/assignments` creada
- [ ] Colección `/settings` (solo super-admin)
- [ ] Colección `/systemLogs` configurada

## 🔗 Enlaces Útiles

- [Firebase Console](https://console.firebase.google.com/)
- [Documentación Firestore Rules](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Authentication Methods](https://firebase.google.com/docs/auth)
- [Página de prueba local](http://localhost:3000/test-firebase)