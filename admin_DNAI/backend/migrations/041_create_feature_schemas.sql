-- Migration: Create feature-based schemas for better organization
-- Description: Creates separate schemas for outbound, inbound, billing, admin, and analytics features
-- This allows better organization without breaking existing code (VIEWs will be created in next migration)
-- Date: 2025-01-XX

-- Create schemas for feature organization
CREATE SCHEMA IF NOT EXISTS outbound;
CREATE SCHEMA IF NOT EXISTS inbound;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS future_features; -- For tables not needed yet

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA outbound TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA inbound TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA billing TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA admin TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA analytics TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA future_features TO authenticated, anon, service_role;

-- Grant CREATE permission for service_role (for migrations)
GRANT CREATE ON SCHEMA outbound TO service_role;
GRANT CREATE ON SCHEMA inbound TO service_role;
GRANT CREATE ON SCHEMA billing TO service_role;
GRANT CREATE ON SCHEMA admin TO service_role;
GRANT CREATE ON SCHEMA analytics TO service_role;
GRANT CREATE ON SCHEMA future_features TO service_role;

-- Add comments for documentation
COMMENT ON SCHEMA outbound IS 'Tables for outbound calling features (voice agents, agent calls, agent analytics, etc.)';
COMMENT ON SCHEMA inbound IS 'Tables for inbound calling features (inbound numbers, call history, call recordings, schedules, etc.)';
COMMENT ON SCHEMA billing IS 'Tables for billing and payments (invoices, payments, subscriptions, packages, coupons, etc.)';
COMMENT ON SCHEMA admin IS 'Tables for admin features (admin profiles, activity logs, support tickets, system settings, etc.)';
COMMENT ON SCHEMA analytics IS 'Tables for analytics and reporting (call analytics, spike detection, abuse alerts, etc.)';
COMMENT ON SCHEMA future_features IS 'Tables for features not yet implemented or needed (can be moved to appropriate schema when ready)';
