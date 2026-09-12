-- Migration: Add has_unread_messages column to support_tickets table
-- Description: Track if tickets have unread messages for notification purposes
-- Date: 2026-01-13

-- Add has_unread_messages column to support_tickets table
ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS has_unread_messages BOOLEAN DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_has_unread_messages 
ON support_tickets(has_unread_messages) 
WHERE has_unread_messages = true;

-- Add comment
COMMENT ON COLUMN support_tickets.has_unread_messages IS 'True if ticket has unread messages (user messages unread by admin, or admin messages unread by user)';

-- Function to update ticket unread status when message is added
CREATE OR REPLACE FUNCTION update_ticket_unread_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If user sends a message, mark ticket as unread for admins
  -- If admin sends a message, mark ticket as unread for users
  IF NEW.message_type = 'user' THEN
    -- User message - mark as unread for admins
    UPDATE support_tickets
    SET has_unread_messages = true,
        updated_at = NOW()
    WHERE id = NEW.ticket_id;
  ELSIF NEW.message_type = 'admin' THEN
    -- Admin message - mark as unread for users
    UPDATE support_tickets
    SET has_unread_messages = true,
        updated_at = NOW()
    WHERE id = NEW.ticket_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update ticket unread status on new message
DROP TRIGGER IF EXISTS trigger_update_ticket_unread_status ON support_messages;
CREATE TRIGGER trigger_update_ticket_unread_status
AFTER INSERT ON support_messages
FOR EACH ROW
EXECUTE FUNCTION update_ticket_unread_status();
