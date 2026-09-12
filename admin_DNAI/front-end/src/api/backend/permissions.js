/**
 * Permissions Management API (Backend)
 * These functions call the backend permissions API
 */

import apiClient from '../../services/apiClient';

/**
 * Get all permissions with optional filters and pagination
 * @param {Object} filters - Filter options
 * @param {string} filters.resource - Filter by resource
 * @param {string} filters.action - Filter by action
 * @param {number} filters.page - Page number (default: 1)
 * @param {number} filters.limit - Items per page (default: 50)
 * @returns {Promise<Object>} Object with data array and pagination info
 */
export const getAllPermissions = async (filters = {}) => {
  try {
    const { resource, action, page = 1, limit = 50 } = filters;
    const params = new URLSearchParams();
    
    if (resource && resource.trim() !== '') {
      params.append('resource', resource.trim());
    }
    if (action && action.trim() !== '') {
      params.append('action', action.trim());
    }
    
    // Add pagination params
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    const queryString = params.toString();
    const response = await apiClient.permissions.getAll(`?${queryString}`);
    console.log("response--==--", response);
    // Axios interceptor returns response.data, so response is already { success: true, data: [...], pagination: {...} }
    if (response?.error) {
      return { error: response.error };
    }
    // Response structure: { success: true, data: [...], pagination: {...} }
    return {
      data: response?.data || [],
      pagination: response?.pagination || null
    };
  } catch (error) {
    console.error('getAllPermissions Error:', error);
    return { error: error.message };
  }
};

/**
 * Get permission by ID
 * @param {string} permissionId - Permission ID
 * @returns {Promise<Object>} Permission data
 */
export const getPermissionById = async (permissionId) => {
  try {
    const response = await apiClient.permissions.getById(permissionId);
    return response.data || response;
  } catch (error) {
    console.error('getPermissionById Error:', error);
    return { error: error.message };
  }
};

/**
 * Get current user's permissions
 * @returns {Promise<Array>} List of user permissions
 */
export const getMyPermissions = async () => {
  try {
    const response = await apiClient.permissions.getMy();
    return response.data || [];
  } catch (error) {
    console.error('getMyPermissions Error:', error);
    return { error: error.message };
  }
};

/**
 * Get current user's role permissions (optimized for frontend caching)
 * Returns simplified permission names with cache version
 * @param {number} clientVersion - Optional client version for cache validation
 * @returns {Promise<Object>} { success, role, permissions, version, unchanged }
 */
export const getMyRolePermissions = async (clientVersion = 0) => {
  try {
    const response = await apiClient.permissions.getMyRolePermissions(clientVersion);
    return response;
  } catch (error) {
    console.error('getMyRolePermissions Error:', error);
    return { error: error.message };
  }
};

/**
 * Get all role cache versions
 * @returns {Promise<Object>} { success, versions: { admin: number, reseller: number, ... } }
 */
export const getRoleCacheVersions = async () => {
  try {
    const response = await apiClient.permissions.getRoleCacheVersions();
    return response;
  } catch (error) {
    console.error('getRoleCacheVersions Error:', error);
    return { error: error.message };
  }
};

/**
 * Get user permissions
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of user permissions
 */
export const getUserPermissions = async (userId) => {
  try {
    const response = await apiClient.permissions.getUserPermissions(userId);
    // Axios interceptor returns response.data, so response is already { success: true, data: [...], count: ... }
    if (response?.error) {
      return { error: response.error };
    }
    // Response structure: { success: true, data: [...], count: ... }
    return response?.data || [];
  } catch (error) {
    console.error('getUserPermissions Error:', error);
    return { error: error.message };
  }
};

/**
 * Get role permissions
 * @param {string} role - Role name (admin, reseller, consumer, viewer)
 * @returns {Promise<Array>} List of role permissions
 */
export const getRolePermissions = async (role) => {
  try {
    const response = await apiClient.permissions.getRolePermissions(role);
    return response.data || [];
  } catch (error) {
    console.error('getRolePermissions Error:', error);
    return { error: error.message };
  }
};

/**
 * Check if user has permission
 * @param {string} userId - User ID
 * @param {string} permissionName - Permission name
 * @returns {Promise<boolean>} Whether user has permission
 */
export const checkUserPermission = async (userId, permissionName) => {
  try {
    const response = await apiClient.permissions.check(userId, permissionName);
    // Response structure: { success: true, data: { userId, permissionName, hasPermission: true/false } }
    // axios interceptor returns response.data, so response is already the backend response
    if (response?.success && response?.data) {
      return response.data.hasPermission === true;
    }
    // Fallback: check if response.data is the data object directly
    if (response?.data?.hasPermission !== undefined) {
      return response.data.hasPermission === true;
    }
    // Fallback: check if response itself has hasPermission
    if (response?.hasPermission !== undefined) {
      return response.hasPermission === true;
    }
    console.warn('checkUserPermission: Unexpected response structure', response);
    return false;
  } catch (error) {
    console.error('checkUserPermission Error:', error);
    console.error('Error response:', error.response?.data);
    return false;
  }
};

