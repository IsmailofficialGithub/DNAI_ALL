-- =====================================================
-- PERMISSIONS SYSTEM - QUICK REFERENCE SQL QUERIES
-- =====================================================

-- =====================================================
-- 1. SET USER AS SYSTEMADMIN
-- =====================================================
-- Set a user as systemadmin by email
UPDATE profiles 
SET is_systemadmin = true 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'admin@example.com' 
  LIMIT 1
);

-- Set a user as systemadmin by user_id
UPDATE profiles 
SET is_systemadmin = true 
WHERE user_id = 'your-user-id-here';

-- Remove systemadmin status
UPDATE profiles 
SET is_systemadmin = false 
WHERE user_id = 'your-user-id-here';

-- =====================================================
-- 2. CHECK USER PERMISSIONS
-- =====================================================
-- Check if user has specific permission
SELECT has_permission('user-id-here', 'users.create');

-- Get all permissions for a user
SELECT * FROM get_user_permissions('user-id-here');

-- Check if user is systemadmin
SELECT is_systemadmin FROM profiles WHERE user_id = 'user-id-here';

-- =====================================================
-- 3. ASSIGN PERMISSIONS TO ROLE
-- =====================================================
-- Grant permission to a role
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name = 'users.create'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Grant multiple permissions to a role
INSERT INTO role_permissions (role, permission_id)
SELECT 'reseller', id FROM permissions 
WHERE name IN ('invoices.create', 'invoices.view', 'invoices.read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Remove permission from a role
DELETE FROM role_permissions 
WHERE role = 'admin' 
AND permission_id = (SELECT id FROM permissions WHERE name = 'users.delete');

-- =====================================================
-- 4. ASSIGN PERMISSIONS TO SPECIFIC USER (Override)
-- =====================================================
-- Grant permission to specific user
INSERT INTO user_permissions (user_id, permission_id, granted)
SELECT 'user-id-here', id, true 
FROM permissions 
WHERE name = 'users.delete'
ON CONFLICT (user_id, permission_id) 
DO UPDATE SET granted = true, updated_at = NOW();

-- Revoke permission from specific user
INSERT INTO user_permissions (user_id, permission_id, granted)
SELECT 'user-id-here', id, false 
FROM permissions 
WHERE name = 'users.delete'
ON CONFLICT (user_id, permission_id) 
DO UPDATE SET granted = false, updated_at = NOW();

-- Remove user-specific permission (fallback to role permission)
DELETE FROM user_permissions 
WHERE user_id = 'user-id-here' 
AND permission_id = (SELECT id FROM permissions WHERE name = 'users.delete');

-- =====================================================
-- 5. VIEW PERMISSIONS
-- =====================================================
-- View all permissions
SELECT * FROM permissions ORDER BY resource, action;

-- View permissions by resource
SELECT * FROM permissions WHERE resource = 'users' ORDER BY action;

-- View all permissions for a role
SELECT 
  rp.role,
  p.name,
  p.resource,
  p.action,
  p.description
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role = 'admin'
ORDER BY p.resource, p.action;

-- View all permissions for a user (including role and overrides)
SELECT 
  p.name as permission_name,
  p.resource,
  p.action,
  CASE 
    WHEN prof.is_systemadmin THEN 'systemadmin (all)'
    WHEN up.permission_id IS NOT NULL THEN 
      CASE WHEN up.granted THEN 'user (granted)' ELSE 'user (revoked)' END
    WHEN rp.permission_id IS NOT NULL THEN 'role (' || prof.role || ')'
    ELSE 'none'
  END as source,
  COALESCE(up.granted, rp.permission_id IS NOT NULL, false) as has_permission
FROM permissions p
LEFT JOIN profiles prof ON prof.user_id = 'user-id-here'
LEFT JOIN role_permissions rp ON rp.role = prof.role AND rp.permission_id = p.id
LEFT JOIN user_permissions up ON up.user_id = prof.user_id AND up.permission_id = p.id
WHERE prof.user_id = 'user-id-here' 
  AND (
    prof.is_systemadmin = true 
    OR rp.permission_id IS NOT NULL 
    OR up.permission_id IS NOT NULL
  )
ORDER BY p.resource, p.action;

-- =====================================================
-- 6. LIST ALL SYSTEMADMINS
-- =====================================================
SELECT 
  p.user_id,
  p.full_name,
  p.email,
  p.role,
  p.is_systemadmin,
  p.created_at
FROM auth_role_with_profiles p
WHERE p.is_systemadmin = true
ORDER BY p.created_at;

-- =====================================================
-- 7. PERMISSION STATISTICS
-- =====================================================
-- Count permissions by resource
SELECT 
  resource,
  COUNT(*) as permission_count
FROM permissions
GROUP BY resource
ORDER BY resource;

-- Count permissions per role
SELECT 
  rp.role,
  COUNT(*) as permission_count
FROM role_permissions rp
GROUP BY rp.role
ORDER BY rp.role;

-- Count users with custom permissions
SELECT 
  COUNT(DISTINCT user_id) as users_with_overrides
FROM user_permissions;

-- =====================================================
-- 8. BULK OPERATIONS
-- =====================================================
-- Grant all "view" permissions to a role
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions 
WHERE action = 'view'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Grant all permissions for a resource to a role
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions 
WHERE resource = 'users'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Remove all permissions from a role
DELETE FROM role_permissions WHERE role = 'viewer';

-- =====================================================
-- 9. CREATE NEW PERMISSION
-- =====================================================
-- Add a new permission
INSERT INTO permissions (name, resource, action, description)
VALUES ('reports.export', 'reports', 'export', 'Export reports')
ON CONFLICT (name) DO NOTHING
RETURNING id;

-- =====================================================
-- 10. AUDIT QUERIES
-- =====================================================
-- View all role permission assignments
SELECT 
  rp.role,
  p.name as permission,
  rp.created_at as assigned_at
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
ORDER BY rp.role, p.resource, p.action;

-- View all user permission overrides
SELECT 
  up.user_id,
  p.name as permission,
  up.granted,
  up.created_at,
  up.updated_at
FROM user_permissions up
JOIN permissions p ON up.permission_id = p.id
ORDER BY up.user_id, p.resource, p.action;

