import { supabase, supabaseAdmin } from '../../config/database.js';
import productDbManager from '../../services/productDatabaseManager.js';
import { cacheService } from '../../config/redis.js';
import {
  isValidUUID,
  validatePagination,
  sanitizeString,
  sanitizeObject,
  sanitizeArray
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError,
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_KEYS = {
  PRODUCT_DETAIL: (id) => `product_detail:${id}`,
  PRODUCT_DASHBOARD: (id) => `product_dashboard:${id}`,
  PRODUCT_USERS: (id) => `product_users:${id}`,
  PRODUCT_TABLES: (id) => `product_tables:${id}`,
  TABLE_DETAILS: (productId, tableName) => `table_details:${productId}_${tableName}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('product_detail', 100);

/**
 * Get product detail with database info
 * @route   GET /api/admin/products/:id
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Redis caching (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getProductDetail = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid product ID format'
      });
    }

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.PRODUCT_DETAIL(id);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for product detail ${id}`);
      return res.json(cachedData);
    }

    // ========================================
    // 3. GET PRODUCT INFO (with timeout)
    // ========================================
    const productPromise = supabase
      .from('products')
      .select('id, name, description, price, is_active, created_at, updated_at')
      .eq('id', id)
      .single();

    const { data: product, error: productError } = await executeWithTimeout(productPromise);

    if (productError || !product) {
      console.error('❌ Error fetching product:', productError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product not found'
      });
    }

    // ========================================
    // 4. GET PRODUCT DATABASE CONFIG (with timeout)
    // ========================================
    let dbConfig = null;
    let healthStatus = null;
    
    try {
      const dbPromise = supabase
        .from('product_databases')
        .select('id, product_name, db_type, is_active, health_status, last_health_check')
        .eq('product_id', id)
        .single();

      const { data: dbData } = await executeWithTimeout(dbPromise, 3000);

      if (dbData) {
        dbConfig = {
          id: dbData.id,
          product_name: dbData.product_name,
          db_type: dbData.db_type,
          is_active: dbData.is_active,
          health_status: dbData.health_status,
          last_health_check: dbData.last_health_check
        };

        // Perform health check (with timeout)
        try {
          healthStatus = await executeWithTimeout(
            productDbManager.healthCheck(id),
            5000
          );
        } catch (healthError) {
          console.warn('⚠️ Health check failed:', healthError?.message);
          healthStatus = { status: 'error', message: healthError?.message };
        }
      }
    } catch (dbError) {
      // Product database not configured yet
      console.log('Product database not configured:', dbError?.message);
    }

    // ========================================
    // 5. DATA SANITIZATION
    // ========================================
    const sanitizedProduct = sanitizeObject(product);
    const sanitizedDbConfig = dbConfig ? sanitizeObject(dbConfig) : null;

    // ========================================
    // 6. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      data: {
        product: sanitizedProduct,
        database: sanitizedDbConfig,
        health: healthStatus
      }
    };

    // ========================================
    // 7. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the product detail.');
  }
};

/**
 * Get product dashboard data
 * @route   GET /api/admin/products/:id/dashboard
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Redis caching (Performance)
 * 4. Secure error handling (Security)
 */
