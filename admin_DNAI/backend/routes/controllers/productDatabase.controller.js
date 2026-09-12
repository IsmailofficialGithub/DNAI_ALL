import { supabase, supabaseAdmin } from '../../config/database.js';
import productDbManager from '../../services/productDatabaseManager.js';
import { getActorInfo, logActivity, getClientIp, getUserAgent } from '../../services/activityLogger.js';
import { cacheService } from '../../config/redis.js';
import {
  isValidUUID,
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
  ALL_PRODUCT_DATABASES: 'product_databases:all',
  PRODUCT_DATABASE: (productId) => `product_database:${productId}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('product_database', 50);

/**
 * Get all product database configurations
 * @route   GET /api/admin/product-databases
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Query timeout (Performance)
 * 2. Redis caching (Performance)
 * 3. Secure error handling (Security)
 * 4. Data sanitization (Security)
 */
export const getAllProductDatabases = async (req, res) => {
  try {
    // ========================================
    // 1. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.ALL_PRODUCT_DATABASES;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for all product databases');
      return res.json(cachedData);
    }

    // ========================================
    // 2. FETCH PRODUCT DATABASES (with timeout)
    // ========================================
    const queryPromise = supabase
      .from('product_databases')
      .select(`
        id,
        product_id,
        product_name,
        db_type,
        is_active,
        health_status,
        last_health_check,
        created_at,
        updated_at,
        products:product_id (
          id,
          name,
          description
        )
      `)
      .order('created_at', { ascending: false });

    const { data: productDbs, error } = await executeWithTimeout(queryPromise);

    if (error) {
      console.error('❌ Error fetching product databases:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch product databases. Please try again.'
      });
    }

    // ========================================
    // 3. SANITIZE DATA (don't expose encrypted keys)
    // ========================================
    const sanitized = (productDbs || []).map(db => ({
      ...db,
      supabase_service_key_encrypted: db.supabase_service_key_encrypted ? '***encrypted***' : null,
      postgres_user_encrypted: db.postgres_user_encrypted ? '***encrypted***' : null,
      postgres_password_encrypted: db.postgres_password_encrypted ? '***encrypted***' : null
    }));

    const finalSanitized = sanitizeArray(sanitized);

    // ========================================
    // 4. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      data: finalSanitized
    };

    // ========================================
    // 5. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching product databases.');
  }
};

/**
 * Get product database configuration by product ID
 * @route   GET /api/admin/product-databases/:productId
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Redis caching (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getProductDatabase = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { productId } = req.params;

    if (!productId || !isValidUUID(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid product ID format'
      });
    }

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.PRODUCT_DATABASE(productId);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for product database ${productId}`);
      return res.json(cachedData);
    }

    // ========================================
    // 3. FETCH PRODUCT DATABASE (with timeout)
    // ========================================
    const queryPromise = supabase
      .from('product_databases')
      .select(`
        id,
        product_id,
        product_name,
        db_type,
        is_active,
        health_status,
        last_health_check,
        created_at,
        updated_at,
        products:product_id (
          id,
          name,
          description
        )
      `)
      .eq('product_id', productId)
      .single();

    const { data: productDb, error } = await executeWithTimeout(queryPromise);

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Product database configuration not found'
        });
      }
      console.error('❌ Error fetching product database:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch product database. Please try again.'
      });
    }

    // ========================================
    // 4. SANITIZE DATA (don't expose encrypted keys)
    // ========================================
    const sanitized = {
      ...productDb,
      supabase_service_key_encrypted: productDb.supabase_service_key_encrypted ? '***encrypted***' : null,
      postgres_user_encrypted: productDb.postgres_user_encrypted ? '***encrypted***' : null,
      postgres_password_encrypted: productDb.postgres_password_encrypted ? '***encrypted***' : null
    };

    const finalSanitized = sanitizeObject(sanitized);

    // ========================================
    // 5. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      data: finalSanitized
    };

    // ========================================
    // 6. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the product database.');
  }
};

