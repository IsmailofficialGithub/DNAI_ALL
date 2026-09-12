-- Migration: Verify Realtime setup for Genie tables (RLS is disabled)
-- Description: Since RLS is disabled, we just need to ensure Realtime is properly configured

-- Step 1: Verify tables are in the publication
SELECT 
  schemaname, 
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('call_logs', 'genie_scheduled_calls', 'genie_leads');

-- Step 2: Check if RLS is enabled (should be false for all tables)
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('call_logs', 'genie_scheduled_calls', 'genie_leads');

-- Step 2: Check existing policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('call_logs', 'genie_scheduled_calls', 'genie_leads')
ORDER BY tablename, policyname;

-- Step 3: If RLS is enabled, ensure there are SELECT policies for authenticated users
-- For call_logs
DO $$
BEGIN
  -- Check if RLS is enabled
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'call_logs'
    AND rowsecurity = true
  ) THEN
    -- Create or replace policy for SELECT (needed for Realtime)
    DROP POLICY IF EXISTS "Allow authenticated users to read their own call logs" ON call_logs;
    CREATE POLICY "Allow authenticated users to read their own call logs"
      ON call_logs FOR SELECT
      TO authenticated
      USING (
        owner_user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.user_id = auth.uid() 
          AND 'admin' = ANY(profiles.role)
        )
      );
    
    -- Also allow service role (for backend operations)
    DROP POLICY IF EXISTS "Allow service role to read all call logs" ON call_logs;
    CREATE POLICY "Allow service role to read all call logs"
      ON call_logs FOR SELECT
      TO service_role
      USING (true);
  END IF;
END $$;

-- For genie_scheduled_calls
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'genie_scheduled_calls'
    AND rowsecurity = true
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to read their own campaigns" ON genie_scheduled_calls;
    CREATE POLICY "Allow authenticated users to read their own campaigns"
      ON genie_scheduled_calls FOR SELECT
      TO authenticated
      USING (
        owner_user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.user_id = auth.uid() 
          AND 'admin' = ANY(profiles.role)
        )
      );
    
    DROP POLICY IF EXISTS "Allow service role to read all campaigns" ON genie_scheduled_calls;
    CREATE POLICY "Allow service role to read all campaigns"
      ON genie_scheduled_calls FOR SELECT
      TO service_role
      USING (true);
  END IF;
END $$;

-- For genie_leads
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'genie_leads'
    AND rowsecurity = true
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to read their own leads" ON genie_leads;
    CREATE POLICY "Allow authenticated users to read their own leads"
      ON genie_leads FOR SELECT
      TO authenticated
      USING (
        owner_user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.user_id = auth.uid() 
          AND 'admin' = ANY(profiles.role)
        )
      );
    
    DROP POLICY IF EXISTS "Allow service role to read all leads" ON genie_leads;
    CREATE POLICY "Allow service role to read all leads"
      ON genie_leads FOR SELECT
      TO service_role
      USING (true);
  END IF;
END $$;

-- Step 4: If RLS is NOT enabled, you might want to enable it for security
-- (Uncomment if you want to enable RLS)
/*
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE genie_scheduled_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE genie_leads ENABLE ROW LEVEL SECURITY;
*/

