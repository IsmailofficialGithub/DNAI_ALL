import { supabase } from '../../config/database.js';
import { cacheService } from '../../config/redis.js';
import {
  sanitizeString,
  isValidUUID,
  validatePagination,
  sanitizeObject,
  sanitizeArray
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError,
  createPaginatedResponse
} from '../../utils/apiOptimization.js';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_KEYS = {
  ALL_PRODUCTS: (page, limit) => `products:list:page${page}_limit${limit}`,
  PRODUCT_BY_ID: (id) => `products:id:${id}`,
};

// Export middleware for use in routes
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';
export const rateLimitMiddleware = createRateLimitMiddleware('products', 100);
export { sanitizeInputMiddleware };

/**
 * Get all products with pagination
 * @route   GET /api/products?page=1&limit=50
 * @access  Private (Admin/Reseller/Consumer)
 * 
 * OPTIMIZATIONS:
 * 1. Pagination support (Performance)
 * 2. Field selection instead of * (Performance)
 * 3. Query timeout (Performance)
 * 4. Better error handling (Security)
 * 5. Data sanitization (Security)
 * 6. Redis caching (Performance)
 */
export const getAllProducts = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & PAGINATION
    // ========================================
    const { page, limit } = req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    console.log('📦 Fetching products with pagination:', { page: pageNum, limit: limitNum });

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.ALL_PRODUCTS(pageNum, limitNum);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for products list');
      return res.json(cachedData);
    }

    console.log('❌ Cache MISS for products list - fetching from database');

    // ========================================
    // 3. OPTIMIZED DATABASE QUERY
    // ========================================
    const query = supabase
      .from('products')
      .select('id, name, description, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data: products, error, count } = await executeWithTimeout(query);

    // ========================================
    // 4. ERROR HANDLING (Security)
    // ========================================
    if (error) {
      console.error('❌ Error fetching products:', error);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Failed to fetch products. Please try again.'
      });
    }

    console.log(`✅ Found ${products?.length || 0} products`);

    // ========================================
    // 5. DATA SANITIZATION (Security)
    // ========================================
    const sanitizedProducts = sanitizeArray(products || []);

    // ========================================
    // 6. RESPONSE STRUCTURE
    // ========================================
    const response = createPaginatedResponse(sanitizedProducts, count, pageNum, limitNum);

    // ========================================
    // 7. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching products.');
  }
};

/**
 * Get product by ID
 * @route   GET /api/products/:id
 * @access  Private (Admin/Reseller/Consumer)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Field selection instead of * (Performance)
 * 3. Query timeout (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 * 6. Redis caching (Performance)
 */
