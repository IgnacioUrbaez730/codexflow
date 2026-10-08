-- Añadir columna locked_at
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Ajustar políticas RLS para revision
DROP POLICY IF EXISTS admin_revision_policy ON public.folios;
CREATE POLICY admin_revision_policy ON public.folios
  FOR ALL
  USING (
    status = 'revision' AND
    (auth.jwt() ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS archivist_revision_policy ON public.folios;
CREATE POLICY archivist_revision_policy ON public.folios
  FOR ALL
  USING (
    status = 'revision' AND
    batch_id IN (
      SELECT id FROM public.batches WHERE uploaded_by = auth.uid()
    )
  );

-- RPC para obtener el siguiente folio
CREATE OR REPLACE FUNCTION get_next_folio(p_tenant_id UUID)
RETURNS setof public.folios
LANGUAGE plpgsql
AS $$
DECLARE
  v_folio public.folios;
BEGIN
  SELECT * INTO v_folio
  FROM public.folios
  WHERE status = 'pending' AND tenant_id = p_tenant_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    UPDATE public.folios
    SET status = 'in_progress', locked_at = NOW()
    WHERE id = v_folio.id
    RETURNING * INTO v_folio;

    RETURN NEXT v_folio;
  END IF;
END;
$$;
