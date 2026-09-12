-- Migration: Add deleted_at column to call_schedules table
-- Description: Adds soft delete support to call_schedules table
-- Date: 2025-01-XX

-- Add deleted_at column to inbound.call_schedules table
ALTER TABLE inbound.call_schedules 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Create index for faster queries filtering out deleted records
CREATE INDEX IF NOT EXISTS idx_call_schedules_deleted_at 
ON inbound.call_schedules(deleted_at) 
WHERE deleted_at IS NULL;

-- Add comment to column
COMMENT ON COLUMN inbound.call_schedules.deleted_at IS 'Timestamp when the schedule was soft deleted. NULL means not deleted.';

-- Update the public view to include deleted_at column
CREATE OR REPLACE VIEW public.call_schedules AS 
SELECT * FROM inbound.call_schedules;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_schedules TO authenticated, anon, service_role;
