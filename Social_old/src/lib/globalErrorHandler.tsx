import React from 'react';
import { showErrorToast, showSuccessToast, showInfoToast } from '@/components/ErrorToast';

// Global error handler for unhandled errors
export const setupGlobalErrorHandling = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Prevent the default browser error handling
    event.preventDefault();
    
    // Show user-friendly error message
    showErrorToast(event.reason, {
      context: 'Application Error',
      showRetry: true,
      retryAction: () => window.location.reload()
    });
  });

  // Handle JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('JavaScript error:', event.error);
    
    // Show user-friendly error message
    showErrorToast(event.error, {
      context: 'Application Error',
      showRetry: true,
      retryAction: () => window.location.reload()
    });
  });

  // Handle network errors
  window.addEventListener('offline', () => {
    showInfoToast('You are now offline', 'Please check your internet connection');
  });

  window.addEventListener('online', () => {
    showSuccessToast('Connection restored', 'You are back online');
  });
};

// Error boundary for specific components
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
) => {
  return (props: P) => {
    const [hasError, setHasError] = React.useState(false);
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
      const handleError = (err: Error) => {
        setHasError(true);
        setError(err);
        console.error('Component error:', err);
      };

      // You can add error handling logic here
      return () => {
        // Cleanup
      };
    }, []);

    if (hasError && error) {
      if (fallback) {
        const FallbackComponent = fallback;
        return <FallbackComponent error={error} resetError={() => setHasError(false)} />;
      }

      return (
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
          <h3 className="text-red-800 font-semibold mb-2">Something went wrong</h3>
          <p className="text-red-600 mb-4">We're working to fix this issue.</p>
          <button
            onClick={() => setHasError(false)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

// Retry mechanism for failed operations
export const withRetry = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  maxRetries: number = 3,
  delay: number = 1000
) => {
  return async (...args: T): Promise<R> => {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          console.log(`Retrying operation (attempt ${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    throw lastError;
  };
};

// Debounced error handling for rapid errors
export const debounceError = (fn: () => void, delay: number = 1000) => {
  let timeoutId: NodeJS.Timeout;
  
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(fn, delay);
  };
};

// Error recovery strategies
export const errorRecoveryStrategies = {
  // Retry with exponential backoff
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  },

  // Fallback to cached data
  async fallbackToCache<T>(
    operation: () => Promise<T>,
    cacheKey: string,
    fallbackData: T
  ): Promise<T> {
    try {
      const result = await operation();
      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify(result));
      return result;
    } catch (error) {
      console.warn('Operation failed, using cached data:', error);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      return fallbackData;
    }
  },

  // Graceful degradation
  async gracefulDegradation<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      console.warn('Primary operation failed, trying fallback:', error);
      try {
        return await fallbackOperation();
      } catch (fallbackError) {
        console.error('Both operations failed:', fallbackError);
        throw fallbackError;
      }
    }
  }
};

// Initialize global error handling
export const initializeErrorHandling = () => {
  setupGlobalErrorHandling();
  
  // Add error handling to fetch requests
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      
      if (!response.ok) {
        let details = '';
        try {
          const data = await response.clone().json();
          details = (data && (data.error?.message || JSON.stringify(data))) || '';
        } catch {
          try {
            details = await response.clone().text();
          } catch {}
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}${details ? ' - ' + details : ''}`);
      }
      
      return response;
    } catch (error) {
      // Don't show error toasts for expected scenarios (timeouts, network issues during analysis)
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if this is an expected scenario (analysis in progress, timeout, etc.)
      const isExpectedError = 
        errorMessage.includes('504') || 
        errorMessage.includes('timeout') ||
        errorMessage.includes('Invalid response format') ||
        errorMessage.includes('company-search'); // Webhook endpoint errors
      
      if (!isExpectedError) {
        console.error('Fetch error:', error);
        showErrorToast(error, {
          context: 'Network Request',
          showRetry: true,
          retryAction: () => window.location.reload()
        });
      }
      throw error;
    }
  };
};
