export interface InboundNumber {
  id: string;
  phone_number: string;
  country_code: string;
  phone_label: string | null;
  call_forwarding_number: string | null;
  provider: string;
  status: 'active' | 'activating' | 'suspended' | 'error' | 'pending' | 'inactive';
  health_status: 'healthy' | 'unhealthy' | 'unknown' | 'testing' | null;
  webhook_status: 'active' | 'inactive' | 'error' | 'unknown' | null;
  assigned_to_agent_id: string | null;
  is_in_use: boolean;
  created_at: string;
  updated_at: string;
  twilio_sid?: string | null;
  vonage_api_key?: string | null;
  callhippo_api_key?: string | null;
}
