import { Handler } from '@netlify/functions';
import { inngest } from '../../src/lib/inngest/client';

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

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.repositoryId || !body.repositoryName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Bad request',
          message: 'repositoryId and repositoryName are required',
        }),
      };
    }

    // Send sync event to Inngest
    const result = await inngest.send({
      name: 'capture/repository.sync.graphql',
      data: {
        repositoryId: body.repositoryId,
        repositoryName: body.repositoryName,
        days: body.days || 7,
        priority: body.priority || 'critical',
        reason: body.reason || 'manual',
        triggeredBy: body.triggeredBy || 'server_side_fallback',
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        result: result,
        message: 'Inngest sync job queued successfully',
      }),
    };
  } catch (error) {
    console.error('[trigger-inngest-sync] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
      }),
    };
  }
};
