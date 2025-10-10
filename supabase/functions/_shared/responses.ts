/**
 * Response Utilities for Edge Functions
 * 
 * Standardized response formatting and error handling for consistent API responses
 * across all edge functions.
 * 
 * @module responses
 */

import { corsHeaders } from './cors.ts';

/**
 * Standard success response format
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
  meta?: Record<string, unknown>;
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
  code?: string;
  meta?: Record<string, unknown>;
}

/**
 * Creates a standardized success response
 * 
 * @param {T} data - Response data payload
 * @param {string} message - Optional success message
 * @param {number} status - HTTP status code (default: 200)
 * @param {Record<string, unknown>} meta - Optional metadata
 * @returns {Response} HTTP Response object
 * 
 * @example
 * return successResponse({ contributorId: '123' }, 'Contributor created', 201);
 */
export function successResponse<T = unknown>(
  data?: T,
  message?: string,
  status: number = 200,
  meta?: Record<string, unknown>
): Response {
  const body: SuccessResponse<T> = {
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
    ...(meta && { meta }),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Creates a standardized error response
 * 
 * @param {string} error - Error message
 * @param {number} status - HTTP status code (default: 500)
 * @param {string} details - Optional detailed error information
 * @param {string} code - Optional error code for client-side handling
 * @param {Record<string, unknown>} meta - Optional metadata
 * @returns {Response} HTTP Response object
 * 
 * @example
 * return errorResponse('Repository not found', 404, 'The repository owner/name does not exist', 'REPO_NOT_FOUND');
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: string,
  code?: string,
  meta?: Record<string, unknown>
): Response {
  const body: ErrorResponse = {
    success: false,
    error,
    ...(details && { details }),
    ...(code && { code }),
    ...(meta && { meta }),
  };

  // Log server errors (5xx)
  if (status >= 500) {
    console.error('Server error:', { error, details, code, meta });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Creates a validation error response (400)
 * 
 * @param {string} message - Validation error message
 * @param {string} details - Optional detailed validation information
 * @returns {Response} HTTP Response object
 * 
 * @example
 * return validationError('Missing required fields', 'Both owner and name are required');
 */
export function validationError(message: string, details?: string): Response {
  return errorResponse(message, 400, details, 'VALIDATION_ERROR');
}

/**
 * Creates a not found error response (404)
 * 
 * @param {string} resource - Name of the resource that was not found
 * @param {string} details - Optional additional details
 * @returns {Response} HTTP Response object
 * 
 * @example
 * return notFoundError('Repository', 'No repository found with owner/name');
 */
export function notFoundError(resource: string, details?: string): Response {
  return errorResponse(
    `${resource} not found`,
    404,
    details,
    'NOT_FOUND'
  );
}

/**
 * Creates an unauthorized error response (401)
 * 
 * @param {string} message - Authorization error message
 * @returns {Response} HTTP Response object
 * 
 * @example
 * return unauthorizedError('GitHub token not configured');
 */
export function unauthorizedError(message: string = 'Unauthorized'): Response {
  return errorResponse(message, 401, undefined, 'UNAUTHORIZED');
}

/**
 * Creates a forbidden error response (403)
 * 
 * @param {string} message - Forbidden error message
 * @returns {Response} HTTP Response object
 * 
 * @example
 * return forbiddenError('Insufficient permissions to access this resource');
 */
export function forbiddenError(message: string = 'Forbidden'): Response {
  return errorResponse(message, 403, undefined, 'FORBIDDEN');
}

/**
 * Creates a rate limit error response (429)
 * 
 * @param {number} retryAfter - Seconds until rate limit resets
 * @returns {Response} HTTP Response object
 * 
 * @example
 * return rateLimitError(3600);
 */
export function rateLimitError(retryAfter?: number): Response {
  const response = errorResponse(
    'Rate limit exceeded',
    429,
    retryAfter ? `Try again in ${retryAfter} seconds` : undefined,
    'RATE_LIMIT_EXCEEDED',
    retryAfter ? { retryAfter } : undefined
  );

  if (retryAfter) {
    // Add Retry-After header
    const headers = new Headers(response.headers);
    headers.set('Retry-After', retryAfter.toString());
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  }

  return response;
}

/**
 * Handles CORS preflight requests
 * 
 * @returns {Response} HTTP Response object for OPTIONS request
 * 
 * @example
 * if (req.method === 'OPTIONS') {
 *   return corsPreflightResponse();
 * }
 */
export function corsPreflightResponse(): Response {
  return new Response('ok', { headers: corsHeaders });
}

/**
 * Creates a legacy-compatible success response without data wrapping
 * 
 * This maintains backward compatibility for existing endpoints that
 * return data at the top level instead of wrapped under a 'data' property.
 * 
 * @param {Record<string, unknown>} payload - Response payload (spread at top level)
 * @param {string} message - Optional success message
 * @param {number} status - HTTP status code (default: 200)
 * @returns {Response} HTTP Response object
 * 
 * @example
 * return legacySuccessResponse({ processed: 5, errors: 0 }, 'Sync completed');
 */
export function legacySuccessResponse(
  payload: Record<string, unknown>,
  message?: string,
  status: number = 200
): Response {
  const body = {
    success: true,
    ...payload,
    ...(message && { message }),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Wraps an error in a standardized error response
 * 
 * Useful for catch blocks to ensure consistent error handling
 * 
 * @param {unknown} error - The caught error
 * @param {string} context - Context of where the error occurred
 * @param {number} status - HTTP status code (default: 500)
 * @returns {Response} HTTP Response object
 * 
 * @example
 * try {
 *   // ... operation
 * } catch (error) {
 *   return handleError(error, 'repository sync');
 * }
 */
export function handleError(
  error: unknown,
  context: string,
  status: number = 500
): Response {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorDetails = error instanceof Error ? error.stack : String(error);

  console.error('Error in %s:', context, { error, errorMessage, errorDetails });

  return errorResponse(
    `${context} failed`,
    status,
    errorMessage,
    'OPERATION_FAILED'
  );
}
