import express from 'express';
import { getActivityLogs, getActivityLogById } from './controllers/activityLogs.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('activity-logs', 100);

const router = express.Router();

// @route GET /api/activity-logs
// @desc  Get all activity logs with filters (admin or support with activity_logs.view permission)
// @access Private (Admin or Support)
router.get('/', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getActivityLogs);

// @route GET /api/activity-logs/:id
// @desc  Get activity log by ID (admin or support with activity_logs.view permission)
// @access Private (Admin or Support)
router.get('/:id', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getActivityLogById);

export default router;

