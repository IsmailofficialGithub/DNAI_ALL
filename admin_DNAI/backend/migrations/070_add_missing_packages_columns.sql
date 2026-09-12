-- Migration: Add missing columns to packages table
-- Description: Adds columns required by the frontend for package management
-- Date: 2025-01-XX

-- ============================================================================
-- packages table updates (billing schema)
-- ============================================================================

-- Add 'slug' column (URL-friendly identifier)
ALTER TABLE billing.packages 
ADD COLUMN IF NOT EXISTS slug character varying(255);

-- Add 'tier' column (package tier: free, pro, premium, enterprise)
ALTER TABLE billing.packages 
ADD COLUMN IF NOT EXISTS tier character varying(50) DEFAULT 'free';

-- Add 'price_monthly' column (monthly subscription price)
ALTER TABLE billing.packages 
ADD COLUMN IF NOT EXISTS price_monthly numeric(10, 2);

-- Add 'price_yearly' column (yearly subscription price)
ALTER TABLE billing.packages 
ADD COLUMN IF NOT EXISTS price_yearly numeric(10, 2);

-- Add 'currency' column (currency code, e.g., USD, EUR)
ALTER TABLE billing.packages 
ADD COLUMN IF NOT EXISTS currency character varying(10) DEFAULT 'USD';

-- Add 'credits_included' column (number of credits included in the package)
ALTER TABLE billing.packages 
ADD COLUMN IF NOT EXISTS credits_included integer;

-- Add 'is_active' column (whether the package is active and available)
ALTER TABLE billing.packages 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add 'is_featured' column (whether the package should be featured)
ALTER TABLE billing.packages 
ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Add 'sort_order' column (order for displaying packages)
ALTER TABLE billing.packages 
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Add 'metadata' column (additional package metadata as JSON)
ALTER TABLE billing.packages 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Sync existing data: copy price to price_monthly if price_monthly is NULL
UPDATE billing.packages
SET price_monthly = price
WHERE price_monthly IS NULL AND price IS NOT NULL;

-- Generate slugs from names if slug is NULL
UPDATE billing.packages
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- Make slugs unique by appending package ID suffix for duplicates
DO $$
DECLARE
  pkg_record RECORD;
  base_slug TEXT;
  new_slug TEXT;
  counter INTEGER;
BEGIN
  FOR pkg_record IN 
    SELECT id, slug, name 
    FROM billing.packages 
    WHERE slug IS NOT NULL AND slug != ''
    ORDER BY created_at
  LOOP
    base_slug := pkg_record.slug;
    new_slug := base_slug;
    counter := 1;
    
    -- Check if slug is duplicate and make it unique
    WHILE EXISTS (
      SELECT 1 FROM billing.packages 
      WHERE slug = new_slug AND id != pkg_record.id
    ) LOOP
      new_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    
    -- Update slug if it was changed
    IF new_slug != pkg_record.slug THEN
      UPDATE billing.packages
      SET slug = new_slug
      WHERE id = pkg_record.id;
    END IF;
  END LOOP;
END $$;

-- Drop unique index if it exists (in case migration was partially run)
DROP INDEX IF EXISTS billing.idx_packages_slug_unique;
DROP INDEX IF EXISTS idx_packages_slug_unique;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_packages_slug ON billing.packages(slug);
CREATE INDEX IF NOT EXISTS idx_packages_tier ON billing.packages(tier);
CREATE INDEX IF NOT EXISTS idx_packages_is_active ON billing.packages(is_active);
CREATE INDEX IF NOT EXISTS idx_packages_is_featured ON billing.packages(is_featured);
CREATE INDEX IF NOT EXISTS idx_packages_sort_order ON billing.packages(sort_order);
CREATE INDEX IF NOT EXISTS idx_packages_metadata ON billing.packages USING GIN (metadata);

-- Add unique constraint on slug (now that duplicates are resolved)
CREATE UNIQUE INDEX idx_packages_slug_unique ON billing.packages(slug) WHERE slug IS NOT NULL AND slug != '';

-- Add comments to columns
COMMENT ON COLUMN billing.packages.slug IS 'URL-friendly identifier for the package';
COMMENT ON COLUMN billing.packages.tier IS 'Package tier: free, pro, premium, enterprise';
COMMENT ON COLUMN billing.packages.price_monthly IS 'Monthly subscription price';
COMMENT ON COLUMN billing.packages.price_yearly IS 'Yearly subscription price';
COMMENT ON COLUMN billing.packages.currency IS 'Currency code (e.g., USD, EUR)';
COMMENT ON COLUMN billing.packages.credits_included IS 'Number of credits included in the package';
COMMENT ON COLUMN billing.packages.is_active IS 'Whether the package is active and available for purchase';
COMMENT ON COLUMN billing.packages.is_featured IS 'Whether the package should be featured prominently';
COMMENT ON COLUMN billing.packages.sort_order IS 'Order for displaying packages (lower numbers appear first)';
COMMENT ON COLUMN billing.packages.metadata IS 'Additional package metadata stored as JSON';

-- Update the public view to include new columns
CREATE OR REPLACE VIEW public.packages AS 
SELECT * FROM billing.packages;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated, anon, service_role;
