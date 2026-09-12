import { axiosInstance } from '../../services/apiClient';

/**
 * Inbound Genie API
 * All API calls for inbound numbers, calls, schedules, and analytics
 */
export const inboundApi = {
  /**
   * Get all inbound numbers
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.search - Search term
   * @param {string} params.status - Filter by status
   * @param {string} params.provider - Filter by provider
   * @returns {Promise} API response
   */
  getAllInboundNumbers: (params = {}) => {
    return axiosInstance.get('/inbound/numbers', { params });
  },
  getNumbers: (params = {}) => {
    return axiosInstance.get('/inbound/numbers', { params });
  },

  /**
   * Get inbound number by ID
   * @param {string} id - Number ID
   * @returns {Promise} API response
   */
  getNumberById: (id) => {
    return axiosInstance.get(`/inbound/numbers/${id}`);
  },

  /**
   * Create inbound number
   * @param {Object} data - Number data
   * @returns {Promise} API response
   */
  createNumber: (data) => {
    return axiosInstance.post('/inbound/numbers', data);
  },

  /**
   * Update inbound number
   * @param {string} id - Number ID
   * @param {Object} data - Update data
   * @returns {Promise} API response
   */
  updateNumber: (id, data) => {
    return axiosInstance.patch(`/inbound/numbers/${id}`, data);
  },

  /**
   * Delete inbound number
   * @param {string} id - Number ID
   * @returns {Promise} API response
   */
  deleteNumber: (id) => {
    return axiosInstance.delete(`/inbound/numbers/${id}`);
  },

  /**
   * Get all call history
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.search - Search term
   * @param {string} params.status - Filter by status
   * @param {string} params.numberId - Filter by number ID
   * @returns {Promise} API response
   */
  getAllCallHistory: (params = {}) => {
    return axiosInstance.get('/inbound/calls', { params });
  },
  getCallHistory: (params = {}) => {
    return axiosInstance.get('/inbound/calls', { params });
  },

  /**
   * Get call history by ID
   * @param {string} id - Call ID
   * @returns {Promise} API response
   */
  getCallById: (id) => {
    return axiosInstance.get(`/inbound/calls/${id}`);
  },

  /**
   * Get call history by number ID
   * @param {string} numberId - Number ID
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  getCallsByNumberId: (numberId, params = {}) => {
    return axiosInstance.get(`/inbound/calls/number/${numberId}`, { params });
  },

  /**
   * Get all call schedules
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  getSchedules: (params = {}) => {
    return axiosInstance.get('/inbound/schedules', { params });
  },

  /**
   * Get schedule by ID
   * @param {string} id - Schedule ID
   * @returns {Promise} API response
   */
  getScheduleById: (id) => {
    return axiosInstance.get(`/inbound/schedules/${id}`);
  },

  /**
   * Get all inbound analytics
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  getAnalytics: (params = {}) => {
    return axiosInstance.get('/inbound/analytics', { params });
  },

  /**
   * Get analytics by number ID
   * @param {string} numberId - Number ID
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  getAnalyticsByNumberId: (numberId, params = {}) => {
    return axiosInstance.get(`/inbound/analytics/number/${numberId}`, { params });
  },

  /**
   * Get all inbound agents
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  getAllInboundAgents: (params = {}) => {
    return axiosInstance.get('/inbound/agents', { params });
  },
  getAgents: (params = {}) => {
    return axiosInstance.get('/inbound/agents', { params });
  },

  /**
   * Get inbound agent by ID
   * @param {string} id - Agent ID
   * @returns {Promise} API response
   */
  getAgentById: (id) => {
    return axiosInstance.get(`/inbound/agents/${id}`);
  },

  /**
   * Create inbound agent
   * @param {Object} data - Agent data
   * @returns {Promise} API response
   */
  createAgent: (data) => {
    return axiosInstance.post('/inbound/agents', data);
  },

  /**
   * Update inbound agent
   * @param {string} id - Agent ID
   * @param {Object} data - Update data
   * @returns {Promise} API response
   */
  updateAgent: (id, data) => {
    return axiosInstance.patch(`/inbound/agents/${id}`, data);
  },

  /**
   * Delete inbound agent
   * @param {string} id - Agent ID
   * @returns {Promise} API response
   */
  deleteAgent: (id) => {
    return axiosInstance.delete(`/inbound/agents/${id}`);
  },

  /**
   * Get available agents for assignment (active only)
   * @returns {Promise} API response
   */
  getAvailableAgents: () => {
    return axiosInstance.get('/inbound/agents/available');
  },

  /**
   * Assign number to agent
   * @param {string} id - Number ID
   * @param {string} agentId - Agent ID
   * @returns {Promise} API response
   */
  assignNumberToAgent: (id, agentId) => {
    return axiosInstance.post(`/inbound/numbers/${id}/assign`, { agent_id: agentId });
  },
  
  /**
   * Get unified statistics for dashboard
   * @returns {Promise} API response
   */
  getStatistics: () => {
    return axiosInstance.get('/inbound/statistics');
  },
};

