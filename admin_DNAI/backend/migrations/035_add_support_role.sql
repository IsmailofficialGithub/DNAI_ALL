-- =====================================================
-- Migration: Add Support Role with Permissions
-- Description: Adds "support" role with permissions to view and manage user data
-- Date: 2025-01-XX
-- =====================================================

-- =====================================================
-- 1. ADD SUPPORT ROLE PERMISSIONS
-- =====================================================
-- Insert support role permissions into role_permissions table
-- Support role has:
-- - User Management: view, read, update (no delete/create to prevent data loss)
-- - Customer Support: full access to support tickets
-- - Invoices: view and read (for troubleshooting)
-- - Payments: view and read (for troubleshooting)
-- - Dashboard: view basic stats

INSERT INTO role_permissions (role, permission_id)
SELECT 'support', id FROM permissions
WHERE name IN (
  -- User Management (view, read, update - no delete/create)
  'users.view',
  'users.read',
  'users.update',
  
  -- Customer Support (full access)
  'customer_support.create',
  'customer_support.view',
  'customer_support.read',
  'customer_support.update',
  'customer_support.manage',
  
  -- Invoices (read-only for troubleshooting)
  'invoices.view',
  'invoices.read',
  
  -- Payments (read-only for troubleshooting)
  'payments.view',
  'payments.read',
  
  -- Dashboard (view basic stats)
  'dashboard.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- =====================================================
-- 2. VERIFICATION
-- =====================================================
-- Verify that support role permissions were added
DO $$
DECLARE
  v_permission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_permission_count
  FROM role_permissions
  WHERE role = 'support';
  
  IF v_permission_count = 0 THEN
    RAISE WARNING 'No permissions were added for support role. Check if permissions exist in permissions table.';
  ELSE
    RAISE NOTICE '✅ Support role created successfully with % permissions', v_permission_count;
  END IF;
END $$;

-- Display the permissions assigned to support role
SELECT 
  rp.role,
  p.name as permission_name,
  p.resource,
  p.action,
  p.description
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role = 'support'
ORDER BY p.resource, p.action;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Support role migration completed!';
  RAISE NOTICE '📋 Support role can now be assigned to users';
  RAISE NOTICE '🔐 Support role has permissions to view and update user data';
  RAISE NOTICE '⚠️  Remember to update code to include "support" in validRoles arrays';
END $$;

