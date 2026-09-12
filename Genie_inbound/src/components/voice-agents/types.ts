export interface VoiceAgent {
  id: string;
  name: string;
  company_name: string | null;
  website_url?: string | null;
  goal?: string | null;
  background?: string | null;
  welcome_message?: string | null;
  instruction_voice?: string | null;
  script?: string | null;
  voice: string | null;
  language: string | null;
  timezone: string | null;
  agent_type: string | null;
  tool: string | null;
  phone_number: string;
  phone_provider: string | null;
  phone_label: string | null;
  status: string;
  vapi_id: string | null;
  knowledge_base_id?: string | null;
  call_forwarding_number?: string | null;
  call_transferring_reason?: string | null;
  temperature?: number;
  confidence?: number;
  verbosity?: number;
  metadata?: {
    call_availability_start?: string;
    call_availability_end?: string;
    call_availability_days?: string[];
    welcome_email_body?: string;
    [key: string]: any;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface InboundNumber {
  id: string;
  phone_number: string;
  phone_label: string | null;
}
