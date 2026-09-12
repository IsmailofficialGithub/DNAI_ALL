-- Migration: Create VIEWs in public schema for backward compatibility
-- Description: Creates VIEWs in public schema pointing to inbound schema tables
-- This allows genie_inbound_Main code to work without schema prefixes initially
-- Date: 2025-01-XX

-- ============================================================================
-- CORE TABLES VIEWS
-- ============================================================================

-- Drop existing VIEWs first to avoid type conflicts
DROP VIEW IF EXISTS public.voice_agents CASCADE;
DROP VIEW IF EXISTS public.call_history CASCADE;
DROP VIEW IF EXISTS public.inbound_numbers CASCADE;
DROP VIEW IF EXISTS public.call_schedules CASCADE;
DROP VIEW IF EXISTS public.inbound_agents CASCADE;
DROP VIEW IF EXISTS public.agent_schedules CASCADE;
DROP VIEW IF EXISTS public.user_subscriptions CASCADE;
DROP VIEW IF EXISTS public.package_features CASCADE;
DROP VIEW IF EXISTS public.package_variables CASCADE;
DROP VIEW IF EXISTS public.purchases CASCADE;
DROP VIEW IF EXISTS public.bank_account_details CASCADE;
DROP VIEW IF EXISTS public.payment_proofs CASCADE;
DROP VIEW IF EXISTS public."payment-proofs" CASCADE;
DROP VIEW IF EXISTS public.coupon_codes CASCADE;
DROP VIEW IF EXISTS public.coupon_usage CASCADE;
DROP VIEW IF EXISTS public.user_credits CASCADE;
DROP VIEW IF EXISTS public.email_logs CASCADE;
DROP VIEW IF EXISTS public.user_emails CASCADE;
DROP VIEW IF EXISTS public.email_templates CASCADE;
DROP VIEW IF EXISTS public.agent_documents CASCADE;
DROP VIEW IF EXISTS public."agent-documents" CASCADE;
DROP VIEW IF EXISTS public.ai_prompts CASCADE;
DROP VIEW IF EXISTS public.weekly_availability CASCADE;
DROP VIEW IF EXISTS public.schedule_overrides CASCADE;
DROP VIEW IF EXISTS public.holidays CASCADE;
DROP VIEW IF EXISTS public.holiday_messages CASCADE;
DROP VIEW IF EXISTS public.after_hours_messages CASCADE;
DROP VIEW IF EXISTS public.login_activity CASCADE;
DROP VIEW IF EXISTS public.password_history CASCADE;
DROP VIEW IF EXISTS public.two_factor_auth CASCADE;
DROP VIEW IF EXISTS public.user_2fa CASCADE;
DROP VIEW IF EXISTS public.phone_verification_tokens CASCADE;
DROP VIEW IF EXISTS public.security_events CASCADE;
DROP VIEW IF EXISTS public.notifications CASCADE;
DROP VIEW IF EXISTS public.kyc_verifications CASCADE;
DROP VIEW IF EXISTS public.kyc_documents CASCADE;
DROP VIEW IF EXISTS public."kyc-documents" CASCADE;

-- Create voice_agents VIEW (points to inbound.voice_agents)
CREATE OR REPLACE VIEW public.voice_agents AS 
  SELECT * FROM inbound.voice_agents;

