import apiClient from '../../services/apiClient';

/**
 * Get error logs with filters
 * @param {Object} filters - Filter options (page, limit, platform, user_id, search, start_date, end_date)
 * @returns {Promise<Object>} Response with error logs data
 */
export const getErrorLogs = async (filters = {}) => {
  try {
    const {
      page = 1,
      limit = 50,
      platform,
      user_id,
      search,
      start_date,
      end_date
    } = filters;

    // Build query string
    const queryParams = new URLSearchParams();
    queryParams.append('page', page);
    queryParams.append('limit', limit);
    
    if (platform) queryParams.append('platform', platform);
    if (user_id) queryParams.append('user_id', user_id);
    if (search) queryParams.append('search', search);
    if (start_date) queryParams.append('start_date', start_date);
    if (end_date) queryParams.append('end_date', end_date);

    const queryString = queryParams.toString();
    const response = await apiClient.errorLogs.getAll(queryString ? `?${queryString}` : '');

    if (response && response.success) {
      return {
        success: true,
        data: response.data || [],
        pagination: response.pagination || {},
        filters: response.filters || {}
      };
    }

    return { error: response?.message || response?.error || 'Failed to fetch error logs' };
  } catch (error) {
    console.error('getErrorLogs Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to fetch error logs' };
  }
};

/**
 * Get error log by ID
 * @param {string} id - Error log ID
 * @returns {Promise<Object>} Response with error log data
 */
export const getErrorLogById = async (id) => {
  try {
    if (!id) {
      return { error: 'Error log ID is required' };
    }

    const response = await apiClient.errorLogs.getById(id);

    if (response && response.success) {
      return {
        success: true,
        data: response.data
      };
    }

    return { error: response?.message || response?.error || 'Failed to fetch error log' };
  } catch (error) {
    console.error('getErrorLogById Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to fetch error log' };
  }
};

/**
 * Create error log (for frontend error reporting)
 * @param {Object} errorData - Error data (error_heading, error_details, platform, user_id)
 * @returns {Promise<Object>} Response
 */
export const createErrorLog = async (errorData) => {
  try {
    if (!errorData || !errorData.error_heading) {
      return { error: 'error_heading is required' };
    }

    const response = await apiClient.errorLogs.create(errorData);

    if (response && response.success) {
      return {
        success: true,
        data: response.data
      };
    }

    return { error: response?.message || response?.error || 'Failed to create error log' };
  } catch (error) {
    console.error('createErrorLog Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.response?.data?.message || error.message || 'Failed to create error log' };
  }
};
