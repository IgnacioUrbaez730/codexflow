-- Migración 009: Indexación Asistida por IA y Active Learning

CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    model_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    field_key VARCHAR(100) NOT NULL,
    suggested_text TEXT NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0.000 AND confidence <= 1.000),
    -- Coordenadas normalizadas relativas a la resolución nativa de la imagen (0.0 a 1.0)
    bbox_x NUMERIC(6, 5) NOT NULL,
    bbox_y NUMERIC(6, 5) NOT NULL,
    bbox_width NUMERIC(6, 5) NOT NULL,
    bbox_height NUMERIC(6, 5) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_folio ON ai_predictions(folio_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_tenant ON ai_predictions(tenant_id);

-- Tabla para Aprendizaje Activo (Active Learning)
CREATE TABLE IF NOT EXISTS training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    folio_id UUID NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    predicted_value TEXT NOT NULL DEFAULT '',
    actual_value TEXT NOT NULL DEFAULT '',
    confidence NUMERIC(4, 3) DEFAULT 0.000,
    bbox_x NUMERIC(6, 5) DEFAULT 0.00000,
    bbox_y NUMERIC(6, 5) DEFAULT 0.00000,
    bbox_width NUMERIC(6, 5) DEFAULT 0.00000,
    bbox_height NUMERIC(6, 5) DEFAULT 0.00000,
    action_type VARCHAR(20) NOT NULL DEFAULT 'corrected_text' CHECK (action_type IN ('accepted_exact', 'corrected_text', 'rejected_blank', 'manual_inserted')),
    corrected_by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_data_field_created ON training_data(field_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_data_tenant ON training_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_data_action ON training_data(action_type);

-- RLS Policies
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ai_predictions' AND policyname = 'Allow authenticated read ai_predictions'
    ) THEN
        CREATE POLICY "Allow authenticated read ai_predictions" ON ai_predictions
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'training_data' AND policyname = 'Allow authenticated insert training_data'
    ) THEN
        CREATE POLICY "Allow authenticated insert training_data" ON training_data
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'training_data' AND policyname = 'Allow authenticated select training_data'
    ) THEN
        CREATE POLICY "Allow authenticated select training_data" ON training_data
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;
