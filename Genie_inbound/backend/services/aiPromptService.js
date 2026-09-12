import OpenAI from 'openai';
import dotenv from 'dotenv';
import { sanitizeError } from '../utils/errorHandler.js';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate prompt using OpenAI
 */
export async function generatePromptFromProfile({ profile, documentText, systemPrompt }) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    const userMessage = `Generate a comprehensive voice agent prompt for this company profile:

Company: ${profile.companyName || "Not specified"}
Industry: ${profile.businessIndustry || "Not specified"}
Description: ${profile.businessDescription || "Not specified"}
Agent Purpose: ${profile.agentPurpose || "Not specified"}
Call Type: ${profile.callType || "Not specified"}
Target Audience: ${profile.targetAudience || "Not specified"}
Call Goal: ${profile.callGoal || "Not specified"}
Tone: ${profile.tone || "Friendly"}
Welcome Message: ${profile.welcomeMessage || "Not specified"}
Instruction Voice: ${profile.instructionVoice || "Not specified"}

Services: ${profile.services?.join(", ") || "Not specified"}

${profile.companyAddress ? `Address: ${profile.companyAddress}` : ""}
${profile.companyWebsite ? `Website: ${profile.companyWebsite}` : ""}
${profile.companyEmail ? `Email: ${profile.companyEmail}` : ""}
${profile.companyPhone ? `Phone: ${profile.companyPhone}` : ""}
${profile.pricingInfo ? `Pricing: ${profile.pricingInfo}` : ""}
${profile.businessHours ? `Business Hours: ${profile.businessHours}` : ""}
${profile.bookingMethod ? `Booking Method: ${profile.bookingMethod}` : ""}
${profile.appointmentRules ? `Appointment Rules: ${profile.appointmentRules}` : ""}
${profile.escalationProcess ? `Escalation: ${profile.escalationProcess}` : ""}
${profile.requiredCustomerFields?.length ? `Required Fields: ${profile.requiredCustomerFields.join(", ")}` : ""}
${profile.faqs?.length ? `FAQs:\n${profile.faqs.map((f, i) => `${i + 1}. ${f}`).join("\n")}` : ""}
${profile.objections?.length ? `Objections:\n${profile.objections.map((o, i) => `${i + 1}. ${o}`).join("\n")}` : ""}
${profile.policies?.length ? `Policies:\n${profile.policies.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : ""}
${profile.languages?.length ? `Languages: ${profile.languages.join(", ")}` : ""}
${documentText ? `\n--- UPLOADED COMPANY DOCUMENT ---\nUse the following document content as additional context to generate a more accurate and detailed prompt:\n\n${documentText}\n--- END OF DOCUMENT ---` : ""}`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("No response from OpenAI");

        return JSON.parse(content);
    } catch (error) {
        console.error("Error generating prompt:", error);
        const { message: sanitizedMsg } = sanitizeError(error, 'Failed to generate prompt');
        throw new Error(sanitizedMsg);
    }
}

/**
 * Format raw prompt using OpenAI
 */
export async function formatRawPrompt({ rawPrompt, systemPrompt }) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                { role: "user", content: rawPrompt },
            ],
            temperature: 0.5,
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("No response from OpenAI");

        return JSON.parse(content);
    } catch (error) {
        console.error("Error formatting prompt:", error);
        const { message: sanitizedMsg } = sanitizeError(error, 'Failed to format prompt');
        throw new Error(sanitizedMsg);
    }
}

/**
 * Extract agent profile from document text using OpenAI
 */
export async function extractProfile(documentText) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    const systemPrompt = `You are a document analyzer. Extract key business and voice agent configuration details from the provided text.
Return ONLY a JSON object with these fields:
{
  "extractedProfile": {
    "companyName": "string",
    "businessIndustry": "string",
    "businessDescription": "string",
    "agentPurpose": "string",
    "callType": "Inbound/Outbound",
    "targetAudience": "string",
    "callGoal": "string",
    "tone": "string",
    "services": ["array", "of", "services"],
    "pricingInfo": "string",
    "companyWebsite": "string",
    "companyEmail": "string"
  },
  "missingFields": ["list", "of", "important", "fields", "not", "found"]
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Extract profile from this text:\n\n${documentText}` },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("No response from OpenAI");

        return JSON.parse(content);
    } catch (error) {
        console.error("Error extracting profile:", error);
        const { message: sanitizedMsg } = sanitizeError(error, 'Failed to extract profile');
        throw new Error(sanitizedMsg);
    }
}
