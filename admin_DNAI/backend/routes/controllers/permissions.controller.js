import { supabase, supabaseAdmin } from '../../config/database.js';
import { cacheService } from '../../config/redis.js';
import { logActivity, getActorInfo, getClientIp, getUserAgent } from '../../services/activityLogger.js';
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
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';
import { getPrimaryRole } from '../../utils/roleUtils.js';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const ROLE_CACHE_TTL = 3600; // 1 hour for role permissions (more stable)
const CACHE_KEYS = {
  ALL_PERMISSIONS: 'permissions:all',
  PERMISSIONS_BY_RESOURCE: (resource) => `permissions:resource:${resource}`,
  USER_PERMISSIONS: (userId) => `permissions:user:${userId}`,
  ROLE_PERMISSIONS: (role) => `permissions:role:${role}`,
  ROLE_PERMISSIONS_VERSION: (role) => `permissions:role:${role}:version`,
  ALL_ROLE_VERSIONS: 'permissions:role:versions', // Hash storing all role versions
};

/**
 * Clear all permission-related caches
 * This function clears all caches that might be affected by permission changes
 * @param {Object} options - Options for cache clearing
 * @param {string} options.role - Role name to clear role-specific cache
 * @param {string} options.userId - User ID to clear user-specific cache
 * @param {boolean} options.clearAllPermissions - Whether to clear all permissions cache
 * @param {string} options.resource - Resource name to clear resource-specific cache
 */
const clearPermissionCaches = async (options = {}) => {
  const { role, userId, clearAllPermissions = true, resource } = options;
  const keysToDelete = [];
  const patternsToDelete = [];

  try {
    // Always clear the main permissions cache when permissions are modified
    if (clearAllPermissions) {
      keysToDelete.push(CACHE_KEYS.ALL_PERMISSIONS);
      
      // Clear all paginated permission caches by pattern
      // The getAllPermissions function uses cache keys like: permissions:all:all:1:50
      // Clear all variations using pattern matching
      patternsToDelete.push('permissions:*:*:*:*'); // Pattern for paginated queries
      patternsToDelete.push('permissions:id:*'); // Pattern for individual permission caches
      
      // Also clear all resource-specific permission caches
      if (resource) {
        keysToDelete.push(CACHE_KEYS.PERMISSIONS_BY_RESOURCE(resource));
        // Also clear paginated resource caches
        patternsToDelete.push(`permissions:${resource}:*:*:*`);
      } else {
        // Clear all resource-specific caches
        patternsToDelete.push('permissions:resource:*');
      }
      
      console.log('🔄 Clearing all permission-related caches (including paginated queries)');
    }

    // Clear role-specific cache
    if (role) {
      keysToDelete.push(CACHE_KEYS.ROLE_PERMISSIONS(role));
    }

    // Clear user-specific cache
    if (userId) {
      keysToDelete.push(CACHE_KEYS.USER_PERMISSIONS(userId));
    }

    // Clear specific keys
    if (keysToDelete.length > 0) {
      await Promise.all(keysToDelete.map(key => cacheService.del(key)));
      console.log(`✅ Cleared ${keysToDelete.length} specific permission cache(s):`, keysToDelete);
    }

    // Clear keys by pattern (for paginated and dynamic caches)
    if (patternsToDelete.length > 0) {
      const deletePromises = patternsToDelete.map(pattern => cacheService.delByPattern(pattern));
      const deleteResults = await Promise.all(deletePromises);
      const totalDeleted = deleteResults.reduce((sum, count) => sum + count, 0);
      if (totalDeleted > 0) {
        console.log(`✅ Cleared ${totalDeleted} permission cache(s) by pattern:`, patternsToDelete);
      }
    }

    // If role permissions changed, note that user permission caches may be affected
    // Users inherit permissions from roles, so role changes can affect user permission checks
    if (role && clearAllPermissions) {
      console.log(`⚠️ Role permissions changed for ${role}. Related caches cleared.`);
    }

    // Also invalidate users, resellers, and consumers cache when permissions/roles change
    // This ensures user lists reflect permission changes immediately
    await cacheService.delByPattern('users:list:*');
    await cacheService.delByPattern('resellers:*');
    await cacheService.delByPattern('consumers:*');
    console.log('✅ Also invalidated users, resellers, and consumers cache due to permission/role change');
  } catch (error) {
    console.error('❌ Error clearing permission caches:', error);
    // Don't throw - cache clearing failure shouldn't break the operation
  }
};

