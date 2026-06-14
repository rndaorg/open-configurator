
CREATE TABLE public.catalog_ai_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT,
  suggestions JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_ai_proposals TO authenticated;
GRANT ALL ON public.catalog_ai_proposals TO service_role;

ALTER TABLE public.catalog_ai_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view proposals"
  ON public.catalog_ai_proposals FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert proposals"
  ON public.catalog_ai_proposals FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update proposals"
  ON public.catalog_ai_proposals FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete proposals"
  ON public.catalog_ai_proposals FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_catalog_ai_proposals_updated_at
  BEFORE UPDATE ON public.catalog_ai_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_catalog_ai_proposals_product ON public.catalog_ai_proposals(product_id);
CREATE INDEX idx_catalog_ai_proposals_status ON public.catalog_ai_proposals(status);
