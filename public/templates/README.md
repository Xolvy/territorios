# Carpeta de Plantillas — Xolvy Territorial Intelligence

Esta carpeta contiene las plantillas institucionales para la exportación de reportes.

## Archivos esperados

### 📊 Plantillas PDF (S-12 / S-13)

| Archivo | Servicio | Descripción |
|---|---|---|
| `S-13_S.pdf` | `generarS13()` | Registro de territorios oficial (20 filas/página) |
| `S-12_S.pdf` | `generarS12()` | Tarjeta individual de territorio |
| `S-12_s-Mlt_S.pdf` | `generarS12Multiple()` | Hoja con 4 tarjetas S-12 (2×2) |

> **Fuente oficial:** Descargar desde [jw.org → Publicaciones → Formularios](https://www.jw.org/es/biblioteca/formularios-de-informes/)

### 📊 Plantillas Excel (Programa Semanal)

| Archivo | Descripción |
|---|---|
| `prog_conductores.xlsx` | Plantilla Excel para la versión completa de Conductores |
| `prog_publicadores.xlsx` | Plantilla Excel para la versión simplificada de Publicadores |

## Cómo calibrar las plantillas

1. **Diseña** tu plantilla en Excel con el diseño institucional que desees
   - Añade logos, encabezados formateados, colores de fondo institucionales, etc.
   - Deja las celdas de datos **en blanco** — el sistema las llenará en runtime

2. **Mapa de celdas por defecto** (configurable en `export-service.js`, función `_injectDataIntoTemplate`):
   ```
   A1  → Nombre de la congregación
   A2  → Rango de fechas de la semana
   Fila 4, col A–G → Fechas de cada día (Lunes a Domingo)
   
   TURNO MAÑANA (col A–G según día):
     Fila 5  → Lugar
     Fila 6  → Hora
     Fila 7  → Conductor
     Fila 8  → Auxiliar (solo plantilla conductores)
     Fila 9  → Faceta
     Fila 10 → Territorio (solo plantilla conductores)
   
   TURNO TARDE (col A–G según día):
     Fila 12–17 → Misma estructura
   
   TURNO NOCHE (col A–G según día):
     Fila 19–24 → Misma estructura
   
   TURNO ZOOM (solo Martes):
     Fila 26–29 → Lugar, Hora, Conductor, Faceta
   ```

3. **Guarda** el archivo como `.xlsx` (Excel 2007+) en esta carpeta

4. Si las plantillas no están presentes, el sistema genera el Excel **desde cero** con
   estilos programáticos de alta calidad como fallback automático.

## Seguridad

- La versión `publicadores` **nunca** incluye números de territorios específicos
- Esta restricción se aplica tanto en Excel como en PNG, en el `export-service.js`
