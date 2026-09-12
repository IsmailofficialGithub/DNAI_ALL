/**
 * Activity Logs API (Backend)
 * These functions call the backend API for activity logs
 */

import apiClient from '../../services/apiClient';

/**
 * Get all activity logs with optional filters
 * @param {Object} filters - Filter options
 * @param {string} filters.action_type - Filter by action type (create, update, delete)
 * @param {string} filters.actor_id - Filter by actor ID
 * @param {string} filters.target_id - Filter by target ID
 * @param {string} filters.actor_role - Filter by actor role (admin, reseller, consumer)
 * @param {string} filters.table_name - Filter by table name
 * @param {number} filters.page - Page number for pagination
 * @param {number} filters.limit - Number of items per page
 * @param {string} filters.start_date - Start date for filtering (ISO format)
 * @param {string} filters.end_date - End date for filtering (ISO format)
 * @returns {Promise<Object>} Response with logs data
 */
export const getActivityLogs = async (filters = {}) => {
  try {
    const {
      action_type,
      actor_id,
      target_id,
      actor_role,
      table_name,
      page = 1,
      limit = 50,
      start_date,
      end_date
    } = filters;

    const params = new URLSearchParams();

    if (action_type) params.append('action_type', action_type);
    if (actor_id) params.append('actor_id', actor_id);
    if (target_id) params.append('target_id', target_id);
    if (actor_role) params.append('actor_role', actor_role);
    if (table_name) params.append('table_name', table_name);
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);

    const queryString = params.toString();
    // axios interceptor already returns response.data, so response is the API body
    const response = await apiClient.activityLogs.getAll(queryString ? `?${queryString}` : '');

    console.log('📊 Activity Logs API Response:', response);

    // Response is already the API body (thanks to axios interceptor)
    if (response && response.success) {
      return response;
    }

    // If response has error field
    if (response && response.error) {
      return { error: response.error || response.message || 'Failed to fetch activity logs' };
    }

    // Fallback
    return { error: 'Unexpected response format', rawResponse: response };
  } catch (error) {
    console.error('getActivityLogs Error:', error);
    // Check if error has response data
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.message || 'Failed to fetch activity logs' };
  }
};

/**
 * Get activity log by ID
 * @param {string} id - Activity log ID
 * @returns {Promise<Object>} Activity log data
 */
export const getActivityLogById = async (id) => {
  try {
    // axios interceptor already returns response.data, so response is the API body
    const response = await apiClient.activityLogs.getById(id);

    if (response && response.success) {
      return response.data;
    }

    // If response has error field
    if (response && response.error) {
      return { error: response.error || response.message || 'Activity log not found' };
    }

    return { error: 'Activity log not found' };
  } catch (error) {
    console.error('getActivityLogById Error:', error);
    // Check if error has response data
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.message || 'Failed to fetch activity log' };
  }
};

