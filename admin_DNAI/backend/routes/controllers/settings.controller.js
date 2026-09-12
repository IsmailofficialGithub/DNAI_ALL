import { supabaseAdmin } from '../../config/database.js';
import { getActorInfo, logActivity, getClientIp, getUserAgent } from '../../services/activityLogger.js';
import { cacheService } from '../../config/redis.js';
import {
  sanitizeString,
  isValidUUID,
  sanitizeObject
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError,
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';
import { hasRole } from '../../utils/roleUtils.js';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_KEYS = {
  DEFAULT_COMMISSION: 'settings:default-commission',
  RESELLER_SETTINGS: 'settings:reseller',
  RESELLER_COMMISSION: (id) => `settings:reseller-commission:${id}`,
  MY_COMMISSION: (id) => `settings:my-commission:${id}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('settings', 100);

/**
 * Settings Controller
 * Handles application settings including default commission
 */

/**
 * Get default reseller commission (admin only)
 * @route   GET /api/settings/default-commission
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Redis caching (Performance)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const getDefaultCommission = async (req, res) => {
  try {
    // ========================================
    // 1. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.DEFAULT_COMMISSION;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for default commission');
      return res.json(cachedData);
    }

    console.log('❌ Cache MISS for default commission - fetching from database');

    // ========================================
    // 2. FETCH SETTING (with timeout)
    // ========================================
    const queryPromise = supabaseAdmin
      .from('app_settings')
      .select('setting_key, setting_value, description, updated_at')
      .eq('setting_key', 'default_reseller_commission')
      .single();

    const { data: setting, error } = await executeWithTimeout(queryPromise);

    if (error) {
      console.error('❌ Error fetching default commission:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch default commission'
      });
    }

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Default commission setting not found'
      });
    }

    // ========================================
    // 3. PREPARE RESPONSE
    // ========================================
    const response = {
      success: true,
      data: {
        commissionRate: parseFloat(setting.setting_value) || 0,
        description: setting.description,
        updatedAt: setting.updated_at
      }
    };

    // ========================================
    // 4. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching default commission.');
  }
};

/**
 * Update default reseller commission (admin only)
 * @route   PUT /api/settings/default-commission
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const updateDefaultCommission = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { commissionRate } = req.body;
    const adminId = req.user?.id;

    // Validate commission rate
    if (commissionRate === undefined || commissionRate === null) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Commission rate is required'
      });
    }

    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Commission rate must be a number between 0 and 100'
      });
    }

    // ========================================
    // 2. UPDATE SETTING (with timeout)
    // ========================================
    const upsertPromise = supabaseAdmin
      .from('app_settings')
      .upsert({
        setting_key: 'default_reseller_commission',
        setting_value: rate.toFixed(2),
        description: 'Default commission rate for resellers (percentage)',
        updated_at: new Date().toISOString(),
        updated_by: adminId
      }, {
        onConflict: 'setting_key'
      })
      .select()
      .single();

    const { data: setting, error: upsertError } = await executeWithTimeout(upsertPromise);

    if (upsertError) {
      console.error('❌ Error updating default commission:', upsertError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update default commission'
      });
    }

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    await logActivity({
      actorId,
      actorRole,
      targetId: null,
      actionType: 'update',
      tableName: 'app_settings',
      changedFields: {
        setting_key: 'default_reseller_commission',
        old_value: setting?.setting_value || null,
        new_value: rate.toFixed(2)
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    // ========================================
    // 3. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.DEFAULT_COMMISSION);
    await cacheService.delByPattern('settings:reseller-commission:*');
    await cacheService.delByPattern('settings:my-commission:*');
    console.log('✅ Cache invalidated for default commission update');

    // ========================================
    // 4. DATA SANITIZATION
    // ========================================
    const sanitizedData = sanitizeObject({
      commissionRate: rate,
      updatedAt: setting.updated_at
    });

    res.json({
      success: true,
      message: 'Default commission updated successfully',
      data: sanitizedData
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating default commission.');
  }
};

/**
 * Get reseller's own commission (effective commission - custom or default)
 * @route   GET /api/resellers/my-commission
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Redis caching (Performance)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const getMyCommission = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const resellerId = req.user.id;
    
    if (!resellerId || !isValidUUID(resellerId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.MY_COMMISSION(resellerId);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for my commission ${resellerId}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for my commission ${resellerId} - fetching from database`);
    
    // ========================================
    // 3. FETCH USER PROFILE (with timeout)
    // ========================================
    const profilePromise = supabaseAdmin
      .from('profiles')
      .select('role, account_status')
      .eq('user_id', resellerId)
      .single();

    const { data: userProfile, error: profileError } = await executeWithTimeout(profilePromise);

    if (profileError || !userProfile) {
      console.error('❌ Error fetching user profile:', profileError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User profile not found'
      });
    }

    // Only resellers can access this endpoint
    if (!hasRole(userProfile.role, 'reseller')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Reseller access required'
      });
    }

    // Check if account is deactivated
    if (userProfile.account_status === 'deactive') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Your account has been deactivated. Please contact the administrator.'
      });
    }

    // ========================================
    // 4. GET RESELLER PROFILE (with timeout)
    // ========================================
    const resellerPromise = supabaseAdmin
      .from('profiles')
      .select('user_id, commission_rate, commission_updated_at')
      .eq('user_id', resellerId)
      .contains('role', ['reseller'])
      .single();

    const { data: reseller, error: resellerError } = await executeWithTimeout(resellerPromise);

    if (resellerError || !reseller) {
      console.error('❌ Error fetching reseller profile:', resellerError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller profile not found'
      });
    }

    // ========================================
    // 5. GET DEFAULT COMMISSION (with timeout)
    // ========================================
    const defaultSettingPromise = supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'default_reseller_commission')
      .single();

    const { data: defaultSetting } = await executeWithTimeout(defaultSettingPromise, 3000);

    const defaultCommission = defaultSetting ? parseFloat(defaultSetting.setting_value) : 10.00;
    const effectiveCommission = reseller.commission_rate !== null 
      ? parseFloat(reseller.commission_rate) 
      : defaultCommission;

    // ========================================
    // 6. PREPARE RESPONSE
    // ========================================
    const response = {
      success: true,
      data: {
        resellerId: resellerId,
        commissionRate: effectiveCommission,
        commissionType: reseller.commission_rate !== null ? 'custom' : 'default',
        customCommission: reseller.commission_rate ? parseFloat(reseller.commission_rate) : null,
        defaultCommission: defaultCommission,
        updatedAt: reseller.commission_updated_at
      }
    };

    // ========================================
    // 7. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching commission.');
  }
};

