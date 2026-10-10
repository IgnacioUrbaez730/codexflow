# Tareas: Loop 3 - Parche RLS de Templates y Batches

- [x] 1. Crear el archivo `supabase/migrations/013_fix_rls.sql`.
- [x] 2. Escribir el código SQL para eliminar (`DROP POLICY`) las políticas de RLS obsoletas de `templates` y `batches`.
- [x] 3. Escribir el código SQL para crear las nuevas políticas de RLS para `templates` y `batches` utilizando `tenant_id = public.get_user_tenant()`.
- [x] 4. Guardar los cambios. **IMPORTANTE:** El implementador NO debe aplicar `supabase db push` automáticamente, solo crear el archivo SQL.
