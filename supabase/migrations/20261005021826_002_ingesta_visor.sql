CREATE TYPE batch_status AS ENUM ('pending', 'processing', 'ready', 'failed');
CREATE TYPE folio_status AS ENUM ('pending', 'processing', 'revision', 'completed', 'failed');

CREATE TABLE public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- Assuming tenants table exists
    name TEXT NOT NULL,
    schema JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL, -- Assuming users table or auth.users
    status batch_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.folios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    status folio_status NOT NULL DEFAULT 'pending',
    metadata JSONB,
    r2_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Configuration
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for templates" 
ON public.templates FOR ALL TO authenticated
USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for batches" 
ON public.batches FOR ALL TO authenticated
USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- For folios, Admins/Digitadors can access all folios in the tenant.
-- Archivistas can only access folios if they uploaded the batch.
CREATE POLICY "Tenant isolation for folios" 
ON public.folios FOR ALL TO authenticated
USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND (
        (SELECT role FROM public.users WHERE id = auth.uid()) != 'archivista'
        OR batch_id IN (SELECT id FROM public.batches WHERE uploaded_by = auth.uid())
    )
);