/**
 * Get the current cache version for a role
 * @param {string} role - Role name
 * @returns {Promise<number>} - Current version number
 */
const getRoleCacheVersion = async (role) => {
  try {
    const version = await cacheService.get(CACHE_KEYS.ROLE_PERMISSIONS_VERSION(role));
    return version ? parseInt(version, 10) : 1;
  } catch (error) {
    console.error(`❌ Error getting cache version for role ${role}:`, error);
    return 1;
  }
};

/**
 * Increment the cache version for a role (used when permissions change)
 * @param {string} role - Role name
 * @returns {Promise<number>} - New version number
 */
const incrementRoleCacheVersion = async (role) => {
  try {
    const currentVersion = await getRoleCacheVersion(role);
    const newVersion = currentVersion + 1;
    // Store version with very long TTL (7 days) - it just increments
    await cacheService.set(CACHE_KEYS.ROLE_PERMISSIONS_VERSION(role), newVersion, 604800);
    console.log(`🔄 Incremented cache version for role ${role}: ${currentVersion} -> ${newVersion}`);
    return newVersion;
  } catch (error) {
    console.error(`❌ Error incrementing cache version for role ${role}:`, error);
    return 1;
  }
};

/**
 * Get all role cache versions
 * @returns {Promise<Object>} - Object with role names as keys and versions as values
 */
export const getAllRoleCacheVersions = async () => {
  try {
    const roles = ['admin', 'reseller', 'consumer', 'viewer', 'support'];
    const versions = {};
    
    await Promise.all(roles.map(async (role) => {
      versions[role] = await getRoleCacheVersion(role);
    }));
    
    return versions;
  } catch (error) {
    console.error('❌ Error getting all role cache versions:', error);
    return { admin: 1, reseller: 1, consumer: 1, viewer: 1 };
  }
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('permissions', 100);

/**
 * Permissions Controller
 * Handles permission-related operations
 */

/**
 * Get all permissions
 * @route   GET /api/permissions
 * @access  Private (permissions.view)
 */
export const getAllPermissions = async (req, res) => {
  try {
    const { resource, action, page = 1, limit = 50 } = req.query;
    
    // 🎯 OPTIMIZATION 1: Better cache key that includes all query params
    const cacheKey = `permissions:${resource || 'all'}:${action || 'all'}:${page}:${limit}`;
    
    // 🎯 OPTIMIZATION 2: Check cache with early return
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedData);
    }
    res.setHeader('X-Cache', 'MISS');

    // 🎯 OPTIMIZATION 3: Input validation (prevent unnecessary DB calls)
    const validatedResource = resource ? sanitizeString(resource, 50) : null;
    const validatedAction = action ? sanitizeString(action, 50) : null;
    
    // Pagination - default 50 per page
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10))); // Cap at 500, default 50
    const offset = (pageNum - 1) * limitNum;

    // 🎯 OPTIMIZATION 4: Build queries conditionally (Supabase doesn't have .modify())
    // Data query with pagination (50 per page)
    let dataQuery = supabase
      .from('permissions')
      .select('id, name, resource, action, description, created_at') // Include 'name' field for frontend
      .order('resource', { ascending: true })
      .order('action', { ascending: true });
    
    if (validatedResource) {
      dataQuery = dataQuery.eq('resource', validatedResource);
    }
    if (validatedAction) {
      dataQuery = dataQuery.eq('action', validatedAction);
    }
    
    // Apply pagination
    dataQuery = dataQuery.range(offset, offset + limitNum - 1);
    
    // Count query for pagination info
    let countQuery = supabase
      .from('permissions')
      .select('id', { count: 'exact', head: true });
    
    if (validatedResource) {
      countQuery = countQuery.eq('resource', validatedResource);
    }
    if (validatedAction) {
      countQuery = countQuery.eq('action', validatedAction);
    }
    
    // 🎯 OPTIMIZATION 5: Execute queries in parallel with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), 10000)
    );

    const [{ data, error }, { count, error: countError }] = await Promise.race([
      Promise.all([dataQuery, countQuery]),
      timeoutPromise
    ]);

    if (error || countError) {
      console.error('❌ Get permissions error:', error || countError);
      return handleApiError(error || countError, res, 'Failed to fetch permissions');
    }

    // 🎯 OPTIMIZATION 6: Build paginated response
    const totalPages = Math.ceil((count || 0) / limitNum);
    const result = {
      success: true,
      data: sanitizeArray(data || []),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    };

    // 🎯 OPTIMIZATION 7: Cache with TTL based on data size
    const cacheTTL = count > 1000 ? 300 : 600; // Shorter TTL for large datasets
    await cacheService.set(cacheKey, result, cacheTTL);

    // 🎯 OPTIMIZATION 8: Set HTTP cache headers
    res.setHeader('Cache-Control', `private, max-age=${cacheTTL}`);
    res.setHeader('ETag', `W/"${Buffer.from(JSON.stringify(result)).toString('base64').slice(0, 27)}"`);

    res.json(result);
  } catch (err) {
    return handleApiError(err, res, 'Failed to fetch permissions');
  }
};

