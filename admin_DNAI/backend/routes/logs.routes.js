import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireSystemAdmin } from '../middleware/permissions.js';
import { getApiLogs } from './controllers/logs.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const router = express.Router();

const rateLimitMiddleware = createRateLimitMiddleware('logs', 50);

/**
 * @route   GET /api/logs
 * @desc    Get API logs with pagination and filtering (Superadmin only)
 * @access  Private (Superadmin only)
 */
router.get(
  '/',
  authenticate,
  requireSystemAdmin,
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getApiLogs
);

export default router;

