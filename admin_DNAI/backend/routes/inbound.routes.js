import express from 'express';
import { authenticate, loadUserProfile, requireRole } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import {
  // Inbound Numbers
  getAllInboundNumbers,
  getInboundNumberById,
  createInboundNumber,
  updateInboundNumber,
  deleteInboundNumber,
  // Call History
  getAllCallHistory,
  getCallHistoryById,
  getCallHistoryByNumberId,
  // Schedules
  getAllCallSchedules,
  getCallScheduleById,
  createCallSchedule,
  updateCallSchedule,
  deleteCallSchedule,
  // Analytics
  getAllInboundAnalytics,
  getInboundAnalyticsByNumberId,
  // Inbound Agents
  getAllInboundAgents,
  getInboundAgentById,
  createInboundAgent,
  updateInboundAgent,
  deleteInboundAgent,
  // Supporting
  getAvailableAgents,
  assignNumberToAgent,
  getInboundStatistics,
  // Middleware
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  // Packages
  getInboundPackages,
  // Settings
  getInboundSettings,
  updateInboundSettings
} from './controllers/inbound.controller.js';

const router = express.Router();

// =====================================================
// INBOUND NUMBERS ROUTES
// =====================================================

/**
 * @route   GET /api/inbound/numbers
 * @desc    Get all inbound numbers
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/numbers',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getAllInboundNumbers
);

/**
 * @route   GET /api/inbound/numbers/:id
 * @desc    Get inbound number by ID
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/numbers/:id',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getInboundNumberById
);

/**
 * @route   POST /api/inbound/numbers
 * @desc    Create new inbound number
 * @access  Private (genie.inbound.create)
 */
router.post(
  '/numbers',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.create'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  createInboundNumber
);

/**
 * @route   PATCH /api/inbound/numbers/:id
 * @desc    Update inbound number
 * @access  Private (genie.inbound.update)
 */
router.patch(
  '/numbers/:id',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.update'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  updateInboundNumber
);

/**
 * @route   DELETE /api/inbound/numbers/:id
 * @desc    Delete inbound number
 * @access  Private (genie.inbound.delete)
 */
router.delete(
  '/numbers/:id',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.delete'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  deleteInboundNumber
);

/**
 * @route   POST /api/inbound/numbers/:id/assign
 * @desc    Assign number to agent
 * @access  Private (genie.inbound.update)
 */
router.post(
  '/numbers/:id/assign',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.update'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  assignNumberToAgent
);


// =====================================================
// CALL HISTORY ROUTES
// =====================================================

/**
 * @route   GET /api/inbound/calls
 * @desc    Get all call history
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/calls',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getAllCallHistory
);

/**
 * @route   GET /api/inbound/calls/number/:numberId
 * @desc    Get call history by number ID
 * @access  Private (genie.inbound.view)
 * NOTE: Must be before /calls/:id to avoid route conflict
 */
router.get(
  '/calls/number/:numberId',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getCallHistoryByNumberId
);

/**
 * @route   GET /api/inbound/calls/:id
 * @desc    Get call history by ID
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/calls/:id',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getCallHistoryById
);

// =====================================================
// SCHEDULES ROUTES
// =====================================================

/**
 * @route   GET /api/inbound/schedules
 * @desc    Get all call schedules
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/schedules',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getAllCallSchedules
);

/**
 * @route   GET /api/inbound/schedules/:id
 * @desc    Get call schedule by ID
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/schedules/:id',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getCallScheduleById
);

/**
 * @route   POST /api/inbound/schedules
 * @desc    Create call schedule
 * @access  Private (genie.inbound.create)
 */
router.post(
  '/schedules',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.create'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  createCallSchedule
);

/**
 * @route   PUT /api/inbound/schedules/:id
 * @desc    Update call schedule
 * @access  Private (genie.inbound.update)
 */
router.put(
  '/schedules/:id',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.update'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  updateCallSchedule
);

/**
 * @route   DELETE /api/inbound/schedules/:id
 * @desc    Delete call schedule (soft delete)
 * @access  Private (genie.inbound.delete)
 */
router.delete(
  '/schedules/:id',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.delete'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  deleteCallSchedule
);

// =====================================================
// ANALYTICS ROUTES
// =====================================================

/**
 * @route   GET /api/inbound/analytics
 * @desc    Get all inbound analytics
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/analytics',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getAllInboundAnalytics
);

/**
 * @route   GET /api/inbound/analytics/number/:numberId
 * @desc    Get analytics by number ID
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/analytics/number/:numberId',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getInboundAnalyticsByNumberId
);

// =====================================================
// INBOUND AGENTS ROUTES
// =====================================================

/**
 * @route   GET /api/inbound/agents
 * @desc    Get all inbound agents
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/agents',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getAllInboundAgents
);

/**
 * @route   GET /api/inbound/agents/available
 * @desc    Get available agents for assignment (active only)
 * @access  Private (genie.inbound.view)
 * NOTE: Must be before /agents/:id to avoid route conflict
 */
router.get(
  '/agents/available',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getAvailableAgents
);

/**
 * @route   GET /api/inbound/agents/:id
 * @desc    Get inbound agent by ID
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/agents/:id',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getInboundAgentById
);

/**
 * @route   POST /api/inbound/agents
 * @desc    Create new inbound agent
 * @access  Private (genie.inbound.create)
 */
router.post(
  '/agents',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.create'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  createInboundAgent
);

/**
 * @route   PATCH /api/inbound/agents/:id
 * @desc    Update inbound agent
 * @access  Private (genie.inbound.update)
 */
router.patch(
  '/agents/:id',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.update'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  updateInboundAgent
);

/**
 * @route   DELETE /api/inbound/agents/:id
 * @desc    Delete inbound agent
 * @access  Private (genie.inbound.delete)
 */
router.delete(
  '/agents/:id',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.delete'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  deleteInboundAgent
);

/**
 * @route   GET /api/inbound/statistics
 * @desc    Get unified statistics for dashboard
 * @access  Private (genie.inbound.view)
 */
router.get(
  '/statistics',
  authenticate,
  loadUserProfile,
  requirePermission('genie.inbound.view'),
  rateLimitMiddleware,
  sanitizeInputMiddleware,
  getInboundStatistics
);


/**
 * @route   GET /api/inbound/packages/inbound
 * @desc    Get all inbound packages (admin, reseller, consumer)
 * @access  Private (Admin/Reseller/Consumer)
 */
router.get('/packages', authenticate, requireRole(['admin', 'reseller', 'consumer']), rateLimitMiddleware, sanitizeInputMiddleware, getInboundPackages);

/**
 * @route   GET /api/inbound/settings
 * @desc    Get inbound system settings
 * @access  Private (Admin only)
 */
router.get('/settings', authenticate, requireRole(['admin']), rateLimitMiddleware, sanitizeInputMiddleware, getInboundSettings);

/**
 * @route   PATCH /api/inbound/settings
 * @desc    Update inbound system settings
 * @access  Private (Admin only)
 */
router.patch('/settings', authenticate, requireRole(['admin']), rateLimitMiddleware, sanitizeInputMiddleware, updateInboundSettings);

export default router;
