// Simple replacements for removed Sentry tracking functions
// These are no-op functions to prevent import errors

export interface Metadata {
  [key: string]: string | number | boolean | object | null;
}

export interface Span {
  setAttributes: (attributes: Metadata) => void;
  setAttribute: (key: string, value: string | number | boolean) => void;
  setStatus: (status: string) => void;
}

export interface SpanConfig {
  name: string;
  op?: string;
  attributes?: Metadata;
}

export const trackRateLimit = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ..._args: (string | number | Metadata)[]
) => {
  // No-op: Rate limit tracking removed
};

export const trackDatabaseOperation = async <T>(
  _name: string,
  operation: () => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _metadata?: Metadata
): Promise<T> => {
  // No-op: Just execute the operation without tracking
  return await operation();
};

export const trackCacheOperation = async <T>(
  _name: string,
  operation: () => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _metadata?: Metadata
): Promise<T> => {
  // No-op: Just execute the operation without tracking
  return await operation();
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const setApplicationContext = (..._args: (string | Metadata)[]) => {
  // No-op: Application context tracking removed
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const trackNetworkOperation = (..._args: (string | Metadata)[]) => {
  // No-op: Network operation tracking removed
};

export const startSpan = <T>(_config: SpanConfig, callback: (span: Span) => T): T => {
  // No-op: Just execute the callback with a mock span object
  const mockSpan: Span = {
    setAttributes: () => {},
    setAttribute: () => {},
    setStatus: () => {},
  };
  return callback(mockSpan);
};
