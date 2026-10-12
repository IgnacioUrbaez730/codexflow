# Tareas de Implementación: Explorador y Editor de Registros (Records Explorer)

---

## Fase 1: Backend & Base de Datos

- [x] **Tarea 1.1:** Diseñar y registrar esquemas Pydantic para el Explorador de Registros en `backend/main.py`.
  - [x] Crear modelo de respuesta para `RecordItem`, `RecordTemplateField`, `RecordsListResponse`.
  - [x] Crear modelo de actualización `UpdateRecordMetadataRequest`.
- [x] **Tarea 1.2:** Implementar endpoint `GET /api/v1/records`.
  - [x] Validar token JWT y extraer `tenant_id` y `role`.
  - [x] Aplicar filtros query: `batch_id`, `search`, `start_date`, `end_date`.
  - [x] Aplicar paginación (`page`, `page_size`).
  - [x] Si `batch_id` está presente, consultar la plantilla asociada al lote y adjuntar `template.fields`.
  - [x] Retornar lista de folios con `view_url` firmada de Supabase Storage.
- [x] **Tarea 1.3:** Implementar endpoint `PATCH /api/v1/records/{folio_id}`.
  - [x] Verificar aislamiento multi-tenant (`tenant_id == auth.tenant_id`).
  - [x] Implementar validación RBAC: `admin` puede editar cualquier folio; `archivist` solo si `batch.uploaded_by == auth.user_id`; denegar a `digitizer` con 403.
  - [x] Validar bloqueo de concurrencia: si el folio está `in_progress` por otro usuario, retornar 409 Conflict.
  - [x] Actualizar `metadata`, `updated_at = NOW()` y `last_modified_by = auth.user_id`.
  - [x] Garantizar que no se descuente saldo de la cuota freemium.
- [x] **Tarea 1.4:** Implementar endpoint `GET /api/v1/records/export`.
  - [x] Filtrar folios coincidentes según parámetros de consulta.
  - [x] Generar respuesta streaming CSV con codificación UTF-8 con BOM.
  - [x] Proyectar columnas de la plantilla si `batch_id` fue provisto.

---

## Fase 2: Navegación y Control de Acceso Frontend

- [x] **Tarea 2.1:** Actualizar `frontend/src/components/Sidebar.tsx`.
  - [x] Incorporar el elemento "Registros" apuntando a `/${subdomain}/records`.
  - [x] Usar ícono representativo (`Database` o `Table2`).
  - [x] Mostrar condicionalmente para roles `admin` y `archivist`. Ocultar para `digitizer`.
- [x] **Tarea 2.2:** Configurar estructura de página en `frontend/src/app/[subdomain]/records/page.tsx`.
  - [x] Resolver `subdomain` asíncronamente utilizando `useParams()` de `next/navigation`.
  - [x] Incorporar guardia de rol: redirigir a `/[subdomain]/workspace` si el usuario es `digitizer`.

---

## Fase 3: Componentes de UI e Interacción

- [x] **Tarea 3.1:** Construir la barra de filtros (`RecordsFilterBar`).
  - [x] Dropdown selector de Lotes (consultando `/api/v1/batches`).
  - [x] Input de búsqueda textual con debounce.
  - [x] Controles de rango de fechas (desde / hasta).
  - [x] Botón "Exportar vista actual" con trigger de descarga CSV.
- [x] **Tarea 3.2:** Construir la tabla interactiva (`RecordsTable`).
  - [x] Proyección dinámica de cabeceras de columnas según la plantilla del lote seleccionado.
  - [x] Cabeceras estándar cuando no hay lote seleccionado.
  - [x] Badges visuales de estado (`completed`, `in_progress`).
  - [x] Controles de paginación anterior/siguiente y selector de tamaño de página (20 / 50).
  - [x] Botón de acción "Ver / Editar" en cada fila.
- [x] **Tarea 3.3:** Construir el modal Split-Screen (`RecordDetailModal`).
  - [x] Panel Izquierdo: Visor de imagen con controles de zoom, arrastre (pan) y rotación de 90°.
  - [x] Panel Derecho: Formulario dinámico con los campos definidos en la plantilla del lote.
  - [x] Validación suave con confirmación visual si hay campos obligatorios sin completar.
  - [x] Acción de guardado conectada a `PATCH /api/v1/records/{folio_id}` con feedback de éxito/error (toast).

---

## Fase 4: Pruebas y Validación E2E

- [ ] **Tarea 4.1:** Probar control de acceso y RBAC.
  - [ ] Verificar que `admin` puede ver y modificar cualquier registro.
  - [ ] Verificar que `archivist` solo puede modificar registros de lotes que él subió.
  - [ ] Verificar que `digitizer` no ve el enlace en el Sidebar ni puede acceder a la ruta.
- [ ] **Tarea 4.2:** Probar concurrencia y validaciones de datos.
  - [ ] Probar intento de guardado de folio en estado `in_progress`.
  - [ ] Probar exportación CSV con y sin filtro de lote seleccionado.
  - [ ] Probar que el guardado no afecte el consumo de créditos.
