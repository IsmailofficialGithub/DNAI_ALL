-- Migration: Fix Foreign Key Relationships for Inbound VIEWs
-- Description: Creates helper functions and ensures foreign keys are discoverable
-- This fixes PostgREST relationship queries on VIEWs
-- Date: 2025-01-XX

-- ============================================================================
-- The Problem:
-- VIEWs don't preserve foreign key constraints, so Supabase PostgREST can't
-- discover relationships for queries like:
-- call_history?select=*,voice_agents:agent_id(*)
-- 
-- Solution: Query directly from schema or use manual joins
-- ============================================================================

-- Note: VIEWs cannot have foreign keys, but we can ensure the base tables do
-- The foreign keys already exist on the base tables in inbound schema

-- Verify foreign keys exist on base tables
DO $$
BEGIN
  -- Check if foreign keys exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'call_history_agent_id_fkey'
    AND table_schema = 'inbound'
  ) THEN
    RAISE EXCEPTION 'Foreign key call_history_agent_id_fkey not found in inbound schema';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'call_history_inbound_number_id_fkey'
    AND table_schema = 'inbound'
  ) THEN
    RAISE EXCEPTION 'Foreign key call_history_inbound_number_id_fkey not found in inbound schema';
  END IF;
  
  RAISE NOTICE 'All foreign keys verified in inbound schema';
END $$;

-- ============================================================================
-- Grant permissions on base tables (for direct schema access)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.inbound_numbers TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.call_history TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.call_recordings TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.call_schedules TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.weekly_availability TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.schedule_overrides TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.holidays TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.holiday_messages TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.after_hours_messages TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.inbound_analytics TO authenticated, anon, service_role;

-- ============================================================================
-- Note: To use relationship queries, query directly from schema:
-- supabase.schema('inbound').from('call_history').select('*,voice_agents:agent_id(*)')
-- ============================================================================
