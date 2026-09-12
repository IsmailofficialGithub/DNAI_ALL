/**
 * User Management API (Backend)
 * These functions call the backend API instead of Supabase directly
 */

import apiClient from '../../services/apiClient';

/**
 * Search all users by email/name (for ticket creation - returns all users regardless of role)
 * @param {string} query - Search query (email or name)
 * @returns {Promise<Array>} List of matching users
 */
export const searchAllUsers = async (query) => {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const response = await apiClient.users.search(query.trim());
    // Backend returns { success: true, count: X, data: [...] }
    // Extract the users array from response.data
    if (response && response.success && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error('searchAllUsers Error:', error);
    return [];
  }
};

/**
 * Get all admin users with optional search
 * @param {Object} filters - Filter options
 * @param {string} filters.search - Search term for name/email
 * @returns {Promise<Array>} List of users
 */
export const getAdminUsers = async (filters = {}) => {
  try {
    const { search } = filters;
    const params = new URLSearchParams();

    if (search && search.trim() !== '') {
      params.append('search', search.trim());
    }

    const queryString = params.toString();
    const response = await apiClient.users.getAll(queryString ? `?${queryString}` : '');
    // Backend returns { success: true, count: X, data: [...] }
    // Extract the users array from response.data
    return response.data || [];
  } catch (error) {
    console.error('getAdminUsers Error:', error);
    return { error: error.message };
  }
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User data
 */
export const getUserById = async (userId) => {
  try {
    const response = await apiClient.users.getById(userId);
    return response;
  } catch (error) {
    console.error('getUserById Error:', error);
    return { error: error.message };
  }
};

/**
 * Create new user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.password - User password
 * @param {string} userData.full_name - User full name
 * @param {Array<string>} userData.roles - User roles array (e.g., ['consumer', 'reseller'])
 * @param {string} userData.country - User country (optional)
 * @param {string} userData.city - User city (optional)
 * @param {string} userData.phone - User phone (optional)
 * @returns {Promise<Object>} Created user data
 */
export const createUser = async (userData) => {
  try {
    const requestData = {
      email: userData.email,
      password: userData.password,
      full_name: userData.full_name,
      roles: userData.roles || ['user'],
      country: userData.country || null,
      city: userData.city || null,
      phone: userData.phone || null
    };

    // Add consumer-specific fields if consumer role is selected
    if (userData.roles && userData.roles.includes('consumer')) {
      if (userData.referred_by) {
        requestData.referred_by = userData.referred_by;
      }
      if (userData.subscribed_products && Array.isArray(userData.subscribed_products)) {
        requestData.subscribed_products = userData.subscribed_products;
      }
      if (userData.trial_expiry_date) {
        requestData.trial_expiry_date = userData.trial_expiry_date;
      }
    }

    const response = await apiClient.users.create(requestData);

    if (response.success) {
      return {
        success: true,
        user: response.user, // Fixed: response.user instead of response.data.user
        message: response.message
      };
    }

    // Return the error message from the backend if available
    const errorMessage = response.message || response.error || 'Failed to create user';
    return { error: errorMessage, success: false };
  } catch (error) {
    console.error('createUser Error:', error);
    // Handle axios errors - extract message from response if available
    const errorMessage = error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Failed to create user. Please try again.';
    return { error: errorMessage, success: false };
  }
};

/**
 * Update user - supports roles, full name, country, city, and phone
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @param {Array<string>} updateData.roles - New roles array (optional)
 * @param {string} updateData.role - New role (optional, backward compatibility)
 * @param {string} updateData.full_name - New full name (optional)
 * @param {string} updateData.country - New country (optional)
 * @param {string} updateData.city - New city (optional)
 * @param {string} updateData.phone - New phone (optional)
 * @returns {Promise<Object>} Updated user data
 */
export const updateUserRole = async (userId, updateData) => {
  try {
    // Clean up the update data - only send fields that are provided
    const cleanedData = {};

    // Support both roles array and single role (backward compatibility)
    if (updateData.roles !== undefined) {
      cleanedData.roles = updateData.roles;
    } else if (updateData.role !== undefined) {
      cleanedData.role = updateData.role;
    }
    if (updateData.nickname !== undefined) cleanedData.nickname = updateData.nickname;
    if (updateData.full_name !== undefined) cleanedData.full_name = updateData.full_name;
    if (updateData.country !== undefined) cleanedData.country = updateData.country;
    if (updateData.city !== undefined) cleanedData.city = updateData.city;
    if (updateData.phone !== undefined) cleanedData.phone = updateData.phone;

    const response = await apiClient.users.update(userId, cleanedData);

    if (response.success) {
      return {
        success: true,
        user: response.data, // This is correct - update returns data directly
        message: response.message
      };
    }

    return { error: 'Failed to update user' };
  } catch (error) {
    console.error('updateUserRole Error:', error);
    return { error: error.message };
  }
};

/**
 * Delete user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Success status
 */
export const deleteUser = async (userId) => {
  try {
    const response = await apiClient.users.delete(userId);

    if (response.success) {
      return {
        success: true,
        message: response.message
      };
    }

    return { error: 'Failed to delete user' };
  } catch (error) {
    console.error('deleteUser Error:', error);
    return { error: error.message };
  }
};

/**
 * Reset user password
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Success status with email
 */
export const resetUserPassword = async (userId) => {
  try {
    const response = await apiClient.users.resetPassword(userId);

    if (response.success) {
      return {
        success: true,
        email: response.email,
        message: response.message
      };
    }

    return { error: 'Failed to reset password' };
  } catch (error) {
    console.error('resetUserPassword Error:', error);
    return { error: error.message };
  }
};

/**
 * Update user account status
 * @param {string} userId - User ID
 * @param {string} accountStatus - New account status (active, deactive)
 * @returns {Promise<Object>} Success status
 */
export const updateUserAccountStatus = async (userId, accountStatus) => {
  try {
    const response = await apiClient.users.updateAccountStatus(userId, accountStatus);

    if (response.success) {
      return {
        success: true,
        message: response.message,
        data: response.data
      };
    }

    return { error: 'Failed to update account status' };
  } catch (error) {
    console.error('updateUserAccountStatus Error:', error);
    return { error: error.message };
  }
};

export default {
  getAdminUsers,
  getUserById,
  createUser,
  updateUserRole,
  deleteUser,
  resetUserPassword,
  updateUserAccountStatus
};

