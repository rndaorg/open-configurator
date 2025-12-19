-- Create search_analytics table for tracking searches
CREATE TABLE public.search_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  filters_applied JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  clicked_product_id UUID REFERENCES public.products(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for popular searches
CREATE INDEX idx_search_analytics_query ON public.search_analytics(search_query);
CREATE INDEX idx_search_analytics_created_at ON public.search_analytics(created_at DESC);

-- Enable RLS
ALTER TABLE public.search_analytics ENABLE ROW LEVEL SECURITY;

-- Anyone can insert search analytics (for tracking)
CREATE POLICY "Anyone can insert search analytics"
ON public.search_analytics
FOR INSERT
WITH CHECK (true);

-- Admins can view all search analytics
CREATE POLICY "Admins can view search analytics"
ON public.search_analytics
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));