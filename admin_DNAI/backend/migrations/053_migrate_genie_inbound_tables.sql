-- Migration: Create Missing genie_inbound_Main Tables in inbound Schema
-- Description: Creates all tables used by genie_inbound_Main that don't exist yet in inbound schema
-- Date: 2025-01-XX

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Create voice_agents table in inbound schema (for inbound-specific agents)
-- Note: outbound.voice_agents exists for outbound calls, this is for inbound
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

-- Create agent_schedules table (links agents to call schedules)
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

-- ============================================================================
-- BILLING & SUBSCRIPTIONS
-- ============================================================================

-- Create user_subscriptions table
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

-- Create package_features table
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

-- Create package_variables table
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

-- Create purchases table
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

-- Create bank_account_details table
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

-- Create payment_proofs table
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

-- Create coupon_codes table
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

-- Create coupon_usage table
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

-- Create user_credits table
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

-- ============================================================================
-- EMAIL TABLES
-- ============================================================================

-- Create email_logs table
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

-- Create user_emails table
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

-- Create email_templates table
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

-- ============================================================================
-- KNOWLEDGE & AI TABLES
-- ============================================================================

-- Note: knowledge_bases, knowledge_base_faqs, knowledge_base_documents already exist in public schema
-- Create agent_documents table (rename from agent-documents)
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

-- Create ai_prompts table
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

-- ============================================================================
-- SECURITY & AUTH TABLES
-- ============================================================================

-- Create login_activity table
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

-- Create password_history table
CREATE TABLE IF NOT EXISTS inbound.password_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  password_hash text NOT NULL,
  changed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_history_pkey PRIMARY KEY (id),
  CONSTRAINT password_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create two_factor_auth table
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

-- Create phone_verification_tokens table
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

-- Create security_events table
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

-- Create notifications table
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

-- ============================================================================
-- KYC TABLES
-- ============================================================================

-- Create kyc_verifications table
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

-- Create kyc_documents table (rename from kyc-documents)
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

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- Voice agents indexes
CREATE INDEX IF NOT EXISTS idx_voice_agents_user_id ON inbound.voice_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_agents_status ON inbound.voice_agents(status);
CREATE INDEX IF NOT EXISTS idx_voice_agents_deleted_at ON inbound.voice_agents(deleted_at) WHERE deleted_at IS NOT NULL;

-- Agent schedules indexes
CREATE INDEX IF NOT EXISTS idx_agent_schedules_agent_id ON inbound.agent_schedules(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_schedules_schedule_id ON inbound.agent_schedules(schedule_id);

-- User subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON inbound.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_package_id ON inbound.user_subscriptions(package_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON inbound.user_subscriptions(status);

-- Package features/variables indexes
CREATE INDEX IF NOT EXISTS idx_package_features_package_id ON inbound.package_features(package_id);
CREATE INDEX IF NOT EXISTS idx_package_variables_package_id ON inbound.package_variables(package_id);

-- Purchases indexes
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON inbound.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON inbound.purchases(payment_status);

-- Payment proofs indexes
CREATE INDEX IF NOT EXISTS idx_payment_proofs_purchase_id ON inbound.payment_proofs(purchase_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_user_id ON inbound.payment_proofs(user_id);

-- Coupon indexes
CREATE INDEX IF NOT EXISTS idx_coupon_codes_code ON inbound.coupon_codes(code);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON inbound.coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON inbound.coupon_usage(user_id);

-- User credits indexes
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON inbound.user_credits(user_id);

-- Email indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON inbound.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON inbound.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_user_emails_user_id ON inbound.user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON inbound.email_templates(user_id);

-- Agent documents indexes
CREATE INDEX IF NOT EXISTS idx_agent_documents_agent_id ON inbound.agent_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_knowledge_base_id ON inbound.agent_documents(knowledge_base_id);

-- AI prompts indexes
CREATE INDEX IF NOT EXISTS idx_ai_prompts_user_id ON inbound.ai_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_agent_id ON inbound.ai_prompts(agent_id);

-- Security indexes
CREATE INDEX IF NOT EXISTS idx_login_activity_user_id ON inbound.login_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_login_at ON inbound.login_activity(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON inbound.password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_auth_user_id ON inbound.two_factor_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_verification_tokens_user_id ON inbound.phone_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON inbound.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON inbound.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON inbound.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON inbound.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON inbound.notifications(created_at DESC);

-- KYC indexes
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_id ON inbound.kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_kyc_verification_id ON inbound.kyc_documents(kyc_verification_id);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA inbound TO authenticated, anon, service_role;

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE inbound.voice_agents IS 'Voice agents for inbound calling (separate from outbound.voice_agents)';
COMMENT ON TABLE inbound.agent_schedules IS 'Links voice agents to call schedules';
COMMENT ON TABLE inbound.user_subscriptions IS 'User subscription records for packages';
COMMENT ON TABLE inbound.user_credits IS 'User credit balance and usage tracking';
COMMENT ON TABLE inbound.notifications IS 'User notifications';
COMMENT ON TABLE inbound.login_activity IS 'User login activity tracking';
