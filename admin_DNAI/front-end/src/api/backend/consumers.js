/**
 * Consumer Management API (Backend)
 * These functions call the backend API instead of Supabase directly
 */

import apiClient from '../../services/apiClient';

/**
 * Get all consumers with optional filters
 * @param {Object} filters - Filter options
 * @param {string} filters.account_status - Account status filter (active, deactive, expired_subscription, all)
 * @param {string} filters.search - Search term for name/email
 * @returns {Promise<Array>} List of consumers
 */
export const getConsumers = async (filters = {}) => {
  try {
    const { account_status, search } = filters;
    const params = new URLSearchParams();

    if (account_status && account_status !== 'all') {
      params.append('account_status', account_status);
    }

    if (search && search.trim() !== '') {
      params.append('search', search.trim());
    }

    const queryString = params.toString();
    const url = queryString ? `/consumers?${queryString}` : '/consumers';

    const response = await apiClient.consumers.getAll(queryString ? `?${queryString}` : '');
    // Backend returns { success: true, count: X, data: [...] }
    // Extract the consumers array from response.data
    return response.data || [];
  } catch (error) {
    console.error('getConsumers Error:', error);
    return { error: error.message };
  }
};

/**
 * Get consumer by ID
 * @param {string} consumerId - Consumer ID
 * @returns {Promise<Object>} Consumer data
 */
export const getConsumerById = async (consumerId) => {
  try {
    const response = await apiClient.consumers.getById(consumerId);
    return response;
  } catch (error) {
    console.error('getConsumerById Error:', error);
    return { error: error.message };
  }
};

/**
 * Create new consumer
 * @param {Object} consumerData - Consumer data
 * @param {string} consumerData.email - Consumer email
 * @param {string} consumerData.password - Consumer password
 * @param {string} consumerData.full_name - Consumer full name
 * @param {string} consumerData.country - Consumer country (required)
 * @param {string} consumerData.city - Consumer city (optional)
 * @param {string} consumerData.phone - Consumer phone (optional)
 * @param {string} consumerData.trial_expiry_date - Trial expiry date (optional)
 * @returns {Promise<Object>} Created consumer data
 */
export const createConsumer = async (consumerData) => {
  try {
    // Use the resellers endpoint for creating consumers
    const requestData = {
      email: consumerData.email,
      password: consumerData.password,
      full_name: consumerData.full_name,
      country: consumerData.country,
      city: consumerData.city,
      phone: consumerData.phone || null,
      roles: consumerData.roles || ['consumer'], // Send roles array
      trial_expiry_date: consumerData.trial_expiry_date || null
    };

    // Add referred_by if provided (reseller ID or admin ID)
    if (consumerData.referred_by !== undefined && consumerData.referred_by !== null && consumerData.referred_by !== '') {
      requestData.referred_by = consumerData.referred_by;
    }

    // Add subscribed_packages if provided (preferred) or subscribed_products (backward compatibility)
    if (consumerData.subscribed_packages !== undefined) {
      requestData.subscribed_packages = consumerData.subscribed_packages || [];
    } else if (consumerData.subscribed_products !== undefined) {
      requestData.subscribed_packages = consumerData.subscribed_products || [];
    }

    // Add subscribed_products if provided (for product access)
    if (consumerData.subscribed_products !== undefined) {
      requestData.subscribed_products = consumerData.subscribed_products || [];
    }

    // Add productSettings if provided
    if (consumerData.productSettings !== undefined) {
      requestData.productSettings = consumerData.productSettings;
    }

    console.log('createConsumer sending data:', requestData);

    const response = await apiClient.resellers.createConsumer(requestData);

    if (response.success) {
      return {
        success: true,
        user: response.user,
        message: response.message || 'Consumer created successfully'
      };
    }

    // Extract error message from response
    const errorMessage = response.message || response.error || 'Failed to create consumer';
    return { success: false, error: errorMessage };
  } catch (error) {
    console.error('createConsumer Error:', error);
    // Extract error message from various possible locations
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to create consumer';
    return { success: false, error: errorMessage };
  }
};

/**
 * Update consumer
 * @param {string} consumerId - Consumer ID
 * @param {Object} updateData - Data to update
 * @param {string} updateData.full_name - Full name (optional)
 * @param {string} updateData.country - Country (optional)
 * @param {string} updateData.city - City (optional)
 * @param {string} updateData.phone - Phone number (optional)
 * @param {string} updateData.trial_expiry_date - Trial expiry date (optional)
 * @returns {Promise<Object>} Updated consumer data
 */
