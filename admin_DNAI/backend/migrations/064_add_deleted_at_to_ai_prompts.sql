-- Migration: Add deleted_at column to ai_prompts table
-- Description: Adds soft delete support to inbound.ai_prompts table
-- Date: 2025-01-XX

-- Add deleted_at column to inbound.ai_prompts table
ALTER TABLE inbound.ai_prompts 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Create index for faster queries filtering out deleted records
CREATE INDEX IF NOT EXISTS idx_ai_prompts_deleted_at 
ON inbound.ai_prompts(deleted_at) 
WHERE deleted_at IS NULL;

-- Add comment to column
COMMENT ON COLUMN inbound.ai_prompts.deleted_at IS 'Timestamp when the prompt was soft deleted. NULL means not deleted.';

-- Update the public view to include deleted_at column
CREATE OR REPLACE VIEW public.ai_prompts AS 
SELECT * FROM inbound.ai_prompts;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompts TO authenticated, anon, service_role;
