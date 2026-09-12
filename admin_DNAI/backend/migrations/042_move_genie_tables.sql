-- Migration: Move Genie/Outbound Calling Tables
-- Description: Moves genie-related tables to outbound schema
-- These tables are related to outbound calling features
-- Date: 2025-01-XX
--
-- IMPORTANT: 
-- 1. Run the simple tables migration first (042_move_simple_tables_test.sql)
-- 2. Test thoroughly after this migration
-- 3. These tables have foreign key relationships - PostgreSQL handles them automatically

-- ============================================================================
-- OUTBOUND SCHEMA: Genie/Calling Tables
-- ============================================================================

-- Move genie_bots to outbound schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'genie_bots') THEN
    ALTER TABLE public.genie_bots SET SCHEMA outbound;
    RAISE NOTICE '✅ Table genie_bots moved to outbound schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.genie_bots AS 
  SELECT * FROM outbound.genie_bots;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.genie_bots 
  TO authenticated, anon, service_role;

-- Move genie_contact_lists to outbound schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'genie_contact_lists') THEN
    ALTER TABLE public.genie_contact_lists SET SCHEMA outbound;
    RAISE NOTICE '✅ Table genie_contact_lists moved to outbound schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.genie_contact_lists AS 
  SELECT * FROM outbound.genie_contact_lists;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.genie_contact_lists 
  TO authenticated, anon, service_role;

-- Move genie_contacts to outbound schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'genie_contacts') THEN
    ALTER TABLE public.genie_contacts SET SCHEMA outbound;
    RAISE NOTICE '✅ Table genie_contacts moved to outbound schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.genie_contacts AS 
  SELECT * FROM outbound.genie_contacts;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.genie_contacts 
  TO authenticated, anon, service_role;

-- Move genie_scheduled_calls to outbound schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'genie_scheduled_calls') THEN
    ALTER TABLE public.genie_scheduled_calls SET SCHEMA outbound;
    RAISE NOTICE '✅ Table genie_scheduled_calls moved to outbound schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.genie_scheduled_calls AS 
  SELECT * FROM outbound.genie_scheduled_calls;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.genie_scheduled_calls 
  TO authenticated, anon, service_role;

-- Move genie_leads to outbound schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'genie_leads') THEN
    ALTER TABLE public.genie_leads SET SCHEMA outbound;
    RAISE NOTICE '✅ Table genie_leads moved to outbound schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.genie_leads AS 
  SELECT * FROM outbound.genie_leads;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.genie_leads 
  TO authenticated, anon, service_role;

-- Move call_logs to outbound schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'call_logs') THEN
    ALTER TABLE public.call_logs SET SCHEMA outbound;
    RAISE NOTICE '✅ Table call_logs moved to outbound schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.call_logs AS 
  SELECT * FROM outbound.call_logs;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_logs 
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
WHERE table_name IN ('genie_bots', 'genie_contact_lists', 'genie_contacts', 
                     'genie_scheduled_calls', 'genie_leads', 'call_logs')
ORDER BY table_schema, table_name;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- Foreign keys are automatically updated when tables move.
-- However, if genie_bots references vapi_accounts (which stays in public),
-- that foreign key will still work because it references across schemas.
