import express from 'express';
import { authenticate, requireAdmin, requireRole } from '../middleware/auth.js';
import {
  getAllPackages,
  getPackagesByProduct,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  getPackageFeatures,
  createPackageFeature,
  updatePackageFeature,
  deletePackageFeature,
  getPackageVariables,
  createPackageVariable,
  updatePackageVariable,
  deletePackageVariable,
  rateLimitMiddleware,
  sanitizeInputMiddleware
} from './controllers/packages.controller.js';

const router = express.Router();

/**
 * @route   GET /api/packages
 * @desc    Get all packages (admin, reseller, consumer, support)
 * @access  Private (Admin/Reseller/Consumer/Support)
 */
router.get('/', authenticate, requireRole(['admin','reseller','consumer','support']), rateLimitMiddleware, sanitizeInputMiddleware, getAllPackages);

/**
 * @route   GET /api/packages/product/:productId
 * @desc    Get packages by product ID (admin, reseller, consumer, support)
 * @access  Private (Admin/Reseller/Consumer/Support)
 */
router.get('/product/:productId', authenticate, requireRole(['admin','reseller','consumer','support']), rateLimitMiddleware, sanitizeInputMiddleware, getPackagesByProduct);

/**
 * @route   GET /api/packages/:id
 * @desc    Get package by ID (admin, reseller, consumer, support)
 * @access  Private (Admin/Reseller/Consumer/Support)
 */
router.get('/:id', authenticate, requireRole(['admin','reseller','consumer','support']), rateLimitMiddleware, sanitizeInputMiddleware, getPackageById);

/**
 * @route   POST /api/packages
 * @desc    Create new package (admin only)
 * @access  Private (Admin)
 */
router.post('/', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, createPackage);

/**
 * @route   PUT /api/packages/:id
 * @desc    Update package (admin only)
 * @access  Private (Admin)
 */
router.put('/:id', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, updatePackage);

/**
 * @route   DELETE /api/packages/:id
 * @desc    Delete package (admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, deletePackage);

/**
 * Package Features Routes
 */
router.get('/:id/features', authenticate, requireRole(['admin','reseller','consumer','support']), rateLimitMiddleware, getPackageFeatures);
router.post('/:id/features', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, createPackageFeature);
router.put('/:id/features/:featureId', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, updatePackageFeature);
router.delete('/:id/features/:featureId', authenticate, requireAdmin, rateLimitMiddleware, deletePackageFeature);

/**
 * Package Variables Routes
 */
router.get('/:id/variables', authenticate, requireRole(['admin','reseller','consumer','support']), rateLimitMiddleware, getPackageVariables);
router.post('/:id/variables', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, createPackageVariable);
router.put('/:id/variables/:variableId', authenticate, requireAdmin, rateLimitMiddleware, sanitizeInputMiddleware, updatePackageVariable);
router.delete('/:id/variables/:variableId', authenticate, requireAdmin, rateLimitMiddleware, deletePackageVariable);

export default router;

