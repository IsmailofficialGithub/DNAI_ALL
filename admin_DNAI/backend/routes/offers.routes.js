import express from 'express';
import {
  getAllOffers,
  getOfferById,
  createOffer,
  updateOffer,
  deleteOffer,
  getActiveOffer
} from './controllers/offers.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('offers', 100);

const router = express.Router();

/**
 * @route   GET /api/offers
 * @desc    Get all offers with pagination and filters
 * @access  Private (Admin, Reseller, or Support) - Read-only for resellers and support
 */
router.get('/', authenticate, requireRole(['admin', 'reseller', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getAllOffers);

/**
 * @route   GET /api/offers/active/:date?
 * @desc    Get active offer for a specific date (or current date)
 * @access  Private (Admin, Reseller, or Support)
 */
router.get('/active/:date?', authenticate, requireRole(['admin', 'reseller', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getActiveOffer);

/**
 * @route   GET /api/offers/:id
 * @desc    Get a single offer by ID
 * @access  Private (Admin or Support)
 */
router.get('/:id', authenticate, requireRole(['admin', 'support']), rateLimitMiddleware, sanitizeInputMiddleware, getOfferById);

/**
 * @route   POST /api/offers
 * @desc    Create a new offer
 * @access  Private (Admin)
 */
router.post('/', authenticate, requireRole(['admin']), rateLimitMiddleware, sanitizeInputMiddleware, createOffer);

/**
 * @route   PUT /api/offers/:id
 * @desc    Update an offer
 * @access  Private (Admin)
 */
router.put('/:id', authenticate, requireRole(['admin']), rateLimitMiddleware, sanitizeInputMiddleware, updateOffer);

/**
 * @route   DELETE /api/offers/:id
 * @desc    Delete an offer
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, requireRole(['admin']), rateLimitMiddleware, sanitizeInputMiddleware, deleteOffer);

export default router;

