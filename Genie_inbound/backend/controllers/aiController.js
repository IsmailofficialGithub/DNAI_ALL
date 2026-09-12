import { generateEmailWithAI } from '../services/aiEmailService.js';
import { generatePromptFromProfile, formatRawPrompt, extractProfile as extractAgentProfile } from '../services/aiPromptService.js';
import { handleChatMessage } from '../services/chatbotService.js';
import { generateAgentDetails as generateDetailsWithAI } from '../services/agentDetailsService.js';

export const generateEmail = async (req, res, next) => {
    try {
        const { name, emailType, tone, context } = req.body;
        if (!emailType || !tone) return res.status(400).json({ success: false, error: 'emailType and tone are required' });

        const result = await generateEmailWithAI({ name: name || 'Email', emailType, tone, context });
        if (!result.success) return res.status(500).json({ success: false, error: result.error });

        res.json({ success: true, subject: result.subject, body: result.body });
    } catch (error) {
        next(error);
    }
};

export const generatePrompt = async (req, res, next) => {
    try {
        const { profile, documentText, systemPrompt } = req.body;
        if (!profile || !systemPrompt) return res.status(400).json({ success: false, error: 'profile and systemPrompt are required' });

        const result = await generatePromptFromProfile({ profile, documentText, systemPrompt });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const formatPrompt = async (req, res, next) => {
    try {
        const { rawPrompt, systemPrompt } = req.body;
        if (!rawPrompt || !systemPrompt) return res.status(400).json({ success: false, error: 'rawPrompt and systemPrompt are required' });

        const result = await formatRawPrompt({ rawPrompt, systemPrompt });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const generateAgentDetails = async (req, res, next) => {
    try {
        const { prompt, systemPrompt } = req.body;
        if (!prompt || !systemPrompt) return res.status(400).json({ success: false, error: 'prompt and systemPrompt are required' });

        const result = await generateDetailsWithAI({ prompt, systemPrompt });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const chatbot = async (req, res, next) => {
    try {
        const { message, history, systemPrompt } = req.body;
        if (!message || !systemPrompt) return res.status(400).json({ success: false, error: 'message and systemPrompt are required' });

        const result = await handleChatMessage({ message, history: history || [], systemPrompt });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const extractProfile = async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ success: false, error: 'text is required' });

        const result = await extractAgentProfile(text);
        res.json(result);
    } catch (error) {
        next(error);
    }
};
