-- Migration: Move Billing Tables
-- Description: Moves billing-related tables to billing schema
-- Date: 2025-01-XX
--
-- IMPORTANT: 
-- 1. Test simple tables migration first
-- 2. These tables have foreign keys to profiles and products (which stay in public)
-- 3. Foreign keys across schemas work fine in PostgreSQL

-- ============================================================================
-- BILLING SCHEMA: Payment and Subscription Tables
-- ============================================================================

-- Move packages to billing schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'packages') THEN
    ALTER TABLE public.packages SET SCHEMA billing;
    RAISE NOTICE '✅ Table packages moved to billing schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.packages AS 
  SELECT * FROM billing.packages;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages 
  TO authenticated, anon, service_role;

-- Move invoices to billing schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    ALTER TABLE public.invoices SET SCHEMA billing;
    RAISE NOTICE '✅ Table invoices moved to billing schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.invoices AS 
  SELECT * FROM billing.invoices;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices 
  TO authenticated, anon, service_role;

-- Move invoice_items to billing schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'invoice_items') THEN
    ALTER TABLE public.invoice_items SET SCHEMA billing;
    RAISE NOTICE '✅ Table invoice_items moved to billing schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.invoice_items AS 
  SELECT * FROM billing.invoice_items;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items 
  TO authenticated, anon, service_role;

-- Move invoice_payments to billing schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'invoice_payments') THEN
    ALTER TABLE public.invoice_payments SET SCHEMA billing;
    RAISE NOTICE '✅ Table invoice_payments moved to billing schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.invoice_payments AS 
  SELECT * FROM billing.invoice_payments;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments 
  TO authenticated, anon, service_role;

-- Move offers to billing schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'offers') THEN
    ALTER TABLE public.offers SET SCHEMA billing;
    RAISE NOTICE '✅ Table offers moved to billing schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.offers AS 
  SELECT * FROM billing.offers;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers 
  TO authenticated, anon, service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
  '✅ Migration completed!' as status,
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name IN ('packages', 'invoices', 'invoice_items', 'invoice_payments', 'offers')
ORDER BY table_schema, table_name;
