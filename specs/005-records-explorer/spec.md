# Especificación 005: Explorador y Editor de Registros (Records Explorer)

## 1. Resumen Ejecutivo
El **Explorador y Editor de Registros** provee a los administradores y archivistas de cada organización una interfaz unificada y de alto rendimiento para auditar, buscar, visualizar, corregir y exportar los folios digitalizados y verificados. Permite visualizar columnas dinámicas adaptadas a las plantillas de extracción de cada lote, realizar correcciones en un modal interactivo de pantalla dividida (visor de imagen + formulario) y descargar reportes tabulares en formato CSV.

---

## 2. Roles y Control de Acceso (RBAC)

| Rol | Visualización en Sidebar | Acceso a `/[subdomain]/records` | Consulta de Registros | Edición de Registros (`PATCH`) | Exportación CSV |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin** | Visible ("Registros") | Permitido | Todos los folios del Tenant | Permitido sobre cualquier folio del Tenant | Permitido |
| **Archivist** | Visible ("Registros") | Permitido | Todos los folios del Tenant | Permitido **únicamente** si el lote fue subido por el archivista (`batch.uploaded_by == auth.user_id`) | Permitido |
| **Digitizer** | Oculto | Denegado (Redirige a `/workspace`) | Denegado (403 Forbidden) | Denegado (403 Forbidden) | Denegado (403 Forbidden) |

---

## 3. Requisitos Funcionales en Formato EARS

### 3.1. Navegación y Permisos
- **EARS-NAV-01 (Ubiquitous):** El sistema **debe** presentar la opción "Registros" en la barra lateral de navegación (`Sidebar`) para usuarios autenticados con rol `admin` o `archivist`.
- **EARS-NAV-02 (Event-Driven):** Cuando un usuario con rol `digitizer` intente acceder directamente a la ruta `/[subdomain]/records`, el sistema **debe** redirigirlo inmediatamente a su entorno de trabajo (`/[subdomain]/workspace`) y denegar el acceso a los datos.
- **EARS-NAV-03 (State-Driven):** Mientras el subdominio se esté resolviendo en Next.js (`useParams`), el sistema **debe** manejar la carga asíncrona previniendo redirecciones o llamadas con parámetros `undefined`.

### 3.2. Consulta y Filtrado de Registros (`GET /api/v1/records`)
- **EARS-REC-01 (Ubiquitous):** El sistema **debe** restringir todas las consultas a registros estrictamente al `tenant_id` derivado del token JWT verificado en backend.
- **EARS-REC-02 (State-Driven):** Mientras no se especifique un `batch_id`, el sistema **debe** mostrar los registros utilizando las columnas estándar: Nombre de archivo, Lote, Fecha de verificación, Estado y Acciones.
- **EARS-REC-03 (Event-Driven):** Cuando el usuario seleccione un Lote (`batch_id`) específico, el sistema **debe** obtener la definición de campos (`fields`) de la plantilla asociada a dicho lote y proyectar dinámicamente cada campo como una columna en la tabla.
- **EARS-REC-04 (Event-Driven):** Cuando el usuario ingrese un término en el campo de búsqueda (`search`), el sistema **debe** filtrar registros coincidentes tanto en el nombre original del archivo como en los valores indexados dentro del objeto JSON `metadata`.
- **EARS-REC-05 (Event-Driven):** Cuando se suministren filtros de fecha (`start_date`, `end_date`), el sistema **debe** acotar los resultados comparando contra la fecha de verificación (`verified_at` o `updated_at`).
- **EARS-REC-06 (Ubiquitous):** El sistema **debe** retornar resultados paginados con parámetros `page` (por defecto 1) y `page_size` (por defecto 20, configurable a 50, con tope en 100), incluyendo los metadatos de paginación (`total_records`, `page`, `page_size`, `total_pages`).
- **EARS-REC-07 (Ubiquitous):** El sistema **debe** incluir folios en estado `completed` y folios en estado `in_progress` debidamente marcados con su indicador de estado.
- **EARS-REC-08 (Ubiquitous):** El sistema **debe** generar URLs firmadas temporales (`view_url` de Supabase Storage) bajo demanda o en la respuesta para permitir la visualización segura del documento digitalizado.

