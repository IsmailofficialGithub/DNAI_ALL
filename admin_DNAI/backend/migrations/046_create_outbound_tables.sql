-- Migration: Create Outbound Calling Tables in outbound schema
-- Description: Creates voice agent and outbound calling tables in the outbound schema
-- This is for the new genie_outbound product
-- Date: 2025-01-XX

-- ============================================================================
-- OUTBOUND SCHEMA: Voice Agents and Outbound Calling Tables
-- ============================================================================

-- Create voice_agents table in outbound schema
CREATE TABLE IF NOT EXISTS outbound.voice_agents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name character varying NOT NULL,
  company_name character varying,
  website_url text,
  goal text,
  background text,
  welcome_message text,
  instruction_voice text,
  script text,
  voice character varying DEFAULT 'aura-helena-en'::character varying,
  tone character varying DEFAULT 'professional'::character varying,
  model character varying DEFAULT 'gpt-4o'::character varying,
  background_noise character varying DEFAULT 'office'::character varying,
  language character varying DEFAULT 'en-US'::character varying,
  agent_type character varying CHECK (agent_type::text = ANY (ARRAY['sales'::character varying, 'support'::character varying, 'booking'::character varying, 'general'::character varying]::text[])),
  tool character varying CHECK (tool::text = ANY (ARRAY['calendar'::character varying, 'crm'::character varying, 'email'::character varying, 'sms'::character varying]::text[])),
  timezone character varying,
  phone_provider character varying CHECK (phone_provider::text = ANY (ARRAY['twilio'::character varying, 'vonage'::character varying, 'telnyx'::character varying]::text[])),
  phone_number character varying,
  phone_label character varying,
  twilio_sid character varying,
  twilio_auth_token text,
  sms_enabled boolean DEFAULT false,
  vonage_api_key character varying,
  vonage_api_secret text,
  telnyx_api_key text,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying::text, 'inactive'::character varying::text, 'archived'::character varying::text, 'testing'::character varying::text, 'draft'::character varying::text, 'activating'::character varying::text])),
  vapi_id uuid,
  vapi_account_assigned integer,
  account_in_use boolean DEFAULT false,
  voice_provider character varying DEFAULT 'deepgram'::character varying,
  execution_mode character varying DEFAULT 'production'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  temperature real,
  confidence numeric DEFAULT 0.8 CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
  verbosity numeric DEFAULT 0.7 CHECK (verbosity >= 0::numeric AND verbosity <= 1::numeric),
  fallback_number character varying,
  fallback_enabled boolean DEFAULT false,
  knowledge_base_config jsonb DEFAULT '{}'::jsonb,
  knowledge_base_id uuid,
  CONSTRAINT voice_agents_pkey PRIMARY KEY (id),
  CONSTRAINT voice_agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create agent_calls table in outbound schema
CREATE TABLE IF NOT EXISTS outbound.agent_calls (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_id uuid NOT NULL,
  user_id uuid NOT NULL,
  caller_number character varying,
  called_number character varying,
  direction character varying CHECK (direction::text = ANY (ARRAY['inbound'::character varying, 'outbound'::character varying]::text[])),
  status character varying CHECK (status::text = ANY (ARRAY['initiated'::character varying, 'ringing'::character varying, 'answered'::character varying, 'completed'::character varying, 'failed'::character varying, 'busy'::character varying, 'no-answer'::character varying]::text[])),
  duration integer DEFAULT 0,
  recording_url text,
  transcript text,
  provider character varying,
  provider_call_id character varying,
  started_at timestamp with time zone,
  answered_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT agent_calls_pkey PRIMARY KEY (id),
  CONSTRAINT agent_calls_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES outbound.voice_agents(id),
  CONSTRAINT agent_calls_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create agent_analytics table in outbound schema
CREATE TABLE IF NOT EXISTS outbound.agent_analytics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agent_id uuid NOT NULL,
  user_id uuid NOT NULL,
  date date NOT NULL,
  period character varying CHECK (period::text = ANY (ARRAY['hour'::character varying, 'day'::character varying, 'week'::character varying, 'month'::character varying]::text[])),
  total_calls integer DEFAULT 0,
  answered_calls integer DEFAULT 0,
  missed_calls integer DEFAULT 0,
  total_duration integer DEFAULT 0,
  average_duration numeric DEFAULT 0,
  conversions integer DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT agent_analytics_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES outbound.voice_agents(id),
  CONSTRAINT agent_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create agent_schedules table in outbound schema
CREATE TABLE IF NOT EXISTS outbound.agent_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  schedule_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT agent_schedules_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES outbound.voice_agents(id)
  -- Note: schedule_id references call_schedules which may be in inbound schema
);

-- Create ai_prompts table in outbound schema
CREATE TABLE IF NOT EXISTS outbound.ai_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general'::text,
  system_prompt text NOT NULL,
  begin_message text,
  agent_profile jsonb DEFAULT '{}'::jsonb,
  state_prompts jsonb DEFAULT '{}'::jsonb,
  tools_config jsonb DEFAULT '{}'::jsonb,
  call_type text,
  call_goal text,
  tone text,
  status text DEFAULT 'draft'::text,
  is_active boolean DEFAULT true,
  is_template boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  welcome_messages jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT ai_prompts_pkey PRIMARY KEY (id),
  CONSTRAINT ai_prompts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create call_analytics table in outbound schema
CREATE TABLE IF NOT EXISTS outbound.call_analytics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  agent_id uuid,
  date date NOT NULL,
  hour integer CHECK (hour >= 0 AND hour <= 23),
  total_calls integer DEFAULT 0,
  answered_calls integer DEFAULT 0,
  missed_calls integer DEFAULT 0,
  forwarded_calls integer DEFAULT 0,
  failed_calls integer DEFAULT 0,
  total_duration_seconds integer DEFAULT 0,
  average_duration_seconds numeric DEFAULT 0,
  min_duration_seconds integer DEFAULT 0,
  max_duration_seconds integer DEFAULT 0,
  total_cost numeric DEFAULT 0,
  average_cost numeric DEFAULT 0,
  average_quality_score numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT call_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT call_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT call_analytics_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES outbound.voice_agents(id)
);

-- ============================================================================
-- Create VIEWs in public schema for backward compatibility
-- ============================================================================

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

CREATE OR REPLACE VIEW public.call_analytics AS 
  SELECT * FROM outbound.call_analytics;

-- ============================================================================
-- Grant permissions on VIEWs
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_agents TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_calls TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_analytics TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_schedules TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompts TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_analytics TO authenticated, anon, service_role;

-- ============================================================================
-- Create indexes for better performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_voice_agents_user_id ON outbound.voice_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_agents_status ON outbound.voice_agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_calls_agent_id ON outbound.agent_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_calls_user_id ON outbound.agent_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_calls_created_at ON outbound.agent_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_agent_id ON outbound.agent_analytics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_date ON outbound.agent_analytics(date);
CREATE INDEX IF NOT EXISTS idx_call_analytics_agent_id ON outbound.call_analytics(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_date ON outbound.call_analytics(date);