/**
 * Test credentials before saving
 * @route   POST /api/admin/product-databases/test-credentials
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const testCredentialsBeforeSave = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let {
      db_type = 'supabase',
      supabase_url,
      supabase_service_key,
      postgres_host,
      postgres_port,
      postgres_database,
      postgres_user,
      postgres_password
    } = req.body;

    // Validate db_type
    if (!['supabase', 'postgres'].includes(db_type)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid db_type. Must be "supabase" or "postgres"'
      });
    }

    // Sanitize inputs
    db_type = sanitizeString(db_type, 20);
    supabase_url = supabase_url ? sanitizeString(supabase_url, 500) : null;
    postgres_host = postgres_host ? sanitizeString(postgres_host, 255) : null;
    postgres_database = postgres_database ? sanitizeString(postgres_database, 100) : null;
    postgres_user = postgres_user ? sanitizeString(postgres_user, 100) : null;
    postgres_port = postgres_port ? parseInt(postgres_port) : 5432;

    // Validate required fields
    if (db_type === 'supabase') {
      if (!supabase_url || !supabase_service_key) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Supabase URL and service key are required'
        });
      }
    } else if (db_type === 'postgres') {
      if (!postgres_host || !postgres_database || !postgres_user || !postgres_password) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'All PostgreSQL connection details are required'
        });
      }
    }

    // ========================================
    // 2. TEST CREDENTIALS (with timeout)
    // ========================================
    const testResult = await executeWithTimeout(
      productDbManager.testCredentials({
        db_type,
        supabase_url,
        supabase_service_key,
        postgres_host,
      postgres_port,
      postgres_database,
      postgres_user,
      postgres_password
    })
    , 10000 // 10 second timeout for credential testing
    );
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while testing credentials.');
  }
};

/**
 * Create or update product database configuration
 * @route   POST /api/admin/product-databases
 * @route   PUT /api/admin/product-databases/:productId
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const upsertProductDatabase = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    // For POST: productId comes from body, for PUT: from params
    const productId = req.params.productId || req.body.product_id;
    
    if (!productId || !isValidUUID(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Valid product ID is required'
      });
    }

    let {
      product_name,
      db_type = 'supabase',
      supabase_url,
      supabase_service_key,
      postgres_host,
      postgres_port,
      postgres_database,
      postgres_user,
      postgres_password,
      schema_name = 'public',
      is_active = true
    } = req.body;

    // Validate db_type
    if (!['supabase', 'postgres'].includes(db_type)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid db_type. Must be "supabase" or "postgres"'
      });
    }

    // Sanitize inputs
    product_name = product_name ? sanitizeString(product_name, 255) : null;
    db_type = sanitizeString(db_type, 20);
    supabase_url = supabase_url ? sanitizeString(supabase_url, 500) : null;
    postgres_host = postgres_host ? sanitizeString(postgres_host, 255) : null;
    postgres_database = postgres_database ? sanitizeString(postgres_database, 100) : null;
    postgres_user = postgres_user ? sanitizeString(postgres_user, 100) : null;
    schema_name = schema_name ? sanitizeString(schema_name, 100) : 'public';
    postgres_port = postgres_port ? parseInt(postgres_port) : 5432;

    // ========================================
    // 2. VALIDATE PRODUCT EXISTS (with timeout)
    // ========================================
    const productPromise = supabase
      .from('products')
      .select('id, name')
      .eq('id', productId)
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
    // 3. CHECK EXISTING CONFIG (with timeout)
    // ========================================
    const existingPromise = supabase
      .from('product_databases')
      .select('id, product_name')
      .eq('product_id', productId);

    const { data: existingConfigs, error: existingError } = await executeWithTimeout(existingPromise);

    // Determine if this is an update (PUT with productId in params) or create (POST)
    const isUpdate = !!req.params.productId;
    const existing = existingConfigs && existingConfigs.length > 0 ? existingConfigs[0] : null;

    // If creating new (POST) and product already has a database, prevent it
    if (!isUpdate && existingConfigs && existingConfigs.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `This product already has a database configuration. Each product can only have one database. Please update the existing configuration instead of creating a new one.`
      });
    }

    // If updating but no existing config found, it's an error
    if (isUpdate && (!existingConfigs || existingConfigs.length === 0)) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product database configuration not found. Cannot update a non-existent configuration.'
      });
    }

    // ========================================
    // 4. VALIDATE REQUIRED FIELDS
    // ========================================
    if (db_type === 'supabase') {
      if (!supabase_url) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Supabase URL is required for Supabase databases'
        });
      }
      // Service key required only for new configurations or when updating
      const needsServiceKey = !existing || (existing && supabase_service_key && supabase_service_key !== '***encrypted***');
      if (needsServiceKey && !supabase_service_key) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Supabase service key is required'
        });
      }
    } else if (db_type === 'postgres') {
      if (!postgres_host || !postgres_database) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'PostgreSQL host and database name are required'
        });
      }
      // Credentials required only for new configurations or when updating
      const needsCredentials = !existing || 
        (existing && ((postgres_user && postgres_user !== '***encrypted***') || 
                      (postgres_password && postgres_password !== '***encrypted***')));
      if (needsCredentials && (!postgres_user || !postgres_password)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'PostgreSQL username and password are required'
        });
      }
    }

    // ========================================
    // 5. TEST CREDENTIALS (with timeout, only if new credentials provided)
    // ========================================
    if (db_type === 'supabase' && supabase_service_key && supabase_service_key !== '***encrypted***') {
      const testResult = await executeWithTimeout(
        productDbManager.testCredentials({
          db_type: 'supabase',
          supabase_url,
          supabase_service_key
        }),
        10000
      ).catch(err => {
        console.error('❌ Error testing credentials:', err);
        return { success: false, error: 'Connection Error', message: err?.message };
      });

      if (!testResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Connection Test Failed',
          message: testResult.error || 'Invalid credentials. Please check your Supabase URL and service key.'
        });
      }
    }

    // Encrypt sensitive data
    let encryptedData = {
      product_id: productId,
      product_name: product_name || product.name,
      db_type,
      schema_name,
      is_active,
      updated_at: new Date().toISOString()
    };

    if (db_type === 'supabase') {
      encryptedData.supabase_url = supabase_url;
      // Only encrypt and update service key if provided
      if (supabase_service_key) {
        encryptedData.supabase_service_key_encrypted = productDbManager.encrypt(supabase_service_key);
      }
    } else if (db_type === 'postgres') {
      encryptedData.postgres_host = postgres_host;
      encryptedData.postgres_port = postgres_port || 5432;
      encryptedData.postgres_database = postgres_database;
      // Only encrypt and update credentials if provided
      if (postgres_user) {
        encryptedData.postgres_user_encrypted = productDbManager.encrypt(postgres_user);
      }
      if (postgres_password) {
        encryptedData.postgres_password_encrypted = productDbManager.encrypt(postgres_password);
      }
    }


    // ========================================
    // 6. ENCRYPT SENSITIVE DATA
    // ========================================
  

    if (db_type === 'supabase') {
      encryptedData.supabase_url = supabase_url;
      // Only encrypt and update service key if provided
      if (supabase_service_key && supabase_service_key !== '***encrypted***') {
        encryptedData.supabase_service_key_encrypted = productDbManager.encrypt(supabase_service_key);
      }
    } else if (db_type === 'postgres') {
      encryptedData.postgres_host = postgres_host;
      encryptedData.postgres_port = postgres_port || 5432;
      encryptedData.postgres_database = postgres_database;
      // Only encrypt and update credentials if provided
      if (postgres_user && postgres_user !== '***encrypted***') {
        encryptedData.postgres_user_encrypted = productDbManager.encrypt(postgres_user);
      }
      if (postgres_password && postgres_password !== '***encrypted***') {
        encryptedData.postgres_password_encrypted = productDbManager.encrypt(postgres_password);
      }
    }

    // ========================================
    // 7. UPSERT DATABASE CONFIG (with timeout)
    // ========================================
    if (existing) {
      // Update existing
      const updatePromise = supabase
        .from('product_databases')
        .update(encryptedData)
        .eq('product_id', productId)
        .select()
        .single();

      const { data: updated, error: updateError } = await executeWithTimeout(updatePromise);

      if (updateError || !updated) {
        console.error('❌ Error updating product database:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to update product database configuration. Please try again.'
        });
      }

      // ========================================
      // 8. LOG ACTIVITY (non-blocking)
      // ========================================
      const { actorId, actorRole } = await getActorInfo(req);
      logActivity({
        actorId,
        actorRole,
        targetId: productId,
        actionType: 'update',
        tableName: 'product_databases',
        changedFields: { product_id: productId, ...encryptedData },
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req)
      }).catch(logError => {
        console.warn('⚠️ Failed to log activity:', logError?.message);
      });

      // ========================================
      // 9. CACHE INVALIDATION
      // ========================================
      await cacheService.del(CACHE_KEYS.PRODUCT_DATABASE(productId));
      await cacheService.del(CACHE_KEYS.ALL_PRODUCT_DATABASES);
      await cacheService.delByPattern('product_detail:*');
      await cacheService.delByPattern('product_dashboard:*');
      productDbManager.connections.delete(productId);
      console.log('✅ Cache invalidated for product database update');

      // ========================================
      // 10. DATA SANITIZATION
      // ========================================
      const sanitizedData = sanitizeObject({
        ...updated,
        supabase_service_key_encrypted: '***encrypted***',
        postgres_user_encrypted: updated.postgres_user_encrypted ? '***encrypted***' : null,
        postgres_password_encrypted: updated.postgres_password_encrypted ? '***encrypted***' : null
      });

      res.json({
        success: true,
        message: 'Product database configuration updated successfully',
        data: sanitizedData
      });
    } else {
      // Create new
      encryptedData.created_at = new Date().toISOString();

      const insertPromise = supabase
        .from('product_databases')
        .insert(encryptedData)
        .select()
        .single();

      const { data: created, error: createError } = await executeWithTimeout(insertPromise);

      if (createError || !created) {
        console.error('❌ Error creating product database:', createError);
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to create product database configuration. Please try again.'
        });
      }

      // ========================================
      // 8. LOG ACTIVITY (non-blocking)
      // ========================================
      const { actorId, actorRole } = await getActorInfo(req);
      logActivity({
        actorId,
        actorRole,
        targetId: productId,
        actionType: 'create',
        tableName: 'product_databases',
        changedFields: { product_id: productId, ...encryptedData },
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req)
      }).catch(logError => {
        console.warn('⚠️ Failed to log activity:', logError?.message);
      });

      // ========================================
      // 9. CACHE INVALIDATION
      // ========================================
      await cacheService.del(CACHE_KEYS.PRODUCT_DATABASE(productId));
      await cacheService.del(CACHE_KEYS.ALL_PRODUCT_DATABASES);
      await cacheService.delByPattern('product_detail:*');
      await cacheService.delByPattern('product_dashboard:*');
      console.log('✅ Cache invalidated for product database creation');

      // ========================================
      // 10. DATA SANITIZATION
      // ========================================
      const sanitizedData = sanitizeObject({
        ...created,
        supabase_service_key_encrypted: '***encrypted***',
        postgres_user_encrypted: created.postgres_user_encrypted ? '***encrypted***' : null,
        postgres_password_encrypted: created.postgres_password_encrypted ? '***encrypted***' : null
      });

      res.status(201).json({
        success: true,
        message: 'Product database configuration created successfully',
        data: sanitizedData
      });
    }
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while saving the product database configuration.');
  }
};

/**
 * Delete product database configuration
 * @route   DELETE /api/admin/product-databases/:productId
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const deleteProductDatabase = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { productId } = req.params;

    if (!productId || !isValidUUID(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid product ID format'
      });
    }

    // ========================================
    // 2. CHECK IF EXISTS (with timeout)
    // ========================================
    const checkPromise = supabase
      .from('product_databases')
      .select('id, product_name')
      .eq('product_id', productId)
      .single();

    const { data: existing, error: checkError } = await executeWithTimeout(checkPromise);

    if (checkError || !existing) {
      console.error('❌ Error fetching product database:', checkError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product database configuration not found'
      });
    }

    // ========================================
    // 3. DELETE (with timeout)
    // ========================================
    const deletePromise = supabase
      .from('product_databases')
      .delete()
      .eq('product_id', productId);

    const { error: deleteError } = await executeWithTimeout(deletePromise);

    if (deleteError) {
      console.error('❌ Error deleting product database:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to delete product database configuration. Please try again.'
      });
    }

    // ========================================
    // 4. LOG ACTIVITY (non-blocking)
    // ========================================
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: productId,
      actionType: 'delete',
      tableName: 'product_databases',
      changedFields: { product_id: productId },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 5. CLEAR CONNECTION CACHE
    // ========================================
    productDbManager.connections.delete(productId);

    // ========================================
    // 6. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.PRODUCT_DATABASE(productId));
    await cacheService.del(CACHE_KEYS.ALL_PRODUCT_DATABASES);
    await cacheService.delByPattern('product_detail:*');
    await cacheService.delByPattern('product_dashboard:*');
    console.log('✅ Cache invalidated for product database deletion');

    res.json({
      success: true,
      message: 'Product database configuration deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while deleting the product database configuration.');
  }
};

/**
 * Test product database connection
 * @route   POST /api/admin/product-databases/:productId/test
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const testProductDatabaseConnection = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { productId } = req.params;

    if (!productId || !isValidUUID(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid product ID format'
      });
    }

    // ========================================
    // 2. GET CONFIGURATION (with timeout)
    // ========================================
    const configPromise = supabase
      .from('product_databases')
      .select('id, product_id, product_name, db_type, is_active')
      .eq('product_id', productId)
      .single();

    const { data: config, error: configError } = await executeWithTimeout(configPromise);

    if (configError || !config) {
      console.error('❌ Error fetching database config:', configError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product database configuration not found'
      });
    }

    // ========================================
    // 3. TEST CONNECTION (with timeout)
    // ========================================
    const healthCheck = await executeWithTimeout(
      productDbManager.healthCheck(productId),
      10000
    ).catch(err => {
      console.error('❌ Error testing connection:', err);
      return {
        status: 'error',
        error: err?.message || 'Connection test failed',
        message: 'Failed to test connection'
      };
    });

    // ========================================
    // 4. BUILD RESPONSE
    // ========================================
    const isHealthy = healthCheck.status === 'healthy';
    
    res.json({
      success: isHealthy,
      message: isHealthy 
        ? 'Connection test successful' 
        : `Connection test failed: ${healthCheck.error || healthCheck.message || 'Unknown error'}`,
      data: healthCheck
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while testing the product database connection.');
  }
};
