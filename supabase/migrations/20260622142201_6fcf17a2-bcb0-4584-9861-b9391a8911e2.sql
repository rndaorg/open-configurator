
-- Persistent AI shopping agent: memory + conversation history

CREATE TABLE public.ai_agent_memory (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  budget_min NUMERIC,
  budget_max NUMERIC,
  style_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  interested_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_memory TO authenticated;
GRANT ALL ON public.ai_agent_memory TO service_role;

ALTER TABLE public.ai_agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agent memory" ON public.ai_agent_memory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own agent memory" ON public.ai_agent_memory
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_ai_agent_memory_updated
  BEFORE UPDATE ON public.ai_agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.ai_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  suggestions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_messages_user_created ON public.ai_agent_messages(user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.ai_agent_messages TO authenticated;
GRANT ALL ON public.ai_agent_messages TO service_role;

ALTER TABLE public.ai_agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own agent messages" ON public.ai_agent_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own agent messages" ON public.ai_agent_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own agent messages" ON public.ai_agent_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
