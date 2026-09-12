import { supabase, supabaseAdmin } from '../../config/database.js';
import { getActorInfo, logActivity, getClientIp, getUserAgent } from '../../services/activityLogger.js';
import { cacheService } from '../../config/redis.js';
import {
  sanitizeString,
  isValidUUID
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError
} from '../../utils/apiOptimization.js';
import { hashApiSecret } from '../../middleware/apiKeyAuth.js';
import crypto from 'crypto';

/**
 * Generate a secure random API key
 * Format: n8n_ prefix + 32 character random string (base64url encoded)
 * @returns {string} API key
 */
const generateApiKey = () => {
  const randomBytes = crypto.randomBytes(24); // 24 bytes = 32 chars in base64url
  const key = randomBytes.toString('base64url');
  return `n8n_${key}`;
};

/**
 * Generate a secure random API secret
 * Format: 64 character random string (base64url encoded)
 * @returns {string} API secret (plain text)
 */
const generateApiSecret = () => {
  const randomBytes = crypto.randomBytes(48); // 48 bytes = 64 chars in base64url
  return randomBytes.toString('base64url');
};

/**
 * Generate new API key and secret pair
 * @route   POST /api/api-keys
 * @access  Private (Admin)
 */
export const createApiKey = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { name } = req.body;
    const userId = req.user?.id;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Name is required'
      });
    }

    const sanitizedName = sanitizeString(name, 255);

    // ========================================
    // 2. GENERATE API KEY AND SECRET
    // ========================================
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();
    const hashedSecret = hashApiSecret(apiSecret);

    // ========================================
    // 3. INSERT INTO DATABASE
    // ========================================
    const insertPromise = supabaseAdmin
      .from('api_keys')
      .insert({
        api_key: apiKey,
        api_secret: hashedSecret,
        name: sanitizedName,
        is_active: true,
        created_by: userId
      })
      .select('id, api_key, name, is_active, created_at, created_by')
      .single();

    const { data: created, error: insertError } = await executeWithTimeout(insertPromise);

    if (insertError || !created) {
      console.error('❌ Error creating API key:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create API key'
      });
    }

    // ========================================
    // 4. LOG ACTIVITY
    // ========================================
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: created.id,
      actionType: 'create',
      tableName: 'api_keys',
      changedFields: { api_key: apiKey, name: sanitizedName },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 5. RETURN RESPONSE (include secret only once)
    // ========================================
    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      data: {
        id: created.id,
        api_key: apiKey,
        api_secret: apiSecret, // Only shown once during creation
        name: created.name,
        is_active: created.is_active,
        created_at: created.created_at
      },
      warning: 'Save the API secret now. It will not be shown again.'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while creating the API key.');
  }
};

/**
 * List all API keys
 * @route   GET /api/api-keys
 * @access  Private (Admin)
 */
export const listApiKeys = async (req, res) => {
  try {
    const { is_active, search } = req.query;

    // Build query
    let query = supabaseAdmin
      .from('api_keys')
      .select('id, api_key, name, is_active, created_at, updated_at, last_used_at, created_by')
      .order('created_at', { ascending: false });

    // Filter by active status
    if (is_active !== undefined) {
      const active = is_active === 'true' || is_active === '1';
      query = query.eq('is_active', active);
    }

    // Search by name
    if (search && typeof search === 'string') {
      const searchTerm = sanitizeString(search, 255);
      query = query.ilike('name', `%${searchTerm}%`);
    }

    const { data: apiKeys, error } = await executeWithTimeout(query);

    if (error) {
      console.error('❌ Error listing API keys:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch API keys'
      });
    }

    res.json({
      success: true,
      data: apiKeys || [],
      count: apiKeys?.length || 0
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching API keys.');
  }
};

/**
 * Get API key by ID
 * @route   GET /api/api-keys/:id
 * @access  Private (Admin)
 */
export const getApiKeyById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid API key ID format'
      });
    }

    const { data: apiKey, error } = await executeWithTimeout(
      supabaseAdmin
        .from('api_keys')
        .select('id, api_key, name, is_active, created_at, updated_at, last_used_at, created_by')
        .eq('id', id)
        .single()
    );

    if (error || !apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'API key not found'
      });
    }

    res.json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the API key.');
  }
};

/**
 * Update API key (name and/or active status)
 * @route   PUT /api/api-keys/:id
 * @access  Private (Admin)
 */
export const updateApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid API key ID format'
      });
    }

    // Build update object
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Name must be a non-empty string'
        });
      }
      updates.name = sanitizeString(name, 255);
    }

    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'is_active must be a boolean'
        });
      }
      updates.is_active = is_active;
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 1) { // Only updated_at
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No valid fields to update'
      });
    }

    // Update in database
    const updatePromise = supabaseAdmin
      .from('api_keys')
      .update(updates)
      .eq('id', id)
      .select('id, api_key, name, is_active, created_at, updated_at, last_used_at, created_by')
      .single();

    const { data: updated, error: updateError } = await executeWithTimeout(updatePromise);

    if (updateError || !updated) {
      if (updateError?.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'API key not found'
        });
      }
      console.error('❌ Error updating API key:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update API key'
      });
    }

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'update',
      tableName: 'api_keys',
      changedFields: updates,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    res.json({
      success: true,
      message: 'API key updated successfully',
      data: updated
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating the API key.');
  }
};

/**
 * Delete API key
 * @route   DELETE /api/api-keys/:id
 * @access  Private (Admin)
 */
export const deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid API key ID format'
      });
    }

    // Check if API key exists
    const { data: existing, error: checkError } = await executeWithTimeout(
      supabaseAdmin
        .from('api_keys')
        .select('id, api_key, name')
        .eq('id', id)
        .single()
    );

    if (checkError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'API key not found'
      });
    }

    // Delete from database
    const { error: deleteError } = await executeWithTimeout(
      supabaseAdmin
        .from('api_keys')
        .delete()
        .eq('id', id)
    );

    if (deleteError) {
      console.error('❌ Error deleting API key:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to delete API key'
      });
    }

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'delete',
      tableName: 'api_keys',
      changedFields: { api_key: existing.api_key, name: existing.name },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while deleting the API key.');
  }
};

/**
 * Regenerate API secret for existing key
 * @route   POST /api/api-keys/:id/regenerate-secret
 * @access  Private (Admin)
 */
export const regenerateSecret = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid API key ID format'
      });
    }

    // Check if API key exists
    const { data: existing, error: checkError } = await executeWithTimeout(
      supabaseAdmin
        .from('api_keys')
        .select('id, api_key, name')
        .eq('id', id)
        .single()
    );

    if (checkError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'API key not found'
      });
    }

    // Generate new secret
    const apiSecret = generateApiSecret();
    const hashedSecret = hashApiSecret(apiSecret);

    // Update in database
    const updatePromise = supabaseAdmin
      .from('api_keys')
      .update({
        api_secret: hashedSecret,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, api_key, name, is_active, created_at, updated_at')
      .single();

    const { data: updated, error: updateError } = await executeWithTimeout(updatePromise);

    if (updateError || !updated) {
      console.error('❌ Error regenerating API secret:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to regenerate API secret'
      });
    }

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'update',
      tableName: 'api_keys',
      changedFields: { action: 'regenerate_secret' },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    res.json({
      success: true,
      message: 'API secret regenerated successfully',
      data: {
        ...updated,
        api_secret: apiSecret // Only shown once during regeneration
      },
      warning: 'Save the new API secret now. It will not be shown again.'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while regenerating the API secret.');
  }
};
