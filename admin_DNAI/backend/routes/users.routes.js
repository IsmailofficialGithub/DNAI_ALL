import express from 'express';
import { authenticate, requireAdmin, requireRole } from '../middleware/auth.js';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  createReseller,
  updateUserAccountStatus,
  searchAllUsers,
  rateLimitMiddleware,
  sanitizeInputMiddleware
} from './controllers/users.controller.js';

const router = express.Router();

/**
 * @route   GET /api/users/search
 * @desc    Search all users by email/name (for ticket creation - returns all users regardless of role)
 * @access  Private (Authenticated users)
 * NOTE: This must come before /:id route to avoid route conflict
 */
router.get('/search', authenticate, rateLimitMiddleware, sanitizeInputMiddleware, searchAllUsers);

/**
 * @route   GET /api/users
 * @desc    Get all users (admin or support)
 * @access  Private (Admin or Support)
 */
router.get('/', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin or Support)
 */
router.get('/:id', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getUserById);

/**
 * @route   POST /api/users
 * @desc    Create new user (admin only)
 * @access  Private (Admin)
 */
router.post('/', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, createUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user (admin or support)
 * @access  Private (Admin or Support)
 */
router.put('/:id', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, deleteUser);

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Reset user password (admin only)
 * @access  Private (Admin)
 */
router.post('/:id/reset-password', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, resetUserPassword);

/**
 * @route   POST /api/users/create-reseller
 * @desc    Create reseller (admin only)
 * @access  Private (Admin)
 */
router.post('/create-reseller', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, createReseller);

/**
 * @route   PATCH /api/users/:id/account-status
 * @desc    Update user account status (admin only)
 * @access  Private (Admin)
 */
router.patch('/:id/account-status', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, updateUserAccountStatus);

export default router;
