-- Optional: Create commission_history table for tracking commission calculations
CREATE TABLE IF NOT EXISTS commission_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  reseller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  commission_percentage DECIMAL(5, 2) NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
  commission_amount DECIMAL(10, 2) NOT NULL CHECK (commission_amount >= 0),
  invoice_amount DECIMAL(10, 2) NOT NULL CHECK (invoice_amount >= 0),
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  
  -- Ensure invoice and reseller relationship is valid
  CONSTRAINT valid_commission CHECK (commission_amount <= invoice_amount)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_commission_history_invoice_id ON commission_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_commission_history_reseller_id ON commission_history(reseller_id);
CREATE INDEX IF NOT EXISTS idx_commission_history_offer_id ON commission_history(offer_id);
CREATE INDEX IF NOT EXISTS idx_commission_history_status ON commission_history(status);
CREATE INDEX IF NOT EXISTS idx_commission_history_calculated_at ON commission_history(calculated_at);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE commission_history ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all commission history
CREATE POLICY "Admins can view all commission history" ON commission_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Resellers can view their own commission history
CREATE POLICY "Resellers can view their own commission history" ON commission_history
  FOR SELECT
  USING (reseller_id = auth.uid());

