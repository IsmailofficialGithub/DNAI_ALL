-- Dashboard Performance Optimization
-- This migration adds indexes and RPC functions to optimize dashboard API performance

-- ========================================
-- 1. CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles(role, account_status);

-- Indexes for invoices table
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_sender_id ON invoices(sender_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_sender_status ON invoices(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_status_created ON invoices(status, created_at);

-- Index for user_product_access
CREATE INDEX IF NOT EXISTS idx_user_product_access_user_id ON user_product_access(user_id);

-- Analyze tables for query planner
ANALYZE profiles;
ANALYZE invoices;
ANALYZE user_product_access;
ANALYZE products;

-- ========================================
-- 2. CREATE OPTIMIZED RPC FUNCTIONS
-- ========================================

-- Function 1: Get all dashboard stats in ONE query
CREATE OR REPLACE FUNCTION get_dashboard_stats(start_of_month_param timestamp with time zone)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'totalUsers', (SELECT COUNT(*) FROM profiles WHERE role IN ('admin', 'user', 'viewer')),
    'totalConsumers', (SELECT COUNT(*) FROM profiles WHERE role = 'consumer'),
    'activeConsumers', (SELECT COUNT(*) FROM profiles WHERE role = 'consumer' AND account_status = 'active'),
    'expiredConsumers', (SELECT COUNT(*) FROM profiles WHERE role = 'consumer' AND account_status = 'expired_subscription'),
    'totalResellers', (SELECT COUNT(*) FROM profiles WHERE role = 'reseller'),
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

-- Function 2: Get reseller stats efficiently with JOIN
-- Uses auth_role_with_profiles view which includes email from auth.users
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
    WHERE p.role = 'reseller'
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

-- ========================================
-- 3. GRANT PERMISSIONS
-- ========================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats(timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION get_reseller_stats(timestamp with time zone, timestamp with time zone, text, integer) TO authenticated;

