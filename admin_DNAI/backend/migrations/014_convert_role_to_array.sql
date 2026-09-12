-- =====================================================
-- Migration: Convert role column to TEXT[] array
-- Description: Allows users to have multiple roles simultaneously
-- Date: 2025-01-XX
-- IMPORTANT: This migration PRESERVES ALL EXISTING DATA
-- Single role values (e.g., 'admin') become arrays (e.g., ['admin'])
-- =====================================================

-- =====================================================
-- 0. PRE-MIGRATION DATA VERIFICATION
-- =====================================================
-- Create a temporary table to store current role data for verification
CREATE TEMP TABLE IF NOT EXISTS migration_role_backup AS
SELECT user_id, role as original_role, 
       CASE 
         WHEN role IS NULL THEN NULL
         WHEN role = '' THEN ARRAY[]::TEXT[]
         ELSE ARRAY[role]
       END as expected_new_role
FROM profiles;

-- Verify we have data to migrate
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM profiles;
  IF v_count = 0 THEN
    RAISE NOTICE 'No profiles found - migration will proceed but no data to convert';
  ELSE
    RAISE NOTICE 'Found % profiles to migrate - all data will be preserved', v_count;
  END IF;
END $$;

-- =====================================================
-- 1. HANDLE POLICIES THAT DEPEND ON ROLE COLUMN
-- =====================================================
-- PostgreSQL cannot alter a column type if it's used in policies
-- We need to drop all policies that reference profiles.role, 
-- then recreate them after the migration with array logic

-- Create a temporary table to store policy definitions
CREATE TEMP TABLE IF NOT EXISTS migration_policy_backup (
  schemaname TEXT,
  tablename TEXT,
  policyname TEXT,
  permissive TEXT,
  roles TEXT[],
  cmd TEXT,
  qual TEXT,
  with_check TEXT
);

-- Find and backup all policies that reference profiles.role
-- This includes policies that check role directly or through profiles table
INSERT INTO migration_policy_backup
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE (qual IS NOT NULL AND (
    qual LIKE '%profiles.role%' 
    OR qual LIKE '%role%profiles%'
    OR qual ~* 'profiles\.role\s*[=<>]'
    OR qual ~* '\brole\s*=\s*'''
    OR qual ~* '\brole\s+IN\s*\('
  ))
   OR (with_check IS NOT NULL AND (
    with_check LIKE '%profiles.role%'
    OR with_check LIKE '%role%profiles%'
    OR with_check ~* 'profiles\.role\s*[=<>]'
    OR with_check ~* '\brole\s*=\s*'''
    OR with_check ~* '\brole\s+IN\s*\('
  ));

-- Drop all policies that depend on profiles.role
DO $$
DECLARE
  policy_rec RECORD;
BEGIN
  FOR policy_rec IN 
    SELECT schemaname, tablename, policyname
    FROM migration_policy_backup
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      policy_rec.policyname, 
      policy_rec.schemaname, 
      policy_rec.tablename);
    RAISE NOTICE 'Dropped policy: %.% on table %.%', 
      policy_rec.policyname, policy_rec.schemaname, policy_rec.tablename;
  END LOOP;
END $$;