/**
 * Check if user has multiple permissions (optimized bulk check)
 * @param {string} userId - User ID
 * @param {string[]} permissionNames - Array of permission names to check
 * @returns {Promise<Object>} Object with permission names as keys and boolean values
 * @example
 * const permissions = await checkUserPermissionsBulk(userId, ['consumers.create', 'consumers.delete']);
 * // Returns: { 'consumers.create': true, 'consumers.delete': false }
 */
export const checkUserPermissionsBulk = async (userId, permissionNames) => {
  try {
    if (!Array.isArray(permissionNames) || permissionNames.length === 0) {
      console.error('checkUserPermissionsBulk: permissionNames must be a non-empty array');
      return {};
    }

    const response = await apiClient.permissions.checkBulk(userId, permissionNames);
    return response.data?.permissions || {};
  } catch (error) {
    console.error('checkUserPermissionsBulk Error:', error);
    // Return all false on error
    const result = {};
    permissionNames.forEach(name => {
      result[name] = false;
    });
    return result;
  }
};

/**
 * Assign permissions to role
 * @param {string} role - Role name
 * @param {Array<string>} permissionIds - Array of permission IDs
 * @returns {Promise<Object>} Success status
 */
export const assignPermissionsToRole = async (role, permissionIds) => {
  try {
    const response = await apiClient.permissions.assignToRole(role, permissionIds);
    if (response.success) {
      return {
        success: true,
        message: response.message
      };
    }
    return { error: 'Failed to assign permissions to role' };
  } catch (error) {
    console.error('assignPermissionsToRole Error:', error);
    return { error: error.message };
  }
};

/**
 * Remove permissions from role
 * @param {string} role - Role name
 * @param {Array<string>} permissionIds - Array of permission IDs
 * @returns {Promise<Object>} Success status
 */
export const removePermissionsFromRole = async (role, permissionIds) => {
  try {
    const response = await apiClient.permissions.removeFromRole(role, permissionIds);
    if (response.success) {
      return {
        success: true,
        message: response.message
      };
    }
    return { error: 'Failed to remove permissions from role' };
  } catch (error) {
    console.error('removePermissionsFromRole Error:', error);
    return { error: error.message };
  }
};

/**
 * Assign permissions to user
 * @param {string} userId - User ID
 * @param {Array<string>} permissionIds - Array of permission IDs
 * @param {boolean} granted - Whether to grant (true) or revoke (false)
 * @returns {Promise<Object>} Success status
 */
export const assignPermissionsToUser = async (userId, permissionIds, granted = true) => {
  try {
    const response = await apiClient.permissions.assignToUser(userId, permissionIds, granted);
    if (response.success) {
      return {
        success: true,
        message: response.message
      };
    }
    return { error: 'Failed to assign permissions to user' };
  } catch (error) {
    console.error('assignPermissionsToUser Error:', error);
    return { error: error.message };
  }
};

/**
 * Remove permissions from user
 * @param {string} userId - User ID
 * @param {Array<string>} permissionIds - Array of permission IDs
 * @returns {Promise<Object>} Success status
 */
export const removePermissionsFromUser = async (userId, permissionIds) => {
  try {
    const response = await apiClient.permissions.removeFromUser(userId, permissionIds);
    if (response.success) {
      return {
        success: true,
        message: response.message
      };
    }
    return { error: 'Failed to remove permissions from user' };
  } catch (error) {
    console.error('removePermissionsFromUser Error:', error);
    return { error: error.message };
  }
};

/**
 * Set systemadmin status for user
 * @param {string} userId - User ID
 * @param {boolean} isSystemAdmin - Whether user should be systemadmin
 * @returns {Promise<Object>} Success status
 */
export const setSystemAdmin = async (userId, isSystemAdmin) => {
  try {
    const response = await apiClient.permissions.setSystemAdmin(userId, isSystemAdmin);
    if (response.success) {
      return {
        success: true,
        message: response.message,
        data: response.data
      };
    }
    return { error: 'Failed to update systemadmin status' };
  } catch (error) {
    console.error('setSystemAdmin Error:', error);
    return { error: error.message };
  }
};

/**
 * Get all users for permissions management
 * @param {string} search - Search query (email, name, or user_id)
 * @returns {Promise<Array>} List of users
 */
export const getAllUsersForPermissions = async (search = '') => {
  try {
    const response = await apiClient.permissions.getAllUsers(search);
    // Backend returns { success: true, data: [...], count: ... }
    return response.data?.data || response.data || [];
  } catch (error) {
    console.error('getAllUsersForPermissions Error:', error);
    return { error: error.message };
  }
};

export default {
  getAllPermissions,
  getPermissionById,
  getMyPermissions,
  getMyRolePermissions,
  getRoleCacheVersions,
  getUserPermissions,
  getRolePermissions,
  checkUserPermission,
  checkUserPermissionsBulk,
  assignPermissionsToRole,
  removePermissionsFromRole,
  assignPermissionsToUser,
  removePermissionsFromUser,
  setSystemAdmin,
  getAllUsersForPermissions
};

