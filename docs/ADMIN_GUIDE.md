# 🔐 Guía de Administración - Sistema de Territorios

## 📋 Roles y Permisos

### 👤 **Conductor** (Sin Contraseña)

**Acceso**: Automático desde el menú principal

**Funcionalidades**:

- ✅ Ver territorios asignados
- ✅ Marcar manzanas completadas
- ✅ Solicitar nuevos territorios
- ✅ Devolver territorios terminados
- ✅ Gestionar base telefónica personal
- ✅ Descargar listados personalizados
- ✅ Ver historial de asignaciones

---

### 🔧 **Administrador** (Contraseña: `admin123`)

**Acceso**: Modo Administrador → Campo teléfono vacío → Contraseña

**Funcionalidades**:

- ✅ **Dashboard**: Estadísticas generales, KPIs, resúmenes
- ✅ **Programar Territorio**: Gestión y asignación manual
- ✅ **Programa**: Fechas, lugares, facetas de predicación
- ✅ **Reportes**: Estadísticas de cobertura y progreso

**Paneles Disponibles**:

```
📊 Dashboard        → Estadísticas generales
🗺️ Programar       → Gestión de territorios
📅 Programa        → Programa de predicación
📈 Reportes        → Análisis y estadísticas
```

---

### 🔐 **SuperAdmin** (Tel: `0994749286` / Pass: `Sonita.09`)

**Acceso**: Modo Administrador → Teléfono + Contraseña

**Funcionalidades Exclusivas**:

#### 👥 **Gestión de Usuarios**

- 🔍 Ver todos los administradores
- ➕ Crear nuevos administradores
- 🔑 Cambiar contraseñas de admins
- 🏷️ Asignar roles (Admin/SuperAdmin)

#### ⚙️ **Configuración del Sistema**

- 🗑️ **Limpiar cache completo**
- 💾 **Exportar base de datos** (JSON completo)
- 📁 **Importar configuraciones**
- ✅ **Verificar integridad** de datos
- ⚡ **Optimizar base de datos** Firebase
- 🔄 **Reset completo** del sistema

#### 🛠️ **Configuración Avanzada**

- 🔐 **Cambiar credenciales SuperAdmin**
- 🌐 **Verificar conexión Firebase**
- 🔄 **Sincronizar datos** manualmente
- ⚠️ **Zona de peligro** (funciones destructivas)

**Paneles SuperAdmin**:

```
📊 Dashboard           → Estadísticas (heredado)
🗺️ Programar          → Territorios (heredado)
📅 Programa           → Predicación (heredado)
📈 Reportes           → Análisis (heredado)
👥 Usuarios           → Gestión de administradores
⚙️ Sistema            → Mantenimiento avanzado
🛠️ Config Avanzada    → Configuración técnica
```

---

## 🚀 Procedimientos de Administración

### **1. Crear Nuevo Administrador** (Solo SuperAdmin)

1. Acceder como **SuperAdmin**
2. Ir a **Usuarios** → **Agregar Nuevo Administrador**
3. Completar formulario:
   - **Nombre**: Nombre completo
   - **Teléfono**: Número de contacto
   - **Contraseña**: Contraseña segura
   - **Rol**: Admin o SuperAdmin
4. Click **Crear Administrador**

### **2. Programar Territorios**

1. Acceder como **Admin** o **SuperAdmin**
2. Ir a **Programar** → **Gestión de Territorios**
3. Seleccionar territorio en la grilla
4. Asignar conductor disponible
5. Configurar fechas y detalles

### **3. Generar Reportes**

1. Acceder como **Admin** o **SuperAdmin**
2. Ir a **Reportes** → Seleccionar tipo:
   - **Cobertura territorial**
   - **Progreso por conductor**
   - **Estadísticas generales**
3. Configurar filtros de fecha
4. Generar y descargar reporte

### **4. Backup del Sistema** (Solo SuperAdmin)

1. Acceder como **SuperAdmin**
2. Ir a **Sistema** → **Exportar Base de Datos**
3. Se descarga archivo JSON completo
4. Guardar en ubicación segura

### **5. Mantenimiento Regular** (Solo SuperAdmin)

**Diario**:

- Verificar conexión Firebase
- Revisar logs de errores

**Semanal**:

- Limpiar cache si hay problemas de rendimiento
- Verificar integridad de datos

**Mensual**:

- Backup completo del sistema
- Optimizar base de datos
- Revisar usuarios y permisos

---

## ⚠️ Zona de Peligro (Solo SuperAdmin)

### 🚨 **Acciones Destructivas**

Estas acciones requieren **confirmación múltiple**:

- **🗑️ Eliminar Todos los Datos**: Borra TODO permanentemente
- **🔄 Reset Configuración**: Vuelve a configuración inicial
- **🔄 Reset Sistema**: Reinicia aplicación completa

**Procedimiento de Seguridad**:

1. Primera confirmación: "¿Estás seguro?"
2. Segunda confirmación: "CONFIRMA: ¿Eliminar TODO?"
3. Solo entonces se ejecuta la acción

---

## 🛠️ Solución de Problemas

### **Problema**: No puedo acceder como Admin

**Solución**:

- Verificar que el campo teléfono esté **vacío**
- Contraseña correcta: `admin123`
- Limpiar cache del navegador

### **Problema**: No veo las opciones de SuperAdmin

**Solución**:

- Verificar teléfono: `0994749286`
- Verificar contraseña: `Sonita.09`
- Ambos campos son **obligatorios** para SuperAdmin

### **Problema**: Error de permisos en Firebase

**Solución**:

- SuperAdmin: **Sistema** → **Verificar Conexión Firebase**
- Si persiste: **Sincronizar Datos**

### **Problema**: La aplicación está lenta

**Solución**:

- SuperAdmin: **Sistema** → **Limpiar Cache Completo**
- Luego: **Optimizar BD**

---

## 📊 Monitoreo y Estadísticas

### **KPIs del Dashboard**

- **Total Territorios**: 22 disponibles
- **Territorios Asignados**: Conteo en tiempo real
- **Conductores Activos**: Número de usuarios
- **Registros Telefónicos**: Total en base de datos

### **Métricas de Rendimiento**

- **Tiempo de Carga**: < 3 segundos
- **Cache Hit Rate**: > 80%
- **Errores**: < 1% de las operaciones

---

## 🔒 Políticas de Seguridad

### **Contraseñas**

- Admin local: Cambiar cada 3 meses
- SuperAdmin: Cambiar cada 6 meses
- No compartir credenciales

### **Backup**

- Backup semanal automático
- Backup manual antes de cambios importantes
- Mantener 3 copias de seguridad

### **Acceso**

- Un solo SuperAdmin activo
- Máximo 3 admins locales
- Auditar accesos mensualmente

---

**Nota**: Para cambios críticos o problemas técnicos, contactar al SuperAdmin del sistema.
