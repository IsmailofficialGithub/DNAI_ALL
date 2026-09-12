import express from 'express';
import { authenticate, loadUserProfile } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { authenticateApiKey } from '../middleware/apiKeyAuth.js';
import {
  createN8nError,
  getN8nErrors,
  getN8nErrorById
} from './controllers/n8nErrors.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const router = express.Router();

// Rate limiting for public API key endpoint (more lenient)
const apiKeyRateLimitMiddleware = createRateLimitMiddleware('n8n-errors-api', 100);

// Rate limiting for admin endpoints
const adminRateLimitMiddleware = createRateLimitMiddleware('n8n-errors-admin', 100);

/**
 * @route   POST /api/n8n-errors
 * @desc    Create n8n error(s) from payload (accepts single object or array)
 * @access  Private (API Key Authentication)
 * 
 * Headers:
 * - X-API-Key: API key identifier
 * - X-API-Secret: API secret
 * 
 * Body: Single error object or array of error objects
 * {
 *   "execution": {
 *     "id": "231",
 *     "url": "https://n8n.example.com/execution/231",
 *     "retryOf": "34",
 *     "error": {
 *       "message": "Example Error Message",
 *       "stack": "Stacktrace"
 *     },
 *     "lastNodeExecuted": "Node With Error",
 *     "mode": "manual"
 *   },
 *   "workflow": {
 *     "id": "1",
 *     "name": "Example Workflow"
 *   }
 * }
 */
router.post(
  '/',
  authenticateApiKey,
  apiKeyRateLimitMiddleware,
  sanitizeInputMiddleware,
  createN8nError
);

/**
 * @route   GET /api/n8n-errors
 * @desc    List n8n errors with filtering and pagination
 * @access  Private (Admin - n8n_errors.view permission)
 * 
 * Query parameters:
 * - workflow_id: Filter by workflow ID
 * - execution_id: Filter by execution ID
 * - mode: Filter by execution mode
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - order_by: Field to order by (default: created_at)
 * - order: asc or desc (default: desc)
 */
router.get(
  '/',
  authenticate,
  loadUserProfile,
  requirePermission('n8n_errors.view'),
  adminRateLimitMiddleware,
  sanitizeInputMiddleware,
  getN8nErrors
);

/**
 * @route   GET /api/n8n-errors/:id
 * @desc    Get n8n error by ID
 * @access  Private (Admin - n8n_errors.view permission)
 */
router.get(
  '/:id',
  authenticate,
  loadUserProfile,
  requirePermission('n8n_errors.view'),
  adminRateLimitMiddleware,
  sanitizeInputMiddleware,
  getN8nErrorById
);

export default router;
