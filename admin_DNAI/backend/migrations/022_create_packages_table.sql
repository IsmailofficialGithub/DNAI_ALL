-- Migration: Create packages table
-- Description: Creates a packages table to store packages that belong to products
-- Each product can have multiple packages (e.g., Free Plan, Premium, Enterprise)

-- Create packages table
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Ensure unique package names per product
    UNIQUE(product_id, name)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_packages_product_id ON packages(product_id);
CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(name);
CREATE INDEX IF NOT EXISTS idx_packages_created_at ON packages(created_at DESC);

-- Add comments
COMMENT ON TABLE packages IS 'Stores packages that belong to products. Each product can have multiple packages.';
COMMENT ON COLUMN packages.id IS 'Unique identifier for the package (UUID)';
COMMENT ON COLUMN packages.product_id IS 'Reference to the parent product';
COMMENT ON COLUMN packages.name IS 'Package name (unique per product)';
COMMENT ON COLUMN packages.description IS 'Detailed description of the package';
COMMENT ON COLUMN packages.price IS 'Package price (optional)';
COMMENT ON COLUMN packages.created_at IS 'Timestamp when package was created';
COMMENT ON COLUMN packages.updated_at IS 'Timestamp when package was last updated';

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER packages_updated_at_trigger
  BEFORE UPDATE ON packages
  FOR EACH ROW
  EXECUTE FUNCTION update_packages_updated_at();

-- Insert sample packages for existing products
-- Note: This assumes products exist. If no products exist, these inserts will be skipped.
DO $$
DECLARE
    product_record RECORD;
BEGIN
    -- For each product, create default packages
    FOR product_record IN SELECT id, name FROM products LIMIT 10 LOOP
        -- Insert Free Plan
        INSERT INTO packages (product_id, name, description, price)
        VALUES (product_record.id, 'Free Plan', 'Basic features with limited access', 0.00)
        ON CONFLICT (product_id, name) DO NOTHING;
        
        -- Insert Premium Plan
        INSERT INTO packages (product_id, name, description, price)
        VALUES (product_record.id, 'Premium', 'Advanced features with priority support', 29.99)
        ON CONFLICT (product_id, name) DO NOTHING;
        
        -- Insert Enterprise Plan
        INSERT INTO packages (product_id, name, description, price)
        VALUES (product_record.id, 'Enterprise', 'Full-featured solution with dedicated support', 99.99)
        ON CONFLICT (product_id, name) DO NOTHING;
    END LOOP;
END $$;

