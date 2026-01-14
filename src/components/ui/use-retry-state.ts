import { useState } from 'react';

export interface RetryState {
  isRetrying: boolean;
  attempt: number;
  maxAttempts: number;
  error?: Error;
  nextRetryIn?: number;
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
