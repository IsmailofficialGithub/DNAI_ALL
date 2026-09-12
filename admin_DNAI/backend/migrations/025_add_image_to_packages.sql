-- =====================================================
-- Migration: Add Image Support to Packages
-- Description: Adds image_url column to packages table for storing package images
-- Date: 2025-01-XX
-- =====================================================

-- Add image_url column to packages table
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment
COMMENT ON COLUMN packages.image_url IS 'URL to the package image stored in Supabase Storage (format: packages/{packageId}/{filename})';

-- Create index for faster lookups (if needed for filtering)
CREATE INDEX IF NOT EXISTS idx_packages_image_url ON packages(image_url) WHERE image_url IS NOT NULL;

