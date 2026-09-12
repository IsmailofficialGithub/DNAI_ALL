-- Migration: Create whatsapp_applications table
-- Description: Table to store WhatsApp application configurations and Baileys session data
-- Date: 2025-01-20

CREATE TABLE IF NOT EXISTS public.whatsapp_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(255) NOT NULL,
  phone character varying(50) NOT NULL,
  purpose text,
  session_data text NULL,
  status character varying(20) NOT NULL DEFAULT 'disconnected',
  qr_code text NULL,
  last_connected_at timestamp with time zone NULL,
  last_disconnected_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by uuid NULL,
  CONSTRAINT whatsapp_applications_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_applications_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES auth.users (id) 
    ON UPDATE CASCADE 
    ON DELETE SET NULL,
  CONSTRAINT whatsapp_applications_status_check CHECK (status IN ('disconnected', 'connecting', 'connected', 'error'))
) TABLESPACE pg_default;

-- Add comments to table
COMMENT ON TABLE public.whatsapp_applications IS 'Stores WhatsApp application configurations and Baileys session data';
COMMENT ON COLUMN public.whatsapp_applications.id IS 'Unique identifier for the WhatsApp application';
COMMENT ON COLUMN public.whatsapp_applications.name IS 'Human-readable name for the WhatsApp application';
COMMENT ON COLUMN public.whatsapp_applications.phone IS 'WhatsApp phone number (with country code)';
COMMENT ON COLUMN public.whatsapp_applications.purpose IS 'Description/purpose of the WhatsApp application';
COMMENT ON COLUMN public.whatsapp_applications.session_data IS 'Encrypted Baileys session credentials stored as JSON string';
COMMENT ON COLUMN public.whatsapp_applications.status IS 'Connection status: disconnected, connecting, connected, error';
COMMENT ON COLUMN public.whatsapp_applications.qr_code IS 'Temporary QR code data URL for authentication';
COMMENT ON COLUMN public.whatsapp_applications.last_connected_at IS 'Timestamp when the application was last connected';
COMMENT ON COLUMN public.whatsapp_applications.last_disconnected_at IS 'Timestamp when the application was last disconnected';
COMMENT ON COLUMN public.whatsapp_applications.created_at IS 'Timestamp when the application was created';
COMMENT ON COLUMN public.whatsapp_applications.updated_at IS 'Timestamp when the application was last updated';
COMMENT ON COLUMN public.whatsapp_applications.created_by IS 'Reference to the user who created this application';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_applications_status ON public.whatsapp_applications(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_applications_phone ON public.whatsapp_applications(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_applications_created_by ON public.whatsapp_applications(created_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_applications_created_at ON public.whatsapp_applications(created_at DESC);
