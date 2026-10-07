# Planificación Técnica: Flujo de Bienvenida y Contraseña (B2B)

## 1. Base de Datos
- **Migración SQL (`010_user_onboarding.sql`)**: 
  - Añadir a la tabla `user_profiles` las siguientes columnas:
    - `first_name` (TEXT)
    - `last_name` (TEXT)
    - `job_title` (TEXT)
    - `has_completed_onboarding` (BOOLEAN DEFAULT FALSE)

## 2. Backend
- **a) Modificar endpoint `GET /api/auth/me`**:
  - Consultar el campo `has_completed_onboarding` en la base de datos.
  - Si es falso (o nulo) y el rol **NO** es `superadmin`, devolver `redirect_url: "/welcome"`.
  - Incluir el `tenant_name` en la respuesta (si aplica) para que el frontend pueda utilizarlo.
- **b) Crear endpoint `POST /api/auth/complete-onboarding`**:
  - Debe recibir 4 campos (`first_name`, `last_name`, `job_title`, `password`).
  - Realizar un `UPDATE` en `user_profiles` guardando los nombres y marcando `has_completed_onboarding = True`.
  - Utilizar **Supabase Auth Admin API** (`update_user_by_id`) para establecer la contraseña (`password`) del `user_id`.
  - Si la actualización en Supabase falla, **revertir** el `UPDATE` en `user_profiles` (volver a `has_completed_onboarding = False`) y devolver error 500.

## 3. Frontend
- **a) Crear vista `frontend/src/app/welcome/page.tsx`**:
  - Configurar como Client Component (`"use client"`).
  - Título dinámico: "Bienvenido a [Nombre ONG]" (usando datos del context/store del tenant).
  - Incluir campos de texto: Nombre, Apellido, Cargo, Contraseña, y Confirmar Contraseña.
- **b) Validación en el formulario**:
  - "Confirmar Contraseña" debe coincidir con la "Contraseña".
  - Longitud mínima de la contraseña: 6 caracteres.
- **c) Integración**:
  - Realizar `fetch` (POST) al nuevo endpoint `/api/auth/complete-onboarding`.
  - En caso de éxito, redirigir: `router.push('/[tenant_name]/dashboard')`.
