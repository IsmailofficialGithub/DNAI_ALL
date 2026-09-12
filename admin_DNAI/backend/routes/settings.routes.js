import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  getDefaultCommission,
  updateDefaultCommission,
  getResellerSettings,
  updateResellerSettings
} from './controllers/settings.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('settings', 100);

const router = express.Router();

/**
 * @route   GET /api/settings/default-commission
 * @desc    Get default reseller commission
 * @access  Private (Admin)
 */
router.get('/default-commission', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, getDefaultCommission);

/**
 * @route   PUT /api/settings/default-commission
 * @desc    Update default reseller commission
 * @access  Private (Admin)
 */
router.put('/default-commission', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, updateDefaultCommission);

/**
 * @route   GET /api/settings/reseller
 * @desc    Get all reseller settings
 * @access  Private (Admin)
 */
router.get('/reseller', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, getResellerSettings);

/**
 * @route   PUT /api/settings/reseller
 * @desc    Update all reseller settings
 * @access  Private (Admin)
 */
router.put('/reseller', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, updateResellerSettings);

export default router;