export const getProductDashboard = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid product ID format'
      });
    }

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.PRODUCT_DASHBOARD(id);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for product dashboard ${id}`);
      return res.json(cachedData);
    }

    // ========================================
    // 3. CHECK PRODUCT DATABASE CONFIG (with timeout)
    // ========================================
    const dbConfigPromise = supabase
      .from('product_databases')
      .select('id, product_name, db_type, is_active')
      .eq('product_id', id)
      .single();

    const { data: dbConfig, error: dbError } = await executeWithTimeout(dbConfigPromise, 3000);

    if (dbError || !dbConfig) {
      console.error('❌ Error fetching database config:', dbError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product database not configured'
      });
    }

    // ========================================
    // 4. GET STATS AND HEALTH (with timeout, parallel)
    // ========================================
    const [stats, health] = await Promise.all([
      executeWithTimeout(productDbManager.getProductStats(id), 5000).catch(err => {
        console.warn('⚠️ Failed to get product stats:', err?.message);
        return null;
      }),
      executeWithTimeout(productDbManager.healthCheck(id), 5000).catch(err => {
        console.warn('⚠️ Health check failed:', err?.message);
        return { status: 'error', message: err?.message };
      })
    ]);

    // ========================================
    // 5. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      data: {
        productId: id,
        productName: dbConfig.product_name,
        stats,
        health
      }
    };

    // ========================================
    // 6. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the product dashboard.');
  }
};

/**
 * Get product users
 * @route   GET /api/admin/products/:id/users?page=1&limit=50
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format, pagination)
 * 2. Query timeout (Performance)
 * 3. Redis caching (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getProductUsers = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;
    const { page, limit, ...filters } = req.query;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid product ID format'
      });
    }

    // Validate pagination
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.PRODUCT_USERS(id);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for product users ${id}`);
      return res.json(cachedData);
    }

    // ========================================
    // 3. CHECK PRODUCT DATABASE CONFIG (with timeout)
    // ========================================
    const dbConfigPromise = supabase
      .from('product_databases')
      .select('id, product_name')
      .eq('product_id', id)
      .single();

    const { data: dbConfig, error: dbError } = await executeWithTimeout(dbConfigPromise, 3000);

    if (dbError || !dbConfig) {
      console.error('❌ Error fetching database config:', dbError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product database not configured'
      });
    }

    // ========================================
    // 4. GET PRODUCT USERS (with timeout)
    // ========================================
    const users = await executeWithTimeout(
      productDbManager.getProductUsers(id, filters),
      10000
    ).catch(err => {
      console.error('❌ Error getting product users:', err);
      return [];
    });

    // ========================================
    // 5. APPLY PAGINATION
    // ========================================
    const paginatedUsers = Array.isArray(users) ? users.slice(offset, offset + limitNum) : [];

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedUsers = sanitizeArray(paginatedUsers);

    // ========================================
    // 7. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      data: sanitizedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Array.isArray(users) ? users.length : 0,
        totalPages: Math.ceil((Array.isArray(users) ? users.length : 0) / limitNum)
      }
    };

    // ========================================
    // 8. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching product users.');
  }
};

/**
 * Get all tables in product database
 * @route   GET /api/admin/products/:id/tables
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Redis caching (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getProductTables = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid product ID format'
      });
    }

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.PRODUCT_TABLES(id);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for product tables ${id}`);
      return res.json(cachedData);
    }

    // ========================================
    // 3. CHECK PRODUCT DATABASE CONFIG (with timeout)
    // ========================================
    const dbConfigPromise = supabase
      .from('product_databases')
      .select('id, product_name')
      .eq('product_id', id)
      .single();

    const { data: dbConfig, error: dbError } = await executeWithTimeout(dbConfigPromise, 3000);

    if (dbError || !dbConfig) {
      console.error('❌ Error fetching database config:', dbError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product database not configured'
      });
    }

    // ========================================
    // 4. GET PRODUCT TABLES (with timeout)
    // ========================================
    const tables = await executeWithTimeout(
      productDbManager.getProductTables(id),
      10000
    ).catch(err => {
      console.error('❌ Error getting product tables:', err);
      return [];
    });

    // ========================================
    // 5. DATA SANITIZATION
    // ========================================
    const sanitizedTables = sanitizeArray(Array.isArray(tables) ? tables : []);

    // ========================================
    // 6. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      data: sanitizedTables
    };

    // ========================================
    // 7. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching product tables.');
  }
};

/**
 * Get table details
 * @route   GET /api/admin/products/:id/tables/:tableName
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format, table name)
 * 2. Query timeout (Performance)
 * 3. Redis caching (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getTableDetails = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { id, tableName } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid product ID format'
      });
    }

    if (!tableName || typeof tableName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Table name is required'
      });
    }

    // Sanitize table name (prevent SQL injection)
    const sanitizedTableName = sanitizeString(tableName, 100);

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.TABLE_DETAILS(id, sanitizedTableName);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for table details ${id}/${sanitizedTableName}`);
      return res.json(cachedData);
    }

    // ========================================
    // 3. CHECK PRODUCT DATABASE CONFIG (with timeout)
    // ========================================
    const dbConfigPromise = supabase
      .from('product_databases')
      .select('id, product_name')
      .eq('product_id', id)
      .single();

    const { data: dbConfig, error: dbError } = await executeWithTimeout(dbConfigPromise, 3000);

    if (dbError || !dbConfig) {
      console.error('❌ Error fetching database config:', dbError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product database not configured'
      });
    }

    // ========================================
    // 4. GET TABLE DETAILS (with timeout)
    // ========================================
    const tableDetails = await executeWithTimeout(
      productDbManager.getTableDetails(id, sanitizedTableName),
      10000
    ).catch(err => {
      console.error('❌ Error getting table details:', err);
      return null;
    });

    if (!tableDetails) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Table not found or error fetching details'
      });
    }

    // ========================================
    // 5. DATA SANITIZATION
    // ========================================
    const sanitizedDetails = sanitizeObject(tableDetails);

    // ========================================
    // 6. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      data: sanitizedDetails
    };

    // ========================================
    // 7. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching table details.');
  }
};

