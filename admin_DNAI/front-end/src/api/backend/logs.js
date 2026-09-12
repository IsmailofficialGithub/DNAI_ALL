import apiClient from '../../services/apiClient';

/**
 * Get API logs with pagination and filtering
 * @param {Object} params - Query parameters
 * @param {string} params.date - Date filter (YYYY-MM-DD), defaults to today
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {string} params.method - Filter by HTTP method
 * @param {string} params.endpoint - Filter by endpoint (partial match)
 * @param {string|number} params.status_code - Filter by status code
 * @param {string} params.user_id - Filter by user ID
 * @param {string} params.search - Search in endpoint, user_email, user_name
 * @returns {Promise<Object>} Logs response with data and pagination info
 */
export const getApiLogs = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.date) queryParams.append('date', params.date);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.method) queryParams.append('method', params.method);
    if (params.endpoint) queryParams.append('endpoint', params.endpoint);
    if (params.status_code) queryParams.append('status_code', params.status_code.toString());
    if (params.user_id) queryParams.append('user_id', params.user_id);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const response = await apiClient.logs.getAll(queryString ? `?${queryString}` : '');
    
    // The axios interceptor already unwraps response.data, so response is the data object
    if (response?.success !== undefined) {
      return response;
    }
    
    // If response doesn't have success field, wrap it
    return {
      success: true,
      data: response?.data || response || [],
      pagination: response?.pagination || {},
      availableDates: response?.availableDates || [],
      filters: response?.filters || {}
    };
  } catch (error) {
    console.error('Error fetching API logs:', error);
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to fetch API logs';
    throw new Error(errorMessage);
  }
};