/**
 * Get permission by ID
 * @route   GET /api/permissions/:id
 * @access  Private (permissions.view)
 */
export const getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid permission ID'
      });
    }

    const cacheKey = `permissions:id:${id}`;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const { data, error } = await executeWithTimeout(
      supabase
        .from('permissions')
        .select('*')
        .eq('id', id)
        .single(),
      10000
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Permission not found'
        });
      }
      return handleApiError(error, res, 'Failed to fetch permission');
    }

    const result = {
      success: true,
      data: sanitizeObject(data)
    };

    await cacheService.set(cacheKey, result, CACHE_TTL);
    res.json(result);
  } catch (err) {
    return handleApiError(err, res, 'Failed to fetch permission');
  }
};

/**
 * Get user permissions
 * @route   GET /api/permissions/user/:userId
 * @access  Private (permissions.view)
 */
export const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }

    // Check cache
    const cacheKey = CACHE_KEYS.USER_PERMISSIONS(userId);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for user permissions');
      return res.json(cachedData);
    }

    // Use the get_user_permissions SQL function
    const { data, error } = await executeWithTimeout(
      supabase.rpc('get_user_permissions', { p_user_id: userId }),
      10000
    );

    if (error) {
      console.error('❌ Get user permissions error:', error);
      return handleApiError(error, res, 'Failed to fetch user permissions');
    }

    const result = {
      success: true,
      data: sanitizeArray(data || []),
      count: data?.length || 0
    };

    // Cache result
    await cacheService.set(cacheKey, result, CACHE_TTL);
    res.json(result);
  } catch (err) {
    return handleApiError(err, res, 'Failed to fetch user permissions');
  }
};

/**
 * Get current user permissions
 * @route   GET /api/permissions/me
 * @access  Private
 */
