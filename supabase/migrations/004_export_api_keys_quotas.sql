-- Migration 004: Export API Keys and Quotas

-- 1. Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL,
    hashed_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view api keys" 
    ON public.api_keys 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.tenant_id = api_keys.tenant_id
            AND user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- 2. Create tenant_quotas table
CREATE TABLE IF NOT EXISTS public.tenant_quotas (
    tenant_id UUID PRIMARY KEY,
    weekly_limit INT NOT NULL DEFAULT 1000,
    used_this_week INT NOT NULL DEFAULT 0,
    reset_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '7 days')
);

ALTER TABLE public.tenant_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view quotas" 
    ON public.tenant_quotas 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.tenant_id = tenant_quotas.tenant_id
            AND user_profiles.user_id = auth.uid()
        )
    );

-- 3. Performance indices on folios
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_folios_tenant_verified ON public.folios(tenant_id, verified_at);
CREATE INDEX IF NOT EXISTS idx_folios_batch_id ON public.folios(batch_id);
