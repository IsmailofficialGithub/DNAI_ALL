# Supabase Edge Function Deployment Guide

This guide walks you through deploying the `send-call-logs-report` Supabase Edge Function step by step.

## Prerequisites

1. ✅ Your API endpoint is working (`/api/genie/calls/export-and-email`)
2. ✅ You have created an API key and secret (from Admin Panel → API Keys)
3. ✅ You have access to your Supabase project

## Step 1: Get Your Supabase Project Details

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Note down:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Project Reference** (the part before `.supabase.co`, e.g., `xxxxx`)
   - **Service Role Key** (click "Reveal" to see it - keep this secret!)

## Step 2: Choose Deployment Method

You have two options:

### Option A: Using Supabase CLI (Recommended)

#### 2.1 Install Supabase CLI

**Windows (PowerShell):**
```powershell
# Using Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# OR using npm
npm install -g supabase
```

**Mac/Linux:**
```bash
# Using Homebrew
brew install supabase/tap/supabase

# OR using npm
npm install -g supabase
```

#### 2.2 Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate. After login, return to the terminal.

#### 2.3 Link to Your Project

```bash
# Replace YOUR_PROJECT_REF with your actual project reference
supabase link --project-ref YOUR_PROJECT_REF
```

You'll be prompted to enter your database password. This is the password you set when creating the Supabase project.

#### 2.4 Deploy the Function

From your project root directory:

```bash
supabase functions deploy send-call-logs-report
```

#### 2.5 Set Environment Variables

After deployment, set the environment variables:

```bash
# Set API URL (your backend URL)
supabase secrets set API_URL=https://your-backend-url.com

# Set API Key (from Admin Panel → API Keys)
supabase secrets set API_KEY=your-api-key-here

# Set API Secret (from Admin Panel → API Keys)
supabase secrets set API_SECRET=your-api-secret-here
```

**Note**: These secrets are encrypted and stored securely. They're available to your edge function via `Deno.env.get()`.

#### 2.6 Verify Deployment

Check that your function is deployed:

```bash
supabase functions list
```

You should see `send-call-logs-report` in the list.

---

### Option B: Using Supabase Dashboard (No CLI Required)

#### 2.1 Create the Function

1. Go to Supabase Dashboard → **Edge Functions**
2. Click **Create a new function**
3. Name it: `send-call-logs-report`
4. Click **Create function**

#### 2.2 Add the Code

1. In the code editor, delete the default code
2. Copy the entire contents of `supabase/functions/send-call-logs-report/index.ts`
3. Paste it into the editor
4. Click **Deploy**

#### 2.3 Set Environment Variables

1. In the Edge Function page, go to **Settings** tab
2. Scroll to **Environment Variables**
3. Add these secrets:

   | Name | Value |
   |------|-------|
   | `API_URL` | Your backend API URL (e.g., `https://api.yourdomain.com` or `http://localhost:5000` for dev) |
   | `API_KEY` | Your API key (from Admin Panel → API Keys) |
   | `API_SECRET` | Your API secret (from Admin Panel → API Keys) |

4. Click **Save**

**Important**: 
- For production, use your production API URL
- For local testing, you can use `http://localhost:5000` but you'll need to expose it (see Step 4)

#### 2.4 Get Function URL

After deployment, note the function URL:
- It will be: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report`
- You'll need this for the database trigger/webhook

---

## Step 3: Test the Edge Function

### 3.1 Test via Supabase Dashboard

1. Go to Edge Functions → `send-call-logs-report`
2. Click **Invoke** tab
3. Use this test payload:

```json
{
  "record": {
    "id": "your-campaign-id-here",
    "owner_user_id": "user-id-here",
    "contacts_count": 10,
    "calls_completed": 10,
    "status": "completed"
  }
}
```

4. Click **Invoke function**
5. Check the logs for success/error messages

### 3.2 Test via cURL

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "record": {
      "id": "your-campaign-id-here",
      "owner_user_id": "user-id-here",
      "contacts_count": 10,
      "calls_completed": 10,
      "status": "completed"
    }
  }'
```

Replace:
- `YOUR_PROJECT_REF` with your project reference
- `YOUR_SERVICE_ROLE_KEY` with your service role key
- `your-campaign-id-here` with an actual campaign ID
- `user-id-here` with an actual user ID

---

## Step 4: Set Up Database Trigger/Webhook

Now you need to trigger the edge function when a campaign's status changes to `completed`. You have two options:

### Option A: Database Webhook (Easiest - Recommended)

