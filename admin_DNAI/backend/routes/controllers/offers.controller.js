import { supabaseAdmin } from '../../config/database.js';
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
  createPaginatedResponse,
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_KEYS = {
  ALL_OFFERS: (status, page, limit) => `offers:list:${status || 'all'}_page${page}_limit${limit}`,
  OFFER_BY_ID: (id) => `offers:id:${id}`,
  ACTIVE_OFFER: (date) => `offers:active:${date || 'today'}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('offers', 100);

/**
 * Offers Controller
 * Handles offer/commission promotion-related operations
 */

/**
 * Get all offers with pagination (admin/reseller)
 * @route   GET /api/offers?page=1&limit=50&status=active
 * @access  Private (Admin/Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Pagination support (Performance)
 * 3. Query timeout (Performance)
 * 4. Better error handling (Security)
 * 5. Data sanitization (Security)
 * 6. Redis caching (Performance)
 */
export const getAllOffers = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { page, limit, status } = req.query;
    
    // Validate pagination parameters
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // Validate status filter
    const validStatuses = ['active', 'upcoming', 'expired', 'inactive'];
    const statusFilter = status && validStatuses.includes(status) ? status : null;

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.ALL_OFFERS(statusFilter || 'all', pageNum, limitNum);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for offers list');
      return res.json(cachedData);
    }

    console.log('❌ Cache MISS for offers list - fetching from database');
    
    // ========================================
    // 3. BUILD QUERY
    // ========================================
    let query = supabaseAdmin
      .from('offers')
      .select(`
        id,
        name,
        description,
        commission_percentage,
        start_date,
        end_date,
        is_active,
        created_by,
        created_at,
        updated_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filter by status if provided
    if (statusFilter === 'active') {
      const now = new Date().toISOString();
      query = query
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now);
    } else if (statusFilter === 'upcoming') {
      const now = new Date().toISOString();
      query = query
        .eq('is_active', true)
        .gt('start_date', now);
    } else if (statusFilter === 'expired') {
      const now = new Date().toISOString();
      query = query.lt('end_date', now);
    } else if (statusFilter === 'inactive') {
      query = query.eq('is_active', false);
    }

    // ========================================
    // 4. EXECUTE QUERY WITH TIMEOUT
    // ========================================
    const { data: offers, error, count } = await executeWithTimeout(
      query.range(offset, offset + limitNum - 1)
    );

    if (error) {
      console.error('❌ Error fetching offers:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch offers. Please try again.'
      });
    }

    // ========================================
    // 5. GET CREATOR PROFILES (with timeout)
    // ========================================
    const creatorIds = Array.from(new Set((offers || []).map(offer => offer.created_by).filter(Boolean)));
    let creatorIdToProfile = new Map();
    
    if (creatorIds.length > 0) {
      const profilesPromise = supabaseAdmin
        .from('auth_role_with_profiles')
        .select('user_id, full_name, email')
        .in('user_id', creatorIds);

      const { data: creatorProfiles } = await executeWithTimeout(profilesPromise, 3000);
      creatorIdToProfile = new Map((creatorProfiles || []).map(p => [p.user_id, { full_name: p.full_name, email: p.email }]));
    }

    // ========================================
    // 6. FORMAT OFFERS & SANITIZE
    // ========================================
    const formattedOffers = (offers || []).map(offer => {
      const creator = creatorIdToProfile.get(offer.created_by);
      return {
        id: offer.id,
        name: offer.name,
        description: offer.description,
        commissionPercentage: parseFloat(offer.commission_percentage),
        startDate: offer.start_date,
        endDate: offer.end_date,
        isActive: offer.is_active,
        createdBy: offer.created_by,
        createdAt: offer.created_at,
        updatedAt: offer.updated_at,
        creatorName: creator?.full_name || 'Unknown'
      };
    });

    const sanitizedOffers = sanitizeArray(formattedOffers);

    // ========================================
    // 7. RESPONSE STRUCTURE
    // ========================================
    const response = createPaginatedResponse(sanitizedOffers, count, pageNum, limitNum);

    // ========================================
    // 8. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching offers.');
  }
};

