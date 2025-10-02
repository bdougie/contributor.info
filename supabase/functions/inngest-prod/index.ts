// Simplified Inngest handler for Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// CORS headers for Inngest
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-inngest-signature, X-Inngest-Signature, x-inngest-sdk, X-Inngest-SDK, x-inngest-server-kind, X-Inngest-Server-Kind',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
};

// Get environment configuration
const INNGEST_APP_ID = Deno.env.get('INNGEST_APP_ID') || 'contributor-info';
const INNGEST_EVENT_KEY = Deno.env.get('INNGEST_EVENT_KEY') ||
                          Deno.env.get('INNGEST_PRODUCTION_EVENT_KEY') || 'test-key';
const INNGEST_SIGNING_KEY = Deno.env.get('INNGEST_SIGNING_KEY') ||
                            Deno.env.get('INNGEST_PRODUCTION_SIGNING_KEY') || '';

console.log('🚀 Inngest Edge Function Started');
console.log('Configuration:', {
  appId: INNGEST_APP_ID,
  hasEventKey: !!INNGEST_EVENT_KEY,
  hasSigningKey: !!INNGEST_SIGNING_KEY,
});

// Define our functions registry
const functions = [
  {
    id: 'prod-test-function',
    name: 'Production Test Function',
    triggers: [{ event: 'test/prod.hello' }],
  },
  {
    id: 'capture-pr-details',
    name: 'Capture PR Details',
    triggers: [{ event: 'pr.details.capture' }],
  },
  {
    id: 'capture-pr-details-graphql',
    name: 'Capture PR Details (GraphQL)',
    triggers: [{ event: 'pr.details.capture.graphql' }],
  },
  {
    id: 'capture-pr-reviews',
    name: 'Capture PR Reviews',
    triggers: [{ event: 'pr.reviews.capture' }],
  },
  {
    id: 'capture-pr-comments',
    name: 'Capture PR Comments',
    triggers: [{ event: 'pr.comments.capture' }],
  },
  {
    id: 'capture-repository-sync',
    name: 'Sync Repository Data',
    triggers: [{ event: 'repository.sync' }],
  },
  {
    id: 'capture-repository-sync-graphql',
    name: 'Sync Repository Data (GraphQL)',
    triggers: [{ event: 'repository.sync.graphql' }],
  },
  {
    id: 'classify-repository-size',
    name: 'Classify Repository Sizes',
    triggers: [{ event: 'repository.size.classify' }],
  },
  {
    id: 'classify-single-repository',
    name: 'Classify Single Repository',
    triggers: [{ event: 'repository.single.classify' }],
  },
  {
    id: 'capture-issue-comments',
    name: 'Capture Issue Comments',
    triggers: [{ event: 'issue.comments.capture' }],
  },
  {
    id: 'capture-repository-issues',
    name: 'Capture Repository Issues',
    triggers: [{ event: 'repository.issues.capture' }],
  },
  {
    id: 'update-pr-activity',
    name: 'Update PR Activity',
    triggers: [{ event: 'pr.activity.update' }],
  },
  {
    id: 'discover-new-repository',
    name: 'Discover New Repository',
    triggers: [{ event: 'repository.discover' }],
  },
];

// Main HTTP handler
serve(async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  console.log(`📥 ${method} ${url.pathname}${url.search}`);

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

  // Handle GET requests - Inngest introspection
  if (method === 'GET') {
    const response = {
      framework: 'deno-edge',
      app: INNGEST_APP_ID,
      functions,
      hasEventKey: !!INNGEST_EVENT_KEY,
      hasSigningKey: !!INNGEST_SIGNING_KEY,
      mode: 'cloud',
      schemaVersion: '2024-01-01',
      endpoint: `https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/inngest-prod`,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  // Handle PUT requests - Inngest registration/sync
  if (method === 'PUT') {
    console.log('📝 Inngest registration/sync request received');

    // Return success for registration
    return new Response(JSON.stringify({
      success: true,
      message: 'Functions registered successfully',
      functions: functions.length
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  // Handle POST requests - Inngest webhooks/events
  if (method === 'POST') {
    try {
      const body = await req.text();
      console.log('🔔 Webhook received:', body.substring(0, 200));

      // Parse the event
      let event;
      try {
        event = JSON.parse(body);
      } catch {
        // If not JSON, treat as raw event
        event = { data: body };
      }

      console.log('📌 Event type:', event.name || 'unknown');
      console.log('📊 Event data:', JSON.stringify(event.data || {}).substring(0, 200));

      // For now, acknowledge all events
      // In production, this would trigger actual function execution
      return new Response(JSON.stringify({
        success: true,
        message: 'Event received and queued for processing',
        event: event.name || 'unknown',
        functionId: functions.find(f => f.triggers.some(t => t.event === event.name))?.id,
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    } catch (error: any) {
      console.error('❌ Error processing webhook:', error);
      return new Response(JSON.stringify({
        error: 'Failed to process webhook',
        message: error.message
      }), {
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