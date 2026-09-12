import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  getAllProductDatabases,
  getProductDatabase,
  upsertProductDatabase,
  deleteProductDatabase,
  testProductDatabaseConnection,
  testCredentialsBeforeSave
} from './controllers/productDatabase.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('product-database', 100);

const router = express.Router();

/**
 * @route   GET /api/admin/product-databases
 * @desc    Get all product database configurations (admin only)
 * @access  Private (Admin)
 */
router.get('/', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, getAllProductDatabases);

/**
 * @route   GET /api/admin/product-databases/:productId
 * @desc    Get product database configuration by product ID (admin only)
 * @access  Private (Admin)
 */
router.get('/:productId', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, getProductDatabase);

/**
 * @route   POST /api/admin/product-databases/test-credentials
 * @desc    Test credentials before saving (admin only)
 * @access  Private (Admin)
 */
router.post('/test-credentials', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, testCredentialsBeforeSave);

/**
 * @route   POST /api/admin/product-databases
 * @desc    Create product database configuration (admin only)
 * @access  Private (Admin)
 */
router.post('/', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, upsertProductDatabase);

/**
 * @route   PUT /api/admin/product-databases/:productId
 * @desc    Update product database configuration (admin only)
 * @access  Private (Admin)
 */
router.put('/:productId', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, upsertProductDatabase);

/**
 * @route   DELETE /api/admin/product-databases/:productId
 * @desc    Delete product database configuration (admin only)
 * @access  Private (Admin)
 */
router.delete('/:productId', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, deleteProductDatabase);

/**
 * @route   POST /api/admin/product-databases/:productId/test
 * @desc    Test product database connection (admin only)
 * @access  Private (Admin)
 */
router.post('/:productId/test', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, testProductDatabaseConnection);

export default router;

