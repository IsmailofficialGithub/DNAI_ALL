import { AlertCircle, Wifi, Server, AlertTriangle, Shield, Clock, Database } from 'lucide-react';
import { saveErrorLog } from '@/lib/api';

// Global notification handler - will be set by NotificationContext (for success/info only)
let globalNotificationHandler: ((type: 'error' | 'success' | 'info' | 'warning', title: string, message?: string) => void) | null = null;

export const setGlobalNotificationHandler = (handler: typeof globalNotificationHandler) => {
  globalNotificationHandler = handler;
};

export interface ErrorToastOptions {
  context?: string;
  duration?: number;
  showRetry?: boolean;
  retryAction?: () => void;
}

export const showErrorToast = (error: any, options: ErrorToastOptions = {}) => {
  const { context } = options;
  
  let message = "Something went wrong. Please try again.";
  let description = context ? `Error in ${context}` : undefined;

  // Parse error message and provide user-friendly alternatives
  if (error?.message) {
    const errorMsg = error.message.toLowerCase();
    
    if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection')) {
      message = "Network connection issue. Please check your internet and try again.";
      description = "Make sure you're connected to the internet";
    } else if (errorMsg.includes('server') || errorMsg.includes('500') || errorMsg.includes('internal server')) {
      message = "Server is temporarily unavailable. Please try again in a moment.";
      description = "Our servers are experiencing high traffic";
    } else if (errorMsg.includes('permission') || errorMsg.includes('403') || errorMsg.includes('unauthorized')) {
      message = "You don't have permission to perform this action.";
      description = "Please check your account permissions";
    } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
      message = "The requested resource was not found.";
      description = "The item you're looking for doesn't exist";
    } else if (errorMsg.includes('timeout') || errorMsg.includes('time out')) {
      message = "Request timed out. Please try again.";
      description = "The request took too long to complete";
    } else if (errorMsg.includes('database') || errorMsg.includes('db')) {
      message = "Database connection issue. Please try again.";
      description = "We're experiencing database connectivity issues";
    } else if (errorMsg.includes('validation') || errorMsg.includes('invalid')) {
      message = "Invalid data provided. Please check your input.";
      description = "Please review the form and try again";
    }
  }

  // Handle specific HTTP status codes
  if (error?.response?.status) {
    const status = error.response.status;
    
    switch (status) {
      case 400:
        message = "Invalid request. Please check your input and try again.";
        description = "The data you provided is not valid";
        break;
      case 401:
        message = "Please log in again to continue.";
        description = "Your session has expired";
        break;
      case 403:
        message = "You don't have permission to perform this action.";
        description = "Please check your account permissions";
        break;
      case 404:
        message = "The requested resource was not found.";
        description = "The item you're looking for doesn't exist";
        break;
      case 429:
        message = "Too many requests. Please wait a moment and try again.";
        description = "You're making requests too quickly";
        break;
      case 500:
        message = "Server error. Please try again later.";
        description = "Our servers are experiencing issues";
        break;
      case 502:
      case 503:
      case 504:
        message = "Service temporarily unavailable. Please try again in a moment.";
        description = "We're working to restore service";
        break;
    }
  }

  // Extract request and response information
  const requestInfo: any = {};
  const responseInfo: any = {};

  // Extract request information
  if (error?.config || error?.request) {
    const request = error?.config || error?.request;
    requestInfo.method = request?.method || request?.method || 'GET';
    requestInfo.url = request?.url || request?.url || error?.url || window.location.href;
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

  // Save error to database with request/response details (NO NOTIFICATIONS)
  const errorDetails = JSON.stringify({
    message: error?.message || message,
    description,
    context,
    status: error?.response?.status || error?.status,
    code: error?.code,
    stack: error?.stack,
    request: requestInfo,
    response: responseInfo,
    url: typeof window !== 'undefined' ? window.location.href : 'server',
    timestamp: new Date().toISOString(),
    fullError: error,
  }, null, 2);
  
  saveErrorLog(message, errorDetails, typeof window !== 'undefined' ? navigator.userAgent : 'server')
    .catch(err => {
      // Silently fail - don't let error logging break the app
      console.error('Failed to save error log:', err);
    });
  
  // Only log to console for debugging - NO UI NOTIFICATIONS
  console.error('Error logged to database:', message, description);
};

// Specific error handlers for common scenarios
export const showNetworkError = (context?: string) => {
  showErrorToast(
    { message: "Network error" },
    { 
      context,
      showRetry: true,
      retryAction: () => window.location.reload()
    }
  );
};

export const showPermissionError = (context?: string) => {
  showErrorToast(
    { message: "Permission denied" },
    { 
      context,
      showRetry: false
    }
  );
};

export const showValidationError = (field: string, context?: string) => {
  showErrorToast(
    { message: `Invalid ${field}` },
    { 
      context: context || `Please check your ${field}`,
      showRetry: false
    }
  );
};

export const showServerError = (context?: string) => {
  showErrorToast(
    { message: "Server error" },
    { 
      context,
      showRetry: true,
      retryAction: () => window.location.reload()
    }
  );
};

// Success toast for positive feedback
export const showSuccessToast = (message: string, description?: string) => {
  if (globalNotificationHandler) {
    globalNotificationHandler('success', message, description);
  } else {
    console.log('Success:', message, description);
  }
};

// Info toast for general information
export const showInfoToast = (message: string, description?: string) => {
  if (globalNotificationHandler) {
    globalNotificationHandler('info', message, description);
  } else {
    console.log('Info:', message, description);
  }
};