export const getMyPermissions = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // Check cache
    const cacheKey = CACHE_KEYS.USER_PERMISSIONS(req.user.id);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Use the get_user_permissions SQL function
    const { data, error } = await executeWithTimeout(
      supabase.rpc('get_user_permissions', { p_user_id: req.user.id }),
      10000
    );

    if (error) {
      console.error('❌ Get my permissions error:', error);
      return handleApiError(error, res, 'Failed to fetch permissions');
    }

    const result = {
      success: true,
      data: sanitizeArray(data || []),
      count: data?.length || 0
    };

    await cacheService.set(cacheKey, result, CACHE_TTL);
    res.json(result);
  } catch (err) {
    return handleApiError(err, res, 'Failed to fetch permissions');
  }
};

/**
 * Get role permissions (admin/management use)
 * @route   GET /api/permissions/role/:role
 * @access  Private (permissions.view)
 */
export const getRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const validRoles = ['admin', 'reseller', 'consumer', 'viewer', 'support'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid role. Must be one of: admin, reseller, consumer, viewer, support'
      });
    }

    // Check cache
    const cacheKey = CACHE_KEYS.ROLE_PERMISSIONS(role);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for role permissions');
      return res.json(cachedData);
    }

    const { data, error } = await executeWithTimeout(
      supabase
        .from('role_permissions')
        .select(`
          id,
          role,
          created_at,
          permissions (
            id,
            name,
            resource,
            action,
            description
          )
        `)
        .eq('role', role), // role_permissions.role is TEXT, not TEXT[], so use .eq() not .contains()
      10000
    );

    if (error) {
      console.error('❌ Get role permissions error:', error);
      return handleApiError(error, res, 'Failed to fetch role permissions');
    }

    // Get version for this role
    const version = await getRoleCacheVersion(role);

    const result = {
      success: true,
      data: sanitizeArray(data || []),
      count: data?.length || 0,
      version // Include version for frontend cache validation
    };

    await cacheService.set(cacheKey, result, ROLE_CACHE_TTL);
    res.json(result);
  } catch (err) {
    return handleApiError(err, res, 'Failed to fetch role permissions');
  }
};

/**
 * Get role permissions for current user's role (optimized for frontend caching)
 * This endpoint is designed for frequent frontend calls and returns:
 * - Permission names as a simple array for easy hasPermission() checks
 * - Cache version for frontend to validate local cache
 * @route   GET /api/permissions/my-role
 * @access  Private (any authenticated user)
 */
export const getMyRolePermissions = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // Get profile - use req.profile if available, otherwise fetch from DB
    let profile = req.profile;
    if (!profile) {
      const { data: profileData, error: profileError } = await executeWithTimeout(
        supabase
          .from('profiles')
          .select('user_id, role, is_systemadmin')
          .eq('user_id', req.user.id)
          .single(),
        5000
      );

      if (profileError || !profileData) {
        console.error('❌ Error fetching profile for my-role:', profileError);
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User profile not found'
        });
      }
      profile = profileData;
    }

    // Get user's primary role - profile.role can be array or string
    // Use getPrimaryRole utility to get highest priority role based on hierarchy
    const primaryRole = getPrimaryRole(profile.role, profile.is_systemadmin) || 'viewer';
    const validRoles = ['admin', 'reseller', 'consumer', 'viewer', 'support', 'systemadmin'];
    
    if (!validRoles.includes(primaryRole)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user role'
      });
    }

    // Check if user is system admin - they have all permissions
    if (profile.is_systemadmin === true) {
      // For system admins, return all permissions
      const { data: allPerms, error: allPermsError } = await executeWithTimeout(
        supabase.from('permissions').select('name'),
        10000
      );

      if (allPermsError) {
        console.error('❌ Get all permissions for sysadmin error:', allPermsError);
        return handleApiError(allPermsError, res, 'Failed to fetch permissions');
      }

      return res.json({
        success: true,
        role: 'systemadmin',
        permissions: (allPerms || []).map(p => p.name),
        version: 0, // System admin doesn't need version tracking
        isSystemAdmin: true
      });
    }

    // Get role cache version
    const version = await getRoleCacheVersion(primaryRole);

    // Check if frontend sent a version - if it matches, just confirm no changes
    const clientVersion = parseInt(req.query.v || '0', 10);
    if (clientVersion > 0 && clientVersion === version) {
      return res.json({
        success: true,
        role: primaryRole,
        unchanged: true,
        version
      });
    }

    // Check cache for this role's simplified permissions
    const simplifiedCacheKey = `${CACHE_KEYS.ROLE_PERMISSIONS(primaryRole)}:simplified`;
    const cachedSimplified = await cacheService.get(simplifiedCacheKey);
    if (cachedSimplified && cachedSimplified.version === version) {
      console.log('✅ Cache HIT for simplified role permissions');
      return res.json({
        success: true,
        role: primaryRole,
        permissions: cachedSimplified.permissions,
        version,
        cached: true
      });
    }

    // Fetch role permissions
    const { data, error } = await executeWithTimeout(
      supabase
        .from('role_permissions')
        .select(`
          permissions (
            name
          )
        `)
        .eq('role', primaryRole),
      10000
    );

    if (error) {
      console.error('❌ Get my role permissions error:', error);
      return handleApiError(error, res, 'Failed to fetch role permissions');
    }

    // Extract just the permission names for easy frontend use
    const permissionNames = (data || [])
      .map(rp => rp.permissions?.name)
      .filter(Boolean);

    // Cache the simplified result
    await cacheService.set(simplifiedCacheKey, {
      permissions: permissionNames,
      version
    }, ROLE_CACHE_TTL);

    res.json({
      success: true,
      role: primaryRole,
      permissions: permissionNames,
      version
    });
  } catch (err) {
    return handleApiError(err, res, 'Failed to fetch role permissions');
  }
};

