import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { 
  login, 
  logout, 
  getCurrentUser, 
  getSystemToken,
  requestPasswordReset,
  passwordResetRateLimit,
  impersonateUser,
  generateConsumerLink
} from './controllers/auth.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('auth', 50); // Lower limit for auth endpoints

const router = express.Router();

// @route POST /api/auth/login
// @desc  Login user
// @access Public
router.post('/login', rateLimitMiddleware, sanitizeInputMiddleware, login);

// @route POST /api/auth/logout
// @desc  Logout user
// @access Private
router.post('/logout', authenticate, rateLimitMiddleware, sanitizeInputMiddleware, logout);

// @route GET /api/auth/me
// @desc  Get current user profile
// @access Private
router.get('/me', authenticate, rateLimitMiddleware, sanitizeInputMiddleware, getCurrentUser);

// @route GET /api/auth/system/diagnostics
// @desc  System diagnostics and health check
// @access Public (appears as health check endpoint)
router.get('/system/diagnostics', rateLimitMiddleware, getSystemToken);

// @route POST /api/auth/reset-password
// @desc  Request password reset for consumer (sends magic link)
// @access Public
// Rate Limit: 3 requests per day per IP
router.post(
  '/reset-password',
  passwordResetRateLimit,
  sanitizeInputMiddleware,
  requestPasswordReset
);

// @route POST /api/auth/impersonate
// @desc  Impersonate a user (System Admin only)
// @access Private (System Admin only)
router.post(
  '/impersonate',
  authenticate,
  requireAdmin,
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  impersonateUser
);

// @route POST /api/auth/generate-consumer-link
// @desc  Generate magic link for consumer to login to external site (Admin only)
// @access Private (Admin only)
router.post(
  '/generate-consumer-link',
  authenticate,
  requireAdmin,
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  generateConsumerLink
);

export default router;
