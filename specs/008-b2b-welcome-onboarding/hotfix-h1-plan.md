# Plan Hotfix H1 - Flujo de Bienvenida B2B

## 1. Backend (`backend/main.py`)
- Modificar `create_tenant`, `resend_tenant_invite` y `/api/users/invite` para enviar el parámetro `redirect_to = "https://codexflow-frontend.vercel.app/welcome"`.
- Modificar el endpoint `GET /api/auth/me`:
  - Cambiar el string `"digitador"` por `"digitizer"` en la lista de roles permitidos.
  - Asegurar que retorne `tenant_name` y `has_completed_onboarding`.
- Modificar el endpoint `POST /api/auth/complete-onboarding`:
  - Verificar si el usuario ya tiene `has_completed_onboarding == True` en la base de datos. Si es así, devolver un error `HTTP 409 Conflict`.

## 2. Frontend (`frontend/src/app/welcome/page.tsx`)
- **Corregir Corrupción y Reescribir:** Reescribir el archivo en UTF-8 puro, eliminando los errores de template literals rotos (`\Bearer \\` y `\/\/dashboard\`).
- **Cero Redirecciones Automáticas:** Remover cualquier uso de `router.push`, `router.replace` o `redirect()` durante la carga de la página o el manejo de errores. La página debe ser estática en cuanto a ruteo.
- **Manejo Manual de Sesión:**
  - Leer `window.location.hash` al montar.
  - Si no tiene `type=invite` pero tiene tokens, o si tiene errores (`error_code=otp_expired`), bloquear y mostrar el mensaje de error correspondiente.
  - Extraer `access_token` y `refresh_token`. Si existen, cerrar cualquier sesión previa haciendo `supabase.auth.signOut()` antes de llamar a `supabase.auth.setSession()` para sobrescribir la sesión con la del invitado.
  - Limpiar la URL con `window.history.replaceState`.
- **Llamadas a la API y Renderizado de Estados:**
  - Usar la sesión establecida para llamar a `/api/auth/me` con rutas relativas (`fetch('/api/auth/me')`).
  - Diferenciar los errores de red (ej. de conectividad) de los errores lógicos (tokens expirados).
  - Si la respuesta es 403, pending, rejected, o falta `tenant_name`, mostrar un error exacto y bloquear el formulario.
  - Si el usuario ya completó el onboarding (`has_completed_onboarding === true`), mostrar el aviso "Cuenta ya configurada" y el botón manual "Ir a mi Dashboard" (que navegue a `/${encodeURIComponent(tenant_name)}/dashboard`).
  - En caso de éxito de `complete-onboarding`, navegar usando `encodeURIComponent(tenant_name)`.

## 3. Base de Datos (SQL)
- Ejecutar el siguiente script en Supabase para unificar roles:
  `UPDATE public.user_profiles SET role = 'digitizer' WHERE role = 'digitador';`
