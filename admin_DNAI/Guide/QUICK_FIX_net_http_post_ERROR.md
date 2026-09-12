# Quick Fix: net.http_post Function Error

## The Error You're Seeing

```
ERROR: 42883: function net.http_post(url => text, headers => jsonb, body => text) does not exist
HINT: No function matches the given name and argument types.
```

## Solution: Use Supabase Database Webhooks (Recommended - 5 minutes)

**This is the easiest and most reliable solution.** No SQL needed!

### Step 1: Remove the Trigger (if you created it)

Go to Supabase Dashboard → **SQL Editor** and run:

```sql
DROP TRIGGER IF EXISTS trigger_campaign_completion ON genie_scheduled_calls;
DROP FUNCTION IF EXISTS notify_campaign_completion();
```

### Step 2: Create a Database Webhook

1. Go to **Supabase Dashboard** → **Database** → **Webhooks**
2. Click **Create a new webhook**
3. Fill in:
   - **Name**: `Campaign Completion Webhook`
   - **Table**: `genie_scheduled_calls`
   - **Events**: Check **Update** ✅
   - **Type**: **HTTP Request**
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report`
     - Replace `YOUR_PROJECT_REF` with your actual project reference
   - **HTTP Method**: `POST`
   - **HTTP Headers**:
     - Click **Add Header**
     - Name: `Content-Type`, Value: `application/json`
     - Click **Add Header**
     - Name: `Authorization`, Value: `Bearer YOUR_SERVICE_ROLE_KEY`
       - Replace `YOUR_SERVICE_ROLE_KEY` with your service role key (from Settings → API)
   - **Filter** (click "Add filter"):
     ```sql
     new.status = 'completed' 
     AND (old.status IS NULL OR old.status != 'completed')
     ```
4. Click **Create webhook**

### Step 3: Test It

1. Update a test campaign's status to `'completed'`:
   ```sql
   UPDATE genie_scheduled_calls 
   SET status = 'completed' 
   WHERE id = 'your-test-campaign-id';
   ```

2. Check Edge Function logs:
   - Go to **Edge Functions** → `send-call-logs-report` → **Logs**
   - You should see the request

3. Check webhook status:
   - Go to **Database** → **Webhooks**
   - Click on your webhook to see recent invocations

**Done!** This approach is much simpler and doesn't require any SQL or extensions.

---

## Why This Error Happens

The `pg_net` extension might:
- Not be available in your Supabase instance
- Have a different function signature
- Require special permissions

Database Webhooks are Supabase's official way to handle this - they're built-in, reliable, and don't require any extensions.

---

## Alternative: If You Must Use a Trigger

If you absolutely need to use a database trigger (not recommended), you can try:

1. Check if `pg_net` is available:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

2. Check available functions:
   ```sql
   SELECT proname, pronargs 
   FROM pg_proc 
   WHERE proname LIKE '%http%' 
   AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'net');
   ```

3. Contact Supabase support to enable `pg_net` if it's not available

But honestly, **just use Database Webhooks** - they're designed for this exact use case! 🎯
