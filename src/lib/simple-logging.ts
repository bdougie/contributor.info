// Simple replacements for removed Sentry tracking functions
// These are no-op functions to prevent import errors

interface SpanLike {
  setAttributes: (attributes: Record<string, string | number | boolean | undefined>) => void;
  setAttribute: (key: string, value: string | number | boolean | undefined) => void;
  setStatus: (status: string) => void;
}

interface SpanConfig {
  name: string;
  op?: string;
  attributes?: Record<string, string | number | boolean | undefined>;
}

export const trackRateLimit: (...args: unknown[]) => void = () => {
  // No-op: Rate limit tracking removed
};

export const trackDatabaseOperation = async <T>(...args: [string, () => T, ...unknown[]]) => {
  // No-op: Just execute the operation without tracking
  return await args[1]();
};

export const trackCacheOperation = async <T>(...args: [string, () => T, ...unknown[]]) => {
  // No-op: Just execute the operation without tracking
  return await args[1]();
};

export const setApplicationContext: (...args: unknown[]) => void = () => {
  // No-op: Application context tracking removed
};

export const trackNetworkOperation: (...args: unknown[]) => void = () => {
  // No-op: Network operation tracking removed
};

export const startSpan = <T>(_config: SpanConfig, callback: (span: SpanLike) => T): T => {
  // No-op: Just execute the callback with a mock span object
  const mockSpan: SpanLike = {
    setAttributes: () => {},
    setAttribute: () => {},
    setStatus: () => {},
  };
  return callback(mockSpan);
};
