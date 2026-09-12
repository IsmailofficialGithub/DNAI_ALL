import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_Server_Url ;

/**
 * Public API client for call logs (no authentication required)
 */
const publicApiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Response interceptor to handle errors properly
publicApiClient.interceptors.response.use(
  (response) => {
    // Return the data directly (axios wraps it in response.data)
    return response.data;
  },
  (error) => {
    // Handle errors
    if (error.response) {
      // Server responded with error status
      return Promise.reject(error.response.data || error.response);
    } else if (error.request) {
      // Request made but no response
      return Promise.reject(new Error('Network error. Please check your connection.'));
    } else {
      // Something else happened
      return Promise.reject(error);
    }
  }
);

/**
 * Call Logs API
 */
export const callLogsApi = {
  /**
   * Get call logs by id or phone
   * @param {Object} params - Query parameters
   * @param {string} params.id - Call log ID (UUID)
   * @param {string} params.phone - Phone number
   * @returns {Promise} API response
   */
  getCallLogs: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.id) queryParams.append('id', params.id);
    if (params.phone) queryParams.append('phone', params.phone);
    
    const queryString = queryParams.toString();
    return publicApiClient.get(`/call-logs${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Create a new call log
   * @param {Object} callLogData - Call log data
   * @returns {Promise} API response
   */
  createCallLog: (callLogData) => {
    return publicApiClient.post('/call-logs', callLogData);
  },
};

export default callLogsApi;

