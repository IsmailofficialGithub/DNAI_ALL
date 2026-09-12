-- Migration: Add break_start_time and break_end_time columns to weekly_availability table
-- Description: Adds break time support to weekly availability schedules
-- Date: 2025-01-XX

-- Add break_start_time column to inbound.weekly_availability table
ALTER TABLE inbound.weekly_availability 
ADD COLUMN IF NOT EXISTS break_start_time time without time zone;

-- Add break_end_time column to inbound.weekly_availability table
ALTER TABLE inbound.weekly_availability 
ADD COLUMN IF NOT EXISTS break_end_time time without time zone;

-- Add comments to columns
COMMENT ON COLUMN inbound.weekly_availability.break_start_time IS 'Start time of break period for this day (optional)';
COMMENT ON COLUMN inbound.weekly_availability.break_end_time IS 'End time of break period for this day (optional)';

-- Update the public view to include break time columns
CREATE OR REPLACE VIEW public.weekly_availability AS 
SELECT * FROM inbound.weekly_availability;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_availability TO authenticated, anon, service_role;
