-- ==============================================================================
-- Migración 012: Gestión de Carpetas/Tomos e Interoperabilidad FamilySearch (DIP)
-- Spec: 012-folder-management-familysearch-interoperability
-- Tareas: T01-DB-01, T01-DB-02, T01-DB-03, T01-DB-04, T01-DB-05
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- T01-DB-01: Tipo enumerado 'folder_type_enum' y tabla 'public.document_folders'
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'folder_type_enum') THEN
        CREATE TYPE folder_type_enum AS ENUM ('root', 'parish', 'series', 'tome');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.document_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    folder_type folder_type_enum NOT NULL DEFAULT 'tome',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de desempeño para jerarquía y consultas por tenant
CREATE INDEX IF NOT EXISTS idx_document_folders_tenant_id ON public.document_folders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent_id ON public.document_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_tenant_type ON public.document_folders(tenant_id, folder_type);

-- ------------------------------------------------------------------------------
-- T01-DB-02: Actualización de la tabla 'public.folios'
-- ------------------------------------------------------------------------------

ALTER TABLE public.folios
    ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sequence_order INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS original_filename TEXT,
    ADD COLUMN IF NOT EXISTS canonical_filename TEXT;

-- Índices para navegación por tomo y ordenamiento correlativo de folios
CREATE INDEX IF NOT EXISTS idx_folios_tenant_folder ON public.folios(tenant_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_folios_folder_sequence ON public.folios(folder_id, sequence_order);

-- ------------------------------------------------------------------------------
-- T01-DB-03: Creación de la tabla 'public.folio_entries' (Multi-Partida)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.folio_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    folio_id UUID NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
    entry_number INT NOT NULL DEFAULT 1,
    status folio_status NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    bounding_box JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_folio_entry UNIQUE (folio_id, entry_number)
);

-- Índices para optimización de consultas multi-partida
CREATE INDEX IF NOT EXISTS idx_folio_entries_tenant_id ON public.folio_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_folio_entries_folio_id ON public.folio_entries(folio_id);
CREATE INDEX IF NOT EXISTS idx_folio_entries_tenant_status ON public.folio_entries(tenant_id, status);

-- ------------------------------------------------------------------------------
-- T01-DB-04: Políticas de Seguridad RLS (Row Level Security) y RBAC
-- ------------------------------------------------------------------------------

-- Habilitar RLS en ambas tablas
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folio_entries ENABLE ROW LEVEL SECURITY;

-- Políticas para document_folders
DROP POLICY IF EXISTS rls_folders_select ON public.document_folders;
CREATE POLICY rls_folders_select ON public.document_folders
    FOR SELECT
    USING (
        public.is_superadmin()
        OR tenant_id = public.get_user_tenant()
    );

DROP POLICY IF EXISTS rls_folders_insert ON public.document_folders;
CREATE POLICY rls_folders_insert ON public.document_folders
    FOR INSERT
    WITH CHECK (
        public.is_superadmin()
        OR (
            tenant_id = public.get_user_tenant()
            AND public.get_user_role() IN ('admin', 'archivist')
        )
    );

DROP POLICY IF EXISTS rls_folders_update ON public.document_folders;
CREATE POLICY rls_folders_update ON public.document_folders
    FOR UPDATE
    USING (
        public.is_superadmin()
        OR (
            tenant_id = public.get_user_tenant()
            AND public.get_user_role() IN ('admin', 'archivist')
        )
    )
    WITH CHECK (
        public.is_superadmin()
        OR (
            tenant_id = public.get_user_tenant()
            AND public.get_user_role() IN ('admin', 'archivist')
        )
    );

DROP POLICY IF EXISTS rls_folders_delete ON public.document_folders;
CREATE POLICY rls_folders_delete ON public.document_folders
    FOR DELETE
    USING (
        public.is_superadmin()
        OR (
            tenant_id = public.get_user_tenant()
            AND public.get_user_role() IN ('admin', 'archivist')
        )
    );

-- Políticas para folio_entries
DROP POLICY IF EXISTS rls_folio_entries_select ON public.folio_entries;
CREATE POLICY rls_folio_entries_select ON public.folio_entries
    FOR SELECT
    USING (
        public.is_superadmin()
        OR tenant_id = public.get_user_tenant()
    );

DROP POLICY IF EXISTS rls_folio_entries_insert ON public.folio_entries;
CREATE POLICY rls_folio_entries_insert ON public.folio_entries
    FOR INSERT
    WITH CHECK (
        public.is_superadmin()
        OR (
            tenant_id = public.get_user_tenant()
            AND public.get_user_role() IN ('admin', 'archivist', 'digitizer')
        )
    );

DROP POLICY IF EXISTS rls_folio_entries_update ON public.folio_entries;
CREATE POLICY rls_folio_entries_update ON public.folio_entries
    FOR UPDATE
    USING (
        public.is_superadmin()
        OR (
            tenant_id = public.get_user_tenant()
            AND public.get_user_role() IN ('admin', 'archivist', 'digitizer')
        )
    )
    WITH CHECK (
        public.is_superadmin()
        OR (
            tenant_id = public.get_user_tenant()
            AND public.get_user_role() IN ('admin', 'archivist', 'digitizer')
        )
    );

DROP POLICY IF EXISTS rls_folio_entries_delete ON public.folio_entries;
CREATE POLICY rls_folio_entries_delete ON public.folio_entries
    FOR DELETE
    USING (
        public.is_superadmin()
        OR (
            tenant_id = public.get_user_tenant()
            AND public.get_user_role() IN ('admin', 'archivist', 'digitizer')
        )
    );

-- ------------------------------------------------------------------------------
-- T01-DB-05: Migración y Compatibilidad hacia atrás
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  t RECORD;
  v_folder_id UUID;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    SELECT id INTO v_folder_id FROM public.document_folders WHERE tenant_id = t.id AND name = 'Sin Clasificar (Migración inicial)' LIMIT 1;
    IF v_folder_id IS NULL THEN
      INSERT INTO public.document_folders (tenant_id, name, folder_type, metadata)
      VALUES (t.id, 'Sin Clasificar (Migración inicial)', 'root', '{"system_managed": true}'::jsonb)
      RETURNING id INTO v_folder_id;
    END IF;
    -- Asignar folios existentes huérfanos a esta carpeta virtual
    UPDATE public.folios SET folder_id = v_folder_id WHERE tenant_id = t.id AND folder_id IS NULL;
  END LOOP;
END $$;
