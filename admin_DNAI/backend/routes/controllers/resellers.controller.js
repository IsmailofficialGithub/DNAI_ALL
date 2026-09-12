import { supabase, supabaseAdmin } from '../../config/database.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../../services/emailService.js';
import { generatePassword } from '../../utils/helpers.js';
import { logActivity, getActorInfo, getClientIp, getUserAgent } from '../../services/activityLogger.js';
import { cacheService } from '../../config/redis.js';
import { performFullUserCleanup } from '../../utils/databaseCleanup.js';
import {
  sanitizeString,
  isValidUUID,
  isValidEmail,
  isValidPhone,
  validatePagination,
  sanitizeObject,
  sanitizeArray
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  RESELLER_SELECT_FIELDS,
  handleApiError,
  validateAndSanitizeSearch,
  createPaginatedResponse,
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';
import { hasRole, getPrimaryRole } from '../../utils/roleUtils.js';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_KEYS = {
  ALL_RESELLERS: (search, page, limit) => `resellers:list:${search || 'all'}_page${page}_limit${limit}`,
  RESELLER_BY_ID: (id) => `resellers:id:${id}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('resellers', 100);

/**
 * Resellers Controller
 * Handles reseller-related operations
 */

/**
 * Get all resellers with search and pagination (admin only)
 * @route   GET /api/resellers?search=john&page=1&limit=50
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Pagination support (Performance)
 * 3. Field selection instead of * (Performance)
 * 4. Query timeout (Performance)
 * 5. Better error handling (Security)
 * 6. Data sanitization (Security)
 * 7. Redis caching (Performance)
 */
export const getAllResellers = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { search, page, limit } = req.query;

    // Validate and sanitize search input
    const searchTerm = validateAndSanitizeSearch(search, 100);
    if (search && !searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid search term. Only alphanumeric characters, spaces, @, ., _, and - are allowed.'
      });
    }

    // Validate pagination parameters
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;


    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.ALL_RESELLERS(searchTerm || '', pageNum, limitNum);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for resellers list');
      return res.json(cachedData);
    }

    console.log('❌ Cache MISS for resellers list - fetching from database');

    // ========================================
    // 3. OPTIMIZED DATABASE QUERY
    // ========================================
    let query = supabase
      .from('auth_role_with_profiles')
      .select(RESELLER_SELECT_FIELDS, { count: 'exact' })
      .contains('role', ['reseller']); // Check if role array contains 'reseller'

    // Apply search filter if provided
    if (searchTerm) {
      query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    // Order and paginate
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data: resellers, error, count } = await executeWithTimeout(query);

    // ========================================
    // 4. ERROR HANDLING (Security)
    // ========================================
    if (error) {
      console.error('❌ Error fetching resellers:', error);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Failed to fetch resellers. Please try again.'
      });
    }


    // ========================================
    // 5. FETCH COMMISSION DATA (with timeout)
    // ========================================
    // Get default commission
    const defaultSettingPromise = supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'default_reseller_commission')
      .single();

    const { data: defaultSetting } = await executeWithTimeout(defaultSettingPromise, 5000);
    const defaultCommission = defaultSetting ? parseFloat(defaultSetting.setting_value) : 10.00;

    // Get commission data for all resellers
    const resellerIds = (resellers || []).map(r => r.user_id);
    const profilesWithCommissionPromise = supabaseAdmin
      .from('auth_role_with_profiles')
      .select('user_id, commission_rate, commission_updated_at')
      .in('user_id', resellerIds);

    const { data: profilesWithCommission } = await executeWithTimeout(profilesWithCommissionPromise, 5000);

    const commissionMap = new Map();
    if (profilesWithCommission) {
      profilesWithCommission.forEach(profile => {
        commissionMap.set(profile.user_id, {
          commission_rate: profile.commission_rate,
          commission_updated_at: profile.commission_updated_at
        });
      });
    }

    // ========================================
    // 6. GATHER REFERRED COUNTS (with timeout)
    // ========================================
    // Gather each reseller's referred customer count and commission
    const resellerWithCounts = await Promise.all(
      (resellers || []).map(async function (reseller) {
        // For each reseller, count the number of users referred by them
        const referredCountPromise = supabase
          .from('auth_role_with_profiles')
          .select('user_id', { count: 'exact', head: true })
          .eq('referred_by', reseller.user_id)
          .contains('role', ['consumer']); // Check if role array contains 'consumer'

        const { count, error: referredError } = await executeWithTimeout(referredCountPromise, 5000);

        // Get commission data
        const commissionData = commissionMap.get(reseller.user_id);
        const customCommission = commissionData?.commission_rate ? parseFloat(commissionData.commission_rate) : null;
        const effectiveCommission = customCommission !== null ? customCommission : defaultCommission;
        const commissionType = customCommission !== null ? 'custom' : 'default';

        // Use function syntax so `this` can work inside object if needed
        return Object.assign({}, reseller, {
          referred_count: referredError ? 0 : (typeof count === 'number' ? count : 0),
          commission_rate: effectiveCommission,
          commission_type: commissionType,
          custom_commission: customCommission,
          default_commission: defaultCommission,
          commission_updated_at: commissionData?.commission_updated_at || null
        });
      })
    );

    // ========================================
    // 7. DATA SANITIZATION (Security)
    // ========================================
    const sanitizedResellers = sanitizeArray(resellerWithCounts);

    // ========================================
    // 8. RESPONSE STRUCTURE
    // ========================================
    const response = createPaginatedResponse(sanitizedResellers, count, pageNum, limitNum, searchTerm);

    // ========================================
    // 9. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching resellers.');
  }
};

/**
 * Get all consumers referred by a specific user/reseller (admin only)
 * @route   GET /api/resellers/:id/referred-consumers
 * @access  Private (Admin)
 */
/**
 * Get referred consumers for a reseller (admin only)
 * @route   GET /api/resellers/:id/consumers
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Data sanitization (Security)
 */
export const getReferredConsumers = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID format'
      });
    }

    // ========================================
    // 2. FETCH REFERRED CONSUMERS (with timeout)
    // ========================================
    const queryPromise = supabase
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email, role, referred_by, account_status, created_at')
      .eq('referred_by', id)
      .contains('role', ['consumer'])
      .order('created_at', { ascending: false });

    const { data: consumers, error } = await executeWithTimeout(queryPromise);

    if (error) {
      console.error('❌ Error fetching referred consumers:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch referred consumers. Please try again.'
      });
    }

    // ========================================
    // 3. DATA SANITIZATION
    // ========================================
    const sanitizedConsumers = sanitizeArray(consumers || []);

    res.json({
      success: true,
      count: sanitizedConsumers.length,
      data: sanitizedConsumers
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching referred consumers.');
  }
};

/**
 * Get reseller by ID (admin only)
 * @route   GET /api/resellers/:id
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Field selection instead of * (Performance)
 * 3. Query timeout (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 * 6. Redis caching (Performance)
 */
export const getResellerById = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID format'
      });
    }

    const cacheKey = CACHE_KEYS.RESELLER_BY_ID(id);

    // Try to get from cache
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for reseller ${id}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for reseller ${id} - fetching from database`);

    // ========================================
    // 2. OPTIMIZED DATABASE QUERY
    // ========================================
    const queryPromise = supabaseAdmin
      .from('auth_role_with_profiles')
      .select(RESELLER_SELECT_FIELDS)
      .eq('user_id', id)
      .maybeSingle();

    const { data: reseller, error } = await executeWithTimeout(queryPromise);

    // ========================================
    // 3. ERROR HANDLING (Security)
    // ========================================
    if (error || !reseller) {
      console.error('❌ Error fetching reseller:', error);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found'
      });
    }

    // ========================================
    // 4. FETCH COMMISSION DATA (with timeout)
    // ========================================
    const defaultSettingPromise = supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'default_reseller_commission')
      .single();

    const { data: defaultSetting } = await executeWithTimeout(defaultSettingPromise, 5000);
    const defaultCommission = defaultSetting ? parseFloat(defaultSetting.setting_value) : 10.00;
    const customCommission = reseller.commission_rate ? parseFloat(reseller.commission_rate) : null;
    const effectiveCommission = customCommission !== null ? customCommission : defaultCommission;
    const commissionType = customCommission !== null ? 'custom' : 'default';

    // ========================================
    // 5. DATA SANITIZATION (Security)
    // ========================================
    const sanitizedReseller = sanitizeObject(reseller);

    const response = {
      success: true,
      data: {
        ...sanitizedReseller,
        commission_rate: effectiveCommission,
        commission_type: commissionType,
        custom_commission: customCommission,
        default_commission: defaultCommission
      }
    };

    // ========================================
    // 6. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the reseller.');
  }
};

