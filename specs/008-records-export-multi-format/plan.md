# Plan Técnico: Exportación Multi-Formato de Registros (Excel .xlsx & CSV)

## 1. Visión General de la Arquitectura

La solución implementa una capa de transformación y serialización multi-formato en el backend de FastAPI y enriquece la UI del Explorador de Registros en Next.js con un selector interactivo.

```
+---------------------------------------------------------------------------------+
|                                Frontend (Next.js)                               |
|  /[subdomain]/records/page.tsx                                                  |
|  - DropdownButton: "Exportar Registros"                                         |
|    ├── Opción 1: "Exportar a Excel (.xlsx)" (FileSpreadsheet icon)              |
|    └── Opción 2: "Exportar a CSV (.csv)" (FileText icon)                        |
|  - Estado `exporting` con feedback visual (Spinner/disabled)                    |
|  - Llamada: GET /api/v1/records/export?format={xlsx|csv}&batch_id=...&search=...|
+----------------------------------------+----------------------------------------+
                                         | REST / HTTPS (JWT Bearer)
+----------------------------------------v----------------------------------------+
|                                Backend (FastAPI)                                |
|  GET /api/v1/records/export                                                     |
|  - Extracción y validación de parámetros (format="xlsx"|"csv", filtros)        |
|  - Extracción de folios autorizados por tenant_id                              |
|  - Motor de proyección de columnas:                                             |
|    * Con batch_id: template_fields                                              |
|    * Sin batch_id: agregación dinámica de claves de metadata & humanización     |
|  - Normalización de celdas: Formato fecha "YYYY-MM-DD HH:MM", strings limpios   |
|  - Generador de salida:                                                         |
|    * Formato XLSX: openpyxl -> Workbook -> Estilos (#1E293B) -> BytesIO        |
|    * Formato CSV: BOM + sep=;\r\n + csv.writer(delimiter=';')                 |
+---------------------------------------------------------------------------------+
```

---

## 2. Contrato de la API

### Endpoint: `GET /api/v1/records/export`

#### Query Parameters:
| Parámetro | Tipo | Requerido | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `format` | `string` | No | `"xlsx"` | Formato de salida: `"xlsx"` o `"csv"`. |
| `batch_id` | `UUID / str` | No | `None` | Filtrar por lote específico. Si se omite, exporta todos los lotes con metadatos unificados. |
| `search` | `string` | No | `None` | Filtro textual sobre nombre de archivo y valores de metadatos. |
| `start_date` | `string` | No | `None` | Filtro `verified_at >= start_date`. |
| `end_date` | `string` | No | `None` | Filtro `verified_at <= end_date`. |

#### Headers:
- `Authorization: Bearer <supabase_jwt>`

#### Respuestas:

- **200 OK (Excel):**
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="registros_export_YYYYMMDD_HHMMSS.xlsx"`
  - Cuerpo: Archivo binario generado con `openpyxl`.

- **200 OK (CSV):**
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="registros_export_YYYYMMDD_HHMMSS.csv"`
  - Cuerpo: Texto plano codificado con BOM `\ufeff`, directiva `sep=;\r\n` y registros separados por `;`.

- **400 Bad Request:**
  - Cuando `format` no pertenezca a `["xlsx", "csv"]`.
  - `{ "detail": "Formato de exportación no soportado. Use 'xlsx' o 'csv'." }`

- **403 Forbidden:**
  - Si el rol del usuario es `digitizer`.

---

## 3. Estrategia de Implementación Detallada

### 3.1. Dependencias Backend
- Archivo afectado: `backend/requirements.txt`
- Agregar `openpyxl` al listado de dependencias para permitir generación de hojas Excel con estilos.

### 3.2. Lógica de Desglose Dinámico de Metadatos
Para evitar el volcado de JSON crudo cuando no se especifica `batch_id`:
1. **Recolección de Claves:**
   - Iterar sobre la lista de folios recuperados.
   - Para cada folio, inspeccionar su diccionario `metadata`.
   - Registrar todas las claves únicas encontradas en un conjunto ordenado (`set` o lista ordenada alfabéticamente).
