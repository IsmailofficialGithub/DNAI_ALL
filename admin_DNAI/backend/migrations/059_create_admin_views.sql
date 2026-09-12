-- Migration: Create VIEWs for admin schema tables
-- Description: Creates VIEWs in public schema pointing to admin schema tables
-- This allows frontend to query admin tables without schema prefix
-- Date: 2025-01-XX

-- ============================================================================
-- ADMIN SCHEMA VIEWS
-- ============================================================================

-- Create consumers VIEW
-- Note: consumers might be a VIEW (auth_role_with_profiles) or a table
-- Check what exists and create appropriate VIEW
DO $$
BEGIN
  -- Check if admin.consumers table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'admin' AND table_name = 'consumers') THEN
    -- Create VIEW pointing to admin.consumers
    EXECUTE 'CREATE OR REPLACE VIEW public.consumers AS SELECT * FROM admin.consumers';
    RAISE NOTICE 'Created consumers VIEW pointing to admin.consumers';
  -- Check if public.consumers table exists
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'consumers') THEN
    -- Consumers table is in public schema, create VIEW pointing to itself (for consistency)
    EXECUTE 'CREATE OR REPLACE VIEW public.consumers AS SELECT * FROM public.consumers';
    RAISE NOTICE 'Created consumers VIEW pointing to public.consumers';
  -- Check if auth_role_with_profiles VIEW exists (this is what the backend uses)
  ELSIF EXISTS (SELECT 1 FROM information_schema.views 
                WHERE table_schema = 'public' AND table_name = 'auth_role_with_profiles') THEN
    -- Create consumers VIEW that filters auth_role_with_profiles for consumers
    EXECUTE 'CREATE OR REPLACE VIEW public.consumers AS 
             SELECT * FROM public.auth_role_with_profiles 
             WHERE role @> ARRAY[''consumer'']::text[]';
    RAISE NOTICE 'Created consumers VIEW based on auth_role_with_profiles';
  ELSE
    -- No consumers table/view found, skip VIEW creation
    RAISE NOTICE 'consumers table/view not found, skipping VIEW creation. You may need to create the consumers table first.';
  END IF;
  
  -- Check if admin.users table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'admin' AND table_name = 'users') THEN
    -- Create VIEW pointing to admin.users
    EXECUTE 'CREATE OR REPLACE VIEW public.admin_users AS SELECT * FROM admin.users';
    RAISE NOTICE 'Created admin_users VIEW pointing to admin.users';
  -- Check if public.users table exists
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'users') THEN
    -- Users table is in public schema, create VIEW pointing to itself
    EXECUTE 'CREATE OR REPLACE VIEW public.admin_users AS SELECT * FROM public.users';
    RAISE NOTICE 'Created admin_users VIEW pointing to public.users';
  ELSE
    -- Table doesn't exist, skip VIEW creation
    RAISE NOTICE 'users table not found in admin or public schema, skipping VIEW creation';
  END IF;
END $$;

-- Grant permissions on VIEWs (only if they exist)
DO $$
BEGIN
  -- Grant permissions on consumers VIEW if it exists
  IF EXISTS (SELECT 1 FROM information_schema.views 
             WHERE table_schema = 'public' AND table_name = 'consumers') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.consumers TO authenticated, anon, service_role';
    RAISE NOTICE 'Granted permissions on public.consumers';
  END IF;
  
  -- Grant permissions on admin_users VIEW if it exists
  IF EXISTS (SELECT 1 FROM information_schema.views 
             WHERE table_schema = 'public' AND table_name = 'admin_users') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated, anon, service_role';
    RAISE NOTICE 'Granted permissions on public.admin_users';
  END IF;
END $$;

-- Add comments (only if VIEWs exist)
DO $$
BEGIN
  -- Add comment on consumers VIEW if it exists
  IF EXISTS (SELECT 1 FROM information_schema.views 
             WHERE table_schema = 'public' AND table_name = 'consumers') THEN
    EXECUTE 'COMMENT ON VIEW public.consumers IS ''VIEW for backward compatibility - points to admin.consumers or auth_role_with_profiles''';
    RAISE NOTICE 'Added comment on public.consumers';
  END IF;
  
  -- Add comment on admin_users VIEW if it exists
  IF EXISTS (SELECT 1 FROM information_schema.views 
             WHERE table_schema = 'public' AND table_name = 'admin_users') THEN
    EXECUTE 'COMMENT ON VIEW public.admin_users IS ''VIEW for backward compatibility - points to admin.users or public.users''';
    RAISE NOTICE 'Added comment on public.admin_users';
  END IF;
END $$;
