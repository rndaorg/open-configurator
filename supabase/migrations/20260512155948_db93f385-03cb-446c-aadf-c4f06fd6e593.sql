
CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  configuration_id uuid,
  order_id uuid,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  content text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_verified_purchase boolean NOT NULL DEFAULT false,
  helpful_count integer NOT NULL DEFAULT 0,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_reviews_product ON public.product_reviews(product_id, status);
CREATE INDEX idx_product_reviews_user ON public.product_reviews(user_id);
CREATE UNIQUE INDEX idx_product_reviews_unique_user_product ON public.product_reviews(user_id, product_id);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved reviews are viewable by everyone"
ON public.product_reviews FOR SELECT
USING (status = 'approved');

CREATE POLICY "Users can view their own reviews"
ON public.product_reviews FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reviews"
ON public.product_reviews FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own reviews"
ON public.product_reviews FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.product_reviews FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can update any review"
ON public.product_reviews FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own reviews"
ON public.product_reviews FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any review"
ON public.product_reviews FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_product_reviews_updated_at
BEFORE UPDATE ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aggregate ratings view (publicly readable)
CREATE OR REPLACE VIEW public.product_rating_summary
WITH (security_invoker = true) AS
SELECT
  product_id,
  COUNT(*)::int AS review_count,
  ROUND(AVG(rating)::numeric, 2) AS average_rating
FROM public.product_reviews
WHERE status = 'approved'
GROUP BY product_id;

GRANT SELECT ON public.product_rating_summary TO anon, authenticated;

-- Helper function to mark verified purchase based on user's orders
CREATE OR REPLACE FUNCTION public.set_review_verified_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = NEW.user_id
      AND o.product_id = NEW.product_id
      AND o.status IN ('paid','shipped','delivered','completed')
  ) THEN
    NEW.is_verified_purchase := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_review_verified_purchase
BEFORE INSERT ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_review_verified_purchase();
