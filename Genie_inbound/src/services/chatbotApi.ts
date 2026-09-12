import { platformKnowledge } from "@/data/platform-knowledge";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");
export const CHATBOT_UNAVAILABLE_MESSAGE =
    "Our AI assistant is currently unavailable. Please try again later or contact support if you need help.";

// Get system prompt from environment variable or use default
// Always includes platform knowledge base for accurate answers
const getSystemPrompt = (): string => {
    const envPrompt = process.env.REACT_APP_CHATBOT_SYSTEM_PROMPT;

    // Base prompt - either from env or default
    let basePrompt: string;
    if (envPrompt) {
        basePrompt = envPrompt.replace(/\\n/g, '\n');
    } else {
        // Default system prompt
        basePrompt = `You are a helpful AI assistant for DNAI, an AI-powered voice automation platform. 
You help users learn about features like voice agents, inbound numbers, knowledge bases, call schedules, and leads.
Be professional, concise, and helpful. If you don't know the answer, suggest contacting support.`;
    }

    // Always append platform knowledge base for accurate answers
    return `${basePrompt}

Use the following platform knowledge base to answer user questions accurately:

${platformKnowledge}

When answering questions:
- Reference specific features and workflows from the knowledge base
- Provide step-by-step instructions when applicable
- Be concise but thorough
- If the answer isn't in the knowledge base, suggest contacting support`;
};

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface ChatResponse {
    response: string;
    session_id?: string;
    message?: string;
}

export const chatbotApi = {
    sendMessage: async (
        message: string,
        history: ChatMessage[],
        sessionId: string,
        userId: string | null
    ): Promise<ChatResponse> => {
        try {
            const systemPrompt = getSystemPrompt();

            const response = await fetch(`${BACKEND_URL}/api/ai/chatbot`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message,
                    history,
                    systemPrompt,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error || `Server error: ${response.status}`);
                (error as any).status = response.status;
                throw error;
            }

            const data = await response.json();

            if (!data.response) {
                throw new Error("No response from AI assistant");
            }

            return {
                response: data.response,
                session_id: sessionId
            };
        } catch (error: any) {
            console.error("Chatbot API error:", error);
            throw new Error(CHATBOT_UNAVAILABLE_MESSAGE);
        }
    }
};