/**
 * Get a single offer by ID (admin only)
 * @route   GET /api/offers/:id
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Redis caching (Performance)
 * 3. Query timeout (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getOfferById = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid offer ID format'
      });
    }

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.OFFER_BY_ID(id);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for offer ${id}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for offer ${id} - fetching from database`);

    // ========================================
    // 3. GET OFFER (with timeout)
    // ========================================
    const queryPromise = supabaseAdmin
      .from('offers')
      .select(`
        id,
        name,
        description,
        commission_percentage,
        start_date,
        end_date,
        is_active,
        created_by,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single();

    const { data: offer, error } = await executeWithTimeout(queryPromise);

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Offer not found'
        });
      }
      console.error('❌ Error fetching offer:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch offer. Please try again.'
      });
    }

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Offer not found'
      });
    }

    // ========================================
    // 4. GET CREATOR PROFILE (with timeout)
    // ========================================
    const creatorPromise = supabaseAdmin
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email')
      .eq('user_id', offer.created_by)
      .single();

    const { data: creatorProfile } = await executeWithTimeout(creatorPromise, 3000);

    // ========================================
    // 5. PREPARE RESPONSE
    // ========================================
    const response = {
      success: true,
      data: sanitizeObject({
        id: offer.id,
        name: offer.name,
        description: offer.description,
        commissionPercentage: parseFloat(offer.commission_percentage),
        startDate: offer.start_date,
        endDate: offer.end_date,
        isActive: offer.is_active,
        createdBy: offer.created_by,
        createdAt: offer.created_at,
        updatedAt: offer.updated_at,
        creatorName: creatorProfile?.full_name || 'Unknown'
      })
    };

    // ========================================
    // 6. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the offer.');
  }
};

/**
 * Create a new offer (admin only)
 * @route   POST /api/offers
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const createOffer = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { name, description, commissionPercentage, startDate, endDate, isActive } = req.body;
    const createdBy = req.user.id;

    // Validate required fields
    if (!name || !commissionPercentage || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Name, commission percentage, start date, and end date are required'
      });
    }

    // Sanitize inputs
    name = sanitizeString(name, 255);
    description = description ? sanitizeString(description, 1000) : null;

    // Validate name length
    if (name.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Offer name must be at least 2 characters long'
      });
    }

    // Validate commission percentage
    const commission = parseFloat(commissionPercentage);
    if (isNaN(commission) || commission < 0 || commission > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Commission percentage must be between 0 and 100'
      });
    }

    // Validate dates
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid date format'
      });
    }

    if (endDateObj <= startDateObj) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'End date must be after start date'
      });
    }

    // ========================================
    // 2. INSERT OFFER (with timeout)
    // ========================================
    const insertPromise = supabaseAdmin
      .from('offers')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        commission_percentage: commission,
        start_date: startDate,
        end_date: endDate,
        is_active: isActive !== undefined ? isActive : true,
        created_by: createdBy
      })
      .select(`
        id,
        name,
        description,
        commission_percentage,
        start_date,
        end_date,
        is_active,
        created_by,
        created_at,
        updated_at
      `)
      .single();

    const { data: offer, error } = await executeWithTimeout(insertPromise);

    if (error) {
      console.error('❌ Error creating offer:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create offer. Please try again.'
      });
    }

    // ========================================
    // 3. CACHE INVALIDATION
    // ========================================
    await cacheService.delByPattern('offers:list:*');
    await cacheService.delByPattern('offers:active:*');
    console.log('✅ Cache invalidated for offer creation');

    // ========================================
    // 4. DATA SANITIZATION
    // ========================================
    const sanitizedData = sanitizeObject({
      id: offer.id,
      name: offer.name,
      description: offer.description,
      commissionPercentage: parseFloat(offer.commission_percentage),
      startDate: offer.start_date,
      endDate: offer.end_date,
      isActive: offer.is_active,
      createdBy: offer.created_by,
      createdAt: offer.created_at,
      updatedAt: offer.updated_at
    });

    res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      data: sanitizedData
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while creating the offer.');
  }
};

/**
 * Update an offer (admin only)
 * @route   PUT /api/offers/:id
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format, commission, dates)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const updateOffer = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;
    let { name, description, commissionPercentage, startDate, endDate, isActive } = req.body;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid offer ID format'
      });
    }

    // ========================================
    // 2. CHECK IF OFFER EXISTS (with timeout)
    // ========================================
    const checkPromise = supabaseAdmin
      .from('offers')
      .select('id')
      .eq('id', id)
      .single();

    const { data: existingOffer, error: fetchError } = await executeWithTimeout(checkPromise);

    if (fetchError || !existingOffer) {
      console.error('❌ Error fetching offer:', fetchError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Offer not found'
      });
    }

    // ========================================
    // 3. BUILD UPDATE OBJECT WITH VALIDATION
    // ========================================
    const updateData = {};
    
    if (name !== undefined) {
      name = sanitizeString(name, 255);
      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Offer name must be at least 2 characters long'
        });
      }
      updateData.name = name.trim();
    }
    
    if (description !== undefined) {
      updateData.description = description ? sanitizeString(description, 1000).trim() : null;
    }
    
    if (commissionPercentage !== undefined) {
      const commission = parseFloat(commissionPercentage);
      if (isNaN(commission) || commission < 0 || commission > 100) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Commission percentage must be between 0 and 100'
        });
      }
      updateData.commission_percentage = commission;
    }
    
    if (startDate !== undefined) updateData.start_date = startDate;
    if (endDate !== undefined) updateData.end_date = endDate;
    if (isActive !== undefined) updateData.is_active = isActive;

    // Validate dates if both are provided
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid date format'
        });
      }

      if (endDateObj <= startDateObj) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'End date must be after start date'
        });
      }
    }

    updateData.updated_at = new Date().toISOString();

    // ========================================
    // 4. UPDATE OFFER (with timeout)
    // ========================================
    const updatePromise = supabaseAdmin
      .from('offers')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        name,
        description,
        commission_percentage,
        start_date,
        end_date,
        is_active,
        created_by,
        created_at,
        updated_at
      `)
      .single();

    const { data: offer, error } = await executeWithTimeout(updatePromise);

    if (error) {
      console.error('❌ Error updating offer:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update offer. Please try again.'
      });
    }

    // ========================================
    // 5. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.OFFER_BY_ID(id));
    await cacheService.delByPattern('offers:list:*');
    await cacheService.delByPattern('offers:active:*');
    console.log('✅ Cache invalidated for offer update');

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedData = sanitizeObject({
      id: offer.id,
      name: offer.name,
      description: offer.description,
      commissionPercentage: parseFloat(offer.commission_percentage),
      startDate: offer.start_date,
      endDate: offer.end_date,
      isActive: offer.is_active,
      createdBy: offer.created_by,
      createdAt: offer.created_at,
      updatedAt: offer.updated_at
    });

    res.json({
      success: true,
      message: 'Offer updated successfully',
      data: sanitizedData
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating the offer.');
  }
};

/**
 * Delete an offer (admin only)
 * @route   DELETE /api/offers/:id
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const deleteOffer = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid offer ID format'
      });
    }

    // ========================================
    // 2. CHECK IF OFFER EXISTS (with timeout)
    // ========================================
    const checkPromise = supabaseAdmin
      .from('offers')
      .select('id')
      .eq('id', id)
      .single();

    const { data: existingOffer, error: fetchError } = await executeWithTimeout(checkPromise);

    if (fetchError || !existingOffer) {
      console.error('❌ Error fetching offer:', fetchError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Offer not found'
      });
    }

    // ========================================
    // 3. DELETE OFFER (with timeout)
    // ========================================
    const deletePromise = supabaseAdmin
      .from('offers')
      .delete()
      .eq('id', id);

    const { error } = await executeWithTimeout(deletePromise);

    if (error) {
      console.error('❌ Error deleting offer:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to delete offer. Please try again.'
      });
    }

    // ========================================
    // 4. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.OFFER_BY_ID(id));
    await cacheService.delByPattern('offers:list:*');
    await cacheService.delByPattern('offers:active:*');
    console.log('✅ Cache invalidated for offer deletion');

    res.json({
      success: true,
      message: 'Offer deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while deleting the offer.');
  }
};

/**
 * Get active offer for a specific date (admin/reseller)
 * @route   GET /api/offers/active/:date?
 * @access  Private (Admin or Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Redis caching (Performance)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Data sanitization (Security)
 */
