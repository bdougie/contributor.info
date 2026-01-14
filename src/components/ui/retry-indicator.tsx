import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, XCircle } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { RetryState } from './use-retry-state';

export type { RetryState } from './use-retry-state';

interface RetryIndicatorProps {
  retryState: RetryState;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function RetryIndicator({
  retryState,
  onRetry,
  className,
  compact = false,
}: RetryIndicatorProps) {
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    if (retryState.nextRetryIn && retryState.nextRetryIn > 0) {
      setCountdown(Math.ceil(retryState.nextRetryIn / 1000));

      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [retryState.nextRetryIn]);

  if (!retryState.isRetrying && !retryState.error) {
    return null;
  }

  if (compact) {
    const renderCompactContent = () => {
      if (retryState.isRetrying) {
        return (
          <>
            <RefreshCw className="h-3 w-3 animate-spin text-yellow-600" />
            <span className="text-muted-foreground">
              Retrying... ({retryState.attempt}/{retryState.maxAttempts})
            </span>
          </>
        );
      }
      if (retryState.error) {
        return (
          <>
            <XCircle className="h-3 w-3 text-red-600" />
            <span className="text-muted-foreground">Failed</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs underline hover:no-underline"
                aria-label="Retry failed operation"
              >
                Retry
              </button>
            )}
          </>
        );
      }
      return null;
    };

    return (
      <div
        className={cn('flex items-center gap-2 text-sm', className)}
        role="status"
        aria-live="polite"
      >
        {renderCompactContent()}
      </div>
    );
  }

  const renderStatusIcon = () => {
    if (retryState.isRetrying) {
      return (
        <RefreshCw className="h-5 w-5 animate-spin text-yellow-600 dark:text-yellow-400 mt-0.5" />
      );
    }
    if (retryState.error) {
      return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />;
    }
    return <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />;
  };

  const renderStatusText = () => {
    if (retryState.isRetrying) {
      return (
        <>
          Connection attempt {retryState.attempt} of {retryState.maxAttempts}
        </>
      );
    }
    if (retryState.error) {
      return <>Connection failed after {retryState.maxAttempts} attempts</>;
    }
    return <>Connecting...</>;
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        retryState.isRetrying &&
          'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950',
        retryState.error && 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {renderStatusIcon()}

        <div className="flex-1">
          <div className="font-medium text-sm">{renderStatusText()}</div>

          {retryState.error && (
            <p className="text-sm text-muted-foreground mt-1">{retryState.error.message}</p>
          )}

          {countdown > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Next retry in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          )}

          {onRetry && retryState.error && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              aria-label="Try connecting again"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