/**
 * Get all role cache versions (for frontend to check if any role changed)
 * @route   GET /api/permissions/role-versions
 * @access  Private (any authenticated user)
 */
export const getRoleCacheVersions = async (req, res) => {
  try {
    const versions = await getAllRoleCacheVersions();
    res.json({
      success: true,
      versions
    });
  } catch (err) {
    return handleApiError(err, res, 'Failed to fetch role cache versions');
  }
};

/**
 * Check if user has permission
 * @route   GET /api/permissions/check/:userId/:permissionName
 * @access  Private (permissions.view)
 */
export const checkUserPermission = async (req, res) => {
  try {
    const { userId, permissionName } = req.params;

    if (!isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }

    if (!permissionName || typeof permissionName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Permission name is required'
      });
    }

    const { data, error } = await executeWithTimeout(
      supabase.rpc('has_permission', {
        p_user_id: userId,
        p_permission_name: sanitizeString(permissionName, 100)
      }),
      10000
    );

    if (error) {
      console.error('❌ Check permission error:', error);
      return handleApiError(error, res, 'Failed to check permission');
    }

    res.json({
      success: true,
      data: sanitizeObject({
        userId,
        permissionName,
        hasPermission: data === true
      })
    });
  } catch (err) {
    return handleApiError(err, res, 'Failed to check permission');
  }
};

/**
 * Check if user has multiple permissions (optimized bulk check)
 * @route   POST /api/permissions/check-bulk/:userId
 * @access  Private (permissions.view)
 * 
 * Request body: { permissionNames: string[] }
 * Response: { permissions: { [permissionName]: boolean } }
 */
