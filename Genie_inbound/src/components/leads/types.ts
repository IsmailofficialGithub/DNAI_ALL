export interface CallHistoryRecord {
  id: string;
  user_id: string;
  agent_id: string | null;
  inbound_number_id: string | null;
  caller_number: string | null;
  called_number: string | null;
  call_status: string | null;
  call_duration: number | null;
  call_start_time: string | null;
  call_end_time: string | null;
  call_answered_time: string | null;
  recording_url: string | null;
  transcript: string | null;
  call_forwarded_to: string | null;
  call_cost: number | null;
  notes: string | null;
  metadata: any;
  is_lead: boolean | null;
  call_summary?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LeadRecord {
  id: string;
  call_history_id: string | null;
  user_id: string;
  agent_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  meeting_time: string | null;
  meeting_date: string | null;
  meeting_timezone: string | null;
  meeting_location: string | null;
  meeting_status: string | null;
  status: string;
  source: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  call_history?: CallHistoryRecord;
  inbound_number_id?: string | null;
  audio_url?: string | null;
  lead_strength?: string | null;
  sentiment?: string | null;
  urgency_level?: string | null;
  call_summary?: string | null;
  intent_summary?: string | null;
  next_step_type?: string | null;
  next_step_details?: string | null;
  transcript?: string | null;
}
