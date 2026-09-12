-- Migration: Create customer support tables
-- Description: Stores customer support tickets, messages, and attachments
-- Allows users to submit support requests and admins to respond

-- Main support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ticket identification
  ticket_number VARCHAR(50) UNIQUE NOT NULL, -- Format: TICKET-YYYYMMDD-XXXXX
  subject VARCHAR(500) NOT NULL,
  
  -- User information
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  user_role VARCHAR(50), -- consumer, reseller, user, etc.
  
  -- Ticket details
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'pending')),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category VARCHAR(100), -- e.g., 'technical', 'billing', 'feature_request', 'bug_report'
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin/Support staff assigned
  assigned_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  tags TEXT[], -- Array of tags for filtering
  internal_notes TEXT, -- Admin-only notes
  
  -- Statistics
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  first_response_at TIMESTAMP WITH TIME ZONE -- Time to first admin response
);

-- Support messages table (conversation thread)
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ticket reference
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  
  -- Message details
  message TEXT NOT NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (message_type IN ('user', 'admin', 'system')),
  
  -- Sender information
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_email VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255),
  sender_role VARCHAR(50),
  
  -- Message metadata
  is_internal BOOLEAN DEFAULT false, -- Internal admin notes (not visible to user)
  is_read BOOLEAN DEFAULT false, -- For user messages, track if admin read it
  read_at TIMESTAMP WITH TIME ZONE,
  read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Message status
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE
);

-- Support attachments table
CREATE TABLE IF NOT EXISTS support_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES support_messages(id) ON DELETE CASCADE,
  
  -- File information
  file_name VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL, -- Storage path
  file_url TEXT, -- Full URL for direct access
  file_size BIGINT NOT NULL, -- Size in bytes
  file_type VARCHAR(100), -- MIME type
  file_extension VARCHAR(20),
  
  -- Upload information
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Security
  is_public BOOLEAN DEFAULT false, -- Whether file is publicly accessible
  access_token VARCHAR(255), -- Optional token for secure access
  
  -- Metadata
  description TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_id ON support_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_is_read ON support_messages(is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket_id ON support_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_attachments_message_id ON support_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_support_attachments_uploaded_by ON support_attachments(uploaded_by);

-- Function to generate unique ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  ticket_num VARCHAR(50);
  date_part VARCHAR(8);
  random_part VARCHAR(5);
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  random_part := LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
  ticket_num := 'TICKET-' || date_part || '-' || random_part;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM support_tickets WHERE ticket_number = ticket_num) LOOP
    random_part := LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
    ticket_num := 'TICKET-' || date_part || '-' || random_part;
  END LOOP;
  
  RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update ticket statistics when message is added
CREATE OR REPLACE FUNCTION update_ticket_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets
  SET 
    message_count = (
      SELECT COUNT(*) FROM support_messages WHERE ticket_id = NEW.ticket_id
    ),
    last_message_at = NEW.created_at,
    updated_at = NOW(),
    first_response_at = CASE
      WHEN NEW.message_type = 'admin' AND first_response_at IS NULL 
      THEN NEW.created_at
      ELSE first_response_at
    END
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update ticket stats on new message
CREATE TRIGGER trigger_update_ticket_stats
AFTER INSERT ON support_messages
FOR EACH ROW
EXECUTE FUNCTION update_ticket_stats();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_support_messages_updated_at
BEFORE UPDATE ON support_messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE support_tickets IS 'Main table for customer support tickets';
COMMENT ON TABLE support_messages IS 'Messages/threads within support tickets';
COMMENT ON TABLE support_attachments IS 'File attachments for tickets and messages';

COMMENT ON COLUMN support_tickets.ticket_number IS 'Unique ticket identifier (TICKET-YYYYMMDD-XXXXX)';
COMMENT ON COLUMN support_tickets.status IS 'Ticket status: open, in_progress, resolved, closed, pending';
COMMENT ON COLUMN support_tickets.priority IS 'Ticket priority: low, medium, high, urgent';
COMMENT ON COLUMN support_messages.is_internal IS 'If true, message is only visible to admins';
COMMENT ON COLUMN support_attachments.file_path IS 'Storage path or URL to the file';