export const checkUserPermissionsBulk = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissionNames } = req.body;

    if (!isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }

    if (!Array.isArray(permissionNames) || permissionNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'permissionNames must be a non-empty array'
      });
    }

    // Validate and sanitize permission names
    const validPermissionNames = permissionNames
      .filter(name => name && typeof name === 'string')
      .map(name => sanitizeString(name, 100))
      .filter(name => name.length > 0);

    if (validPermissionNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No valid permission names provided'
      });
    }

    // Limit to prevent abuse (max 50 permissions per request)
    if (validPermissionNames.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Maximum 50 permissions can be checked at once'
      });
    }

    // Check if user is systemadmin (optimization: single query)
    const profilePromise = supabase
      .from('profiles')
      .select('is_systemadmin')
      .eq('user_id', userId)
      .single();

    const { data: profile, error: profileError } = await executeWithTimeout(profilePromise, 5000);

    // If systemadmin, return all true (optimization)
    if (!profileError && profile?.is_systemadmin === true) {
      const permissions = {};
      validPermissionNames.forEach(name => {
        permissions[name] = true;
      });
      return res.json({
        success: true,
        data: sanitizeObject({
          userId,
          permissions
        })
      });
    }

    // Check all permissions in parallel (optimized with Promise.all)
    const permissionChecks = validPermissionNames.map(permissionName =>
      executeWithTimeout(
        supabase.rpc('has_permission', {
          p_user_id: userId,
          p_permission_name: permissionName
        }),
        10000
      )
    );

    const results = await Promise.all(permissionChecks);

    // Build result object
    const permissions = {};
    results.forEach((result, index) => {
      const permissionName = validPermissionNames[index];
      if (result.error) {
        console.error(`❌ Check permission error for ${permissionName}:`, result.error);
        permissions[permissionName] = false;
      } else {
        permissions[permissionName] = result.data === true;
      }
    });

    res.json({
      success: true,
      data: sanitizeObject({
        userId,
        permissions
      })
    });
  } catch (err) {
    return handleApiError(err, res, 'Failed to check permissions');
  }
};

/**
 * Assign permissions to role
 * @route   POST /api/permissions/role/:role/assign
 * @access  Private (permissions.manage)
 */
export const assignPermissionsToRole = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissionIds } = req.body;

    const validRoles = ['admin', 'reseller', 'consumer', 'viewer', 'support'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid role'
      });
    }

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'permissionIds must be a non-empty array'
      });
    }

    // Validate all permission IDs
    const sanitizedIds = permissionIds.filter(id => {
      if (typeof id !== 'string') return false;
      return isValidUUID(id);
    });
    
    if (sanitizedIds.length !== permissionIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'All permission IDs must be valid UUIDs'
      });
    }

    // Insert role permissions
    const rolePermissions = sanitizedIds.map(permissionId => ({
      role,
      permission_id: permissionId
    }));

    const { data, error } = await executeWithTimeout(
      supabase
        .from('role_permissions')
        .upsert(rolePermissions, {
          onConflict: 'role,permission_id',
          ignoreDuplicates: false
        })
        .select(),
      10000
    );

    if (error) {
      console.error('❌ Assign permissions to role error:', error);
      return handleApiError(error, res, 'Failed to assign permissions to role');
    }

    // Clear all related caches and increment version
    await clearPermissionCaches({ role, clearAllPermissions: true });
    
    // Increment role cache version so frontends know to refresh
    const newVersion = await incrementRoleCacheVersion(role);

    // Log activity (non-blocking)
    // Note: targetId is null for role operations since role is a string, not a UUID
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: null, // Role is not a UUID, so set to null
      actionType: 'update',
      tableName: 'role_permissions',
      changedFields: {
        role,
        permissionIds: sanitizedIds,
        count: sanitizedIds.length,
        newCacheVersion: newVersion
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(err => console.error('Error logging activity:', err));

    res.json({
      success: true,
      message: `Successfully assigned ${sanitizedIds.length} permission(s) to role ${role}`,
      data: sanitizeArray(data || []),
      cacheVersion: newVersion
    });
  } catch (err) {
    return handleApiError(err, res, 'Failed to assign permissions to role');
  }
};

/**
 * Remove permissions from role
 * @route   DELETE /api/permissions/role/:role/remove
 * @access  Private (permissions.manage)
 */
