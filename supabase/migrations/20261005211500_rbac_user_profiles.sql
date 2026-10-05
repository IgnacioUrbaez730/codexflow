-- Create ENUM for roles
CREATE TYPE user_role AS ENUM ('admin', 'archivist', 'digitizer');

-- Create user_profiles table
CREATE TABLE user_profiles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  tenant_id UUID NOT NULL,
  role user_role NOT NULL
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS user_role AS $$
  SELECT role FROM public.user_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant() RETURNS UUID AS $$
  SELECT tenant_id FROM public.user_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on folios and batches if not already enabled
-- ALTER TABLE folios ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- RLS for folios
CREATE POLICY folios_admin_policy ON public.folios
  FOR ALL
  USING (get_user_role() = 'admin' AND tenant_id = get_user_tenant());

CREATE POLICY folios_digitizer_select_policy ON public.folios
  FOR SELECT
  USING (
    get_user_role() = 'digitizer' 
    AND tenant_id = get_user_tenant() 
    AND (assigned_to = auth.uid() OR status = 'pending')
  );

CREATE POLICY folios_archivist_select_policy ON public.folios
  FOR SELECT
  USING (
    get_user_role() = 'archivist' 
    AND tenant_id = get_user_tenant() 
    AND status = 'doubtful' 
    AND uploaded_by = auth.uid()
  );

-- RLS for batches
CREATE POLICY batches_admin_policy ON public.batches
  FOR ALL
  USING (get_user_role() = 'admin' AND tenant_id = get_user_tenant());

CREATE POLICY batches_archivist_insert_policy ON public.batches
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'archivist' 
    AND tenant_id = get_user_tenant() 
    AND uploaded_by = auth.uid()
  );

CREATE POLICY batches_archivist_select_policy ON public.batches
  FOR SELECT
  USING (
    get_user_role() = 'archivist' 
    AND tenant_id = get_user_tenant() 
    AND uploaded_by = auth.uid()
  );
