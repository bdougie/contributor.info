import { Handler } from '@netlify/functions';
import { manualBackfillServerClient } from '../../src/lib/manual-backfill/server-client';

export const handler: Handler = async (event) => {
  // Standard headers for all responses
  const headers = {
    'Content-Type': 'application/json',
  };

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        Allow: 'GET',
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
    // Extract job ID from path
    // Path format: /api/backfill/status/{job_id}
    const pathParts = event.path.split('/');
    const jobId = pathParts[pathParts.length - 1];

    if (!jobId || jobId === 'status') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Bad request',
          message: 'Job ID is required',
        }),
      };
    }

    // Get job status via the server client
    const status = await manualBackfillServerClient.getJobStatus(jobId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(status),
    };
  } catch (error) {
    console.error('[backfill-status] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: statusCode === 404 ? 'Not found' : 'Internal server error',
        message: errorMessage,
      }),
    };
  }
};
