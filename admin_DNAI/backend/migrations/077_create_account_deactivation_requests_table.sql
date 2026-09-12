-- Migration: Create account_deactivation_requests table
-- Description: Creates table for account deactivation and deletion requests
-- Date: 2025-01-XX

-- ============================================================================
-- account_deactivation_requests table (public schema)
-- ============================================================================

-- Create account_deactivation_requests table
CREATE TABLE IF NOT EXISTS public.account_deactivation_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  reason text,
  scheduled_deletion_at timestamp with time zone,
  status character varying(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  cancelled_at timestamp with time zone,
  cancelled_by uuid,
  completed_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT account_deactivation_requests_pkey PRIMARY KEY (id),
  CONSTRAINT account_deactivation_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT account_deactivation_requests_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_deactivation_requests_user_id 
ON public.account_deactivation_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_account_deactivation_requests_status 
ON public.account_deactivation_requests(status);

CREATE INDEX IF NOT EXISTS idx_account_deactivation_requests_scheduled_deletion_at 
ON public.account_deactivation_requests(scheduled_deletion_at) 
WHERE scheduled_deletion_at IS NOT NULL;

-- Add comments
COMMENT ON TABLE public.account_deactivation_requests IS 'Stores account deactivation and deletion requests';
COMMENT ON COLUMN public.account_deactivation_requests.reason IS 'Reason provided by user for deactivating account';
COMMENT ON COLUMN public.account_deactivation_requests.scheduled_deletion_at IS 'Date and time when the account will be permanently deleted (typically 30 days after request)';
COMMENT ON COLUMN public.account_deactivation_requests.status IS 'Status of the deactivation request: pending, completed, or cancelled';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_deactivation_requests TO authenticated, anon, service_role;
