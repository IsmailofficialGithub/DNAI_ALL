-- Migration: Add subscribed_products column to profiles table
-- Description: Adds a subscribed_products column to store array of product IDs

-- Add subscribed_products column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscribed_products UUID[] DEFAULT '{}';

-- Add comment to column
COMMENT ON COLUMN profiles.subscribed_products IS 'Array of product IDs (UUIDs) that the user is subscribed to';

-- Create index for faster lookups on subscribed products
CREATE INDEX IF NOT EXISTS idx_profiles_subscribed_products ON profiles USING GIN (subscribed_products);

