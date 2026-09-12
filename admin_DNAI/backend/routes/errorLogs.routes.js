import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getErrorLogs, getErrorLogById, createErrorLog } from './controllers/errorLogs.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const router = express.Router();

const rateLimitMiddleware = createRateLimitMiddleware('error-logs', 100);

/**
 * @route   GET /api/error-logs
 * @desc    Get error logs with pagination and filtering (Admin only)
 * @access  Private (Admin only)
 */
router.get(
  '/',
  authenticate,
  requireAdmin,
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getErrorLogs
);

/**
 * @route   GET /api/error-logs/:id
 * @desc    Get error log by ID (Admin only)
 * @access  Private (Admin only)
 */
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getErrorLogById
);

/**
 * @route   POST /api/error-logs
 * @desc    Create error log (Public - for error reporting from frontend)
 * @access  Public (no auth required for error reporting)
 */
router.post(
  '/',
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  createErrorLog
);

export default router;
