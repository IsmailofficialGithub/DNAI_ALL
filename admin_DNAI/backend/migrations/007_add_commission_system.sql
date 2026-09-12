-- Migration: Add Commission System for Resellers
-- Date: 2025-11-03
-- Description: Adds commission_rate to profiles and creates app_settings table for default commission

-- Step 1: Create app_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES auth.users(id)
);

-- Step 2: Add commission_rate column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS commission_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Step 3: Add index on commission_rate for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_commission_rate ON profiles(commission_rate) 
WHERE commission_rate IS NOT NULL;

-- Step 4: Insert default commission setting (10%)
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES ('default_reseller_commission', '10.00', 'Default commission rate for resellers (percentage)')
ON CONFLICT (setting_key) DO NOTHING;

-- Step 5: Add comments to document the columns
COMMENT ON COLUMN profiles.commission_rate IS 'Custom commission rate for reseller (NULL = use default)';
COMMENT ON COLUMN profiles.commission_updated_at IS 'Timestamp when custom commission was set';
COMMENT ON TABLE app_settings IS 'Application-wide settings stored as key-value pairs';

-- Step 6: Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('commission_rate', 'commission_updated_at');

-- Verify app_settings table
SELECT 
  setting_key, 
  setting_value, 
  description
FROM app_settings 
WHERE setting_key = 'default_reseller_commission';

