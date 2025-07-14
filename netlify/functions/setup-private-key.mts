import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

/**
 * Setup endpoint to store private key in Netlify Blobs
 * POST /api/github/setup-private-key
 * 
 * Body: { privateKey: "base64-encoded-key" }
 */
export const handler: Handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check for admin key (add ADMIN_KEY to env vars for security)
  const adminKey = event.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    if (!body.privateKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Private key required' }),
      };
    }

    // Decode from base64
    const privateKey = Buffer.from(body.privateKey, 'base64').toString();
    
    // Store in Netlify Blobs
    const store = getStore('github-app');
    await store.set('private-key', privateKey);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        message: 'Private key stored successfully in Netlify Blobs',
        keyPreview: privateKey.substring(0, 50) + '...' 
      }),
    };
  } catch (error) {
    console.error('Error storing private key:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to store private key',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};