-- Migration: Enable Realtime for Genie tables
-- Description: Enables Supabase Realtime subscriptions for call_logs, genie_scheduled_calls, and genie_leads tables
-- Run this in Supabase SQL Editor

-- Step 1: Enable Realtime for call_logs table
-- Note: If table already exists in publication, this will error but that's okay
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'call_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;
  END IF;
END $$;

-- Step 2: Enable Realtime for genie_scheduled_calls table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'genie_scheduled_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE genie_scheduled_calls;
  END IF;
END $$;

-- Step 3: Enable Realtime for genie_leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'genie_leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE genie_leads;
  END IF;
END $$;

-- Step 4: Verify Realtime is enabled (optional check)
SELECT 
  schemaname, 
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename IN ('call_logs', 'genie_scheduled_calls', 'genie_leads');

-- Step 5: Ensure RLS policies allow authenticated users to read these tables
-- (Only needed if RLS is enabled on these tables)

-- For call_logs: Users can see their own call logs or if they're admin
-- Note: This assumes RLS is enabled. If not, you may need to adjust policies.
DO $$
BEGIN
  -- Check if RLS is enabled on call_logs
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'call_logs'
    AND rowsecurity = true
  ) THEN
    -- Create policy if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'call_logs' 
      AND policyname = 'Users can view their own call logs or admin can view all'
    ) THEN
      CREATE POLICY "Users can view their own call logs or admin can view all"
        ON call_logs FOR SELECT
        USING (
          owner_user_id = auth.uid() 
          OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND 'admin' = ANY(profiles.role)
          )
        );
    END IF;
  END IF;
END $$;

-- For genie_scheduled_calls: Users can see their own campaigns or if they're admin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'genie_scheduled_calls'
    AND rowsecurity = true
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'genie_scheduled_calls' 
      AND policyname = 'Users can view their own campaigns or admin can view all'
    ) THEN
      CREATE POLICY "Users can view their own campaigns or admin can view all"
        ON genie_scheduled_calls FOR SELECT
        USING (
          owner_user_id = auth.uid() 
          OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND 'admin' = ANY(profiles.role)
          )
        );
    END IF;
  END IF;
END $$;

-- For genie_leads: Users can see their own leads or if they're admin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'genie_leads'
    AND rowsecurity = true
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'genie_leads' 
      AND policyname = 'Users can view their own leads or admin can view all'
    ) THEN
      CREATE POLICY "Users can view their own leads or admin can view all"
        ON genie_leads FOR SELECT
        USING (
          owner_user_id = auth.uid() 
          OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND 'admin' = ANY(profiles.role)
          )
        );
    END IF;
  END IF;
END $$;

