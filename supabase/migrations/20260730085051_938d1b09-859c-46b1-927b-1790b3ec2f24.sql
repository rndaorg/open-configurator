CREATE TABLE public.api_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  scopes text[] NOT NULL DEFAULT ARRAY['products:read','configurations:validate','pricing:read'],
  rate_limit_per_minute integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_agents TO authenticated;
GRANT ALL ON public.api_agents TO service_role;
ALTER TABLE public.api_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their agents" ON public.api_agents FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Admins manage all agents" ON public.api_agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.api_agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.api_agents(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'default',
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_agent_tokens_agent ON public.api_agent_tokens(agent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_agent_tokens TO authenticated;
GRANT ALL ON public.api_agent_tokens TO service_role;
ALTER TABLE public.api_agent_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their agent tokens" ON public.api_agent_tokens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_agents a WHERE a.id = agent_id AND a.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.api_agents a WHERE a.id = agent_id AND a.owner_user_id = auth.uid()));
CREATE POLICY "Admins manage all agent tokens" ON public.api_agent_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.api_agent_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.api_agents(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.api_agent_tokens(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  duration_ms integer,
  ip_address text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_agent_requests_agent_time ON public.api_agent_requests(agent_id, created_at DESC);
GRANT SELECT ON public.api_agent_requests TO authenticated;
GRANT ALL ON public.api_agent_requests TO service_role;
ALTER TABLE public.api_agent_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view their agent requests" ON public.api_agent_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_agents a WHERE a.id = agent_id AND a.owner_user_id = auth.uid()));
CREATE POLICY "Admins view all agent requests" ON public.api_agent_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.api_agent_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.api_agents(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['order.created'],
  signing_secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_agent_webhooks_agent ON public.api_agent_webhooks(agent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_agent_webhooks TO authenticated;
GRANT ALL ON public.api_agent_webhooks TO service_role;
ALTER TABLE public.api_agent_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their agent webhooks" ON public.api_agent_webhooks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_agents a WHERE a.id = agent_id AND a.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.api_agents a WHERE a.id = agent_id AND a.owner_user_id = auth.uid()));
CREATE POLICY "Admins manage all agent webhooks" ON public.api_agent_webhooks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.api_agent_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.api_agent_webhooks(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.api_agents(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  response_status integer,
  response_body text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_agent_webhook_deliveries_agent ON public.api_agent_webhook_deliveries(agent_id, created_at DESC);
GRANT SELECT ON public.api_agent_webhook_deliveries TO authenticated;
GRANT ALL ON public.api_agent_webhook_deliveries TO service_role;
ALTER TABLE public.api_agent_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view their webhook deliveries" ON public.api_agent_webhook_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.api_agents a WHERE a.id = agent_id AND a.owner_user_id = auth.uid()));
CREATE POLICY "Admins view all webhook deliveries" ON public.api_agent_webhook_deliveries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER update_api_agents_updated_at BEFORE UPDATE ON public.api_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_api_agent_tokens_updated_at BEFORE UPDATE ON public.api_agent_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_api_agent_webhooks_updated_at BEFORE UPDATE ON public.api_agent_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_api_agent_webhook_deliveries_updated_at BEFORE UPDATE ON public.api_agent_webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();