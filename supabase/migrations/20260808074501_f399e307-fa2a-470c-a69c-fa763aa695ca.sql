
-- ============ ENUM ============
DO $$ BEGIN
  CREATE TYPE public.tenant_role AS ENUM ('owner','admin','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TENANTS ============
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  custom_domain text UNIQUE,
  status text NOT NULL DEFAULT 'active',
  onboarding_step integer NOT NULL DEFAULT 0,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

CREATE TABLE public.tenant_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  logo_url text,
  favicon_url text,
  tagline text,
  support_email text,
  primary_color text NOT NULL DEFAULT '221 83% 53%',
  accent_color text NOT NULL DEFAULT '262 83% 58%',
  background_color text NOT NULL DEFAULT '0 0% 100%',
  foreground_color text NOT NULL DEFAULT '222 47% 11%',
  heading_font text NOT NULL DEFAULT 'Inter',
  body_font text NOT NULL DEFAULT 'Inter',
  radius text NOT NULL DEFAULT '0.5rem',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenant_branding TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_branding TO authenticated;
GRANT ALL ON public.tenant_branding TO service_role;

CREATE TABLE public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.tenant_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;

-- ============ HELPER FUNCTIONS (security definer, avoid RLS recursion) ============
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id = _tenant_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id uuid, _role public.tenant_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id = _tenant_id AND m.user_id = auth.uid() AND m.role = _role);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_tenant(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.tenant_members m
                 WHERE m.tenant_id = _tenant_id AND m.user_id = auth.uid()
                   AND m.role IN ('owner','admin'));
$$;

CREATE OR REPLACE FUNCTION public.can_write_tenant(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.is_tenant_member(_tenant_id);
$$;

-- auto-add creator as owner + default branding
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.tenant_branding (tenant_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_new_tenant AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant();

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tenant_branding_updated BEFORE UPDATE ON public.tenant_branding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS: tenants ============
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active tenants are viewable by everyone" ON public.tenants
  FOR SELECT USING (status = 'active' OR public.can_write_tenant(id));
CREATE POLICY "Authenticated users can create tenants" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Tenant admins can update their tenant" ON public.tenants
  FOR UPDATE TO authenticated USING (public.can_manage_tenant(id)) WITH CHECK (public.can_manage_tenant(id));
CREATE POLICY "Tenant owners can delete their tenant" ON public.tenants
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_tenant_role(id,'owner'));

ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branding is viewable by everyone" ON public.tenant_branding
  FOR SELECT USING (true);
CREATE POLICY "Tenant admins manage branding" ON public.tenant_branding
  FOR ALL TO authenticated USING (public.can_manage_tenant(tenant_id)) WITH CHECK (public.can_manage_tenant(tenant_id));

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their tenant memberships" ON public.tenant_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.can_manage_tenant(tenant_id));
CREATE POLICY "Tenant admins manage members" ON public.tenant_members
  FOR ALL TO authenticated USING (public.can_manage_tenant(tenant_id)) WITH CHECK (public.can_manage_tenant(tenant_id));

-- ============ DEFAULT TENANT + BACKFILL ============
INSERT INTO public.tenants (slug, name, status, onboarding_completed)
VALUES ('default', 'Open Configurator', 'active', true);

ALTER TABLE public.categories ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.config_options ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.option_values ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.configuration_rules ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.pricing_rules ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.product_configurations ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.warehouses ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.categories SET tenant_id = (SELECT id FROM public.tenants WHERE slug='default');
UPDATE public.products SET tenant_id = (SELECT id FROM public.tenants WHERE slug='default');
UPDATE public.config_options SET tenant_id = (SELECT id FROM public.tenants WHERE slug='default');
UPDATE public.option_values SET tenant_id = (SELECT id FROM public.tenants WHERE slug='default');
UPDATE public.configuration_rules SET tenant_id = (SELECT id FROM public.tenants WHERE slug='default');
UPDATE public.pricing_rules SET tenant_id = (SELECT id FROM public.tenants WHERE slug='default');
UPDATE public.orders SET tenant_id = (SELECT id FROM public.tenants WHERE slug='default');
UPDATE public.product_configurations SET tenant_id = (SELECT id FROM public.tenants WHERE slug='default');
UPDATE public.warehouses SET tenant_id = (SELECT id FROM public.tenants WHERE slug='default');
UPDATE public.suppliers SET tenant_id = (SELECT id FROM public.tenants WHERE slug='default');

CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_categories_tenant ON public.categories(tenant_id);
CREATE INDEX idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX idx_product_configurations_tenant ON public.product_configurations(tenant_id);

-- ============ TENANT-SCOPED WRITE POLICIES ON CORE TABLES ============
-- categories
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
CREATE POLICY "Tenant members insert categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant(tenant_id));
CREATE POLICY "Tenant members update categories" ON public.categories
  FOR UPDATE TO authenticated USING (public.can_write_tenant(tenant_id)) WITH CHECK (public.can_write_tenant(tenant_id));
CREATE POLICY "Tenant members delete categories" ON public.categories
  FOR DELETE TO authenticated USING (public.can_write_tenant(tenant_id));

-- products
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Tenant members insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant(tenant_id));
CREATE POLICY "Tenant members update products" ON public.products
  FOR UPDATE TO authenticated USING (public.can_write_tenant(tenant_id)) WITH CHECK (public.can_write_tenant(tenant_id));
