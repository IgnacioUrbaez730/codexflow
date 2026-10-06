-- 1. Añadir 'pending' al ENUM de roles (si no existe)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pending';

-- 2. Crear función y trigger para insertar en user_profiles
CREATE OR REPLACE FUNCTION on_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, role, tenant_id)
  VALUES (new.id, 'pending', NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;

CREATE TRIGGER trigger_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION on_auth_user_created();

-- 3. Script retroactivo para los usuarios viejos sin perfil
INSERT INTO public.user_profiles (user_id, role, tenant_id)
SELECT id, 'pending', NULL
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_profiles);
