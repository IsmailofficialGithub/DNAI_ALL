import express from 'express';
import { authenticate, requireAdmin, requireRole } from '../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../middleware/permissions.js';
import {
  getAllConsumers,
  getConsumerById,
  updateConsumer,
  deleteConsumer,
  resetConsumerPassword,
  updateConsumerAccountStatus,
  grantLifetimeAccess,
  revokeLifetimeAccess,
  reassignConsumerToReseller,
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getConsumerProductSettings,
  updateConsumerProductSettings
} from './controllers/consumers.controller.js';

const router = express.Router();

/**
 * @route   GET /api/consumers
 * @desc    Get all consumers (admin or support with consumers.view permission)
 * @access  Private (Admin or Support)
 */
router.get('/', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getAllConsumers);

/**
 * @route   GET /api/consumers/:id
 * @desc    Get consumer by ID
 * @access  Private (Admin or Support)
 */
router.get('/:id', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getConsumerById);

/**
 * @route   PUT /api/consumers/:id
 * @desc    Update consumer (admin or support with consumers.update permission)
 * @access  Private (Admin or Support)
 */
router.put('/:id', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, updateConsumer);

/**
 * @route   DELETE /api/consumers/:id
 * @desc    Delete consumer (admin only, requires consumers.delete permission)
 * @access  Private (Admin with consumers.delete permission)
 */
router.delete('/:id', authenticate, requireAdmin, requirePermission('consumers.delete'), rateLimitMiddleware, sanitizeInputMiddleware, deleteConsumer);

/**
 * @route   POST /api/consumers/:id/reset-password
 * @desc    Reset consumer password (admin only)
 * @access  Private (Admin)
 */
router.post('/:id/reset-password', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, resetConsumerPassword);

/**
 * @route   PATCH /api/consumers/:id/account-status
 * @desc    Update consumer account status (admin only)
 * @access  Private (Admin with consumers.update permission)
 */
router.patch('/:id/account-status', authenticate, requireAdmin, requirePermission('consumers.update'), rateLimitMiddleware, sanitizeInputMiddleware, updateConsumerAccountStatus);

/**
 * @route   POST /api/consumers/:id/grant-lifetime-access
 * @desc    Grant lifetime access to consumer (admin only, requires consumers.grant_lifetime_access permission)
 * @access  Private (Admin with consumers.grant_lifetime_access or consumers.manage_lifetime_access permission)
 */
router.post('/:id/grant-lifetime-access', authenticate, requireAdmin, requireAnyPermission(['consumers.grant_lifetime_access', 'consumers.manage_lifetime_access']), rateLimitMiddleware, sanitizeInputMiddleware, grantLifetimeAccess);

/**
 * @route   POST /api/consumers/:id/revoke-lifetime-access
 * @desc    Revoke lifetime access from consumer (admin only, requires consumers.revoke_lifetime_access permission)
 * @access  Private (Admin with consumers.revoke_lifetime_access or consumers.manage_lifetime_access permission)
 */
router.post('/:id/revoke-lifetime-access', authenticate, requireAdmin, requireAnyPermission(['consumers.revoke_lifetime_access', 'consumers.manage_lifetime_access']), rateLimitMiddleware, sanitizeInputMiddleware, revokeLifetimeAccess);

/**
 * @route   POST /api/consumers/:id/reassign
 * @desc    Reassign consumer to a different reseller (admin only, requires consumers.reassign permission)
 * @access  Private (Admin with consumers.reassign permission)
 */
router.post('/:id/reassign', authenticate, requireAdmin, requirePermission('consumers.reassign'), rateLimitMiddleware, sanitizeInputMiddleware, reassignConsumerToReseller);

router.get('/:id/product-settings', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, getConsumerProductSettings);

/**
 * @route   PATCH /api/consumers/:id/product-settings
 * @desc    Update consumer product settings (admin only)
 * @access  Private (Admin)
 */
router.patch('/:id/product-settings', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, updateConsumerProductSettings);

// =====================================================
// CREDIT MANAGEMENT ROUTES
// =====================================================
import {
  getUserCredits,
  updateUserCredits,
  getBillingPackages,
  createUserSubscription
} from './controllers/credits.controller.js';

router.get('/:userId/credits', authenticate, requireAdmin, getUserCredits);
router.put('/:userId/credits', authenticate, requireAdmin, updateUserCredits);
router.get('/products/:productId/packages', authenticate, requireAdmin, getBillingPackages);
router.post('/:userId/subscriptions', authenticate, requireAdmin, createUserSubscription);

export default router;