export const updateConsumer = async (consumerId, updateData) => {
  try {
    // Clean up the update data - only send fields that are provided
    const cleanedData = {};

    if (updateData.full_name !== undefined) cleanedData.full_name = updateData.full_name;
    if (updateData.country !== undefined) cleanedData.country = updateData.country;
    if (updateData.city !== undefined) cleanedData.city = updateData.city;
    if (updateData.phone !== undefined) cleanedData.phone = updateData.phone;
    if (updateData.trial_expiry_date !== undefined) cleanedData.trial_expiry_date = updateData.trial_expiry_date;
    // Support both subscribed_packages (new) and subscribed_products (backward compatibility)
    if (updateData.subscribed_packages !== undefined) cleanedData.subscribed_packages = updateData.subscribed_packages;
    if (updateData.subscribed_products !== undefined) cleanedData.subscribed_products = updateData.subscribed_products;
    if (updateData.productSettings !== undefined) cleanedData.productSettings = updateData.productSettings;
    if (updateData.nickname !== undefined) cleanedData.nickname = updateData.nickname;
    // Support both roles array and single role (backward compatibility)
    if (updateData.roles !== undefined) {
      cleanedData.roles = updateData.roles;
    } else if (updateData.role !== undefined) {
      cleanedData.role = updateData.role;
    }

    console.log('updateConsumer sending data:', cleanedData);

    const response = await apiClient.consumers.update(consumerId, cleanedData);

    if (response.success) {
      return {
        success: true,
        user: response.user,
        message: response.message
      };
    }

    return { error: 'Failed to update consumer' };
  } catch (error) {
    console.error('updateConsumer Error:', error);
    return { error: error.message };
  }
};

/**
 * Delete consumer
 * @param {string} consumerId - Consumer ID
 * @returns {Promise<Object>} Success status
 */
export const deleteConsumer = async (consumerId) => {
  try {
    const response = await apiClient.consumers.delete(consumerId);

    if (response.success) {
      return {
        success: true,
        message: response.message
      };
    }

    return { error: 'Failed to delete consumer' };
  } catch (error) {
    console.error('deleteConsumer Error:', error);
    return { error: error.message };
  }
};

/**
 * Reset consumer password
 * @param {string} consumerId - Consumer ID
 * @returns {Promise<Object>} Success status
 */
export const resetConsumerPassword = async (consumerId, password = null) => {
  try {
    const response = await apiClient.consumers.resetPassword(consumerId, password);

    if (response.success) {
      return {
        success: true,
        message: response.message,
        newPassword: response.newPassword
      };
    }

    return { error: 'Failed to reset password' };
  } catch (error) {
    console.error('resetConsumerPassword Error:', error);
    return { error: error.message };
  }
};

/**
 * Update consumer account status
 * @param {string} consumerId - Consumer ID
 * @param {string} accountStatus - New account status (active, deactive, expired_subscription)
 * @param {string|null} trialExpiryDate - Trial expiry date (optional)
 * @param {boolean} lifetimeAccess - Whether to grant lifetime access (optional)
 * @returns {Promise<Object>} Success status
 */
export const updateConsumerAccountStatus = async (consumerId, accountStatus, trialExpiryDate = null, lifetimeAccess = false) => {
  try {
    const response = await apiClient.consumers.updateAccountStatus(consumerId, accountStatus, trialExpiryDate, lifetimeAccess);

    if (response.success) {
      return {
        success: true,
        message: response.message,
        data: response.data
      };
    }

    return { error: 'Failed to update account status' };
  } catch (error) {
    console.error('updateConsumerAccountStatus Error:', error);
    return { error: error.message };
  }
};

/**
 * Grant lifetime access to a consumer
 * @param {string} consumerId - Consumer ID
 * @returns {Promise<Object>} Success status
 */
export const grantLifetimeAccess = async (consumerId) => {
  try {
    const response = await apiClient.consumers.grantLifetimeAccess(consumerId);

    if (response.success) {
      return {
        success: true,
        message: response.message || 'Lifetime access granted successfully',
        data: response.data
      };
    }

    return { error: 'Failed to grant lifetime access' };
  } catch (error) {
    console.error('grantLifetimeAccess Error:', error);
    return { error: error.message };
  }
};

/**
 * Revoke lifetime access from a consumer
 * @param {string} consumerId - Consumer ID
 * @param {number|null} trialDays - Number of days for trial (1-365, optional, defaults to 7)
 * @returns {Promise<Object>} Success status
 */
