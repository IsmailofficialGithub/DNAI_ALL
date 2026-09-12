-- Migration: Create database functions for dashboard stats optimization
-- Date: 2025
-- Description: Creates optimized SQL functions for dashboard statistics

-- Function to get total revenue from paid invoices
CREATE OR REPLACE FUNCTION sum_paid_invoices_total()
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'paid';
$$ LANGUAGE sql STABLE;

-- Function to get revenue this month from paid invoices
CREATE OR REPLACE FUNCTION sum_paid_invoices_this_month(start_date TIMESTAMP)
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(total_amount), 0) 
  FROM invoices 
  WHERE status = 'paid' AND created_at >= start_date;
$$ LANGUAGE sql STABLE;

-- Function to get count of unique users with product access
CREATE OR REPLACE FUNCTION count_unique_subscriptions()
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT user_id) FROM user_product_access;
$$ LANGUAGE sql STABLE;

