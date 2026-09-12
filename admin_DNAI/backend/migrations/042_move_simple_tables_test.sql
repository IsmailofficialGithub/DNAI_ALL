-- Migration: Move Simple Tables (Test Batch)
-- Description: Moves simple tables with minimal dependencies as a safe test
-- Start with these tables first - they have few or no foreign key dependencies
-- Date: 2025-01-XX
--
-- IMPORTANT: Test this with 1-2 tables first, then continue with more

-- ============================================================================
-- BATCH 1: Simple Admin/Logging Tables (Safe to Start)
-- ============================================================================

-- Move error_logs to admin schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'error_logs') THEN
    ALTER TABLE public.error_logs SET SCHEMA admin;
    RAISE NOTICE '✅ Table error_logs moved to admin schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.error_logs AS 
  SELECT * FROM admin.error_logs;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_logs 
  TO authenticated, anon, service_role;

-- Move n8n_errors to admin schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'n8n_errors') THEN
    ALTER TABLE public.n8n_errors SET SCHEMA admin;
    RAISE NOTICE '✅ Table n8n_errors moved to admin schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.n8n_errors AS 
  SELECT * FROM admin.n8n_errors;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.n8n_errors 
  TO authenticated, anon, service_role;

-- Move api_keys to admin schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'api_keys') THEN
    ALTER TABLE public.api_keys SET SCHEMA admin;
    RAISE NOTICE '✅ Table api_keys moved to admin schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.api_keys AS 
  SELECT * FROM admin.api_keys;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys 
  TO authenticated, anon, service_role;

-- ============================================================================
-- VERIFICATION: Check what was moved
-- ============================================================================
SELECT 
  '✅ Migration completed!' as status,
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name IN ('error_logs', 'n8n_errors', 'api_keys')
ORDER BY table_schema, table_name;

-- ============================================================================
-- TEST QUERIES (Run these separately to verify VIEWs work)
-- ============================================================================
-- Test error_logs VIEW
-- SELECT * FROM public.error_logs LIMIT 1;
-- SELECT * FROM admin.error_logs LIMIT 1;

-- Test n8n_errors VIEW
-- SELECT * FROM public.n8n_errors LIMIT 1;
-- SELECT * FROM admin.n8n_errors LIMIT 1;

-- Test api_keys VIEW
-- SELECT * FROM public.api_keys LIMIT 1;
-- SELECT * FROM admin.api_keys LIMIT 1;
