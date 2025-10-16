# 🔥 Configuración Firebase Real

Para habilitar Firebase y resolver el error de conexión:

## 📋 Pasos Necesarios

### 1. Crear Proyecto Firebase
1. Ve a https://console.firebase.google.com/
2. Crea un nuevo proyecto llamado "conductores-app"
3. Habilita Authentication (Email/Password + Teléfono)
4. Crea Firestore Database

### 2. Obtener Credenciales
En la configuración del proyecto, copia las credenciales web

### 3. Reemplazar Variables de Entorno
Actualiza el archivo `.env.local` con credenciales reales:

```bash
# Reemplaza estos valores offline con credenciales reales:
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC...  # Tu API Key real
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-ABC123DEF

# Cambiar a modo online
NEXT_PUBLIC_ENABLE_OFFLINE_MODE=false
```

### 4. Rebuild y Deploy
```bash
npm run build
git add .
git commit -m "feat: habilitar Firebase real"
git push
```

## ✅ Resultado
- ✅ Autenticación real con Firebase
- ✅ Base de datos sincronizada
- ✅ Datos persistentes en la nube
- ✅ Múltiples usuarios simultáneos