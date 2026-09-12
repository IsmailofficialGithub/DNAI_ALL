import apiClient from '../../services/apiClient';

/**
 * Get all API keys with optional filters
 * @param {Object} filters - Filter options (is_active, search)
 * @returns {Promise<Object>} Response with API keys data
 */
export const getApiKeys = async (filters = {}) => {
  try {
    const {
      is_active,
      search
    } = filters;

    // Build query string
    const queryParams = new URLSearchParams();
    
    if (is_active !== undefined) queryParams.append('is_active', is_active);
    if (search) queryParams.append('search', search);

    const queryString = queryParams.toString();
    const response = await apiClient.apiKeys.getAll(queryString ? `?${queryString}` : '');

    if (response && response.success) {
      return {
        success: true,
        data: response.data || [],
        count: response.count || 0
      };
    }

    return { error: response?.message || response?.error || 'Failed to fetch API keys' };
  } catch (error) {
    console.error('getApiKeys Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to fetch API keys' };
  }
};

/**
 * Get API key by ID
 * @param {string} id - API key ID
 * @returns {Promise<Object>} Response with API key data
 */
export const getApiKeyById = async (id) => {
  try {
    if (!id) {
      return { error: 'API key ID is required' };
    }

    const response = await apiClient.apiKeys.getById(id);

    if (response && response.success) {
      return {
        success: true,
        data: response.data
      };
    }

    return { error: response?.message || response?.error || 'Failed to fetch API key' };
  } catch (error) {
    console.error('getApiKeyById Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to fetch API key' };
  }
};

/**
 * Create new API key
 * @param {Object} apiKeyData - API key data (name)
 * @returns {Promise<Object>} Response with API key and secret
 */
export const createApiKey = async (apiKeyData) => {
  try {
    if (!apiKeyData || !apiKeyData.name) {
      return { error: 'Name is required' };
    }

    const response = await apiClient.apiKeys.create(apiKeyData);

    if (response && response.success) {
      return {
        success: true,
        data: response.data,
        message: response.message
      };
    }

    return { error: response?.message || response?.error || 'Failed to create API key' };
  } catch (error) {
    console.error('createApiKey Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to create API key' };
  }
};

/**
 * Update API key
 * @param {string} id - API key ID
 * @param {Object} updates - Update data (name, is_active)
 * @returns {Promise<Object>} Response
 */
export const updateApiKey = async (id, updates) => {
  try {
    if (!id) {
      return { error: 'API key ID is required' };
    }

    const response = await apiClient.apiKeys.update(id, updates);

    if (response && response.success) {
      return {
        success: true,
        data: response.data,
        message: response.message
      };
    }

    return { error: response?.message || response?.error || 'Failed to update API key' };
  } catch (error) {
    console.error('updateApiKey Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to update API key' };
  }
};

/**
 * Delete API key
 * @param {string} id - API key ID
 * @returns {Promise<Object>} Response
 */
export const deleteApiKey = async (id) => {
  try {
    if (!id) {
      return { error: 'API key ID is required' };
    }

    const response = await apiClient.apiKeys.delete(id);

    if (response && response.success) {
      return {
        success: true,
        message: response.message
      };
    }

    return { error: response?.message || response?.error || 'Failed to delete API key' };
  } catch (error) {
    console.error('deleteApiKey Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to delete API key' };
  }
};

/**
 * Regenerate API secret
 * @param {string} id - API key ID
 * @returns {Promise<Object>} Response with new secret
 */
export const regenerateApiSecret = async (id) => {
  try {
    if (!id) {
      return { error: 'API key ID is required' };
    }

    const response = await apiClient.apiKeys.regenerateSecret(id);

    if (response && response.success) {
      return {
        success: true,
        data: response.data,
        message: response.message
      };
    }

    return { error: response?.message || response?.error || 'Failed to regenerate API secret' };
  } catch (error) {
    console.error('regenerateApiSecret Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to regenerate API secret' };
  }
};
