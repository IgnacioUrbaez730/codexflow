# Plan Técnico - Loop 2: Jerarquías, Personal y Fix de Subdominio

## 1. Backend (Python / FastAPI / Supabase)

### 1.1 Fix de Subdominio y Auth (`/api/auth/me`)
- Modificar el endpoint para que realice un JOIN con la tabla de `tenants` y devuelva el `tenant_name` correcto junto a la información del usuario tras el login.
- Validar y asegurar que todas las consultas a la base de datos y políticas de RLS usen estrictamente el `tenant_id` contenido en el JWT (contexto de Supabase), **nunca** de un parámetro en la URL.

### 1.2 Endpoints de Gestión de Equipo (`/api/v1/team`)
- **GET `/api/v1/team`**: 
  - Consultar usuarios del `tenant_id` actual.
  - Retornar: Nombre, Email, Rol, Estado (Activo/Inactivo).
  - Incluir cálculo (subquery o join) de "Folios Procesados Hoy" basado en los logs de auditoría o tabla de folios.
- **POST `/api/v1/team/invite`**:
  - Validar si el usuario ya existe. Si existe pero está inactivo, lanzar un error 400: `"Usuario ya existe, reactívelo manualmente"`.
  - Crear invitación utilizando Supabase Auth Admin.
- **PATCH `/api/v1/team/{user_id}`**:
  - Restricciones de seguridad a implementar:
    - El usuario autenticado (Admin) no puede cambiar su propio rol o estado.
    - No permitir degradar de rol ni desactivar al usuario si es el **último Admin activo** del tenant.

### 1.3 Lazy Expulsion (Expulsión Perezosa)
- En los endpoints del visor (`GET /next-folio`, `POST /save-folio`):
  - Verificar que el usuario tenga estado 'Activo'.
  - Si está inactivo, retornar error HTTP 403 (Forbidden) para que el frontend fuerce la salida o notifique al usuario y bloquee la acción.

## 2. Frontend (Next.js)

### 2.1 Fix de Redirecciones (Subdominio "undefined")
- Actualizar el hook/contexto de autenticación para consumir y guardar el `tenant_name` retornado por `/api/auth/me`.
- Actualizar la lógica de ruteo post-login para asegurar que la URL se forme como `/{tenant_name}/...` y evitar el bug de "undefined".

### 2.2 Layout y Navegación Dinámica (Sidebar)
- Modificar el layout principal para renderizar el Sidebar basado en el rol:
  - **Admin**: Ver Dashboard, Ingesta/Dudosos, Equipo, Visor de Indexación. Redirección por defecto post-login: Dashboard.
  - **Archivista**: Ver Ingesta/Dudosos, Visor de Indexación.
  - **Indexador (Digitizer)**: Layout limpio sin Sidebar (o Sidebar completamente oculto). Redirección directa al Visor.

### 2.3 Visor de Indexación (Global Queue)
- Asegurar que el componente del Visor no tenga distinciones de cola por rol a la hora de pedir folios (Admins y Archivistas consumen la misma cola global automática que los Digitizers).

### 2.4 Tabla de Equipo (`/settings/users/page.tsx` o equivalente)
- Reemplazar el formulario aislado por una tabla de datos interactiva.
- **Componentes UI a agregar**:
  - Barra de búsqueda por texto.
  - Filtro tipo Dropdown por Estado (Activos/Inactivos).
  - Tabla con columnas: Nombre, Email, Rol, Folios Procesados Hoy, y Estado.
  - Menús contextuales en las filas para Editar Rol y Desactivar/Reactivar.
  - Botón principal para "Invitar Usuario" que abra un modal.
- Integración de manejo de errores específicos enviados por el backend (ej. "Usuario ya existe...").
