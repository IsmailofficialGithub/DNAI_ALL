/**
 * Centralized API Client for Backend Communication
 * All backend API calls should go through this client
 */

import axios from 'axios';
import { supabase } from '../lib/supabase/Production/client';

const API_BASE_URL = process.env.REACT_APP_Server_Url;

/**
 * Token cache - updated by auth state listener
 */
let cachedToken = null;

/**
 * Try to get token from localStorage synchronously (fast!)
 */
const getTokenFromStorage = () => {
  try {
    // Only log in development mode
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('🔍 Searching localStorage, total keys:', localStorage.length);
    // }

    // Check all localStorage keys for Supabase auth data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // if (process.env.NODE_ENV === 'development') {
      //   console.log('🔑 LocalStorage key:', key);
      // }

      // Look for Supabase auth keys (various formats)
      if (key && (key.includes('supabase') || key.includes('auth') || key.includes('sb-'))) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            // if (process.env.NODE_ENV === 'development') {
            //   console.log('📦 Parsed data from key:', key, parsed);
            // }

            // Try different token paths in Supabase storage structure
            const token = parsed?.access_token ||
              parsed?.currentSession?.access_token ||
              parsed?.[0]?.access_token ||
              parsed?.session?.access_token;

            if (token) {
              // if (process.env.NODE_ENV === 'development') {
              //   console.log('✅ Found token in key:', key);
              // }
              return token;
            }
          }
        } catch (e) {
          // Skip invalid JSON
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Failed to parse key:', key);
          }
        }
      }
    }
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('❌ No token found in localStorage');
    // }
  } catch (error) {
    // Always log errors
    console.warn('⚠️ Error reading token from localStorage:', error);
  }
  return null;
};

// Initialize token from localStorage FIRST (synchronous)
cachedToken = getTokenFromStorage();
// if (process.env.NODE_ENV === 'development') {
//   console.log('🔐 apiClient: Token from localStorage:', cachedToken ? 'Token found' : 'No token');
// }

/**
 * Then update with fresh session and listen for auth changes
 */
const initializeAuth = async () => {
  try {
    // Get fresh session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    cachedToken = session?.access_token || null;
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('🔐 apiClient: Token updated from session:', cachedToken ? 'Token present' : 'No token');
    // }
  } catch (error) {
    // Always log errors
    console.error('❌ apiClient: Error getting session:', error);
  }

  // Listen for auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    cachedToken = session?.access_token || null;
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('🔐 apiClient: Token updated on auth change:', event, cachedToken ? 'Token present' : 'No token');
    // }
  });
};

// Initialize async updates
initializeAuth();

/**
 * Create axios instance with default config
 */
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

/**
 * Request interceptor - Add auth token to all requests
 */
