/**
 * Reseller Management API (Backend)
 * These functions call the backend API instead of Supabase directly
 */

import apiClient from '../../services/apiClient';

/**
 * Get all resellers with optional search
 * @param {Object} filters - Filter options
 * @param {string} filters.search - Search term for name/email
 * @returns {Promise<Array>} List of resellers
 */
export const getResellers = async (filters = {}) => {
  try {
    const { search } = filters;
    const params = new URLSearchParams();
    
    if (search && search.trim() !== '') {
      params.append('search', search.trim());
    }
    
    const queryString = params.toString();
    const response = await apiClient.resellers.getAll(queryString ? `?${queryString}` : '');
    // Backend returns { success: true, count: X, data: [...] }
    // axios interceptor returns response.data directly, which is { success: true, count: X, data: [...] }
    // Extract the resellers array from response.data.data
    if (response && response.data && Array.isArray(response.data)) {
      return response.data;
    } else if (response && response.success && Array.isArray(response.data)) {
      return response.data;
    } else if (Array.isArray(response)) {
      return response;
    }
    return [];
  } catch (error) {
    console.error('getResellers Error:', error);
    return { error: error.message };
  }
};

/**
 * Get reseller by ID
 * @param {string} resellerId - Reseller ID
 * @returns {Promise<Object>} Reseller data
 */
export const getResellerById = async (resellerId) => {
  try {
    const response = await apiClient.resellers.getById(resellerId);
    return response;
  } catch (error) {
    console.error('getResellerById Error:', error);
    return { error: error.message };
  }
};

/**
 * Create new reseller
 * @param {Object} resellerData - Reseller data
 * @param {string} resellerData.email - Reseller email
 * @param {string} resellerData.password - Reseller password
 * @param {string} resellerData.full_name - Reseller full name
 * @param {string} resellerData.country - Reseller country (optional)
 * @param {string} resellerData.city - Reseller city (optional)
 * @param {string} resellerData.phone - Reseller phone (optional)
 * @returns {Promise<Object>} Created reseller data
 */
export const createReseller = async (resellerData) => {
  try {
    const requestData = {
      email: resellerData.email,
      password: resellerData.password,
      full_name: resellerData.full_name,
      country: resellerData.country || null,
      city: resellerData.city || null,
      phone: resellerData.phone || null,
      roles: resellerData.roles || ['reseller'], // Send roles array
      nickname: resellerData.nickname || null
    };
    
    // Add consumer-specific fields if consumer role is selected
    if (resellerData.roles && resellerData.roles.includes('consumer')) {
      if (resellerData.referred_by) {
        requestData.referred_by = resellerData.referred_by;
      }
      if (resellerData.subscribed_products && Array.isArray(resellerData.subscribed_products)) {
        requestData.subscribed_products = resellerData.subscribed_products;
      }
      if (resellerData.trial_expiry_date) {
        requestData.trial_expiry_date = resellerData.trial_expiry_date;
      }
    }
    
    const response = await apiClient.resellers.create(requestData);
    
    if (response.success) {
      return {
        success: true,
        user: response.user,
        message: response.message || 'Reseller created successfully'
      };
    }
    
    return { error: 'Failed to create reseller' };
  } catch (error) {
    console.error('createReseller Error:', error);
    return { error: error.message };
  }
};

/**
 * Update reseller
 * @param {string} resellerId - Reseller ID
 * @param {Object} updateData - Data to update
 * @param {string} updateData.full_name - Full name (optional)
 * @param {string} updateData.country - Country (optional)
 * @param {string} updateData.city - City (optional)
 * @param {string} updateData.phone - Phone number (optional)
 * @returns {Promise<Object>} Updated reseller data
 */
export const updateReseller = async (resellerId, updateData) => {
  try {
    // Clean up the update data - only send fields that are provided
    const cleanedData = {};
    
    if (updateData.full_name !== undefined) cleanedData.full_name = updateData.full_name;
    if (updateData.nickname !== undefined) cleanedData.nickname = updateData.nickname;
    if (updateData.country !== undefined) cleanedData.country = updateData.country;
    if (updateData.city !== undefined) cleanedData.city = updateData.city;
    if (updateData.phone !== undefined) cleanedData.phone = updateData.phone;
    // Support both roles array and single role (backward compatibility)
    if (updateData.roles !== undefined) {
      cleanedData.roles = updateData.roles;
    } else if (updateData.role !== undefined) {
      cleanedData.role = updateData.role;
    }
    
    const response = await apiClient.resellers.update(resellerId, cleanedData);
    
    if (response.success) {
      return {
        success: true,
        user: response.user,
        message: response.message
      };
    }
    
    return { error: 'Failed to update reseller' };
  } catch (error) {
    console.error('updateReseller Error:', error);
    return { error: error.message };
  }
};

/**
 * Delete reseller
 * @param {string} resellerId - Reseller ID
 * @returns {Promise<Object>} Success status
 */
