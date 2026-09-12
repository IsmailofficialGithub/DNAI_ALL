-- Migration: Update get_all_tables function to support multiple schemas
-- Description: Updates the RPC function to return tables from all organized schemas
-- This allows the admin panel to discover tables in outbound, inbound, billing, admin, analytics, content schemas
-- Date: 2025-01-XX
--
-- IMPORTANT: Run this migration in EACH product database (not the admin database)

-- Drop old function if exists
DROP FUNCTION IF EXISTS get_all_tables(TEXT);

-- Create new function that returns tables from all schemas
CREATE OR REPLACE FUNCTION get_all_tables(schema_names TEXT[] DEFAULT ARRAY['public', 'outbound', 'inbound', 'billing', 'admin', 'analytics', 'content'])
RETURNS TABLE (
  table_schema TEXT,
  table_name TEXT
) 
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    t.table_schema::TEXT,
    t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = ANY(schema_names)
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'  -- Exclude PostgreSQL system tables
    AND t.table_name NOT LIKE '_%'     -- Exclude Supabase internal tables
  ORDER BY 
    CASE t.table_schema
      WHEN 'public' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'outbound' THEN 3
      WHEN 'inbound' THEN 4
      WHEN 'billing' THEN 5
      WHEN 'content' THEN 6
      WHEN 'analytics' THEN 7
      ELSE 8
    END,
    t.table_name;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_all_tables(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_tables(TEXT[]) TO anon;
GRANT EXECUTE ON FUNCTION get_all_tables(TEXT[]) TO service_role;

-- Also keep the old single-schema version for backward compatibility
CREATE OR REPLACE FUNCTION get_all_tables(schema_name TEXT)
RETURNS TABLE (
  table_schema TEXT,
  table_name TEXT
) 
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    t.table_schema::TEXT,
    t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = schema_name
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE '_%'
  ORDER BY t.table_name;
$$;

GRANT EXECUTE ON FUNCTION get_all_tables(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_tables(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_all_tables(TEXT) TO service_role;

COMMENT ON FUNCTION get_all_tables(TEXT[]) IS 'Returns all base tables from multiple schemas (public, outbound, inbound, billing, admin, analytics, content)';
COMMENT ON FUNCTION get_all_tables(TEXT) IS 'Returns all base tables from a single specified schema (backward compatible)';