export const getProductById = async (req, res) => {
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

    console.log(`📦 Fetching product with ID: ${id}`);

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.PRODUCT_BY_ID(id);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for product ${id}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for product ${id} - fetching from database`);

    // ========================================
    // 3. OPTIMIZED DATABASE QUERY
    // ========================================
    const query = supabase
      .from('products')
      .select('id, name, description, created_at, updated_at')
      .eq('id', id)
      .single();

    const { data: product, error } = await executeWithTimeout(query);

    // ========================================
    // 4. ERROR HANDLING (Security)
    // ========================================
    if (error || !product) {
      console.error('❌ Product not found:', error);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product not found'
      });
    }

    console.log('✅ Product found:', product.name);

    // ========================================
    // 5. DATA SANITIZATION (Security)
    // ========================================
    const sanitizedProduct = sanitizeObject(product);

    const response = {
      success: true,
      data: sanitizedProduct
    };

    // ========================================
    // 6. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the product.');
  }
};

/**
 * Create new product
 * @route   POST /api/products
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Secure error handling (Security)
 * 3. Query timeout (Performance)
 */
export const createProduct = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { name, description } = req.body;

    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Name and description are required'
      });
    }

    // Sanitize inputs
    name = sanitizeString(name, 255);
    description = sanitizeString(description, 1000);

    // Validate name length
    if (name.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Product name must be at least 2 characters long'
      });
    }

    // Validate description length
    if (description.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Product description must be at least 5 characters long'
      });
    }

    console.log(`📦 Creating product: ${name}`);

    // ========================================
    // 2. CREATE PRODUCT (with timeout)
    // ========================================
    const insertPromise = supabase
      .from('products')
      .insert([{
        name: name.trim(),
        description: description.trim()
      }])
      .select('id, name, description, created_at, updated_at')
      .single();

    const { data: product, error } = await executeWithTimeout(insertPromise);

    if (error) {
      console.error('❌ Error creating product:', error);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Failed to create product. Please try again.'
      });
    }

    console.log('✅ Product created successfully:', product.name);

    // ========================================
    // 3. CACHE INVALIDATION
    // ========================================
    await cacheService.delByPattern('products:list:*');
    console.log('✅ Cache invalidated for product creation');

    // ========================================
    // 4. DATA SANITIZATION
    // ========================================
    const sanitizedProduct = sanitizeObject(product);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: sanitizedProduct
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while creating the product.');
  }
};

/**
 * Update product
 * @route   PUT /api/products/:id
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. UUID validation (Security)
 * 3. Secure error handling (Security)
 * 4. Query timeout (Performance)
 */
export const updateProduct = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;
    let { name, description } = req.body;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid product ID format'
      });
    }

    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Name and description are required'
      });
    }

    // Sanitize inputs
    name = sanitizeString(name, 255);
    description = sanitizeString(description, 1000);

    // Validate name length
    if (name.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Product name must be at least 2 characters long'
      });
    }

    // Validate description length
    if (description.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Product description must be at least 5 characters long'
      });
    }

    console.log(`📦 Updating product with ID: ${id}`);

    // ========================================
    // 2. CHECK IF PRODUCT EXISTS (with timeout)
    // ========================================
    const checkPromise = supabase
      .from('products')
      .select('id, name')
      .eq('id', id)
      .single();

    const { data: existingProduct, error: fetchError } = await executeWithTimeout(checkPromise);

    if (fetchError || !existingProduct) {
      console.error('❌ Product not found:', fetchError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product not found'
      });
    }

    // ========================================
    // 3. UPDATE PRODUCT (with timeout)
    // ========================================
    const updatePromise = supabase
      .from('products')
      .update({
        name: name.trim(),
        description: description.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, name, description, created_at, updated_at')
      .single();

    const { data: product, error } = await executeWithTimeout(updatePromise);

    if (error) {
      console.error('❌ Error updating product:', error);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Failed to update product. Please try again.'
      });
    }

    console.log('✅ Product updated successfully:', product.name);

    // ========================================
    // 4. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.PRODUCT_BY_ID(id));
    await cacheService.delByPattern('products:list:*');
    console.log('✅ Cache invalidated for product update');

    // ========================================
    // 5. DATA SANITIZATION
    // ========================================
    const sanitizedProduct = sanitizeObject(product);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: sanitizedProduct
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating the product.');
  }
};

/**
 * Delete product
 * @route   DELETE /api/products/:id
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Secure error handling (Security)
 * 3. Query timeout (Performance)
 */
export const deleteProduct = async (req, res) => {
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

    console.log(`📦 Deleting product with ID: ${id}`);

    // ========================================
    // 2. CHECK IF PRODUCT EXISTS (with timeout)
    // ========================================
    const checkPromise = supabase
      .from('products')
      .select('id, name')
      .eq('id', id)
      .single();

    const { data: existingProduct, error: fetchError } = await executeWithTimeout(checkPromise);

    if (fetchError || !existingProduct) {
      console.error('❌ Product not found:', fetchError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Product not found'
      });
    }

    // ========================================
    // 3. DELETE PRODUCT (with timeout)
    // ========================================
    const deletePromise = supabase
      .from('products')
      .delete()
      .eq('id', id);

    const { error } = await executeWithTimeout(deletePromise);

    if (error) {
      console.error('❌ Error deleting product:', error);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Failed to delete product. Please try again.'
      });
    }

    console.log('✅ Product deleted successfully:', existingProduct.name);

    // ========================================
    // 4. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.PRODUCT_BY_ID(id));
    await cacheService.delByPattern('products:list:*');
    console.log('✅ Cache invalidated for product deletion');

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while deleting the product.');
  }
};
