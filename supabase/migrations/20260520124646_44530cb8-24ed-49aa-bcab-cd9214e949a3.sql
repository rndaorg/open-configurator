
-- Email templates
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  variables JSONB NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT 'transactional' CHECK (category IN ('transactional','promotional','drip','cart_recovery','newsletter')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email_templates" ON public.email_templates FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated read active templates" ON public.email_templates FOR SELECT TO authenticated USING (is_active = true);
CREATE TRIGGER trg_email_templates_updated BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email campaigns
CREATE TABLE public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE RESTRICT NOT NULL,
  type TEXT NOT NULL DEFAULT 'one_off' CHECK (type IN ('newsletter','one_off','cart_recovery','drip')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','paused','failed')),
  audience_filter JSONB NOT NULL DEFAULT '{"type":"all"}',
  template_data JSONB NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  stats JSONB NOT NULL DEFAULT '{"queued":0,"sent":0,"failed":0,"skipped":0}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email_campaigns" ON public.email_campaigns FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_email_campaigns_updated BEFORE UPDATE ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped','unsubscribed')),
  error TEXT,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ecr_campaign ON public.email_campaign_recipients(campaign_id, status);
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email_campaign_recipients" ON public.email_campaign_recipients FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Drip campaigns
CREATE TABLE public.drip_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('signup','first_order','cart_abandoned','inactive_30d','manual')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drip_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage drip_campaigns" ON public.drip_campaigns FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_drip_campaigns_updated BEFORE UPDATE ON public.drip_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.drip_campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drip_campaign_id UUID REFERENCES public.drip_campaigns(id) ON DELETE CASCADE NOT NULL,
  step_order INTEGER NOT NULL,
  delay_hours INTEGER NOT NULL DEFAULT 24,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE RESTRICT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(drip_campaign_id, step_order)
);
ALTER TABLE public.drip_campaign_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage drip_steps" ON public.drip_campaign_steps FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.drip_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drip_campaign_id UUID REFERENCES public.drip_campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(drip_campaign_id, user_id)
);
CREATE INDEX idx_drip_enrollments_due ON public.drip_enrollments(next_send_at) WHERE status = 'active';
ALTER TABLE public.drip_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage drip_enrollments" ON public.drip_enrollments FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Users view own enrollments" ON public.drip_enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Email subscriptions
CREATE TABLE public.email_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  email TEXT NOT NULL UNIQUE,
  newsletter BOOLEAN NOT NULL DEFAULT true,
  promotional BOOLEAN NOT NULL DEFAULT true,
  transactional BOOLEAN NOT NULL DEFAULT true,
  unsubscribe_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email_subscriptions" ON public.email_subscriptions FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Users view own subscription" ON public.email_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own subscription" ON public.email_subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_email_subs_updated BEFORE UPDATE ON public.email_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email send log
CREATE TABLE public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug TEXT,
  category TEXT,
  recipient_email TEXT NOT NULL,
  campaign_id UUID,
  drip_enrollment_id UUID,
  status TEXT NOT NULL CHECK (status IN ('sent','failed','skipped','demo')),
  provider TEXT NOT NULL DEFAULT 'sendgrid',
  provider_message_id TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_send_log_recent ON public.email_send_log(sent_at DESC);
CREATE INDEX idx_email_send_log_recipient ON public.email_send_log(recipient_email, sent_at DESC);
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view send log" ON public.email_send_log FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

-- Abandoned carts
CREATE TABLE public.abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email TEXT NOT NULL,
  cart_data JSONB NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  recovery_status TEXT NOT NULL DEFAULT 'pending' CHECK (recovery_status IN ('pending','email_1_sent','email_2_sent','recovered','expired')),
  last_email_sent_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_abandoned_carts_recovery ON public.abandoned_carts(recovery_status, created_at);
