/**
 * Standardized error handling for API endpoints
 */

export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Authorization errors
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Method errors
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: string;
  path?: string;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export class ApiErrorResponse extends Error {
  public statusCode: number;
  public errorCode: ErrorCode;
  public details?: any;

  constructor(statusCode: number, errorCode: ErrorCode, message: string, details?: any) {
    super(message);
    this.name = 'ApiErrorResponse';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }

  toJSON(): ApiError {
    return {
      code: this.errorCode,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
}

// Predefined error responses
export const ErrorResponses = {
  unauthorized: () => new ApiErrorResponse(401, ErrorCode.UNAUTHORIZED, 'Authentication required'),

  invalidToken: () =>
    new ApiErrorResponse(401, ErrorCode.INVALID_TOKEN, 'Invalid authentication token'),

  forbidden: (resource?: string) =>
    new ApiErrorResponse(
      403,
      ErrorCode.FORBIDDEN,
      resource ? `Access denied to ${resource}` : 'Access denied'
    ),

  insufficientPermissions: (action: string) =>
    new ApiErrorResponse(
      403,
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      `Insufficient permissions to ${action}`
    ),

  validationFailed: (errors: ValidationErrorDetail[]) =>
    new ApiErrorResponse(400, ErrorCode.VALIDATION_FAILED, 'Validation failed', { errors }),

  invalidRequest: (message: string) =>
    new ApiErrorResponse(400, ErrorCode.INVALID_REQUEST, message),

  notFound: (resource: string) =>
    new ApiErrorResponse(404, ErrorCode.NOT_FOUND, `${resource} not found`),

  alreadyExists: (resource: string) =>
    new ApiErrorResponse(409, ErrorCode.ALREADY_EXISTS, `${resource} already exists`),

  conflict: (message: string) => new ApiErrorResponse(409, ErrorCode.CONFLICT, message),

  rateLimitExceeded: (retryAfter: number) =>
    new ApiErrorResponse(429, ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', { retryAfter }),

  internalError: (message?: string) =>
    new ApiErrorResponse(500, ErrorCode.INTERNAL_ERROR, message || 'An internal error occurred'),

  databaseError: () =>
    new ApiErrorResponse(500, ErrorCode.DATABASE_ERROR, 'Database operation failed'),

  serviceUnavailable: () =>
    new ApiErrorResponse(503, ErrorCode.SERVICE_UNAVAILABLE, 'Service temporarily unavailable'),

  methodNotAllowed: (method: string, allowed: string[]) =>
    new ApiErrorResponse(405, ErrorCode.METHOD_NOT_ALLOWED, `Method ${method} not allowed`, {
      allowedMethods: allowed,
    }),
};

/**
 * Create error response with proper formatting
 */
export function createErrorResponse(
  error: ApiErrorResponse,
  path?: string,
  headers?: Record<string, string>
): Response {
  const errorJson = error.toJSON();
  if (path) {
    errorJson.path = path;
  }

  const responseHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  return new Response(JSON.stringify(errorJson), {
    status: error.statusCode,
    headers: responseHeaders,
  });
}

/**
 * Handle unknown errors and convert to standardized format
 */
export function handleUnknownError(error: unknown, path?: string): Response {
  console.error('Unhandled error:', error);

  if (error instanceof ApiErrorResponse) {
    return createErrorResponse(error, path);
  }

  if (error instanceof Error) {
    // Check for specific database errors
    if (error.message.includes('23505')) {
      return createErrorResponse(ErrorResponses.conflict('Resource already exists'), path);
    }

    if (error.message.includes('PGRST116')) {
      return createErrorResponse(ErrorResponses.notFound('Resource'), path);
    }

    // Log the actual error for debugging
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
    });
  }

  // Return generic internal error
  return createErrorResponse(ErrorResponses.internalError(), path);
}
