-- Migration: Add missing columns to package_features table
-- Description: Adds columns required by the frontend for package features
-- Date: 2025-01-XX

-- ============================================================================
-- package_features table updates (inbound schema)
-- ============================================================================

-- Add 'feature_key' column (key identifier for the feature)
ALTER TABLE inbound.package_features 
ADD COLUMN IF NOT EXISTS feature_key character varying(255);

-- Add 'feature_label' column (display label for the feature)
ALTER TABLE inbound.package_features 
ADD COLUMN IF NOT EXISTS feature_label character varying(255);

-- Add 'feature_template' column (template string for rendering the feature)
ALTER TABLE inbound.package_features 
ADD COLUMN IF NOT EXISTS feature_template text;

-- Add 'display_order' column (order for displaying features)
ALTER TABLE inbound.package_features 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Add 'is_highlighted' column (whether the feature should be highlighted)
ALTER TABLE inbound.package_features 
ADD COLUMN IF NOT EXISTS is_highlighted boolean DEFAULT false;

-- Sync existing data: copy feature_name to feature_key and feature_label if they are NULL
UPDATE inbound.package_features
SET feature_key = feature_name,
    feature_label = feature_name
WHERE feature_key IS NULL OR feature_label IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_package_features_feature_key ON inbound.package_features(feature_key);
CREATE INDEX IF NOT EXISTS idx_package_features_display_order ON inbound.package_features(display_order);
CREATE INDEX IF NOT EXISTS idx_package_features_is_highlighted ON inbound.package_features(is_highlighted);

-- Add comments to columns
COMMENT ON COLUMN inbound.package_features.feature_key IS 'Key identifier for the feature (used programmatically)';
COMMENT ON COLUMN inbound.package_features.feature_label IS 'Display label for the feature (shown to users)';
COMMENT ON COLUMN inbound.package_features.feature_template IS 'Template string for rendering the feature with variables';
COMMENT ON COLUMN inbound.package_features.display_order IS 'Order for displaying features (lower numbers appear first)';
COMMENT ON COLUMN inbound.package_features.is_highlighted IS 'Whether the feature should be highlighted prominently';

-- Update the public view to include new columns
CREATE OR REPLACE VIEW public.package_features AS 
SELECT * FROM inbound.package_features;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_features TO authenticated, anon, service_role;
