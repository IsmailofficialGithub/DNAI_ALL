-- Migration: Add missing columns to purchases table
-- Description: Adds columns required by the frontend for purchase management
-- Date: 2025-01-XX

-- ============================================================================
-- purchases table updates (inbound schema)
-- ============================================================================

-- Add purchase_type column
ALTER TABLE inbound.purchases 
ADD COLUMN IF NOT EXISTS purchase_type character varying(50) DEFAULT 'credits';

-- Add credits_amount column
ALTER TABLE inbound.purchases 
ADD COLUMN IF NOT EXISTS credits_amount numeric(10, 2) DEFAULT 0;

-- Add subtotal column
ALTER TABLE inbound.purchases 
ADD COLUMN IF NOT EXISTS subtotal numeric(10, 2);

-- Add discount_amount column
ALTER TABLE inbound.purchases 
ADD COLUMN IF NOT EXISTS discount_amount numeric(10, 2) DEFAULT 0;

-- Add total_amount column
ALTER TABLE inbound.purchases 
ADD COLUMN IF NOT EXISTS total_amount numeric(10, 2);

-- Add tax_rate column
ALTER TABLE inbound.purchases 
ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2) DEFAULT 0;

-- Add tax_amount column
ALTER TABLE inbound.purchases 
ADD COLUMN IF NOT EXISTS tax_amount numeric(10, 2) DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_type 
ON inbound.purchases(purchase_type);

CREATE INDEX IF NOT EXISTS idx_purchases_credits_amount 
ON inbound.purchases(credits_amount) 
WHERE credits_amount > 0;

-- Add comments to columns
COMMENT ON COLUMN inbound.purchases.purchase_type IS 'Type of purchase: credits, subscription, or package';
COMMENT ON COLUMN inbound.purchases.credits_amount IS 'Number of credits purchased in this transaction';
COMMENT ON COLUMN inbound.purchases.subtotal IS 'Subtotal amount before tax and discounts';
COMMENT ON COLUMN inbound.purchases.discount_amount IS 'Discount amount applied to the purchase';
COMMENT ON COLUMN inbound.purchases.total_amount IS 'Total amount after tax and discounts';
COMMENT ON COLUMN inbound.purchases.tax_rate IS 'Tax rate percentage applied';
COMMENT ON COLUMN inbound.purchases.tax_amount IS 'Tax amount calculated';

-- Update the public view to include new columns
CREATE OR REPLACE VIEW public.purchases AS 
SELECT * FROM inbound.purchases;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated, anon, service_role;
