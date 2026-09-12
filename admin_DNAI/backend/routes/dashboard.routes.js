import express from 'express';
import { authenticate, requireAdmin, requireRole } from '../middleware/auth.js';
import { getDashboardStats, getResellerStats } from './controllers/dashboard.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('dashboard', 100);

const router = express.Router();

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics (admin or support)
 * @access  Private (Admin or Support)
 */
router.get('/stats', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getDashboardStats);

/**
 * @route   GET /api/dashboard/reseller-stats
 * @desc    Get reseller business statistics (admin or support with resellers.view permission)
 * @access  Private (Admin or Support)
 */
router.get('/reseller-stats', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getResellerStats);

export default router;

