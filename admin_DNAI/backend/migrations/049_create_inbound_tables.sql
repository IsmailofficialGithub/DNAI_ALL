-- Migration: Create Inbound Calling Tables in inbound schema
-- Description: Creates inbound calling tables in the inbound schema
-- This is for the genie_inbound product
-- Date: 2025-01-XX

-- ============================================================================
-- INBOUND SCHEMA: Inbound Calling Tables
-- ============================================================================

-- Create inbound_numbers table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.inbound_numbers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  phone_number character varying NOT NULL,
  country_code character varying NOT NULL,
  phone_label character varying,
  call_forwarding_number character varying,
  provider character varying NOT NULL CHECK (provider::text = ANY (ARRAY['twilio'::character varying, 'vonage'::character varying, 'telnyx'::character varying, 'callhippo'::character varying]::text[])),
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying::text, 'inactive'::character varying::text, 'activating'::character varying::text, 'suspended'::character varying::text, 'error'::character varying::text, 'pending'::character varying::text])),
  health_status character varying CHECK (health_status::text = ANY (ARRAY['healthy'::character varying, 'unhealthy'::character varying, 'unknown'::character varying, 'testing'::character varying]::text[])),
  webhook_status character varying CHECK (webhook_status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'error'::character varying, 'unknown'::character varying]::text[])),
  assigned_to_agent_id uuid,
  is_in_use boolean DEFAULT false,
  sms_enabled boolean DEFAULT false,
  twilio_sid character varying,
  twilio_account_sid character varying,
  twilio_auth_token text,
  vonage_api_key character varying,
  vonage_api_secret text,
  vonage_application_id character varying,
  telnyx_api_key text,
  provider_api_key text,
  callhippo_api_key character varying,
  last_webhook_test timestamp with time zone,
  webhook_test_result jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT inbound_numbers_pkey PRIMARY KEY (id),
  CONSTRAINT inbound_numbers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT inbound_numbers_assigned_to_agent_id_fkey FOREIGN KEY (assigned_to_agent_id) REFERENCES outbound.voice_agents(id)
);

-- Create call_history table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.call_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  agent_id uuid,
  inbound_number_id uuid,
  call_sid character varying,
  provider character varying NOT NULL,
  caller_number character varying NOT NULL,
  caller_country_code character varying,
  called_number character varying NOT NULL,
  called_country_code character varying,
  call_status character varying CHECK (call_status::text = ANY (ARRAY['answered'::character varying, 'missed'::character varying, 'forwarded'::character varying, 'busy'::character varying, 'failed'::character varying, 'no-answer'::character varying, 'canceled'::character varying, 'completed'::character varying, 'ringing'::character varying, 'initiated'::character varying]::text[])),
  call_direction character varying DEFAULT 'inbound'::character varying CHECK (call_direction::text = ANY (ARRAY['inbound'::character varying, 'outbound'::character varying]::text[])),
  call_duration integer DEFAULT 0,
  call_start_time timestamp with time zone,
  call_end_time timestamp with time zone,
  call_answered_time timestamp with time zone,
  recording_url text,
  recording_duration integer,
  transcript text,
  transcript_url text,
  speaker_separated_transcript jsonb,
  call_forwarded_to character varying,
  call_cost numeric DEFAULT 0,
  call_quality_score numeric CHECK (call_quality_score >= 0::numeric AND call_quality_score <= 10::numeric),
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT call_history_pkey PRIMARY KEY (id),
  CONSTRAINT call_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT call_history_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES outbound.voice_agents(id),
  CONSTRAINT call_history_inbound_number_id_fkey FOREIGN KEY (inbound_number_id) REFERENCES inbound.inbound_numbers(id)
);

-- Create call_recordings table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.call_recordings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  call_history_id uuid NOT NULL,
  user_id uuid NOT NULL,
  recording_url text NOT NULL,
  recording_duration integer,
  recording_format character varying DEFAULT 'mp3'::character varying,
  file_size_bytes bigint,
  storage_provider character varying DEFAULT 's3'::character varying,
  storage_path text,
  transcription_status character varying DEFAULT 'pending'::character varying CHECK (transcription_status::text = ANY (ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying]::text[])),
  transcription_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT call_recordings_pkey PRIMARY KEY (id),
  CONSTRAINT call_recordings_call_history_id_fkey FOREIGN KEY (call_history_id) REFERENCES inbound.call_history(id),
  CONSTRAINT call_recordings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create call_schedules table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.call_schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  inbound_number_id uuid,
  agent_id uuid,
  schedule_name character varying NOT NULL,
  timezone character varying DEFAULT 'UTC'::character varying,
  is_active boolean DEFAULT true,
  start_date date,
  end_date date,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT call_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT call_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT call_schedules_inbound_number_id_fkey FOREIGN KEY (inbound_number_id) REFERENCES inbound.inbound_numbers(id),
  CONSTRAINT call_schedules_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES outbound.voice_agents(id)
);

-- Create weekly_availability table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.weekly_availability (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  schedule_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_available boolean DEFAULT true,
  start_time time without time zone,
  end_time time without time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT weekly_availability_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_availability_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES inbound.call_schedules(id) ON DELETE CASCADE,
  CONSTRAINT weekly_availability_day_check CHECK (day_of_week >= 0 AND day_of_week <= 6)
);

-- Create schedule_overrides table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.schedule_overrides (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  schedule_id uuid NOT NULL,
  override_date date NOT NULL,
  is_available boolean DEFAULT false,
  start_time time without time zone,
  end_time time without time zone,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedule_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_overrides_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES inbound.call_schedules(id) ON DELETE CASCADE,
  CONSTRAINT schedule_overrides_unique_date UNIQUE (schedule_id, override_date)
);

