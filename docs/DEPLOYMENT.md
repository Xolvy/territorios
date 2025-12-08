# 🚀 Guía de Despliegue - Sistema de Territorios

## 🏗️ Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────────────┐
│                     PRODUCCIÓN                          │
├─────────────────────────────────────────────────────────┤
│  🌐 Firebase Hosting                                    │
│  ├── 📱 PWA (index.html + assets)                      │
│  ├── 🔄 Service Worker (cache)                         │
│  └── 📋 Manifest (instalación)                         │
├─────────────────────────────────────────────────────────┤
│  🗄️ Firebase Firestore                                 │
│  ├── 👥 Colección: conductores                         │
│  ├── 🏘️ Colección: territorios                          │
│  ├── 📞 Colección: telefonos                           │
│  └── ⚙️ Colección: configuracion                       │
├─────────────────────────────────────────────────────────┤
│  🔐 Firebase Security Rules                            │
│  └── 📋 Firestore Rules + Indexes                      │
└─────────────────────────────────────────────────────────┘
```

## 📋 Prerrequisitos

### **Herramientas Necesarias**

- ✅ **Node.js** (v16+)
- ✅ **Firebase CLI** (`npm install -g firebase-tools`)
- ✅ **Git** (para control de versiones)
- ✅ **PowerShell** (para scripts de Windows)

### **Cuentas y Permisos**

- ✅ **Cuenta Google** con acceso al proyecto Firebase
- ✅ **Proyecto Firebase**: `conductores-9oct`
- ✅ **Permisos**: Editor o propietario del proyecto

## 🔧 Configuración Inicial

### **1. Clonar el Repositorio**

```bash
git clone <repository-url>
cd app-conductores
```

### **2. Instalar Dependencias**

```bash
npm install
```

### **3. Configurar Firebase CLI**

```bash
# Iniciar sesión en Firebase
firebase login

# Verificar proyecto activo
firebase use

# Si necesitas cambiar proyecto:
firebase use conductores-9oct
```

### **4. Verificar Configuración**

```bash
# Verificar configuración Firebase
firebase projects:list

# Verificar archivos de configuración
dir firebase.json
dir firestore.rules
dir firestore.indexes.json
```

## 🚀 Proceso de Despliegue

### **Método 1: Despliegue Rápido (Recomendado)**

**Script Automatizado**:

```powershell
# Ejecutar script de despliegue
.\scripts\deploy.ps1
```

**Pasos del Script**:

1. ✅ Verificar archivos fuente
2. ✅ Actualizar dist/ con src/
3. ✅ Ejecutar firebase deploy
4. ✅ Verificar URL de producción

### **Método 2: Despliegue Manual**

```bash
# 1. Preparar archivos para producción
Copy-Item "src\*" "dist\" -Recurse -Force

# 2. Desplegar solo hosting (más rápido)
firebase deploy --only hosting

# 3. Despliegue completo (hosting + firestore + functions)
firebase deploy
```

### **Método 3: Despliegue con Verificación**

```bash
# 1. Verificar estado local
firebase serve --only hosting
# Abrir: http://localhost:5000

# 2. Si todo está bien, desplegar
firebase deploy --only hosting

# 3. Verificar producción
# Abrir: https://conductores-9oct.web.app
```

## 📁 Estructura de Despliegue

### **Archivos que se despliegan**:

```
dist/
├── index.html          # ← Copiado desde src/
├── manifest.json       # ← Copiado desde src/
├── service-worker.js   # ← Generado automáticamente
├── sw.js              # ← Respaldo del service worker
├── favicon.ico        # ← Recursos estáticos
├── icon-192.png       # ← Iconos PWA
└── icon-512.png       # ← Iconos PWA
```

### **Archivos de configuración**:

```
firebase.json          # ← Configuración de hosting
firestore.rules        # ← Reglas de seguridad
firestore.indexes.json # ← Índices de base de datos
```

## ⚙️ Configuraciones Avanzadas

### **Firebase Hosting (firebase.json)**

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "max-age=604800" }]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [{ "key": "Cache-Control", "value": "max-age=2592000" }]
      }
    ]
  }
}
```

