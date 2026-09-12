-- Migration: Add missing columns to user_emails and email_templates tables
-- Description: Adds columns expected by the frontend that don't exist in the database schema
-- Date: 2025-01-XX

-- ============================================================================
-- USER_EMAILS TABLE
-- ============================================================================

-- Add email column (alias for email_address for frontend compatibility)
ALTER TABLE inbound.user_emails 
ADD COLUMN IF NOT EXISTS email character varying(255);

-- Add name column
ALTER TABLE inbound.user_emails 
ADD COLUMN IF NOT EXISTS name character varying(255);

-- Add smtp_password column
ALTER TABLE inbound.user_emails 
ADD COLUMN IF NOT EXISTS smtp_password text;

-- Update email column from email_address for existing records
UPDATE inbound.user_emails 
SET email = email_address 
WHERE email IS NULL AND email_address IS NOT NULL;

-- Create trigger function to sync email and email_address columns
CREATE OR REPLACE FUNCTION inbound.sync_user_emails_email()
RETURNS TRIGGER AS $$
BEGIN
  -- If email is set but email_address is not, copy email to email_address
  IF NEW.email IS NOT NULL AND (NEW.email_address IS NULL OR NEW.email_address != NEW.email) THEN
    NEW.email_address := NEW.email;
  END IF;
  -- If email_address is set but email is not, copy email_address to email
  IF NEW.email_address IS NOT NULL AND (NEW.email IS NULL OR NEW.email != NEW.email_address) THEN
    NEW.email := NEW.email_address;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync columns on insert/update
DROP TRIGGER IF EXISTS sync_user_emails_email_trigger ON inbound.user_emails;
CREATE TRIGGER sync_user_emails_email_trigger
  BEFORE INSERT OR UPDATE ON inbound.user_emails
  FOR EACH ROW
  EXECUTE FUNCTION inbound.sync_user_emails_email();

-- Create index on email column
CREATE INDEX IF NOT EXISTS idx_user_emails_email 
ON inbound.user_emails(email) 
WHERE email IS NOT NULL;

-- Add comments
COMMENT ON COLUMN inbound.user_emails.email IS 'Email address (alias for email_address, for frontend compatibility)';
COMMENT ON COLUMN inbound.user_emails.name IS 'Display name for the email address';
COMMENT ON COLUMN inbound.user_emails.smtp_password IS 'SMTP password for sending emails from this address';

-- ============================================================================
-- EMAIL_TEMPLATES TABLE
-- ============================================================================

-- Add name column (alias for template_name)
ALTER TABLE inbound.email_templates 
ADD COLUMN IF NOT EXISTS name character varying(255);

-- Add body column (combines body_html and body_text)
ALTER TABLE inbound.email_templates 
ADD COLUMN IF NOT EXISTS body text;

-- Add description column
ALTER TABLE inbound.email_templates 
ADD COLUMN IF NOT EXISTS description text;

-- Add is_default column
ALTER TABLE inbound.email_templates 
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Add accent_color column
ALTER TABLE inbound.email_templates 
ADD COLUMN IF NOT EXISTS accent_color character varying(50) DEFAULT '#4F46E5';

-- Add design_style column
ALTER TABLE inbound.email_templates 
ADD COLUMN IF NOT EXISTS design_style character varying(50) DEFAULT 'modern';

-- Add company_name column
ALTER TABLE inbound.email_templates 
ADD COLUMN IF NOT EXISTS company_name character varying(255);

-- Update name column from template_name for existing records
UPDATE inbound.email_templates 
SET name = template_name 
WHERE name IS NULL AND template_name IS NOT NULL;

-- Update body column from body_html or body_text for existing records
UPDATE inbound.email_templates 
SET body = COALESCE(body_html, body_text, '') 
WHERE body IS NULL;

-- Create trigger function to sync email_templates columns
CREATE OR REPLACE FUNCTION inbound.sync_email_templates_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync name and template_name
  IF NEW.name IS NOT NULL AND (NEW.template_name IS NULL OR NEW.template_name != NEW.name) THEN
    NEW.template_name := NEW.name;
  END IF;
  IF NEW.template_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name != NEW.template_name) THEN
    NEW.name := NEW.template_name;
  END IF;
  
  -- Sync body with body_html (prefer body_html over body_text)
  IF NEW.body IS NOT NULL AND (NEW.body_html IS NULL OR NEW.body_html != NEW.body) THEN
    NEW.body_html := NEW.body;
  END IF;
  IF NEW.body_html IS NOT NULL AND (NEW.body IS NULL OR NEW.body != NEW.body_html) THEN
    NEW.body := NEW.body_html;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync columns on insert/update
DROP TRIGGER IF EXISTS sync_email_templates_columns_trigger ON inbound.email_templates;
CREATE TRIGGER sync_email_templates_columns_trigger
  BEFORE INSERT OR UPDATE ON inbound.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION inbound.sync_email_templates_columns();

-- Create index on is_default for faster queries
CREATE INDEX IF NOT EXISTS idx_email_templates_is_default 
ON inbound.email_templates(is_default) 
WHERE is_default = true;

-- Add comments
COMMENT ON COLUMN inbound.email_templates.name IS 'Template name (alias for template_name, for frontend compatibility)';
COMMENT ON COLUMN inbound.email_templates.body IS 'Email body content (combines body_html and body_text)';
COMMENT ON COLUMN inbound.email_templates.description IS 'Description of the email template';
COMMENT ON COLUMN inbound.email_templates.is_default IS 'Whether this template is the default template for the user';
COMMENT ON COLUMN inbound.email_templates.accent_color IS 'Accent color for the email template design';
COMMENT ON COLUMN inbound.email_templates.design_style IS 'Design style for the email template (e.g., modern, classic)';
COMMENT ON COLUMN inbound.email_templates.company_name IS 'Company name to use in the email template';

-- Update the public views to include new columns
CREATE OR REPLACE VIEW public.user_emails AS 
SELECT * FROM inbound.user_emails;

CREATE OR REPLACE VIEW public.email_templates AS 
SELECT * FROM inbound.email_templates;

-- Grant permissions on the views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_emails TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated, anon, service_role;
