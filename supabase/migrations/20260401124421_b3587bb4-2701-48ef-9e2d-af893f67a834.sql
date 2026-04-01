-- Drop the overly permissive anonymous SELECT policy
DROP POLICY IF EXISTS "Anonymous users can view their session configurations" ON public.product_configurations;

-- Add a more restrictive anonymous SELECT policy that requires matching session_id via RPC
-- Since anon users can't prove session ownership via RLS alone, we remove direct anon SELECT
-- Configurations should be retrieved via the validate-and-save-configuration edge function instead