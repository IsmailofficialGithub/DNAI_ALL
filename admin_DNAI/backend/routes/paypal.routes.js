import express from 'express';
import {
  createPayPalOrder,
  capturePayPalPayment,
} from './controllers/paypal.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('paypal', 200); // Higher limit for payment endpoints

const router = express.Router();

/**
 * @route   POST /api/paypal/create-order
 * @desc    Create PayPal order
 * @access  Public (requires encrypted data)
 */
router.post('/create-order', rateLimitMiddleware, sanitizeInputMiddleware, createPayPalOrder);

/**
 * @route   POST /api/paypal/capture-payment
 * @desc    Capture PayPal payment
 * @access  Public
 */
router.post('/capture-payment', rateLimitMiddleware, sanitizeInputMiddleware, capturePayPalPayment);

export default router;

