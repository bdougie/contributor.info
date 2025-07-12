import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  context?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Enhanced Error Boundary with Sentry integration
 * Automatically captures errors and provides user feedback options
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Only send to Sentry in production
    if (import.meta.env.PROD) {
      import('@sentry/react').then((Sentry) => {
        Sentry.withScope((scope) => {
          scope.setTag('component', 'ErrorBoundary');
          scope.setContext('errorBoundary', {
            componentStack: errorInfo.componentStack,
            context: this.props.context || 'unknown'
          });
          
          // Add user feedback capability
          scope.setContext('userFeedback', {
            canCollectFeedback: true,
            errorId: Sentry.captureException(error)
          });
        });
      }).catch(() => {
        // Sentry not available, just log to console
        console.error('Failed to track error in Sentry:', error);
      });
    } else {
      // In development, just log to console
      console.error('Error caught by ErrorBoundary:', error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleFeedback = () => {
    // Only show feedback dialog in production
    if (import.meta.env.PROD) {
      import('@sentry/react').then((Sentry) => {
        Sentry.showReportDialog({
          subtitle: 'Help us improve by describing what you were doing when this error occurred.',
          subtitle2: 'Your feedback helps us fix bugs faster.',
          labelName: 'Name',
          labelEmail: 'Email',
          labelComments: 'What happened?',
          labelClose: 'Close',
          labelSubmit: 'Submit',
          errorGeneric: 'An error occurred while submitting your feedback.',
          errorFormEntry: 'Please check your entries and try again.',
          successMessage: 'Thank you for your feedback!'
        });
      }).catch(() => {
        alert('Error reporting not available in development');
      });
    } else {
      alert('Error reporting is only available in production');
    }
  };

  handleClearCache = async () => {
    try {
      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear Supabase auth cache
      const { createClient } = await import('@supabase/supabase-js');
      const { env } = await import('@/lib/env');
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
      await supabase.auth.signOut();
      
      // Clear browser cache for this domain (if possible)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Force a hard reload
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      // Fallback to just reloading
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Something went wrong
            </h3>
            <p className="text-gray-600 mb-6">
              {this.props.context 
                ? `Error in ${this.props.context}. Please try again or contact support if the problem persists.`
                : 'An unexpected error occurred. Please try again or contact support if the problem persists.'
              }
              {this.props.context === 'Application Root' && (
                <span className="block mt-2 text-sm text-blue-600">
                  💡 If this error persists, try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) to clear cached authentication data.
                </span>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
              {this.props.context === 'Application Root' && (
                <button
                  onClick={this.handleClearCache}
                  className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear Cache & Reload
                </button>
              )}
              {import.meta.env.PROD && (
                <button
                  onClick={this.handleFeedback}
                  className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Report Issue
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Error boundary HOC with optional Sentry integration (production only)
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  context?: string
) => {
  // In production, use Sentry's withErrorBoundary if available
  if (import.meta.env.PROD) {
    try {
      // Dynamic import to avoid loading Sentry in development
      return (props: P) => {
        import('@sentry/react').then((Sentry) => {
          return Sentry.withErrorBoundary(Component, {
            fallback: ({ error, resetError }) => (
              <div className="min-h-[200px] flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {context ? `Error in ${context}` : 'Component Error'}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {(error as Error)?.message || 'An unexpected error occurred'}
                  </p>
                  <button
                    onClick={resetError}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </button>
                </div>
              </div>
            ),
            beforeCapture: (scope) => {
              scope.setTag('component', context || 'unknown');
              scope.setLevel('error');
            }
          });
        }).catch(() => {
          // Fallback to regular ErrorBoundary if Sentry fails
          return (
            <ErrorBoundary context={context}>
              <Component {...props} />
            </ErrorBoundary>
          );
        });

        // Return ErrorBoundary while Sentry loads
        return (
          <ErrorBoundary context={context}>
            <Component {...props} />
          </ErrorBoundary>
        );
      };
    } catch {
      // Fallback to regular ErrorBoundary if Sentry import fails
      return (props: P) => (
        <ErrorBoundary context={context}>
          <Component {...props} />
        </ErrorBoundary>
      );
    }
  }

  // In development, use our custom ErrorBoundary
  return (props: P) => (
    <ErrorBoundary context={context}>
      <Component {...props} />
    </ErrorBoundary>
  );
};