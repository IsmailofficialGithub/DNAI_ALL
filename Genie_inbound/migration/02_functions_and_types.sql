CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- ============================================================================
-- Section 1: Utility and Trigger Routines
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_invoice_payments_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_invoice_status_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- When a payment is submitted (status = 'pending'), update invoice to 'under_review'
  IF NEW.status = 'pending' THEN
    UPDATE billing.invoices
    SET status = 'under_review',
        updated_at = NOW()
    WHERE id = NEW.invoice_id
      AND status IN ('unpaid', 'pending'); -- Update if unpaid or pending
  END IF;
  
  -- When a payment is approved, update invoice to 'paid'
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE billing.invoices
    SET status = 'paid',
        updated_at = NOW()
    WHERE id = NEW.invoice_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_packages_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ads_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_call_history_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_call_logs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_genie_bots_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_genie_scheduled_calls_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_knowledge_base_document_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_knowledge_base_faq_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_knowledge_base_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_products_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ticket_stats()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE admin.support_tickets
  SET 
    message_count = (
      SELECT COUNT(*) FROM admin.support_messages WHERE ticket_id = NEW.ticket_id
    ),
    last_message_at = NEW.created_at,
    updated_at = NOW(),
    first_response_at = CASE
      WHEN NEW.message_type = 'admin' AND first_response_at IS NULL 
      THEN NEW.created_at
      ELSE first_response_at
    END
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ticket_unread_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- If user sends a message, mark ticket as unread for admins
  -- If admin sends a message, mark ticket as unread for users
  IF NEW.message_type = 'user' THEN
    -- User message - mark as unread for admins
    UPDATE admin.support_tickets
    SET has_unread_messages = true,
        updated_at = NOW()
    WHERE id = NEW.ticket_id;
  ELSIF NEW.message_type = 'admin' THEN
    -- Admin message - mark as unread for users
    UPDATE admin.support_tickets
    SET has_unread_messages = true,
        updated_at = NOW()
    WHERE id = NEW.ticket_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_ads_total_budget()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.daily_budget IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
    NEW.total_budget := NEW.daily_budget * GREATEST(1, EXTRACT(EPOCH FROM (NEW.end_date - NEW.start_date)) / 86400);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    created_at,
    updated_at,
    metadata
  ) VALUES (
    NEW.id,
    now(),
    now(),
    '{}'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_campaign_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
DECLARE
  edge_function_url TEXT := 'https://ztscnilhtnxmzgpozxrz.supabase.co/functions/v1/send-call-logs-report';
  service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0c2NuaWxodG54bXpncG96eHJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzI3MDcwMiwiZXhwIjoyMDgyODQ2NzAyfQ.mg3dYclPUFq7Pt_2SXRstKw8vXCOLk36GU4pO8DQoR0';
  payload_json JSONB;
  response extensions.http_response;
BEGIN
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    payload_json := jsonb_build_object(
      'record', jsonb_build_object(
        'id', NEW.id,
        'owner_user_id', NEW.owner_user_id,
        'contacts_count', NEW.contacts_count,
        'calls_completed', NEW.calls_completed,
        'status', NEW.status
      )
    );
    
    -- Use http extension
    SELECT * INTO response FROM http((
      'POST',
      edge_function_url,
      ARRAY[
        extensions.http_header('Content-Type', 'application/json'),
        extensions.http_header('Authorization', 'Bearer ' || service_key)
      ],
      'application/json',
      payload_json::text
    )::extensions.http_request);
    
    RAISE NOTICE '✅ Response status: %', response.status;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION inbound.sync_email_templates_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync name and template_name
  IF NEW.name IS NOT NULL AND (NEW.template_name IS NULL OR NEW.template_name != NEW.name) THEN
    NEW.template_name := NEW.name;
  END IF;
  IF NEW.template_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name != NEW.template_name) THEN
    NEW.name := NEW.template_name;
  END IF;
  
  -- Sync body with body_html (prefer body_html over body_text)
  IF NEW.body IS NOT NULL AND (NEW.body_html IS NULL OR NEW.body_html != NEW.body) THEN
    NEW.body_html := NEW.body;
  END IF;
  IF NEW.body_html IS NOT NULL AND (NEW.body IS NULL OR NEW.body != NEW.body_html) THEN
    NEW.body := NEW.body_html;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION inbound.sync_user_emails_email()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- If email is set but email_address is not, copy email to email_address
  IF NEW.email IS NOT NULL AND (NEW.email_address IS NULL OR NEW.email_address != NEW.email) THEN
    NEW.email_address := NEW.email;
  END IF;
  -- If email_address is set but email is not, copy email_address to email
  IF NEW.email_address IS NOT NULL AND (NEW.email IS NULL OR NEW.email != NEW.email_address) THEN
    NEW.email := NEW.email_address;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION inbound.update_inbound_agent_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Section 2: Business Logic & RPC Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION inbound.increment_user_credits(
  p_user_id UUID,
  p_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
  -- Insert or update in one go (Upsert)
  INSERT INTO inbound.user_credits (user_id, balance, total_purchased, updated_at)
  VALUES (p_user_id, p_amount, p_amount, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = inbound.user_credits.balance + p_amount,
    total_purchased = inbound.user_credits.total_purchased + p_amount,
    updated_at = NOW();
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.process_package_purchase(
    p_user_id uuid, 
    p_package_id uuid, 
    p_credits_to_add numeric, 
    p_billing_cycle character varying, 
    p_purchase_id uuid DEFAULT NULL::uuid, 
    p_tier_name text DEFAULT 'active'::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_period_end TIMESTAMPTZ;
    v_sub_id UUID;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
    v_period_interval INTERVAL;
BEGIN
    -- 0. Check for Idempotency: Prevent double processing of the same purchase_id
    IF p_purchase_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM inbound.credit_transactions 
        WHERE (metadata->>'purchase_id')::uuid = p_purchase_id
    ) THEN
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'This purchase has already been fulfilled.',
            'purchase_id', p_purchase_id
        );
    END IF;

    -- 1. Calculate base period
    v_period_interval := CASE WHEN p_billing_cycle = 'yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END;

    -- 2. Upsert Subscription (FIXED: Reset to now + interval instead of adding)
    IF p_package_id IS NOT NULL AND p_package_id != '00000000-0000-0000-0000-000000000000'::uuid THEN
        UPDATE inbound.user_subscriptions
        SET 
            package_id = p_package_id,
            status = 'active',
            billing_cycle = p_billing_cycle,
            -- FIXED: Always 30 days/1 year from NOW
            current_period_end = v_now + v_period_interval, 
            current_period_start = v_now,
            updated_at = v_now,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('last_purchase_id', p_purchase_id)
        WHERE id = (
            SELECT id FROM inbound.user_subscriptions 
            WHERE user_id = p_user_id 
            ORDER BY created_at DESC 
            LIMIT 1
        )
        RETURNING id, current_period_end INTO v_sub_id, v_period_end;

        IF NOT FOUND THEN
            v_period_end := v_now + v_period_interval;
            INSERT INTO inbound.user_subscriptions (
                user_id, package_id, status, billing_cycle, 
                current_period_start, current_period_end, metadata
            )
            VALUES (
                p_user_id, p_package_id, 'active', p_billing_cycle, 
                v_now, v_period_end, jsonb_build_object('purchase_id', p_purchase_id)
            )
            RETURNING id INTO v_sub_id;
        END IF;
    END IF;

    -- 3. Update Credits
    INSERT INTO inbound.user_credits (user_id, balance, total_purchased, updated_at)
    VALUES (p_user_id, p_credits_to_add, p_credits_to_add, v_now)
    ON CONFLICT (user_id) DO UPDATE
    SET 
        balance = inbound.user_credits.balance + EXCLUDED.balance,
        total_purchased = inbound.user_credits.total_purchased + EXCLUDED.total_purchased,
        updated_at = v_now,
        services_paused = false
    RETURNING 
        (inbound.user_credits.balance - p_credits_to_add),
        inbound.user_credits.balance
    INTO v_balance_before, v_balance_after;

    -- 4. Record Credit Transaction
    INSERT INTO inbound.credit_transactions (
        user_id, amount, transaction_type, balance_before, balance_after, description, metadata
    )
    VALUES (
        p_user_id, 
        p_credits_to_add, 
        'purchase', 
        v_balance_before,
        v_balance_after,
        'Package Upgrade: ' || p_tier_name,
        jsonb_build_object('purchase_id', p_purchase_id, 'package_id', p_package_id)
    );

    -- 5. Sync Profile Tier
    UPDATE public.profiles
    SET subscription_tier = p_tier_name
    WHERE user_id = p_user_id;

    -- 6. Set Trial Expiry (FIXED: Always exactly 30 days from now)
    UPDATE public.profiles
    SET 
        trial_expiry = v_now + INTERVAL '30 days'
    WHERE user_id = p_user_id;

    -- FINAL RETURN
    RETURN jsonb_build_object(
        'success', true,
        'subscription_id', v_sub_id,
        'credits_added', p_credits_to_add
    );

END;
$$;

CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id UUID,
    p_amount NUMERIC,
    p_transaction_type CHARACTER VARYING,
    p_purchase_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- Get current balance
    SELECT balance INTO v_current_balance FROM inbound.user_credits WHERE user_id = p_user_id FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        INSERT INTO inbound.user_credits (user_id, balance) VALUES (p_user_id, 0);
        v_current_balance := 0;
    END IF;

    v_new_balance := v_current_balance + p_amount;

    -- Update balance
    UPDATE inbound.user_credits 
    SET 
        balance = v_new_balance,
        total_purchased = total_purchased + CASE WHEN p_transaction_type = 'purchase' THEN p_amount ELSE 0 END,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Create transaction record
    INSERT INTO inbound.credit_transactions (
        user_id,
        transaction_type,
        amount,
        purchase_id,
        balance_before,
        balance_after,
        description,
        created_at
    ) VALUES (
        p_user_id,
        p_transaction_type,
        p_amount,
        p_purchase_id,
        v_current_balance,
        v_new_balance,
        'Credits added: ' || p_transaction_type,
        NOW()
    );

    RETURN v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_call_credits(
    p_user_id UUID,
    p_call_id UUID,
    p_agent_id UUID,
    p_duration_seconds NUMERIC,
    p_credits_per_minute NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credits_to_deduct NUMERIC;
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
    v_agent_name TEXT;
BEGIN
    -- Calculate credits (ceil to nearest second or minute? Usually rounded to 1 decimal)
    v_credits_to_deduct := (p_duration_seconds / 60.0) * p_credits_per_minute;
    
    -- Round to 2 decimal places
    v_credits_to_deduct := ROUND(v_credits_to_deduct, 2);

    -- If 0 duration or error, return 0
    IF v_credits_to_deduct <= 0 THEN
        RETURN 0;
    END IF;

    -- Check if already deducted for this call
    IF EXISTS (SELECT 1 FROM inbound.credit_transactions WHERE call_id = p_call_id AND transaction_type = 'usage') THEN
        RETURN 0;
    END IF;

    -- Get current balance
    SELECT balance INTO v_current_balance FROM inbound.user_credits WHERE user_id = p_user_id FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        -- Create record if not exists
        INSERT INTO inbound.user_credits (user_id, balance) VALUES (p_user_id, 0);
        v_current_balance := 0;
    END IF;

    v_new_balance := v_current_balance - v_credits_to_deduct;

    -- Update balance
    UPDATE inbound.user_credits 
    SET 
        balance = v_new_balance,
        total_used = total_used + v_credits_to_deduct,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Get agent name for description
    SELECT name INTO v_agent_name FROM inbound.voice_agents WHERE id = p_agent_id;

    -- Create transaction record
    INSERT INTO inbound.credit_transactions (
        user_id,
        transaction_type,
        amount,
        agent_id,
        call_id,
        call_duration_seconds,
        credits_per_minute,
        balance_before,
        balance_after,
        description,
        created_at
    ) VALUES (
        p_user_id,
        'usage',
        v_credits_to_deduct,
        p_agent_id,
        p_call_id,
        p_duration_seconds::INTEGER,
        p_credits_per_minute,
        v_current_balance,
        v_new_balance,
        'Call usage: ' || COALESCE(v_agent_name, 'Voice Agent') || ' (' || ROUND(p_duration_seconds/60.0, 1) || ' min)',
        NOW()
    );

    -- Create notification
    PERFORM public.create_notification(
        p_user_id,
        'call_credits_deducted',
        'Call Credits Deducted',
        v_credits_to_deduct || ' credits deducted for a ' || ROUND(p_duration_seconds/60.0, 1) || '-minute call with "' || COALESCE(v_agent_name, 'Agent') || '".',
        jsonb_build_object(
            'credits_deducted', v_credits_to_deduct,
            'call_duration', p_duration_seconds,
            'agent_name', v_agent_name,
            'remaining_balance', v_new_balance
        )
    );

    -- Check for low credits
    IF v_new_balance < 10 AND v_current_balance >= 10 THEN
        PERFORM public.create_notification(
            p_user_id,
            'low_credits',
            'Low Credit Balance',
            'Your credit balance is low (' || ROUND(v_new_balance, 2) || ' credits). Please purchase more credits to continue using services.',
            jsonb_build_object('current_balance', v_new_balance, 'threshold', 10)
        );
    END IF;

    RETURN v_credits_to_deduct;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_agent_creation_credits(
    p_user_id UUID,
    p_agent_id UUID,
    p_agent_name TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credits_to_deduct NUMERIC := 5.0; -- Default agent creation cost
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- Get current balance
    SELECT balance INTO v_current_balance FROM inbound.user_credits WHERE user_id = p_user_id FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        INSERT INTO inbound.user_credits (user_id, balance) VALUES (p_user_id, 0);
        v_current_balance := 0;
    END IF;

    IF v_current_balance < v_credits_to_deduct THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    v_new_balance := v_current_balance - v_credits_to_deduct;

    -- Update balance
    UPDATE inbound.user_credits 
    SET 
        balance = v_new_balance,
        total_used = total_used + v_credits_to_deduct,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Create transaction record
    INSERT INTO inbound.credit_transactions (
        user_id,
        transaction_type,
        amount,
        agent_id,
        balance_before,
        balance_after,
        description,
        created_at
    ) VALUES (
        p_user_id,
        'usage',
        v_credits_to_deduct,
        p_agent_id,
        v_current_balance,
        v_new_balance,
        'Agent creation: ' || p_agent_name,
        NOW()
    );

    RETURN v_credits_to_deduct;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_signup_availability(p_email TEXT, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user record;
    v_email_exists BOOLEAN := false;
    v_email_confirmed BOOLEAN := false;
    v_phone_exists BOOLEAN := false;
BEGIN
    -- 1. Check email status in auth.users
    SELECT id, email_confirmed_at INTO v_user 
    FROM auth.users 
    WHERE email = p_email;

    IF v_user.id IS NOT NULL THEN
        v_email_exists := true;
        v_email_confirmed := (v_user.email_confirmed_at IS NOT NULL);
    END IF;

    -- 2. Check email in auth_role_with_profiles (extra safety)
    IF NOT v_email_exists THEN
        SELECT EXISTS (SELECT 1 FROM public.auth_role_with_profiles WHERE email = p_email) INTO v_email_exists;
    END IF;
 
    -- 3. Check phone in auth.users or auth_role_with_profiles
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE phone = p_phone
        UNION
        SELECT 1 FROM public.auth_role_with_profiles WHERE phone = p_phone
    ) INTO v_phone_exists;

    -- Handle Logic
    IF v_email_exists THEN
        IF v_email_confirmed THEN
            RETURN jsonb_build_object('status', 'VERIFIED', 'message', 'Email already registered');
        ELSE
            RETURN jsonb_build_object(
                'status', 'UNVERIFIED', 
                'user_id', v_user.id,
                'message', 'Email exists but not verified'
            );
        END IF;
    END IF;

    IF v_phone_exists THEN
        return jsonb_build_object('status', 'PHONE_TAKEN', 'message', 'Phone number already in use');
    END IF;

    RETURN jsonb_build_object('status', 'AVAILABLE', 'message', 'Ready for signup');
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_access(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user record;
    v_profile record;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- 1. Get user and confirmation status
    SELECT id, email_confirmed_at INTO v_user 
    FROM auth.users 
    WHERE email = p_email;

    IF v_user.id IS NULL THEN
        RETURN jsonb_build_object('status', 'NOT_FOUND');
    END IF;

    IF v_user.email_confirmed_at IS NULL THEN
        RETURN jsonb_build_object('status', 'UNVERIFIED');
    END IF;

    -- 2. Get profile status and trial
    SELECT account_status, trial_expiry, lifetime_access INTO v_profile 
    FROM public.profiles 
    WHERE user_id = v_user.id;

    IF v_profile.account_status IS NOT NULL AND v_profile.account_status != 'active' THEN
        RETURN jsonb_build_object('status', 'DEACTIVATED', 'reason', v_profile.account_status);
    END IF;

    IF v_profile.lifetime_access = false AND v_profile.trial_expiry < v_now THEN
        -- Check if they have an active paid subscription as fallback
        -- (This depends on your subscription table structure)
        -- For now, let's assume if trial is expired and no lifetime, it's expired
        RETURN jsonb_build_object('status', 'TRIAL_EXPIRED', 'expiry', v_profile.trial_expiry);
    END IF;

    RETURN jsonb_build_object('status', 'ALLOWED');
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = p_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type CHARACTER VARYING,
    p_title CHARACTER VARYING,
    p_message TEXT,
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
        user_id, notification_type, title, message, metadata
    ) VALUES (
        p_user_id, p_type, p_title, p_message, p_metadata
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_phone_number_existence(target_phone_number text)
 RETURNS TABLE(is_in_use boolean, owner_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        EXISTS (SELECT 1 FROM inbound.inbound_numbers WHERE phone_number = target_phone_number),
        (SELECT user_id FROM inbound.inbound_numbers WHERE phone_number = target_phone_number LIMIT 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_expired_trials()
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET account_status = 'expired_subscription'
  WHERE trial_expiry < NOW()
    AND account_status != 'expired_subscription';
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_user_profile(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Check if profile exists
  SELECT user_id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- If profile doesn't exist, create it
  IF v_profile_id IS NULL THEN
    INSERT INTO public.profiles (
      user_id,
      email,
      created_at,
      updated_at,
      metadata
    ) VALUES (
      p_user_id,
      v_user_email,
      now(),
      now(),
      '{}'::jsonb
    )
    RETURNING user_id INTO v_profile_id;
  END IF;
  
  RETURN v_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $$
DECLARE
  ticket_num VARCHAR(50);
  date_part VARCHAR(8);
  random_part VARCHAR(5);
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  random_part := LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
  ticket_num := 'TICKET-' || date_part || '-' || random_part;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM admin.support_tickets WHERE ticket_number = ticket_num) LOOP
    random_part := LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
    ticket_num := 'TICKET-' || date_part || '-' || random_part;
  END LOOP;
  
  RETURN ticket_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_all_tables(schema_name text)
 RETURNS TABLE(table_schema text, table_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $$
  SELECT 
    t.table_schema::TEXT,
    t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = schema_name
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE '_%'
  ORDER BY t.table_name;
$$;

CREATE OR REPLACE FUNCTION public.get_all_tables(schema_names text[] DEFAULT ARRAY['public'::text, 'outbound'::text, 'inbound'::text, 'billing'::text, 'admin'::text, 'analytics'::text, 'content'::text])
 RETURNS TABLE(table_schema text, table_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $$
  SELECT 
    t.table_schema::TEXT,
    t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = ANY(schema_names)
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'  -- Exclude PostgreSQL system tables
    AND t.table_name NOT LIKE '_%'     -- Exclude Supabase internal tables
  ORDER BY 
    CASE t.table_schema
      WHEN 'public' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'outbound' THEN 3
      WHEN 'inbound' THEN 4
      WHEN 'billing' THEN 5
      WHEN 'content' THEN 6
      WHEN 'analytics' THEN 7
      ELSE 8
    END,
    t.table_name;
$$;

CREATE OR REPLACE FUNCTION public.get_call_statistics(p_user_id uuid DEFAULT NULL::uuid, p_agent_id uuid DEFAULT NULL::uuid, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(total_calls bigint, answered_calls bigint, missed_calls bigint, forwarded_calls bigint, total_duration integer, average_duration numeric, total_cost numeric)
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
    deleted_at IS NULL
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    AND (p_start_date IS NULL OR call_start_time >= p_start_date)
    AND (p_end_date IS NULL OR call_start_time <= p_end_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(start_of_month_param timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'totalUsers', (SELECT COUNT(*) FROM public.profiles WHERE 'admin' = ANY(role) OR 'user' = ANY(role) OR 'viewer' = ANY(role)),
    'totalConsumers', (SELECT COUNT(*) FROM public.profiles WHERE 'consumer' = ANY(role)),
    'activeConsumers', (SELECT COUNT(*) FROM public.profiles WHERE 'consumer' = ANY(role) AND account_status = 'active'),
    'expiredConsumers', (SELECT COUNT(*) FROM public.profiles WHERE 'consumer' = ANY(role) AND account_status = 'expired_subscription'),
    'totalResellers', (SELECT COUNT(*) FROM public.profiles WHERE 'reseller' = ANY(role)),
    'newUsersThisMonth', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= start_of_month_param),
    'activeSubscriptions', (SELECT COUNT(DISTINCT user_id) FROM public.user_product_access),
    'totalProducts', (SELECT COUNT(*) FROM public.products),
    'totalInvoices', (SELECT COUNT(*) FROM billing.invoices),
    'paidInvoices', (SELECT COUNT(*) FROM billing.invoices WHERE status = 'paid'),
    'unpaidInvoices', (SELECT COUNT(*) FROM billing.invoices WHERE status = 'unpaid'),
    'totalRevenue', (SELECT COALESCE(SUM(total_amount), 0) FROM billing.invoices WHERE status = 'paid'),
    'revenueThisMonth', (SELECT COALESCE(SUM(total_amount), 0) FROM billing.invoices WHERE status = 'paid' AND created_at >= start_of_month_param)
  ) INTO result;
  
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_reseller_stats(start_date timestamp with time zone, end_date timestamp with time zone, invoice_status text, result_limit integer)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
AS $$
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
    FROM public.auth_role_with_profiles p
    LEFT JOIN billing.invoices i ON i.sender_id = p.user_id
      AND i.created_at >= start_date
      AND i.created_at <= end_date
      AND (invoice_status = 'all' OR i.status = invoice_status)
    WHERE 'reseller' = ANY(p.role::TEXT[])  -- Use ANY() for array check with explicit cast
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
$$;

CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
 RETURNS TABLE(permission_name text, granted boolean)
 LANGUAGE plpgsql
 STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH user_perms AS (
    -- Check if systemadmin
    SELECT 
      CASE WHEN p.is_systemadmin THEN true ELSE false END as is_sysadmin
    FROM public.profiles p
    WHERE p.user_id = p_user_id
  ),
  role_perms AS (
    -- Get permissions for all roles in the user's role array
    -- role_permissions.role is TEXT, profiles.role is TEXT[]
    -- Use ANY() to check if role string is in the role array
    -- COALESCE handles NULL roles gracefully
    SELECT DISTINCT p.name as perm_name
    FROM public.profiles prof
    JOIN public.role_permissions rp ON rp.role = ANY(COALESCE(prof.role, ARRAY[]::TEXT[]))
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE prof.user_id = p_user_id
      AND prof.role IS NOT NULL
      AND array_length(prof.role, 1) > 0
  ),
  user_specific_perms AS (
    -- Get user-specific permission overrides
    SELECT 
      p.name as perm_name,
      up.granted
    FROM public.user_permissions up
    JOIN public.permissions p ON up.permission_id = p.id
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
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $$
DECLARE
  v_is_systemadmin BOOLEAN;
  v_user_role TEXT;
  v_permission_granted BOOLEAN;
BEGIN
  -- Check if user is systemadmin
  SELECT is_systemadmin INTO v_is_systemadmin
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- Systemadmin has all permissions
  IF v_is_systemadmin = true THEN
    RETURN true;
  END IF;
  
  -- Get user role (Note: profiles.role is an array. For legacy logic we look at the first one)
  SELECT role[1] INTO v_user_role
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check user-specific permission override first
  SELECT granted INTO v_permission_granted
  FROM public.user_permissions up
  JOIN public.permissions p ON up.permission_id = p.id
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
    FROM public.role_permissions rp
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE rp.role = v_user_role
      AND p.name = p_permission_name
  ) INTO v_permission_granted;
  
  RETURN COALESCE(v_permission_granted, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 'admin' = ANY(role)
  FROM public.profiles
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_reseller()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 'reseller' = ANY(role)
  FROM public.profiles
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_support()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 'support' = ANY(role)
  FROM public.profiles
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_systemadmin(user_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = user_uuid 
    AND is_systemadmin = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_login_activity(p_user_id uuid, p_session_id text DEFAULT NULL::text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_login_method text DEFAULT 'email'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_activity_id UUID;
  v_device_type TEXT;
  v_browser_name TEXT;
  v_os_name TEXT;
BEGIN
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
  
  INSERT INTO inbound.login_activity (
    user_id, session_id, ip_address, device_type, browser_name, os_name,
    login_method, user_agent, is_active, login_at
  ) VALUES (
    p_user_id, p_session_id, p_ip_address, v_device_type, v_browser_name, v_os_name,
    p_login_method, p_user_agent, true, now()
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_dnai_documents(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
 LANGUAGE sql
 STABLE
AS $$
  select
    dnai_vector_store.id,
    dnai_vector_store.content,
    dnai_vector_store.metadata,
    1 - (dnai_vector_store.embedding <=> query_embedding) as similarity
  from public.dnai_vector_store
  where 1 - (dnai_vector_store.embedding <=> query_embedding) > match_threshold
  order by dnai_vector_store.embedding <=> query_embedding
  limit match_count;
$$;
