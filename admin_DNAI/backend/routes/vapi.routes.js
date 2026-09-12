import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getAllVapiAccounts,
  rateLimitMiddleware,
  sanitizeInputMiddleware
} from './controllers/vapi.controller.js';

const router = express.Router();

/**
 * @route   GET /api/vapi/accounts
 * @desc    Get all VAPI accounts (admin, reseller)
 * @access  Private (Admin/Reseller)
 */
router.get('/accounts', authenticate, requireRole(['admin', 'reseller']), rateLimitMiddleware, sanitizeInputMiddleware, getAllVapiAccounts);

export default router;

