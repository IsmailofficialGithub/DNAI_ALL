-- Helper: Identify all tables in your database
-- Description: Run this first to see what tables you have before moving them
-- This helps you decide which tables belong in which schemas

-- ============================================================================
-- STEP 1: List all tables in public schema
-- ============================================================================
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = 'public' AND table_name = t.table_name) as column_count,
  (SELECT COUNT(*)::bigint 
   FROM information_schema.table_constraints 
   WHERE table_schema = 'public' 
     AND table_name = t.table_name 
     AND constraint_type = 'FOREIGN KEY') as foreign_key_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'  -- Exclude PostgreSQL system tables
  AND table_name NOT LIKE '_%'     -- Exclude Supabase internal tables (usually start with _)
ORDER BY table_name;

-- ============================================================================
-- STEP 2: Check which tables have foreign keys (helps with move order)
-- ============================================================================
SELECT 
  tc.table_name as table_with_fk,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, ccu.table_name;

-- ============================================================================
-- STEP 3: Suggested schema assignments (customize based on your needs)
-- ============================================================================
-- Use the results from Step 1 to decide which tables go where:
--
-- OUTBOUND SCHEMA:
--   - voice_agents
--   - agent_calls
--   - agent_analytics
--   - agent_schedules
--   - ai_prompts
--
-- INBOUND SCHEMA:
--   - inbound_numbers
--   - call_history
--   - call_recordings
--   - call_schedules
--   - after_hours_messages
--   - holiday_messages
--   - holidays
--   - schedule_overrides
--   - weekly_availability
--
-- BILLING SCHEMA:
--   - invoices
--   - payment_history
--   - purchases
--   - user_subscriptions
--   - packages
--   - package_features
--   - package_variables
--   - coupon_codes
--   - coupon_usage
--   - credit_transactions
--   - invoice_settings
--   - invoice_email_logs
--   - refund_dispute_notes
--   - tax_configuration
--
-- ADMIN SCHEMA:
--   - admin_profiles
--   - admin_activity_log
--   - admin_ip_allowlist
--   - support_tickets
--   - support_ticket_notes
--   - system_settings
--   - feature_flags
--   - feature_flag_history
--   - global_ip_allowlist
--   - kyc_verifications
--   - kyc_moderation_history
--
-- ANALYTICS SCHEMA:
--   - call_analytics
--   - call_spike_detection
--   - abuse_detection_alerts
--
-- KEEP IN PUBLIC (Core/Shared):
--   - user_profiles
--   - user_credits
--   - user_emails
--   - user_2fa
--   - profiles (if different from user_profiles)
--   - auth.users (Supabase managed - don't move)