2. **Humanización de Nombres de Columnas:**
   - Función auxiliar `format_column_title(key: str) -> str`:
     - Reemplazar guiones bajos y medios por espacios (`key.replace('_', ' ').replace('-', ' ')`).
     - Aplicar capitalización de palabras (`.title()`).
     - Ejemplos: `nombre_padre` $\to$ `"Nombre Padre"`, `fecha_nacimiento` $\to$ `"Fecha Nacimiento"`.
3. **Mapeo de Valores por Fila:**
   - Para cada folio y para cada clave unificada, extraer `folio.get("metadata", {}).get(key, "")`.
   - Si el valor es `None`, sustituir por cadena vacía `""`.
   - Si el valor es de tipo compuesto o fecha, convertir a cadena legible.

### 3.3. Formateo de Fechas
- Función auxiliar `format_datetime(iso_str: Optional[str]) -> str`:
  - Si `iso_str` es nulo o vacío, retornar `""`.
  - Parsear la cadena ISO utilizando `datetime.fromisoformat` o expresiones regulares seguras.
  - Formatear como `YYYY-MM-DD HH:MM`.

### 3.4. Generación Excel con `openpyxl`
1. Crear `wb = openpyxl.Workbook()` y seleccionar `ws = wb.active`.
2. Asignar título a la hoja: `ws.title = "Registros CodexFlow"`.
3. Escribir fila 1 con la lista de encabezados:
   - Base: `["ID Folio", "Archivo", "Lote", "Fecha Verificación", "Estado"]` + columnas de metadatos.
4. Aplicar estilos a la fila 1:
   - `PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")`
   - `Font(name="Calibri", size=11, bold=True, color="FFFFFF")`
   - `Alignment(horizontal="center", vertical="center", wrap_text=True)`
   - `ws.row_dimensions[1].height = 26`
5. Escribir las filas de datos con bordes finos (`Thin border` en color `#CBD5E1`).
6. Ajuste dinámico de anchos de columna:
   - Iterar columnas de `ws.columns`.
   - Calcular `max_len = max(len(str(cell.value or '')) for cell in col)`.
   - Asignar `ws.column_dimensions[get_column_letter(col_idx)].width = max(max_len + 3, 12)`.
7. Guardar en `io.BytesIO()` y devolver mediante `Response(content=stream.getvalue(), media_type=...)`.

### 3.5. Generación CSV Optimizado
1. Generar flujo con `yield "\ufeff"` (BOM) y `yield "sep=;\r\n"`.
2. Usar `csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")`.
3. Escribir encabezados y filas de manera secuencial o en streaming.

### 3.6. Componente Frontend en `frontend/src/app/[subdomain]/records/page.tsx`
1. Reemplazar el botón `<button onClick={handleExport}>` por un contenedor relativo con Dropdown menu:
   - Botón principal de exportación con ícono `Download` o `ChevronDown`.
   - Menú flotante animado o condicional (`isOpenDropdown`).
   - Opción 1: Ícono `FileSpreadsheet` / `Table` + "Exportar a Excel (.xlsx)".
   - Opción 2: Ícono `FileText` / `FileSpreadsheet` + "Exportar a CSV (.csv)".
2. Actualizar `handleExport(format: "xlsx" | "csv")`:
   - Incorporar `params.append("format", format)`.
   - Descargar archivo con nombre correspondiente: `registros_export_${YYYY-MM-DD}.${format}`.
   - Manejo de excepciones con toast/alert informativo.
   - Manejo de click-outside para cerrar el menú desplegable.

---

## 4. Pruebas y Validación

1. **Prueba Unitaria Backend:**
   - Probar llamada con `format=xlsx` y verificar que el payload empiece con firma de archivo ZIP/XLSX (`PK\x03\x04`).
   - Probar llamada con `format=csv` y verificar que empiece con `\ufeffsep=;\r\n`.
   - Probar exportación con `batch_id` presente (columnas de plantilla).
   - Probar exportación sin `batch_id` con múltiples folios que tengan distintas claves de metadatos (unificación de columnas).
   - Probar rechazo con `format=invalid` (código HTTP 400).
2. **Prueba de Interfaz Frontend:**
   - Abrir desplegable, hacer clic en "Exportar a Excel (.xlsx)", verificar descarga y apertura en Microsoft Excel y LibreOffice Calc.
   - Hacer clic en "Exportar a CSV (.csv)", verificar apertura directa en Excel con detección automática de columnas sin requerir asistente de texto a columnas.
