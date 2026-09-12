-- Migration: Add schedule_id column to holidays table
-- Description: Links holidays to specific call schedules
-- Date: 2025-01-XX

-- Add schedule_id column to inbound.holidays table
ALTER TABLE inbound.holidays
ADD COLUMN IF NOT EXISTS schedule_id uuid;

-- Drop constraint if it exists, then add foreign key constraint to link with inbound.call_schedules
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_holidays_schedule_id'
    ) THEN
        ALTER TABLE inbound.holidays DROP CONSTRAINT fk_holidays_schedule_id;
    END IF;
END $$;

ALTER TABLE inbound.holidays
ADD CONSTRAINT fk_holidays_schedule_id
FOREIGN KEY (schedule_id) REFERENCES inbound.call_schedules(id) ON DELETE CASCADE;

-- Create index for faster queries on schedule_id
CREATE INDEX IF NOT EXISTS idx_holidays_schedule_id
ON inbound.holidays(schedule_id)
WHERE schedule_id IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN inbound.holidays.schedule_id IS 'Foreign key to inbound.call_schedules, linking holiday to a specific schedule. NULL means the holiday applies to all schedules for the user.';

-- Update the public view to include schedule_id column
CREATE OR REPLACE VIEW public.holidays AS
SELECT * FROM inbound.holidays;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated, anon, service_role;
