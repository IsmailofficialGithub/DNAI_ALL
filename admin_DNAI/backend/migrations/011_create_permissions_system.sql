-- =====================================================
-- Migration: Create Role-Based Permission System
-- Description: Implements granular permission control
-- =====================================================

-- =====================================================
-- 1. CREATE PERMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g., "users.create", "invoices.delete"
  resource TEXT NOT NULL, -- e.g., "users", "invoices", "products"
  action TEXT NOT NULL, -- e.g., "create", "read", "update", "delete", "manage"
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);

-- =====================================================
-- 2. CREATE ROLE_PERMISSIONS TABLE (Many-to-Many)
-- =====================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL, -- "admin", "reseller", "consumer", "viewer"
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- =====================================================
-- 3. CREATE USER_PERMISSIONS TABLE (Optional - for custom overrides)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true, -- true = grant, false = revoke
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, permission_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);

-- =====================================================
-- 4. ADD is_systemadmin COLUMN TO PROFILES TABLE
-- =====================================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_systemadmin BOOLEAN DEFAULT false;

-- Index for systemadmin check
CREATE INDEX IF NOT EXISTS idx_profiles_systemadmin ON profiles(is_systemadmin) WHERE is_systemadmin = true;

-- =====================================================
-- 5. SEED ALL PERMISSIONS
-- =====================================================

-- Users Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('users.create', 'users', 'create', 'Create new users'),
('users.view', 'users', 'view', 'View users list'),
('users.read', 'users', 'read', 'View user details'),
('users.update', 'users', 'update', 'Update user information'),
('users.delete', 'users', 'delete', 'Delete users'),
('users.manage', 'users', 'manage', 'Full user management'),
('users.reset_password', 'users', 'reset_password', 'Reset user passwords')
ON CONFLICT (name) DO NOTHING;

-- Consumers Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('consumers.create', 'consumers', 'create', 'Create new consumers'),
('consumers.view', 'consumers', 'view', 'View consumers list'),
('consumers.read', 'consumers', 'read', 'View consumer details'),
('consumers.update', 'consumers', 'update', 'Update consumer information'),
('consumers.delete', 'consumers', 'delete', 'Delete consumers'),
('consumers.manage', 'consumers', 'manage', 'Full consumer management')
ON CONFLICT (name) DO NOTHING;

-- Resellers Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('resellers.create', 'resellers', 'create', 'Create new resellers'),
('resellers.view', 'resellers', 'view', 'View resellers list'),
('resellers.read', 'resellers', 'read', 'View reseller details'),
('resellers.update', 'resellers', 'update', 'Update reseller information'),
('resellers.delete', 'resellers', 'delete', 'Delete resellers'),
('resellers.manage', 'resellers', 'manage', 'Full reseller management'),
('resellers.set_commission', 'resellers', 'set_commission', 'Set reseller commission rates')
ON CONFLICT (name) DO NOTHING;

-- Products Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('products.create', 'products', 'create', 'Create new products'),
('products.view', 'products', 'view', 'View products list'),
('products.read', 'products', 'read', 'View product details'),
('products.update', 'products', 'update', 'Update product information'),
('products.delete', 'products', 'delete', 'Delete products'),
('products.manage', 'products', 'manage', 'Full product management')
ON CONFLICT (name) DO NOTHING;

-- Invoices Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('invoices.create', 'invoices', 'create', 'Create new invoices'),
('invoices.view', 'invoices', 'view', 'View invoices list'),
('invoices.read', 'invoices', 'read', 'View invoice details'),
('invoices.update', 'invoices', 'update', 'Update invoice information'),
('invoices.delete', 'invoices', 'delete', 'Delete invoices'),
('invoices.manage', 'invoices', 'manage', 'Full invoice management'),
('invoices.resend', 'invoices', 'resend', 'Resend invoice emails')
ON CONFLICT (name) DO NOTHING;

-- Payments Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('payments.create', 'payments', 'create', 'Submit payment'),
('payments.view', 'payments', 'view', 'View payments list'),
('payments.read', 'payments', 'read', 'View payment details'),
('payments.approve', 'payments', 'approve', 'Approve payments'),
('payments.reject', 'payments', 'reject', 'Reject payments'),
('payments.manage', 'payments', 'manage', 'Full payment management')
ON CONFLICT (name) DO NOTHING;

-- Settings Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('settings.view', 'settings', 'view', 'View application settings'),
('settings.update', 'settings', 'update', 'Update application settings'),
('settings.manage', 'settings', 'manage', 'Full settings management'),
('settings.commission', 'settings', 'commission', 'Manage commission settings')
ON CONFLICT (name) DO NOTHING;

-- Offers Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('offers.create', 'offers', 'create', 'Create new offers'),
('offers.view', 'offers', 'view', 'View offers list'),
('offers.read', 'offers', 'read', 'View offer details'),
('offers.update', 'offers', 'update', 'Update offer information'),
('offers.delete', 'offers', 'delete', 'Delete offers'),
('offers.manage', 'offers', 'manage', 'Full offer management')
ON CONFLICT (name) DO NOTHING;

-- Invitations Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('invitations.create', 'invitations', 'create', 'Create invitations'),
('invitations.view', 'invitations', 'view', 'View invitations list'),
('invitations.manage', 'invitations', 'manage', 'Full invitation management')
ON CONFLICT (name) DO NOTHING;

-- Activity Logs Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('activity_logs.view', 'activity_logs', 'view', 'View activity logs'),
('activity_logs.read', 'activity_logs', 'read', 'View activity log details'),
('activity_logs.export', 'activity_logs', 'export', 'Export activity logs')
ON CONFLICT (name) DO NOTHING;

