-- Migration: Create n8n_errors table
-- Description: Table to store n8n workflow execution errors
-- Date: 2025-01-20

CREATE TABLE IF NOT EXISTS public.n8n_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  execution_id character varying(255) NULL,
  execution_url text NULL,
  retry_of character varying(255) NULL,
  error_message text NULL,
  error_stack text NULL,
  last_node_executed character varying(255) NULL,
  mode character varying(50) NULL,
  workflow_id character varying(255) NULL,
  workflow_name character varying(255) NULL,
  api_key_id uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT n8n_errors_pkey PRIMARY KEY (id),
  CONSTRAINT n8n_errors_api_key_id_fkey FOREIGN KEY (api_key_id) 
    REFERENCES public.api_keys (id) 
    ON UPDATE CASCADE 
    ON DELETE SET NULL
) TABLESPACE pg_default;

-- Add comments to table
COMMENT ON TABLE public.n8n_errors IS 'Stores n8n workflow execution errors received via API';
COMMENT ON COLUMN public.n8n_errors.id IS 'Unique identifier for the error record';
COMMENT ON COLUMN public.n8n_errors.execution_id IS 'n8n execution ID';
COMMENT ON COLUMN public.n8n_errors.execution_url IS 'Full execution URL from n8n';
COMMENT ON COLUMN public.n8n_errors.retry_of IS 'If this is a retry, the original execution ID';
COMMENT ON COLUMN public.n8n_errors.error_message IS 'Error message from n8n';
COMMENT ON COLUMN public.n8n_errors.error_stack IS 'Full stack trace from the error';
COMMENT ON COLUMN public.n8n_errors.last_node_executed IS 'Name of the node where the error occurred';
COMMENT ON COLUMN public.n8n_errors.mode IS 'Execution mode (manual, trigger, etc.)';
COMMENT ON COLUMN public.n8n_errors.workflow_id IS 'n8n workflow ID';
COMMENT ON COLUMN public.n8n_errors.workflow_name IS 'Name of the workflow';
COMMENT ON COLUMN public.n8n_errors.api_key_id IS 'Reference to the API key used for authentication';
COMMENT ON COLUMN public.n8n_errors.created_at IS 'Timestamp when the error was logged';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_n8n_errors_execution_id ON public.n8n_errors(execution_id);
CREATE INDEX IF NOT EXISTS idx_n8n_errors_workflow_id ON public.n8n_errors(workflow_id);
CREATE INDEX IF NOT EXISTS idx_n8n_errors_api_key_id ON public.n8n_errors(api_key_id);
CREATE INDEX IF NOT EXISTS idx_n8n_errors_created_at ON public.n8n_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_n8n_errors_mode ON public.n8n_errors(mode);
