-- Migration: Diagnose and Fix Profiles Table Issues
-- Description: Checks profiles table structure and creates missing profiles
-- Date: 2025-01-XX

-- ============================================================================
-- STEP 1: Check if profiles table exists and has user_id column
-- ============================================================================

-- Check if user_id column exists
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'user_id';

-- ============================================================================
-- STEP 2: Check RLS policies on profiles table
-- ============================================================================

-- List all RLS policies on profiles
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles';

-- ============================================================================
-- STEP 3: Create a function to auto-create profiles for users
-- ============================================================================

-- Function to ensure profile exists for a user
CREATE OR REPLACE FUNCTION public.ensure_user_profile(p_user_id UUID)
RETURNS UUID
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
  SELECT id INTO v_profile_id
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
    RETURNING id INTO v_profile_id;
  END IF;
  
  RETURN v_profile_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.ensure_user_profile(UUID) TO authenticated, anon, service_role;

-- ============================================================================
-- STEP 4: Create trigger to auto-create profile on user signup
-- ============================================================================

-- Trigger function to create profile when user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (
    user_id,
    email,
    created_at,
    updated_at,
    metadata
  ) VALUES (
    NEW.id,
    NEW.email,
    now(),
    now(),
    '{}'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger (only if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 5: Check and fix RLS policies
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they're too restrictive
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create permissive RLS policies
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow service_role to bypass RLS (for backend operations)
-- Note: service_role already bypasses RLS by default in Supabase

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if a specific user has a profile
-- Replace the UUID with the actual user_id
-- SELECT * FROM public.profiles WHERE user_id = '620a8a1c-243a-4c6e-96f3-d1b462d12e90';

-- Count total profiles
-- SELECT COUNT(*) FROM public.profiles;

-- List all profiles with user emails
-- SELECT p.id, p.user_id, p.email, p.created_at 
-- FROM public.profiles p
-- ORDER BY p.created_at DESC
-- LIMIT 10;
