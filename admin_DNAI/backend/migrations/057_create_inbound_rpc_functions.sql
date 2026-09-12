-- Migration: Create RPC Functions for genie_inbound_Main
-- Description: Creates all RPC functions used by genie_inbound_Main application
-- Date: 2025-01-XX

-- ============================================================================
-- USER MANAGEMENT RPC FUNCTIONS
-- ============================================================================

-- Check if user exists by email
CREATE OR REPLACE FUNCTION public.check_user_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = p_email
  );
END;
$$;

-- ============================================================================
-- LOGIN ACTIVITY RPC FUNCTIONS
-- ============================================================================

-- Log login activity
CREATE OR REPLACE FUNCTION public.log_login_activity(
  p_user_id UUID,
  p_session_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_login_method TEXT DEFAULT 'email'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activity_id UUID;
  v_device_type TEXT;
  v_browser_name TEXT;
  v_os_name TEXT;
BEGIN
  -- Extract device info from user agent (simplified)
  v_device_type := CASE 
    WHEN p_user_agent ILIKE '%mobile%' OR p_user_agent ILIKE '%android%' OR p_user_agent ILIKE '%iphone%' THEN 'mobile'
    WHEN p_user_agent ILIKE '%tablet%' OR p_user_agent ILIKE '%ipad%' THEN 'tablet'
    ELSE 'desktop'
  END;
  
  v_browser_name := CASE
    WHEN p_user_agent ILIKE '%chrome%' THEN 'Chrome'
    WHEN p_user_agent ILIKE '%firefox%' THEN 'Firefox'
    WHEN p_user_agent ILIKE '%safari%' THEN 'Safari'
    WHEN p_user_agent ILIKE '%edge%' THEN 'Edge'
    ELSE 'Unknown'
  END;
  
  v_os_name := CASE
    WHEN p_user_agent ILIKE '%windows%' THEN 'Windows'
    WHEN p_user_agent ILIKE '%mac%' OR p_user_agent ILIKE '%os x%' THEN 'macOS'
    WHEN p_user_agent ILIKE '%linux%' THEN 'Linux'
    WHEN p_user_agent ILIKE '%android%' THEN 'Android'
    WHEN p_user_agent ILIKE '%iphone%' OR p_user_agent ILIKE '%ipad%' THEN 'iOS'
    ELSE 'Unknown'
  END;
  
  -- Insert login activity
  INSERT INTO inbound.login_activity (
    user_id,
    session_id,
    ip_address,
    device_type,
    browser_name,
    os_name,
    login_method,
    user_agent,
    is_active,
    login_at
  ) VALUES (
    p_user_id,
    p_session_id,
    p_ip_address,
    v_device_type,
    v_browser_name,
    v_os_name,
    p_login_method,
    p_user_agent,
    true,
    now()
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$;

-- ============================================================================
-- NOTIFICATION RPC FUNCTIONS
-- ============================================================================

-- Create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_notification_type TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO inbound.notifications (
    user_id,
    title,
    message,
    notification_type,
    action_url,
    metadata,
    is_read,
    created_at
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_notification_type,
    p_action_url,
    p_metadata,
    false,
    now()
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- ============================================================================
-- CREDIT MANAGEMENT RPC FUNCTIONS
-- ============================================================================

-- Add credits to user account
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT DEFAULT 'manual',
  p_purchase_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  -- Get or create user credits record
  INSERT INTO inbound.user_credits (user_id, balance, total_purchased)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    balance = inbound.user_credits.balance + p_amount,
    total_purchased = inbound.user_credits.total_purchased + p_amount,
    updated_at = now()
  RETURNING balance INTO v_new_balance;
  
  -- If no conflict, get the balance
  IF v_new_balance IS NULL THEN
    SELECT balance INTO v_current_balance FROM inbound.user_credits WHERE user_id = p_user_id;
    v_new_balance := v_current_balance;
  END IF;
  
  -- Update services_paused if balance is above threshold
  UPDATE inbound.user_credits
  SET services_paused = false
  WHERE user_id = p_user_id AND balance >= low_credit_threshold;
  
  RETURN v_new_balance;
END;
$$;

-- Deduct credits for call usage
CREATE OR REPLACE FUNCTION public.deduct_call_credits(
  p_user_id UUID,
  p_call_id UUID,
  p_agent_id UUID,
  p_duration_seconds INTEGER,
  p_credits_per_minute NUMERIC DEFAULT 3.0
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits_to_deduct NUMERIC;
  v_new_balance NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  -- Calculate credits to deduct (3 credits per minute)
  v_credits_to_deduct := (p_duration_seconds / 60.0) * p_credits_per_minute;
  
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM inbound.user_credits
  WHERE user_id = p_user_id;
  
  -- If no record exists, create one with 0 balance
  IF v_current_balance IS NULL THEN
    INSERT INTO inbound.user_credits (user_id, balance, total_used)
    VALUES (p_user_id, 0, 0);
    v_current_balance := 0;
  END IF;
  
  -- Check if user has enough credits
  IF v_current_balance < v_credits_to_deduct THEN
    -- Pause services if balance is below threshold
    UPDATE inbound.user_credits
    SET services_paused = true
    WHERE user_id = p_user_id;
    
    RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', v_credits_to_deduct, v_current_balance;
  END IF;
  
  -- Deduct credits
  UPDATE inbound.user_credits
  SET 
    balance = balance - v_credits_to_deduct,
    total_used = total_used + v_credits_to_deduct,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;
  
  RETURN v_credits_to_deduct;
END;
$$;

-- Deduct credits for agent creation
CREATE OR REPLACE FUNCTION public.deduct_agent_creation_credits(
  p_user_id UUID,
  p_agent_id UUID,
  p_agent_name TEXT,
  p_credits_per_agent NUMERIC DEFAULT 5.0
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits_to_deduct NUMERIC;
  v_new_balance NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  v_credits_to_deduct := p_credits_per_agent;
  
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM inbound.user_credits
  WHERE user_id = p_user_id;
  
  -- If no record exists, create one with 0 balance
  IF v_current_balance IS NULL THEN
    INSERT INTO inbound.user_credits (user_id, balance, total_used)
    VALUES (p_user_id, 0, 0);
    v_current_balance := 0;
  END IF;
  
  -- Check if user has enough credits
  IF v_current_balance < v_credits_to_deduct THEN
    RAISE EXCEPTION 'Insufficient credits for agent creation. Required: %, Available: %', v_credits_to_deduct, v_current_balance;
  END IF;
  
  -- Deduct credits
  UPDATE inbound.user_credits
  SET 
    balance = balance - v_credits_to_deduct,
    total_used = total_used + v_credits_to_deduct,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;
  
  RETURN v_credits_to_deduct;
END;
$$;

-- ============================================================================
-- SECURITY RPC FUNCTIONS
-- ============================================================================

-- Log security event
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_description TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'medium',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO inbound.security_events (
    user_id,
    event_type,
    event_description,
    ip_address,
    user_agent,
    severity,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    p_event_type,
    p_event_description,
    p_ip_address,
    p_user_agent,
    p_severity,
    p_metadata,
    now()
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- ============================================================================
-- ANALYTICS RPC FUNCTIONS
-- ============================================================================

-- Get call statistics
CREATE OR REPLACE FUNCTION public.get_call_statistics(
  p_user_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  total_calls BIGINT,
  answered_calls BIGINT,
  missed_calls BIGINT,
  forwarded_calls BIGINT,
  total_duration INTEGER,
  average_duration NUMERIC,
  total_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_calls,
    COUNT(*) FILTER (WHERE call_status = 'answered')::BIGINT as answered_calls,
    COUNT(*) FILTER (WHERE call_status = 'missed')::BIGINT as missed_calls,
    COUNT(*) FILTER (WHERE call_status = 'forwarded')::BIGINT as forwarded_calls,
    COALESCE(SUM(call_duration), 0)::INTEGER as total_duration,
    COALESCE(AVG(call_duration), 0)::NUMERIC as average_duration,
    COALESCE(SUM(call_cost), 0)::NUMERIC as total_cost
  FROM inbound.call_history
  WHERE 
    (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    AND (p_start_date IS NULL OR call_start_time >= p_start_date)
    AND (p_end_date IS NULL OR call_start_time <= p_end_date);
END;
$$;

-- ============================================================================
-- BILLING RPC FUNCTIONS
-- ============================================================================

-- Generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_number TEXT;
  v_year TEXT;
  v_month TEXT;
  v_sequence INTEGER;
BEGIN
  -- Get current year and month
  v_year := TO_CHAR(now(), 'YYYY');
  v_month := TO_CHAR(now(), 'MM');
  
  -- Get next sequence number for this month
  -- Note: This assumes invoices table exists in billing schema
  -- If not, we'll use a simple timestamp-based approach
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM billing.invoices
  WHERE invoice_number LIKE 'INV-' || v_year || v_month || '%'
  LIMIT 1;
  
  -- If no invoices found, start at 1
  IF v_sequence IS NULL THEN
    v_sequence := 1;
  END IF;
  
  -- Format: INV-YYYYMM-001
  v_invoice_number := 'INV-' || v_year || v_month || '-' || LPAD(v_sequence::TEXT, 3, '0');
  
  RETURN v_invoice_number;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to timestamp-based invoice number if billing.invoices doesn't exist
    RETURN 'INV-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
END;
$$;

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.check_user_exists(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_login_activity(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(UUID, NUMERIC, TEXT, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.deduct_call_credits(UUID, UUID, UUID, INTEGER, NUMERIC) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.deduct_agent_creation_credits(UUID, UUID, TEXT, NUMERIC) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_security_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_call_statistics(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated, anon, service_role;

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.check_user_exists IS 'Checks if a user exists by email address';
COMMENT ON FUNCTION public.log_login_activity IS 'Logs user login activity with device and IP information';
COMMENT ON FUNCTION public.create_notification IS 'Creates a notification for a user';
COMMENT ON FUNCTION public.add_credits IS 'Adds credits to user account';
COMMENT ON FUNCTION public.deduct_call_credits IS 'Deducts credits for call usage';
COMMENT ON FUNCTION public.deduct_agent_creation_credits IS 'Deducts credits for agent creation';
COMMENT ON FUNCTION public.log_security_event IS 'Logs security-related events';
COMMENT ON FUNCTION public.get_call_statistics IS 'Returns call statistics for a user or agent';
COMMENT ON FUNCTION public.generate_invoice_number IS 'Generates a unique invoice number';
