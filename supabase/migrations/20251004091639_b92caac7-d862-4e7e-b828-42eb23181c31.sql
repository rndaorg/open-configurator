-- Fix product_configurations security issue
-- Add user_id and session_id columns for proper access control

-- Add user_id column (nullable to preserve existing data)
ALTER TABLE product_configurations 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add session_id column for anonymous users
ALTER TABLE product_configurations 
ADD COLUMN session_id text;

-- Add index for better query performance
CREATE INDEX idx_product_configurations_user_id ON product_configurations(user_id);
CREATE INDEX idx_product_configurations_session_id ON product_configurations(session_id);

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can create product configurations" ON product_configurations;
DROP POLICY IF EXISTS "Anyone can view product configurations" ON product_configurations;

-- Create secure policies

-- Authenticated users can insert their own configurations
CREATE POLICY "Authenticated users can create their own configurations"
ON product_configurations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Anonymous users can insert with session_id (for guest checkout)
CREATE POLICY "Anonymous users can create configurations with session"
ON product_configurations
FOR INSERT
TO anon
WITH CHECK (session_id IS NOT NULL AND user_id IS NULL);

-- Authenticated users can view their own configurations
CREATE POLICY "Users can view their own configurations"
ON product_configurations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Anonymous users can view their session configurations
CREATE POLICY "Anonymous users can view their session configurations"
ON product_configurations
FOR SELECT
TO anon
USING (session_id IS NOT NULL AND user_id IS NULL);

-- Authenticated users can update their own configurations
CREATE POLICY "Users can update their own configurations"
ON product_configurations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own configurations
CREATE POLICY "Users can delete their own configurations"
ON product_configurations
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add comment explaining the security model
COMMENT ON TABLE product_configurations IS 'Stores product configurations with user-level or session-level access control. Authenticated users are tied to user_id, anonymous users to session_id.';