import express from 'express';
import { sendPublicEmail } from './controllers/publicMail.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const router = express.Router();

// Rate limiting for public mail endpoint
const publicMailRateLimitMiddleware = createRateLimitMiddleware('public-mail', 20); // 20 requests per minute

/**
 * @route   POST /api/public/mail
 * @desc    Send email via API (PUBLIC - API key authentication required)
 * @access  Public
 * 
 * Request Body (JSON):
 * {
 *   "to": "recipient@example.com" (required),
 *   "from": "sender@example.com" (required),
 *   "subject": "Email subject" (required),
 *   "html": "<html>Email HTML content</html>" (required),
 *   "api_key": "your-api-key" (required - must match MAIL_API_KEY in .env)
 * }
 * 
 * Response (Success):
 * {
 *   "success": true,
 *   "message": "Email sent successfully",
 *   "data": {
 *     "to": "recipient@example.com",
 *     "from": "sender@example.com",
 *     "subject": "Email subject"
 *   },
 *   "timestamp": "2024-..."
 * }
 * 
 * Response (Error):
 * {
 *   "success": false,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Error message",
 *     "timestamp": "2024-..."
 *   }
 * }
 */
router.post(
  '/',
  publicMailRateLimitMiddleware,
  sanitizeInputMiddleware,
  sendPublicEmail
);

export default router;

