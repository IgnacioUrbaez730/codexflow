-- 012_form_builder.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='templates' AND column_name='fields') THEN
        ALTER TABLE public.templates ADD COLUMN fields JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_template_edit()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.fields IS DISTINCT FROM NEW.fields OR OLD.name IS DISTINCT FROM NEW.name) THEN
        IF EXISTS (SELECT 1 FROM public.batches WHERE template_id = OLD.id) THEN
            RAISE EXCEPTION 'Cannot edit template fields or name because it is already used in batches.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_template_edit ON public.templates;

CREATE TRIGGER prevent_template_edit
BEFORE UPDATE ON public.templates
FOR EACH ROW
EXECUTE FUNCTION public.check_template_edit();
