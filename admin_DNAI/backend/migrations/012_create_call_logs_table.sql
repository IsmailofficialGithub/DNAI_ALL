-- Migration: Create call_logs table
-- Description: Stores call log information including customer details and agent assignment
-- Tracks phone calls made to customers

CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer information
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  call_url VARCHAR(500) NOT NULL, -- URL of the call recording or call link
  
  -- Agent assignment
  agent VARCHAR(255), -- Agent who made/received the call
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional metadata (optional)
  call_type VARCHAR(50), -- 'incoming', 'outgoing' (optional)
  call_status VARCHAR(50), -- 'completed', 'missed', 'voicemail', etc. (optional)
  
  -- Indexes for better query performance
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_call_logs_phone ON call_logs(phone);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent ON call_logs(agent);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_updated_at ON call_logs(updated_at DESC);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on row update
CREATE TRIGGER trigger_update_call_logs_updated_at
  BEFORE UPDATE ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_call_logs_updated_at();

-- Add RLS (Row Level Security) policies - Public access
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow everyone (public) to read call logs
CREATE POLICY "Public can view call logs"
  ON call_logs
  FOR SELECT
  USING (true);

-- Policy: Allow everyone (public) to insert call logs
CREATE POLICY "Public can insert call logs"
  ON call_logs
  FOR INSERT
  WITH CHECK (true);



-- Add comment to table
COMMENT ON TABLE call_logs IS 'Stores call log information including customer details and agent assignments';
COMMENT ON COLUMN call_logs.name IS 'Customer name';
COMMENT ON COLUMN call_logs.phone IS 'Customer phone number (required)';
COMMENT ON COLUMN call_logs.call_url IS 'URL of the call recording or call link';
COMMENT ON COLUMN call_logs.agent IS 'Agent (user) who made/received the call';
COMMENT ON COLUMN call_logs.call_type IS 'Type of call: incoming or outgoing';
COMMENT ON COLUMN call_logs.call_status IS 'Status of call: completed, missed, voicemail, etc.';

