DROP TRIGGER IF EXISTS trigger_assign_first_user_admin ON auth.users CASCADE;
DROP TRIGGER IF EXISTS trigger_assign_first_user_admin ON public.user_profiles CASCADE;

DROP FUNCTION IF EXISTS assign_first_user_admin() CASCADE;
DROP FUNCTION IF EXISTS public.assign_first_user_admin() CASCADE;
