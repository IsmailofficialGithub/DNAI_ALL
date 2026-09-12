-- Migration: Add deleted_at column to email_logs, email_templates, and user_emails tables
-- Description: Adds soft delete support to email-related tables
-- Date: 2025-01-XX

-- Add deleted_at column to inbound.email_logs table
ALTER TABLE inbound.email_logs 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Add deleted_at column to inbound.email_templates table
ALTER TABLE inbound.email_templates 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Add deleted_at column to inbound.user_emails table
ALTER TABLE inbound.user_emails 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Create indexes for faster queries filtering out deleted records
CREATE INDEX IF NOT EXISTS idx_email_logs_deleted_at 
ON inbound.email_logs(deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_templates_deleted_at 
ON inbound.email_templates(deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_emails_deleted_at 
ON inbound.user_emails(deleted_at) 
WHERE deleted_at IS NULL;

-- Add comments to columns
COMMENT ON COLUMN inbound.email_logs.deleted_at IS 'Timestamp when the email log was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN inbound.email_templates.deleted_at IS 'Timestamp when the email template was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN inbound.user_emails.deleted_at IS 'Timestamp when the user email was soft deleted. NULL means not deleted.';

-- Update the public views to include deleted_at column
CREATE OR REPLACE VIEW public.email_logs AS 
SELECT * FROM inbound.email_logs;

CREATE OR REPLACE VIEW public.email_templates AS 
SELECT * FROM inbound.email_templates;

CREATE OR REPLACE VIEW public.user_emails AS 
SELECT * FROM inbound.user_emails;

-- Grant permissions on the views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_emails TO authenticated, anon, service_role;