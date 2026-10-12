# Tareas de Implementación: Exportación Multi-Formato de Registros (Excel .xlsx & CSV)

---

## Fase 1: Dependencias y Preparación Backend

- [x] **Tarea 1.1:** Actualizar dependencias del backend.
  - [x] Añadir `openpyxl` a `backend/requirements.txt`.
- [x] **Tarea 1.2:** Implementar funciones utilitarias de formateo y proyección en `backend/main.py`.
  - [x] Implementar `format_export_datetime(dt_str: Optional[str]) -> str` para transformar marcas temporales a formato `AAAA-MM-DD HH:MM`.
  - [x] Implementar `clean_column_name(key: str) -> str` para convertir identificadores tipo `nombre_padre` a formato legible como "Nombre Padre".
  - [x] Implementar `extract_dynamic_columns(folios: list, template_fields: Optional[list]) -> tuple[list[str], list[str]]` para obtener claves y etiquetas de encabezados.

---

## Fase 2: Endpoint de Exportación Backend (`GET /api/v1/records/export`)

- [x] **Tarea 2.1:** Actualizar firma y validación de parámetros del endpoint.
  - [x] Añadir parámetro de consulta `format: str = Query("xlsx", regex="^(xlsx|csv)$")`.
  - [x] Manejar rechazo HTTP 400 si se envía un formato distinto a `"xlsx"` o `"csv"`.
- [x] **Tarea 2.2:** Adaptar la recolección de registros y desglose de metadatos.
  - [x] Mantener filtros existentes: `tenant_id`, `batch_id`, `search`, `start_date`, `end_date`, `status in ["completed", "in_progress"]`.
  - [x] Si `batch_id` está presente: proyectar columnas base (`ID Folio`, `Archivo`, `Lote`, `Fecha Verificación`, `Estado`) junto con los campos de la plantilla.
  - [x] Si `batch_id` no está presente: recopilar el conjunto unificado de todas las claves presentes en los objetos `metadata` de todos los folios a exportar, ordenarlas y generar las columnas individuales con nombres limpios en lugar de un JSON crudo.
  - [x] Formatear `verified_at` de cada fila al estándar `AAAA-MM-DD HH:MM`.
- [x] **Tarea 2.3:** Implementar generador de archivo CSV optimizado para Excel (`format="csv"`).
  - [x] Incluir byte BOM UTF-8 (`\ufeff`) al inicio.
  - [x] Incluir directiva explícita `sep=;\r\n` como primera línea.
  - [x] Usar delimitador `;` y escape estándar RFC 4180.
  - [x] Configurar encabezado `Content-Type: text/csv; charset=utf-8` y `Content-Disposition`.
- [x] **Tarea 2.4:** Implementar generador de archivo Excel nativo (`format="xlsx"`).
  - [x] Construir libro de trabajo (`Workbook`) con `openpyxl`.
  - [x] Nombrar la hoja principal como `"Registros CodexFlow"`.
  - [x] Aplicar estilo corporativo en la cabecera: fondo oscuro `#1E293B`, texto blanco `#FFFFFF` en negrita, altura de fila de 26pt.
  - [x] Aplicar bordes finos de celda en toda la tabla.
  - [x] Calcular y aplicar autoajuste de anchos de columna según la longitud del texto con margen de seguridad.
  - [x] Serializar en `io.BytesIO` y responder con `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

---

## Fase 3: Interfaz de Usuario Frontend (`frontend/src/app/[subdomain]/records/page.tsx`)

- [x] **Tarea 3.1:** Actualizar lógica de exportación en el cliente.
  - [x] Modificar función `handleExport(format: "xlsx" | "csv")` para pasar el parámetro `format` en la query.
  - [x] Manejar la descarga del archivo con la extensión y tipo MIME apropiado (`.xlsx` o `.csv`).
  - [x] Mantener estado `exporting` para desactivar acciones concurrentes y proveer feedback visual.
- [x] **Tarea 3.2:** Reemplazar botón simple por Dropdown interactivo de exportación.
  - [x] Implementar componente de menú desplegable con cierre al hacer clic fuera (click-outside listener).
  - [x] Botón principal con indicador de carga / spinner cuando `exporting == true`.
  - [x] Opción 1 del dropdown: "Exportar a Excel (.xlsx)" con ícono alusivo a tabla/hoja de cálculo.
  - [x] Opción 2 del dropdown: "Exportar a CSV (.csv)" con ícono alusivo a documento de texto/separado por comas.
  - [x] Preservar estilos visuales Tailwind y accesibilidad del botón.

---

## Fase 4: Pruebas y Control de Calidad

- [ ] **Tarea 4.1:** Pruebas unitarias/integración de los endpoints.
  - [ ] Verificar exportación en XLSX con cabecera estilizada y hojas válidas.
  - [ ] Verificar exportación en CSV con BOM `\ufeff`, directiva `sep=;\r\n` y delimitador `;`.
  - [ ] Verificar desglose de columnas cuando se exportan folios sin lote seleccionado.
  - [ ] Verificar que las fechas de verificación cumplan `AAAA-MM-DD HH:MM`.
- [ ] **Tarea 4.2:** Verificación cruzada en navegadores y aplicaciones cliente.
  - [ ] Probar descarga y apertura directa en Microsoft Excel tanto para el archivo `.xlsx` como para el `.csv`.
  - [ ] Validar funcionamiento del dropdown en resoluciones de escritorio y móviles.
