-- =============================================================================
-- Migración 017: Rol de Evaluador ('evaluator') y Mesa de Arbitraje de Calidad
-- SPEC-017: Control de Calidad, Verificación, Devolución Prioritaria y Escalamiento
-- =============================================================================

-- 1. Añadir 'verified' al enum folio_status (si existe en PostgreSQL)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'folio_status') THEN
        ALTER TYPE folio_status ADD VALUE IF NOT EXISTS 'verified';
    END IF;
END$$;

-- 2. Ampliar el enum user_role o constraint de user_profiles.role para admitir 'evaluator'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'evaluator';
    END IF;
END$$;

-- Si user_profiles.role tiene un CHECK constraint de texto, actualizarlo de forma segura
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'user_profiles'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%role%'
    ) LOOP
        EXECUTE format('ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        BEGIN
            ALTER TABLE user_profiles
            ADD CONSTRAINT user_profiles_role_check
            CHECK (role::text IN ('superadmin', 'admin', 'archivist', 'evaluator', 'digitizer', 'pending', 'rejected'));
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END$$;

-- 3. Añadir de forma idempotente columnas de trazabilidad y bloqueo en folios y folio_entries
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'folios') THEN
        ALTER TABLE folios ADD COLUMN IF NOT EXISTS digitized_by TEXT;
        ALTER TABLE folios ADD COLUMN IF NOT EXISTS verified_by TEXT;
        ALTER TABLE folios ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
        ALTER TABLE folios ADD COLUMN IF NOT EXISTS review_notes TEXT;
        ALTER TABLE folios ADD COLUMN IF NOT EXISTS evaluation_locked_at TIMESTAMPTZ;
        ALTER TABLE folios ADD COLUMN IF NOT EXISTS evaluation_locked_by UUID;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'folio_entries') THEN
        ALTER TABLE folio_entries ADD COLUMN IF NOT EXISTS digitized_by TEXT;
        ALTER TABLE folio_entries ADD COLUMN IF NOT EXISTS verified_by TEXT;
        ALTER TABLE folio_entries ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
        ALTER TABLE folio_entries ADD COLUMN IF NOT EXISTS review_notes TEXT;
        ALTER TABLE folio_entries ADD COLUMN IF NOT EXISTS evaluation_locked_at TIMESTAMPTZ;
        ALTER TABLE folio_entries ADD COLUMN IF NOT EXISTS evaluation_locked_by UUID;
    END IF;
END$$;

-- 4. Documentación de llaves en el diccionario JSONB metadata (Resiliencia Híbrida)
-- Las siguientes llaves son mantenidas también dentro de folios.metadata y folio_entries.metadata:
--   * digitized_by          : Email o nombre completo del digitador que transcribió el acta
--   * digitized_at          : Fecha/hora ISO-8601 UTC de digitación
--   * verified_by           : Email o nombre completo del Evaluador que certificó el acta
--   * verified_at           : Fecha/hora ISO-8601 UTC de verificación de calidad
--   * review_notes          : Observación o motivo de devolución/escalamiento redactado por el Evaluador
--   * priority_returned     : Booleano (true) cuando el folio fue devuelto al digitador con máxima prioridad
--   * returned_by           : Identidad del Evaluador que devolvió el acta
--   * returned_at           : Fecha/hora ISO-8601 UTC de devolución al digitador
--   * escalated_to_archivist: Booleano (true) cuando el Evaluador escala un caso dudoso al Archivista
--   * escalated_by          : Identidad del Evaluador que escaló el caso al Archivista
--   * escalated_at          : Fecha/hora ISO-8601 UTC del escalamiento
--   * evaluation_locked_at  : Timestamp ISO-8601 UTC del bloqueo concurrente (15 min) en Mesa de Evaluación
--   * evaluation_locked_by  : UUID del Evaluador con bloqueo activo sobre el folio
COMMENT ON COLUMN folios.metadata IS 'Metadatos JSONB del folio e historial de arbitraje (digitized_by, verified_by, verified_at, review_notes, priority_returned, escalated_to_archivist, escalated_by, escalated_at, evaluation_locked_at, evaluation_locked_by)';
