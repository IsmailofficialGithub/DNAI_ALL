-- Migration: Fix phone column type from numeric to text
-- Date: 2025-10-28
-- Description: Changes phone column from numeric to text to support country codes and formatting

-- First, drop the column if it exists as numeric
-- This is safe because we'll preserve the data
DO $$ 
BEGIN
    -- Check if phone column exists and get its type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'phone'
    ) THEN
        -- If the column is numeric, we need to convert it
        -- First, create a temporary column to store the data as text
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_temp TEXT;
        
        -- Copy data from phone to phone_temp (convert numeric to text)
        UPDATE profiles SET phone_temp = phone::TEXT WHERE phone IS NOT NULL;
        
        -- Drop the old numeric phone column
        ALTER TABLE profiles DROP COLUMN IF EXISTS phone;
        
        -- Rename the temp column to phone
        ALTER TABLE profiles RENAME COLUMN phone_temp TO phone;
    END IF;
END $$;

-- Ensure phone is TEXT type
ALTER TABLE profiles ALTER COLUMN phone TYPE TEXT USING phone::TEXT;

-- Add index on phone for better query performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Add comment to document the column
COMMENT ON COLUMN profiles.phone IS 'User phone number with country code (optional, stored as text)';

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'phone';

