-- =====================================================
-- Migration: Fix auth_role_with_profiles view for array roles
-- Description: Ensures the view correctly exposes role as TEXT[] array
-- Date: 2025-01-XX
-- =====================================================

-- =====================================================
-- 1. DROP AND RECREATE VIEW WITH EXPLICIT TYPE CASTING
-- =====================================================
-- Drop the view if it exists (CASCADE to drop dependent objects)
DROP VIEW IF EXISTS auth_role_with_profiles CASCADE;

-- Recreate view with explicit type casting to ensure role is TEXT[]
CREATE VIEW auth_role_with_profiles AS
SELECT 
  p.user_id,
  p.email,
  p.full_name,
  p.role::TEXT[] as role,  -- Explicit cast to TEXT[] to ensure array type
  p.account_status,
  p.is_systemadmin,
  p.phone,
  p.referred_by,
  p.created_at,
  p.updated_at,
  p.trial_expiry_date,
  p.subscribed_products,
  p.lifetime_access,
  p.commission_rate,
  p.commission_updated_at
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.user_id;

-- Grant permissions
GRANT SELECT ON auth_role_with_profiles TO authenticated;
GRANT SELECT ON auth_role_with_profiles TO anon;

-- Add comment
COMMENT ON VIEW auth_role_with_profiles IS 'View combining profiles with auth.users, role is TEXT[] array';

-- =====================================================
-- 2. RE-CREATE FUNCTIONS TO ENSURE THEY USE CORRECT SYNTAX
-- =====================================================
-- Recreate get_dashboard_stats function
CREATE OR REPLACE FUNCTION get_dashboard_stats(start_of_month_param timestamp with time zone)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'totalUsers', (SELECT COUNT(*) FROM profiles WHERE 'admin' = ANY(role) OR 'user' = ANY(role) OR 'viewer' = ANY(role)),
    'totalConsumers', (SELECT COUNT(*) FROM profiles WHERE 'consumer' = ANY(role)),
    'activeConsumers', (SELECT COUNT(*) FROM profiles WHERE 'consumer' = ANY(role) AND account_status = 'active'),
    'expiredConsumers', (SELECT COUNT(*) FROM profiles WHERE 'consumer' = ANY(role) AND account_status = 'expired_subscription'),
    'totalResellers', (SELECT COUNT(*) FROM profiles WHERE 'reseller' = ANY(role)),
    'newUsersThisMonth', (SELECT COUNT(*) FROM profiles WHERE created_at >= start_of_month_param),
    'activeSubscriptions', (SELECT COUNT(DISTINCT user_id) FROM user_product_access),
    'totalProducts', (SELECT COUNT(*) FROM products),
    'totalInvoices', (SELECT COUNT(*) FROM invoices),
    'paidInvoices', (SELECT COUNT(*) FROM invoices WHERE status = 'paid'),
    'unpaidInvoices', (SELECT COUNT(*) FROM invoices WHERE status = 'unpaid'),
    'totalRevenue', (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'paid'),
    'revenueThisMonth', (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'paid' AND created_at >= start_of_month_param)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Recreate get_reseller_stats function
DROP FUNCTION IF EXISTS get_reseller_stats(timestamp with time zone, timestamp with time zone, text, integer);

CREATE OR REPLACE FUNCTION get_reseller_stats(
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  invoice_status text,
  result_limit integer
)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  WITH reseller_invoice_stats AS (
    SELECT 
      p.user_id,
      p.full_name,
      p.email,
      COUNT(i.id) as invoice_count,
      COALESCE(SUM(i.total_amount), 0) as total_revenue,
      json_agg(
        json_build_object(
          'id', i.id,
          'amount', i.total_amount,
          'status', i.status,
          'created_at', i.created_at
        ) ORDER BY i.created_at DESC
      ) FILTER (WHERE i.id IS NOT NULL) as invoices
    FROM auth_role_with_profiles p
    LEFT JOIN invoices i ON i.sender_id = p.user_id
      AND i.created_at >= start_date
      AND i.created_at <= end_date
      AND (invoice_status = 'all' OR i.status = invoice_status)
    WHERE 'reseller' = ANY(p.role::TEXT[])  -- Explicit cast to ensure array type
    GROUP BY p.user_id, p.full_name, p.email
    HAVING COUNT(i.id) > 0
    ORDER BY total_revenue DESC
    LIMIT result_limit
  )
  SELECT json_build_object(
    'stats', COALESCE(json_agg(
      json_build_object(
        'reseller_id', user_id,
        'reseller_name', full_name,
        'reseller_email', email,
        'total_revenue', total_revenue,
        'invoice_count', invoice_count,
        'invoices', invoices
      )
    ), '[]'::json),
    'summary', json_build_object(
      'total_resellers', COUNT(*),
      'total_revenue', COALESCE(SUM(total_revenue), 0),
      'total_invoices', COALESCE(SUM(invoice_count), 0)
    )
  ) INTO result
  FROM reseller_invoice_stats;
  
  RETURN COALESCE(result, json_build_object('stats', '[]'::json, 'summary', json_build_object('total_resellers', 0, 'total_revenue', 0, 'total_invoices', 0)));
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dashboard_stats(timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION get_reseller_stats(timestamp with time zone, timestamp with time zone, text, integer) TO authenticated;

-- =====================================================
-- 3. VERIFY VIEW CREATION
-- =====================================================
DO $$
DECLARE
  v_role_type TEXT;
BEGIN
  SELECT data_type INTO v_role_type
  FROM information_schema.columns
  WHERE table_name = 'auth_role_with_profiles'
    AND column_name = 'role';
  
  IF v_role_type = 'ARRAY' THEN
    RAISE NOTICE '✅ View auth_role_with_profiles created successfully with role as ARRAY';
  ELSE
    RAISE WARNING '⚠️ View role type is: % (expected ARRAY)', v_role_type;
  END IF;
END $$;

