export interface AgentPromptProfile {
  companyName: string;
  companyAddress?: string;
  companyWebsite?: string;
  companyEmail?: string;
  companyPhone?: string;
  businessIndustry: string;
  businessDescription?: string;
  agentPurpose?: string;
  callType: "Support" | "Booking" | "Billing" | "Complaint" | "Mixed" | "";
  targetAudience?: string;
  callGoal?: "Book Appointment" | "Close Sale" | "Qualify Lead" | "Collect Information" | "Support Resolution" | "custom" | "";
  services?: string[];
  pricingInfo?: string;
  businessHours?: string;
  bookingMethod?: string;
  appointmentRules?: string;
  escalationProcess?: string;
  requiredCustomerFields: string[];
  faqs: string[];
  objections: string[];
  policies: string[];
  tone: "Friendly" | "Professional" | "Empathetic" | "Energetic" | "Strict";
  languages: string[];
  welcomeMessage?: string;
  instructionVoice?: string;
}
