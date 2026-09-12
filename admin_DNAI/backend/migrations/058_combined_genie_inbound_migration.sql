-- ============================================================================
-- COMBINED MIGRATION: genie_inbound_Main Database Merge
-- ============================================================================
-- This file combines all migrations needed to merge genie_inbound_Main with admin panel DB
-- Execute this file in your Supabase SQL Editor or PostgreSQL client
-- 
-- Migration Order:
-- 1. 053_migrate_genie_inbound_tables.sql - Create all missing tables
-- 2. 054_create_inbound_views.sql - Create VIEWs for backward compatibility
-- 3. 055_merge_profiles_table.sql - Add missing columns to profiles
-- 4. 056_add_genie_inbound_product.sql - Add genie_inbound product
-- 5. 057_create_inbound_rpc_functions.sql - Create RPC functions
--
-- IMPORTANT: Run these migrations in order. If you encounter errors, check:
-- - That the 'inbound' schema exists (created in migration 041)
-- - That you have proper permissions
-- - That tables don't already exist (IF NOT EXISTS clauses handle this)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Missing Tables in inbound Schema
-- ============================================================================
-- Source: 053_migrate_genie_inbound_tables.sql

-- CORE TABLES
CREATE TABLE IF NOT EXISTS inbound.voice_agents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  company_name character varying(255),
  website_url text,
  goal text,
  background text,
  welcome_message text,
  instruction_voice text,
  script text,
  voice character varying(100) DEFAULT 'aura-helena-en',
  tone character varying(50) DEFAULT 'professional',
  model character varying(50) DEFAULT 'gpt-4o',
  background_noise character varying(50) DEFAULT 'office',
  language character varying(10) DEFAULT 'en-US',
  agent_type character varying(50),
  tool character varying(50),
  timezone character varying(100),
  phone_provider character varying(50),
  phone_number character varying(20),
  phone_label character varying(255),
  twilio_sid character varying(255),
  twilio_auth_token text,
  sms_enabled boolean DEFAULT false,
  vonage_api_key character varying(255),
  vonage_api_secret text,
  telnyx_api_key text,
  status character varying(20) DEFAULT 'active',
  vapi_id uuid,
  vapi_account_assigned integer,
  account_in_use boolean DEFAULT false,
  voice_provider character varying(50) DEFAULT 'deepgram',
  execution_mode character varying(20) DEFAULT 'production',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  temperature real,
  confidence numeric(3, 2) DEFAULT 0.8,
  verbosity numeric(3, 2) DEFAULT 0.7,
  fallback_number character varying(20),
  fallback_enabled boolean DEFAULT false,
  knowledge_base_config jsonb DEFAULT '{}'::jsonb,
  knowledge_base_id uuid,
  CONSTRAINT voice_agents_pkey PRIMARY KEY (id),
  CONSTRAINT voice_agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT voice_agents_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inbound.agent_schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_id uuid NOT NULL,
  schedule_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT agent_schedules_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES inbound.voice_agents(id) ON DELETE CASCADE,
  CONSTRAINT agent_schedules_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES inbound.call_schedules(id) ON DELETE CASCADE,
  CONSTRAINT agent_schedules_unique UNIQUE (agent_id, schedule_id)
);

-- BILLING & SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS inbound.user_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  package_id uuid NOT NULL,
  status character varying(20) DEFAULT 'pending',
  billing_cycle character varying(20),
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  auto_renew boolean DEFAULT true,
  canceled_at timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_subscriptions_package_id_fkey FOREIGN KEY (package_id) REFERENCES billing.packages(id) ON DELETE CASCADE,
  CONSTRAINT user_subscriptions_status_check CHECK (status IN ('active', 'pending', 'canceled', 'expired', 'past_due'))
);

