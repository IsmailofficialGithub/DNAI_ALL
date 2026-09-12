-- Create invoice_payments table to store payment details for invoices
-- This table stores payment information submitted by users

CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Payment basic information
  payment_mode VARCHAR(50) NOT NULL CHECK (payment_mode IN (
    'cash', 
    'bank_transfer', 
    'stripe', 
    'paypal', 
    'online_payment', 
    'credit_card', 
    'debit_card', 
    'cheque', 
    'other'
  )),
  payment_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  
  -- Bank Transfer fields
  bank_name VARCHAR(255),
  account_number VARCHAR(100),
  transaction_reference VARCHAR(255),
  utr_number VARCHAR(255),
  
  -- Online Payment fields (Stripe, PayPal, etc.)
  transaction_id VARCHAR(255),
  payment_gateway VARCHAR(100),
  
  -- Card fields
  card_last_four VARCHAR(4),
  cardholder_name VARCHAR(255),
  
  -- Cheque fields
  cheque_number VARCHAR(100),
  cheque_bank_name VARCHAR(255),
  
  -- Payment proof file (stored in Supabase Storage)
  proof_file_url TEXT,
  proof_file_name VARCHAR(255),
  
  -- Metadata
  submitted_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_payment_mode ON invoice_payments(payment_mode);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_payment_date ON invoice_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_status ON invoice_payments(status);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_submitted_by ON invoice_payments(submitted_by);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_transaction_id ON invoice_payments(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_payments_created_at ON invoice_payments(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoice_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_invoice_payments_updated_at
  BEFORE UPDATE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payments_updated_at();

-- Add comments for documentation
COMMENT ON TABLE invoice_payments IS 'Stores payment details submitted by users for invoices';
COMMENT ON COLUMN invoice_payments.payment_mode IS 'Payment method used (cash, bank_transfer, stripe, paypal, etc.)';
COMMENT ON COLUMN invoice_payments.proof_file_url IS 'URL to the payment proof file stored in Supabase Storage';
COMMENT ON COLUMN invoice_payments.status IS 'Payment status: pending (awaiting review), approved (verified), rejected (declined)';

