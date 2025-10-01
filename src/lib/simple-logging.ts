// Simple replacements for removed Sentry tracking functions
// These are no-op functions to prevent import errors

/**
 * Track rate limit events (no-op)
 */
export const trackRateLimit = (
  _service: string,
  _endpoint?: string,
  _metadata?: Record<string, unknown>
): void => {
  // No-op: Rate limit tracking removed
};

/**
 * Track database operations and execute them (no-op wrapper)
 */
export const trackDatabaseOperation = async <T>(
  _name: string,
  operation: () => Promise<T> | T,
  _metadata?: {
    operation?: string;
    table?: string;
    repository?: string;
    fallbackUsed?: boolean;
    [key: string]: unknown;
  }
): Promise<T> => {
  // No-op: Just execute the operation without tracking
  return await operation();
};

/**
 * Track cache operations and execute them (no-op wrapper)
 */
export const trackCacheOperation = async <T>(
  _name: string,
  operation: () => Promise<T> | T,
  _metadata?: {
    operation?: string;
    cacheType?: string;
    hit?: boolean;
    key?: string;
    ttl?: number;
    [key: string]: unknown;
  }
): Promise<T> => {
  // No-op: Just execute the operation without tracking
  return await operation();
};

/**
 * Set application context for tracking (no-op)
 */
export const setApplicationContext = (
  _context: Record<string, string | number | boolean | null | undefined>
): void => {
  // No-op: Application context tracking removed
};

/**
 * Track network operations (no-op)
 */
export const trackNetworkOperation = (
  _name: string,
  _metadata?: Record<string, unknown>
): void => {
  // No-op: Network operation tracking removed
};

/**
 * Mock span object for tracing
 */
interface MockSpan {
  setAttributes: (attributes: Record<string, unknown>) => void;
  setAttribute: (key: string, value: unknown) => void;
}

/**
 * Start a tracing span (no-op wrapper)
 */
export const startSpan = <T>(
  _config: {
    name: string;
    op?: string;
    attributes?: Record<string, unknown>;
  },
  callback: (span: MockSpan) => T
): T => {
  // No-op: Just execute the callback with a mock span object
  const mockSpan: MockSpan = {
    setAttributes: () => {},
    setAttribute: () => {},
  };
  return callback(mockSpan);
};
