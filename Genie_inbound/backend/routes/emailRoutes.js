import express from 'express';
import * as emailController from '../controllers/emailController.js';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

const emailLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 429, error: 'Too many emails sent' }
});

router.post('/send-email', emailLimiter, emailController.sendEmail);
router.post('/send-email-custom', emailLimiter, emailController.sendEmailCustom);
router.post('/send-system-email', emailLimiter, emailController.sendSystemEmail);
router.post('/send-agent-email', emailLimiter, emailController.sendAgentEmail);
router.post('/email', emailLimiter, emailController.sendEmailLegacy);
router.post('/send-grid-email', emailLimiter, emailController.sendGridEmail);

export default router;
