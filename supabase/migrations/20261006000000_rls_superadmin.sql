-- Función helper para verificar superadmin sin causar recursividad infinita en RLS
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_tenants" ON public.tenants;
CREATE POLICY "superadmin_all_tenants" ON public.tenants
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- tenant_quotas
ALTER TABLE public.tenant_quotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_tenant_quotas" ON public.tenant_quotas;
CREATE POLICY "superadmin_all_tenant_quotas" ON public.tenant_quotas
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_user_profiles" ON public.user_profiles;
CREATE POLICY "superadmin_all_user_profiles" ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- folios
ALTER TABLE public.folios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_folios" ON public.folios;
CREATE POLICY "superadmin_all_folios" ON public.folios
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- batches
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_all_batches" ON public.batches;
CREATE POLICY "superadmin_all_batches" ON public.batches
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
