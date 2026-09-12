-- Migration: Create Missing Profile for Specific User
-- Description: Creates a profile for a user if it doesn't exist
-- Usage: Replace USER_ID_HERE with the actual user UUID
-- Date: 2025-01-XX

-- ============================================================================
-- CREATE PROFILE FOR SPECIFIC USER
-- ============================================================================
-- Replace '620a8a1c-243a-4c6e-96f3-d1b462d12e90' with the actual user_id

DO $$
DECLARE
  v_user_id UUID := '620a8a1c-243a-4c6e-96f3-d1b462d12e90';
  v_user_email TEXT;
  v_profile_exists BOOLEAN;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User with id % does not exist', v_user_id;
  END IF;
  
  -- Check if profile exists
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE user_id = v_user_id
  ) INTO v_profile_exists;
  
  IF NOT v_profile_exists THEN
    -- Create profile
    INSERT INTO public.profiles (
      user_id,
      email,
      created_at,
      updated_at,
      metadata
    ) VALUES (
      v_user_id,
      v_user_email,
      now(),
      now(),
      '{}'::jsonb
    );
    
    RAISE NOTICE 'Profile created for user % (email: %)', v_user_id, v_user_email;
  ELSE
    RAISE NOTICE 'Profile already exists for user %', v_user_id;
  END IF;
END $$;
