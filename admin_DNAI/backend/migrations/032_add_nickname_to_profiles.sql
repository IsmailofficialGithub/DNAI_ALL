-- Migration: Add nickname column to profiles table
-- Date: 2025-01-XX
-- Description: Adds nickname/label support to user profiles for custom user identification

-- Add nickname column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Add index on nickname for better query performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON profiles(nickname)
WHERE nickname IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN profiles.nickname IS 'User nickname or label for custom identification (optional)';

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'nickname';

