
CREATE TABLE public.analytics_agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'completed',
  window_days INTEGER NOT NULL DEFAULT 30,
  summary TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_agent_runs TO authenticated;
GRANT ALL ON public.analytics_agent_runs TO service_role;
ALTER TABLE public.analytics_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agent runs" ON public.analytics_agent_runs FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.analytics_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.analytics_agent_runs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_insights TO authenticated;
GRANT ALL ON public.analytics_insights TO service_role;
ALTER TABLE public.analytics_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage insights" ON public.analytics_insights FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_analytics_insights_updated
  BEFORE UPDATE ON public.analytics_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_analytics_insights_status ON public.analytics_insights(status);
CREATE INDEX idx_analytics_insights_product ON public.analytics_insights(product_id);
CREATE INDEX idx_analytics_agent_runs_created ON public.analytics_agent_runs(created_at DESC);
