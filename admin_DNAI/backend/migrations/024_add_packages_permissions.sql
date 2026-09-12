-- =====================================================
-- Migration: Add Packages Permissions
-- Description: Adds permissions for package management (create, view, read, update, delete)
-- Date: 2025-01-XX
-- =====================================================

-- =====================================================
-- 1. ADD PACKAGES PERMISSIONS
-- =====================================================
-- Add permissions for managing packages
INSERT INTO permissions (name, resource, action, description) VALUES
('packages.create', 'packages', 'create', 'Create new packages'),
('packages.view', 'packages', 'view', 'View packages list'),
('packages.read', 'packages', 'read', 'View package details'),
('packages.update', 'packages', 'update', 'Update package information'),
('packages.delete', 'packages', 'delete', 'Delete packages'),
('packages.manage', 'packages', 'manage', 'Full package management')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. ASSIGN PERMISSIONS TO ROLES
-- =====================================================

-- Admin Role - Full package management permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
WHERE name IN (
  'packages.create',
  'packages.view',
  'packages.read',
  'packages.update',
  'packages.delete',
  'packages.manage'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Reseller Role - View and read packages (can see packages to assign to consumers)
INSERT INTO role_permissions (role, permission_id)
SELECT 'reseller', id FROM permissions
WHERE name IN (
  'packages.view',
  'packages.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Consumer Role - View and read packages (can see available packages)
INSERT INTO role_permissions (role, permission_id)
SELECT 'consumer', id FROM permissions
WHERE name IN (
  'packages.view',
  'packages.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Viewer Role - View and read packages (read-only access)
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions
WHERE name IN (
  'packages.view',
  'packages.read'
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
  WHERE name LIKE 'packages.%';
  
  IF v_count = 6 THEN
    RAISE NOTICE '✅ Successfully created % package permissions', v_count;
  ELSE
    RAISE WARNING '⚠️ Expected 6 package permissions, found %', v_count;
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
  WHERE rp.role = 'admin' AND p.name LIKE 'packages.%';
  
  -- Check reseller permissions
  SELECT COUNT(*) INTO v_reseller_count
  FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE rp.role = 'reseller' AND p.name LIKE 'packages.%';
  
  -- Check consumer permissions
  SELECT COUNT(*) INTO v_consumer_count
  FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE rp.role = 'consumer' AND p.name LIKE 'packages.%';
  
  -- Check viewer permissions
  SELECT COUNT(*) INTO v_viewer_count
  FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE rp.role = 'viewer' AND p.name LIKE 'packages.%';
  
  RAISE NOTICE '✅ Admin role: % package permissions', v_admin_count;
  RAISE NOTICE '✅ Reseller role: % package permissions', v_reseller_count;
  RAISE NOTICE '✅ Consumer role: % package permissions', v_consumer_count;
  RAISE NOTICE '✅ Viewer role: % package permissions', v_viewer_count;
END $$;

