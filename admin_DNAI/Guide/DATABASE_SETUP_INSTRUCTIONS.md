# Database Setup Instructions - Status-Based Trigger

This guide explains what you need to do in your Supabase database to set up the status-based trigger for campaign completion.

## What You Need to Do in the Database

### Step 1: Check if pg_net Extension is Enabled

The trigger uses `pg_net` to make HTTP calls to the edge function. Check if it's enabled:

```sql
-- Check if pg_net is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

If it returns no rows, enable it:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

**Note**: In Supabase, `pg_net` should already be available, but you may need to enable it.

### Step 2: Run the Migration

You have two options:

#### Option A: Run the Migration File (Recommended)

1. Go to Supabase Dashboard → **SQL Editor**
2. Open the file: `backend/migrations/020_add_campaign_completion_trigger.sql`
3. **IMPORTANT**: Replace these placeholders before running:
   - `YOUR_PROJECT_REF` → Your actual Supabase project reference
   - Set the `app.edge_function_url` setting (see Step 3)
   - Set the `app.supabase_service_key` setting (see Step 3)
4. Copy and paste the entire SQL into the SQL Editor
5. Click **Run**

#### Option B: Use Supabase Dashboard Webhooks (Easier - No SQL)

Instead of using a database trigger, you can use Supabase's built-in webhooks:

1. Go to Supabase Dashboard → **Database** → **Webhooks**
2. Click **Create a new webhook**
3. Configure:
   - **Name**: `Campaign Completion Webhook`
   - **Table**: `genie_scheduled_calls`
   - **Events**: Select **Update**
   - **Type**: **HTTP Request**
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report`
   - **HTTP Method**: `POST`
   - **HTTP Headers**:
     - `Content-Type`: `application/json`
     - `Authorization`: `Bearer YOUR_SERVICE_ROLE_KEY`
   - **Filter**:
     ```sql
     new.status = 'completed' 
     AND (old.status IS NULL OR old.status != 'completed')
     ```
4. Click **Create webhook**

**This is the recommended approach** - it's simpler and doesn't require SQL.

### Step 3: Set Database Settings (If Using Trigger)

If you're using the database trigger (Option A), you need to set these database settings:

```sql
-- Set edge function URL
ALTER DATABASE postgres SET app.edge_function_url = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report';

-- Set service role key (get this from Settings → API → Service Role Key)
ALTER DATABASE postgres SET app.supabase_service_key = 'YOUR_SERVICE_ROLE_KEY';
```

**OR** you can hardcode them in the trigger function (less secure but simpler):

Edit the migration file and replace:
```sql
edge_function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report';
service_key := 'YOUR_SERVICE_ROLE_KEY';
```

### Step 4: Verify the Trigger/Webhook

#### If Using Database Trigger:

```sql
-- Check if trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_campaign_completion';

-- Check if function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'notify_campaign_completion';
```

#### If Using Webhook:

1. Go to Database → Webhooks
2. Verify `Campaign Completion Webhook` is listed and active

### Step 5: Test the Setup

1. Find a test campaign in `genie_scheduled_calls` table
2. Update its status to `'completed'`:
   ```sql
   UPDATE genie_scheduled_calls 
   SET status = 'completed' 
   WHERE id = 'your-test-campaign-id';
   ```
3. Check Edge Function logs in Supabase Dashboard
4. Check if email was sent to the campaign owner

---

## Common Problems and Solutions

### Problem 1: "Extension pg_net does not exist"

**Error**: `ERROR: extension "pg_net" does not exist`

**Solution**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

If this doesn't work, you may need to:
- Use Supabase Dashboard Webhooks instead (Option B above)
- Contact Supabase support to enable the extension

### Problem 2: "Function net.http_post does not exist" or "No function matches the given name and argument types"

**Error**: 
```
ERROR: 42883: function net.http_post(url => text, headers => jsonb, body => text) does not exist
HINT: No function matches the given name and argument types.
```

**Cause**: The `pg_net` extension might not be available, or the function signature is different in your Supabase instance.

**Solution**: 
1. **RECOMMENDED**: Use Supabase Database Webhooks instead (see Option B in Step 2). This avoids all SQL/extension issues.

