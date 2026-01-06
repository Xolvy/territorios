# App Territorios JW

[![Deploy to Firebase](https://github.com/Xolvy/conductores/actions/workflows/firebase-deploy.yml/badge.svg)](https://github.com/Xolvy/conductores/actions/workflows/firebase-deploy.yml)

Aplicación web para la gestión de territorios y predicación.

## 🌐 Aplicación en Vivo

**URL:** [https://territorios-jw.web.app](https://territorios-jw.web.app)

> 🚀 **Auto-Deploy Activo:** Cada push a `main` se despliega automáticamente a Firebase Hosting

## 📋 Características

- **Dashboard de Administrador**: Gestión completa de territorios, conductores y publicadores
- **Programa Semanal**: Asignación y seguimiento de actividades de predicación
- **Gestión de Territorios**: CRUD completo de territorios con mapas
- **Predicación Telefónica**: Sistema de gestión de llamadas telefónicas
- **Autenticación**: Sistema de login con roles (Administrador/Conductor)
- **PWA**: Funciona como aplicación instalable

## 🛠️ Tecnologías

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Firebase (Firestore, Authentication, Hosting)
- **Diseño**: MorphinGlass UI con gradientes teal/black
- **CI/CD**: GitHub Actions para deploy automático

## 🚀 Deploy Automático

Este proyecto está configurado con GitHub Actions. Cada push a la rama `main` despliega automáticamente a Firebase Hosting.

## 📁 Estructura del Proyecto

```
app-territorios/
├── index.html              # Página principal
├── app.js                  # Lógica principal de la aplicación
├── styles.css              # Estilos globales
├── modules/                # Módulos de la aplicación
│   ├── admin-dashboard.js
│   └── conductor-dashboard.js
├── data/                   # Servicios de datos
│   └── firestore-services.js
└── firebase.json           # Configuración de Firebase
```

## 🔧 Configuración Local

1. Clonar el repositorio
2. Abrir `index.html` en un navegador
3. La aplicación se conecta automáticamente a Firebase

## 📝 Licencia

Uso privado para la congregación.
