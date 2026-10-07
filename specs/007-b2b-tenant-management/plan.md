# Plan Técnico: Gestión B2B de Organizaciones (Superadmin)

Este plan técnico detalla los pasos necesarios para implementar la Especificación 007, respetando el Aislamiento Multi-Tenant Absoluto definido en la Constitución.

## 1. Base de Datos
- Crear una migración SQL para modificar la tabla `tenants`:
  - Añadir columnas: `country` (TEXT), `contact_name` (TEXT), `tax_id` (TEXT), `phone` (TEXT).
  - Añadir columna de estado: `is_active` (BOOLEAN DEFAULT TRUE).

## 2. Backend
- **Endpoint POST `/api/superadmin/tenants`:**
  - Actualizar el modelo de datos/payload esperado para incluir `country`, `contact_name`, `tax_id`, y `phone`.
  - Añadir validación de duplicados antes de crear: verificar si el correo del administrador ingresado ya pertenece a un usuario activo en el sistema (en OTRA organización). Si es así, retornar error bloqueante.
  - Almacenar los nuevos campos en la tabla `tenants`.
- **Endpoint POST `/api/superadmin/tenants/{id}/resend-invite`:**
  - Crear un nuevo endpoint que permita al superadmin reenviar la invitación.
  - Invocar internamente a Supabase Auth (`invite_user_by_email`) para generar y enviar el "Magic Link" nuevamente.
- **Endpoint PATCH `/api/superadmin/tenants/{id}/status`:**
  - Crear un nuevo endpoint para alternar el estado lógico de la organización (`is_active` = true/false).
- **Ajustes de Impersonation (Dashboard):**
  - Modificar los endpoints de consulta de métricas y datos del dashboard.
  - Lógica: Si el rol del usuario que hace la petición es `superadmin`, omitir la restricción estricta de su propio tenant y permitir que pase el `tenant_id` de la organización a consultar.

## 3. Frontend
- **Vista del Formulario Expandido (`frontend/src/app/superadmin/tenants/new/page.tsx`):**
  - Construir la interfaz de creación de nueva ONG.
  - Campos a incluir: Nombre de la ONG, Límite Semanal de Folios, Correo del Administrador, País, Nombre completo del contacto, RIF/NIT, Teléfono.
  - Conectar el formulario con el backend actualizado. Mostrar correctamente los errores bloqueantes.
- **Actualización de la Tabla (`frontend/src/app/superadmin/page.tsx`):**
  - Añadir columna de "Estado".
  - Añadir acciones por fila: Reenviar Invitación, Desactivar/Activar, Ver Dashboard.
