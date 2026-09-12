-- Migration: Move tables to feature schemas with backward-compatible VIEWs
-- Description: Moves tables to appropriate schemas and creates VIEWs in public schema
-- This ensures existing code continues to work without modification
-- Date: 2025-01-XX
-- 
-- IMPORTANT: Run this migration in batches. Start with a few tables, test, then continue.
-- This is an EXAMPLE - customize based on your actual table names and needs.

-- ============================================================================
-- OUTBOUND TABLES
-- ============================================================================

-- Move outbound-related tables
DO $$
BEGIN
  -- Only move if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voice_agents') THEN
    ALTER TABLE public.voice_agents SET SCHEMA outbound;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_calls') THEN
    ALTER TABLE public.agent_calls SET SCHEMA outbound;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_analytics') THEN
    ALTER TABLE public.agent_analytics SET SCHEMA outbound;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_schedules') THEN
    ALTER TABLE public.agent_schedules SET SCHEMA outbound;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_prompts') THEN
    ALTER TABLE public.ai_prompts SET SCHEMA outbound;
  END IF;
END $$;

-- Create VIEWs in public schema for backward compatibility
CREATE OR REPLACE VIEW public.voice_agents AS 
  SELECT * FROM outbound.voice_agents;

CREATE OR REPLACE VIEW public.agent_calls AS 
  SELECT * FROM outbound.agent_calls;

CREATE OR REPLACE VIEW public.agent_analytics AS 
  SELECT * FROM outbound.agent_analytics;

CREATE OR REPLACE VIEW public.agent_schedules AS 
  SELECT * FROM outbound.agent_schedules;

CREATE OR REPLACE VIEW public.ai_prompts AS 
  SELECT * FROM outbound.ai_prompts;

-- Grant permissions on VIEWs (same as original tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_agents TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_calls TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_analytics TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_schedules TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompts TO authenticated, anon, service_role;

-- ============================================================================
-- INBOUND TABLES
-- ============================================================================

-- Move inbound-related tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inbound_numbers') THEN
    ALTER TABLE public.inbound_numbers SET SCHEMA inbound;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'call_history') THEN
    ALTER TABLE public.call_history SET SCHEMA inbound;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'call_recordings') THEN
    ALTER TABLE public.call_recordings SET SCHEMA inbound;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'call_schedules') THEN
    ALTER TABLE public.call_schedules SET SCHEMA inbound;
  END IF;
END $$;

-- Create VIEWs
CREATE OR REPLACE VIEW public.inbound_numbers AS 
  SELECT * FROM inbound.inbound_numbers;

CREATE OR REPLACE VIEW public.call_history AS 
  SELECT * FROM inbound.call_history;

CREATE OR REPLACE VIEW public.call_recordings AS 
  SELECT * FROM inbound.call_recordings;

CREATE OR REPLACE VIEW public.call_schedules AS 
  SELECT * FROM inbound.call_schedules;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_numbers TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_history TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_recordings TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_schedules TO authenticated, anon, service_role;

-- ============================================================================
-- BILLING TABLES
-- ============================================================================

-- Move billing-related tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    ALTER TABLE public.invoices SET SCHEMA billing;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_history') THEN
    ALTER TABLE public.payment_history SET SCHEMA billing;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchases') THEN
    ALTER TABLE public.purchases SET SCHEMA billing;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_subscriptions') THEN
    ALTER TABLE public.user_subscriptions SET SCHEMA billing;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'packages') THEN
    ALTER TABLE public.packages SET SCHEMA billing;
  END IF;
END $$;

-- Create VIEWs
CREATE OR REPLACE VIEW public.invoices AS 
  SELECT * FROM billing.invoices;

CREATE OR REPLACE VIEW public.payment_history AS 
  SELECT * FROM billing.payment_history;

CREATE OR REPLACE VIEW public.purchases AS 
  SELECT * FROM billing.purchases;

CREATE OR REPLACE VIEW public.user_subscriptions AS 
  SELECT * FROM billing.user_subscriptions;

CREATE OR REPLACE VIEW public.packages AS 
  SELECT * FROM billing.packages;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_history TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated, anon, service_role;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- 1. Foreign keys are automatically updated when tables are moved
-- 2. Indexes move with tables automatically
-- 3. RLS policies need to be recreated on moved tables (they reference schema)
-- 4. Functions/triggers may need schema updates
-- 5. Test thoroughly after each batch
-- 
-- To verify tables were moved:
-- SELECT table_schema, table_name 
-- FROM information_schema.tables 
-- WHERE table_schema IN ('outbound', 'inbound', 'billing')
-- ORDER BY table_schema, table_name;
--
-- To verify VIEWs work:
-- SELECT * FROM public.voice_agents LIMIT 1; -- Should work via VIEW
