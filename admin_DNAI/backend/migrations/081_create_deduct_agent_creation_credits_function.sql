-- Migration: Create deduct_agent_creation_credits RPC function
-- Description: Creates a function to deduct credits when an agent is created
-- Date: 2025-01-XX

-- Drop the function if it exists to ensure clean creation
DROP FUNCTION IF EXISTS public.deduct_agent_creation_credits(UUID, TEXT, UUID);

-- Create the function to deduct credits for agent creation
CREATE OR REPLACE FUNCTION public.deduct_agent_creation_credits(
    p_agent_id UUID,
    p_agent_name TEXT,
    p_user_id UUID
)
RETURNS DECIMAL(10, 2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credits_to_deduct DECIMAL(10, 2) := 5.0; -- 5 credits per agent
    v_current_balance DECIMAL(10, 2);
    v_new_balance DECIMAL(10, 2);
BEGIN
    -- Get current balance from inbound.user_credits table
    SELECT balance INTO v_current_balance
    FROM inbound.user_credits
    WHERE user_id = p_user_id;
    
    -- If no credits record exists, create one
    IF v_current_balance IS NULL THEN
        INSERT INTO inbound.user_credits (user_id, balance, total_used)
        VALUES (p_user_id, 0, 0)
        ON CONFLICT (user_id) DO NOTHING;
        v_current_balance := 0;
    END IF;
    
    -- Check if user has enough credits
    IF v_current_balance < v_credits_to_deduct THEN
        RAISE EXCEPTION 'Insufficient credits. Creating an agent requires 5 credits. Current balance: %', v_current_balance;
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance - v_credits_to_deduct;
    
    -- Update credits in inbound.user_credits table
    UPDATE inbound.user_credits
    SET 
        balance = v_new_balance,
        total_used = total_used + v_credits_to_deduct,
        services_paused = CASE WHEN v_new_balance <= 0 THEN true ELSE services_paused END,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Record transaction in billing.credit_transactions table
    INSERT INTO billing.credit_transactions (
        user_id,
        transaction_type,
        amount,
        agent_id,
        balance_before,
        balance_after,
        description
    ) VALUES (
        p_user_id,
        'usage',
        -v_credits_to_deduct,
        p_agent_id,
        v_current_balance,
        v_new_balance,
        'Agent creation: ' || COALESCE(p_agent_name, 'Unknown') || ' (5 credits)'
    );
    
    RETURN v_credits_to_deduct;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.deduct_agent_creation_credits(UUID, TEXT, UUID) TO authenticated, anon, service_role;

-- Add comment
COMMENT ON FUNCTION public.deduct_agent_creation_credits IS 'Deducts 5 credits from user account when creating an agent. Returns the amount deducted. Throws exception if insufficient credits.';
