import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get Inngest configuration
const INNGEST_SIGNING_KEY =
  Deno.env.get('INNGEST_SIGNING_KEY') || Deno.env.get('INNGEST_PRODUCTION_SIGNING_KEY') || '';

serve(async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-inngest-signature, X-Inngest-Signature, x-inngest-sdk, X-Inngest-SDK, x-inngest-server-kind, X-Inngest-Server-Kind`,
      },
    });
  }

  // Handle HEAD requests (health checks)
  if (method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Handle GET requests - Inngest introspection
  if (method === 'GET') {
    // Check if this is an Inngest introspection request
    if (url.searchParams.has('introspect')) {
      // Return function definitions for Inngest
      return new Response(
        JSON.stringify({
          framework: 'deno',
          app: 'contributor-info',
          functions: [
            {
              id: 'prod-test-function',
              name: 'Production Test Function',
              triggers: [{ event: 'test/prod.hello' }],
            },
            {
              id: 'capture-repository-sync-graphql',
              name: 'Sync Recent Repository PRs (GraphQL)',
              triggers: [{ event: 'capture/repository.sync.graphql' }],
            },
            {
              id: 'classify-single-repository',
              name: 'Classify Single Repository',
              triggers: [{ event: 'classify/repository.single' }],
            },
          ],
          hasEventKey: !!Deno.env.get('INNGEST_EVENT_KEY'),
          hasSigningKey: !!INNGEST_SIGNING_KEY,
          mode: 'cloud',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Default status page
    return new Response(
      JSON.stringify({
        message: 'Inngest Production endpoint (Supabase Edge)',
        status: 'active',
        endpoint: '/functions/v1/inngest-prod',
        environment: {
          runtime: 'deno',
          platform: 'supabase-edge',
          hasSigningKey: !!INNGEST_SIGNING_KEY,
        },
        ready: true,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Handle PUT requests - Inngest registration
  if (method === 'PUT') {
    try {
      const body = await req.json();
      console.log('Inngest registration request:', body);

      // Return success for registration
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Endpoint registered',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Error handling PUT request:', error);
      return new Response(JSON.stringify({ error: 'Failed to process registration' }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  }

  // Handle POST requests - Inngest webhooks
  if (method === 'POST') {
    try {
      // Verify signature if present
      const signature =
        req.headers.get('x-inngest-signature') || req.headers.get('X-Inngest-Signature');

      if (signature && INNGEST_SIGNING_KEY) {
        // TODO: Implement signature verification
        console.log('Signature present, would verify in production');
      }

      const body = await req.json();
      console.log('Received webhook event:', body);

      // Process the event based on type
      if (body.name === 'test/prod.hello') {
        console.log('Processing test event:', body.data);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Test event processed',
            data: body.data,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // For now, acknowledge all events
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Event received',
          event: body.name,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response(JSON.stringify({ error: 'Failed to process webhook' }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  }

  // Method not allowed
  return new Response(JSON.stringify({ error: `Method ${method} not allowed` }), {
    status: 405,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
});