/**
 * Create new reseller (admin only)
 * @route   POST /api/resellers
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const createReseller = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { email, password, full_name, phone, country, city, roles, referred_by, subscribed_products, trial_expiry_date, productSettings, nickname } = req.body;
    console.log('=============================================')

    // Validate required fields
    if (!email || !password || !full_name || !country || !city) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'FullName, Email, password, country, city are required'
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Sanitize inputs
    email = email.toLowerCase().trim();
    full_name = sanitizeString(full_name, 255);
    country = sanitizeString(country, 100);
    city = sanitizeString(city, 100);
    phone = phone ? sanitizeString(phone, 20) : null;

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Configuration Error',
        message: 'Admin client not configured'
      });
    }

    // Admin-created accounts should be usable immediately.
    const accountStatus = 'active';

    // Get the user ID of who created this reseller (from token) - use as fallback if referred_by not provided
    const adminId = req.user && req.user.id ? req.user.id : null;
    
    // Validate roles - support both single role (backward compatibility) and roles array
    const validRoles = ['reseller', 'consumer', 'support'];
    let userRoles = [];
    
    // If roles array is provided, use it; otherwise default to reseller
    if (roles && Array.isArray(roles)) {
      userRoles = roles.map(r => r.toLowerCase()).filter(r => validRoles.includes(r));
      if (userRoles.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `At least one valid role is required. Valid roles: ${validRoles.join(', ')}`
        });
      }
    } else {
      // Default to reseller if no roles provided
      userRoles = ['reseller'];
    }
    
    // Remove duplicates
    userRoles = [...new Set(userRoles)];
    
    // For consumer role: use provided referred_by, otherwise use admin creating the user
    // For other roles: use admin creating the user
    let finalReferredBy = adminId;
    if (userRoles.includes('consumer') && referred_by) {
      // Validate referred_by is a valid UUID if provided
      if (isValidUUID(referred_by)) {
        finalReferredBy = referred_by;
      } else {
        console.warn('⚠️ Invalid referred_by UUID provided, using admin ID instead');
      }
    }

    // ========================================
    // 3. CREATE USER (with timeout)
    // ========================================
    // Store primary role (highest priority) in user_metadata for backward compatibility
    const primaryRole = getPrimaryRole(userRoles) || 'reseller';
    const createUserPayload = {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || '',
        country: country || '',
        city: city || '',
        role: primaryRole,
        roles: userRoles
      }
    };

    // Only include phone if it's defined
    if (phone) {
      createUserPayload.phone = phone;
    }

    // Note: Supabase auth.admin.createUser doesn't support timeout wrapper directly
    // but we'll handle errors properly
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser(createUserPayload);

    if (createError) {
      console.error('❌ Error creating user:', createError);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: createError.message || 'Failed to create user'
      });
    }

    // ========================================
    // 4. CREATE PROFILE (with timeout)
    // ========================================
    const profileData = {
      user_id: newUser.user.id,
      full_name,
      role: userRoles, // Store as array
      phone: phone || null,
      country: country || null,
      city: city || null,
      referred_by: finalReferredBy || null,
      commission_rate: null, // Explicitly set to NULL to use default
      commission_updated_at: null,
      account_status: accountStatus,
      nickname: nickname ? sanitizeString(nickname, 100) : null
    };
    
    // If roles include consumer, handle trial_expiry and account_status
    if (userRoles.includes('consumer')) {
      // Use provided trial_expiry_date if valid, otherwise default to 3 days from now
      if (trial_expiry_date) {
        const trialDate = new Date(trial_expiry_date);
        if (!isNaN(trialDate.getTime()) && trialDate >= new Date()) {
          profileData.trial_expiry = trialDate.toISOString();
        } else {
          // Invalid date, use default
          const trialExpiry = new Date();
          trialExpiry.setDate(trialExpiry.getDate() + 3);
          profileData.trial_expiry = trialExpiry.toISOString();
        }
      } else {
        // No date provided, use default 3 days
        const trialExpiry = new Date();
        trialExpiry.setDate(trialExpiry.getDate() + 3);
        profileData.trial_expiry = trialExpiry.toISOString();
      }
      // If consumer is included, set account_status to active (override pending for resellers)
      profileData.account_status = 'active';
    }

    const profilePromise = supabaseAdmin
      .from('profiles')
      .upsert([profileData]);

    const { error: insertError } = await executeWithTimeout(profilePromise);

    if (insertError) {
      console.error('❌ Error inserting profile:', insertError);
      // Try to delete the created user if profile insert fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      } catch (deleteError) {
        console.error('Error deleting failed user:', deleteError);
      }
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create reseller profile. Please try again.'
      });
    }

    // If consumer role and subscribed_products provided, store in user_product_access table
    if (userRoles.includes('consumer') && subscribed_products && Array.isArray(subscribed_products) && subscribed_products.length > 0) {
      try {
        // Validate all product IDs are valid UUIDs
        const validProductIds = subscribed_products.filter(productId => isValidUUID(productId));
        
        if (validProductIds.length > 0) {
          // Build product access records with product_settings included
          const productAccessRecords = validProductIds.map(productId => {
            const record = {
              user_id: newUser.user.id,
              product_id: productId
            };
            
            // Add product_settings if available for this product
            if (productSettings && typeof productSettings === 'object' && productSettings[productId]) {
              const settings = productSettings[productId];
              
              // Validate and sanitize settings
              const sanitizedSettings = {};
              
              if (settings.vapi_account !== undefined && settings.vapi_account !== null && settings.vapi_account !== '') {
                sanitizedSettings.vapi_account = parseInt(settings.vapi_account);
              }
              if (settings.agent_number !== undefined && settings.agent_number !== null && settings.agent_number !== '') {
                sanitizedSettings.agent_number = parseInt(settings.agent_number);
              }
              if (settings.duration_limit !== undefined && settings.duration_limit !== null && settings.duration_limit !== '') {
                sanitizedSettings.duration_limit = parseInt(settings.duration_limit);
              }
              if (settings.list_limit !== undefined && settings.list_limit !== null && settings.list_limit !== '') {
                sanitizedSettings.list_limit = parseInt(settings.list_limit);
              }
              if (settings.concurrency_limit !== undefined && settings.concurrency_limit !== null && settings.concurrency_limit !== '') {
                sanitizedSettings.concurrency_limit = parseInt(settings.concurrency_limit);
              }
              
              // Beeba product settings
              if (settings.brands !== undefined && settings.brands !== null && settings.brands !== '') {
                sanitizedSettings.brands = parseInt(settings.brands);
              }
              if (settings.posts !== undefined && settings.posts !== null && settings.posts !== '') {
                sanitizedSettings.posts = parseInt(settings.posts);
              }
              if (settings.analysis !== undefined && settings.analysis !== null && settings.analysis !== '') {
                sanitizedSettings.analysis = parseInt(settings.analysis);
              }
              if (settings.images !== undefined && settings.images !== null && settings.images !== '') {
                sanitizedSettings.images = parseInt(settings.images);
              }
              if (settings.video !== undefined && settings.video !== null && settings.video !== '') {
                sanitizedSettings.video = parseInt(settings.video);
              }
              if (settings.carasoul !== undefined && settings.carasoul !== null && settings.carasoul !== '') {
                sanitizedSettings.carasoul = parseInt(settings.carasoul);
              }

              // Inbound product settings (Balance & Credits)
              if (settings.balance !== undefined && settings.balance !== null && settings.balance !== '') {
                sanitizedSettings.balance = parseFloat(settings.balance);
              }
              if (settings.low_credit_threshold !== undefined && settings.low_credit_threshold !== null && settings.low_credit_threshold !== '') {
                sanitizedSettings.low_credit_threshold = parseFloat(settings.low_credit_threshold);
              }
              if (settings.auto_topup_enabled !== undefined) {
                sanitizedSettings.auto_topup_enabled = !!settings.auto_topup_enabled;
              }
              if (settings.auto_topup_amount !== undefined && settings.auto_topup_amount !== null && settings.auto_topup_amount !== '') {
                sanitizedSettings.auto_topup_amount = parseFloat(settings.auto_topup_amount);
              }
              if (settings.auto_topup_threshold !== undefined && settings.auto_topup_threshold !== null && settings.auto_topup_threshold !== '') {
                sanitizedSettings.auto_topup_threshold = parseFloat(settings.auto_topup_threshold);
              }
              
              // Only add product_settings if there are valid settings
              if (Object.keys(sanitizedSettings).length > 0) {
                record.product_settings = sanitizedSettings;
              }
            }
            
            return record;
          });

          const productAccessPromise = supabaseAdmin
            .from('user_product_access')
            .insert(productAccessRecords)
            .select('id, product_id, product_settings');

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Product access insert timeout')), 5000)
          );

          const { data: insertedProductAccess, error: productAccessError } = await Promise.race([productAccessPromise, timeoutPromise]);
          
          if (productAccessError) {
            console.error('❌ Error inserting product access:', productAccessError);
            throw productAccessError;
          }
          
          console.log('✅ Product access records inserted:', insertedProductAccess?.length || 0);
          if (productSettings && Object.keys(productSettings).length > 0) {
            console.log('✅ Product settings included in insert');
          }
        } else {
          console.warn('⚠️ No valid product IDs provided in subscribed_products');
        }
      } catch (productAccessError) {
        console.warn('⚠️ Failed to store product access (non-critical):', productAccessError?.message || productAccessError);
        // Don't fail the request, just log the error
      }
    }

    // Send welcome email
    try {
      await sendWelcomeEmail({
        email,
        full_name,
        password,
        role: userRoles.join(', ')
      });
      console.log('✅ Welcome email sent to:', email);
    } catch (emailError) {
      console.error('❌ Email send error:', emailError);
    }

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    await logActivity({
      actorId,
      actorRole,
      targetId: newUser.user.id,
      actionType: 'create',
      tableName: 'profiles',
      changedFields: profileData,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    // Invalidate cache for users, resellers, and consumers list
    await cacheService.delByPattern('users:list:*');
    await cacheService.delByPattern('resellers:*');
    await cacheService.delByPattern('consumers:*');
    console.log('✅ Cache invalidated for users, resellers, and consumers list after reseller creation');

    res.status(201).json({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        full_name,
        role: userRoles, // Return as array
        phone: phone || null,
        country: country || null,
        city: city || null,
      }
    });
  } catch (error) {
    console.error('Error creating reseller:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Internal server error'
    });
  }
};

/**
 * Update reseller (admin only)
 * @route   PUT /api/resellers/:id
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format, required fields)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const updateReseller = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { id } = req.params;
    let { full_name, phone, country, city, roles, nickname } = req.body;
    
    console.log('📝 Update reseller - received data:', { 
      roles, 
      rolesType: typeof roles, 
      isArray: Array.isArray(roles)
    });

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID format'
      });
    }

    // Validate required fields for update
    if (!country || !city || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Country, city, and phone are required'
      });
    }

    // Sanitize inputs
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = sanitizeString(full_name, 255);
    updateData.phone = sanitizeString(phone, 20);
    updateData.country = sanitizeString(country, 100);
    updateData.city = sanitizeString(city, 100);
    
    // Handle nickname (optional)
    if (nickname !== undefined) {
      updateData.nickname = nickname ? sanitizeString(nickname, 100) : null;
    }

    // Handle roles update if provided
    if (roles !== undefined) {
      // Normalize roles to array
      let rolesArray = roles;
      if (!Array.isArray(roles)) {
        // If it's a string, convert to array
        if (typeof roles === 'string') {
          rolesArray = [roles];
        } else {
          console.warn('⚠️ Roles is not an array or string, defaulting to reseller:', roles);
          rolesArray = ['reseller'];
        }
      }
      
      const validRoles = ['consumer', 'reseller', 'support'];
      const userRoles = rolesArray.map(r => String(r).toLowerCase()).filter(r => validRoles.includes(r));
      
      if (userRoles.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `At least one valid role is required. Valid roles: ${validRoles.join(', ')}`
        });
      }
      
      // Remove duplicates and set as array
      updateData.role = [...new Set(userRoles)];
      }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }

    // ========================================
    // 2. GET OLD DATA FOR LOGGING (with timeout)
    // ========================================
    const oldDataPromise = supabase
      .from('profiles')
      .select('*')
      .eq('user_id', id)
      .contains('role', ['reseller']) // Check if role array contains 'reseller'
      .single();

    const { data: oldReseller } = await executeWithTimeout(oldDataPromise, 3000);

    // ========================================
    // 3. UPDATE RESELLER (with timeout)
    // ========================================
    const updatePromise = supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', id)
      .select()
      .maybeSingle();

    const { data: updatedReseller, error } = await executeWithTimeout(updatePromise);

    if (error) {
      console.error('❌ Error updating reseller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update reseller. Please try again.'
      });
    }

    if (!updatedReseller) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found'
      });
    }

    // ========================================
    // 4. LOG ACTIVITY (non-blocking)
    // ========================================
    const changedFields = {};
    Object.keys(updateData).forEach(key => {
      if (oldReseller && oldReseller[key] !== updateData[key]) {
        changedFields[key] = {
          old: oldReseller[key],
          new: updateData[key]
        };
      }
    });

    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'update',
      tableName: 'profiles',
      changedFields: changedFields,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 5. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.RESELLER_BY_ID(id));
    await cacheService.delByPattern('users:list:*');
    await cacheService.delByPattern('resellers:*');
    await cacheService.delByPattern('consumers:*');
    
    // If roles were updated, also clear permission caches since permissions are role-based
    if (updateData.role) {
      await cacheService.delByPattern('permissions:*');
      // Also clear user-specific permission cache
      await cacheService.del(`permissions:user:${id}`);
      console.log('✅ Also cleared permission caches due to role update');
    }
    
    console.log('✅ Cache invalidated for reseller update');

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedData = sanitizeObject({
      ...updatedReseller,
      country: country || null,
      city: city || null,
      phone: phone || null,
    });

    res.json({
      success: true,
      message: 'Reseller updated successfully',
      data: sanitizedData
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating the reseller.');
  }
};

/**
 * Delete reseller (admin only)
 * @route   DELETE /api/resellers/:id
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const deleteReseller = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID format'
      });
    }

    // ========================================
    // 2. CHECK IF RESELLER EXISTS (with timeout)
    // ========================================
    const checkPromise = supabase
      .from('profiles')
      .select('*')
      .eq('user_id', id)
      .contains('role', ['reseller']) // Check if role array contains 'reseller'
      .single();

    const { data: reseller, error: fetchError } = await executeWithTimeout(checkPromise);

    if (fetchError || !reseller) {
      console.error('❌ Error fetching reseller:', fetchError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found'
      });
    }

    // ========================================
    // 3. LOG ACTIVITY BEFORE DELETION (non-blocking)
    // ========================================
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'delete',
      tableName: 'profiles',
      changedFields: reseller || null,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 4. ROBUST DATA CLEANUP (FOREIGN KEY HELL)
    // ========================================
    const cleanupSuccess = await performFullUserCleanup(id);
    
    if (!cleanupSuccess) {
      return res.status(500).json({
        success: false,
        error: 'CLEANUP_FAILED',
        message: 'Failed to clean up reseller data. The deletion was aborted to prevent data corruption.'
      });
    }

    // ========================================
    // 5. DELETE FROM AUTH (non-blocking)
    // ========================================
    if (supabaseAdmin) {
      supabaseAdmin.auth.admin.deleteUser(id).catch(authError => {
        console.warn('⚠️ Error deleting user from auth:', authError?.message);
      });
    }

    // ========================================
    // 6. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.RESELLER_BY_ID(id));
    await cacheService.delByPattern('users:list:*');
    await cacheService.delByPattern('resellers:*');
    await cacheService.delByPattern('consumers:*');
    console.log('✅ Cache invalidated for reseller deletion');

    res.json({
      success: true,
      message: 'Reseller deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while deleting the reseller.');
  }
};

/**
 * Reset reseller password (admin only)
 * @route   POST /api/resellers/:id/reset-password
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Secure error handling (Security)
 */