axiosInstance.interceptors.request.use(
  async (config) => {
    // Only log in development mode
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('🔄 API Request:', config.method.toUpperCase(), config.url);
    // }

    // For FormData, let the browser set Content-Type with boundary
    // Don't set Content-Type header for FormData
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    // Try to get fresh token - ALWAYS get from session to ensure we have the latest token
    // This is especially important during impersonation when the session changes
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        cachedToken = session.access_token;
        config.headers.Authorization = `Bearer ${cachedToken}`;
        // Log in development or when impersonating to debug token issues
        const impersonationData = localStorage.getItem('impersonation_session');
        if (impersonationData || process.env.NODE_ENV === 'development') {
          console.log('🔐 apiClient: Token from session:', {
            user_id: session.user?.id,
            email: session.user?.email,
            has_token: !!cachedToken
          });
        }
      } else if (cachedToken) {
        // Fallback to cached token if session doesn't have one (shouldn't happen normally)
        config.headers.Authorization = `Bearer ${cachedToken}`;
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ apiClient: No session token, using cached token');
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ apiClient: No token available');
        }
      }
    } catch (error) {
      console.error('❌ apiClient: Error getting token:', error);
      if (cachedToken) {
        config.headers.Authorization = `Bearer ${cachedToken}`;
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ apiClient: Using cached token after error');
        }
      }
    }
    return config;
  },
  (error) => {
    // Always log errors, even in production
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle errors globally including account deactivation
 */
axiosInstance.interceptors.response.use(
  (response) => {
    // Only log in development mode
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('✅ API Response:', response.config.url, response.data);
    // }
    return response.data;
  },
  async (error) => {
    // Always log errors, but with less detail in production
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ API Error Details:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    } else {
      // In production, only log essential error info
      console.error('❌ API Error:', error.response?.status, error.config?.url);
    }

    // Handle 401 Unauthorized errors (any authentication error - redirect to login without toast)
    if (error.response?.status === 401) {
      // Sign out and clear storage
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        // Ignore sign out errors
      }

      await new Promise(resolve => setTimeout(resolve, 200));
      localStorage.clear();
      sessionStorage.clear();

      // Clear cookies
      document.cookie.split(";").forEach((c) => {
        const cookieName = c.split("=")[0].trim();
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname};`;
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      });

      // Redirect to login immediately (no toast will be shown)
      // window.location.href = '/login';

      // Return a rejected promise that never resolves (prevents error propagation)
      return Promise.reject(new Error('Authentication required - redirecting to login'));
    }

    // Handle 403 Forbidden errors (account deactivated)
    if (error.response?.status === 403) {
      const errorMessage = error.response?.data?.message || '';

      // Check if account is deactivated
      if (errorMessage.includes('deactivated') || errorMessage.includes('account has been deactivated')) {
        // Sign out and clear storage
        await supabase.auth.signOut();
        await new Promise(resolve => setTimeout(resolve, 200));
        localStorage.clear();
        sessionStorage.clear();

        // Clear cookies
        document.cookie.split(";").forEach((c) => {
          const cookieName = c.split("=")[0].trim();
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname};`;
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
        });

        // Redirect to login
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);

        throw new Error('Your account has been deactivated. Please contact the administrator.');
      }
    }

    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const errorData = error.response.data || {};

      // Handle specific HTTP status codes with better error messages
      let message = errorData.message || errorData.error || 'Request failed';

      switch (status) {
        case 429:
          // Too Many Requests - Rate limit exceeded
          message = errorData.message || 'Too many requests. Please wait a moment and try again.';
          break;
        case 400:
          // Bad Request
          message = errorData.message || 'Invalid request. Please check your input and try again.';
          break;
        case 401:
          // Unauthorized
          message = errorData.message || 'Authentication required. Please log in again.';
          break;
        case 403:
          // Forbidden (already handled above for deactivation, but catch other 403s)
          if (!message.includes('deactivated') && !message.includes('account has been deactivated')) {
            message = errorData.message || 'You do not have permission to perform this action.';
          }
          break;
        case 404:
          // Not Found
          message = errorData.message || 'The requested resource was not found.';
          break;
        case 500:
          // Internal Server Error
          message = errorData.message || 'Server error. Please try again later or contact support.';
          break;
        case 503:
          // Service Unavailable
          message = errorData.message || 'Service temporarily unavailable. Please try again later.';
          break;
        default:
          // Use the message from the response if available
          message = errorData.message || errorData.error || `Request failed with status ${status}`;
      }

      console.error('API Error:', { status, message, url: error.config?.url });
      throw new Error(message);
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error: No response from server');
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      // Something else happened
      console.error('Request Error:', error.message);
      throw new Error(error.message || 'An unexpected error occurred. Please try again.');
    }
  }
);

/**
 * API Client Methods
 */
