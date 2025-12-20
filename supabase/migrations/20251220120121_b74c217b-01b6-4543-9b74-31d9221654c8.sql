-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'order_status', 'inventory_alert', 'price_change', 'system'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications (via service role)
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(user_id, is_read);

-- Enable realtime for notifications, orders, and inventory_levels
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_levels REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_levels;

-- Create function to notify on order status change
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'order_status',
      'Order Status Updated',
      'Your order #' || LEFT(NEW.id::text, 8) || ' status changed to ' || NEW.status,
      jsonb_build_object('order_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for order status changes
CREATE TRIGGER on_order_status_change
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();

-- Create function to check low stock and create admin notifications
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER AS $$
DECLARE
  admin_users UUID[];
  admin_id UUID;
BEGIN
  IF NEW.available_quantity <= NEW.low_stock_threshold AND 
     (OLD.available_quantity IS NULL OR OLD.available_quantity > OLD.low_stock_threshold) THEN
    -- Get all admin user IDs
    SELECT ARRAY_AGG(user_id) INTO admin_users FROM public.user_roles WHERE role = 'admin';
    
    IF admin_users IS NOT NULL THEN
      FOREACH admin_id IN ARRAY admin_users LOOP
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
          admin_id,
          'inventory_alert',
          'Low Stock Alert',
          'An item is running low on stock (Qty: ' || NEW.available_quantity || ')',
          jsonb_build_object('option_value_id', NEW.option_value_id, 'available_quantity', NEW.available_quantity, 'threshold', NEW.low_stock_threshold)
        );
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for low stock notifications
CREATE TRIGGER on_low_stock
AFTER INSERT OR UPDATE ON public.inventory_levels
FOR EACH ROW
EXECUTE FUNCTION public.notify_low_stock();