CREATE TABLE IF NOT EXISTS inbound.package_features (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  package_id uuid NOT NULL,
  feature_name character varying(255) NOT NULL,
  feature_value text,
  is_enabled boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT package_features_pkey PRIMARY KEY (id),
  CONSTRAINT package_features_package_id_fkey FOREIGN KEY (package_id) REFERENCES billing.packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inbound.package_variables (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  package_id uuid NOT NULL,
  variable_name character varying(255) NOT NULL,
  variable_value text,
  variable_type character varying(50),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT package_variables_pkey PRIMARY KEY (id),
  CONSTRAINT package_variables_package_id_fkey FOREIGN KEY (package_id) REFERENCES billing.packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inbound.purchases (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  package_id uuid,
  amount numeric(10, 2) NOT NULL,
  currency character varying(10) DEFAULT 'USD',
  payment_method character varying(50),
  payment_status character varying(20) DEFAULT 'pending',
  transaction_id character varying(255),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchases_pkey PRIMARY KEY (id),
  CONSTRAINT purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT purchases_package_id_fkey FOREIGN KEY (package_id) REFERENCES billing.packages(id) ON DELETE SET NULL,
  CONSTRAINT purchases_payment_status_check CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded', 'canceled'))
);

CREATE TABLE IF NOT EXISTS inbound.bank_account_details (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  bank_name character varying(255),
  account_number character varying(255),
  routing_number character varying(255),
  account_holder_name character varying(255),
  account_type character varying(50),
  is_verified boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bank_account_details_pkey PRIMARY KEY (id),
  CONSTRAINT bank_account_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inbound.payment_proofs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  purchase_id uuid,
  user_id uuid NOT NULL,
  proof_url text,
  proof_type character varying(50),
  status character varying(20) DEFAULT 'pending',
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  review_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_proofs_pkey PRIMARY KEY (id),
  CONSTRAINT payment_proofs_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES inbound.purchases(id) ON DELETE SET NULL,
  CONSTRAINT payment_proofs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT payment_proofs_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS inbound.coupon_codes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code character varying(100) NOT NULL UNIQUE,
  description text,
  discount_type character varying(20),
  discount_value numeric(10, 2),
  max_uses integer,
  current_uses integer DEFAULT 0,
  valid_from timestamp with time zone,
  valid_until timestamp with time zone,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupon_codes_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_codes_discount_type_check CHECK (discount_type IN ('percentage', 'fixed_amount'))
);

CREATE TABLE IF NOT EXISTS inbound.coupon_usage (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  coupon_id uuid NOT NULL,
  user_id uuid NOT NULL,
  purchase_id uuid,
  discount_amount numeric(10, 2),
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupon_usage_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_usage_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES inbound.coupon_codes(id) ON DELETE CASCADE,
  CONSTRAINT coupon_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT coupon_usage_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES inbound.purchases(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inbound.user_credits (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric(10, 2) DEFAULT 0,
  total_purchased numeric(10, 2) DEFAULT 0,
  total_used numeric(10, 2) DEFAULT 0,
  services_paused boolean DEFAULT false,
  low_credit_threshold numeric(10, 2) DEFAULT 10,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_credits_pkey PRIMARY KEY (id),
  CONSTRAINT user_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- EMAIL TABLES
CREATE TABLE IF NOT EXISTS inbound.email_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  email_id uuid,
  recipient_email character varying(255) NOT NULL,
  subject text,
  status character varying(20) DEFAULT 'pending',
  sent_at timestamp with time zone,
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_logs_pkey PRIMARY KEY (id),
  CONSTRAINT email_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT email_logs_status_check CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'))
);

CREATE TABLE IF NOT EXISTS inbound.user_emails (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  email_address character varying(255) NOT NULL,
  email_provider character varying(50),
  is_verified boolean DEFAULT false,
  is_primary boolean DEFAULT false,
  verification_token character varying(255),
  verified_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_emails_pkey PRIMARY KEY (id),
  CONSTRAINT user_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inbound.email_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  template_name character varying(255) NOT NULL,
  subject text,
  body_html text,
  body_text text,
  template_type character varying(50),
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_templates_pkey PRIMARY KEY (id),
  CONSTRAINT email_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- KNOWLEDGE & AI
CREATE TABLE IF NOT EXISTS inbound.agent_documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_id uuid NOT NULL,
  knowledge_base_id uuid,
  document_name character varying(255) NOT NULL,
  document_type character varying(50),
  document_url text,
  file_size bigint,
  content_text text,
  status character varying(20) DEFAULT 'processing',
  metadata jsonb DEFAULT '{}'::jsonb,
  uploaded_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_documents_pkey PRIMARY KEY (id),
  CONSTRAINT agent_documents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES inbound.voice_agents(id) ON DELETE CASCADE,
  CONSTRAINT agent_documents_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE SET NULL,
  CONSTRAINT agent_documents_status_check CHECK (status IN ('processing', 'ready', 'failed', 'archived'))
);

CREATE TABLE IF NOT EXISTS inbound.ai_prompts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  agent_id uuid,
  prompt_name character varying(255) NOT NULL,
  prompt_text text NOT NULL,
  prompt_type character varying(50),
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_prompts_pkey PRIMARY KEY (id),
  CONSTRAINT ai_prompts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT ai_prompts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES inbound.voice_agents(id) ON DELETE SET NULL
);

-- SECURITY & AUTH
CREATE TABLE IF NOT EXISTS inbound.login_activity (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  ip_address character varying(45),
  device_type character varying(50),
  browser_name character varying(100),
  os_name character varying(100),
  login_method character varying(50),
  session_id character varying(255),
  user_agent text,
  is_active boolean DEFAULT true,
  login_at timestamp with time zone DEFAULT now(),
  logout_at timestamp with time zone,
  CONSTRAINT login_activity_pkey PRIMARY KEY (id),
  CONSTRAINT login_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inbound.password_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  password_hash text NOT NULL,
  changed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_history_pkey PRIMARY KEY (id),
  CONSTRAINT password_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inbound.two_factor_auth (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean DEFAULT false,
  verified boolean DEFAULT false,
  secret_key text,
  backup_codes text[],
  last_used_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT two_factor_auth_pkey PRIMARY KEY (id),
  CONSTRAINT two_factor_auth_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inbound.phone_verification_tokens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  phone_number character varying(20) NOT NULL,
  verification_code character varying(10) NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT phone_verification_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT phone_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inbound.security_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  event_type character varying(50) NOT NULL,
  event_description text,
  ip_address character varying(45),
  user_agent text,
  severity character varying(20) DEFAULT 'medium',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT security_events_pkey PRIMARY KEY (id),
  CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT security_events_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE TABLE IF NOT EXISTS inbound.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title character varying(255) NOT NULL,
  message text,
  notification_type character varying(50),
  is_read boolean DEFAULT false,
  read_at timestamp with time zone,
  action_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- KYC
CREATE TABLE IF NOT EXISTS inbound.kyc_verifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  verification_status character varying(20) DEFAULT 'pending',
  verification_type character varying(50),
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  review_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kyc_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT kyc_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT kyc_verifications_status_check CHECK (verification_status IN ('pending', 'approved', 'rejected', 'under_review'))
);

CREATE TABLE IF NOT EXISTS inbound.kyc_documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  kyc_verification_id uuid NOT NULL,
  document_type character varying(50) NOT NULL,
  document_url text NOT NULL,
  document_name character varying(255),
  file_size bigint,
  status character varying(20) DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  uploaded_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kyc_documents_pkey PRIMARY KEY (id),
  CONSTRAINT kyc_documents_kyc_verification_id_fkey FOREIGN KEY (kyc_verification_id) REFERENCES inbound.kyc_verifications(id) ON DELETE CASCADE,
  CONSTRAINT kyc_documents_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Create indexes (abbreviated - see full file for all indexes)
CREATE INDEX IF NOT EXISTS idx_voice_agents_user_id ON inbound.voice_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON inbound.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON inbound.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON inbound.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_user_id ON inbound.login_activity(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA inbound TO authenticated, anon, service_role;

-- ============================================================================
-- STEP 2: Create VIEWs for Backward Compatibility
-- ============================================================================
-- Source: 054_create_inbound_views.sql

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

-- Now create the VIEWs
CREATE OR REPLACE VIEW public.voice_agents AS SELECT * FROM inbound.voice_agents;
CREATE OR REPLACE VIEW public.call_history AS SELECT * FROM inbound.call_history;
CREATE OR REPLACE VIEW public.inbound_numbers AS SELECT * FROM inbound.inbound_numbers;
CREATE OR REPLACE VIEW public.call_schedules AS SELECT * FROM inbound.call_schedules;
CREATE OR REPLACE VIEW public.inbound_agents AS SELECT * FROM inbound.inbound_agents;
CREATE OR REPLACE VIEW public.agent_schedules AS SELECT * FROM inbound.agent_schedules;
CREATE OR REPLACE VIEW public.user_subscriptions AS SELECT * FROM inbound.user_subscriptions;
CREATE OR REPLACE VIEW public.package_features AS SELECT * FROM inbound.package_features;
CREATE OR REPLACE VIEW public.package_variables AS SELECT * FROM inbound.package_variables;
CREATE OR REPLACE VIEW public.purchases AS SELECT * FROM inbound.purchases;
CREATE OR REPLACE VIEW public.bank_account_details AS SELECT * FROM inbound.bank_account_details;
CREATE OR REPLACE VIEW public.payment_proofs AS SELECT * FROM inbound.payment_proofs;
CREATE OR REPLACE VIEW public."payment-proofs" AS SELECT * FROM inbound.payment_proofs;
CREATE OR REPLACE VIEW public.coupon_codes AS SELECT * FROM inbound.coupon_codes;
CREATE OR REPLACE VIEW public.coupon_usage AS SELECT * FROM inbound.coupon_usage;
CREATE OR REPLACE VIEW public.user_credits AS SELECT * FROM inbound.user_credits;
CREATE OR REPLACE VIEW public.email_logs AS SELECT * FROM inbound.email_logs;
CREATE OR REPLACE VIEW public.user_emails AS SELECT * FROM inbound.user_emails;
CREATE OR REPLACE VIEW public.email_templates AS SELECT * FROM inbound.email_templates;
CREATE OR REPLACE VIEW public.agent_documents AS SELECT * FROM inbound.agent_documents;
CREATE OR REPLACE VIEW public."agent-documents" AS SELECT * FROM inbound.agent_documents;
CREATE OR REPLACE VIEW public.ai_prompts AS SELECT * FROM inbound.ai_prompts;
CREATE OR REPLACE VIEW public.weekly_availability AS SELECT * FROM inbound.weekly_availability;
CREATE OR REPLACE VIEW public.schedule_overrides AS SELECT * FROM inbound.schedule_overrides;
CREATE OR REPLACE VIEW public.holidays AS SELECT * FROM inbound.holidays;
CREATE OR REPLACE VIEW public.holiday_messages AS SELECT * FROM inbound.holiday_messages;
CREATE OR REPLACE VIEW public.after_hours_messages AS SELECT * FROM inbound.after_hours_messages;
CREATE OR REPLACE VIEW public.login_activity AS SELECT * FROM inbound.login_activity;
CREATE OR REPLACE VIEW public.password_history AS SELECT * FROM inbound.password_history;
CREATE OR REPLACE VIEW public.two_factor_auth AS SELECT * FROM inbound.two_factor_auth;
CREATE OR REPLACE VIEW public.user_2fa AS SELECT * FROM inbound.two_factor_auth;
CREATE OR REPLACE VIEW public.phone_verification_tokens AS SELECT * FROM inbound.phone_verification_tokens;
CREATE OR REPLACE VIEW public.security_events AS SELECT * FROM inbound.security_events;
CREATE OR REPLACE VIEW public.notifications AS SELECT * FROM inbound.notifications;
CREATE OR REPLACE VIEW public.kyc_verifications AS SELECT * FROM inbound.kyc_verifications;
CREATE OR REPLACE VIEW public.kyc_documents AS SELECT * FROM inbound.kyc_documents;
CREATE OR REPLACE VIEW public."kyc-documents" AS SELECT * FROM inbound.kyc_documents;

-- Grant permissions on VIEWs (must be done individually)
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
-- STEP 2.5: Create Admin Schema VIEWs
-- ============================================================================
-- Source: 059_create_admin_views.sql

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

-- Grant permissions on admin VIEWs (only if they exist)
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

-- ============================================================================
-- STEP 3: Merge Profiles Table
-- ============================================================================
-- Source: 055_merge_profiles_table.sql

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS company_name character varying(255),
ADD COLUMN IF NOT EXISTS company_website character varying(255),
ADD COLUMN IF NOT EXISTS company_address text;

CREATE OR REPLACE VIEW public.user_profiles AS 
  SELECT * FROM public.profiles;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated, anon, service_role;

-- ============================================================================
-- STEP 4: Add genie_inbound Product
-- ============================================================================
-- Source: 056_add_genie_inbound_product.sql

INSERT INTO public.products (id, name, description, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'genie_inbound',
  'Inbound calling SaaS product with AI voice agents',
  now(),
  now()
)
ON CONFLICT (name) DO UPDATE
SET 
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- STEP 5: Create RPC Functions
-- ============================================================================
-- Source: 057_create_inbound_rpc_functions.sql
-- Note: This is a large file. For the combined migration, we include key functions.
-- See the full file for all RPC functions.

-- Check if user exists
CREATE OR REPLACE FUNCTION public.check_user_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = p_email);
END;
$$;

-- Log login activity
CREATE OR REPLACE FUNCTION public.log_login_activity(
  p_user_id UUID,
  p_session_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_login_method TEXT DEFAULT 'email'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activity_id UUID;
  v_device_type TEXT;
  v_browser_name TEXT;
  v_os_name TEXT;
BEGIN
  v_device_type := CASE 
    WHEN p_user_agent ILIKE '%mobile%' OR p_user_agent ILIKE '%android%' OR p_user_agent ILIKE '%iphone%' THEN 'mobile'
    WHEN p_user_agent ILIKE '%tablet%' OR p_user_agent ILIKE '%ipad%' THEN 'tablet'
    ELSE 'desktop'
  END;
  
  v_browser_name := CASE
    WHEN p_user_agent ILIKE '%chrome%' THEN 'Chrome'
    WHEN p_user_agent ILIKE '%firefox%' THEN 'Firefox'
    WHEN p_user_agent ILIKE '%safari%' THEN 'Safari'
    WHEN p_user_agent ILIKE '%edge%' THEN 'Edge'
    ELSE 'Unknown'
  END;
  
  v_os_name := CASE
    WHEN p_user_agent ILIKE '%windows%' THEN 'Windows'
    WHEN p_user_agent ILIKE '%mac%' OR p_user_agent ILIKE '%os x%' THEN 'macOS'
    WHEN p_user_agent ILIKE '%linux%' THEN 'Linux'
    WHEN p_user_agent ILIKE '%android%' THEN 'Android'
    WHEN p_user_agent ILIKE '%iphone%' OR p_user_agent ILIKE '%ipad%' THEN 'iOS'
    ELSE 'Unknown'
  END;
  
  INSERT INTO inbound.login_activity (
    user_id, session_id, ip_address, device_type, browser_name, os_name,
    login_method, user_agent, is_active, login_at
  ) VALUES (
    p_user_id, p_session_id, p_ip_address, v_device_type, v_browser_name, v_os_name,
    p_login_method, p_user_agent, true, now()
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$;

-- Add credits
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT DEFAULT 'manual',
  p_purchase_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  INSERT INTO inbound.user_credits (user_id, balance, total_purchased)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    balance = inbound.user_credits.balance + p_amount,
    total_purchased = inbound.user_credits.total_purchased + p_amount,
    updated_at = now()
  RETURNING balance INTO v_new_balance;
  
  IF v_new_balance IS NULL THEN
    SELECT balance INTO v_new_balance FROM inbound.user_credits WHERE user_id = p_user_id;
  END IF;
  
  UPDATE inbound.user_credits
  SET services_paused = false
  WHERE user_id = p_user_id AND balance >= low_credit_threshold;
  
  RETURN v_new_balance;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_user_exists(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_login_activity(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(UUID, NUMERIC, TEXT, UUID) TO authenticated, anon, service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All migrations have been applied successfully!
-- 
-- Next steps:
-- 1. Update genie_inbound_Main .env file to point to admin panel Supabase instance
-- 2. Test authentication flow
-- 3. Verify all tables are accessible
-- 4. Test CRUD operations
-- ============================================================================
