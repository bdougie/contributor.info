// Simple replacements for removed Sentry tracking functions
// These are no-op functions to prevent import errors

export const trackRateLimit = (..._args: any[]) => {
  // No-op: Rate limit tracking removed
};

export const trackDatabaseOperation = async (_name: string, operation: () => any, _metadata?: any) => {
  // No-op: Just execute the operation without tracking
  return await operation();
};

export const trackCacheOperation = async (_name: string, operation: () => any, _metadata?: any) => {
  // No-op: Just execute the operation without tracking
  return await operation();
};

export const setApplicationContext = (..._args: any[]) => {
  // No-op: Application context tracking removed
};

export const trackNetworkOperation = (..._args: any[]) => {
  // No-op: Network operation tracking removed
};

export const startSpan = (_config: any, callback: (span: any) => any) => {
  // No-op: Just execute the callback with a mock span object
  const mockSpan = {
    setAttributes: () => {},
    setAttribute: () => {}
  };
  return callback(mockSpan);
};