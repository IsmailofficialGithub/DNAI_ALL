-- Migration: Create error_logs table
-- Description: Table to store error logs with error heading, details, platform, and user reference
-- Date: 2025-01-16

CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_date timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error_heading text NOT NULL,
  error_details text NULL,
  platform character varying(50) NULL,
  user_id uuid NULL,
  CONSTRAINT error_logs_pkey PRIMARY KEY (id),
  CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES profiles (user_id) 
    ON UPDATE CASCADE 
    ON DELETE CASCADE
) TABLESPACE pg_default;

-- Add comment to table
COMMENT ON TABLE public.error_logs IS 'Stores error logs from various platforms with error details and user associations';

-- Add comments to columns
COMMENT ON COLUMN public.error_logs.id IS 'Unique identifier for the error log entry';
COMMENT ON COLUMN public.error_logs.created_date IS 'Timestamp when the error was logged';
COMMENT ON COLUMN public.error_logs.error_heading IS 'Brief description or heading of the error';
COMMENT ON COLUMN public.error_logs.error_details IS 'Detailed error information, stack trace, or additional context';
COMMENT ON COLUMN public.error_logs.platform IS 'Platform or source where the error occurred (e.g., frontend, backend, mobile)';
COMMENT ON COLUMN public.error_logs.user_id IS 'Foreign key to profiles table - user associated with the error (if applicable)';

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);

-- Create index on created_date for time-based queries
CREATE INDEX IF NOT EXISTS idx_error_logs_created_date ON public.error_logs(created_date);

-- Create index on platform for filtering by platform
CREATE INDEX IF NOT EXISTS idx_error_logs_platform ON public.error_logs(platform);
