import { showErrorToast, showNetworkError, showPermissionError, showServerError } from '@/components/ErrorToast';
import { saveErrorLog } from './api';

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

export const handleApiError = (error: any, context: string): string => {
  console.error(`API Error in ${context}:`, error);
  
  // Log to error reporting service (integrate with Sentry, LogRocket, etc.)
  logErrorToService(error, context);
  
  // Determine user-friendly message based on error type
  let userMessage = "Something went wrong. Please try again.";
  let shouldShowToast = true;

  // Handle network errors
  if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('fetch')) {
    userMessage = "Network connection issue. Please check your internet and try again.";
    showNetworkError(context);
    return userMessage;
  }

  // Handle HTTP status codes
  if (error?.response?.status) {
    const status = error.response.status;
    
    switch (status) {
      case 400:
        userMessage = "Invalid request. Please check your input and try again.";
        break;
      case 401:
        userMessage = "Please log in again to continue.";
        // Redirect to login if needed
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
        break;
      case 403:
        userMessage = "You don't have permission to perform this action.";
        showPermissionError(context);
        return userMessage;
      case 404:
        userMessage = "The requested resource was not found.";
        break;
      case 409:
        userMessage = "This item already exists. Please try a different name.";
        break;
      case 422:
        userMessage = "Invalid data provided. Please check your input and try again.";
        break;
      case 429:
        userMessage = "Too many requests. Please wait a moment and try again.";
        break;
      case 500:
        userMessage = "Server error. Please try again later.";
        showServerError(context);
        return userMessage;
      case 502:
      case 503:
      case 504:
        userMessage = "Service temporarily unavailable. Please try again in a moment.";
        showServerError(context);
        return userMessage;
    }
  }

  // Handle specific error messages
  if (error?.message) {
    const errorMsg = error.message.toLowerCase();
    
    if (errorMsg.includes('network') || errorMsg.includes('connection')) {
      userMessage = "Network connection issue. Please check your internet and try again.";
      showNetworkError(context);
      return userMessage;
    } else if (errorMsg.includes('timeout')) {
      userMessage = "Request timed out. Please try again.";
    } else if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
      userMessage = "You don't have permission to perform this action.";
      showPermissionError(context);
      return userMessage;
    } else if (errorMsg.includes('validation') || errorMsg.includes('invalid')) {
      userMessage = "Invalid data provided. Please check your input and try again.";
    } else if (errorMsg.includes('not found')) {
      userMessage = "The requested resource was not found.";
    } else if (errorMsg.includes('server') || errorMsg.includes('internal')) {
      userMessage = "Server error. Please try again later.";
      showServerError(context);
      return userMessage;
    }
  }

  // Handle Supabase specific errors
  if (error?.code) {
    switch (error.code) {
      case 'PGRST116':
        userMessage = "The requested resource was not found.";
        break;
      case 'PGRST301':
        userMessage = "You don't have permission to perform this action.";
        showPermissionError(context);
        return userMessage;
      case '23505': // Unique constraint violation
        userMessage = "This item already exists. Please try a different name.";
        break;
      case '23503': // Foreign key constraint violation
        userMessage = "Cannot delete this item as it's being used elsewhere.";
        break;
      case '23502': // Not null constraint violation
        userMessage = "Please fill in all required fields.";
        break;
    }
  }

  // Show toast if appropriate
  if (shouldShowToast) {
    showErrorToast(error, { context });
  }

  return userMessage;
};

// Log errors to database
const logErrorToService = async (error: any, context: string) => {
  try {
    const errorHeading = error?.message || 'Unknown error';
    
    // Extract request information
    const requestInfo: any = {};
    if (error?.config || error?.request) {
      const request = error?.config || error?.request;
      requestInfo.method = request?.method || 'GET';
      requestInfo.url = request?.url || error?.url || (typeof window !== 'undefined' ? window.location.href : 'server');
      requestInfo.headers = request?.headers || {};
      
      // Try to extract request body/payload
      if (request?.data) {
        try {
          requestInfo.body = typeof request.data === 'string' ? JSON.parse(request.data) : request.data;
        } catch {
          requestInfo.body = request.data;
        }
      } else if (error?.body) {
        requestInfo.body = error.body;
      }
    }

    // Extract response information
    const responseInfo: any = {};
    if (error?.response) {
      const response = error.response;
      responseInfo.status = response.status;
      responseInfo.statusText = response.statusText;
      responseInfo.headers = response.headers || {};
      
      // Extract response data
      if (response.data) {
        responseInfo.data = response.data;
      } else if (response.text) {
        responseInfo.text = response.text;
      }
    } else if (error?.status) {
      responseInfo.status = error.status;
    }
    
    const errorDetails = JSON.stringify({
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      status: error?.response?.status || error?.status,
      code: error?.code,
      request: requestInfo,
      response: responseInfo,
      fullError: error,
    }, null, 2);
    
    await saveErrorLog(
      `${context}: ${errorHeading}`,
      errorDetails,
      typeof window !== 'undefined' ? navigator.userAgent : 'server'
    );
  } catch (err) {
    // Silently fail - don't let error logging break the app
    console.error('Failed to log error to database:', err);
  }
};

// Get current user ID for error logging
const getCurrentUserId = (): string | null => {
  // Implement based on your auth system
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.id || null;
  } catch {
    return null;
  }
};

// Retry mechanism for failed requests
export const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        console.log(`Request failed, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError;
};

// Handle form validation errors
export const handleValidationError = (error: any, fieldName?: string): string => {
  if (error?.message?.includes('required')) {
    return `Please fill in the ${fieldName || 'required field'}.`;
  }
  
  if (error?.message?.includes('email')) {
    return 'Please enter a valid email address.';
  }
  
  if (error?.message?.includes('password')) {
    return 'Password must be at least 8 characters long.';
  }
  
  if (error?.message?.includes('phone')) {
    return 'Please enter a valid phone number.';
  }
  
  return 'Please check your input and try again.';
};

// Handle file upload errors
export const handleFileUploadError = (error: any): string => {
  if (error?.message?.includes('size')) {
    return 'File is too large. Please choose a smaller file.';
  }
  
  if (error?.message?.includes('type')) {
    return 'Invalid file type. Please choose a supported file format.';
  }
  
  if (error?.message?.includes('permission')) {
    return 'You don\'t have permission to upload files.';
  }
  
  return 'Failed to upload file. Please try again.';
};
