import { Handler } from '@netlify/functions';
import { Polar } from '@polar-sh/sdk';
import { createClient } from '@supabase/supabase-js';
import { trackServerEvent, captureServerException } from './lib/server-tracking.mts';

// Initialize Polar client
// Note: Netlify functions need non-VITE prefixed env vars
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN || '',
  server: (process.env.POLAR_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
});

// Initialize Supabase client with Service Role Key to bypass RLS for ownership verification
// We verify user identity via the passed token, then use admin privileges to check database
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
// Use Service Role Key for admin access to database
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
// Use Anon Key for verifying the user token
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing authorization header' }),
      };
    }

    // Verify user with Supabase Anon client (validates the JWT)
    const {
      data: { user },
      error: authError,
    } = await supabaseAnon.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Subscription ID is required' }),
      };
    }

    // Verify ownership of the subscription using Admin client
    // We check if the subscription exists in our database and belongs to the user
    const { data: subscriptionRecord, error: dbError } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('polar_subscription_id', subscriptionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (dbError) {
      console.error('Database error verifying subscription:', dbError);
      throw new Error('Internal database error');
    }

    if (!subscriptionRecord) {
      // Return 404 to avoid leaking existence of other subscriptions
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Subscription not found' }),
      };
    }

    // Revoke (cancel) subscription via Polar API
    const subscription = await polar.subscriptions.revoke({
      id: subscriptionId,
    });

    await trackServerEvent(
      'subscription_canceled',
      {
        subscription_id: subscriptionId,
      },
      user.id
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(subscription),
    };
  } catch (error) {
    console.error('Error canceling subscription:', error);

    await captureServerException(error instanceof Error ? error : new Error(String(error)), {
      level: 'error',
      tags: { type: 'subscription_cancellation_failed' },
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to cancel subscription',
        // Don't expose internal error details
        details: 'An unexpected error occurred while processing your request',
      }),
    };
  }
};
