-- Migration: Add deleted_at to holidays and schedule_id to after_hours_messages
-- Description: Adds soft delete support to holidays and links after_hours_messages to call_schedules
-- Date: 2025-01-XX

-- ============================================================================
-- holidays table updates (inbound schema)
-- ============================================================================

-- Add deleted_at column to inbound.holidays table
ALTER TABLE inbound.holidays 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Create index for faster queries filtering out deleted records
CREATE INDEX IF NOT EXISTS idx_holidays_deleted_at 
ON inbound.holidays(deleted_at) 
WHERE deleted_at IS NULL;

-- Add comment to column
COMMENT ON COLUMN inbound.holidays.deleted_at IS 'Timestamp when the holiday was soft deleted. NULL means not deleted.';

-- ============================================================================
-- after_hours_messages table updates (inbound schema)
-- ============================================================================

-- Add schedule_id column to inbound.after_hours_messages table
ALTER TABLE inbound.after_hours_messages 
ADD COLUMN IF NOT EXISTS schedule_id uuid;

-- Add foreign key constraint to call_schedules
ALTER TABLE inbound.after_hours_messages
ADD CONSTRAINT after_hours_messages_schedule_id_fkey 
FOREIGN KEY (schedule_id) REFERENCES inbound.call_schedules(id) ON DELETE CASCADE;

-- Create index for faster queries on schedule_id
CREATE INDEX IF NOT EXISTS idx_after_hours_messages_schedule_id 
ON inbound.after_hours_messages(schedule_id) 
WHERE schedule_id IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN inbound.after_hours_messages.schedule_id IS 'Reference to the call schedule this after-hours message belongs to';

-- ============================================================================
-- Update public views
-- ============================================================================

-- Update the public view to include deleted_at column
CREATE OR REPLACE VIEW public.holidays AS 
SELECT * FROM inbound.holidays;

-- Update the public view to include schedule_id column
CREATE OR REPLACE VIEW public.after_hours_messages AS 
SELECT * FROM inbound.after_hours_messages;

-- Grant permissions on the views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.after_hours_messages TO authenticated, anon, service_role;
