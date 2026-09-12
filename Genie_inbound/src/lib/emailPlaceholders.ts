export interface Placeholder {
  placeholder: string;
  description: string;
  example: string;
}

export const AVAILABLE_PLACEHOLDERS: Placeholder[] = [
  {
    placeholder: "{{contact_name}}",
    description: "Contact's full name",
    example: "John Doe",
  },
  {
    placeholder: "{{phone_number}}",
    description: "Contact's phone number",
    example: "+1234567890",
  },
  {
    placeholder: "{{company_name}}",
    description: "Contact's company name",
    example: "Acme Corp",
  },
  {
    placeholder: "{{call_date}}",
    description: "Date of the call",
    example: "January 15, 2024",
  },
  {
    placeholder: "{{call_time}}",
    description: "Time of the call",
    example: "2:30 PM",
  },
  {
    placeholder: "{{call_duration}}",
    description: "Duration of the call",
    example: "15 minutes",
  },
  {
    placeholder: "{{agent_name}}",
    description: "Name of the agent",
    example: "AI Assistant",
  },
  {
    placeholder: "{{call_summary}}",
    description: "Summary of the call",
    example: "Discussed product features and pricing",
  },
  {
    placeholder: "{{meeting_date}}",
    description: "Scheduled meeting date",
    example: "January 20, 2024",
  },
  {
    placeholder: "{{meeting_time}}",
    description: "Scheduled meeting time",
    example: "10:00 AM",
  },
];

export const getAvailablePlaceholders = (): Placeholder[] => {
  return AVAILABLE_PLACEHOLDERS;
};

export const replacePlaceholders = (
  text: string,
  values: Record<string, string>
): string => {
  let result = text;
  Object.keys(values).forEach((key) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, values[key] || "");
  });
  return result;
};
