import express from 'express';
import { authenticate, requireAdmin, requireRole } from '../middleware/auth.js';
import {
  getAllResellers,
  getResellerById,
  createReseller,
  updateReseller,
  deleteReseller,
  resetResellerPassword,
  getMyConsumers,
  createMyConsumer,
  updateMyConsumer,
  deleteMyConsumer,
  resetMyConsumerPassword,
  createConsumerAdmin,
  getReferredConsumers,
  updateResellerAccountStatus,
  getAllReferredResellers,
  getMyResellers,
  getMyResellerById,
  createMyReseller,
  updateMyReseller,
  deleteMyReseller,
  rateLimitMiddleware,
  sanitizeInputMiddleware
} from './controllers/resellers.controller.js';
import {
  getMyCommission,
  getResellerCommission,
  setResellerCommission,
  resetResellerCommission,
  
} from './controllers/settings.controller.js';

const router = express.Router();

/**
 * @route   GET /api/resellers
 * @desc    Get all resellers (admin or support with resellers.view permission)
 * @access  Private (Admin or Support)
 */
router.get('/', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getAllResellers);

/**
 * ==========================================
 * RESELLER'S OWN CONSUMERS MANAGEMENT ROUTES
 * (Must come BEFORE /:id routes)
 * ==========================================
 */

/**
 * @route   GET /api/resellers/my-commission
 * @desc    Get reseller's own commission (effective commission)
 * @access  Private (Reseller) - Must come before /:id routes
 */
router.get('/my-commission', authenticate, requireRole(['reseller']), getMyCommission);

/**
 * @route   GET /api/resellers/my-consumers
 * @desc    Get all consumers created by the logged-in reseller
 * @access  Private (Reseller)
 */
router.get('/my-consumers', authenticate, requireRole(['reseller']), getMyConsumers);

/**
 * @route   POST /api/resellers/my-consumers
 * @desc    Create new consumer (referred by reseller)
 * @access  Private (Reseller)
 */
router.post('/my-consumers', authenticate, createMyConsumer);

/**
 * @route   PUT /api/resellers/my-consumers/:id
 * @desc    Update consumer created by reseller
 * @access  Private (Reseller)
 */
router.put('/my-consumers/:id', authenticate, updateMyConsumer);

/**
 * @route   DELETE /api/resellers/my-consumers/:id
 * @desc    Delete consumer created by reseller
 * @access  Private (Reseller)
 */
router.delete('/my-consumers/:id', authenticate, deleteMyConsumer);

/**
 * @route   POST /api/resellers/my-consumers/:id/reset-password
 * @desc    Reset password for consumer created by reseller
 * @access  Private (Reseller)
 */
router.post('/my-consumers/:id/reset-password', authenticate, resetMyConsumerPassword);

/**
 * @route   POST /api/resellers/create-consumer
 * @desc    Create new consumer (admin only)
 * @access  Private (Admin)
 */
router.post('/create-consumer', authenticate, requireAdmin, createConsumerAdmin);

/**
 * ==========================================
 * RESELLER MANAGEMENT ROUTES
 * ==========================================
 */

/**
 * @route   GET /api/resellers/referred-resellers
 * @desc    Get all referred resellers (reseller role and admin only)
 * @access  Private (Reseller and Admin)
 */
router.get('/referred-resellers', authenticate, getAllReferredResellers);

/**
 * ==========================================
 * RESELLER'S OWN RESELLERS MANAGEMENT ROUTES
 * ==========================================
 */

/**
 * @route   GET /api/resellers/my-resellers
 * @desc    Get all resellers created by the logged-in reseller
 * @access  Private (Reseller)
 */
router.get('/my-resellers', authenticate, requireRole(['reseller']), getMyResellers);

/**
 * @route   POST /api/resellers/my-resellers
 * @desc    Create new reseller (reseller can create other resellers)
 * @access  Private (Reseller)
 */
router.post('/my-resellers', authenticate, requireRole(['reseller']), createMyReseller);

/**
 * @route   GET /api/resellers/my-resellers/:id
 * @desc    Get reseller by ID (reseller can only see their own resellers)
 * @access  Private (Reseller)
 */
router.get('/my-resellers/:id', authenticate, requireRole(['reseller']), getMyResellerById);

/**
 * @route   PUT /api/resellers/my-resellers/:id
 * @desc    Update reseller created by reseller
 * @access  Private (Reseller)
 */
router.put('/my-resellers/:id', authenticate, requireRole(['reseller']), updateMyReseller);

/**
 * @route   DELETE /api/resellers/my-resellers/:id
 * @desc    Delete reseller created by reseller
 * @access  Private (Reseller)
 */
router.delete('/my-resellers/:id', authenticate, requireRole(['reseller']), deleteMyReseller);

/**
 * @route   GET /api/resellers/:id/referred-consumers
 * @desc    Get all consumers referred by a specific user/reseller (admin only)
 * @access  Private (Admin)
 */
router.get('/:id/referred-consumers', authenticate, requireAdmin, getReferredConsumers);

/**
 * @route   GET /api/resellers/:id
 * @desc    Get reseller by ID (admin or support with resellers.view permission)
 * @access  Private (Admin or Support)
 */
router.get('/:id', authenticate, requireRole(['admin', 'support']), getResellerById);

/**
 * @route   POST /api/resellers
 * @desc    Create new reseller (admin only)
 * @access  Private (Admin)
 */
router.post('/', authenticate, requireAdmin, createReseller);

/**
 * @route   PUT /api/resellers/:id
 * @desc    Update reseller (admin only)
 * @access  Private (Admin)
 */
router.put('/:id', authenticate, requireAdmin, updateReseller);

/**
 * @route   DELETE /api/resellers/:id
 * @desc    Delete reseller (admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, requireAdmin, deleteReseller);

/**
 * @route   POST /api/resellers/:id/reset-password
 * @desc    Reset reseller password (admin only)
 * @access  Private (Admin)
 */
router.post('/:id/reset-password', authenticate, requireAdmin, resetResellerPassword);

/**
 * @route   PATCH /api/resellers/:id/account-status
 * @desc    Update reseller account status (admin only)
 * @access  Private (Admin)
 */
router.patch('/:id/account-status', authenticate, requireAdmin, updateResellerAccountStatus);

/**
 * ==========================================
 * COMMISSION MANAGEMENT ROUTES
 * ==========================================
 */

/**
 * @route   GET /api/resellers/:id/commission
 * @desc    Get reseller commission (effective commission)
 * @access  Private (Admin)
 */
router.get('/:id/commission', authenticate, requireAdmin, getResellerCommission);

/**
 * @route   PUT /api/resellers/:id/commission
 * @desc    Set custom commission for reseller
 * @access  Private (Admin)
 */
router.put('/:id/commission', authenticate, requireAdmin, setResellerCommission);

/**
 * @route   DELETE /api/resellers/:id/commission
 * @desc    Reset reseller commission to default
 * @access  Private (Admin)
 */
router.delete('/:id/commission', authenticate, requireAdmin, resetResellerCommission);

export default router;
