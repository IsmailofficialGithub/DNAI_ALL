import OpenAI from 'openai';
import dotenv from 'dotenv';
import { sanitizeError } from '../utils/errorHandler.js';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate agent details using OpenAI
 */
export async function generateAgentDetails({ prompt, systemPrompt }) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("No response from OpenAI");

        return JSON.parse(content);
    } catch (error) {
        console.error("Agent Details Service error:", error);
        const { message: sanitizedMsg } = sanitizeError(error, 'Failed to generate agent details');
        throw new Error(sanitizedMsg);
    }
}
