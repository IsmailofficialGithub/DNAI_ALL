-- Migration: Create invitations table
-- Description: Stores invitation tokens for users, resellers, and consumers
-- Invited users can sign up using the token

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'reseller', 'consumer')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional metadata for consumer invites
  trial_expiry_date TIMESTAMP WITH TIME ZONE,
  subscribed_products UUID[] DEFAULT '{}',
  
  -- Ensure invitation is not expired when checking
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_invitations_referred_by ON invitations(referred_by);
CREATE INDEX IF NOT EXISTS idx_invitations_used_at ON invitations(used_at);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all invitations
CREATE POLICY "Admins can view all invitations" ON invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Resellers can view invitations they created
CREATE POLICY "Resellers can view their invitations" ON invitations
  FOR SELECT
  USING (
    invited_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Users can view their own invitation (for signup)
CREATE POLICY "Users can view invitation by token" ON invitations
  FOR SELECT
  USING (true); -- Allow public access for signup, but validation happens in backend