export const removePermissionsFromRole = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissionIds } = req.body;

    const validRoles = ['admin', 'reseller', 'consumer', 'viewer', 'support'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid role'
      });
    }

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'permissionIds must be a non-empty array'
      });
    }

    // Validate all permission IDs
    const sanitizedIds = permissionIds.filter(id => {
      if (typeof id !== 'string') return false;
      return isValidUUID(id);
    });
    
    if (sanitizedIds.length !== permissionIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'All permission IDs must be valid UUIDs'
      });
    }

    const { error } = await executeWithTimeout(
      supabase
        .from('role_permissions')
        .delete()
        .eq('role', role)
        .in('permission_id', sanitizedIds),
      10000
    );

    if (error) {
      console.error('❌ Remove permissions from role error:', error);
      return handleApiError(error, res, 'Failed to remove permissions from role');
    }

    // Clear all related caches and increment version
    await clearPermissionCaches({ role, clearAllPermissions: true });
    
    // Increment role cache version so frontends know to refresh
    const newVersion = await incrementRoleCacheVersion(role);

    // Log activity (non-blocking)
    // Note: targetId is null for role operations since role is a string, not a UUID
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: null, // Role is not a UUID, so set to null
      actionType: 'update',
      tableName: 'role_permissions',
      changedFields: {
        role,
        permissionIds: sanitizedIds,
        count: sanitizedIds.length,
        newCacheVersion: newVersion
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(err => console.error('Error logging activity:', err));

    res.json({
      success: true,
      message: `Successfully removed ${sanitizedIds.length} permission(s) from role ${role}`,
      cacheVersion: newVersion
    });
  } catch (err) {
    return handleApiError(err, res, 'Failed to remove permissions from role');
  }
};

/**
 * Assign permissions to user
 * @route   POST /api/permissions/user/:userId/assign
 * @access  Private (permissions.manage)
 */
export const assignPermissionsToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissionIds, granted = true } = req.body;

    if (!isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'permissionIds must be a non-empty array'
      });
    }

    // Validate all permission IDs
    const sanitizedIds = permissionIds.filter(id => {
      if (typeof id !== 'string') return false;
      return isValidUUID(id);
    });
    
    if (sanitizedIds.length !== permissionIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'All permission IDs must be valid UUIDs'
      });
    }

    // Replace all user permissions: First delete all existing, then insert new ones
    // This ensures that permissions not in the request are removed
    
    // Step 1: Delete all existing permissions for this user
    const { error: deleteError } = await executeWithTimeout(
      supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId),
      10000
    );

    if (deleteError) {
      console.error('❌ Delete existing user permissions error:', deleteError);
      return handleApiError(deleteError, res, 'Failed to clear existing user permissions');
    }

    // Step 2: Insert new permissions (only if there are any to add)
    let data = [];
    if (sanitizedIds.length > 0) {
      const userPermissions = sanitizedIds.map(permissionId => ({
        user_id: userId,
        permission_id: permissionId,
        granted: granted === true
      }));

      const { data: insertData, error: insertError } = await executeWithTimeout(
        supabase
          .from('user_permissions')
          .insert(userPermissions)
          .select(),
        10000
      );

      if (insertError) {
        console.error('❌ Insert user permissions error:', insertError);
        return handleApiError(insertError, res, 'Failed to assign permissions to user');
      }

      data = insertData || [];
    }

    // Clear all related caches
    await clearPermissionCaches({ userId, clearAllPermissions: true });

    // Log activity (non-blocking)
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: userId,
      actionType: 'update',
      tableName: 'user_permissions',
      changedFields: {
        userId,
        permissionIds: sanitizedIds,
        granted,
        count: sanitizedIds.length
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(err => console.error('Error logging activity:', err));

    res.json({
      success: true,
      message: sanitizedIds.length > 0 
        ? `Successfully updated user permissions: ${sanitizedIds.length} permission(s) assigned`
        : `Successfully removed all permissions from user`,
      data: sanitizeArray(data || [])
    });
  } catch (err) {
    return handleApiError(err, res, 'Failed to assign permissions to user');
  }
};

