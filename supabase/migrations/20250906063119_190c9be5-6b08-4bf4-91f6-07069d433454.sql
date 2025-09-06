-- Add rule engine tables
CREATE TABLE public.configuration_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('dependency', 'restriction', 'auto_select', 'pricing')),
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add pricing rules table
CREATE TABLE public.pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('volume_discount', 'time_based', 'bundle', 'conditional')),
  conditions JSONB NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 1,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add inventory tracking
CREATE TABLE public.inventory_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_value_id UUID REFERENCES public.option_values(id),
  available_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add user preferences for recommendations
CREATE TABLE public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  product_id UUID REFERENCES public.products(id),
  preferences JSONB NOT NULL,
  interaction_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add configuration analytics
CREATE TABLE public.configuration_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id),
  configuration_data JSONB NOT NULL,
  session_id TEXT,
  user_agent TEXT,
  completion_rate NUMERIC DEFAULT 0,
  abandonment_point TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuration_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuration_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Configuration rules are viewable by everyone" 
ON public.configuration_rules FOR SELECT USING (true);

CREATE POLICY "Pricing rules are viewable by everyone" 
ON public.pricing_rules FOR SELECT USING (true);

CREATE POLICY "Inventory levels are viewable by everyone" 
ON public.inventory_levels FOR SELECT USING (true);

CREATE POLICY "Anyone can create user preferences" 
ON public.user_preferences FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view user preferences" 
ON public.user_preferences FOR SELECT USING (true);

CREATE POLICY "Anyone can create analytics" 
ON public.configuration_analytics FOR INSERT WITH CHECK (true);

-- Add triggers for timestamps
CREATE TRIGGER update_configuration_rules_updated_at
BEFORE UPDATE ON public.configuration_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_rules_updated_at
BEFORE UPDATE ON public.pricing_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_levels_updated_at
BEFORE UPDATE ON public.inventory_levels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();