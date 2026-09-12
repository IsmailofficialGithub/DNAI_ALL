-- Helper: Identify remaining tables that could be organized
-- Description: Shows tables still in public schema that could be moved
-- Run this to see what other tables you have

-- ============================================================================
-- List all tables still in public schema (excluding already moved ones)
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
  AND table_name NOT LIKE '_%'     -- Exclude Supabase internal tables
  AND table_name NOT IN (
    -- Already moved tables
    'error_logs', 'n8n_errors', 'api_keys',
    'genie_bots', 'genie_contact_lists', 'genie_contacts', 
    'genie_scheduled_calls', 'genie_leads', 'call_logs',
    'packages', 'invoices', 'invoice_items', 'invoice_payments', 'offers',
    'support_tickets', 'support_messages', 'support_attachments'
  )
  AND table_name NOT IN (
    -- Core tables that should stay in public
    'profiles', 'products', 'vapi_accounts', 'user_package_access',
    'user_permissions', 'user_product_access', 'permissions', 'role_permissions'
  )
ORDER BY table_name;

-- ============================================================================
-- Suggested organization for remaining tables
-- ============================================================================
-- Based on your original schema, here are tables that could be moved:
--
-- OUTBOUND SCHEMA (if you have them):
--   - voice_agents (if exists)
--   - agent_calls (if exists)
--   - agent_analytics (if exists)
--   - ai_prompts (if exists)
--
-- INBOUND SCHEMA (if you have them):
--   - inbound_numbers (if exists)
--   - call_history (if exists)
--   - call_recordings (if exists)
--   - call_schedules (if exists)
--   - after_hours_messages (if exists)
--   - holiday_messages (if exists)
--   - holidays (if exists)
--
-- BILLING SCHEMA (if you have them):
--   - user_subscriptions (if exists)
--   - purchases (if exists)
--   - payment_history (if exists)
--   - coupon_codes (if exists)
--   - coupon_usage (if exists)
--   - credit_transactions (if exists)
--
-- ADMIN SCHEMA (if you have them):
--   - admin_profiles (if exists)
--   - admin_activity_log (if exists)
--   - system_settings (if exists)
--   - feature_flags (if exists)
--
-- ANALYTICS SCHEMA (if you have them):
--   - call_analytics (if exists)
--   - call_spike_detection (if exists)
--   - abuse_detection_alerts (if exists)
--
-- SOCIAL MEDIA / CONTENT SCHEMA (if you have many):
--   - brands, ads, analysis, content_calendar, calendar_posts
--   - posts, post_contents, post_images, post_schedule
--   - published_posts, rejected_posts
--   - social_accounts, linkedin_analytics_cache
--   - strategic_calendars, user_search_queries
--   - activity_logs
--
-- Note: If you have many social media/content tables, consider creating
-- a 'content' or 'social' schema for them
