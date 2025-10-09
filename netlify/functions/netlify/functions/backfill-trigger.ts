import { Handler } from '@netlify/functions';
import { manualBackfillServerClient } from '../../src/lib/manual-backfill/server-client';

export const handler: Handler = async (event) => {
  // Standard headers for all responses
  const headers = {
    'Content-Type': 'application/json',
  };

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        Allow: 'POST',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check if API is configured
  if (!process.env.GH_DATPIPE_KEY) {
    console.warn('[backfill-trigger] GH_DATPIPE_KEY not configured - service unavailable');
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'Service unavailable',
        message:
          'Backfill service is temporarily unavailable. Please try again later or use the sync button for immediate updates.',
        code: 'SERVICE_UNAVAILABLE',
        service: 'gh-datapipe',
      }),
    };
  }

  // Parse request body outside try-catch for error logging
  let body: { repository?: string; days?: number; force?: boolean; callback_url?: string } = {};
  let parseError: Error | null = null;

  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    parseError = error instanceof Error ? error : new Error('Invalid JSON');
  }

  try {
    // Check for JSON parse error
    if (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Bad request',
          message: 'Invalid JSON in request body',
          details: parseError.message,
        }),
      };
    }

    if (!body.repository) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Bad request',
          message: 'Repository is required',
        }),
      };
    }

    // Validate repository format
    if (!body.repository.match(/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Bad request',
          message: 'Invalid repository format. Expected: owner/name',
        }),
      };
    }

    // Log request details for diagnostics
    console.log('[backfill-trigger] Processing request:', {
      repository: body.repository,
      days: body.days || 30,
      force: body.force || false,
      hasCallbackUrl: Boolean(body.callback_url),
      timestamp: new Date().toISOString(),
    });

    // Trigger backfill via the server client
    const result = await manualBackfillServerClient.triggerBackfill({
      repository: body.repository,
      days: body.days || 30,
      force: body.force || false,
      callback_url: body.callback_url,
    });

    console.log('[backfill-trigger] Success:', {
      job_id: result.job_id,
      repository: body.repository,
      status: result.status,
    });

    return {
      statusCode: 202,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    // Enhanced error logging for diagnostics
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[backfill-trigger] Detailed error:', {
      error: errorMessage,
      stack: errorStack,
      repository: body.repository, // Safe to access now
      timestamp: new Date().toISOString(),
      ghDatapipeUrl: process.env.GH_DATPIPE_API_URL || 'not-configured',
      hasApiKey: Boolean(process.env.GH_DATPIPE_KEY),
    });

    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';

    // Determine appropriate status code and error code
    if (errorMessage.includes('Rate limit') || errorMessage.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMITED';
    } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      statusCode = 502;
      errorCode = 'NETWORK_ERROR';
    } else if (errorMessage.includes('timeout')) {
      statusCode = 504;
      errorCode = 'TIMEOUT';
    } else if (errorMessage.includes('not configured')) {
      statusCode = 503;
      errorCode = 'SERVICE_UNAVAILABLE';
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: 'Backfill trigger failed',
        message: `Failed to trigger backfill: ${errorMessage}`,
        code: errorCode,
        service: 'backfill-trigger',
        diagnostic: {
          hasGhDatapipeKey: Boolean(process.env.GH_DATPIPE_KEY),
          ghDatapipeUrl: process.env.GH_DATPIPE_API_URL || 'default',
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
};
