-- Migration: Create user_product_access table
-- Description: Creates a table to track which products users/consumers have access to
-- Note: This matches the exact table structure provided by the user

CREATE TABLE user_product_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  granted_at TIMESTAMP DEFAULT NOW()
);

