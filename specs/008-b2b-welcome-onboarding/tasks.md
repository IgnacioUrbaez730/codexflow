# Tareas: Flujo de Bienvenida y Contraseña (B2B)

- [x] **1. Base de Datos**
  - [x] Crear el archivo de migración `010_user_onboarding.sql`.
  - [x] Añadir las columnas `first_name`, `last_name`, `job_title` (TEXT) y `has_completed_onboarding` (BOOLEAN DEFAULT FALSE) a la tabla `user_profiles`.

- [x] **2. Backend**
  - [x] **Modificar `GET /api/auth/me`**:
    - [x] Consultar el campo `has_completed_onboarding`.
    - [x] Implementar lógica: Si `has_completed_onboarding` es falso/nulo y el rol no es `superadmin`, devolver `redirect_url: "/welcome"`.
    - [x] Incluir `tenant_name` en la respuesta de la API.
  - [x] **Crear `POST /api/auth/complete-onboarding`**:
    - [x] Recibir y validar los parámetros del body (`first_name`, `last_name`, `job_title`, `password`).
    - [x] Realizar el `UPDATE` en `user_profiles` (nombres y `has_completed_onboarding=True`).
    - [x] Llamar a Supabase Auth Admin API (`update_user_by_id`) para cambiar la contraseña.
    - [x] Manejo de errores: revertir `has_completed_onboarding=False` en DB si Supabase Auth falla y lanzar error 500.

- [x] **3. Frontend**
  - [x] **Crear `frontend/src/app/welcome/page.tsx`**:
    - [x] Definir como Client Component.
    - [x] Implementar título dinámico "Bienvenido a [Nombre ONG]".
    - [x] Crear inputs para Nombre, Apellido, Cargo, Contraseña y Confirmar Contraseña.
  - [x] **Validaciones de Front**:
    - [x] Validar longitud mínima de contraseña (6 caracteres).
    - [x] Validar que contraseña y confirmación coincidan.
  - [x] **Integración de API**:
    - [x] Hacer `fetch` al endpoint de `/api/auth/complete-onboarding`.
    - [x] Implementar redirección `router.push('/[tenant_name]/dashboard')` tras el éxito de la petición.
