
-- Subscription tiers table
CREATE TABLE public.subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  monthly_price_usd numeric NOT NULL DEFAULT 0,
  yearly_price_usd numeric NOT NULL DEFAULT 0,
  max_products integer NOT NULL DEFAULT 5,
  max_categories integer NOT NULL DEFAULT 2,
  analytics_access boolean NOT NULL DEFAULT false,
  api_access boolean NOT NULL DEFAULT false,
  white_label boolean NOT NULL DEFAULT false,
  priority_support boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tiers are viewable by everyone"
  ON public.subscription_tiers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage tiers"
  ON public.subscription_tiers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- User subscriptions table
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.subscription_tiers(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'paused')),
  payment_provider text NOT NULL DEFAULT 'none' CHECK (payment_provider IN ('stripe', 'paddle', 'none')),
  provider_subscription_id text,
  provider_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  billing_interval text NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage subscriptions"
  ON public.user_subscriptions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own subscription"
  ON public.user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON public.user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Payment provider config (admin toggle)
CREATE TABLE public.payment_provider_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE CHECK (provider IN ('stripe', 'paddle')),
  is_enabled boolean NOT NULL DEFAULT false,
  is_live_mode boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_provider_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view payment config"
  ON public.payment_provider_config FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage payment config"
  ON public.payment_provider_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON public.subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_provider_config_updated_at
  BEFORE UPDATE ON public.payment_provider_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-assign free tier to new users
CREATE OR REPLACE FUNCTION public.assign_free_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_tier_id uuid;
BEGIN
  SELECT id INTO free_tier_id FROM public.subscription_tiers WHERE slug = 'free' LIMIT 1;
  IF free_tier_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, tier_id, status, payment_provider)
    VALUES (NEW.id, free_tier_id, 'active', 'none')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_assign_tier
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_free_tier();

-- Seed tiers
INSERT INTO public.subscription_tiers (name, slug, description, monthly_price_usd, yearly_price_usd, max_products, max_categories, analytics_access, api_access, white_label, priority_support, display_order, features) VALUES
('Free', 'free', 'Get started with basic product configuration', 0, 0, 5, 2, false, false, false, false, 0, '["Up to 5 products", "2 categories", "Basic configurator", "Community support"]'::jsonb),
('Pro', 'pro', 'For growing businesses that need more power', 29, 290, 50, 10, true, false, false, false, 1, '["Up to 50 products", "10 categories", "Advanced analytics", "Priority email support", "Custom pricing rules", "Inventory management"]'::jsonb),
('Enterprise', 'enterprise', 'For large teams with advanced needs', 99, 990, -1, -1, true, true, true, true, 2, '["Unlimited products", "Unlimited categories", "Full analytics suite", "API access", "White-label branding", "24/7 priority support", "Custom integrations"]'::jsonb);

-- Seed payment provider config
INSERT INTO public.payment_provider_config (provider, is_enabled, is_live_mode) VALUES
('stripe', true, false),
('paddle', false, false);
