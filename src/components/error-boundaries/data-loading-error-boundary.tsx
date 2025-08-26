import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Clock, Wifi, Shield, AlertTriangle } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LoadingError,
  ErrorBoundaryState,
  LoadingStage,
  RecoveryAction,
  getRetryDelay,
  canRecoverInNextStage,
} from '@/lib/types/data-loading-errors';

interface Props {
  children: ReactNode;
  stage: LoadingStage;
  onRetry?: () => void;
  onRecoveryAction?: (action: RecoveryAction, context?: unknown) => void;
  onError?: (error: LoadingError, errorInfo: unknown) => void;
  fallbackData?: unknown;
  enableGracefulDegradation?: boolean;
}

interface State extends ErrorBoundaryState {
  hasError: boolean;
  currentError: LoadingError | null;
  isRetrying: boolean;
  retryCountdown: number;
}

/**
 * Specialized error boundary for progressive data loading failures
 * Provides stage-aware error handling with recovery options
 */
export class DataLoadingErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private countdownIntervalId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      currentError: null,
      isRetrying: false,
      retryCountdown: 0,
      errors: {
        critical: null,
        full: null,
        enhancement: null,
      },
      partialData: {},
      recoveryAttempts: {},
      lastRecoveryTime: {},
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Check if this is a LoadingError, otherwise create a generic one
    const loadingError = error as LoadingError;

    if (!loadingError.stage || !loadingError.type) {
      // Convert generic error to LoadingError
      const genericError = error as LoadingError;
      genericError.stage = 'critical';
      genericError.type = 'network';
      genericError.retryable = true;
      genericError.userMessage = 'An unexpected error occurred while loading data.';
      genericError.technicalDetails = error.message;
    }

    return {
      hasError: true,
      currentError: loadingError,
      errors: {
        critical: loadingError.stage === 'critical' ? loadingError : null,
        full: loadingError.stage === 'full' ? loadingError : null,
        enhancement: loadingError.stage === 'enhancement' ? loadingError : null,
      },
    };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    const loadingError = error as LoadingError;

    console.error(`DataLoadingErrorBoundary (${this.props.stage}):`, error, errorInfo);

    // Track error for monitoring
    this.props.onError?.(loadingError, errorInfo);

    // Log technical details for debugging
    if (loadingError.technicalDetails) {
      console.error('Technical details:', loadingError.technicalDetails);
    }

    if (loadingError.context) {
      console.error('Error context:', loadingError.context);
    }
  }

  componentWillUnmount() {
    this.clearTimeouts();
  }

  clearTimeouts = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
  };

  handleRetry = async () => {
    const { currentError } = this.state;

    if (!currentError || !currentError.retryable) {
      return;
    }

    const errorId = `${currentError.stage}-${currentError.type}`;
    const attemptCount = (this.state.recoveryAttempts[errorId] || 0) + 1;
    const retryDelay = getRetryDelay(currentError, attemptCount);

    // Update attempt count
    this.setState({
      recoveryAttempts: {
        ...this.state.recoveryAttempts,
        [errorId]: attemptCount,
      },
      lastRecoveryTime: {
        ...this.state.lastRecoveryTime,
        [errorId]: Date.now(),
      },
      isRetrying: true,
    });

    if (retryDelay > 0) {
      // Show countdown for longer delays
      if (retryDelay > 2000) {
        this.startRetryCountdown(Math.ceil(retryDelay / 1000));
      }

      this.retryTimeoutId = setTimeout(() => {
        this.executeRetry();
      }, retryDelay);
    } else {
      this.executeRetry();
    }
  };

  startRetryCountdown = (seconds: number) => {
    this.setState({ retryCountdown: seconds });

    this.countdownIntervalId = setInterval(() => {
      this.setState((prev) => {
        const newCountdown = prev.retryCountdown - 1;
        if (newCountdown <= 0) {
          this.clearTimeouts();
          return { retryCountdown: 0 };
        }
        return { retryCountdown: newCountdown };
      });
    }, 1000);
  };

  executeRetry = () => {
    this.clearTimeouts();
    this.setState({
      hasError: false,
      currentError: null,
      isRetrying: false,
      retryCountdown: 0,
    });
    this.props.onRetry?.();
  };

  handleRecoveryAction = (action: RecoveryAction, context?: unknown) => {
    switch (action) {
      case 'retry':
        this.handleRetry();
        break;
      case 'use_partial_data':
        // Use any available partial data and continue
        this.setState({
          hasError: false,
          currentError: null,
        });
        break;
      case 'clear_cache':
        this.clearCache();
        break;
      case 'refresh_auth':
        this.refreshAuth();
        break;
      default:
        this.props.onRecoveryAction?.(action, context);
    }
  };

  clearCache = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Retry after cache clear
      this.handleRetry();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  refreshAuth = async () => {
    try {
      // Use window.location for auth refresh instead of dynamic imports
      // which can cause issues in production builds
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to refresh auth:', error);
    }
  };

  getErrorIcon = (type: string) => {
    switch (type) {
      case 'network':
        return <Wifi className="h-5 w-5" />;
      case 'timeout':
        return <Clock className="h-5 w-5" />;
      case 'permission':
        return <Shield className="h-5 w-5" />;
      case 'rate_limit':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  getSeverityColor = (stage: LoadingStage) => {
    switch (stage) {
      case 'critical':
        return 'text-red-500';
      case 'full':
        return 'text-orange-500';
      case 'enhancement':
        return 'text-yellow-500';
      default:
        return 'text-red-500';
    }
  };

  canShowPartialData = (): boolean => {
    const { currentError } = this.state;
    const { enableGracefulDegradation, fallbackData } = this.props;

    if (!enableGracefulDegradation || !currentError) {
      return false;
    }

    // Show partial data for non-critical errors or if we can recover
    return (
      currentError.stage !== 'critical' ||
      canRecoverInNextStage(currentError) ||
      Boolean(fallbackData)
    );
  };

  render() {
    const { children, fallbackData } = this.props;
    const { hasError, currentError, isRetrying, retryCountdown } = this.state;

    // Show partial data if graceful degradation is enabled
    if (hasError && this.canShowPartialData()) {
      return (
        <div className="space-y-4">
          {fallbackData && (
            <div className="opacity-75">
              {typeof fallbackData === 'function' ? fallbackData() : fallbackData}
            </div>
          )}

          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={this.getSeverityColor(currentError?.stage || 'critical')}>
                  {this.getErrorIcon(currentError?.type || 'network')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {currentError?.stage === 'enhancement'
                      ? 'Additional data unavailable'
                      : 'Partial data shown'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {currentError?.userMessage || 'Some data could not be loaded.'}
                  </p>
                  {currentError?.retryable && (
                    <button
                      onClick={this.handleRetry}
                      disabled={isRetrying}
                      className="text-xs text-blue-600 hover:text-blue-800 mt-2 disabled:opacity-50"
                    >
                      {isRetrying ? 'Retrying...' : 'Try loading again'}
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Show error UI for critical failures
    if (hasError && currentError) {
      return (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={this.getSeverityColor(currentError.stage)}>
                {this.getErrorIcon(currentError.type)}
              </div>
              <span className="text-lg">
                {currentError.stage === 'critical'
                  ? 'Failed to load data'
                  : 'Partial loading error'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-gray-900 mb-2">{currentError.userMessage}</p>
              {currentError.context && (
                <p className="text-sm text-gray-600">
                  Repository: {currentError.context.owner}/{currentError.context.repo}
                </p>
              )}
            </div>

            {currentError.recoveryOptions && currentError.recoveryOptions.length > 0 && (
              <div className="space-y-2">
                {currentError.recoveryOptions
                  .sort((a, b) => {
                    const priorityOrder = { high: 0, medium: 1, low: 2 };
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                  })
                  .map((option) => (
                    <button
                      key={option.id}
                      onClick={() => this.handleRecoveryAction(option.action)}
                      disabled={isRetrying}
                      className={`
                        w-full text-left p-3 rounded-lg border transition-colors disabled:opacity-50
                        ${
                          option.priority === 'high'
                            ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2">
                        {option.action === 'retry' && <RefreshCw className="h-4 w-4" />}
                        <div>
                          <p className="font-medium text-sm">{option.label}</p>
                          <p className="text-xs text-gray-600">{option.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {isRetrying && retryCountdown > 0 && (
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Retrying in {retryCountdown} second{retryCountdown !== 1 ? 's' : ''}...
                </p>
              </div>
            )}

            {isRetrying && retryCountdown === 0 && (
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <p className="text-sm text-blue-800">Retrying...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    return children;
  }
}

/**
 * Higher-order component for wrapping components with data loading error boundaries
 */
export function withDataLoadingErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  stage: LoadingStage,
  options: {
    enableGracefulDegradation?: boolean;
    onError?: (error: LoadingError, errorInfo: unknown) => void;
    onRetry?: () => void;
  } = {},
) {
  return (props: P) => (
    <DataLoadingErrorBoundary
      stage={stage}
      enableGracefulDegradation={options.enableGracefulDegradation}
      onError={options.onError}
      onRetry={options.onRetry}
    >
      <Component {...props} />
    </DataLoadingErrorBoundary>
  );
}
