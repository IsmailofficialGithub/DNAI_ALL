
INSERT INTO public.products (
  id,
  name,
  description,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'genie_outbound',
  'Outbound calling and voice agent management system. Create AI-powered voice agents, manage outbound calls, track analytics, and automate customer interactions.',
  now(),
  now()
)
ON CONFLICT (name) DO UPDATE 
SET 
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- Get the product ID for reference
-- ============================================================================
SELECT 
  id,
  name,
  description,
  created_at
FROM public.products
WHERE name = 'genie_outbound';
