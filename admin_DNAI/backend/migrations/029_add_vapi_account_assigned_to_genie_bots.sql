-- Migration: Add vapi_account_assigned column to genie_bots table
-- Description: Adds a foreign key column to link genie_bots to Vapi_accounts
-- Date: 2024

-- Add vapi_account_assigned column to genie_bots table
ALTER TABLE genie_bots
ADD COLUMN IF NOT EXISTS vapi_account_assigned BIGINT REFERENCES public."Vapi_accounts"(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_genie_bots_vapi_account_assigned ON genie_bots(vapi_account_assigned) 
WHERE vapi_account_assigned IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN genie_bots.vapi_account_assigned IS 'Reference to the assigned Vapi account (foreign key to Vapi_accounts.id)';

