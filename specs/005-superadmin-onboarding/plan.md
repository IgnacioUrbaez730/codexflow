# Plan Técnico: 005-superadmin-onboarding

## 1. Modificación de la Base de Datos (PostgreSQL/Supabase)

### 1.1 Modificación de ENUM y Roles
- **Roles:** Actualizar el ENUM de roles (ej. `user_role`) para agregar el valor `superadmin`.
- **Bootstrapping:** Implementar un mecanismo en el momento de creación del usuario (por ejemplo, un Trigger en Supabase sobre `auth.users` que inserte en `public.user_profiles` o la lógica equivalente en el backend/webhook). Si el conteo en `user_profiles` es `0` antes de la inserción, el rol asignado será `superadmin`. En caso contrario, el rol dependerá del flujo normal.

### 1.2 Nuevas Tablas (Recurso Tenants)
- **Tabla `tenants`:** 
  - Columnas: `id` (UUID, PK), `name` (String), `created_at` (Timestamp).
- **Tabla `tenant_quotas`:**
  - Columnas: `tenant_id` (UUID, FK a tenants, PK), `weekly_limit` (Int), `current_usage` (Int), `updated_at` (Timestamp).
- Relación: Un `tenant` tiene un `tenant_quotas`. Los `user_profiles` deben tener una columna `tenant_id` (FK) anulable (o no atada obligatoriamente para superadmins).

### 1.3 Seguridad RLS (Row Level Security)
- Actualizar o crear políticas en todas las tablas (`tenants`, `tenant_quotas`, `user_profiles`, etc.) para permitir lectura y escritura (`ALL`) a usuarios cuyo rol comprobado mediante una función (ej. `auth.jwt() ->> 'role'` o mediante tabla cruzada) sea `superadmin`.
- Si las consultas de superadmin se realizan desde un backend de confianza (API), usar la clave `service_role` pero **solo tras validar rigurosamente** que el token JWT (Bearer) del llamante corresponde a un `superadmin`.

## 2. Endpoints Backend (Concierge Onboarding)

### 2.1 Middleware de Autorización
- Implementar middleware en el backend que intercepte peticiones a `/api/superadmin/*`, valide el JWT y confirme que el rol en el perfil de usuario asociado es `superadmin`.

### 2.2 Endpoints a crear
- **POST `/api/superadmin/tenants` (Concierge Onboarding):**
  - **Payload:** `organizationName`, `weeklyLimit`, `adminEmail`.
  - **Flujo:**
    1. Iniciar transacción en DB.
    2. Insertar nuevo registro en `tenants`.
    3. Insertar nuevo registro en `tenant_quotas` con el límite inicial.
    4. Usar la API de administración de Supabase Auth (con service role) para invitar/crear un usuario con el `adminEmail`. Configurar en la base de datos o en la metadata el `tenant_id` recién creado y el rol `admin`.
    5. Se enviará el *Magic Link* o email de invitación estándar al correo proporcionado.
- **GET `/api/superadmin/tenants`:**
  - Devuelve una lista combinada de `tenants` con su información de `tenant_quotas` (consumo y límites).
- **PUT `/api/superadmin/tenants/:id/quota`:**
  - Actualiza el campo `weekly_limit` en `tenant_quotas` para un tenant específico.

## 3. Frontend (Rutas y Vistas)

### 3.1 Rutas Protegidas
- Crear un layout dedicado en `/superadmin`.
- Implementar un *Guard/Middleware* de ruta en el router del cliente (ej. React Router/Next.js middleware). Si el rol extraído del contexto/estado de autenticación no es `superadmin`, redirigir al login o a la raíz.

### 3.2 Vistas a crear
- **Dashboard Global (`/superadmin`):**
  - Tabla de datos que liste las ONGs (Tenants) obteniendo datos del endpoint GET mencionado.
  - Columnas: Nombre, Cuota Asignada, Cuota Consumida, Fecha de Alta.
  - Acciones: Botón para "Editar Cuota" que abre un modal con el endpoint PUT.
- **Formulario de Alta (`/superadmin/onboarding` o en un Modal):**
  - Formulario con campos: Nombre de Organización, Cuota Inicial, Email del Administrador.
  - Al enviar, llama al POST `/api/superadmin/tenants` y muestra un mensaje de éxito indicando que la invitación fue enviada.
