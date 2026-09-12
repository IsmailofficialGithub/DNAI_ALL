-- Migration: Add auto-topup columns to user_credits table
-- Description: Adds auto_topup_enabled, auto_topup_amount, and auto_topup_threshold columns
-- Date: 2025-01-XX

-- ============================================================================
-- user_credits table updates (inbound schema)
-- ============================================================================

-- Add auto_topup_enabled column to inbound.user_credits table
ALTER TABLE inbound.user_credits 
ADD COLUMN IF NOT EXISTS auto_topup_enabled boolean DEFAULT false;

-- Add auto_topup_amount column to inbound.user_credits table
ALTER TABLE inbound.user_credits 
ADD COLUMN IF NOT EXISTS auto_topup_amount numeric(10, 2);

-- Add auto_topup_threshold column to inbound.user_credits table
ALTER TABLE inbound.user_credits 
ADD COLUMN IF NOT EXISTS auto_topup_threshold numeric(10, 2);

-- Create index for faster queries filtering by auto_topup_enabled
CREATE INDEX IF NOT EXISTS idx_user_credits_auto_topup_enabled 
ON inbound.user_credits(auto_topup_enabled) 
WHERE auto_topup_enabled = true;

-- Add comments to columns
COMMENT ON COLUMN inbound.user_credits.auto_topup_enabled IS 'Whether automatic top-up is enabled for this user. When enabled, credits will be automatically purchased when balance falls below threshold.';
COMMENT ON COLUMN inbound.user_credits.auto_topup_amount IS 'Amount of credits to purchase when auto-topup is triggered (in currency units).';
COMMENT ON COLUMN inbound.user_credits.auto_topup_threshold IS 'Credit balance threshold that triggers auto-topup when balance falls below this value.';

-- Update the public view to include new columns
CREATE OR REPLACE VIEW public.user_credits AS 
SELECT * FROM inbound.user_credits;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_credits TO authenticated, anon, service_role;