export const deleteReseller = async (resellerId) => {
  try {
    const response = await apiClient.resellers.delete(resellerId);
    
    if (response.success) {
      return {
        success: true,
        message: response.message
      };
    }
    
    return { error: 'Failed to delete reseller' };
  } catch (error) {
    console.error('deleteReseller Error:', error);
    return { error: error.message };
  }
};

/**
 * Reset reseller password
 * @param {string} resellerId - Reseller ID
 * @returns {Promise<Object>} Success status
 */
export const resetResellerPassword = async (resellerId, password = null) => {
  try {
    const response = await apiClient.resellers.resetPassword(resellerId, password);
    
    if (response.success) {
      return {
        success: true,
        message: response.message,
        newPassword: response.newPassword
      };
    }
    
    return { error: 'Failed to reset password' };
  } catch (error) {
    console.error('resetResellerPassword Error:', error);
    return { error: error.message };
  }
};

/**
 * Update reseller account status
 * @param {string} resellerId - Reseller ID
 * @param {string} accountStatus - New account status (active, deactive)
 * @returns {Promise<Object>} Success status
 */
export const updateResellerAccountStatus = async (resellerId, accountStatus) => {
  try {
    const response = await apiClient.resellers.updateAccountStatus(resellerId, accountStatus);
    
    if (response.success) {
      return {
        success: true,
        message: response.message,
        data: response.data
      };
    }
    
    return { error: 'Failed to update account status' };
  } catch (error) {
    console.error('updateResellerAccountStatus Error:', error);
    return { error: error.message };
  }
};

/**
 * Create reseller (reseller can create other resellers)
 * @param {Object} resellerData - Reseller data
 * @returns {Promise<Object>} Created reseller data
 */
export const createMyReseller = async (resellerData) => {
  try {
    const response = await apiClient.resellers.createMyReseller({
      email: resellerData.email,
      password: resellerData.password,
      full_name: resellerData.full_name,
      country: resellerData.country || null,
      city: resellerData.city || null,
      phone: resellerData.phone || null,
      role: 'reseller',
      nickname: resellerData.nickname || null
    });
    
    if (response.success) {
      return {
        success: true,
        user: response.user,
        message: response.message || 'Reseller created successfully'
      };
    }
    
    return { error: 'Failed to create reseller' };
  } catch (error) {
    console.error('createMyReseller Error:', error);
    return { error: error.message };
  }
};

/**
 * Get reseller's own resellers
 * @param {string} search - Optional search term for name/email
 * @returns {Promise<Array>} List of resellers created by the logged-in reseller
 */
export const getMyResellers = async (search = '') => {
  try {
    const params = new URLSearchParams();
    if (search && search.trim() !== '') {
      params.append('search', search.trim());
    }
    const queryString = params.toString();
    const response = await apiClient.resellers.getMyResellers(queryString ? `?${queryString}` : '');
    if (response && response.success && Array.isArray(response.data)) {
      return response.data;
    } else if (Array.isArray(response)) {
      return response;
    }
    return [];
  } catch (error) {
    console.error('getMyResellers Error:', error);
    return { error: error.message };
  }
};

/**
 * Invite reseller (reseller can invite other resellers)
 * @param {string} email - Email address to invite
 * @returns {Promise<Object>} Invitation result
 */
export const inviteReseller = async (email) => {
  try {
    const response = await apiClient.invitations.inviteReseller(email);
    if (response && response.success) {
      return {
        success: true,
        message: response.message || 'Invitation sent successfully'
      };
    }
    return { error: 'Failed to send invitation' };
  } catch (error) {
    console.error('inviteReseller Error:', error);
    return { error: error.message };
  }
};

/**
 * Update reseller (reseller can only update their own resellers)
 * @param {string} resellerId - Reseller ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated reseller data
 */
export const updateMyReseller = async (resellerId, updateData) => {
  try {
    const response = await apiClient.resellers.updateMyReseller(resellerId, updateData);
    if (response && response.success) {
      return {
        success: true,
        user: response.data,
        message: response.message
      };
    }
    return { error: 'Failed to update reseller' };
  } catch (error) {
    console.error('updateMyReseller Error:', error);
    return { error: error.message };
  }
};

/**
 * Delete reseller (reseller can only delete their own resellers)
 * @param {string} resellerId - Reseller ID
 * @returns {Promise<Object>} Success status
 */
export const deleteMyReseller = async (resellerId) => {
  try {
    const response = await apiClient.resellers.deleteMyReseller(resellerId);
    if (response && response.success) {
      return {
        success: true,
        message: response.message
      };
    }
    return { error: 'Failed to delete reseller' };
  } catch (error) {
    console.error('deleteMyReseller Error:', error);
    return { error: error.message };
  }
};

export default {
  getResellers,
  getResellerById,
  createReseller,
  updateReseller,
  deleteReseller,
  resetResellerPassword,
  updateResellerAccountStatus,
  getMyResellers,
  createMyReseller,
  inviteReseller,
  updateMyReseller,
  deleteMyReseller
};

