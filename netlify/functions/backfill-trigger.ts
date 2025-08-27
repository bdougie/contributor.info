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
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'Service unavailable',
        message: 'Manual backfill service is not configured',
      }),
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');

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

    // Trigger backfill via the server client
    const result = await manualBackfillServerClient.triggerBackfill({
      repository: body.repository,
      days: body.days || 30,
      force: body.force || false,
      callback_url: body.callback_url,
    });

    return {
      statusCode: 202,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[backfill-trigger] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('Rate limit') ? 429 : 500;

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
      }),
    };
  }
};