1. Go to Supabase Dashboard → **Database** → **Webhooks**
2. Click **Create a new webhook**
3. Configure:
   - **Name**: `Campaign Completion Webhook`
   - **Table**: `genie_scheduled_calls`
   - **Events**: Select **Update**
   - **Type**: **HTTP Request**
   - **HTTP Request**:
     - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report`
     - **HTTP Method**: `POST`
     - **HTTP Headers**:
       - `Content-Type`: `application/json`
       - `Authorization`: `Bearer YOUR_SERVICE_ROLE_KEY`
4. **Filter** (required - triggers only when status changes to 'completed'):
   ```sql
   new.status = 'completed' 
   AND (old.status IS NULL OR old.status != 'completed')
   ```
5. Click **Create webhook**

### Option B: Database Trigger with pg_net

If you prefer using a database trigger:

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this SQL (replace `YOUR_PROJECT_REF`):

```sql
-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to call edge function
CREATE OR REPLACE FUNCTION notify_campaign_completion()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report';
  service_key TEXT := 'YOUR_SERVICE_ROLE_KEY';
  payload JSONB;
BEGIN
  -- Only trigger if status changed to 'completed'
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Build payload
    payload := jsonb_build_object(
      'record', jsonb_build_object(
        'id', NEW.id,
        'owner_user_id', NEW.owner_user_id,
        'contacts_count', NEW.contacts_count,
        'calls_completed', NEW.calls_completed,
        'status', NEW.status
      )
    );
    
    -- Call the edge function
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := payload::text
    );
    
    RAISE NOTICE 'Campaign % status changed to completed. Triggered call logs report.', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_campaign_completion ON genie_scheduled_calls;
CREATE TRIGGER trigger_campaign_completion
  BEFORE UPDATE ON genie_scheduled_calls
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed' 
    AND (OLD.status IS NULL OR OLD.status != 'completed')
  )
  EXECUTE FUNCTION notify_campaign_completion();
```

**Important**: Replace:
- `YOUR_PROJECT_REF` with your actual project reference
- `YOUR_SERVICE_ROLE_KEY` with your service role key

**Known Issues with Database Triggers:**
- `pg_net.http_post` may not send Authorization headers correctly
- You may get 401 Unauthorized errors
- Data may be sent in query string instead of POST body
- If you encounter these issues, **use Database Webhooks (Option A) instead**

See `Guide/DATABASE_SETUP_INSTRUCTIONS.md` and `Guide/QUICK_FIX_net_http_post_ERROR.md` for troubleshooting.

---

## Step 5: Test End-to-End

1. Create a test campaign with a small contact list (e.g., 2-3 contacts)
2. Update the campaign's `status` field to `'completed'` in the `genie_scheduled_calls` table
3. The edge function should trigger automatically when the status changes to `'completed'`
4. Check the campaign owner's email for the Excel report
5. Check Edge Function logs in Supabase Dashboard for any errors

**Note**: The trigger will only fire when the status changes FROM something else TO `'completed'`. If you update other fields but keep the status as `'completed'`, it won't trigger again.

---

## Troubleshooting

### Edge Function Not Triggering

1. **Check Webhook/Trigger Status**:
   - Go to Database → Webhooks (or check triggers in SQL Editor)
   - Verify it's active and configured correctly

2. **Check Edge Function Logs**:
   - Go to Edge Functions → `send-call-logs-report` → **Logs**
   - Look for error messages

3. **Verify Environment Variables**:
   - Check that `API_URL`, `API_KEY`, and `API_SECRET` are set correctly
   - For CLI: `supabase secrets list`
   - For Dashboard: Check Settings → Environment Variables

### API Call Failing

1. **Check API Endpoint**:
   - Verify `API_URL` is correct and accessible
   - For local development, use a tool like [ngrok](https://ngrok.com) to expose localhost

2. **Check API Key**:
   - Verify the API key and secret are correct
   - Check that the API key is active in Admin Panel → API Keys

3. **Check API Logs**:
   - Look at your backend server logs for incoming requests
   - Check for authentication errors

### Local Development Setup

If testing locally, you need to expose your local API:

1. **Using ngrok**:
   ```bash
   ngrok http 5000
   ```
   Use the ngrok URL as `API_URL` in edge function secrets

2. **Update Edge Function Secret**:
   ```bash
   supabase secrets set API_URL=https://your-ngrok-url.ngrok.io
   ```

---

## Security Best Practices

1. ✅ **Never commit secrets to git** - Use environment variables
2. ✅ **Use Service Role Key carefully** - It has full database access
3. ✅ **Rotate API keys regularly** - Especially if compromised
4. ✅ **Monitor function logs** - Check for suspicious activity
5. ✅ **Use HTTPS** - Always use HTTPS URLs in production

---

## Next Steps

Once everything is set up:

1. ✅ Test with a small campaign
2. ✅ Monitor the first few automated emails
3. ✅ Check Edge Function logs for any issues
4. ✅ Verify Excel files are being generated correctly
5. ✅ Confirm emails are being delivered

Your automated call logs email system is now ready! 🎉
