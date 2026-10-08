# Plan Arquitectónico - Loop 1 (Hub de Ingesta y Cola Global)

## 1. Cambios en Base de Datos y Backend (Supabase / FastAPI)
- **Extensión de Estados:** El estado de un `folio` debe contemplar `pending`, `in_progress`, `revision` y `completed`.
- **Bloqueos de Concurrencia:** Añadir una columna `locked_at` en la tabla `folios`.
- **Lógica de Cola Global:**
  - Crear un endpoint (FastAPI) o función RPC (Supabase) llamado `get_next_folio`.
  - Debe buscar el folio más antiguo (FIFO) con estado `pending`.
  - En la misma transacción, actualizar su estado a `in_progress` y fijar `locked_at = NOW()`.
- **Liberación de Bloqueos (Timeout):** Implementar un cron job o tarea en background que reinicie a `pending` los folios con estado `in_progress` cuyo `locked_at` sea mayor a 15 minutos.
- **Seguridad RLS para Bandeja de Dudosos:**
  - Si un usuario accede a un folio específico con `status = 'revision'` a través de `?folio_id=XXX`, aplicar políticas RLS estrictas.
  - El Admin puede ver todos los lotes.
  - El Archivista solo puede ver folios cuyo lote haya sido subido por él (`uploaded_by = auth.uid()`).

## 2. Refactor del Frontend (Next.js) - Hub de Ingesta
- **Mudar Rutas:** Eliminar las vistas sueltas `/upload` y `/templates`.
- **Crear `/[subdomain]/ingest/page.tsx`:** Implementar un Layout con Tabs (Pestañas).
  - **Pestaña 1: Subir Lote:** Formulario de subida. Debe requerir validación de plantilla seleccionada antes de permitir la subida. Mostrar un componente de tabla `Lotes Recientes`. La subida debe ser asíncrona sin bloquear o congelar la UI.
  - **Pestaña 2: Dudosos:** Mostrar una tabla simple filtrando folios con estado `revision` accesibles para el usuario actual. Cada fila tendrá un botón "Corregir" enlazando a `/[subdomain]/visor?folio_id=XXX`.
  - **Pestaña 3: Plantillas:** Gestión de plantillas existentes. **Lógica condicional:** Esta pestaña no se renderiza si el rol del usuario actual es `archivist`.

## 3. Refactor del Frontend (Next.js) - Visor Dual Ergonómico
- **Cola Global Automática:** Modificar `/[subdomain]/visor/page.tsx` para que si no recibe el parámetro `folio_id`, haga un fetch automático a `get_next_folio`.
- **Empty State:** Si la cola devuelve nulo o vacío, renderizar una vista amigable con el texto "¡Trabajo al día!" y un botón de retorno al Dashboard.
- **Atajos de Teclado Globales:**
  - `Ctrl + Enter` (Guardar): Dispara la mutación de guardado. Se debe permitir el guardado aunque los campos estén vacíos. Si está en la Cola Global, carga el siguiente folio.
  - `Ctrl + Espacio` (Dudoso): Dispara mutación para cambiar estado a `revision` y avanza.
- **Validación de Parámetros:** Si se incluye `?folio_id=XXX`, el visor asume modo "Corrección de Dudosos" y carga ese folio específico en lugar de sacar uno nuevo de la cola.
