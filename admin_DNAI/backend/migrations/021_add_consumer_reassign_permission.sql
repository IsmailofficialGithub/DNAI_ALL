-- =====================================================
-- Migration: Add consumers.reassign permission
-- Description: Allows admins to reassign consumers to different resellers
-- Date: 2025-12-10
-- =====================================================

-- =====================================================
-- 1. ADD consumers.reassign PERMISSION
-- =====================================================
INSERT INTO permissions (name, resource, action, description) VALUES
('consumers.reassign', 'consumers', 'reassign', 'Reassign consumers to different resellers')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. GRANT PERMISSION TO ADMIN ROLE
-- =====================================================
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
WHERE name = 'consumers.reassign'
ON CONFLICT (role, permission_id) DO NOTHING;

-- =====================================================
-- 3. VERIFICATION
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM permissions WHERE name = 'consumers.reassign') THEN
    RAISE NOTICE '✅ consumers.reassign permission added successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to add consumers.reassign permission';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE p.name = 'consumers.reassign' AND rp.role = 'admin'
  ) THEN
    RAISE NOTICE '✅ consumers.reassign permission granted to admin role';
  ELSE
    RAISE EXCEPTION '❌ Failed to grant consumers.reassign permission to admin role';
  END IF;
END $$;

