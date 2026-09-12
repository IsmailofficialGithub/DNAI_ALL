-- Migration: Add product_settings column to user_product_access table
-- Description: Stores product-specific settings for each user-product relationship
-- Format: JSONB with { "vapi_account": 1, "agent_number": 3, "duration_limit": 60, "list_limit": 1, "concurrency_limit": 3 }
-- Date: 2024

-- Add product_settings column as JSONB
ALTER TABLE user_product_access 
ADD COLUMN IF NOT EXISTS product_settings JSONB DEFAULT NULL;

-- Create GIN index for efficient querying of JSONB data
CREATE INDEX IF NOT EXISTS idx_user_product_access_settings 
ON user_product_access USING GIN (product_settings);

-- Add comment
COMMENT ON COLUMN user_product_access.product_settings IS 'Product-specific settings for the user: vapi_account, agent_number, duration_limit, list_limit, concurrency_limit';