/**
 * Remove permissions from user
 * @route   DELETE /api/permissions/user/:userId/remove
 * @access  Private (permissions.manage)
 */
export const removePermissionsFromUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissionIds } = req.body;

    if (!isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'permissionIds must be a non-empty array'
      });
    }

    // Validate all permission IDs
    const sanitizedIds = permissionIds.filter(id => {
      if (typeof id !== 'string') return false;
      return isValidUUID(id);
    });
    
    if (sanitizedIds.length !== permissionIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'All permission IDs must be valid UUIDs'
      });
    }

    const { error } = await executeWithTimeout(
      supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .in('permission_id', sanitizedIds),
      10000
    );

    if (error) {
      console.error('❌ Remove permissions from user error:', error);
      return handleApiError(error, res, 'Failed to remove permissions from user');
    }

    // Clear all related caches
    await clearPermissionCaches({ userId, clearAllPermissions: true });

    // Log activity (non-blocking)
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: userId,
      actionType: 'update',
      tableName: 'user_permissions',
      changedFields: {
        userId,
        permissionIds: sanitizedIds,
        count: sanitizedIds.length
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(err => console.error('Error logging activity:', err));

    res.json({
      success: true,
      message: `Successfully removed ${sanitizedIds.length} permission(s) from user`
    });
  } catch (err) {
    return handleApiError(err, res, 'Failed to remove permissions from user');
  }
};

/**
 * Set systemadmin status for user
 * @route   PATCH /api/permissions/user/:userId/systemadmin
 * @access  Private (permissions.manage - systemadmin only)
 */
export const setSystemAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_systemadmin } = req.body;

    if (!isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }

    if (typeof is_systemadmin !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'is_systemadmin must be a boolean'
      });
    }

    const { data, error } = await executeWithTimeout(
      supabase
        .from('profiles')
        .update({ is_systemadmin })
        .eq('user_id', userId)
        .select('user_id, full_name, role, is_systemadmin')
        .single(),
      10000
    );

    if (error) {
      console.error('❌ Set systemadmin error:', error);
      return handleApiError(error, res, 'Failed to update systemadmin status');
    }

    // Clear all related caches (systemadmin status affects permission checks)
    await clearPermissionCaches({ userId, clearAllPermissions: true });

    // Log activity (non-blocking)
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: userId,
      actionType: 'update',
      tableName: 'profiles',
      changedFields: {
        userId,
        is_systemadmin,
        targetUser: data.email
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(err => console.error('Error logging activity:', err));

    res.json({
      success: true,
      message: `Successfully ${is_systemadmin ? 'granted' : 'revoked'} systemadmin status`,
      data: sanitizeObject(data)
    });
  } catch (err) {
    return handleApiError(err, res, 'Failed to update systemadmin status');
  }
};

/**
 * Get all users for system admin management
 * @route   GET /api/permissions/users
 * @access  Private (permissions.view - systemadmin only)
 */
export const getAllUsersForPermissions = async (req, res) => {
  try {
    const { search } = req.query;
    
    // Build query
    let query = supabaseAdmin
      .from('auth_role_with_profiles')
      .select('user_id, email, full_name, role, is_systemadmin')
      .order('full_name', { ascending: true });

    // Apply search filter if provided (search by email, full_name, or user_id)
    if (search && search.trim().length >= 2) {
      const searchTerm = sanitizeString(search.trim(), 100);
      query = query.or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,user_id.ilike.%${searchTerm}%`);
    }

    const { data, error } = await executeWithTimeout(query, 10000);

    if (error) {
      console.error('❌ Get users for permissions error:', error);
      return handleApiError(error, res, 'Failed to fetch users');
    }

    res.json({
      success: true,
      data: sanitizeArray(data || []),
      count: data?.length || 0
    });
  } catch (err) {
    return handleApiError(err, res, 'Failed to fetch users');
  }
};

