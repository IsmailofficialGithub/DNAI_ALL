-- =====================================================
-- Migration: Fix get_user_permissions function for array roles
-- Description: Ensures get_user_permissions correctly handles TEXT[] role column
-- Date: 2025-01-XX
-- =====================================================

-- =====================================================
-- UPDATE get_user_permissions FUNCTION
-- =====================================================
-- Fix to handle role arrays correctly
-- The role_permissions.role is TEXT, profiles.role is TEXT[]
-- We need to use ANY() to check if the role string is in the role array
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(permission_name TEXT, granted BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  WITH user_perms AS (
    -- Check if systemadmin
    SELECT 
      CASE WHEN p.is_systemadmin THEN true ELSE false END as is_sysadmin
    FROM profiles p
    WHERE p.user_id = p_user_id
  ),
  role_perms AS (
    -- Get permissions for all roles in the user's role array
    -- role_permissions.role is TEXT, profiles.role is TEXT[]
    -- Use ANY() to check if role string is in the role array
    SELECT DISTINCT p.name as perm_name
    FROM profiles prof
    JOIN role_permissions rp ON rp.role = ANY(COALESCE(prof.role, ARRAY[]::TEXT[]))
    JOIN permissions p ON rp.permission_id = p.id
    WHERE prof.user_id = p_user_id
      AND prof.role IS NOT NULL
      AND array_length(prof.role, 1) > 0
  ),
  user_specific_perms AS (
    -- Get user-specific permission overrides
    SELECT 
      p.name as perm_name,
      up.granted
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = p_user_id
  )
  SELECT 
    COALESCE(usp.perm_name, rp.perm_name) as permission_name,
    CASE 
      WHEN (SELECT is_sysadmin FROM user_perms) THEN true
      WHEN usp.perm_name IS NOT NULL THEN usp.granted
      ELSE true
    END as granted
  FROM role_perms rp
  FULL OUTER JOIN user_specific_perms usp ON rp.perm_name = usp.perm_name
  WHERE (SELECT is_sysadmin FROM user_perms) = true 
     OR rp.perm_name IS NOT NULL 
     OR usp.perm_name IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ get_user_permissions function updated to handle TEXT[] role arrays';
END $$;

