import express from 'express';
import { authenticate, requireAdmin, requireRole } from '../middleware/auth.js';
import {
  inviteUser,
  inviteReseller,
  validateInviteToken,
  signupWithInvite
} from './controllers/invitations.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('invitations', 100);

const router = express.Router();

/**
 * @route   POST /api/invitations/invite
 * @desc    Invite user/reseller/consumer (admin only)
 * @access  Private (Admin)
 */
router.post('/invite', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, inviteUser);

/**
 * @route   POST /api/invitations/invite-reseller
 * @desc    Invite reseller (reseller can invite other resellers)
 * @access  Private (Reseller)
 */
router.post('/invite-reseller', authenticate, requireRole(['reseller']), rateLimitMiddleware, sanitizeInputMiddleware, inviteReseller);

/**
 * @route   GET /api/invitations/validate/:token
 * @desc    Validate invitation token
 * @access  Public
 */
router.get('/validate/:token', rateLimitMiddleware, sanitizeInputMiddleware, validateInviteToken);

/**
 * @route   POST /api/invitations/signup
 * @desc    Sign up using invitation token
 * @access  Public
 */
router.post('/signup', rateLimitMiddleware, sanitizeInputMiddleware, signupWithInvite);

export default router;










