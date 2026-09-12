-- Migration: Merge Profiles Table
-- Description: Adds missing columns from genie_inbound_Main profile structure to public.profiles
-- This ensures profiles table has all columns needed by both admin panel and genie_inbound_Main
-- Date: 2025-01-XX

-- ============================================================================
-- ADD MISSING COLUMNS TO public.profiles
-- ============================================================================

-- Add metadata column (JSONB for flexible data storage)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add company_name column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS company_name character varying(255);

-- Add company_website column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS company_website character varying(255);

-- Add company_address column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS company_address text;

-- ============================================================================
-- CREATE VIEW FOR user_profiles (backward compatibility)
-- ============================================================================

-- Create VIEW pointing to profiles table for backward compatibility
-- This allows code that queries user_profiles to still work
CREATE OR REPLACE VIEW public.user_profiles AS 
  SELECT 
    id,
    user_id,
    email,
    full_name,
    avatar_url,
    phone_number,
    company_name,
    company_website,
    company_address,
    metadata,
    created_at,
    updated_at,
    -- Include any other columns that exist in profiles
    *
  FROM public.profiles;

-- Grant permissions on user_profiles VIEW
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated, anon, service_role;

-- ============================================================================
-- VERIFY COLUMNS WERE ADDED
-- ============================================================================

-- Query to verify columns exist (for reference, not executed)
-- SELECT 
--     column_name,
--     data_type,
--     is_nullable,
--     column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND column_name IN ('metadata', 'company_name', 'company_website', 'company_address', 'user_id')
-- ORDER BY column_name;

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.profiles.metadata IS 'Flexible JSONB storage for additional profile data';
COMMENT ON COLUMN public.profiles.company_name IS 'Company name for business profiles';
COMMENT ON COLUMN public.profiles.company_website IS 'Company website URL';
COMMENT ON COLUMN public.profiles.company_address IS 'Company physical address';
COMMENT ON VIEW public.user_profiles IS 'VIEW for backward compatibility - points to public.profiles';
