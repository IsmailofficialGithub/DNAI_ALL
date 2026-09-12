-- Update invoice status logic:
-- When a payment is submitted, invoice status should change to 'under_review'
-- Invoice becomes 'paid' only when payment is approved by admin

-- Note: This is handled in the backend code, but we can add a trigger as backup
-- The backend should set invoice status to 'under_review' when payment is submitted

-- Create or replace function to update invoice status on payment submission
CREATE OR REPLACE FUNCTION update_invoice_status_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- When a payment is submitted (status = 'pending'), update invoice to 'under_review'
  IF NEW.status = 'pending' THEN
    UPDATE invoices
    SET status = 'under_review',
        updated_at = NOW()
    WHERE id = NEW.invoice_id
      AND status IN ('unpaid', 'pending'); -- Update if unpaid or pending
  END IF;
  
  -- When a payment is approved, update invoice to 'paid'
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE invoices
    SET status = 'paid',
        updated_at = NOW()
    WHERE id = NEW.invoice_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_invoice_status_on_payment ON invoice_payments;
CREATE TRIGGER trigger_update_invoice_status_on_payment
  AFTER INSERT OR UPDATE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status_on_payment();

COMMENT ON FUNCTION update_invoice_status_on_payment() IS 'Automatically updates invoice status to under_review when payment is submitted, and to paid when payment is approved';

