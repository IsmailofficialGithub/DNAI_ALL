-- =====================================================
-- Migration: Add Lifetime Access Permissions
-- Description: Adds permissions for granting and revoking lifetime access
-- Date: 2025-01-XX
-- =====================================================

-- =====================================================
-- 1. ADD LIFETIME ACCESS PERMISSIONS
-- =====================================================
-- Add permissions for managing lifetime access
INSERT INTO permissions (name, resource, action, description) VALUES
('consumers.grant_lifetime_access', 'consumers', 'grant_lifetime_access', 'Grant lifetime access to consumers'),
('consumers.revoke_lifetime_access', 'consumers', 'revoke_lifetime_access', 'Revoke lifetime access from consumers'),
('consumers.manage_lifetime_access', 'consumers', 'manage_lifetime_access', 'Grant or revoke lifetime access (includes both grant and revoke)')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. ASSIGN PERMISSIONS TO ADMIN ROLE
-- =====================================================
-- Admin role should have all lifetime access management permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
WHERE name IN (
  'consumers.grant_lifetime_access',
  'consumers.revoke_lifetime_access',
  'consumers.manage_lifetime_access'
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
  WHERE name LIKE 'consumers.%lifetime_access%';
  
  IF v_count = 3 THEN
    RAISE NOTICE '✅ Successfully created % lifetime access permissions', v_count;
  ELSE
    RAISE WARNING '⚠️ Expected 3 lifetime access permissions, found %', v_count;
  END IF;
END $$;

