-- Modify invoices table to add commission offer tracking columns
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS reseller_commission_percentage DECIMAL(5, 2) CHECK (reseller_commission_percentage >= 0 AND reseller_commission_percentage <= 100),
ADD COLUMN IF NOT EXISTS applied_offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS commission_calculated_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_applied_offer_id ON invoices(applied_offer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_reseller_commission_percentage ON invoices(reseller_commission_percentage);
CREATE INDEX IF NOT EXISTS idx_invoices_commission_calculated_at ON invoices(commission_calculated_at);

