CREATE TABLE training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    folio_id UUID NOT NULL,
    field_name TEXT NOT NULL,
    predicted_value TEXT,
    actual_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users in the same tenant"
ON training_data
FOR SELECT
USING (
    tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Enable insert access for users in the same tenant"
ON training_data
FOR INSERT
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
    )
);