export const resetResellerPassword = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID format'
      });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Configuration Error',
        message: 'Admin client not configured'
      });
    }

    // ========================================
    // 2. GET USER DATA
    // ========================================
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(id);

    if (userError) {
      console.error("❌ Error fetching user from auth:", userError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found'
      });
    }

    const profile = {
      email: user?.user?.email,
      full_name: user?.user?.user_metadata?.full_name || user?.user?.email?.split('@')[0]
    };

    if (!profile || !profile.email || !profile.full_name) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Email or full name not found'
      });
    }

    // ========================================
    // 3. GENERATE OR USE MANUAL PASSWORD
    // ========================================
    const { password: manualPassword } = req.body;

    // Use manual password if provided, otherwise generate random
    const newPassword = manualPassword || generatePassword();

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to reset password. Please try again.'
      });
    }

    // ========================================
    // 4. SEND PASSWORD RESET EMAIL (non-blocking)
    // ========================================
    sendPasswordResetEmail({
      email: profile.email,
      full_name: profile.full_name,
      new_password: newPassword
    }).catch(emailError => {
      console.warn('⚠️ Failed to send password reset email:', emailError?.message);
    });

    res.json({
      success: true,
      message: 'Password reset successfully. Email sent to reseller.',
      newPassword: newPassword
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while resetting the password.');
  }
};

