import { handleApiError } from './errorHandler';
import { showErrorToast, showSuccessToast } from '@/components/ErrorToast';

// Generic error wrapper for API functions
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  showSuccess: boolean = false,
  successMessage?: string
) {
  return async (...args: T): Promise<R> => {
    try {
      const result = await fn(...args);
      
      if (showSuccess && successMessage) {
        showSuccessToast(successMessage);
      }
      
      return result;
    } catch (error) {
      const userMessage = handleApiError(error, context);
      showErrorToast(error, { context });
      throw new Error(userMessage);
    }
  };
}

// Specific error handlers for different types of operations
export const withRetry = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  maxRetries: number = 3
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
          console.log(`Retrying ${context} (attempt ${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    const userMessage = handleApiError(lastError, context);
    showErrorToast(lastError, { context });
    throw new Error(userMessage);
  };
};

// Error handler for form submissions
export const withFormErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const userMessage = handleApiError(error, context);
      
      // Don't show toast for form errors, let the form handle it
      throw new Error(userMessage);
    }
  };
};

// Error handler for data fetching operations
export const withDataErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const userMessage = handleApiError(error, context);
      showErrorToast(error, { 
        context: `Loading ${context}`,
        showRetry: true,
        retryAction: () => window.location.reload()
      });
      throw new Error(userMessage);
    }
  };
};

// Error handler for create operations
export const withCreateErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  successMessage?: string
) => {
  return async (...args: T): Promise<R> => {
    try {
      const result = await fn(...args);
      
      if (successMessage) {
        showSuccessToast(successMessage);
      }
      
      return result;
    } catch (error) {
      const userMessage = handleApiError(error, context);
      showErrorToast(error, { context: `Creating ${context}` });
      throw new Error(userMessage);
    }
  };
};

// Error handler for update operations
export const withUpdateErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  successMessage?: string
) => {
  return async (...args: T): Promise<R> => {
    try {
      const result = await fn(...args);
      
      if (successMessage) {
        showSuccessToast(successMessage);
      }
      
      return result;
    } catch (error) {
      const userMessage = handleApiError(error, context);
      showErrorToast(error, { context: `Updating ${context}` });
      throw new Error(userMessage);
    }
  };
};

// Error handler for delete operations
export const withDeleteErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  successMessage?: string
) => {
  return async (...args: T): Promise<R> => {
    try {
      const result = await fn(...args);
      
      if (successMessage) {
        showSuccessToast(successMessage);
      }
      
      return result;
    } catch (error) {
      const userMessage = handleApiError(error, context);
      showErrorToast(error, { context: `Deleting ${context}` });
      throw new Error(userMessage);
    }
  };
};
