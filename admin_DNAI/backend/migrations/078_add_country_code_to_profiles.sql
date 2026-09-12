-- Migration: Add country_code column to profiles table
-- Description: Adds country_code column for phone number country codes
-- Date: 2025-01-XX

-- ============================================================================
-- profiles table updates (public schema)
-- ============================================================================

-- Add country_code column to public.profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS country_code character varying(10) DEFAULT '+1';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_country_code 
ON public.profiles(country_code) 
WHERE country_code IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN public.profiles.country_code IS 'Country code for phone number (e.g., +1 for US, +44 for UK)';
