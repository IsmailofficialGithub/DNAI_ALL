import apiClient from '../../services/apiClient';

/**
 * Get n8n errors with filters
 * @param {Object} filters - Filter options (workflow_id, execution_id, mode, limit, offset, order_by, order)
 * @returns {Promise<Object>} Response with n8n errors data
 */
export const getN8nErrors = async (filters = {}) => {
  try {
    const {
      workflow_id,
      execution_id,
      mode,
      limit = 50,
      offset = 0,
      order_by = 'created_at',
      order = 'desc'
    } = filters;

    // Build query string
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (order_by) queryParams.append('order_by', order_by);
    if (order) queryParams.append('order', order);
    if (workflow_id) queryParams.append('workflow_id', workflow_id);
    if (execution_id) queryParams.append('execution_id', execution_id);
    if (mode) queryParams.append('mode', mode);

    const queryString = queryParams.toString();
    const response = await apiClient.n8nErrors.getAll(queryString ? `?${queryString}` : '');

    if (response && response.success) {
      return {
        success: true,
        data: response.data || [],
        pagination: response.pagination || {}
      };
    }

    return { error: response?.message || response?.error || 'Failed to fetch n8n errors' };
  } catch (error) {
    console.error('getN8nErrors Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to fetch n8n errors' };
  }
};

/**
 * Get n8n error by ID
 * @param {string} id - Error ID
 * @returns {Promise<Object>} Response with error data
 */
export const getN8nErrorById = async (id) => {
  try {
    if (!id) {
      return { error: 'Error ID is required' };
    }

    const response = await apiClient.n8nErrors.getById(id);

    if (response && response.success) {
      return {
        success: true,
        data: response.data
      };
    }

    return { error: response?.message || response?.error || 'Failed to fetch n8n error' };
  } catch (error) {
    console.error('getN8nErrorById Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to fetch n8n error' };
  }
};