/**
 * Get all consumers created by the logged-in reseller
 * @route   GET /api/resellers/my-consumers
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation
 * 2. Query timeout (Performance)
 * 3. Batch product access fetch (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getMyConsumers = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const resellerId = req.user.id;

    if (!resellerId || !isValidUUID(resellerId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID'
      });
    }

    // ========================================
    // 2. FETCH CONSUMERS (with timeout)
    // ========================================
    const consumersPromise = supabase
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email, role, phone, trial_expiry, lifetime_access, referred_by, created_at, updated_at, country, city')
      .contains('role', ['consumer']) // Check if role array contains 'consumer'
      .eq('referred_by', resellerId)
      .order('created_at', { ascending: false });

    const { data: consumers, error } = await executeWithTimeout(consumersPromise);

    if (error) {
      console.error('❌ Error fetching consumers:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch consumers. Please try again.'
      });
    }

    // ========================================
    // 3. BATCH FETCH PRODUCT ACCESS (with timeout)
    // ========================================
    const consumerIds = (consumers || []).map(c => c.user_id);
    let productAccessMap = new Map();
    
    if (consumerIds.length > 0) {
      const productAccessPromise = supabase
        .from('user_product_access')
        .select('user_id, product_id')
        .in('user_id', consumerIds);

      const { data: productAccess } = await executeWithTimeout(productAccessPromise, 3000);
      
      // Build map: user_id -> [product_ids]
      (productAccess || []).forEach(pa => {
        if (!productAccessMap.has(pa.user_id)) {
          productAccessMap.set(pa.user_id, []);
        }
        productAccessMap.get(pa.user_id).push(pa.product_id);
      });
    }

    // ========================================
    // 4. ENRICH CONSUMERS WITH PRODUCT ACCESS
    // ========================================
    const consumersWithProducts = (consumers || []).map(consumer => ({
      ...consumer,
      subscribed_products: productAccessMap.get(consumer.user_id) || []
    }));

    // ========================================
    // 5. DATA SANITIZATION
    // ========================================
    const sanitizedConsumers = sanitizeArray(consumersWithProducts);

    res.json({
      success: true,
      count: sanitizedConsumers.length,
      data: sanitizedConsumers
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching consumers.');
  }
};

/**
 * Create new consumer (referred by reseller)
 * @route   POST /api/resellers/my-consumers
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const createMyConsumer = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const resellerId = req.user.id;
    let { email, password, full_name, phone, trial_expiry_date, country, city, subscribed_products, subscribed_packages, roles, productSettings } = req.body;
    console.log('req.body', email,password,full_name,phone,trial_expiry_date,country,city,subscribed_products,subscribed_packages,roles,productSettings);

    // Validate required fields
    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'FullName, Email, password are required'
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Sanitize inputs
    email = email.toLowerCase().trim();
    full_name = sanitizeString(full_name, 255);
    country = country ? sanitizeString(country, 100) : null;
    city = city ? sanitizeString(city, 100) : null;
    phone = phone ? sanitizeString(phone, 20) : null;

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Configuration Error',
        message: 'Admin client not configured'
      });
    }

    // Validate roles - support both single role (backward compatibility) and roles array
    const validRoles = ['consumer', 'reseller'];
    let userRoles = [];
    
    // If roles array is provided, use it; otherwise default to consumer
    if (roles && Array.isArray(roles)) {
      userRoles = roles.map(r => r.toLowerCase()).filter(r => validRoles.includes(r));
      if (userRoles.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `At least one valid role is required. Valid roles: ${validRoles.join(', ')}`
        });
      }
    } else {
      // Default to consumer if no roles provided
      userRoles = ['consumer'];
    }
    
    // Remove duplicates
    userRoles = [...new Set(userRoles)];
    
    // ========================================
    // 2. CHECK MAX CONSUMERS LIMIT (with timeout)
    // ========================================
    const { getResellerSettings } = await import('../../utils/resellerSettings.js');
    const resellerSettings = await getResellerSettings();
    
    // Only check limit if consumer role is included
    if (userRoles.includes('consumer') && resellerSettings.maxConsumersPerReseller !== null && resellerSettings.maxConsumersPerReseller > 0) {
      const countPromise = supabaseAdmin
        .from('auth_role_with_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', resellerId)
        .contains('role', ['consumer']); // Check if role array contains 'consumer'

      const { count: currentConsumerCount, error: countError } = await executeWithTimeout(countPromise);

      if (countError) {
        console.error('❌ Error counting consumers:', countError);
      } else if (currentConsumerCount >= resellerSettings.maxConsumersPerReseller) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Maximum consumers limit reached. You can only have ${resellerSettings.maxConsumersPerReseller} consumer(s).`
        });
      }
    }

    // Create user with Supabase Admin
    const createUserPayload = {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || '',
        role: ['consumer'], // Array for TEXT[]
        country: country || '',
        city: city || '',
      }
    };

    // Only include phone if it's defined
    if (phone) {
      createUserPayload.phone = phone;
    }

    // ========================================
    // 3. CREATE USER
    // ========================================
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser(createUserPayload);

    if (createError) {
      console.error('❌ Error creating user:', createError);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: createError.message || 'Failed to create user'
      });
    }

    // ========================================
    // 4. CREATE PROFILE (with timeout)
    // ========================================
    const profileData = {
      user_id: newUser.user.id,
      full_name,
      role: userRoles, // Store as array
      phone: phone || null,
      country: country || null,
      city: city || null,
      referred_by: resellerId
    };

    // If roles include consumer, handle trial_expiry and account_status
    if (userRoles.includes('consumer')) {
      // Use provided trial_expiry_date if valid, otherwise default to 3 days from now
      if (trial_expiry_date) {
        const trialDate = new Date(trial_expiry_date);
        if (!isNaN(trialDate.getTime()) && trialDate >= new Date()) {
          profileData.trial_expiry = trialDate.toISOString();
          console.log('✅ Using provided trial expiry date:', profileData.trial_expiry);
        } else {
          // Invalid date, use default
          const trialExpiry = new Date();
          trialExpiry.setDate(trialExpiry.getDate() + 3);
          profileData.trial_expiry = trialExpiry.toISOString();
          console.log('⚠️ Invalid trial_expiry_date provided, using default 3-day trial:', profileData.trial_expiry);
        }
      } else {
        // No date provided, use default 3 days
        const trialExpiry = new Date();
        trialExpiry.setDate(trialExpiry.getDate() + 3);
        profileData.trial_expiry = trialExpiry.toISOString();
        console.log('✅ Setting default 3-day trial for consumer:', profileData.trial_expiry);
      }
      profileData.account_status = 'active';
    }

    const profilePromise = supabaseAdmin
      .from('profiles')
      .upsert([profileData]);

    const { error: insertError } = await executeWithTimeout(profilePromise);

    if (insertError) {
      console.error('❌ Error inserting profile:', insertError);
      // Try to delete the created user if profile insert fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      } catch (deleteError) {
        console.error('Error deleting failed user:', deleteError);
      }
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create consumer profile. Please try again.'
      });
    }

    // ========================================
    // 5. STORE PACKAGE ACCESS (with timeout, non-blocking)
    // ========================================
    // Only store package access if consumer role is included
    // Support both subscribed_packages (new) and subscribed_products (backward compatibility)
    const packagesToStore = subscribed_packages || subscribed_products || [];
    
    if (userRoles.includes('consumer') && packagesToStore && Array.isArray(packagesToStore) && packagesToStore.length > 0) {
      // Validate package IDs and store in profiles.subscribed_packages
      const validPackageIds = packagesToStore.filter(packageId => isValidUUID(packageId));
      
      if (validPackageIds.length > 0) {
        // Update profile with subscribed_packages array
        const updateProfilePromise = supabaseAdmin
          .from('profiles')
          .update({ subscribed_packages: validPackageIds })
          .eq('user_id', newUser.user.id);

        executeWithTimeout(updateProfilePromise, 3000).catch(profileUpdateError => {
          console.warn('⚠️ Failed to update profile with packages:', profileUpdateError?.message);
        });

        // Store package access records
        const packageAccessRecords = validPackageIds.map(packageId => ({
          user_id: newUser.user.id,
          package_id: packageId
        }));

        const packageAccessPromise = supabaseAdmin
          .from('user_package_access')
          .insert(packageAccessRecords);

        executeWithTimeout(packageAccessPromise, 3000).catch(packageAccessError => {
          console.warn('⚠️ Failed to store package access:', packageAccessError?.message);
        });
      }
    }

    // ========================================
    // 5b. STORE PRODUCT ACCESS AND SETTINGS (with timeout, non-blocking)
    // ========================================
    // Handle subscribed_products separately from packages
    if (userRoles.includes('consumer') && subscribed_products && Array.isArray(subscribed_products) && subscribed_products.length > 0) {
      const validProductIds = subscribed_products.filter(productId => isValidUUID(productId));
      
      if (validProductIds.length > 0) {
        // Build product access records with product_settings included
        const productAccessRecordsWithSettings = validProductIds.map(productId => {
          const record = {
            user_id: newUser.user.id,
            product_id: productId
          };
          
          // Add product_settings if available for this product
          if (productSettings && typeof productSettings === 'object' && productSettings[productId]) {
            const settings = productSettings[productId];
            
            // Validate and sanitize settings
            const sanitizedSettings = {};
            
            if (settings.vapi_account !== undefined && settings.vapi_account !== null && settings.vapi_account !== '') {
              sanitizedSettings.vapi_account = parseInt(settings.vapi_account);
            }
            if (settings.agent_number !== undefined && settings.agent_number !== null && settings.agent_number !== '') {
              sanitizedSettings.agent_number = parseInt(settings.agent_number);
            }
            if (settings.duration_limit !== undefined && settings.duration_limit !== null && settings.duration_limit !== '') {
              sanitizedSettings.duration_limit = parseInt(settings.duration_limit);
            }
            if (settings.list_limit !== undefined && settings.list_limit !== null && settings.list_limit !== '') {
              sanitizedSettings.list_limit = parseInt(settings.list_limit);
            }
            if (settings.concurrency_limit !== undefined && settings.concurrency_limit !== null && settings.concurrency_limit !== '') {
              sanitizedSettings.concurrency_limit = parseInt(settings.concurrency_limit);
            }
            
            // Beeba product settings
            if (settings.brands !== undefined && settings.brands !== null && settings.brands !== '') {
              sanitizedSettings.brands = parseInt(settings.brands);
            }
            if (settings.posts !== undefined && settings.posts !== null && settings.posts !== '') {
              sanitizedSettings.posts = parseInt(settings.posts);
            }
            if (settings.analysis !== undefined && settings.analysis !== null && settings.analysis !== '') {
              sanitizedSettings.analysis = parseInt(settings.analysis);
            }
            if (settings.images !== undefined && settings.images !== null && settings.images !== '') {
              sanitizedSettings.images = parseInt(settings.images);
            }
            if (settings.video !== undefined && settings.video !== null && settings.video !== '') {
              sanitizedSettings.video = parseInt(settings.video);
            }
            if (settings.carasoul !== undefined && settings.carasoul !== null && settings.carasoul !== '') {
              sanitizedSettings.carasoul = parseInt(settings.carasoul);
            }
            
            // Only add product_settings if there are valid settings
            if (Object.keys(sanitizedSettings).length > 0) {
              record.product_settings = sanitizedSettings;
            }
          }
          
          return record;
        });

        const productAccessPromise = supabaseAdmin
          .from('user_product_access')
          .insert(productAccessRecordsWithSettings)
          .select('id, product_id, product_settings');

        const { data: insertedProductAccess, error: productAccessError } = await executeWithTimeout(productAccessPromise, 3000);

        if (productAccessError) {
          console.warn('⚠️ Failed to store product access:', productAccessError?.message);
        } else {
          console.log(`✅ Stored ${insertedProductAccess.length} product access records`);
          if (productSettings && Object.keys(productSettings).length > 0) {
            console.log('✅ Product settings included in insert');
          }
        }
      }
    }

    // ========================================
    // 6. SEND WELCOME EMAIL (non-blocking)
    // ========================================
    sendWelcomeEmail({
      email,
      password,
      full_name,
      role: userRoles.join(', ')
    }).catch(emailError => {
      console.warn('⚠️ Failed to send welcome email:', emailError?.message);
    });

    // ========================================
    // 7. LOG ACTIVITY (non-blocking)
    // ========================================
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: newUser.user.id,
      actionType: 'create',
      tableName: 'profiles',
      changedFields: profileData,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 8. INVALIDATE CACHE
    // ========================================
    // Invalidate cache for users and consumers list
    await cacheService.delByPattern('users:list:*');
    await cacheService.delByPattern('consumers:*');
    console.log('✅ Cache invalidated for users and consumers list after consumer creation');

    // ========================================
    // 9. DATA SANITIZATION
    // ========================================
    const sanitizedUser = sanitizeObject({
      id: newUser.user.id,
      email: newUser.user.email,
      full_name,
      role: ['consumer'], // Array for TEXT[]
      referred_by: resellerId
    });

    res.status(201).json({
      success: true,
      user: sanitizedUser,
      message: 'Consumer created successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while creating the consumer.');
  }
};

/**
 * Update consumer created by reseller
 * @route   PUT /api/resellers/my-consumers/:id
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Data sanitization (Security)
 */
