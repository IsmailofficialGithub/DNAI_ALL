import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FormErrorHandlerProps {
  error?: string | null;
  success?: string | null;
  info?: string | null;
  warning?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const FormErrorHandler: React.FC<FormErrorHandlerProps> = ({
  error,
  success,
  info,
  warning,
  onRetry,
  onDismiss,
  className = ""
}) => {
  if (!error && !success && !info && !warning) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <div className="flex gap-2">
                {onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="text-red-700 border-red-300 hover:bg-red-100"
                  >
                    Try Again
                  </Button>
                )}
                {onDismiss && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDismiss}
                    className="text-red-700 hover:bg-red-100"
                  >
                    Dismiss
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {info && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            {info}
          </AlertDescription>
        </Alert>
      )}

      {warning && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            {warning}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// Hook for form error handling
export const useFormError = () => {
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  const setFormError = (message: string) => {
    setError(message);
    setSuccess(null);
    setInfo(null);
    setWarning(null);
  };

  const setFormSuccess = (message: string) => {
    setSuccess(message);
    setError(null);
    setInfo(null);
    setWarning(null);
  };

  const setFormInfo = (message: string) => {
    setInfo(message);
    setError(null);
    setSuccess(null);
    setWarning(null);
  };

  const setFormWarning = (message: string) => {
    setWarning(message);
    setError(null);
    setSuccess(null);
    setInfo(null);
  };

  const clearAll = () => {
    setError(null);
    setSuccess(null);
    setInfo(null);
    setWarning(null);
  };

  return {
    error,
    success,
    info,
    warning,
    setFormError,
    setFormSuccess,
    setFormInfo,
    setFormWarning,
    clearAll
  };
};

// Validation error handler
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
  
  if (error?.message?.includes('min length')) {
    return `${fieldName || 'Field'} must be at least ${error.message.match(/\d+/)?.[0] || 'required'} characters.`;
  }
  
  if (error?.message?.includes('max length')) {
    return `${fieldName || 'Field'} must be no more than ${error.message.match(/\d+/)?.[0] || 'allowed'} characters.`;
  }
  
  return 'Please check your input and try again.';
};

// Form submission error handler
export const handleFormSubmissionError = (error: any, context: string): string => {
  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return 'Network connection issue. Please check your internet and try again.';
  }
  
  if (error?.message?.includes('permission') || error?.message?.includes('403')) {
    return 'You don\'t have permission to perform this action.';
  }
  
  if (error?.message?.includes('not found') || error?.message?.includes('404')) {
    return 'The requested resource was not found.';
  }
  
  if (error?.message?.includes('server') || error?.message?.includes('500')) {
    return 'Server error. Please try again later.';
  }
  
  if (error?.message?.includes('validation')) {
    return 'Please check your input and try again.';
  }
  
  return `Failed to ${context}. Please try again.`;
};
