-- ========================================================
-- CODEXFLOW UNIFIED DATABASE SCHEMA (BUG-FREE)
-- ========================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'archivist', 'digitizer', 'superadmin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE batch_status AS ENUM ('pending', 'processing', 'ready', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE folio_status AS ENUM ('pending', 'processing', 'revision', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. CORE TABLES
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    role user_role NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tenant_quotas (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    weekly_limit INT NOT NULL DEFAULT 1000,
    used_this_week INT NOT NULL DEFAULT 0,
    reset_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '7 days')
);

CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    hashed_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. DOMAIN TABLES
CREATE TABLE IF NOT EXISTS public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    schema JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status batch_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.folios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    status folio_status NOT NULL DEFAULT 'pending',
    metadata JSONB,
    r2_url TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INDICES
CREATE INDEX IF NOT EXISTS idx_folios_tenant_verified ON public.folios(tenant_id, verified_at);
CREATE INDEX IF NOT EXISTS idx_folios_batch_id ON public.folios(batch_id);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folios ENABLE ROW LEVEL SECURITY;

-- SUPERADMIN POLICIES (Superadmin bypass)
CREATE POLICY "Superadmin bypass tenants" ON public.tenants FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin'));
CREATE POLICY "Superadmin bypass quotas" ON public.tenant_quotas FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin'));
CREATE POLICY "Superadmin bypass user_profiles" ON public.user_profiles FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin'));
CREATE POLICY "Superadmin bypass folios" ON public.folios FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin'));
CREATE POLICY "Superadmin bypass batches" ON public.batches FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'superadmin'));

-- NORMAL TENANT POLICIES
CREATE POLICY "Tenant isolation for user_profiles" ON public.user_profiles FOR SELECT TO authenticated USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant users can view quotas" ON public.tenant_quotas FOR SELECT TO authenticated USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admins can view api keys" ON public.api_keys FOR SELECT TO authenticated USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Tenant isolation for templates" ON public.templates FOR ALL TO authenticated USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant isolation for batches" ON public.batches FOR ALL TO authenticated USING (tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Tenant isolation for folios" ON public.folios FOR ALL TO authenticated USING (
    tenant_id = (SELECT tenant_id FROM public.user_profiles WHERE user_id = auth.uid())
    AND (
        (SELECT role FROM public.user_profiles WHERE user_id = auth.uid()) != 'archivist'
        OR batch_id IN (SELECT id FROM public.batches WHERE uploaded_by = auth.uid())
    )
);

-- 6. BOOTSTRAPPING TRIGGER (Auto-create first superadmin)
CREATE OR REPLACE FUNCTION public.handle_new_user_bootstrapping()
RETURNS trigger AS $$
DECLARE
    user_count INT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.user_profiles;
    IF user_count = 0 THEN
        INSERT INTO public.user_profiles (user_id, role, tenant_id)
        VALUES (NEW.id, 'superadmin', NULL);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrapping ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrapping
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_bootstrapping();
