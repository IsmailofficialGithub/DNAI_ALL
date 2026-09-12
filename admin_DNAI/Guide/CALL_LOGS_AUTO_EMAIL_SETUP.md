# Call Logs Auto-Email Setup Guide

This guide explains how to set up automatic email notifications with call logs Excel reports when a dialer list (campaign) is completed.

> **📘 For detailed Supabase Edge Function deployment instructions, see: [SUPABASE_EDGE_FUNCTION_DEPLOYMENT.md](./SUPABASE_EDGE_FUNCTION_DEPLOYMENT.md)**  
> **⚡ For quick deployment steps, see: [QUICK_DEPLOY_SUPABASE_FUNCTION.md](./QUICK_DEPLOY_SUPABASE_FUNCTION.md)**

## Overview

When a campaign's `calls_completed` equals `contacts_count`, the system will:
1. Automatically generate an Excel file with all call logs
2. Send it via email to the agent (campaign owner)

## Architecture

1. **Database Trigger**: Detects when a campaign is completed
2. **Supabase Edge Function**: Receives the trigger and calls the API
3. **API Endpoint**: Generates Excel file and sends email

## Setup Steps

### 1. Install Dependencies

The Excel library (`xlsx`) is already installed. If not:

```bash
cd backend
npm install xlsx
```

### 2. Configure Environment Variables

Add these to your `.env` file:

```env
# API URL for the backend (used by edge function)
API_URL=http://localhost:5000  # or your production URL

# API Key and Secret for edge function to call your API
# Create these via the API Keys management in admin panel
API_KEY=your-api-key-here
API_SECRET=your-api-secret-here
```

### 3. Create API Key

**Important**: This endpoint requires API key authentication. You must create an API key before using it.

1. Go to Admin Panel → API Keys
2. Create a new API key with name "Call Logs Auto-Email"
3. **IMPORTANT**: Copy both the API Key and Secret immediately - the secret is only shown once!
4. Add them to your `.env` file as `API_KEY` and `API_SECRET`
5. Store these securely - they will be used by the Supabase Edge Function

**Security Notes**:
- API secrets are hashed using SHA-256 with salt before storage
- Only active API keys can be used
- API key usage is logged (last_used_at is updated on each use)
- If you lose the secret, you'll need to create a new API key

### 4. Deploy Supabase Edge Function

#### Option A: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy send-call-logs-report
```

#### Option B: Using Supabase Dashboard

1. Go to Supabase Dashboard → Edge Functions
2. Create a new function named `send-call-logs-report`
3. Copy the code from `supabase/functions/send-call-logs-report/index.ts`
4. Set environment variables:
   - `API_URL`: Your backend API URL
   - `API_KEY`: Your API key
   - `API_SECRET`: Your API secret

### 5. Set Up Database Trigger

Run the migration:

```bash
# Using Supabase SQL Editor or migration tool
psql -h YOUR_DB_HOST -U postgres -d postgres -f backend/migrations/020_add_campaign_completion_trigger.sql
```

Or manually in Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from `backend/migrations/020_add_campaign_completion_trigger.sql`
3. Make sure to:
   - Replace `YOUR_PROJECT_REF` with your actual Supabase project reference
   - Enable `pg_net` extension if not already enabled: `CREATE EXTENSION IF NOT EXISTS pg_net;`

### 6. Configure Edge Function URL

In your Supabase database, set the edge function URL:

```sql
-- Set the edge function URL (replace with your actual URL)
ALTER DATABASE postgres SET app.edge_function_url = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report';

-- Set the service key (optional, if using Authorization header)
-- ALTER DATABASE postgres SET app.supabase_service_key = 'your-service-role-key';
```

### 7. Alternative: Using Supabase Database Webhooks

If `pg_net` is not available, you can use Supabase Database Webhooks:

1. Go to Supabase Dashboard → Database → Webhooks
2. Create a new webhook:
   - **Name**: Campaign Completion Webhook
   - **Table**: `genie_scheduled_calls`
   - **Events**: Update
   - **Type**: HTTP Request
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report`
   - **HTTP Method**: POST
   - **HTTP Headers**: 
     - `Content-Type: application/json`
     - `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
3. Add filter condition:
   ```sql
   (new.calls_completed >= new.contacts_count AND new.contacts_count > 0)
   AND (old.calls_completed < old.contacts_count OR old.calls_completed IS NULL)
   ```

## Testing

### Manual Test

You can manually trigger the endpoint (requires API key and secret):

```bash
curl -X POST http://localhost:5000/api/genie/calls/export-and-email \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "X-API-Secret: YOUR_API_SECRET" \
  -d '{
    "campaign_id": "YOUR_CAMPAIGN_ID"
  }'
```

**Note**: Without valid API key and secret headers, you'll receive a 401 Unauthorized error:
```json
{
  "success": false,
  "error": {
    "code": "MISSING_CREDENTIALS",
    "message": "API key and secret are required. Provide X-API-Key and X-API-Secret headers."
  }
}
```

### Test Campaign Completion

1. Create a test campaign with a small contact list
2. Wait for all calls to complete
3. Check the agent's email for the Excel report

## Troubleshooting

### Edge Function Not Triggering

1. Check Supabase Edge Function logs in the dashboard
2. Verify the trigger is created: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_campaign_completion';`
3. Check if `pg_net` extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_net';`

### API Call Failing

1. Check API logs in your backend
2. Verify API key and secret are correct
3. Check that the API endpoint is accessible from Supabase

### Email Not Sending

1. Check SendGrid logs
2. Verify `SENDGRID_API_KEY` is set in backend `.env`
3. Check email service logs in backend console

## API Endpoint Details

**Endpoint**: `POST /api/genie/calls/export-and-email`

**Authentication**: 
- **Required**: API Key + Secret (X-API-Key and X-API-Secret headers)
- This endpoint is protected and requires API key authentication only
- API keys must be created via the Admin Panel → API Keys
- The API secret is hashed using SHA-256 with salt for security

**Request Body**:
```json
{
  "campaign_id": "uuid",           // Optional: Campaign ID
  "scheduled_list_id": "uuid",     // Optional: Scheduled list ID
  "owner_user_id": "uuid"          // Optional: Owner user ID
}
```

**Response**:
```json
{
  "success": true,
  "message": "Call logs exported and email sent successfully",
  "data": {
    "email_sent_to": "agent@example.com",
    "call_count": 150,
    "campaign_name": "My Campaign"
  }
}
```

## Notes

- The Excel file includes: name, phone, call status, duration, timestamps, lead status, transcript, bot name, and agent info
- The email is sent to the campaign owner's email address
- The trigger only fires once when a campaign transitions to completed status
- Large campaigns may take a few moments to generate the Excel file
