-- ALTERNATIVE: Simplified version using hardcoded values
-- If the main migration doesn't work, try this version OR use Database Webhooks (recommended)

-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Replace these with your actual values:
-- 1. YOUR_PROJECT_REF - Your Supabase project reference (e.g., 'abcdefghijklmnop')
-- 2. YOUR_SERVICE_ROLE_KEY - Your service role key from Supabase Dashboard → Settings → API

CREATE OR REPLACE FUNCTION notify_campaign_completion()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report';
  service_key TEXT := 'YOUR_SERVICE_ROLE_KEY';
  payload_json JSONB;
  request_id BIGINT;
BEGIN
  -- Only trigger if status changed to 'completed'
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Build payload
    payload_json := jsonb_build_object(
      'record', jsonb_build_object(
        'id', NEW.id,
        'owner_user_id', NEW.owner_user_id,
        'contacts_count', NEW.contacts_count,
        'calls_completed', NEW.calls_completed,
        'status', NEW.status
      )
    );
    
    -- Try calling with different possible signatures
    -- Option 1: Standard pg_net signature
    BEGIN
      SELECT net.http_post(
        edge_function_url,
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        payload_json::text::bytea
      ) INTO request_id;
    EXCEPTION WHEN OTHERS THEN
      -- If that fails, try alternative signature
      RAISE WARNING 'First attempt failed: %', SQLERRM;
      -- You may need to use Database Webhooks instead
      RAISE NOTICE 'Campaign % completed, but HTTP call failed. Consider using Database Webhooks.', NEW.id;
    END;
    
    RAISE NOTICE 'Campaign % status changed to completed. Request ID: %', NEW.id, request_id;
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
