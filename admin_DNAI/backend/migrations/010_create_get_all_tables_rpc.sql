-- Migration: Create RPC function to get all tables from information_schema
-- Description: This function allows querying all tables in a schema dynamically
-- This is much faster and more reliable than checking table names one by one
-- 
-- IMPORTANT: Run this migration in EACH product database (not the admin database)
-- This allows the admin panel to discover all tables dynamically

-- Create function to get all tables in a schema (simple version - just table names)
CREATE OR REPLACE FUNCTION get_all_tables(schema_name TEXT DEFAULT 'public')
RETURNS TABLE (
  table_name TEXT
) 
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = schema_name
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
$$;

-- Grant execute permission (adjust based on your RLS policies)
-- Note: SECURITY DEFINER means it runs with creator's privileges
GRANT EXECUTE ON FUNCTION get_all_tables(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_tables(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_all_tables(TEXT) TO service_role;

COMMENT ON FUNCTION get_all_tables IS 'Returns all base table names in the specified schema from information_schema';

