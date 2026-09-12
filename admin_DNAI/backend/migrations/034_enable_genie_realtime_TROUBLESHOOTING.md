# Troubleshooting Supabase Realtime "mismatch between server and client bindings" Error

## The Error
```
Error: mismatch between server and client bindings for postgres changes
```

## Common Causes

1. **Realtime server hasn't picked up the new tables yet**
   - After adding tables to the publication, Supabase Realtime needs time to sync
   - Wait 30-60 seconds after running the migration
   - Or restart your Supabase project (if self-hosted)

2. **Tables not properly added to publication**
   - Verify with: `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('call_logs', 'genie_scheduled_calls', 'genie_leads');`
   - Should return 3 rows

3. **RLS policies blocking access**
   - Check if Row Level Security is enabled on these tables
   - Ensure authenticated users have SELECT permissions

## Solutions

### Solution 1: Wait and Retry
After running the migration, wait 30-60 seconds, then refresh your browser.

### Solution 2: Verify in Supabase Dashboard
1. Go to Supabase Dashboard > Database > Replication
2. Check if `call_logs`, `genie_scheduled_calls`, and `genie_leads` are listed
3. If not, manually enable them in the dashboard

### Solution 3: Restart Supabase (if self-hosted)
If you're self-hosting Supabase, restart the Realtime service:
```bash
# Docker Compose
docker-compose restart supabase-realtime
```

### Solution 4: Check RLS Policies
Run this to check if RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('call_logs', 'genie_scheduled_calls', 'genie_leads');
```

If `rowsecurity = true`, ensure policies allow SELECT for authenticated users.

### Solution 5: Test Without Filters
Temporarily remove the filter to test if the connection works:
```javascript
// In useGenieWebSocket.js, temporarily change:
filter: `owner_user_id=eq.${user.id}`,
// To:
// filter: undefined,  // or remove the filter line entirely
```

If this works, the issue is with the filter syntax or RLS policies.

## Verification Query
Run this to verify everything is set up correctly:
```sql
-- Check publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('call_logs', 'genie_scheduled_calls', 'genie_leads');

-- Check RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('call_logs', 'genie_scheduled_calls', 'genie_leads');

-- Check policies (if RLS enabled)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('call_logs', 'genie_scheduled_calls', 'genie_leads');
```

