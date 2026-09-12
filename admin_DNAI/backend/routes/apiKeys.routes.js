import express from 'express';
import { authenticate, loadUserProfile } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import {
  createApiKey,
  listApiKeys,
  getApiKeyById,
  updateApiKey,
  deleteApiKey,
  regenerateSecret
} from './controllers/apiKeys.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const router = express.Router();

// Rate limiting middleware
const rateLimitMiddleware = createRateLimitMiddleware('api-keys', 100);

/**
 * @route   POST /api/api-keys
 * @desc    Generate new API key and secret pair
 * @access  Private (Admin - api_keys.create permission)
 */
router.post(
  '/',
  authenticate,
  loadUserProfile,
  requirePermission('api_keys.create'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  createApiKey
);

/**
 * @route   GET /api/api-keys
 * @desc    List all API keys (with optional filters)
 * @access  Private (Admin - api_keys.view permission)
 */
router.get(
  '/',
  authenticate,
  loadUserProfile,
  requirePermission('api_keys.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  listApiKeys
);

/**
 * @route   GET /api/api-keys/:id
 * @desc    Get API key by ID
 * @access  Private (Admin - api_keys.view permission)
 */
router.get(
  '/:id',
  authenticate,
  loadUserProfile,
  requirePermission('api_keys.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getApiKeyById
);

/**
 * @route   PUT /api/api-keys/:id
 * @desc    Update API key (name and/or active status)
 * @access  Private (Admin - api_keys.update permission)
 */
router.put(
  '/:id',
  authenticate,
  loadUserProfile,
  requirePermission('api_keys.update'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  updateApiKey
);

/**
 * @route   DELETE /api/api-keys/:id
 * @desc    Delete API key
 * @access  Private (Admin - api_keys.delete permission)
 */
router.delete(
  '/:id',
  authenticate,
  loadUserProfile,
  requirePermission('api_keys.delete'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  deleteApiKey
);

/**
 * @route   POST /api/api-keys/:id/regenerate-secret
 * @desc    Regenerate API secret for existing key
 * @access  Private (Admin - api_keys.update permission)
 */
router.post(
  '/:id/regenerate-secret',
  authenticate,
  loadUserProfile,
  requirePermission('api_keys.update'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  regenerateSecret
);

export default router;