/**
 * Get reseller commission (effective commission - custom or default) (admin only)
 * @route   GET /api/resellers/:id/commission
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Redis caching (Performance)
 * 3. Query timeout (Performance)
 * 4. Secure error handling (Security)
 */
export const getResellerCommission = async (req, res) => {
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
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.RESELLER_COMMISSION(id);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for reseller commission ${id}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for reseller commission ${id} - fetching from database`);

    // ========================================
    // 3. GET RESELLER PROFILE (with timeout)
    // ========================================
    const resellerPromise = supabaseAdmin
      .from('profiles')
      .select('user_id, commission_rate, commission_updated_at')
      .eq('user_id', id)
      .contains('role', ['reseller'])
      .single();

    const { data: reseller, error: resellerError } = await executeWithTimeout(resellerPromise);

    if (resellerError || !reseller) {
      console.error('❌ Error fetching reseller:', resellerError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found'
      });
    }

    // ========================================
    // 4. GET DEFAULT COMMISSION (with timeout)
    // ========================================
    const defaultSettingPromise = supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'default_reseller_commission')
      .single();

    const { data: defaultSetting } = await executeWithTimeout(defaultSettingPromise, 3000);

    const defaultCommission = defaultSetting ? parseFloat(defaultSetting.setting_value) : 10.00;
    const effectiveCommission = reseller.commission_rate !== null 
      ? parseFloat(reseller.commission_rate) 
      : defaultCommission;

    // ========================================
    // 5. PREPARE RESPONSE
    // ========================================
    const response = {
      success: true,
      data: {
        resellerId: id,
        commissionRate: effectiveCommission,
        commissionType: reseller.commission_rate !== null ? 'custom' : 'default',
        customCommission: reseller.commission_rate ? parseFloat(reseller.commission_rate) : null,
        defaultCommission: defaultCommission,
        updatedAt: reseller.commission_updated_at
      }
    };

    // ========================================
    // 6. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching reseller commission.');
  }
};

/**
 * Set custom commission for a reseller (admin only)
 * @route   PUT /api/resellers/:id/commission
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format, commission rate)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const setResellerCommission = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id } = req.params;
    const { commissionRate } = req.body;

    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid reseller ID format'
      });
    }

    // Validate commission rate
    if (commissionRate === undefined || commissionRate === null) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Commission rate is required'
      });
    }

    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Commission rate must be a number between 0 and 100'
      });
    }

    // ========================================
    // 2. CHECK IF RESELLER EXISTS (with timeout)
    // ========================================
    const checkPromise = supabaseAdmin
      .from('profiles')
      .select('user_id, full_name, commission_rate')
      .eq('user_id', id)
      .contains('role', ['reseller'])
      .single();

    const { data: reseller, error: resellerError } = await executeWithTimeout(checkPromise);

    if (resellerError || !reseller) {
      console.error('❌ Error fetching reseller:', resellerError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found'
      });
    }

    // ========================================
    // 3. UPDATE COMMISSION (with timeout)
    // ========================================
    const updatePromise = supabaseAdmin
      .from('profiles')
      .update({
        commission_rate: rate.toFixed(2),
        commission_updated_at: new Date().toISOString()
      })
      .eq('user_id', id)
      .select('user_id, commission_rate, commission_updated_at')
      .single();

    const { data: updatedReseller, error: updateError } = await executeWithTimeout(updatePromise);

    if (updateError) {
      console.error('❌ Error updating reseller commission:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update reseller commission'
      });
    }

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    await logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'update',
      tableName: 'profiles',
      changedFields: {
        commission_rate: {
          old: reseller.commission_rate,
          new: rate.toFixed(2)
        }
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    // ========================================
    // 4. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.RESELLER_COMMISSION(id));
    await cacheService.del(CACHE_KEYS.MY_COMMISSION(id));
    console.log('✅ Cache invalidated for reseller commission update');

    // ========================================
    // 5. DATA SANITIZATION
    // ========================================
    const sanitizedData = sanitizeObject({
      resellerId: id,
      commissionRate: rate,
      commissionType: 'custom',
      updatedAt: updatedReseller.commission_updated_at
    });

    res.json({
      success: true,
      message: 'Reseller commission updated successfully',
      data: sanitizedData
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating reseller commission.');
  }
};

/**
 * Get all reseller settings (admin only)
 * @route   GET /api/settings/reseller
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Redis caching (Performance)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const getResellerSettings = async (req, res) => {
  try {
    // ========================================
    // 1. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.RESELLER_SETTINGS;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for reseller settings');
      return res.json(cachedData);
    }

    console.log('❌ Cache MISS for reseller settings - fetching from database');

    // Get all reseller-related settings
    const settingKeys = [
      'max_consumers_per_reseller',
      'default_reseller_commission',
      'min_invoice_amount',
      'require_reseller_approval',
      'allow_reseller_price_override'
    ];

    // ========================================
    // 2. FETCH SETTINGS (with timeout)
    // ========================================
    const queryPromise = supabaseAdmin
      .from('app_settings')
      .select('setting_key, setting_value, description, updated_at')
      .in('setting_key', settingKeys);

    const { data: settings, error } = await executeWithTimeout(queryPromise);

    if (error) {
      console.error('❌ Error fetching reseller settings:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch reseller settings'
      });
    }

    // Convert array to object with default values
    const settingsMap = {};
    (settings || []).forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });

    // ========================================
    // 3. PREPARE RESPONSE
    // ========================================
    const response = {
      success: true,
      data: {
        maxConsumersPerReseller: settingsMap['max_consumers_per_reseller'] || null,
        defaultCommissionRate: settingsMap['default_reseller_commission'] ? parseFloat(settingsMap['default_reseller_commission']) : null,
        minInvoiceAmount: settingsMap['min_invoice_amount'] ? parseFloat(settingsMap['min_invoice_amount']) : null,
        requireResellerApproval: settingsMap['require_reseller_approval'] === 'true',
        allowResellerPriceOverride: settingsMap['allow_reseller_price_override'] === 'true'
      }
    };

    // ========================================
    // 4. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching reseller settings.');
  }
};

/**
 * Update all reseller settings
 * @route   PUT /api/settings/reseller
 * @access  Private (Admin)
 */
export const updateResellerSettings = async (req, res) => {
  try {
    const {
      maxConsumersPerReseller,
      defaultCommissionRate,
      minInvoiceAmount,
      requireResellerApproval,
      allowResellerPriceOverride
    } = req.body;

    const adminId = req.user?.id;
    const settingsToUpdate = [];

    // Validate and prepare settings for update
    if (maxConsumersPerReseller !== undefined) {
      const maxConsumers = maxConsumersPerReseller === '' || maxConsumersPerReseller === null 
        ? null 
        : parseInt(maxConsumersPerReseller);
      if (maxConsumers !== null && (isNaN(maxConsumers) || maxConsumers < 0)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Maximum consumers per reseller must be a positive number or empty'
        });
      }
      settingsToUpdate.push({
        setting_key: 'max_consumers_per_reseller',
        setting_value: maxConsumers === null ? '' : maxConsumers.toString(),
        description: 'Maximum number of consumers allowed per reseller (empty = unlimited)',
        updated_at: new Date().toISOString(),
        updated_by: adminId
      });
    }

    if (defaultCommissionRate !== undefined && defaultCommissionRate !== null && defaultCommissionRate !== '') {
      const rate = parseFloat(defaultCommissionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Default commission rate must be a number between 0 and 100'
        });
      }
      settingsToUpdate.push({
        setting_key: 'default_reseller_commission',
        setting_value: rate.toFixed(2),
        description: 'Default commission rate for resellers (percentage)',
        updated_at: new Date().toISOString(),
        updated_by: adminId
      });
    }

    if (minInvoiceAmount !== undefined && minInvoiceAmount !== null && minInvoiceAmount !== '') {
      const amount = parseFloat(minInvoiceAmount);
      if (isNaN(amount) || amount < 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Minimum invoice amount must be a positive number'
        });
      }
      settingsToUpdate.push({
        setting_key: 'min_invoice_amount',
        setting_value: amount.toFixed(2),
        description: 'Minimum invoice amount allowed',
        updated_at: new Date().toISOString(),
        updated_by: adminId
      });
    }

    if (requireResellerApproval !== undefined) {
      settingsToUpdate.push({
        setting_key: 'require_reseller_approval',
        setting_value: requireResellerApproval ? 'true' : 'false',
        description: 'Require admin approval for new resellers',
        updated_at: new Date().toISOString(),
        updated_by: adminId
      });
    }

    if (allowResellerPriceOverride !== undefined) {
      settingsToUpdate.push({
        setting_key: 'allow_reseller_price_override',
        setting_value: allowResellerPriceOverride ? 'true' : 'false',
        description: 'Allow resellers to override product prices (must be equal or greater than original)',
        updated_at: new Date().toISOString(),
        updated_by: adminId
      });
    }

    // ========================================
    // 2. UPSERT SETTINGS (with timeout)
    // ========================================
    if (settingsToUpdate.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No settings provided to update'
      });
    }

    const upsertPromise = supabaseAdmin
      .from('app_settings')
      .upsert(settingsToUpdate, {
        onConflict: 'setting_key'
      })
      .select();

    const { data: updatedSettings, error: upsertError } = await executeWithTimeout(upsertPromise);

    if (upsertError) {
      console.error('❌ Error updating reseller settings:', upsertError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update reseller settings'
      });
    }

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    await logActivity({
      actorId,
      actorRole,
      targetId: null,
      actionType: 'update',
      tableName: 'app_settings',
      changedFields: {
        settings: settingsToUpdate.map(s => ({
          key: s.setting_key,
          value: s.setting_value
        }))
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    // ========================================
    // 3. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.RESELLER_SETTINGS);
    await cacheService.del(CACHE_KEYS.DEFAULT_COMMISSION);
    console.log('✅ Cache invalidated for reseller settings update');

    // ========================================
    // 4. DATA SANITIZATION
    // ========================================
    const sanitizedData = sanitizeObject({
      maxConsumersPerReseller: maxConsumersPerReseller === '' || maxConsumersPerReseller === null ? null : parseInt(maxConsumersPerReseller),
      defaultCommissionRate: defaultCommissionRate !== undefined && defaultCommissionRate !== null && defaultCommissionRate !== '' ? parseFloat(defaultCommissionRate) : null,
      minInvoiceAmount: minInvoiceAmount !== undefined && minInvoiceAmount !== null && minInvoiceAmount !== '' ? parseFloat(minInvoiceAmount) : null,
      requireResellerApproval: requireResellerApproval || false,
      allowResellerPriceOverride: allowResellerPriceOverride || false
    });

    res.json({
      success: true,
      message: 'Reseller settings updated successfully',
      data: sanitizedData
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating reseller settings.');
  }
};

/**
 * Reset reseller commission to default (admin only)
 * @route   DELETE /api/resellers/:id/commission
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const resetResellerCommission = async (req, res) => {
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
    const checkPromise = supabaseAdmin
      .from('profiles')
      .select('user_id, full_name, commission_rate')
      .eq('user_id', id)
      .contains('role', ['reseller'])
      .single();

    const { data: reseller, error: resellerError } = await executeWithTimeout(checkPromise);

    if (resellerError || !reseller) {
      console.error('❌ Error fetching reseller:', resellerError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reseller not found'
      });
    }

    // ========================================
    // 3. RESET COMMISSION (with timeout)
    // ========================================
    const updatePromise = supabaseAdmin
      .from('profiles')
      .update({
        commission_rate: null,
        commission_updated_at: null
      })
      .eq('user_id', id)
      .select('user_id, commission_rate, commission_updated_at')
      .single();

    const { data: updatedReseller, error: updateError } = await executeWithTimeout(updatePromise);

    if (updateError) {
      console.error('❌ Error resetting reseller commission:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to reset reseller commission'
      });
    }

    // ========================================
    // 4. GET DEFAULT COMMISSION (with timeout)
    // ========================================
    const defaultSettingPromise = supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'default_reseller_commission')
      .single();

    const { data: defaultSetting } = await executeWithTimeout(defaultSettingPromise, 3000);

    const defaultCommission = defaultSetting ? parseFloat(defaultSetting.setting_value) : 10.00;

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    await logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'update',
      tableName: 'profiles',
      changedFields: {
        commission_rate: {
          old: reseller.commission_rate,
          new: null
        }
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    // ========================================
    // 5. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.RESELLER_COMMISSION(id));
    await cacheService.del(CACHE_KEYS.MY_COMMISSION(id));
    console.log('✅ Cache invalidated for reseller commission reset');

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedData = sanitizeObject({
      resellerId: id,
      commissionRate: defaultCommission,
      commissionType: 'default'
    });

    res.json({
      success: true,
      message: 'Reseller commission reset to default',
      data: sanitizedData
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while resetting reseller commission.');
  }
};

