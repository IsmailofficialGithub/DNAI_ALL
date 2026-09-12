import express from 'express';
import * as paymentController from '../controllers/paymentController.js';

const router = express.Router();

// Checkout Session (Frontend calls this)
router.post('/payments/create-session', paymentController.createCheckoutSession);

// Intent for Inline Elements
router.post('/payments/create-intent', paymentController.createPaymentIntent);

// Status Check (Frontend calls this after redirect)
router.get('/payments/verify/:sessionId', paymentController.verifySession);

// Confirm Payment (called by frontend after success)
router.post('/payments/confirm', paymentController.confirmPayment);

// Webhook (Stripe calls this)
router.post('/payments/webhook', paymentController.handleWebhook);

export default router;
