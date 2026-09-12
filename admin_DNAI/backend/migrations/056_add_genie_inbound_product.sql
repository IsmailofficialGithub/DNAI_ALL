-- Migration: Add genie_inbound Product
-- Description: Adds genie_inbound product to admin.products table
-- Date: 2025-01-XX

-- ============================================================================
-- ADD genie_inbound PRODUCT
-- ============================================================================

-- Insert genie_inbound product if it doesn't exist
-- Note: products table is in public schema (not admin schema)
INSERT INTO public.products (id, name, description, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'genie_inbound',
  'Inbound calling SaaS product with AI voice agents',
  now(),
  now()
)
ON CONFLICT (name) DO UPDATE
SET 
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- VERIFY PRODUCT WAS ADDED
-- ============================================================================

-- Query to verify product exists (for reference, not executed)
-- SELECT id, name, description 
-- FROM public.products 
-- WHERE name = 'genie_inbound';

-- ============================================================================
-- ADD COMMENT
-- ============================================================================

COMMENT ON TABLE public.products IS 'Products table - genie_inbound added for inbound calling SaaS';
