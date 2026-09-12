import { supabaseAdmin } from '../../config/database.js';
import { cacheService } from '../../config/redis.js';
import {
  executeWithTimeout,
  handleApiError,
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';
import { hasRole } from '../../utils/roleUtils.js';

// Cache configuration
const CACHE_TTL = 600; // 10 minutes (increased for better cache hit rate)
const RESELLER_CACHE_TTL = 300; // 5 minutes for reseller stats
const CACHE_KEYS = {
  DASHBOARD_STATS: 'dashboard:stats',
  RESELLER_STATS: (month, year, status, limit) => `dashboard:reseller-stats:${month}_${year}_${status}_${limit}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('dashboard', 50); // Lower limit for dashboard

/**
 * Dashboard Controller
 * Handles dashboard statistics and analytics
 */

/**
 * Get dashboard statistics (admin only)
 * @route   GET /api/dashboard/stats
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Redis caching (Performance)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const getDashboardStats = async (req, res) => {
  try {
    const userRole = req.userProfile?.role;

    // Only admin or support can access dashboard stats
    if (!hasRole(userRole, 'admin') && !hasRole(userRole, 'support')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin or Support access required'
      });
    }

    // ========================================
    // 1. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.DASHBOARD_STATS;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for dashboard stats');
      return res.json(cachedData);
    }

    console.log('❌ Cache MISS for dashboard stats - fetching from database');

    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // ========================================
    // 2. SINGLE DATABASE CALL - All stats in one optimized RPC function
    // ========================================
    const { data: statsData, error } = await executeWithTimeout(
      supabaseAdmin.rpc('get_dashboard_stats', {
        start_of_month_param: startOfMonth.toISOString()
      }),
      3000 // Reduced timeout since it's much faster now
    );

    if (error) {
      console.error('❌ Error calling get_dashboard_stats RPC:', error);
      throw error;
    }

    // Prepare response with data from RPC function
    const stats = {
      totalUsers: statsData?.totalUsers || 0,
      totalConsumers: statsData?.totalConsumers || 0,
      activeConsumers: statsData?.activeConsumers || 0,
      expiredConsumers: statsData?.expiredConsumers || 0,
      totalResellers: statsData?.totalResellers || 0,
      newUsersThisMonth: statsData?.newUsersThisMonth || 0,
      activeSubscriptions: statsData?.activeSubscriptions || 0,
      totalRevenue: parseFloat(statsData?.totalRevenue || 0),
      revenueThisMonth: parseFloat(statsData?.revenueThisMonth || 0),
      totalInvoices: statsData?.totalInvoices || 0,
      paidInvoices: statsData?.paidInvoices || 0,
      unpaidInvoices: statsData?.unpaidInvoices || 0,
      totalProducts: statsData?.totalProducts || 0,
      serverStatus: 'online'
    };

    const response = {
      success: true,
      data: stats
    };

    // ========================================
    // 3. CACHE THE RESPONSE (10 minutes)
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching dashboard statistics.');
  }
};

/**
 * Get reseller business statistics (admin or support)
 * @route   GET /api/dashboard/reseller-stats
 * @access  Private (Admin or Support)
 * 
 * OPTIMIZATIONS:
 * 1. Redis caching (Performance)
 * 2. Single RPC function call with JOIN (Performance)
 * 3. Query timeout (Performance)
 * 4. Secure error handling (Security)
 */
export const getResellerStats = async (req, res) => {
  try {
    const userRole = req.userProfile?.role;

    // Only admin or support can access reseller stats
    if (!hasRole(userRole, 'admin') && !hasRole(userRole, 'support')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin or Support access required'
      });
    }

    const { month, year, status, limit = 10 } = req.query;
    
    // ========================================
    // 1. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.RESELLER_STATS(month, year, status, limit);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for reseller stats');
      return res.json(cachedData);
    }

    console.log('❌ Cache MISS for reseller stats - fetching from database');

    // ========================================
    // 2. VALIDATE AND PREPARE PARAMETERS
    // ========================================
    // Default to current month if not specified
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth(); // month is 0-indexed
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    
    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
    const invoiceStatus = status || 'paid';
    const resultLimit = Math.min(parseInt(limit) || 10, 100); // Max 100

    // ========================================
    // 3. SINGLE DATABASE CALL with JOIN - No N+1 queries
    // ========================================
    const { data: rpcData, error } = await executeWithTimeout(
      supabaseAdmin.rpc('get_reseller_stats', {
        start_date: startOfMonth.toISOString(),
        end_date: endOfMonth.toISOString(),
        invoice_status: invoiceStatus,
        result_limit: resultLimit
      }),
      3000 // Reduced timeout since it's much faster now
    );

    if (error) {
      console.error('❌ Error calling get_reseller_stats RPC:', error);
      throw error;
    }

    // ========================================
    // 4. PREPARE RESPONSE
    // ========================================
    const response = {
      success: true,
      data: {
        stats: rpcData?.stats || [],
        summary: {
          ...(rpcData?.summary || {}),
          month: targetMonth + 1,
          year: targetYear,
          status: invoiceStatus
        }
      }
    };

    // ========================================
    // 5. CACHE THE RESPONSE (5 minutes)
    // ========================================
    await cacheService.set(cacheKey, response, RESELLER_CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching reseller statistics.');
  }
};

