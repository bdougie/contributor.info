/**
 * Error tracking utilities for API calls and Supabase queries
 * Provides wrappers and helpers to automatically track errors in PostHog
 * 
 * Note: All imports from posthog-lazy are done dynamically to avoid bundle bloat
 */

import type { PostgrestError } from '@supabase/supabase-js';
import type { ErrorSeverity, ErrorCategory } from './posthog-lazy';

/**
 * Wrap an async function to automatically track errors
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: {
    operation: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
  }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Lazy load posthog tracking
      import('./posthog-lazy').then(({ trackError, ErrorSeverity, ErrorCategory }) => {
        trackError(err, {
          severity: context.severity || ErrorSeverity.MEDIUM,
          category: context.category || ErrorCategory.UNKNOWN,
          metadata: {
            operation: context.operation,
            args: args.map((arg) => (typeof arg === 'object' ? '[Object]' : arg)),
          },
        });
      }).catch(console.error);
      
      throw error;
    }
  }) as T;
}

/**
 * Wrap fetch calls to track API errors
 */
export async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  
  try {
    const response = await fetch(input, init);
    
    // Track 4xx and 5xx errors
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      
      // Lazy load posthog tracking
      import('./posthog-lazy').then(({ trackApiError }) => {
        trackApiError(response.status, url, errorText, {
          method: init?.method || 'GET',
          headers: init?.headers ? '[REDACTED]' : undefined,
        });
      }).catch(console.error);
    }
    
    return response;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    // Lazy load posthog tracking
    import('./posthog-lazy').then(({ trackApiError }) => {
      trackApiError(0, url, err, {
        method: init?.method || 'GET',
        network_error: true,
      });
    }).catch(console.error);
    
    throw error;
  }
}

/**
 * Wrap Supabase query results to track errors
 */
export async function trackSupabaseQuery<T>(
  operation: string,
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>
): Promise<{ data: T | null; error: PostgrestError | null }> {
  try {
    const result = await queryFn();
    
    // Track Supabase-specific errors
    if (result.error) {
      // Lazy load posthog tracking
      import('./posthog-lazy').then(({ trackSupabaseError }) => {
        trackSupabaseError(operation, result.error!, {
          has_data: result.data !== null,
        });
      }).catch(console.error);
    }
    
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    // Lazy load posthog tracking
    import('./posthog-lazy').then(({ trackSupabaseError }) => {
      trackSupabaseError(operation, err, {
        unexpected_error: true,
      });
    }).catch(console.error);
    
    throw error;
  }
}

/**
 * Track unhandled promise rejections
 */
export function setupGlobalErrorTracking(): void {
  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error =
      event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    
    // Lazy load posthog tracking
    import('./posthog-lazy').then(({ trackError, ErrorSeverity, ErrorCategory }) => {
      trackError(error, {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.UNKNOWN,
        metadata: {
          type: 'unhandled_rejection',
          promise: '[Promise]',
        },
      });
    }).catch(console.error);
  });

  // Track global errors
  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message);
    
    // Lazy load posthog tracking
    import('./posthog-lazy').then(({ trackError, ErrorSeverity, ErrorCategory }) => {
      trackError(error, {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.UNKNOWN,
        metadata: {
          type: 'global_error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    }).catch(console.error);
  });
}

/**
 * Create a custom error with additional context
 */
export class TrackedError extends Error {
  constructor(
    message: string,
    public readonly context: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = 'TrackedError';
    
    // Track immediately when created (lazy loaded)
    import('./posthog-lazy').then(({ trackError }) => {
      trackError(this, this.context);
    }).catch(console.error);
  }
}

/**
 * Retry wrapper that tracks failures
 */
export async function retryWithTracking<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    operation: string;
    category?: ErrorCategory;
  }
): Promise<T> {
  const { maxRetries = 3, delay = 1000, operation, category = ErrorCategory.NETWORK } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        // Track final failure (lazy loaded)
        import('./posthog-lazy').then(({ trackError, ErrorSeverity }) => {
          trackError(lastError!, {
            severity: ErrorSeverity.HIGH,
            category,
            metadata: {
              operation,
              attempts: maxRetries,
              final_attempt: true,
            },
          });
        }).catch(console.error);
        throw lastError;
      }
      
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError || new Error('Retry failed');
}
