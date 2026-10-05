# Tareas de Implementación: Dashboard, Roles y Exportación (Spec 004)

- [x] **T1: Migración de BD - Autenticación y RBAC**
  - Crear tabla `user_profiles` (`user_id`, `tenant_id`, `role` [enum: admin, archivist, digitizer]).
  - Crear o actualizar políticas de Seguridad a Nivel de Fila (RLS) en `folios` y `batches` usando el rol del usuario.

- [x] **T2: Migración de BD - Exportación y Cuotas**
  - Crear tabla `api_keys` (`tenant_id` UNIQUE, `hashed_key`).
  - Crear tabla o columnas para `tenant_quotas` (estado de suscripción/cuota).
  - Añadir índices de rendimiento en `folios(tenant_id, verified_at)` y `folios(batch_id)`.

- [x] **T3: Backend - API de Gestión de Usuarios y Roles**
  - Crear endpoint de invitación de usuario (`POST /api/users/invite`) usando Supabase Auth (Magic Links).
  - Sincronizar inserción en `user_profiles` al aceptar invitación/crear el usuario.

- [x] **T4: Backend - API Key Management**
  - Crear endpoint (`POST /api/v1/keys/regenerate`) para revocar y crear un nuevo hash API Key mediante UPSERT.

- [x] **T5: Backend - API de Exportación (`GET /api/v1/export`)**
  - Implementar middleware de autenticación de la API Key.
  - Implementar validación financiera (Si Freemium está agotado, devolver HTTP 402).
  - Implementar consulta de folios limitando el retorno por defecto a los últimos 30 días (`verified_at`).

- [x] **T6: Backend/Frontend - Exportación CSV Dinámica**
  - Desarrollar la lógica de exportación que construya las columnas dinámicamente según la plantilla del tenant al día actual.

- [x] **T7: Frontend - Gestión de Accesos UI**
  - Implementar layout protegido con redirecciones por Rol (ej. los Digitadores solo van al Visor Dual).
  - Actualizar UI de Bandeja de Dudosos: el Archivista solo hace fetch de sus lotes; la vista de Admin incluye la columna "Archivista Responsable".

- [x] **T8: Frontend - Panel de Usuarios e Invitación**
  - Pantalla para listar los miembros del tenant.
  - Botón de invitar nuevo empleado con modal para ingresar email y seleccionar su rol.

- [x] **T9: Frontend - Configuración de Exportación (API y CSV)**
  - Pantalla para que el Admin obtenga y regenere su API Key.
  - Botón para disparar la descarga estática CSV de los últimos datos.

- [ ] **T10: Frontend - Dashboard, Gráficas y Soft Paywall**
  - Desarrollar query/fetch optimizado y el componente de la gráfica de línea de tendencia (productividad de folios procesados en el tiempo).
  - Desarrollar métricas de embudo (subidos vs verificados).
  - Implementar banner de "Procesamiento Congelado" si la cuota Freemium expiró, permitiendo que las gráficas históricas se sigan renderizando bajo la alerta.
