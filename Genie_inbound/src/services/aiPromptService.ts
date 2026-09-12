import type { AgentPromptProfile } from "@/types/aiPrompt";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");

export interface ExtractionResult {
  extractedProfile: Partial<AgentPromptProfile>;
  missingFields: string[];
}

export interface AgentFormData {
  agentName?: string;
  companyName?: string;
  websiteUrl?: string;
  goal?: string;
  backgroundContext?: string;
  instructionVoice?: string;
  script?: string;
  language?: string;
  timezone?: string;
  agentType?: string;
  tool?: string;
  voice?: string;
  temperature?: number;
  confidence?: number;
  verbosity?: number;
}

export interface PromptGenerationResult {
  status: "success";
  finalPrompt: string;
  welcomeMessages?: string[];
  formData?: AgentFormData;
  agentProfile?: Partial<AgentPromptProfile>;
}

/**
 * Agent A: Document Profile Extractor
 */
export async function extractDocumentProfile(
  documentText: string
): Promise<ExtractionResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/extract-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: documentText }),
    });
    if (!response.ok) throw new Error("Failed to extract profile from document");
    return await response.json();
  } catch (error: any) {
    console.error("Error extracting profile:", error);
    return {
      extractedProfile: {},
      missingFields: ["companyName", "businessIndustry", "agentPurpose", "targetAudience", "callGoal", "services"],
    };
  }
}

/**
 * Agent B: Generate prompt using Backend API
 */
// Get system prompt from environment variable or use default
const getPromptGenerationSystemPrompt = (): string => {
  const envPrompt = process.env.REACT_APP_AI_PROMPT_GENERATOR_SYSTEM_PROMPT;
  if (envPrompt) {
    return envPrompt.replace(/\\n/g, '\n');
  }

  // Default system prompt
  return `You are an expert AI voice agent prompt engineer. Based on the provided company profile, generate a comprehensive, production-ready system prompt for an inbound calling AI voice agent.

IMPORTANT: NEVER ask clarification questions. ALWAYS generate the best possible prompt using the information provided. If some fields are missing, use reasonable professional defaults and make the prompt as complete as possible.

The prompt you generate must be detailed, professional, and cover:
1. Agent identity and role
2. Company background and services
3. Conversation flow and guidelines
4. Objection handling
5. Call goals and success criteria
6. Tone and personality instructions
7. Escalation procedures
8. Data collection requirements
9. Closing procedures

Also generate ONE unique welcome/greeting message the agent can use. It should be natural, professional, and use {name} as a placeholder for personalization.

Return ONLY a JSON object with this exact structure:
{
  "finalPrompt": "the complete system prompt text",
  "welcomeMessage": "the single greeting message",
  "status": "success"
}

Always set status to "success". Never return needs_clarification.`;
};

export async function generatePromptFromProfile(
  profile: Partial<AgentPromptProfile>,
  documentText?: string
): Promise<PromptGenerationResult> {
  const systemPrompt = getPromptGenerationSystemPrompt();

  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/generate-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile,
        documentText,
        systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    return {
      status: "success" as const,
      finalPrompt: data.finalPrompt || "",
      welcomeMessages: data.welcomeMessage ? [data.welcomeMessage] : [],
      formData: data.formData || undefined,
      agentProfile: data.agentProfile || undefined,
    };
  } catch (error: any) {
    console.error("Error generating prompt:", error);
    throw error;
  }
}

/**
 * Agent C: Prompt Formatter
 */
// Get prompt formatter system prompt from environment variable or use default
const getPromptFormatterSystemPrompt = (): string => {
  const envPrompt = process.env.REACT_APP_AI_PROMPT_FORMATTER_SYSTEM_PROMPT;
  if (envPrompt) {
    return envPrompt.replace(/\\n/g, '\n');
  }

  // Default system prompt - updated to request JSON format
  return `You are an expert prompt formatter. Take the raw, unstructured prompt provided and restructure it into a clear, professional AI voice agent system prompt. Organize it with clear sections, proper formatting, and professional language.\n\nReturn ONLY a JSON object with this exact structure:\n{\n  "formattedPrompt": "The formatted, professional system prompt text",\n  "formData": {\n    "agentName": "Extracted or inferred agent name",\n    "companyName": "Extracted company name",\n    "websiteUrl": "Extracted website URL or empty string",\n    "goal": "Extracted call goal",\n    "backgroundContext": "Extracted background context",\n    "instructionVoice": "Extracted voice instructions",\n    "script": "Same as formattedPrompt",\n    "language": "Extracted language code or 'en-US'",\n    "timezone": "Extracted timezone or 'America/New_York'",\n    "agentType": "Inferred: 'support', 'booking', 'billing', 'complaint', or 'general'",\n    "tool": "Inferred: 'crm', 'calendar', 'email', 'sms', or empty string",\n    "voice": "Default 'helena'",\n    "temperature": 0.7,\n    "confidence": 0.8,\n    "verbosity": 0.7\n  },\n  "welcomeMessage": "Extracted or generated welcome message"\n}\n\nExtract all available information from the prompt and structure it properly.`;
};

export interface FormatPromptResult {
  formattedPrompt: string;
  formData?: AgentFormData;
  welcomeMessages?: string[];
}

export async function formatRawPrompt(rawPrompt: string): Promise<FormatPromptResult> {
  const systemPrompt = getPromptFormatterSystemPrompt();

  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/format-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rawPrompt,
        systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();

    // Legacy mapping and fallback logic (simplified as backend handle OpenAI structure)
    if (data.formattedPrompt) {
      return {
        formattedPrompt: data.formattedPrompt.trim(),
        formData: data.formData || undefined,
        welcomeMessages: data.welcomeMessage ? [data.welcomeMessage] : [],
      };
    }

    // Fallback if structure is slightly different
    return {
      formattedPrompt: data.prompt || data.text || rawPrompt,
      formData: data.formData || undefined,
      welcomeMessages: data.welcomeMessage ? [data.welcomeMessage] : [],
    };
  } catch (error: any) {
    console.error("Error formatting prompt:", error);
    return {
      formattedPrompt: `You are an AI assistant. ${rawPrompt}\n\nPlease respond professionally and helpfully to user queries.`,
      formData: undefined,
      welcomeMessages: [],
    };
  }
}