-- Customer Support Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('customer_support.create', 'customer_support', 'create', 'Create support tickets'),
('customer_support.view', 'customer_support', 'view', 'View support tickets'),
('customer_support.read', 'customer_support', 'read', 'View ticket details'),
('customer_support.update', 'customer_support', 'update', 'Update ticket status'),
('customer_support.manage', 'customer_support', 'manage', 'Full support management')
ON CONFLICT (name) DO NOTHING;

-- Dashboard Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('dashboard.view', 'dashboard', 'view', 'View dashboard statistics'),
('dashboard.stats', 'dashboard', 'stats', 'View detailed statistics'),
('dashboard.export', 'dashboard', 'export', 'Export dashboard data')
ON CONFLICT (name) DO NOTHING;

-- Permissions Management (for systemadmin only)
INSERT INTO permissions (name, resource, action, description) VALUES
('permissions.view', 'permissions', 'view', 'View permissions'),
('permissions.manage', 'permissions', 'manage', 'Manage role and user permissions'),
('permissions.assign', 'permissions', 'assign', 'Assign permissions to roles/users')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 6. SET DEFAULT ROLE PERMISSIONS
-- =====================================================

-- Admin Role - Most permissions (except systemadmin management)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
WHERE name IN (
  'users.create', 'users.view', 'users.read', 'users.update', 'users.delete', 'users.reset_password',
  'consumers.create', 'consumers.view', 'consumers.read', 'consumers.update', 'consumers.delete',
  'resellers.create', 'resellers.view', 'resellers.read', 'resellers.update', 'resellers.delete', 'resellers.set_commission',
  'products.create', 'products.view', 'products.read', 'products.update', 'products.delete',
  'invoices.create', 'invoices.view', 'invoices.read', 'invoices.update', 'invoices.delete', 'invoices.resend',
  'payments.view', 'payments.read', 'payments.approve', 'payments.reject',
  'settings.view', 'settings.update', 'settings.commission',
  'offers.create', 'offers.view', 'offers.read', 'offers.update', 'offers.delete',
  'invitations.create', 'invitations.view',
  'activity_logs.view', 'activity_logs.read', 'activity_logs.export',
  'customer_support.create', 'customer_support.view', 'customer_support.read', 'customer_support.update',
  'dashboard.view', 'dashboard.stats', 'dashboard.export'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Reseller Role - Limited permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'reseller', id FROM permissions
WHERE name IN (
  'consumers.create', 'consumers.view', 'consumers.read', 'consumers.update', 'consumers.delete',
  'invoices.create', 'invoices.view', 'invoices.read', 'invoices.resend',
  'payments.create', 'payments.view', 'payments.read',
  'products.view', 'products.read',
  'offers.view', 'offers.read',
  'customer_support.create', 'customer_support.view', 'customer_support.read',
  'dashboard.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Consumer Role - Minimal permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'consumer', id FROM permissions
WHERE name IN (
  'invoices.view', 'invoices.read',
  'payments.create', 'payments.view', 'payments.read',
  'customer_support.create', 'customer_support.view', 'customer_support.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Viewer Role - Read-only
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions
WHERE name IN (
  'users.view', 'users.read',
  'consumers.view', 'consumers.read',
  'resellers.view', 'resellers.read',
  'products.view', 'products.read',
  'invoices.view', 'invoices.read',
  'payments.view', 'payments.read',
  'dashboard.view', 'dashboard.stats'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- =====================================================
-- 7. HELPER FUNCTION: Check if user has permission
-- =====================================================
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_permission_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_systemadmin BOOLEAN;
  v_user_role TEXT;
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
  
  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = p_user_id;
  
  IF v_user_role IS NULL THEN
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
  
  -- Check role permission
  SELECT EXISTS(
    SELECT 1
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role = v_user_role
      AND p.name = p_permission_name
  ) INTO v_permission_granted;
  
  RETURN COALESCE(v_permission_granted, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION has_permission(UUID, TEXT) TO authenticated;

-- =====================================================
-- 8. HELPER FUNCTION: Get all user permissions
-- =====================================================
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
    -- Get role permissions
    SELECT DISTINCT p.name as perm_name
    FROM profiles prof
    JOIN role_permissions rp ON rp.role = prof.role
    JOIN permissions p ON rp.permission_id = p.id
    WHERE prof.user_id = p_user_id
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
-- 9. RLS POLICIES (if using RLS)
-- =====================================================
-- Enable RLS on new tables
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Permissions table - readable by authenticated users
CREATE POLICY "Permissions are viewable by authenticated users"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

-- Role permissions - readable by authenticated users
CREATE POLICY "Role permissions are viewable by authenticated users"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- User permissions - users can view their own, admins can view all
CREATE POLICY "Users can view their own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND (is_systemadmin = true OR role = 'admin')
    )
  );

-- =====================================================
-- 10. SET FIRST USER AS SYSTEMADMIN (Optional)
-- =====================================================
-- Uncomment and update the email to set a user as systemadmin
-- UPDATE profiles 
-- SET is_systemadmin = true 
-- WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'your-systemadmin@email.com' LIMIT 1
-- );

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Permission system created successfully!';
  RAISE NOTICE '📋 Total permissions created: %', (SELECT COUNT(*) FROM permissions);
  RAISE NOTICE '👥 Default role permissions assigned';
  RAISE NOTICE '🔧 Helper functions created: has_permission(), get_user_permissions()';
  RAISE NOTICE '⚠️  Remember to set a systemadmin user!';
END $$;

