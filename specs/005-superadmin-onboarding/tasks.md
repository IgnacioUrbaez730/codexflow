# Tareas: 005-superadmin-onboarding

- [x] **T1. Configurar rol y esquema Base de Datos:**
  - Modificar el ENUM de roles para incluir `superadmin`.
  - Crear la tabla `tenants` (id, name, created_at).
  - Crear la tabla `tenant_quotas` (tenant_id, weekly_limit, current_usage, updated_at).
  - Asegurar que `user_profiles` soporte `tenant_id` referenciando a `tenants`.

- [x] **T2. Implementar Políticas RLS Extendidas:**
  - Crear o ajustar las políticas de Row Level Security (RLS) en `tenants`, `tenant_quotas` y `user_profiles` para que los usuarios con rol `superadmin` tengan permisos totales (`ALL`) de lectura y escritura.

- [x] **T3. Implementar Mecanismo de Bootstrapping (Trigger/Backend):**
  - Desarrollar la lógica (mediante Trigger en DB o en el proceso de creación de usuario/webhook de Auth) que cuente los registros en `user_profiles`. Si el resultado es `0`, forzar la asignación del rol `superadmin` al usuario que se está creando.

- [x] **T4. Backend: Implementar Middleware Superadmin:**
  - Crear un middleware/guardia en el backend para las rutas `/api/superadmin/*` que valide el token de sesión y confirme explícitamente que el rol del usuario emisor es `superadmin`.

- [ ] **T5. Backend: Crear Endpoint GET de Tenants:**
  - Implementar `GET /api/superadmin/tenants` para listar todas las organizaciones junto con sus cuotas y consumos actuales (JOIN `tenants` y `tenant_quotas`).

- [ ] **T6. Backend: Crear Endpoint PUT de Cuotas:**
  - Implementar `PUT /api/superadmin/tenants/:id/quota` para que el Superadmin pueda actualizar el `weekly_limit` de un tenant específico.

- [ ] **T7. Backend: Crear Endpoint POST de Concierge Onboarding:**
  - Implementar `POST /api/superadmin/tenants` recibiendo nombre, límite de cuota y email.
  - Implementar la transacción para insertar en `tenants` y `tenant_quotas`.
  - Integrar la API de administración de usuarios (Supabase Auth Admin) para crear al usuario/enviar invitación o Magic Link, asignándole el nuevo `tenant_id` y el rol `admin`.

- [ ] **T8. Frontend: Proteger Rutas del Panel de Control:**
  - Configurar las rutas bajo `/superadmin` implementando una validación del rol en el estado de autenticación (redirección a inicio/login si no es superadmin).

- [ ] **T9. Frontend: Crear Vista de Dashboard Global:**
  - Desarrollar la tabla de visualización consumiendo `GET /api/superadmin/tenants`.
  - Añadir la capacidad de abrir un diálogo/modal para editar la cuota (llamando a `PUT /api/superadmin/tenants/:id/quota`).

- [ ] **T10. Frontend: Crear Vista de Onboarding de Cliente:**
  - Construir el formulario para "Concierge Onboarding" pidiendo: Nombre, Cuota y Email.
  - Conectar el formulario al endpoint `POST /api/superadmin/tenants`. Mostrar notificaciones de éxito o error al usuario.
