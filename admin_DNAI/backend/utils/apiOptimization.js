/**
 * Shared API Optimization Utilities
 * Reusable functions for all API endpoints
 */

import { cacheService } from '../config/redis.js';
import {
  sanitizeString,
  isValidEmail,
  isValidSearchTerm,
  isValidUUID,
  isValidPhone,
  validatePagination,
  sanitizeObject,
  sanitizeArray
} from './validation.js';

// Query timeout in milliseconds
export const QUERY_TIMEOUT = 10000; // 10 seconds

/**
 * Execute database query with timeout protection
 * @param {Promise} queryPromise - Database query promise
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} - Query result with timeout protection
 */
export const executeWithTimeout = async (queryPromise, timeout = QUERY_TIMEOUT) => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Query timeout')), timeout)
  );

  return Promise.race([queryPromise, timeoutPromise]);
};

/**
 * Create cache key with pagination and search
 * @param {string} baseKey - Base cache key
 * @param {string} search - Search term
 * @param {number} page - Page number
 * @param {number} limit - Limit per page
 * @returns {string} - Cache key
 */
export const createCacheKey = (baseKey, search = '', page = 1, limit = 50) => {
  const searchPart = search ? `:${search}` : '';
  return `${baseKey}${searchPart}_page${page}_limit${limit}`;
};

/**
 * Standard field selection for user-related queries
 */
export const USER_SELECT_FIELDS = [
  'user_id',
  'email',
  'full_name',
  'role',
  'phone',
  'country',
  'city',
  'account_status',
  'created_at',
  'updated_at'
].join(',');

/**
 * Standard field selection for consumer queries
 */
export const CONSUMER_SELECT_FIELDS = [
  'user_id',
  'email',
  'full_name',
  'nickname',
  'role',
  'phone',
  'country',
  'city',
  'account_status',
  'trial_expiry',
  'lifetime_access',
  'total_trial_days_used',
  'created_at',
  'updated_at'
].join(',');

/**
 * Standard field selection for reseller queries
 */
export const RESELLER_SELECT_FIELDS = [
  'user_id',
  'email',
  'full_name',
  'nickname',
  'role',
  'phone',
  'country',
  'city',
  'account_status',
  'referred_by',
  'created_at',
  'updated_at'
].join(',');

/**
 * Handle API errors with secure error messages
 * @param {Error} error - Error object
 * @param {Response} res - Express response
 * @param {string} defaultMessage - Default error message
 * @returns {Response} - Error response
 */
export const handleApiError = (error, res, defaultMessage = 'An error occurred while processing your request.') => {
  console.error('❌ API Error:', error);

  // Don't expose internal error details
  if (error.message?.includes('timeout') || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'Service is temporarily unavailable. Please try again later.'
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: defaultMessage
  });
};

/**
 * Validate and sanitize search input
 * @param {string} search - Search term
 * @param {number} maxLength - Maximum length
 * @returns {string|null} - Sanitized search term or null if invalid
 */
export const validateAndSanitizeSearch = (search, maxLength = 100) => {
  if (!search) return null;
  
  const sanitized = sanitizeString(search, maxLength);
  
  if (!isValidSearchTerm(sanitized)) {
    return null;
  }
  
  return sanitized;
};

/**
 * Create paginated response
 * @param {Array} data - Data array
 * @param {number} count - Total count
 * @param {number} page - Page number
 * @param {number} limit - Limit per page
 * @param {string} search - Search term
 * @returns {Object} - Paginated response
 */
export const createPaginatedResponse = (data, count, page, limit, search = null) => {
  return {
    success: true,
    count: data.length,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
    hasMore: (page * limit) < (count || 0),
    data: sanitizeArray(data),
    search: search || null
  };
};

/**
 * Rate limit middleware factory
 * Creates rate limit middleware for specific endpoint
 * @param {string} endpoint - Endpoint name for rate limit key
 * @param {number} maxRequests - Maximum requests per minute
 * @returns {Function} - Rate limit middleware
 */
export const createRateLimitMiddleware = (endpoint, maxRequests = 100) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.ip;
      const rateLimitKey = `rate_limit:${endpoint}:${userId}`;
      
      // Try to get current request count, but don't fail if Redis is unavailable
      let requests = 0;
      try {
        const cached = await cacheService.get(rateLimitKey);
        requests = cached || 0;
      } catch (getError) {
        // Redis unavailable - silently continue (fail open)
        // Don't log error here to avoid spam
      }
      
      if (requests >= maxRequests) {
        return res.status(429).json({
          success: false,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.'
        });
      }

      // Try to increment counter, but don't fail if Redis is unavailable
      try {
        await cacheService.set(rateLimitKey, requests + 1, 60); // 60 seconds TTL
      } catch (setError) {
        // Redis unavailable - silently continue (fail open)
        // Don't log error here to avoid spam
      }
      
      next();
    } catch (error) {
      // If rate limiting fails completely, allow request (fail open)
      // Don't log error to avoid spam when Redis is down
      next();
    }
  };
};

/**
 * Rate limit middleware factory with custom window
 * Creates rate limit middleware for specific endpoint with custom time window
 * @param {string} endpoint - Endpoint name for rate limit key
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Function} - Rate limit middleware
 */
export const createRateLimitMiddlewareWithWindow = (endpoint, maxRequests = 1, windowSeconds = 3) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.ip;
      const rateLimitKey = `rate_limit:${endpoint}:${userId}`;
      
      // Try to get current request count, but don't fail if Redis is unavailable
      let requests = 0;
      try {
        const cached = await cacheService.get(rateLimitKey);
        requests = cached || 0;
      } catch (getError) {
        // Redis unavailable - silently continue (fail open)
        // Don't log error here to avoid spam
      }
      
      if (requests >= maxRequests) {
        return res.status(429).json({
          success: false,
          error: 'Too Many Requests',
          message: `Please wait ${windowSeconds} seconds before creating another ticket.`
        });
      }

      // Try to increment counter, but don't fail if Redis is unavailable
      try {
        await cacheService.set(rateLimitKey, requests + 1, windowSeconds); // Custom window TTL
      } catch (setError) {
        // Redis unavailable - silently continue (fail open)
        // Don't log error here to avoid spam
      }
      
      next();
    } catch (error) {
      // If rate limiting fails completely, allow request (fail open)
      // Don't log error to avoid spam when Redis is down
      next();
    }
  };
};

/**
 * Input sanitization middleware
 * Sanitizes query and body parameters
 */
export const sanitizeInputMiddleware = (req, res, next) => {
  try {
    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = req.query[key].replace(/<[^>]*>/g, '').trim();
        }
      });
    }

    // Sanitize body parameters
    if (req.body && typeof req.body === 'object') {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          req.body[key] = req.body[key].replace(/<[^>]*>/g, '').trim();
        }
      });
    }

    next();
  } catch (error) {
    console.error('❌ Sanitization error:', error);
    next();
  }
};

