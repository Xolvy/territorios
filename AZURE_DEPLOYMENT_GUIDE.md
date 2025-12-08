# 🚀 Guía de Deployment a Azure Static Web Apps

## ✅ **Estado Actual:**

- ✅ Repositorio Git inicializado con commit inicial
- ✅ Azure SWA CLI instalado (v2.0.7)
- ✅ Configuración SWA (`staticwebapp.config.json`) creada
- ✅ GitHub Workflow (`.github/workflows/azure-static-web-apps.yml`) configurado
- ✅ Build estático exitoso (16 páginas en `/dist`)

## 🎯 **Próximos Pasos:**

### **Paso 1: Crear repositorio en GitHub**

1. Ve a [GitHub.com](https://github.com) y haz login
2. Clic en "New repository" (botón verde)
3. Nombre: `app-conductores`
4. Descripción: `Sistema de gestión de territorios y predicación telefónica`
5. Público o Privado (tu elección)
6. NO inicializar con README (ya tenemos archivos)
7. Clic "Create repository"

### **Paso 2: Conectar repositorio local con GitHub**

```bash
# Ejecutar estos comandos en tu terminal:
git remote add origin https://github.com/TU_USUARIO/app-conductores.git
git branch -M main
git push -u origin main
```

### **Paso 3: Crear Azure Static Web App**

1. Ve a [Azure Portal](https://portal.azure.com)
2. Clic "Create a resource" → "Static Web App"
3. Configuración:
   - **Subscription:** Tu suscripción de Azure
   - **Resource Group:** Crear nuevo "rg-app-conductores"
   - **Name:** `app-conductores-swa`
   - **Plan type:** Free (para empezar)
   - **Region:** East US 2 (recomendado)
   - **Source:** GitHub
   - **GitHub account:** Autorizar conexión
   - **Organization:** Tu usuario de GitHub
   - **Repository:** `app-conductores`
   - **Branch:** `main`
   - **Build presets:** Custom
   - **App location:** `/`
   - **API location:** (dejar vacío)
   - **Output location:** `dist`
4. Clic "Review + create" → "Create"

### **Paso 4: Configurar GitHub Secret (Automático)**

Azure creará automáticamente el secret `AZURE_STATIC_WEB_APPS_API_TOKEN` en tu repositorio.

### **Paso 5: Verificar Deployment**

1. Azure iniciará el deployment automáticamente
2. Ve a GitHub → Tu repositorio → Actions tab
3. Verás el workflow ejecutándose
4. Cuando complete, tendrás una URL pública

## 📊 **Configuración Actual del Proyecto:**

### **Next.js Static Export:**

```javascript
// next.config.js
module.exports = {
  output: "export",
  distDir: "dist",
  trailingSlash: true,
  images: { unoptimized: true },
};
```

### **Azure SWA Configuration:**

```json
// staticwebapp.config.json
{
  "routes": [...], // 16 rutas configuradas
  "globalHeaders": {...}, // Headers de seguridad
  "navigationFallback": {...} // SPA routing
}
```

### **GitHub Actions Workflow:**

- ✅ Build automático en cada push a `main`
- ✅ Preview deployments para Pull Requests
- ✅ Cleanup automático cuando se cierran PRs
- ✅ Verificación post-deployment

## 🎯 **Deployment Alternativo (Manual):**

Si prefieres deployment manual inmediato:

```bash
# 1. Build del proyecto (ya hecho)
npm run build

# 2. Deploy directo con SWA CLI
swa deploy ./dist --subscription-id "TU_SUBSCRIPTION_ID" --resource-group "rg-app-conductores" --app-name "app-conductores-swa"
```

## 🔧 **Comandos de Utilidad:**

```bash
# Ver status del proyecto
swa --version

# Deploy local para testing
swa start ./dist

# Ver logs de Azure
swa deploy --print-token
```

## 🌐 **URLs Esperadas:**

Después del deployment tendrás:

- **Producción:** `https://app-conductores-swa.azurestaticapps.net`
- **Custom Domain:** Configurable desde Azure Portal
- **PR Previews:** URLs automáticas para cada PR

## 🔒 **Características de Seguridad Incluidas:**

- ✅ HTTPS automático con certificado SSL
- ✅ Headers de seguridad configurados
- ✅ Protección XSS y clickjacking
- ✅ Política de contenido seguro
- ✅ Cache optimizado para performance

## 📱 **PWA Ready:**

Tu app incluye:

- ✅ Service Worker configurado
- ✅ Manifest.json completo
- ✅ Iconos para todas las plataformas
- ✅ Cacheo offline inteligente
- ✅ Instalable desde browser

¡Tu aplicación está 100% lista para producción! 🎉
