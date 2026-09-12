-- Migration: Add package_id column to invoice_items table
-- Description: Adds package_id column to support packages in invoices instead of products
-- Date: 2024

-- Add package_id column to invoice_items table
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES packages(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_items_package_id ON invoice_items(package_id);

-- Add comment to column
COMMENT ON COLUMN invoice_items.package_id IS 'Reference to the package (replaces product_id for new invoices)';

-- Note: product_id column is kept for backward compatibility with existing invoices
-- New invoices will use package_id instead of product_id

