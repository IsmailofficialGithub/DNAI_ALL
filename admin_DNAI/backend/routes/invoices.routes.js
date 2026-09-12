import express from 'express';
import { authenticate, requireRole, loadUserProfile } from '../middleware/auth.js';
import { checkInvoiceAccess } from '../middleware/invoiceAccess.js';
import {
  getConsumerProductsForInvoice,
  getConsumerPackagesForInvoice,
  getAllInvoices,
  getInvoiceById,
  getMyInvoices,
  createInvoice,
  getConsumerInvoices,
  resendInvoice,
  downloadInvoicePDF
} from './controllers/invoices.controller.js';
import {
  submitPayment,
  getInvoicePayments,
  reviewPayment,
  upload
} from './controllers/invoice_payments.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const rateLimitMiddleware = createRateLimitMiddleware('invoices', 100);

const router = express.Router();

/**
 * @route   GET /api/invoices/consumer/:consumerId/products
 * @desc    Get consumer's accessed products with prices for invoice creation
 * @access  Private (Admin or Reseller)
 */
router.get(
  '/consumer/:consumerId/products',
  (req, res, next) => {
    console.log('📥 Invoice route hit:', req.method, req.path);
    console.log('📥 Params:', req.params);
    next();
  },
  authenticate,
  requireRole(['admin', 'reseller']),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getConsumerProductsForInvoice
);

/**
 * @route   GET /api/invoices/consumer/:consumerId/packages
 * @desc    Get consumer's accessed packages with prices for invoice creation
 * @access  Private (Admin or Reseller)
 */
router.get(
  '/consumer/:consumerId/packages',
  authenticate,
  requireRole(['admin', 'reseller']),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getConsumerPackagesForInvoice
);

/**
 * @route   GET /api/invoices
 * @desc    Get all invoices (admin or support)
 * @access  Private (Admin or Support)
 */
router.get(
  '/',
  authenticate,
  requireRole(['admin', 'support']),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getAllInvoices
);

// Alias to support /api/invoices/invoices (some clients expect this path)
router.get(
  '/invoices',
  authenticate,
  requireRole(['admin', 'support']),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getAllInvoices
);

/**
 * @route   GET /api/invoices/my-invoices
 * @desc    Get invoices for reseller's referred consumers
 * @access  Private (Reseller)
 */
router.get(
  '/my-invoices',
  authenticate,
  requireRole(['reseller']),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getMyInvoices
);

/**
 * @route   GET /api/invoices/consumer/:consumerId
 * @desc    Get invoices for a specific consumer
 * @access  Private (Admin, Reseller, or Support)
 */
router.get(
  '/consumer/:consumerId',
  authenticate,
  requireRole(['admin', 'reseller', 'support']),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getConsumerInvoices
);

/**
 * @route   GET /api/invoices/:id
 * @desc    Get a single invoice by ID
 * @access  Private (Admin, Support, Reseller, Consumer)
 */
router.get(
  '/:id',
  authenticate,
  loadUserProfile,
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getInvoiceById
);

/**
 * @route   POST /api/invoices
 * @desc    Create invoice with invoice items
 * @access  Private (Admin or Reseller)
 */
router.post(
  '/',
  authenticate,
  requireRole(['admin', 'reseller']),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  createInvoice
);

/**
 * @route   POST /api/invoices/:id/resend
 * @desc    Resend invoice email (admin only)
 * @access  Private (Admin)
 */
router.post(
  '/:id/resend',
  authenticate,
  requireRole(['admin']),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  resendInvoice
);

/**
 * @route   GET /api/invoices/:id/download-pdf
 * @desc    Download invoice as PDF
 * @access  Private (Admin, Reseller, Consumer)
 */
router.get(
  '/:id/download-pdf',
  authenticate,
  loadUserProfile,
  checkInvoiceAccess,
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  downloadInvoicePDF
);

/**
 * @route   POST /api/invoices/:id/payments
 * @desc    Submit payment for an invoice
 * @access  Private (Admin, Reseller, Consumer)
 */
router.post(
  '/:id/payments',
  authenticate,
  loadUserProfile,
  rateLimitMiddleware,
  upload.single('proof'), // Handle file upload (must come after rate limit, before sanitize)
  sanitizeInputMiddleware,
  submitPayment
);

/**
 * @route   GET /api/invoices/:id/payments
 * @desc    Get payments for an invoice
 * @access  Private (Admin, Reseller, Consumer)
 */
router.get(
  '/:id/payments',
  authenticate,
  loadUserProfile,
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getInvoicePayments
);

/**
 * @route   PATCH /api/invoices/payments/:paymentId
 * @desc    Approve or reject a payment (admin only)
 * @access  Private (Admin)
 */
router.patch(
  '/payments/:paymentId',
  authenticate,
  requireRole(['admin']),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  reviewPayment
);

export default router;

