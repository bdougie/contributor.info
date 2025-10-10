import { Handler } from '@netlify/functions';

// Store active SSE connections (in production, use Redis or similar)
// const activeConnections = new Map<string, any>();

export const handler: Handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check if API is configured
  if (!process.env.GH_DATPIPE_KEY) {
    return {
      statusCode: 503,
      body: JSON.stringify({
        error: 'Service unavailable',
        message: 'Manual backfill service is not configured',
      }),
    };
  }

  // Extract job ID from query parameters
  const jobId = event.queryStringParameters?.job_id;

  // Note: Netlify Functions don't support true SSE streaming
  // This is a workaround that returns the current status
  // For real SSE, you'd need to use a different service or Edge Functions

  try {
    // In a real implementation, this would connect to the gh-datapipe SSE endpoint
    // For now, we'll return a polling suggestion to the client

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
      },
      body: `data: ${JSON.stringify({
        type: 'connection',
        message:
          'Connected to event stream. Note: Netlify Functions have limited SSE support. Consider polling /api/backfill/status/{job_id} instead.',
        job_id: jobId,
        timestamp: new Date().toISOString(),
      })}\n\n`,
    };
  } catch (error) {
    console.error('[backfill-events] Error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Failed to establish event stream',
      }),
    };
  }
};
