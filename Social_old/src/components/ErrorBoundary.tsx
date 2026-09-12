import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Log to error reporting service (you can integrate with Sentry, LogRocket, etc.)
    this.logErrorToService(error, errorInfo);
    
    this.setState({ error, errorInfo });
  }

  logErrorToService = (error: Error, errorInfo: React.ErrorInfo) => {
    // Example: Send to error reporting service
    // Sentry.captureException(error, { extra: errorInfo });
    
    // For now, just log to console
    console.error('Error Boundary caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  };

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
          <div className="max-w-lg mx-auto text-center p-8 bg-white rounded-2xl shadow-xl border border-red-100">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Oops! Something went wrong
            </h1>
            
            <p className="text-gray-600 mb-2 text-lg">
              We're sorry for the inconvenience. Our team has been notified and we're working to fix this issue.
            </p>
            
            <p className="text-gray-500 mb-8 text-sm">
              Don't worry, your data is safe and this is just a temporary hiccup.
            </p>
            
            <div className="space-y-3">
              <Button
                onClick={this.resetError}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Try Again
              </Button>
              
              <Button
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 rounded-lg transition-all duration-200"
              >
                <Home className="w-5 h-5 mr-2" />
                Go to Homepage
              </Button>
            </div>
            
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-2">
                If this problem persists, please contact our support team.
              </p>
              {this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                    Technical Details (Click to expand)
                  </summary>
                  <div className="mt-2 p-3 bg-white rounded border border-gray-200 text-xs font-mono text-gray-700 max-h-40 overflow-auto">
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="whitespace-pre-wrap break-words mt-1">
                          {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Custom fallback component for specific pages
export const PageErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => (
  <div className="min-h-[400px] flex items-center justify-center p-8">
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Something went wrong on this page
      </h3>
      <p className="text-gray-600 mb-4">
        We're working to fix this issue. Please try refreshing the page.
      </p>
      <Button onClick={resetError} variant="outline" size="sm">
        <RefreshCw className="w-4 h-4 mr-2" />
        Refresh Page
      </Button>
    </div>
  </div>
);
