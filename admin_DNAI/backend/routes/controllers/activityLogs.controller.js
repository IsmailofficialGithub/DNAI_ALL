import { supabaseAdmin } from '../../config/database.js';
import { cacheService } from '../../config/redis.js';
import {
  isValidUUID,
  validatePagination,
  sanitizeString,
  sanitizeArray,
  sanitizeObject
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError,
  createPaginatedResponse,
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';

// Cache configuration
const CACHE_TTL = 180; // 3 minutes
const CACHE_KEYS = {
  ACTIVITY_LOGS: (filters, page, limit) => `activity_logs:${JSON.stringify(filters)}_page${page}_limit${limit}`,
  ACTIVITY_LOG_BY_ID: (id) => `activity_logs:id:${id}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('activity_logs', 100);

/**
 * Activity Logs Controller
 * Handles activity log retrieval and filtering
 */

/**
 * Get all activity logs with filters (admin only)
 * @route   GET /api/activity-logs?action_type=create&actor_id=xxx&target_id=xxx&page=1&limit=50
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Pagination support (Performance)
 * 3. Query timeout (Performance)
 * 4. Batch profile fetching (Performance)
 * 5. Redis caching (Performance)
 * 6. Secure error handling (Security)
 * 7. Data sanitization (Security)
 */
export const getActivityLogs = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { 
      action_type, 
      actor_id, 
      target_id, 
      actor_role,
      table_name,
      page, 
      limit,
      start_date,
      end_date
    } = req.query;

    // Validate pagination
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // Validate UUIDs if provided
    if (actor_id && !isValidUUID(actor_id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid actor_id format'
      });
    }

    if (target_id && !isValidUUID(target_id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid target_id format'
      });
    }

    // Sanitize string inputs
    action_type = action_type ? sanitizeString(action_type, 50) : null;
    actor_role = actor_role ? sanitizeString(actor_role, 50) : null;
    table_name = table_name ? sanitizeString(table_name, 100) : null;

    // Build cache key
    const filters = { action_type, actor_id, target_id, actor_role, table_name, start_date, end_date };
    const cacheKey = CACHE_KEYS.ACTIVITY_LOGS(filters, pageNum, limitNum);

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for activity logs');
      return res.json(cachedData);
    }

    console.log('❌ Cache MISS for activity logs - fetching from database');

    // ========================================
    // 3. BUILD QUERY (with timeout)
    // ========================================
    let query = supabaseAdmin
      .from('activity_logs')
      .select('id, actor_id, actor_role, target_id, action_type, table_name, changed_fields, ip_address, user_agent, created_at', { count: 'exact' });

    // Apply filters
    if (action_type) query = query.eq('action_type', action_type);
    if (actor_id) query = query.eq('actor_id', actor_id);
    if (target_id) query = query.eq('target_id', target_id);
    if (actor_role) query = query.eq('actor_role', actor_role);
    if (table_name) query = query.eq('table_name', table_name);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data: logs, error, count } = await executeWithTimeout(query);

    if (error) {
      console.error('❌ Error fetching activity logs:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch activity logs. Please try again.'
      });
    }

    // ========================================
    // 4. BATCH FETCH ACTOR AND TARGET NAMES (with timeout)
    // ========================================
    const actorIds = Array.from(new Set((logs || []).map(log => log.actor_id).filter(Boolean)));
    const targetIds = Array.from(new Set((logs || []).map(log => log.target_id).filter(Boolean)));
    const allUserIds = Array.from(new Set([...actorIds, ...targetIds]));

    let profileMap = new Map();
    if (allUserIds.length > 0) {
      const profilesPromise = supabaseAdmin
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allUserIds);

      const { data: profiles } = await executeWithTimeout(profilesPromise, 3000);
      
      (profiles || []).forEach(profile => {
        profileMap.set(profile.user_id, profile.full_name);
      });
    }

    // ========================================
    // 5. ENRICH LOGS WITH NAMES
    // ========================================
    const logsWithNames = (logs || []).map(log => ({
      ...log,
      actor_name: log.actor_id ? profileMap.get(log.actor_id) || null : null,
      target_name: log.target_id ? profileMap.get(log.target_id) || null : null
    }));

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedLogs = sanitizeArray(logsWithNames);

    // ========================================
    // 7. BUILD RESPONSE
    // ========================================
    const response = createPaginatedResponse(sanitizedLogs, count || 0, pageNum, limitNum);

    // ========================================
    // 8. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching activity logs.');
  }
};

/**
 * Get activity log by ID (admin only)
 * @route   GET /api/activity-logs/:id
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Redis caching (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getActivityLogById = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid activity log ID format'
      });
    }

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.ACTIVITY_LOG_BY_ID(id);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for activity log ${id}`);
      return res.json(cachedData);
    }

    // ========================================
    // 3. FETCH ACTIVITY LOG (with timeout)
    // ========================================
    const logPromise = supabaseAdmin
      .from('activity_logs')
      .select('id, actor_id, actor_role, target_id, action_type, table_name, changed_fields, ip_address, user_agent, created_at')
      .eq('id', id)
      .single();

    const { data: log, error } = await executeWithTimeout(logPromise);

    if (error || !log) {
      console.error('❌ Error fetching activity log:', error);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Activity log not found'
      });
    }

    // ========================================
    // 4. FETCH ACTOR AND TARGET NAMES (with timeout)
    // ========================================
    const userIds = [log.actor_id, log.target_id].filter(Boolean);
    let profileMap = new Map();

    if (userIds.length > 0) {
      const profilesPromise = supabaseAdmin
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const { data: profiles } = await executeWithTimeout(profilesPromise, 3000);
      
      (profiles || []).forEach(profile => {
        profileMap.set(profile.user_id, profile.full_name);
      });
    }

    // ========================================
    // 5. ENRICH LOG WITH NAMES
    // ========================================
    const enrichedLog = {
      ...log,
      actor_name: log.actor_id ? profileMap.get(log.actor_id) || null : null,
      target_name: log.target_id ? profileMap.get(log.target_id) || null : null
    };

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedLog = sanitizeObject(enrichedLog);

    // ========================================
    // 7. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      data: sanitizedLog
    };

    // ========================================
    // 8. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the activity log.');
  }
};

