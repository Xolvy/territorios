# 🚀 App Conductores - Sistema de Gestión de Territorios

> Sistema completo de gestión de territorios y predicación telefónica para Congregaciones de Testigos de Jehová

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.StaticApp)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Azure SWA](https://img.shields.io/badge/Azure-Static%20Web%20Apps-blue)](https://azure.microsoft.com/en-us/services/app-service/static/)

## ✨ **Características Principales**

### 🎯 **Gestión de Territorios**

- **Asignación inteligente** de territorios por conductor
- **Seguimiento en tiempo real** del progreso
- **Programación flexible** de turnos y horarios
- **Visualización interactiva** de mapas y estadísticas

### 📞 **Predicación Telefónica**

- **Gestión completa** de números telefónicos
- **Seguimiento de llamadas** y resultados
- **Reportes automáticos** de actividad
- **Sistema offline-first** para uso sin conexión

### 👥 **Panel Administrativo**

- **Gestión de usuarios** y permisos
- **Dashboard analítico** con métricas clave
- **Configuración avanzada** del sistema
- **Herramientas de diagnóstico** integradas

## 🛠️ **Stack Tecnológico**

```json
{
  "framework": "Next.js 15.5.2",
  "language": "TypeScript",
  "styling": "Tailwind CSS",
  "deployment": "Azure Static Web Apps",
  "database": "Offline-First (CSV/Local Storage)",
  "architecture": "PWA + Service Worker",
  "ci_cd": "GitHub Actions"
}
```

## 🚀 **Deployment y Configuración**

### **Deployment Automático (Azure SWA)**

1. Fork este repositorio
2. Crea un recurso Azure Static Web App
3. Conecta con tu fork de GitHub
4. ¡El deployment se hace automáticamente!

### **Configuración Local**

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/app-conductores.git
cd app-conductores

# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Build de producción
npm run build

# Servidor estático local
npm run export && swa start ./dist
```

## 📱 **PWA Ready**

La aplicación está optimizada como **Progressive Web App**:

- ✅ **Instalable** desde cualquier navegador
- ✅ **Funciona offline** con Service Worker
- ✅ **Responsive design** para móvil y desktop
- ✅ **Notificaciones push** (próximamente)
- ✅ **Actualización automática** en segundo plano

## 🔒 **Características de Seguridad**

- 🛡️ **Headers de seguridad** configurados
- 🔐 **Modo offline** sin dependencias externas
- 🚫 **Firebase deshabilitado** para máxima privacidad
- ✅ **Datos locales** sin transmisión a servidores
- 🔍 **Herramientas de diagnóstico** integradas

## 📊 **Performance**

```
Bundle Size: 272KB (optimizado)
Pages: 16 rutas estáticas
Build Time: ~10 segundos
Lighthouse Score: 95+ (PWA)
First Load: <3 segundos
```

## 🗂️ **Estructura del Proyecto**

```
📦 app-conductores/
├── 🎨 src/
│   ├── app/           # Next.js App Router
│   ├── components/    # Componentes React
│   ├── lib/           # Utilidades y servicios
│   ├── hooks/         # React Hooks personalizados
│   └── types/         # Definiciones TypeScript
├── 📱 public/         # Assets estáticos y PWA
├── 🔧 .github/        # CI/CD workflows
└── ⚙️ staticwebapp.config.json # Azure SWA config
```

## 🧪 **Testing y Quality**

- ✅ **TypeScript** para type safety
- ✅ **ESLint** configuración estricta
- ✅ **Build verification** en CI/CD
- ✅ **Offline testing** con SWA CLI
- ✅ **Cross-browser compatibility**

## 📋 **Roadmap**

### **v2.0 (Q1 2026)**

- [ ] 🔄 Sincronización cloud opcional
- [ ] 📊 Analytics avanzados con IA
- [ ] 🌍 Soporte multi-idioma
- [ ] 📱 App móvil nativa

### **v1.1 (Próximo)**

- [ ] 🔔 Notificaciones push
- [ ] 📈 Métricas de rendimiento
- [ ] 🎨 Temas personalizables
- [ ] 🔍 Búsqueda avanzada

## 🤝 **Contribuir**

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Add nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Crea un Pull Request

## 📄 **Licencia**

Este proyecto está bajo la licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

## 💡 **Soporte**

- 📖 **Documentación:** [docs/README.md](docs/README.md)
- 🐛 **Issues:** [GitHub Issues](https://github.com/TU_USUARIO/app-conductores/issues)
- 💬 **Discusiones:** [GitHub Discussions](https://github.com/TU_USUARIO/app-conductores/discussions)

---

<div align="center">

**Desarrollado con ❤️ para la comunidad**

_Sistema de gestión que simplifica la organización territorial y optimiza la predicación telefónica_

[🌐 Demo Live](https://app-conductores-swa.azurestaticapps.net) • [📖 Documentación](docs/) • [🚀 Deploy](https://portal.azure.com/#create/Microsoft.StaticApp)

</div>
# Last updated: 10/14/2025 21:54:51
