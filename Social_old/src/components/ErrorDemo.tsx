import React from 'react';
import { Button } from '@/components/ui/button';
import { showErrorToast, showSuccessToast, showInfoToast } from '@/components/ErrorToast';
import { FormErrorHandler, useFormError } from '@/components/FormErrorHandler';

// Demo component to test error handling
export const ErrorDemo: React.FC = () => {
  const { error, success, info, warning, setFormError, setFormSuccess, setFormInfo, setFormWarning, clearAll } = useFormError();

  const triggerNetworkError = () => {
    showErrorToast(
      { message: 'Network connection failed' },
      { context: 'Demo Network Error' }
    );
  };

  const triggerServerError = () => {
    showErrorToast(
      { message: 'Server temporarily unavailable' },
      { context: 'Demo Server Error' }
    );
  };

  const triggerPermissionError = () => {
    showErrorToast(
      { message: 'Permission denied' },
      { context: 'Demo Permission Error' }
    );
  };

  const triggerSuccess = () => {
    showSuccessToast('Operation completed successfully!');
  };

  const triggerInfo = () => {
    showInfoToast('This is an informational message');
  };

  const triggerFormError = () => {
    setFormError('Please fill in all required fields');
  };

  const triggerFormSuccess = () => {
    setFormSuccess('Form submitted successfully!');
  };

  const triggerFormInfo = () => {
    setFormInfo('Please review your information before submitting');
  };

  const triggerFormWarning = () => {
    setFormWarning('This action cannot be undone');
  };

  const triggerJavaScriptError = () => {
    // This will trigger the error boundary
    throw new Error('Demo JavaScript Error');
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Error Handling Demo</h1>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Toast Notifications</h2>
          <div className="space-y-2">
            <Button onClick={triggerNetworkError} variant="destructive">
              Trigger Network Error
            </Button>
            <Button onClick={triggerServerError} variant="destructive">
              Trigger Server Error
            </Button>
            <Button onClick={triggerPermissionError} variant="destructive">
              Trigger Permission Error
            </Button>
            <Button onClick={triggerSuccess} variant="default">
              Trigger Success
            </Button>
            <Button onClick={triggerInfo} variant="outline">
              Trigger Info
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Form Error States</h2>
          <div className="space-y-2">
            <Button onClick={triggerFormError} variant="destructive">
              Form Error
            </Button>
            <Button onClick={triggerFormSuccess} variant="default">
              Form Success
            </Button>
            <Button onClick={triggerFormInfo} variant="outline">
              Form Info
            </Button>
            <Button onClick={triggerFormWarning} variant="secondary">
              Form Warning
            </Button>
            <Button onClick={clearAll} variant="ghost">
              Clear All
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Form Error Handler Demo</h2>
        <FormErrorHandler
          error={error}
          success={success}
          info={info}
          warning={warning}
          onRetry={() => {
            console.log('Retry clicked');
            clearAll();
          }}
          onDismiss={clearAll}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Error Boundary Demo</h2>
        <Button onClick={triggerJavaScriptError} variant="destructive">
          Trigger JavaScript Error (Will be caught by Error Boundary)
        </Button>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Error Handling Features:</h3>
        <ul className="text-blue-800 space-y-1 text-sm">
          <li>• Global error boundary catches React errors</li>
          <li>• User-friendly error messages instead of technical errors</li>
          <li>• Retry mechanisms for failed operations</li>
          <li>• Form validation with helpful messages</li>
          <li>• Network error detection and handling</li>
          <li>• Graceful degradation for offline scenarios</li>
          <li>• Success and info notifications</li>
          <li>• Automatic error logging for debugging</li>
        </ul>
      </div>
    </div>
  );
};
