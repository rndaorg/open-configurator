-- Fix: Replace overly permissive search_analytics INSERT policy
DROP POLICY IF EXISTS "Anyone can insert search analytics" ON public.search_analytics;

-- Allow authenticated users, enforcing their own user_id
CREATE POLICY "Authenticated users can insert own search analytics"
  ON public.search_analytics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow anon users but require user_id to be NULL
CREATE POLICY "Anonymous users can insert anonymous search analytics"
  ON public.search_analytics FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);