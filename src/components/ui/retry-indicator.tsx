import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, XCircle } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export interface RetryState {
  isRetrying: boolean;
  attempt: number;
  maxAttempts: number;
  error?: Error;
  nextRetryIn?: number;
}

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
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        {retryState.isRetrying
? (
          <>
            <RefreshCw className="h-3 w-3 animate-spin text-yellow-600" />
            <span className="text-muted-foreground">
              Retrying... ({retryState.attempt}/{retryState.maxAttempts})
            </span>
          </>
        )
: retryState.error
? (
          <>
            <XCircle className="h-3 w-3 text-red-600" />
            <span className="text-muted-foreground">Failed</span>
            {onRetry && (
              <button onClick={onRetry} className="text-xs underline hover:no-underline">
                Retry
              </button>
            )}
          </>
        )
: null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        retryState.isRetrying &&
          'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950',
        retryState.error && 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {retryState.isRetrying
? (
          <RefreshCw className="h-5 w-5 animate-spin text-yellow-600 dark:text-yellow-400 mt-0.5" />
        )
: retryState.error
? (
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
        )
: (
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
        )}

        <div className="flex-1">
          <div className="font-medium text-sm">
            {retryState.isRetrying
? (
              <>
                Connection attempt {retryState.attempt} of {retryState.maxAttempts}
              </>
            )
: retryState.error
? (
              <>Connection failed after {retryState.maxAttempts} attempts</>
            )
: (
              <>Connecting...</>
            )}
          </div>

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
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage retry state
 */
export function useRetryState(): [RetryState, (updates: Partial<RetryState>) => void] {
  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
    maxAttempts: 3,
  });

  const updateState = (updates: Partial<RetryState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  return [state, updateState];
}

/**
 * Hook to integrate retry state with retry utils
 */
export function useRetryIndicator() {
  const [retryState, setRetryState] = useRetryState();

  const createRetryHandler = (maxAttempts: number = 3) => {
    return {
      onRetry: (_error: Error, attempt: number) => {
        setRetryState({
          isRetrying: true,
          attempt,
          maxAttempts,
          error: undefined,
          nextRetryIn: Math.pow(2, attempt - 1) * 1000, // Exponential backoff
        });
      },
      onSuccess: () => {
        setRetryState({
          isRetrying: false,
          attempt: 0,
          error: undefined,
          nextRetryIn: undefined,
        });
      },
      onError: (err: Error) => {
        setRetryState({
          isRetrying: false,
          error: err,
          nextRetryIn: undefined,
        });
      },
    };
  };

  return {
    retryState,
    createRetryHandler,
    resetRetryState: () =>
      setRetryState({
        isRetrying: false,
        attempt: 0,
        maxAttempts: 3,
      }),
  };
}
