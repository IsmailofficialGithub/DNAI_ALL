import apiClient from '../../services/apiClient';

/**
 * Dashboard API functions
 */

/**
 * Get dashboard statistics (admin only)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getDashboardStats = async () => {
  try {
    const response = await apiClient.dashboard.getStats();
    console.log('📊 Dashboard API Response:', response);
    
    // Axios response structure: response.data contains the server response
    // Server response: { success: true, data: {...} }
    const apiResponse = response.data;
    
    // If the response already has success and data, return it as is
    if (apiResponse && apiResponse.success !== undefined && apiResponse.data) {
      return apiResponse;
    }
    
    // If response.data is the data directly (without wrapper)
    if (apiResponse && !apiResponse.success && !apiResponse.error) {
      return {
        success: true,
        data: apiResponse
      };
    }
    
    return apiResponse;
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to fetch dashboard stats'
    };
  }
};

/**
 * Get reseller business statistics (admin only)
 * @param {Object} filters - Filter options
 * @param {number} filters.month - Month (1-12)
 * @param {number} filters.year - Year
 * @param {string} filters.status - Invoice status (paid, unpaid, all)
 * @param {number} filters.limit - Limit results (default: 10)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getResellerStats = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.month) params.append('month', filters.month);
    if (filters.year) params.append('year', filters.year);
    if (filters.status) params.append('status', filters.status);
    if (filters.limit) params.append('limit', filters.limit);
    
    const queryString = params.toString();
    console.log('📊 Fetching reseller stats with filters:', filters, 'Query:', queryString);
    const response = await apiClient.dashboard.getResellerStats(queryString ? `?${queryString}` : '');

    
    // Ensure we return the response in the expected format
    const result = response.data;
    if (result && result.success !== undefined) {
      return result;
    }
    
    // If response.data is the data directly, wrap it
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('❌ Error fetching reseller stats:', error);
    console.error('❌ Error response:', error.response);
    return {
      success: false,
      error: error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to fetch reseller stats'
    };
  }
};

