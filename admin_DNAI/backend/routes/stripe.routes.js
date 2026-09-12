import express from 'express';
import {
  createPaymentIntent,
  confirmPayment,
} from './controllers/stripe.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('stripe', 200); // Higher limit for payment endpoints

const router = express.Router();

/**
 * @route   POST /api/stripe/create-payment-intent
 * @desc    Create Stripe payment intent
 * @access  Public (requires encrypted data)
 */
router.post('/create-payment-intent', rateLimitMiddleware, sanitizeInputMiddleware, createPaymentIntent);

/**
 * @route   POST /api/stripe/confirm-payment
 * @desc    Confirm payment and update invoice
 * @access  Public
 */
router.post('/confirm-payment', rateLimitMiddleware, sanitizeInputMiddleware, confirmPayment);

export default router;

