import express from 'express';
import { authenticate, loadUserProfile } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import {
  createWhatsAppApplication,
  getWhatsAppApplications,
  getWhatsAppApplication,
  updateWhatsAppApplication,
  deleteWhatsAppApplication,
  connectWhatsAppApplication,
  disconnectWhatsAppApplication,
  reconnectWhatsAppApplication,
  getQRCode,
  sendWhatsAppMessage
} from './controllers/whatsapp.controller.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../utils/apiOptimization.js';

const router = express.Router();

// Rate limiting middleware
const rateLimitMiddleware = createRateLimitMiddleware('whatsapp', 100);

/**
 * @route   POST /api/whatsapp/applications
 * @desc    Create new WhatsApp application
 * @access  Private (Admin - whatsapp.create permission)
 */
router.post(
  '/applications',
  authenticate,
  loadUserProfile,
  requirePermission('whatsapp.create'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  createWhatsAppApplication
);

/**
 * @route   GET /api/whatsapp/applications
 * @desc    List all WhatsApp applications
 * @access  Private (Admin - whatsapp.view permission)
 */
router.get(
  '/applications',
  authenticate,
  loadUserProfile,
  requirePermission('whatsapp.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getWhatsAppApplications
);

/**
 * @route   GET /api/whatsapp/applications/:id
 * @desc    Get WhatsApp application by ID
 * @access  Private (Admin - whatsapp.view permission)
 */
router.get(
  '/applications/:id',
  authenticate,
  loadUserProfile,
  requirePermission('whatsapp.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getWhatsAppApplication
);

/**
 * @route   PUT /api/whatsapp/applications/:id
 * @desc    Update WhatsApp application
 * @access  Private (Admin - whatsapp.update permission)
 */
router.put(
  '/applications/:id',
  authenticate,
  loadUserProfile,
  requirePermission('whatsapp.update'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  updateWhatsAppApplication
);

/**
 * @route   DELETE /api/whatsapp/applications/:id
 * @desc    Delete WhatsApp application
 * @access  Private (Admin - whatsapp.delete permission)
 */
router.delete(
  '/applications/:id',
  authenticate,
  loadUserProfile,
  requirePermission('whatsapp.delete'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  deleteWhatsAppApplication
);

/**
 * @route   POST /api/whatsapp/applications/:id/connect
 * @desc    Initiate WhatsApp connection (generate QR)
 * @access  Private (Admin - whatsapp.update permission)
 */
router.post(
  '/applications/:id/connect',
  authenticate,
  loadUserProfile,
  requirePermission('whatsapp.update'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  connectWhatsAppApplication
);

/**
 * @route   POST /api/whatsapp/applications/:id/disconnect
 * @desc    Disconnect WhatsApp application
 * @access  Private (Admin - whatsapp.update permission)
 */
router.post(
  '/applications/:id/disconnect',
  authenticate,
  loadUserProfile,
  requirePermission('whatsapp.update'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  disconnectWhatsAppApplication
);

/**
 * @route   POST /api/whatsapp/applications/:id/reconnect
 * @desc    Reconnect WhatsApp application (clear session, generate new QR)
 * @access  Private (Admin - whatsapp.update permission)
 */
router.post(
  '/applications/:id/reconnect',
  authenticate,
  loadUserProfile,
  requirePermission('whatsapp.update'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  reconnectWhatsAppApplication
);

/**
 * @route   GET /api/whatsapp/applications/:id/qr
 * @desc    Get QR code for WhatsApp application
 * @access  Private (Admin - whatsapp.view permission)
 */
router.get(
  '/applications/:id/qr',
  authenticate,
  loadUserProfile,
  requirePermission('whatsapp.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getQRCode
);

/**
 * @route   POST /api/whatsapp/send
 * @desc    Send WhatsApp message
 * @access  Private (Admin - whatsapp.send permission)
 */
router.post(
  '/send',
  authenticate,
  loadUserProfile,
  requirePermission('whatsapp.send'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  sendWhatsAppMessage
);

export default router;
