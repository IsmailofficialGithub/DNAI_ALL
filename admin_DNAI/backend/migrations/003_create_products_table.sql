-- Migration: Create products table
-- Description: Creates a products table to store available products/packages

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Insert default products
INSERT INTO products (name, description) VALUES
    ('Basic Package', 'Essential features for getting started with basic functionality and support'),
    ('Premium Package', 'Advanced features with priority support and enhanced capabilities'),
    ('Enterprise Package', 'Full-featured solution with dedicated support and custom integrations'),
    ('Analytics Module', 'Comprehensive analytics and reporting tools for data-driven insights'),
    ('Reporting Module', 'Customizable reporting dashboard with export capabilities'),
    ('API Access', 'Full API access for integration with third-party applications')
ON CONFLICT (name) DO NOTHING;

-- Add comment to table
COMMENT ON TABLE products IS 'Stores available products and packages that can be subscribed to';
COMMENT ON COLUMN products.id IS 'Unique identifier for the product (UUID)';
COMMENT ON COLUMN products.name IS 'Product name (unique)';
COMMENT ON COLUMN products.description IS 'Detailed description of the product';
COMMENT ON COLUMN products.created_at IS 'Timestamp when product was created';
COMMENT ON COLUMN products.updated_at IS 'Timestamp when product was last updated';

