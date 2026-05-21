
DROP POLICY IF EXISTS "Authenticated users can create analytics" ON public.configuration_analytics;
CREATE POLICY "Authenticated users can create analytics"
ON public.configuration_analytics
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
