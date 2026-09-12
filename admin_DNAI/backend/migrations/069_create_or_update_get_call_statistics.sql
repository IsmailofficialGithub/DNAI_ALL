-- Migration: Create or update get_call_statistics RPC function
-- Description: Ensures get_call_statistics function exists and filters deleted records
-- Date: 2025-01-XX

-- Drop existing function if it exists (to recreate with updated logic)
DROP FUNCTION IF EXISTS public.get_call_statistics(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS public.get_call_statistics;

-- Create get_call_statistics function with deleted_at filter
CREATE OR REPLACE FUNCTION public.get_call_statistics(
  p_user_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  total_calls BIGINT,
  answered_calls BIGINT,
  missed_calls BIGINT,
  forwarded_calls BIGINT,
  total_duration INTEGER,
  average_duration NUMERIC,
  total_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_calls,
    COUNT(*) FILTER (WHERE call_status = 'answered')::BIGINT as answered_calls,
    COUNT(*) FILTER (WHERE call_status = 'missed')::BIGINT as missed_calls,
    COUNT(*) FILTER (WHERE call_status = 'forwarded')::BIGINT as forwarded_calls,
    COALESCE(SUM(call_duration), 0)::INTEGER as total_duration,
    COALESCE(AVG(call_duration), 0)::NUMERIC as average_duration,
    COALESCE(SUM(call_cost), 0)::NUMERIC as total_cost
  FROM inbound.call_history
  WHERE 
    deleted_at IS NULL
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    AND (p_start_date IS NULL OR call_start_time >= p_start_date)
    AND (p_end_date IS NULL OR call_start_time <= p_end_date);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_call_statistics(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated, anon, service_role;

-- Add comment
COMMENT ON FUNCTION public.get_call_statistics IS 'Returns call statistics for a user or agent, excluding soft-deleted records';
