ALTER TABLE folios
ADD COLUMN ai_predictions JSONB DEFAULT '{}'::jsonb;
