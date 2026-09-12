import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getProductDetail,
  getProductDashboard,
  getProductUsers,
  getProductTables,
  getTableDetails
} from './controllers/productDetail.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('product-detail', 100);

const router = express.Router();

/**
 * @route   GET /api/admin/products/:id
 * @desc    Get product detail with database info (admin or support with products.view permission)
 * @access  Private (Admin or Support)
 */
router.get('/:id', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getProductDetail);

/**
 * @route   GET /api/admin/products/:id/dashboard
 * @desc    Get product dashboard data (admin or support with products.view permission)
 * @access  Private (Admin or Support)
 */
router.get('/:id/dashboard', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getProductDashboard);

/**
 * @route   GET /api/admin/products/:id/users
 * @desc    Get product users (admin or support with products.view permission)
 * @access  Private (Admin or Support)
 */
router.get('/:id/users', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getProductUsers);

/**
 * @route   GET /api/admin/products/:id/tables
 * @desc    Get all tables in product database (admin or support with products.view permission)
 * @access  Private (Admin or Support)
 */
router.get('/:id/tables', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getProductTables);

/**
 * @route   GET /api/admin/products/:id/tables/:tableName
 * @desc    Get table details (admin or support with products.view permission)
 * @access  Private (Admin or Support)
 */
router.get('/:id/tables/:tableName', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getTableDetails);

export default router;