export const updateMyConsumer = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;
    const resellerId = req.user.id;
    let { full_name, phone, trial_expiry_date, country, city, subscribed_products } = req.body;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid consumer ID format'
      });
    }

    // ========================================
    // 2. VERIFY CONSUMER OWNERSHIP (with timeout)
    // ========================================
    const checkPromise = supabase
      .from('auth_role_with_profiles')
      .select('referred_by, role')
      .eq('user_id', id)
      .single();

    const { data: consumer, error: checkError } = await executeWithTimeout(checkPromise);

    if (checkError || !consumer) {
      console.error('❌ Error fetching consumer:', checkError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Consumer not found'
      });
    }

    // Check ownership
    if (consumer.referred_by !== resellerId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only update consumers you created'
      });
    }

    // Check role
    if (!hasRole(consumer.role, 'consumer')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Can only update consumers'
      });
    }

    // ========================================
    // 3. GET OLD DATA FOR LOGGING (with timeout)
    // ========================================
    const oldDataPromise = supabase
      .from('auth_role_with_profiles')
      .select('*')
      .eq('user_id', id)
      .single();

    const { data: oldConsumer } = await executeWithTimeout(oldDataPromise, 3000);

    // ========================================
    // 4. BUILD UPDATE DATA WITH SANITIZATION
    // ========================================
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = sanitizeString(full_name, 255);
    if (phone !== undefined) updateData.phone = phone ? sanitizeString(phone, 20) : null;
    if (country !== undefined) updateData.country = country ? sanitizeString(country, 100) : null;
    if (city !== undefined) updateData.city = city ? sanitizeString(city, 100) : null;
    if (trial_expiry_date !== undefined) {
      if (trial_expiry_date) {
        updateData.trial_expiry = new Date(trial_expiry_date);
      } else {
        updateData.trial_expiry = null;
      }
    }

    if (Object.keys(updateData).length === 0 && subscribed_products === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }

    // ========================================
    // 5. UPDATE CONSUMER (with timeout)
    // ========================================
    const updatePromise = supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', id)
      .select()
      .single();

    const { data: updatedConsumer, error } = await executeWithTimeout(updatePromise);

    if (error) {
      console.error('❌ Error updating consumer:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update consumer. Please try again.'
      });
    }

    // ========================================
    // 6. UPDATE PRODUCT ACCESS (with timeout, non-blocking)
    // ========================================
    if (subscribed_products !== undefined) {
      // First, delete all existing product access for this user
      const deletePromise = supabase
        .from('user_product_access')
        .delete()
        .eq('user_id', id);

      executeWithTimeout(deletePromise, 3000).then(() => {
        // Then insert new product access records if any products are provided
        if (Array.isArray(subscribed_products) && subscribed_products.length > 0) {
          const productAccessRecords = subscribed_products
            .filter(productId => isValidUUID(productId))
            .map(productId => ({
              user_id: id,
              product_id: productId
            }));

          if (productAccessRecords.length > 0) {
            const insertPromise = supabase
              .from('user_product_access')
              .insert(productAccessRecords);

            executeWithTimeout(insertPromise, 3000).catch(insertError => {
              console.warn('⚠️ Failed to update product access:', insertError?.message);
            });
          }
        }
      }).catch(deleteError => {
        console.warn('⚠️ Failed to delete existing product access:', deleteError?.message);
      });
    }

    // ========================================
    // 7. LOG ACTIVITY (non-blocking)
    // ========================================
    const changedFields = {};
    Object.keys(updateData).forEach(key => {
      if (oldConsumer && oldConsumer[key] !== updateData[key]) {
        changedFields[key] = {
          old: oldConsumer[key],
          new: updateData[key]
        };
      }
    });

    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'update',
      tableName: 'profiles',
      changedFields: changedFields,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 8. CACHE INVALIDATION
    // ========================================
    await cacheService.delByPattern('users:list:*');
    await cacheService.delByPattern('consumers:*');
    console.log('✅ Cache invalidated for consumer update');

    // ========================================
    // 9. DATA SANITIZATION
    // ========================================
    const sanitizedConsumer = sanitizeObject(updatedConsumer);

    res.json({
      success: true,
      user: sanitizedConsumer,
      message: 'Consumer updated successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating the consumer.');
  }
};

/**
 * Delete consumer created by reseller
 * @route   DELETE /api/resellers/my-consumers/:id
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const deleteMyConsumer = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;
    const resellerId = req.user.id;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid consumer ID format'
      });
    }

    // ========================================
    // 2. VERIFY CONSUMER OWNERSHIP (with timeout)
    // ========================================
    const checkPromise = supabase
      .from('auth_role_with_profiles')
      .select('referred_by, role')
      .eq('user_id', id)
      .single();

    const { data: consumer, error: checkError } = await executeWithTimeout(checkPromise);

    if (checkError || !consumer) {
      console.error('❌ Error fetching consumer:', checkError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Consumer not found'
      });
    }

    // Check ownership
    if (consumer.referred_by !== resellerId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only delete consumers you created'
      });
    }

    // Check role
    if (!hasRole(consumer.role, 'consumer')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Can only delete consumers'
      });
    }

    // ========================================
    // 3. GET FULL DATA FOR LOGGING (with timeout)
    // ========================================
    const fullDataPromise = supabase
      .from('auth_role_with_profiles')
      .select('*')
      .eq('user_id', id)
      .single();

    const { data: fullConsumer } = await executeWithTimeout(fullDataPromise, 3000);

    // ========================================
    // 4. LOG ACTIVITY BEFORE DELETION (non-blocking)
    // ========================================
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'delete',
      tableName: 'profiles',
      changedFields: fullConsumer || consumer || null,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // 5. ROBUST DATA CLEANUP (FOREIGN KEY HELL)
    // ========================================
    const cleanupSuccess = await performFullUserCleanup(id);
    
    if (!cleanupSuccess) {
      return res.status(500).json({
        success: false,
        error: 'CLEANUP_FAILED',
        message: 'Failed to clean up consumer data. The deletion was aborted to prevent data corruption.'
      });
    }

    // ========================================
    // 6. DELETE FROM AUTH (non-blocking)
    // ========================================
    if (supabaseAdmin) {
      supabaseAdmin.auth.admin.deleteUser(id).catch(deleteAuthError => {
        console.warn('⚠️ Error deleting auth user:', deleteAuthError?.message);
      });
    }

    // ========================================
    // 7. CACHE INVALIDATION
    // ========================================
    await cacheService.delByPattern('users:list:*');
    await cacheService.delByPattern('consumers:*');
    console.log('✅ Cache invalidated for consumer deletion');

    res.json({
      success: true,
      message: 'Consumer deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while deleting the consumer.');
  }
};

/**
 * Reset password for consumer created by reseller
 * @route   POST /api/resellers/my-consumers/:id/reset-password
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Secure error handling (Security)
 */
