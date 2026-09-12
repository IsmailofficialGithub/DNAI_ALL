-- Migration: Add is_active column to bank_account_details table
-- Description: Adds is_active column to bank_account_details for filtering active bank accounts
-- Date: 2025-01-XX

-- ============================================================================
-- bank_account_details table updates (inbound schema)
-- ============================================================================

-- Add is_active column to inbound.bank_account_details table
ALTER TABLE inbound.bank_account_details 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Create index for faster queries filtering active accounts
CREATE INDEX IF NOT EXISTS idx_bank_account_details_is_active 
ON inbound.bank_account_details(is_active) 
WHERE is_active = true;

-- Add comment to column
COMMENT ON COLUMN inbound.bank_account_details.is_active IS 'Whether this bank account is currently active and available for use. Defaults to true.';

-- Update the public view to include is_active column
CREATE OR REPLACE VIEW public.bank_account_details AS 
SELECT * FROM inbound.bank_account_details;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_account_details TO authenticated, anon, service_role;
