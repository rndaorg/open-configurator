
CREATE TABLE public.mediator_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_config_id uuid NOT NULL REFERENCES public.shared_configurations(id) ON DELETE CASCADE,
  user_id uuid,
  display_name text NOT NULL DEFAULT 'Guest',
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  proposed_config jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mediator_messages_share_idx ON public.mediator_messages(shared_config_id, created_at);
GRANT SELECT, INSERT ON public.mediator_messages TO anon, authenticated;
GRANT ALL ON public.mediator_messages TO service_role;
ALTER TABLE public.mediator_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mediator messages readable on collaborative shares"
  ON public.mediator_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shared_configurations sc
    WHERE sc.id = shared_config_id AND sc.is_collaborative = true));
CREATE POLICY "Anyone in a collaborative share can post mediator messages"
  ON public.mediator_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.shared_configurations sc
    WHERE sc.id = shared_config_id AND sc.is_collaborative = true));

CREATE TABLE public.mediator_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_config_id uuid NOT NULL REFERENCES public.shared_configurations(id) ON DELETE CASCADE,
  user_id uuid,
  display_name text NOT NULL DEFAULT 'Guest',
  preferences_text text NOT NULL DEFAULT '',
  priorities jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget_max numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shared_config_id, display_name)
);
CREATE INDEX mediator_preferences_share_idx ON public.mediator_preferences(shared_config_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mediator_preferences TO anon, authenticated;
GRANT ALL ON public.mediator_preferences TO service_role;
ALTER TABLE public.mediator_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mediator prefs readable on collaborative shares"
  ON public.mediator_preferences FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shared_configurations sc
    WHERE sc.id = shared_config_id AND sc.is_collaborative = true));
CREATE POLICY "Anyone in a collaborative share can upsert mediator prefs"
  ON public.mediator_preferences FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.shared_configurations sc
    WHERE sc.id = shared_config_id AND sc.is_collaborative = true));
CREATE POLICY "Anyone in a collaborative share can update mediator prefs"
  ON public.mediator_preferences FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.shared_configurations sc
    WHERE sc.id = shared_config_id AND sc.is_collaborative = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shared_configurations sc
    WHERE sc.id = shared_config_id AND sc.is_collaborative = true));
CREATE POLICY "Anyone in a collaborative share can delete their mediator prefs"
  ON public.mediator_preferences FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.shared_configurations sc
    WHERE sc.id = shared_config_id AND sc.is_collaborative = true));

ALTER TABLE public.mediator_messages REPLICA IDENTITY FULL;
ALTER TABLE public.mediator_preferences REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mediator_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mediator_preferences;
