# Tareas: Gestión B2B de Organizaciones (Superadmin)

## 1. Base de Datos
- [x] Crear migración SQL para añadir a la tabla `tenants` las columnas `country`, `contact_name`, `tax_id`, `phone` (tipo TEXT).
- [x] Incluir en la migración la columna `is_active` (BOOLEAN DEFAULT TRUE) en `tenants`.

## 2. Backend
- [x] Actualizar el payload y lógica del endpoint `POST /api/superadmin/tenants` para recibir y guardar los nuevos campos.
- [x] Implementar validación en `POST /api/superadmin/tenants` para abortar la transacción si el correo ya existe en otra ONG.
- [x] Crear endpoint `POST /api/superadmin/tenants/{id}/resend-invite` y cablearlo con la función de invitación de Supabase.
- [x] Crear endpoint `PATCH /api/superadmin/tenants/{id}/status` para actualizar la columna `is_active`.
- [x] Modificar los endpoints del dashboard para permitir que un `superadmin` consulte métricas de cualquier `tenant_id`.

## 3. Frontend
- [x] Crear el componente/vista en `frontend/src/app/superadmin/tenants/new/page.tsx` con todos los campos de datos básicos y de facturación.
- [x] Conectar el formulario de creación con el endpoint actualizado, manejando errores de duplicidad.
- [x] Actualizar la tabla principal en `frontend/src/app/superadmin/page.tsx` para mostrar la columna de Estado.
- [x] Añadir a la tabla el botón "Reenviar Invitación" (visible si aplica).
- [x] Añadir a la tabla el botón "Desactivar" / "Activar" conectado al endpoint de status.
- [x] Añadir a la tabla el botón "Ver Dashboard" para realizar *impersonation* sobre el `tenant_id` seleccionado.
