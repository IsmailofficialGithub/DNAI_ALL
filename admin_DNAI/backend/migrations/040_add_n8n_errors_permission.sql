-- Migration: Add n8n_errors.view permission
-- Description: Adds permission for viewing n8n workflow errors (superadmin only)
-- Date: 2025-01-20

-- Insert n8n_errors.view permission
INSERT INTO permissions (name, resource, action, description)
VALUES 
  ('n8n_errors.view', 'n8n_errors', 'view', 'View n8n workflow execution errors')
ON CONFLICT (name) DO NOTHING;

-- Note: This permission should only be assigned to systemadmins
-- Regular admins should not have this permission by default
-- Systemadmins automatically have all permissions, so no need to assign to role_permissions

-- Add comment
COMMENT ON TABLE permissions IS 'Updated: Added n8n_errors.view permission for superadmin access to n8n workflow errors';
