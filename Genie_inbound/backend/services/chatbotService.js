import OpenAI from 'openai';
import dotenv from 'dotenv';
import { sanitizeError } from '../utils/errorHandler.js';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Handle chatbot messages using OpenAI
 */
export async function handleChatMessage({ message, history, systemPrompt }) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    try {
        const messages = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message }
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            temperature: 0.7,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("No response from AI assistant");

        return { response: content };
    } catch (error) {
        console.error("Chatbot Service error:", error);
        const { message: sanitizedMsg } = sanitizeError(error, 'Failed to get chatbot response');
        throw new Error(sanitizedMsg);
    }
}
