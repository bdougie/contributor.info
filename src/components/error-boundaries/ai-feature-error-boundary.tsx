import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  featureName?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

/**
 * Error boundary specifically for AI/ML features
 * Provides graceful degradation when models fail to load
 */
export class AIFeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[AIFeatureErrorBoundary] ${this.props.featureName || 'AI Feature'} error:`, {
        error,
        errorInfo,
        componentStack: errorInfo.componentStack,
      });
    }

    // Call error handler if provided
    this.props.onError?.(error, errorInfo);

    // Increment error count
    this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));

    // Log to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // Would integrate with Sentry/PostHog here
      console.error('AI Feature Error:', error.message);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      const isModelLoadError =
        this.state.error?.message?.includes('ONNX') ||
        this.state.error?.message?.includes('model') ||
        this.state.error?.message?.includes('transformers');

      const isNetworkError =
        this.state.error?.message?.includes('fetch') ||
        this.state.error?.message?.includes('network');

      return (
        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              {this.props.featureName || 'AI Feature'} Unavailable
            </CardTitle>
            <CardDescription>
              {(() => {
                if (isModelLoadError) {
                  return 'The AI model failed to load. This feature requires machine learning models to work.';
                }
                if (isNetworkError) {
                  return 'Network error while loading AI features. Please check your connection.';
                }
                return 'An unexpected error occurred while loading this AI-powered feature.';
              })()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {process.env.NODE_ENV === 'development' && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-mono text-muted-foreground">
                  {this.state.error?.message}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={this.handleReset}
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={this.state.errorCount > 3}
              >
                <RefreshCw className="h-4 w-4" />
                {this.state.errorCount > 3 ? 'Max retries reached' : 'Try Again'}
              </Button>
              {this.state.errorCount > 3 && (
                <p className="text-sm text-muted-foreground self-center">
                  Please refresh the page to reset.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              You can continue using other features while we work on fixing this issue.
            </p>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap components with AI error boundary
 */
export function withAIErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  featureName?: string,
  fallback?: ReactNode
) {
  return (props: P) => (
    <AIFeatureErrorBoundary featureName={featureName} fallback={fallback}>
      <Component {...props} />
    </AIFeatureErrorBoundary>
  );
}
