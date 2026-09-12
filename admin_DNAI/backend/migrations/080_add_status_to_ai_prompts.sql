-- Migration: Add status column to ai_prompts table
-- Description: Adds status column to inbound.ai_prompts for tracking prompt status
-- Date: 2025-01-XX

-- ============================================================================
-- ai_prompts table updates (inbound schema)
-- ============================================================================

-- Add status column to inbound.ai_prompts table
ALTER TABLE inbound.ai_prompts 
ADD COLUMN IF NOT EXISTS status character varying(20) DEFAULT 'draft';

-- Add check constraint for valid status values
ALTER TABLE inbound.ai_prompts
DROP CONSTRAINT IF EXISTS ai_prompts_status_check;

ALTER TABLE inbound.ai_prompts
ADD CONSTRAINT ai_prompts_status_check 
CHECK (status IN ('draft', 'ready', 'active', 'inactive', 'archived'));

-- Create index for faster queries filtering by status
CREATE INDEX IF NOT EXISTS idx_ai_prompts_status 
ON inbound.ai_prompts(status) 
WHERE status IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN inbound.ai_prompts.status IS 'Status of the AI prompt: draft, ready, active, inactive, or archived';

-- Update the public view to include status column
CREATE OR REPLACE VIEW public.ai_prompts AS 
SELECT * FROM inbound.ai_prompts;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompts TO authenticated, anon, service_role;