export const getActiveOffer = async (req, res) => {
  try {
    // ========================================
    // 1. PREPARE DATE PARAMETER
    // ========================================
    const { date } = req.params;
    const checkDate = date || new Date().toISOString().split('T')[0]; // Use date only for cache key

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.ACTIVE_OFFER(checkDate);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for active offer ${checkDate}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for active offer ${checkDate} - fetching from database`);

    const checkDateISO = date ? new Date(date).toISOString() : new Date().toISOString();

    // ========================================
    // 3. GET ACTIVE OFFER (with timeout)
    // ========================================
    const queryPromise = supabaseAdmin
      .from('offers')
      .select('id, name, commission_percentage, start_date, end_date')
      .eq('is_active', true)
      .lte('start_date', checkDateISO)
      .gte('end_date', checkDateISO)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: offers, error } = await executeWithTimeout(queryPromise);

    if (error) {
      console.error('❌ Error fetching active offer:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch active offer. Please try again.'
      });
    }

    // ========================================
    // 4. PREPARE RESPONSE
    // ========================================
    let response;
    if (!offers || offers.length === 0) {
      response = {
        success: true,
        data: null,
        message: 'No active offer found for this date'
      };
    } else {
      const offer = offers[0];
      response = {
        success: true,
        data: sanitizeObject({
          id: offer.id,
          name: offer.name,
          commissionPercentage: parseFloat(offer.commission_percentage),
          startDate: offer.start_date,
          endDate: offer.end_date
        })
      };
    }

    // ========================================
    // 5. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the active offer.');
  }
};

