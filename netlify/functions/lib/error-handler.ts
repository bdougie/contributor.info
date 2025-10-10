import { APIError, APIResponse, generateRequestId } from '../../../../../src/lib/api/error-types';

export class APIErrorHandler {
  static createError(
    code: string,
    category: APIError['category'],
    message: string,
    userMessage: string,
    options: {
      details?: Record<string, unknown>;
      statusCode?: number;
      retryable?: boolean;
      requestId?: string;
    } = {}
  ): APIError {
    return {
      code,
      message,
      userMessage,
      category,
      details: options.details,
      timestamp: new Date().toISOString(),
      requestId: options.requestId || generateRequestId(),
      retryable: options.retryable || false,
    };
  }

  static createResponse<T>(data?: T, error?: APIError, requestId?: string): APIResponse<T> {
    return {
      success: !error,
      data,
      error,
      meta: {
        requestId: requestId || generateRequestId(),
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
    };
  }

  static handleDatabaseError(error: unknown, context: string, requestId: string): APIError {
    const err = error as { code?: string; message?: string };

    // Supabase-specific error handling
    if (err.code === 'PGRST116') {
      return this.createError(
        'REPOSITORY_NOT_FOUND',
        'not_found',
        `Repository not found in database: ${err.message}`,
        'Repository is not being tracked. Please add it to start using this feature.',
        { requestId, retryable: false }
      );
    }

    if (err.code === '42P01') {
      return this.createError(
        'DATABASE_SCHEMA_ERROR',
        'server_error',
        `Database schema error in ${context}: ${err.message}`,
        'Service temporarily unavailable. Please try again later.',
        { requestId, retryable: true }
      );
    }

    return this.createError(
      'DATABASE_ERROR',
      'server_error',
      `Database error in ${context}: ${err.message || 'Unknown error'}`,
      'Database temporarily unavailable. Please try again in a moment.',
      { requestId, retryable: true }
    );
  }

  static handleValidationError(
    field: string,
    value: unknown,
    expectedFormat: string,
    requestId: string
  ): APIError {
    return this.createError(
      'VALIDATION_ERROR',
      'validation',
      `Invalid ${field}: expected ${expectedFormat}, got ${typeof value}`,
      `Invalid ${field} format. ${expectedFormat} is required.`,
      {
        requestId,
        retryable: false,
        details: {
          field,
          expectedFormat,
          received: typeof value,
          value: value,
        },
      }
    );
  }

  static handleGitHubAPIError(error: unknown, operation: string, requestId: string): APIError {
    const err = error as { status?: number; message?: string };

    if (err.status === 404) {
      return this.createError(
        'GITHUB_RESOURCE_NOT_FOUND',
        'external_api',
        `GitHub resource not found: ${err.message}`,
        'The requested GitHub resource was not found. Please check the URL and try again.',
        {
          requestId,
          retryable: false,
          details: { operation, status: err.status },
        }
      );
    }

    if (err.status === 403) {
      return this.createError(
        'GITHUB_RATE_LIMIT',
        'rate_limit',
        `GitHub API rate limit exceeded: ${err.message}`,
        'GitHub API rate limit exceeded. Please try again in a few minutes.',
        {
          requestId,
          retryable: true,
          details: { operation, status: err.status },
        }
      );
    }

    return this.createError(
      'GITHUB_API_ERROR',
      'external_api',
      `GitHub API error during ${operation}: ${err.message || 'Unknown error'}`,
      'Unable to fetch data from GitHub. Please try again later.',
      {
        requestId,
        retryable: true,
        details: { operation, status: err.status },
      }
    );
  }
}
