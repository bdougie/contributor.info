import { Handler } from '@netlify/functions';
import { Polar } from '@polar-sh/sdk';
import { trackServerEvent, captureServerException } from './lib/server-tracking.mts';

// Initialize Polar client
// Note: Netlify functions need non-VITE prefixed env vars
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN || '',
  server: (process.env.POLAR_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
});

export const handler: Handler = async (event) => {
  // CORS headers for local development
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { productPriceId, customerEmail, metadata } = body;

    if (!productPriceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Product ID is required' }),
      };
    }

    // Determine the base URL from environment or request headers
    const baseUrl =
      process.env.URL ||
      process.env.BASE_URL ||
      (event.headers?.origin ? event.headers.origin : 'https://contributor.info');

    // Create checkout session - Polar expects 'products' array with price IDs as strings
    const checkout = await polar.checkouts.create({
      products: [productPriceId],
      successUrl: `${baseUrl}/billing?success=true`,
      // @ts-ignore - Polar SDK type mismatch for cancelUrl/returnUrl
      returnUrl: `${baseUrl}/billing?canceled=true`,
      customerEmail,
      metadata,
    });

    await trackServerEvent(
      'checkout_session_created',
      {
        product_price_id: productPriceId,
        customer_email: customerEmail,
        ...metadata,
      },
      metadata?.user_id
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: checkout.id,
        url: checkout.url,
      }),
    };
  } catch (error) {
    console.error('Error creating checkout:', error);

    await captureServerException(error instanceof Error ? error : new Error(String(error)), {
      level: 'error',
      tags: { type: 'checkout_creation_failed' },
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
