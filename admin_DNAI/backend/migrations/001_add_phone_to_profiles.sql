-- Migration: Add phone column to profiles table
-- Date: 2025-10-28
-- Description: Adds phone number support to user profiles

-- Add phone column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add index on phone for better query performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Add comment to document the column
COMMENT ON COLUMN profiles.phone IS 'User phone number (optional)';

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'phone';