export const resetMyConsumerPassword = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;
    const resellerId = req.user.id;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid consumer ID format'
      });
    }

    // ========================================
    // 2. VERIFY CONSUMER OWNERSHIP (with timeout)
    // ========================================
    const checkPromise = supabase
      .from('auth_role_with_profiles')
      .select('referred_by, role, full_name')
      .eq('user_id', id)
      .single();

    const { data: consumer, error: checkError } = await executeWithTimeout(checkPromise);

    if (checkError || !consumer) {
      console.error('❌ Error fetching consumer:', checkError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Consumer not found'
      });
    }

    // Check ownership
    if (consumer.referred_by !== resellerId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only reset passwords for consumers you created'
      });
    }

    // Check role
    if (!hasRole(consumer.role, 'consumer')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Can only reset password for consumers'
      });
    }

    // ========================================
    // 3. GENERATE AND UPDATE PASSWORD
    // ========================================
    const newPassword = generatePassword();

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to reset password. Please try again.'
      });
    }

    // ========================================
    // 4. GET USER EMAIL AND SEND RESET EMAIL (non-blocking)
    // ========================================
    supabaseAdmin.auth.admin.getUserById(id).then(({ data: authUser }) => {
      if (authUser?.user?.email) {
        sendPasswordResetEmail({
          email: authUser.user.email,
          new_password: newPassword,
          full_name: consumer.full_name || 'User'
        }).catch(emailError => {
          console.warn('⚠️ Failed to send password reset email:', emailError?.message);
        });
      }
    }).catch(getUserError => {
      console.warn('⚠️ Failed to get user email:', getUserError?.message);
    });

    res.json({
      success: true,
      message: 'Password reset successfully. Email sent to consumer.'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while resetting the password.');
  }
};

/**
 * Create new consumer (admin only)
 * @route   POST /api/resellers/create-consumer
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const createConsumerAdmin = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { email, password, full_name, phone, trial_expiry_date, country, city, referred_by, subscribed_products, subscribed_packages ,productSettings} = req.body;
    
    // Validate required fields
    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'FullName, Email, password are required'
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Validate referred_by if provided
    if (referred_by && !isValidUUID(referred_by)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid referred_by ID format'
      });
    }

    // Sanitize inputs
    email = email.toLowerCase().trim();
    full_name = sanitizeString(full_name, 255);
    country = country ? sanitizeString(country, 100) : null;
    city = city ? sanitizeString(city, 100) : null;
    phone = phone ? sanitizeString(phone, 20) : null;

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Configuration Error',
        message: 'Admin client not configured'
      });
    }

    // Get referred_by from request body or from token
    let finalReferredBy = referred_by;
    if (!finalReferredBy && req.user && req.user.id) {
      finalReferredBy = req.user.id;
    }

    // ========================================
    // 2. VERIFY REFERRED_BY RESELLER (with timeout)
    // ========================================
    let isReferredByReseller = false;
    if (referred_by && referred_by !== req.user?.id) {
      const resellerPromise = supabaseAdmin
        .from('auth_role_with_profiles')
        .select('user_id, role')
        .eq('user_id', referred_by)
        .contains('role', ['reseller'])
        .single();

      const { data: reseller, error: resellerError } = await executeWithTimeout(resellerPromise);

      if (resellerError || !reseller) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid referred_by: Reseller not found'
        });
      }
      isReferredByReseller = true;
    }

    // ========================================
    // 3. CHECK MAX CONSUMERS LIMIT (with timeout)
    // ========================================
    if (isReferredByReseller) {
      const { getResellerSettings } = await import('../../utils/resellerSettings.js');
      const resellerSettings = await getResellerSettings();
      
      if (resellerSettings.maxConsumersPerReseller !== null && resellerSettings.maxConsumersPerReseller > 0) {
        const countPromise = supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('referred_by', referred_by)
          .contains('role', ['consumer']); // Check if role array contains 'consumer'

        const { count: currentConsumerCount, error: countError } = await executeWithTimeout(countPromise);

        if (countError) {
        } else if (currentConsumerCount >= resellerSettings.maxConsumersPerReseller) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: `Maximum consumers limit reached for this reseller. The reseller can only have ${resellerSettings.maxConsumersPerReseller} consumer(s).`
          });
        }
      }
    }

    // Create user with Supabase Admin
    const createUserPayload = {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || '',
        role: ['consumer'], // Array for TEXT[]
        country: country || '',
        city: city || '',
      }
    };

    // Only include phone if it's defined
    if (phone) {
      createUserPayload.phone = phone;
    }

    // ========================================
    // 4. CREATE USER
    // ========================================
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser(createUserPayload);

    if (createError) {
      console.error('❌ Error creating user:', createError);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: createError.message || 'Failed to create user'
      });
    }

    // ========================================
    // 5. CREATE PROFILE (with timeout)
    // ========================================
    const profileData = {
      user_id: newUser.user.id,
      full_name,
      role: ['consumer'], // Array for TEXT[]
      phone: phone || null,
      country: country || null,
      city: city || null,
      referred_by: finalReferredBy || null,
      account_status: 'active',
    };

    // Add trial_expiry if provided
    if (trial_expiry_date) {
      profileData.trial_expiry = new Date(trial_expiry_date);
    }

    const profilePromise = supabaseAdmin
      .from('profiles')
      .upsert([profileData]);

    const { error: insertError } = await executeWithTimeout(profilePromise);

    if (insertError) {
      console.error('❌ Error inserting profile:', insertError);
      // Try to delete the created user if profile insert fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      } catch (deleteError) {
        console.error('Error deleting failed user:', deleteError);
      }
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create consumer profile. Please try again.'
      });
    }

    // ========================================
    // 6. STORE PACKAGE ACCESS (with timeout, non-blocking)
    // ========================================
    // Support both subscribed_packages (new) and subscribed_products (backward compatibility)
    const packagesToStore = subscribed_packages || subscribed_products || [];
    
    if (packagesToStore && Array.isArray(packagesToStore) && packagesToStore.length > 0) {
      // Validate package IDs and store in profiles.subscribed_packages
      const validPackageIds = packagesToStore.filter(packageId => isValidUUID(packageId));
      
      if (validPackageIds.length > 0) {
        // Update profile with subscribed_packages array
        const updateProfilePromise = supabaseAdmin
          .from('profiles')
          .update({ subscribed_packages: validPackageIds })
          .eq('user_id', newUser.user.id);

        executeWithTimeout(updateProfilePromise, 3000).catch(profileUpdateError => {
          console.warn('⚠️ Failed to update profile with packages:', profileUpdateError?.message);
        });

        // Store package access records
        const packageAccessRecords = validPackageIds.map(packageId => ({
          user_id: newUser.user.id,
          package_id: packageId
        }));

        const packageAccessPromise = supabaseAdmin
          .from('user_package_access')
          .insert(packageAccessRecords);

        executeWithTimeout(packageAccessPromise, 3000).catch(packageAccessError => {
          console.warn('⚠️ Failed to store package access:', packageAccessError?.message);
        });
      }
    }

    // ========================================
    // 6b. STORE PRODUCT ACCESS AND SETTINGS (with timeout, non-blocking)
    // ========================================
    // Handle subscribed_products separately from packages
    if (subscribed_products && Array.isArray(subscribed_products) && subscribed_products.length > 0) {
      const validProductIds = subscribed_products.filter(productId => isValidUUID(productId));
      
      if (validProductIds.length > 0) {
        // Build product access records with product_settings included
        const productAccessRecordsWithSettings = validProductIds.map(productId => {
          const record = {
            user_id: newUser.user.id,
            product_id: productId
          };
          
          // Add product_settings if available for this product
          if (productSettings && typeof productSettings === 'object' && productSettings[productId]) {
            const settings = productSettings[productId];
            
            // Validate and sanitize settings
            const sanitizedSettings = {};
            
            if (settings.vapi_account !== undefined && settings.vapi_account !== null && settings.vapi_account !== '') {
              sanitizedSettings.vapi_account = parseInt(settings.vapi_account);
            }
            if (settings.agent_number !== undefined && settings.agent_number !== null && settings.agent_number !== '') {
              sanitizedSettings.agent_number = parseInt(settings.agent_number);
            }
            if (settings.duration_limit !== undefined && settings.duration_limit !== null && settings.duration_limit !== '') {
              sanitizedSettings.duration_limit = parseInt(settings.duration_limit);
            }
            if (settings.list_limit !== undefined && settings.list_limit !== null && settings.list_limit !== '') {
              sanitizedSettings.list_limit = parseInt(settings.list_limit);
            }
            if (settings.concurrency_limit !== undefined && settings.concurrency_limit !== null && settings.concurrency_limit !== '') {
              sanitizedSettings.concurrency_limit = parseInt(settings.concurrency_limit);
            }
            
            // Beeba product settings
            if (settings.brands !== undefined && settings.brands !== null && settings.brands !== '') {
              sanitizedSettings.brands = parseInt(settings.brands);
            }
            if (settings.posts !== undefined && settings.posts !== null && settings.posts !== '') {
              sanitizedSettings.posts = parseInt(settings.posts);
            }
            if (settings.analysis !== undefined && settings.analysis !== null && settings.analysis !== '') {
              sanitizedSettings.analysis = parseInt(settings.analysis);
            }
            if (settings.images !== undefined && settings.images !== null && settings.images !== '') {
              sanitizedSettings.images = parseInt(settings.images);
            }
            if (settings.video !== undefined && settings.video !== null && settings.video !== '') {
              sanitizedSettings.video = parseInt(settings.video);
            }
            if (settings.carasoul !== undefined && settings.carasoul !== null && settings.carasoul !== '') {
              sanitizedSettings.carasoul = parseInt(settings.carasoul);
            }
            
            // Only add product_settings if there are valid settings
            if (Object.keys(sanitizedSettings).length > 0) {
              record.product_settings = sanitizedSettings;
            }
          }
          
          return record;
        });

        const productAccessPromise = supabaseAdmin
          .from('user_product_access')
          .insert(productAccessRecordsWithSettings)
          .select('id, product_id, product_settings');

        const { data: insertedProductAccess, error: productAccessError } = await executeWithTimeout(productAccessPromise, 3000);

        if (productAccessError) {
          console.warn('⚠️ Failed to store product access:', productAccessError?.message);
        } else {
          console.log(`✅ Stored ${insertedProductAccess.length} product access records`);
          if (productSettings && Object.keys(productSettings).length > 0) {
            console.log('✅ Product settings included in insert');
          }
        }
      }
    }

    // ========================================
    // 7. SEND WELCOME EMAIL (non-blocking)
    // ========================================
    sendWelcomeEmail({
      email,
      full_name,
      password,
      role: ['consumer'] // Array for TEXT[]
    }).catch(emailError => {
      console.warn('⚠️ Failed to send welcome email:', emailError?.message);
    });

    // ========================================
    // 8. LOG ACTIVITY (non-blocking)
    // ========================================
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: newUser.user.id,
      actionType: 'create',
      tableName: 'profiles',
      changedFields: profileData,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 9. INVALIDATE CACHE
    // ========================================
    // Invalidate cache for users and consumers list
    await cacheService.delByPattern('users:list:*');
    await cacheService.delByPattern('consumers:*');
    console.log('✅ Cache invalidated for users and consumers list after admin consumer creation');

    // ========================================
    // 10. DATA SANITIZATION
    // ========================================
    const sanitizedUser = sanitizeObject({
      id: newUser.user.id,
      email: newUser.user.email,
      full_name,
      role: ['consumer'], // Array for TEXT[]
      phone: phone || null,
      country: country || null,
      city: city || null,
    });

    res.status(201).json({
      success: true,
      user: sanitizedUser
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while creating the consumer.');
  }
};

/**
 * Update reseller account status (admin only)
 * @route   PATCH /api/resellers/:id/account-status
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format, status validation)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const updateResellerAccountStatus = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;
    let { account_status } = req.body;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID format'
      });
    }

    // Validate account_status
    const validStatuses = ['active', 'deactive'];
    if (!account_status) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'account_status is required'
      });
    }

    account_status = sanitizeString(account_status, 20);
    if (!validStatuses.includes(account_status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid account_status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // ========================================
    // 2. CHECK IF RESELLER EXISTS (with timeout)
    // ========================================
    const checkPromise = supabaseAdmin
      .from('auth_role_with_profiles')
      .select('role, account_status')
      .eq('user_id', id)
      .maybeSingle();

    const { data: resellerProfile, error: fetchError } = await executeWithTimeout(checkPromise);

    if (fetchError || !resellerProfile) {
      console.error('❌ Error fetching reseller:', fetchError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found'
      });
    }

    // ========================================
    // 3. UPDATE ACCOUNT STATUS (with timeout)
    // ========================================
    const updatePromise = supabaseAdmin
      .from('profiles')
      .upsert({ 
        user_id: id,
        account_status: account_status,
        updated_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    const { data: updatedReseller, error: updateError } = await executeWithTimeout(updatePromise);

    if (updateError) {
      console.error('❌ Error updating reseller account status:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update account status. Please try again.'
      });
    }

    // ========================================
    // 4. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.RESELLER_BY_ID(id));
    await cacheService.delByPattern('users:list:*');
    await cacheService.delByPattern('resellers:*');
    await cacheService.delByPattern('consumers:*');
    console.log('✅ Cache invalidated for reseller account status update');

    // ========================================
    // 5. DATA SANITIZATION
    // ========================================
    const sanitizedData = sanitizeObject(updatedReseller);

    res.json({
      success: true,
      message: `Reseller account status updated to ${account_status}`,
      data: sanitizedData
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating the reseller account status.');
  }
};



/**
 * Get all referred resellers (reseller can see their own, admin sees all)
 * @route   GET /api/resellers/referred-resellers
 * @access  Private (Reseller and Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Data sanitization (Security)
 */
