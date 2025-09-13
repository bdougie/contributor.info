import { Handler } from '@netlify/functions';
import { Polar } from '@polar-sh/sdk';

// Initialize Polar client
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN || process.env.VITE_POLAR_ACCESS_TOKEN || '',
  server: (process.env.POLAR_ENVIRONMENT || process.env.VITE_POLAR_ENVIRONMENT || 'sandbox') as
    | 'sandbox'
    | 'production',
});

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { productPriceId, customerEmail, metadata } = body;

    if (!productPriceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Product ID is required' }),
      };
    }

    // Create checkout session
    const checkout = await polar.checkouts.create({
      productPriceId,
      successUrl: `${process.env.BASE_URL || process.env.URL || 'http://localhost:8888'}/billing?success=true`,
      customerEmail,
      metadata,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: checkout.id,
        url: checkout.url,
      }),
    };
  } catch (error) {
    console.error('Error creating checkout:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