CREATE UNIQUE INDEX idx_abandoned_carts_active_email ON public.abandoned_carts(email) WHERE recovery_status NOT IN ('recovered','expired');
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage abandoned_carts" ON public.abandoned_carts FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own abandoned cart" ON public.abandoned_carts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own abandoned cart" ON public.abandoned_carts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anon insert abandoned cart with email" ON public.abandoned_carts FOR INSERT TO anon WITH CHECK (user_id IS NULL AND email IS NOT NULL);
CREATE TRIGGER trg_abandoned_carts_updated BEFORE UPDATE ON public.abandoned_carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create email_subscription + drip enrollment on user signup
CREATE OR REPLACE FUNCTION public.create_email_subscription_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dc_id UUID;
BEGIN
  INSERT INTO public.email_subscriptions (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id;

  FOR dc_id IN SELECT id FROM public.drip_campaigns WHERE trigger_event = 'signup' AND is_active = true LOOP
    INSERT INTO public.drip_enrollments (drip_campaign_id, user_id, email, next_send_at)
    VALUES (dc_id, NEW.id, NEW.email, now())
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_email_sub
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_email_subscription_for_user();

-- Seed default templates
INSERT INTO public.email_templates (slug, name, subject, html_body, text_body, variables, category) VALUES
('order_confirmation', 'Order Confirmation', 'Order #{{order_id}} confirmed',
'<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h1 style="color:#1a1a2e">Thanks for your order, {{customer_name}}!</h1>
<p>We''ve received order <strong>#{{order_id}}</strong>.</p>
<div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0">
<p><strong>Product:</strong> {{product_name}}</p>
<p><strong>Total:</strong> ${{total_price}}</p>
</div>
<p>We''ll let you know when it ships.</p>
</div>',
'Thanks for your order #{{order_id}}, {{customer_name}}! Product: {{product_name}}, Total: ${{total_price}}.',
'["customer_name","order_id","product_name","total_price"]'::jsonb, 'transactional'),

('order_shipped', 'Order Shipped', 'Your order #{{order_id}} has shipped',
'<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h1>On its way! 📦</h1>
<p>Hi {{customer_name}}, your order <strong>#{{order_id}}</strong> has shipped.</p>
<p><strong>Tracking:</strong> {{tracking_number}}</p>
</div>',
'Your order #{{order_id}} has shipped. Tracking: {{tracking_number}}',
'["customer_name","order_id","tracking_number"]'::jsonb, 'transactional'),

('cart_recovery_1', 'Cart Recovery - 24h', 'You left something behind',
'<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h1>Still thinking it over?</h1>
<p>Hi {{customer_name}}, you have {{item_count}} item(s) waiting in your cart worth ${{total_amount}}.</p>
<a href="{{cart_url}}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Return to cart</a>
</div>',
'You have {{item_count}} items waiting in your cart. Return: {{cart_url}}',
'["customer_name","item_count","total_amount","cart_url"]'::jsonb, 'cart_recovery'),

('cart_recovery_2', 'Cart Recovery - 72h', 'Last chance - 10% off your cart',
'<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h1>Don''t miss out!</h1>
<p>Hi {{customer_name}}, complete your order today and we''ll throw in a little something extra.</p>
<a href="{{cart_url}}" style="display:inline-block;background:#e94560;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Complete order</a>
</div>',
'Complete your cart today: {{cart_url}}',
'["customer_name","cart_url"]'::jsonb, 'cart_recovery'),

('welcome', 'Welcome Email', 'Welcome to Open Configurator',
'<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h1>Welcome aboard, {{customer_name}}!</h1>
<p>We''re thrilled to have you. Start exploring custom configurations tailored just for you.</p>
<a href="{{site_url}}/products" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Browse products</a>
</div>',
'Welcome to Open Configurator! Browse: {{site_url}}/products',
'["customer_name","site_url"]'::jsonb, 'drip'),

('newsletter_default', 'Monthly Newsletter', '{{subject_line}}',
'<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h1>{{headline}}</h1>
<div>{{body_html}}</div>
</div>',
'{{headline}}',
'["subject_line","headline","body_html"]'::jsonb, 'newsletter');