export const getAllReferredResellers = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const currentUserId = req.user.id;

    if (!currentUserId || !isValidUUID(currentUserId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }

    // ========================================
    // 2. GET USER PROFILE (with timeout)
    // ========================================
    const profilePromise = supabaseAdmin
      .from('auth_role_with_profiles')
      .select('role')
      .eq('user_id', currentUserId)
      .maybeSingle();

    const { data: currentUserProfile } = await executeWithTimeout(profilePromise, 3000);

    const isAdmin = hasRole(currentUserProfile?.role, 'admin');

    // ========================================
    // 3. BUILD QUERY (with timeout)
    // ========================================
    let query = supabase
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email, role, referred_by, account_status, created_at')
      .contains('role', ['reseller']); // Use contains for array role column

    // If reseller, only show their referred resellers
    if (!isAdmin) {
      query = query.eq('referred_by', currentUserId);
    }

    // ========================================
    // 4. EXECUTE QUERY (with timeout)
    // ========================================
    const { data: resellers, error } = await executeWithTimeout(
      query.order('created_at', { ascending: false })
    );

    if (error) {
      console.error('❌ Error fetching referred resellers:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch referred resellers. Please try again.'
      });
    }

    // ========================================
    // 5. DATA SANITIZATION
    // ========================================
    const sanitizedResellers = sanitizeArray(resellers || []);

    res.json({
      success: true,
      count: sanitizedResellers.length,
      data: sanitizedResellers
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching referred resellers.');
  }
};

/**
 * Get reseller's own resellers
 * @route   GET /api/resellers/my-resellers?search=
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Batch queries (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getMyResellers = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const resellerId = req.user.id;
    let { search } = req.query;

    if (!resellerId || !isValidUUID(resellerId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID'
      });
    }

    // Sanitize search
    const searchTerm = search ? validateAndSanitizeSearch(search, 100) : null;

    // ========================================
    // 2. BUILD QUERY (with timeout)
    // ========================================
    let query = supabase
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email, role, referred_by, account_status, created_at')
      .contains('role', ['reseller']) // Use contains for array role column
      .eq('referred_by', resellerId);

    // Optional search
    if (searchTerm) {
      query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const { data: resellers, error } = await executeWithTimeout(
      query.order('created_at', { ascending: false })
    );

    if (error) {
      console.error('❌ Error fetching my resellers:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch resellers. Please try again.'
      });
    }

    // ========================================
    // 3. GET DEFAULT COMMISSION (with timeout)
    // ========================================
    const defaultSettingPromise = supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'default_reseller_commission')
      .single();

    const { data: defaultSetting } = await executeWithTimeout(defaultSettingPromise, 3000);
    const defaultCommission = defaultSetting ? parseFloat(defaultSetting.setting_value) : 10.00;

    // ========================================
    // 4. BATCH GET COMMISSION INFO (with timeout)
    // ========================================
    const resellerIds = (resellers || []).map(r => r.user_id);
    let commissionMap = new Map();
    
    if (resellerIds.length > 0) {
      const commissionPromise = supabaseAdmin
        .from('auth_role_with_profiles')
        .select('user_id, commission_rate, commission_updated_at')
        .in('user_id', resellerIds);

      const { data: profilesWithCommission } = await executeWithTimeout(commissionPromise, 3000);
      
      (profilesWithCommission || []).forEach(profile => {
        commissionMap.set(profile.user_id, {
          commission_rate: profile.commission_rate,
          commission_updated_at: profile.commission_updated_at
        });
      });
    }

    // ========================================
    // 5. BATCH COUNT CONSUMERS (with timeout)
    // ========================================
    const resellerWithCounts = await Promise.all(
      (resellers || []).map(async (reseller) => {
        const countPromise = supabase
          .from('auth_role_with_profiles')
          .select('user_id', { count: 'exact', head: true })
          .eq('referred_by', reseller.user_id)
          .contains('role', ['consumer']); // Check if role array contains 'consumer'

        const { count } = await executeWithTimeout(countPromise, 3000);

        // Commission info
        const commissionData = commissionMap.get(reseller.user_id);
        const customCommission = commissionData?.commission_rate ? parseFloat(commissionData.commission_rate) : null;
        const effectiveCommission = customCommission !== null ? customCommission : defaultCommission;
        const commissionType = customCommission !== null ? 'custom' : 'default';

        return {
          ...reseller,
          referred_count: typeof count === 'number' ? count : 0,
          commission_rate: effectiveCommission,
          commission_type: commissionType,
          custom_commission: customCommission,
          default_commission: defaultCommission,
          commission_updated_at: commissionData?.commission_updated_at || null
        };
      })
    );

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedResellers = sanitizeArray(resellerWithCounts);

    res.json({
      success: true,
      count: sanitizedResellers.length,
      data: sanitizedResellers,
      search: searchTerm || ''
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching resellers.');
  }
};


/**
 * Get reseller by ID (reseller can only see their own resellers)
 * @route   GET /api/resellers/my-resellers/:id
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Data sanitization (Security)
 */
