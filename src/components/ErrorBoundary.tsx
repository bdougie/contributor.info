/**
 * React Error Boundary with PostHog integration
 * Catches errors in component tree and reports them to PostHog
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that tracks errors in PostHog
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Track error in PostHog (lazy-loaded to avoid bundle bloat)
    import('@/lib/posthog-lazy').then(({ trackError, ErrorSeverity, ErrorCategory }) => {
      trackError(error, {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.UI,
        metadata: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
        },
      });
    }).catch(console.error);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback or default error UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
            </div>

            <p className="mb-4 text-sm text-gray-600">
              We've encountered an unexpected error. The error has been reported and we'll look
              into it.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mb-4 rounded border border-gray-200 bg-gray-50 p-3">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">
                  Error Details (dev only)
                </summary>
                <pre className="mt-2 overflow-x-auto text-xs text-gray-600">
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Reload Page
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight error fallback component for non-critical sections
 */
export const ErrorFallback: React.FC<{
  error?: Error;
  resetError?: () => void;
}> = ({ error, resetError }) => {
  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100">
          <svg
            className="h-5 w-5 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800">Unable to load this content</h3>
          <p className="mt-1 text-sm text-yellow-700">
            We're having trouble displaying this section. Try refreshing the page.
          </p>
          {import.meta.env.DEV && error && (
            <pre className="mt-2 overflow-x-auto text-xs text-yellow-800">
              {error.toString()}
            </pre>
          )}
          {resetError && (
            <button
              onClick={resetError}
              className="mt-3 rounded-md bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-200"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
