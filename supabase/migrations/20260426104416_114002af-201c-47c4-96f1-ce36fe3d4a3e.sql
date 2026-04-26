-- Invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID,
  invoice_number TEXT NOT NULL UNIQUE,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'paid', -- paid, pending, failed, refunded
  payment_provider TEXT NOT NULL DEFAULT 'none',
  provider_invoice_id TEXT,
  invoice_pdf_url TEXT,
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  description TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all invoices" ON public.invoices
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage invoices" ON public.invoices
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_subscription_id ON public.invoices(subscription_id);

-- Payment methods table
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  payment_provider TEXT NOT NULL,
  provider_payment_method_id TEXT,
  type TEXT NOT NULL, -- card, upi, netbanking, wallet
  brand TEXT, -- visa, mastercard, amex, etc
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  billing_name TEXT,
  billing_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment methods" ON public.payment_methods
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payment methods" ON public.payment_methods
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payment methods" ON public.payment_methods
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own payment methods" ON public.payment_methods
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all payment methods" ON public.payment_methods
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_payment_methods_user_id ON public.payment_methods(user_id);

-- Subscription history (audit trail)
CREATE TABLE public.subscription_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID,
  event_type TEXT NOT NULL, -- created, upgraded, downgraded, canceled, resumed, payment_failed, renewed
  from_tier_id UUID,
  to_tier_id UUID,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription history" ON public.subscription_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription history" ON public.subscription_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all subscription history" ON public.subscription_history
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage subscription history" ON public.subscription_history
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_subscription_history_user_id ON public.subscription_history(user_id);
CREATE INDEX idx_subscription_history_subscription_id ON public.subscription_history(subscription_id);

-- Cancellation feedback
CREATE TABLE public.cancellation_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID,
  reason TEXT NOT NULL, -- too_expensive, missing_features, switched_provider, not_using, technical_issues, other
  feedback TEXT,
  would_recommend INTEGER, -- 0-10
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own cancellation feedback" ON public.cancellation_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own cancellation feedback" ON public.cancellation_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all cancellation feedback" ON public.cancellation_feedback
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default payment method per user
CREATE OR REPLACE FUNCTION public.ensure_single_default_payment_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.payment_methods
    SET is_default = false
    WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_default_payment_method_trigger
  AFTER INSERT OR UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_payment_method();

-- Auto-log subscription history on changes
CREATE OR REPLACE FUNCTION public.log_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event := 'created';
    INSERT INTO public.subscription_history (user_id, subscription_id, event_type, to_tier_id, to_status)
    VALUES (NEW.user_id, NEW.id, event, NEW.tier_id, NEW.status);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tier_id IS DISTINCT FROM NEW.tier_id THEN
      event := 'tier_changed';
      INSERT INTO public.subscription_history (user_id, subscription_id, event_type, from_tier_id, to_tier_id, from_status, to_status)
      VALUES (NEW.user_id, NEW.id, event, OLD.tier_id, NEW.tier_id, OLD.status, NEW.status);
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      event := CASE NEW.status WHEN 'canceled' THEN 'canceled' WHEN 'active' THEN 'resumed' ELSE 'status_changed' END;
      INSERT INTO public.subscription_history (user_id, subscription_id, event_type, from_status, to_status)
      VALUES (NEW.user_id, NEW.id, event, OLD.status, NEW.status);
    END IF;
    IF OLD.cancel_at_period_end IS DISTINCT FROM NEW.cancel_at_period_end AND NEW.cancel_at_period_end = true THEN
      INSERT INTO public.subscription_history (user_id, subscription_id, event_type, to_status)
      VALUES (NEW.user_id, NEW.id, 'cancellation_scheduled', NEW.status);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_subscription_change_trigger
  AFTER INSERT OR UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.log_subscription_change();