-- Template: Move ONE table to a new schema with backward-compatible VIEW
-- Description: Use this template to safely test moving one table at a time
-- 
-- INSTRUCTIONS:
-- 1. Replace 'TABLE_NAME_HERE' with your actual table name (3 places)
-- 2. Replace 'TARGET_SCHEMA_HERE' with target schema: outbound, inbound, billing, admin, or analytics
-- 3. Run this migration
-- 4. Test your application
-- 5. If successful, use this template for other tables

-- ============================================================================
-- STEP 1: Move the table to new schema
-- ============================================================================
DO $$
BEGIN
  -- Check if table exists before moving
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'TABLE_NAME_HERE') THEN
    ALTER TABLE public.TABLE_NAME_HERE SET SCHEMA TARGET_SCHEMA_HERE;
    RAISE NOTICE '✅ Table TABLE_NAME_HERE moved to TARGET_SCHEMA_HERE schema';
  ELSE
    RAISE NOTICE '⚠️ Table TABLE_NAME_HERE does not exist in public schema, skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create VIEW in public schema for backward compatibility
-- ============================================================================
CREATE OR REPLACE VIEW public.TABLE_NAME_HERE AS 
  SELECT * FROM TARGET_SCHEMA_HERE.TABLE_NAME_HERE;

-- ============================================================================
-- STEP 3: Grant permissions on VIEW (same as original table)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.TABLE_NAME_HERE 
  TO authenticated, anon, service_role;

-- ============================================================================
-- STEP 4: Verify the move was successful
-- ============================================================================
SELECT 
  '✅ Migration completed!' as status,
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'TABLE_NAME_HERE'
ORDER BY table_schema;

-- ============================================================================
-- STEP 5: Test the VIEW works (run these separately after migration)
-- ============================================================================
-- Test query via VIEW (should work - this is what your code uses)
-- SELECT * FROM public.TABLE_NAME_HERE LIMIT 1;

-- Test query via direct schema (should also work)
-- SELECT * FROM TARGET_SCHEMA_HERE.TABLE_NAME_HERE LIMIT 1;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Foreign keys are automatically updated when tables move
-- 2. Indexes move with tables automatically
-- 3. RLS policies may need to be recreated (check after moving)
-- 4. If you need to rollback, move table back:
--    ALTER TABLE TARGET_SCHEMA_HERE.TABLE_NAME_HERE SET SCHEMA public;
--    DROP VIEW IF EXISTS public.TABLE_NAME_HERE;
