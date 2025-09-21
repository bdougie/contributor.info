import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Inngest Edge Function starting...');

serve(async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  console.log(`${method} ${url.pathname}${url.search}`);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Handle HEAD requests (health checks)
  if (method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'X-Inngest-Ready': 'true',
      },
    });
  }

  // Handle GET requests - Inngest introspection or status
  if (method === 'GET') {
    // Simple introspection response that Inngest expects
    const response = {
      framework: 'deno',
      app: 'contributor-info',
      functions: [
        {
          id: 'test-function',
          name: 'Test Function',
          triggers: [{ event: 'test.event' }],
        },
      ],
      hasEventKey: true,
      hasSigningKey: true,
      mode: 'cloud',
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  // Handle PUT requests - Inngest registration
  if (method === 'PUT') {
    console.log('PUT registration received');

    // Just return 200 OK for registration
    return new Response('OK', {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Handle POST requests - Inngest webhooks
  if (method === 'POST') {
    try {
      const body = await req.text();
      console.log('POST body:', body);

      // Return simple 200 OK - no JSON wrapper
      return new Response('OK', {
        status: 200,
        headers: corsHeaders,
      });
    } catch (error) {
      console.error('POST error:', error);
      // Still return 200 to avoid Inngest marking as failed
      return new Response('OK', {
        status: 200,
        headers: corsHeaders,
      });
    }
  }

  // Any other method
  return new Response('Method Not Allowed', {
    status: 405,
    headers: corsHeaders,
  });
});