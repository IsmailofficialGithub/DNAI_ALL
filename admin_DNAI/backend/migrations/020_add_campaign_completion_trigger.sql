-- Migration: Add trigger to detect campaign completion and call Supabase Edge Function
-- This trigger fires when a campaign's status changes to 'completed'
--
-- ⚠️  IMPORTANT: If you get errors with net.http_post, we STRONGLY recommend using
--    Supabase Database Webhooks instead (see Guide/DATABASE_SETUP_INSTRUCTIONS.md).
--    Webhooks are easier, more reliable, and don't require SQL knowledge.
--
-- If you must use a trigger, try this version. If it still fails, use webhooks.

-- Enable pg_net extension if not already enabled (required for HTTP calls)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the Supabase Edge Function via HTTP
CREATE OR REPLACE FUNCTION notify_campaign_completion()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  service_key TEXT;
  payload TEXT;
  request_id BIGINT;
BEGIN
  -- Only trigger if status changed to 'completed'
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get edge function URL (replace with your actual project reference)
    edge_function_url := COALESCE(
      current_setting('app.edge_function_url', TRUE),
      'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report'
    );
    
    -- Get service role key (replace with your actual service role key)
    service_key := COALESCE(
      current_setting('app.supabase_service_key', TRUE),
      'YOUR_SERVICE_ROLE_KEY'
    );
    
    -- Build payload as JSON string
    payload := json_build_object(
      'record', json_build_object(
        'id', NEW.id,
        'owner_user_id', NEW.owner_user_id,
        'contacts_count', NEW.contacts_count,
        'calls_completed', NEW.calls_completed,
        'status', NEW.status
      )
    )::text;
    
    -- Call edge function using pg_net
    -- If this fails, the trigger will still work but won't call the edge function
    -- In that case, use Database Webhooks instead (see Guide/DATABASE_SETUP_INSTRUCTIONS.md)
    BEGIN
      PERFORM net.http_post(
        edge_function_url,
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        payload::bytea
      );
      RAISE NOTICE 'Campaign % completed. Edge function called successfully.', NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to call edge function: %. Use Database Webhooks instead.', SQLERRM;
    END;
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
    -- Only trigger when status changes to 'completed'
    NEW.status = 'completed' 
    AND (OLD.status IS NULL OR OLD.status != 'completed')
  )
  EXECUTE FUNCTION notify_campaign_completion();

-- Note: If pg_net extension is not available, you may need to:
-- 1. Enable the extension: CREATE EXTENSION IF NOT EXISTS pg_net;
-- 2. Or use Supabase's database webhooks feature instead (see deployment guide)
-- 3. Or use a scheduled job that checks for completed campaigns

COMMENT ON FUNCTION notify_campaign_completion() IS 
  'Triggers when a campaign status changes to completed and calls the edge function to send call logs report';