### **Firestore Security Rules**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura y escritura para usuarios autenticados
    match /{document=**} {
      allow read, write: if true; // Temporalmente abierto
    }
  }
}
```

## 🔍 Verificación Post-Despliegue

### **Checklist de Verificación**

- [ ] **URL accesible**: https://conductores-9oct.web.app
- [ ] **PWA instalable**: Mostrar banner "Instalar app"
- [ ] **Offline funcional**: Desconectar internet y verificar
- [ ] **Login Admin**: Probar con `admin123`
- [ ] **Login SuperAdmin**: Probar con credenciales completas
- [ ] **Firebase conectado**: Verificar datos en tiempo real
- [ ] **Cache funcionando**: Verificar carga rápida en segunda visita

### **URLs de Verificación**

```bash
# Aplicación principal
https://conductores-9oct.web.app

# Console Firebase (para monitoreo)
https://console.firebase.google.com/project/conductores-9oct

# Hosting Dashboard
https://console.firebase.google.com/project/conductores-9oct/hosting/main

# Firestore Database
https://console.firebase.google.com/project/conductores-9oct/firestore
```

### **Comandos de Verificación**

```bash
# Verificar estado del proyecto
firebase projects:list

# Ver logs de hosting
firebase hosting:sites:list

# Verificar funciones (si las hay)
firebase functions:list

# Ver uso de Firestore
firebase firestore:databases:list
```

## 🔄 Rollback (Revertir Despliegue)

### **Opción 1: Rollback Automático Firebase**

```bash
# Ver historial de despliegues
firebase hosting:releases:list

# Revertir al despliegue anterior
firebase hosting:releases:rollback <RELEASE_ID>
```

### **Opción 2: Redespliegue de Versión Anterior**

```bash
# Cambiar a commit anterior
git checkout <commit-hash>

# Redesplegar
firebase deploy --only hosting

# Volver a la rama principal
git checkout main
```

### **Opción 3: Rollback Manual**

```bash
# Restaurar archivo desde backup
Copy-Item "backup\index.html" "dist\index.html" -Force

# Redesplegar
firebase deploy --only hosting
```

## 🚨 Troubleshooting

### **Error: "Firebase project not found"**

```bash
# Verificar proyecto activo
firebase use

# Cambiar a proyecto correcto
firebase use conductores-9oct
```

### **Error: "Permission denied"**

```bash
# Verificar autenticación
firebase login --reauth

# Verificar permisos del proyecto
firebase projects:list
```

### **Error: "Build failed"**

```bash
# Verificar archivos fuente
dir src\

# Limpiar y recrear dist/
Remove-Item dist\* -Recurse -Force
Copy-Item src\* dist\ -Recurse -Force
```

### **Error: "Service Worker no actualiza"**

```bash
# Forzar actualización del Service Worker
# Agregar timestamp al cache name en service-worker.js
# Redesplegar
firebase deploy --only hosting
```

## 📊 Monitoreo Post-Despliegue

### **Métricas a Monitorear**

- **Tiempo de carga**: < 3 segundos
- **Tasa de error**: < 1%
- **Usuarios concurrentes**: Monitorear picos
- **Uso de Firestore**: Lecturas/escrituras por día

### **Herramientas de Monitoreo**

- **Firebase Console**: Análiticas básicas
- **Chrome DevTools**: Performance y PWA audit
- **Lighthouse**: Puntuación PWA y rendimiento
- **Firebase Performance**: Métricas avanzadas (opcional)

## 🔐 Seguridad Post-Despliegue

### **Verificaciones de Seguridad**

- [ ] **HTTPS**: Verificar certificado SSL válido
- [ ] **Firebase Rules**: Revisar reglas de seguridad
- [ ] **Admin Access**: Probar controles de acceso
- [ ] **Data Privacy**: Verificar que no se exponen datos sensibles
- [ ] **CORS**: Verificar que solo dominios autorizados accedan

### **Actualizaciones de Seguridad**

- Revisar Firebase Security Rules mensualmente
- Actualizar contraseñas cada 3-6 meses
- Monitorear logs de acceso sospechosos
- Mantener Firebase CLI actualizado

---

## 📞 Soporte de Despliegue

**Para problemas de despliegue contactar**:

- SuperAdmin del sistema
- Revisar logs en Firebase Console
- Documentar errores con capturas de pantalla

**Recursos Adicionales**:

- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [PWA Best Practices](https://web.dev/pwa-checklist/)
