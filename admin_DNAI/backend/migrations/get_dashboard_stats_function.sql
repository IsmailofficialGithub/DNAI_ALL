-- =====================================================
-- Function: get_dashboard_stats
-- Description: Get all dashboard statistics in a single optimized query
-- Handles role as TEXT[] array
-- =====================================================

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_dashboard_stats(timestamp with time zone) TO authenticated;

