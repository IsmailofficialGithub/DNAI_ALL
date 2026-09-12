/**
 * Authentication API (Backend)
 * These functions call the backend API for authentication operations
 */

import apiClient from '../../services/apiClient';

/**
 * Impersonate a user (System Admin only)
 * @param {string} targetUserId - UUID of the user to impersonate
 * @param {number} durationMinutes - Duration of impersonation in minutes (default: 60, max: 1440)
 * @param {string} targetUrl - URL of the admin panel (default: current origin)
 * @returns {Promise<Object>} Response with impersonation session data
 */
export const impersonateUser = async (targetUserId, durationMinutes = 60, targetUrl = null) => {
  try {
    if (!targetUserId) {
      return { error: 'target_user_id is required' };
    }

    // Use provided targetUrl or fallback to current origin
    const redirectUrl = targetUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

    const response = await apiClient.auth.impersonate({
      target_user_id: targetUserId,
      duration_minutes: durationMinutes,
      target_url: redirectUrl
    });

    if (response && response.success) {
      return response.data;
    }

    return { error: response?.message || response?.error || 'Failed to create impersonation session' };
  } catch (error) {
    console.error('impersonateUser Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.message || 'Failed to create impersonation session' };
  }
};

/**
 * Generate magic link for consumer to login to external site (Admin only)
 * @param {string} targetUserId - UUID of the consumer to generate link for
 * @param {string} targetUrl - URL of the external site (default: 'http://localhost:5173')
 * @returns {Promise<Object>} Response with magic link
 */
export const generateConsumerLink = async (targetUserId, targetUrl = 'http://localhost:5173') => {
  try {
    if (!targetUserId) {
      return { error: 'target_user_id is required' };
    }

    const response = await apiClient.auth.generateConsumerLink({
      target_user_id: targetUserId,
      target_url: targetUrl
    });

    if (response && response.success) {
      return response.data;
    }

    return { error: response?.message || response?.error || 'Failed to generate login link' };
  } catch (error) {
    console.error('generateConsumerLink Error:', error);
    if (error.response && error.response.data) {
      return { error: error.response.data.message || error.response.data.error || error.message };
    }
    return { error: error.message || 'Failed to generate login link' };
  }
};