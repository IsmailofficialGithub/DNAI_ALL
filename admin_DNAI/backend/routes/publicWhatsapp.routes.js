import express from 'express';
import { authenticateApiKey } from '../middleware/apiKeyAuth.js';
import { sendWhatsAppMessage } from './controllers/publicWhatsapp.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const router = express.Router();

// Rate limiting for public endpoint (more restrictive)
const publicRateLimitMiddleware = createRateLimitMiddleware('public-whatsapp', 30); // 30 requests per minute

/**
 * @route   POST /api/public/whatsapp/send-message
 * @desc    Send WhatsApp message (PUBLIC - API key authentication required)
 * @access  Public (X-API-Key and X-API-Secret headers required)
 * 
 * Request Headers:
 * - X-API-Key: Your API key
 * - X-API-Secret: Your API secret
 * 
 * Request Body:
 * {
 *   "whatsapp_number": "+1234567890",  // The WhatsApp number to send from (must be connected)
 *   "recipient_number": "+0987654321", // Recipient phone number
 *   "message": "Hello from API"        // Message text
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "WhatsApp message sent successfully",
 *   "data": {
 *     "message_id": "...",
 *     "whatsapp_number": "+1234567890",
 *     "recipient_number": "+0987654321",
 *     "timestamp": "2025-01-20T..."
 *   },
 *   "timestamp": "2025-01-20T..."
 * }
 */
router.post(
  '/send-message',
  authenticateApiKey,
  publicRateLimitMiddleware,
  sanitizeInputMiddleware,
  sendWhatsAppMessage
);

export default router;
