-- Migration: Add lifetime_access column to profiles table
-- Description: Adds a boolean column to track if a consumer has lifetime access
-- This allows distinguishing between lifetime access and regular trial expiry

-- Add lifetime_access column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS lifetime_access BOOLEAN DEFAULT false;

-- Create index for faster queries on lifetime_access
CREATE INDEX IF NOT EXISTS idx_profiles_lifetime_access ON profiles(lifetime_access) WHERE lifetime_access = true;

-- Add comment to column
COMMENT ON COLUMN profiles.lifetime_access IS 'Indicates if the consumer has lifetime access (true) or regular trial/subscription (false/null)';

