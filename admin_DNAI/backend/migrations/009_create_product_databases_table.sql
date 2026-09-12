-- Migration: Create product_databases table
-- Description: Creates a table to store database connection details for each product
-- This enables the admin panel to connect to different product databases

-- Create product_databases table
CREATE TABLE IF NOT EXISTS product_databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE UNIQUE,
  product_name VARCHAR(255) NOT NULL,
  
  -- Connection details (store encrypted in production)
  db_type VARCHAR(50) NOT NULL DEFAULT 'supabase',
  supabase_url TEXT,
  supabase_service_key_encrypted TEXT,
  
  -- Alternative: Direct PostgreSQL connection (if needed)
  postgres_host TEXT,
  postgres_port INTEGER DEFAULT 5432,
  postgres_database TEXT,
  postgres_user_encrypted TEXT,
  postgres_password_encrypted TEXT,
  
  -- Configuration
  schema_name VARCHAR(100) DEFAULT 'public',
  is_active BOOLEAN DEFAULT true,
  health_status VARCHAR(20) DEFAULT 'unknown', -- 'healthy', 'degraded', 'down'
  last_health_check TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_databases_product_id ON product_databases(product_id);
CREATE INDEX IF NOT EXISTS idx_product_databases_active ON product_databases(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_databases_health_status ON product_databases(health_status);

-- Ensure only one database configuration per product (unique constraint)
-- This enforces one-to-one relationship at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_databases_unique_product 
  ON product_databases(product_id) 
  WHERE is_active = true;

-- Add comments
COMMENT ON TABLE product_databases IS 'Stores database connection details for each product';
COMMENT ON COLUMN product_databases.product_id IS 'Reference to the product';
COMMENT ON COLUMN product_databases.db_type IS 'Type of database: supabase, postgres, mysql, etc.';
COMMENT ON COLUMN product_databases.supabase_service_key_encrypted IS 'Encrypted Supabase service role key';
COMMENT ON COLUMN product_databases.health_status IS 'Current health status of the database connection';

