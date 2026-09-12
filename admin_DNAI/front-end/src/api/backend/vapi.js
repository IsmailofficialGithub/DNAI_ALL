/**
 * VAPI Accounts API (Backend)
 * These functions call the backend API instead of Supabase directly
 */

import apiClient from '../../services/apiClient';

/**
 * Get all VAPI accounts
 * @returns {Promise<Object>} VAPI accounts data
 */
export const getAllVapiAccounts = async () => {
  try {
    const response = await apiClient.vapi.getAllAccounts();
    
    // The axios interceptor already unwraps response.data, so response is the data object
    if (response?.success) {
      return {
        success: true,
        data: response.data || [],
        count: response.count || 0
      };
    }
    
    return { success: false, error: response?.error || 'Failed to fetch VAPI accounts' };
  } catch (error) {
    console.error('getAllVapiAccounts Error:', error);
    return { success: false, error: error.message || 'Failed to fetch VAPI accounts' };
  }
};

