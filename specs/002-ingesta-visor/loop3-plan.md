# Plan: Loop 3 - Parche RLS de Templates y Batches

1. **Creación de migración SQL:**
   - Crear un nuevo archivo de migración `supabase/migrations/013_fix_rls.sql`.
   - En esta migración, se hará un `DROP POLICY` de las políticas antiguas (ej. `"Tenant isolation for templates"`, `"Tenant isolation for batches"` o las que hagan referencia a `public.users`).
   - Se crearán las nuevas políticas de aislamiento para las tablas `templates` y `batches` utilizando la función correcta: `tenant_id = public.get_user_tenant()`.

2. **Propósito del Cambio:**
   - Eliminar el error 500 al consultar plantillas desde el frontend.
   - Reflejar la actualización de la arquitectura (uso de `user_profiles` y helper functions).
