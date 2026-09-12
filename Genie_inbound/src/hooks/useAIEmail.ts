import { useState } from "react";
import { toast } from "./use-toast";

interface GenerateTemplateOptions {
  name: string;
  description?: string;
  emailType: "follow-up" | "thank-you" | "appointment" | "custom";
  tone: "professional" | "friendly" | "casual" | "formal";
  context?: string;
}

interface GenerateEmailOptions {
  leadInfo?: {
    contact_name?: string;
    phone_number?: string;
    company_name?: string;
    call_date?: string;
  };
  emailType: "follow-up" | "thank-you" | "appointment" | "custom";
  tone: "professional" | "friendly" | "casual" | "formal";
  context?: string;
}

interface GeneratedContent {
  subject: string;
  body: string;
}

// Actual AI generation call to backend
const generateWithAI = async (
  options: { name?: string; emailType: string; tone: string; context?: string }
): Promise<GeneratedContent> => {
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";
  const response = await fetch(`${BACKEND_URL}/api/ai/generate-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to generate AI content');
  }

  const data = await response.json();
  return {
    subject: data.subject,
    body: data.body,
  };
};

export const useAIEmail = () => {
  const [generating, setGenerating] = useState(false);

  const generateTemplate = async (
    options: GenerateTemplateOptions
  ): Promise<GeneratedContent | null> => {
    setGenerating(true);
    try {
      const result = await generateWithAI({
        name: options.name,
        emailType: options.emailType,
        tone: options.tone,
        context: options.context
      });
      return result;
    } catch (error: any) {
      console.error("Error generating template:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate email template",
        variant: "destructive",
      });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const generateEmail = async (
    options: GenerateEmailOptions
  ): Promise<GeneratedContent | null> => {
    setGenerating(true);
    try {
      const result = await generateWithAI({
        emailType: options.emailType,
        tone: options.tone,
        context: options.context
      });

      if (!result) return null;

      // Replace placeholders with actual values
      if (options.leadInfo) {
        Object.keys(options.leadInfo).forEach((key) => {
          const value = options.leadInfo?.[key as keyof typeof options.leadInfo] || "";
          result.subject = result.subject.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, "g"),
            value
          );
          result.body = result.body.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, "g"),
            value
          );
        });
      }

      return result;
    } catch (error: any) {
      console.error("Error generating email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate email",
        variant: "destructive",
      });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return {
    generateTemplate,
    generateEmail,
    generating,
  };
};
