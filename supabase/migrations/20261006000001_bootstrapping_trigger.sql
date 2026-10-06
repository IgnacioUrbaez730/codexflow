-- Migration: Bootstrapping Trigger (T3)
-- This trigger executes AFTER INSERT ON auth.users.
-- If user_profiles is empty, it assigns the 'superadmin' role to the first user created,
-- with tenant_id set to NULL.

CREATE OR REPLACE FUNCTION public.handle_new_user_bootstrapping()
RETURNS TRIGGER AS $$
DECLARE
  profile_count INT;
BEGIN
  -- Count existing profiles
  SELECT COUNT(*) INTO profile_count FROM public.user_profiles;
  
  -- If this is the very first user, make them a superadmin
  IF profile_count = 0 THEN
    INSERT INTO public.user_profiles (user_id, role, tenant_id)
    VALUES (NEW.id, 'superadmin'::public.user_role, NULL);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_bootstrapping ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrapping
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_bootstrapping();
