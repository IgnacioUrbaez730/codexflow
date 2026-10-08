# Tareas Secuenciales - Loop 1 (Hub de Ingesta y Cola Global)

## Fase 1: Base de Datos y API
- [x] **Tarea 1.1:** Actualizar esquema de tabla `folios`. Añadir columna `locked_at` (timestamp) y asegurar que el estado contemple los valores `pending`, `in_progress`, `revision` y `completed`.
- [x] **Tarea 1.2:** Crear función `get_next_folio` (RPC o Endpoint). Debe seleccionar un folio `pending` (orden FIFO por `created_at`), cambiar su estado a `in_progress` y setear `locked_at = NOW()` de forma transaccional.
- [x] **Tarea 1.3:** Implementar job o trigger de liberación de timeout. Buscar folios `in_progress` donde `NOW() - locked_at > 15 minutos` y devolverlos a estado `pending`.
- [x] **Tarea 1.4:** Ajustar políticas RLS para lectura y escritura de folios en modo "Dudoso". El Admin puede acceder a todos los folios en `revision`; el Archivista solo a aquellos pertenecientes a lotes con su `uploaded_by`.

## Fase 2: Hub de Ingesta (Frontend)
- [x] **Tarea 2.1:** Eliminar rutas antiguas `/upload` y `/templates`. Crear la nueva ruta base `/[subdomain]/ingest/page.tsx`.
- [x] **Tarea 2.2:** Implementar navegación por pestañas en la vista de Ingesta. Aplicar control de acceso para ocultar la pestaña "Plantillas" si el rol de usuario es `archivist`.
- [x] **Tarea 2.3:** Integrar lógica previa de plantillas en la nueva pestaña "Plantillas".
- [x] **Tarea 2.4:** Desarrollar la pestaña "Subir Lote". Implementar validación estricta para seleccionar una plantilla antes de habilitar la subida. Asegurar que la subida (a R2 o similar) no congele la UI.
- [x] **Tarea 2.5:** Añadir tabla de "Lotes Recientes" en la pestaña de Subir Lote.
- [x] **Tarea 2.6:** Desarrollar la pestaña "Dudosos". Mostrar tabla de folios en estado `revision` con un botón "Corregir" apuntando a `/[subdomain]/visor?folio_id=XXX`.

## Fase 3: Visor Dual y Cola Global
- [x] **Tarea 3.1:** Actualizar `/[subdomain]/visor/page.tsx` para soportar dos modos: si hay `?folio_id`, cargar folio específico; si no hay, invocar a la función `get_next_folio` (modo Cola Global).
- [x] **Tarea 3.2:** Implementar vista de estado vacío "¡Trabajo al día!" en caso de que la cola de folios esté vacía, e incluir botón de regreso al Dashboard.
- [x] **Tarea 3.3:** Modificar lógica de guardado en el visor. Permitir guardar con campos vacíos. Tras guardar en modo Cola Global, marcar folio como `completed` e invocar el siguiente automáticamente.
- [x] **Tarea 3.4:** Implementar atajos de teclado globales. Registrar listeners para `Ctrl + Enter` (Guardar) y `Ctrl + Espacio` (Marcar como dudoso, estado `revision`). Evitar conflictos de focus con los inputs.