2. **Alternative**: Try enabling pg_net:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```
   Then check available functions:
   ```sql
   SELECT proname, pronargs, proargtypes 
   FROM pg_proc 
   WHERE proname LIKE '%http%' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'net');
   ```

3. **If still failing**: Definitely use Database Webhooks - they're designed for this exact use case and don't require any extensions.

### Problem 3: Trigger Not Firing

**Symptoms**: Status changes to `'completed'` but edge function is not called

**Checklist**:
1. ✅ Verify trigger exists:
   ```sql
   SELECT * FROM information_schema.triggers 
   WHERE trigger_name = 'trigger_campaign_completion';
   ```

2. ✅ Check if status is actually changing:
   ```sql
   -- Check recent updates
   SELECT id, status, updated_at 
   FROM genie_scheduled_calls 
   ORDER BY updated_at DESC 
   LIMIT 10;
   ```

3. ✅ Verify the WHEN condition is correct:
   - Status must change FROM something else TO `'completed'`
   - If status is already `'completed'`, updating other fields won't trigger it

4. ✅ Check database logs for errors:
   - Go to Supabase Dashboard → Logs → Postgres Logs
   - Look for errors related to `notify_campaign_completion`

5. ✅ Test manually:
   ```sql
   -- Test the function directly
   SELECT notify_campaign_completion();
   ```

### Problem 4: Edge Function Not Receiving Requests

**Symptoms**: Trigger fires but edge function logs show no requests

**Checklist**:
1. ✅ Verify edge function URL is correct:
   ```sql
   SHOW app.edge_function_url;
   ```

2. ✅ Verify service role key is set:
   ```sql
   SHOW app.supabase_service_key;
   ```

3. ✅ Check if HTTP call is being made:
   - Check Postgres logs for `RAISE NOTICE` messages
   - Look for network errors

4. ✅ Test edge function directly:
   - Use the test in the deployment guide
   - Verify it works when called manually

### Problem 5: "Permission denied for setting app.edge_function_url"

**Error**: `ERROR: permission denied to set parameter "app.edge_function_url"`

**Solution**: You need superuser privileges. Options:
1. Use Supabase Dashboard Webhooks instead (no SQL needed)
2. Hardcode the values in the trigger function
3. Contact Supabase support

### Problem 6: Trigger Fires Multiple Times

**Symptoms**: Edge function is called multiple times for the same campaign

**Cause**: Multiple triggers or webhooks configured

**Solution**:
1. Check for duplicate triggers:
   ```sql
   SELECT * FROM information_schema.triggers 
   WHERE event_object_table = 'genie_scheduled_calls';
   ```

2. Check for duplicate webhooks in Dashboard → Database → Webhooks

3. Remove duplicates

### Problem 7: Status Update Doesn't Trigger (Already Completed)

**Symptoms**: You update a campaign but trigger doesn't fire

**Cause**: The trigger only fires when status changes TO `'completed'`, not when it's already `'completed'`

**Solution**: This is expected behavior. The trigger only fires on the transition:
- `NULL` → `'completed'` ✅
- `'scheduled'` → `'completed'` ✅
- `'running'` → `'completed'` ✅
- `'completed'` → `'completed'` ❌ (no change, won't trigger)

### Problem 8: Webhook Filter Not Working

**Symptoms**: Webhook fires for all updates, not just status changes

**Solution**: 
1. Check the filter syntax in the webhook configuration
2. Make sure it's:
   ```sql
   new.status = 'completed' 
   AND (old.status IS NULL OR old.status != 'completed')
   ```
3. Test with a campaign that's not completed first

---

## Recommended Approach

**For most users, we recommend using Supabase Dashboard Webhooks** (Option B in Step 2):

✅ **Advantages**:
- No SQL knowledge required
- Easy to configure via UI
- No extension issues
- Easier to debug
- Can be enabled/disabled easily

❌ **Disadvantages**:
- Requires manual setup in dashboard
- Can't be version controlled in migrations

**For developers who want version control**, use the database trigger (Option A), but be aware of the potential issues above.

---

## Quick Reference

### Check Current Setup
```sql
-- Check triggers
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'genie_scheduled_calls';

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%campaign%';

-- Check extensions
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

### Remove Existing Trigger (if needed)
```sql
DROP TRIGGER IF EXISTS trigger_campaign_completion ON genie_scheduled_calls;
DROP FUNCTION IF EXISTS notify_campaign_completion();
```

### Test Status Change
```sql
-- Update a test campaign
UPDATE genie_scheduled_calls 
SET status = 'completed' 
WHERE id = 'your-campaign-id' 
  AND (status IS NULL OR status != 'completed');
```

---

## Need Help?

If you encounter issues:
1. Check Supabase Dashboard → Logs → Postgres Logs
2. Check Edge Function logs
3. Verify all settings are correct
4. Test with a small campaign first
5. Use Supabase Dashboard Webhooks if trigger approach is problematic
