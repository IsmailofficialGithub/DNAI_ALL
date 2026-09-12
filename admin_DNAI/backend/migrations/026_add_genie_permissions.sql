-- =====================================================
-- Migration: Add Genie Permissions
-- Description: Adds permissions for Genie call management (calls, campaigns, leads, analytics)
-- Date: 2025-12-XX
-- =====================================================

-- =====================================================
-- 1. ADD GENIE PERMISSIONS
-- =====================================================
-- Add permissions for managing Genie calls, campaigns, leads, and analytics
INSERT INTO permissions (name, resource, action, description) VALUES
-- View/Read permissions
('genie.view', 'genie', 'view', 'View Genie dashboard and call data'),
('genie.calls.view', 'genie_calls', 'view', 'View call logs list'),
('genie.calls.read', 'genie_calls', 'read', 'View call details and transcripts'),
('genie.campaigns.view', 'genie_campaigns', 'view', 'View scheduled call campaigns'),
('genie.campaigns.read', 'genie_campaigns', 'read', 'View campaign details'),
('genie.leads.view', 'genie_leads', 'view', 'View leads list'),
('genie.leads.read', 'genie_leads', 'read', 'View lead details'),
('genie.analytics.view', 'genie_analytics', 'view', 'View Genie analytics and reports'),

-- Create permissions
('genie.campaigns.create', 'genie_campaigns', 'create', 'Create new call campaigns'),
('genie.leads.create', 'genie_leads', 'create', 'Create leads manually'),

-- Update permissions
('genie.calls.update', 'genie_calls', 'update', 'Update call information (mark as lead, etc.)'),
('genie.campaigns.update', 'genie_campaigns', 'update', 'Update scheduled campaigns'),
('genie.leads.update', 'genie_leads', 'update', 'Update lead information'),

-- Delete permissions
('genie.campaigns.delete', 'genie_campaigns', 'delete', 'Cancel/delete campaigns'),
('genie.leads.delete', 'genie_leads', 'delete', 'Delete leads'),

-- Export permissions
('genie.leads.export', 'genie_leads', 'export', 'Export leads to CSV'),

-- Full management
('genie.manage', 'genie', 'manage', 'Full Genie management (includes all permissions)')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. ASSIGN PERMISSIONS TO ROLES
-- =====================================================

-- Admin Role - Full genie management permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
WHERE name IN (
  'genie.view',
  'genie.calls.view',
  'genie.calls.read',
  'genie.calls.update',
  'genie.campaigns.view',
  'genie.campaigns.read',
  'genie.campaigns.create',
  'genie.campaigns.update',
  'genie.campaigns.delete',
  'genie.leads.view',
  'genie.leads.read',
  'genie.leads.create',
  'genie.leads.update',
  'genie.leads.delete',
  'genie.leads.export',
  'genie.analytics.view',
  'genie.manage'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Reseller Role - View calls, campaigns, and leads (read-only + export)
INSERT INTO role_permissions (role, permission_id)
SELECT 'reseller', id FROM permissions
WHERE name IN (
  'genie.view',
  'genie.calls.view',
  'genie.calls.read',
  'genie.campaigns.view',
  'genie.campaigns.read',
  'genie.leads.view',
  'genie.leads.read',
  'genie.leads.export',
  'genie.analytics.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Consumer Role - View own calls and leads only
INSERT INTO role_permissions (role, permission_id)
SELECT 'consumer', id FROM permissions
WHERE name IN (
  'genie.view',
  'genie.calls.view',
  'genie.calls.read',
  'genie.leads.view',
  'genie.leads.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Viewer Role - Read-only access to genie data
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions
WHERE name IN (
  'genie.view',
  'genie.calls.view',
  'genie.calls.read',
  'genie.campaigns.view',
  'genie.campaigns.read',
  'genie.leads.view',
  'genie.leads.read',
  'genie.analytics.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- =====================================================
-- 3. VERIFY PERMISSIONS WERE CREATED
-- =====================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM permissions
  WHERE name LIKE 'genie.%';
  
  IF v_count >= 17 THEN
    RAISE NOTICE '✅ Successfully created % genie permissions', v_count;
  ELSE
    RAISE WARNING '⚠️ Expected at least 17 genie permissions, found %', v_count;
  END IF;
END $$;

-- =====================================================
-- 4. VERIFY ROLE PERMISSIONS WERE ASSIGNED
-- =====================================================
DO $$
DECLARE
  v_admin_count INTEGER;
  v_reseller_count INTEGER;
  v_consumer_count INTEGER;
  v_viewer_count INTEGER;
BEGIN
  -- Check admin permissions
  SELECT COUNT(*) INTO v_admin_count
  FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE rp.role = 'admin' AND p.name LIKE 'genie.%';
  
  -- Check reseller permissions
  SELECT COUNT(*) INTO v_reseller_count
  FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE rp.role = 'reseller' AND p.name LIKE 'genie.%';
  
  -- Check consumer permissions
  SELECT COUNT(*) INTO v_consumer_count
  FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE rp.role = 'consumer' AND p.name LIKE 'genie.%';
  
  -- Check viewer permissions
  SELECT COUNT(*) INTO v_viewer_count
  FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE rp.role = 'viewer' AND p.name LIKE 'genie.%';
  
  RAISE NOTICE '✅ Admin role: % genie permissions', v_admin_count;
  RAISE NOTICE '✅ Reseller role: % genie permissions', v_reseller_count;
  RAISE NOTICE '✅ Consumer role: % genie permissions', v_consumer_count;
  RAISE NOTICE '✅ Viewer role: % genie permissions', v_viewer_count;
END $$;

