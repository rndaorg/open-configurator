CREATE TABLE public.wishlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  configuration_id UUID,
  configuration_data JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_wishlists_user ON public.wishlists(user_id);
CREATE INDEX idx_wishlists_product ON public.wishlists(product_id);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wishlist" ON public.wishlists
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wishlist" ON public.wishlists
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own wishlist" ON public.wishlists
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own wishlist" ON public.wishlists
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_wishlists_updated_at
  BEFORE UPDATE ON public.wishlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.shared_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token TEXT NOT NULL UNIQUE,
  owner_id UUID,
  product_id UUID NOT NULL,
  configuration_id UUID,
  configuration_data JSONB NOT NULL,
  configuration_name TEXT,
  total_price NUMERIC,
  is_collaborative BOOLEAN NOT NULL DEFAULT false,
  allow_edits BOOLEAN NOT NULL DEFAULT false,
  view_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_configurations_token ON public.shared_configurations(share_token);
CREATE INDEX idx_shared_configurations_owner ON public.shared_configurations(owner_id);

ALTER TABLE public.shared_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shared configurations are publicly viewable" ON public.shared_configurations
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create shares" ON public.shared_configurations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their shares" ON public.shared_configurations
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their shares" ON public.shared_configurations
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Collaborators can update collaborative shares" ON public.shared_configurations
  FOR UPDATE TO authenticated USING (is_collaborative = true AND allow_edits = true)
  WITH CHECK (is_collaborative = true AND allow_edits = true);

CREATE TRIGGER update_shared_configurations_updated_at
  BEFORE UPDATE ON public.shared_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.shared_configuration_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_config_id UUID NOT NULL REFERENCES public.shared_configurations(id) ON DELETE CASCADE,
  user_id UUID,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_shared_config ON public.shared_configuration_collaborators(shared_config_id);

ALTER TABLE public.shared_configuration_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collaborators visible on collaborative shares" ON public.shared_configuration_collaborators
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.shared_configurations sc 
            WHERE sc.id = shared_config_id AND sc.is_collaborative = true)
  );
CREATE POLICY "Anyone can join a collaborative share" ON public.shared_configuration_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.shared_configurations sc 
            WHERE sc.id = shared_config_id AND sc.is_collaborative = true)
  );
CREATE POLICY "Users can update own collab presence" ON public.shared_configuration_collaborators
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

ALTER TABLE public.shared_configurations REPLICA IDENTITY FULL;
ALTER TABLE public.shared_configuration_collaborators REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_configurations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_configuration_collaborators;