export const getMyResellerById = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;
    const resellerId = req.user.id;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID format'
      });
    }

    // ========================================
    // 2. VERIFY AND FETCH RESELLER (with timeout)
    // ========================================
    const queryPromise = supabase
      .from('auth_role_with_profiles')
      .select('user_id, full_name, email, role, referred_by, account_status, created_at')
      .eq('user_id', id)
      .contains('role', ['reseller']) // Use contains for array role column
      .eq('referred_by', resellerId)
      .single();

    const { data: reseller, error: checkError } = await executeWithTimeout(queryPromise);

    if (checkError || !reseller) {
      console.error('❌ Error fetching reseller:', checkError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found or you do not have permission to view it'
      });
    }

    // ========================================
    // 3. DATA SANITIZATION
    // ========================================
    const sanitizedReseller = sanitizeObject(reseller);

    res.json({
      success: true,
      data: sanitizedReseller
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the reseller.');
  }
};

/**
 * Update reseller (reseller can only update their own resellers)
 * @route   PUT /api/resellers/my-resellers/:id
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format, required fields)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Data sanitization (Security)
 */
export const updateMyReseller = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { id } = req.params;
    const resellerId = req.user.id;
    let { full_name, phone, country, city, nickname } = req.body;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID format'
      });
    }

    // Validate required fields
    if (!country || !city || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Country, city, and phone are required'
      });
    }

    // Sanitize inputs
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = sanitizeString(full_name, 255);
    updateData.phone = sanitizeString(phone, 20);
    updateData.country = sanitizeString(country, 100);
    updateData.city = sanitizeString(city, 100);
    
    // Handle nickname (optional)
    if (nickname !== undefined) {
      updateData.nickname = nickname ? sanitizeString(nickname, 100) : null;
    }

    // ========================================
    // 2. VERIFY OWNERSHIP (with timeout)
    // ========================================
    const checkPromise = supabase
      .from('auth_role_with_profiles')
      .select('referred_by, role')
      .eq('user_id', id)
      .contains('role', ['reseller']) // Check if role array contains 'reseller'
      .single();

    const { data: reseller, error: checkError } = await executeWithTimeout(checkPromise);

    if (checkError || !reseller) {
      console.error('❌ Error fetching reseller:', checkError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found'
      });
    }

    if (reseller.referred_by !== resellerId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only update resellers you created'
      });
    }

    // ========================================
    // 3. GET OLD DATA FOR LOGGING (with timeout)
    // ========================================
    const oldDataPromise = supabase
      .from('auth_role_with_profiles')
      .select('*')
      .eq('user_id', id)
      .single();

    const { data: oldReseller } = await executeWithTimeout(oldDataPromise, 3000);

    // ========================================
    // 4. UPDATE RESELLER (with timeout)
    // ========================================
    const updatePromise = supabaseAdmin
      .from('profiles')
      .upsert({ user_id: id, ...updateData, updated_at: new Date().toISOString() })
      .select()
      .maybeSingle();

    const { data: updatedReseller, error } = await executeWithTimeout(updatePromise);

    if (error) {
      console.error('❌ Error updating reseller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update reseller. Please try again.'
      });
    }

    // ========================================
    // 5. LOG ACTIVITY (non-blocking)
    // ========================================
    const changedFields = {};
    Object.keys(updateData).forEach(key => {
      if (oldReseller && oldReseller[key] !== updateData[key]) {
        changedFields[key] = {
          old: oldReseller[key],
          new: updateData[key]
        };
      }
    });

    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'update',
      tableName: 'profiles',
      changedFields: changedFields,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedData = sanitizeObject(updatedReseller);

    res.json({
      success: true,
      message: 'Reseller updated successfully',
      data: sanitizedData
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating the reseller.');
  }
};

/**
 * Create reseller (reseller can create other resellers)
 * @route   POST /api/resellers/my-resellers
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const createMyReseller = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const resellerId = req.user.id;
    let { email, password, full_name, phone, country, city, nickname } = req.body;

    // Validate required fields
    if (!email || !password || !full_name || !country ) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'FullName, Email, password, country are required'
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Sanitize inputs
    email = email.toLowerCase().trim();
    full_name = sanitizeString(full_name, 255);
    country = sanitizeString(country, 100);
    city = sanitizeString(city, 100);
    phone = phone ? sanitizeString(phone, 20) : null;

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Configuration Error',
        message: 'Admin client not configured'
      });
    }

    // ========================================
    // 2. GET RESELLER SETTINGS (with timeout)
    // ========================================
    const { getResellerSettings } = await import('../../utils/resellerSettings.js');
    const resellerSettings = await getResellerSettings();
    
    const accountStatus = resellerSettings.requireResellerApproval ? 'pending' : 'active';

    // ========================================
    // 3. CREATE USER
    // ========================================
    const createUserPayload = {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || '',
        country: country || '',
        city: city || '',
        role: ['reseller'] // Array for TEXT[]
      }
    };

    if (phone) {
      createUserPayload.phone = phone;
    }

    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser(createUserPayload);

    if (createError) {
      console.error('❌ Error creating user:', createError);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: createError.message || 'Failed to create user'
      });
    }

    // ========================================
    // 4. CREATE PROFILE (with timeout)
    // ========================================
    const profileData = {
      user_id: newUser.user.id,
      full_name,
      role: ['reseller'], // Array for TEXT[]
      phone: phone || null,
      country: country || null,
      city: city || null,
      referred_by: resellerId,
      nickname: nickname ? sanitizeString(nickname, 100) : null,
      commission_rate: null,
      commission_updated_at: null,
      account_status: accountStatus
    };

    const profilePromise = supabaseAdmin
      .from('profiles')
      .upsert([profileData]);

    const { error: insertError } = await executeWithTimeout(profilePromise);

    if (insertError) {
      console.error('❌ Error inserting profile:', insertError);
      // Try to delete the created user if profile insert fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      } catch (deleteError) {
        console.error('Error deleting failed user:', deleteError);
      }
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create reseller profile. Please try again.'
      });
    }

    // ========================================
    // 5. SEND WELCOME EMAIL (non-blocking)
    // ========================================
    sendWelcomeEmail({
      email,
      full_name,
      password,
      role: ['reseller'] // Array for TEXT[]
    }).catch(emailError => {
      console.warn('⚠️ Failed to send welcome email:', emailError?.message);
    });

    // ========================================
    // 6. LOG ACTIVITY (non-blocking)
    // ========================================
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: newUser.user.id,
      actionType: 'create',
      tableName: 'profiles',
      changedFields: profileData,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 7. CACHE INVALIDATION
    // ========================================
    await cacheService.delByPattern('resellers:*');
    console.log('✅ Cache invalidated for reseller creation');

    // ========================================
    // 8. DATA SANITIZATION
    // ========================================
    const sanitizedUser = sanitizeObject({
      id: newUser.user.id,
      email: newUser.user.email,
      full_name,
      role: ['reseller'], // Array for TEXT[]
      phone: phone || null,
      country: country || null,
      city: city || null,
    });

    res.status(201).json({
      success: true,
      user: sanitizedUser
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while creating the reseller.');
  }
};

/**
 * Delete reseller (reseller can only delete their own resellers)
 * @route   DELETE /api/resellers/my-resellers/:id
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const deleteMyReseller = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;
    const resellerId = req.user.id;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID format'
      });
    }

    // ========================================
    // 2. VERIFY OWNERSHIP (with timeout)
    // ========================================
    const checkPromise = supabase
      .from('auth_role_with_profiles')
      .select('referred_by, role')
      .eq('user_id', id)
      .contains('role', ['reseller']) // Check if role array contains 'reseller'
      .single();

    const { data: reseller, error: checkError } = await executeWithTimeout(checkPromise);

    if (checkError || !reseller) {
      console.error('❌ Error fetching reseller:', checkError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found'
      });
    }

    if (reseller.referred_by !== resellerId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only delete resellers you created'
      });
    }

    // ========================================
    // 3. GET FULL DATA FOR LOGGING (with timeout)
    // ========================================
    const fullDataPromise = supabase
      .from('auth_role_with_profiles')
      .select('*')
      .eq('user_id', id)
      .single();

    const { data: fullReseller } = await executeWithTimeout(fullDataPromise, 3000);

    // ========================================
    // 4. LOG ACTIVITY BEFORE DELETION (non-blocking)
    // ========================================
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'delete',
      tableName: 'profiles',
      changedFields: fullReseller || reseller || null,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 5. DELETE FROM PROFILES (with timeout)
    // ========================================
    const deleteProfilePromise = supabase
      .from('profiles')
      .delete()
      .eq('user_id', id);

    const { error: deleteProfileError } = await executeWithTimeout(deleteProfilePromise);

    if (deleteProfileError) {
      console.error('❌ Error deleting profile:', deleteProfileError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to delete reseller. Please try again.'
      });
    }

    // ========================================
    // 6. DELETE FROM AUTH (non-blocking)
    // ========================================
    if (supabaseAdmin) {
      supabaseAdmin.auth.admin.deleteUser(id).catch(authError => {
        console.warn('⚠️ Error deleting user from auth:', authError?.message);
      });
    }

    // ========================================
    // 7. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.RESELLER_BY_ID(id));
    await cacheService.delByPattern('resellers:*');
    console.log('✅ Cache invalidated for reseller deletion');

    res.json({
      success: true,
      message: 'Reseller deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while deleting the reseller.');
  }
};

