# Especificación 008: Exportación Multi-Formato de Registros (Excel .xlsx & CSV)

## 1. Resumen Ejecutivo
La funcionalidad de **Exportación Multi-Formato de Registros** amplía las capacidades del Explorador de Registros (`/api/v1/records/export` y la UI en Next.js) permitiendo a administradores y archivistas descargar datos históricos y verifiados en dos formatos optimizados para usuarios comerciales y analistas: **Excel Nativo (`.xlsx`)** y **CSV delimitado por punto y coma con directivas para Excel (`.csv`)**.

Elimina por completo la serialización cruda de JSON (`json.dumps(metadata)`) cuando se consultan múltiples lotes simultáneamente, sustituyéndola por un análisis dinámico que unifica y proyecta todas las claves de metadatos en columnas amigables ("Nombre Padre" a partir de `nombre_padre`). Además, formatea de manera homogénea las fechas de verificación (`AAAA-MM-DD HH:MM`) y aplica estilos visuales corporativos en Excel (cabeceras contrastadas `#1E293B`, bordes limpios y autoajuste de anchos de columna).

---

## 2. Roles y Control de Acceso (RBAC)

| Rol | Menú de Exportación en UI | Solicitud `GET /api/v1/records/export?format=xlsx` | Solicitud `GET /api/v1/records/export?format=csv` | Restricción Multi-Tenant |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Visible (Dropdown Activo) | Permitido (Descarga .xlsx) | Permitido (Descarga .csv) | Estricto al `tenant_id` del usuario |
| **Archivist** | Visible (Dropdown Activo) | Permitido (Descarga .xlsx) | Permitido (Descarga .csv) | Estricto al `tenant_id` del usuario |
| **Digitizer** | Oculto / Sin Acceso a vista | Denegado (HTTP 403 Forbidden) | Denegado (HTTP 403 Forbidden) | Bloqueado por guardias de rol |

---

## 3. Requisitos Funcionales en Formato EARS

### 3.1. Parámetros y Selección de Formato (`GET /api/v1/records/export`)
- **EARS-EXP-01 (Ubiquitous):** El sistema **debe** aceptar un parámetro opcional de consulta `format: str = "xlsx"` en el endpoint `/api/v1/records/export`.
- **EARS-EXP-02 (State-Driven):** Si el parámetro `format` no se proporciona o se omite, el sistema **debe** asumir `"xlsx"` como formato predeterminado.
- **EARS-EXP-03 (Unwanted Behavior):** Si el valor de `format` no es ni `"xlsx"` ni `"csv"`, el sistema **debe** responder con un error HTTP `400 Bad Request` indicando formatos soportados válidos.
- **EARS-EXP-04 (Ubiquitous):** La exportación **debe** respetar todos los filtros activos provistos por el usuario: `batch_id`, `search`, `start_date` y `end_date`.

### 3.2. Proyección y Limpieza Dinámica de Metadatos
- **EARS-META-01 (State-Driven):** Cuando se suministre un `batch_id` válido, el sistema **debe** usar la lista de campos definida en la plantilla del lote (`template_fields`) para las columnas de metadatos.
- **EARS-META-02 (State-Driven):** Cuando NO se suministre un `batch_id` (exportación global de todos los lotes), el sistema **debe** inspeccionar los folios obtenidos, consolidar la unión de todas las claves presentes en el objeto `metadata`, y generar una columna individual por cada clave única.
- **EARS-META-03 (State-Driven):** Las claves técnicas de metadatos (e.g. `nombre_padre`, `fecha_bautismo`, `libro_tomo`) **deben** transformarse automáticamente en encabezados legibles y capitalizados (e.g. "Nombre Padre", "Fecha Bautismo", "Libro Tomo"), ordenados de forma predecible y alfabética o estructurada.
- **EARS-META-04 (Ubiquitous):** Las columnas base iniciales **deben** ser invariantes: `ID Folio`, `Archivo`, `Lote`, `Fecha Verificación`, `Estado`.
- **EARS-META-05 (Ubiquitous):** Las marcas de tiempo de `verified_at` **deben** formatearse obligatoriamente bajo el estándar localizable `AAAA-MM-DD HH:MM` (o cadena vacía si no está verificado).

### 3.3. Especificación del Formato CSV Optimizado
- **EARS-CSV-01 (Ubiquitous):** El archivo CSV **debe** emitirse con el carácter Byte Order Mark UTF-8 (`\ufeff`) al inicio del flujo de datos para garantizar correcta detección de acentos en Microsoft Excel en Windows.
- **EARS-CSV-02 (Ubiquitous):** La primera línea física del archivo CSV **debe** contener la directiva explícita de Excel `sep=;\r\n`.
- **EARS-CSV-03 (Ubiquitous):** El delimitador entre celdas **debe** ser punto y coma (`;`).
- **EARS-CSV-04 (Ubiquitous):** El contenido de las celdas **debe** seguir el estándar RFC 4180 (entrecomillado con `"` y escape `""` cuando contenga caracteres especiales, saltos de línea o punto y coma).
- **EARS-CSV-05 (Ubiquitous):** El encabezado `Content-Type` de la respuesta **debe** ser `text/csv; charset=utf-8` y `Content-Disposition` con nombre de archivo dinámico `registros_export_YYYYMMDD_HHMMSS.csv`.