export const revokeLifetimeAccess = async (consumerId, trialDays = null) => {
  try {
    const response = await apiClient.consumers.revokeLifetimeAccess(consumerId, trialDays);

    if (response.success) {
      return {
        success: true,
        message: response.message || 'Lifetime access revoked successfully',
        data: response.data
      };
    }

    return { error: 'Failed to revoke lifetime access' };
  } catch (error) {
    console.error('revokeLifetimeAccess Error:', error);
    return { error: error.message };
  }
};

/**
 * Reassign consumer to a different reseller
 * @param {string} consumerId - Consumer ID
 * @param {string} resellerId - New reseller ID
 * @returns {Promise<Object>} Success status
 */
export const reassignConsumerToReseller = async (consumerId, resellerId) => {
  try {
    const response = await apiClient.consumers.reassign(consumerId, { reseller_id: resellerId });

    if (response.success) {
      return {
        success: true,
        message: response.message || 'Consumer reassigned successfully',
        data: response.data
      };
    }

    return { error: response.message || 'Failed to reassign consumer' };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Get consumer product settings
 * @param {string} consumerId - Consumer ID
 * @returns {Promise<Object>} Product settings
 */
export const getConsumerProductSettings = async (consumerId) => {
  try {
    const response = await apiClient.consumers.getProductSettings(consumerId);
    if (response.success) {
      return {
        success: true,
        data: response.data || {}
      };
    }
    return { error: 'Failed to fetch product settings' };
  } catch (error) {
    console.error('getConsumerProductSettings Error:', error);
    return { error: error.message };
  }
};

/**
 * Update consumer product settings
 * @param {string} consumerId - Consumer ID
 * @param {Object} settings - Settings object
 * @returns {Promise<Object>} Success status
 */
export const updateConsumerProductSettings = async (consumerId, settings) => {
  try {
    const response = await apiClient.consumers.updateProductSettings(consumerId, settings);
    if (response.success) {
      return {
        success: true,
        message: response.message || 'Product settings updated successfully',
        data: response.data
      };
    }
    return { error: 'Failed to update product settings' };
  } catch (error) {
    console.error('updateConsumerProductSettings Error:', error);
    return { error: error.message };
  }
};

/**
 * Get user credits
 * @param {string} userId - User ID
 */
export const getUserCredits = async (userId) => {
  try {
    const response = await apiClient.consumers.getUserCredits(userId);
    return response;
  } catch (error) {
    console.error('getUserCredits Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update user credits
 * @param {string} userId - User ID
 * @param {Object} creditData - Credit data
 */
export const updateUserCredits = async (userId, creditData) => {
  try {
    const response = await apiClient.consumers.updateUserCredits(userId, creditData);
    return response;
  } catch (error) {
    console.error('updateUserCredits Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get billing packages for product
 * @param {string} productId - Product ID
 */
export const getBillingPackages = async (productId) => {
  try {
    // Product ID for Inbound (from .env or hardcoded)
    const inboundProductId = '1e27e1d8-2c82-408c-89c3-ecab9f608cc8';
    
    // If it's an inbound product, use the specialized endpoint
    if (productId === inboundProductId) {
      console.log('📦 Fetching specialized inbound packages...');
      return await getInboundPackages();
    }

    const response = await apiClient.consumers.getBillingPackages(productId);
    return response;
  } catch (error) {
    console.error('getBillingPackages Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get specialized inbound packages
 */
export const getInboundPackages = async () => {
  try {
    const response = await apiClient.inbound.getPackages();
    
    // The backend returns a paginated response: { success: true, data: [...], count: X, ... }
    // We need to return it in a way that the existing frontend components expect
    // If it's paginated, extract the data array
    if (response.success && response.data && !Array.isArray(response.data)) {
      return {
        success: true,
        data: response.data.data || []
      };
    }
    
    return response;
  } catch (error) {
    console.error('getInboundPackages Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create user subscription
 * @param {string} userId - User ID
 * @param {Object} subscriptionData - Subscription data
 */
export const createUserSubscription = async (userId, subscriptionData) => {
  try {
    const response = await apiClient.consumers.createUserSubscription(userId, subscriptionData);
    return response;
  } catch (error) {
    console.error('createUserSubscription Error:', error);
    return { success: false, error: error.message };
  }
};

export default {
  getConsumers,
  getConsumerById,
  createConsumer,
  updateConsumer,
  deleteConsumer,
  resetConsumerPassword,
  updateConsumerAccountStatus,
  grantLifetimeAccess,
  revokeLifetimeAccess,
  reassignConsumerToReseller,
  getConsumerProductSettings,
  updateConsumerProductSettings,
  getUserCredits,
  updateUserCredits,
  getBillingPackages,
  getInboundPackages,
  createUserSubscription
};

