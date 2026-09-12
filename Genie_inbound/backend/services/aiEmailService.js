import OpenAI from 'openai';
import dotenv from 'dotenv';
import { sanitizeError } from '../utils/errorHandler.js';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const EMAIL_GEN_SYSTEM_PROMPT = `You are an expert email marketer and template designer. Your goal is to generate high-converting, professional email templates based on user requirements.

IMPORTANT RULES:
1. Use placeholders for dynamic content: {{contact_name}}, {{phone_number}}, {{company_name}}, {{call_date}}, {{call_time}}, {{call_duration}}, {{agent_name}}, {{call_summary}}, {{meeting_date}}, {{meeting_time}}.
2. Output ONLY valid JSON with 'subject' and 'body' fields.
3. The body should use single newline transitions and maintain a clean structure.
4. Keep the tone consistent with the user's request.
5. If context is provided, ensure you incorporate those specific details into the email.

Output JSON structure:
{
  "subject": "Email Subject Line",
  "body": "Email body content with placeholders..."
}`;

/**
 * Generate email template using OpenAI
 */
export async function generateEmailWithAI(options) {
    const { name, emailType, tone, context } = options;

    if (!process.env.OPENAI_API_KEY) {
        return {
            success: false,
            error: 'OPENAI_API_KEY is not configured'
        };
    }

    try {
        const userPrompt = `
      Create an email template named "${name}".
      Type of Email: ${emailType}
      Desired Tone: ${tone}
      ${context ? `Additional Context: ${context}` : ''}
    `;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: EMAIL_GEN_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
            throw new Error('No response from AI engine');
        }

        const result = JSON.parse(responseText);

        return {
            success: true,
            subject: result.subject,
            body: result.body
        };
    } catch (error) {
        console.error('AI Email Generation Error:', error);
        const { message: sanitizedMsg } = sanitizeError(error, 'Failed to generate email content');
        return {
            success: false,
            error: sanitizedMsg
        };
    }
}
