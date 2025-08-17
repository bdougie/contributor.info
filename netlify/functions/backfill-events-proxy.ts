import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const jobId = event.queryStringParameters?.job_id;
  if (!jobId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing job_id parameter' }),
    };
  }

  const apiKey = process.env.GH_DATPIPE_KEY;
  
  if (!apiKey) {
    console.error('[backfill-events-proxy] No GH_DATPIPE_KEY configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  try {
    
    // Since Netlify Functions don't support streaming responses directly,
    // we'll return a redirect to a polling endpoint instead
    // This is a limitation of Netlify Functions
    
    // For now, return an error indicating SSE is not supported
    return {
      statusCode: 501,
      body: JSON.stringify({ 
        error: 'Server-Sent Events not supported in Netlify Functions',
        message: 'Please use polling endpoint /api/backfill/status/:jobId instead'
      }),
    };
  } catch (error) {
    console.error('[backfill-events-proxy] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};