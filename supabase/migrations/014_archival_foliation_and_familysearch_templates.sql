-- Migración 014: Foliación Archivística Tridimensional y Plantillas Maestras Oficiales FamilySearch
-- Spec: 014-archival-standard-familysearch-templates-and-dip-filter
-- Tareas: T01-DB-01, T01-DB-02, T01-DB-03

-- ============================================================================
-- T01-DB-01: Extensión de public.folio_entries para foliación archivística
-- ============================================================================

DO $$
BEGIN
    -- 1. folio_number (INT)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'folio_entries' AND column_name = 'folio_number'
    ) THEN
        ALTER TABLE public.folio_entries ADD COLUMN folio_number INT;
    END IF;

    -- 2. folio_side (VARCHAR(10) CHECK ('recto', 'vuelto', 'unica') DEFAULT 'recto')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'folio_entries' AND column_name = 'folio_side'
    ) THEN
        ALTER TABLE public.folio_entries ADD COLUMN folio_side VARCHAR(10) DEFAULT 'recto' CHECK (folio_side IN ('recto', 'vuelto', 'unica'));
    END IF;

    -- 3. act_number (VARCHAR(50))
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'folio_entries' AND column_name = 'act_number'
    ) THEN
        ALTER TABLE public.folio_entries ADD COLUMN act_number VARCHAR(50);
    END IF;

    -- 4. is_continued (BOOLEAN DEFAULT FALSE)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'folio_entries' AND column_name = 'is_continued'
    ) THEN
        ALTER TABLE public.folio_entries ADD COLUMN is_continued BOOLEAN DEFAULT FALSE;
    END IF;

    -- 5. continued_from_entry_id (UUID REFERENCES public.folio_entries(id) ON DELETE SET NULL)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'folio_entries' AND column_name = 'continued_from_entry_id'
    ) THEN
        ALTER TABLE public.folio_entries ADD COLUMN continued_from_entry_id UUID REFERENCES public.folio_entries(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Índices requeridos para rendimiento y filtro estricto DIP
CREATE INDEX IF NOT EXISTS idx_folio_entries_status_tenant 
    ON public.folio_entries (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_folio_entries_foliation 
    ON public.folio_entries (folio_id, folio_number, folio_side);


-- ============================================================================
-- T01-DB-02: Extensión de public.templates e inmutabilidad de plantillas maestras
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'templates' AND column_name = 'is_system_template'
    ) THEN
        ALTER TABLE public.templates ADD COLUMN is_system_template BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Índice para plantillas del sistema por tenant
CREATE INDEX IF NOT EXISTS idx_templates_system 
    ON public.templates (tenant_id, is_system_template);

-- Trigger / Regla de integridad para proteger plantillas del sistema contra eliminación o modificación no autorizada
CREATE OR REPLACE FUNCTION public.prevent_system_template_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_system_template = TRUE THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'No se puede eliminar una plantilla oficial del sistema (FamilySearch).';
        ELSIF TG_OP = 'UPDATE' THEN
            -- Impedir renombrar o alterar campos base de la plantilla oficial
            IF NEW.is_system_template = FALSE OR NEW.fields IS DISTINCT FROM OLD.fields OR NEW.name IS DISTINCT FROM OLD.name THEN
                RAISE EXCEPTION 'No se pueden modificar los campos base ni el nombre de una plantilla oficial del sistema. Puede duplicarla para crear una personalizada.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_system_templates ON public.templates;
CREATE TRIGGER trg_protect_system_templates
    BEFORE UPDATE OR DELETE ON public.templates
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_system_template_modification();


-- ============================================================================
-- T01-DB-03: Seed de las 3 Plantillas Maestras Oficiales de FamilySearch
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    bautismo_fields JSONB;
    matrimonio_fields JSONB;
    defuncion_fields JSONB;
    
    bautismo_name CONSTANT TEXT := 'Bautismo / Nacimiento (Estándar FamilySearch)';
    matrimonio_name CONSTANT TEXT := 'Matrimonio (Estándar FamilySearch)';
    defuncion_name CONSTANT TEXT := 'Defunción / Entierro (Estándar FamilySearch)';
BEGIN
    -- 1. Definición JSONB de campos para Bautismo / Nacimiento
    bautismo_fields := '[
        {"id": "nombres", "name": "nombres", "label": "Nombres del Bautizado/Inscrito", "type": "short_text", "required": true},
        {"id": "apellidos", "name": "apellidos", "label": "Apellidos", "type": "short_text", "required": true},
        {"id": "sexo", "name": "sexo", "label": "Sexo", "type": "dropdown", "options": ["M", "F", "U"], "required": true},
        {"id": "fecha_sacramento", "name": "fecha_sacramento", "label": "Fecha del Bautismo", "type": "date", "required": true},
        {"id": "fecha_nacimiento", "name": "fecha_nacimiento", "label": "Fecha de Nacimiento", "type": "date", "required": false},
        {"id": "lugar_nacimiento", "name": "lugar_nacimiento", "label": "Lugar de Nacimiento", "type": "short_text", "required": false},
        {"id": "nombre_padre", "name": "nombre_padre", "label": "Nombre del Padre", "type": "short_text", "required": false},
        {"id": "nombre_madre", "name": "nombre_madre", "label": "Nombre de la Madre", "type": "short_text", "required": false},
        {"id": "abuelo_paterno", "name": "abuelo_paterno", "label": "Abuelo Paterno", "type": "short_text", "required": false},
        {"id": "abuela_paterna", "name": "abuela_paterna", "label": "Abuela Paterna", "type": "short_text", "required": false},
        {"id": "abuelo_materno", "name": "abuelo_materno", "label": "Abuelo Materno", "type": "short_text", "required": false},
        {"id": "abuela_materna", "name": "abuela_materna", "label": "Abuela Materna", "type": "short_text", "required": false},
        {"id": "padrino", "name": "padrino", "label": "Padrino", "type": "short_text", "required": false},
        {"id": "madrina", "name": "madrina", "label": "Madrina", "type": "short_text", "required": false},
        {"id": "ministro", "name": "ministro", "label": "Sacerdote / Ministro", "type": "short_text", "required": false},
        {"id": "notas_marginales", "name": "notas_marginales", "label": "Notas Marginales / Enmiendas", "type": "long_text", "required": false}
    ]'::jsonb;

    -- 2. Definición JSONB de campos para Matrimonio
    matrimonio_fields := '[
        {"id": "fecha_matrimonio", "name": "fecha_matrimonio", "label": "Fecha del Matrimonio", "type": "date", "required": true},
        {"id": "novio_nombres", "name": "novio_nombres", "label": "Nombres del Novio / Contrayente 1", "type": "short_text", "required": true},
        {"id": "novio_apellidos", "name": "novio_apellidos", "label": "Apellidos del Novio", "type": "short_text", "required": true},
        {"id": "novio_edad", "name": "novio_edad", "label": "Edad del Novio", "type": "number", "required": false},
        {"id": "novio_estado_civil", "name": "novio_estado_civil", "label": "Estado Civil Previo del Novio", "type": "dropdown", "options": ["Soltero", "Viudo", "Divorciado"], "required": false},
        {"id": "novio_origen", "name": "novio_origen", "label": "Lugar de Origen / Naturaleza del Novio", "type": "short_text", "required": false},
        {"id": "novio_padre", "name": "novio_padre", "label": "Padre del Novio", "type": "short_text", "required": false},
        {"id": "novio_madre", "name": "novio_madre", "label": "Madre del Novio", "type": "short_text", "required": false},
        {"id": "novia_nombres", "name": "novia_nombres", "label": "Nombres de la Novia / Contrayente 2", "type": "short_text", "required": true},
        {"id": "novia_apellidos", "name": "novia_apellidos", "label": "Apellidos de la Novia", "type": "short_text", "required": true},
        {"id": "novia_edad", "name": "novia_edad", "label": "Edad de la Novia", "type": "number", "required": false},
        {"id": "novia_estado_civil", "name": "novia_estado_civil", "label": "Estado Civil Previo de la Novia", "type": "dropdown", "options": ["Soltera", "Viuda", "Divorciada"], "required": false},
        {"id": "novia_origen", "name": "novia_origen", "label": "Lugar de Origen / Naturaleza de la Novia", "type": "short_text", "required": false},
        {"id": "novia_padre", "name": "novia_padre", "label": "Padre de la Novia", "type": "short_text", "required": false},
        {"id": "novia_madre", "name": "novia_madre", "label": "Madre de la Novia", "type": "short_text", "required": false},
        {"id": "padrinos", "name": "padrinos", "label": "Padrinos de Boda", "type": "short_text", "required": false},
        {"id": "testigos", "name": "testigos", "label": "Testigos", "type": "short_text", "required": false},
        {"id": "ministro", "name": "ministro", "label": "Sacerdote / Celebrante", "type": "short_text", "required": false},
        {"id": "notas_marginales", "name": "notas_marginales", "label": "Notas Marginales / Dispensas", "type": "long_text", "required": false}
    ]'::jsonb;

    -- 3. Definición JSONB de campos para Defunción / Entierro
    defuncion_fields := '[
        {"id": "nombres_difunto", "name": "nombres_difunto", "label": "Nombres del Difunto", "type": "short_text", "required": true},
        {"id": "apellidos_difunto", "name": "apellidos_difunto", "label": "Apellidos del Difunto", "type": "short_text", "required": true},
        {"id": "sexo", "name": "sexo", "label": "Sexo", "type": "dropdown", "options": ["M", "F", "U"], "required": true},
        {"id": "fecha_defuncion", "name": "fecha_defuncion", "label": "Fecha de Defunción", "type": "date", "required": true},
        {"id": "fecha_entierro", "name": "fecha_entierro", "label": "Fecha de Entierro / Sepultura", "type": "date", "required": false},
        {"id": "edad", "name": "edad", "label": "Edad del Difunto", "type": "short_text", "required": false},
        {"id": "estado_civil", "name": "estado_civil", "label": "Estado Civil", "type": "dropdown", "options": ["Soltero", "Casado", "Viudo", "Párvulo"], "required": false},
        {"id": "conyuge", "name": "conyuge", "label": "Nombre del Cónyuge", "type": "short_text", "required": false},
        {"id": "padres", "name": "padres", "label": "Padres del Difunto", "type": "short_text", "required": false},
        {"id": "causa_muerte", "name": "causa_muerte", "label": "Causa de Muerte", "type": "short_text", "required": false},
        {"id": "cementerio_lugar", "name": "cementerio_lugar", "label": "Lugar de Sepultura / Cementerio", "type": "short_text", "required": false},
        {"id": "ministro", "name": "ministro", "label": "Sacerdote / Ministro que dio sepultura", "type": "short_text", "required": false},
        {"id": "notas_marginales", "name": "notas_marginales", "label": "Notas Marginales / Testamento", "type": "long_text", "required": false}
    ]'::jsonb;

    -- Iterar por todas las organizaciones / tenants existentes
    FOR r IN (
        SELECT id FROM public.tenants
        UNION
        SELECT id FROM public.organizations WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
    ) LOOP
        -- Plantilla 1: Bautismo
        IF NOT EXISTS (
            SELECT 1 FROM public.templates 
            WHERE tenant_id = r.id AND (name = bautismo_name OR (is_system_template = TRUE AND name LIKE 'Bautismo%'))
        ) THEN
            INSERT INTO public.templates (tenant_id, name, fields, is_system_template)
            VALUES (r.id, bautismo_name, bautismo_fields, TRUE);
        ELSE
            UPDATE public.templates
            SET is_system_template = TRUE,
                fields = bautismo_fields,
                name = bautismo_name
            WHERE tenant_id = r.id AND (name = bautismo_name OR (is_system_template = TRUE AND name LIKE 'Bautismo%'));
        END IF;

        -- Plantilla 2: Matrimonio
        IF NOT EXISTS (
            SELECT 1 FROM public.templates 
            WHERE tenant_id = r.id AND (name = matrimonio_name OR (is_system_template = TRUE AND name LIKE 'Matrimonio%'))
        ) THEN
            INSERT INTO public.templates (tenant_id, name, fields, is_system_template)
            VALUES (r.id, matrimonio_name, matrimonio_fields, TRUE);
        ELSE
            UPDATE public.templates
            SET is_system_template = TRUE,
                fields = matrimonio_fields,
                name = matrimonio_name
            WHERE tenant_id = r.id AND (name = matrimonio_name OR (is_system_template = TRUE AND name LIKE 'Matrimonio%'));
        END IF;

        -- Plantilla 3: Defunción / Entierro
        IF NOT EXISTS (
            SELECT 1 FROM public.templates 
            WHERE tenant_id = r.id AND (name = defuncion_name OR (is_system_template = TRUE AND name LIKE 'Defunción%'))
        ) THEN
            INSERT INTO public.templates (tenant_id, name, fields, is_system_template)
            VALUES (r.id, defuncion_name, defuncion_fields, TRUE);
        ELSE
            UPDATE public.templates
            SET is_system_template = TRUE,
                fields = defuncion_fields,
                name = defuncion_name
            WHERE tenant_id = r.id AND (name = defuncion_name OR (is_system_template = TRUE AND name LIKE 'Defunción%'));
        END IF;

    END LOOP;
END $$;
