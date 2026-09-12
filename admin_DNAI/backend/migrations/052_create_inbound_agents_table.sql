-- Migration: Create inbound_agents table
-- Description: Create inbound_agents table in inbound schema, similar to voice_agents but for inbound-specific agents
-- IMPORTANT: Run 052_create_knowledge_bases_tables.sql FIRST to create the knowledge_bases table
-- Date: 2025-01-XX

-- Create inbound_agents table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.inbound_agents (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  company_name character varying(255) NULL,
  website_url text NULL,
  goal text NULL,
  background text NULL,
  welcome_message text NULL,
  instruction_voice text NULL,
  script text NULL,
  voice character varying(100) NULL DEFAULT 'aura-helena-en'::character varying,
  tone character varying(50) NULL DEFAULT 'professional'::character varying,
  model character varying(50) NULL DEFAULT 'gpt-4o'::character varying,
  background_noise character varying(50) NULL DEFAULT 'office'::character varying,
  language character varying(10) NULL DEFAULT 'en-US'::character varying,
  agent_type character varying(50) NULL,
  tool character varying(50) NULL,
  timezone character varying(100) NULL,
  phone_provider character varying(50) NULL,
  phone_number character varying(20) NULL,
  phone_label character varying(255) NULL,
  twilio_sid character varying(255) NULL,
  twilio_auth_token text NULL,
  sms_enabled boolean NULL DEFAULT false,
  vonage_api_key character varying(255) NULL,
  vonage_api_secret text NULL,
  telnyx_api_key text NULL,
  status character varying(20) NULL DEFAULT 'active'::character varying,
  vapi_id uuid NULL,
  vapi_account_assigned integer NULL,
  account_in_use boolean NULL DEFAULT false,
  voice_provider character varying(50) NULL DEFAULT 'deepgram'::character varying,
  execution_mode character varying(20) NULL DEFAULT 'production'::character varying,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  temperature real NULL,
  confidence numeric(3, 2) NULL DEFAULT 0.8,
  verbosity numeric(3, 2) NULL DEFAULT 0.7,
  fallback_number character varying(20) NULL,
  fallback_enabled boolean NULL DEFAULT false,
  knowledge_base_config jsonb NULL DEFAULT '{}'::jsonb,
  knowledge_base_id uuid NULL,
  CONSTRAINT inbound_agents_pkey PRIMARY KEY (id),
  CONSTRAINT inbound_agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT inbound_agents_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases (id) ON DELETE SET NULL,
  CONSTRAINT inbound_agents_status_check CHECK (
    (status)::text = ANY (
      ARRAY[
        ('active'::character varying)::text,
        ('inactive'::character varying)::text,
        ('archived'::character varying)::text,
        ('testing'::character varying)::text,
        ('draft'::character varying)::text,
        ('activating'::character varying)::text
      ]
    )
  ),
  CONSTRAINT inbound_agents_tool_check CHECK (
    (tool)::text = ANY (
      ARRAY[
        'calendar'::character varying,
        'crm'::character varying,
        'email'::character varying,
        'sms'::character varying
      ]::text[]
    )
  ),
  CONSTRAINT inbound_agents_agent_type_check CHECK (
    (agent_type)::text = ANY (
      ARRAY[
        'sales'::character varying,
        'support'::character varying,
        'booking'::character varying,
        'general'::character varying
      ]::text[]
    )
  ),
  CONSTRAINT inbound_agents_verbosity_check CHECK (
    (verbosity >= 0::numeric) AND (verbosity <= 1::numeric)
  ),
  CONSTRAINT inbound_agents_confidence_check CHECK (
    (confidence >= 0::numeric) AND (confidence <= 1::numeric)
  ),
  CONSTRAINT inbound_agents_phone_provider_check CHECK (
    (phone_provider)::text = ANY (
      ARRAY[
        'twilio'::character varying,
        'vonage'::character varying,
        'telnyx'::character varying
      ]::text[]
    )
  )
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inbound_agents_user_id 
  ON inbound.inbound_agents USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_inbound_agents_status 
  ON inbound.inbound_agents USING btree (status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_inbound_agents_phone_number 
  ON inbound.inbound_agents USING btree (phone_number) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_inbound_agents_created_at 
  ON inbound.inbound_agents USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_inbound_agents_deleted_at 
  ON inbound.inbound_agents USING btree (deleted_at) TABLESPACE pg_default
  WHERE (deleted_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_inbound_agents_kb_id 
  ON inbound.inbound_agents USING btree (knowledge_base_id) TABLESPACE pg_default;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION inbound.update_inbound_agent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_inbound_agents_updated_at ON inbound.inbound_agents;
CREATE TRIGGER update_inbound_agents_updated_at
  BEFORE UPDATE ON inbound.inbound_agents
  FOR EACH ROW
  EXECUTE FUNCTION inbound.update_inbound_agent_updated_at();

-- Create VIEW in public schema for backward compatibility
CREATE OR REPLACE VIEW public.inbound_agents AS
SELECT * FROM inbound.inbound_agents;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON inbound.inbound_agents TO authenticated, anon, service_role;
GRANT SELECT ON public.inbound_agents TO authenticated, anon, service_role;

-- Add comment
COMMENT ON TABLE inbound.inbound_agents IS 'Inbound voice agents for handling incoming calls';
COMMENT ON VIEW public.inbound_agents IS 'Public view of inbound_agents table for backward compatibility';
