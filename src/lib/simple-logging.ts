// Simple replacements for removed Sentry tracking functions
// These are no-op functions to prevent import errors

export const trackRateLimit = (..._args: unknown[]) => {
  // No-op: Rate limit tracking removed
};

export const trackDatabaseOperation = async (_name: string, operation: () => any, _metadata?: unknown) => {
  // No-op: Just execute the operation without tracking
  return await operation();
};

export const trackCacheOperation = async (_name: string, operation: () => any, _metadata?: unknown) => {
  // No-op: Just execute the operation without tracking
  return await operation();
};

export const setApplicationContext = (..._args: unknown[]) => {
  // No-op: Application context tracking removed
};

export const trackNetworkOperation = (..._args: unknown[]) => {
  // No-op: Network operation tracking removed
};

export const startSpan = (_config: unknown, callback: (span: unknown) => any) => {
  // No-op: Just execute the callback with a mock span object
  const mockSpan = {
    setAttributes: () => {},
    setAttribute: () => {}
  };
  return callback(mockSpan);
};