export interface APIError {
  code: string;
  message: string;
  userMessage: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId: string;
  retryable: boolean;
  category: 'validation' | 'authentication' | 'authorization' | 'not_found' | 'rate_limit' | 'server_error' | 'external_api';
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}