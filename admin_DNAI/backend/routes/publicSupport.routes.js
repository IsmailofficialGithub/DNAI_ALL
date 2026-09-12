import express from 'express';
import multer from 'multer';
import { createPublicTicket, getPublicTickets, uploadPublicFile, deletePublicFile, getPublicFileUrl, addPublicMessage, upload } from './controllers/publicSupport.controller.js';
import {
  createRateLimitMiddleware,
  createRateLimitMiddlewareWithWindow,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const router = express.Router();

// Custom rate limit for ticket creation: 1 request per 3 seconds
const ticketCreateRateLimit = createRateLimitMiddlewareWithWindow('public-support-create', 1, 3);
// More lenient rate limiting for other public endpoints
const publicRateLimitMiddleware = createRateLimitMiddleware('public-support', 20); // 20 requests per minute

/**
 * @route   POST /api/public/customer-support/tickets
 * @desc    Create a new support ticket (PUBLIC - no authentication required)
 * @access  Public
 * 
 * Supports both JSON and multipart/form-data (for file uploads)
 * 
 * Request Body (JSON):
 * {
 *   "subject": "Ticket subject",
 *   "message": "Ticket message",
 *   "email": "user@example.com",
 *   "name": "User Name" (optional),
 *   "category": "technical" (optional),
 *   "priority": "medium" (optional: low, medium, high, urgent),
 *   "api_key": "your-api-key" (optional: to identify source website),
 *   "source_url": "https://yourwebsite.com" (optional),
 *   "metadata": {} (optional: additional data)
 * }
 * 
 * Request Body (multipart/form-data):
 * - subject: string (required)
 * - message: string (required)
 * - email: string (required)
 * - name: string (optional)
 * - category: string (optional)
 * - priority: string (optional)
 * - files: File[] (optional, max 5 files, 10MB each)
 */
router.post(
  '/tickets', 
  ticketCreateRateLimit,
  upload.array('files', 5), // Handle up to 5 files
  sanitizeInputMiddleware, 
  createPublicTicket
);

/**
 * @route   GET /api/public/customer-support/tickets?email=user@example.com&ticket_number=TICKET-123
 * @desc    Get tickets by email (PUBLIC - no authentication required)
 * @access  Public
 * 
 * Query Parameters:
 * - email: string (required) - Email address used to create tickets
 * - ticket_number: string (optional) - Get specific ticket by ticket number
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "tickets": [...] or "ticket": {...}
 *   },
 *   "timestamp": "2024-..."
 * }
 */
router.get(
  '/tickets',
  publicRateLimitMiddleware,
  sanitizeInputMiddleware,
  getPublicTickets
);

/**
 * @route   POST /api/public/customer-support/upload
 * @desc    Upload file to bucket and get URL (PUBLIC - for widget)
 * @access  Public
 * 
 * Request Body (multipart/form-data):
 * - file: File (required, max 10MB)
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "file_url": "https://...",
 *     "file_path": "...",
 *     "file_name": "...",
 *     "file_size": 12345,
 *     "file_type": "image/png"
 *   }
 * }
 */
router.post(
  '/upload',
  publicRateLimitMiddleware,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        // Handle multer errors
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: {
                code: 'FILE_TOO_LARGE',
                message: 'File size exceeds the 10MB limit. Please choose a smaller file.',
                timestamp: new Date().toISOString()
              }
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              error: {
                code: 'TOO_MANY_FILES',
                message: 'Maximum 5 files allowed per upload.',
                timestamp: new Date().toISOString()
              }
            });
          }
          return res.status(400).json({
            success: false,
            error: {
              code: 'UPLOAD_ERROR',
              message: err.message || 'File upload failed. Please try again.',
              timestamp: new Date().toISOString()
            }
          });
        }
        
        // Handle file filter errors (invalid file type)
        if (err.message && err.message.includes('Invalid file type')) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_FILE_TYPE',
              message: err.message.replace('Invalid file type: ', '').split('.')[0] + '. Allowed: images (including SVG), PDF, Word, Excel, text files.',
              timestamp: new Date().toISOString()
            }
          });
        }
        
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message || 'File upload failed. Please try again.',
            timestamp: new Date().toISOString()
          }
        });
      }
      next();
    });
  },
  sanitizeInputMiddleware,
  uploadPublicFile
);

/**
 * @route   GET /api/public/customer-support/upload?file_path=...
 * @desc    Get fresh file URL (refresh signed URL if needed)
 * @access  Public
 * 
 * Query Parameters:
 * - file_path: string (required) - Path to the file in storage
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "file_url": "https://...",
 *     "file_path": "..."
 *   }
 * }
 */
router.get(
  '/upload',
  publicRateLimitMiddleware,
  sanitizeInputMiddleware,
  getPublicFileUrl
);

/**
 * @route   DELETE /api/public/customer-support/upload
 * @desc    Delete file from bucket (PUBLIC - for widget)
 * @access  Public
 * 
 * Request Body (JSON):
 * {
 *   "file_path": "public-support/temp/ticket/filename.jpg"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "message": "File deleted successfully",
 *     "file_path": "..."
 *   }
 * }
 */
router.delete(
  '/upload',
  publicRateLimitMiddleware,
  sanitizeInputMiddleware,
  deletePublicFile
);

/**
 * @route   POST /api/public/customer-support/tickets/:ticketId/messages
 * @desc    Add message to ticket (PUBLIC - no authentication required)
 * @access  Public
 * 
 * Request Body (JSON):
 * {
 *   "email": "user@example.com" (required - must match ticket owner),
 *   "message": "Message text" (required, 3-5000 characters),
 *   "attachments": [] (optional)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "message": {
 *       "id": "...",
 *       "ticket_id": "...",
 *       "message": "...",
 *       "message_type": "user",
 *       "sender_name": "...",
 *       "sender_email": "...",
 *       "created_at": "..."
 *     }
 *   },
 *   "message": "Message sent successfully"
 * }
 */
router.post(
  '/tickets/:ticketId/messages',
  publicRateLimitMiddleware,
  sanitizeInputMiddleware,
  addPublicMessage
);

export default router;
