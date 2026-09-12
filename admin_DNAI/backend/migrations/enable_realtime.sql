-- Enable Realtime for customer support tables
-- Run this in Supabase SQL Editor

-- Step 1: Enable Realtime for support_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;

-- Step 2: Enable Realtime for support_tickets table
ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;

-- Step 3: Verify Realtime is enabled (optional check)
SELECT 
  schemaname, 
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename IN ('support_messages', 'support_tickets');

-- Step 4: If RLS is enabled, ensure policies allow authenticated users to read
-- (Only run if you have RLS enabled on these tables)

-- For support_messages: Users can see messages from their tickets or if they're admin
CREATE POLICY IF NOT EXISTS "Users can view messages from their tickets"
  ON support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets 
      WHERE support_tickets.id = support_messages.ticket_id 
      AND (
        support_tickets.user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.user_id = auth.uid() 
          AND profiles.role = 'admin'
        )
      )
    )
  );

-- For support_tickets: Users can see their own tickets or if they're admin
CREATE POLICY IF NOT EXISTS "Users can view their own tickets or admin can view all"
  ON support_tickets FOR SELECT
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

