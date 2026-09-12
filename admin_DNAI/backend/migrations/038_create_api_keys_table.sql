-- Migration: Create api_keys table
-- Description: Table to store API keys and secrets for authentication
-- Date: 2025-01-20

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  api_key character varying(255) NOT NULL,
  api_secret text NOT NULL,
  name character varying(255) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at timestamp with time zone NULL,
  created_by uuid NULL,
  CONSTRAINT api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT api_keys_api_key_key UNIQUE (api_key),
  CONSTRAINT api_keys_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES auth.users (id) 
    ON UPDATE CASCADE 
    ON DELETE SET NULL
) TABLESPACE pg_default;

-- Add comments to table
COMMENT ON TABLE public.api_keys IS 'Stores API keys and secrets for external API authentication';
COMMENT ON COLUMN public.api_keys.id IS 'Unique identifier for the API key record';
COMMENT ON COLUMN public.api_keys.api_key IS 'Public API key identifier (unique)';
COMMENT ON COLUMN public.api_keys.api_secret IS 'Hashed API secret for authentication';
COMMENT ON COLUMN public.api_keys.name IS 'Human-readable name/description for the API key';
COMMENT ON COLUMN public.api_keys.is_active IS 'Whether the API key is active and can be used';
COMMENT ON COLUMN public.api_keys.created_at IS 'Timestamp when the API key was created';
COMMENT ON COLUMN public.api_keys.updated_at IS 'Timestamp when the API key was last updated';
COMMENT ON COLUMN public.api_keys.last_used_at IS 'Timestamp when the API key was last used for authentication';
COMMENT ON COLUMN public.api_keys.created_by IS 'Reference to the user who created this API key';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON public.api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON public.api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON public.api_keys(created_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used_at ON public.api_keys(last_used_at);
