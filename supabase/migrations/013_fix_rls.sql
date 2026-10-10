-- Drop old policies that reference public.users
DROP POLICY IF EXISTS "Tenant isolation for templates" ON public.templates;
DROP POLICY IF EXISTS "Tenant isolation for batches" ON public.batches;

-- Create new policies using public.get_user_tenant()
-- Ensure archivists and other tenant roles have access to read (SELECT) templates and batches
CREATE POLICY "Tenant isolation for templates" 
ON public.templates 
FOR ALL 
TO authenticated
USING (tenant_id = public.get_user_tenant());

CREATE POLICY "Tenant isolation for batches" 
ON public.batches 
FOR ALL 
TO authenticated
USING (tenant_id = public.get_user_tenant());
