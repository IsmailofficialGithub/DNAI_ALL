-- Add paid_by column to invoice_payments table
-- This column tracks who actually paid the invoice (could be different from submitted_by)
-- For example: Consumer submits payment themselves (paid_by = consumer_id)
-- Or: Admin/reseller submits payment on behalf of consumer (paid_by = consumer_id, submitted_by = admin/reseller_id)

ALTER TABLE invoice_payments
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_payments_paid_by ON invoice_payments(paid_by);

-- Add comment for documentation
COMMENT ON COLUMN invoice_payments.paid_by IS 'The user who actually paid the invoice (usually the consumer). This may differ from submitted_by if someone else submits the payment on their behalf.';

