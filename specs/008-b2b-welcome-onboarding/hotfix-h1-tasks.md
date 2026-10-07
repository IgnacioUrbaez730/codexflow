# Tareas Hotfix H1 - Flujo de Bienvenida B2B

- [ ] **Base de Datos: Migración de roles**
  - Ejecutar la query SQL en la base de datos de Supabase: `UPDATE public.user_profiles SET role = 'digitizer' WHERE role = 'digitador';`
- [x] **Backend: Actualizar enlaces de invitación**
  - En `backend/main.py`, buscar `invite_user_by_email` en `create_tenant`, `resend_tenant_invite` y `/api/users/invite`.
  - Añadir/modificar el argumento `options={"redirect_to": "https://codexflow-frontend.vercel.app/welcome"}`.
- [x] **Backend: Ajustar `/api/auth/me` y rol digitizer**
  - En `backend/main.py`, reemplazar `"digitador"` por `"digitizer"`.
  - Asegurar que la respuesta incluye `has_completed_onboarding`.
- [x] **Backend: Prevenir doble onboarding**
  - En `POST /api/auth/complete-onboarding`, añadir validación: si el perfil del usuario ya tiene `has_completed_onboarding = True`, retornar HTTP 409.
- [x] **Frontend: Reescritura de `welcome/page.tsx` (UTF-8)**
  - Reemplazar el archivo corrupto.
  - Eliminar los `useEffect` que hacen redirecciones automáticas.
  - Implementar parseo manual de `window.location.hash`.
  - Diferenciar errores de red (mostrando error de conectividad) de token expirado.
  - Antes de establecer una sesión, ejecutar `supabase.auth.signOut()` para sobrescribir sesiones previas (ej. de superadmin).
  - Llamar `supabase.auth.setSession` y luego limpiar la URL con `history.replaceState`.
  - Validar que el hash incluye `type=invite` (si proviene de hash) o mostrar error.
- [x] **Frontend: Manejo de estados de la API en `/welcome`**
  - Llamar a `/api/auth/me` con la sesión establecida.
  - Manejar respuestas 403, pending, rejected: mostrar error y bloquear formulario.
  - Si `has_completed_onboarding` es `true`, cambiar la UI para mostrar "Cuenta ya configurada" y un botón "Ir a mi Dashboard".
  - En el `handleSubmit`, tras el éxito del 2xx, hacer `router.push('/' + encodeURIComponent(tenant_name) + '/dashboard')`.

