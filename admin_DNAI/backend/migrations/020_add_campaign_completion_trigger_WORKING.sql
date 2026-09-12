-- WORKING TRIGGER - Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY, then run this

-- Step 1: Remove old trigger if exists
DROP TRIGGER IF EXISTS trigger_campaign_completion ON genie_scheduled_calls;
DROP FUNCTION IF EXISTS notify_campaign_completion();

-- Step 2: Enable pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 3: Create function (REPLACE the values below!)
CREATE OR REPLACE FUNCTION notify_campaign_completion()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report';
  service_key TEXT := 'YOUR_SERVICE_ROLE_KEY';
  payload_json JSONB;
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
    
    -- Call edge function - try pg_net with different syntax
    PERFORM net.http_post(
      edge_function_url,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      payload_json::text::bytea
    );
    
    RAISE NOTICE 'Campaign % completed. Edge function called.', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger
CREATE TRIGGER trigger_campaign_completion
  BEFORE UPDATE ON genie_scheduled_calls
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed' 
    AND (OLD.status IS NULL OR OLD.status != 'completed')
  )
  EXECUTE FUNCTION notify_campaign_completion();
