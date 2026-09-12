-- Fix get_reseller_stats function to use auth_role_with_profiles view
-- This fixes the error: column p.email does not exist

-- Drop and recreate the function with correct view
DROP FUNCTION IF EXISTS get_reseller_stats(timestamp with time zone, timestamp with time zone, text, integer);

-- Function: Get reseller stats efficiently with JOIN
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_reseller_stats(timestamp with time zone, timestamp with time zone, text, integer) TO authenticated;

