import express from 'express';
import { createCallLog, getCallLogs } from './controllers/callLogs.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const router = express.Router();

// Rate limiting for public endpoints
const publicRateLimitMiddleware = createRateLimitMiddleware('call-logs', 30); // 30 requests per minute

/**
 * @route   POST /api/call-logs
 * @desc    Create a new call log (PUBLIC - no authentication required)
 * @access  Public
 * 
 * Request Body (JSON):
 * {
 *   "owner_user_id": "uuid" (required),
 *   "phone": "+1234567890" (required),
 *   "bot_id": "uuid" (optional),
 *   "scheduled_call_id": "uuid" (optional),
 *   "contact_id": "uuid" (optional),
 *   "name": "John Doe" (optional),
 *   "call_url": "https://..." (optional),
 *   "agent": "Agent Name" (optional),
 *   "call_type": "incoming" or "outgoing" (optional),
 *   "call_status": "completed", "missed", "voicemail" (optional),
 *   "transcript": "text content" (optional),
 *   "duration": 120.5 (optional, number),
 *   "error_message": "error text" (optional),
 *   "started_at": "2024-01-01T00:00:00Z" (optional, ISO timestamp),
 *   "ended_at": "2024-01-01T00:05:00Z" (optional, ISO timestamp)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "call_log": {
 *       "id": "...",
 *       "owner_user_id": "...",
 *       "phone": "...",
 *       ...
 *     }
 *   },
 *   "timestamp": "2024-..."
 * }
 */
router.post(
  '/',
  publicRateLimitMiddleware,
  sanitizeInputMiddleware,
  createCallLog
);

/**
 * @route   GET /api/call-logs?id=...&owner_user_id=...&phone=...&bot_id=...&scheduled_call_id=...&contact_id=...&call_status=...&call_type=...&started_after=...&started_before=...&created_after=...&created_before=...
 * @desc    Get call logs with various filters (PUBLIC - no authentication required)
 * @access  Public
 * 
 * Query Parameters (all optional, but at least one recommended for performance):
 * - id: UUID (optional) - Get specific call log by ID
 * - owner_user_id: UUID (optional) - Filter by owner user ID
 * - phone: string (optional) - Filter by phone number
 * - bot_id: UUID (optional) - Filter by bot ID
 * - scheduled_call_id: UUID (optional) - Filter by scheduled call ID
 * - contact_id: UUID (optional) - Filter by contact ID
 * - call_status: string (optional) - Filter by call status
 * - call_type: string (optional) - Filter by call type
 * - started_after: ISO timestamp (optional) - Filter calls started after this date
 * - started_before: ISO timestamp (optional) - Filter calls started before this date
 * - created_after: ISO timestamp (optional) - Filter logs created after this date
 * - created_before: ISO timestamp (optional) - Filter logs created before this date
 * 
 * Examples:
 * - GET /api/call-logs?id=uuid-here
 * - GET /api/call-logs?owner_user_id=uuid-here
 * - GET /api/call-logs?phone=+1234567890
 * - GET /api/call-logs?owner_user_id=uuid&call_status=completed&started_after=2024-01-01T00:00:00Z
 * 
 * Response (single result if id provided):
 * {
 *   "success": true,
 *   "data": {
 *     "call_log": {...}
 *   },
 *   "timestamp": "2024-..."
 * }
 * 
 * Response (multiple results):
 * {
 *   "success": true,
 *   "data": {
 *     "call_logs": [...],
 *     "count": 5
 *   },
 *   "timestamp": "2024-..."
 * }
 */
router.get(
  '/',
  publicRateLimitMiddleware,
  sanitizeInputMiddleware,
  getCallLogs
);

export default router;
