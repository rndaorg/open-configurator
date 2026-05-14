
-- Warehouses
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Warehouses viewable by authenticated" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage warehouses" ON public.warehouses FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_warehouses_updated BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Supplier products
CREATE TABLE public.supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  option_value_id UUID NOT NULL,
  supplier_sku TEXT,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  min_order_quantity INTEGER NOT NULL DEFAULT 1,
  lead_time_days INTEGER,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, option_value_id)
);
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage supplier_products" ON public.supplier_products FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_supplier_products_updated BEFORE UPDATE ON public.supplier_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Warehouse inventory (per-warehouse stock)
CREATE TABLE public.warehouse_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_value_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 10,
  reorder_quantity INTEGER NOT NULL DEFAULT 50,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (option_value_id, warehouse_id)
);
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage warehouse_inventory" ON public.warehouse_inventory FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated read warehouse_inventory" ON public.warehouse_inventory FOR SELECT TO authenticated USING (true);

-- Inventory batches
CREATE TABLE public.inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_value_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  remaining_quantity INTEGER NOT NULL DEFAULT 0,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage inventory_batches" ON public.inventory_batches FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_inventory_batches_updated BEFORE UPDATE ON public.inventory_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reorder alerts
CREATE TABLE public.reorder_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_value_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  current_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 0,
  suggested_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  notes TEXT
);
ALTER TABLE public.reorder_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage reorder_alerts" ON public.reorder_alerts FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX uq_reorder_alerts_pending ON public.reorder_alerts (option_value_id, warehouse_id) WHERE status = 'pending';

-- Inventory movements
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_value_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.inventory_batches(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read inventory_movements" ON public.inventory_movements FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert inventory_movements" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));

CREATE INDEX idx_warehouse_inventory_option ON public.warehouse_inventory(option_value_id);
CREATE INDEX idx_warehouse_inventory_warehouse ON public.warehouse_inventory(warehouse_id);
CREATE INDEX idx_batches_option_warehouse ON public.inventory_batches(option_value_id, warehouse_id);
CREATE INDEX idx_movements_option_warehouse ON public.inventory_movements(option_value_id, warehouse_id);
CREATE INDEX idx_supplier_products_option ON public.supplier_products(option_value_id);

-- Trigger: keep aggregate inventory_levels in sync with sum across warehouses
CREATE OR REPLACE FUNCTION public.sync_inventory_levels_aggregate()
RETURNS TRIGGER AS $$
DECLARE
  ovid UUID;
  total_avail INTEGER;
  total_reserved INTEGER;
  min_threshold INTEGER;
BEGIN
  ovid := COALESCE(NEW.option_value_id, OLD.option_value_id);
  SELECT COALESCE(SUM(available_quantity),0), COALESCE(SUM(reserved_quantity),0), COALESCE(MIN(low_stock_threshold),10)
    INTO total_avail, total_reserved, min_threshold
  FROM public.warehouse_inventory WHERE option_value_id = ovid;

  INSERT INTO public.inventory_levels (option_value_id, available_quantity, reserved_quantity, low_stock_threshold, updated_at)
  VALUES (ovid, total_avail, total_reserved, min_threshold, now())
  ON CONFLICT (option_value_id) DO UPDATE
    SET available_quantity = EXCLUDED.available_quantity,
        reserved_quantity = EXCLUDED.reserved_quantity,
        low_stock_threshold = EXCLUDED.low_stock_threshold,
        updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Need unique constraint on inventory_levels.option_value_id for ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_levels_option_value_id_key'
  ) THEN
    ALTER TABLE public.inventory_levels ADD CONSTRAINT inventory_levels_option_value_id_key UNIQUE (option_value_id);
  END IF;
END $$;

CREATE TRIGGER trg_warehouse_inventory_sync
AFTER INSERT OR UPDATE OR DELETE ON public.warehouse_inventory
FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_levels_aggregate();

-- Trigger: reorder alert + admin notification when stock drops to/below reorder point
CREATE OR REPLACE FUNCTION public.check_reorder_point()
RETURNS TRIGGER AS $$
DECLARE
  preferred_supplier UUID;
  admin_id UUID;
BEGIN
  IF NEW.available_quantity <= NEW.reorder_point AND
     (TG_OP = 'INSERT' OR OLD.available_quantity > OLD.reorder_point) THEN

    SELECT supplier_id INTO preferred_supplier
    FROM public.supplier_products
    WHERE option_value_id = NEW.option_value_id
    ORDER BY is_preferred DESC, cost_price ASC LIMIT 1;

    INSERT INTO public.reorder_alerts (option_value_id, warehouse_id, supplier_id, current_quantity, reorder_point, suggested_quantity, status)
    VALUES (NEW.option_value_id, NEW.warehouse_id, preferred_supplier, NEW.available_quantity, NEW.reorder_point, NEW.reorder_quantity, 'pending')
    ON CONFLICT (option_value_id, warehouse_id) WHERE status = 'pending' DO NOTHING;

    FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (admin_id, 'reorder_alert', 'Reorder Point Reached',
        'An item has reached its reorder point (qty: ' || NEW.available_quantity || ')',
        jsonb_build_object('option_value_id', NEW.option_value_id, 'warehouse_id', NEW.warehouse_id, 'suggested_quantity', NEW.reorder_quantity));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_warehouse_inventory_reorder
AFTER INSERT OR UPDATE OF available_quantity, reorder_point ON public.warehouse_inventory
FOR EACH ROW EXECUTE FUNCTION public.check_reorder_point();

-- Seed a default warehouse
INSERT INTO public.warehouses (name, code, is_default) VALUES ('Main Warehouse', 'MAIN', true)
ON CONFLICT (code) DO NOTHING;