### 3.3. Edición y Auditoría de Metadatos (`PATCH /api/v1/records/{folio_id}`)
- **EARS-EDIT-01 (Event-Driven):** Cuando un usuario con rol `admin` envíe una solicitud de modificación de metadatos para cualquier folio de su tenant, el sistema **debe** aplicar los cambios, actualizar `updated_at` y registrar `last_modified_by = auth.user_id`.
- **EARS-EDIT-02 (Event-Driven):** Cuando un usuario con rol `archivist` envíe una solicitud de modificación, el sistema **debe** verificar si `folio.batch.uploaded_by == auth.user_id`. Si coincide, **debe** procesar la actualización; si no coincide, **debe** rechazar la operación con código HTTP `403 Forbidden` ("No posee permisos para editar folios de lotes ajenos").
- **EARS-EDIT-03 (Unwanted Behavior):** Si un usuario intenta modificar un folio que se encuentra actualmente en estado `in_progress` o bloqueado por otro transcriptor/usuario, el sistema **debe** rechazar la solicitud con código HTTP `409 Conflict` ("El folio está siendo procesado en este momento").
- **EARS-EDIT-04 (Ubiquitous):** Las modificaciones y correcciones manuales realizadas a través de este endpoint **no deben** descontar créditos de la cuota freemium ni computar como un nuevo folio procesado.

### 3.4. Modal Split-Screen (Visor y Corrección Rápida)
- **EARS-UI-01 (Event-Driven):** Cuando el usuario presione el botón "Ver / Editar" en una fila de la tabla, el sistema **debe** desplegar un modal en pantalla dividida (split screen) sin salir de la vista del explorador.
- **EARS-UI-02 (State-Driven):** Mientras el modal esté abierto, el panel izquierdo **debe** renderizar el visor interactivo de la imagen original con soporte de zoom (acercar/alejar), paneo (arrastre) y rotación (en incrementos de 90°).
- **EARS-UI-03 (State-Driven):** Mientras el modal esté abierto, el panel derecho **debe** presentar un formulario dinámico generado a partir de los campos de la plantilla asociada al lote, prellenado con los valores actuales del folio.
- **EARS-UI-04 (Event-Driven):** Cuando el usuario guarde cambios dejando campos obligatorios en blanco, el sistema **debe** emitir una advertencia visual suave (soft warning) requiriendo confirmación antes de guardar.

### 3.5. Exportación Tabular (`GET /api/v1/records/export`)
- **EARS-EXP-01 (Event-Driven):** Cuando el usuario presione el botón "Exportar vista actual", el sistema **debe** generar y descargar un archivo CSV estructurado con codificación UTF-8 con BOM.
- **EARS-EXP-02 (State-Driven):** Si un lote específico está seleccionado, el CSV **debe** incluir como columnas los nombres de los campos de la plantilla correspondiente, además de las columnas estándar (ID de folio, nombre de archivo, fecha de verificación, verificador).
- **EARS-EXP-03 (State-Driven):** Si no hay lote seleccionado, el CSV **debe** exportar las columnas generales junto con la serialización legible de los metadatos comunes.
- **EARS-EXP-04 (Ubiquitous):** La exportación CSV **debe** respetar estrictamente los filtros de búsqueda, fechas y lote aplicados en la vista.

---

## 4. Casos Límite y Reglas de Negocio

1. **Campos Faltantes o Nulos en Metadatos Antiguos:** Si la plantilla fue editada con nuevos campos posteriormente a la verificación de un folio, la tabla y el formulario deben mostrar el campo vacío sin generar errores de renderizado.
2. **Imágenes no Disponibles o URLs Expiradas:** Si una URL firmada expira mientras el usuario mantiene abierto el modal de edición, el visor debe ofrecer un botón de recarga que solicite una nueva URL firmada sin perder los cambios no guardados en el formulario.
3. **Concurrencia entre Archivista y Digitador:** Si un folio pasa a estado `in_progress` en el visor de digitación mientras un archivista tiene el modal abierto, el intento de guardado debe fallar con `409 Conflict` informando que el folio fue tomado por otro operador.
4. **Volúmenes Grandes de Exportación:** La exportación CSV debe procesar los registros en streaming o bloques para evitar saturación de memoria del servidor si el lote contiene cientos o miles de folios.
5. **Aislamiento Multi-Tenant:** Ninguna consulta o mutación puede ejecutarse sin filtrar explícitamente por `tenant_id` en las cláusulas de base de datos (`eq("tenant_id", tenant_id)`).

---

## 5. Criterios de Aceptación

- [ ] Un usuario con rol `admin` puede visualizar y editar cualquier folio de su organización.
- [ ] Un usuario con rol `archivist` puede visualizar todos los folios, pero solo puede editar folios de lotes que él haya subido.
- [ ] Un usuario con rol `digitizer` no puede ver la opción "Registros" en la navegación ni acceder a `/[subdomain]/records`.
- [ ] La selección de un lote actualiza instantáneamente las columnas de la tabla con los labels de la plantilla de dicho lote.
- [ ] La búsqueda por texto filtra resultados en base al nombre de archivo y campos de metadatos.
- [ ] El modal split-screen permite navegar la imagen con zoom/pan/rotación y modificar los campos dinámicos.
- [ ] El guardado de metadatos registra al usuario modificador y la fecha de actualización sin consumir cuota freemium.
- [ ] La exportación a CSV genera un archivo válido que coincide con los filtros aplicados en pantalla.
