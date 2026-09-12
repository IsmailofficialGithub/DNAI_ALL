-- Migration: Ensure credit_transactions exists and fix invoices view
-- Description: Creates credit_transactions table/view and ensures invoices view has user_id
-- Date: 2025-01-XX

-- ============================================================================
-- credit_transactions table (billing schema)
-- ============================================================================

-- Create credit_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS billing.credit_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  transaction_type character varying(50) NOT NULL,
  amount numeric(10, 2) NOT NULL,
  balance_before numeric(10, 2) NOT NULL DEFAULT 0,
  balance_after numeric(10, 2) NOT NULL DEFAULT 0,
  description text,
  agent_id uuid,
  call_id uuid,
  purchase_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT credit_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT credit_transactions_transaction_type_check CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'adjustment', 'subscription_credit', 'bonus', 'expired'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON billing.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_transaction_type ON billing.credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON billing.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_agent_id ON billing.credit_transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_call_id ON billing.credit_transactions(call_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_purchase_id ON billing.credit_transactions(purchase_id);

-- Add comments
COMMENT ON TABLE billing.credit_transactions IS 'Tracks all credit transactions (purchases, usage, refunds, etc.)';
COMMENT ON COLUMN billing.credit_transactions.transaction_type IS 'Type of transaction: purchase, usage, refund, adjustment, subscription_credit, bonus, expired';
COMMENT ON COLUMN billing.credit_transactions.amount IS 'Transaction amount (positive for credits added, negative for credits used)';
COMMENT ON COLUMN billing.credit_transactions.balance_before IS 'Credit balance before this transaction';
COMMENT ON COLUMN billing.credit_transactions.balance_after IS 'Credit balance after this transaction';

-- Create or replace public view for credit_transactions
DROP VIEW IF EXISTS public.credit_transactions;
CREATE VIEW public.credit_transactions AS 
SELECT * FROM billing.credit_transactions;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_transactions TO authenticated, anon, service_role;

-- ============================================================================
-- Fix invoices view to ensure it points to billing.invoices with user_id
-- ============================================================================

-- First, ensure billing.invoices table exists with user_id column
DO $$
BEGIN
  -- Check if invoices table exists in billing schema
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'billing' AND table_name = 'invoices'
  ) THEN
    -- Create invoices table in billing schema
    CREATE TABLE billing.invoices (
      id uuid NOT NULL DEFAULT uuid_generate_v4(),
      invoice_number character varying(100) NOT NULL UNIQUE,
      user_id uuid NOT NULL,
      invoice_date date NOT NULL DEFAULT CURRENT_DATE,
      due_date date,
      subtotal numeric(10, 2) NOT NULL DEFAULT 0,
      tax_rate numeric(5, 2) DEFAULT 0,
      tax_amount numeric(10, 2) DEFAULT 0,
      discount_amount numeric(10, 2) DEFAULT 0,
      discount_code character varying(50),
      total_amount numeric(10, 2) NOT NULL DEFAULT 0,
      status character varying(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'canceled', 'refunded')),
      pdf_url text,
      package_id uuid,
      purchase_id uuid,
      subscription_id uuid,
      billing_address jsonb,
      notes text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      CONSTRAINT invoices_pkey PRIMARY KEY (id),
      CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
      CONSTRAINT invoices_package_id_fkey FOREIGN KEY (package_id) REFERENCES billing.packages(id) ON DELETE SET NULL,
      CONSTRAINT invoices_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES inbound.purchases(id) ON DELETE SET NULL,
      CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES inbound.user_subscriptions(id) ON DELETE SET NULL
    );

    -- Create indexes
    CREATE INDEX idx_invoices_user_id ON billing.invoices(user_id);
    CREATE INDEX idx_invoices_invoice_number ON billing.invoices(invoice_number);
    CREATE INDEX idx_invoices_status ON billing.invoices(status);
    CREATE INDEX idx_invoices_created_at ON billing.invoices(created_at DESC);
    CREATE INDEX idx_invoices_package_id ON billing.invoices(package_id);
    CREATE INDEX idx_invoices_purchase_id ON billing.invoices(purchase_id);
    CREATE INDEX idx_invoices_subscription_id ON billing.invoices(subscription_id);

    RAISE NOTICE '✅ Created billing.invoices table';
  ELSE
    -- Table exists, check if user_id column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'billing' AND table_name = 'invoices' AND column_name = 'user_id'
    ) THEN
      -- Add user_id column if it doesn't exist
      ALTER TABLE billing.invoices ADD COLUMN user_id uuid;
      ALTER TABLE billing.invoices ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON billing.invoices(user_id);
      RAISE NOTICE '✅ Added user_id column to billing.invoices table';
    ELSE
      RAISE NOTICE '✅ billing.invoices table already exists with user_id column';
    END IF;
  END IF;
END $$;

-- Move invoices table from public to billing if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'billing' AND table_name = 'invoices'
  ) THEN
    -- Move table from public to billing
    ALTER TABLE public.invoices SET SCHEMA billing;
    RAISE NOTICE '✅ Moved invoices table from public to billing schema';
    
    -- Add user_id if it doesn't exist after move
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'billing' AND table_name = 'invoices' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE billing.invoices ADD COLUMN user_id uuid;
      ALTER TABLE billing.invoices ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON billing.invoices(user_id);
      RAISE NOTICE '✅ Added user_id column to moved invoices table';
    END IF;
  END IF;
END $$;

-- Drop and recreate the public view to ensure it points to billing.invoices
DROP VIEW IF EXISTS public.invoices;
CREATE VIEW public.invoices AS 
SELECT * FROM billing.invoices;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated, anon, service_role;
