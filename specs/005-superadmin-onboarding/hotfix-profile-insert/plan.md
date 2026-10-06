# Plan Técnico: Rediseño de Flujo de Auto-reparación y Perfiles Huérfanos (Post-QA)

Este plan técnico detalla la implementación de los cambios arquitectónicos acordados para gestionar la creación automática de perfiles y la auto-reparación (self-healing) del rol de superadmin, en estricto cumplimiento de la constitution.md (Aislamiento y Spec manda).

## 1. Base de Datos
- **Rol 'pending'**: Se añadirá el rol `'pending'` al ENUM correspondiente en la base de datos para manejar el estado inicial de usuarios sin asignar.
- **Trigger de Creación**: Se implementará un trigger en PostgreSQL que observe la tabla `auth.users`. Al detectar una inserción de un nuevo usuario, el trigger automáticamente insertará un registro en `user_profiles` con rol `'pending'` y `tenant_id` en `null`.
- **Script Retroactivo**: Se desarrollará un script de migración que buscará a todos los usuarios existentes en `auth.users` que actualmente no posean un perfil asociado en `user_profiles` y les creará dicho perfil asumiendo los mismos valores por defecto (rol `pending`, `tenant_id` null).

## 2. Backend (Python)
- **Endpoint `/api/auth/me`**: El antiguo endpoint `/api/auth/self-heal` será completamente reemplazado por `/api/auth/me`.
- **Lógica de Evaluación**:
  - Al recibir una petición, este endpoint evaluará el rol del perfil del usuario logueado.
  - Si el rol es `'pending'`, verificará si el email del usuario coincide con el correo preestablecido del superadmin.
  - Si el email coincide, actualizará *silenciosamente* el registro en `user_profiles` asignándole el rol `'superadmin'`. Inmediatamente retornará: `{ "role": "superadmin", "redirect_url": "/superadmin" }`.
  - Si el email *no* coincide con el superadmin, conservará el estado y retornará: `{ "role": "pending", "redirect_url": "/pending" }`.
  - Para cualquier otro rol ya establecido (no `pending`), simplemente devolverá la URL de redirección correspondiente a su rol.

## 3. Frontend (React)
- **Enrutamiento Centralizado**: Los flujos de autenticación en `login/page.tsx` y `register/page.tsx` serán refactorizados.
- **Lógica Post-Login**: Ambas páginas dependerán exclusivamente de la respuesta proporcionada por el backend en `/api/auth/me` para efectuar el enrutamiento y la redirección post-login. Esto simplificará la lógica frontend de los componentes y evitará enrutamientos inseguros locales.