CREATE POLICY "Tenant members delete products" ON public.products
  FOR DELETE TO authenticated USING (public.can_write_tenant(tenant_id));

-- config_options
DROP POLICY IF EXISTS "Admins can insert config_options" ON public.config_options;
DROP POLICY IF EXISTS "Admins can update config_options" ON public.config_options;
DROP POLICY IF EXISTS "Admins can delete config_options" ON public.config_options;
CREATE POLICY "Tenant members insert config_options" ON public.config_options
  FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant(tenant_id));
CREATE POLICY "Tenant members update config_options" ON public.config_options
  FOR UPDATE TO authenticated USING (public.can_write_tenant(tenant_id)) WITH CHECK (public.can_write_tenant(tenant_id));
CREATE POLICY "Tenant members delete config_options" ON public.config_options
  FOR DELETE TO authenticated USING (public.can_write_tenant(tenant_id));

-- option_values
DROP POLICY IF EXISTS "Admins can insert option_values" ON public.option_values;
DROP POLICY IF EXISTS "Admins can update option_values" ON public.option_values;
DROP POLICY IF EXISTS "Admins can delete option_values" ON public.option_values;
CREATE POLICY "Tenant members insert option_values" ON public.option_values
  FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant(tenant_id));
CREATE POLICY "Tenant members update option_values" ON public.option_values
  FOR UPDATE TO authenticated USING (public.can_write_tenant(tenant_id)) WITH CHECK (public.can_write_tenant(tenant_id));
CREATE POLICY "Tenant members delete option_values" ON public.option_values
  FOR DELETE TO authenticated USING (public.can_write_tenant(tenant_id));

-- configuration_rules
DROP POLICY IF EXISTS "Admins can manage configuration rules" ON public.configuration_rules;
DROP POLICY IF EXISTS "Admins can view configuration rules" ON public.configuration_rules;
CREATE POLICY "Tenant members view configuration rules" ON public.configuration_rules
  FOR SELECT TO authenticated USING (public.can_write_tenant(tenant_id));
CREATE POLICY "Tenant members manage configuration rules" ON public.configuration_rules
  FOR ALL TO authenticated USING (public.can_write_tenant(tenant_id)) WITH CHECK (public.can_write_tenant(tenant_id));

-- pricing_rules
DROP POLICY IF EXISTS "Admins can manage pricing rules" ON public.pricing_rules;
CREATE POLICY "Tenant members manage pricing rules" ON public.pricing_rules
  FOR ALL TO authenticated USING (public.can_write_tenant(tenant_id)) WITH CHECK (public.can_write_tenant(tenant_id));

-- warehouses / suppliers
DROP POLICY IF EXISTS "Admins can manage warehouses" ON public.warehouses;
CREATE POLICY "Tenant members manage warehouses" ON public.warehouses
  FOR ALL TO authenticated USING (public.can_write_tenant(tenant_id)) WITH CHECK (public.can_write_tenant(tenant_id));
DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.suppliers;
CREATE POLICY "Tenant members manage suppliers" ON public.suppliers
  FOR ALL TO authenticated USING (public.can_write_tenant(tenant_id)) WITH CHECK (public.can_write_tenant(tenant_id));

-- orders: tenant admins can see their tenant's orders
CREATE POLICY "Tenant admins view tenant orders" ON public.orders
  FOR SELECT TO authenticated USING (tenant_id IS NOT NULL AND public.can_write_tenant(tenant_id));
CREATE POLICY "Tenant admins update tenant orders" ON public.orders
  FOR UPDATE TO authenticated USING (tenant_id IS NOT NULL AND public.can_write_tenant(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.can_write_tenant(tenant_id));

CREATE POLICY "Tenant admins view tenant configurations" ON public.product_configurations
  FOR SELECT TO authenticated USING (tenant_id IS NOT NULL AND public.can_write_tenant(tenant_id));
