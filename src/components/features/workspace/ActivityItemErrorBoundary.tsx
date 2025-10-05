/**
 * Activity Item Error Boundary
 * Granular error boundary for individual activity items to prevent cascade failures
 */

import { Component, type ReactNode } from 'react';
import { AlertCircle } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  eventId?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ActivityItemErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console for debugging
    console.error('Activity item error:', {
      eventId: this.props.eventId,
      error,
      errorInfo,
    });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);

    // In production, you could send to error tracking service
    // Example: Sentry.captureException(error, { extra: { eventId, errorInfo } });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900 dark:text-red-100">
              Failed to load activity item
            </p>
            <p className="text-xs text-red-700 dark:text-red-300">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <Button
            onClick={this.resetError}
            size="sm"
            variant="outline"
            className="border-red-300 hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900"
          >
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper for activity feed error boundary
 */
interface ActivityFeedErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ActivityFeedErrorBoundary extends Component<ActivityFeedErrorBoundaryProps, State> {
  constructor(props: ActivityFeedErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Activity feed error:', {
      error,
      errorInfo,
    });

    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-950">
          <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
          <div className="text-center">
            <h3 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">
              Failed to load activity feed
            </h3>
            <p className="mb-4 text-sm text-red-700 dark:text-red-300">
              {this.state.error?.message || 'An unexpected error occurred while loading activities'}
            </p>
            <Button onClick={this.resetError} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