-- =====================================================
-- 2. CONVERT ROLE COLUMN TO ARRAY
-- =====================================================
-- Step 1: Drop the default value if it exists (can't be cast automatically)
-- NOTE: This does NOT remove any data, only the default constraint
ALTER TABLE profiles 
ALTER COLUMN role DROP DEFAULT;

-- Step 2: Convert existing TEXT role values to TEXT[] arrays
-- DATA PRESERVATION: All existing role values are preserved:
--   - Single role 'admin' becomes ['admin'] (data preserved)
--   - NULL stays NULL (data preserved)
--   - Empty string '' becomes [] (empty array, data preserved)
--   - No data is lost or removed in this conversion
ALTER TABLE profiles 
ALTER COLUMN role TYPE TEXT[] USING 
  CASE 
    WHEN role IS NULL THEN NULL
    WHEN role = '' THEN ARRAY[]::TEXT[]
    ELSE ARRAY[role]
  END;

-- Step 3: Set a new default value as an array (optional, but good practice)
ALTER TABLE profiles 
ALTER COLUMN role SET DEFAULT ARRAY['user']::TEXT[];

-- Add comment to document the change
COMMENT ON COLUMN profiles.role IS 'Array of user roles (e.g., ["consumer", "reseller"])';

-- =====================================================
-- 3. UPDATE INDEXES
-- =====================================================
-- Drop old index if it exists
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_profiles_role_status;

-- Create GIN index for array operations (faster array contains checks)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles USING GIN (role);

-- Create composite index for role and account_status
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles USING GIN (role, account_status);

-- =====================================================
-- 4. UPDATE has_permission FUNCTION
-- =====================================================
-- Update the function to check if ANY role in the array has the permission
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_permission_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_systemadmin BOOLEAN;
  v_user_roles TEXT[];
  v_permission_granted BOOLEAN;
BEGIN
  -- Check if user is systemadmin
  SELECT is_systemadmin INTO v_is_systemadmin
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- Systemadmin has all permissions
  IF v_is_systemadmin = true THEN
    RETURN true;
  END IF;
  
  -- Get user roles array
  SELECT role INTO v_user_roles
  FROM profiles
  WHERE user_id = p_user_id;
  
  IF v_user_roles IS NULL OR array_length(v_user_roles, 1) IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check user-specific permission override first
  SELECT granted INTO v_permission_granted
  FROM user_permissions up
  JOIN permissions p ON up.permission_id = p.id
  WHERE up.user_id = p_user_id
    AND p.name = p_permission_name
  LIMIT 1;
  
  -- If user-specific permission exists, return it
  IF v_permission_granted IS NOT NULL THEN
    RETURN v_permission_granted;
  END IF;
  
  -- Check if ANY role in the array has the permission
  SELECT EXISTS(
    SELECT 1
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role = ANY(v_user_roles)
      AND p.name = p_permission_name
  ) INTO v_permission_granted;
  
  RETURN COALESCE(v_permission_granted, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION has_permission(UUID, TEXT) TO authenticated;

-- =====================================================
-- 5. UPDATE get_user_permissions FUNCTION
-- =====================================================
-- Update to handle role arrays
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
    SELECT DISTINCT p.name as perm_name
    FROM profiles prof
    JOIN role_permissions rp ON rp.role = ANY(prof.role)
    JOIN permissions p ON rp.permission_id = p.id
    WHERE prof.user_id = p_user_id
      AND prof.role IS NOT NULL
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
-- 6. RECREATE POLICIES WITH ARRAY LOGIC
-- =====================================================
-- Recreate all policies that were dropped, but update them to work with role arrays
-- Convert conditions like "role = 'admin'" to "'admin' = ANY(role)"
DO $$
DECLARE
  policy_rec RECORD;
  updated_qual TEXT;
  updated_with_check TEXT;
  policy_count INTEGER;
BEGIN
  -- Check if any policies were found
  SELECT COUNT(*) INTO policy_count FROM migration_policy_backup;
  
  IF policy_count = 0 THEN
    RAISE NOTICE 'No policies found that depend on role column';
  ELSE
    RAISE NOTICE 'Recreating % policies with array logic', policy_count;
  END IF;
  
  FOR policy_rec IN 
    SELECT * FROM migration_policy_backup
  LOOP
    -- Convert role conditions in USING clause
    updated_qual := policy_rec.qual;
    IF updated_qual IS NOT NULL THEN
      -- Replace "profiles.role = 'admin'" with "'admin' = ANY(profiles.role)"
      updated_qual := regexp_replace(updated_qual, 
        'profiles\.role\s*=\s*''([^'']+)''', 
        '''\1'' = ANY(profiles.role)', 
        'gi');
      -- Replace "role = 'admin'" (without profiles prefix) with "'admin' = ANY(role)"
      updated_qual := regexp_replace(updated_qual, 
        '(\s|\(|,)(role)\s*=\s*''([^'']+)''', 
        '\1''\3'' = ANY(\2)', 
        'gi');
      -- Handle role IN ('admin', 'user') -> 'admin' = ANY(role) OR 'user' = ANY(role)
      updated_qual := regexp_replace(updated_qual,
        'role\s+IN\s*\(([^)]+)\)',
        '(SELECT bool_or(unnest(ARRAY[\1]) = ANY(role)))',
        'gi');
    END IF;
    
    -- Convert role conditions in WITH CHECK clause
    updated_with_check := policy_rec.with_check;
    IF updated_with_check IS NOT NULL THEN
      updated_with_check := regexp_replace(updated_with_check, 
        'profiles\.role\s*=\s*''([^'']+)''', 
        '''\1'' = ANY(profiles.role)', 
        'gi');
      updated_with_check := regexp_replace(updated_with_check, 
        '(\s|\(|,)(role)\s*=\s*''([^'']+)''', 
        '\1''\3'' = ANY(\2)', 
        'gi');
      updated_with_check := regexp_replace(updated_with_check,
        'role\s+IN\s*\(([^)]+)\)',
        '(SELECT bool_or(unnest(ARRAY[\1]) = ANY(role)))',
        'gi');
    END IF;
    
    -- Recreate the policy with error handling
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR %s%s USING (%s)%s',
        policy_rec.policyname,
        policy_rec.schemaname,
        policy_rec.tablename,
        CASE WHEN policy_rec.permissive = 'RESTRICTIVE' THEN 'RESTRICTIVE ' ELSE '' END,
        policy_rec.cmd,
        COALESCE(array_to_string(policy_rec.roles, ', '), 'authenticated'),
        COALESCE(updated_qual, 'true'),
        CASE 
          WHEN updated_with_check IS NOT NULL 
          THEN format(' WITH CHECK (%s)', updated_with_check)
          ELSE ''
        END
      );
      
      RAISE NOTICE 'Recreated policy: %.% on table %.%', 
        policy_rec.policyname, policy_rec.schemaname, policy_rec.tablename;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to recreate policy %.% on table %.%: %', 
        policy_rec.policyname, policy_rec.schemaname, policy_rec.tablename, SQLERRM;
      -- Continue with next policy
    END;
  END LOOP;
END $$;

-- Clean up policy backup table
DROP TABLE IF EXISTS migration_policy_backup;

-- =====================================================
-- 7. POST-MIGRATION DATA VERIFICATION
-- =====================================================
-- Verify that all data was preserved correctly
DO $$
DECLARE
  v_mismatch_count INTEGER;
  v_total_count INTEGER;
  v_column_type TEXT;
BEGIN
  -- Check column type was changed
  SELECT udt_name INTO v_column_type
  FROM information_schema.columns 
  WHERE table_name = 'profiles' 
    AND column_name = 'role';
  
  IF v_column_type != '_text' THEN
    RAISE EXCEPTION 'Migration failed: role column is not TEXT[] (found: %)', v_column_type;
  END IF;
  
  RAISE NOTICE 'Column type verified: role is now TEXT[]';
  
  -- Verify data integrity: compare original with converted
  SELECT COUNT(*) INTO v_mismatch_count
  FROM migration_role_backup b
  JOIN profiles p ON b.user_id = p.user_id
  WHERE (b.expected_new_role IS NULL AND p.role IS NOT NULL)
     OR (b.expected_new_role IS NOT NULL AND p.role IS NULL)
     OR (b.expected_new_role IS NOT NULL AND p.role IS NOT NULL 
         AND b.expected_new_role != p.role);
  
  SELECT COUNT(*) INTO v_total_count FROM profiles;
  
  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION 'Data integrity check failed: % out of % records have mismatched role values', 
      v_mismatch_count, v_total_count;
  END IF;
  
  RAISE NOTICE 'Data integrity verified: All % records preserved correctly', v_total_count;
END $$;

-- Display column information
SELECT 
  column_name, 
  data_type,
  udt_name
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'role';

-- Clean up temporary backup table
DROP TABLE IF EXISTS migration_role_backup;
