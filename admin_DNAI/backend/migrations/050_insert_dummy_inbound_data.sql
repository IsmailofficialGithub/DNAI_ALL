-- Migration: Insert Dummy Data for Inbound Tables
-- Description: Adds sample data for testing the inbound genie product
-- Date: 2025-01-XX

-- ============================================================================
-- Insert Dummy Inbound Numbers
-- ============================================================================
-- Note: Replace 'YOUR_USER_ID_HERE' with an actual user_id from auth.users

INSERT INTO inbound.inbound_numbers (
  id,
  user_id,
  phone_number,
  country_code,
  phone_label,
  call_forwarding_number,
  provider,
  status,
  health_status,
  webhook_status,
  assigned_to_agent_id,
  is_in_use,
  sms_enabled,
  created_at
) VALUES 
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  '+12345678901',
  '+1',
  'Main Office Line',
  '+12345678902',
  'twilio',
  'active',
  'healthy',
  'active',
  (SELECT id FROM outbound.voice_agents LIMIT 1),
  true,
  true,
  now()
),
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  '+12345678903',
  '+1',
  'Sales Department',
  '+12345678904',
  'twilio',
  'active',
  'healthy',
  'active',
  (SELECT id FROM outbound.voice_agents LIMIT 1 OFFSET 1),
  true,
  false,
  now()
),
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  '+12345678905',
  '+1',
  'Support Hotline',
  '+12345678906',
  'vonage',
  'active',
  'healthy',
  'active',
  (SELECT id FROM outbound.voice_agents LIMIT 1 OFFSET 2),
  false,
  true,
  now()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Dummy Call History
-- ============================================================================
INSERT INTO inbound.call_history (
  id,
  user_id,
  agent_id,
  inbound_number_id,
  call_sid,
  provider,
  caller_number,
  caller_country_code,
  called_number,
  called_country_code,
  call_status,
  call_direction,
  call_duration,
  call_start_time,
  call_end_time,
  call_answered_time,
  recording_url,
  transcript,
  call_cost,
  call_quality_score,
  created_at
) 
SELECT 
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM outbound.voice_agents LIMIT 1),
  (SELECT id FROM inbound.inbound_numbers LIMIT 1),
  'CA' || substr(md5(random()::text), 1, 32),
  'twilio',
  '+1' || (1000000000 + floor(random() * 9000000000)::bigint)::text,
  '+1',
  (SELECT phone_number FROM inbound.inbound_numbers LIMIT 1),
  '+1',
  (ARRAY['answered', 'missed', 'forwarded', 'completed', 'failed'])[floor(random() * 5 + 1)],
  'inbound',
  floor(random() * 300 + 30)::integer,
  now() - (random() * interval '7 days'),
  now() - (random() * interval '7 days') + (random() * interval '5 minutes'),
  now() - (random() * interval '7 days') + (random() * interval '10 seconds'),
  'https://example.com/recordings/recording_' || substr(md5(random()::text), 1, 16) || '.mp3',
  'This is a sample transcript of the call conversation.',
  (random() * 2 + 0.5)::numeric(10,2),
  (random() * 3 + 7)::numeric(3,1),
  now() - (random() * interval '7 days')
FROM generate_series(1, 30);

-- ============================================================================
-- Insert Dummy Call Schedules
-- ============================================================================
INSERT INTO inbound.call_schedules (
  id,
  user_id,
  inbound_number_id,
  agent_id,
  schedule_name,
  timezone,
  is_active,
  created_at
) VALUES 
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM inbound.inbound_numbers LIMIT 1),
  (SELECT id FROM outbound.voice_agents LIMIT 1),
  'Business Hours',
  'America/New_York',
  true,
  now()
),
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM inbound.inbound_numbers LIMIT 1 OFFSET 1),
  (SELECT id FROM outbound.voice_agents LIMIT 1 OFFSET 1),
  'Extended Hours',
  'America/New_York',
  true,
  now()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Dummy Weekly Availability
-- ============================================================================
INSERT INTO inbound.weekly_availability (
  id,
  schedule_id,
  day_of_week,
  is_available,
  start_time,
  end_time
)
SELECT 
  gen_random_uuid(),
  cs.id,
  day,
  true,
  '09:00:00'::time,
  '17:00:00'::time
FROM inbound.call_schedules cs
CROSS JOIN generate_series(0, 4) AS day
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Dummy Holidays
-- ============================================================================
INSERT INTO inbound.holidays (
  id,
  user_id,
  holiday_name,
  holiday_date,
  is_recurring,
  is_active,
  created_at
) VALUES 
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'New Year''s Day',
  CURRENT_DATE + interval '1 year' - interval '1 day',
  true,
  true,
  now()
),
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Independence Day',
  CURRENT_DATE + interval '6 months',
  true,
  true,
  now()
),
(
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Christmas',
  CURRENT_DATE + interval '11 months',
  true,
  true,
  now()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Dummy Holiday Messages
-- ============================================================================
INSERT INTO inbound.holiday_messages (
  id,
  holiday_id,
  inbound_number_id,
  message_text,
  message_type,
  is_active
)
SELECT 
  gen_random_uuid(),
  h.id,
  in_num.id,
  'We are closed for ' || h.holiday_name || '. Please leave a message and we will get back to you.',
  'voicemail',
  true
FROM inbound.holidays h
CROSS JOIN inbound.inbound_numbers in_num
LIMIT 5
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Dummy After Hours Messages
-- ============================================================================
INSERT INTO inbound.after_hours_messages (
  id,
  inbound_number_id,
  message_text,
  message_type,
  is_active
)
SELECT 
  gen_random_uuid(),
  id,
  'Thank you for calling. Our business hours are Monday-Friday, 9 AM to 5 PM EST. Please leave a message and we will get back to you.',
  'voicemail',
  true
FROM inbound.inbound_numbers
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Dummy Inbound Analytics
-- ============================================================================
INSERT INTO inbound.inbound_analytics (
  id,
  user_id,
  inbound_number_id,
  agent_id,
  date,
  period,
  total_calls,
  answered_calls,
  missed_calls,
  forwarded_calls,
  failed_calls,
  total_duration_seconds,
  average_duration_seconds,
  total_cost,
  average_cost,
  average_quality_score,
  peak_hour
)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  in_num.id,
  (SELECT id FROM outbound.voice_agents LIMIT 1),
  CURRENT_DATE - (day_offset || ' days')::interval,
  'day',
  floor(random() * 50 + 10)::integer,
  floor(random() * 40 + 5)::integer,
  floor(random() * 10 + 1)::integer,
  floor(random() * 5)::integer,
  floor(random() * 3)::integer,
  floor(random() * 3600 + 600)::integer,
  (random() * 120 + 60)::numeric(10,2),
  (random() * 50 + 10)::numeric(10,2),
  (random() * 2 + 0.5)::numeric(10,2),
  (random() * 2 + 7.5)::numeric(3,1),
  floor(random() * 8 + 9)::integer
FROM inbound.inbound_numbers in_num
CROSS JOIN generate_series(0, 29) AS day_offset
LIMIT 30
ON CONFLICT DO NOTHING;
