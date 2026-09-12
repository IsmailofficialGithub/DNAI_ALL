-- Migration: Insert Dummy Data for Outbound Tables
-- Description: Adds sample data for testing the outbound genie product
-- Date: 2025-01-XX

-- ============================================================================
-- Insert Dummy Voice Agents
-- ============================================================================
-- Note: Replace 'YOUR_USER_ID_HERE' with an actual user_id from auth.users

INSERT INTO outbound.voice_agents (
  id,
  user_id,
  name,
  company_name,
  goal,
  welcome_message,
  voice,
  tone,
  model,
  agent_type,
  status,
  created_at
) VALUES 
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1), -- Use first available user
  'Sales Assistant Agent',
  'Tech Corp',
  'Help customers understand our products and close sales',
  'Hello! I''m here to help you find the perfect solution for your needs.',
  'aura-helena-en',
  'friendly',
  'gpt-4o',
  'sales',
  'active',
  now()
),
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Support Agent',
  'Customer Care Inc',
  'Provide excellent customer support and resolve issues',
  'Hi! I''m here to help you with any questions or issues you may have.',
  'aura-helena-en',
  'professional',
  'gpt-4o',
  'support',
  'active',
  now()
),
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Booking Agent',
  'Appointment Services',
  'Schedule appointments and manage bookings',
  'Welcome! I can help you schedule an appointment that works for you.',
  'aura-helena-en',
  'professional',
  'gpt-4o',
  'booking',
  'active',
  now()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Dummy Agent Calls
-- ============================================================================
INSERT INTO outbound.agent_calls (
  id,
  agent_id,
  user_id,
  caller_number,
  called_number,
  direction,
  status,
  duration,
  started_at,
  answered_at,
  ended_at,
  created_at
)
SELECT 
  gen_random_uuid(),
  va.id,
  va.user_id,
  '+1234567890',
  '+1987654321',
  'outbound',
  CASE (random() * 5)::int
    WHEN 0 THEN 'completed'
    WHEN 1 THEN 'answered'
    WHEN 2 THEN 'failed'
    WHEN 3 THEN 'no-answer'
    ELSE 'completed'
  END,
  (random() * 300 + 60)::int, -- 60-360 seconds
  now() - (random() * interval '7 days'),
  now() - (random() * interval '7 days') + interval '5 seconds',
  now() - (random() * interval '7 days') + interval '120 seconds',
  now() - (random() * interval '7 days')
FROM outbound.voice_agents va
LIMIT 20
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Dummy Agent Analytics
-- ============================================================================
INSERT INTO outbound.agent_analytics (
  id,
  agent_id,
  user_id,
  date,
  period,
  total_calls,
  answered_calls,
  missed_calls,
  total_duration,
  average_duration,
  conversions,
  conversion_rate
)
SELECT 
  gen_random_uuid(),
  va.id,
  va.user_id,
  CURRENT_DATE - (random() * 30)::int,
  'day',
  (random() * 50 + 10)::int,
  (random() * 40 + 5)::int,
  (random() * 10)::int,
  (random() * 3600 + 600)::int,
  (random() * 180 + 60)::numeric,
  (random() * 10)::int,
  (random() * 0.3 + 0.1)::numeric
FROM outbound.voice_agents va
LIMIT 30
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Dummy AI Prompts
-- ============================================================================
INSERT INTO outbound.ai_prompts (
  id,
  user_id,
  name,
  category,
  system_prompt,
  begin_message,
  call_type,
  call_goal,
  tone,
  status,
  is_active,
  is_template
)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  CASE (random() * 3)::int
    WHEN 0 THEN 'Sales Conversation Template'
    WHEN 1 THEN 'Support Resolution Template'
    ELSE 'General Inquiry Template'
  END,
  'sales',
  'You are a helpful AI assistant designed to assist customers with their needs.',
  'Hello! How can I help you today?',
  'outbound',
  'Engage customer and provide value',
  'professional',
  'active',
  true,
  true
FROM generate_series(1, 5)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Dummy Call Analytics
-- ============================================================================
INSERT INTO outbound.call_analytics (
  id,
  user_id,
  agent_id,
  date,
  hour,
  total_calls,
  answered_calls,
  missed_calls,
  total_duration_seconds,
  average_duration_seconds,
  total_cost,
  average_cost
)
SELECT 
  gen_random_uuid(),
  va.user_id,
  va.id,
  CURRENT_DATE - (random() * 7)::int,
  (random() * 23)::int,
  (random() * 20 + 5)::int,
  (random() * 15 + 3)::int,
  (random() * 5)::int,
  (random() * 1800 + 300)::int,
  (random() * 120 + 60)::numeric,
  (random() * 50 + 10)::numeric,
  (random() * 2 + 0.5)::numeric
FROM outbound.voice_agents va
LIMIT 21
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Verification: Check inserted data
-- ============================================================================
SELECT 
  'voice_agents' as table_name,
  COUNT(*) as row_count
FROM outbound.voice_agents
UNION ALL
SELECT 
  'agent_calls',
  COUNT(*)
FROM outbound.agent_calls
UNION ALL
SELECT 
  'agent_analytics',
  COUNT(*)
FROM outbound.agent_analytics
UNION ALL
SELECT 
  'ai_prompts',
  COUNT(*)
FROM outbound.ai_prompts
UNION ALL
SELECT 
  'call_analytics',
  COUNT(*)
FROM outbound.call_analytics;
