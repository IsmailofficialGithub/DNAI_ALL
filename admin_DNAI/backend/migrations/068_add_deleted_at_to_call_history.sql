-- Migration: Add deleted_at column to call_history table
-- Description: Adds soft delete support to call_history table
-- Date: 2025-01-XX

-- Add deleted_at column to inbound.call_history table
ALTER TABLE inbound.call_history 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Create index for faster queries filtering out deleted records
CREATE INDEX IF NOT EXISTS idx_call_history_deleted_at 
ON inbound.call_history(deleted_at) 
WHERE deleted_at IS NULL;

-- Add comment to column
COMMENT ON COLUMN inbound.call_history.deleted_at IS 'Timestamp when the call history record was soft deleted. NULL means not deleted.';

-- Update the public view to include deleted_at column
CREATE OR REPLACE VIEW public.call_history AS 
SELECT * FROM inbound.call_history;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_history TO authenticated, anon, service_role;
