# Contributing to App Conductores

¡Gracias por tu interés en contribuir a App Conductores! 🎉

## 🤝 Cómo Contribuir

### 1. Fork y Clone

```bash
git fork https://github.com/OWNER/app-conductores.git
git clone https://github.com/TU_USUARIO/app-conductores.git
cd app-conductores
```

### 2. Setup Local

```bash
npm install
npm run dev
```

### 3. Crear Feature Branch

```bash
git checkout -b feature/nueva-funcionalidad
```

### 4. Desarrollo

- ✅ Seguir las convenciones TypeScript
- ✅ Mantener tests actualizados
- ✅ Documentar cambios importantes

### 5. Testing

```bash
npm run build     # Verificar build
npm run lint      # Verificar linting
```

### 6. Commit y Push

```bash
git add .
git commit -m "feat: descripción clara del cambio"
git push origin feature/nueva-funcionalidad
```

### 7. Pull Request

- Describe claramente los cambios
- Incluye screenshots si es UI
- Referencias a issues relacionados

## 📋 Guidelines

### **Naming Conventions**

- **Components**: PascalCase (`TerritoryManager.tsx`)
- **Functions**: camelCase (`calculateTerritory()`)
- **Files**: kebab-case (`territory-utils.ts`)
- **Constants**: UPPER_CASE (`API_ENDPOINTS`)

### **Commit Messages**

```
feat: nueva funcionalidad
fix: corrección de bug
docs: actualización documentación
style: cambios de formato
refactor: refactoring de código
test: agregar tests
chore: tareas de mantenimiento
```

### **Branch Strategy**

- `main` - Producción estable
- `develop` - Desarrollo activo
- `feature/` - Nuevas funcionalidades
- `fix/` - Correcciones de bugs
- `hotfix/` - Fixes urgentes para producción

## 🚀 Areas de Contribución

### **🎯 Funcionalidades Prioritarias**

- [ ] Sistema de notificaciones
- [ ] Mejoras de performance
- [ ] Tests automatizados
- [ ] Internacionalización (i18n)

### **🎨 UI/UX Improvements**

- [ ] Themes personalizables
- [ ] Animaciones fluidas
- [ ] Responsive design
- [ ] Accessibility (a11y)

### **🔧 Technical Debt**

- [ ] Refactoring de componentes
- [ ] Optimización de bundles
- [ ] Documentation updates
- [ ] Code cleanup

## 🐛 Reportar Bugs

Usa el [issue template](https://github.com/OWNER/app-conductores/issues/new) con:

- **Descripción clara** del problema
- **Steps to reproduce** el bug
- **Expected vs Actual** behavior
- **Environment info** (browser, OS)
- **Screenshots** si es relevante

## 💡 Sugerir Features

1. Checkea que no exista ya en [Issues](https://github.com/OWNER/app-conductores/issues)
2. Crea un issue con label `enhancement`
3. Describe claramente el use case
4. Incluye mockups si es posible

## 📞 Contact

- **Issues**: [GitHub Issues](https://github.com/OWNER/app-conductores/issues)
- **Discussions**: [GitHub Discussions](https://github.com/OWNER/app-conductores/discussions)

¡Esperamos tu contribución! 🚀