### 3.4. Especificación del Formato Excel Nativo (.xlsx)
- **EARS-XLSX-01 (Ubiquitous):** La generación del archivo binario `.xlsx` **debe** realizarse en memoria utilizando la librería `openpyxl` mediante `io.BytesIO`.
- **EARS-XLSX-02 (Ubiquitous):** La hoja principal de cálculo **debe** llamarse `"Registros CodexFlow"`.
- **EARS-XLSX-03 (Ubiquitous):** La fila de cabecera (Fila 1) **debe** contar con estilo corporativo:
  - Color de fondo (Fill): Azul pizarra oscuro `#1E293B`.
  - Fuente: Negrita (`bold=True`), color blanco `#FFFFFF`.
  - Alineación: Centrada o a la izquierda según tipo, verticalmente centrada.
  - Altura de fila: 26 puntos.
- **EARS-XLSX-04 (Ubiquitous):** Todas las celdas de datos y encabezados **deben** tener bordes finos de separación de color gris claro (`#CBD5E1` o `#E2E8F0`).
- **EARS-XLSX-05 (Ubiquitous):** El generador **debe** calcular automáticamente el ancho óptimo de cada columna (`column_dimensions[col_letter].width`) basado en la longitud máxima de su contenido (con un margen de seguridad mínimo de +3 caracteres y límite superior para textos muy largos).
- **EARS-XLSX-06 (Ubiquitous):** El encabezado `Content-Type` de la respuesta **debe** ser `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y `Content-Disposition` con nombre de archivo `registros_export_YYYYMMDD_HHMMSS.xlsx`.

### 3.5. Interfaz de Usuario y Experiencia (Frontend)
- **EARS-UI-01 (Event-Driven):** En `frontend/src/app/[subdomain]/records/page.tsx`, el botón simple de "Exportar CSV" **debe** ser reemplazado por un botón con menú desplegable (Dropdown) interactivo.
- **EARS-UI-02 (State-Driven):** El menú desplegable **debe** exponer dos opciones accesibles:
  - "Exportar a Excel (.xlsx)" (acompañado de ícono representativo de hoja de cálculo / tabla).
  - "Exportar a CSV (.csv)" (acompañado de ícono representativo de archivo delimitado / documento).
- **EARS-UI-03 (State-Driven):** Durante el proceso de descarga/generación de cualquiera de los dos formatos, el botón principal **debe** reflejar un estado de carga (`exporting = true`), deshabilitando clicks repetidos y mostrando un spinner indicador.
- **EARS-UI-04 (Event-Driven):** El frontend **debe** descargar el blob recibido con la extensión correcta correspondiente (`.xlsx` o `.csv`) y disparar la descarga en el navegador sin recargar la página.

---

## 4. Casos Límite y Reglas de Negocio

1. **Conjunto vacío de folios:** Si los filtros aplicados no retornan registros, el archivo `.xlsx` o `.csv` debe generarse correctamente con la fila de encabezados y 0 filas de datos, sin fallar con excepciones 500.
2. **Campos con valores especiales o saltos de línea:** En CSV, deben estar rigurosamente escapados para evitar desalinear las columnas en Excel. En XLSX, `openpyxl` maneja nativamente los tipos string/number sin riesgo de inyección de delimitadores.
3. **Valores nulos o ausentes en metadatos desglosados:** Si un folio no posee una clave de metadatos que otro lote o folio sí posee, la celda correspondiente debe quedar vacía (`""`), sin mostrar `null` ni `undefined`.
4. **Fechas corruptas o vacías:** Si un folio no posee `verified_at` o su valor es inválido, el sistema debe omitir el formateo y dejar la celda en blanco sin romper el proceso.
5. **Consumo de memoria en exportaciones masivas:** Para `.xlsx`, la construcción debe usar estructuras eficientes en memoria (`io.BytesIO`) y cerrar el workbook al finalizar.
6. **Seguridad Multi-Tenant:** Todas las consultas a la base de datos deben filtrar estrictamente por el `tenant_id` validado en el token JWT.

---

## 5. Criterios de Aceptación

- [ ] La librería `openpyxl` está declarada en `backend/requirements.txt`.
- [ ] El endpoint `GET /api/v1/records/export` acepta `format=xlsx` (default) y `format=csv`.
- [ ] La descarga en formato Excel genera un archivo `.xlsx` válido, con hoja "Registros CodexFlow", cabecera `#1E293B` en texto blanco y anchos autoajustados.
- [ ] La descarga en formato CSV incluye el BOM `\ufeff`, delimitador `;` y directiva `sep=;\r\n` en la primera línea.
- [ ] Cuando no hay lote seleccionado, las claves de `metadata` se desglosan en columnas individuales limpias (e.g. "Nombre Padre") en lugar de un JSON crudo.
- [ ] Las fechas de verificación se presentan formateadas como `AAAA-MM-DD HH:MM`.
- [ ] El frontend muestra un menú desplegable con opciones para Excel (.xlsx) y CSV (.csv) con feedback de carga.