-- Create holidays table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.holidays (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  holiday_name character varying NOT NULL,
  holiday_date date NOT NULL,
  is_recurring boolean DEFAULT false,
  recurrence_pattern character varying,
  country_code character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT holidays_pkey PRIMARY KEY (id),
  CONSTRAINT holidays_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create holiday_messages table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.holiday_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  holiday_id uuid NOT NULL,
  inbound_number_id uuid,
  message_text text NOT NULL,
  message_type character varying DEFAULT 'voicemail'::character varying CHECK (message_type::text = ANY (ARRAY['voicemail'::character varying, 'sms'::character varying, 'email'::character varying]::text[])),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT holiday_messages_pkey PRIMARY KEY (id),
  CONSTRAINT holiday_messages_holiday_id_fkey FOREIGN KEY (holiday_id) REFERENCES inbound.holidays(id) ON DELETE CASCADE,
  CONSTRAINT holiday_messages_inbound_number_id_fkey FOREIGN KEY (inbound_number_id) REFERENCES inbound.inbound_numbers(id)
);

-- Create after_hours_messages table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.after_hours_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  inbound_number_id uuid NOT NULL,
  message_text text NOT NULL,
  message_type character varying DEFAULT 'voicemail'::character varying CHECK (message_type::text = ANY (ARRAY['voicemail'::character varying, 'sms'::character varying, 'email'::character varying]::text[])),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT after_hours_messages_pkey PRIMARY KEY (id),
  CONSTRAINT after_hours_messages_inbound_number_id_fkey FOREIGN KEY (inbound_number_id) REFERENCES inbound.inbound_numbers(id) ON DELETE CASCADE
);

-- Create inbound_analytics table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.inbound_analytics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  inbound_number_id uuid,
  agent_id uuid,
  date date NOT NULL,
  period character varying CHECK (period::text = ANY (ARRAY['hour'::character varying, 'day'::character varying, 'week'::character varying, 'month'::character varying]::text[])),
  total_calls integer DEFAULT 0,
  answered_calls integer DEFAULT 0,
  missed_calls integer DEFAULT 0,
  forwarded_calls integer DEFAULT 0,
  failed_calls integer DEFAULT 0,
  total_duration_seconds integer DEFAULT 0,
  average_duration_seconds numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  average_cost numeric DEFAULT 0,
  average_quality_score numeric DEFAULT 0,
  peak_hour integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inbound_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT inbound_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT inbound_analytics_inbound_number_id_fkey FOREIGN KEY (inbound_number_id) REFERENCES inbound.inbound_numbers(id),
  CONSTRAINT inbound_analytics_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES outbound.voice_agents(id)
);

-- ============================================================================
-- Create VIEWs in public schema for backward compatibility
-- ============================================================================

CREATE OR REPLACE VIEW public.inbound_numbers AS 
  SELECT * FROM inbound.inbound_numbers;

CREATE OR REPLACE VIEW public.call_history AS 
  SELECT * FROM inbound.call_history;

CREATE OR REPLACE VIEW public.call_recordings AS 
  SELECT * FROM inbound.call_recordings;

CREATE OR REPLACE VIEW public.call_schedules AS 
  SELECT * FROM inbound.call_schedules;

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

CREATE OR REPLACE VIEW public.inbound_analytics AS 
  SELECT * FROM inbound.inbound_analytics;

-- ============================================================================
-- Grant permissions on VIEWs
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_numbers TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_history TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_recordings TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_schedules TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_availability TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_overrides TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_messages TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.after_hours_messages TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_analytics TO authenticated, anon, service_role;

-- ============================================================================
-- Create indexes for better performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inbound_numbers_user_id ON inbound.inbound_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_inbound_numbers_status ON inbound.inbound_numbers(status);
CREATE INDEX IF NOT EXISTS idx_inbound_numbers_assigned_agent ON inbound.inbound_numbers(assigned_to_agent_id);
CREATE INDEX IF NOT EXISTS idx_call_history_user_id ON inbound.call_history(user_id);
CREATE INDEX IF NOT EXISTS idx_call_history_agent_id ON inbound.call_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_history_inbound_number_id ON inbound.call_history(inbound_number_id);
CREATE INDEX IF NOT EXISTS idx_call_history_call_status ON inbound.call_history(call_status);
CREATE INDEX IF NOT EXISTS idx_call_history_created_at ON inbound.call_history(created_at);
CREATE INDEX IF NOT EXISTS idx_call_recordings_call_history_id ON inbound.call_recordings(call_history_id);
CREATE INDEX IF NOT EXISTS idx_call_schedules_user_id ON inbound.call_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_call_schedules_inbound_number_id ON inbound.call_schedules(inbound_number_id);
CREATE INDEX IF NOT EXISTS idx_weekly_availability_schedule_id ON inbound.weekly_availability(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_schedule_id ON inbound.schedule_overrides(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_override_date ON inbound.schedule_overrides(override_date);
CREATE INDEX IF NOT EXISTS idx_holidays_user_id ON inbound.holidays(user_id);
CREATE INDEX IF NOT EXISTS idx_holidays_holiday_date ON inbound.holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holiday_messages_holiday_id ON inbound.holiday_messages(holiday_id);
CREATE INDEX IF NOT EXISTS idx_after_hours_messages_inbound_number_id ON inbound.after_hours_messages(inbound_number_id);
CREATE INDEX IF NOT EXISTS idx_inbound_analytics_user_id ON inbound.inbound_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_inbound_analytics_inbound_number_id ON inbound.inbound_analytics(inbound_number_id);
CREATE INDEX IF NOT EXISTS idx_inbound_analytics_date ON inbound.inbound_analytics(date);