-- Create call_history VIEW (already exists from migration 049, but ensure it's correct)
CREATE OR REPLACE VIEW public.call_history AS 
  SELECT * FROM inbound.call_history;

-- Create inbound_numbers VIEW (already exists from migration 049)
CREATE OR REPLACE VIEW public.inbound_numbers AS 
  SELECT * FROM inbound.inbound_numbers;

-- Create call_schedules VIEW (already exists from migration 049)
CREATE OR REPLACE VIEW public.call_schedules AS 
  SELECT * FROM inbound.call_schedules;

-- Create inbound_agents VIEW (points to inbound.inbound_agents)
CREATE OR REPLACE VIEW public.inbound_agents AS 
  SELECT * FROM inbound.inbound_agents;

-- Create agent_schedules VIEW
CREATE OR REPLACE VIEW public.agent_schedules AS 
  SELECT * FROM inbound.agent_schedules;

-- ============================================================================
-- BILLING & SUBSCRIPTIONS VIEWS
-- ============================================================================

-- Create user_subscriptions VIEW
CREATE OR REPLACE VIEW public.user_subscriptions AS 
  SELECT * FROM inbound.user_subscriptions;

-- Create package_features VIEW
CREATE OR REPLACE VIEW public.package_features AS 
  SELECT * FROM inbound.package_features;

-- Create package_variables VIEW
CREATE OR REPLACE VIEW public.package_variables AS 
  SELECT * FROM inbound.package_variables;

-- Create purchases VIEW
CREATE OR REPLACE VIEW public.purchases AS 
  SELECT * FROM inbound.purchases;

-- Create bank_account_details VIEW
CREATE OR REPLACE VIEW public.bank_account_details AS 
  SELECT * FROM inbound.bank_account_details;

-- Create payment_proofs VIEW (handle both payment-proofs and payment_proofs)
CREATE OR REPLACE VIEW public.payment_proofs AS 
  SELECT * FROM inbound.payment_proofs;

CREATE OR REPLACE VIEW public."payment-proofs" AS 
  SELECT * FROM inbound.payment_proofs;

-- Create coupon_codes VIEW
CREATE OR REPLACE VIEW public.coupon_codes AS 
  SELECT * FROM inbound.coupon_codes;

-- Create coupon_usage VIEW
CREATE OR REPLACE VIEW public.coupon_usage AS 
  SELECT * FROM inbound.coupon_usage;

-- Create user_credits VIEW
CREATE OR REPLACE VIEW public.user_credits AS 
  SELECT * FROM inbound.user_credits;

-- ============================================================================
-- EMAIL VIEWS
-- ============================================================================

-- Create email_logs VIEW
CREATE OR REPLACE VIEW public.email_logs AS 
  SELECT * FROM inbound.email_logs;

-- Create user_emails VIEW
CREATE OR REPLACE VIEW public.user_emails AS 
  SELECT * FROM inbound.user_emails;

-- Create email_templates VIEW
CREATE OR REPLACE VIEW public.email_templates AS 
  SELECT * FROM inbound.email_templates;

-- ============================================================================
-- KNOWLEDGE & AI VIEWS
-- ============================================================================

-- Note: knowledge_bases, knowledge_base_faqs, knowledge_base_documents are in public schema already

-- Create agent_documents VIEW (handle both agent_documents and agent-documents)
CREATE OR REPLACE VIEW public.agent_documents AS 
  SELECT * FROM inbound.agent_documents;

CREATE OR REPLACE VIEW public."agent-documents" AS 
  SELECT * FROM inbound.agent_documents;

-- Create ai_prompts VIEW
CREATE OR REPLACE VIEW public.ai_prompts AS 
  SELECT * FROM inbound.ai_prompts;

-- ============================================================================
-- SCHEDULING VIEWS (already exist from migration 049, but ensure they're correct)
-- ============================================================================

CREATE OR REPLACE VIEW public.weekly_availability AS 
  SELECT * FROM inbound.weekly_availability;

CREATE OR REPLACE VIEW public.schedule_overrides AS 
  SELECT * FROM inbound.schedule_overrides;

CREATE OR REPLACE VIEW public.holidays AS 
  SELECT * FROM inbound.holidays;

CREATE OR REPLACE VIEW public.holiday_messages AS 
  SELECT * FROM inbound.holiday_messages;

CREATE OR REPLACE VIEW public.after_hours_messages AS 
  SELECT * FROM inbound.after_hours_messages;

-- ============================================================================
-- SECURITY & AUTH VIEWS
-- ============================================================================

-- Create login_activity VIEW
CREATE OR REPLACE VIEW public.login_activity AS 
  SELECT * FROM inbound.login_activity;

-- Create password_history VIEW
CREATE OR REPLACE VIEW public.password_history AS 
  SELECT * FROM inbound.password_history;

-- Create two_factor_auth VIEW (handle both two_factor_auth and user_2fa)
CREATE OR REPLACE VIEW public.two_factor_auth AS 
  SELECT * FROM inbound.two_factor_auth;

CREATE OR REPLACE VIEW public.user_2fa AS 
  SELECT * FROM inbound.two_factor_auth;

-- Create phone_verification_tokens VIEW
CREATE OR REPLACE VIEW public.phone_verification_tokens AS 
  SELECT * FROM inbound.phone_verification_tokens;

-- Create security_events VIEW
CREATE OR REPLACE VIEW public.security_events AS 
  SELECT * FROM inbound.security_events;

-- Create notifications VIEW
CREATE OR REPLACE VIEW public.notifications AS 
  SELECT * FROM inbound.notifications;

-- ============================================================================
-- KYC VIEWS
-- ============================================================================

-- Create kyc_verifications VIEW
CREATE OR REPLACE VIEW public.kyc_verifications AS 
  SELECT * FROM inbound.kyc_verifications;

-- Create kyc_documents VIEW (handle both kyc_documents and kyc-documents)
CREATE OR REPLACE VIEW public.kyc_documents AS 
  SELECT * FROM inbound.kyc_documents;

CREATE OR REPLACE VIEW public."kyc-documents" AS 
  SELECT * FROM inbound.kyc_documents;

-- ============================================================================
-- GRANT PERMISSIONS ON VIEWS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_agents TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_history TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_numbers TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_schedules TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_agents TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_schedules TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_features TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_variables TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_account_details TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_proofs TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."payment-proofs" TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_codes TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_usage TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_credits TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_emails TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_documents TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."agent-documents" TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompts TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_availability TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_overrides TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_messages TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.after_hours_messages TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_activity TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_history TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.two_factor_auth TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_2fa TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_verification_tokens TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_events TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_verifications TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_documents TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."kyc-documents" TO authenticated, anon, service_role;

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON VIEW public.voice_agents IS 'VIEW for backward compatibility - points to inbound.voice_agents';
COMMENT ON VIEW public.call_history IS 'VIEW for backward compatibility - points to inbound.call_history';
COMMENT ON VIEW public.user_subscriptions IS 'VIEW for backward compatibility - points to inbound.user_subscriptions';
COMMENT ON VIEW public.user_credits IS 'VIEW for backward compatibility - points to inbound.user_credits';
COMMENT ON VIEW public.notifications IS 'VIEW for backward compatibility - points to inbound.notifications';
COMMENT ON VIEW public.login_activity IS 'VIEW for backward compatibility - points to inbound.login_activity';
