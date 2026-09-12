-- Migration: Update subscribed_products to subscribed_packages
-- Description: Adds subscribed_packages column and creates user_package_access table
-- Note: This migration keeps subscribed_products for backward compatibility but adds new package support

-- Add subscribed_packages column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscribed_packages UUID[] DEFAULT '{}';

-- Add comment to column
COMMENT ON COLUMN profiles.subscribed_packages IS 'Array of package IDs (UUIDs) that the user is subscribed to';

-- Create index for faster lookups on subscribed packages
CREATE INDEX IF NOT EXISTS idx_profiles_subscribed_packages ON profiles USING GIN (subscribed_packages);

-- Create user_package_access table to track package access
CREATE TABLE IF NOT EXISTS user_package_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure one record per user-package combination
  UNIQUE(user_id, package_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_package_access_user_id ON user_package_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_package_access_package_id ON user_package_access(package_id);
CREATE INDEX IF NOT EXISTS idx_user_package_access_granted_at ON user_package_access(granted_at DESC);

-- Add comments
COMMENT ON TABLE user_package_access IS 'Tracks which packages users/consumers have access to';
COMMENT ON COLUMN user_package_access.user_id IS 'Reference to the user profile';
COMMENT ON COLUMN user_package_access.package_id IS 'Reference to the package';
COMMENT ON COLUMN user_package_access.granted_at IS 'Timestamp when access was granted';

