import express from 'express';
import * as aiController from '../controllers/aiController.js';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        error: 'Our AI assistant is currently unavailable. Please try again later or contact support if you need help.'
    }
});

// Paths matching frontend calls
router.post('/ai/generate-email', aiLimiter, aiController.generateEmail);
router.post('/ai/generate-prompt', aiLimiter, aiController.generatePrompt);
router.post('/ai/format-prompt', aiLimiter, aiController.formatPrompt);
router.post('/ai/generate-agent-details', aiLimiter, aiController.generateAgentDetails);
router.post('/ai/chatbot', aiLimiter, aiController.chatbot);

// This one doesn't have the /ai prefix in frontend service
router.post('/extract-profile', aiLimiter, aiController.extractProfile);

export default router;
