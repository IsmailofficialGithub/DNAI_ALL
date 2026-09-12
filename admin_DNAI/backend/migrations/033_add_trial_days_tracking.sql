-- Migration: Add trial days tracking to profiles table
-- Description: Adds columns to track total trial days used to properly enforce 7-day limit
-- This allows tracking trial extensions even when trials expire

-- Add total_trial_days_used column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS total_trial_days_used INTEGER DEFAULT 0;

-- Create index for faster queries on total_trial_days_used
CREATE INDEX IF NOT EXISTS idx_profiles_total_trial_days_used ON profiles(total_trial_days_used) 
WHERE total_trial_days_used > 0;

-- Add comment to column
COMMENT ON COLUMN profiles.total_trial_days_used IS 'Total number of trial days used/allocated (max 7 days from account creation)';

-- Update existing records: Calculate total_trial_days_used from trial_expiry and created_at
-- For existing consumers, calculate days between created_at and trial_expiry
UPDATE profiles
SET total_trial_days_used = CASE
  WHEN trial_expiry IS NOT NULL AND created_at IS NOT NULL THEN
    GREATEST(0, LEAST(7, EXTRACT(EPOCH FROM (trial_expiry - created_at)) / 86400)::INTEGER)
  ELSE 0
END
WHERE total_trial_days_used = 0 OR total_trial_days_used IS NULL;

