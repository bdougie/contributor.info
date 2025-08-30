import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary specifically for analytics-related components.
 * Prevents analytics failures from crashing the entire app.
 */
export class AnalyticsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Analytics Error Boundary caught:', error, errorInfo);
    }
    // In production, you might want to send this to an error reporting service
    // But NOT to analytics since that might be what failed!
  }

  render() {
    if (this.state.hasError) {
      // Return fallback UI or just render children without analytics
      return this.props.fallback || this.props.children;
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap components that use analytics
 */
export function withAnalyticsErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return (props: P) => (
    <AnalyticsErrorBoundary fallback={fallback}>
      <Component {...props} />
    </AnalyticsErrorBoundary>
  );
}