const apiClient = {
  // ==================== AUTH ====================
  auth: {
    /**
     * Get current user info
     */
    me: () => axiosInstance.get('/auth/me'),

    /**
     * Logout
     */
    logout: () => axiosInstance.post('/auth/logout'),

    /**
     * Impersonate a user (System Admin only)
     */
    impersonate: (data) => axiosInstance.post('/auth/impersonate', data),

    /**
     * Generate magic link for consumer to login to external site (Admin only)
     */
    generateConsumerLink: (data) => axiosInstance.post('/auth/generate-consumer-link', data),
  },

  // ==================== USERS ====================
  users: {
    /**
     * Get all users with optional search
     */
    getAll: (queryString = '') => axiosInstance.get(`/users${queryString}`),

    /**
     * Search all users by email/name (for ticket creation - returns all users)
     */
    search: (query) => axiosInstance.get(`/users/search?q=${encodeURIComponent(query)}`),

    /**
     * Get user by ID
     */
    getById: (id) => axiosInstance.get(`/users/${id}`),

    /**
     * Create new user
     */
    create: (userData) => axiosInstance.post('/users', userData),

    /**
     * Update user
     */
    update: (id, userData) => axiosInstance.put(`/users/${id}`, userData),

    /**
     * Delete user
     */
    delete: (id) => axiosInstance.delete(`/users/${id}`),

    /**
     * Reset user password
     */
    resetPassword: (id) => axiosInstance.post(`/users/${id}/reset-password`),

    /**
     * Update user account status
     */
    updateAccountStatus: (id, account_status) => axiosInstance.patch(`/users/${id}/account-status`, { account_status }),
  },

  // ==================== CONSUMERS ====================
  consumers: {
    /**
     * Get all consumers with optional filters
     */
    getAll: (queryString = '') => axiosInstance.get(`/consumers${queryString}`),

    /**
     * Get consumer by ID
     */
    getById: (id) => axiosInstance.get(`/consumers/${id}`),

    /**
     * Create new consumer
     */
    create: (consumerData) => axiosInstance.post('/consumers', consumerData),

    /**
     * Update consumer
     */
    update: (id, consumerData) => axiosInstance.put(`/consumers/${id}`, consumerData),

    /**
     * Delete consumer
     */
    delete: (id) => axiosInstance.delete(`/consumers/${id}`),

    /**
     * Reset consumer password
     */
    resetPassword: (id, password = null) => axiosInstance.post(`/consumers/${id}/reset-password`, password ? { password } : {}),

    /**
     * Update consumer account status
     */
    updateAccountStatus: (id, account_status, trial_expiry_date = null, lifetime_access = false) => {
      const payload = { account_status };
      if (trial_expiry_date) {
        payload.trial_expiry_date = trial_expiry_date;
      }
      if (lifetime_access) {
        payload.lifetime_access = true;
      }
      return axiosInstance.patch(`/consumers/${id}/account-status`, payload);
    },

    /**
     * Grant lifetime access to consumer
     */
    grantLifetimeAccess: (id) => {
      return axiosInstance.post(`/consumers/${id}/grant-lifetime-access`);
    },

    /**
     * Revoke lifetime access from consumer
     * @param {string} id - Consumer ID
     * @param {number} trialDays - Number of days for trial (1-365, optional)
     */
    revokeLifetimeAccess: (id, trialDays = null) => {
      return axiosInstance.post(`/consumers/${id}/revoke-lifetime-access`, {
        trial_days: trialDays
      });
    },

    /**
     * Get consumer product settings
     */
    getProductSettings: (id) => {
      return axiosInstance.get(`/consumers/${id}/product-settings`);
    },

    /**
     * Update consumer product settings
     */
    updateProductSettings: (id, settings) => {
      return axiosInstance.patch(`/consumers/${id}/product-settings`, { settings });
    },

    /**
     * Reassign consumer to a different reseller
     */
    reassign: (id, data) => axiosInstance.post(`/consumers/${id}/reassign`, data),

    /**
     * Get user credits
     */
    getUserCredits: (userId) => axiosInstance.get(`/consumers/${userId}/credits`),

    /**
     * Update user credits
     */
    updateUserCredits: (userId, creditData) => axiosInstance.put(`/consumers/${userId}/credits`, creditData),

    /**
     * Get billing packages for product
     */
    getBillingPackages: (productId) => axiosInstance.get(`/consumers/products/${productId}/packages`),

    /**
     * Create user subscription
     */
    createUserSubscription: (userId, subscriptionData) => axiosInstance.post(`/consumers/${userId}/subscriptions`, subscriptionData),
  },

  // ==================== RESELLERS ====================
  resellers: {
    /**
     * Get all resellers with optional search
     */
    getAll: (queryString = '') => axiosInstance.get(`/resellers${queryString}`),

    /**
     * Get reseller by ID
     */
    getById: (id) => axiosInstance.get(`/resellers/${id}`),

    /**
     * Create new reseller
     */
    create: (resellerData) => axiosInstance.post('/resellers', resellerData),

    /**
     * Update reseller
     */
    update: (id, resellerData) => axiosInstance.put(`/resellers/${id}`, resellerData),

    /**
     * Delete reseller
     */
    delete: (id) => axiosInstance.delete(`/resellers/${id}`),

    /**
     * Reset reseller password
     */
    resetPassword: (id, password = null) => axiosInstance.post(`/resellers/${id}/reset-password`, password ? { password } : {}),

    /**
     * Update reseller account status
     */
    updateAccountStatus: (id, account_status) => axiosInstance.patch(`/resellers/${id}/account-status`, { account_status }),

    /**
     * Get referred consumers by reseller ID
     */
    getReferredConsumers: (id) => axiosInstance.get(`/resellers/${id}/referred-consumers`),

    /**
     * Create new consumer (via reseller endpoint) - Legacy
     */
    createConsumer: (consumerData) => axiosInstance.post('/resellers/create-consumer', consumerData),

    // ========== RESELLER'S OWN CONSUMERS ==========

    /**
     * Get all consumers created by the logged-in reseller
     */
    getMyConsumers: () => axiosInstance.get('/resellers/my-consumers'),

    /**
     * Create new consumer (as reseller)
     */
    createMyConsumer: (consumerData) => axiosInstance.post('/resellers/my-consumers', consumerData),

    /**
     * Update consumer (as reseller)
     */
    updateMyConsumer: (id, consumerData) => axiosInstance.put(`/resellers/my-consumers/${id}`, consumerData),

    /**
     * Delete consumer (as reseller)
     */
    deleteMyConsumer: (id) => axiosInstance.delete(`/resellers/my-consumers/${id}`),

    /**
     * Reset consumer password (as reseller)
     */
    resetMyConsumerPassword: (id) => axiosInstance.post(`/resellers/my-consumers/${id}/reset-password`),

    // ========== RESELLER'S OWN RESELLERS ==========

    /**
     * Get all resellers created by the logged-in reseller
     */
    getMyResellers: (queryString = '') => axiosInstance.get(`/resellers/my-resellers${queryString}`),

    /**
     * Create reseller (as reseller)
     */
    createMyReseller: (resellerData) => axiosInstance.post('/resellers/my-resellers', resellerData),

    /**
     * Get reseller by ID (as reseller)
     */
    getMyResellerById: (id) => axiosInstance.get(`/resellers/my-resellers/${id}`),

    /**
     * Update reseller (as reseller)
     */
    updateMyReseller: (id, resellerData) => axiosInstance.put(`/resellers/my-resellers/${id}`, resellerData),

    /**
     * Delete reseller (as reseller)
     */
    deleteMyReseller: (id) => axiosInstance.delete(`/resellers/my-resellers/${id}`),
  },

  // ==================== INVITATIONS ====================
  invitations: {
    /**
     * Invite user/reseller/consumer (admin only)
     */
    invite: (inviteData) => axiosInstance.post('/invitations/invite', inviteData),

    /**
     * Invite reseller (reseller can invite other resellers)
     */
    inviteReseller: (email) => axiosInstance.post('/invitations/invite-reseller', { email }),

    /**
     * Validate invitation token
     */
    validateToken: (token) => axiosInstance.get(`/invitations/validate/${token}`),

    /**
     * Sign up using invitation token
     */
    signup: (signupData) => axiosInstance.post('/invitations/signup', signupData),
  },

  // ==================== PRODUCTS ====================
  products: {
    /**
     * Get all products
     */
    getAll: () => axiosInstance.get('/products'),

    /**
     * Get product by ID
     */
    getById: (id) => axiosInstance.get(`/products/${id}`),

    /**
     * Create new product
     */
    create: (productData) => axiosInstance.post('/products', productData),

    /**
     * Update product
     */
    update: (id, productData) => axiosInstance.put(`/products/${id}`, productData),

    /**
     * Delete product
     */
    delete: (id) => axiosInstance.delete(`/products/${id}`),
  },

  // ==================== PACKAGES ====================
  // ==================== VAPI ====================
  vapi: {
    /**
     * Get all VAPI accounts
     */
    getAllAccounts: () => axiosInstance.get('/vapi/accounts'),
  },

  // ==================== PACKAGES ====================
  packages: {
    /**
     * Get all packages with optional filters
     */
    getAll: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.productId) queryParams.append('productId', params.productId);
      const query = queryParams.toString();
      return axiosInstance.get(`/packages${query ? `?${query}` : ''}`);
    },

    /**
     * Get package by ID
     */
    getById: (id) => axiosInstance.get(`/packages/${id}`),

    /**
     * Create package
     */
    create: (packageData) => axiosInstance.post('/packages', packageData),

    /**
     * Update package
     */
    update: (id, packageData) => axiosInstance.put(`/packages/${id}`, packageData),

    /**
     * Delete package
     */
    delete: (id) => axiosInstance.delete(`/packages/${id}`),
  },

  // ==================== INVOICES ====================
  invoices: {
    /**
     * Get all invoices (admin only)
     */
    getAll: (queryString = '') => axiosInstance.get(`/invoices${queryString}`),

    /**
     * Get a single invoice by ID
     */
    getById: (invoiceId) => axiosInstance.get(`/invoices/${invoiceId}`),

    /**
     * Get invoices for reseller (reseller only)
     */
    getMyInvoices: (queryString = '') => axiosInstance.get(`/invoices/my-invoices${queryString}`),

    /**
     * Get consumer's accessed products with prices for invoice creation
     */
    getConsumerProducts: (consumerId) => axiosInstance.get(`/invoices/consumer/${consumerId}/products`),

    /**
     * Get consumer's accessed packages with prices for invoice creation
     */
    getConsumerPackages: (consumerId) => axiosInstance.get(`/invoices/consumer/${consumerId}/packages`),

    /**
     * Get invoices for a specific consumer
     */
    getConsumerInvoices: (consumerId, params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      const queryString = queryParams.toString();
      return axiosInstance.get(`/invoices/consumer/${consumerId}${queryString ? `?${queryString}` : ''}`);
    },

    /**
     * Create invoice with invoice items
     */
    create: (invoiceData) => axiosInstance.post('/invoices', invoiceData),

    /**
     * Resend invoice email (admin only)
     */
    resend: (invoiceId) => axiosInstance.post(`/invoices/${invoiceId}/resend`),

    /**
     * Submit payment for an invoice
     */
    submitPayment: async (invoiceId, paymentData, proofFile) => {
      const formData = new FormData();

      // Add all payment fields
      Object.keys(paymentData).forEach(key => {
        if (paymentData[key] !== null && paymentData[key] !== undefined && paymentData[key] !== '') {
          formData.append(key, paymentData[key]);
        }
      });

      // Add file if present
      if (proofFile) {
        formData.append('proof', proofFile);
      }

      // Content-Type will be set automatically by axios for FormData
      return axiosInstance.post(`/invoices/${invoiceId}/payments`, formData);
    },

    /**
     * Get payments for an invoice
     */
    getInvoicePayments: (invoiceId) => axiosInstance.get(`/invoices/${invoiceId}/payments`),

    /**
     * Review payment (approve/reject) - Admin only
     */
    reviewPayment: (paymentId, status, reviewNotes) => {
      return axiosInstance.patch(`/invoices/payments/${paymentId}`, {
        status,
        review_notes: reviewNotes
      });
    },

    /**
     * Download invoice as PDF
     */
    downloadInvoicePDF: async (invoiceId) => {
      let token = cachedToken;
      if (!token) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          token = session?.access_token;
        } catch (e) {
          console.error('Error getting session for PDF download:', e);
        }
      }

      const baseURL = axiosInstance.defaults.baseURL || '';
      const response = await fetch(`${baseURL}/invoices/${invoiceId}/download-pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PDF download failed: ${errorText}`);
      }

      const blob = await response.blob();
      return { data: blob };
    },
  },

  // ==================== DASHBOARD ====================
  dashboard: {
    /**
     * Get dashboard statistics (admin only)
     */
    getStats: () => axiosInstance.get('/dashboard/stats'),

    /**
     * Get reseller business statistics (admin only)
     */
    getResellerStats: (queryString = '') => axiosInstance.get(`/dashboard/reseller-stats${queryString}`),
  },

  // ==================== ACTIVITY LOGS ====================
  activityLogs: {
    /**
     * Get all activity logs with optional filters
     */
    getAll: (queryString = '') => axiosInstance.get(`/activity-logs${queryString}`),

    /**
     * Get activity log by ID
     */
    getById: (id) => axiosInstance.get(`/activity-logs/${id}`),
  },

  // ==================== API LOGS ====================
  logs: {
    /**
     * Get all API logs with optional filters
     */
    getAll: (queryString = '') => axiosInstance.get(`/logs${queryString}`),
  },

  // ==================== ERROR LOGS ====================
  errorLogs: {
    /**
     * Get all error logs with optional filters
     */
    getAll: (queryString = '') => axiosInstance.get(`/error-logs${queryString}`),

    /**
     * Get error log by ID
     */
    getById: (id) => axiosInstance.get(`/error-logs/${id}`),
  },

  // ==================== N8N ERRORS ====================
  n8nErrors: {
    /**
     * Get all n8n errors with optional filters
     */
    getAll: (queryString = '') => axiosInstance.get(`/n8n-errors${queryString}`),

    /**
     * Get n8n error by ID
     */
    getById: (id) => axiosInstance.get(`/n8n-errors/${id}`),
  },

  apiKeys: {
    /**
     * Get all API keys with optional filters
     */
    getAll: (queryString = '') => axiosInstance.get(`/api-keys${queryString}`),

    /**
     * Get API key by ID
     */
    getById: (id) => axiosInstance.get(`/api-keys/${id}`),

    /**
     * Create new API key
     */
    create: (data) => axiosInstance.post(`/api-keys`, data),

    /**
     * Update API key
     */
    update: (id, data) => axiosInstance.put(`/api-keys/${id}`, data),

    /**
     * Delete API key
     */
    delete: (id) => axiosInstance.delete(`/api-keys/${id}`),

    /**
     * Regenerate API secret
     */
    regenerateSecret: (id) => axiosInstance.post(`/api-keys/${id}/regenerate-secret`),
  },

  // ==================== SETTINGS ====================
  settings: {
    /**
     * Get default reseller commission
     */
    getDefaultCommission: () => axiosInstance.get('/settings/default-commission'),

    /**
     * Update default reseller commission
     */
    updateDefaultCommission: (commissionRate) => axiosInstance.put('/settings/default-commission', { commissionRate }),

    /**
     * Get all reseller settings
     */
    getResellerSettings: () => axiosInstance.get('/settings/reseller'),

    /**
     * Update all reseller settings
     */
    updateResellerSettings: (settings) => axiosInstance.put('/settings/reseller', settings),
  },

  // ==================== OFFERS ====================
  offers: {
    /**
     * Get all offers with pagination and filters
     */
    getAll: (queryString = '') => axiosInstance.get(`/offers${queryString}`),

    /**
     * Get a single offer by ID
     */
    getById: (id) => axiosInstance.get(`/offers/${id}`),

    /**
     * Create a new offer
     */
    create: (offerData) => axiosInstance.post('/offers', offerData),

    /**
     * Update an offer
     */
    update: (id, offerData) => axiosInstance.put(`/offers/${id}`, offerData),

    /**
     * Delete an offer
     */
    delete: (id) => axiosInstance.delete(`/offers/${id}`),

    /**
     * Get active offer for a specific date (or current date)
     */
    getActiveOffer: (date) => axiosInstance.get(`/offers/active/${date || ''}`),
  },

  // ==================== RESELLER COMMISSION ====================
  resellerCommission: {
    /**
     * Get reseller's own commission (effective commission) - for resellers viewing their own
     */
    getMyCommission: () => axiosInstance.get('/resellers/my-commission'),

    /**
     * Get reseller commission (effective commission) - for admins viewing any reseller
     */
    getCommission: (resellerId) => axiosInstance.get(`/resellers/${resellerId}/commission`),

    /**
     * Set custom commission for reseller
     */
    setCommission: (resellerId, commissionRate) => axiosInstance.put(`/resellers/${resellerId}/commission`, { commissionRate }),

    /**
     * Reset reseller commission to default
     */
    resetCommission: (resellerId) => axiosInstance.delete(`/resellers/${resellerId}/commission`),
  },

  // ==================== STRIPE PAYMENTS ====================
  stripe: {
    /**
     * Create payment intent
     */
    createPaymentIntent: (encryptedData) => axiosInstance.post('/stripe/create-payment-intent', { encryptedData }),

    /**
     * Confirm payment
     */
    confirmPayment: (paymentIntentId, encryptedData) => axiosInstance.post('/stripe/confirm-payment', { paymentIntentId, encryptedData }),
  },

  // ==================== PAYPAL ====================
  paypal: {
    /**
     * Create PayPal order
     */
    createOrder: (encryptedData) => axiosInstance.post('/paypal/create-order', { encryptedData }),

    /**
     * Capture PayPal payment
     */
    capturePayment: (orderId, encryptedData) => axiosInstance.post('/paypal/capture-payment', { orderId, encryptedData }),
  },

  // ==================== CUSTOMER SUPPORT ====================
  customerSupport: {
    /**
     * Create a new support ticket
     */
    createTicket: (ticketData) => axiosInstance.post('/customer-support/tickets', ticketData),

    /**
     * Get all support tickets (with filters)
     */
    getTickets: (queryString = '') => axiosInstance.get(`/customer-support/tickets${queryString}`),

    /**
     * Get single ticket with messages and attachments
     */
    getTicket: (ticketId) => axiosInstance.get(`/customer-support/tickets/${ticketId}`),

    /**
     * Add message to ticket
     */
    addMessage: (ticketId, messageData) => axiosInstance.post(`/customer-support/tickets/${ticketId}/messages`, messageData),

    /**
     * Update ticket status, assignment, priority
     */
    updateTicketStatus: (ticketId, updateData) => axiosInstance.patch(`/customer-support/tickets/${ticketId}/status`, updateData),

    /**
     * Get ticket statistics (admin only)
     */
    getStats: () => axiosInstance.get('/customer-support/stats'),

    /**
     * Generate AI response via webhook (proxy endpoint)
     */
    generateAiResponse: (messages) => axiosInstance.post('/customer-support/generate-ai-response', { messages }),

    /**
     * Upload attachment file
     */
    uploadAttachment: (formData) => {
      return axiosInstance.post('/customer-support/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },

    /**
     * Export tickets to CSV (with filters)
     */
    exportTickets: async (queryString = '') => {
      // Use fetch for file download (more reliable for blobs)
      let token = cachedToken;
      if (!token) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          token = session?.access_token;
        } catch (e) {
          console.error('Error getting session for export:', e);
        }
      }

      const baseURL = axiosInstance.defaults.baseURL || '';
      const response = await fetch(`${baseURL}/customer-support/tickets/export${queryString}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = `Export failed: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          let errorData;

          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
          } else {
            // Try to read as text and parse JSON
            const errorText = await response.text();
            if (errorText) {
              try {
                errorData = JSON.parse(errorText);
              } catch {
                // If not JSON, use the text as error message
                errorMessage = errorText;
                const error = new Error(errorMessage);
                error.status = response.status;
                throw error;
              }
            }
          }

          // Extract message from error data
          if (errorData) {
            errorMessage = errorData.message || errorData.error || errorMessage;
          }
        } catch (parseError) {
          // If error is already thrown with message, re-throw it
          if (parseError.message && parseError.message !== `Export failed: ${response.status}`) {
            throw parseError;
          }
          console.error('Error parsing error response:', parseError);
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }

      const blob = await response.blob();
      return { data: blob };
    },
  },

  // ==================== PERMISSIONS ====================
  permissions: {
    /**
     * Get all permissions with optional filters
     */
    getAll: (queryString = '') => axiosInstance.get(`/permissions${queryString}`),

    /**
     * Get permission by ID
     */
    getById: (id) => axiosInstance.get(`/permissions/${id}`),

    /**
     * Get current user's permissions
     */
    getMy: () => axiosInstance.get('/permissions/me'),

    /**
     * Get user permissions
     */
    getUserPermissions: (userId) => axiosInstance.get(`/permissions/user/${userId}`),

    /**
     * Get role permissions
     */
    getRolePermissions: (role) => axiosInstance.get(`/permissions/role/${role}`),

    /**
     * Get current user's role permissions (optimized for caching)
     * @param {number} version - Optional client version for cache validation
     */
    getMyRolePermissions: (version = 0) => axiosInstance.get(`/permissions/my-role${version ? `?v=${version}` : ''}`),

    /**
     * Get all role cache versions
     */
    getRoleCacheVersions: () => axiosInstance.get('/permissions/role-versions'),

    /**
     * Check if user has permission
     */
    check: (userId, permissionName) => axiosInstance.get(`/permissions/check/${userId}/${permissionName}`),

    /**
     * Check if user has multiple permissions (bulk check - optimized)
     */
    checkBulk: (userId, permissionNames) => axiosInstance.post(`/permissions/check-bulk/${userId}`, { permissionNames }),

    /**
     * Assign permissions to role
     */
    assignToRole: (role, permissionIds) => axiosInstance.post(`/permissions/role/${role}/assign`, { permissionIds }),

    /**
     * Remove permissions from role
     */
    removeFromRole: (role, permissionIds) => axiosInstance.delete(`/permissions/role/${role}/remove`, { data: { permissionIds } }),

    /**
     * Assign permissions to user
     */
    assignToUser: (userId, permissionIds, granted = true) => axiosInstance.post(`/permissions/user/${userId}/assign`, { permissionIds, granted }),

    /**
     * Remove permissions from user
     */
    removeFromUser: (userId, permissionIds) => axiosInstance.delete(`/permissions/user/${userId}/remove`, { data: { permissionIds } }),

    /**
     * Set systemadmin status for user
     */
    setSystemAdmin: (userId, isSystemAdmin) => axiosInstance.patch(`/permissions/user/${userId}/systemadmin`, { is_systemadmin: isSystemAdmin }),

    /**
     * Get all users for permissions management
     */
    getAllUsers: (search = '') => axiosInstance.get(`/permissions/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  },

  // ==================== GENIE ====================
  genie: {
    // Calls
    getAllCalls: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.botId) queryParams.append('botId', params.botId);
      if (params.status) queryParams.append('status', params.status);
      if (params.isLead !== undefined) queryParams.append('isLead', params.isLead);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.search) queryParams.append('search', params.search);
      if (params.listId) queryParams.append('listId', params.listId);
      if (params.scheduledListId) queryParams.append('scheduledListId', params.scheduledListId);
      if (params.minDuration) queryParams.append('minDuration', params.minDuration);
      const query = queryParams.toString();
      return axiosInstance.get(`/genie/calls${query ? `?${query}` : ''}`);
    },
    getAllCallsByOwnerId: (ownerUserId, params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.botId) queryParams.append('botId', params.botId);
      if (params.status) queryParams.append('status', params.status);
      if (params.isLead !== undefined) queryParams.append('isLead', params.isLead);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.search) queryParams.append('search', params.search);
      const query = queryParams.toString();
      return axiosInstance.get(`/genie/calls/owner/${ownerUserId}${query ? `?${query}` : ''}`);
    },
    getCallById: (id) => axiosInstance.get(`/genie/calls/${id}`),
    getCallStats: (period = 'today') => axiosInstance.get(`/genie/calls/stats?period=${period}`),
    updateCallLeadStatus: (id, isLead) => axiosInstance.patch(`/genie/calls/${id}/lead`, { isLead }),

    // Campaigns
    getAllCampaigns: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.status) queryParams.append('status', params.status);
      if (params.hasLeads !== undefined && params.hasLeads !== '') queryParams.append('hasLeads', params.hasLeads);
      if (params.ownerUserId) queryParams.append('ownerUserId', params.ownerUserId);
      if (params.campaignSearch) queryParams.append('campaignSearch', params.campaignSearch);
      if (params.consumerSearch) queryParams.append('consumerSearch', params.consumerSearch);
      const query = queryParams.toString();
      return axiosInstance.get(`/genie/campaigns${query ? `?${query}` : ''}`);
    },
    getCampaignById: (id) => axiosInstance.get(`/genie/campaigns/${id}`),
    createCampaign: (data) => axiosInstance.post('/genie/campaigns', data),
    updateCampaign: (id, data) => axiosInstance.patch(`/genie/campaigns/${id}`, data),
    cancelCampaign: (id) => axiosInstance.delete(`/genie/campaigns/${id}`),

    // Leads
    getAllLeads: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.botId) queryParams.append('botId', params.botId);
      if (params.listId) queryParams.append('listId', params.listId);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.search) queryParams.append('search', params.search);
      if (params.ownerUserId) queryParams.append('ownerUserId', params.ownerUserId);
      const query = queryParams.toString();
      return axiosInstance.get(`/genie/leads${query ? `?${query}` : ''}`);
    },
    getLeadById: (id) => axiosInstance.get(`/genie/leads/${id}`),
    updateLead: (id, data) => axiosInstance.patch(`/genie/leads/${id}`, data),
    deleteLead: (id) => axiosInstance.delete(`/genie/leads/${id}`),
    exportLeads: async (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.botId) queryParams.append('botId', params.botId);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.ownerUserId) queryParams.append('ownerUserId', params.ownerUserId);
      // Add timestamp to prevent caching (304 responses)
      queryParams.append('_t', Date.now());
      const query = queryParams.toString();

      // Use fetch for file download (more reliable for blobs)
      // Get token from Supabase session (same way as axiosInstance)
      let token = cachedToken;
      if (!token) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          token = session?.access_token;
        } catch (e) {
          console.error('Error getting session for export:', e);
        }
      }

      const baseURL = axiosInstance.defaults.baseURL || '';
      const response = await fetch(`${baseURL}/genie/leads/export?${query}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      return { data: blob };
    },

    // Analytics
    getCallAnalytics: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.period) queryParams.append('period', params.period);
      if (params.groupBy) queryParams.append('groupBy', params.groupBy);
      if (params.ownerUserId) queryParams.append('ownerUserId', params.ownerUserId);
      if (params.botId) queryParams.append('botId', params.botId);
      const query = queryParams.toString();
      return axiosInstance.get(`/genie/analytics/calls${query ? `?${query}` : ''}`);
    },
    getConversionMetrics: (params = {}) => {
      const queryParams = new URLSearchParams();
      const period = typeof params === 'string' ? params : (params.period || 'month');
      queryParams.append('period', period);
      if (typeof params === 'object') {
        if (params.ownerUserId) queryParams.append('ownerUserId', params.ownerUserId);
        if (params.botId) queryParams.append('botId', params.botId);
      }
      const query = queryParams.toString();
      return axiosInstance.get(`/genie/analytics/conversion${query ? `?${query}` : ''}`);
    },
    getBotPerformance: (params = {}) => {
      const queryParams = new URLSearchParams();
      const period = typeof params === 'string' ? params : (params.period || 'month');
      queryParams.append('period', period);
      if (typeof params === 'object') {
        if (params.ownerUserId) queryParams.append('ownerUserId', params.ownerUserId);
        if (params.botId) queryParams.append('botId', params.botId);
      }
      const query = queryParams.toString();
      return axiosInstance.get(`/genie/analytics/bots${query ? `?${query}` : ''}`);
    },

    // Supporting
    getAllBots: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.ownerUserId) queryParams.append('ownerUserId', params.ownerUserId);
      const query = queryParams.toString();
      return axiosInstance.get(`/genie/bots${query ? `?${query}` : ''}`);
    },
    getBotById: (id) => {
      return axiosInstance.get(`/genie/bots/${id}`);
    },
    getAllContactLists: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.ownerUserId) queryParams.append('ownerUserId', params.ownerUserId);
      const query = queryParams.toString();
      return axiosInstance.get(`/genie/contact-lists${query ? `?${query}` : ''}`);
    },
    getVapiAccounts: () => axiosInstance.get('/genie/vapi-accounts'),
    assignVapiAccountToBots: (ownerUserId, vapiAccountId) =>
      axiosInstance.patch('/genie/bots/assign-vapi-account', { ownerUserId, vapiAccountId }),
  },

  // ==================== INBOUND ====================
  inbound: {
    /**
     * Get all inbound packages
     */
    getPackages: () => axiosInstance.get('/inbound/packages'),
    
    /**
     * Get inbound system settings
     */
    getSettings: () => axiosInstance.get('/inbound/settings'),

    /**
     * Update inbound system settings
     */
    updateSettings: (data) => axiosInstance.patch('/inbound/settings', data),
  },
};

export default apiClient;
export { axiosInstance };

