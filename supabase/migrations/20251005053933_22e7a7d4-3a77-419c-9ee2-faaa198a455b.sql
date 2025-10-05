-- Fix user_preferences security issue
-- Restrict access so users can only view and manage their own preferences

-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Anyone can view user preferences" ON user_preferences;

-- Drop the public write policy (we'll add more restrictive ones)
DROP POLICY IF EXISTS "Anyone can create user preferences" ON user_preferences;

-- Authenticated users can view only their own preferences
CREATE POLICY "Users can view their own preferences"
ON user_preferences
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Authenticated users can create their own preferences
CREATE POLICY "Users can create their own preferences"
ON user_preferences
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own preferences
CREATE POLICY "Users can update their own preferences"
ON user_preferences
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own preferences
CREATE POLICY "Users can delete their own preferences"
ON user_preferences
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- For anonymous tracking: allow INSERT with null user_id (for recommendation engine)
-- This is for tracking anonymous user behavior without exposing other users' data
CREATE POLICY "Anonymous users can create anonymous preferences"
ON user_preferences
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Add comment explaining the security model
COMMENT ON TABLE user_preferences IS 'Stores user shopping preferences with strict user-level access control. Each user can only access their own preferences. Anonymous tracking allowed only for null user_id.';